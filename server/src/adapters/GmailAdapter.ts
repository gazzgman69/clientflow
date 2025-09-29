import type {
  MailAdapter,
  AuthConfig,
  TenantContext,
  SendEmailRequest,
  SendEmailResponse,
  EmailMessage,
  EmailThread,
  FetchMessagesOptions,
  FetchThreadsOptions,
  VerifyCredentialsResult
} from '@shared/mailAdapter';
import {
  AuthenticationError,
  MailAdapterError
} from '@shared/mailAdapter';
import { GmailService } from '../services/gmail';

export class GmailAdapter implements MailAdapter {
  readonly providerId = 'gmail';
  private gmailService: GmailService | null = null;
  private tenantContext: TenantContext | null = null;
  private authConfig: AuthConfig | null = null;

  async connect(auth: AuthConfig, tenantContext: TenantContext): Promise<void> {
    try {
      this.authConfig = auth;
      this.tenantContext = tenantContext;
      
      // Create Gmail service with token provider
      this.gmailService = new GmailService(async (userId: string) => {
        if (!auth.accessToken) {
          throw new AuthenticationError('gmail', { message: 'No access token provided' });
        }
        
        return {
          access_token: auth.accessToken,
          refresh_token: auth.refreshToken,
          expiry_date: auth.expiresAt?.getTime()
        };
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Gmail adapter connected for tenant:', tenantContext.tenantId);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Gmail connection failed:', error);
      }
      throw new AuthenticationError('gmail', { originalError: error });
    }
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (!this.gmailService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'gmail');
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Gmail sending email:', {
          to: Array.isArray(request.to) ? request.to : [request.to],
          subject: request.subject,
          from: request.from || this.authConfig?.fromEmail
        });
      }

      // Convert to Gmail service format
      const emailData = {
        to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
        cc: request.cc ? (Array.isArray(request.cc) ? request.cc.join(', ') : request.cc) : undefined,
        bcc: request.bcc ? (Array.isArray(request.bcc) ? request.bcc.join(', ') : request.bcc) : undefined,
        subject: request.subject,
        text: request.text || '',
        html: request.html,
        preheader: undefined
      };

      const result = await this.gmailService.sendEmail(
        this.tenantContext.userId,
        emailData
      );

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Gmail send result:', result);
      }

      if (result.ok) {
        return {
          success: true,
          messageId: 'gmail-sent-' + Date.now(),
          providerId: this.providerId
        };
      } else {
        return {
          success: false,
          providerId: this.providerId,
          error: result.error || 'Unknown error'
        };
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Gmail send error:', error);
      }
      throw new MailAdapterError(
        `Gmail send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_FAILED',
        'gmail',
        false,
        { originalError: error }
      );
    }
  }

  async fetchMessages(options?: FetchMessagesOptions): Promise<EmailMessage[]> {
    if (!this.gmailService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'gmail');
    }

    try {
      const result = await this.gmailService.listEmails(
        this.tenantContext.userId,
        options?.limit || 50
      );

      if (!result.ok || !result.emails) {
        throw new MailAdapterError(
          result.error || 'Failed to fetch messages',
          'FETCH_FAILED',
          'gmail'
        );
      }

      return result.emails.map(email => ({
        id: email.id,
        threadId: email.threadId,
        from: email.from,
        to: [email.to],
        subject: email.subject,
        date: new Date(email.date),
        isRead: true, // Gmail API doesn't provide this in list
        snippet: email.snippet
      }));
    } catch (error) {
      throw new MailAdapterError(
        `Gmail fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_FAILED',
        'gmail',
        true,
        { originalError: error }
      );
    }
  }

  async fetchThreads(options?: FetchThreadsOptions): Promise<EmailThread[]> {
    if (!this.gmailService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'gmail');
    }

    try {
      const result = await this.gmailService.listThreads(
        this.tenantContext.userId,
        { limit: options?.limit || 50 }
      );

      if (!result.ok || !result.threads) {
        throw new MailAdapterError(
          result.error || 'Failed to fetch threads',
          'FETCH_FAILED',
          'gmail'
        );
      }

      return result.threads.map(thread => ({
        id: thread.threadId,
        subject: thread.latest.subject,
        participants: [thread.latest.from, thread.latest.to],
        messageCount: thread.count,
        lastMessageDate: new Date(thread.latest.dateISO),
        isRead: true, // Would need additional API call to determine
        snippet: thread.latest.snippet
      }));
    } catch (error) {
      throw new MailAdapterError(
        `Gmail fetch threads failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_FAILED',
        'gmail',
        true,
        { originalError: error }
      );
    }
  }

  async verifyCredentials(): Promise<VerifyCredentialsResult> {
    if (!this.gmailService || !this.tenantContext) {
      return {
        success: false,
        error: 'Not connected'
      };
    }

    try {
      // Try to get user profile as a credential check
      const result = await this.gmailService.listEmails(this.tenantContext.userId, 1);
      
      if (result.ok) {
        return {
          success: true,
          details: {
            serverReachable: true,
            authValid: true
          }
        };
      } else {
        return {
          success: false,
          error: result.error || 'Credentials verification failed'
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

  getCapabilities() {
    return {
      canSend: true,
      canReceive: true,
      supportsWebhooks: false,
      supportsAttachments: true,
      supportsHtml: true
    };
  }

  async disconnect(): Promise<void> {
    this.gmailService = null;
    this.tenantContext = null;
    this.authConfig = null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEBUG] Gmail adapter disconnected');
    }
  }
}