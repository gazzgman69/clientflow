import { db } from "../../db";
import { emailThreads, emails, emailAttachments, contacts, projects } from "@shared/schema";
import { eq, and, or, desc, isNotNull } from "drizzle-orm";
import type { gmail_v1 } from "googleapis";
import type { EmailThread, Email, InsertEmailThread, InsertEmail, InsertEmailAttachment } from "@shared/schema";

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
  /**
   * Sync Gmail threads to database for instant access
   */
  async syncGmailThreadsToDatabase(userId: string, specificProjectId?: string): Promise<{
    synced: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      const { gmailService } = await import('./gmail');
      console.log('🔄 Syncing Gmail threads to database...');
      
      // Get all projects and their contact emails for matching
      const projectsWithContacts = await db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          contactEmail: contacts.email,
        })
        .from(projects)
        .leftJoin(contacts, eq(contacts.id, projects.contactId))
        .where(isNotNull(contacts.email));

      const emailToProjectMap = new Map<string, string>();
      projectsWithContacts.forEach(p => {
        if (p.contactEmail) {
          emailToProjectMap.set(p.contactEmail.toLowerCase(), p.projectId);
        }
      });

      console.log(`📧 Found ${emailToProjectMap.size} project email mappings:`, 
        Array.from(emailToProjectMap.keys()));
      
      // Get contact email addresses to search for
      const contactEmails = Array.from(emailToProjectMap.keys());
      
      // Search for emails between business email AND contact emails (both directions)
      const allEmailsToSearch = ['skinnycheck@gmail.com', ...contactEmails];
      console.log('🔍 Searching for emails involving addresses:', allEmailsToSearch);
      
      const gmailThreads = await gmailService.listThreadsForAddresses(userId, { 
        limit: 100,
        addresses: allEmailsToSearch // Business email + contact emails
      });
      
      if (!gmailThreads.ok || !gmailThreads.threads) {
        console.error('❌ Failed to fetch Gmail threads:', gmailThreads.error);
        return { synced: 0, skipped: 0, errors: [gmailThreads.error || 'Unknown Gmail API error'] };
      }

      console.log(`📧 Found ${gmailThreads.threads.length} Gmail threads, syncing to database...`);
      
      // Log the first few threads for debugging
      if (gmailThreads.threads.length > 0) {
        console.log('📧 Sample threads found:');
        gmailThreads.threads.slice(0, 3).forEach((thread, i) => {
          console.log(`  ${i+1}. Subject: "${thread.latest.subject}" | From: ${thread.latest.from} | To: ${thread.latest.to}`);
        });
      };
      
      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const gmailThread of gmailThreads.threads) {
        try {
          // Use Gmail thread ID as our thread ID
          const threadId = gmailThread.threadId;
          
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

          // Check if thread already exists
          const existingThread = await db
            .select()
            .from(emailThreads)
            .where(eq(emailThreads.id, threadId))
            .limit(1);

          if (existingThread.length === 0) {
            // Create new thread
            await db
              .insert(emailThreads)
              .values({
                id: threadId,
                subject: gmailThread.latest.subject,
                projectId: matchedProjectId,
                lastMessageAt: new Date(gmailThread.latest.dateISO),
                createdAt: new Date(),
                updatedAt: new Date(),
              });
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
            
            await db
              .update(emailThreads)
              .set(updateData)
              .where(eq(emailThreads.id, threadId));
          }

          // Get ALL messages in the thread, not just the latest
          const threadMessages = await this.gmailService.getThreadMessages('test-user', threadId);
          
          for (const gmailMessage of threadMessages) {
            await this.syncThreadMessage(gmailMessage, threadId, matchedProjectId);
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

      console.log(`✅ Gmail sync complete: ${synced} synced, ${skipped} skipped${errors.length > 0 ? `, ${errors.length} errors` : ''}`);
      return { synced, skipped, errors };
    } catch (error: any) {
      console.error('❌ Gmail sync failed:', error);
      return { synced: 0, skipped: 0, errors: [error.message] };
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
   * Find or create contact for email address
   */
  private async findOrCreateContact(email: string, projectId?: string) {
    if (!email) return null;
    
    try {
      // Look for existing contact
      const [existingContact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, email))
        .limit(1);
      
      if (existingContact) return existingContact.id;
      
      // Create new contact if not found
      const [newContact] = await db
        .insert(contacts)
        .values({
          firstName: email.split('@')[0], // Use email prefix as name
          lastName: '',
          email: email,
        })
        .returning();
      
      return newContact.id;
    } catch (error) {
      console.error('Error finding/creating contact:', error);
      return null;
    }
  }

  /**
   * Find or create email thread
   */
  private async findOrCreateThread(providerThreadId: string, projectId?: string, subject?: string) {
    try {
      // Look for existing thread with this provider thread ID
      const [existingThread] = await db
        .select()
        .from(emailThreads)
        .where(eq(emailThreads.id, providerThreadId))
        .limit(1);
      
      if (existingThread) return existingThread.id;
      
      // Create new thread
      const [newThread] = await db
        .insert(emailThreads)
        .values({
          id: providerThreadId, // Use Gmail thread ID as our thread ID
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
  async syncGmailThread(gmailThread: GmailThread, projectId?: string): Promise<EmailThread | null> {
    try {
      if (!gmailThread.id || !gmailThread.messages?.length) {
        return null;
      }

      // Get the first message to extract subject
      const firstMessage = gmailThread.messages[0];
      const headers = this.parseHeaders(firstMessage.payload);
      const subject = headers.subject || 'No Subject';

      // Find or create thread
      const threadId = await this.findOrCreateThread(gmailThread.id, projectId, subject);

      // Sync all messages in the thread
      for (const message of gmailThread.messages) {
        await this.syncGmailMessage(message, threadId, projectId);
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
          .where(eq(emailThreads.id, threadId));
      }

      // Return the updated thread
      const [thread] = await db
        .select()
        .from(emailThreads)
        .where(eq(emailThreads.id, threadId))
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
  private async syncThreadMessage(message: any, threadId: string, projectId?: string): Promise<any> {
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

      // Find contact for sender
      const contactId = fromEmails.length > 0 
        ? await this.findOrCreateContact(fromEmails[0], projectId)
        : null;

      // Determine direction (inbound/outbound) based on user's email
      const userEmail = await this.gmailService.getUserEmail('test-user');
      const direction = fromEmails.some(email => email.toLowerCase().includes(userEmail.toLowerCase())) 
        ? 'outbound' 
        : 'inbound';

      // Convert date
      const sentAt = message.date ? new Date(message.date) : (
        message.internalDate ? new Date(parseInt(message.internalDate)) : new Date()
      );

      // Insert message
      const [newMessage] = await db
        .insert(emails)
        .values({
          threadId,
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
   * Sync a Gmail message to our database
   */
  async syncGmailMessage(gmailMessage: GmailMessage, threadId: string, projectId?: string): Promise<Email | null> {
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

      // Extract email addresses
      const fromEmails = this.extractEmails(headers.from || '');
      const toEmails = this.extractEmails(headers.to || '');
      const ccEmails = this.extractEmails(headers.cc || '');
      const bccEmails = this.extractEmails(headers.bcc || '');

      // Find contact for sender
      const contactId = fromEmails.length > 0 
        ? await this.findOrCreateContact(fromEmails[0], projectId)
        : null;

      // Determine direction (inbound/outbound) based on user's email
      const userEmail = await this.gmailService.getUserEmail('test-user');
      const direction = fromEmails.some(email => email.toLowerCase().includes(userEmail.toLowerCase())) 
        ? 'outbound' 
        : 'inbound';

      // Check for attachments
      const hasAttachments = this.hasAttachments(gmailMessage.payload);

      // Insert message
      const [newMessage] = await db
        .insert(emails)
        .values({
          threadId,
          provider: 'gmail',
          providerMessageId: gmailMessage.id,
          providerThreadId: gmailMessage.threadId || '',
          messageId: headers['message-id'] || '',
          inReplyTo: headers['in-reply-to'] || null,
          references: headers.references || null,
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

      // TODO: Extract and save attachments if any
      if (hasAttachments) {
        await this.extractAttachments(gmailMessage.payload, newMessage.id);
      }

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
  async getProjectThreads(projectId: string): Promise<EmailThread[]> {
    try {
      const threads = await db
        .select()
        .from(emailThreads)
        .where(eq(emailThreads.projectId, projectId))
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
  async getThreadMessages(threadId: string): Promise<Email[]> {
    try {
      const messages = await db
        .select()
        .from(emails)
        .where(eq(emails.threadId, threadId))
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
  async createOutboundEmail(data: {
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
  }): Promise<Email | null> {
    try {
      let threadId = data.threadId;
      
      // Create new thread if not provided
      if (!threadId) {
        const newThreadId = await this.findOrCreateThread(
          `thread-${Date.now()}`, // Generate temporary ID
          data.projectId,
          data.subject
        );
        threadId = newThreadId;
      }

      // Find contact for primary recipient
      const contactId = data.to.length > 0 
        ? await this.findOrCreateContact(data.to[0], data.projectId)
        : null;

      const [newEmail] = await db
        .insert(emails)
        .values({
          threadId,
          provider: 'gmail',
          direction: 'outbound',
          fromEmail: data.fromEmail, // Use the provided email address
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
        .where(eq(emailThreads.id, threadId));

      return newEmail;
    } catch (error) {
      console.error('Error creating outbound email:', error);
      return null;
    }
  }

  /**
   * Background sync Gmail threads - can be called periodically
   */
  async backgroundSync(userId: string): Promise<void> {
    try {
      console.log('🔄 Running background Gmail sync...');
      const result = await this.syncGmailThreadsToDatabase(userId);
      console.log(`📧 Background sync complete: ${result.synced} synced, ${result.skipped} skipped`);
    } catch (error) {
      console.error('❌ Background Gmail sync failed:', error);
    }
  }
}

// Export singleton instance
export const emailSyncService = new EmailSyncService();