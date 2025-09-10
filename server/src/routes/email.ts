import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { attachmentsService } from '../services/attachments';
import { emailSyncService } from '../services/emailSync';
import { templatesService } from '../services/templates';
import { z } from 'zod';
import { storage } from '../../storage';
import { db } from '../../db';
import { emailThreads, emails, emailAttachments, projects, contacts, emailThreadReads } from '@shared/schema';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import { google } from 'googleapis';

const router = Router();

// Configure multer for file uploads (temporary storage)
const upload = multer({ 
  dest: path.join(process.cwd(), 'temp-uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const sendEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().optional(),
  text: z.string().optional(),
  templateId: z.string().optional(),
  projectId: z.string().optional(),
  contactId: z.string().optional(),
  emails: z.array(z.string()).optional()
}).refine(data => {
  // Either use template OR provide subject+text directly
  return (data.templateId) || (data.subject && data.text);
}, {
  message: 'Either templateId or both subject and text are required'
});

// Middleware to check for authenticated user - use hardcoded test-user for now
const requireAuth = (req: any, res: any, next: any) => {
  const userIdHeader = req.headers['user-id'];
  const userId = typeof userIdHeader === 'string' ? userIdHeader : 'test-user'; // In production, get from session
  
  // Set user on request for compatibility
  req.user = { id: userId };
  
  next();
};

// Helper function to get user's email address
async function getUserEmail(userId: string): Promise<string> {
  try {
    // This is a simplified version - in production, you'd get this from user profile
    // For now, we'll use the known email addresses from the system
    if (userId === 'test-user') {
      return 'skinnycheck@gmail.com'; // Known user email for testing
    }
    return 'user@example.com'; // Fallback
  } catch (error) {
    console.error('Failed to get user email:', error);
    return 'user@example.com'; // Fallback
  }
}

/**
 * Send email via Gmail with template support
 */
router.post('/send', requireAuth, async (req: any, res) => {
  try {
    const emailData = sendEmailSchema.parse(req.body);
    const userId = req.user.id;
    
    let finalSubject = emailData.subject || '';
    let finalText = emailData.text || '';
    
    // Handle template-based email
    if (emailData.templateId) {
      const template = await templatesService.getTemplate(emailData.templateId);
      if (!template) {
        return res.status(404).json({ ok: false, error: 'Template not found' });
      }
      
      // Build context for token resolution - auto-enrich from email address
      const context: any = {};
      
      // Use provided IDs or try to derive from email address
      let contactId = emailData.contactId;
      let projectId = emailData.projectId;
      
      // If contactId not provided, try to find contact by email
      if (!contactId && emailData.to) {
        try {
          const [contact] = await db
            .select({ id: contacts.id })
            .from(contacts)
            .where(eq(contacts.email, emailData.to))
            .limit(1);
          if (contact) {
            contactId = contact.id;
          }
        } catch (error) {
          console.log('Could not auto-detect contact from email:', emailData.to);
        }
      }
      
      // If projectId not provided but we have contactId, try to find project
      if (!projectId && contactId) {
        try {
          const [project] = await db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.contactId, contactId))
            .limit(1);
          if (project) {
            projectId = project.id;
          }
        } catch (error) {
          console.log('Could not auto-detect project from contact:', contactId);
        }
      }
      
      if (contactId) context.contactId = contactId;
      if (projectId) context.projectId = projectId;
      
      // Render template with tokens
      const rendered = await templatesService.renderTemplate(template, context);
      finalSubject = rendered.subject || 'No Subject';
      finalText = rendered.body;
      
      console.log(`📧 Template rendered: ${rendered.unresolved.length} unresolved tokens`);
      if (rendered.unresolved.length > 0) {
        console.log('⚠️ Unresolved tokens:', rendered.unresolved);
      }
    }
    
    const result = await gmailService.sendEmail(userId, {
      to: emailData.to,
      subject: finalSubject,
      text: finalText
    });
    
    // If email was sent successfully, save to database immediately
    if (result.ok) {
      try {
        // Use existing service instance
        
        // Find project ID if provided, or determine from contact email
        let projectId = emailData.projectId || null;
        
        if (!projectId && emailData.to) {
          // Try to find project by contact email
          const [contact] = await db
            .select({ id: contacts.id })
            .from(contacts)
            .where(eq(contacts.email, emailData.to))
            .limit(1);
            
          if (contact) {
            const [project] = await db
              .select({ id: projects.id })
              .from(projects)
              .where(eq(projects.contactId, contact.id))
              .limit(1);
              
            if (project) {
              projectId = project.id;
            }
          }
        }
        
        // Create outbound email record in database
        // First, try to find existing thread with emails involving this contact
        // Extract email address from "Name <email@example.com>" format
        const cleanToEmail = emailData.to.toLowerCase().includes('<') 
          ? emailData.to.match(/<([^>]+)>/)?.[1] || emailData.to 
          : emailData.to;
        
        const existingThreads = await db
          .select({
            threadId: emails.threadId
          })
          .from(emails)
          .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
          .where(
            and(
              eq(emailThreads.projectId, projectId || ''),
              or(
                sql`LOWER(${emails.fromEmail}) LIKE LOWER(${'%' + cleanToEmail + '%'})`,
                sql`LOWER(${emails.toEmails}::text) LIKE LOWER(${'%' + cleanToEmail + '%'})`
              )
            )
          )
          .orderBy(desc(emails.sentAt))
          .limit(1);

        const existingThreadId = existingThreads.length > 0 ? existingThreads[0].threadId : undefined;
        console.log(`🔍 Looking for existing thread with contact: ${emailData.to}`);
        console.log(`✅ Found existing thread: ${existingThreadId || 'none'}`);
        
        if (existingThreadId) {
          console.log(`🔗 Adding email to existing thread: ${existingThreadId}`);
        } else {
          console.log(`🆕 Creating new thread for this email`);
        }
        
        const userEmail = await getUserEmail(userId);
        await emailSyncService.createOutboundEmail({
          threadId: existingThreadId, // Use existing thread if available
          projectId: projectId || undefined,
          to: [emailData.to],
          subject: finalSubject,
          bodyText: finalText,
          fromEmail: userEmail, // Pass the user's actual email
        });
        
        console.log(`💾 Saved outbound email to database (project: ${projectId})`);
      } catch (dbError) {
        console.error('Failed to save sent email to database:', dbError);
        // Don't fail the request if database save fails
      }
    }
    
    res.json(result);
  } catch (error: any) {
    if (error.issues) {
      res.status(400).json({ ok: false, error: error.issues[0].message });
    } else {
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
});

/**
 * Get email threads (all recent)
 */
router.get('/threads', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const q = req.query.q as string || '';
    const userId = req.user.id;
    
    const result = await gmailService.listThreads(userId, { limit, q });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Get email threads by project
 * Filters by project contact emails or fallback to query param emails
 */
router.get('/threads/by-project/:projectId', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.user.id;
    const projectId = req.params.projectId;
    
    let addresses: string[] = [];
    
    try {
      // Try to get project and client emails
      const project = await storage.getProject(projectId);
      if (project) {
        // For now, we'll use the fallback approach
        // In the future, we can add contactEmails field to project schema
      }
    } catch (error) {
      // If project doesn't exist or fails, continue with fallback
    }
    
    // Fallback: accept ?emails=a@x.com,b@y.com query parameter
    if (addresses.length === 0 && req.query.emails) {
      const emailsParam = req.query.emails as string;
      addresses = emailsParam.split(',').map(email => email.trim()).filter(email => email);
    }
    
    if (addresses.length === 0) {
      return res.json({ 
        ok: true, 
        threads: [],
        message: 'No contact emails found for project. Use ?emails=a@x.com,b@y.com to specify addresses.'
      });
    }
    
    // Load email threads from database for instant response
    try {
      // Get threads with proper counts
      const threadsData = await db
        .select({
          threadId: emailThreads.id,
          subject: emailThreads.subject,
          lastMessageAt: emailThreads.lastMessageAt,
          emailCount: sql<number>`cast(count(${emails.id}) as int)`.as('emailCount'),
        })
        .from(emailThreads)
        .leftJoin(emails, eq(emails.threadId, emailThreads.id))
        .where(eq(emailThreads.projectId, projectId))
        .groupBy(emailThreads.id, emailThreads.subject, emailThreads.lastMessageAt)
        .orderBy(desc(emailThreads.lastMessageAt))
        .limit(limit);

      // Get latest message for each thread
      const threads = await Promise.all(threadsData.map(async (thread) => {
        const [latestMessage] = await db
          .select({
            id: emails.providerMessageId,
            from: emails.fromEmail,
            to: emails.toEmails,
            subject: emails.subject,
            snippet: emails.bodyText,
            dateISO: emails.sentAt,
          })
          .from(emails)
          .where(eq(emails.threadId, thread.threadId))
          .orderBy(desc(emails.sentAt))
          .limit(1);

        return {
          threadId: thread.threadId,
          latest: latestMessage || {
            id: null,
            from: 'Unknown',
            to: [],
            subject: thread.subject || 'No subject',
            snippet: 'No preview',
            dateISO: thread.lastMessageAt || new Date().toISOString(),
          },
          count: thread.emailCount || 1,
        };
      }));

      res.json({ ok: true, threads, needsReconnect: false });
    } catch (dbError) {
      console.error('Database query failed, falling back to Gmail API:', dbError);
      // Fallback to Gmail API if database fails
      const result = await gmailService.listThreadsForAddresses(userId, { limit, addresses });
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Get detailed thread content by threadId
 */
router.get('/thread/:threadId', requireAuth, async (req: any, res) => {
  try {
    const threadId = req.params.threadId;
    const userId = req.user.id;
    
    const result = await gmailService.getThreadDetails(userId, threadId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * List emails (existing endpoint)
 */
router.get('/list', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.user.id;
    
    const result = await gmailService.listEmails(userId, limit);
    
    if (result.ok) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// === NEW DATABASE-BACKED EMAIL ROUTES ===

/**
 * GET /api/projects/:projectId/email-threads
 * Get email threads for a project from Gmail for project contacts
 */
router.get('/projects/:projectId/email-threads', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 20 } = req.query;
    const userId = req.user.id;

    // Get project with its contacts
    const project = await db
      .select({
        id: projects.id,
        name: projects.name,
        contactId: projects.contactId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project.length) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get contact emails for the project (primary contact + any related contacts)
    const contactEmails: string[] = [];
    
    if (project[0].contactId) {
      const contact = await db
        .select({ email: contacts.email })
        .from(contacts)
        .where(eq(contacts.id, project[0].contactId))
        .limit(1);
      
      if (contact.length && contact[0].email) {
        contactEmails.push(contact[0].email);
      }
    }

    // If no contact emails found, return empty result
    if (contactEmails.length === 0) {
      return res.json({
        threads: [],
        page: 1,
        limit: Number(limit),
        total: 0,
        needsReconnect: false
      });
    }

    try {
      // Get threads directly from emails table, grouped by thread ID
      const threadsQuery = await db
        .select({
          threadId: emails.threadId,
          count: sql<number>`count(*)`,
          latestSentAt: sql<Date>`max(${emails.sentAt})`,
        })
        .from(emails)
        .where(eq(emails.projectId, projectId))
        .groupBy(emails.threadId)
        .orderBy(desc(sql`max(${emails.sentAt})`))
        .limit(Number(limit));

      // Get latest message for each thread
      const threads = await Promise.all(
        threadsQuery.map(async (threadInfo) => {
          // Get the latest message for this thread
          const [latestMessage] = await db
            .select({
              id: emails.providerMessageId,
              from: emails.fromEmail,
              to: emails.toEmails,
              subject: emails.subject,
              snippet: emails.bodyText,
              dateISO: emails.sentAt,
            })
            .from(emails)
            .where(eq(emails.threadId, threadInfo.threadId))
            .orderBy(desc(emails.sentAt))
            .limit(1);

          if (!latestMessage) return null;

          return {
            threadId: threadInfo.threadId,
            latest: {
              ...latestMessage,
              dateISO: latestMessage.dateISO?.toISOString() || new Date().toISOString(),
            },
            count: Number(threadInfo.count) || 1,
          };
        })
      );

      // Filter out null entries  
      const validThreads = threads.filter(thread => thread !== null);

      console.log(`📧 Loaded ${validThreads.length} email threads from database for project ${projectId}`);

      res.json({
        threads: validThreads,
        page: 1,
        limit: Number(limit),
        total: validThreads.length,
        needsReconnect: false
      });

    } catch (dbError: any) {
      console.error('Database error, falling back to Gmail API:', dbError);
      
      // Fallback to Gmail API if database fails
      try {
        const result = await gmailService.listThreadsForAddresses(userId, {
          limit: Number(limit),
          addresses: contactEmails
        });

        if (result.ok && result.threads) {
          res.json({
            threads: result.threads,
            page: 1,
            limit: Number(limit),
            total: result.threads.length,
            needsReconnect: false
          });
        } else {
          res.json({
            threads: [],
            page: 1,
            limit: Number(limit),
            total: 0,
            needsReconnect: true,
            error: result.error
          });
        }
      } catch (gmailError: any) {
        console.error('Gmail service also failed:', gmailError);
        res.json({
          threads: [],
          page: 1,
          limit: Number(limit),
          total: 0,
          needsReconnect: true,
          error: 'Gmail access required'
        });
      }
    }
  } catch (error) {
    console.error('Error fetching project email threads:', error);
    res.status(500).json({ error: 'Failed to fetch email threads' });
  }
});

/**
 * GET /api/projects/:projectId/email-messages
 * Get individual email messages for a project (for unified and RFC threading views)
 */
router.get('/projects/:projectId/email-messages', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 100 } = req.query;

    // Get all individual email messages for the project
    const messages = await db
      .select({
        id: emails.id,
        subject: emails.subject,
        fromEmail: emails.fromEmail,
        direction: emails.direction,
        toEmails: emails.toEmails,
        ccEmails: emails.ccEmails,
        bccEmails: emails.bccEmails,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        sentAt: emails.sentAt,
        hasAttachments: emails.hasAttachments,
        providerMessageId: emails.providerMessageId,
        threadId: emails.threadId,
        // RFC headers for threading
        messageId: emails.messageId,
        inReplyTo: emails.inReplyTo,
        references: emails.references,
        snippet: emails.snippet
      })
      .from(emails)
      .where(eq(emails.projectId, projectId))
      .orderBy(desc(emails.sentAt))
      .limit(Number(limit));

    console.log(`📧 Found ${messages.length} individual messages for project ${projectId}`);

    res.json({
      messages,
      total: messages.length,
      needsReconnect: false
    });

  } catch (error) {
    console.error('Error fetching project email messages:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project email messages',
      needsReconnect: false 
    });
  }
});

/**
 * GET /api/email-threads/:threadId/messages
 * Get all messages in an email thread from database
 */
router.get('/email-threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;

    const messages = await db
      .select({
        id: emails.id,
        subject: emails.subject,
        fromEmail: emails.fromEmail,
        direction: emails.direction,
        toEmails: emails.toEmails,
        ccEmails: emails.ccEmails,
        bccEmails: emails.bccEmails,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        sentAt: emails.sentAt,
        hasAttachments: emails.hasAttachments,
        providerMessageId: emails.providerMessageId,
        attachments: emailAttachments
      })
      .from(emails)
      .leftJoin(emailAttachments, eq(emailAttachments.emailId, emails.id))
      .where(eq(emails.threadId, threadId))
      .orderBy(asc(emails.sentAt));

    // Group attachments by email ID
    const emailsMap = new Map();
    for (const row of messages) {
      const emailId = row.id;
      if (!emailsMap.has(emailId)) {
        emailsMap.set(emailId, {
          ...row,
          attachments: []
        });
      }
      if (row.attachments) {
        emailsMap.get(emailId).attachments.push(row.attachments);
      }
    }

    const emailsWithAttachments = Array.from(emailsMap.values());
    
    console.log(`📧 Thread ${threadId} returning ${emailsWithAttachments.length} messages`);
    if (emailsWithAttachments.length > 0) {
      console.log('📧 Sample message:', {
        id: emailsWithAttachments[0].id,
        subject: emailsWithAttachments[0].subject,
        from: emailsWithAttachments[0].fromEmail,
        bodyText: emailsWithAttachments[0].bodyText?.substring(0, 50) + '...'
      });
    }

    res.json({ messages: emailsWithAttachments });
  } catch (error) {
    console.error('Error fetching email messages:', error);
    res.status(500).json({ error: 'Failed to fetch email messages' });
  }
});

/**
 * POST /api/email-threads/:threadId/reply
 * Send a reply in an email thread with database sync
 */
router.post('/email-threads/:threadId/reply', upload.array('attachments'), async (req, res) => {
  try {
    const { threadId } = req.params;
    const { to, cc = [], bcc = [], subject, body } = req.body;
    const files = req.files as Express.Multer.File[];

    // Get thread info
    const [thread] = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.id, threadId))
      .limit(1);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Use test-user for now (should get from auth)
    const userId = 'test-user';

    // Send email via Gmail with sync
    const emailRequest = {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject || `Re: ${thread.subject}`,
      text: body,
      projectId: thread.projectId || undefined
    };

    const sendResult = await gmailService.sendEmail(userId, emailRequest);
    
    if (!sendResult.ok) {
      return res.status(500).json({ error: sendResult.error });
    }

    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

/**
 * POST /api/projects/:projectId/compose-email
 * Compose and send a new email for a project with database sync and template support
 */
router.post('/projects/:projectId/compose-email', upload.array('attachments'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { to, cc = [], bcc = [], subject, body, templateId } = req.body;
    const files = req.files as Express.Multer.File[];

    // Get project info for context
    const [project] = await db
      .select()
      .from(projects)
      .leftJoin(contacts, eq(contacts.id, projects.contactId))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let finalSubject = subject || '';
    let finalBody = body || '';
    
    // Handle template-based email  
    if (templateId) {
      const template = await templatesService.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Build context for token resolution
      const context: any = {
        projectId: projectId
      };
      if (project.projects?.contactId) {
        context.contactId = project.projects.contactId;
      }
      
      // Render template with tokens
      const rendered = await templatesService.renderTemplate(template, context);
      finalSubject = rendered.subject || 'No Subject';
      finalBody = rendered.body;
      
      console.log(`📧 Project email template rendered: ${rendered.unresolved.length} unresolved tokens`);
    }

    // Use test-user for now (should get from auth)
    const userId = 'test-user';

    // Send email via Gmail with sync
    const emailRequest = {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: finalSubject,
      text: finalBody,
      projectId: projectId
    };

    const sendResult = await gmailService.sendEmail(userId, emailRequest);
    
    if (!sendResult.ok) {
      return res.status(500).json({ error: sendResult.error });
    }

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * POST /api/projects/:projectId/sync-emails
 * Sync Gmail emails for project addresses
 */
router.post('/projects/:projectId/sync-emails', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'addresses array is required' });
    }

    // Use test-user for now (should get from auth)
    const userId = 'test-user';

    // Sync Gmail threads for project
    const syncResult = await gmailService.syncProjectThreads(userId, projectId, addresses);
    
    if (!syncResult.ok) {
      return res.status(500).json({ error: syncResult.error });
    }

    res.json({
      success: true,
      syncedCount: syncResult.syncedCount,
      totalThreads: syncResult.totalThreads,
      message: `Synced ${syncResult.syncedCount} of ${syncResult.totalThreads} threads`
    });
  } catch (error) {
    console.error('Error syncing emails:', error);
    res.status(500).json({ error: 'Failed to sync emails' });
  }
});

