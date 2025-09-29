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
import { MicrosoftMailService } from '../services/microsoft-mail';

export class MicrosoftAdapter implements MailAdapter {
  readonly providerId = 'microsoft';
  private microsoftMailService: MicrosoftMailService | null = null;
  private tenantContext: TenantContext | null = null;
  private authConfig: AuthConfig | null = null;

  async connect(auth: AuthConfig, tenantContext: TenantContext): Promise<void> {
    try {
      this.authConfig = auth;
      this.tenantContext = tenantContext;
      
      if (!auth.accessToken) {
        throw new AuthenticationError('microsoft', { message: 'No access token provided' });
      }
      
      // Create Microsoft mail service
      this.microsoftMailService = new MicrosoftMailService();

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Microsoft adapter connected for tenant:', tenantContext.tenantId);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Microsoft connection failed:', error);
      }
      throw new AuthenticationError('microsoft', { originalError: error });
    }
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (!this.microsoftMailService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'microsoft');
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Microsoft sending email:', {
          to: Array.isArray(request.to) ? request.to : [request.to],
          subject: request.subject,
          from: request.from || this.authConfig?.fromEmail
        });
      }

      // Convert to Microsoft service format
      const emailData = {
        to: Array.isArray(request.to) ? request.to : [request.to],
        cc: request.cc ? (Array.isArray(request.cc) ? request.cc : [request.cc]) : undefined,
        bcc: request.bcc ? (Array.isArray(request.bcc) ? request.bcc : [request.bcc]) : undefined,
        subject: request.subject,
        body: request.html || request.text || '',
        isHtml: !!request.html,
        fromEmail: request.from || this.authConfig?.fromEmail
      };

      const result = await this.microsoftMailService.sendEmail(emailData);

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] Microsoft send result:', result);
      }

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId || 'microsoft-sent-' + Date.now(),
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
        console.log('📧 [DEBUG] Microsoft send error:', error);
      }
      throw new MailAdapterError(
        `Microsoft send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_FAILED',
        'microsoft',
        false,
        { originalError: error }
      );
    }
  }

  async fetchMessages(options?: FetchMessagesOptions): Promise<EmailMessage[]> {
    if (!this.microsoftMailService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'microsoft');
    }

    try {
      const messages = await this.microsoftMailService.getMessages(
        options?.folder || 'inbox',
        options?.limit || 50,
        options?.since
      );

      return messages.map(message => ({
        id: message.id,
        threadId: message.threadId || undefined,
        from: message.fromEmail,
        to: message.toEmails || [],
        cc: message.ccEmails || undefined,
        bcc: message.bccEmails || undefined,
        subject: message.subject || '',
        text: message.bodyText || undefined,
        html: message.bodyHtml || undefined,
        date: message.sentAt || new Date(),
        isRead: true, // Database doesn't track read status for synced emails
        isDraft: false, // Only sync received emails
        hasAttachments: message.hasAttachments || false,
        snippet: message.snippet || undefined
      }));
    } catch (error) {
      throw new MailAdapterError(
        `Microsoft fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_FAILED',
        'microsoft',
        true,
        { originalError: error }
      );
    }
  }

  async fetchThreads(options?: FetchThreadsOptions): Promise<EmailThread[]> {
    if (!this.microsoftMailService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'microsoft');
    }

    try {
      // Microsoft Graph doesn't have a direct threads concept like Gmail
      // We'll group messages by conversationId
      const messages = await this.microsoftMailService.getMessages(
        options?.folder || 'inbox',
        options?.limit || 50,
        options?.since
      );

      // Group by conversation ID
      const threadMap = new Map<string, EmailThread>();
      
      messages.forEach(message => {
        const conversationId = message.threadId || message.id;
        
        if (!threadMap.has(conversationId)) {
          threadMap.set(conversationId, {
            id: conversationId,
            subject: message.subject || '',
            participants: [message.fromEmail, ...(message.toEmails || [])].filter(Boolean),
            messageCount: 1,
            lastMessageDate: message.sentAt || new Date(),
            isRead: true,
            snippet: message.snippet || undefined
          });
        } else {
          const thread = threadMap.get(conversationId)!;
          thread.messageCount++;
          
          const messageDate = message.sentAt || new Date();
          if (messageDate > thread.lastMessageDate) {
            thread.lastMessageDate = messageDate;
            thread.snippet = message.snippet || undefined;
          }
          
          // Add unique participants
          if (!thread.participants.includes(message.fromEmail)) {
            thread.participants.push(message.fromEmail);
          }
          const toEmails = message.toEmails || [];
          toEmails.forEach(email => {
            if (!thread.participants.includes(email)) {
              thread.participants.push(email);
            }
          });
        }
      });

      return Array.from(threadMap.values());
    } catch (error) {
      throw new MailAdapterError(
        `Microsoft fetch threads failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_FAILED',
        'microsoft',
        true,
        { originalError: error }
      );
    }
  }

  async verifyCredentials(): Promise<VerifyCredentialsResult> {
    if (!this.microsoftMailService || !this.tenantContext) {
      return {
        success: false,
        error: 'Not connected'
      };
    }

    try {
      // Try to get a single message as a credential check
      const messages = await this.microsoftMailService.getMessages('inbox', 1);
      
      return {
        success: true,
        details: {
          serverReachable: true,
          authValid: true
        }
      };
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
    this.microsoftMailService = null;
    this.tenantContext = null;
    this.authConfig = null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEBUG] Microsoft adapter disconnected');
    }
  }
}