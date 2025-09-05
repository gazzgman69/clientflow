import { google } from 'googleapis';
import { getUserGoogleTokens } from '../storage/google-tokens';

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
   * Send email using Gmail API
   */
  async sendEmail(userId: string, emailRequest: EmailRequest): Promise<EmailResponse> {
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
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage }
      });

      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message || 'Failed to send email' };
    }
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
}

// Singleton with proper token lookup function
export const gmailService = new GmailService(getUserGoogleTokens);