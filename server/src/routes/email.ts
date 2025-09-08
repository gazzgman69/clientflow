import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { attachmentsService } from '../services/attachments';
import { emailSyncService } from '../services/emailSync';
import { z } from 'zod';
import { storage } from '../../storage';
import { db } from '../../db';
import { emailThreads, emails, emailAttachments, projects, clients } from '@shared/schema';
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
    
    const result = await gmailService.listThreadsForAddresses(userId, { limit, addresses });
    
    res.json(result);
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
 * Get email threads for a project from database
 */
router.get('/projects/:projectId/email-threads', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);

    // Get threads with their latest email
    const threads = await db
      .select({
        id: emailThreads.id,
        subject: emailThreads.subject,
        gmailThreadId: emailThreads.gmailThreadId,
        participants: emailThreads.participants,
        createdAt: emailThreads.createdAt,
        updatedAt: emailThreads.updatedAt,
        latestEmail: {
          id: emails.id,
          subject: emails.subject,
          fromEmail: emails.fromEmail,
          fromName: emails.fromName,
          toEmails: emails.toEmails,
          bodyText: emails.bodyText,
          bodyHtml: emails.bodyHtml,
          sentAt: emails.sentAt,
          isOutbound: emails.isOutbound,
          hasAttachments: emails.hasAttachments,
        }
      })
      .from(emailThreads)
      .leftJoin(emails, eq(emails.threadId, emailThreads.id))
      .where(eq(emailThreads.projectId, projectId))
      .orderBy(desc(emailThreads.updatedAt))
      .limit(Number(limit))
      .offset(offset);

    // Group by thread ID and get latest email for each
    const threadMap = new Map();
    for (const row of threads) {
      const threadId = row.id;
      if (!threadMap.has(threadId) || 
          (row.latestEmail?.sentAt && 
           (!threadMap.get(threadId).latestEmail?.sentAt || 
            new Date(row.latestEmail.sentAt) > new Date(threadMap.get(threadId).latestEmail.sentAt)))) {
        threadMap.set(threadId, row);
      }
    }

    const uniqueThreads = Array.from(threadMap.values());

    res.json({
      threads: uniqueThreads,
      page: Number(page),
      limit: Number(limit),
      total: uniqueThreads.length
    });
  } catch (error) {
    console.error('Error fetching email threads:', error);
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
        fromName: emails.fromName,
        toEmails: emails.toEmails,
        ccEmails: emails.ccEmails,
        bccEmails: emails.bccEmails,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        sentAt: emails.sentAt,
        isOutbound: emails.isOutbound,
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
      threadId: thread.gmailThreadId,
      projectId: thread.projectId
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
      .leftJoin(clients, eq(clients.id, projects.clientId))
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
    const stream = await attachmentsService.getAttachmentStream(attachmentId, userId);
    
    if (!stream) {
      return res.status(404).json({ error: 'Attachment not found or failed to download' });
    }

    // Get attachment metadata
    const attachment = await attachmentsService.getAttachment(attachmentId);
    if (attachment) {
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    }

    stream.pipe(res);
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

    // Mark thread as read using emailSync service
    await emailSyncService.markThreadAsRead(threadId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking thread as read:', error);
    res.status(500).json({ error: 'Failed to mark thread as read' });
  }
});

export default router;