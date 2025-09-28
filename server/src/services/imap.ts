import Imap from 'imap';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { Readable } from 'stream';
import { emailSyncService } from './emailSync';

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

export class ImapService {
  private imapConfig: ImapConfig | null = null;
  private smtpConfig: SmtpConfig | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    // Load configuration from environment variables
    if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS) {
      this.imapConfig = {
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT || '993'),
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASS,
        tls: true
      };
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASS,
        secure: process.env.SMTP_PORT === '465' // SSL for port 465, STARTTLS for others
      };

      this.smtpTransporter = nodemailer.createTransport({
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: {
          user: this.smtpConfig.user,
          pass: this.smtpConfig.password
        }
      });
    }
  }

  /**
   * Check if IMAP configuration is available
   */
  isImapConfigured(): boolean {
    return this.imapConfig !== null;
  }

  /**
   * Check if SMTP configuration is available
   */
  isSmtpConfigured(): boolean {
    return this.smtpConfig !== null && this.smtpTransporter !== null;
  }

  /**
   * Connect to IMAP server and return connection
   */
  async connectImap(): Promise<Imap> {
    if (!this.imapConfig) {
      throw new Error('IMAP configuration not available. Set IMAP_HOST, IMAP_USER, IMAP_PASS environment variables.');
    }

    const imap = new Imap({
      user: this.imapConfig.user,
      password: this.imapConfig.password,
      host: this.imapConfig.host,
      port: this.imapConfig.port,
      tls: this.imapConfig.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 3000,
      connTimeout: 10000
    });

    return new Promise((resolve, reject) => {
      imap.once('ready', () => {
        console.log('📧 IMAP connection ready');
        resolve(imap);
      });

      imap.once('error', (err: Error) => {
        console.error('❌ IMAP connection error:', err);
        reject(err);
      });

      imap.once('end', () => {
        console.log('📧 IMAP connection ended');
      });

      imap.connect();
    });
  }

  /**
   * Fetch new messages from IMAP server and sync to database
   */
  async fetchNewMessages(userId: string, specificProjectId?: string): Promise<{ synced: number; skipped: number; errors: any[] }> {
    if (!this.isImapConfigured()) {
      console.log('⚠️ IMAP not configured, skipping IMAP sync');
      return { synced: 0, skipped: 0, errors: ['IMAP not configured'] };
    }

    let imap: Imap | null = null;
    const result = { synced: 0, skipped: 0, errors: [] as any[] };

    try {
      imap = await this.connectImap();
      
      // Open INBOX folder
      await new Promise<void>((resolve, reject) => {
        imap!.openBox('INBOX', false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`📧 IMAP opened INBOX with ${box.messages.total} messages`);
          resolve();
        });
      });

      // Search for recent messages (last 30 days)
      const searchCriteria = ['SINCE', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)];
      
      const messageIds = await new Promise<number[]>((resolve, reject) => {
        imap!.search(searchCriteria, (err, results) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(results || []);
        });
      });

      console.log(`📧 Found ${messageIds.length} recent IMAP messages`);

      if (messageIds.length === 0) {
        return result;
      }

      // Fetch messages in batches
      const batchSize = 10;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        try {
          await this.processBatch(imap, batch, userId, specificProjectId, result);
        } catch (batchError) {
          console.error(`❌ Error processing batch ${i}-${i + batchSize}:`, batchError);
          result.errors.push(batchError);
        }
      }

    } catch (error) {
      console.error('❌ IMAP fetch error:', error);
      result.errors.push(error);
    } finally {
      if (imap) {
        imap.end();
      }
    }

    return result;
  }

  private async processBatch(imap: Imap, messageIds: number[], userId: string, specificProjectId: string | undefined, result: { synced: number; skipped: number; errors: any[] }) {
    return new Promise<void>((resolve, reject) => {
      const fetch = imap.fetch(messageIds, { 
        bodies: '',
        struct: true,
        envelope: true
      });

      fetch.on('message', (msg, seqno) => {
        this.processMessage(msg, seqno, userId, specificProjectId, result);
      });

      fetch.once('error', (err) => {
        reject(err);
      });

      fetch.once('end', () => {
        resolve();
      });
    });
  }

  private processMessage(msg: any, seqno: number, userId: string, specificProjectId: string | undefined, result: { synced: number; skipped: number; errors: any[] }) {
    let buffer = '';
    let envelope: any = null;

    msg.on('body', (stream: Readable) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
      });
    });

    msg.on('attributes', (attrs: any) => {
      envelope = attrs.envelope;
    });

    msg.once('end', async () => {
      try {
        // Parse the raw email
        const parsed = await simpleParser(buffer);
        
        // Create email object for emailSync service
        const emailData = {
          messageId: parsed.messageId || `imap-${seqno}-${Date.now()}`,
          inReplyTo: parsed.inReplyTo || null,
          references: parsed.references || [],
          fromEmail: envelope?.from?.[0]?.name 
            ? `${envelope.from[0].name} <${envelope.from[0].mailbox}@${envelope.from[0].host}>`
            : `${envelope?.from?.[0]?.mailbox}@${envelope?.from?.[0]?.host}`,
          toEmails: envelope?.to?.map((addr: any) => `${addr.mailbox}@${addr.host}`) || [],
          ccEmails: envelope?.cc?.map((addr: any) => `${addr.mailbox}@${addr.host}`) || [],
          subject: envelope?.subject || parsed.subject || '(no subject)',
          sentAt: envelope?.date || parsed.date || new Date(),
          bodyHtml: parsed.html || null,
          bodyText: parsed.text || null,
          direction: 'inbound',
          provider: 'imap',
          providerMessageId: `imap-${seqno}`,
          providerThreadId: parsed.messageId || `imap-thread-${seqno}`,
          hasAttachments: (parsed.attachments?.length || 0) > 0
        };

        // Use emailSync service to store the message with RFC threading
        // Cast to any to bypass type checking since we're adapting IMAP data to Gmail format
        await emailSyncService.syncGmailMessage(emailData as any, emailData.providerThreadId, specificProjectId);
        result.synced++;
        
      } catch (parseError) {
        console.error(`❌ Error parsing IMAP message ${seqno}:`, parseError);
        result.errors.push(parseError);
        result.skipped++;
      }
    });
  }

  /**
   * Download attachments for a message (placeholder for future implementation)
   */
  async downloadAttachments(messageId: string, attachmentIds: string[]): Promise<void> {
    // TODO: Implement IMAP attachment download
    // This would require fetching the specific message parts containing attachments
    console.log('📎 IMAP attachment download not yet implemented');
  }

  /**
   * Send email via SMTP
   */
  async sendViaSmtp(emailData: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string[];
    bcc?: string[];
    fromEmail?: string; // For from header verification
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isSmtpConfigured() || !this.smtpTransporter) {
      return {
        success: false,
        error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.'
      };
    }

    try {
      // VERBOSE LOGGING: Log recipient + provider status before sending
      console.log(`📧 SMTP SEND START - Provider: SMTP (Nodemailer)`);
      console.log(`📧 SMTP SEND - Host: ${this.smtpConfig!.host}:${this.smtpConfig!.port}`);
      console.log(`📧 SMTP SEND - Security: ${this.smtpConfig!.secure ? 'SSL/TLS' : 'STARTTLS'}`);
      console.log(`📧 SMTP SEND - To: ${emailData.to}`);
      if (emailData.cc && emailData.cc.length > 0) {
        console.log(`📧 SMTP SEND - CC: ${emailData.cc.join(', ')}`);
      }
      if (emailData.bcc && emailData.bcc.length > 0) {
        console.log(`📧 SMTP SEND - BCC: ${emailData.bcc.join(', ')}`);
      }
      console.log(`📧 SMTP SEND - Subject: ${emailData.subject}`);
      console.log(`📧 SMTP SEND - Content: ${emailData.html ? 'HTML + Text' : 'Text only'}`);
      
      // VERBOSE LOGGING: From header verification
      const authenticatedUser = this.smtpConfig!.user;
      let fromAddress = authenticatedUser;
      
      if (emailData.fromEmail && emailData.fromEmail.toLowerCase() !== authenticatedUser.toLowerCase()) {
        console.warn(`📧 SMTP SEND WARNING - From header mismatch! Requested: ${emailData.fromEmail}, Authenticated: ${authenticatedUser}`);
        console.log(`📧 SMTP SEND - Using authenticated account in From header with replyTo fallback`);
        fromAddress = authenticatedUser;
      } else {
        console.log(`📧 SMTP SEND - From header: ${fromAddress}`);
      }
      
      const mailOptions = {
        from: fromAddress,
        replyTo: emailData.fromEmail !== authenticatedUser ? emailData.fromEmail : undefined,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html
      };

      console.log(`📧 SMTP SEND - Calling SMTP server with debug logging enabled...`);
      
      // DEVELOPMENT-ONLY: Enhanced debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEBUG] SMTP REQUEST - Full mail options:`, JSON.stringify(mailOptions, null, 2));
        console.log(`📧 [DEBUG] SMTP REQUEST - SMTP server config:`, {
          host: this.smtpConfig!.host,
          port: this.smtpConfig!.port,
          secure: this.smtpConfig!.secure,
          user: this.smtpConfig!.user,
          // Don't log password
        });
        console.log(`📧 [DEBUG] SMTP REQUEST - About to send MAIL FROM command`);
      }
      
      // Enable debug logging for this specific send
      this.smtpTransporter.options.logger = true;
      this.smtpTransporter.options.debug = true;
      
      const info = await this.smtpTransporter.sendMail(mailOptions);
      
      // VERBOSE LOGGING: Log full SMTP response
      console.log(`📧 SMTP API RESPONSE - Message ID: ${info.messageId}`);
      console.log(`📧 SMTP API RESPONSE - Response: ${info.response}`);
      console.log(`📧 SMTP API RESPONSE - Envelope:`, JSON.stringify(info.envelope, null, 2));
      if (info.accepted && info.accepted.length > 0) {
        console.log(`📧 SMTP API RESPONSE - Accepted: ${info.accepted.join(', ')}`);
      }
      if (info.rejected && info.rejected.length > 0) {
        console.log(`📧 SMTP API RESPONSE - Rejected: ${info.rejected.join(', ')}`);
      }
      
      // DEVELOPMENT-ONLY: Enhanced debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEBUG] SMTP RESPONSE - Full nodemailer info object:`, JSON.stringify(info, null, 2));
        console.log(`📧 [DEBUG] SMTP RESPONSE - SMTP conversation completed successfully`);
        console.log(`📧 [DEBUG] SMTP RESPONSE - MAIL FROM: ${fromAddress}`);
        console.log(`📧 [DEBUG] SMTP RESPONSE - RCPT TO: ${emailData.to}`);
        if (emailData.cc && emailData.cc.length > 0) {
          console.log(`📧 [DEBUG] SMTP RESPONSE - RCPT TO (CC): ${emailData.cc.join(', ')}`);
        }
        if (emailData.bcc && emailData.bcc.length > 0) {
          console.log(`📧 [DEBUG] SMTP RESPONSE - RCPT TO (BCC): ${emailData.bcc.join(', ')}`);
        }
        console.log(`📧 [DEBUG] SMTP RESPONSE - DATA command executed`);
        console.log(`📧 [DEBUG] SMTP RESPONSE - Server responded with 250 OK (success)`);
      }
      
      console.log(`📧 SMTP SUCCESS - Provider accepted email with Message-ID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId
      };

    } catch (error) {
      // VERBOSE LOGGING: Log detailed error information
      console.error('📧 SMTP SEND ERROR - Raw error object:', JSON.stringify(error, null, 2));
      console.error('📧 SMTP SEND ERROR - Error message:', error instanceof Error ? error.message : 'Unknown error');
      
      // DEVELOPMENT-ONLY: Enhanced debug error logging
      if (process.env.NODE_ENV === 'development') {
        console.error('📧 [DEBUG] SMTP ERROR - Error stack trace:', error instanceof Error ? error.stack : 'No stack available');
        if (error instanceof Error && 'command' in error) {
          console.error('📧 [DEBUG] SMTP ERROR - Failed SMTP command:', (error as any).command);
        }
      }
      
      if (error instanceof Error && 'response' in error) {
        console.error('📧 SMTP SEND ERROR - Server response:', (error as any).response);
      }
      if (error instanceof Error && 'responseCode' in error) {
        console.error('📧 SMTP SEND ERROR - Response code:', (error as any).responseCode);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMTP error'
      };
    }
  }

  /**
   * Test IMAP connection
   */
  async testImapConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isImapConfigured()) {
      return { success: false, error: 'IMAP not configured' };
    }

    try {
      const imap = await this.connectImap();
      imap.end();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown IMAP error' 
      };
    }
  }

  /**
   * Test SMTP connection
   */
  async testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSmtpConfigured() || !this.smtpTransporter) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      await this.smtpTransporter.verify();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown SMTP error' 
      };
    }
  }
}

// Export singleton instance
export const imapService = new ImapService();