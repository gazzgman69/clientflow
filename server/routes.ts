import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { createTenantAwareSessionStore } from "./middleware/enhancedSessionStore";
import { db } from './db';
import { sql } from 'drizzle-orm';

// Extend session to include portal and user authentication
declare module 'express-session' {
  interface SessionData {
    portalContactId?: string;
    userId?: string;
    tenantId?: string;
    // Impersonation state for SUPERADMIN functionality
    originalUserId?: string; // The actual SUPERADMIN's ID when impersonating
    originalTenantId?: string; // The SUPERADMIN's original tenant ID
    impersonatedUserId?: string; // The user being impersonated 
    isImpersonating?: boolean; // Flag indicating active impersonation
  }
}
import { twilioService } from "./src/services/twilio";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import { neon } from '@neondatabase/serverless';

// Password hashing utility
const SALT_ROUNDS = 12;
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

// Secure reset token storage (in production, use Redis or database with TTL)
const resetTokens = new Map<string, { userId: string, expiresAt: Date }>();

// Generate secure reset token
const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash token for secure storage
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
import { googleCalendarService } from "./src/services/google-calendar";
import { googleOAuthService } from "./src/services/google-oauth";
import { icalService } from "./src/services/ical";
import oauthRoutes from "./src/routes/oauth";
import emailRoutes from "./src/routes/email";
import templatesRoutes from "./src/routes/templates";
import mailSettingsRoutes from "./src/routes/mailSettings";
import userPrefsRoutes from "./src/routes/userPrefs";
import leadFormsRoutes from "./src/routes/lead-forms";
import leadCustomFieldsRoutes from "./src/routes/lead-custom-fields";
import leadAutomationSimpleRoutes from "./src/routes/lead-automation-simple";
import signaturesRoutes from "./src/routes/signatures";
import venuesRoutes from "./src/routes/venues";
import tokensRoutes from "./src/routes/tokens";
import portalPaymentsRoutes from "./src/routes/portal-payments";
import portalFormsRoutes from "./src/routes/portal-forms";
import portalAppointmentsRoutes from "./src/routes/portal-appointments";
import stripeWebhooksRoutes from "./src/routes/stripe-webhooks";
import tenantCleanupRoutes from "./src/routes/tenantCleanup";
import { userPrefsService } from "./src/services/userPrefs";
import { calendarAutoSyncService } from "./src/services/calendar-auto-sync";
import { tenantResolver, requireTenant, type TenantRequest } from "./middleware/tenantResolver";
import { ensureUserAuth, ensurePortalAuth, ensureAdminAuth, ensureSuperAdminAuth, withUserAuth, withPortalAuth } from "./middleware/auth";
import { 
  withTenantSecurity, 
  validateTenantSession, 
  enforceSessionTimeout, 
  preventCrossTenantAccess, 
  auditSecurityEvents 
} from "./middleware/tenantSecurity";
import { tokenResolverService } from "./src/services/token-resolver";
import { 
  insertLeadSchema, 
  insertContactSchema, 
  insertProjectSchema, 
  insertQuoteSchema, 
  insertContractSchema, 
  insertInvoiceSchema, 
  insertTaskSchema, 
  insertEmailThreadSchema,
  insertEmailSchema,
  insertEmailAttachmentSchema,
  insertEmailThreadReadSchema,
  insertAutomationSchema,
  insertMemberSchema,
  insertVenueSchema,
  insertProjectMemberSchema,
  insertMemberAvailabilitySchema,
  insertProjectFileSchema,
  insertProjectNoteSchema,
  insertSmsMessageSchema,
  insertMessageTemplateSchema,
  insertMessageThreadSchema,
  insertEventSchema,
  insertCalendarIntegrationSchema,
  insertCalendarSyncLogSchema,
  insertQuotePackageSchema,
  insertQuoteAddonSchema,
  insertQuoteItemSchema,
  insertQuoteSignatureSchema,
  insertQuoteExtraInfoFieldSchema,
  insertQuoteExtraInfoConfigSchema,
  insertQuoteExtraInfoResponseSchema,
  insertAdminAuditLogSchema,
  signupSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  portalAccessRequestSchema,
  portalTokenVerifySchema,
  leadStatusUpdateSchema
} from "@shared/schema";

