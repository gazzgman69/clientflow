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

export class MailgunAdapter implements MailAdapter {
  readonly providerId = 'mailgun';
  private tenantContext: TenantContext | null = null;
  private authConfig: AuthConfig | null = null;

  async connect(auth: AuthConfig, tenantContext: TenantContext): Promise<void> {
    try {
      this.authConfig = auth;
      this.tenantContext = tenantContext;
      
      if (!auth.apiKey) {
        throw new AuthenticationError('mailgun', { message: 'API key is required' });
      }
      
      if (!auth.domain) {
        throw new AuthenticationError('mailgun', { message: 'Domain is required' });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Mailgun adapter connected for tenant:', tenantContext.tenantId);
        console.log('📧 [DEBUG] Mailgun domain:', auth.domain);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Mailgun connection failed:', error);
      }
      throw new AuthenticationError('mailgun', { originalError: error });
    }
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (!this.authConfig || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'mailgun');
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Mailgun sending email:', {
          to: Array.isArray(request.to) ? request.to : [request.to],
          subject: request.subject,
          from: request.from || this.authConfig.fromEmail,
          domain: this.authConfig.domain
        });
      }

      // Build Mailgun API request using form data
      const formData = new FormData();
      formData.append('from', request.from || this.authConfig.fromEmail || 'noreply@' + this.authConfig.domain);
      formData.append('to', Array.isArray(request.to) ? request.to.join(',') : request.to);
      
      if (request.cc) {
        formData.append('cc', Array.isArray(request.cc) ? request.cc.join(',') : request.cc);
      }
      
      if (request.bcc) {
        formData.append('bcc', Array.isArray(request.bcc) ? request.bcc.join(',') : request.bcc);
      }
      
      formData.append('subject', request.subject);
      
      if (request.text) {
        formData.append('text', request.text);
      }
      
      if (request.html) {
        formData.append('html', request.html);
      }
      
      if (request.replyTo) {
        formData.append('h:Reply-To', request.replyTo);
      }
      
      // Add custom headers for tracking
      formData.append('v:tenant_id', this.tenantContext.tenantId);
      formData.append('v:user_id', this.tenantContext.userId);

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Mailgun API request to:', `https://api.mailgun.net/v3/${this.authConfig.domain}/messages`);
      }

      const response = await fetch(`https://api.mailgun.net/v3/${this.authConfig.domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.authConfig.apiKey}`).toString('base64')}`
        },
        body: formData
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Mailgun response status:', response.status);
        console.log('📧 [DEBUG] Mailgun response headers:', Object.fromEntries(response.headers.entries()));
      }

      if (response.ok) {
        const responseData = await response.json();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 [DEBUG] Mailgun success response:', responseData);
        }
        
        return {
          success: true,
          messageId: responseData.id || 'mailgun-sent-' + Date.now(),
          providerId: this.providerId,
          details: responseData
        };
      } else {
        const errorData = await response.text();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 [DEBUG] Mailgun error response:', errorData);
        }

        // Handle specific Mailgun errors
        if (response.status === 402) {
          throw new QuotaExceededError('mailgun', { response: errorData });
        } else if (response.status === 429) {
          throw new RateLimitError('mailgun', undefined, { response: errorData });
        } else if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError('mailgun', { response: errorData });
        }

        return {
          success: false,
          providerId: this.providerId,
          error: `Mailgun API error: ${response.status} - ${errorData}`
        };
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Mailgun send error:', error);
      }

      if (error instanceof MailAdapterError) {
        throw error; // Re-throw our custom errors
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('mailgun', { originalError: error });
      }
      
      throw new MailAdapterError(
        `Mailgun send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_FAILED',
        'mailgun',
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
      // Test API key and domain by getting domain info
      const response = await fetch(`https://api.mailgun.net/v3/domains/${this.authConfig.domain}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.authConfig.apiKey}`).toString('base64')}`
        }
      });

      if (response.ok) {
        const domainInfo = await response.json();
        
        return {
          success: true,
          details: {
            serverReachable: true,
            authValid: true,
            quotaInfo: {
              // Mailgun quota info would need separate API call
            }
          }
        };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `Mailgun API error: ${response.status} - ${errorData}`,
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
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'mailgun');
    }

    try {
      const webhookFormData = new FormData();
      webhookFormData.append('url', config.url);
      
      // Set up events - Mailgun uses different event names
      const events = config.events || ['delivered', 'bounced', 'dropped', 'complained'];
      events.forEach(event => {
        webhookFormData.append('event', event);
      });

      const response = await fetch(`https://api.mailgun.net/v3/domains/${this.authConfig.domain}/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.authConfig.apiKey}`).toString('base64')}`
        },
        body: webhookFormData
      });

      if (response.ok) {
        const responseData = await response.json();
        return {
          success: true,
          webhookId: responseData.webhook?.id || 'mailgun-webhook-' + Date.now()
        };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `Mailgun webhook setup failed: ${response.status} - ${errorData}`
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
      console.log('📧 [DEBUG] Mailgun adapter disconnected');
    }
  }
}