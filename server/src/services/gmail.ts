import { google } from 'googleapis';
import { getUserGoogleTokens } from '../storage/google-tokens';
import { emailSyncService } from './emailSync';
import type { gmail_v1 } from 'googleapis';

interface EmailRequest {
  to: string;
  subject: string;
  text: string;
}

interface EmailResponse {
  ok: boolean;
  error?: string;
}

interface EmailListItem {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
}

interface EmailListResponse {
  ok: boolean;
  emails?: EmailListItem[];
  error?: string;
}

interface EmailThread {
  threadId: string;
  latest: {
    id: string;
    from: string;
    to: string;
    subject: string;
    dateISO: string;
    snippet: string;
  };
  count: number;
}

interface ThreadsResponse {
  ok: boolean;
  threads?: EmailThread[];
  error?: string;
}

interface GoogleTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}

export class GmailService {
  constructor(private getTokensForUser: (userId: string) => Promise<GoogleTokens>) {}

  /**
   * Get Gmail service with user's OAuth tokens
   */
  private async getGmailService(userId: string) {
    const tokens = await this.getTokensForUser(userId);
    
    if (!tokens.access_token) {
      throw new Error('No Google access token found for user. Please reconnect your Google account.');
    }

    // Set up OAuth2 client with user's tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials(tokens);

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Get user's Gmail profile to get their email address
   */
  private async getUserEmail(userId: string): Promise<string> {
    try {
      const gmail = await this.getGmailService(userId);
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return profile.data.emailAddress || 'user@example.com';
    } catch (error) {
      console.error('Failed to get user email:', error);
      return 'user@example.com'; // Fallback
    }
  }

  /**
   * Send email using Gmail API with database sync
   */
  async sendEmail(userId: string, emailRequest: EmailRequest & { projectId?: string; threadId?: string }): Promise<EmailResponse> {
    try {
      const gmail = await this.getGmailService(userId);

      // Create email message in RFC 2822 format
      const emailContent = [
        `To: ${emailRequest.to}`,
        `Subject: ${emailRequest.subject}`,
        '',
        emailRequest.text
      ].join('\n');

      // Proper base64url encoding: + -> -, / -> _, remove padding
      const encodedMessage = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''); // Remove trailing padding

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage }
      });

      // Sync to database if successful
      if (response.data.id) {
        try {
          const userEmail = await this.getUserEmail(userId);
          await emailSyncService.createOutboundEmail({
            threadId: emailRequest.threadId,
            projectId: emailRequest.projectId,
            to: [emailRequest.to],
            subject: emailRequest.subject,
            bodyText: emailRequest.text,
            fromEmail: userEmail, // Pass the user's actual email
          });
        } catch (syncError) {
          console.error('Failed to sync sent email to database:', syncError);
          // Don't fail the send operation if sync fails
        }
      }

      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Failed to send email' };
    }
  }

  /**
   * List email threads grouped by Gmail threadId
   */
  async listThreads(userId: string, { limit = 20, q = "" }: { limit?: number; q?: string } = {}): Promise<ThreadsResponse> {
    try {
      const gmail = await this.getGmailService(userId);

      // Get message list from INBOX
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: limit * 3, // Get more messages to account for threading
        q: q || '',
        labelIds: ['INBOX']
      });

      const messages = listResponse.data.messages || [];
      const threadMap = new Map<string, EmailListItem[]>();

      // Get details for each message and group by threadId
      for (const message of messages) {
        if (!message.id || !message.threadId) continue;

        const detailResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });

        const headers = detailResponse.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';
        
        const emailItem: EmailListItem = {
          id: message.id,
          threadId: message.threadId,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          date: new Date(getHeader('Date')).toISOString(),
          snippet: detailResponse.data.snippet || ''
        };

        if (!threadMap.has(message.threadId)) {
          threadMap.set(message.threadId, []);
        }
        threadMap.get(message.threadId)!.push(emailItem);
      }

      // Convert to thread format - pick latest message for each thread
      const threads: EmailThread[] = [];
      for (const [threadId, emails] of threadMap.entries()) {
        if (threads.length >= limit) break;
        
        // Sort by date descending to get latest
        emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latest = emails[0];
        
        threads.push({
          threadId,
          latest: {
            id: latest.id,
            from: latest.from,
            to: latest.to,
            subject: latest.subject,
            dateISO: latest.date,
            snippet: latest.snippet
          },
          count: emails.length
        });
      }

      // Sort threads by latest message date
      threads.sort((a, b) => new Date(b.latest.dateISO).getTime() - new Date(a.latest.dateISO).getTime());

      return { ok: true, threads: threads.slice(0, limit) };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Failed to list email threads' };
    }
  }

  /**
   * List email threads filtered by specific email addresses
   */
  async listThreadsForAddresses(userId: string, { limit = 50, addresses }: { limit?: number; addresses: string[] }): Promise<ThreadsResponse> {
    try {
      const gmail = await this.getGmailService(userId);

      // Build query to search for messages from/to any of the addresses
      const addressQueries = addresses.map(addr => `(from:${addr} OR to:${addr})`);
      const q = addressQueries.join(' OR ');

      // Get message list with address filter
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: limit * 3, // Get more messages to account for threading
        q,
        labelIds: ['INBOX']
      });

      const messages = listResponse.data.messages || [];
      const threadMap = new Map<string, EmailListItem[]>();

      // Get details for each message and group by threadId
      for (const message of messages) {
        if (!message.id || !message.threadId) continue;

        const detailResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });

        const headers = detailResponse.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';
        
        const from = getHeader('From');
        const to = getHeader('To');
        
        // Double-check that this message contains one of our target addresses
        const containsTargetAddress = addresses.some(addr => 
          from.toLowerCase().includes(addr.toLowerCase()) || 
          to.toLowerCase().includes(addr.toLowerCase())
        );
        
        if (!containsTargetAddress) continue;

        const emailItem: EmailListItem = {
          id: message.id,
          threadId: message.threadId,
          from,
          to,
          subject: getHeader('Subject'),
          date: new Date(getHeader('Date')).toISOString(),
          snippet: detailResponse.data.snippet || ''
        };

        if (!threadMap.has(message.threadId)) {
          threadMap.set(message.threadId, []);
        }
        threadMap.get(message.threadId)!.push(emailItem);
      }

      // Convert to thread format - pick latest message for each thread
      const threads: EmailThread[] = [];
      for (const [threadId, emails] of threadMap.entries()) {
        if (threads.length >= limit) break;
        
        // Sort by date descending to get latest
        emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latest = emails[0];
        
        threads.push({
          threadId,
          latest: {
            id: latest.id,
            from: latest.from,
            to: latest.to,
            subject: latest.subject,
            dateISO: latest.date,
            snippet: latest.snippet
          },
          count: emails.length
        });
      }

      // Sort threads by latest message date
      threads.sort((a, b) => new Date(b.latest.dateISO).getTime() - new Date(a.latest.dateISO).getTime());

      return { ok: true, threads: threads.slice(0, limit) };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Failed to list email threads for addresses' };
    }
  }

  /**
   * Get all messages in a specific Gmail thread
   */
  async getThreadMessages(userId: string, threadId: string): Promise<any[]> {
    try {
      const gmail = await this.getGmailService(userId);
      
      // Get the full thread with all messages
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      const messages = threadResponse.data.messages || [];
      const emailMessages = [];

      for (const message of messages) {
        if (!message.id) continue;
        
        const headers = message.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';
        
        // Extract content
        const content = this.extractMessageContent(message.payload);
        
        emailMessages.push({
          id: message.id,
          threadId: threadId,
          from: getHeader('From'),
          to: getHeader('To'),
          cc: getHeader('Cc'),
          bcc: getHeader('Bcc'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          snippet: message.snippet || '',
          bodyHtml: content.html,
          bodyText: content.text,
          inReplyTo: getHeader('In-Reply-To'),
          references: getHeader('References'),
          messageId: getHeader('Message-ID'),
          internalDate: message.internalDate
        });
      }

      return emailMessages;
    } catch (error: any) {
      console.error(`Failed to get thread messages: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract content from Gmail message payload
   */
  private extractMessageContent(payload: any): { html?: string, text?: string } {
    if (!payload) return {};
    
    let html = '';
    let text = '';
    
    const extractFromPart = (part: any) => {
      if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        text = Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };
    
    if (payload.body?.data) {
      if (payload.mimeType === 'text/html') {
        html = Buffer.from(payload.body.data, 'base64').toString('utf8');
      } else if (payload.mimeType === 'text/plain') {
        text = Buffer.from(payload.body.data, 'base64').toString('utf8');
      }
    } else if (payload.parts) {
      payload.parts.forEach(extractFromPart);
    }
    
    return { html, text };
  }

  /**
   * List recent emails from Gmail INBOX
   */
  async listEmails(userId: string, limit = 10): Promise<EmailListResponse> {
    try {
      const gmail = await this.getGmailService(userId);

      // Get message list from INBOX only
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: limit,
        q: '',
        labelIds: ['INBOX']
      });

      const messages = listResponse.data.messages || [];
      const emails: EmailListItem[] = [];

      // Get details for each message
      for (const message of messages) {
        if (!message.id) continue;

        const detailResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });

        const headers = detailResponse.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';

        emails.push({
          id: message.id,
          threadId: message.threadId || '',
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          date: new Date(getHeader('Date')).toISOString(),
          snippet: detailResponse.data.snippet || ''
        });
      }

      return { ok: true, emails };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Failed to list emails' };
    }
  }

  /**
   * Get detailed thread content by threadId
   */
  async getThreadDetails(userId: string, threadId: string) {
    try {
      const gmail = await this.getGmailService(userId);

      // Get the thread with all messages
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId
      });

      const messages = threadResponse.data.messages || [];
      const threadMessages = [];

      // Get details for each message in the thread
      for (const message of messages) {
        if (!message.id) continue;

        const detailResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const headers = detailResponse.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';

        // Extract message body
        let body = '';
        const payload = detailResponse.data.payload;
        if (payload) {
          if (payload.parts) {
            // Multipart message
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                body += Buffer.from(part.body.data, 'base64').toString();
              } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
                // Fallback to HTML if no plain text
                body += Buffer.from(part.body.data, 'base64').toString();
              }
            }
          } else if (payload.body?.data) {
            // Single part message
            body = Buffer.from(payload.body.data, 'base64').toString();
          }
        }

        threadMessages.push({
          id: message.id,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          dateISO: new Date(getHeader('Date')).toISOString(),
          body: body || detailResponse.data.snippet || '',
          snippet: detailResponse.data.snippet || ''
        });
      }

      // Sort messages by date (oldest first for thread view)
      threadMessages.sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());

      return {
        ok: true,
        thread: {
          threadId,
          messages: threadMessages,
          count: threadMessages.length,
          subject: threadMessages[0]?.subject || 'No Subject'
        }
      };

    } catch (error: any) {
      console.error('Error getting thread details:', error);
      
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        return { ok: false, needsReconnect: true };
      }
      
      return { 
        ok: false, 
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Sync Gmail thread to database
   */
  async syncThreadToDatabase(userId: string, threadId: string, projectId?: string) {
    try {
      const gmail = await this.getGmailService(userId);

      // Get the thread with all messages
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      if (!threadResponse.data.messages) {
        return { ok: false, error: 'No messages in thread' };
      }

      // Convert Gmail thread format to our sync format
      const gmailThread = {
        id: threadId,
        snippet: threadResponse.data.messages[0]?.snippet,
        messages: threadResponse.data.messages.map(msg => ({
          id: msg.id,
          threadId: msg.threadId,
          payload: msg.payload,
          snippet: msg.snippet,
          internalDate: msg.internalDate
        }))
      };

      // Sync to database
      const syncedThread = await emailSyncService.syncGmailThread(gmailThread, projectId);
      
      return { ok: true, thread: syncedThread };
    } catch (error: any) {
      console.error('Error syncing thread to database:', error);
      return { ok: false, error: error.message || 'Failed to sync thread' };
    }
  }

  /**
   * Sync multiple Gmail threads for project addresses
   */
  async syncProjectThreads(userId: string, projectId: string, addresses: string[], limit = 50) {
    try {
      // Get threads from Gmail for these addresses
      const threadsResponse = await this.listThreadsForAddresses(userId, { addresses, limit });
      
      if (!threadsResponse.ok || !threadsResponse.threads) {
        return { ok: false, error: 'Failed to fetch threads from Gmail' };
      }

      const syncResults = [];
      
      // Sync each thread to database
      for (const thread of threadsResponse.threads) {
        const syncResult = await this.syncThreadToDatabase(userId, thread.threadId, projectId);
        syncResults.push({
          threadId: thread.threadId,
          synced: syncResult.ok,
          error: syncResult.error
        });
      }

      return {
        ok: true,
        syncedCount: syncResults.filter(r => r.synced).length,
        totalThreads: syncResults.length,
        results: syncResults
      };
    } catch (error: any) {
      console.error('Error syncing project threads:', error);
      return { ok: false, error: error.message || 'Failed to sync project threads' };
    }
  }

  /**
   * Get attachment data from Gmail
   */
  async getAttachmentData(userId: string, messageId: string, attachmentId: string): Promise<Buffer | null> {
    try {
      const gmail = await this.getGmailService(userId);
      
      const response = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId
      });

      if (response.data.data) {
        return Buffer.from(response.data.data, 'base64');
      }
      
      return null;
    } catch (error: any) {
      console.error('Error fetching attachment from Gmail:', error);
      return null;
    }
  }
}

// Singleton with proper token lookup function
export const gmailService = new GmailService(getUserGoogleTokens);