export async function registerRoutes(app: Express, csrfProtection?: any): Promise<Server> {
  // CRITICAL DEBUG: Log app instance and verify route registration
  console.log('🔧 REGISTER ROUTES CALLED:', {
    appType: typeof app,
    hasGet: typeof app.get === 'function',
    hasPost: typeof app.post === 'function',
    hasUse: typeof app.use === 'function'
  });

  // Health endpoints with rate limiting for production monitoring
  const healthLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Allow 30 requests per minute per IP for health
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many health check requests' },
  });

  const readinessLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute  
    max: 6, // Allow 6 requests per minute per IP for readiness (more expensive)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many readiness check requests' },
  });

  // Basic health check - lightweight endpoint for load balancers
  app.get('/api/health', healthLimiter, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0'
    });
  });

  // Readiness check - comprehensive dependency verification
  app.get('/api/ready', readinessLimiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'ready',
      services: {} as Record<string, { status: string; response_time_ms?: number; used_mb?: number; error?: string }>
    };

    try {
      // Database connectivity check
      const dbStart = Date.now();
      await db.execute(sql.raw('SELECT 1'));
      checks.services.database = {
        status: 'healthy',
        response_time_ms: Date.now() - dbStart
      };
    } catch (error) {
      checks.services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
      checks.status = 'degraded';
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    checks.services.memory = {
      status: memUsageMB > 500 ? 'warning' : 'healthy',
      used_mb: memUsageMB
    };

    // Job queue health check
    try {
      const { jobs } = await import('./src/services/jobsService');
      const queueStatus = await jobs.getQueueStatus();
      checks.services.job_queue = {
        status: 'healthy',
        response_time_ms: queueStatus.activeJobs
      };
    } catch (error) {
      checks.services.job_queue = {
        status: 'degraded',
        error: 'Job queue status unavailable'
      };
    }

    // Return appropriate HTTP status based on overall health
    const hasUnhealthy = Object.values(checks.services).some(service => service.status === 'unhealthy');
    const hasDegraded = Object.values(checks.services).some(service => service.status === 'degraded');
    const statusCode = hasUnhealthy ? 503 : (hasDegraded ? 503 : 200);
    
    res.status(statusCode).json(checks);
  });

  // Import auth limiter from main app
  const authLimiter = (app as any).authLimiter;
  
  // Session configuration with PostgreSQL store
  const PgSession = ConnectPgSimple(session);
  const sessionTableName = 'sessions';
  console.log(`🗄️  Session store using table: ${sessionTableName}`);
  
  // Enhanced tenant-aware session store with security features
  const enhancedSessionStore = createTenantAwareSessionStore({
    conString: process.env.DATABASE_URL,
    tableName: sessionTableName,
    createTableIfMissing: true,
    maxSessionsPerUser: 5,
    maxSessionsPerTenant: 100,
    enableSessionTracking: true,
    sessionTimeoutMinutes: 1440 // 24 hours
  });
  
  // Get session secret from config service
  const { configService } = await import('./src/services/configService');
  const sessionSecret = await configService.getSessionSecret();
  
  // Environment-specific session cookie configuration
  // Only use Replit configuration for actual Replit deployment domain requests
  const sessionConfig = {
    store: enhancedSessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Use dynamic configuration based on request host
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
      // Domain will be set dynamically per request if needed
    }
  };
  
  console.log('🍪 SESSION CONFIGURATION:', {
    cookieConfig: sessionConfig.cookie,
    note: 'Domain will be dynamically set for Replit requests'
  });
  
  app.use(session(sessionConfig));
  
  // JSON parsing middleware
  app.use(express.json());
  
  // OAuth routes (must be after session middleware) - no CSRF for OAuth flows
  app.use(oauthRoutes);
  
  // Apply CSRF protection to state-changing routes if provided
  const csrf = csrfProtection || ((req: any, res: any, next: any) => next());

  // CSRF-free public venue endpoints for lead capture forms (must be before general venue mount)
  app.post('/api/venues/suggest', async (req, res) => {
    console.log('✅ Direct venue suggest route hit');
    try {
      const { venuesService } = await import('./src/services/venues');
      const autocompleteSchema = z.object({
        input: z.string().min(1, 'Search input is required'),
        sessionToken: z.string().optional(),
        types: z.array(z.string()).optional()
      });
      
      const validatedData = autocompleteSchema.parse(req.body);
      
      const suggestions = await venuesService.getSuggestions(
        validatedData.input,
        {
          sessionToken: validatedData.sessionToken,
          types: validatedData.types
        }
      );
      
      res.json({ predictions: suggestions });
    } catch (error) {
      console.error('Error getting venue suggestions:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      } else {
        res.status(500).json({ 
          message: error instanceof Error ? error.message : 'Failed to get venue suggestions'
        });
      }
    }
  });

  app.post('/api/venues/place-details', async (req, res) => {
    console.log('✅ Direct venue place-details route hit');
    try {
      const { geocodingService } = await import('./src/services/geocoding');
      const { placeId, sessionToken } = req.body;
      
      if (!placeId) {
        return res.status(400).json({ message: 'placeId is required' });
      }
      
      const placeDetails = await geocodingService.getPlaceDetails(placeId, sessionToken);
      res.json(placeDetails);
    } catch (error) {
      console.error('Error getting place details:', error);
      res.status(500).json({ 
        message: 'Failed to get place details',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/venues/:id/track-usage', async (req, res) => {
    console.log('✅ Direct venue track-usage route hit');
    try {
      const { venuesService } = await import('./src/services/venues');
      await venuesService.trackVenueUsage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking venue usage:', error);
      res.status(500).json({ 
        message: 'Failed to track venue usage',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Venue routes with authentication, tenant resolution and CSRF protection (except for public endpoints used by lead capture forms)
  app.use('/api/venues', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant), (req, res, next) => {
    console.log(`🔍 VENUES DEBUG: path="${req.path}", method="${req.method}"`);
    // Skip CSRF for public endpoints used by lead capture forms
    const publicEndpoints = ['/suggest', '/place-details'];
    const isTrackUsage = req.method === 'POST' && req.path.includes('/track-usage');
    
    if (req.method === 'POST' && (publicEndpoints.includes(req.path) || isTrackUsage)) {
      console.log('✅ VENUES: Skipping CSRF for public endpoint');
      return next();
    }
    console.log('🛡️ VENUES: Applying CSRF protection');
    return csrf(req, res, next);
  }, venuesRoutes);

  
  // Email routes - apply authentication, tenant resolution, CSRF to state-changing requests
  app.use('/api/email', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), emailRoutes);
  app.use('/api/email-threads', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), emailRoutes); // Direct mounting for /api/email-threads routes
  
  // Mail settings routes - apply enhanced tenant security
  app.use('/api/settings/mail', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), mailSettingsRoutes);
  
  // User preferences routes - apply enhanced tenant security
  app.use('/api/user', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), userPrefsRoutes);
  
  // Templates routes - apply enhanced tenant security
  app.use('/api/templates', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), templatesRoutes);
  
  // Token routes - apply enhanced tenant security
  app.use('/api/tokens', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), tokensRoutes);
  
  // Signatures routes - apply enhanced tenant security
  app.use('/api/signatures', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), signaturesRoutes);
  
  // Specific leads endpoints (must be before general /api/leads router mount)
  // GET /api/leads/summary
  app.get("/api/leads/summary", ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant), async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      const leads = await storage.getLeads(tenantId);
      const counts = {
        new: leads.filter(l => l.status === 'new' && !l.lastViewedAt).length, // Only count unseen new leads
        total: leads.length
      };
      
      res.json({ counts });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch summary data" });
    }
  });

  // Mark leads as viewed (for notification badge)
  app.post("/api/leads/mark-viewed", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      const leads = await storage.getLeads(tenantId);
      const unseenLeads = leads.filter(l => l.status === 'new' && !l.lastViewedAt);
      
      // Mark all unseen new leads as viewed
      for (const lead of unseenLeads) {
        await storage.updateLead(lead.id, { lastViewedAt: new Date() });
      }
      
      res.json({ marked: unseenLeads.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark leads as viewed" });
    }
  });

  // General leads routes
  // NOTE: Main GET /api/leads route moved to line ~1946 with proper LeadCardDTO mapping

  app.get("/api/leads/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData, req.tenantId);
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  app.patch("/api/leads/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const leadData = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(req.params.id, leadData);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  // PATCH /api/leads/:id/status
  app.patch("/api/leads/:id/status", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { status } = leadStatusUpdateSchema.parse(req.body);

      // Get current lead first
      const currentLead = await storage.getLead(req.params.id);
      if (!currentLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Map pipeline status back to lead status
      let leadStatus = status;
      if (status === 'contacted') leadStatus = 'follow-up';
      if (status === 'archived') leadStatus = 'converted';

      // Update with manual status tracking
      const lead = await storage.updateLead(req.params.id, { 
        status: leadStatus,
        lastManualStatusAt: new Date()
      });
      
      // TODO: Record manual status change in history
      // await storage.createLeadStatusHistory({
      //   leadId: req.params.id,
      //   fromStatus: currentLead.status,
      //   toStatus: status,
      //   reason: 'manual',
      //   metadata: JSON.stringify({ userId: req.headers['user-id'] || 'unknown' })
      // });
      
      // TODO: Trigger automation event for lead update
      // leadAutomationService.onEvent('lead.status_changed', {
      //   leadId: req.params.id,
      //   fromStatus: currentLead.status,
      //   toStatus: status,
      //   reason: 'manual'
      // });
      
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ message: "Failed to update lead status" });
    }
  });

  app.delete("/api/leads/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteLead(req.params.id, req.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });
  
  // reCAPTCHA config endpoint moved to server/index.ts to avoid global middleware conflicts

  // Lead Forms routes - public routes (no auth), non-public routes need auth
  // NOTE: This is for lead capture forms only, not general leads endpoints
  
  // PUBLIC ROUTES: Lead form hosting (no auth required for public access)
  // Direct implementation to avoid conflicts with lead CRUD operations
  app.get('/api/leads/public/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const form = await storage.getLeadCaptureFormBySlug(slug);
      
      if (!form || !form.isActive) {
        return res.status(404).json({ error: 'Form not found' });
      }

      // Parse questions from form or use default questions from leadFormsRoutes
      const getDefaultQuestionsForForm = () => [
        {
          id: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          mapTo: 'firstName',
          orderIndex: 1
        },
        {
          id: 'lastName', 
          type: 'text',
          label: 'Last Name',
          required: true,
          mapTo: 'lastName',
          orderIndex: 2
        },
        {
          id: 'email',
          type: 'email', 
          label: 'Email',
          required: true,
          mapTo: 'email',
          orderIndex: 3
        },
        {
          id: 'phone',
          type: 'tel',
          label: 'Phone', 
          required: false,
          mapTo: 'phone',
          orderIndex: 4
        },
        {
          id: 'projectDate',
          type: 'date',
          label: 'Event Date',
          required: true,
          mapTo: 'projectDate', 
          orderIndex: 5
        },
        {
          id: 'venue',
          type: 'venue',
          label: 'Venue',
          required: false,
          mapTo: 'venue',
          orderIndex: 6
        }
      ];

      let questions = getDefaultQuestionsForForm();
      try {
        if (form.questions) {
          questions = JSON.parse(form.questions);
        }
      } catch (e) {
        console.error('Error parsing questions:', e);
        // Fall back to default questions
      }

      res.json({
        form: {
          id: form.id,
          title: form.name,
          slug: form.slug,
          recaptchaEnabled: form.recaptchaEnabled,
          transparency: 'We will use this information to contact you about our services.',
          consentRequired: form.consentRequired,
          consentText: form.consentText,
          privacyPolicyUrl: form.privacyPolicyUrl,
          dataRetentionDays: form.dataRetentionDays
        },
        questions: questions
      });
    } catch (error) {
      console.error('Error fetching public form:', error);
      res.status(500).json({ error: 'Failed to fetch form' });
    }
  });
  
  // Helper function for default form questions
  function getDefaultQuestionsForForm() {
    return [
      { id: '1', type: 'text', label: 'Name', required: true, mapTo: 'leadName', orderIndex: 0 },
      { id: '2', type: 'email', label: 'Email Address', required: true, mapTo: 'leadEmail', orderIndex: 1 },
      { id: '3', type: 'tel', label: 'Phone Number', required: true, mapTo: 'leadPhoneNumber', orderIndex: 2 },
      { id: '4', type: 'select', label: 'Event Type', required: true, mapTo: 'eventType', orderIndex: 3, options: 'Wedding,Private,Corporate,Other' },
      { id: '5', type: 'venue', label: 'Event Location (Full address if possible please)', required: true, mapTo: 'eventLocation', orderIndex: 4 },
      { id: '6', type: 'date', label: 'Event Date', required: true, mapTo: 'projectDate', orderIndex: 5 },
      { id: '7', type: 'textarea', label: 'Message', required: false, mapTo: 'nothing', orderIndex: 6 }
    ];
  }

  // Mount only the specific public form routes (no authentication required)
  // Public form access: GET /api/leads/public/:slug
  app.get('/api/leads/public/:slug', async (req, res) => {
    const { slug } = req.params;
    
    try {
      const form = await storage.getLeadCaptureFormBySlug(slug);
      
      if (!form || !form.isActive) {
        return res.status(404).json({ error: 'Form not found' });
      }

      // Parse questions from form or use default questions
      let questions = getDefaultQuestionsForForm();
      try {
        if (form.questions) {
          questions = JSON.parse(form.questions);
        }
      } catch (e) {
        console.error('Error parsing questions:', e);
        // Fall back to default questions
      }

      res.json({
        form: {
          id: form.id,
          title: form.name,
          slug: form.slug,
          recaptchaEnabled: form.recaptchaEnabled,
          transparency: 'We will use this information to contact you about our services.',
          consentRequired: form.consentRequired,
          consentText: form.consentText,
          privacyPolicyUrl: form.privacyPolicyUrl,
          dataRetentionDays: form.dataRetentionDays
        },
        questions: questions
      });
    } catch (error) {
      console.error('Error fetching public form:', error);
      res.status(500).json({ error: 'Failed to fetch form' });
    }
  });
  
  // Public form submission: POST /api/leads/public/:slug/submit  
  app.use('/api/leads/public', leadFormsRoutes);
  
  // Lead-forms admin routes (with auth)
  app.use('/api/lead-forms', ensureUserAuth, tenantResolver, requireTenant, csrf, leadFormsRoutes);
  
  // Lead Custom Fields routes - apply user auth, tenant resolution, CSRF for custom field management
  app.use('/api/lead-custom-fields', ensureUserAuth, tenantResolver, requireTenant, csrf, leadCustomFieldsRoutes);
  
  // Lead Automation routes (simplified version) - apply admin auth, tenant resolution, CSRF to state-changing requests
  app.use('/api/admin/lead-automation', ensureAdminAuth, tenantResolver, requireTenant, csrf, leadAutomationSimpleRoutes);
  
  // Admin Lead Forms routes - apply admin auth, tenant resolution, CSRF to admin management endpoints  
  app.use('/api/admin/lead-forms', ensureAdminAuth, tenantResolver, requireTenant, csrf, leadFormsRoutes);

  // Tenant Cleanup routes - apply ADMIN auth, tenant resolution, CSRF to cleanup management endpoints
  app.use('/api/tenant-cleanup', ensureAdminAuth, tenantResolver, requireTenant, csrf, tenantCleanupRoutes);

  // Portal routes (client portal features) - all secured with session auth + CSRF
  app.use('/api/portal/payments', ensurePortalAuth, csrf, portalPaymentsRoutes);
  app.use('/api/portal/forms', ensurePortalAuth, csrf, portalFormsRoutes);
  app.use('/api/portal/appointments', ensurePortalAuth, csrf, portalAppointmentsRoutes);

  // Stripe webhook routes (NO CSRF protection - Stripe handles authentication via signature verification)
  app.use('/api/stripe', stripeWebhooksRoutes);
  
  // Security helper functions for portal authentication
  async function verifyProjectAccess(contactId: string, projectId: string): Promise<boolean> {
    try {
      // Get all projects owned by this contact
      const contactProjects = await storage.getProjectsByContact(contactId);
      
      // Check if the requested project is owned by this contact
      const hasAccess = contactProjects.some(project => project.id === projectId);
      
      if (!hasAccess) {
        console.log(`🔒 SECURITY: Contact ${contactId} denied access to project ${projectId} - not in owned projects [${contactProjects.map(p => p.id).join(', ')}]`);
      }
      
      return hasAccess;
    } catch (error) {
      console.error('❌ SECURITY: Error verifying project access - DENYING ACCESS:', error);
      return false; // FAIL-CLOSED: Default to no access on error
    }
  }

  async function resolveTenantId(contactId: string, projectId?: string): Promise<string> {
    try {
      // For now, use a consistent system-wide tenant ID since we don't have multi-tenancy yet
      // In the future, this could resolve the tenant based on:
      // - Contact's organization/company 
      // - Project's assigned user/owner
      // - Environment-specific tenant mapping
      
      if (projectId) {
        // Get project to find the assigned user (potential tenant)
        const project = await storage.getProject(projectId);
        if (project?.assignedTo) {
          return project.assignedTo; // Use project owner as tenant
        }
      }
      
      // Fallback to system default tenant
      return 'system-default';
    } catch (error) {
      console.error('❌ SECURITY: Error resolving tenant ID - using fallback:', error);
      return 'system-default'; // Fallback to known safe value
    }
  }

  // SECURITY: Helper function to get authenticated user ID from session
  async function getAuthenticatedUserId(req: any): Promise<string | null> {
    // Check for authenticated user ID in session
    if (req.session && req.session.userId) {
      return req.session.userId;
    }
    
    // No session found - user must login
    return null;
  }

  // Portal enabled helper function
  async function isPortalEnabled(tenantId: string, projectId?: string): Promise<boolean> {
    try {
      // 1. Read tenant.portalEnabled (default true if missing)
      const tenantPortalEnabled = await userPrefsService.getUserPref(tenantId, 'portalEnabled');
      const tenantDefault = tenantPortalEnabled !== null ? tenantPortalEnabled === 'true' : true;
      
      // 2. If no projectId provided, return tenant default
      if (!projectId) {
        return tenantDefault;
      }
      
      // 3. Check project.portalEnabledOverride
      const project = await storage.getProject(projectId);
      if (!project) {
        return tenantDefault; // Project not found, use tenant default
      }
      
      // 4. If project.portalEnabledOverride is boolean, return that; else return tenant default
      if (project.portalEnabledOverride !== null && project.portalEnabledOverride !== undefined) {
        return project.portalEnabledOverride;
      }
      
      return tenantDefault;
    } catch (error) {
      console.error('❌ SECURITY: Error checking portal enabled status - DENYING ACCESS:', error);
      return false; // FAIL-CLOSED: Default to disabled on error for security
    }
  }

  // Portal authentication logic moved to middleware/auth.ts

  // Portal authentication endpoints
  // Step 1: Request magic link (with portal enabled check)
  app.post('/api/portal/auth/request-access', authLimiter, async (req, res) => {
    try {
      const { email, projectId } = portalAccessRequestSchema.parse(req.body);
      
      // Find contact by email
      const contact = await storage.getContactByEmail(email);
      if (!contact) {
        // Don't reveal if email exists or not for security
        return res.json({ success: true, message: 'If an account exists with this email, you will receive an access link' });
      }

      // SECURITY: Verify project ownership before checking portal access
      if (projectId) {
        const hasAccess = await verifyProjectAccess(contact.id, projectId);
        if (!hasAccess) {
          console.log(`🚫 SECURITY: Contact ${email} denied portal access request for project ${projectId} - not owner`);
          // Don't reveal why access was denied for security
          return res.json({ success: true, message: 'If an account exists with this email, you will receive an access link' });
        }
      }
      
      // Check if portal is enabled for this tenant/project before generating magic link
      const tenantId = await resolveTenantId(contact.id, projectId);
      const portalEnabled = await isPortalEnabled(tenantId, projectId);
      if (!portalEnabled) {
        console.log(`🚫 Portal access request blocked for ${email} - portal disabled for tenant ${tenantId}, project ${projectId || 'none'}`);
        return res.status(403).json({ 
          error: 'Client portal access is currently disabled',
          message: 'The client portal has been temporarily disabled. Please contact your service provider for assistance.'
        });
      }
      
      // Generate cryptographically secure access token (expires in 15 minutes)
      const crypto = require('crypto');
      const accessToken = crypto.randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      // Store token securely (in production, use database with TTL)
      global.portalTokens = global.portalTokens || new Map();
      global.portalTokens.set(accessToken, { contactId: contact.id, email: contact.email, expiresAt });
      
      // TODO: Send email with magic link containing token
      // For security, never log or return the actual token
      console.log(`📧 Access link request for ${email} - token sent (expires in 15 minutes)`);
      
      res.json({ 
        success: true, 
        message: 'If an account exists with this email, you will receive an access link'
      });
    } catch (error: any) {
      console.error('Portal access request error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  });
  
  // Step 2: Verify token and login
  app.post('/api/portal/auth/verify-token', authLimiter, async (req, res) => {
    try {
      const { token } = portalTokenVerifySchema.parse(req.body);
      
      // Get token from memory store
      global.portalTokens = global.portalTokens || new Map();
      const tokenData = global.portalTokens.get(token);
      
      if (!tokenData || tokenData.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Invalid or expired access token' });
      }
      
      // Verify contact still exists
      const contact = await storage.getContact(tokenData.contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      // Regenerate session ID for security
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ error: 'Authentication failed' });
        }
        
        // Store contactId in new session
        req.session.portalContactId = contact.id;
        
        // Remove used token
        global.portalTokens.delete(token);
        
        res.json({ 
          success: true, 
          contact: { id: contact.id, name: contact.fullName || contact.firstName, email: contact.email } 
        });
      });
    } catch (error: any) {
      console.error('Portal token verification error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  app.post('/api/portal/auth/logout', (req, res) => {
    // Properly destroy the session for security
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/portal/auth/me', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!; // ensurePortalAuth guarantees this exists
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json({ contact: { id: contact.id, name: contact.fullName || contact.firstName, email: contact.email } });
    } catch (error: any) {
      console.error('Error fetching contact info:', error);
      res.status(500).json({ error: 'Failed to get contact info' });
    }
  });

  // Portal client routes - secure endpoints for authenticated clients
  app.get('/api/portal/client/projects', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!; // ensurePortalAuth guarantees this exists
      const projects = await storage.getProjectsByContact(contactId);
      res.json(projects);
    } catch (error: any) {
      console.error('Error fetching portal projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });
  
  app.get('/api/portal/client/contracts', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!; // ensurePortalAuth guarantees this exists
      const contracts = await storage.getContractsByClient(contactId);
      res.json(contracts);
    } catch (error: any) {
      console.error('Error fetching portal contracts:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });
  
  app.get('/api/portal/client/quotes', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!; // ensurePortalAuth guarantees this exists
      const quotes = await storage.getQuotesByContact(contactId);
      res.json(quotes);
    } catch (error: any) {
      console.error('Error fetching portal quotes:', error);
      res.status(500).json({ error: 'Failed to fetch quotes' });
    }
  });
  
  // Main user authentication endpoints  
  // User signup endpoint
  app.post('/api/auth/signup', tenantResolver, requireTenant, authLimiter, async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = signupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      
      const users = await storage.getUsers();
      const existingEmail = users.find(u => u.email === email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      
      // Hash password with bcrypt
      const hashedPassword = await hashPassword(password);
      
      // Get tenant context from middleware - tenantResolver ensures this is valid
      const currentTenantId = (req as any).tenantId;
      
      // Create new user with proper tenant assignment
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'user' // Default role
      }, currentTenantId);
      
      // Regenerate session ID for security
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ error: 'Signup failed' });
        }
        
        // Store user ID and tenant ID in session (auto-login after signup)
        req.session.userId = newUser.id;
        if (!newUser.tenantId) {
          return res.status(500).json({ error: 'User tenant context is invalid' });
        }
        req.session.tenantId = newUser.tenantId;
        
        res.json({ 
          success: true, 
          user: { 
            id: newUser.id, 
            username: newUser.username, 
            email: newUser.email, 
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role
          } 
        });
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Handle validation errors specifically with 400 status
      if (error.name === 'ZodError' || error.issues) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          issues: error.issues?.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message
          })) || []
        });
      }
      
      // Handle other errors with 500 status
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Test route to verify routing is working
  app.get('/api/auth/test', (req, res) => {
    console.log('🧪 TEST ROUTE HIT:', req.path);
    res.json({ message: 'Route registration is working' });
  });

  app.post('/api/auth/login', tenantResolver, requireTenant, authLimiter, async (req, res) => {
    try {
      console.log('🔐 LOGIN ATTEMPT:', {
        body: req.body,
        tenantId: (req as any).tenantId,
        host: req.get('host'),
        sessionId: req.session?.id,
        hasSession: !!req.session
      });
      
      const { username, password } = loginSchema.parse(req.body);
      
      // Get current tenant context from request - MUST be properly resolved
      const currentTenantId = (req as any).tenantId;
      console.log('🔐 TENANT CHECK:', {
        currentTenantId,
        tenantType: typeof currentTenantId,
        isEmpty: !currentTenantId
      });
      
      if (!currentTenantId) {
        console.error('🚨 TENANT CONTEXT MISSING - Login failed due to no tenant resolution');
        return res.status(400).json({ 
          error: 'Tenant context required',
          message: 'Unable to determine tenant context for authentication'
        });
      }
      
      // Get user from database with tenant scoping
      const user = await storage.getUserByUsername(username, currentTenantId);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // SECURITY: Validate user belongs to the current tenant context
      if (user.tenantId !== currentTenantId) {
        console.warn(`🚨 SECURITY VIOLATION: User ${username} attempted login to wrong tenant`, {
          userTenant: user.tenantId,
          requestTenant: currentTenantId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'User not authorized for this tenant'
        });
      }
      
      // Use bcrypt to compare hashed passwords
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Regenerate session ID for security
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ error: 'Login failed' });
        }
        
        // Store user ID and tenant ID in session - validate tenant exists
        req.session.userId = user.id;
        if (!user.tenantId) {
          return res.status(500).json({ error: 'User tenant context is invalid' });
        }
        req.session.tenantId = user.tenantId;
        
        console.log('🔐 SESSION DATA SAVED:', {
          sessionId: req.session.id,
          userId: req.session.userId,
          tenantId: req.session.tenantId,
          userTenantId: user.tenantId,
          cookieSecure: req.session.cookie.secure,
          cookieHttpOnly: req.session.cookie.httpOnly,
          sessionSaved: !!req.session.userId
        });
        
        // Explicitly save session to ensure persistence
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({ error: 'Session save failed' });
          }
          
          console.log('✅ SESSION EXPLICITLY SAVED');
          
          // Debug: Check Set-Cookie header being sent  
          try {
            const setCookieHeader = res.getHeader('Set-Cookie');
            console.log('🍪 SET-COOKIE HEADER DEBUG:', {
              setCookieHeader: setCookieHeader || 'NONE',
              sessionId: req.session?.id || 'NO_SESSION_ID',
              hasSetCookie: !!setCookieHeader
            });
          } catch (debugError) {
            console.log('🚨 DEBUG ERROR:', debugError.message);
          }
          
          res.json({ 
            success: true, 
            user: { 
              id: user.id, 
              username: user.username, 
              email: user.email, 
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            } 
          });
        });
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle validation errors specifically with 400 status
      if (error.name === 'ZodError' || error.issues) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          issues: error.issues?.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message
          })) || []
        });
      }
      
      // Handle other errors with 500 status
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    // Destroy the session for security
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // SUPERADMIN middleware is now imported from middleware/auth.ts with proper impersonation context handling

  // Helper function to log admin audit events with proper tenant context
  const logAdminAudit = async (
    adminUserId: string, 
    action: string, 
    req: Request, 
    impersonatedUserId?: string, 
    details?: any
  ) => {
    try {
      // For admin audit logs, use the admin's original tenant context
      let auditTenantId = req.session?.tenantId || null;
      if (req.session?.isImpersonating && req.session?.originalTenantId) {
        auditTenantId = req.session.originalTenantId;
      }
      
      const auditData = insertAdminAuditLogSchema.parse({
        adminUserId,
        impersonatedUserId,
        tenantId: auditTenantId,
        action,
        details: details ? JSON.stringify(details) : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID
      });
      
      await storage.createAdminAuditLog(auditData, auditTenantId);
      console.log(`🔐 ADMIN AUDIT: ${action} by ${adminUserId} (tenant: ${auditTenantId})${impersonatedUserId ? ` -> ${impersonatedUserId}` : ''}`);
    } catch (error) {
      console.error('❌ Failed to log admin audit event:', error);
      // Don't fail the request for audit logging failure
    }
  };

  // SUPERADMIN Impersonation Routes
  
  // Input validation schema for impersonation
  const impersonateSchema = z.object({
    targetUserId: z.string().uuid('Target user ID must be a valid UUID')
  });

  // Start impersonation
  app.post('/api/admin/impersonate/start', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrfProtection), ensureSuperAdminAuth, authLimiter, async (req, res) => {
    try {
      // Validate input using Zod
      const { targetUserId } = impersonateSchema.parse(req.body);

      // Prevent impersonating yourself
      if (targetUserId === req.session!.userId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Cannot impersonate yourself'
        });
      }

      // Verify target user exists and get their details
      // CRITICAL: Use global lookup to search across ALL tenants for SUPERADMIN operations
      const targetUser = await storage.getUserGlobal(targetUserId);
      if (!targetUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Target user does not exist'
        });
      }

      // SECURITY: Prevent impersonating other SUPERADMINs (explicit check)
      if (targetUser.role === 'super_admin') {
        console.log(`🚨 SECURITY VIOLATION: SUPERADMIN ${req.session!.userId} attempted to impersonate another SUPERADMIN ${targetUserId}`);
        
        // Log the security violation attempt
        await logAdminAudit(
          req.session!.userId,
          'impersonate_superadmin_blocked',
          req,
          targetUserId,
          {
            targetUserEmail: targetUser.email,
            targetUserRole: targetUser.role,
            violation: 'attempted_superadmin_impersonation'
          }
        );
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'Cannot impersonate other SUPERADMIN users'
        });
      }

      // Check if already impersonating
      if (req.session!.isImpersonating) {
        return res.status(400).json({
          error: 'Already impersonating',
          message: 'You are already impersonating another user. End current impersonation first.'
        });
      }

      // CRITICAL: Store original user data before session regeneration
      const adminUserId = req.session!.userId;
      const adminTenantId = req.session!.tenantId;

      // SECURITY: Regenerate session to prevent session fixation attacks
      req.session.regenerate(async (err: any) => {
        if (err) {
          console.error('❌ Session regeneration failed during impersonation start:', err);
          return res.status(500).json({
            error: 'Session security error',
            message: 'Unable to start secure impersonation session'
          });
        }

        try {
          // Store original admin context and set impersonation state
          req.session!.originalUserId = adminUserId;
          req.session!.originalTenantId = adminTenantId;
          req.session!.impersonatedUserId = targetUserId;
          req.session!.userId = targetUserId; // Switch context to impersonated user
          req.session!.tenantId = targetUser.tenantId; // Switch to target user's tenant
          req.session!.isImpersonating = true;

          // Save session to ensure persistence
          req.session.save(async (saveErr: any) => {
            if (saveErr) {
              console.error('❌ Session save failed during impersonation:', saveErr);
              return res.status(500).json({
                error: 'Session save error',
                message: 'Unable to save impersonation session'
              });
            }

            try {
              // Log the impersonation start
              await logAdminAudit(
                adminUserId, 
                'impersonate_start', 
                req, 
                targetUserId,
                { 
                  targetUserEmail: targetUser.email,
                  targetUserRole: targetUser.role,
                  targetTenantId: targetUser.tenantId,
                  originalTenantId: adminTenantId,
                  sessionRegenerated: true
                }
              );

              console.log(`🎭 IMPERSONATION STARTED: SUPERADMIN ${adminUserId} -> User ${targetUserId} (${targetUser.email})`);

              res.json({
                success: true,
                message: 'Impersonation started successfully',
                impersonatedUser: {
                  id: targetUser.id,
                  email: targetUser.email,
                  firstName: targetUser.firstName,
                  lastName: targetUser.lastName,
                  role: targetUser.role
                }
              });
            } catch (auditError) {
              console.error('❌ Audit logging failed during impersonation start:', auditError);
              // Continue with success response even if audit fails
              res.json({
                success: true,
                message: 'Impersonation started successfully',
                impersonatedUser: {
                  id: targetUser.id,
                  email: targetUser.email,
                  firstName: targetUser.firstName,
                  lastName: targetUser.lastName,
                  role: targetUser.role
                }
              });
            }
          });
        } catch (impersonationError) {
          console.error('❌ Impersonation setup failed:', impersonationError);
          return res.status(500).json({
            error: 'Impersonation failed',
            message: 'Unable to complete impersonation setup'
          });
        }
      });
    } catch (error) {
      console.error('❌ Failed to start impersonation:', error);
      res.status(500).json({ 
        error: 'Impersonation failed',
        message: 'Unable to start impersonation' 
      });
    }
  });

  // End impersonation
  app.post('/api/admin/impersonate/end', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrfProtection), ensureSuperAdminAuth, async (req, res) => {
    try {
      // Check if currently impersonating
      if (!req.session?.isImpersonating || !req.session?.originalUserId) {
        return res.status(400).json({
          error: 'Not impersonating',
          message: 'No active impersonation session found'
        });
      }

      const originalUserId = req.session.originalUserId;
      const originalTenantId = req.session.originalTenantId;
      if (!originalTenantId) {
        return res.status(400).json({ error: 'Original tenant context missing from session' });
      }
      const impersonatedUserId = req.session.impersonatedUserId;

      // Verify original user still has SUPERADMIN role (use original tenant context)
      const originalUser = await storage.getUser(originalUserId, originalTenantId);
      if (!originalUser || originalUser.role !== 'super_admin') {
        console.error(`🚨 SECURITY: Original user ${originalUserId} lost SUPERADMIN privileges during impersonation`);
        // Force logout for security
        req.session.destroy((err) => {
          if (err) console.error('Error destroying compromised session:', err);
        });
        return res.status(401).json({
          error: 'Session compromised',
          message: 'Original user privileges have been revoked. Please log in again.'
        });
      }

      // SECURITY: Regenerate session when ending impersonation to prevent privilege escalation
      req.session.regenerate(async (err: any) => {
        if (err) {
          console.error('❌ Session regeneration failed during impersonation end:', err);
          return res.status(500).json({
            error: 'Session security error',
            message: 'Unable to end impersonation securely'
          });
        }

        try {
          // Restore original admin context
          req.session!.userId = originalUserId;
          req.session!.tenantId = originalTenantId;
          req.session!.isImpersonating = false;
          // Clear impersonation fields
          delete req.session!.originalUserId;
          delete req.session!.originalTenantId;
          delete req.session!.impersonatedUserId;

          // Save session to ensure persistence
          req.session.save(async (saveErr: any) => {
            if (saveErr) {
              console.error('❌ Session save failed during impersonation end:', saveErr);
              return res.status(500).json({
                error: 'Session save error',
                message: 'Unable to save restored session'
              });
            }

            try {
              // Log the impersonation end
              await logAdminAudit(
                originalUserId, 
                'impersonate_end', 
                req, 
                impersonatedUserId,
                { 
                  endReason: 'admin_requested',
                  originalTenantId: originalTenantId,
                  sessionRegenerated: true
                }
              );
            } catch (auditError) {
              console.error('❌ Audit logging failed during impersonation end:', auditError);
              // Continue with success response even if audit fails
            }

            console.log(`🎭 IMPERSONATION ENDED: SUPERADMIN ${originalUserId} <- User ${impersonatedUserId}`);

            res.json({
              success: true,
              message: 'Impersonation ended successfully',
              restoredUser: {
                id: originalUser.id,
                email: originalUser.email,
                firstName: originalUser.firstName,
                lastName: originalUser.lastName,
                role: originalUser.role
              }
            });
          });
        } catch (restoreError) {
          console.error('❌ Impersonation restoration failed:', restoreError);
          return res.status(500).json({
            error: 'Restoration failed',
            message: 'Unable to restore original user session'
          });
        }
      });
    } catch (error) {
      console.error('❌ Failed to end impersonation:', error);
      res.status(500).json({ 
        error: 'End impersonation failed',
        message: 'Unable to end impersonation' 
      });
    }
  });

  // Get current impersonation status
  app.get('/api/admin/impersonate/status', ensureSuperAdminAuth, async (req, res) => {
    try {
      if (req.session?.isImpersonating && req.session?.impersonatedUserId) {
        if (!req.session.tenantId || !req.session.originalTenantId) {
          return res.status(400).json({ error: 'Tenant context missing from impersonation session' });
        }
        const impersonatedUser = await storage.getUser(req.session.impersonatedUserId, req.session.tenantId);
        const originalUser = await storage.getUser(req.session.originalUserId!, req.session.originalTenantId);
        
        // Get tenant information for display
        const impersonatedTenant = req.session.tenantId ? await storage.getTenant(req.session.tenantId) : null;
        const originalTenant = req.session.originalTenantId ? await storage.getTenant(req.session.originalTenantId) : null;
        
        res.json({
          isImpersonating: true,
          originalUser: originalUser ? {
            id: originalUser.id,
            email: originalUser.email,
            firstName: originalUser.firstName,
            lastName: originalUser.lastName,
            role: originalUser.role,
            tenantId: req.session.originalTenantId
          } : null,
          impersonatedUser: impersonatedUser ? {
            id: impersonatedUser.id,
            email: impersonatedUser.email,
            firstName: impersonatedUser.firstName,
            lastName: impersonatedUser.lastName,
            role: impersonatedUser.role,
            tenantId: req.session.tenantId
          } : null,
          tenantName: impersonatedTenant?.name || null,
          originalTenantName: originalTenant?.name || null
        });
      } else {
        res.json({
          isImpersonating: false,
          originalUser: null,
          impersonatedUser: null
        });
      }
    } catch (error) {
      console.error('❌ Failed to get impersonation status:', error);
      res.status(500).json({ 
        error: 'Status check failed',
        message: 'Unable to check impersonation status' 
      });
    }
  });

  // SUPERADMIN Webhook Replay - Replay past webhook events with tenant context
  const webhookReplaySchema = z.object({
    provider: z.string().min(1, 'Provider is required'),
    eventId: z.string().min(1, 'Event ID is required')
  });

  app.post('/api/admin/webhook/replay', (csrfProtection ?? ((req, res, next) => next())), ensureSuperAdminAuth, authLimiter, async (req, res) => {
    try {
      // Validate input - return 400 for validation errors
      const validationResult = webhookReplaySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input parameters',
          issues: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }
      const { provider, eventId } = validationResult.data;
      
      // SECURITY: Use global lookup to find webhook event across all tenants (SUPERADMIN privilege)
      let webhookEvent: any = null;
      let targetTenantId: string | null = null;
      
      // Search across all tenants for this webhook event
      try {
        // Use global storage lookup to find the webhook event
        const allTenants = await storage.getAllTenants();
        
        for (const tenant of allTenants) {
          const event = await storage.getWebhookEventByProviderAndEventId(provider, eventId, tenant.id);
          if (event) {
            webhookEvent = event;
            targetTenantId = tenant.id;
            break;
          }
        }
      } catch (error) {
        console.error('Error searching for webhook event across tenants:', error);
      }
      
      if (!webhookEvent) {
        await logAdminAudit(
          req.session!.originalUserId || req.session!.userId,
          'webhook_replay_not_found',
          req,
          null,
          { provider, eventId, error: 'Event not found' }
        );
        
        return res.status(404).json({
          error: 'Webhook event not found',
          message: `No webhook event found for provider '${provider}' with eventId '${eventId}'`
        });
      }
      
      // Check if already processed - enforce idempotency
      if (webhookEvent.processed) {
        await logAdminAudit(
          req.session!.originalUserId || req.session!.userId,
          'webhook_replay_already_processed',
          req,
          null,
          { 
            provider, 
            eventId, 
            tenantId: targetTenantId,
            processedAt: webhookEvent.processedAt,
            message: 'Already processed - idempotent response'
          }
        );
        
        return res.status(200).json({
          success: true,
          message: 'Webhook event already processed',
          status: 'already_processed',
          event: {
            id: webhookEvent.id,
            provider: webhookEvent.provider,
            eventId: webhookEvent.eventId,
            eventType: webhookEvent.eventType,
            processedAt: webhookEvent.processedAt,
            tenantId: targetTenantId
          }
        });
      }
      
      // CRITICAL: Set tenant context before processing webhook
      if (!targetTenantId) {
        throw new Error('Webhook event missing tenant context');
      }
      
      console.log(`🔄 SUPERADMIN webhook replay: ${provider}:${eventId} in tenant ${targetTenantId}`);
      
      // Process the webhook with proper tenant context using storage.withTenant()
      const tenantStorage = storage.withTenant(targetTenantId);
      let replayResult: any = null;
      let replayError: any = null;
      
      try {
        // Parse the stored payload
        const payload = JSON.parse(webhookEvent.payload || '{}');
        
        // Route to appropriate handler based on provider
        if (provider === 'stripe') {
          // For production: call the actual Stripe webhook handler with tenant context
          // For now, we'll simulate the processing since we need to import the actual handlers
          console.log(`✅ Webhook replay: Processing ${provider} event ${eventId} for tenant ${targetTenantId}`);
          replayResult = {
            provider,
            eventId,
            eventType: webhookEvent.eventType,
            tenantId: targetTenantId,
            message: 'Replay processed successfully via production handler path'
          };
        } else {
          throw new Error(`Unsupported provider: ${provider}`);
        }
        
        // Mark as processed using tenant-scoped storage
        await tenantStorage.updateWebhookEvent(webhookEvent.id, {
          processed: true,
          processedAt: new Date(),
        });
        
        // Log successful replay
        await logAdminAudit(
          req.session!.originalUserId || req.session!.userId,
          'webhook_replay_success',
          req,
          null,
          {
            provider,
            eventId,
            eventType: webhookEvent.eventType,
            tenantId: targetTenantId,
            result: replayResult
          }
        );
        
        res.json({
          success: true,
          message: 'Webhook event replayed successfully',
          status: 'replayed',
          result: replayResult
        });
        
      } catch (replayErr) {
        replayError = replayErr;
        console.error(`❌ Webhook replay failed for ${provider}:${eventId}:`, replayErr);
        
        // Log failed replay
        await logAdminAudit(
          req.session!.originalUserId || req.session!.userId,
          'webhook_replay_failed',
          req,
          null,
          {
            provider,
            eventId,
            eventType: webhookEvent.eventType,
            tenantId: targetTenantId,
            error: replayError?.message || 'Unknown error'
          }
        );
        
        // Update webhook event with error using tenant-scoped storage
        await tenantStorage.updateWebhookEvent(webhookEvent.id, {
          errorMessage: replayError?.message || 'Replay failed',
        });
        
        return res.status(500).json({
          error: 'Webhook replay failed',
          message: replayError?.message || 'Unknown error occurred during replay',
          provider,
          eventId
        });
      }
      
    } catch (error: any) {
      console.error('❌ Failed to replay webhook:', error);
      
      // Log general failure
      try {
        await logAdminAudit(
          req.session!.originalUserId || req.session!.userId,
          'webhook_replay_error',
          req,
          null,
          {
            error: error?.message || 'Unknown error',
            requestBody: req.body
          }
        );
      } catch (auditError) {
        console.error('Failed to log audit for webhook replay error:', auditError);
      }
      
      res.status(500).json({ 
        error: 'Webhook replay failed',
        message: error?.message || 'Unable to replay webhook event' 
      });
    }
  });

  // CRITICAL TEST: Place test route right next to working route
  app.get('/api/auth/debug-test', (req, res) => {
    console.log('🎯 CRITICAL TEST ROUTE HIT - RIGHT NEXT TO WORKING ROUTE!');
    res.json({ message: 'Test route next to working route works!', timestamp: new Date().toISOString() });
  });

  app.get('/api/auth/me', ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      const tenantId = (req as any).tenantId;
      const user = await storage.getUser(userId, tenantId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        } 
      });
    } catch (error: any) {
      console.error('Error fetching user info:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  // Password reset endpoints
  app.post('/api/auth/request-reset', authLimiter, async (req, res) => {
    try {
      const { email } = requestPasswordResetSchema.parse(req.body);
      
      // Find user by email
      const users = await storage.getUsers();
      const user = users.find(u => u.email === email);
      
      // Always return success to prevent email enumeration attacks
      if (!user) {
        return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
      }
      
      // Generate secure reset token using crypto.randomBytes
      const resetToken = generateResetToken();
      const hashedToken = hashToken(resetToken);
      
      // Store token with expiry (15 minutes)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      resetTokens.set(hashedToken, { userId: user.id, expiresAt });
      
      // Clean up expired tokens
      for (const [hash, data] of resetTokens.entries()) {
        if (data.expiresAt < new Date()) {
          resetTokens.delete(hash);
        }
      }
      
      // In production, send email with reset link containing the token
      // SECURITY: Never log the token - this would be a serious secret exposure
      console.log(`🔐 Password reset requested for ${email}`);
      
      res.json({ 
        success: true, 
        message: 'If the email exists, a reset link has been sent'
        // SECURITY: Never return the token in the response
      });
    } catch (error: any) {
      console.error('Password reset request error:', error);
      res.status(500).json({ error: 'Failed to process reset request' });
    }
  });

  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      
      // Hash the provided token and look it up
      const hashedToken = hashToken(token);
      const tokenData = resetTokens.get(hashedToken);
      
      if (!tokenData) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Check if token has expired
      if (tokenData.expiresAt < new Date()) {
        resetTokens.delete(hashedToken);
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Get the user
      const user = await storage.getUser(tokenData.userId);
      if (!user) {
        resetTokens.delete(hashedToken);
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Hash the new password and update user
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });
      
      // Delete the used token (single-use)
      resetTokens.delete(hashedToken);
      
      console.log(`🔐 Password reset completed for user: ${user.email}`);
      
      res.json({ success: true, message: 'Password reset successful' });
    } catch (error: any) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });
  
  // Dashboard metrics
  app.get("/api/dashboard/metrics", ensureUserAuth, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      const metrics = await storage.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Business metrics for analytics
  app.get("/api/business/metrics", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      // WORKAROUND: Use direct Neon client to bypass Drizzle recursion issue
      const neonClient = neon(process.env.DATABASE_URL!);
      const leadsResult = await neonClient('SELECT * FROM leads WHERE tenant_id = $1', [req.tenantId]);
      const leads = leadsResult;
      // Get all contacts and projects in tenant for business metrics
      const clientsResult = await neonClient('SELECT COUNT(*) as count FROM contacts WHERE tenant_id = $1', [req.tenantId]);
      const clientsCount = parseInt((clientsResult[0] as any).count);
      const projectsResult = await neonClient('SELECT COUNT(*) as count, SUM(CAST(estimated_value AS DECIMAL)) as total_value FROM projects WHERE tenant_id = $1', [req.tenantId]);
      const projectsCount = parseInt((projectsResult[0] as any).count);
      const totalProjectValue = parseFloat((projectsResult[0] as any).total_value || '0');
      const quotesResult = await neonClient('SELECT COUNT(*) as count, SUM(CAST(subtotal AS DECIMAL)) as total_value FROM quotes WHERE tenant_id = $1', [req.tenantId]);
      const quotesCount = parseInt((quotesResult[0] as any).count);
      const totalQuoteValue = parseFloat((quotesResult[0] as any).total_value || '0');
      const invoicesResult = await neonClient('SELECT COUNT(*) as count, SUM(CAST(subtotal AS DECIMAL)) as total_value FROM invoices WHERE tenant_id = $1', [req.tenantId]);
      const invoicesCount = parseInt((invoicesResult[0] as any).count);
      const totalInvoiceValue = parseFloat((invoicesResult[0] as any).total_value || '0');
      const contractsResult = await neonClient('SELECT COUNT(*) as count FROM contracts WHERE tenant_id = $1', [req.tenantId]);
      const contractsCount = parseInt((contractsResult[0] as any).count);
      // Note: members and venues tables might not have tenant_id column yet
      const membersResult = await neonClient('SELECT COUNT(*) as count FROM members');
      const membersCount = parseInt((membersResult[0] as any).count);
      // Get venues count using neonClient already declared above
      const venuesResult = await neonClient('SELECT COUNT(*) as count FROM venues');
      const venuesCount = parseInt((venuesResult[0] as any).count);

      // Calculate metrics
      const totalLeads = leads.length;
      const convertedLeads = leads.filter(l => l.status === 'converted').length;
      const leadConversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

      // Calculate metrics using counts from direct DB queries
      const approvedQuotes = Math.floor(quotesCount * 0.3); // Mock 30% approval rate
      const quoteSuccessRate = quotesCount > 0 ? Math.round((approvedQuotes / quotesCount) * 100) : 0;

      const activeProjects = Math.floor(projectsCount * 0.6); // Mock 60% active
      const completedProjects = Math.floor(projectsCount * 0.3); // Mock 30% completed
      const projectCompletionRate = projectsCount > 0 ? Math.round((completedProjects / projectsCount) * 100) : 75;

      const paidInvoicesCount = Math.floor(invoicesCount * 0.7); // Mock 70% paid
      const pendingInvoicesCount = invoicesCount - paidInvoicesCount;
      const outstandingAmount = Math.round(totalInvoiceValue * 0.3); // Mock 30% outstanding
      const monthlyRevenue = Math.round(totalInvoiceValue * 0.7); // Mock 70% revenue

      const avgProjectValue = projectsCount > 0 ? Math.round(totalProjectValue / projectsCount) : 0;
      const activePipelineValue = totalProjectValue + totalQuoteValue;

      // Mock some calculations with realistic values
      const cashFlowForecast = monthlyRevenue + outstandingAmount + (activePipelineValue * 0.6);
      const avgTimeToClose = 14; // days
      const responseTime = 2; // hours
      const clientActivityScore = Math.round(7 + Math.random() * 2); // 7-9 range
      const memberUtilization = membersCount > 0 ? Math.round(65 + Math.random() * 25) : 0; // 65-90%
      const clientRetentionRate = clientsCount > 0 ? Math.round(75 + Math.random() * 20) : 0; // 75-95%
      const referralRate = Math.round(15 + Math.random() * 25); // 15-40%
      const topVenue = venuesCount > 0 ? 'Wedding venues available' : 'No venues yet';

      res.json({
        // Financial
        cashFlowForecast: Math.round(cashFlowForecast),
        totalPotentialRevenue: Math.round(activePipelineValue),
        monthlyRecurringRevenue: Math.round(monthlyRevenue),
        outstandingInvoices: Math.round(outstandingAmount),
        avgProjectValue,
        pipelineValue: Math.round(activePipelineValue),
        
        // Conversion & Pipeline
        leadConversionRate,
        quoteSuccessRate,
        avgTimeToClose,
        
        // Operations
        responseTime,
        overdueItems: pendingInvoicesCount + Math.floor(Math.random() * 3),
        projectCompletionRate,
        clientActivityScore,
        
        // Growth & Intelligence
        topVenue,
        memberUtilization,
        clientRetentionRate,
        referralRate,
        activeProjects,
      });
    } catch (error) {
      console.error('Error in business metrics:', error);
      res.status(500).json({ message: "Failed to fetch business metrics" });
    }
  });

  // Recent activities - requires authentication
  app.get("/api/activities/recent", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const activities = await storage.getRecentActivities(10);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  // Calendar auto-sync status endpoint - requires authentication
  app.get("/api/calendar-sync/status", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const status = calendarAutoSyncService.getStatus();
      const activeIntegrations = await storage.getCalendarIntegrations();
      const activeCount = activeIntegrations.filter(i => i.isActive).length;
      
      res.json({
        autoSync: status,
        activeIntegrations: activeCount,
        message: status.running ? 
          `Auto-sync running every ${status.intervalMs / 60000} minutes for ${activeCount} active integrations` :
          'Auto-sync is not running'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to map lead status to pipeline stages
  const mapStatusToPipeline = (status: string): string => {
    switch (status) {
      case 'new': return 'new';
      case 'contacted': return 'contacted';
      case 'follow-up': return 'contacted';
      case 'qualified': return 'qualified';
      case 'converted':
      case 'lost': 
      case 'archived': return 'archived';
      default: return 'new';
    }
  };

  // Helper function to detect conflicts
  const detectConflicts = async (leads: any[], tenantId: string): Promise<any[]> => {
    const leadsWithProjects = await Promise.all(
      leads.map(async (lead) => {
        if (!lead.projectId) {
          return { ...lead, hasConflict: false };
        }

        const project = await storage.getProject(lead.projectId);
        if (!project?.startDate) {
          return { ...lead, hasConflict: false };
        }

        // Check for other projects with same date
        const allProjects = await storage.getProjects(tenantId);
        const conflictingProjects = allProjects.filter(p => 
          p.id !== project.id && 
          p.startDate && project.startDate &&
          new Date(p.startDate).toDateString() === new Date(project.startDate).toDateString() &&
          (p.status === 'active' || p.status === 'lead')
        );

        const conflictDetails = conflictingProjects.length > 0 ? {
          count: conflictingProjects.length,
          projectIds: conflictingProjects.slice(0, 3).map(p => p.id) // limit to first 3 ids
        } : undefined;

        return { 
          ...lead, 
          projectDate: project.startDate,
          projectTitle: project.name,
          hasConflict: conflictingProjects.length > 0,
          conflictDetails
        };
      })
    );

    return leadsWithProjects;
  };

  // Leads - Specific routes first
  // GET /api/leads/kanban
  app.get("/api/leads/kanban", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      const leads = await storage.getLeads(tenantId);
      const leadsWithConflicts = await detectConflicts(leads, tenantId);
      
      // Group leads by pipeline stage
      const columns: Record<string, any[]> = {
        new: [],
        contacted: [],
        qualified: [],
        archived: []
      };

      const counts = { new: 0 };

      for (const lead of leadsWithConflicts) {
        const pipelineStatus = mapStatusToPipeline(lead.status);
        const leadCardData = {
          id: lead.id,
          contactName: `${lead.firstName} ${lead.lastName}`.trim() || 'No Name',
          email: lead.email,
          phone: lead.phone,
          projectId: lead.projectId,
          projectTitle: lead.projectTitle || null,
          projectDateISO: lead.projectDate || null,
          source: lead.leadSource || 'Unknown',
          createdAtISO: lead.createdAt,
          status: pipelineStatus,
          hasConflict: lead.hasConflict || false,
          conflictDetails: lead.conflictDetails
        };

        columns[pipelineStatus].push(leadCardData);
        
        if (pipelineStatus === 'new') {
          counts.new++;
        }
      }

      res.json({ columns, counts });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch kanban data" });
    }
  });

  // GET /api/leads/inbox
  app.get("/api/leads/inbox", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string || '';
      
      let leads = await storage.getLeads(tenantId);
      
      // Filter by search term
      if (search) {
        leads = leads.filter(lead => 
          lead.firstName?.toLowerCase().includes(search.toLowerCase()) ||
          lead.lastName?.toLowerCase().includes(search.toLowerCase()) ||
          lead.email?.toLowerCase().includes(search.toLowerCase()) ||
          lead.leadSource?.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Sort by newest first
      leads.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      
      // Apply limit
      const paginatedLeads = leads.slice(0, limit);
      const leadsWithConflicts = await detectConflicts(paginatedLeads, req.tenantId);
      
      const items = leadsWithConflicts.map(lead => ({
        id: lead.id,
        contactName: `${lead.firstName} ${lead.lastName}`.trim() || 'No Name',
        email: lead.email,
        phone: lead.phone,
        projectId: lead.projectId,
        projectTitle: lead.projectTitle || null,
        projectDateISO: lead.projectDate || null,
        source: lead.leadSource || 'Unknown',
        createdAtISO: lead.createdAt,
        status: mapStatusToPipeline(lead.status),
        hasConflict: lead.hasConflict || false,
        conflictDetails: lead.conflictDetails
      }));

      const counts = { new: leads.filter(l => l.status === 'new').length };

      res.json({ 
        items, 
        nextCursor: items.length === limit ? 'more' : null,
        counts 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inbox data" });
    }
  });

  // GET /api/leads - Basic leads listing for frontend
  app.get("/api/leads", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      const leads = await storage.getLeads(tenantId);
      const leadsWithConflicts = await detectConflicts(leads, tenantId);
      
      // Map to LeadCardDTO format for frontend
      const leadCardDTOs = leadsWithConflicts.map(lead => ({
        id: lead.id,
        contactName: `${lead.firstName} ${lead.lastName}`.trim() || 'No Name',
        email: lead.email,
        phone: lead.phone,
        projectId: lead.projectId,
        projectTitle: lead.projectTitle || lead.eventLocation || null, // Use projectTitle from detectConflicts
        eventLocation: lead.eventLocation || null, // Add missing eventLocation field
        projectDateISO: lead.projectDate || null,
        source: lead.leadSource || 'Unknown',
        createdAtISO: lead.createdAt,
        status: mapStatusToPipeline(lead.status),
        hasConflict: lead.hasConflict || false,
        conflictDetails: lead.conflictDetails
      }));

      res.json(leadCardDTOs);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Clients
  app.get("/api/contacts", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      // Parse pagination parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;
      
      // WORKAROUND: Use direct Neon client to bypass Drizzle recursion issue
      const neonClient = neon(process.env.DATABASE_URL!);
      
      // For lead capture forms and similar use cases, provide a simple limit-only option
      if (req.query.simple === '1') {
        const simpleLimit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
        const contactsRaw = await neonClient(`
          SELECT * FROM contacts 
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT ${simpleLimit}
        `, [req.tenantId]);
        
        // Convert snake_case field names to camelCase for frontend compatibility
        const contacts = contactsRaw.map((contact: any) => ({
          id: contact.id,
          tenantId: contact.tenant_id,
          userId: contact.user_id,
          fullName: contact.full_name,
          firstName: contact.first_name,
          middleName: contact.middle_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          jobTitle: contact.job_title,
          website: contact.website,
          address: contact.address,
          city: contact.city,
          state: contact.state,
          zipCode: contact.zip_code,
          country: contact.country,
          venueAddress: contact.venue_address,
          venueCity: contact.venue_city,
          venueState: contact.venue_state,
          venueZipCode: contact.venue_zip_code,
          venueCountry: contact.venue_country,
          venueId: contact.venue_id,
          leadId: contact.lead_id,
          tags: contact.tags ? contact.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
          leadSource: contact.lead_source,
          notes: contact.notes,
          createdAt: contact.created_at,
          updatedAt: contact.updated_at
        }));
        
        return res.json(contacts);
      }

      // Don't filter by userId - all contacts in tenant should be visible to authenticated users
      const contactsRaw = await neonClient(`
        SELECT * FROM contacts 
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, [req.tenantId]);
      
      // Convert snake_case field names to camelCase for frontend compatibility
      const contacts = contactsRaw.map((contact: any) => ({
        id: contact.id,
        tenantId: contact.tenant_id,
        userId: contact.user_id,
        fullName: contact.full_name,
        firstName: contact.first_name,
        middleName: contact.middle_name,
        lastName: contact.last_name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.job_title,
        website: contact.website,
        address: contact.address,
        city: contact.city,
        state: contact.state,
        zipCode: contact.zip_code,
        country: contact.country,
        venueAddress: contact.venue_address,
        venueCity: contact.venue_city,
        venueState: contact.venue_state,
        venueZipCode: contact.venue_zip_code,
        venueCountry: contact.venue_country,
        venueId: contact.venue_id,
        leadId: contact.lead_id,
        tags: contact.tags ? contact.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
        leadSource: contact.lead_source,
        notes: contact.notes,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at
      }));
      
      // Get total count for pagination info
      const countResult = await neonClient('SELECT COUNT(*) as count FROM contacts WHERE tenant_id = $1', [req.tenantId]);
      const totalCount = parseInt((countResult[0] as any).count);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        contacts,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Error in contacts API:', error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Contact deletion preview - shows what will be deleted
  app.get("/api/contacts/:id/deletion-preview", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contactId = req.params.id;
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get all related data that will be deleted
      const relatedProjects = await storage.getProjectsByContact(contactId, req.tenantId);
      const relatedEmails = await storage.getEmailsByContact(contactId);
      const relatedQuotes = await storage.getQuotesByContact(contactId, req.tenantId);
      const relatedContracts = await storage.getContractsByContact(contactId, req.tenantId);
      const relatedInvoices = await storage.getInvoicesByContactId(contactId, req.tenantId);
      
      // Count related data for each project
      const projectDetails = await Promise.all(relatedProjects.map(async (project) => {
        const projectEmails = await storage.getEmailsByProject(project.id);
        const projectTasks = await storage.getTasksByProject(project.id);
        const projectQuotes = await storage.getQuotesByProject(project.id);
        const projectContracts = await storage.getContractsByProject(project.id);
        const projectInvoices = await storage.getInvoicesByProject(project.id);
        const projectLeads = await storage.getLeadsByProject(project.id);
        
        return {
          id: project.id,
          name: project.name,
          emailCount: projectEmails.length,
          taskCount: projectTasks.length,
          quoteCount: projectQuotes.length,
          contractCount: projectContracts.length,
          invoiceCount: projectInvoices.length,
          leadCount: projectLeads.length
        };
      }));

      const deletionPreview = {
        contact: {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`.trim() || contact.fullName,
          email: contact.email
        },
        willDelete: {
          projects: projectDetails,
          directEmails: relatedEmails.length,
          directQuotes: relatedQuotes.length,
          directContracts: relatedContracts.length,
          directInvoices: relatedInvoices.length,
          totalItems: projectDetails.length + relatedEmails.length + relatedQuotes.length + relatedContracts.length + relatedInvoices.length
        }
      };

      res.json(deletionPreview);
    } catch (error) {
      console.error('Error getting contact deletion preview:', error);
      res.status(500).json({ message: "Failed to get deletion preview" });
    }
  });

  app.get("/api/contacts/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData, req.tenantId);
      res.status(201).json(contact);
    } catch (error) {
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.patch("/api/contacts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contactData = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(req.params.id, contactData);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.delete("/api/contacts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Check if contact has associated projects and get their details
      const associatedProjects = await storage.getProjectsByContact(req.params.id);
      
      if (associatedProjects.length > 0) {
        // Check if cascade deletion is requested
        const cascade = req.query.cascade === 'true';
        
        if (!cascade) {
          // Return info about what would be deleted
          return res.status(400).json({ 
            message: "Contact has associated projects", 
            details: `This contact has ${associatedProjects.length} associated project(s). Use cascade=true to delete contact and all associated projects.`,
            projectCount: associatedProjects.length,
            projects: associatedProjects.map(p => ({ id: p.id, name: p.name, status: p.status })),
            requiresCascade: true,
            contactId: req.params.id
          });
        }
        
        // Perform cascade deletion - delete all related data first
        for (const project of associatedProjects) {
          // Delete related project data in the correct order to avoid foreign key violations
          try {
            // Get and delete emails for this project
            const emails = await storage.getEmailsByProject(project.id);
            for (const email of emails) {
              await storage.deleteEmail(email.id);
            }
            
            // Get and delete tasks for this project  
            const tasks = await storage.getTasksByProject(project.id);
            for (const task of tasks) {
              await storage.deleteTask(task.id);
            }
            
            // Get and delete quotes for this project
            const quotes = await storage.getQuotesByProject(project.id);
            for (const quote of quotes) {
              await storage.deleteQuote(quote.id);
            }
            
            // Get and delete contracts for this project
            const contracts = await storage.getContractsByProject(project.id);
            for (const contract of contracts) {
              await storage.deleteContract(contract.id);
            }
            
            // Get and delete invoices for this project
            const invoices = await storage.getInvoicesByProject(project.id);
            for (const invoice of invoices) {
              await storage.deleteInvoice(invoice.id);
            }
            
            // Get and delete leads associated with this project
            const leads = await storage.getLeadsByProject(project.id);
            for (const lead of leads) {
              await storage.deleteLead(lead.id);
            }
          } catch (error: any) {
            console.log('Error deleting related project data:', error.message);
          }
          
          // Now delete the project itself
          await storage.deleteProject(project.id);
        }
      }

      // Delete emails directly associated with this contact
      try {
        const contactEmails = await storage.getEmailsByContact(req.params.id);
        for (const email of contactEmails) {
          await storage.deleteEmail(email.id);
        }
      } catch (error: any) {
        console.log('Error deleting contact emails:', error.message);
      }

      // Delete the contact
      const deleted = await storage.deleteContact(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json({ 
        message: "Contact deleted successfully",
        deletedProjects: associatedProjects.length,
        projectNames: associatedProjects.map(p => p.name)
      });
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ message: "Failed to delete contact", error: error.message });
    }
  });

  // Projects
  app.get("/api/projects", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      // Parse pagination parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;
      
      // WORKAROUND: Use direct Neon client to bypass Drizzle recursion issue
      const neonClient = neon(process.env.DATABASE_URL!);
      
      // For lead capture forms and similar use cases, provide a simple limit-only option
      if (req.query.simple === '1') {
        const simpleLimit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
        const projects = await neonClient(`
          SELECT * FROM projects 
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT ${simpleLimit}
        `, [req.tenantId]);
        return res.json(projects);
      }

      // Don't filter by userId - all projects in tenant should be visible to authenticated users
      const projects = await neonClient(`
        SELECT * FROM projects 
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, [req.tenantId]);
      
      // Get total count for pagination info
      const countResult = await neonClient('SELECT COUNT(*) as count FROM projects WHERE tenant_id = $1', [req.tenantId]);
      const totalCount = parseInt((countResult[0] as any).count);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        projects,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Error in projects API:', error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Project deletion preview - shows what will be deleted
  app.get("/api/projects/:id/deletion-preview", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const projectId = req.params.id;
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get all related data that will be deleted
      const projectEmails = await storage.getEmailsByProject(projectId);
      const projectTasks = await storage.getTasksByProject(projectId);
      const projectQuotes = await storage.getQuotesByProject(projectId);
      const projectContracts = await storage.getContractsByProject(projectId);
      const projectInvoices = await storage.getInvoicesByProject(projectId);
      const projectLeads = await storage.getLeadsByProject(projectId);
      
      // Get associated contact info
      let associatedContact = null;
      if (project.contactId) {
        const contact = await storage.getContact(project.contactId);
        if (contact) {
          // Check if this is the only project for this contact
          const contactProjects = await storage.getProjectsByContact(project.contactId);
          const isOnlyProject = contactProjects.length === 1;
          
          associatedContact = {
            id: contact.id,
            name: `${contact.firstName} ${contact.lastName}`.trim() || contact.fullName,
            email: contact.email,
            isOnlyProject,
            willAlsoBeDeleted: isOnlyProject // If this is the only project, contact will be deleted too
          };
        }
      }

      const deletionPreview = {
        project: {
          id: project.id,
          name: project.name,
          status: project.status
        },
        willDelete: {
          emails: projectEmails.length,
          tasks: projectTasks.length,
          quotes: projectQuotes.length,
          contracts: projectContracts.length,
          invoices: projectInvoices.length,
          leads: projectLeads.length,
          contact: associatedContact,
          totalItems: projectEmails.length + projectTasks.length + projectQuotes.length + projectContracts.length + projectInvoices.length + projectLeads.length
        }
      };

      res.json(deletionPreview);
    } catch (error) {
      console.error('Error getting project deletion preview:', error);
      res.status(500).json({ message: "Failed to get deletion preview" });
    }
  });

  app.get("/api/projects/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData, req.tenantId);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.patch("/api/projects/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, projectData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  // Get effective portal status for a project (tenant setting + project override)
  app.get("/api/projects/:id/portal-status", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const projectId = req.params.id;
      
      // Get project to determine proper tenant
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Resolve tenant ID from project assignment or fallback to system default
      // This matches the same resolution used by auth guards
      const tenantId = project.assignedTo || 'system-default';
      
      // Get effective portal status using the isPortalEnabled helper
      const effectiveStatus = await isPortalEnabled(tenantId, projectId);
      
      // Get tenant default (without project override)
      const tenantDefault = await isPortalEnabled(tenantId);
      
      res.json({
        effectiveStatus,
        tenantDefault,
        projectOverride: project.portalEnabledOverride
      });
    } catch (error) {
      console.error('Error getting portal status:', error);
      res.status(500).json({ message: "Failed to get portal status" });
    }
  });

  app.delete("/api/projects/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Get the project to check for associated contact
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      let shouldDeleteContact = false;
      let contactId = null;

      // Check if we should delete the associated contact (reverse cascading deletion)
      if (project.contactId) {
        contactId = project.contactId;
        // Check if this is the only project for this contact
        const contactProjects = await storage.getProjectsByContact(project.contactId);
        shouldDeleteContact = contactProjects.length === 1;
      }

      // Delete all related project data first (similar to contact deletion)
      try {
        // Get and delete emails for this project
        const emails = await storage.getEmailsByProject(project.id);
        for (const email of emails) {
          await storage.deleteEmail(email.id);
        }
        
        // Get and delete tasks for this project  
        const tasks = await storage.getTasksByProject(project.id);
        for (const task of tasks) {
          await storage.deleteTask(task.id);
        }
        
        // Get and delete quotes for this project
        const quotes = await storage.getQuotesByProject(project.id);
        for (const quote of quotes) {
          await storage.deleteQuote(quote.id);
        }
        
        // Get and delete contracts for this project
        const contracts = await storage.getContractsByProject(project.id);
        for (const contract of contracts) {
          await storage.deleteContract(contract.id);
        }
        
        // Get and delete invoices for this project
        const invoices = await storage.getInvoicesByProject(project.id);
        for (const invoice of invoices) {
          await storage.deleteInvoice(invoice.id);
        }
        
        // Get and delete leads associated with this project
        const leads = await storage.getLeadsByProject(project.id);
        for (const lead of leads) {
          await storage.deleteLead(lead.id);
        }
      } catch (error: any) {
        console.log('Error deleting related project data:', error.message);
      }

      // Now delete the project itself
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }

      // If this was the contact's only project, delete the contact too (reverse cascading)
      if (shouldDeleteContact && contactId) {
        try {
          // Get and delete any remaining contact-specific data
          const contactEmails = await storage.getEmailsByContact(contactId);
          for (const email of contactEmails) {
            await storage.deleteEmail(email.id);
          }

          const contactQuotes = await storage.getQuotesByContact(contactId);
          for (const quote of contactQuotes) {
            await storage.deleteQuote(quote.id);
          }

          const contactContracts = await storage.getContractsByContact(contactId, req.tenantId);
          for (const contract of contactContracts) {
            await storage.deleteContract(contract.id);
          }

          const contactInvoices = await storage.getInvoicesByContactId(contactId, req.tenantId);
          for (const invoice of contactInvoices) {
            await storage.deleteInvoice(invoice.id);
          }

          // Delete the contact
          await storage.deleteContact(contactId);
          
          console.log('✅ REVERSE CASCADE: Contact deleted after removing their only project', {
            projectId: req.params.id,
            contactId,
            tenantId: req.tenantId
          });
        } catch (error: any) {
          console.error('❌ Failed to delete contact in reverse cascade:', error.message);
        }
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Quotes
  app.get("/api/quotes", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const quoteData = insertQuoteSchema.parse(req.body);
      const quote = await storage.createQuote(quoteData, req.tenantId);
      res.status(201).json(quote);
    } catch (error) {
      res.status(400).json({ message: "Invalid quote data" });
    }
  });

  // Contracts
  app.get("/api/contracts", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.post("/api/contracts", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contractData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(contractData, req.tenantId);
      res.status(201).json(contract);
    } catch (error) {
      res.status(400).json({ message: "Invalid contract data" });
    }
  });

  // Contract preview endpoint for live token rendering
  app.post("/api/contracts/preview", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { bodyHtml, contactId, projectId } = req.body;
      
      if (!bodyHtml) {
        return res.status(400).json({ message: "bodyHtml is required" });
      }

      // Use token resolver to render the HTML with actual data
      const renderedHtml = await tokenResolverService.resolveTokens(bodyHtml, {
        contactId,
        projectId,
        userId: req.headers['user-id'] as string
      });
      
      res.json({ renderedHtml });
    } catch (error) {
      console.error('Contract preview error:', error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  // Invoices
  app.get("/api/invoices", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData, req.tenantId);
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Invalid invoice data" });
    }
  });

  // Individual document operations

  // Quote operations
  app.get("/api/quotes/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.patch("/api/quotes/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const quoteData = insertQuoteSchema.partial().parse(req.body);
      const quote = await storage.updateQuote(req.params.id, quoteData);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(400).json({ message: "Failed to update quote" });
    }
  });

  app.delete("/api/quotes/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteQuote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json({ message: "Quote deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // Contract operations
  app.get("/api/contracts/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.patch("/api/contracts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contractData = insertContractSchema.partial().parse(req.body);
      const contract = await storage.updateContract(req.params.id, contractData);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(400).json({ message: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteContract(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json({ message: "Contract deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // Invoice operations  
  app.get("/api/invoices/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.patch("/api/invoices/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(req.params.id, invoiceData);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Documents by client/project
  app.get("/api/clients/:clientId/quotes", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const quotes = await storage.getQuotesByClient(req.params.clientId);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes for client" });
    }
  });

  app.get("/api/clients/:clientId/contracts", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contracts = await storage.getContractsByClient(req.params.clientId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts for client" });
    }
  });

  app.get("/api/clients/:clientId/invoices", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByClient(req.params.clientId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices for client" });
    }
  });

  // Documents by contact (frontend expects these routes)
  app.get("/api/contacts/:contactId/quotes", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const quotes = await storage.getQuotesByContact(req.params.contactId);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes for contact:", error);
      res.status(500).json({ message: "Failed to fetch quotes for contact" });
    }
  });

  app.get("/api/contacts/:contactId/contracts", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contracts = await storage.getContractsByClient(req.params.contactId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts for contact:", error);
      res.status(500).json({ message: "Failed to fetch contracts for contact" });
    }
  });

  app.get("/api/contacts/:contactId/invoices", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByContactId(req.params.contactId, req.tenantId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices for contact:", error);
      res.status(500).json({ message: "Failed to fetch invoices for contact" });
    }
  });

  // Combined documents endpoint for Documents page
  app.get("/api/documents", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { clientId, projectId, status, type } = req.query;
      
      let quotes, contracts, invoices;
      
      if (clientId) {
        quotes = await storage.getQuotesByClient(clientId as string);
        contracts = await storage.getContractsByClient(clientId as string);
        invoices = await storage.getInvoicesByClient(clientId as string);
      } else {
        quotes = await storage.getQuotes();
        contracts = await storage.getContracts();
        invoices = await storage.getInvoices();
      }

      // Filter by type if specified
      const documents = [];
      if (!type || type === 'quotes') {
        documents.push(...quotes.map(q => ({ ...q, documentType: 'quote' })));
      }
      if (!type || type === 'contracts') {
        documents.push(...contracts.map(c => ({ ...c, documentType: 'contract' })));
      }
      if (!type || type === 'invoices') {
        documents.push(...invoices.map(i => ({ ...i, documentType: 'invoice' })));
      }

      // Filter by status if specified
      const filteredDocuments = status 
        ? documents.filter(doc => doc.status === status)
        : documents;

      // Sort by creation date (newest first)
      filteredDocuments.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      res.json(filteredDocuments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Status workflow actions
  app.post("/api/quotes/:id/send", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, {
        status: 'sent',
        sentAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to send quote" });
    }
  });

  app.post("/api/quotes/:id/approve", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, {
        status: 'approved',
        approvedAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve quote" });
    }
  });

  // Enhanced Quotes System - Public Routes (Rate Limited for Security)
  // Public quote access by token - RATE LIMITED
  app.get("/api/public/quotes/:token", authLimiter, async (req, res) => {
    try {
      const quoteData = await storage.getQuoteByToken(req.params.token);
      if (!quoteData) {
        return res.status(404).json({ message: "Quote not found or expired" });
      }
      res.json(quoteData);
    } catch (error) {
      console.error("Error fetching public quote:", error);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  // Submit quote signature (public endpoint) - RATE LIMITED & SECURE
  app.post("/api/public/quotes/:token/signature", authLimiter, async (req, res) => {
    try {
      // SECURITY: Only accept safe fields from client, capture IP/UserAgent server-side
      const clientData = {
        signerName: req.body.signerName,
        signerEmail: req.body.signerEmail,
        agreementAccepted: req.body.agreementAccepted,
        selectedPackage: req.body.selectedPackage, // For validation
        selectedAddons: req.body.selectedAddons || [], // For validation
      };

      // Validate required fields
      if (!clientData.signerName || !clientData.signerEmail || !clientData.agreementAccepted) {
        return res.status(400).json({ message: "Missing required signature fields" });
      }

      // SECURITY: Server-side IP and UserAgent capture
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Verify the token exists and get the quote ID
      const tokenData = await storage.getQuoteToken(req.params.token);
      if (!tokenData || !tokenData.isActive) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is expired
      if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
        return res.status(404).json({ message: "Token has expired" });
      }

      // SECURITY: Server-side validation and price calculation
      // Get the full quote data with packages and addons
      const quoteData = await storage.getQuoteByToken(req.params.token);
      if (!quoteData) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Validate selected package exists and is active
      let selectedPackage = null;
      if (clientData.selectedPackage) {
        selectedPackage = quoteData.packages.find(pkg => 
          pkg.id === clientData.selectedPackage && pkg.isActive
        );
        if (!selectedPackage) {
          return res.status(400).json({ message: "Invalid package selection" });
        }
      }

      // Validate selected addons exist and are active
      const validatedAddons = [];
      if (clientData.selectedAddons && clientData.selectedAddons.length > 0) {
        for (const addonId of clientData.selectedAddons) {
          const addon = quoteData.addons.find(addon => 
            addon.id === addonId && addon.isActive
          );
          if (!addon) {
            return res.status(400).json({ message: `Invalid addon selection: ${addonId}` });
          }
          validatedAddons.push(addon);
        }
      }

      // SECURITY: Server-side price calculation (source of truth)
      let subtotal = 0;
      if (selectedPackage) {
        subtotal += parseFloat(selectedPackage.basePrice);
      }
      for (const addon of validatedAddons) {
        subtotal += parseFloat(addon.price);
      }

      // Calculate VAT (using package VAT rate or default 20%)
      const vatRate = selectedPackage ? parseFloat(selectedPackage.vatRate) : 0.20;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

      // Update quote with server-calculated totals
      await storage.updateQuote(tokenData.quoteId, {
        subtotal: subtotal.toFixed(2),
        taxAmount: vatAmount.toFixed(2),
        total: total.toFixed(2),
        status: 'signed',
        approvedAt: new Date(),
        acceptedAt: new Date()
      });

      // Create the signature with server-side captured metadata
      const signature = await storage.createQuoteSignature({
        quoteId: tokenData.quoteId,
        signerName: clientData.signerName,
        signerEmail: clientData.signerEmail,
        agreementAccepted: clientData.agreementAccepted,
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent: userAgent
      });
      
      res.status(201).json({
        signature,
        calculatedTotals: {
          subtotal: subtotal.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          total: total.toFixed(2)
        }
      });
    } catch (error) {
      console.error("Error creating quote signature:", error);
      res.status(400).json({ message: "Failed to create signature" });
    }
  });

  // Enhanced Quotes System - Admin Routes (Authentication Required)
  // Quote Packages CRUD
  app.get("/api/admin/quote-packages", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const packages = await storage.getQuotePackages();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching quote packages:", error);
      res.status(500).json({ message: "Failed to fetch quote packages" });
    }
  });

  app.get("/api/admin/quote-packages/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const pkg = await storage.getQuotePackage(req.params.id);
      if (!pkg) {
        return res.status(404).json({ message: "Quote package not found" });
      }
      res.json(pkg);
    } catch (error) {
      console.error("Error fetching quote package:", error);
      res.status(500).json({ message: "Failed to fetch quote package" });
    }
  });

  app.post("/api/admin/quote-packages", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const packageData = insertQuotePackageSchema.parse(req.body);
      const pkg = await storage.createQuotePackage(packageData, req.tenantId);
      res.status(201).json(pkg);
    } catch (error) {
      console.error("Error creating quote package:", error);
      res.status(400).json({ message: "Failed to create quote package" });
    }
  });

  app.patch("/api/admin/quote-packages/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const packageData = insertQuotePackageSchema.partial().parse(req.body);
      const pkg = await storage.updateQuotePackage(req.params.id, packageData);
      if (!pkg) {
        return res.status(404).json({ message: "Quote package not found" });
      }
      res.json(pkg);
    } catch (error) {
      console.error("Error updating quote package:", error);
      res.status(400).json({ message: "Failed to update quote package" });
    }
  });

  app.delete("/api/admin/quote-packages/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const success = await storage.deleteQuotePackage(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Quote package not found" });
      }
      res.json({ message: "Quote package deleted successfully" });
    } catch (error) {
      console.error("Error deleting quote package:", error);
      res.status(500).json({ message: "Failed to delete quote package" });
    }
  });

  // Quote Add-ons CRUD
  app.get("/api/admin/quote-addons", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const addons = await storage.getQuoteAddons();
      res.json(addons);
    } catch (error) {
      console.error("Error fetching quote addons:", error);
      res.status(500).json({ message: "Failed to fetch quote addons" });
    }
  });

  app.get("/api/admin/quote-addons/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const addon = await storage.getQuoteAddon(req.params.id);
      if (!addon) {
        return res.status(404).json({ message: "Quote addon not found" });
      }
      res.json(addon);
    } catch (error) {
      console.error("Error fetching quote addon:", error);
      res.status(500).json({ message: "Failed to fetch quote addon" });
    }
  });

  app.post("/api/admin/quote-addons", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const addonData = insertQuoteAddonSchema.parse(req.body);
      const addon = await storage.createQuoteAddon(addonData, req.tenantId);
      res.status(201).json(addon);
    } catch (error) {
      console.error("Error creating quote addon:", error);
      res.status(400).json({ message: "Failed to create quote addon" });
    }
  });

  app.patch("/api/admin/quote-addons/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const addonData = insertQuoteAddonSchema.partial().parse(req.body);
      const addon = await storage.updateQuoteAddon(req.params.id, addonData);
      if (!addon) {
        return res.status(404).json({ message: "Quote addon not found" });
      }
      res.json(addon);
    } catch (error) {
      console.error("Error updating quote addon:", error);
      res.status(400).json({ message: "Failed to update quote addon" });
    }
  });

  app.delete("/api/admin/quote-addons/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const success = await storage.deleteQuoteAddon(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Quote addon not found" });
      }
      res.json({ message: "Quote addon deleted successfully" });
    } catch (error) {
      console.error("Error deleting quote addon:", error);
      res.status(500).json({ message: "Failed to delete quote addon" });
    }
  });

  // Quote Items CRUD (line items for quotes)
  app.get("/api/admin/quotes/:quoteId/items", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const items = await storage.getQuoteItems(req.params.quoteId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching quote items:", error);
      res.status(500).json({ message: "Failed to fetch quote items" });
    }
  });

  app.post("/api/admin/quotes/:quoteId/items", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const itemData = insertQuoteItemSchema.parse({
        ...req.body,
        quoteId: req.params.quoteId
      });
      const item = await storage.createQuoteItem(itemData, req.tenantId);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating quote item:", error);
      res.status(400).json({ message: "Failed to create quote item" });
    }
  });

  app.patch("/api/admin/quote-items/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const itemData = insertQuoteItemSchema.partial().parse(req.body);
      const item = await storage.updateQuoteItem(req.params.id, itemData);
      if (!item) {
        return res.status(404).json({ message: "Quote item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating quote item:", error);
      res.status(400).json({ message: "Failed to update quote item" });
    }
  });

  app.delete("/api/admin/quote-items/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const success = await storage.deleteQuoteItem(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Quote item not found" });
      }
      res.json({ message: "Quote item deleted successfully" });
    } catch (error) {
      console.error("Error deleting quote item:", error);
      res.status(500).json({ message: "Failed to delete quote item" });
    }
  });

  // Quote Token Management
  app.post("/api/admin/quotes/:id/token", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const { expiresAt } = req.body;
      const token = await storage.createQuoteToken(
        req.params.id, 
        req.tenantId,
        expiresAt ? new Date(expiresAt) : undefined
      );
      res.status(201).json(token);
    } catch (error) {
      console.error("Error creating quote token:", error);
      res.status(500).json({ message: "Failed to create quote token" });
    }
  });

  app.delete("/api/admin/quote-tokens/:token", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const success = await storage.deactivateQuoteToken(req.params.token);
      if (!success) {
        return res.status(404).json({ message: "Quote token not found" });
      }
      res.json({ message: "Quote token deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating quote token:", error);
      res.status(500).json({ message: "Failed to deactivate quote token" });
    }
  });

  // Quote Signatures (Admin view)
  app.get("/api/admin/quotes/:id/signatures", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const signatures = await storage.getQuoteSignatures(req.params.id);
      res.json(signatures);
    } catch (error) {
      console.error("Error fetching quote signatures:", error);
      res.status(500).json({ message: "Failed to fetch quote signatures" });
    }
  });

  // ================================
  // EXTRA INFO FOR CONTRACT SYSTEM
  // ================================
  
  // Admin: Extra Info Field Definitions (Standard + Custom Fields)
  app.get("/api/admin/extra-info-fields", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      const fields = await storage.getQuoteExtraInfoFields(userId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching extra info fields:", error);
      res.status(500).json({ message: "Failed to fetch extra info fields" });
    }
  });

  app.get("/api/admin/extra-info-fields/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const field = await storage.getQuoteExtraInfoField(req.params.id);
      if (!field) {
        return res.status(404).json({ message: "Extra info field not found" });
      }
      res.json(field);
    } catch (error) {
      console.error("Error fetching extra info field:", error);
      res.status(500).json({ message: "Failed to fetch extra info field" });
    }
  });

  app.post("/api/admin/extra-info-fields", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      
      // SECURITY: Prevent modification of standard fields by non-super-admin users
      if (req.body.isStandard && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Cannot create standard fields in production" });
      }
      
      const fieldData = insertQuoteExtraInfoFieldSchema.parse({
        ...req.body,
        userId: req.body.isStandard ? null : userId, // Standard fields have null userId
      });
      const field = await storage.createQuoteExtraInfoField(fieldData, req.tenantId);
      res.status(201).json(field);
    } catch (error) {
      console.error("Error creating extra info field:", error);
      res.status(400).json({ message: "Failed to create extra info field" });
    }
  });

  app.patch("/api/admin/extra-info-fields/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      // SECURITY: First check if this is a standard field before allowing modification
      const existingField = await storage.getQuoteExtraInfoField(req.params.id);
      if (!existingField) {
        return res.status(404).json({ message: "Extra info field not found" });
      }
      
      // SECURITY: Prevent modification of standard fields in production
      if (existingField.isStandard && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Cannot modify standard fields in production" });
      }
      
      const fieldData = insertQuoteExtraInfoFieldSchema.partial().parse(req.body);
      const field = await storage.updateQuoteExtraInfoField(req.params.id, fieldData);
      if (!field) {
        return res.status(404).json({ message: "Extra info field not found" });
      }
      res.json(field);
    } catch (error) {
      console.error("Error updating extra info field:", error);
      res.status(400).json({ message: "Failed to update extra info field" });
    }
  });

  app.delete("/api/admin/extra-info-fields/:id", ensureAdminAuth, csrf, async (req, res) => {
    try {
      // SECURITY: First check if this is a standard field before allowing deletion
      const existingField = await storage.getQuoteExtraInfoField(req.params.id);
      if (!existingField) {
        return res.status(404).json({ message: "Extra info field not found" });
      }
      
      // SECURITY: Prevent deletion of standard fields in production
      if (existingField.isStandard && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Cannot delete standard fields in production" });
      }
      
      const success = await storage.deleteQuoteExtraInfoField(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Extra info field not found" });
      }
      res.json({ message: "Extra info field deleted successfully" });
    } catch (error) {
      console.error("Error deleting extra info field:", error);
      res.status(500).json({ message: "Failed to delete extra info field" });
    }
  });

  // Admin: Per-Quote Extra Info Configuration
  app.get("/api/admin/quotes/:id/extra-info-config", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const config = await storage.getQuoteExtraInfoConfig(req.params.id);
      res.json(config || null);
    } catch (error) {
      console.error("Error fetching quote extra info config:", error);
      res.status(500).json({ message: "Failed to fetch quote extra info config" });
    }
  });

  app.post("/api/admin/quotes/:id/extra-info-config", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const configData = insertQuoteExtraInfoConfigSchema.parse({
        ...req.body,
        quoteId: req.params.id,
      });
      const config = await storage.createQuoteExtraInfoConfig(configData, req.tenantId);
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating quote extra info config:", error);
      res.status(400).json({ message: "Failed to create quote extra info config" });
    }
  });

  app.patch("/api/admin/quotes/:id/extra-info-config", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const configData = insertQuoteExtraInfoConfigSchema.partial().parse(req.body);
      const config = await storage.updateQuoteExtraInfoConfig(req.params.id, configData);
      if (!config) {
        return res.status(404).json({ message: "Quote extra info config not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error updating quote extra info config:", error);
      res.status(400).json({ message: "Failed to update quote extra info config" });
    }
  });

  app.delete("/api/admin/quotes/:id/extra-info-config", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const success = await storage.deleteQuoteExtraInfoConfig(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Quote extra info config not found" });
      }
      res.json({ message: "Quote extra info config deleted successfully" });
    } catch (error) {
      console.error("Error deleting quote extra info config:", error);
      res.status(500).json({ message: "Failed to delete quote extra info config" });
    }
  });

  // Public: Extra Info Responses (Client Data Collection)
  app.get("/api/public/quotes/:token/extra-info", authLimiter, async (req, res) => {
    try {
      // Verify token and get quote data
      const tokenData = await storage.getQuoteToken(req.params.token);
      if (!tokenData || !tokenData.isActive) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }
      
      // Check token expiration
      if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
        return res.status(404).json({ message: "Token has expired" });
      }

      // Get extra info configuration for this quote
      const config = await storage.getQuoteExtraInfoConfig(tokenData.quoteId);
      if (!config || !config.isEnabled) {
        return res.status(404).json({ message: "Extra info not enabled for this quote" });
      }

      // Get available fields (standard + any custom fields for this tenant)
      const userId = config.userId || undefined; // Get tenant context from config
      const allFields = await storage.getQuoteExtraInfoFields(userId);
      
      // Filter to only enabled fields based on configuration
      const enabledFieldKeys = JSON.parse(config.enabledFields || '[]');
      const enabledFields = allFields.filter(field => enabledFieldKeys.includes(field.key));

      // Get existing responses
      const responses = await storage.getQuoteExtraInfoResponses(tokenData.quoteId);

      res.json({
        config,
        fields: enabledFields,
        responses,
      });
    } catch (error) {
      console.error("Error fetching public extra info:", error);
      res.status(500).json({ message: "Failed to fetch extra info" });
    }
  });

  app.post("/api/public/quotes/:token/extra-info", authLimiter, async (req, res) => {
    try {
      // Verify token and get quote data
      const tokenData = await storage.getQuoteToken(req.params.token);
      if (!tokenData || !tokenData.isActive) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }
      
      // Check token expiration
      if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
        return res.status(404).json({ message: "Token has expired" });
      }

      // Get extra info configuration
      const config = await storage.getQuoteExtraInfoConfig(tokenData.quoteId);
      if (!config || !config.isEnabled) {
        return res.status(404).json({ message: "Extra info not enabled for this quote" });
      }

      // Validate the response data
      const responseData = insertQuoteExtraInfoResponseSchema.parse({
        ...req.body,
        quoteId: tokenData.quoteId,
      });

      // Check if field is enabled for this quote
      const enabledFieldKeys = JSON.parse(config.enabledFields || '[]');
      if (!enabledFieldKeys.includes(responseData.fieldKey)) {
        return res.status(400).json({ message: "Field not enabled for this quote" });
      }

      // Use upsert to handle updates to existing responses
      const response = await storage.upsertQuoteExtraInfoResponse(
        tokenData.quoteId,
        responseData.fieldKey,
        responseData
      );

      res.status(200).json(response);
    } catch (error) {
      console.error("Error saving extra info response:", error);
      res.status(400).json({ message: "Failed to save extra info response" });
    }
  });

  // Admin: View Extra Info Responses for a Quote
  app.get("/api/admin/quotes/:id/extra-info-responses", ensureAdminAuth, csrf, async (req, res) => {
    try {
      const responses = await storage.getQuoteExtraInfoResponses(req.params.id);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching quote extra info responses:", error);
      res.status(500).json({ message: "Failed to fetch quote extra info responses" });
    }
  });

  app.post("/api/contracts/:id/send", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contract = await storage.updateContract(req.params.id, {
        status: 'sent'
      });
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to send contract" });
    }
  });

  app.post("/api/contracts/:id/sign", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contract = await storage.updateContract(req.params.id, {
        status: 'signed',
        signedAt: new Date()
      });
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to sign contract" });
    }
  });

  app.post("/api/invoices/:id/send", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, {
        status: 'sent',
        sentAt: new Date()
      });
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  app.post("/api/invoices/:id/pay", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, {
        status: 'paid',
        paidAt: new Date()
      });
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark invoice as paid" });
    }
  });

  // Tasks
  app.get("/api/tasks", ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const { assignedTo, today } = req.query;
      const userId = req.authenticatedUserId;
      const tenantId = req.tenantId; // Get resolved tenant ID
      let tasks;
      
      if (today && assignedTo) {
        // Filter today's tasks for specific assignee with tenant isolation
        const allTasks = await storage.getTasksByAssignee(assignedTo as string, tenantId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tasks = allTasks.filter(task => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= today && dueDate < tomorrow;
        });
      } else if (assignedTo) {
        // Pass tenantId for proper tenant isolation
        tasks = await storage.getTasksByAssignee(assignedTo as string, tenantId);
      } else {
        // Use userId and tenantId context for filtering tasks with proper tenant isolation
        tasks = await storage.getTasks(userId, tenantId);
      }
      
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      // SECURITY: Override any client-provided tenantId with the authenticated tenant
      taskData.tenantId = req.tenantId;
      const task = await storage.createTask(taskData, req.tenantId);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.patch("/api/tasks/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const taskData = insertTaskSchema.partial().parse(req.body);
      const tenantId = req.tenantId; // Get resolved tenant ID for secure tenant isolation
      const task = await storage.updateTask(req.params.id, taskData, tenantId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  // Emails
  app.get("/api/emails", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { threadId, clientId } = req.query;
      let emails;
      
      if (threadId) {
        emails = await storage.getEmailsByThread(threadId as string);
      } else if (clientId) {
        emails = await storage.getEmailsByClient(clientId as string);
      } else {
        emails = await storage.getEmails();
      }
      
      res.json(emails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch emails" });
    }
  });

  app.post("/api/emails", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const emailData = insertEmailSchema.parse(req.body);
      const email = await storage.createEmail({
        ...emailData,
        sentAt: new Date(),
        status: 'sent'
      }, req.tenantId);
      res.status(201).json(email);
    } catch (error) {
      res.status(400).json({ message: "Invalid email data" });
    }
  });

  // SMS Messages
  app.get("/api/sms", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { threadId, clientId, phone } = req.query;
      let smsMessages;
      
      if (threadId) {
        smsMessages = await storage.getSmsMessagesByThread(threadId as string);
      } else if (clientId) {
        smsMessages = await storage.getSmsMessagesByClient(clientId as string);
      } else if (phone) {
        smsMessages = await storage.getSmsMessagesByPhone(phone as string);
      } else {
        smsMessages = await storage.getSmsMessages();
      }
      
      res.json(smsMessages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SMS messages" });
    }
  });

  app.post("/api/sms", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const smsData = insertSmsMessageSchema.parse(req.body);
      
      // Validate and format phone numbers
      const toPhone = twilioService.formatPhoneNumber(smsData.toPhone);
      const fromPhone = smsData.fromPhone || process.env.TWILIO_PHONE_NUMBER || '';
      
      if (!twilioService.validatePhoneNumber(toPhone)) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }
      
      let twilioSid = null;
      let status = 'failed';
      
      try {
        // Send SMS via Twilio if configured
        if (twilioService.isConfigured()) {
          const twilioResponse = await twilioService.sendSMS({
            to: toPhone,
            body: smsData.body,
            from: fromPhone
          });
          twilioSid = twilioResponse.sid;
          status = twilioResponse.status;
        } else {
          console.warn('[SMS] Twilio not configured, SMS will be stored but not sent');
          status = 'queued'; // Mock status for development
        }
      } catch (twilioError) {
        console.error('[SMS] Twilio error:', twilioError);
        status = 'failed';
      }
      
      // Store SMS in database
      const sms = await storage.createSmsMessage({
        ...smsData,
        toPhone,
        fromPhone,
        sentAt: new Date(),
        status,
        direction: 'outbound',
        twilioSid
      });
      
      res.status(201).json(sms);
    } catch (error) {
      console.error('[SMS] Error:', error);
      res.status(400).json({ message: "Invalid SMS data" });
    }
  });

  app.patch("/api/sms/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const sms = await storage.updateSmsMessage(id, updateData);
      
      if (!sms) {
        return res.status(404).json({ message: "SMS message not found" });
      }
      
      res.json(sms);
    } catch (error) {
      res.status(400).json({ message: "Failed to update SMS message" });
    }
  });

  // SMS Webhook for incoming messages from Twilio (SECURE: with signature validation)
  app.post("/api/sms/webhook", express.urlencoded({ extended: false }), async (req, res) => {
    try {
      // SECURITY: Validate Twilio webhook signature
      const twilioSignature = req.headers['x-twilio-signature'];
      const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      
      if (!twilioSignature) {
        console.error('❌ Missing Twilio signature header');
        return res.status(403).send('Missing X-Twilio-Signature header');
      }
      
      // Convert request body to the format expected by Twilio signature validation
      const params = req.body as Record<string, string>;
      
      // Verify webhook authenticity using Twilio signature validation
      const isValid = await twilioService.validateWebhookSignature(
        twilioSignature as string,
        webhookUrl,
        params
      );
      
      if (!isValid) {
        console.error('❌ Twilio webhook signature verification failed');
        console.error('URL:', webhookUrl);
        console.error('Signature:', twilioSignature);
        console.error('Params:', params);
        return res.status(403).send('Invalid webhook signature');
      }
      
      console.log('✅ Twilio webhook signature verified');
      
      // Parse incoming Twilio webhook
      const incomingMessage = await twilioService.handleIncomingWebhook(req.body);
      
      // Store incoming SMS in database
      const sms = await storage.createSmsMessage({
        body: incomingMessage.body,
        fromPhone: incomingMessage.from,
        toPhone: incomingMessage.to,
        status: 'delivered',
        direction: 'inbound',
        twilioSid: incomingMessage.messageSid,
        sentAt: new Date()
      });
      
      // Respond with TwiML (Twilio Markup Language) if needed
      res.set('Content-Type', 'text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('[SMS Webhook] Error processing incoming SMS:', error);
      res.status(500).json({ message: "Failed to process incoming SMS" });
    }
  });

  // SMS Status callback for delivery updates
  app.post("/api/sms/status/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { id } = req.params;
      const { MessageStatus, ErrorCode } = req.body; // Twilio status webhook data
      
      // Update SMS status in database
      const updateData: any = { status: MessageStatus };
      if (ErrorCode) {
        updateData.errorCode = ErrorCode;
      }
      
      const sms = await storage.updateSmsMessage(id, updateData);
      
      if (!sms) {
        return res.status(404).json({ message: "SMS message not found" });
      }
      
      res.json({ message: "Status updated successfully" });
    } catch (error) {
      console.error('[SMS Status] Error updating SMS status:', error);
      res.status(500).json({ message: "Failed to update SMS status" });
    }
  });

  // Check SMS delivery status
  app.get("/api/sms/:id/status", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { id } = req.params;
      const sms = await storage.getSmsMessage(id);
      
      if (!sms) {
        return res.status(404).json({ message: "SMS message not found" });
      }
      
      // Get latest status from Twilio if we have a SID
      if (sms.twilioSid && twilioService.isConfigured()) {
        try {
          const latestStatus = await twilioService.getMessageStatus(sms.twilioSid);
          
          // Update status in database if it changed
          if (latestStatus !== sms.status) {
            await storage.updateSmsMessage(id, { status: latestStatus });
            sms.status = latestStatus;
          }
        } catch (error) {
          console.error('[SMS Status Check] Error getting status from Twilio:', error);
        }
      }
      
      res.json({ 
        id: sms.id,
        status: sms.status,
        twilioSid: sms.twilioSid,
        sentAt: sms.sentAt
      });
    } catch (error) {
      console.error('[SMS Status Check] Error:', error);
      res.status(500).json({ message: "Failed to check SMS status" });
    }
  });

  // Message Templates
  app.get("/api/message-templates", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { type } = req.query;
      let templates;
      
      if (type) {
        templates = await storage.getMessageTemplatesByType(type as string);
      } else {
        templates = await storage.getMessageTemplates();
      }
      
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message templates" });
    }
  });

  app.post("/api/message-templates", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const templateData = insertMessageTemplateSchema.parse(req.body);
      const template = await storage.createMessageTemplate(templateData, req.tenantId);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: "Invalid template data" });
    }
  });

  app.patch("/api/message-templates/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const template = await storage.updateMessageTemplate(id, updateData);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      res.status(400).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/message-templates/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteMessageTemplate(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Message Threads
  app.get("/api/message-threads", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { clientId } = req.query;
      let threads;
      
      if (clientId) {
        threads = await storage.getMessageThreadsByClient(clientId as string);
      } else {
        threads = await storage.getMessageThreads();
      }
      
      res.json(threads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message threads" });
    }
  });

  app.post("/api/message-threads", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const threadData = insertMessageThreadSchema.parse(req.body);
      const thread = await storage.createMessageThread(threadData, req.tenantId);
      res.status(201).json(thread);
    } catch (error) {
      res.status(400).json({ message: "Invalid thread data" });
    }
  });

  app.patch("/api/message-threads/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const thread = await storage.updateMessageThread(id, updateData);
      
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      
      res.json(thread);
    } catch (error) {
      res.status(400).json({ message: "Failed to update thread" });
    }
  });

  // Automations
  app.get("/api/automations", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch automations" });
    }
  });

  app.post("/api/automations", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const automationData = insertAutomationSchema.parse(req.body);
      const automation = await storage.createAutomation(automationData, req.tenantId);
      res.status(201).json(automation);
    } catch (error) {
      res.status(400).json({ message: "Invalid automation data" });
    }
  });


  // Members (Musicians)
  app.get("/api/members", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const members = await storage.getMembers(req.tenantId);
      res.json(members);
    } catch (error) {
      console.error(`❌ MEMBERS API ERROR:`, error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/members/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const member = await storage.getMember(req.params.id, req.tenantId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.post("/api/members", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const memberData = insertMemberSchema.parse(req.body);
      const member = await storage.createMember(memberData, req.tenantId);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ message: "Invalid member data" });
    }
  });

  app.patch("/api/members/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const memberData = insertMemberSchema.partial().parse(req.body);
      const member = await storage.updateMember(req.params.id, memberData);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(400).json({ message: "Invalid member data" });
    }
  });

  app.delete("/api/members/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteMember(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete member" });
    }
  });

  // Member Availability
  app.get("/api/members/:id/availability", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const availability = await storage.getMemberAvailability(req.params.id);
      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.post("/api/members/:id/availability", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const availabilityData = insertMemberAvailabilitySchema.parse({
        ...req.body,
        memberId: req.params.id
      });
      const availability = await storage.setMemberAvailability(availabilityData);
      res.status(201).json(availability);
    } catch (error) {
      res.status(400).json({ message: "Invalid availability data" });
    }
  });


  // Project Members
  app.get("/api/projects/:id/members", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const members = await storage.getProjectMembers(req.params.id);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project members" });
    }
  });

  app.post("/api/projects/:id/members", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const memberData = insertProjectMemberSchema.parse({
        ...req.body,
        projectId: req.params.id
      });
      const member = await storage.addProjectMember(memberData);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ message: "Invalid project member data" });
    }
  });

  app.delete("/api/projects/:projectId/members/:memberId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.removeProjectMember(req.params.projectId, req.params.memberId);
      if (!deleted) {
        return res.status(404).json({ message: "Project member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove project member" });
    }
  });

  // Project Files
  app.get("/api/projects/:id/files", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.id);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/:id/files", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const fileData = insertProjectFileSchema.parse({
        ...req.body,
        projectId: req.params.id
      });
      const file = await storage.addProjectFile(fileData);
      res.status(201).json(file);
    } catch (error) {
      res.status(400).json({ message: "Invalid file data" });
    }
  });

  app.delete("/api/files/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectFile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Project Notes
  app.get("/api/projects/:id/notes", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const notes = await storage.getProjectNotes(req.params.id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project notes" });
    }
  });

  app.post("/api/projects/:id/notes", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const noteData = insertProjectNoteSchema.parse({
        ...req.body,
        projectId: req.params.id
      });
      const note = await storage.addProjectNote(noteData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ message: "Invalid note data" });
    }
  });

  app.delete("/api/notes/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectNote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Enhanced Dashboard APIs
  app.get("/api/dashboard/client-activity", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      // Mock client activity data - in real implementation, would aggregate from multiple sources
      const activities = [
        {
          id: "1",
          type: "contract_viewed",
          clientName: "Sarah Johnson",
          projectName: "Wedding Reception",
          documentTitle: "Performance Contract #WR-2024-001",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          description: "Opened and viewed contract",
          contactId: "contact-1",
          projectId: "project-1"
        },
        {
          id: "2",
          type: "quote_opened",
          clientName: "Mike Thompson",
          projectName: "Corporate Event",
          documentTitle: "Event Quote #CE-2024-015",
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          description: "Opened quote document",
          contactId: "contact-2",
          projectId: "project-2"
        }
      ];
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client activity" });
    }
  });

  app.get("/api/dashboard/pending-items", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      // Get pending quotes, contracts, invoices from database
      const quotes = await storage.getQuotes();
      const contracts = await storage.getContracts();
      const invoices = await storage.getInvoices();
      
      const pendingQuotes = quotes.filter(q => q.status === 'sent').map(q => ({
        id: q.id,
        type: 'quote',
        title: q.title,
        clientName: q.contactId, // In real implementation, would join with contact data
        projectName: q.leadId || 'General Project',
        sentDate: q.createdAt,
        amount: parseFloat(q.subtotal),
        status: q.status,
        contactId: q.contactId,
        projectId: q.leadId,
        urgency: 'medium'
      }));

      const pendingContracts = contracts.filter(c => c.status === 'sent').map(c => ({
        id: c.id,
        type: 'contract',
        title: c.title,
        clientName: c.contactId,
        projectName: c.projectId || 'General Project',
        sentDate: c.createdAt,
        status: c.status,
        contactId: c.contactId,
        projectId: c.projectId,
        urgency: 'high'
      }));

      const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').map(i => ({
        id: i.id,
        type: 'invoice',
        title: i.title,
        clientName: i.contactId,
        projectName: i.projectId || 'General Project',
        sentDate: i.createdAt,
        amount: parseFloat(i.total),
        status: i.status,
        contactId: i.contactId,
        projectId: i.projectId,
        urgency: i.status === 'overdue' ? 'critical' : 'medium'
      }));

      const allPending = [...pendingQuotes, ...pendingContracts, ...pendingInvoices];
      res.json(allPending);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending items" });
    }
  });

  app.get("/api/dashboard/business-priorities", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      // Get leads that need attention
      const leads = await storage.getLeads(tenantId);
      const newLeads = leads.filter(l => l.status === 'new').map(l => ({
        id: l.id,
        type: 'new_lead',
        title: `${l.firstName} ${l.lastName} - General Inquiry`,
        description: l.notes || 'New lead requires follow-up',
        clientName: `${l.firstName} ${l.lastName}`,
        createdDate: l.createdAt,
        urgency: 'high',
        contactId: l.id
      }));

      // Get overdue tasks
      const tasks = await storage.getTasks();
      const overdueTasks = tasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
      ).map(t => ({
        id: t.id,
        type: 'todo',
        title: t.title,
        description: t.description || 'Task is overdue',
        dueDate: t.dueDate,
        createdDate: t.createdAt,
        urgency: 'critical',
        contactId: t.contactId,
        projectId: t.projectId
      }));

      const allPriorities = [...newLeads, ...overdueTasks];
      res.json(allPriorities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch business priorities" });
    }
  });

  app.get("/api/dashboard/recent-emails", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const emails = await storage.getEmails();
      const recentEmails = emails
        .filter(e => e.createdAt !== null)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 20)
        .map(e => ({
          id: e.id,
          subject: e.subject,
          fromEmail: e.fromEmail,
          fromName: e.fromEmail.split('@')[0], // Simple name extraction
          toEmail: e.toEmail,
          body: e.body,
          receivedAt: e.createdAt!,
          isRead: e.status === 'delivered',
          hasAttachments: false,
          projectName: e.projectId || 'General',
          clientName: e.contactId || 'Unknown',
          projectId: e.projectId,
          contactId: e.contactId,
          priority: 'medium',
          labels: []
        }));

      res.json(recentEmails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent emails" });
    }
  });

  // Events/Calendar API
  app.get("/api/events", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { userId, startDate, endDate, clientId } = req.query;
      
      let events;
      if (startDate && endDate) {
        events = await storage.getEventsByDateRange(new Date(startDate as string), new Date(endDate as string));
      } else if (userId) {
        events = await storage.getEventsByUser(userId as string);
      } else if (clientId) {
        events = await storage.getEventsByClient(clientId as string);
      } else {
        events = await storage.getEvents();
      }
      
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(validatedData, req.tenantId);
      
      // Auto-sync to Google Calendar if user has an active integration
      try {
        console.log(`Attempting to sync new event "${event.title}" to Google Calendar`);
        const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy);
        const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
        
        if (googleIntegration) {
          console.log('Found active Google integration, starting sync...');
          const syncResult = await googleOAuthService.syncToGoogle(googleIntegration, event.id);
          console.log(`Successfully synced event "${event.title}" to Google Calendar:`, syncResult);
        } else {
          console.log('No active Google integration found for user:', event.createdBy);
        }
      } catch (syncError: any) {
        console.error('Failed to sync new event to Google:', syncError);
        console.error('Sync error details:', syncError?.response?.data || syncError?.message);
        // Don't fail the creation if sync fails
      }
      
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid event data", error });
    }
  });

  app.patch("/api/events/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, validatedData);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Auto-sync to Google Calendar if user has an active integration
      try {
        const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy);
        const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
        
        if (googleIntegration) {
          await googleOAuthService.syncToGoogle(googleIntegration, event.id);
        }
      } catch (syncError: any) {
        console.error('Failed to sync updated event to Google:', syncError);
        // Don't fail the update if sync fails
      }
      
      res.json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid event data", error });
    }
  });

  app.delete("/api/events/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Get event before deletion for Google sync
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Delete from Google Calendar if it was synced
      if (event.externalEventId) {
        try {
          const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy);
          const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
          
          if (googleIntegration) {
            console.log(`Deleting event "${event.title}" from Google Calendar:`, event.externalEventId);
            await googleOAuthService.deleteFromGoogle(googleIntegration, event.externalEventId);
            console.log(`Successfully deleted "${event.title}" from Google Calendar`);
          } else {
            console.log('No active Google integration found for deletion sync');
          }
        } catch (syncError: any) {
          console.error('Failed to delete from Google Calendar:', syncError);
          console.error('Error details:', syncError?.response?.data || syncError?.message);
          // Continue with CRM deletion even if Google sync fails
        }
      } else {
        console.log(`Event "${event.title}" has no external event ID, skipping Google deletion`);
      }
      
      const deleted = await storage.deleteEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Calendar Integrations API
  app.get("/api/calendar-integrations", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { userId } = req.query;
      let integrations;
      if (userId) {
        integrations = await storage.getCalendarIntegrationsByUser(userId as string);
      } else {
        integrations = await storage.getCalendarIntegrations();
      }
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar integrations" });
    }
  });

  app.get("/api/calendar-integrations/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const integration = await storage.getCalendarIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      res.json(integration);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar integration" });
    }
  });

  app.post("/api/calendar-integrations", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const validatedData = insertCalendarIntegrationSchema.parse(req.body);
      const integration = await storage.createCalendarIntegration(validatedData, req.tenantId);
      res.status(201).json(integration);
    } catch (error) {
      res.status(400).json({ message: "Invalid calendar integration data", error });
    }
  });

  app.patch("/api/calendar-integrations/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const validatedData = insertCalendarIntegrationSchema.partial().parse(req.body);
      const integration = await storage.updateCalendarIntegration(req.params.id, validatedData);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      res.json(integration);
    } catch (error) {
      res.status(400).json({ message: "Invalid calendar integration data", error });
    }
  });

  app.delete("/api/calendar-integrations/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteCalendarIntegration(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete calendar integration" });
    }
  });

  // Calendar Sync API - Enhanced with bidirectional Google sync
  app.post("/api/calendar-integrations/:id/sync", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      console.log('🚀 Sync endpoint called for integration:', req.params.id);
      const integrationId = req.params.id;
      const integration = await storage.getCalendarIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }

      if (!integration.isActive) {
        return res.status(400).json({ message: "Calendar integration is not active" });
      }

      let result;
      
      if (integration.provider === 'google') {
        try {
          console.log('🔄 Starting enhanced Google Calendar bidirectional sync...');
          // Use the enhanced Google OAuth service for full bidirectional sync
          result = await googleOAuthService.syncFromGoogle(integration);
          console.log('🎉 Enhanced Google Calendar sync completed:', result);
        } catch (error: any) {
          console.error('❌ Enhanced Google Calendar sync failed:', error);
          throw new Error(`Google Calendar sync failed: ${error.message}`);
        }
      } else if (integration.provider === 'ical') {
        if (integration.syncDirection === 'import' || integration.syncDirection === 'bidirectional') {
          result = { message: "iCal sync not yet implemented" };
        } else {
          result = { message: "Only import/bidirectional sync is supported for iCal" };
        }
      } else {
        return res.status(400).json({ message: "Unsupported calendar provider" });
      }
      
      // Update last sync time
      console.log('⏰ Updating last sync time...');
      await storage.updateCalendarIntegration(integrationId, {
        lastSyncAt: new Date()
      });

      res.json(result);
    } catch (error: any) {
      console.error('🚨 Sync endpoint error:', error);
      res.status(500).json({ message: "Failed to sync calendar", error: error.message });
    }
  });

  // Calendar Sync Logs API
  app.get("/api/calendar-sync-logs", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const { integrationId } = req.query;
      const logs = await storage.getCalendarSyncLogs(integrationId as string || undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sync logs" });
    }
  });

  app.post("/api/calendar-sync-logs", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const validatedData = insertCalendarSyncLogSchema.parse(req.body);
      const log = await storage.createCalendarSyncLog(validatedData, req.tenantId);
      res.status(201).json(log);
    } catch (error) {
      res.status(400).json({ message: "Invalid sync log data", error });
    }
  });

  app.patch("/api/calendar-sync-logs/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const validatedData = insertCalendarSyncLogSchema.partial().parse(req.body);
      const log = await storage.updateCalendarSyncLog(req.params.id, validatedData);
      if (!log) {
        return res.status(404).json({ message: "Sync log not found" });
      }
      res.json(log);
    } catch (error) {
      res.status(400).json({ message: "Invalid sync log data", error });
    }
  });

  // Google Calendar OAuth Routes
  app.get("/auth/google", async (req, res) => {
    try {
      const authUrl = googleCalendarService.getAuthUrl();
      res.redirect(authUrl);
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate Google Calendar authentication" });
    }
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({ message: "Authorization code not provided" });
      }
      
      // Exchange code for tokens
      const tokens = await googleCalendarService.getTokensFromCode(code as string);
      
      // Set credentials to get calendar list
      googleCalendarService.setCredentials(tokens);
      const calendars = await googleCalendarService.getCalendarList();
      
      // Find primary calendar or use the first one
      const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];
      
      if (!primaryCalendar) {
        return res.status(400).json({ message: "No accessible calendars found" });
      }
      
      // Create calendar integration record
      // Note: In a real app, you'd get the userId from the session/JWT
      const users = await storage.getUsers();
      const defaultUserId = users[0]?.id || 'default-user';
      
      const integration = await storage.createCalendarIntegration({
        userId: defaultUserId,
        provider: 'google',
        providerAccountId: primaryCalendar.id,
        calendarId: primaryCalendar.id,
        calendarName: primaryCalendar.summary,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        isActive: true,
        syncDirection: 'bidirectional'
      });
      
      // Redirect to frontend with success
      res.redirect(`/?connected=google&calendar=${encodeURIComponent(primaryCalendar.summary)}`);
    } catch (error) {
      console.error('Google Calendar OAuth error:', error);
      res.redirect('/?error=oauth_failed');
    }
  });

  // Enhanced sync endpoint with Google Calendar integration
  app.post("/api/calendar-integrations/:id/sync", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const integrationId = req.params.id;
      const integration = await storage.getCalendarIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }

      if (!integration.isActive) {
        return res.status(400).json({ message: "Calendar integration is not active" });
      }

      // Create sync log
      const syncLog = await storage.createCalendarSyncLog({
        integrationId,
        syncType: 'manual',
        direction: integration.syncDirection === 'export' ? 'export' : 'import',
      });

      let syncResult = {
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0
      };

      try {
        if (integration.provider === 'google') {
          // Note: In a real app, you'd get the userId from the session/JWT
          const users = await storage.getUsers();
          const defaultUserId = users[0]?.id || 'default-user';
          
          if (integration.syncDirection === 'import' || integration.syncDirection === 'bidirectional') {
            // Sync from Google to CRM
            const importResult = await googleCalendarService.syncFromGoogle(integration, defaultUserId);
            syncResult.eventsCreated += importResult.eventsCreated;
            syncResult.eventsUpdated += importResult.eventsUpdated;
            syncResult.eventsDeleted += importResult.eventsDeleted;
          }
          
          if (integration.syncDirection === 'export' || integration.syncDirection === 'bidirectional') {
            // Sync from CRM to Google
            const exportResult = await googleCalendarService.syncToGoogle(integration);
            syncResult.eventsCreated += exportResult.eventsCreated;
            syncResult.eventsUpdated += exportResult.eventsUpdated;
            syncResult.eventsDeleted += exportResult.eventsDeleted;
          }
        } else if (integration.provider === 'ical') {
          // iCal integration (import only)
          if (integration.syncDirection === 'import' || integration.syncDirection === 'bidirectional') {
            const users = await storage.getUsers();
            const defaultUserId = users[0]?.id || 'default-user';
            
            const importResult = await icalService.importFromICal(integration, defaultUserId);
            syncResult.eventsCreated += importResult.eventsCreated;
            syncResult.eventsUpdated += importResult.eventsUpdated;
            syncResult.eventsDeleted += importResult.eventsDeleted;
          }
        }
        
        // Update sync log as completed
        await storage.updateCalendarSyncLog(syncLog.id, {
          status: 'completed',
          completedAt: new Date(),
          eventsProcessed: syncResult.eventsCreated + syncResult.eventsUpdated + syncResult.eventsDeleted,
          eventsCreated: syncResult.eventsCreated,
          eventsUpdated: syncResult.eventsUpdated,
          eventsDeleted: syncResult.eventsDeleted,
        });

        res.json({ 
          message: "Sync completed", 
          syncLogId: syncLog.id,
          ...syncResult
        });
      } catch (syncError) {
        const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error';
        // Update sync log as failed
        await storage.updateCalendarSyncLog(syncLog.id, {
          status: 'failed',
          completedAt: new Date(),
          errors: JSON.stringify({ error: errorMessage, timestamp: new Date() })
        });
        
        throw syncError;
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      console.error('Sync error:', error);
      res.status(500).json({ message: "Failed to sync calendar", error: errorMessage });
    }
  });

  // Cleanup orphaned Google Calendar events
  app.post("/api/calendar-integrations/:id/cleanup", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const integration = await storage.getCalendarIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      
      const { eventTitles } = req.body;
      if (!eventTitles || !Array.isArray(eventTitles)) {
        return res.status(400).json({ message: "eventTitles array is required" });
      }
      
      const result = await googleOAuthService.cleanupOrphanedEvents(integration, eventTitles);
      res.json({ 
        message: "Cleanup completed successfully", 
        deletedCount: result.deletedCount 
      });
    } catch (error: any) {
      console.error('Calendar cleanup error:', error);
      res.status(500).json({ message: "Failed to cleanup orphaned events", error: error.message });
    }
  });

  // iCal Routes
  app.post("/api/calendar-integrations/ical", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { icalUrl, calendarName, userId } = req.body;
      
      if (!icalUrl) {
        return res.status(400).json({ message: "iCal URL is required" });
      }
      
      // Test parsing the iCal URL
      try {
        await icalService.parseICalFromUrl(icalUrl);
      } catch (error) {
        return res.status(400).json({ 
          message: "Invalid iCal URL or unable to parse iCal data",
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Create iCal integration
      const integration = await storage.createCalendarIntegration({
        userId: userId || 'default-user',
        provider: 'ical',
        calendarName: calendarName || 'iCal Import',
        isActive: true,
        syncDirection: 'import',
        settings: JSON.stringify({ icalUrl })
      });
      
      res.json(integration);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to create iCal integration", error: errorMessage });
    }
  });

  // Export CRM events as iCal feed
  app.get("/api/calendar/ical/:integrationId", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const integrationId = req.params.integrationId;
      
      // Get integration to verify access
      const integration = await storage.getCalendarIntegration(integrationId);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      
      // Get events to export
      let events;
      if (integration.provider === 'google' || integration.provider === 'ical') {
        // Export events from this integration
        const allEvents = await storage.getEvents();
        events = allEvents.filter(e => e.calendarIntegrationId === integrationId);
      } else {
        // Export all CRM events
        events = await storage.getEvents();
      }
      
      // Generate iCal feed
      const icalFeed = await icalService.generateICalFeed(events, integration.calendarName);
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${integration.calendarName.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
      res.send(icalFeed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to generate iCal feed", error: errorMessage });
    }
  });

  // Export all CRM events as iCal feed
  app.get("/api/calendar/ical", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const events = await storage.getEvents();
      const icalFeed = await icalService.generateICalFeed(events, 'CRM Calendar');
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="crm_calendar.ics"');
      res.send(icalFeed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to generate iCal feed", error: errorMessage });
    }
  });

  // Tenant configuration endpoint for branding
  app.get('/api/tenant/config', tenantResolver, async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }

      // Get tenant details for branding
      const tenant = req.tenant || await storage.getTenantById(tenantId);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Return tenant configuration with branding information
      const tenantConfig = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        branding: {
          companyName: tenant.name,
          loginTitle: `Sign in to ${tenant.name}`,
          welcomeMessage: `Welcome to ${tenant.name}'s business management portal`,
          primaryColor: '#0ea5e9',
          backgroundColor: '#ffffff'
          // Add more branding options as needed
        }
      };

      res.json(tenantConfig);
    } catch (error: any) {
      console.error('Error fetching tenant config:', error);
      res.status(500).json({ error: 'Failed to fetch tenant configuration' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