/**
 * GET /api/attachments/:attachmentId/download
 * Download email attachment
 */
router.get('/attachments/:attachmentId/download', async (req, res) => {
  try {
    const { attachmentId } = req.params;

    // Use test-user for now (should get from auth)
    const userId = 'test-user';

    // Get attachment stream
    const result = await attachmentsService.getAttachmentStream(attachmentId, userId);
    
    if (!result || !result.stream) {
      return res.status(404).json({ error: 'Attachment not found or failed to download' });
    }

    // Set headers from attachment metadata
    if (result.attachment) {
      res.setHeader('Content-Disposition', `attachment; filename="${result.attachment.filename}"`);
      res.setHeader('Content-Type', result.attachment.mimeType || 'application/octet-stream');
    }

    result.stream.pipe(res);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

/**
 * POST /api/email-threads/:threadId/mark-read
 * Mark thread as read for user
 */
router.post('/email-threads/:threadId/mark-read', async (req, res) => {
  try {
    const { threadId } = req.params;

    // Use test-user for now (should get from auth)
    const userId = 'test-user';

    // Mark thread as read - insert or update in emailThreadReads table
    await db
      .insert(emailThreadReads)
      .values({
        threadId,
        userId,
        lastReadAt: new Date()
      })
      .onConflictDoUpdate({
        target: [emailThreadReads.threadId, emailThreadReads.userId],
        set: { lastReadAt: new Date() }
      });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking thread as read:', error);
    res.status(500).json({ error: 'Failed to mark thread as read' });
  }
});

// Manual Gmail + IMAP sync endpoint
router.post('/sync', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { emailSyncService } = await import('../services/emailSync');
    const { imapService } = await import('../services/imap');
    
    console.log('🔄 Manual email sync requested (Gmail + IMAP)');
    
    // Sync Gmail
    let gmailResult = { synced: 0, skipped: 0, errors: [] };
    try {
      gmailResult = await emailSyncService.syncGmailThreadsToDatabase(userId);
    } catch (error) {
      console.error('❌ Manual Gmail sync failed:', error);
      gmailResult.errors.push(error);
    }

    // Sync IMAP if configured
    let imapResult = { synced: 0, skipped: 0, errors: [] };
    try {
      if (imapService.isImapConfigured()) {
        console.log('🔄 Manual IMAP sync starting...');
        imapResult = await imapService.fetchNewMessages(userId);
      }
    } catch (error) {
      console.error('❌ Manual IMAP sync failed:', error);
      imapResult.errors.push(error);
    }

    const totalSynced = gmailResult.synced + imapResult.synced;
    const totalSkipped = gmailResult.skipped + imapResult.skipped;
    const totalErrors = [...gmailResult.errors, ...imapResult.errors];
    
    res.json({
      success: totalErrors.length === 0,
      gmail: {
        synced: gmailResult.synced,
        skipped: gmailResult.skipped,
        errors: gmailResult.errors
      },
      imap: {
        synced: imapResult.synced,
        skipped: imapResult.skipped,
        errors: imapResult.errors,
        configured: imapService.isImapConfigured()
      },
      total: {
        synced: totalSynced,
        skipped: totalSkipped
      },
      message: `Synced ${totalSynced} emails successfully (Gmail: ${gmailResult.synced}, IMAP: ${imapResult.synced})`
    });
  } catch (error) {
    console.error('Manual email sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Email sync failed',
      message: 'Please check your email provider connections'
    });
  }
});

export default router;