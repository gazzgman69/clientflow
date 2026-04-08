import { Client } from '@microsoft/microsoft-graph-client';
import type { EmailProviderIntegration } from '@shared/schema';
import { storage } from '../../storage';
import { db } from '../../db';
import { emails, emailThreads, contacts, projects } from '@shared/schema';
import { eq, and, desc, isNotNull, notInArray } from 'drizzle-orm';
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
      console.log('📧 Microsoft Graph sendMail:', { subject: message.subject, to: message.toRecipients?.map((r: any) => r.emailAddress?.address), contentType: message.body?.contentType, hasBody: !!message.body?.content });
      // Send email using Graph API
      await client
        .api('/me/sendMail')
        .post({
          message,
          saveToSentItems: true
        });

      console.log('📧 Microsoft: Email sent successfully');

      // sendMail returns void — fetch the actual message from Sent Items
      // to get the real messageId and conversationId for proper threading
      let messageId = `microsoft-${Date.now()}`;
      let conversationId: string | undefined;

      try {
        // Small delay to let Microsoft process the send
        await new Promise(resolve => setTimeout(resolve, 1500));

        const sentItems = await client
          .api('/me/mailFolders/SentItems/messages')
          .select('id,conversationId,internetMessageId')
          .filter(`subject eq '${(params.subject || '').replace(/'/g, "''")}'`)
          .top(1)
          .orderby('sentDateTime desc')
          .get();

        if (sentItems?.value?.length > 0) {
          const sentMsg = sentItems.value[0];
          messageId = sentMsg.internetMessageId || sentMsg.id || messageId;
          conversationId = sentMsg.conversationId;
          console.log('📧 Microsoft: Retrieved sent message IDs:', { messageId, conversationId });
        }
      } catch (lookupErr) {
        console.warn('⚠️ Microsoft: Could not retrieve sent message ID (non-fatal):', lookupErr);
        // Continue with fallback IDs — sync will reconcile later
      }

      // Log structured event
      console.log(JSON.stringify({
        event: 'email_send_success',
        provider: 'microsoft',
        tenantId: activeIntegration.tenantId,
        userId: activeIntegration.userId,
        messageId,
        conversationId,
        timestamp: new Date().toISOString()
      }));

      return {
        messageId,
        threadId: conversationId,
        provider: 'microsoft',
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
   * Sync inbox emails from Microsoft Graph — mirrors the Gmail sync pattern.
   * Only ingests messages from/to known CRM contacts, creates threads, and links to projects.
   */
  async syncInbox(params: SyncContactsOnlyParams): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const { tenantId, userId, integration } = params;
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Refresh token if needed
    const activeIntegration = await this.refreshTokenIfNeeded(integration);

    // Decrypt access token
    let accessToken = activeIntegration.accessTokenEnc || '';
    if ((activeIntegration as any).secretsEnc) {
      const decrypted = await storage.decryptEmailAccountSecrets((activeIntegration as any).secretsEnc);
      accessToken = decrypted?.accessToken || accessToken;
    }
    if (!accessToken) {
      return { synced: 0, skipped: 0, errors: ['No access token for Microsoft account'] };
    }

    // Build contact→project and contact→contactId maps (same approach as Gmail sync)
    const projectsWithContacts = await db
      .select({
        projectId: projects.id,
        contactEmail: contacts.email,
        contactId: contacts.id,
      })
      .from(projects)
      .leftJoin(contacts, and(eq(contacts.id, projects.contactId), eq(contacts.tenantId, tenantId)))
      .where(and(eq(projects.tenantId, tenantId), isNotNull(contacts.email)));

    const emailToProjectMap = new Map<string, string>();
    const emailToContactMap = new Map<string, string>();
    projectsWithContacts.forEach(p => {
      if (p.contactEmail) {
        emailToProjectMap.set(p.contactEmail.toLowerCase(), p.projectId);
        if (p.contactId) emailToContactMap.set(p.contactEmail.toLowerCase(), p.contactId);
      }
    });

    const contactEmails = Array.from(emailToProjectMap.keys());
    if (contactEmails.length === 0) {
      return { synced: 0, skipped: 0, errors: [] };
    }

    // Get the authenticated user's email so we can determine direction
    const userEmail = activeIntegration.accountEmail?.toLowerCase() || '';

    // Create Graph client
    const client = Client.init({
      authProvider: (done) => { done(null, accessToken); }
    });

    try {
      // Build OData filter to only fetch messages involving known contacts
      // Microsoft Graph $filter supports 'from/emailAddress/address eq ...' and 'toRecipients/any(...)'
      // But complex OR across from/to isn't well-supported, so we fetch recent messages and filter in-app
      const response = await client
        .api('/me/messages')
        .select('id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,receivedDateTime,body')
        .top(100)
        .orderby('receivedDateTime desc')
        .get();

      const messages = response.value || [];
      console.log(`📬 Microsoft sync: Fetched ${messages.length} recent messages for tenant ${tenantId}`);

      for (const message of messages) {
        try {
          const fromEmail = (message.from?.emailAddress?.address || '').toLowerCase();
          const fromName = message.from?.emailAddress?.name || fromEmail;
          const toEmailsList = (message.toRecipients || []).map((r: any) => (r.emailAddress?.address || '').toLowerCase());
          const allRecipients = [...toEmailsList];
          const ccEmailsList = (message.ccRecipients || []).map((r: any) => (r.emailAddress?.address || '').toLowerCase());

          // Check if any participant is a known contact
          const allParticipants = [fromEmail, ...allRecipients, ...ccEmailsList];
          const hasKnownContact = allParticipants.some(e => emailToContactMap.has(e));
          if (!hasKnownContact) {
            skipped++;
            continue;
          }

          // Determine direction
          const direction = fromEmail === userEmail ? 'outbound' : 'inbound';

          // Find contact ID
          let contactId: string | null = null;
          if (direction === 'inbound') {
            contactId = emailToContactMap.get(fromEmail) || null;
            if (!contactId) {
              // Try DB lookup for contacts not linked to projects
              const [existingContact] = await db
                .select({ id: contacts.id })
                .from(contacts)
                .where(and(eq(contacts.tenantId, tenantId), eq(contacts.email, fromEmail)))
                .limit(1);
              contactId = existingContact?.id || null;
            }
            if (!contactId) {
              skipped++;
              continue; // Ingestion guard: skip unknown senders
            }
          } else {
            // Outbound: match recipient to contact
            for (const toEmail of allRecipients) {
              contactId = emailToContactMap.get(toEmail) || null;
              if (contactId) break;
            }
            if (!contactId) {
              skipped++;
              continue;
            }
          }

          // Find matching project
          let matchedProjectId: string | null = null;
          if (direction === 'inbound' && emailToProjectMap.has(fromEmail)) {
            matchedProjectId = emailToProjectMap.get(fromEmail)!;
          } else {
            for (const e of allRecipients) {
              if (emailToProjectMap.has(e)) {
                matchedProjectId = emailToProjectMap.get(e)!;
                break;
              }
            }
          }

          // Auto-link to most recent non-terminal project for this contact
          if (contactId && !matchedProjectId) {
            const terminalStatuses = ['lost', 'cancelled', 'archived', 'completed'];
            const [activeProject] = await db
              .select({ id: projects.id })
              .from(projects)
              .where(and(
                eq(projects.contactId, contactId),
                eq(projects.tenantId, tenantId),
                notInArray(projects.status, terminalStatuses)
              ))
              .orderBy(desc(projects.createdAt))
              .limit(1);
            if (activeProject) {
              matchedProjectId = activeProject.id;
            }
          }

          // Use Microsoft conversationId as thread grouping (analogous to Gmail threadId)
          const threadId = message.conversationId || message.id;
          const emailId = `ms_${message.id}`;

          // Upsert thread
          const [existingThread] = await db
            .select({ id: emailThreads.id })
            .from(emailThreads)
            .where(eq(emailThreads.id, threadId))
            .limit(1);

          if (!existingThread) {
            await db.insert(emailThreads).values({
              id: threadId,
              userId,
              tenantId,
              subject: message.subject || 'No Subject',
              projectId: matchedProjectId,
              lastMessageAt: new Date(message.receivedDateTime),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            const updateData: any = {
              lastMessageAt: new Date(message.receivedDateTime),
              updatedAt: new Date(),
            };
            if (matchedProjectId && !existingThread) {
              updateData.projectId = matchedProjectId;
            }
            await db.update(emailThreads)
              .set(updateData)
              .where(eq(emailThreads.id, threadId));
          }

          // Upsert email record
          await db
            .insert(emails)
            .values({
              id: emailId,
              threadId,
              userId,
              tenantId,
              provider: 'microsoft',
              providerMessageId: message.id,
              direction,
              fromEmail: `${fromName} <${fromEmail}>`,
              toEmails: toEmailsList,
              ccEmails: ccEmailsList,
              subject: message.subject || 'No Subject',
              bodyText: message.bodyPreview || '',
              bodyHtml: message.body?.contentType === 'html' ? message.body.content : null,
              snippet: (message.bodyPreview || '').substring(0, 200),
              sentAt: new Date(message.receivedDateTime),
              hasAttachments: false,
              contactId,
              projectId: matchedProjectId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [emails.provider, emails.providerMessageId],
              set: {
                updatedAt: new Date(),
                subject: message.subject || 'No Subject',
                bodyText: message.bodyPreview || '',
                snippet: (message.bodyPreview || '').substring(0, 200),
                projectId: matchedProjectId,
                contactId,
              },
            });

          synced++;
        } catch (msgError: any) {
          errors.push(`Message ${message.id}: ${msgError.message}`);
          skipped++;
        }
      }

      console.log(`📬 Microsoft sync complete: ${synced} synced, ${skipped} skipped, ${errors.length} errors`);
      return { synced, skipped, errors };

    } catch (error: any) {
      console.error('❌ Microsoft inbox sync failed:', error);
      return { synced: 0, skipped: 0, errors: [error.message] };
    }
  }

  /**
   * Legacy wrapper for backward compatibility
   */
  async syncContactsOnly(params: SyncContactsOnlyParams): Promise<{ ingested: number; skipped: number }> {
    const result = await this.syncInbox(params);
    return { ingested: result.synced, skipped: result.skipped };
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
