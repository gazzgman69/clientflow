import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { attachmentsService } from '../services/attachments';
import { emailSyncService } from '../services/emailSync';
import { templatesService } from '../services/templates';
import { tokenResolverService } from '../services/token-resolver';
import { microsoftMailService } from '../services/microsoft-mail';
import { imapService } from '../services/imap';
import { z } from 'zod';
import { storage } from '../../storage';
import { db } from '../../db';
import { emailThreads, emails, emailAttachments, projects, contacts, emailThreadReads, users } from '@shared/schema';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import { google } from 'googleapis';

const router = Router();

/**
 * Get available email providers from catalog (OAuth-enabled only)
 */
router.get('/providers', async (req, res) => {
  try {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all OAuth providers from catalog
    const providers = await storage.getEmailProviderCatalog();
    const oauthProviders = providers.filter(p => p.type === 'oauth');

    res.json({ ok: true, providers: oauthProviders });
  } catch (error: any) {
    console.error('❌ Failed to fetch email providers:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

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

// Debug test email schema
const debugTestEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  provider: z.enum(['gmail', 'microsoft', 'smtp'], {
    errorMap: () => ({ message: 'Provider must be gmail, microsoft, or smtp' })
  }),
  fromEmail: z.string().email().optional() // For from header verification testing
});

// Middleware to require proper authentication - SESSION ONLY
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    // Get user ID from session (enforces proper auth)
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required', 
        message: 'Please log in to access this endpoint'
      });
    }
    
    // Fetch user email from database using session userId
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user || !user.email) {
      return res.status(401).json({ 
        error: 'User not found', 
        message: 'Invalid user session. Please log in again.'
      });
    }
    
    // Set authenticated user info with real email from database
    req.user = { 
      id: userId,
      email: user.email.trim().toLowerCase()
    };
    
    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed', 
      message: 'Unable to verify user identity'
    });
  }
};

// Helper function to get user's email address from authenticated session
async function getUserEmail(userId: string, userEmail?: string): Promise<string> {
  // SECURITY FIX: Only use authenticated email that was fetched from database
  if (userEmail && /.+@.+\..+/.test(userEmail)) {
    return userEmail.trim().toLowerCase();
  }
  
  // If no session email provided, this is a security issue - should not happen with fixed requireAuth
  throw new Error(`No authenticated email found for user ${userId}. Authentication middleware should have verified this.`);
}

/**
 * Decode HTML entities (e.g., &lt; to <, &gt; to >, &amp; to &)
 * Using a more comprehensive approach to handle all entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // Must be last to avoid double-decoding
}

/**
 * Send email via Gmail with template support
 */
