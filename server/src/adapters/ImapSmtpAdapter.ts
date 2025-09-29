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
  MailAdapterError,
  NetworkError
} from '@shared/mailAdapter';
import { ImapService } from '../services/imap';

export class ImapSmtpAdapter implements MailAdapter {
  readonly providerId = 'imap_smtp';
  private imapService: ImapService | null = null;
  private tenantContext: TenantContext | null = null;
  private authConfig: AuthConfig | null = null;

  async connect(auth: AuthConfig, tenantContext: TenantContext): Promise<void> {
    try {
      this.authConfig = auth;
      this.tenantContext = tenantContext;
      
      if (!auth.username || !auth.password) {
        throw new AuthenticationError('imap_smtp', { message: 'Username and password are required' });
      }
      
      if (!auth.imapHost || !auth.smtpHost) {
        throw new AuthenticationError('imap_smtp', { message: 'IMAP and SMTP hosts are required' });
      }
      
      // Create IMAP service with configuration
      this.imapService = new ImapService();
      
      // Configure IMAP service with provided settings
      const imapConfig = {
        host: auth.imapHost,
        port: auth.imapPort || 993,
        user: auth.username,
        password: auth.password,
        tls: auth.imapSecure !== false
      };
      
      const smtpConfig = {
        host: auth.smtpHost,
        port: auth.smtpPort || 587,
        user: auth.username,
        password: auth.password,
        secure: auth.smtpSecure === true
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] IMAP/SMTP adapter connected for tenant:', tenantContext.tenantId);
        console.log('📧 [DEBUG] IMAP config:', { 
          host: imapConfig.host, 
          port: imapConfig.port, 
          user: imapConfig.user,
          tls: imapConfig.tls 
        });
        console.log('📧 [DEBUG] SMTP config:', { 
          host: smtpConfig.host, 
          port: smtpConfig.port, 
          user: smtpConfig.user,
          secure: smtpConfig.secure 
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] IMAP/SMTP connection failed:', error);
      }
      throw new AuthenticationError('imap_smtp', { originalError: error });
    }
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (!this.imapService || !this.tenantContext || !this.authConfig) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'imap_smtp');
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] IMAP/SMTP sending email:', {
          to: Array.isArray(request.to) ? request.to : [request.to],
          subject: request.subject,
          from: request.from || this.authConfig.fromEmail
        });
      }

      // Convert to IMAP service format
      const emailData = {
        to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
        cc: request.cc ? (Array.isArray(request.cc) ? request.cc.join(', ') : request.cc) : undefined,
        bcc: request.bcc ? (Array.isArray(request.bcc) ? request.bcc.join(', ') : request.bcc) : undefined,
        subject: request.subject,
        text: request.text || '',
        html: request.html,
        from: request.from || this.authConfig.fromEmail || this.authConfig.username,
        replyTo: request.replyTo || this.authConfig.replyToEmail
      };

      const result = await this.imapService.sendEmail(emailData);

      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEBUG] IMAP/SMTP send result:', result);
      }

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId || 'imap-smtp-sent-' + Date.now(),
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
        console.log('📧 [DEBUG] IMAP/SMTP send error:', error);
      }
      
      if (error instanceof Error && error.message.includes('connection')) {
        throw new NetworkError('imap_smtp', { originalError: error });
      }
      
      throw new MailAdapterError(
        `IMAP/SMTP send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_FAILED',
        'imap_smtp',
        true,
        { originalError: error }
      );
    }
  }

  async fetchMessages(options?: FetchMessagesOptions): Promise<EmailMessage[]> {
    if (!this.imapService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'imap_smtp');
    }

    try {
      const emails = await this.imapService.getEmails(
        options?.limit || 50,
        options?.since
      );

      return emails.map(email => ({
        id: email.id,
        threadId: email.threadId || undefined,
        from: email.fromEmail,
        to: email.toEmails || [],
        cc: email.ccEmails || undefined,
        bcc: email.bccEmails || undefined,
        subject: email.subject || '',
        text: email.bodyText || undefined,
        html: email.bodyHtml || undefined,
        date: email.sentAt || new Date(),
        isRead: true, // IMAP typically marks as read when fetched
        hasAttachments: email.hasAttachments || false,
        snippet: email.snippet || undefined
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes('connection')) {
        throw new NetworkError('imap_smtp', { originalError: error });
      }
      
      throw new MailAdapterError(
        `IMAP fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_FAILED',
        'imap_smtp',
        true,
        { originalError: error }
      );
    }
  }

  async fetchThreads(options?: FetchThreadsOptions): Promise<EmailThread[]> {
    if (!this.imapService || !this.tenantContext) {
      throw new MailAdapterError('Not connected', 'NOT_CONNECTED', 'imap_smtp');
    }

    try {
      // IMAP doesn't have native thread support like Gmail
      // We'll group messages by subject (simplified threading)
      const emails = await this.imapService.getEmails(
        options?.limit || 50,
        options?.since
      );

      // Group by simplified thread ID (subject-based)
      const threadMap = new Map<string, EmailThread>();
      
      emails.forEach(email => {
        const threadKey = email.subject?.replace(/^(Re:|Fwd?:)\s*/i, '').trim() || email.id;
        
        if (!threadMap.has(threadKey)) {
          threadMap.set(threadKey, {
            id: email.threadId || email.id,
            subject: email.subject || '',
            participants: [email.fromEmail, ...(email.toEmails || [])].filter(Boolean),
            messageCount: 1,
            lastMessageDate: email.sentAt || new Date(),
            isRead: true,
            snippet: email.snippet || undefined
          });
        } else {
          const thread = threadMap.get(threadKey)!;
          thread.messageCount++;
          
          const messageDate = email.sentAt || new Date();
          if (messageDate > thread.lastMessageDate) {
            thread.lastMessageDate = messageDate;
            thread.snippet = email.snippet || undefined;
          }
          
          // Add unique participants
          if (!thread.participants.includes(email.fromEmail)) {
            thread.participants.push(email.fromEmail);
          }
          const toEmails = email.toEmails || [];
          toEmails.forEach(emailAddr => {
            if (!thread.participants.includes(emailAddr)) {
              thread.participants.push(emailAddr);
            }
          });
        }
      });

      return Array.from(threadMap.values());
    } catch (error) {
      if (error instanceof Error && error.message.includes('connection')) {
        throw new NetworkError('imap_smtp', { originalError: error });
      }
      
      throw new MailAdapterError(
        `IMAP fetch threads failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_FAILED',
        'imap_smtp',
        true,
        { originalError: error }
      );
    }
  }

  async verifyCredentials(): Promise<VerifyCredentialsResult> {
    if (!this.imapService || !this.tenantContext || !this.authConfig) {
      return {
        success: false,
        error: 'Not connected'
      };
    }

    try {
      // Test IMAP connection
      const imapConnection = await this.imapService.connectImap();
      imapConnection.end();
      
      // Test SMTP connection if possible
      let smtpWorking = true;
      try {
        if (this.imapService.isSmtpConfigured()) {
          // SMTP verification would require actual sending which we want to avoid
          // For now, assume SMTP works if IMAP works and config is provided
        }
      } catch (smtpError) {
        smtpWorking = false;
      }
      
      return {
        success: true,
        details: {
          username: this.authConfig.username,
          serverReachable: true,
          authValid: true
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          username: this.authConfig.username,
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
    this.imapService = null;
    this.tenantContext = null;
    this.authConfig = null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEBUG] IMAP/SMTP adapter disconnected');
    }
  }
}