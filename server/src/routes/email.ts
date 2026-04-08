import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { attachmentsService } from '../services/attachments';
import { emailSyncService } from '../services/emailSync';
import { templatesService } from '../services/templates';
import { tokenResolverService } from '../services/token-resolver';
import { microsoftMailService } from '../services/microsoft-mail';
import { imapService } from '../services/imap';
import { leadStatusAutomator } from '../services/lead-status-automator';
import { secureStore } from '../services/secureStore';
import { z } from 'zod';
import { storage } from '../../storage';
import { db } from '../../db';
import { emailThreads, emails, emailAttachments, projects, contacts, emailThreadReads, users, emailAccounts, leads } from '@shared/schema';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import { unlink, mkdir } from 'fs/promises';
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

// Configure multer for file uploads with TENANT ISOLATION
// Each tenant's files are stored in separate subdirectories for security
const upload = multer({ 
  storage: multer.diskStorage({
    destination: async (req: any, file, cb) => {
      try {
        // SECURITY: Use tenant ID from authenticated session for directory isolation
        const tenantId = req.tenantId || 'default-tenant';
        const tenantUploadDir = path.join(process.cwd(), 'temp-uploads', tenantId);
        
        // Create tenant-specific directory if it doesn't exist
        await mkdir(tenantUploadDir, { recursive: true });
        
        cb(null, tenantUploadDir);
      } catch (error: any) {
        cb(error, '');
      }
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
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
    // Get user ID from session OR from middleware (ensureUserAuth sets req.userId)
    const userId = req.userId || req.session?.userId;
    
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
 * Send email via Gmail with template support and file attachments
 */
router.post('/send', requireAuth, upload.array('attachments', 10), async (req: any, res) => {
  try {
    // Handle both JSON and multipart/form-data
    let emailData: any;
    
    if (req.files && req.files.length > 0) {
      // Multipart/form-data with files
      // Parse JSON fields from FormData
      emailData = {
        to: req.body.to,
        subject: req.body.subject,
        html: req.body.html,
        text: req.body.text,
        preheader: req.body.preheader,
        templateId: req.body.templateId,
        projectId: req.body.projectId,
        contactId: req.body.contactId,
        emails: req.body.emails ? JSON.parse(req.body.emails) : undefined
      };
    } else {
      // Regular JSON request
      emailData = req.body;
    }
    
    // Clean "Name <email>" format to bare email before validation
    if (emailData.to && typeof emailData.to === 'string' && emailData.to.includes('<')) {
      const match = emailData.to.match(/<(.+?)>/);
      if (match) emailData.to = match[1];
    }

    const validatedEmailData = sendEmailSchema.parse(emailData);
    const userId = req.user.id;
    
    let finalSubject = validatedEmailData.subject || '';
    let finalText = validatedEmailData.text || '';
    let finalHtml = validatedEmailData.html || '';
    
    // CRITICAL FIX: Decode HTML entities that may have been escaped during HTTP transmission
    // (Replit proxy or security middleware may escape HTML in JSON payloads)
    if (finalHtml) {
      finalHtml = decodeHtmlEntities(finalHtml);
    }
    
    // Build context for token resolution - auto-enrich from email address
    const context: any = {
      tenantId: req.tenantId || 'default-tenant'
    };
    
    // Use provided IDs or try to derive from email address
    let contactId = validatedEmailData.contactId;
    let projectId = validatedEmailData.projectId;
    
    // If contactId not provided, try to find contact by email
    // SECURITY FIX: Added tenant scoping to prevent cross-tenant contact access
    if (!contactId && validatedEmailData.to) {
      const tenantId = req.tenantId || 'default-tenant';
      try {
        const [contact] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(
            eq(contacts.tenantId, tenantId),
            eq(contacts.email, validatedEmailData.to)
          ))
          .limit(1);
        if (contact) {
          contactId = contact.id;
        }
      } catch (error) {
      }
    }
    
    // If projectId not provided but we have contactId, try to find project
    // SECURITY FIX: Added tenant scoping to prevent cross-tenant project access
    if (!projectId && contactId) {
      const tenantId = req.tenantId || 'default-tenant';
      try {
        const [project] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(
            eq(projects.tenantId, tenantId),
            eq(projects.contactId, contactId)
          ))
          .limit(1);
        if (project) {
          projectId = project.id;
        }
      } catch (error) {
      }
    }
    
    // If contactId is still null but we have a projectId, look up the project's contact
    if (!contactId && projectId) {
      const tenantId = req.tenantId || 'default-tenant';
      try {
        const [proj] = await db
          .select({ contactId: projects.contactId })
          .from(projects)
          .where(and(
            eq(projects.tenantId, tenantId),
            eq(projects.id, projectId)
          ))
          .limit(1);
        if (proj?.contactId) {
          contactId = proj.contactId;
        }
      } catch (error) {
      }
    }

    if (contactId) context.contactId = contactId;
    if (projectId) context.projectId = projectId;
    
    // Handle template-based email
    if (validatedEmailData.templateId) {
      const tenantId = req.tenantId || 'default-tenant';
      const template = await templatesService.getTemplate(validatedEmailData.templateId, tenantId);
      if (!template) {
        return res.status(404).json({ ok: false, error: 'Template not found' });
      }
      
      // Render template with tokens
      const rendered = await templatesService.renderTemplate(template, context);
      finalSubject = rendered.subject || 'No Subject';
      finalText = rendered.body;
      
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
      
    }
    
    // Use the projectId we already determined above
    // SECURITY FIX: Added tenant scoping to all database queries
    if (!projectId && validatedEmailData.to) {
      const tenantId = req.tenantId || 'default-tenant';
      // Try to find project by contact email
      try {
        const [contact] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(
            eq(contacts.tenantId, tenantId),
            eq(contacts.email, validatedEmailData.to)
          ))
          .limit(1);
          
        if (contact) {
          const [project] = await db
            .select({ id: projects.id })
            .from(projects)
            .where(and(
              eq(projects.tenantId, tenantId),
              eq(projects.contactId, contact.id)
            ))
            .limit(1);
            
          if (project) {
            projectId = project.id;
          }
        }
      } catch (error) {
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
      toCount: validatedEmailData.to ? 1 : 0,
      ccCount: validatedEmailData.cc ? 1 : 0,
      bccCount: validatedEmailData.bcc ? 1 : 0,
      attachmentCount: req.files?.length || 0
    });

    // Prepare attachments if present
    const attachments = req.files?.map((file: any) => ({
      filename: file.originalname,
      path: file.path,
      contentType: file.mimetype
    })) || [];

    // Send emails as plain HTML — no branded template wrapping.
    // The user composes the email content directly; no logo or template chrome is added.
    // (Previously wrapped in emailRenderer.render() with business logo — removed per user preference)

    try {
      // Dispatch email using OAuth provider
      console.log('📧 Dispatching email:', { to: validatedEmailData.to, subject: finalSubject, hasHtml: !!finalHtml, hasText: !!finalText, projectId });
      const { emailDispatcher } = await import('../services/email-dispatcher');
      const result = await emailDispatcher.dispatchEmail(userId, tenantId, {
        to: validatedEmailData.to,
        subject: finalSubject,
        text: finalText,
        html: finalHtml,
        cc: validatedEmailData.cc,
        bcc: validatedEmailData.bcc,
        replyTo: validatedEmailData.replyTo,
        attachments
      });
      
      if (!result.ok) {
        return res.status(500).json(result);
      }
      
      // Store sent email in database for thread tracking
      console.log('📧 Email send result:', { ok: result.ok, messageId: result.messageId, threadId: result.threadId, provider: result.provider, projectId, contactId, subject: finalSubject });
      if (projectId) {
        try {
          // The emails table has a FK to email_threads — we must create a thread first
          const providerThreadId = result.threadId || result.messageId || `sent-${Date.now()}`;

          // Check if thread already exists (e.g. from email sync)
          const existingThread = await db.select({ id: emailThreads.id })
            .from(emailThreads)
            .where(eq(emailThreads.id, providerThreadId))
            .limit(1);

          let threadId: string;
          if (existingThread.length > 0) {
            threadId = existingThread[0].id;
            // Update lastMessageAt
            await db.update(emailThreads)
              .set({ lastMessageAt: new Date(), updatedAt: new Date() })
              .where(eq(emailThreads.id, threadId));
          } else {
            // Create new thread record
            const [newThread] = await db.insert(emailThreads).values({
              id: providerThreadId,
              tenantId,
              userId,
              projectId,
              subject: finalSubject,
              lastMessageAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();
            threadId = newThread.id;
            console.log('📧 Created email thread:', threadId);
          }

          await storage.createEmail({
            tenantId,
            userId,
            threadId,
            // Store provider messageId so background sync can deduplicate
            providerMessageId: result.messageId,
            provider: result.provider || 'unknown',
            fromEmail: result.fromEmail || req.user?.email || '',
            toEmails: [validatedEmailData.to],
            ccEmails: validatedEmailData.cc ? [validatedEmailData.cc] : [],
            bccEmails: validatedEmailData.bcc ? [validatedEmailData.bcc] : [],
            subject: finalSubject,
            bodyText: finalText,
            bodyHtml: finalHtml,
            sentAt: new Date(),
            projectId,
            contactId,
            isSent: true,
            direction: 'outbound',
            snippet: finalText?.substring(0, 100)
          }, tenantId);
          console.log('📧 Email stored in DB for project thread:', { threadId, projectId });

          // Trigger a background email sync 15s after sending so the sent email
          // (and any quick reply) shows up promptly without waiting for the next poll cycle
          setTimeout(async () => {
            try {
              const { emailAutoSyncService } = await import('../services/email-auto-sync');
              console.log('🔄 Post-send sync triggered for user:', userId);
              await emailAutoSyncService.syncEmailsForUser(userId);
            } catch (syncErr) {
              console.warn('⚠️ Post-send sync failed (non-fatal):', syncErr);
            }
          }, 15000);

          // Trigger lead status automator if email was sent to a lead
          if (contactId) {
            try {
              // Try to find if this contact is linked to a lead
              const leadResult = await db.select()
                .from(leads)
                .where(and(
                  eq(leads.tenantId, tenantId),
                  eq(leads.contactId, contactId)
                ))
                .limit(1);

              if (leadResult.length > 0) {
                await leadStatusAutomator.onEmailSent(leadResult[0].id, tenantId);
              }
            } catch (automatorError) {
              console.error('⚠️ Lead status automator error after email send:', automatorError);
              // Continue - email was sent successfully regardless
            }
          }
        } catch (dbError) {
          console.error('❌ Failed to store sent email in DB:', dbError);
          // Continue - email was sent successfully
        }
      } else {
      }
      
      res.json({ 
        ok: true, 
        messageId: result.messageId,
        provider: result.provider,
        warning: result.warning 
      });
    } finally {
      // Clean up temporary files
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await unlink(file.path);
            console.log(`🧹 Cleaned up temp file: ${file.originalname}`);
          } catch (err) {
            console.error(`Failed to delete temp file ${file.path}:`, err);
          }
        }
      }
    }
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
 * GET /api/email/inbox
 * Returns individual recent inbound emails from contacts, ordered chronologically.
 * Used by the dashboard "Recent Emails" widget as an inbox-style list.
 */
router.get('/inbox', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    // Fetch individual inbound emails with contact info, ordered by date desc
    const inboxEmails = await db
      .select({
        id: emails.id,
        subject: emails.subject,
        snippet: emails.snippet,
        fromEmail: emails.fromEmail,
        sentAt: emails.sentAt,
        direction: emails.direction,
        projectId: emails.projectId,
        contactId: emails.contactId,
        threadId: emails.threadId,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactFullName: contacts.fullName,
      })
      .from(emails)
      .leftJoin(contacts, eq(emails.contactId, contacts.id))
      .where(
        and(
          eq(emails.tenantId, tenantId),
          eq(emails.direction, 'inbound'),
          sql`${emails.contactId} IS NOT NULL`
        )
      )
      .orderBy(desc(emails.sentAt))
      .limit(limit);

    const formattedEmails = inboxEmails.map(email => ({
      id: email.id,
      from: email.contactFullName || `${email.contactFirstName || ''} ${email.contactLastName || ''}`.trim() || email.fromEmail,
      fromEmail: email.fromEmail,
      subject: email.subject || 'No Subject',
      snippet: email.snippet || '',
      date: email.sentAt?.toISOString() || new Date().toISOString(),
      projectId: email.projectId,
      contactId: email.contactId,
      threadId: email.threadId,
    }));

    res.json({ ok: true, emails: formattedEmails });
  } catch (error: any) {
    console.error('Error fetching inbox emails:', error);
    res.status(500).json({ ok: false, error: 'Failed to retrieve inbox emails' });
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
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    // SECURITY: Verify user has access to the project (owner, assigned, team member, or admin)
    const hasAccess = await storage.canUserAccessProject(userId, tenantId, projectId);
    if (!hasAccess) {
      console.log(`🔒 SECURITY: User ${userId} denied access to project ${projectId} - no permission`);
      return res.status(403).json({ error: 'Access denied - you do not have permission to view this project' });
    }
    
    // Get ALL email messages for the project (not just the logged-in user's emails)
    // User access is already verified via project ownership check above
    // Tenant isolation ensures multi-tenant security
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
      .where(and(eq(emails.projectId, projectId), eq(emails.tenantId, tenantId)))
      .orderBy(desc(emails.sentAt))
      .limit(Number(limit));


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
    
    if (emailsWithAttachments.length > 0) {
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

    try {
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
      }
    }

    // Resolve tokens in both subject and body if context is available
    if (Object.keys(context).length > 0) {
      try {
        const subjectResolution = await tokenResolverService.resolveTemplate(resolvedSubject, context);
        const bodyResolution = await tokenResolverService.resolveTemplate(resolvedBody, context);
        
        resolvedSubject = subjectResolution.rendered;
        resolvedBody = bodyResolution.rendered;
        
        if (subjectResolution.unresolved.length > 0 || bodyResolution.unresolved.length > 0) {
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

      const sendResult = await gmailService.sendEmail(userId, emailRequest, req.tenantId);
      
      if (!sendResult.ok) {
        return res.status(500).json({ error: sendResult.error });
      }

      res.json({ success: true, message: 'Reply sent successfully' });
    } finally {
      // Clean up temporary files
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await unlink(file.path);
            console.log(`🧹 Cleaned up temp file: ${file.originalname}`);
          } catch (err) {
            console.error(`Failed to delete temp file ${file.path}:`, err);
          }
        }
      }
    }
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

    try {
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
      const tenantId = req.tenantId || 'default-tenant';
      const template = await templatesService.getTemplate(templateId, tenantId);
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
        
        if (subjectResolution.unresolved.length > 0 || bodyResolution.unresolved.length > 0) {
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

      const sendResult = await gmailService.sendEmail(userId, emailRequest, req.tenantId);
      
      if (!sendResult.ok) {
        return res.status(500).json({ error: sendResult.error });
      }

      res.json({ success: true, message: 'Email sent successfully' });
    } finally {
      // Clean up temporary files
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await unlink(file.path);
            console.log(`🧹 Cleaned up temp file: ${file.originalname}`);
          } catch (err) {
            console.error(`Failed to delete temp file ${file.path}:`, err);
          }
        }
      }
    }
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
    
    
    // Find active Gmail OAuth connections in email_accounts table
    const gmailAccounts = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.providerKey, 'google'),
          eq(emailAccounts.status, 'connected')
        )
      );

    // Get unique user IDs to sync
    const uniqueUserIds = Array.from(new Set(
      gmailAccounts
        .map(account => account.userId)
        .filter((userId): userId is string => userId !== null)
    ));

    
    // Sync Gmail for each user with Google integration
    let gmailResult: { synced: number; skipped: number; errors: string[] } = { synced: 0, skipped: 0, errors: [] };
    for (const userId of uniqueUserIds) {
      try {
        // SECURITY FIX: Pass session tenantId for proper tenant isolation
        const tenantId = req.tenantId || 'default-tenant';
        const userResult = await emailSyncService.syncGmailThreadsToDatabase(userId, undefined, tenantId);
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
 * POST /api/email/accounts
 * Connect an IMAP/SMTP email account
 */
router.post('/accounts', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(400).json({ ok: false, error: 'Tenant and user context required' });
    }

    const { type, providerKey, settings } = req.body;

    // Validate required fields
    if (!type || type !== 'imap_smtp') {
      return res.status(400).json({ ok: false, error: 'Invalid account type' });
    }

    if (!settings?.imap?.host || !settings?.imap?.user || !settings?.imap?.pass) {
      return res.status(400).json({ ok: false, error: 'Missing required IMAP settings' });
    }

    const imapSettings = settings.imap;

    // Build secrets object with IMAP settings (SMTP is optional)
    const secrets = {
      username: imapSettings.user,
      password: imapSettings.pass,
      imapHost: imapSettings.host,
      imapPort: imapSettings.port || 993,
      imapSecure: imapSettings.secure !== false,
      smtpHost: settings.smtp?.host,
      smtpPort: settings.smtp?.port || 465,
      smtpSecure: settings.smtp?.secure !== false
    };

    const secretsEnc = secureStore.encrypt(JSON.stringify(secrets));

    // Insert or update email account
    await db
      .insert(emailAccounts)
      .values({
        tenantId,
        userId,
        providerKey: providerKey || 'imap_smtp',
        status: 'connected',
        accountEmail: imapSettings.user,
        authType: 'basic',
        secretsEnc,
        lastSyncAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [emailAccounts.tenantId, emailAccounts.userId, emailAccounts.providerKey],
        set: {
          status: 'connected',
          secretsEnc,
          accountEmail: imapSettings.user,
          updatedAt: new Date(),
          lastSyncAt: new Date()
        }
      });

    res.json({ ok: true, success: true });
  } catch (error: any) {
    console.error('Error connecting email account:', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to connect email account' });
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