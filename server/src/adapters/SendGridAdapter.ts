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

export class SendGridAdapter implements MailAdapter {
  readonly providerId = 'sendgrid';
  private tenantContext: TenantContext | null = null;
  private authConfig: AuthConfig | null = null;

  async connect(auth: AuthConfig, tenantContext: TenantContext): Promise<void> {
    try {
      this.authConfig = auth;
      this.tenantContext = tenantContext;
      
      if (!auth.apiKey) {
        throw new AuthenticationError('sendgrid', { message: 'API key is required' });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] SendGrid adapter connected for tenant:', tenantContext.tenantId);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] SendGrid connection failed:', error);
      }
      throw new AuthenticationError('sendgrid', { originalError: error });
    }
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (!this.authConfig || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'sendgrid');
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] SendGrid sending email:', {
          to: Array.isArray(request.to) ? request.to : [request.to],
          subject: request.subject,
          from: request.from || this.authConfig.fromEmail
        });
      }

      // Build SendGrid API request
      const sendGridPayload = {
        personalizations: [{
          to: (Array.isArray(request.to) ? request.to : [request.to]).map(email => ({ email })),
          cc: request.cc ? (Array.isArray(request.cc) ? request.cc : [request.cc]).map(email => ({ email })) : undefined,
          bcc: request.bcc ? (Array.isArray(request.bcc) ? request.bcc : [request.bcc]).map(email => ({ email })) : undefined,
          subject: request.subject
        }],
        from: {
          email: request.from || this.authConfig.fromEmail || 'noreply@example.com',
          name: this.authConfig.fromName
        },
        reply_to: request.replyTo ? { email: request.replyTo } : undefined,
        content: [
          ...(request.text ? [{ type: 'text/plain', value: request.text }] : []),
          ...(request.html ? [{ type: 'text/html', value: request.html }] : [])
        ],
        custom_args: {
          tenant_id: this.tenantContext.tenantId,
          user_id: this.tenantContext.userId
        }
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] SendGrid API payload:', JSON.stringify(sendGridPayload, null, 2));
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendGridPayload)
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] SendGrid response status:', response.status);
        console.log('📧 [DEBUG] SendGrid response headers:', Object.fromEntries(response.headers.entries()));
      }

      if (response.ok) {
        const messageId = response.headers.get('x-message-id') || 'sendgrid-sent-' + Date.now();
        
        return {
          success: true,
          messageId,
          providerId: this.providerId
        };
      } else {
        const errorData = await response.text();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 [DEBUG] SendGrid error response:', errorData);
        }

        // Handle specific SendGrid errors
        if (response.status === 413) {
          throw new QuotaExceededError('sendgrid', { response: errorData });
        } else if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          throw new RateLimitError('sendgrid', retryAfter ? parseInt(retryAfter) : undefined, { response: errorData });
        } else if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError('sendgrid', { response: errorData });
        }

        return {
          success: false,
          providerId: this.providerId,
          error: `SendGrid API error: ${response.status} - ${errorData}`
        };
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] SendGrid send error:', error);
      }

      if (error instanceof MailAdapterError) {
        throw error; // Re-throw our custom errors
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('sendgrid', { originalError: error });
      }
      
      throw new MailAdapterError(
        `SendGrid send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_FAILED',
        'sendgrid',
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
      // Test API key by getting account info
      const response = await fetch('https://api.sendgrid.com/v3/user/account', {
        headers: {
          'Authorization': `Bearer ${this.authConfig.apiKey}`
        }
      });

      if (response.ok) {
        const accountInfo = await response.json();
        
        return {
          success: true,
          details: {
            serverReachable: true,
            authValid: true,
            quotaInfo: {
              // SendGrid doesn't provide quota in account endpoint
              // Would need separate API call to get usage stats
            }
          }
        };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `SendGrid API error: ${response.status} - ${errorData}`,
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
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'sendgrid');
    }

    try {
      const webhookPayload = {
        url: config.url,
        enabled: true,
        bounce: config.events?.includes('bounced') || true,
        click: config.events?.includes('clicked') || false,
        deferred: config.events?.includes('deferred') || false,
        delivered: config.events?.includes('delivered') || true,
        dropped: config.events?.includes('dropped') || true,
        open: config.events?.includes('opened') || false,
        processed: config.events?.includes('processed') || false,
        spam_report: config.events?.includes('spam_report') || true,
        unsubscribe: config.events?.includes('unsubscribed') || false
      };

      const response = await fetch('https://api.sendgrid.com/v3/user/webhooks/event/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.authConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (response.ok) {
        return {
          success: true,
          webhookId: 'sendgrid-webhook-' + Date.now()
        };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `SendGrid webhook setup failed: ${response.status} - ${errorData}`
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
      console.log('📧 [DEBUG] SendGrid adapter disconnected');
    }
  }
}