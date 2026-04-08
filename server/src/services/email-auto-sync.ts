import { storage } from '../../storage';
import { emailSyncService } from './emailSync';
import { log } from '../../vite';
import { db } from '../../db';
import { and, eq, desc, isNotNull, notInArray } from 'drizzle-orm';
import { emails as emailsTable, emailThreads as emailThreadsTable, contacts as contactsTable, projects as projectsTable } from '@shared/schema';

/**
 * Auto-sync service for email synchronization across all tenants and providers
 * Supports Gmail (OAuth), Microsoft/Outlook (OAuth), and IMAP/SMTP (credentials)
 * with proper isolation, jitter/backoff, and feature flag support
 */
export class EmailAutoSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 60 * 1000; // 60 seconds — matches industry-standard CRM sync cadence
  private isRunning = false;
  private inProgressByUser = new Set<string>();
  private lastSyncByTenant = new Map<string, number>();
  private retryCountByTenant = new Map<string, number>();
  private readonly MAX_RETRIES = 3;
  private readonly BASE_BACKOFF_MS = 5000; // 5 seconds base backoff

  /**
   * Start the auto-sync service
   */
  start(): void {
    if (this.intervalId) {
      console.log('📧 Email auto-sync service is already running');
      return;
    }

    console.log('🚀 Starting email auto-sync service (every 60 seconds)');
    
    // Run initial sync after 30 seconds to let the server fully initialize
    setTimeout(() => {
      log('⏱️ Initial email sync timer fired');
      this.performAutoSync().catch(err => log('❌ Initial email sync error:', err));
    }, 30000);

    // Set up recurring sync every 3 minutes
    this.intervalId = setInterval(() => {
      log('⏱️ Scheduled email sync timer fired');
      this.performAutoSync().catch(err => log('❌ Scheduled email sync error:', err));
    }, this.SYNC_INTERVAL);

    console.log('✅ Email auto-sync service started successfully');
  }

  /**
   * Stop the auto-sync service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️  Email auto-sync service stopped');
    }
  }

  /**
   * Perform auto-sync for all tenants with proper isolation and feature flags
   * This method enumerates all active tenants and processes each with tenant-scoped storage
   */
  async performAutoSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Email auto-sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      // Get active tenants and process per tenant to ensure isolation
      const activeTenants = await storage.getActiveTenants();

      if (activeTenants.length === 0) {
        return;
      }
      
      let totalSuccessCount = 0;
      let totalErrorCount = 0;

      // Process each tenant with proper isolation
      for (const tenant of activeTenants) {
        try {
          const tenantStorage = storage.withTenant(tenant.id);
          
          // Check if email sync is enabled for this tenant via feature flag
          const { userPrefsService } = await import('./userPrefs');
          const emailSyncEnabled = await userPrefsService.getUserPref(tenant.id, 'emailSyncEnabled');
          if (emailSyncEnabled === 'false') {
            log(`📭 Email sync disabled for tenant ${tenant.id} via feature flag`);
            continue;
          }
          
          // Apply backoff if tenant had recent failures
          const retryCount = this.retryCountByTenant.get(tenant.id) || 0;
          if (retryCount > 0) {
            const backoffMs = this.BASE_BACKOFF_MS * Math.pow(2, retryCount - 1);
            const lastSync = this.lastSyncByTenant.get(tenant.id) || 0;
            const timeSinceLastSync = Date.now() - lastSync;
            
            if (timeSinceLastSync < backoffMs) {
              log(`⏳ Tenant ${tenant.id} in backoff (${Math.round((backoffMs - timeSinceLastSync) / 1000)}s remaining)`);
              continue;
            }
          }
          
          // Process tenant email sync — all connected providers (Gmail, Microsoft, etc.)

          const { emailAccounts: emailAccountsTable } = await import('@shared/schema');
          const allAccounts = await db
            .select()
            .from(emailAccountsTable)
            .where(
              and(
                eq(emailAccountsTable.tenantId, tenant.id),
                eq(emailAccountsTable.status, 'connected')
              )
            );

          if (allAccounts.length === 0) {
            log(`📭 No active email connections for tenant ${tenant.id}`);
            continue;
          }

          const gmailAccounts = allAccounts.filter(a => a.providerKey === 'google');
          const microsoftAccounts = allAccounts.filter(a => a.providerKey === 'microsoft');

          // Get unique user IDs across all providers
          const userIds = [...new Set(allAccounts.map(account => account.userId).filter(Boolean))];

          let tenantSuccessCount = 0;
          let tenantErrorCount = 0;

          // Add jitter to avoid thundering herd
          const jitterMs = Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, jitterMs));

          // Process each user across all their connected providers
          for (const userId of userIds) {
            if (this.inProgressByUser.has(userId)) {
              console.log(`⚠️  Email sync already in progress for user ${userId}, skipping...`);
              continue;
            }

            try {
              this.inProgressByUser.add(userId);

              // --- Gmail sync ---
              const userGmailAccounts = gmailAccounts.filter(a => a.userId === userId);
              if (userGmailAccounts.length > 0) {
                try {
                  console.log(`🔄 Syncing Gmail for user ${userId} in tenant ${tenant.id}`);
                  const result = await this.syncEmailsForTenant(userId, tenant.id);
                  if (result.synced > 0 || result.skipped > 0) {
                    console.log(`✅ Gmail ${tenant.id}/${userId}: ${result.synced} synced, ${result.skipped} skipped`);
                  }
                  for (const account of userGmailAccounts) {
                    await db.update(emailAccountsTable)
                      .set({ lastSyncedAt: new Date() })
                      .where(eq(emailAccountsTable.id, account.id));
                  }
                  tenantSuccessCount++;
                } catch (gmailErr) {
                  const msg = gmailErr instanceof Error ? gmailErr.message : 'Unknown error';
                  console.error(`❌ Gmail sync failed for ${userId}: ${msg}`);
                  tenantErrorCount++;
                }
              }

              // --- Microsoft sync ---
              const userMsAccounts = microsoftAccounts.filter(a => a.userId === userId);
              if (userMsAccounts.length > 0) {
                try {
                  console.log(`🔄 Syncing Microsoft for user ${userId} in tenant ${tenant.id}`);
                  const { microsoftEmailProvider } = await import('./email-provider-microsoft');

                  for (const msAccount of userMsAccounts) {
                    const msIntegration = {
                      id: msAccount.id,
                      tenantId: msAccount.tenantId,
                      userId: msAccount.userId,
                      provider: 'microsoft' as const,
                      providerKey: msAccount.providerKey,
                      accountEmail: msAccount.accountEmail,
                      status: msAccount.status as 'connected',
                      authType: msAccount.authType,
                      accessTokenEnc: '',
                      refreshTokenEnc: '',
                      scopes: [],
                      secretsEnc: msAccount.secretsEnc,
                      expiresAt: msAccount.expiresAt,
                      metadata: msAccount.metadata,
                      createdAt: null,
                      updatedAt: null,
                      lastSyncedAt: msAccount.lastSyncedAt,
                      nextSyncCursor: null,
                    };

                    const result = await microsoftEmailProvider.syncInbox({
                      tenantId: tenant.id,
                      userId,
                      integration: msIntegration as any,
                    });

                    if (result.synced > 0 || result.skipped > 0) {
                      console.log(`✅ Microsoft ${tenant.id}/${userId}: ${result.synced} synced, ${result.skipped} skipped`);
                    }

                    await db.update(emailAccountsTable)
                      .set({ lastSyncedAt: new Date() })
                      .where(eq(emailAccountsTable.id, msAccount.id));
                  }
                  tenantSuccessCount++;
                } catch (msErr) {
                  const msg = msErr instanceof Error ? msErr.message : 'Unknown error';
                  console.error(`❌ Microsoft sync failed for ${userId}: ${msg}`);
                  tenantErrorCount++;
                }
              }

              // --- IMAP/SMTP sync (any provider that isn't google or microsoft) ---
              const userImapAccounts = allAccounts.filter(
                a => a.userId === userId && a.providerKey !== 'google' && a.providerKey !== 'microsoft' && a.status === 'connected'
              );
              if (userImapAccounts.length > 0) {
                // Build contact→project maps for IMAP matching
                const projectsWithContacts = await db
                  .select({
                    projectId: projectsTable.id,
                    contactEmail: contactsTable.email,
                    contactId: contactsTable.id,
                  })
                  .from(projectsTable)
                  .leftJoin(contactsTable, and(eq(contactsTable.id, projectsTable.contactId), eq(contactsTable.tenantId, tenant.id)))
                  .where(and(eq(projectsTable.tenantId, tenant.id), isNotNull(contactsTable.email)));

                const emailToProjectMap = new Map<string, string>();
                const emailToContactMap = new Map<string, string>();
                projectsWithContacts.forEach(p => {
                  if (p.contactEmail) {
                    emailToProjectMap.set(p.contactEmail.toLowerCase(), p.projectId);
                    if (p.contactId) emailToContactMap.set(p.contactEmail.toLowerCase(), p.contactId);
                  }
                });

                try {
                  console.log(`🔄 Syncing IMAP for user ${userId} in tenant ${tenant.id}`);
                  const { ImapSmtpAdapter } = await import('../adapters/ImapSmtpAdapter');
                  const { secureStore } = await import('./secureStore');

                  for (const imapAccount of userImapAccounts) {
                    try {
                      if (!imapAccount.secretsEnc) continue;

                      // Decrypt credentials
                      const decrypted = secureStore.decrypt(imapAccount.secretsEnc);
                      const secrets = JSON.parse(decrypted);

                      if (!secrets.imapHost || !secrets.username || !secrets.password) {
                        console.log(`⚠️ IMAP account ${imapAccount.id} missing credentials, skipping`);
                        continue;
                      }

                      const adapter = new ImapSmtpAdapter();
                      await adapter.connect({
                        username: secrets.username,
                        password: secrets.password,
                        imapHost: secrets.imapHost,
                        imapPort: secrets.imapPort || 993,
                        imapSecure: secrets.imapSecure !== false,
                        smtpHost: secrets.smtpHost || '',
                        smtpPort: secrets.smtpPort || 587,
                        smtpSecure: secrets.smtpSecure || false,
                      } as any, { tenantId: tenant.id, userId } as any);

                      const messages = await adapter.fetchMessages({ limit: 50 });
                      console.log(`📬 IMAP ${tenant.id}/${userId}: Fetched ${messages.length} messages`);

                      // Store messages using same contact-matching logic
                      let imapSynced = 0;
                      for (const msg of messages) {
                        try {
                          const fromEmail = (msg.from || '').toLowerCase();
                          const matchedContactEmail = [fromEmail, ...(msg.to || []).map(e => e.toLowerCase())]
                            .find(e => emailToContactMap.has(e));

                          if (!matchedContactEmail) continue;

                          const contactId = emailToContactMap.get(matchedContactEmail) || null;
                          if (!contactId) continue;

                          const matchedProjectId = emailToProjectMap.get(matchedContactEmail) || null;
                          const threadId = msg.threadId || msg.subject?.replace(/^(Re:|Fwd?:)\s*/i, '').trim() || msg.id;
                          const emailId = `imap_${msg.id}`;

                          // Upsert thread
                          const [existingThread] = await db
                            .select({ id: emailThreadsTable.id })
                            .from(emailThreadsTable)
                            .where(eq(emailThreadsTable.id, threadId))
                            .limit(1);

                          if (!existingThread) {
                            await db.insert(emailThreadsTable).values({
                              id: threadId,
                              userId,
                              tenantId: tenant.id,
                              subject: msg.subject || 'No Subject',
                              projectId: matchedProjectId,
                              lastMessageAt: msg.date || new Date(),
                              createdAt: new Date(),
                              updatedAt: new Date(),
                            });
                          }

                          const direction = fromEmail.includes(imapAccount.accountEmail?.toLowerCase() || '') ? 'outbound' : 'inbound';

                          await db.insert(emailsTable).values({
                            id: emailId,
                            threadId,
                            userId,
                            tenantId: tenant.id,
                            provider: imapAccount.providerKey || 'imap_smtp',
                            providerMessageId: msg.id,
                            direction,
                            fromEmail: msg.from,
                            toEmails: msg.to || [],
                            subject: msg.subject || 'No Subject',
                            bodyText: msg.text || '',
                            bodyHtml: msg.html || null,
                            snippet: (msg.snippet || msg.text || '').substring(0, 200),
                            sentAt: msg.date || new Date(),
                            hasAttachments: msg.hasAttachments || false,
                            contactId,
                            projectId: matchedProjectId,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                          }).onConflictDoNothing();

                          imapSynced++;
                        } catch (msgErr) {
                          // Skip individual message errors
                        }
                      }

                      if (imapSynced > 0) {
                        console.log(`✅ IMAP ${tenant.id}/${userId}: ${imapSynced} synced`);
                      }

                      await db.update(emailAccountsTable)
                        .set({ lastSyncedAt: new Date() })
                        .where(eq(emailAccountsTable.id, imapAccount.id));

                      await adapter.disconnect();
                    } catch (acctErr) {
                      const msg = acctErr instanceof Error ? acctErr.message : 'Unknown error';
                      console.error(`❌ IMAP account ${imapAccount.id} sync failed: ${msg}`);
                    }
                  }
                  tenantSuccessCount++;
                } catch (imapErr) {
                  const msg = imapErr instanceof Error ? imapErr.message : 'Unknown error';
                  console.error(`❌ IMAP sync failed for ${userId}: ${msg}`);
                  tenantErrorCount++;
                }
              }

            } catch (error) {
              tenantErrorCount++;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`❌ Failed to sync emails for user ${userId} in tenant ${tenant.id}:`, errorMessage);
            } finally {
              this.inProgressByUser.delete(userId);
            }
          }
          
          // Update tenant sync tracking
          this.lastSyncByTenant.set(tenant.id, Date.now());
          
          if (tenantErrorCount > 0) {
            // Increment retry count for backoff
            const currentRetries = this.retryCountByTenant.get(tenant.id) || 0;
            this.retryCountByTenant.set(tenant.id, Math.min(currentRetries + 1, this.MAX_RETRIES));
          } else {
            // Reset retry count on success
            this.retryCountByTenant.set(tenant.id, 0);
          }
          
          totalSuccessCount += tenantSuccessCount;
          totalErrorCount += tenantErrorCount;
          
          console.log(`🏢 Tenant ${tenant.id} sync completed: ${tenantSuccessCount} success, ${tenantErrorCount} errors`);
          
        } catch (error) {
          console.error(`❌ Failed to process tenant ${tenant.id}:`, error);
          totalErrorCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Multi-tenant email sync completed in ${duration}ms - Success: ${totalSuccessCount}, Errors: ${totalErrorCount}`);
      
    } catch (error) {
      console.error('❌ Email auto-sync service encountered an error:', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Sync emails for a specific user within a tenant context
   */
  private async syncEmailsForTenant(userId: string, tenantId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const { EmailSyncService } = await import('./emailSync');
    // Instantiate EmailSyncService with tenant context
    const emailSyncService = new EmailSyncService(tenantId);
    return await emailSyncService.syncGmailThreadsToDatabase(userId);
  }

  /**
   * Sync emails for a specific user across ALL connected providers (safe for job handlers / post-send trigger)
   */
  async syncEmailsForUser(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
    if (this.inProgressByUser.has(userId)) {
      throw new Error(`Email sync already in progress for user ${userId}`);
    }

    try {
      this.inProgressByUser.add(userId);
      console.log(`🔄 Job-triggered email sync for user: ${userId}`);

      const user = await storage.getUserGlobal(userId);
      if (!user || !user.tenantId) {
        throw new Error(`Cannot find tenant context for user ${userId}`);
      }
      const tenantId = user.tenantId;

      let totalSynced = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];

      // Get all connected accounts for this user
      const { emailAccounts: emailAccountsTable } = await import('@shared/schema');
      const accounts = await db
        .select()
        .from(emailAccountsTable)
        .where(
          and(
            eq(emailAccountsTable.userId, userId),
            eq(emailAccountsTable.tenantId, tenantId),
            eq(emailAccountsTable.status, 'connected')
          )
        );

      // Gmail sync
      const hasGmail = accounts.some(a => a.providerKey === 'google');
      if (hasGmail) {
        try {
          const { EmailSyncService } = await import('./emailSync');
          const emailSyncService = new EmailSyncService(tenantId);
          const result = await emailSyncService.syncGmailThreadsToDatabase(userId);
          totalSynced += result.synced;
          totalSkipped += result.skipped;
          allErrors.push(...result.errors);
        } catch (err) {
          allErrors.push(`Gmail: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Microsoft sync
      const msAccounts = accounts.filter(a => a.providerKey === 'microsoft');
      if (msAccounts.length > 0) {
        try {
          const { microsoftEmailProvider } = await import('./email-provider-microsoft');
          for (const msAccount of msAccounts) {
            const msIntegration = {
              id: msAccount.id,
              tenantId: msAccount.tenantId,
              userId: msAccount.userId,
              provider: 'microsoft' as const,
              providerKey: msAccount.providerKey,
              accountEmail: msAccount.accountEmail,
              status: msAccount.status as 'connected',
              authType: msAccount.authType,
              accessTokenEnc: '',
              refreshTokenEnc: '',
              scopes: [],
              secretsEnc: msAccount.secretsEnc,
              expiresAt: msAccount.expiresAt,
              metadata: msAccount.metadata,
              createdAt: null,
              updatedAt: null,
              lastSyncedAt: msAccount.lastSyncedAt,
              nextSyncCursor: null,
            };

            const result = await microsoftEmailProvider.syncInbox({
              tenantId,
              userId,
              integration: msIntegration as any,
            });
            totalSynced += result.synced;
            totalSkipped += result.skipped;
            allErrors.push(...result.errors);
          }
        } catch (err) {
          allErrors.push(`Microsoft: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      return { synced: totalSynced, skipped: totalSkipped, errors: allErrors };

    } finally {
      this.inProgressByUser.delete(userId);
    }
  }
}

// Create singleton instance
export const emailAutoSyncService = new EmailAutoSyncService();