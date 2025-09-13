import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { attachmentsService } from '../services/attachments';
import { emailSyncService } from '../services/emailSync';
import { templatesService } from '../services/templates';
import { tokenResolverService } from '../services/token-resolver';
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
  html: z.string().optional(),
  preheader: z.string().optional(),
  templateId: z.string().optional(),
  projectId: z.string().optional(),
  contactId: z.string().optional(),
  emails: z.array(z.string()).optional()
}).refine(data => {
  // Either use template OR provide subject + (text OR html) directly
  return (data.templateId) || (data.subject && (data.text || data.html));
}, {
  message: 'Either templateId or both subject and (text or html) are required'
});

// Middleware to require proper authentication - NO HEADER SPOOFING ALLOWED
const requireAuth = (req: any, res: any, next: any) => {
  // SECURITY FIX: Use session-based authentication instead of spoofable headers
  const sessionUser = req.session?.user;
  
  if (sessionUser && sessionUser.id) {
    // Session-based authentication (preferred)
    if (!sessionUser.email) {
      return res.status(401).json({ 
        error: 'Invalid session', 
        message: 'Session missing required user data'
      });
    }
    
    req.user = { 
      id: sessionUser.id, 
      email: sessionUser.email
    };
    return next();
  }
  
  // DEVELOPMENT FALLBACK: Allow header-based auth for dev mode only
  if (process.env.NODE_ENV === 'development') {
    const userIdHeader = req.headers['user-id'];
    const userId = typeof userIdHeader === 'string' ? userIdHeader : null;
    
    if (userId) {
      // Use the actual user ID that owns the test data
      const developmentUserId = '00000000-0000-0000-0000-000000000001';
      console.log(`⚠️  DEV MODE: Using header-based auth for user ${userId}, mapped to ${developmentUserId}`);
      req.user = { 
        id: developmentUserId, 
        email: `${userId}@example.com` // Development fallback email
      };
      return next();
    }
  }
  
  return res.status(401).json({ 
    error: 'Authentication required', 
    message: 'Please log in to access this endpoint'
  });
};

