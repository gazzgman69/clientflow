import { google } from 'googleapis';
import type { EmailProviderIntegration } from '@shared/schema';
import { storage } from '../../storage';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SyncContactsOnlyParams {
  tenantId: string;
  userId: string;
  integration: EmailProviderIntegration;
}

export class GmailEmailProvider {
  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(integration: EmailProviderIntegration): Promise<EmailProviderIntegration> {
    // Check if token is expired or about to expire (within 5 minutes)
    const now = new Date();
    const expiresAt = integration.expiresAt ? new Date(integration.expiresAt) : null;
    
    if (!expiresAt || expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
      // Token is still valid
      return integration;
    }

    console.log('🔄 Gmail: Refreshing access token for integration:', integration.id);

    // Validate credentials
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Get redirect URI
    const redirectUri = this.getRedirectUri();

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: integration.refreshTokenEnc
    });

    try {
      // Refresh the token
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update integration with new tokens
      const updatedIntegration = await storage.upsertEmailProviderIntegration({
        tenantId: integration.tenantId,
        userId: integration.userId,
        provider: 'google',
        status: 'connected',
        accountEmail: integration.accountEmail,
        scopes: integration.scopes,
        accessTokenEnc: credentials.access_token || integration.accessTokenEnc,
        refreshTokenEnc: credentials.refresh_token || integration.refreshTokenEnc,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : integration.expiresAt,
        metadata: integration.metadata,
        nextSyncCursor: integration.nextSyncCursor
      }, integration.tenantId);

      console.log('✅ Gmail: Token refreshed successfully');
      
      return updatedIntegration;
    } catch (error: any) {
      console.error('❌ Gmail: Token refresh failed:', error);
      
      // Mark integration as error status
      await storage.upsertEmailProviderIntegration({
        tenantId: integration.tenantId,
        userId: integration.userId,
        provider: 'google',
        status: 'error',
        accountEmail: integration.accountEmail,
        scopes: integration.scopes,
        accessTokenEnc: integration.accessTokenEnc,
        refreshTokenEnc: integration.refreshTokenEnc,
        expiresAt: integration.expiresAt,
        metadata: JSON.stringify({ ...JSON.parse(integration.metadata || '{}'), lastError: error.message }),
        nextSyncCursor: integration.nextSyncCursor
      }, integration.tenantId);

      throw new Error(`Failed to refresh Gmail token: ${error.message}`);
    }
  }

  /**
   * Send email via Gmail API
   */
  async sendEmail(integration: EmailProviderIntegration, params: SendEmailParams): Promise<{ messageId: string; warning?: string }> {
    // Decrypt secrets if using new format
    let access_token = integration.accessTokenEnc || '';
    let refresh_token = integration.refreshTokenEnc || '';
    
    if (integration.secretsEnc) {
      const decrypted = await storage.decryptEmailAccountSecrets(integration.secretsEnc);
      access_token = decrypted?.accessToken || '';
      refresh_token = decrypted?.refreshToken || '';
    }
    
    // Validate credentials
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Get redirect URI
    const redirectUri = this.getRedirectUri();

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token,
      refresh_token
    });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Build email message
    const toAddresses = Array.isArray(params.to) ? params.to.join(',') : params.to;
    const ccAddresses = params.cc ? (Array.isArray(params.cc) ? params.cc.join(',') : params.cc) : '';
    const bccAddresses = params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(',') : params.bcc) : '';

    // Gmail always sends from the authenticated account
    // If a different "from" is requested, we'll use replyTo instead
    const fromAddress = integration.accountEmail || '';
    let warning: string | undefined;
    
    // If replyTo is specified and different from authenticated account, use it
    const replyToAddress = params.replyTo && params.replyTo !== fromAddress ? params.replyTo : '';
    
    if (params.replyTo && params.replyTo !== fromAddress) {
      warning = `Gmail only supports sending from authenticated account (${fromAddress}). Using ${params.replyTo} as Reply-To address.`;
      console.warn('⚠️ Gmail:', warning);
    }

    const messageParts = [
      `From: ${fromAddress}`,
      `To: ${toAddresses}`,
      ccAddresses ? `Cc: ${ccAddresses}` : '',
      bccAddresses ? `Bcc: ${bccAddresses}` : '',
      replyToAddress ? `Reply-To: ${replyToAddress}` : '',
      `Subject: ${params.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      params.html || params.text || ''
    ].filter(part => part !== '').join('\n');

    // Encode message in base64url
    const encodedMessage = Buffer.from(messageParts)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log('📧 Gmail: Email sent successfully:', response.data.id);

      // Log structured event
      console.log(JSON.stringify({
        event: 'email_send_success',
        provider: 'google',
        tenantId: integration.tenantId,
        userId: integration.userId,
        messageId: response.data.id,
        timestamp: new Date().toISOString()
      }));

      return {
        messageId: response.data.id || '',
        warning
      };
    } catch (error: any) {
      console.error('❌ Gmail: Send failed:', error);

      // Log structured event
      console.log(JSON.stringify({
        event: 'email_send_error',
        provider: 'google',
        tenantId: integration.tenantId,
        userId: integration.userId,
        error: error.message,
        timestamp: new Date().toISOString()
      }));

      throw new Error(`Failed to send email via Gmail: ${error.message}`);
    }
  }

  /**
   * Sync contacts-only emails (only ingest emails from/to known contacts)
   */
  async syncContactsOnly(params: SyncContactsOnlyParams): Promise<{ ingested: number; skipped: number }> {
    const { tenantId, userId, integration } = params;

    // Refresh token if needed
    const activeIntegration = await this.refreshTokenIfNeeded(integration);

    // Get all contacts for this tenant to build email map
    const contacts = await storage.getContacts(tenantId, userId);
    const contactEmailMap = new Map<string, string>(); // email -> contactId
    
    contacts.forEach(contact => {
      if (contact.email) {
        contactEmailMap.set(contact.email.toLowerCase(), contact.id);
      }
    });

    console.log(`📬 Gmail: Found ${contactEmailMap.size} contact emails for tenant ${tenantId}`);

    // Validate credentials
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Get redirect URI
    const redirectUri = this.getRedirectUri();

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: activeIntegration.accessTokenEnc,
      refresh_token: activeIntegration.refreshTokenEnc
    });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let ingested = 0;
    let skipped = 0;

    try {
      // List messages (limit to recent 50 for now)
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 50
      });

      const messages = response.data.messages || [];
      console.log(`📬 Gmail: Found ${messages.length} messages to process`);

      // Process each message
      for (const message of messages) {
        if (!message.id) continue;

        try {
          // Get message details
          const messageData = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date']
          });

          // Extract email addresses from headers
          const headers = messageData.data.payload?.headers || [];
          const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
          const toHeader = headers.find(h => h.name?.toLowerCase() === 'to')?.value || '';
          const ccHeader = headers.find(h => h.name?.toLowerCase() === 'cc')?.value || '';

          // Extract all email addresses
          const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
          const allEmails = [fromHeader, toHeader, ccHeader]
            .join(' ')
            .match(emailRegex) || [];

          // Check if any email matches a contact
          const matchingEmails = allEmails.filter(email => 
            contactEmailMap.has(email.toLowerCase())
          );

          if (matchingEmails.length === 0) {
            // Skip this message - no matching contacts
            skipped++;
            continue;
          }

          // Find matching contact ID
          const contactId = contactEmailMap.get(matchingEmails[0].toLowerCase());
          
          // TODO: Store email in database (this will be handled by main agent separately)
          // For now, just log that we would ingest this
          console.log(`✅ Gmail: Would ingest message ${message.id} for contact ${contactId}`);
          ingested++;

          // Log structured event
          console.log(JSON.stringify({
            event: 'email_sync_ingested',
            provider: 'google',
            tenantId,
            userId,
            messageId: message.id,
            contactId,
            timestamp: new Date().toISOString()
          }));

        } catch (error: any) {
          console.error(`❌ Gmail: Failed to process message ${message.id}:`, error);
          skipped++;
        }
      }

      // Update sync cursor (historyId for incremental sync)
      if (response.data.resultSizeEstimate) {
        await storage.upsertEmailProviderIntegration({
          tenantId: activeIntegration.tenantId,
          userId: activeIntegration.userId,
          provider: 'google',
          status: 'connected',
          accountEmail: activeIntegration.accountEmail,
          scopes: activeIntegration.scopes,
          accessTokenEnc: activeIntegration.accessTokenEnc,
          refreshTokenEnc: activeIntegration.refreshTokenEnc,
          expiresAt: activeIntegration.expiresAt,
          metadata: activeIntegration.metadata,
          lastSyncedAt: new Date(),
          nextSyncCursor: response.data.messages?.[0]?.id || activeIntegration.nextSyncCursor
        }, tenantId);
      }

      console.log(`📬 Gmail: Sync complete - ingested: ${ingested}, skipped: ${skipped}`);

      return { ingested, skipped };

    } catch (error: any) {
      console.error('❌ Gmail: Sync failed:', error);
      throw new Error(`Failed to sync Gmail contacts: ${error.message}`);
    }
  }

  /**
   * Get redirect URI for OAuth
   */
  private getRedirectUri(): string {
    if (process.env.REPLIT_DOMAINS) {
      const domain = process.env.REPLIT_DOMAINS.split(',')[0];
      return `https://${domain}/api/auth/google/gmail/callback`;
    }
    return 'http://localhost:5000/api/auth/google/gmail/callback';
  }
}

// Export singleton instance
export const gmailEmailProvider = new GmailEmailProvider();
