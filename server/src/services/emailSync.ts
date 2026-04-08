import { db } from "../../db";
import { emailThreads, emails, emailAttachments, contacts, projects, leads, emailAccounts } from "@shared/schema";
import { eq, and, or, desc, isNotNull, sql, not } from "drizzle-orm";
import type { gmail_v1 } from "googleapis";
import type { EmailThread, Email, InsertEmailThread, InsertEmail, InsertEmailAttachment } from "@shared/schema";
import { storage } from "../../storage";

// Database retry wrapper to handle connection issues
async function withDbRetry<T>(operation: () => Promise<T>, maxRetries = 3, delayMs = 1000): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // Check if this is a database connection error
      if (error instanceof Error && (
        error.message.includes('terminating connection') ||
        error.message.includes('connection') ||
        error.message.includes('FATAL') ||
        error.message.includes('administrator command')
      )) {
        if (attempt < maxRetries) {
          console.log(`Retrying database operation in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 1.5; // Exponential backoff
          continue;
        }
      }
      
      // If it's not a connection error or we've exhausted retries, throw
      throw error;
    }
  }
  
  throw lastError;
}

interface GmailMessage {
  id?: string;
  threadId?: string;
  payload?: gmail_v1.Schema$MessagePart;
  snippet?: string;
  internalDate?: string;
}

interface GmailThread {
  id?: string;
  snippet?: string;
  messages?: GmailMessage[];
}

export class EmailSyncService {
  private gmailService: any;
  private tenantId?: string;

  constructor(tenantId?: string) {
    this.tenantId = tenantId;
    // Gmail service will be initialized on first use
  }

  private async initializeGmailService() {
    if (!this.gmailService) {
      const { gmailService } = await import('./gmail');
      this.gmailService = gmailService;
    }
    return this.gmailService;
  }

  /**
   * Verify if a project exists for the given tenant (defensive check for FK violations)
   */
  private async projectExists(projectId: string | null | undefined, tenantId: string): Promise<boolean> {
    if (!projectId) return false;
    
    try {
      const result = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(
          eq(projects.id, projectId),
          eq(projects.tenantId, tenantId)
        ))
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      console.error('Error checking project existence:', error);
      return false;
    }
  }

  /**
   * Sync Gmail threads to database for instant access
   */
  async syncGmailThreadsToDatabase(userId: string, specificProjectId?: string, sessionTenantId?: string): Promise<{
    synced: number;
    skipped: number;
    errors: string[];
  }> {
    // SECURITY FIX: Use session-provided tenantId for authenticated sync
    const originalTenantId = this.tenantId;
    // Sync debug info (quiet in production)
    if (sessionTenantId) {
      this.tenantId = sessionTenantId;
      console.log(`🔐 SYNC DEBUG: Set this.tenantId to ${this.tenantId}`);
    }
    
    try {
      this.gmailService = await this.initializeGmailService();

      // Get all projects and their contact emails for this tenant only
      const tenantId = this.tenantId;
      const projectsWithContacts = await withDbRetry(() =>
        db
          .select({
            projectId: projects.id,
            projectName: projects.name,
            contactEmail: contacts.email,
            contactId: contacts.id,
          })
          .from(projects)
          .leftJoin(contacts, and(eq(contacts.id, projects.contactId), eq(contacts.tenantId, tenantId!)))
          .where(and(eq(projects.tenantId, tenantId!), isNotNull(contacts.email)))
      );

      const emailToProjectMap = new Map<string, string>();
      const emailToContactMap = new Map<string, string>(); // email -> contactId
      projectsWithContacts.forEach(p => {
        if (p.contactEmail) {
          emailToProjectMap.set(p.contactEmail.toLowerCase(), p.projectId);
          if (p.contactId) emailToContactMap.set(p.contactEmail.toLowerCase(), p.contactId);
        }
      });

      // Get contact email addresses to search for
      const contactEmails = Array.from(emailToProjectMap.keys());

      // PRIVACY FIX: Only sync if there are known CRM contact emails
      // Don't sync if no contacts - prevents syncing ALL personal emails
      const userBusinessEmail = await this.getUserBusinessEmail(userId);

      if (contactEmails.length === 0) {
        return { synced: 0, skipped: 0, errors: [] };
      }
      
      const gmailThreads = await this.gmailService.listThreadsForAddresses(userId, {
        limit: 100,
        addresses: contactEmails // Only contact emails, NOT business email
      });

      if (!gmailThreads.ok || !gmailThreads.threads) {
        console.error('❌ Failed to fetch Gmail threads:', gmailThreads.error);
        return { synced: 0, skipped: 0, errors: [gmailThreads.error || 'Unknown Gmail API error'] };
      }
      
      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const gmailThread of gmailThreads.threads) {
        try {
          // Extract emails from the from and to fields to match with projects
          const fromEmail = this.extractEmails(gmailThread.latest.from)[0]?.toLowerCase();
          const toEmails = this.extractEmails(gmailThread.latest.to);
          
          // Find which project this email belongs to
          let matchedProjectId: string | null = specificProjectId || null;
          
          // Check if sender or recipient matches any project contact
          if (!matchedProjectId) {
            if (fromEmail && emailToProjectMap.has(fromEmail)) {
              matchedProjectId = emailToProjectMap.get(fromEmail)!;
            }
            
            if (!matchedProjectId) {
              for (const email of toEmails) {
                const lowerEmail = email.toLowerCase();
                if (emailToProjectMap.has(lowerEmail)) {
                  matchedProjectId = emailToProjectMap.get(lowerEmail)!;
                  break;
                }
              }
            }
          }

          // INGESTION GUARD: Get tenant ID from authenticated session context
          // This is passed from the email sync service call which has session context
          if (!this.tenantId) {
            // SECURITY: Require authenticated tenant context - never fallback to default
            throw new Error(`Email sync requires authenticated tenant context for user ${userId}. Session-based tenant ID must be provided.`);
          }
          const tenantId = this.tenantId;

          // RFC-compliant threading: Use Message-ID, In-Reply-To, References for proper threading
          // Note: We need to get the full message details to access RFC headers
          // For quick sync, we'll use Gmail thread ID as fallback, but mark for RFC processing
          let threadId = gmailThread.threadId; // Temporary - will be updated during full message sync

          // Check if thread already exists
          const existingThread = await withDbRetry(() =>
            db
              .select()
              .from(emailThreads)
              .where(eq(emailThreads.id, threadId))
              .limit(1)
          );

          if (existingThread.length === 0) {
            // Create new thread with userId for multi-tenant isolation
            await withDbRetry(() =>
              db
                .insert(emailThreads)
                .values({
                  id: threadId,
                  userId, // CRITICAL: Add userId for multi-tenant isolation
                  tenantId, // CRITICAL: Add tenantId for proper isolation
                  subject: gmailThread.latest.subject,
                  projectId: matchedProjectId,
                  lastMessageAt: new Date(gmailThread.latest.dateISO),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
            );
          } else {
            // Update existing thread, ensuring project association is preserved
            const updateData: any = {
              subject: gmailThread.latest.subject,
              lastMessageAt: new Date(gmailThread.latest.dateISO),
              updatedAt: new Date(),
            };
            
            // Only update project ID if we found a better match
            if (matchedProjectId && !existingThread[0].projectId) {
              updateData.projectId = matchedProjectId;
            }
            
            await withDbRetry(() =>
              db
                .update(emailThreads)
                .set(updateData)
                .where(eq(emailThreads.id, threadId))
            );
          }

          // Store the latest message details (quick sync) - CONTACTS-ONLY INGESTION GUARD
          const emailId = `email_${gmailThread.latest.id}`;
          
          // Determine direction based on user's email
          const userEmail = await this.gmailService.getUserEmail(userId);
          const fromEmailParsed = this.extractEmails(gmailThread.latest.from)[0] || '';
          const direction = fromEmailParsed.toLowerCase().includes(userEmail.toLowerCase()) ? 'outbound' : 'inbound';
          
          let contactId: string | null = null;
          
          if (direction === 'inbound') {
            // For inbound emails, sender must be a known contact — check map first, then DB
            contactId = emailToContactMap.get(fromEmailParsed.toLowerCase()) ||
                        await this.findExistingContact(fromEmailParsed, tenantId);
            if (!contactId) {
              const senderDomain = fromEmailParsed ? fromEmailParsed.split('@')[1] || 'unknown' : 'unknown';
              console.log(`🚫 INGESTION GUARD: Rejecting inbound email from unknown contact from domain: ${senderDomain} (tenant: ${tenantId})`);
              skipped++;
              continue;
            }
          } else {
            // For outbound emails, recipient must be a known contact
            const toEmailParsed = this.extractEmails(gmailThread.latest.to)[0] || '';
            contactId = emailToContactMap.get(toEmailParsed.toLowerCase()) ||
                        await this.findOrCreateContact(toEmailParsed, tenantId, matchedProjectId);
          }
          
          // AUTO-LINK PROJECTS: When contact has active projects, link to most recent
          // Active statuses = anything that isn't terminal (lost/cancelled/archived/completed)
          if (contactId && !matchedProjectId) {
            const { db } = await import('../../db');
            const { projects } = await import('../../../shared/schema');
            const { eq, and, desc, notInArray } = await import('drizzle-orm');

            const terminalStatuses = ['lost', 'cancelled', 'archived', 'completed'];
            const activeProjects = await db
              .select({ id: projects.id, createdAt: projects.createdAt })
              .from(projects)
              .where(and(
                eq(projects.contactId, contactId),
                eq(projects.tenantId, tenantId),
                notInArray(projects.status, terminalStatuses)
              ))
              .orderBy(desc(projects.createdAt))
              .limit(1);

            if (activeProjects.length > 0) {
              matchedProjectId = activeProjects[0].id;
            }
          }
          
          // DEFENSIVE: Verify project exists before linking (prevents FK violations on deleted projects)
          if (matchedProjectId && !(await this.projectExists(matchedProjectId, tenantId))) {
            console.info('📧 EMAIL SYNC: Project deleted, detaching from thread', {
              tenantId,
              threadId,
              intendedProjectId: matchedProjectId
            });
            matchedProjectId = null; // Detach instead of failing
          }
          
          // Only persist if we have a valid contact
          if (contactId) {
            // RUNTIME ASSERT: Ensure tenantId is present for email persistence
            if (!tenantId) {
              console.error('🚨 CRITICAL: Missing tenantId in email persistence', {
                action: 'email_insert',
                provider: 'gmail',
                direction,
                emailId,
                userId,
                timestamp: new Date().toISOString()
              });
              throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required for email persistence');
            }
            
            await withDbRetry(() =>
              db
                .insert(emails)
                .values({
                  id: emailId,
                  threadId,
                  userId, // Add userId for multi-tenant support
                  tenantId, // Add tenantId for proper isolation
                  provider: 'gmail',
                  providerMessageId: gmailThread.latest.id,
                  direction,
                  fromEmail: gmailThread.latest.from,
                  toEmails: [gmailThread.latest.to],
                  ccEmails: [],
                  bccEmails: [],
                  subject: gmailThread.latest.subject,
                  bodyText: gmailThread.latest.snippet,
                  bodyHtml: null,
                  sentAt: new Date(gmailThread.latest.dateISO),
                  hasAttachments: false,
                  contactId, // CONTACTS-ONLY GUARD: Always populated by this point
                  projectId: matchedProjectId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: emails.providerMessageId,
                  set: {
                    updatedAt: new Date(),
                    bodyText: gmailThread.latest.snippet,
                    subject: gmailThread.latest.subject,
                    projectId: matchedProjectId,
                    contactId, // Update contact ID too
                    // Don't overwrite direction to preserve manual fixes
                  },
                })
            );
          } else {
            console.log(`🚫 INGESTION GUARD: No valid contact found, skipping email: ${fromEmailParsed}`);
            skipped++;
            continue;
          }

          if (matchedProjectId) {
            console.log(`📧 Associated thread "${gmailThread.latest.subject}" with project ${matchedProjectId}`);
          }

          synced++;
        } catch (error: any) {
          console.error(`❌ Error syncing thread ${gmailThread.threadId}:`, error);
          errors.push(`Thread ${gmailThread.threadId}: ${error.message}`);
          skipped++;
        }
      }

      if (synced > 0) {
        console.log(`📧 Email sync: ${synced} new threads found`);
      }

      // Update last_synced_at timestamp in email_accounts table
      try {
        await db
          .update(emailAccounts)
          .set({ lastSyncedAt: new Date() })
          .where(
            and(
              eq(emailAccounts.userId, userId),
              eq(emailAccounts.providerKey, 'google'),
              eq(emailAccounts.tenantId, this.tenantId || 'default-tenant')
            )
          );
      } catch (updateError) {
        console.error('⚠️ Failed to update last_synced_at timestamp:', updateError);
        // Don't fail the sync if timestamp update fails
      }

      return { synced, skipped, errors };
    } catch (error: any) {
      console.error('❌ Gmail sync failed:', error);
      return { synced: 0, skipped: 0, errors: [error.message] };
    } finally {
      // SECURITY: Restore original tenantId to prevent leakage across calls
      this.tenantId = originalTenantId;
    }
  }

  /**
   * Find or create thread based on RFC email headers (Message-ID, In-Reply-To, References)
   * This replaces subject-based threading with proper RFC compliance
   */
  private async findRFCThread(messageId: string, inReplyTo?: string | null, references?: string | null, projectId?: string | null, tenantId?: string): Promise<string> {
    try {
      // If this message has In-Reply-To header, find the thread containing that Message-ID
      if (inReplyTo) {
        const parentMessage = await db
          .select({ threadId: emails.threadId })
          .from(emails)
          .where(eq(emails.messageId, inReplyTo))
          .limit(1);

        if (parentMessage.length > 0) {
          console.log(`🔗 RFC Threading: Found parent message with Message-ID ${inReplyTo}, joining thread ${parentMessage[0].threadId}`);
          return parentMessage[0].threadId;
        }
      }

      // If In-Reply-To didn't work, try References header
      if (references) {
        // References contain chain of Message-IDs, try each one
        const referenceIds = references.split(/\s+/).filter(id => id.includes('@'));
        
        for (const refId of referenceIds.reverse()) { // Start with most recent reference
          const refMessage = await db
            .select({ threadId: emails.threadId })
            .from(emails)
            .where(eq(emails.messageId, refId.trim()))
            .limit(1);

          if (refMessage.length > 0) {
            console.log(`🔗 RFC Threading: Found reference message with Message-ID ${refId}, joining thread ${refMessage[0].threadId}`);
            return refMessage[0].threadId;
          }
        }
      }

      // DEFENSIVE: Verify project exists before linking (prevents FK violations)
      let safeProjectId = projectId || null;
      if (safeProjectId && tenantId && !(await this.projectExists(safeProjectId, tenantId))) {
        console.info('📧 RFC THREADING: Project deleted, creating thread without project link', {
          tenantId,
          messageId,
          intendedProjectId: safeProjectId
        });
        safeProjectId = null;
      }

      // No RFC headers match existing threads - create new thread
      const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await db.insert(emailThreads).values({
        id: newThreadId,
        projectId: safeProjectId,
        subject: null, // Subject is display-only, not used for threading
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`🆕 RFC Threading: Created new thread ${newThreadId} for Message-ID ${messageId}`);
      return newThreadId;
      
    } catch (error) {
      console.error('❌ Error in RFC thread finding:', error);
      // Fallback: create unique thread (no project link on error to prevent FK violations)
      const fallbackThreadId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await db.insert(emailThreads).values({
        id: fallbackThreadId,
        projectId: null, // Never link project on error fallback
        subject: null,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return fallbackThreadId;
    }
  }

  /**
   * Extract email addresses from Gmail API format
   */
  private extractEmails(headerValue: string): string[] {
    if (!headerValue) return [];
    
    // Handle multiple emails separated by commas
    const emails = headerValue.split(',').map(email => {
      // Extract email from "Name <email>" format
      const match = email.match(/<([^>]+)>/);
      return match ? match[1].trim() : email.trim();
    }).filter(email => email.includes('@'));
    
    return emails;
  }

  /**
   * Parse Gmail message headers
   */
  private parseHeaders(payload: gmail_v1.Schema$MessagePart | undefined) {
    if (!payload?.headers) return {};
    
    const headers: Record<string, string> = {};
    payload.headers.forEach(header => {
      if (header.name && header.value) {
        headers[header.name.toLowerCase()] = header.value;
      }
    });
    
    return headers;
  }

  /**
   * Extract text content from Gmail message payload
   */
  private extractContent(payload: gmail_v1.Schema$MessagePart | undefined): { html?: string, text?: string } {
    if (!payload) return {};
    
    let html = '';
    let text = '';
    
    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
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
   * Normalize email address for consistent lookup
   */
  private normalizeEmail(email: string): string {
    if (!email) return '';
    
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = email.match(/<([^>]+)>/);
    const cleanEmail = emailMatch ? emailMatch[1] : email;
    
    // Lowercase and trim
    return cleanEmail.toLowerCase().trim();
  }

  /**
   * Find existing contact for email address (tenant-aware, no creation)
   * Used for ingestion guard - only returns existing contacts
   */
  private async findExistingContact(email: string, tenantId: string): Promise<string | null> {
    if (!email || !tenantId) return null;
    
    try {
      const normalizedEmail = this.normalizeEmail(email);
      
      // Look for existing contact in this tenant only
      const { withTenantAnd } = await import('../../utils/tenantQueries');
      const [existingContact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(withTenantAnd(contacts.tenantId, tenantId, eq(contacts.email, normalizedEmail)))
        .limit(1);
      
      return existingContact?.id || null;
    } catch (error) {
      console.error('Error finding existing contact:', error);
      return null;
    }
  }

  /**
   * Find existing contact for email address (tenant-aware)
   * DISABLED: No longer auto-creates contacts from emails
   */
  private async findOrCreateContact(email: string, tenantId: string, projectId?: string): Promise<string | null> {
    if (!email || !tenantId) return null;
    
    try {
      const normalizedEmail = this.normalizeEmail(email);
      
      // Look for existing contact in this tenant only
      const { withTenantAnd } = await import('../../utils/tenantQueries');
      const [existingContact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(withTenantAnd(contacts.tenantId, tenantId, eq(contacts.email, normalizedEmail)))
        .limit(1);
      
      if (existingContact) return existingContact.id;
      
      // DISABLED: Do NOT auto-create contacts from email sync
      // Return null if contact doesn't exist
      return null;
    } catch (error) {
      console.error('Error finding existing contact:', error);
      return null;
    }
  }

  /**
   * Find or create email thread
   */
  private async findOrCreateThread(providerThreadId: string, userId: string, projectId?: string, subject?: string) {
    try {
      // Look for existing thread with this provider thread ID scoped to user
      const [existingThread] = await db
        .select()
        .from(emailThreads)
        .where(and(eq(emailThreads.id, providerThreadId), eq(emailThreads.userId, userId)))
        .limit(1);
      
      if (existingThread) return existingThread.id;
      
      // Create new thread with userId for multi-tenant isolation
      const [newThread] = await db
        .insert(emailThreads)
        .values({
          id: providerThreadId, // Use Gmail thread ID as our thread ID
          userId, // CRITICAL: Add userId for multi-tenant isolation
          projectId: projectId || null,
          subject: subject || null,
          lastMessageAt: new Date(),
        })
        .returning();
      
      return newThread.id;
    } catch (error) {
      console.error('Error finding/creating thread:', error);
      throw error;
    }
  }

  /**
   * Sync a Gmail thread to our database
   */
  async syncGmailThread(gmailThread: GmailThread, userId: string, projectId?: string): Promise<EmailThread | null> {
    try {
      if (!gmailThread.id || !gmailThread.messages?.length) {
        return null;
      }

      // Get the first message to extract subject
      const firstMessage = gmailThread.messages[0];
      const headers = this.parseHeaders(firstMessage.payload);
      const subject = headers.subject || 'No Subject';

      // Find or create thread
      const threadId = await this.findOrCreateThread(gmailThread.id, userId, projectId, subject);

      // Sync all messages in the thread
      for (const message of gmailThread.messages) {
        await this.syncGmailMessage(message, threadId, userId, projectId);
      }

      // Update thread's last message time
      const lastMessage = gmailThread.messages[gmailThread.messages.length - 1];
      if (lastMessage.internalDate) {
        await db
          .update(emailThreads)
          .set({ 
            lastMessageAt: new Date(parseInt(lastMessage.internalDate)),
            updatedAt: new Date()
          })
          .where(and(eq(emailThreads.id, threadId), eq(emailThreads.userId, userId)));
      }

      // Return the updated thread
      const [thread] = await db
        .select()
        .from(emailThreads)
        .where(and(eq(emailThreads.id, threadId), eq(emailThreads.userId, userId)))
        .limit(1);

      return thread || null;
    } catch (error) {
      console.error('Error syncing Gmail thread:', error);
      return null;
    }
  }

  /**
   * Sync a thread message from getThreadMessages format
   */
  private async syncThreadMessage(message: any, threadId: string, userId: string, projectId?: string): Promise<any> {
    try {
      // Check if message already exists
      const [existingMessage] = await db
        .select()
        .from(emails)
        .where(eq(emails.providerMessageId, message.id))
        .limit(1);

      if (existingMessage) {
        return existingMessage;
      }

      // Extract email addresses
      const fromEmails = this.extractEmails(message.from || '');
      const toEmails = this.extractEmails(message.to || '');
      const ccEmails = this.extractEmails(message.cc || '');
      const bccEmails = this.extractEmails(message.bcc || '');

      // Determine direction (inbound/outbound) based on user's email
      const userEmail = await this.gmailService.getUserEmail(userId);
      const direction = fromEmails.some(email => email.toLowerCase().includes(userEmail.toLowerCase())) 
        ? 'outbound' 
        : 'inbound';

      // INGESTION GUARD: Get tenant ID and check if sender is a known contact
      // SECURITY FIX: Use session-aware tenant resolution
      let tenantId: string;
      if (this.tenantId) {
        tenantId = this.tenantId;
      } else {
        // Fallback: Lookup user's tenant from database using authenticated userId
        const userTenant = await storage.getUserTenant(userId);
        // SECURITY: Require authenticated tenant context - never fallback to default
        throw new Error(`Email sync requires authenticated tenant context for user ${userId}. Session-based tenant ID must be provided.`);
      }
      let contactId: string | null = null;

      if (direction === 'inbound') {
        // For inbound emails, sender must be a known contact
        contactId = fromEmails.length > 0 
          ? await this.findExistingContact(fromEmails[0], tenantId)
          : null;
        
        if (!contactId) {
          // PII-SAFE LOGGING: Use domain-only information
          const senderDomain = fromEmails[0] ? fromEmails[0].split('@')[1] || 'unknown' : 'unknown';
          console.log(`🚫 INGESTION GUARD: Rejecting inbound email from unknown contact from domain: ${senderDomain} (tenant: ${tenantId})`);
          return null; // Skip this email - do not persist
        }
      } else {
        // For outbound emails, recipient should be a contact (create if needed)
        contactId = fromEmails.length > 0 
          ? await this.findOrCreateContact(fromEmails[0], tenantId, projectId)
          : null;
      }

      // Convert date
      const sentAt = message.date ? new Date(message.date) : (
        message.internalDate ? new Date(parseInt(message.internalDate)) : new Date()
      );

      // Insert message
      const [newMessage] = await db
        .insert(emails)
        .values({
          threadId,
          userId, // Add userId for multi-tenant support
          provider: 'gmail',
          providerMessageId: message.id,
          providerThreadId: message.threadId || '',
          messageId: message.messageId || '',
          inReplyTo: message.inReplyTo || null,
          references: message.references || null,
          direction,
          fromEmail: fromEmails[0] || '',
          toEmails,
          ccEmails,
          bccEmails,
          subject: message.subject || '',
          snippet: message.snippet || '',
          sentAt,
          bodyHtml: message.bodyHtml || null,
          bodyText: message.bodyText || null,
          hasAttachments: false,
          contactId,
          projectId: projectId || null,
        })
        .returning();

      console.log(`📧 Synced ${direction} email: "${message.subject}" from ${fromEmails[0] || 'unknown'}`);
      return newMessage;
    } catch (error) {
      console.error('Error syncing thread message:', error);
      return null;
    }
  }

  /**
   * Sync a Gmail message to our database using RFC-compliant threading
   */
  async syncGmailMessage(gmailMessage: GmailMessage, fallbackThreadId: string, userId: string, projectId?: string): Promise<Email | null> {
    try {
      if (!gmailMessage.id) return null;

      // Check if message already exists
      const [existingMessage] = await db
        .select()
        .from(emails)
        .where(eq(emails.providerMessageId, gmailMessage.id))
        .limit(1);

      if (existingMessage) {
        return existingMessage;
      }

      // Parse headers
      const headers = this.parseHeaders(gmailMessage.payload);
      const content = this.extractContent(gmailMessage.payload);

      // Extract RFC headers for proper threading
      const messageId = headers['message-id'] || '';
      const inReplyTo = headers['in-reply-to'] || null;
      const references = headers.references || null;

      // INGESTION GUARD: Get tenant ID from authenticated context and check if sender is a known contact  
      // SECURITY FIX: Use session-aware tenant resolution
      let tenantId: string;
      if (this.tenantId) {
        tenantId = this.tenantId;
      } else {
        // This should not happen in authenticated contexts - log for debugging
        // SECURITY: Require authenticated tenant context for outbound emails
        throw new Error(`Outbound email sync requires authenticated tenant context for user ${userId}. Session-based tenant ID must be provided.`);
      }

      // Use RFC headers to find/create the correct thread (with tenant verification)
      const correctThreadId = await this.findRFCThread(messageId, inReplyTo, references, projectId, tenantId);

      // Extract email addresses
      const fromEmails = this.extractEmails(headers.from || '');
      const toEmails = this.extractEmails(headers.to || '');
      const ccEmails = this.extractEmails(headers.cc || '');
      const bccEmails = this.extractEmails(headers.bcc || '');

      // Determine direction (inbound/outbound) based on user's email
      const userEmail = await this.gmailService.getUserEmail(userId);
      console.log(`🔍 DEBUG: userEmail="${userEmail}", fromEmails=[${fromEmails.join(', ')}], subject="${headers.subject || 'N/A'}"`);
      
      // Test each fromEmail individually for debugging
      const matches = fromEmails.map(email => {
        const match = email.toLowerCase().includes(userEmail.toLowerCase());
        console.log(`   - "${email}" includes "${userEmail}"? ${match}`);
        return match;
      });
      
      const direction = matches.some(match => match) ? 'outbound' : 'inbound';
      console.log(`📧 FINAL DIRECTION: ${direction} (${fromEmails[0]} → ${direction})`)
      let contactId: string | null = null;

      if (direction === 'inbound') {
        // For inbound emails, sender must be a known contact
        contactId = fromEmails.length > 0 
          ? await this.findExistingContact(fromEmails[0], tenantId)
          : null;
        
        if (!contactId) {
          // PII-safe logging: Use domain-only information
          const senderDomain = fromEmails[0] ? fromEmails[0].split('@')[1] || 'unknown' : 'unknown';
          console.log(`🚫 INGESTION GUARD: Rejecting inbound email from unknown contact from domain: ${senderDomain} (tenant: ${tenantId})`);
          return null; // Skip this email - do not persist
        }
      } else {
        // For outbound emails, sender should be a contact (for consistency)
        contactId = fromEmails.length > 0 
          ? await this.findOrCreateContact(fromEmails[0], tenantId, projectId)
          : null;
      }

      // Check for attachments
      const hasAttachments = this.hasAttachments(gmailMessage.payload);

      // Insert message with RFC-determined thread
      const [newMessage] = await db
        .insert(emails)
        .values({
          threadId: correctThreadId, // Use RFC-determined thread, not Gmail thread ID
          userId, // Add userId for multi-tenant support
          provider: 'gmail',
          providerMessageId: gmailMessage.id,
          providerThreadId: gmailMessage.threadId || '',
          messageId,
          inReplyTo,
          references,
          direction,
          fromEmail: fromEmails[0] || '',
          toEmails,
          ccEmails,
          bccEmails,
          subject: headers.subject || '',
          snippet: gmailMessage.snippet || '',
          sentAt: gmailMessage.internalDate 
            ? new Date(parseInt(gmailMessage.internalDate))
            : new Date(),
          bodyHtml: content.html || null,
          bodyText: content.text || null,
          hasAttachments,
          contactId,
          projectId: projectId || null,
        })
        .returning();

      // Update thread's last message timestamp and subject
      await db
        .update(emailThreads)
        .set({
          lastMessageAt: newMessage.sentAt,
          subject: headers.subject || null, // Subject for display only
          projectId: projectId || null,
          updatedAt: new Date(),
        })
        .where(and(eq(emailThreads.id, correctThreadId), eq(emailThreads.userId, userId)));

      // Extract and save attachments if any
      if (hasAttachments) {
        await this.extractAttachments(gmailMessage.payload, newMessage.id);
      }

      console.log(`📧 RFC Threading: Synced message "${headers.subject}" with Message-ID: ${messageId} to thread: ${correctThreadId}`);
      return newMessage;
    } catch (error) {
      console.error('Error syncing Gmail message:', error);
      return null;
    }
  }

  /**
   * Check if message has attachments
   */
  private hasAttachments(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
    if (!payload) return false;
    
    if (payload.filename && payload.filename.length > 0) {
      return true;
    }
    
    if (payload.parts) {
      return payload.parts.some(part => this.hasAttachments(part));
    }
    
    return false;
  }

  /**
   * Extract attachment metadata (not download actual files)
   */
  private async extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined, emailId: string): Promise<void> {
    if (!payload) return;
    
    const extractFromPart = async (part: gmail_v1.Schema$MessagePart) => {
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        try {
          await db.insert(emailAttachments).values({
            emailId,
            filename: part.filename,
            mimeType: part.mimeType || null,
            size: part.body.size || null,
            storageKey: part.body.attachmentId, // Store Gmail attachment ID for now
          });
        } catch (error) {
          console.error('Error saving attachment metadata:', error);
        }
      }
      
      if (part.parts) {
        for (const subPart of part.parts) {
          await extractFromPart(subPart);
        }
      }
    };
    
    await extractFromPart(payload);
  }

  /**
   * Get email threads for a project
   */
  async getProjectThreads(projectId: string, userId: string): Promise<EmailThread[]> {
    try {
      const threads = await db
        .select()
        .from(emailThreads)
        .where(and(eq(emailThreads.projectId, projectId), eq(emailThreads.userId, userId)))
        .orderBy(desc(emailThreads.lastMessageAt));
      
      return threads;
    } catch (error) {
      console.error('Error fetching project threads:', error);
      return [];
    }
  }

  /**
   * Get messages for a thread
   */
  async getThreadMessages(threadId: string, userId: string): Promise<Email[]> {
    try {
      const messages = await db
        .select()
        .from(emails)
        .where(and(eq(emails.threadId, threadId), eq(emails.userId, userId)))
        .orderBy(emails.sentAt);
      
      return messages;
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      return [];
    }
  }

  /**
   * Create a new outbound email
   */
  async createOutboundEmail(userId: string, data: {
    threadId?: string;
    projectId?: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    bodyHtml?: string;
    bodyText?: string;
    inReplyTo?: string;
    references?: string;
    fromEmail: string; // Add required fromEmail parameter
  }, sessionTenantId?: string): Promise<Email | null> {
    try {
      // Generate a Message-ID for this outbound email (RFC 2822 compliant)
      const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@crm.system>`;
      
      // Find contact for primary recipient
      // SECURITY FIX: Use session-aware tenant resolution
      let tenantId: string;
      if (sessionTenantId) {
        tenantId = sessionTenantId;
      } else if (this.tenantId) {
        tenantId = this.tenantId;
      } else {
        // This method needs tenant context - should be passed from authenticated context
        const { storage } = await import('../../storage');
        // SECURITY: Require authenticated tenant context for email creation
        throw new Error(`Email creation requires authenticated tenant context for user ${userId}. Session-based tenant ID must be provided.`);
      }
      
      // Use RFC threading to find/create the correct thread (with tenant verification)
      const correctThreadId = await this.findRFCThread(
        messageId, 
        data.inReplyTo, 
        data.references, 
        data.projectId,
        tenantId
      );
      const contactId = data.to.length > 0 
        ? await this.findOrCreateContact(data.to[0], tenantId, data.projectId)
        : null;

      const [newEmail] = await db
        .insert(emails)
        .values({
          threadId: correctThreadId, // Use RFC-determined thread
          userId, // Add userId for multi-tenant support
          provider: 'gmail',
          direction: 'outbound',
          messageId, // Store the generated Message-ID
          fromEmail: data.fromEmail,
          toEmails: data.to,
          ccEmails: data.cc || [],
          bccEmails: data.bcc || [],
          subject: data.subject,
          bodyHtml: data.bodyHtml || null,
          bodyText: data.bodyText || null,
          inReplyTo: data.inReplyTo || null,
          references: data.references || null,
          sentAt: new Date(),
          hasAttachments: false,
          contactId,
          projectId: data.projectId || null,
        })
        .returning();

      // Update thread's last message time
      await db
        .update(emailThreads)
        .set({ 
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(emailThreads.id, newEmail.threadId));

      // Update lead lastContactAt if this email is to a lead contact
      if (data.to.length > 0) {
        const recipientEmail = data.to[0].toLowerCase();
        
        // Find leads that match this email address
        const matchingLeads = await db
          .select()
          .from(leads)
          .where(eq(leads.email, recipientEmail));
        
        if (matchingLeads.length > 0) {
          console.log(`📧 Updating lastContactAt for ${matchingLeads.length} lead(s) contacted via email: ${recipientEmail}`);
          
          // Update all matching leads
          for (const lead of matchingLeads) {
            await db
              .update(leads)
              .set({ 
                lastContactAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(leads.id, lead.id));
            
            console.log(`📧 Updated lead ${lead.id} (${lead.firstName} ${lead.lastName}) - lastContactAt set to now`);
          }

          // Trigger automation immediately for contacted leads
          try {
            console.log(`🤖 Triggering immediate automation for ${matchingLeads.length} contacted lead(s)`);
            const { leadAutomationService } = await import('./lead-automation');
            await leadAutomationService.runTick();
            console.log(`✅ Immediate automation completed`);
          } catch (error) {
            console.error('❌ Failed to trigger immediate automation:', error);
          }
        }
      }

      return newEmail;
    } catch (error) {
      console.error('Error creating outbound email:', error);
      return null;
    }
  }

  /**
   * Background sync Gmail threads and IMAP - can be called periodically
   */
  async backgroundSync(userId: string): Promise<void> {
    let gmailResult = { synced: 0, skipped: 0, errors: [] as any[] };
    let imapResult = { synced: 0, skipped: 0, errors: [] as any[] };

    // Sync Gmail
    try {
      gmailResult = await this.syncGmailThreadsToDatabase(userId);
    } catch (error) {
      console.error('❌ Background Gmail sync failed:', error);
      gmailResult.errors.push(error as any);
    }

    // Sync IMAP if configured
    try {
      const { imapService } = await import('./imap');
      if (imapService.isImapConfigured()) {
        imapResult = await imapService.fetchNewMessages(userId);
      }
    } catch (error) {
      console.error('❌ Background IMAP sync failed:', error);
      imapResult.errors.push(error as any);
    }

    // Combined summary
    const totalSynced = gmailResult.synced + imapResult.synced;
    const totalSkipped = gmailResult.skipped + imapResult.skipped;
    if (totalSynced > 0) {
      console.log(`📧 Email sync: ${totalSynced} new threads found`);
    }
  }

  /**
   * Get user's configured business email (security fix for hardcoded emails)
   */
  private async getUserBusinessEmail(userId: string): Promise<string> {
    // Prefer settings if present; fallback to Gmail profile
    try {
      const { mailSettingsService } = await import('./mailSettings');
      const settings = await mailSettingsService.getSettings(userId);
      const fromEmail = settings?.fromEmail || settings?.businessEmail;
      if (fromEmail && /.+@.+\..+/.test(fromEmail)) return fromEmail.trim().toLowerCase();
    } catch (_) {}
    this.gmailService = await this.initializeGmailService();
    const gmailEmail = await this.gmailService.getUserEmail(userId);
    if (gmailEmail && /.+@.+\..+/.test(gmailEmail)) return gmailEmail.trim().toLowerCase();
    throw new Error('No business email configured for user');
  }
}

// Export singleton instance
export const emailSyncService = new EmailSyncService();