// Helper function to get user's email address from authenticated session
async function getUserEmail(userId: string, userEmail?: string): Promise<string> {
  // SECURITY FIX: Use authenticated user's email, no hardcoded fallbacks
  if (userEmail && /.+@.+\..+/.test(userEmail)) {
    return userEmail.trim().toLowerCase();
  }
  
  // If no session email, this is a security issue
  throw new Error(`No authenticated email found for user ${userId}. Session may be invalid.`);
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
    
    // Handle template-based email
    if (emailData.templateId) {
      const template = await templatesService.getTemplate(emailData.templateId);
      if (!template) {
        return res.status(404).json({ ok: false, error: 'Template not found' });
      }
      
      // Render template with tokens
      const rendered = await templatesService.renderTemplate(template, context);
      finalSubject = rendered.subject || 'No Subject';
      finalText = rendered.body;
      
      console.log(`📧 Template rendered: ${rendered.unresolved.length} unresolved tokens`);
      if (rendered.unresolved.length > 0) {
        console.log('⚠️ Unresolved tokens:', rendered.unresolved);
      }
    } else {
      // Direct email composition - apply token resolution to subject and body
      const subjectResult = finalSubject ? 
        await tokenResolverService.resolveTemplate(finalSubject, context) : 
        { rendered: finalSubject, unresolved: [] };
      
      const bodyResult = finalText ? 
        await tokenResolverService.resolveTemplate(finalText, context) : 
        { rendered: finalText, unresolved: [] };
      
      finalSubject = subjectResult.rendered;
      finalText = bodyResult.rendered;
      
      const unresolved = [...subjectResult.unresolved, ...bodyResult.unresolved];
      
      // Debug logging as specified in task (first 120 chars + unresolved tokens)
      const debugText = (emailData.text || '').substring(0, 120);
      console.log(`📧 Token resolution DEBUG - Before: "${debugText}${debugText.length >= 120 ? '...' : ''}"`);
      console.log(`📧 Direct email rendered: ${unresolved.length} unresolved tokens`);
      if (unresolved.length > 0) {
        console.log('⚠️ Unresolved tokens:', unresolved);
      }
    }
    
    // Use the projectId we already determined above
    if (!projectId && emailData.to) {
      // Try to find project by contact email
      try {
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
      } catch (error) {
        console.log('Could not auto-detect project for email sending');
      }
    }
    
    // Send email via Gmail service (which handles database sync automatically)
    const result = await gmailService.sendEmail(userId, {
      to: emailData.to,
      subject: finalSubject,
      text: finalText,
      html: emailData.html,
      preheader: emailData.preheader,
      projectId: projectId
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
 * Get email threads (from contacts only)
 */
router.get('/threads', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.user.id;
    
    // Get all contact emails from CRM to filter threads
    const contactEmails = await db
      .select({ email: contacts.email })
      .from(contacts)
      .where(sql`${contacts.email} IS NOT NULL AND ${contacts.email} != ''`);
    
    const emailAddresses = contactEmails
      .map(c => c.email)
      .filter(email => email && email.trim().length > 0);
    
    // If no contact emails, return empty result
    if (emailAddresses.length === 0) {
      return res.json({
        threads: [],
        ok: true,
        needsReconnect: false
      });
    }
    
    // Get threads involving contact emails only
    const result = await gmailService.listThreadsForAddresses(userId, { 
      limit, 
      addresses: emailAddresses 
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching contact email threads:', error);
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
    
    // SECURITY FIX: Verify user owns the project before accessing threads
    let project;
    try {
      project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Verify project ownership/access
      if (project.assignedTo !== userId && project.userId !== userId) {
        console.log(`🔒 SECURITY: User ${userId} denied access to project ${projectId} - owned by ${project.assignedTo || project.userId}`);
        return res.status(403).json({ error: 'Access denied - project not owned by user' });
      }
    } catch (error) {
      console.error('Error verifying project ownership:', error);
      return res.status(500).json({ error: 'Failed to verify project access' });
    }
    
    let addresses: string[] = [];
    
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
      // SECURITY FIX: Filter threads by both project AND user ownership
      const threadsData = await db
        .select({
          threadId: emailThreads.id,
          subject: emailThreads.subject,
          lastMessageAt: emailThreads.lastMessageAt,
          emailCount: sql<number>`cast(count(${emails.id}) as int)`.as('emailCount'),
        })
        .from(emailThreads)
        .leftJoin(emails, eq(emails.threadId, emailThreads.id))
        .where(and(eq(emailThreads.projectId, projectId), eq(emailThreads.userId, userId)))
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

    const userId = req.user.id;
    
    // SECURITY FIX: Verify user owns the project before accessing messages
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Verify project ownership/access
      if (project.assignedTo !== userId && project.userId !== userId) {
        console.log(`🔒 SECURITY: User ${userId} denied access to project ${projectId} - owned by ${project.assignedTo || project.userId}`);
        return res.status(403).json({ error: 'Access denied - project not owned by user' });
      }
    } catch (error) {
      console.error('Error verifying project ownership:', error);
      return res.status(500).json({ error: 'Failed to verify project access' });
    }
    
    // Get all individual email messages for the project with user filtering
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
      .where(and(eq(emails.projectId, projectId), eq(emails.userId, userId)))
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
 * Get all messages in an email thread from database - REQUIRES AUTH + OWNERSHIP
 */
router.get('/email-threads/:threadId/messages', requireAuth, async (req: any, res) => {
  try {
    const { threadId } = req.params;

    const userId = req.user.id;
    
    // SECURITY FIX: Verify user owns the thread before accessing messages
    const threadOwnership = await db
      .select({ userId: emailThreads.userId })
      .from(emailThreads)
      .where(eq(emailThreads.id, threadId))
      .limit(1);
    
    if (threadOwnership.length === 0) {
      return res.status(404).json({ error: 'Email thread not found' });
    }
    
    if (threadOwnership[0].userId !== userId) {
      console.log(`🔒 SECURITY: User ${userId} denied access to thread ${threadId} - owned by ${threadOwnership[0].userId}`);
      return res.status(403).json({ error: 'Access denied - thread not owned by user' });
    }
    
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
      .where(and(eq(emails.threadId, threadId), eq(emails.userId, userId)))
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
 * POST /api/dev/send-test-email - Development endpoint for testing email formatting
 */
router.post('/dev/send-test-email', requireAuth, async (req, res) => {
  try {
    const { to } = req.body;
    const userId = 'test-user'; // Use same pattern as other endpoints
    
    if (!to) {
      return res.status(400).json({ error: 'Recipient email address is required' });
    }
    
    // Create test email with various formatting elements
    const testHtml = `
      <h1>Test formatting ✓</h1>
      <p>This is a test email to verify HTML formatting and multipart/alternative rendering.</p>
      
      <p>Here are some <strong>bold text</strong> and <em>italic text</em> examples.</p>
      
      <h2>List Example</h2>
      <ul>
        <li>First item with <strong>bold</strong> text</li>
        <li>Second item with <em>italic</em> text</li>
        <li>Third item with <code>inline code</code></li>
      </ul>
      
      <blockquote>
        This is a blockquote to test email client rendering.
      </blockquote>
      
      <p>
        <a href="https://example.com" class="btn" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500;">
          Button-style Link
        </a>
      </p>
      
      <p>Here's an image test:</p>
      <p><img src="https://via.placeholder.com/300x200/007bff/ffffff?text=Email+Test" alt="Test Image" style="max-width: 100%; height: auto;" /></p>
      
      <p>Date format test: ${new Date().toLocaleDateString('en-GB')}</p>
    `;
    
    // Send test email
    const result = await gmailService.sendEmail(userId, {
      to,
      subject: 'Test formatting ✓',
      text: testHtml,
      preheader: 'This is the preview line.'
    });
    
    res.json({
      success: result.ok,
      message: result.ok 
        ? 'Test email sent successfully. Check Gmail/Outlook/Apple Mail for proper rendering.'
        : 'Failed to send test email',
      error: result.error
    });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
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

    // Build context for token resolution
    let resolvedBody = body;
    let resolvedSubject = subject || `Re: ${thread.subject}`;
    
    // Try to build token resolution context from thread info
    const context: any = {};
    if (thread.projectId) {
      context.projectId = thread.projectId;
      
      // Try to get contact ID from project
      try {
        const [project] = await db
          .select({ contactId: projects.contactId })
          .from(projects)
          .where(eq(projects.id, thread.projectId))
          .limit(1);
        if (project?.contactId) {
          context.contactId = project.contactId;
        }
      } catch (error) {
        console.log('Could not auto-detect contact for token resolution');
      }
    }

    // Resolve tokens in both subject and body if context is available
    if (Object.keys(context).length > 0) {
      try {
        const subjectResolution = await tokenResolverService.resolveTemplate(resolvedSubject, context);
        const bodyResolution = await tokenResolverService.resolveTemplate(resolvedBody, context);
        
        resolvedSubject = subjectResolution.rendered;
        resolvedBody = bodyResolution.rendered;
        
        console.log(`📧 Reply token resolution: ${subjectResolution.unresolved.length + bodyResolution.unresolved.length} unresolved tokens`);
        if (subjectResolution.unresolved.length > 0 || bodyResolution.unresolved.length > 0) {
          console.log('⚠️ Unresolved tokens:', [...subjectResolution.unresolved, ...bodyResolution.unresolved]);
        }
      } catch (error) {
        console.error('Token resolution failed for reply:', error);
        // Continue with unresolved content
      }
    }

    // Send email via Gmail with sync
    const emailRequest = {
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: resolvedSubject,
      text: resolvedBody,
      projectId: thread.projectId || undefined,
      threadId: threadId // Pass threadId for proper Gmail threading
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
    } else {
      // No template provided, but check for tokens in subject/body and resolve them
      const context: any = { projectId: projectId };
      if (project.projects?.contactId) {
        context.contactId = project.projects.contactId;
      }
      
      try {
        const subjectResolution = await tokenResolverService.resolveTemplate(finalSubject, context);
        const bodyResolution = await tokenResolverService.resolveTemplate(finalBody, context);
        
        finalSubject = subjectResolution.rendered;
        finalBody = bodyResolution.rendered;
        
        console.log(`📧 Project email token resolution: ${subjectResolution.unresolved.length + bodyResolution.unresolved.length} unresolved tokens`);
        if (subjectResolution.unresolved.length > 0 || bodyResolution.unresolved.length > 0) {
          console.log('⚠️ Unresolved tokens:', [...subjectResolution.unresolved, ...bodyResolution.unresolved]);
        }
      } catch (error) {
        console.error('Token resolution failed for compose email:', error);
        // Continue with unresolved content
      }
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
    const { emailSyncService } = await import('../services/emailSync');
    const { imapService } = await import('../services/imap');
    const { storage } = await import('../../storage');
    
    console.log('🔄 Manual email sync requested (Gmail + IMAP)');
    
    // Use the same logic as background sync: find active Google integrations
    const integrations = await storage.getCalendarIntegrations();
    const activeGoogleIntegrations = integrations.filter(integration => 
      integration.provider === 'google' && 
      integration.isActive && 
      integration.accessToken &&
      integration.userId // Ensure userId is present
    );

    // Get unique user IDs to sync (same as background sync) 
    const uniqueUserIds = Array.from(new Set(
      activeGoogleIntegrations
        .map(integration => integration.userId)
        .filter((userId): userId is string => userId !== null)
    ));

    console.log(`🎯 Found ${uniqueUserIds.length} users with Google integrations for manual sync`);
    
    // Sync Gmail for each user with Google integration
    let gmailResult: { synced: number; skipped: number; errors: string[] } = { synced: 0, skipped: 0, errors: [] };
    for (const userId of uniqueUserIds) {
      try {
        console.log(`🔄 Manual sync for user: ${userId}`);
        const userResult = await emailSyncService.syncGmailThreadsToDatabase(userId);
        gmailResult.synced += userResult.synced;
        gmailResult.skipped += userResult.skipped;
        gmailResult.errors.push(...userResult.errors);
      } catch (error) {
        console.error(`❌ Manual Gmail sync failed for user ${userId}:`, error);
        gmailResult.errors.push(`User ${userId}: ${String(error)}`);
      }
    }

    // Sync IMAP if configured (for each user)
    let imapResult: { synced: number; skipped: number; errors: string[] } = { synced: 0, skipped: 0, errors: [] };
    if (imapService.isImapConfigured()) {
      for (const userId of uniqueUserIds) {
        try {
          console.log(`🔄 Manual IMAP sync starting for user: ${userId}...`);
          const userImapResult = await imapService.fetchNewMessages(userId);
          imapResult.synced += userImapResult.synced;
          imapResult.skipped += userImapResult.skipped;
          imapResult.errors.push(...userImapResult.errors);
        } catch (error) {
          console.error(`❌ Manual IMAP sync failed for user ${userId}:`, error);
          imapResult.errors.push(`User ${userId}: ${String(error)}`);
        }
      }
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