import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { attachmentsService } from '../services/attachments';
import { emailSyncService } from '../services/emailSync';
import { z } from 'zod';
import { storage } from '../../storage';
import { db } from '../../db';
import { emailThreads, emails, emailAttachments, projects, contacts, emailThreadReads } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for file uploads (temporary storage)
const upload = multer({ 
  dest: path.join(process.cwd(), 'temp-uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const sendEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().min(1, 'Email body is required'),
  projectId: z.string().optional(),
  emails: z.array(z.string()).optional()
});

// Middleware to check for authenticated user - use hardcoded test-user for now
const requireAuth = (req: any, res: any, next: any) => {
  const userIdHeader = req.headers['user-id'];
  const userId = typeof userIdHeader === 'string' ? userIdHeader : 'test-user'; // In production, get from session
  
  // Set user on request for compatibility
  req.user = { id: userId };
  
  next();
};

/**
 * Send email via Gmail
 */
router.post('/send', requireAuth, async (req: any, res) => {
  try {
    const emailData = sendEmailSchema.parse(req.body);
    const userId = req.user.id;
    
    const result = await gmailService.sendEmail(userId, {
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text
    });
    
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
      const threadsFromDB = await db
        .select({
          threadId: emailThreads.id,
          subject: emailThreads.subject,
          lastMessageAt: emailThreads.lastMessageAt,
          latest: {
            id: emails.providerMessageId,
            from: emails.fromEmail,
            to: emails.toEmails,
            subject: emails.subject,
            snippet: emails.bodyText,
            dateISO: emails.sentAt,
          },
          count: 1, // For now, simplified count
        })
        .from(emailThreads)
        .leftJoin(emails, eq(emails.threadId, emailThreads.id))
        .where(eq(emailThreads.projectId, projectId))
        .orderBy(desc(emailThreads.lastMessageAt))
        .limit(limit);

      // Transform to match Gmail API response format
      const threads = threadsFromDB.map(thread => ({
        threadId: thread.threadId,
        latest: thread.latest,
        count: thread.count,
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
      // Load email threads from database for instant response
      const threadsFromDB = await db
        .select({
          threadId: emailThreads.id,
          subject: emailThreads.subject,
          lastMessageAt: emailThreads.lastMessageAt,
          latest: {
            id: emails.providerMessageId,
            from: emails.fromEmail,
            to: emails.toEmails,
            subject: emails.subject,
            snippet: emails.bodyText,
            dateISO: emails.sentAt,
          },
          count: 1, // Simplified count for now
        })
        .from(emailThreads)
        .leftJoin(emails, eq(emails.threadId, emailThreads.id))
        .where(eq(emailThreads.projectId, projectId))
        .orderBy(desc(emailThreads.lastMessageAt))
        .limit(Number(limit));

      // Transform to match expected format
      const threads = threadsFromDB
        .filter(thread => thread.latest && thread.latest.id) // Only include threads with messages
        .map(thread => ({
          threadId: thread.threadId,
          latest: {
            ...thread.latest,
            dateISO: thread.latest.dateISO?.toISOString() || new Date().toISOString(),
          },
          count: thread.count,
        }));

      console.log(`📧 Loaded ${threads.length} email threads from database for project ${projectId}`);

      res.json({
        threads,
        page: 1,
        limit: Number(limit),
        total: threads.length,
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
 * Compose and send a new email for a project with database sync
 */
router.post('/projects/:projectId/compose-email', upload.array('attachments'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { to, cc = [], bcc = [], subject, body } = req.body;
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

    // Use test-user for now (should get from auth)
    const userId = 'test-user';

    // Send email via Gmail with sync
    const emailRequest = {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      text: body,
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

// Manual Gmail sync endpoint
router.post('/sync', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { emailSyncService } = await import('../services/emailSync');
    
    console.log('🔄 Manual Gmail sync requested');
    const result = await emailSyncService.syncGmailThreadsToDatabase(userId);
    
    res.json({
      success: true,
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
      message: `Synced ${result.synced} emails successfully`
    });
  } catch (error) {
    console.error('Manual Gmail sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Gmail sync failed',
      message: 'Please make sure your Google account is connected'
    });
  }
});

export default router;