router.post('/send', requireAuth, async (req: any, res) => {
  try {
    // Debug: Log raw request body before Zod parsing
    console.log('📧 RAW req.body.html (first 100 chars):', req.body.html?.substring(0, 100));
    console.log('📧 RAW req.body type:', typeof req.body.html);
    
    const emailData = sendEmailSchema.parse(req.body);
    const userId = req.user.id;
    
    console.log('📧 AFTER ZOD emailData.html (first 100 chars):', emailData.html?.substring(0, 100));
    
    let finalSubject = emailData.subject || '';
    let finalText = emailData.text || '';
    let finalHtml = emailData.html || '';
    
    // CRITICAL FIX: Decode HTML entities that may have been escaped during HTTP transmission
    // (Replit proxy or security middleware may escape HTML in JSON payloads)
    if (finalHtml) {
      const decodedHtml = decodeHtmlEntities(finalHtml);
      console.log('🔓 DECODED HTML (first 100 chars):', decodedHtml.substring(0, 100));
      finalHtml = decodedHtml;
    }
    
    // Build context for token resolution - auto-enrich from email address
    const context: any = {
      tenantId: req.tenantId || 'default-tenant'
    };
    
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
      // Direct email composition - apply token resolution to subject and body (both text and html)
      const subjectResult = finalSubject ? 
        await tokenResolverService.resolveTemplate(finalSubject, context) : 
        { rendered: finalSubject, unresolved: [] };
      
      const textResult = finalText ? 
        await tokenResolverService.resolveTemplate(finalText, context) : 
        { rendered: finalText, unresolved: [] };
      
      const htmlResult = finalHtml ? 
        await tokenResolverService.resolveTemplate(finalHtml, context) : 
        { rendered: finalHtml, unresolved: [] };
      
      finalSubject = subjectResult.rendered;
      finalText = textResult.rendered;
      finalHtml = htmlResult.rendered;
      
      const unresolved = [...subjectResult.unresolved, ...textResult.unresolved, ...htmlResult.unresolved];
      
      // Debug logging as specified in task (first 120 chars + unresolved tokens)
      const debugContent = (emailData.html || emailData.text || '').substring(0, 120);
      console.log(`📧 Token resolution DEBUG - Before: "${debugContent}${debugContent.length >= 120 ? '...' : ''}"`);
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
    
    // Get tenant ID from session
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    // DIAGNOSTICS: Log send payload before dispatching (per mission requirements)
    console.info('📧 sendEmail payload', {
      hasSubject: !!finalSubject,
      htmlLen: (finalHtml || '').length,
      textLen: (finalText || '').length,
      toCount: emailData.to ? 1 : 0,
      ccCount: emailData.cc ? 1 : 0,
      bccCount: emailData.bcc ? 1 : 0
    });

    // Dispatch email using OAuth provider
    const { emailDispatcher } = await import('../services/email-dispatcher');
    const result = await emailDispatcher.dispatchEmail(userId, tenantId, {
      to: emailData.to,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
      cc: emailData.cc,
      bcc: emailData.bcc,
      replyTo: emailData.replyTo
    });
    
    if (!result.ok) {
      return res.status(500).json(result);
    }
    
    // Store sent email in database for thread tracking
    if (projectId && result.messageId) {
      try {
        await storage.createEmail({
          tenantId,
          userId,
          threadId: result.messageId,
          fromEmail: result.fromEmail || req.user?.email || '',
          toEmails: [emailData.to],
          ccEmails: emailData.cc ? [emailData.cc] : [],
          bccEmails: emailData.bcc ? [emailData.bcc] : [],
          subject: finalSubject,
          bodyText: finalText,
          bodyHtml: finalHtml,
          sentAt: new Date(),
          projectId,
          isSent: true,
          snippet: finalText?.substring(0, 100)
        }, tenantId);
      } catch (dbError) {
        console.error('Failed to store sent email in DB:', dbError);
        // Continue - email was sent successfully
      }
    }
    
    res.json({ 
      ok: true, 
      messageId: result.messageId,
      provider: result.provider,
      warning: result.warning 
    });
  } catch (error: any) {
    if (error.issues) {
      res.status(400).json({ ok: false, error: error.issues[0].message });
    } else {
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
});

/**
 * Get email threads (from synced database)
 */
router.get('/threads', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.user.id;
    
    // SECURITY FIX: Use tenant-aware storage method with proper filtering
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    // Get email threads using tenant-aware storage method - CONTACTS-ONLY FILTERING
    const emails = await storage.getEmails(tenantId, { userId, limit, contactsOnly: true });
    
    // Transform to threads format with latest message details
    const threadMap = new Map();
    emails.forEach(email => {
      if (!threadMap.has(email.threadId)) {
        threadMap.set(email.threadId, {
          threadId: email.threadId,
          subject: email.subject || 'No Subject',
          lastMessageAt: email.sentAt,
          projectId: email.projectId,
          latestMessageId: email.id,
          latestFrom: email.fromEmail || 'Unknown Sender',
          latestSnippet: email.snippet || email.bodyText?.substring(0, 100) || '',
          messageCount: 1
        });
      } else {
        const thread = threadMap.get(email.threadId);
        thread.messageCount++;
        if (email.sentAt > thread.lastMessageAt) {
          thread.lastMessageAt = email.sentAt;
          thread.latestMessageId = email.id;
          thread.latestFrom = email.fromEmail || 'Unknown Sender';
          thread.latestSnippet = email.snippet || email.bodyText?.substring(0, 100) || '';
        }
      }
    });
    
    const threadsWithLatest = Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    ).slice(0, limit);

    // Format the response to match the frontend expectations
    const formattedThreads = threadsWithLatest.map(thread => ({
      threadId: thread.threadId,
      subject: thread.subject || 'No Subject',
      count: parseInt(thread.messageCount as string) || 1,
      latest: {
        from: thread.latestFrom || 'Unknown Sender',
        snippet: thread.latestSnippet || '',
        dateISO: thread.lastMessageAt?.toISOString() || new Date().toISOString(),
        subject: thread.subject || 'No Subject'
      },
      projectId: thread.projectId
    }));
    
    res.json({
      ok: true,
      threads: formattedThreads,
      needsReconnect: false
    });
  } catch (error: any) {
    console.error('Error fetching email threads from database:', error);
    res.status(500).json({ ok: false, error: 'Failed to retrieve email threads from database' });
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
 * List emails (DATABASE-BACKED with CONTACTS-ONLY filtering)
 */
router.get('/list', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.user.id;
    
    // SECURITY FIX: Use tenant-aware storage method with contacts-only filtering
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    // Get emails from database with contacts-only filtering
    const emails = await storage.getEmails(tenantId, { userId, limit, contactsOnly: true });
    
    res.json({
      ok: true,
      emails: emails.map(email => ({
        id: email.id,
        threadId: email.threadId,
        from: email.fromEmail,
        to: email.toEmails,
        subject: email.subject,
        snippet: email.snippet || email.bodyText?.substring(0, 100),
        date: email.sentAt?.toISOString(),
        contactId: email.contactId,
        projectId: email.projectId
      }))
    });
  } catch (error: any) {
    console.error('Error fetching emails from database:', error);
    res.status(500).json({ ok: false, error: 'Failed to retrieve emails from database' });
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
router.post('/dev/send-test-email', requireAuth, async (req: any, res) => {
  try {
    const { to } = req.body;
    const userId = req.user.id;
    
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
router.post('/email-threads/:threadId/reply', requireAuth, upload.array('attachments'), async (req: any, res) => {
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

    // Get user from authenticated session
    const userId = req.user.id;

    // Build context for token resolution
    let resolvedBody = body;
    let resolvedSubject = subject || `Re: ${thread.subject}`;
    
    // Try to build token resolution context from thread info
    const context: any = {
      tenantId: req.tenantId || 'default-tenant'
    };
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
        tenantId: req.tenantId || 'default-tenant',
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
      const context: any = { 
        tenantId: req.tenantId || 'default-tenant',
        projectId: projectId 
      };
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

    // Get user from authenticated session
    const userId = req.user.id;

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
router.post('/projects/:projectId/sync-emails', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'addresses array is required' });
    }

    // Get user from authenticated session
    const userId = req.user.id;

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
router.get('/attachments/:attachmentId/download', requireAuth, async (req: any, res) => {
  try {
    const { attachmentId } = req.params;

    // Get user from authenticated session
    const userId = req.user.id;

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
router.post('/email-threads/:threadId/mark-read', requireAuth, async (req: any, res) => {
  try {
    const { threadId } = req.params;

    // Get user from authenticated session
    const userId = req.user.id;

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

/**
 * DEBUG TEST ENDPOINT: Send test email with provider selection and detailed logging
 */
router.post('/debug/send-test-email', requireAuth, async (req: any, res) => {
  try {
    const { to, provider, fromEmail } = debugTestEmailSchema.parse(req.body);
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    console.log('🧪 DEBUG TEST EMAIL - Starting test send');
    console.log('🧪 DEBUG TEST - Requested provider:', provider);
    console.log('🧪 DEBUG TEST - Target email:', to);
    console.log('🧪 DEBUG TEST - From email (if specified):', fromEmail || 'Not specified');
    console.log('🧪 DEBUG TEST - Authenticated user:', userEmail);
    
    const testSubject = 'Test Email from CRM - Email Provider Debug Test';
    const testText = `This is a test email sent from the CRM email provider debug endpoint.
    
Provider Used: ${provider}
Sent At: ${new Date().toISOString()}
Authenticated User: ${userEmail}
Target Recipient: ${to}

If you received this email, the ${provider} email provider is working correctly!

This email was sent for debugging purposes. You can ignore this message.`;
    
    let providerResponse: any = null;
    
    // Handle each provider with individual try/catch for detailed error responses
    switch (provider) {
      case 'gmail':
        console.log('🧪 DEBUG TEST - Routing to Gmail service...');
        try {
          const result = await gmailService.sendEmail(userId, {
            to,
            subject: testSubject,
            text: testText,
            preheader: 'CRM Email Provider Debug Test'
          });
          
          providerResponse = {
            ok: true,
            provider: 'gmail',
            status: 200,
            messageId: result.messageId,
            raw: {
              messageId: result.messageId,
              threadId: result.threadId,
              success: result.ok
            }
          };
          
          console.log('🧪 DEBUG TEST COMPLETE - Gmail success:', JSON.stringify(providerResponse, null, 2));
          
        } catch (err: any) {
          console.error('🧪 DEBUG TEST ERROR - Gmail error:', err);
          
          providerResponse = {
            ok: false,
            provider: 'gmail',
            errorType: 'OAuthError',
            errorMessage: err.message || 'Gmail API error',
            raw: err.response?.data || err.stack || err
          };
        }
        break;
        
      case 'microsoft':
        console.log('🧪 DEBUG TEST - Routing to Microsoft Graph service...');
        try {
          const microsoftResult = await microsoftMailService.sendEmail({
            to: [to],
            subject: testSubject,
            body: testText,
            isHtml: false,
            fromEmail
          });
          
          if (microsoftResult.success) {
            providerResponse = {
              ok: true,
              provider: 'microsoft',
              status: 200,
              messageId: microsoftResult.messageId,
              raw: microsoftResult
            };
          } else {
            providerResponse = {
              ok: false,
              provider: 'microsoft',
              errorType: 'GraphError',
              errorMessage: microsoftResult.error || 'Microsoft Graph API error',
              raw: microsoftResult
            };
          }
          
          console.log('🧪 DEBUG TEST COMPLETE - Microsoft result:', JSON.stringify(providerResponse, null, 2));
          
        } catch (err: any) {
          console.error('🧪 DEBUG TEST ERROR - Microsoft error:', err);
          
          providerResponse = {
            ok: false,
            provider: 'microsoft',
            errorType: 'GraphError',
            errorMessage: err.message || 'Microsoft Graph API error',
            raw: err.response?.data || err.stack || err
          };
        }
        break;
        
      case 'smtp':
        console.log('🧪 DEBUG TEST - Routing to SMTP service...');
        try {
          const smtpResult = await imapService.sendViaSmtp({
            to,
            subject: testSubject,
            text: testText,
            fromEmail
          });
          
          if (smtpResult.success) {
            providerResponse = {
              ok: true,
              provider: 'smtp',
              status: 200,
              messageId: smtpResult.messageId,
              raw: smtpResult
            };
          } else {
            providerResponse = {
              ok: false,
              provider: 'smtp',
              errorType: 'SMTPError',
              errorMessage: smtpResult.error || 'SMTP delivery error',
              raw: smtpResult
            };
          }
          
          console.log('🧪 DEBUG TEST COMPLETE - SMTP result:', JSON.stringify(providerResponse, null, 2));
          
        } catch (err: any) {
          console.error('🧪 DEBUG TEST ERROR - SMTP error:', err);
          
          providerResponse = {
            ok: false,
            provider: 'smtp',
            errorType: 'SMTPError',
            errorMessage: err.message || 'SMTP connection error',
            raw: err.response || err.stack || err
          };
        }
        break;
        
      default:
        providerResponse = {
          ok: false,
          provider: provider,
          errorType: 'ConfigError',
          errorMessage: `Unknown provider: ${provider}`,
          raw: { error: 'Invalid provider selection' }
        };
    }
    
    // Return enhanced debug information with structured error/success response
    res.json({
      success: providerResponse.ok,
      message: providerResponse.ok 
        ? `Test email sent successfully via ${provider}` 
        : `Test email failed via ${provider}: ${providerResponse.errorMessage}`,
      testDetails: {
        to,
        subject: testSubject,
        provider,
        fromEmailRequested: fromEmail,
        authenticatedUser: userEmail,
        timestamp: new Date().toISOString()
      },
      appResult: providerResponse.ok 
        ? { ok: true } 
        : { ok: false, error: providerResponse.errorMessage, fromMismatch: false },
      providerResponse,
      logs: {
        note: 'Check console logs for detailed provider conversations and status messages'
      }
    });
    
  } catch (error: any) {
    console.error('🧪 DEBUG TEST VALIDATION ERROR:', error);
    
    if (error.issues) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.issues[0].message,
        logs: { note: 'Request validation failed' }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Debug test endpoint error',
      error: error.message || 'Unknown error',
      logs: { note: 'Internal server error in debug endpoint' }
    });
  }
});

/**
 * GET /api/email/provider-catalog
 * Get all email providers from the global catalog
 */
router.get('/provider-catalog', requireAuth, async (req: any, res) => {
  try {
    const providers = await storage.getEmailProviderCatalog();
    res.json({ ok: true, providers });
  } catch (error: any) {
    console.error('Error fetching email provider catalog:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch provider catalog' });
  }
});

/**
 * GET /api/email/provider-catalog/active
 * Get only active email providers from the catalog
 */
router.get('/provider-catalog/active', requireAuth, async (req: any, res) => {
  try {
    const providers = await storage.getActiveEmailProviders();
    // Map database fields to frontend interface (key → code, incoming → supportsReceive, outgoing → supportsSend)
    const mappedProviders = providers.map(p => ({
      id: p.id,
      code: p.key,  // Map key to code for frontend compatibility
      displayName: p.displayName,
      category: p.category,
      authType: p.category,  // Use category as authType for simplicity
      supportsReceive: p.incoming,
      supportsSend: p.outgoing,
      helpUrl: p.helpBlurb,
      setupComplexity: p.category === 'oauth' ? 'simple' : 'moderate',
      isActive: p.isActive
    }));
    res.json({ ok: true, providers: mappedProviders });
  } catch (error: any) {
    console.error('Error fetching active providers:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch active providers' });
  }
});

/**
 * POST /api/email/provider-catalog/seed
 * Seed the email provider catalog (admin only - for initial setup)
 */
router.post('/provider-catalog/seed', requireAuth, async (req: any, res) => {
  try {
    const { emailProviderSeeds } = await import('../../emailProviderSeeds');
    await storage.seedEmailProviders(emailProviderSeeds);
    res.json({ ok: true, message: 'Email provider catalog seeded successfully' });
  } catch (error: any) {
    console.error('Error seeding email providers:', error);
    res.status(500).json({ ok: false, error: 'Failed to seed provider catalog' });
  }
});

/**
 * GET /api/email/tenant-prefs
 * Get tenant email preferences (BCC, read receipts, dashboard settings)
 */
router.get('/tenant-prefs', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    let prefs = await storage.getTenantEmailPrefs(tenantId);
    
    // Return defaults if no preferences exist yet
    if (!prefs) {
      prefs = {
        tenantId,
        bccSelf: false,
        readReceipts: false,
        showOnDashboard: true,
        contactsOnly: true,
        updatedAt: new Date()
      };
    }
    
    res.json({ ok: true, prefs });
  } catch (error: any) {
    console.error('Error fetching tenant email prefs:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/email/tenant-prefs
 * Update tenant email preferences
 */
router.put('/tenant-prefs', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    const { bccSelf, readReceipts, showOnDashboard, contactsOnly } = req.body;
    
    const prefs = await storage.upsertTenantEmailPrefs(tenantId, {
      bccSelf,
      readReceipts,
      showOnDashboard,
      contactsOnly
    });
    
    res.json({ ok: true, prefs });
  } catch (error: any) {
    console.error('Error updating tenant email prefs:', error);
    res.status(500).json({ ok: false, error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/email/preview
 * Preview email with token resolution and MIME formatting (DEBUG_EMAIL=1 only)
 */
if (process.env.DEBUG_EMAIL === '1') {
  router.post('/preview', async (req, res) => {
    try {
      const { to, subject, html, text, tokens } = req.body;
      
      // Build context for token resolution
      const context: any = { 
        tenantId: req.tenantId || 'default-tenant',
        tokens: tokens || {} 
      };
      
      // Resolve tokens
      const subjectResult = subject ? 
        await tokenResolverService.resolveTemplate(subject, context) : 
        { rendered: '', unresolved: [] };
      
      const htmlResult = html ? 
        await tokenResolverService.resolveTemplate(html, context) : 
        { rendered: '', unresolved: [] };
      
      const textResult = text ? 
        await tokenResolverService.resolveTemplate(text, context) : 
        { rendered: '', unresolved: [] };
      
      const finalSubject = subjectResult.rendered;
      let finalHtml = htmlResult.rendered;
      let finalText = textResult.rendered;
      
      // Apply same fallback logic as real send
      if (finalHtml && !finalText) {
        const { convert } = await import('html-to-text');
        finalText = convert(finalHtml, {
          wordwrap: 130,
          selectors: [
            { selector: 'a', options: { ignoreHref: false } },
            { selector: 'img', format: 'skip' }
          ]
        });
      }
      
      if (finalText && !finalHtml) {
        finalHtml = `<html><body><pre style="font-family: sans-serif; white-space: pre-wrap;">${finalText}</pre></body></html>`;
      }
      
      // Build MIME using the same function as real send
      const { buildMimeRaw } = await import('../services/gmail-send');
      const raw = buildMimeRaw({
        from: 'preview@example.com',
        to: to?.length ? (Array.isArray(to) ? to : [to]) : ['them@example.com'],
        subject: finalSubject || 'Subject',
        html: finalHtml || '<p>Empty</p>',
        text: finalText || 'Empty'
      });
      
      // Decode to show preview
      const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      
      res.json({
        ok: true,
        finalSubject,
        htmlLen: (finalHtml || '').length,
        textLen: (finalText || '').length,
        unresolved: [...subjectResult.unresolved, ...htmlResult.unresolved, ...textResult.unresolved],
        preview: decoded.slice(0, 800)
      });
    } catch (error: any) {
      console.error('Preview error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}

export default router;