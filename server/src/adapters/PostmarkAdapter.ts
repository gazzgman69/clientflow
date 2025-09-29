import type {
  MailAdapter,
  AuthConfig,
  TenantContext,
  SendEmailRequest,
  SendEmailResponse,
  VerifyCredentialsResult,
  WebhookConfig,
  WebhookSetupResult
} from '@shared/mailAdapter';
import {
  AuthenticationError,
  MailAdapterError,
  QuotaExceededError,
  RateLimitError,
  NetworkError
} from '@shared/mailAdapter';

export class PostmarkAdapter implements MailAdapter {
  readonly providerId = 'postmark';
  private tenantContext: TenantContext | null = null;
  private authConfig: AuthConfig | null = null;

  async connect(auth: AuthConfig, tenantContext: TenantContext): Promise<void> {
    try {
      this.authConfig = auth;
      this.tenantContext = tenantContext;
      
      if (!auth.apiKey) {
        throw new AuthenticationError('postmark', { message: 'Server API token is required' });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Postmark adapter connected for tenant:', tenantContext.tenantId);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Postmark connection failed:', error);
      }
      throw new AuthenticationError('postmark', { originalError: error });
    }
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (!this.authConfig || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'postmark');
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Postmark sending email:', {
          to: Array.isArray(request.to) ? request.to : [request.to],
          subject: request.subject,
          from: request.from || this.authConfig.fromEmail
        });
      }

      // Build Postmark API request
      const postmarkPayload = {
        From: request.from || this.authConfig.fromEmail || 'noreply@example.com',
        To: Array.isArray(request.to) ? request.to.join(',') : request.to,
        Cc: request.cc ? (Array.isArray(request.cc) ? request.cc.join(',') : request.cc) : undefined,
        Bcc: request.bcc ? (Array.isArray(request.bcc) ? request.bcc.join(',') : request.bcc) : undefined,
        Subject: request.subject,
        TextBody: request.text || undefined,
        HtmlBody: request.html || undefined,
        ReplyTo: request.replyTo || undefined,
        Headers: [
          ...(request.headers ? Object.entries(request.headers).map(([key, value]) => ({ Name: key, Value: value })) : []),
          { Name: 'X-Tenant-ID', Value: this.tenantContext.tenantId },
          { Name: 'X-User-ID', Value: this.tenantContext.userId }
        ],
        TrackOpens: true,
        TrackLinks: 'HtmlOnly',
        MessageStream: 'outbound'
      };

      // Remove undefined fields
      Object.keys(postmarkPayload).forEach(key => {
        if (postmarkPayload[key as keyof typeof postmarkPayload] === undefined) {
          delete postmarkPayload[key as keyof typeof postmarkPayload];
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Postmark API payload:', JSON.stringify(postmarkPayload, null, 2));
      }

      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.authConfig.apiKey
        },
        body: JSON.stringify(postmarkPayload)
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Postmark response status:', response.status);
        console.log('📧 [DEBUG] Postmark response headers:', Object.fromEntries(response.headers.entries()));
      }

      const responseData = await response.json();

      if (response.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 [DEBUG] Postmark success response:', responseData);
        }
        
        return {
          success: true,
          messageId: responseData.MessageID || 'postmark-sent-' + Date.now(),
          providerId: this.providerId,
          details: responseData
        };
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 [DEBUG] Postmark error response:', responseData);
        }

        // Handle specific Postmark errors
        if (response.status === 422 && responseData.ErrorCode === 406) {
          throw new AuthenticationError('postmark', { response: responseData });
        } else if (response.status === 429) {
          throw new RateLimitError('postmark', undefined, { response: responseData });
        } else if (responseData.ErrorCode === 405) {
          throw new QuotaExceededError('postmark', { response: responseData });
        }

        return {
          success: false,
          providerId: this.providerId,
          error: `Postmark API error: ${responseData.ErrorCode} - ${responseData.Message}`
        };
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Postmark send error:', error);
      }

      if (error instanceof MailAdapterError) {
        throw error; // Re-throw our custom errors
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('postmark', { originalError: error });
      }
      
      throw new MailAdapterError(
        `Postmark send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_FAILED',
        'postmark',
        true,
        { originalError: error }
      );
    }
  }

  async verifyCredentials(): Promise<VerifyCredentialsResult> {
    if (!this.authConfig) {
      return {
        success: false,
        error: 'Not connected'
      };
    }

    try {
      // Test API token by getting server info
      const response = await fetch('https://api.postmarkapp.com/server', {
        headers: {
          'Accept': 'application/json',
          'X-Postmark-Server-Token': this.authConfig.apiKey
        }
      });

      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          details: {
            serverReachable: true,
            authValid: true,
            quotaInfo: {
              used: responseData.MonthlyEmailsSent || 0,
              limit: responseData.MonthlyEmailsAllowed || 0,
              percentage: responseData.MonthlyEmailsAllowed > 0 
                ? (responseData.MonthlyEmailsSent / responseData.MonthlyEmailsAllowed) * 100 
                : 0
            }
          }
        };
      } else {
        return {
          success: false,
          error: `Postmark API error: ${responseData.ErrorCode} - ${responseData.Message}`,
          details: {
            serverReachable: true,
            authValid: false
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          serverReachable: false,
          authValid: false
        }
      };
    }
  }

  async webhookSetup(config: WebhookConfig): Promise<WebhookSetupResult> {
    if (!this.authConfig) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'postmark');
    }

    try {
      const webhookPayload = {
        Url: config.url,
        MessageStream: 'outbound',
        HttpAuth: config.secret ? {
          Username: 'webhook',
          Password: config.secret
        } : undefined,
        HttpHeaders: [
          { Name: 'X-Webhook-Source', Value: 'postmark' }
        ],
        Triggers: {
          Open: { Enabled: config.events?.includes('opened') || false },
          Click: { Enabled: config.events?.includes('clicked') || false },
          Delivery: { Enabled: config.events?.includes('delivered') || true },
          Bounce: { Enabled: config.events?.includes('bounced') || true },
          SpamComplaint: { Enabled: config.events?.includes('complained') || true },
          SubscriptionChange: { Enabled: false }
        }
      };

      const response = await fetch('https://api.postmarkapp.com/webhooks', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.authConfig.apiKey
        },
        body: JSON.stringify(webhookPayload)
      });

      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          webhookId: responseData.ID?.toString() || 'postmark-webhook-' + Date.now()
        };
      } else {
        return {
          success: false,
          error: `Postmark webhook setup failed: ${responseData.ErrorCode} - ${responseData.Message}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getCapabilities() {
    return {
      canSend: true,
      canReceive: false,
      supportsWebhooks: true,
      supportsAttachments: true,
      supportsHtml: true
    };
  }

  async disconnect(): Promise<void> {
    this.authConfig = null;
    this.tenantContext = null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEBUG] Postmark adapter disconnected');
    }
  }
}