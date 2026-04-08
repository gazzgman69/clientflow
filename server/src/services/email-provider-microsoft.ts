import { Client } from '@microsoft/microsoft-graph-client';
import type { EmailProviderIntegration } from '@shared/schema';
import { storage } from '../../storage';
import * as fs from 'fs/promises';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    path: string;
    contentType?: string;
  }>;
  inlineImages?: Array<{
    cid: string;
    contentType: string;
    base64: string;
  }>;
}

export interface SyncContactsOnlyParams {
  tenantId: string;
  userId: string;
  integration: EmailProviderIntegration;
}

export class MicrosoftEmailProvider {
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

    console.log('🔄 Microsoft: Refreshing access token for integration:', integration.id);

    // Validate credentials
    const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
    const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;

    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured');
    }

    try {
      // Decrypt secrets if using new encrypted format (email_accounts table)
      let refresh_token = integration.refreshTokenEnc || '';
      if ((integration as any).secretsEnc) {
        const decrypted = await storage.decryptEmailAccountSecrets((integration as any).secretsEnc);
        refresh_token = decrypted?.refreshToken || refresh_token;
      }

      if (!refresh_token) {
        throw new Error('No refresh token available for Microsoft. Please reconnect your account.');
      }

      // Microsoft token refresh endpoint
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

      const params = new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const data = await response.json();
      
      // Update integration with new tokens
      const updatedIntegration = await storage.upsertEmailProviderIntegration({
        tenantId: integration.tenantId,
        userId: integration.userId,
        provider: 'microsoft',
        status: 'connected',
        accountEmail: integration.accountEmail,
        scopes: integration.scopes,
        accessTokenEnc: data.access_token || integration.accessTokenEnc,
        refreshTokenEnc: data.refresh_token || integration.refreshTokenEnc,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : integration.expiresAt,
        metadata: integration.metadata,
        nextSyncCursor: integration.nextSyncCursor
      }, integration.tenantId);

      console.log('✅ Microsoft: Token refreshed successfully');
      
      return updatedIntegration;
    } catch (error: any) {
      console.error('❌ Microsoft: Token refresh failed:', error);
      
      // Mark integration as error status
      await storage.upsertEmailProviderIntegration({
        tenantId: integration.tenantId,
        userId: integration.userId,
        provider: 'microsoft',
        status: 'error',
        accountEmail: integration.accountEmail,
        scopes: integration.scopes,
        accessTokenEnc: integration.accessTokenEnc,
        refreshTokenEnc: integration.refreshTokenEnc,
        expiresAt: integration.expiresAt,
        metadata: JSON.stringify({ ...JSON.parse(integration.metadata || '{}'), lastError: error.message }),
        nextSyncCursor: integration.nextSyncCursor
      }, integration.tenantId);

      throw new Error(`Failed to refresh Microsoft token: ${error.message}`);
    }
  }

  /**
   * Send email via Microsoft Graph API
   */
  async sendEmail(integration: EmailProviderIntegration, params: SendEmailParams): Promise<{ messageId: string; warning?: string }> {
    // Refresh token if needed
    const activeIntegration = await this.refreshTokenIfNeeded(integration);

    // Decrypt secrets if using new encrypted format (email_accounts table)
    let access_token = activeIntegration.accessTokenEnc || '';
    if ((activeIntegration as any).secretsEnc) {
      const decrypted = await storage.decryptEmailAccountSecrets((activeIntegration as any).secretsEnc);
      access_token = decrypted?.accessToken || access_token;
    }

    if (!access_token) {
      throw new Error('No access token available for Microsoft email. Please reconnect your Microsoft account.');
    }

    // Create Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, access_token);
      }
    });

    // Build recipients
    const toRecipients = (Array.isArray(params.to) ? params.to : [params.to]).map(email => ({
      emailAddress: { address: email }
    }));

    const ccRecipients = params.cc 
      ? (Array.isArray(params.cc) ? params.cc : [params.cc]).map(email => ({
          emailAddress: { address: email }
        }))
      : [];

    const bccRecipients = params.bcc 
      ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]).map(email => ({
          emailAddress: { address: email }
        }))
      : [];

    // Microsoft Graph always sends from the authenticated account
    // If a different "from" is requested, we'll use replyTo instead
    const fromAddress = activeIntegration.accountEmail || '';
    let warning: string | undefined;
    
    // If replyTo is specified and different from authenticated account, use it
    const replyToRecipients = params.replyTo && params.replyTo !== fromAddress 
      ? [{ emailAddress: { address: params.replyTo } }]
      : [];
    
    if (params.replyTo && params.replyTo !== fromAddress) {
      warning = `Microsoft only supports sending from authenticated account (${fromAddress}). Using ${params.replyTo} as Reply-To address.`;
      console.warn('⚠️ Microsoft:', warning);
    }

    // Process file attachments if present
    const msAttachments: any[] = [];
    if (params.attachments && params.attachments.length > 0) {
      for (const att of params.attachments) {
        try {
          const fileBuffer = await fs.readFile(att.path);
          const base64Content = fileBuffer.toString('base64');
          msAttachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: att.filename,
            contentType: att.contentType || 'application/octet-stream',
            contentBytes: base64Content
          });
        } catch (err) {
          console.error(`Failed to read attachment ${att.filename}:`, err);
        }
      }
    }

    // Process inline images (CID-referenced, e.g. logo) as inline attachments
    if (params.inlineImages && params.inlineImages.length > 0) {
      for (const img of params.inlineImages) {
        msAttachments.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: `${img.cid.replace('@', '_')}.${img.contentType.split('/')[1] || 'png'}`,
          contentType: img.contentType,
          contentBytes: img.base64,
          contentId: img.cid,
          isInline: true
        });
      }
    }

    // Build message
    const message: any = {
      subject: params.subject,
      body: {
        contentType: params.html ? 'HTML' : 'Text',
        content: params.html || params.text || ''
      },
      toRecipients,
      ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
      bccRecipients: bccRecipients.length > 0 ? bccRecipients : undefined,
      replyTo: replyToRecipients.length > 0 ? replyToRecipients : undefined,
      attachments: msAttachments.length > 0 ? msAttachments : undefined
    };

    try {
      // Send email using Graph API
      const response = await client
        .api('/me/sendMail')
        .post({
          message,
          saveToSentItems: true
        });

      // Note: sendMail doesn't return a message ID directly
      // We'll use a timestamp-based ID for logging
      const messageId = `microsoft-${Date.now()}`;

      console.log('📧 Microsoft: Email sent successfully');

      // Log structured event
      console.log(JSON.stringify({
        event: 'email_send_success',
        provider: 'microsoft',
        tenantId: activeIntegration.tenantId,
        userId: activeIntegration.userId,
        messageId,
        timestamp: new Date().toISOString()
      }));

      return {
        messageId,
        warning
      };
    } catch (error: any) {
      console.error('❌ Microsoft: Send failed:', error);

      // Log structured event
      console.log(JSON.stringify({
        event: 'email_send_error',
        provider: 'microsoft',
        tenantId: activeIntegration.tenantId,
        userId: activeIntegration.userId,
        error: error.message,
        timestamp: new Date().toISOString()
      }));

      throw new Error(`Failed to send email via Microsoft: ${error.message}`);
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

    console.log(`📬 Microsoft: Found ${contactEmailMap.size} contact emails for tenant ${tenantId}`);

    // Create Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, activeIntegration.accessTokenEnc || '');
      }
    });

    let ingested = 0;
    let skipped = 0;

    try {
      // List messages (limit to recent 50 for now)
      const response = await client
        .api('/me/messages')
        .select('id,from,toRecipients,ccRecipients,subject,receivedDateTime')
        .top(50)
        .get();

      const messages = response.value || [];
      console.log(`📬 Microsoft: Found ${messages.length} messages to process`);

      // Process each message
      for (const message of messages) {
        try {
          // Extract email addresses
          const fromEmail = message.from?.emailAddress?.address?.toLowerCase() || '';
          const toEmails = (message.toRecipients || []).map((r: any) => r.emailAddress?.address?.toLowerCase() || '');
          const ccEmails = (message.ccRecipients || []).map((r: any) => r.emailAddress?.address?.toLowerCase() || '');

          const allEmails = [fromEmail, ...toEmails, ...ccEmails].filter(e => e);

          // Check if any email matches a contact
          const matchingEmails = allEmails.filter(email => 
            contactEmailMap.has(email)
          );

          if (matchingEmails.length === 0) {
            // Skip this message - no matching contacts
            skipped++;
            continue;
          }

          // Find matching contact ID
          const contactId = contactEmailMap.get(matchingEmails[0]);
          
          // TODO: Store email in database (this will be handled by main agent separately)
          // For now, just log that we would ingest this
          console.log(`✅ Microsoft: Would ingest message ${message.id} for contact ${contactId}`);
          ingested++;

          // Log structured event
          console.log(JSON.stringify({
            event: 'email_sync_ingested',
            provider: 'microsoft',
            tenantId,
            userId,
            messageId: message.id,
            contactId,
            timestamp: new Date().toISOString()
          }));

        } catch (error: any) {
          console.error(`❌ Microsoft: Failed to process message ${message.id}:`, error);
          skipped++;
        }
      }

      // Update sync cursor
      await storage.upsertEmailProviderIntegration({
        tenantId: activeIntegration.tenantId,
        userId: activeIntegration.userId,
        provider: 'microsoft',
        status: 'connected',
        accountEmail: activeIntegration.accountEmail,
        scopes: activeIntegration.scopes,
        accessTokenEnc: activeIntegration.accessTokenEnc,
        refreshTokenEnc: activeIntegration.refreshTokenEnc,
        expiresAt: activeIntegration.expiresAt,
        metadata: activeIntegration.metadata,
        lastSyncedAt: new Date(),
        nextSyncCursor: messages[0]?.id || activeIntegration.nextSyncCursor
      }, tenantId);

      console.log(`📬 Microsoft: Sync complete - ingested: ${ingested}, skipped: ${skipped}`);

      return { ingested, skipped };

    } catch (error: any) {
      console.error('❌ Microsoft: Sync failed:', error);
      throw new Error(`Failed to sync Microsoft contacts: ${error.message}`);
    }
  }

  /**
   * Get redirect URI for OAuth
   */
  private getRedirectUri(): string {
    if (process.env.REPLIT_DOMAINS) {
      const domain = process.env.REPLIT_DOMAINS.split(',')[0];
      return `https://${domain}/api/auth/microsoft/mail/callback`;
    }
    return 'http://localhost:5000/api/auth/microsoft/mail/callback';
  }
}

// Export singleton instance
export const microsoftEmailProvider = new MicrosoftEmailProvider();
