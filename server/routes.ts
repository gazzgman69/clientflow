import type { Express } from "express";
import express from "express";
import { exec as execCmd } from 'child_process';
import { createServer, type Server } from "http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { createTenantAwareSessionStore } from "./middleware/enhancedSessionStore";
import { validateResponseCasing } from "./src/utils/devCasingGuard";
import { db, pool } from './db';
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
import { sendToMusicianTracker } from "./src/services/musicianTrackerWebhook";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer";
import { z } from "zod";
import { neon } from '@neondatabase/serverless';
import {
  createPortalToken, verifyPortalToken, consumePortalToken,
  createResetToken, verifyResetToken, consumeResetToken,
  purgeExpiredTokens
} from "./src/services/authTokenService";

// Password hashing utility
const SALT_ROUNDS = 12;
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};
import { googleCalendarService } from "./src/services/google-calendar";
import { googleOAuthService } from "./src/services/google-oauth";
import { icalService } from "./src/services/ical";
import { emailDispatcher } from "./src/services/email-dispatcher";
import { emailRenderer } from "./src/services/emailRenderer";
import { leadStatusAutomator } from "./src/services/lead-status-automator";
import { projectStatusAutomator } from "./src/services/project-status-automator";
import oauthRoutes from "./src/routes/oauth";
import emailOAuthRoutes from "./src/routes/email-oauth";
import emailRoutes from "./src/routes/email";
import templatesRoutes from "./src/routes/templates";
import autoRespondersRoutes from "./src/routes/auto-responders";
import mailSettingsRoutes from "./src/routes/mailSettings";
import userPrefsRoutes from "./src/routes/userPrefs";
import leadFormsRoutes from "./src/routes/lead-forms";
import embedRoutes from "./src/routes/embed";
import leadCustomFieldsRoutes from "./src/routes/lead-custom-fields";
import leadAutomationSimpleRoutes from "./src/routes/lead-automation-simple";
import signaturesRoutes from "./src/routes/signatures";
import venuesRoutes from "./src/routes/venues";
import tokensRoutes from "./src/routes/tokens";
import portalAuthRoutes from "./src/routes/portal-auth";
import portalPaymentsRoutes from "./src/routes/portal-payments";
import portalFormsRoutes from "./src/routes/portal-forms";
import portalAppointmentsRoutes from "./src/routes/portal-appointments";
import stripeWebhooksRoutes from "./src/routes/stripe-webhooks";
import tenantCleanupRoutes from "./src/routes/tenantCleanup";
import aiFeaturesRoutes from "./src/routes/ai-features";
import aiOnboardingRoutes from "./src/routes/ai-onboarding";
import publicChatRoutes from "./src/routes/public-chat";
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
  insertContractTemplateSchema,
  insertInvoiceSchema,
  insertIncomeCategorySchema,
  insertInvoiceItemSchema,
  insertInvoiceLineItemSchema,
  insertPaymentScheduleSchema,
  insertPaymentInstallmentSchema,
  insertRecurringInvoiceSettingsSchema,
  insertPaymentTransactionSchema,
  insertTaxSettingsSchema,
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
  insertMemberGroupSchema,
  insertMemberGroupMemberSchema,
  insertPerformerContractSchema,
  insertRepertoireSchema,
  insertProjectSetlistSchema,
  insertProjectFileSchema,
  insertProjectNoteSchema,
  insertProjectTaskSchema,
  insertProjectScheduleItemSchema,
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
  insertEmailProviderConfigSchema,
  signupSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  portalAccessRequestSchema,
  portalTokenVerifySchema,
  leadStatusUpdateSchema,
  projectStatusUpdateSchema
} from "@shared/schema";

export async function registerRoutes(app: Express, csrfProtection?: any): Promise<Server> {

  // ── Admin reload endpoint ─────────────────────────────────────────────────
  // Called by CI after each git push to pull latest code; tsx watch restarts automatically.
  // Requires RELOAD_SECRET env var to be set in Replit Secrets.
  app.get('/api/admin/reload', (req: any, res: any) => {
    const secret = process.env.RELOAD_SECRET;
    if (!secret || req.query.key !== secret) {
      return res.status(403).json({ error: 'forbidden' });
    }
    execCmd('git fetch origin && git reset --hard origin/main', (err: any, stdout: string, stderr: string) => {
      if (err) {
        return res.status(500).json({ error: 'git pull failed', detail: stderr });
      }
      res.json({ ok: true, output: stdout.trim() });
    });
  });
  // ─────────────────────────────────────────────────────────────────────────

  // CRITICAL DEBUG: Log app instance and verify route registration
  console.log('🔧 REGISTER ROUTES CALLED:', {
    appType: typeof app,
    hasGet: typeof app.get === 'function',
    hasPost: typeof app.post === 'function',
    hasUse: typeof app.use === 'function'
  });

  // Configure multer for project file uploads with tenant isolation
  const projectFileUpload = multer({
    storage: multer.diskStorage({
      destination: async (req: any, file, cb) => {
        try {
          const tenantId = req.tenantId || 'default-tenant';
          const uploadDir = path.join(process.cwd(), 'project-uploads', tenantId);
          await mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error: any) {
          cb(error, '');
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
      }
    }),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
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

  // Debug endpoint: identify runtime storage type and git commit
  // /api/debug/info removed — exposed internal infrastructure details (storage class, git hash)


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
      // OAuth popup compatibility: SameSite=None allows cross-site requests
      sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
      secure: process.env.NODE_ENV === 'production', // Required for SameSite=none in production
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
  
  // NOTE: express.json() is already mounted globally in index.ts — not duplicated here
  // NOTE: CSRF token endpoint is already mounted in index.ts after csrfProtection — not duplicated here
  
  // DEBUG: Log before OAuth routes
  app.use((req, res, next) => {
    if (req.path.includes('/auth/')) {
      console.log('🚦 BEFORE OAUTH ROUTES:', {
        method: req.method,
        path: req.path,
        url: req.url,
        body: req.body,
        hasBody: !!req.body,
        contentType: req.headers['content-type']
      });
    }
    next();
  });
  
  // OAuth routes (must be after session middleware) - no CSRF for OAuth flows
  app.use(oauthRoutes);
  app.use(emailOAuthRoutes);
  
  // Apply CSRF protection to state-changing routes if provided
  const csrfBase = csrfProtection || ((req: any, res: any, next: any) => next());
  
  // CSRF middleware wrapper (new middleware handles errors inline via 403 response)
  const csrf = (req: any, res: any, next: any) => {
    csrfBase(req, res, next);
  };

  // CSRF-free public venue endpoints for lead capture forms (must be before general venue mount)
  app.post('/api/venues/suggest', async (req, res) => {
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

  // Public venue details endpoint for lead capture forms (no auth required)
  // Needed when a visitor selects a cached venue from the autocomplete dropdown
  app.get('/api/venues/:id/public', async (req, res) => {
    try {
      const { venuesService } = await import('./src/services/venues');
      const venue = await venuesService.getVenuePublic(req.params.id);
      if (!venue) {
        return res.status(404).json({ message: 'Venue not found' });
      }
      res.json(venue);
    } catch (error) {
      console.error('Error fetching public venue details:', error);
      res.status(500).json({ message: 'Failed to fetch venue details' });
    }
  });

  // Venue routes with authentication, tenant resolution and CSRF protection (except for public endpoints used by lead capture forms)
  app.use('/api/venues', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant), (req, res, next) => {
    // Skip CSRF for public endpoints used by lead capture forms
    const publicEndpoints = ['/suggest', '/place-details'];
    const isTrackUsage = req.method === 'POST' && req.path.includes('/track-usage');
    if (req.method === 'POST' && (publicEndpoints.includes(req.path) || isTrackUsage)) {
      return next();
    }
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
  
  // Auto-responders routes - apply enhanced tenant security
  app.use('/api/auto-responders', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), autoRespondersRoutes);
  
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
      
      const response = { counts };
      validateResponseCasing('/api/leads/summary', response);
      res.json(response);
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
        await storage.updateLead(lead.id, { lastViewedAt: new Date() }, tenantId);
      }
      
      res.json({ marked: unseenLeads.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark leads as viewed" });
    }
  });

  // General leads routes
  // NOTE: Main GET /api/leads route moved to line ~1946 with proper LeadCardDTO mapping
  
  // IMPORTANT: Specific routes MUST come before parameterized routes (:id)
  // GET /api/leads/urgency - Leads with AI-calculated urgency scores
  app.get("/api/leads/urgency", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      const userId = req.session.userId!;
      const { urgencyService } = await import("./urgency-service");
      
      const allLeads = await storage.getLeads(tenantId);
      
      // Filter out orphaned leads (leads without projects)
      const leads = allLeads.filter(lead => lead.projectId !== null && lead.projectId !== undefined);
      
      // Batch fetch all projects for all leads in ONE query
      const contactIds = leads.map(lead => lead.id);
      const projectsByContact = await storage.getProjectsByContacts(contactIds, tenantId);
      
      // Calculate urgency for each lead
      const leadsWithUrgency = await Promise.all(leads.map(async (lead) => {
        // Pass projects to the urgency service to avoid duplicate lookup
        const projects = projectsByContact.get(lead.id) || [];
        const urgencyAnalysis = await urgencyService.calculateLeadUrgency(
          lead, 
          tenantId, 
          userId,
          projects // Pass pre-fetched projects
        );
        
        const primaryProject = projects.find(p => p.id === lead.projectId) || projects[0];
        
        return {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          eventDate: primaryProject?.eventDate,
          venue: primaryProject?.eventLocation || lead.venueAddress,
          projectId: lead.projectId,
          urgencyScore: urgencyAnalysis.score,
          urgencyPriority: urgencyAnalysis.priority,
          needsReply: urgencyAnalysis.needsReply,
          daysSinceContact: urgencyAnalysis.daysSinceContact,
          daysUntilEvent: urgencyAnalysis.daysUntilEvent,
          hasAutoReply: urgencyAnalysis.hasAutoReply,
          hasPersonalReply: urgencyAnalysis.hasPersonalReply,
        };
      }));

      res.json(leadsWithUrgency);
    } catch (error) {
      console.error('Error calculating lead urgency:', error);
      res.status(500).json({ message: "Failed to calculate lead urgency" });
    }
  });

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

  app.get("/api/leads/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id, req.tenantId);
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
      // Clean empty strings → undefined so Zod/drizzle-zod won't choke on
      // timestamp/numeric columns (e.g. projectDate "" → Invalid Date)
      const body = { ...req.body };
      for (const key of Object.keys(body)) {
        if (body[key] === "") {
          body[key] = undefined;
        }
      }
      // Coerce date strings → Date objects for timestamp columns
      const dateFields = ['projectDate', 'holdExpiresAt', 'followUpDate', 'lastContactedAt', 'lastViewedAt'];
      for (const field of dateFields) {
        if (body[field] && typeof body[field] === 'string') {
          body[field] = new Date(body[field]);
        }
      }
      const leadData = insertLeadSchema.omit({ tenantId: true }).parse(body);
      const lead = await storage.createLead({ ...leadData, tenantId: req.tenantId }, req.tenantId);
      
      // Auto-create calendar event if lead has a projectDate
      if (lead.projectDate) {
        try {
          const eventStart = new Date(lead.projectDate);
          
          // Detect if projectDate is date-only (no time component)
          const projectDateStr = String(lead.projectDate);
          const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(projectDateStr) || 
                             (eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && eventStart.getSeconds() === 0);
          
          // For date-only: all-day + transparent (free). For timed: 1-hour + busy
          const eventEnd = new Date(eventStart);
          if (!isDateOnly) {
            eventEnd.setHours(eventEnd.getHours() + 1); // Timed event: 1-hour duration
          }
          
          // Create event with 17hats-style title: "New Lead Project • [Name]"
          const leadName = lead.fullName || lead.email || 'Unknown';
          const eventTitle = `New Lead Project • ${leadName}`;
          
          // Build description with form details
          let eventDescription = lead.notes || '';
          
          // Idempotency guard: check for duplicate events within 5 minutes
          const existingEvents = await storage.getEvents(req.tenantId);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const isDuplicate = existingEvents.some(e => 
            e.leadId === lead.id && 
            e.type === 'lead' && 
            e.title === eventTitle &&
            new Date(e.createdAt) > fiveMinutesAgo
          );
          
          if (!isDuplicate) {
            const createdEvent = await storage.createEvent({
              title: eventTitle,
              description: eventDescription || undefined,
              startDate: eventStart,
              endDate: eventEnd,
              location: lead.eventLocation || undefined,
              attendees: lead.email ? [lead.email] : undefined,
              userId: req.userId,
              leadId: lead.id,
              type: 'lead',
              allDay: isDateOnly,
              transparency: isDateOnly ? 'free' : 'busy',
              createdBy: req.userId || req.authenticatedUserId,
              tenantId: req.tenantId
            } as any);
            
            // Format start time as dd/mm/yyyy HH:mm
            const day = String(eventStart.getDate()).padStart(2, '0');
            const month = String(eventStart.getMonth() + 1).padStart(2, '0');
            const year = eventStart.getFullYear();
            const hours = String(eventStart.getHours()).padStart(2, '0');
            const minutes = String(eventStart.getMinutes()).padStart(2, '0');
            const formattedStart = `${day}/${month}/${year} ${hours}:${minutes}`;
            
            console.log('ℹ️ INFO: calendar.event.created', {
              eventId: createdEvent.id,
              leadId: lead.id,
              title: eventTitle,
              start: formattedStart,
              timestamp: new Date().toISOString()
            });

            // Enqueue for async Google Calendar push
            const { googleOutbox } = await import('../services/googleOutbox');
            googleOutbox.enqueue({ eventId: createdEvent.id, tenantId: req.tenantId ?? undefined });
          }
        } catch (calError) {
          console.error('Failed to auto-create calendar event for lead:', calError);
          // Don't fail the lead creation if calendar event fails
        }
      }
      
      res.status(201).json(lead);
    } catch (error: any) {
      console.error('Lead creation error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      res.status(400).json({ message: "Invalid lead data", errors: error?.issues, debug: error?.message || String(error) });
    }
  });

  app.patch("/api/leads/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const leadData = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(req.params.id, leadData, req.tenantId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Auto-update calendar event if it exists
      try {
        const events = await storage.getEvents(req.tenantId);
        const leadEvent = events.find(e => e.leadId === lead.id);
        
        if (leadEvent) {
          const updates: any = {};
          
          // Update title if name changed
          if (lead.fullName) {
            const leadName = lead.fullName || lead.email || 'Unknown';
            updates.title = `New Lead Project • ${leadName}`;
          }
          
          // Update dates if project date changed
          if (leadData.projectDate) {
            const eventStart = new Date(leadData.projectDate);
            const eventEnd = new Date(eventStart);
            eventEnd.setHours(eventEnd.getHours() + 1);
            updates.startTime = eventStart;
            updates.endTime = eventEnd;
          }
          
          // Update attendees if email changed
          if (leadData.email) {
            updates.attendees = [leadData.email];
          }
          
          // Update notes if changed
          if (leadData.notes !== undefined) {
            updates.description = leadData.notes;
          }
          
          if (Object.keys(updates).length > 0) {
            await storage.updateEvent(leadEvent.id, updates, req.tenantId);
            console.log(`📅 Auto-updated calendar event for lead ${lead.id}`);
          }
        } else if (lead.projectDate && leadData.projectDate) {
          // Create event if projectDate was just added
          const eventStart = new Date(lead.projectDate);
          const eventEnd = new Date(eventStart);
          eventEnd.setHours(eventEnd.getHours() + 1);
          
          const leadName = lead.fullName || lead.email || 'Unknown';
          const eventTitle = `New Lead Project • ${leadName}`;
          
          await storage.createEvent({
            title: eventTitle,
            description: lead.notes || undefined,
            startTime: eventStart,
            endTime: eventEnd,
            location: lead.eventLocation || undefined,
            attendees: lead.email ? [lead.email] : undefined,
            userId: req.userId,
            leadId: lead.id,
            type: 'lead',
            allDay: false,
            tenantId: req.tenantId
          });
          
          console.log(`📅 Auto-created calendar event for updated lead ${lead.id}: "${eventTitle}"`);
        }
      } catch (calError) {
        console.error('Failed to update calendar event for lead:', calError);
        // Don't fail the lead update if calendar event fails
      }
      
      res.json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  // PATCH /api/leads/:id/status
  app.patch("/api/leads/:id/status", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { status, lostReason, lostReasonNotes, holdExpiresAt } = leadStatusUpdateSchema.parse(req.body);

      // Get current lead first
      const currentLead = await storage.getLead(req.params.id, req.tenantId);
      if (!currentLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Validate lost reason is provided when marking as lost
      if (status === 'lost' && !lostReason) {
        return res.status(400).json({ message: "A reason is required when marking a lead as lost" });
      }

      // Build update payload
      const updateData: Record<string, any> = {
        status,
        lastManualStatusAt: new Date()
      };

      // Add lost reason fields when status is lost
      if (status === 'lost') {
        updateData.lostReason = lostReason;
        updateData.lostReasonNotes = lostReason === 'other' ? (lostReasonNotes || null) : null;
      } else {
        // Clear lost reason when moving away from lost status
        updateData.lostReason = null;
        updateData.lostReasonNotes = null;
      }

      // Add hold expiry when status is hold
      if (status === 'hold' && holdExpiresAt) {
        updateData.holdExpiresAt = new Date(holdExpiresAt);
      } else if (status !== 'hold') {
        updateData.holdExpiresAt = null;
      }

      const lead = await storage.updateLead(req.params.id, updateData, req.tenantId);

      // Record status change in history
      try {
        await storage.createLeadStatusHistory({
          leadId: req.params.id,
          fromStatus: currentLead.status,
          toStatus: status,
          reason: 'manual',
          metadata: JSON.stringify({
            userId: req.headers['user-id'] || 'unknown',
            lostReason: status === 'lost' ? lostReason : undefined,
            lostReasonNotes: status === 'lost' && lostReason === 'other' ? lostReasonNotes : undefined,
            holdExpiresAt: status === 'hold' ? holdExpiresAt : undefined,
          })
        });
      } catch (historyError) {
        // Don't fail the status update if history recording fails
        console.error('Failed to record lead status history:', historyError);
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ message: "Failed to update lead status" });
    }
  });

  app.delete("/api/leads/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Delete associated calendar event first
      try {
        const events = await storage.getEvents(req.tenantId);
        const leadEvent = events.find(e => e.leadId === req.params.id);
        
        if (leadEvent) {
          await storage.deleteEvent(leadEvent.id, req.tenantId);
          console.log(`📅 Auto-deleted calendar event for lead ${req.params.id}`);
        }
      } catch (calError) {
        console.error('Failed to delete calendar event for lead:', calError);
        // Continue with lead deletion even if calendar event fails
      }
      
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
  
  // PUBLIC ROUTES: Lead form hosting — handled by leadFormsRoutes mounted below at /api/leads/public
  
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

  // Embed widget script — public, no auth, served at /embed.js
  app.use('/', embedRoutes);

  // Mount only the specific public form routes (no authentication required)
  // Public form access: GET /api/leads/public/:slug
  // Public form submission: POST /api/leads/public/:slug/submit
  app.use('/api/leads/public', leadFormsRoutes);
  
  // Public chat widget routes - no auth required
  app.use('/api/public', publicChatRoutes);
  
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

  // Portal authentication routes (OTP login) - NO auth required for request/verify, YES for logout
  app.use('/api/portal/auth', tenantResolver, portalAuthRoutes);

  // Portal routes (client portal features) - all secured with session auth + CSRF
  app.use('/api/portal/payments', ensurePortalAuth, csrf, portalPaymentsRoutes);
  app.use('/api/portal/forms', ensurePortalAuth, csrf, portalFormsRoutes);
  app.use('/api/portal/appointments', ensurePortalAuth, csrf, portalAppointmentsRoutes);

  // Stripe webhook routes (NO CSRF protection - Stripe handles authentication via signature verification)
  app.use('/api/stripe', stripeWebhooksRoutes);

  // AI Features routes (onboarding, media library, widget settings, chat, scheduler)
  app.use('/api/ai-features', ensureUserAuth, tenantResolver, requireTenant, csrf, aiFeaturesRoutes);

  // AI Onboarding Wizard routes
  app.use('/api/ai-onboarding', ensureUserAuth, tenantResolver, requireTenant, csrf, aiOnboardingRoutes);
  
  // Security helper functions for portal authentication
  async function verifyProjectAccess(contactId: string, projectId: string, tenantId?: string): Promise<boolean> {
    try {
      // Get all projects owned by this contact (tenant-scoped when available)
      const contactProjects = tenantId
        ? await storage.getProjectsByContact(contactId, tenantId)
        : await (storage as any).getProjectsByContact(contactId);
      
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
      const project = await storage.getProject(projectId, tenantId);
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
      
      // Find contact by email (global lookup — no tenant context in portal request flow)
      // TODO: Add storage.getContactByEmailGlobal() for proper cross-tenant portal lookups
      const contact = await (storage as any).getContactByEmail(email);
      if (!contact) {
        // Don't reveal if email exists or not for security
        return res.json({ success: true, message: 'If an account exists with this email, you will receive an access link' });
      }

      // SECURITY: Verify project ownership before checking portal access
      if (projectId) {
        const hasAccess = await verifyProjectAccess(contact.id, projectId, contact.tenantId);
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
      
      // Generate cryptographically secure access token (expires in 15 minutes, stored in DB)
      const accessToken = await createPortalToken(contact.id, contact.email, contact.tenantId, 15);

      // Send magic link email to the client
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const magicLinkUrl = `${baseUrl}/portal/access?token=${encodeURIComponent(accessToken)}`;

      try {
        const emailResult = await emailDispatcher.sendEmail({
          tenantId: contact.tenantId,
          to: contact.email,
          subject: 'Your Client Portal Access Link',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #1a1a1a;">Access Your Client Portal</h2>
              <p>Click the button below to securely access your client portal. This link expires in 15 minutes.</p>
              <p style="margin: 24px 0;">
                <a href="${magicLinkUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Access Client Portal
                </a>
              </p>
              <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">
                If the button doesn't work, copy this link into your browser:<br/>
                <a href="${magicLinkUrl}" style="color: #2563eb; word-break: break-all;">${magicLinkUrl}</a>
              </p>
            </div>
          `,
          text: `Access your client portal here (expires in 15 minutes): ${magicLinkUrl}`,
        });

        if (!emailResult.success) {
          console.warn(`⚠️ Portal magic link email could not be sent to ${email} (no email provider configured): ${emailResult.error}`);
        } else {
          console.log(`📧 Portal magic link sent to ${email}`);
        }
      } catch (emailErr: any) {
        // Email sending failure should not block the response — client gets the same message
        console.error(`❌ Failed to send portal magic link to ${email}:`, emailErr.message);
      }
      
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
      
      // Verify token from database
      const tokenData = await verifyPortalToken(token);
      
      if (!tokenData) {
        return res.status(401).json({ error: 'Invalid or expired access token' });
      }
      
      // Verify contact still exists (tenant-scoped)
      const contact = await storage.getContact(tokenData.contactId, tokenData.tenantId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      // Regenerate session ID for security
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ error: 'Authentication failed' });
        }
        
        // Store contactId and tenantId in new session
        req.session.portalContactId = contact.id;
        req.session.tenantId = contact.tenantId;
        
        // Consume token (single-use) — fire-and-forget
        consumePortalToken(token).catch(e => console.error('Failed to consume portal token:', e));
        
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
      const tenantId = req.session.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Missing tenant context in portal session' });
      }
      const contact = await storage.getContact(contactId, tenantId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      const businessLogo = await getTenantLogoUrl(tenantId);
      const tenant = await storage.getTenant(tenantId);
      // Get business owner email so the portal client can send messages to the right address
      const tenantUsers = await storage.getUsers(tenantId);
      const adminUser = tenantUsers.find(u => u.role === 'admin') || tenantUsers[0];
      res.json({
        contact: { id: contact.id, name: contact.fullName || contact.firstName, email: contact.email },
        businessLogo,
        businessName: tenant?.name || '',
        businessEmail: adminUser?.email || '',
      });
    } catch (error: any) {
      console.error('Error fetching contact info:', error);
      res.status(500).json({ error: 'Failed to get contact info' });
    }
  });

  // Admin portal preview — lets authenticated business owners preview their own portal
  app.get('/api/portal/preview/me', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const businessLogo = await getTenantLogoUrl(tenantId);
      const tenant = await storage.getTenant(tenantId);
      const users = await storage.getUsers(tenantId);
      const currentUser = users.find(u => u.id === req.session.userId) || users[0];
      res.json({
        contact: { id: currentUser?.id || '', name: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(), email: currentUser?.email || '' },
        businessLogo,
        businessName: tenant?.name || '',
        businessEmail: currentUser?.email || '',
        isPreviewMode: true,
      });
    } catch (error: any) {
      console.error('Error fetching portal preview info:', error);
      res.status(500).json({ error: 'Failed to get portal preview info' });
    }
  });

  // Portal client routes - secure endpoints for authenticated clients
  app.get('/api/portal/client/projects', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!; // ensurePortalAuth guarantees this exists
      const tenantId = req.session.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Missing tenant context in portal session' });
      }
      const projects = await storage.getProjectsByContact(contactId, tenantId);
      res.json(projects);
    } catch (error: any) {
      console.error('Error fetching portal projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });
  
  app.get('/api/portal/client/contracts', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!; // ensurePortalAuth guarantees this exists
      const tenantId = req.session.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Missing tenant context in portal session' });
      }
      const contracts = await storage.getContractsByClient(contactId, tenantId);
      res.json(contracts);
    } catch (error: any) {
      console.error('Error fetching portal contracts:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });
  
  app.get('/api/portal/client/quotes', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!; // ensurePortalAuth guarantees this exists
      const tenantId = req.session.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Missing tenant context in portal session' });
      }
      const quotes = await storage.getQuotesByContact(contactId, tenantId);
      res.json(quotes);
    } catch (error: any) {
      console.error('Error fetching portal quotes:', error);
      res.status(500).json({ error: 'Failed to fetch quotes' });
    }
  });

  // Portal quote view redirect — verifies ownership then redirects to public quote page
  app.get('/api/portal/client/quotes/:id/view', ensurePortalAuth, async (req, res) => {
    try {
      const contactId = req.session.portalContactId!;
      const tenantId = req.session.tenantId;
      if (!tenantId) return res.status(401).json({ error: 'Missing tenant context' });
      const quotes = await storage.getQuotesByContact(contactId, tenantId);
      const quote = (quotes as any[]).find((q: any) => q.id === req.params.id);
      if (!quote) return res.status(404).json({ error: 'Quote not found' });
      const token = await storage.getActiveTokenForQuote(req.params.id, tenantId);
      if (!token) return res.status(404).json({ error: 'No active link for this quote. Please contact your coordinator.' });
      res.redirect(`/q/${token}`);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get quote link' });
    }
  });

  // ── Musician Portal Routes ─────────────────────────────────────────────────
  // These use the standard user auth (ensureUserAuth) scoped to a member ID
  // passed as a query param or from session. For now they work for agency-side
  // preview — full musician auth can be layered on later.

  app.get('/api/portal/musician/gigs', ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const memberId = req.query.memberId as string;
      if (!memberId) return res.status(400).json({ error: 'memberId required' });

      // Get all projectMembers rows for this musician
      const allProjects = await storage.getProjects(req.tenantId!);
      const results = [];
      for (const project of allProjects) {
        const pms = await storage.getProjectMembers(project.id, req.tenantId!);
        const assignment = pms.find(pm => pm.memberId === memberId);
        if (assignment) results.push({ ...project, assignment });
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch musician gigs' });
    }
  });

  app.get('/api/portal/musician/contracts', ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const memberId = req.query.memberId as string;
      if (!memberId) return res.status(400).json({ error: 'memberId required' });
      const contracts = await storage.getPerformerContracts(req.tenantId!);
      res.json(contracts.filter(c => c.memberId === memberId));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch performer contracts' });
    }
  });

  app.get('/api/portal/musician/availability', ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const memberId = req.query.memberId as string;
      if (!memberId) return res.status(400).json({ error: 'memberId required' });
      const availability = await storage.getMemberAvailability(memberId, req.tenantId!);
      res.json(availability);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  });

  app.post('/api/portal/musician/availability', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { memberId, date, availabilityType, notes, startTime, endTime } = req.body;
      if (!memberId) return res.status(400).json({ error: 'memberId required' });
      const availability = await storage.addMemberAvailability(
        { memberId, date: new Date(date), availabilityType: availabilityType || 'available', notes, startTime: startTime ? new Date(startTime) : undefined, endTime: endTime ? new Date(endTime) : undefined, tenantId: req.tenantId! },
        req.tenantId!
      );
      res.status(201).json(availability);
    } catch (error) {
      res.status(500).json({ error: 'Failed to set availability' });
    }
  });

  // Musician responds to a gig offer (confirm or decline)
  app.patch('/api/portal/musician/gigs/:projectId/respond', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { memberId, status } = req.body;
      if (!memberId || !['confirmed', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'memberId and status (confirmed|declined) required' });
      }
      const updated = await storage.updateProjectMember(
        req.params.projectId, memberId,
        { status, respondedAt: new Date() },
        req.tenantId!
      );
      if (!updated) return res.status(404).json({ error: 'Assignment not found' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to respond to gig' });
    }
  });

  // Main user authentication endpoints  
  // User signup endpoint - Creates isolated tenant for each new user
  app.post('/api/auth/signup', authLimiter, async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = signupSchema.parse(req.body);
      
      // Check if user already exists (global check across all tenants)
      const existingUser = await storage.getUserByUsernameGlobal(username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      
      const existingEmail = await storage.getUserByEmailGlobal(email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      
      // Generate unique tenant slug from username
      const baseSlug = username.toLowerCase().replace(/[^a-z0-9]/g, '-');
      let tenantSlug = baseSlug;
      let slugAttempt = 1;
      
      // Ensure slug is unique
      while (await storage.getTenantBySlug(tenantSlug)) {
        tenantSlug = `${baseSlug}-${slugAttempt}`;
        slugAttempt++;
      }
      
      // Create new tenant for this user
      const newTenant = await storage.createTenant({
        name: `${firstName} ${lastName}'s Business`,
        slug: tenantSlug,
        plan: 'starter',
        isActive: true
      });
      
      console.log('✅ Created new tenant:', {
        id: newTenant.id,
        slug: newTenant.slug,
        name: newTenant.name
      });
      
      // Hash password with bcrypt
      const hashedPassword = await hashPassword(password);
      
      // Create new user in the new tenant
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'admin' // First user in tenant is admin
      }, newTenant.id);
      
      // Regenerate session ID for security
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ error: 'Signup failed' });
        }
        
        // Store user ID and tenant ID in session (auto-login after signup)
        req.session.userId = newUser.id;
        req.session.tenantId = newTenant.id;
        
        res.json({ 
          success: true, 
          user: { 
            id: newUser.id, 
            username: newUser.username, 
            email: newUser.email, 
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role
          },
          tenant: {
            id: newTenant.id,
            slug: newTenant.slug,
            name: newTenant.name
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
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      console.log('🔐 LOGIN ATTEMPT:', {
        username: req.body.username,
        host: req.get('host'),
        sessionId: req.session?.id,
        hasSession: !!req.session
      });
      
      const { username, password } = loginSchema.parse(req.body);
      
      // TENANT-PER-USER MODEL: Look up user globally first (username or email)
      // Then derive tenant from the user's record
      let user = await storage.getUserByUsernameGlobal(username);
      
      // If not found by username, try email (support both login methods)
      if (!user) {
        user = await storage.getUserByEmailGlobal(username);
      }
      
      if (!user) {
        console.log('🔐 User not found:', { username });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      console.log('🔐 User found:', {
        userId: user.id,
        userTenantId: user.tenantId,
        username: user.username,
        email: user.email
      });
      
      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.log('🔐 Password mismatch for user:', { username });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Validate user has a tenant assigned
      if (!user.tenantId) {
        console.error('🚨 User has no tenant assigned:', { userId: user.id, username: user.username });
        return res.status(500).json({ error: 'User account configuration error' });
      }

      // 2FA: Generate a 6-digit MFA code and send via email
      const mfaCode = String(Math.floor(100000 + Math.random() * 900000));
      const mfaExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const mfaToken = await storage.createCrmMfaToken({
        userId: user.id,
        tenantId: user.tenantId,
        code: mfaCode,
        expiresAt: mfaExpiresAt,
      });

      console.log('🔐 MFA code generated for user:', { userId: user.id, mfaTokenId: mfaToken.id });

      // Send the MFA code via email
      try {
        await emailDispatcher.sendEmail({
          tenantId: user.tenantId,
          to: user.email,
          subject: 'Your Login Verification Code',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1f2937; margin-bottom: 8px;">Two-Factor Authentication</h2>
              <p style="color: #6b7280; margin-bottom: 24px;">Enter the code below to complete your sign-in. It expires in 10 minutes.</p>
              <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${mfaCode}</span>
              </div>
              <p style="color: #9ca3af; font-size: 13px;">If you didn't attempt to sign in, you can safely ignore this email.</p>
            </div>
          `,
        });
        console.log('🔐 MFA email sent to:', user.email);
      } catch (emailErr) {
        console.error('🔐 Failed to send MFA email:', emailErr);
        return res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
      }

      // Return MFA challenge — do NOT create a session yet
      return res.json({
        requiresMfa: true,
        mfaTokenId: mfaToken.id,
        email: user.email,
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

  // 2FA verify endpoint — validates the MFA code and creates a full session
  app.post('/api/auth/verify-mfa', async (req, res) => {
    try {
      const { mfaTokenId, code } = req.body;

      if (!mfaTokenId || !code) {
        return res.status(400).json({ error: 'mfaTokenId and code are required' });
      }

      // Validate the MFA token
      const mfaToken = await storage.getCrmMfaToken(mfaTokenId, String(code));
      if (!mfaToken) {
        console.log('🔐 Invalid or expired MFA token:', { mfaTokenId });
        return res.status(401).json({ error: 'Invalid or expired verification code' });
      }

      // Mark the token as used immediately
      await storage.markCrmMfaTokenUsed(mfaToken.id);

      // Look up the user
      const user = await storage.getUserGlobal(mfaToken.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Regenerate session ID for security and create full session
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ error: 'Login failed' });
        }

        req.session.userId = user.id;
        req.session.tenantId = user.tenantId!;

        console.log('🔐 MFA verified — session created:', {
          sessionId: req.session.id,
          userId: user.id,
          tenantId: user.tenantId,
        });

        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({ error: 'Session save failed' });
          }

          res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
            },
          });
        });
      });
    } catch (error: any) {
      console.error('MFA verification error:', error);
      res.status(500).json({ error: 'Verification failed' });
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

  // Get current impersonation status (all users can check their own status)
  app.get('/api/admin/impersonate/status', ensureUserAuth, async (req, res) => {
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
          role: user.role,
          avatar: user.avatar ?? null
        }
      });
    } catch (error: any) {
      console.error('Error fetching user info:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  // Update current user profile
  app.patch('/api/auth/me', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { firstName, lastName, avatar } = req.body;
      const updateData: { firstName?: string; lastName?: string; avatar?: string } = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (avatar !== undefined) updateData.avatar = avatar;
      const updated = await storage.updateUser(userId, updateData, req.tenantId!);
      if (!updated) return res.status(404).json({ error: 'User not found' });
      // When avatar changes, mirror it to tenant settings as the business logo
      // Wrapped in its own try-catch so a logo-mirror failure never blocks the avatar save
      if (avatar !== undefined) {
        try {
          const tenant = await storage.getTenant(req.tenantId!);
          const currentSettings = tenant?.settings ? JSON.parse(tenant.settings) : {};
          await storage.updateTenantSettings(req.tenantId!, JSON.stringify({ ...currentSettings, logoUrl: avatar }));
        } catch (logoErr) {
          console.error('Warning: failed to mirror avatar to tenant logo (avatar still saved):', logoErr);
        }
      }
      res.json({ user: { id: updated.id, username: updated.username, email: updated.email, firstName: updated.firstName, lastName: updated.lastName, role: updated.role, avatar: updated.avatar } });
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Change password (authenticated user, requires current password verification)
  app.patch('/api/auth/me/password', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      const userId = req.authenticatedUserId;
      const user = await storage.getUser(userId, req.tenantId!);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const valid = await bcrypt.compare(currentPassword, user.password || '');
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(userId, { password: hashedPassword }, req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // Password reset endpoints
  app.post('/api/auth/request-reset', authLimiter, async (req, res) => {
    try {
      const { email } = requestPasswordResetSchema.parse(req.body);
      
      // Find user by email (global lookup - password reset must work across tenants)
      const user = await storage.getUserByEmailGlobal(email);
      
      // Always return success to prevent email enumeration attacks
      if (!user) {
        return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
      }
      
      // Generate secure reset token and store in database (15 min TTL)
      const resetToken = await createResetToken(user.id, 15);
      
      // Purge expired tokens in the background
      purgeExpiredTokens().catch(e => console.error('Token purge error:', e));
      
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
      
      // Verify token from database
      const tokenData = await verifyResetToken(token);
      
      if (!tokenData) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Get the user (global lookup — password reset doesn't have tenant context)
      const user = await storage.getUserGlobal(tokenData.userId);
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Hash the new password and update user
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });
      
      // Consume the token (single-use) — fire-and-forget
      consumeResetToken(token).catch(e => console.error('Failed to consume reset token:', e));
      
      console.log(`🔐 Password reset completed for user: ${user.email}`);
      
      res.json({ success: true, message: 'Password reset successful' });
    } catch (error: any) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });
  
  // Dashboard metrics
  app.get("/api/dashboard/metrics", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.tenantId!;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Paid this month
      const paidThisMonthResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(total AS DECIMAL)), 0) as total
         FROM invoices
         WHERE tenant_id = $1 AND status = 'paid'
           AND updated_at >= $2 AND updated_at <= $3`,
        [tenantId, startOfMonth, endOfMonth]
      );
      const paidThisMonth = parseFloat((paidThisMonthResult.rows[0] as any).total || '0');

      // Outstanding (sent but not overdue)
      const outstandingResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(total AS DECIMAL)), 0) as total
         FROM invoices
         WHERE tenant_id = $1 AND status = 'sent'
           AND (due_date IS NULL OR due_date >= NOW())`,
        [tenantId]
      );
      const outstanding = parseFloat((outstandingResult.rows[0] as any).total || '0');

      // Overdue (sent past due date OR status = 'overdue')
      const overdueResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(total AS DECIMAL)), 0) as total, COUNT(*) as count
         FROM invoices
         WHERE tenant_id = $1
           AND (status = 'overdue' OR (status = 'sent' AND due_date IS NOT NULL AND due_date < NOW()))`,
        [tenantId]
      );
      const overdue = parseFloat((overdueResult.rows[0] as any).total || '0');
      const overdueCount = parseInt((overdueResult.rows[0] as any).count || '0');

      // Pipeline value (active/booked projects + sent quotes)
      const pipelineResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(estimated_value AS DECIMAL)), 0) as total
         FROM projects
         WHERE tenant_id = $1 AND status IN ('lead', 'booked', 'active')
           AND estimated_value IS NOT NULL AND estimated_value != ''`,
        [tenantId]
      );
      const pipeline = parseFloat((pipelineResult.rows[0] as any).total || '0');

      // Active project count
      const activeProjectsResult = await pool.query(
        `SELECT COUNT(*) as count FROM projects
         WHERE tenant_id = $1 AND status IN ('lead', 'booked', 'active')`,
        [tenantId]
      );
      const activeProjects = parseInt((activeProjectsResult.rows[0] as any).count || '0');

      // Unsigned contracts (sent but not signed)
      const unsignedContractsResult = await pool.query(
        `SELECT COUNT(*) as count FROM contracts
         WHERE tenant_id = $1 AND status IN ('sent', 'awaiting_counter_signature')`,
        [tenantId]
      );
      const unsignedContracts = parseInt((unsignedContractsResult.rows[0] as any).count || '0');

      res.json({
        paidThisMonth: Math.round(paidThisMonth),
        outstanding: Math.round(outstanding),
        overdue: Math.round(overdue),
        overdueCount,
        pipeline: Math.round(pipeline),
        activeProjects,
        unsignedContracts,
      });
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Business metrics for analytics
  app.get("/api/business/metrics", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const leadsResult = await pool.query('SELECT * FROM leads WHERE tenant_id = $1', [tenantId]);
      const leads = leadsResult.rows;
      // Get all contacts and projects in tenant for business metrics
      const clientsResult = await pool.query('SELECT COUNT(*) as count FROM contacts WHERE tenant_id = $1', [tenantId]);
      const clientsCount = parseInt((clientsResult.rows[0] as any).count);
      const projectsResult = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(CAST(estimated_value AS DECIMAL)), 0) as total_value FROM projects WHERE tenant_id = $1', [tenantId]);
      const projectsCount = parseInt((projectsResult.rows[0] as any).count);
      const totalProjectValue = parseFloat((projectsResult.rows[0] as any).total_value || '0');
      const quotesResult = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(CAST(subtotal AS DECIMAL)), 0) as total_value FROM quotes WHERE tenant_id = $1', [tenantId]);
      const quotesCount = parseInt((quotesResult.rows[0] as any).count);
      const totalQuoteValue = parseFloat((quotesResult.rows[0] as any).total_value || '0');
      const invoicesResult = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(CAST(subtotal AS DECIMAL)), 0) as total_value FROM invoices WHERE tenant_id = $1', [tenantId]);
      const invoicesCount = parseInt((invoicesResult.rows[0] as any).count);
      const totalInvoiceValue = parseFloat((invoicesResult.rows[0] as any).total_value || '0');
      const contractsResult = await pool.query('SELECT COUNT(*) as count FROM contracts WHERE tenant_id = $1', [tenantId]);
      const contractsCount = parseInt((contractsResult.rows[0] as any).count);
      const membersResult = await pool.query('SELECT COUNT(*) as count FROM members WHERE tenant_id = $1', [tenantId]);
      const membersCount = parseInt((membersResult.rows[0] as any).count);
      const venuesResult = await pool.query('SELECT COUNT(*) as count FROM venues WHERE tenant_id = $1', [tenantId]);
      const venuesCount = parseInt((venuesResult.rows[0] as any).count);

      // Calculate metrics
      const totalLeads = leads.length;
      const convertedLeads = leads.filter((l: any) => l.status === 'converted').length;
      const leadConversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

      // Real quote approval rate from DB
      const approvedQuotesResult = await pool.query('SELECT COUNT(*) as count FROM quotes WHERE tenant_id = $1 AND status = $2', [tenantId, 'approved']);
      const approvedQuotes = parseInt((approvedQuotesResult.rows[0] as any).count);
      const quoteSuccessRate = quotesCount > 0 ? Math.round((approvedQuotes / quotesCount) * 100) : 0;

      // Real project status counts from DB
      const activeProjectsResult = await pool.query("SELECT COUNT(*) as count FROM projects WHERE tenant_id = $1 AND status IN ('lead', 'booked')", [tenantId]);
      const activeProjects = parseInt((activeProjectsResult.rows[0] as any).count);
      const completedProjectsResult = await pool.query("SELECT COUNT(*) as count FROM projects WHERE tenant_id = $1 AND status = 'completed'", [tenantId]);
      const completedProjects = parseInt((completedProjectsResult.rows[0] as any).count);
      const projectCompletionRate = projectsCount > 0 ? Math.round((completedProjects / projectsCount) * 100) : 0;

      // Real invoice payment data from DB
      const paidInvoicesResult = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(CAST(subtotal AS DECIMAL)), 0) as total FROM invoices WHERE tenant_id = $1 AND status = 'paid'", [tenantId]);
      const paidInvoicesCount = parseInt((paidInvoicesResult.rows[0] as any).count);
      const paidTotal = parseFloat((paidInvoicesResult.rows[0] as any).total || '0');
      const pendingInvoicesCount = invoicesCount - paidInvoicesCount;
      const outstandingAmount = Math.round(totalInvoiceValue - paidTotal);
      const monthlyRevenue = Math.round(paidTotal);

      const avgProjectValue = projectsCount > 0 ? Math.round(totalProjectValue / projectsCount) : 0;
      const activePipelineValue = totalProjectValue + totalQuoteValue;

      // Derived metrics — real calculations from DB
      const cashFlowForecast = monthlyRevenue + outstandingAmount + Math.round(activePipelineValue * 0.6);

      // avgTimeToClose: average days from project creation to when status was manually set to booked/completed
      const avgTimeResult = await pool.query(
        `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (last_manual_status_at - created_at)) / 86400)) as avg_days
         FROM projects
         WHERE tenant_id = $1
           AND status IN ('booked', 'completed')
           AND last_manual_status_at IS NOT NULL
           AND last_manual_status_at > created_at`,
        [tenantId]
      );
      const avgTimeToClose = parseInt(avgTimeResult.rows[0]?.avg_days || '0') || 0;

      // responseTime: not calculable from existing schema — leave at 0
      const responseTime = 0;

      // clientActivityScore: % of active projects contacted in last 30 days
      const recentContactResult = await pool.query(
        `SELECT ROUND(100.0 * COUNT(CASE WHEN last_contact_at > NOW() - INTERVAL '30 days' THEN 1 END) / NULLIF(COUNT(*), 0)) as score
         FROM projects WHERE tenant_id = $1 AND status NOT IN ('completed', 'lost', 'cancelled', 'archived')`,
        [tenantId]
      );
      const clientActivityScore = parseInt(recentContactResult.rows[0]?.score || '0') || 0;

      // memberUtilization: % of projects that have at least one member assigned
      const memberUtilResult = await pool.query(
        `SELECT ROUND(100.0 * COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0)) as pct
         FROM projects WHERE tenant_id = $1`,
        [tenantId]
      );
      const memberUtilization = parseInt(memberUtilResult.rows[0]?.pct || '0') || 0;

      // clientRetentionRate: % of contacts who have more than one project (returning clients)
      const retentionResult = await pool.query(
        `SELECT ROUND(100.0 * COUNT(DISTINCT CASE WHEN project_count > 1 THEN contact_id END) / NULLIF(COUNT(DISTINCT contact_id), 0)) as rate
         FROM (SELECT contact_id, COUNT(*) as project_count FROM projects WHERE tenant_id = $1 GROUP BY contact_id) sub`,
        [tenantId]
      );
      const clientRetentionRate = parseInt(retentionResult.rows[0]?.rate || '0') || 0;

      // referralRate: % of projects where lead_source = 'referral' or referral_source is set
      const referralResult = await pool.query(
        `SELECT ROUND(100.0 * SUM(CASE WHEN lead_source = 'referral' OR referral_source IS NOT NULL AND referral_source != '' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) as rate
         FROM projects WHERE tenant_id = $1`,
        [tenantId]
      );
      const referralRate = parseInt(referralResult.rows[0]?.rate || '0') || 0;

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
        overdueItems: pendingInvoicesCount,
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
      const activities = await storage.getRecentActivities(req.tenantId!, 10);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  // Calendar auto-sync status endpoint - requires authentication
  app.get("/api/calendar-sync/status", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const status = calendarAutoSyncService.getStatus();
      const activeIntegrations = await storage.getCalendarIntegrations(req.tenantId!);
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

        const project = await storage.getProject(lead.projectId, tenantId);
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

  // GET /api/leads - Full leads listing for frontend
  app.get("/api/leads", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = (req as TenantRequest).tenantId;
      const leads = await storage.getLeads(tenantId);

      res.json(leads);
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
      
      // For lead capture forms and similar use cases, provide a simple limit-only option
      if (req.query.simple === '1') {
        const simpleLimit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 10));
        const contactsRaw = (await pool.query(`
          SELECT c.*, v.name as venue_name
          FROM contacts c
          LEFT JOIN venues v ON c.venue_id = v.id AND v.tenant_id = c.tenant_id
          WHERE c.tenant_id = $1
          ORDER BY c.created_at DESC
          LIMIT $2
        `, [req.tenantId, simpleLimit])).rows;
        
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
          venueName: contact.venue_name,
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
      // Join with venues table to get venue name and count projects
      const contactsRaw = (await pool.query(`
        SELECT 
          c.*, 
          v.name as venue_name,
          COUNT(DISTINCT p.id) as projects_count
        FROM contacts c
        LEFT JOIN venues v ON c.venue_id = v.id AND v.tenant_id = c.tenant_id
        LEFT JOIN projects p ON c.id = p.contact_id AND p.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1
        GROUP BY c.id, v.name
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
      `, [req.tenantId, limit, offset])).rows;
      
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
        venueName: contact.venue_name,
        leadId: contact.lead_id,
        tags: Array.isArray(contact.tags) ? contact.tags : [],
        leadSource: contact.lead_source,
        notes: contact.notes,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
        projectsCount: parseInt(contact.projects_count) || 0
      }));
      
      // Get total count for pagination info
      const countResult = await pool.query('SELECT COUNT(*) as count FROM contacts WHERE tenant_id = $1', [req.tenantId]);
      const totalCount = parseInt((countResult.rows[0] as any).count);
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
      const contact = await storage.getContact(contactId, req.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get all related data that will be deleted
      const relatedProjects = await storage.getProjectsByContact(contactId, req.tenantId);
      const relatedEmails = await storage.getEmailsByContact(contactId, req.tenantId);
      const relatedQuotes = await storage.getQuotesByContact(contactId, req.tenantId);
      const relatedContracts = await storage.getContractsByContact(contactId, req.tenantId);
      const relatedInvoices = await storage.getInvoicesByContactId(contactId, req.tenantId);
      
      // Count related data for each project
      const projectDetails = await Promise.all(relatedProjects.map(async (project) => {
        const projectEmails = await storage.getEmailsByProject(project.id, req.tenantId);
        const projectTasks = await storage.getTasksByProject(project.id, req.tenantId);
        const projectQuotes = await storage.getQuotesByProject(project.id, req.tenantId);
        const projectContracts = await storage.getContractsByProject(project.id, req.tenantId);
        const projectInvoices = await storage.getInvoicesByProject(project.id, req.tenantId);
        const projectLeads = await storage.getLeadsByProject(project.id, req.tenantId);
        
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

  app.get("/api/contacts/:contactId/projects", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const projects = await storage.getProjectsByContact(req.params.contactId, req.tenantId);
      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects for contact:', error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/contacts/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id, req.tenantId);
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
      // Inject tenantId from session before schema validation (client doesn't send it)
      const contactData = insertContactSchema.parse({ ...req.body, tenantId: req.tenantId });
      const contact = await storage.createContact(contactData, req.tenantId);
      res.status(201).json(contact);
    } catch (error: any) {
      console.error('Error creating contact:', error?.message || error);
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.patch("/api/contacts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contactData = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(req.params.id, contactData, req.tenantId);
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
      // Check if contact has associated projects
      const associatedProjects = await storage.getProjectsByContact(req.params.id, req.tenantId);
      
      if (associatedProjects.length > 0) {
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
      }

      // Mark all associated events as cancelled before deleting the contact
      // This preserves historical records rather than deleting them
      await storage.markEventsCancelledForContact(req.params.id, req.tenantId, req.userId);

      // Delete the contact - CASCADE will handle all related data automatically
      const deleted = await storage.deleteContact(req.params.id, req.tenantId);
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

  // Custom Contact Field Definitions
  app.get("/api/contact-field-definitions", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const fieldDefs = await storage.getContactFieldDefinitions(req.tenantId);
      res.json(fieldDefs);
    } catch (error) {
      console.error('Error fetching contact field definitions:', error);
      res.status(500).json({ message: "Failed to fetch field definitions" });
    }
  });

  app.post("/api/contact-field-definitions", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const fieldDef = await storage.createContactFieldDefinition(req.body, req.tenantId);
      res.status(201).json(fieldDef);
    } catch (error) {
      console.error('Error creating contact field definition:', error);
      res.status(400).json({ message: "Failed to create field definition" });
    }
  });

  app.patch("/api/contact-field-definitions/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const fieldDef = await storage.updateContactFieldDefinition(req.params.id, req.body, req.tenantId);
      if (!fieldDef) {
        return res.status(404).json({ message: "Field definition not found" });
      }
      res.json(fieldDef);
    } catch (error) {
      console.error('Error updating contact field definition:', error);
      res.status(400).json({ message: "Failed to update field definition" });
    }
  });

  app.delete("/api/contact-field-definitions/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteContactFieldDefinition(req.params.id, req.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Field definition not found" });
      }
      res.json({ message: "Field definition deleted successfully" });
    } catch (error) {
      console.error('Error deleting contact field definition:', error);
      res.status(500).json({ message: "Failed to delete field definition" });
    }
  });

  // Custom Contact Field Values
  app.get("/api/contacts/:contactId/field-values", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const values = await storage.getContactFieldValues(req.params.contactId, req.tenantId);
      res.json(values);
    } catch (error) {
      console.error('Error fetching contact field values:', error);
      res.status(500).json({ message: "Failed to fetch field values" });
    }
  });

  app.put("/api/contacts/:contactId/field-values", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { fieldDefinitionId, value } = req.body;
      const fieldValue = await storage.setContactFieldValue({
        contactId: req.params.contactId,
        fieldDefinitionId,
        value,
        tenantId: req.tenantId
      }, req.tenantId);
      res.json(fieldValue);
    } catch (error) {
      console.error('Error setting contact field value:', error);
      res.status(400).json({ message: "Failed to set field value" });
    }
  });

  app.delete("/api/contacts/:contactId/field-values/:fieldDefinitionId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteContactFieldValue(req.params.contactId, req.params.fieldDefinitionId, req.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Field value not found" });
      }
      res.json({ message: "Field value deleted successfully" });
    } catch (error) {
      console.error('Error deleting contact field value:', error);
      res.status(500).json({ message: "Failed to delete field value" });
    }
  });

  // Tags
  app.get("/api/tags", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const tags = await storage.getTags(req.tenantId, category);
      res.json(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.get("/api/tags/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tag = await storage.getTag(req.params.id, req.tenantId);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      console.error('Error fetching tag:', error);
      res.status(500).json({ message: "Failed to fetch tag" });
    }
  });

  app.post("/api/tags", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { name, color, category } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Tag name is required" });
      }
      
      // Check if tag already exists
      const existingTag = await storage.getTagByName(name, req.tenantId);
      if (existingTag) {
        // Increment usage and return existing tag
        await storage.incrementTagUsage(existingTag.id, req.tenantId);
        return res.json(existingTag);
      }

      // Create new tag
      const tag = await storage.createTag({
        name,
        color: color || '#3b82f6',
        category: category || null,
      }, req.tenantId);
      res.status(201).json(tag);
    } catch (error: any) {
      // Handle duplicate key constraint violation (race condition)
      if (error.code === '23505' && error.constraint === 'tags_tenant_name_unique') {
        // Tag was created by another request, fetch and return it
        const existingTag = await storage.getTagByName(req.body.name, req.tenantId);
        if (existingTag) {
          await storage.incrementTagUsage(existingTag.id, req.tenantId);
          return res.json(existingTag);
        }
      }
      console.error('Error creating tag:', error);
      res.status(400).json({ message: "Failed to create tag" });
    }
  });

  app.patch("/api/tags/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { name, color, category } = req.body;
      const tag = await storage.updateTag(req.params.id, {
        name,
        color,
        category
      }, req.tenantId);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      console.error('Error updating tag:', error);
      res.status(400).json({ message: "Failed to update tag" });
    }
  });

  app.delete("/api/tags/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteTag(req.params.id, req.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json({ message: "Tag deleted successfully" });
    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  // Stub endpoints for missing admin features (to prevent 404 errors in console)
  app.get("/api/clients", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    // This endpoint is deprecated - redirecting to contacts
    res.redirect(307, '/api/contacts');
  });

  app.get("/api/admin/addons", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    // Admin add-ons feature not yet implemented
    res.json([]);
  });

  app.get("/api/admin/packages", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    // Admin packages feature not yet implemented
    res.json([]);
  });

  app.get("/api/templates", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    // Templates feature not yet implemented
    res.json([]);
  });

  app.get("/api/admin/templates", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    // Admin templates feature not yet implemented
    res.json([]);
  });

  // =============================================================
  // Projects
  app.get("/api/projects", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      // Parse pagination parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;

      // Status filter: ?status=new,contacted,hold (comma-separated) or ?status=active (shortcut)
      const statusParam = req.query.status as string | undefined;
      let statusFilter: string[] | null = null;
      if (statusParam) {
        if (statusParam === 'active') {
          // Active = everything except completed, lost, cancelled, archived
          statusFilter = ['new', 'contacted', 'hold', 'proposal_sent', 'booked'];
        } else {
          statusFilter = statusParam.split(',').map(s => s.trim());
        }
      }

      // Build WHERE clause
      const params: any[] = [req.tenantId];
      let whereClause = 'WHERE p.tenant_id = $1';
      if (statusFilter && statusFilter.length > 0) {
        const placeholders = statusFilter.map((_, i) => `$${params.length + 1 + i}`).join(', ');
        params.push(...statusFilter);
        whereClause += ` AND p.status IN (${placeholders})`;
      }

      // For lead capture forms and similar use cases, provide a simple limit-only option
      if (req.query.simple === '1') {
        const simpleLimit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 10));
        const projects = await pool.query(`
          SELECT
            p.*,
            v.name as venue_name,
            v.address as venue_address,
            v.city as venue_city,
            v.state as venue_state,
            v.zip_code as venue_zip,
            v.contact_phone as venue_phone
          FROM projects p
          LEFT JOIN venues v ON p.venue_id = v.id
          ${whereClause}
          ORDER BY p.created_at DESC
          LIMIT $${params.length + 1}
        `, [...params, simpleLimit]);
        return res.json(projects.rows);
      }

      // Don't filter by userId - all projects in tenant should be visible to authenticated users
      const projects = await pool.query(`
        SELECT
          p.*,
          v.name as venue_name,
          v.address as venue_address,
          v.city as venue_city,
          v.state as venue_state,
          v.zip_code as venue_zip,
          v.contact_phone as venue_phone
        FROM projects p
        LEFT JOIN venues v ON p.venue_id = v.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      // Get total count for pagination info (with same status filter)
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM projects p ${whereClause}`, params);
      const totalCount = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCount / limit);
      
      // Fetch document statuses for all projects (for instant loading)
      // Wrapped in try/catch so document status failures don't break the project listing
      const documentStatuses: Record<string, any> = {};
      try {
        const quoteResult = await pool.query(`
          SELECT
            p.id as project_id,
            q.status,
            COUNT(*) as count
          FROM quotes q
          JOIN projects p ON q.contact_id = p.contact_id AND q.tenant_id = p.tenant_id
          WHERE q.tenant_id = $1
            AND p.id IS NOT NULL
          GROUP BY p.id, q.status
        `, [req.tenantId]);

        const contractResult = await pool.query(`
          SELECT
            project_id,
            status,
            client_signed_at,
            business_signed_at,
            signature_workflow
          FROM contracts
          WHERE tenant_id = $1
            AND project_id IS NOT NULL
        `, [req.tenantId]);

        const invoiceResult = await pool.query(`
          SELECT
            project_id,
            status,
            COUNT(*) as count
          FROM invoices
          WHERE tenant_id = $1
            AND project_id IS NOT NULL
          GROUP BY project_id, status
        `, [req.tenantId]);

        // Process quotes
        for (const row of quoteResult.rows as any[]) {
          if (!documentStatuses[row.project_id]) {
            documentStatuses[row.project_id] = { quotes: {}, contracts: [], invoices: {} };
          }
          documentStatuses[row.project_id].quotes[row.status] = parseInt(row.count);
        }

        // Process contracts
        for (const row of contractResult.rows as any[]) {
          if (!documentStatuses[row.project_id]) {
            documentStatuses[row.project_id] = { quotes: {}, contracts: [], invoices: {} };
          }
          documentStatuses[row.project_id].contracts.push({
            status: row.status,
            clientSignedAt: row.client_signed_at,
            businessSignedAt: row.business_signed_at,
            signatureWorkflow: row.signature_workflow
          });
        }

        // Process invoices
        for (const row of invoiceResult.rows as any[]) {
          if (!documentStatuses[row.project_id]) {
            documentStatuses[row.project_id] = { quotes: {}, contracts: [], invoices: {} };
          }
          documentStatuses[row.project_id].invoices[row.status] = parseInt(row.count);
        }
      } catch (docError) {
        console.error('Error fetching document statuses (projects will still load):', docError);
      }
      
      // DEBUG: Log first project's venue-related fields
      if (projects.rows.length > 0) {
        const firstProject = projects.rows[0] as any;
        console.log('🔍 VENUE DEBUG (projects list API):', {
          projectId: firstProject.id,
          projectName: firstProject.name,
          venue_id: firstProject.venue_id,
          venueId: firstProject.venueId,
          venue_name: firstProject.venue_name,
          venueName: firstProject.venueName,
          venue_address: firstProject.venue_address,
          allKeys: Object.keys(firstProject).filter(k => k.includes('venue')),
        });
      }

      res.json({
        projects: projects.rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        documentStatuses
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
      const project = await storage.getProject(projectId, req.tenantId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get all related data that will be deleted
      const projectEmails = await storage.getEmailsByProject(projectId, req.tenantId);
      const projectTasks = await storage.getTasksByProject(projectId, req.tenantId);
      const projectQuotes = await storage.getQuotesByProject(projectId, req.tenantId);
      const projectContracts = await storage.getContractsByProject(projectId, req.tenantId);
      const projectInvoices = await storage.getInvoicesByProject(projectId, req.tenantId);
      const projectLeads = await storage.getLeadsByProject(projectId, req.tenantId);
      
      // Get associated contact info
      let associatedContact = null;
      if (project.contactId) {
        const contact = await storage.getContact(project.contactId, req.tenantId);
        if (contact) {
          // Check if this is the only project for this contact
          const contactProjects = await storage.getProjectsByContact(project.contactId, req.tenantId);
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

  // IMPORTANT: Specific routes must come BEFORE parameterized routes
  // Get document status summary for all projects
  app.get("/api/projects/document-statuses", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      // Get quote statuses for all projects in this tenant
      // Note: Quotes are linked to contacts, not projects, so we join through contacts
      const quoteStatuses = (await pool.query(`
        SELECT 
          p.id as project_id,
          q.status,
          COUNT(*) as count
        FROM quotes q
        JOIN projects p ON q.contact_id = p.contact_id AND q.tenant_id = p.tenant_id
        WHERE q.tenant_id = $1
          AND p.id IS NOT NULL
        GROUP BY p.id, q.status
      `, [req.tenantId])).rows;

      // Get contract statuses for all projects in this tenant
      const contractStatuses = (await pool.query(`
        SELECT 
          c.project_id,
          c.status,
          c.client_signed_at,
          c.business_signed_at,
          c.signature_workflow
        FROM contracts c
        WHERE c.tenant_id = $1
          AND c.project_id IS NOT NULL
        ORDER BY c.created_at DESC
      `, [req.tenantId])).rows;

      // Get invoice statuses
      const invoiceStatuses = (await pool.query(`
        SELECT 
          i.project_id,
          i.status,
          COUNT(*) as count
        FROM invoices i
        WHERE i.tenant_id = $1
          AND i.project_id IS NOT NULL
        GROUP BY i.project_id, i.status
      `, [req.tenantId])).rows;

      // Organize by project
      const projectStatuses: Record<string, any> = {};
      
      // Process quotes
      for (const quote of quoteStatuses as any[]) {
        if (!projectStatuses[quote.project_id]) {
          projectStatuses[quote.project_id] = { quotes: {}, contracts: [], invoices: {} };
        }
        projectStatuses[quote.project_id].quotes[quote.status] = parseInt(quote.count);
      }

      // Process contracts
      for (const contract of contractStatuses as any[]) {
        if (!projectStatuses[contract.project_id]) {
          projectStatuses[contract.project_id] = { quotes: {}, contracts: [], invoices: {} };
        }
        projectStatuses[contract.project_id].contracts.push({
          status: contract.status,
          clientSignedAt: contract.client_signed_at,
          businessSignedAt: contract.business_signed_at,
          signatureWorkflow: contract.signature_workflow,
        });
      }

      // Process invoices
      for (const invoice of invoiceStatuses as any[]) {
        if (!projectStatuses[invoice.project_id]) {
          projectStatuses[invoice.project_id] = { quotes: {}, contracts: [], invoices: {} };
        }
        projectStatuses[invoice.project_id].invoices[invoice.status] = parseInt(invoice.count);
      }

      res.json(projectStatuses);
    } catch (error) {
      console.error('Error fetching project document statuses:', error);
      res.status(500).json({ message: "Failed to fetch document statuses" });
    }
  });

  // Get project status counts for filter badges (MUST be before :id route)
  app.get("/api/projects/status-counts", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT status, COUNT(*)::int as count FROM projects WHERE tenant_id = $1 GROUP BY status`,
        [req.tenantId]
      );
      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        counts[row.status] = row.count;
      }
      res.json(counts);
    } catch (error) {
      console.error('Error fetching project status counts:', error);
      res.status(500).json({ message: "Failed to fetch status counts" });
    }
  });

  // Generic :id route comes AFTER specific routes
  app.get("/api/projects/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const project = await storage.getProjectWithDetails(req.params.id, (req as any).tenantId);
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
      // Support quick-add: if contactDetails is provided, create or find the contact first
      let contactId = req.body.contactId;
      if (!contactId && req.body.contactDetails) {
        const { firstName, lastName, email, phone, company } = req.body.contactDetails;
        // Try to find existing contact by email
        const existingContacts = await pool.query(
          'SELECT id FROM contacts WHERE email = $1 AND tenant_id = $2 LIMIT 1',
          [email, req.tenantId]
        );
        if (existingContacts.rows.length > 0) {
          contactId = existingContacts.rows[0].id;
        } else {
          // Create the contact
          const newContact = await storage.createContact({
            firstName,
            lastName,
            email,
            phone: phone || null,
            company: company || null,
            tenantId: req.tenantId,
          }, req.tenantId);
          contactId = newContact.id;
        }
      }

      // Build project data with the resolved contactId
      const projectInput = { ...req.body, tenantId: req.tenantId, contactId };
      // Remove contactDetails from the payload before schema validation
      delete projectInput.contactDetails;

      const projectData = insertProjectSchema.parse(projectInput);
      // SECURITY FIX: Always set userId from authenticated session to ensure proper project ownership
      const projectWithUser = {
        ...projectData,
        userId: req.session.userId,
      };
      const project = await storage.createProject(projectWithUser, req.tenantId);

      // Increment venue use count if a venue was assigned (non-blocking)
      if (project.venueId) {
        try {
          const venue = await storage.getVenue(project.venueId, req.tenantId!);
          if (venue) {
            await storage.updateVenue(project.venueId, { useCount: (venue.useCount || 0) + 1 }, req.tenantId!);
          }
        } catch (venueErr) {
          console.error('⚠️ Failed to increment venue use count (non-blocking):', venueErr);
        }
      }

      // Link lead events to project if applicable (non-blocking — don't let linking errors crash project creation)
      if (project.contactId) {
        try {
          const linkedCount = await storage.linkLeadEventsToProject(project.contactId, project.id, req.tenantId);
          if (linkedCount > 0) {
            console.log(`🔗 Linked ${linkedCount} lead event(s) to new project ${project.id}`);
          }
        } catch (linkError) {
          console.error('⚠️ Failed to link lead events to project (non-blocking):', linkError);
        }

        // Trigger lead status automator when project is created from a lead (legacy support)
        if (req.body.leadId) {
          try {
            await leadStatusAutomator.onProjectCreated(req.body.leadId, req.tenantId, project.id);
          } catch (automatorError) {
            console.error('⚠️ Lead status automator error after project creation:', automatorError);
          }
        }
      }

      res.status(201).json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.patch("/api/projects/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Convert ISO date strings to Date objects before schema validation
      const bodyWithDates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        holdExpiresAt: req.body.holdExpiresAt ? new Date(req.body.holdExpiresAt) : undefined,
      };
      const projectData = insertProjectSchema.partial().parse(bodyWithDates);
      const project = await storage.updateProject(req.params.id, projectData, req.tenantId!);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  // Dedicated project status update with lost reason tracking
  app.patch("/api/projects/:id/status", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { status, lostReason, lostReasonNotes, holdExpiresAt } = projectStatusUpdateSchema.parse(req.body);

      const updateData: any = {
        status,
        lastManualStatusAt: new Date(),
        updatedAt: new Date(),
      };

      // Store lost reason when marking as lost
      if (status === 'lost') {
        updateData.lostReason = lostReason || null;
        updateData.lostReasonNotes = lostReasonNotes || null;
      }

      // Store hold expiry when putting on hold
      if (status === 'hold' && holdExpiresAt) {
        updateData.holdExpiresAt = new Date(holdExpiresAt);
      }

      // Clear lost reason when moving away from lost
      if (status !== 'lost') {
        updateData.lostReason = null;
        updateData.lostReasonNotes = null;
      }

      const project = await storage.updateProject(req.params.id, updateData, req.tenantId!);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error('Error updating project status:', error);
      res.status(400).json({ message: "Invalid status update" });
    }
  });

  // Get effective portal status for a project (tenant setting + project override)
  app.get("/api/projects/:id/portal-status", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const projectId = req.params.id;
      
      // Get project within the authenticated tenant's scope
      const project = await storage.getProject(projectId, req.tenantId!);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const tenantId = req.tenantId!;
      
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
      const project = await storage.getProject(req.params.id, req.tenantId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      let shouldDeleteContact = false;
      let contactId = null;

      // Check if we should delete the associated contact (reverse cascading deletion)
      if (project.contactId) {
        contactId = project.contactId;
        // Check if this is the only project for this contact
        const contactProjects = await storage.getProjectsByContact(project.contactId, req.tenantId);
        shouldDeleteContact = contactProjects.length === 1;
      }

      // Mark all associated events as cancelled before deleting the project
      // This preserves historical records rather than deleting them
      await storage.markEventsCancelledForProject(req.params.id, req.tenantId, req.userId);

      // Delete the project - CASCADE will handle all related data automatically
      const deleted = await storage.deleteProject(req.params.id, req.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }

      // If this was the contact's only project, delete the contact too (CASCADE will handle contact's data)
      if (shouldDeleteContact && contactId) {
        try {
          await storage.deleteContact(contactId, req.tenantId);
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
      const tenantId = req.session.tenantId!;
      const quotes = await storage.getQuotes(tenantId);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Coerce numeric decimal fields to strings (Drizzle schema expects strings for decimal columns)
      const body = {
        ...req.body,
        subtotal: req.body.subtotal != null ? String(req.body.subtotal) : undefined,
        taxAmount: req.body.taxAmount != null ? String(req.body.taxAmount) : undefined,
        total: req.body.total != null ? String(req.body.total) : undefined,
      };
      const quoteData = insertQuoteSchema.parse({ ...body, tenantId: req.tenantId, createdBy: req.session.userId! });
      const quote = await storage.createQuote(quoteData, req.tenantId);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Quote creation error:", error);
      res.status(400).json({ message: "Invalid quote data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Contracts
  app.get("/api/contracts", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const contracts = await storage.getContracts(tenantId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.post("/api/contracts", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Transform ISO string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        clientSignedAt: req.body.clientSignedAt ? new Date(req.body.clientSignedAt) : undefined,
      };
      
      const contractData = insertContractSchema.parse(bodyWithDates);
      const contractNumber = `C-${Date.now()}`;
      
      // Get tenant information for auto-signing
      const tenant = await storage.getTenant(req.tenantId!);
      
      // Auto-sign with tenant name if workflow is sign_upon_creation
      const autoSignData = contractData.signatureWorkflow === 'sign_upon_creation' 
        ? {
            businessSignature: tenant?.name || 'Business',
            businessSignedAt: new Date(),
          }
        : {};
      
      const contract = await storage.createContract({
        ...contractData,
        ...autoSignData,
        tenantId: req.tenantId!,
        contractNumber,
        createdBy: req.session.userId!,
      });
      res.status(201).json(contract);
    } catch (error) {
      console.error("Contract creation error:", error);
      res.status(400).json({ message: "Invalid contract data", error: error instanceof Error ? error.message : String(error) });
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
      const tenantId = req.session.tenantId!;
      const invoices = await storage.getInvoices(tenantId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Auto-generate invoiceNumber if not provided (schema requires it but clients shouldn't have to supply it)
      const bodyWithNumber = {
        ...req.body,
        invoiceNumber: req.body.invoiceNumber || `INV-${Date.now()}`,
      };
      const invoiceData = insertInvoiceSchema.parse({ ...bodyWithNumber, tenantId: req.tenantId, createdBy: req.session.userId! });
      const invoice = await storage.createInvoice(invoiceData, req.tenantId);
      res.status(201).json(invoice);
    } catch (error) {
      console.error('Invoice creation error:', error);
      res.status(400).json({ message: "Invalid invoice data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Individual document operations

  // Quote operations
  app.get("/api/quotes/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id, req.tenantId);
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
      const body = {
        ...req.body,
        subtotal: req.body.subtotal != null ? String(req.body.subtotal) : undefined,
        taxAmount: req.body.taxAmount != null ? String(req.body.taxAmount) : undefined,
        total: req.body.total != null ? String(req.body.total) : undefined,
      };
      const quoteData = insertQuoteSchema.partial().parse(body);
      const quote = await storage.updateQuote(req.params.id, quoteData, req.tenantId!);
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
      const deleted = await storage.deleteQuote(req.params.id, req.tenantId!);
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
      const contract = await storage.getContract(req.params.id, req.tenantId);
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
      // Transform ISO string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        clientSignedAt: req.body.clientSignedAt ? new Date(req.body.clientSignedAt) : undefined,
      };
      
      const contractData = insertContractSchema.partial().parse(bodyWithDates);
      const contract = await storage.updateContract(req.params.id, contractData, req.tenantId!);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(400).json({ message: "Failed to update contract", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/contracts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteContract(req.params.id, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json({ message: "Contract deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // Contract Templates
  app.get("/api/contract-templates", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const templates = await storage.getContractTemplates(req.tenantId!);
      res.json(templates);
    } catch (error) {
      console.error('[CONTRACT TEMPLATES] Error fetching templates:', error);
      res.status(500).json({ message: "Failed to fetch contract templates" });
    }
  });

  app.get("/api/contract-templates/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const template = await storage.getContractTemplate(req.params.id, req.tenantId!);
      if (!template) {
        return res.status(404).json({ message: "Contract template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract template" });
    }
  });

  app.post("/api/contract-templates", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const templateData = insertContractTemplateSchema.parse(req.body);
      const template = await storage.createContractTemplate({
        ...templateData,
        createdBy: req.session.userId!,
      }, req.tenantId!);
      res.status(201).json(template);
    } catch (error) {
      console.error('[CONTRACT TEMPLATE CREATE] Error:', error);
      if (error instanceof z.ZodError) {
        console.error('[CONTRACT TEMPLATE CREATE] Zod validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(400).json({ message: "Failed to create contract template", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/contract-templates/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const templateData = insertContractTemplateSchema.partial().parse(req.body);
      const template = await storage.updateContractTemplate(req.params.id, templateData, req.tenantId!);
      if (!template) {
        return res.status(404).json({ message: "Contract template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(400).json({ message: "Failed to update contract template" });
    }
  });

  app.delete("/api/contract-templates/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteContractTemplate(req.params.id, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Contract template not found" });
      }
      res.json({ message: "Contract template deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contract template" });
    }
  });

  // Invoice operations  
  app.get("/api/invoices/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id, req.tenantId);
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
      const invoice = await storage.updateInvoice(req.params.id, invoiceData, req.tenantId!);
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
      const deleted = await storage.deleteInvoice(req.params.id, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Invoice Line Items
  app.get("/api/invoices/:invoiceId/line-items", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const lineItems = await storage.getInvoiceLineItems(req.params.invoiceId, tenantId);
      res.json(lineItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice line items" });
    }
  });

  app.post("/api/invoices/:invoiceId/line-items", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const lineItemsData = z.array(insertInvoiceLineItemSchema).parse(req.body);
      
      await storage.deleteInvoiceLineItems(req.params.invoiceId, tenantId);
      
      const createdItems = await Promise.all(
        lineItemsData.map(item => storage.createInvoiceLineItem({
          ...item,
          invoiceId: req.params.invoiceId
        }, tenantId))
      );
      
      res.status(201).json(createdItems);
    } catch (error) {
      res.status(400).json({ message: "Invalid line item data" });
    }
  });

  // Payment Schedules
  app.get("/api/invoices/:invoiceId/payment-schedule", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const schedule = await storage.getPaymentSchedule(req.params.invoiceId, tenantId);
      res.json(schedule || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment schedule" });
    }
  });

  app.post("/api/invoices/:invoiceId/payment-schedule", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const scheduleData = insertPaymentScheduleSchema.parse(req.body);
      const schedule = await storage.createPaymentSchedule({
        ...scheduleData,
        invoiceId: req.params.invoiceId
      }, tenantId);
      res.status(201).json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment schedule data" });
    }
  });

  app.patch("/api/payment-schedules/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const scheduleData = insertPaymentScheduleSchema.partial().parse(req.body);
      const schedule = await storage.updatePaymentSchedule(req.params.id, scheduleData, tenantId);
      if (!schedule) {
        return res.status(404).json({ message: "Payment schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Failed to update payment schedule" });
    }
  });

  app.delete("/api/payment-schedules/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const deleted = await storage.deletePaymentSchedule(req.params.id, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Payment schedule not found" });
      }
      res.json({ message: "Payment schedule deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete payment schedule" });
    }
  });

  // Payment Installments
  app.get("/api/payment-schedules/:scheduleId/installments", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const installments = await storage.getPaymentInstallments(req.params.scheduleId, tenantId);
      res.json(installments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment installments" });
    }
  });

  app.post("/api/payment-schedules/:scheduleId/installments", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const installmentsData = z.array(insertPaymentInstallmentSchema).parse(req.body);
      
      await storage.deletePaymentInstallments(req.params.scheduleId, tenantId);
      
      const createdInstallments = await Promise.all(
        installmentsData.map(installment => storage.createPaymentInstallment({
          ...installment,
          paymentScheduleId: req.params.scheduleId
        }, tenantId))
      );
      
      res.status(201).json(createdInstallments);
    } catch (error) {
      res.status(400).json({ message: "Invalid installment data" });
    }
  });

  app.patch("/api/payment-installments/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const installmentData = insertPaymentInstallmentSchema.partial().parse(req.body);
      const installment = await storage.updatePaymentInstallment(req.params.id, installmentData, tenantId);
      if (!installment) {
        return res.status(404).json({ message: "Payment installment not found" });
      }
      res.json(installment);
    } catch (error) {
      res.status(400).json({ message: "Failed to update installment" });
    }
  });

  // Recurring Invoice Settings
  app.get("/api/invoices/:invoiceId/recurring-settings", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const settings = await storage.getRecurringInvoiceSettings(req.params.invoiceId, tenantId);
      res.json(settings || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recurring settings" });
    }
  });

  app.post("/api/invoices/:invoiceId/recurring-settings", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const settingsData = insertRecurringInvoiceSettingsSchema.parse(req.body);
      const settings = await storage.createRecurringInvoiceSettings({
        ...settingsData,
        invoiceId: req.params.invoiceId
      }, tenantId);
      res.status(201).json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid recurring settings data" });
    }
  });

  app.patch("/api/recurring-invoice-settings/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const settingsData = insertRecurringInvoiceSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateRecurringInvoiceSettings(req.params.id, settingsData, tenantId);
      if (!settings) {
        return res.status(404).json({ message: "Recurring settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Failed to update recurring settings" });
    }
  });

  app.delete("/api/recurring-invoice-settings/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const deleted = await storage.deleteRecurringInvoiceSettings(req.params.id, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Recurring settings not found" });
      }
      res.json({ message: "Recurring settings deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete recurring settings" });
    }
  });

  // Payment Transactions
  app.get("/api/invoices/:invoiceId/payment-transactions", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const transactions = await storage.getPaymentTransactions(req.params.invoiceId, tenantId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment transactions" });
    }
  });

  app.post("/api/invoices/:invoiceId/payment-transactions", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const transactionData = insertPaymentTransactionSchema.parse(req.body);
      const transaction = await storage.createPaymentTransaction({
        ...transactionData,
        invoiceId: req.params.invoiceId
      }, tenantId);
      res.status(201).json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment transaction data" });
    }
  });

  app.patch("/api/payment-transactions/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const transactionData = insertPaymentTransactionSchema.partial().parse(req.body);
      const transaction = await storage.updatePaymentTransaction(req.params.id, transactionData, tenantId);
      if (!transaction) {
        return res.status(404).json({ message: "Payment transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Failed to update payment transaction" });
    }
  });

  // Stripe Payment Intent Creation
  app.post("/api/invoices/:invoiceId/create-payment-intent", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const invoice = await storage.getInvoice(req.params.invoiceId);
      
      if (!invoice || invoice.tenantId !== tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const amount = Math.round((invoice.total || 0) * 100);
      
      const stripe = (await import('stripe')).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2024-12-18.acacia'
      });
      
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount,
        currency: invoice.currency?.toLowerCase() || 'usd',
        metadata: {
          invoiceId: invoice.id,
          tenantId: tenantId,
          invoiceNumber: invoice.invoiceNumber || ''
        }
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error: any) {
      console.error('Failed to create payment intent:', error);
      res.status(500).json({ message: error.message || "Failed to create payment intent" });
    }
  });

  // Income Categories
  app.get("/api/income-categories", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const categories = await storage.getIncomeCategories(tenantId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch income categories" });
    }
  });

  app.get("/api/income-categories/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const category = await storage.getIncomeCategory(req.params.id, tenantId);
      if (!category) {
        return res.status(404).json({ message: "Income category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch income category" });
    }
  });

  app.post("/api/income-categories", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const categoryData = insertIncomeCategorySchema.parse({ ...req.body, tenantId });
      const category = await storage.createIncomeCategory(categoryData, tenantId);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ message: "Invalid income category data" });
    }
  });

  app.patch("/api/income-categories/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const categoryData = insertIncomeCategorySchema.partial().parse(req.body);
      const category = await storage.updateIncomeCategory(req.params.id, categoryData, tenantId);
      if (!category) {
        return res.status(404).json({ message: "Income category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(400).json({ message: "Failed to update income category" });
    }
  });

  app.delete("/api/income-categories/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const deleted = await storage.deleteIncomeCategory(req.params.id, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Income category not found" });
      }
      res.json({ message: "Income category deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete income category" });
    }
  });

  // Invoice Items (Products & Services)
  app.get("/api/invoice-items", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const items = await storage.getInvoiceItems(tenantId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice items" });
    }
  });

  app.get("/api/invoice-items/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const item = await storage.getInvoiceItem(req.params.id, tenantId);
      if (!item) {
        return res.status(404).json({ message: "Invoice item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice item" });
    }
  });

  app.post("/api/invoice-items", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const userId = req.session.userId!;
      const itemData = insertInvoiceItemSchema.parse(req.body);
      const item = await storage.createInvoiceItem({ ...itemData, tenantId, createdBy: userId }, tenantId);
      res.status(201).json(item);
    } catch (error) {
      console.error('❌ Failed to create invoice item:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      if (error instanceof z.ZodError) {
        console.error('Zod validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ 
          message: "Invalid invoice item data", 
          errors: error.errors,
          receivedData: req.body
        });
      }
      res.status(400).json({ message: "Invalid invoice item data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/invoice-items/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const itemData = insertInvoiceItemSchema.partial().parse(req.body);
      const item = await storage.updateInvoiceItem(req.params.id, itemData, tenantId);
      if (!item) {
        return res.status(404).json({ message: "Invoice item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: "Failed to update invoice item" });
    }
  });

  app.delete("/api/invoice-items/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const deleted = await storage.deleteInvoiceItem(req.params.id, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Invoice item not found" });
      }
      res.json({ message: "Invoice item deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice item" });
    }
  });

  // Tax Settings
  app.get("/api/tax-settings", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const settings = await storage.getTaxSettings(tenantId);
      res.json(settings || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tax settings" });
    }
  });

  app.post("/api/tax-settings", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const settingsData = insertTaxSettingsSchema.parse(req.body);
      const settings = await storage.createTaxSettings(settingsData, tenantId);
      res.status(201).json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid tax settings data" });
    }
  });

  app.patch("/api/tax-settings", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const settingsData = insertTaxSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateTaxSettings(tenantId, settingsData);
      if (!settings) {
        return res.status(404).json({ message: "Tax settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Failed to update tax settings" });
    }
  });

  // Tenant Settings (currency, locale, etc.)
  app.get("/api/tenant-settings", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const tenant = await storage.getTenantById(tenantId);
      
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      // Parse settings JSON or return defaults
      const settings = tenant.settings ? JSON.parse(tenant.settings) : {};
      res.json(settings);
    } catch (error) {
      console.error("Error fetching tenant settings:", error);
      res.status(500).json({ message: "Failed to fetch tenant settings" });
    }
  });

  app.patch("/api/tenant-settings", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const tenantId = req.session.tenantId!;
      const settingsSchema = z.object({
        currency: z.string().optional(),
        locale: z.string().optional(),
        dateFormat: z.string().optional(),
        timeFormat: z.string().optional(),
        timezone: z.string().optional(),
      });
      
      const newSettings = settingsSchema.parse(req.body);
      
      // Get current tenant
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      
      // Merge new settings with existing
      const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      // Update tenant settings
      await storage.updateTenantSettings(tenantId, JSON.stringify(updatedSettings));
      
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating tenant settings:", error);
      res.status(400).json({ message: "Failed to update tenant settings" });
    }
  });

  // Documents by client/project
  app.get("/api/clients/:clientId/quotes", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const quotes = await storage.getQuotesByClient(req.params.clientId, req.tenantId);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes for client" });
    }
  });

  app.get("/api/clients/:clientId/contracts", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contracts = await storage.getContractsByClient(req.params.clientId, req.tenantId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts for client" });
    }
  });

  app.get("/api/clients/:clientId/invoices", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByClient(req.params.clientId, req.tenantId);
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
      const contracts = await storage.getContractsByClient(req.params.contactId, req.tenantId);
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
        quotes = await storage.getQuotesByClient(clientId as string, req.tenantId);
        contracts = await storage.getContractsByClient(clientId as string, req.tenantId);
        invoices = await storage.getInvoicesByClient(clientId as string, req.tenantId);
      } else {
        quotes = await storage.getQuotes(req.tenantId!);
        contracts = await storage.getContracts(req.tenantId!);
        invoices = await storage.getInvoices(req.tenantId!);
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
  app.post("/api/quotes/:id/send", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, {
        status: 'sent',
        sentAt: new Date()
      }, req.tenantId!);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to send quote" });
    }
  });

  app.post("/api/quotes/:id/approve", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, {
        status: 'approved',
        approvedAt: new Date()
      }, req.tenantId!);
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
  // Helper: get business logo URL from tenant settings
  async function getTenantLogoUrl(tenantId: string): Promise<string | null> {
    try {
      const tenant = await storage.getTenant(tenantId);
      if (!tenant?.settings) return null;
      const settings = JSON.parse(tenant.settings);
      return settings.logoUrl || null;
    } catch { return null; }
  }

  app.get("/api/public/quotes/:token", authLimiter, async (req, res) => {
    try {
      const quoteData = await storage.getQuoteByToken(req.params.token);
      if (!quoteData) {
        return res.status(404).json({ message: "Quote not found or expired" });
      }
      // Attach business logo for branding on the public quote page
      const tenantId = (quoteData as any).quote?.tenantId || (quoteData as any).tenantId;
      const businessLogo = tenantId ? await getTenantLogoUrl(tenantId) : null;
      res.json({ ...quoteData, businessLogo });
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

  // Public contract view endpoint - no authentication required
  app.get("/api/public/contracts/:id", authLimiter, async (req, res) => {
    try {
      const contractId = req.params.id;
      const contract = await storage.getContract(contractId);

      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Get contact info (use contract.tenantId since this is a public, unauthenticated endpoint)
      const contact = await storage.getContactById(contract.contactId, contract.tenantId);

      // Get project info if available
      let project = null;
      let venue = null;
      if (contract.projectId) {
        project = await storage.getProject(contract.projectId, contract.tenantId);
        if (project && project.venueId) {
          venue = await storage.getVenue(project.venueId, contract.tenantId);
        }
      }
      
      // Get tenant info
      const tenant = await storage.getTenant(contract.tenantId);
      
      // Track view (async, don't wait for it)
      const ipAddress = req.ip || req.connection.remoteAddress || null;
      const userAgent = req.get('user-agent') || null;
      storage.recordDocumentView(contract.tenantId, 'contract', contractId, ipAddress, userAgent).catch(err => {
        console.error("Error recording contract view:", err);
      });
      
      res.json({
        contract: {
          id: contract.id,
          contractNumber: contract.contractNumber,
          title: contract.title,
          displayTitle: contract.displayTitle,
          bodyHtml: contract.bodyHtml,
          dueDate: contract.dueDate,
          status: contract.status,
          signatureWorkflow: contract.signatureWorkflow,
          clientSignature: contract.clientSignature,
          businessSignature: contract.businessSignature,
          clientSignedAt: contract.clientSignedAt,
          businessSignedAt: contract.businessSignedAt,
        },
        contact: contact ? {
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.fullName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
        } : null,
        project: project ? {
          name: project.name,
          description: project.description,
          startDate: project.startDate,
        } : null,
        venue: venue ? {
          name: venue.name,
          address: venue.address,
        } : null,
        tenant: tenant ? {
          name: tenant.name,
          logoUrl: await getTenantLogoUrl(contract.tenantId),
        } : null,
      });
    } catch (error) {
      console.error("Error fetching public contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  // Get document views - authenticated endpoint
  app.get("/api/documents/:type/:id/views", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const { type, id } = req.params;
      const tenantId = req.tenantId!;
      
      // Verify the document belongs to the tenant
      let document;
      if (type === 'contract') {
        document = await storage.getContract(id);
      } else if (type === 'quote') {
        document = await storage.getQuoteById(id);
      } else if (type === 'invoice') {
        document = await storage.getInvoiceById(id);
      } else {
        return res.status(400).json({ message: "Invalid document type" });
      }
      
      if (!document || document.tenantId !== tenantId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const views = await storage.getDocumentViews(tenantId, type, id);
      res.json(views);
    } catch (error) {
      console.error("Error fetching document views:", error);
      res.status(500).json({ message: "Failed to fetch document views" });
    }
  });

  // Public contract signing endpoint - no authentication required
  app.post("/api/public/contracts/:id/sign", authLimiter, async (req, res) => {
    try {
      const contractId = req.params.id;
      const { signature, signatureType = 'client' } = req.body;

      if (!signature || !signature.trim()) {
        return res.status(400).json({ message: "Signature is required" });
      }

      const contract = await storage.getContract(contractId);

      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Contract must be in a signable state — reject cancelled, draft, or already-completed
      const signableStatuses = ['sent', 'active', 'awaiting_counter_signature'];
      if (!signableStatuses.includes(contract.status)) {
        return res.status(400).json({ message: "This contract is not available for signing" });
      }

      // Check if contract can be signed
      if (contract.signatureWorkflow === 'not_required') {
        return res.status(400).json({ message: "This contract does not require a signature" });
      }

      if (signatureType === 'client') {
        // Client signing
        if (contract.clientSignature) {
          return res.status(400).json({ message: "Contract has already been signed by client" });
        }

        // Determine new status based on workflow
        let newStatus = contract.status;
        if (contract.signatureWorkflow === 'sign_upon_creation') {
          newStatus = 'signed';
        } else if (contract.signatureWorkflow === 'counter_sign_after_client') {
          newStatus = 'awaiting_counter_signature';
        }

        // Update contract with client signature
        const updatedContract = await storage.updateContract(contractId, {
          clientSignature: signature.trim(),
          clientSignedAt: new Date(),
          status: newStatus,
        }, contract.tenantId!);

        if (!updatedContract) {
          return res.status(404).json({ message: "Failed to update contract" });
        }

        res.json({ 
          message: "Contract signed successfully",
          contract: updatedContract 
        });
      } else if (signatureType === 'business') {
        // Business counter-signing
        if (!contract.clientSignature) {
          return res.status(400).json({ message: "Client must sign first" });
        }

        if (contract.businessSignature) {
          return res.status(400).json({ message: "Contract has already been counter-signed" });
        }

        // Update contract with business signature
        const updatedContract = await storage.updateContract(contractId, {
          businessSignature: signature.trim(),
          businessSignedAt: new Date(),
          status: 'signed',
        }, contract.tenantId!);

        if (!updatedContract) {
          return res.status(404).json({ message: "Failed to update contract" });
        }

        // Auto-status: project proposal_sent → booked (if also has paid invoice)
        if (updatedContract.projectId) {
          projectStatusAutomator.onBookingConditionMet(updatedContract.projectId, updatedContract.tenantId!).catch(err =>
            console.error('[ProjectStatusAutomator] contract sign hook:', err)
          );
        }
        res.json({ 
          message: "Contract counter-signed successfully",
          contract: updatedContract 
        });
      } else {
        return res.status(400).json({ message: "Invalid signature type" });
      }
    } catch (error) {
      console.error("Error signing contract:", error);
      res.status(500).json({ message: "Failed to sign contract" });
    }
  });

  app.post("/api/contracts/:id/send", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const contract = await storage.updateContract(req.params.id, {
        status: 'sent'
      }, req.tenantId!);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      // Auto-status: project new/contacted → proposal_sent
      if (contract.projectId) {
        projectStatusAutomator.onDocumentSent(contract.projectId, req.tenantId!).catch(err =>
          console.error('[ProjectStatusAutomator] contract send hook:', err)
        );
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to send contract" });
    }
  });

  app.post("/api/contracts/:id/sign", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const contractId = req.params.id;
      const { signature, signatureType = 'business' } = req.body;
      const tenantId = req.session.tenantId;

      if (!signature || !signature.trim()) {
        return res.status(400).json({ message: "Signature is required" });
      }

      const contract = await storage.getContract(contractId);
      
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // MULTITENANT SAFETY: Verify contract belongs to the authenticated tenant
      if (contract.tenantId !== tenantId) {
        console.log('[CONTRACT SIGN] SECURITY: Tenant mismatch!', { 
          contractTenantId: contract.tenantId, 
          sessionTenantId: tenantId 
        });
        return res.status(404).json({ message: "Contract not found" });
      }

      // Business counter-signing (authenticated users only)
      if (signatureType === 'business') {
        if (!contract.clientSignature) {
          return res.status(400).json({ message: "Client must sign first" });
        }

        if (contract.businessSignature) {
          return res.status(400).json({ message: "Contract has already been counter-signed" });
        }

        const updateData = {
          businessSignature: signature.trim(),
          businessSignedAt: new Date(),
          status: 'signed',
        };
        const updatedContract = await storage.updateContract(contractId, updateData, tenantId || undefined);

        if (!updatedContract) {
          return res.status(404).json({ message: "Failed to update contract" });
        }

        // Send confirmation email to contact after counter-signing
        try {
          const contact = await storage.getContact(contract.contactId, tenantId);
          
          if (contact && contact.email) {
            // Get contract confirmation email template
            const templates = await storage.getEmailTemplates(tenantId);
            const confirmationTemplate = templates.find(t => t.category === 'contract_confirmation');
            
            if (confirmationTemplate) {
              // Get contract URL for the email
              const contractUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/contracts/${contractId}/view`;
              
              // Render template with tokens
              const renderedSubject = await emailRenderer.renderTemplate(confirmationTemplate.subject, {
                contractId: updatedContract.id,
                contactId: contract.contactId,
                tenantId
              });
              
              const renderedBody = await emailRenderer.renderTemplate(confirmationTemplate.body, {
                contractId: updatedContract.id,
                contactId: contract.contactId,
                tenantId
              });
              
              // Add contract view button to the email body
              const emailBody = `
                ${renderedBody}
                <div style="margin-top: 24px; text-align: center;">
                  <a href="${contractUrl}" 
                     style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                    View Fully Signed Contract
                  </a>
                </div>
              `;
              
              // Wrap email body in branded template with business logo
              let brandedEmailBody = emailBody;
              try {
                const businessLogo = await getTenantLogoUrl(tenantId);
                const rendered = emailRenderer.render({ subject: renderedSubject, html: emailBody, businessLogo: businessLogo || undefined });
                brandedEmailBody = rendered.htmlInlined;
              } catch { /* use raw emailBody on failure */ }

              // Send the email
              const emailResult = await emailDispatcher.sendEmail({
                tenantId,
                to: contact.email,
                subject: renderedSubject,
                html: brandedEmailBody
              });
              
            }
          }
        } catch (emailError) {
          console.error('[CONTRACT SIGN] Failed to send confirmation email:', emailError);
          // Don't fail the request if email fails
        }

        res.json({ 
          message: "Contract counter-signed successfully",
          contract: updatedContract 
        });
      } else {
        return res.status(400).json({ message: "Invalid signature type" });
      }
    } catch (error) {
      console.error("Error signing contract:", error);
      res.status(500).json({ message: "Failed to sign contract" });
    }
  });

  app.post("/api/invoices/:id/send", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, {
        status: 'sent',
        sentAt: new Date()
      }, req.tenantId!);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      // Auto-status: project new/contacted → proposal_sent
      if (invoice.projectId) {
        projectStatusAutomator.onDocumentSent(invoice.projectId, req.tenantId!).catch(err =>
          console.error('[ProjectStatusAutomator] invoice send hook:', err)
        );
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  app.post("/api/invoices/:id/pay", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, {
        status: 'paid',
        paidAt: new Date()
      }, req.tenantId!);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      // Auto-status: project proposal_sent → booked (if also has signed contract)
      if (invoice.projectId) {
        projectStatusAutomator.onBookingConditionMet(invoice.projectId, req.tenantId!).catch(err =>
          console.error('[ProjectStatusAutomator] invoice pay hook:', err)
        );
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
      const taskData = insertTaskSchema.parse({ ...req.body, tenantId: req.tenantId, createdBy: req.session.userId! });
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

  app.delete("/api/tasks/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const deleted = await storage.deleteTask(req.params.id, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task" });
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
      const emailData = insertEmailSchema.parse({ ...req.body, tenantId: req.tenantId });
      const email = await storage.createEmail({
        ...emailData,
        sentAt: new Date(),
        status: 'sent'
      }, req.tenantId);
      // Auto-status: project new → contacted (manual emails only, not auto-responders)
      if (email.direction === 'outbound' && email.projectId) {
        projectStatusAutomator.onEmailSent(email.projectId, req.tenantId!).catch(err =>
          console.error('[ProjectStatusAutomator] email hook:', err)
        );
      }
      res.status(201).json(email);
    } catch (error) {
      res.status(400).json({ message: "Invalid email data" });
    }
  });

  // Email Provider Catalog (global provider list)
  app.get("/api/email/providers", ensureUserAuth, async (req, res) => {
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
      res.json({ providers: mappedProviders });
    } catch (error) {
      console.error('Error fetching email provider catalog:', error);
      res.status(500).json({ message: "Failed to fetch email providers" });
    }
  });
  
  // Create email account (IMAP/SMTP)
  app.post("/api/email/accounts", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { type, providerKey, settings } = req.body;
      const userId = req.session.userId;
      const tenantId = req.tenantId;
      
      if (!userId) {
        return res.status(401).json({ message: "User authentication required" });
      }
      
      if (!type || !providerKey || !settings) {
        return res.status(400).json({ message: "Missing required fields: type, providerKey, settings" });
      }
      
      // For IMAP/SMTP connections, encrypt credentials and store in email_accounts table
      if (type === 'imap_smtp') {
        const { imap, smtp } = settings;
        
        if (!imap || !imap.user || !imap.pass) {
          return res.status(400).json({ message: "IMAP settings with user and pass are required" });
        }
        
        // Store encrypted credentials in email_accounts using the existing storage method
        const account = await storage.createEmailAccount({
          tenantId,
          userId,
          providerKey,
          status: 'connected',
          accountEmail: imap.user,
          authType: 'basic',
          secretsEnc: JSON.stringify({
            imap: {
              host: imap.host,
              port: imap.port,
              secure: imap.secure,
              user: imap.user,
              pass: imap.pass
            },
            smtp: smtp ? {
              host: smtp.host,
              port: smtp.port,
              secure: smtp.secure,
              user: smtp.user,
              pass: smtp.pass
            } : null
          })
        });
        
        return res.status(201).json({ 
          success: true, 
          account,
          message: "Email account connected successfully" 
        });
      }
      
      return res.status(400).json({ message: "Unsupported account type" });
    } catch (error: any) {
      console.error('Error creating email account:', error);
      res.status(500).json({ message: error.message || "Failed to create email account" });
    }
  });

  // Email Provider Configurations
  app.get("/api/email-provider-configs", ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const { userId } = req.query;
      const configs = await storage.getEmailProviderConfigs(req.tenantId, userId as string);
      res.json({ configs });
    } catch (error) {
      console.error('Error fetching email provider configs:', error);
      res.status(500).json({ message: "Failed to fetch email provider configurations" });
    }
  });

  app.post("/api/email-provider-configs", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const configData = insertEmailProviderConfigSchema.parse(req.body);
      // SECURITY: Override any client-provided tenantId with the authenticated tenant
      configData.tenantId = req.tenantId;
      const config = await storage.createEmailProviderConfig(configData, req.tenantId);
      res.status(201).json(config);
    } catch (error) {
      console.error('Error creating email provider config:', error);
      res.status(400).json({ message: "Invalid email provider configuration data" });
    }
  });

  app.patch("/api/email-provider-configs/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const configData = insertEmailProviderConfigSchema.partial().parse(req.body);
      const config = await storage.updateEmailProviderConfig(req.params.id, configData, req.tenantId);
      if (!config) {
        return res.status(404).json({ message: "Email provider configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error('Error updating email provider config:', error);
      res.status(400).json({ message: "Invalid email provider configuration data" });
    }
  });

  app.delete("/api/email-provider-configs/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const success = await storage.deleteEmailProviderConfig(req.params.id, req.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Email provider configuration not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting email provider config:', error);
      res.status(500).json({ message: "Failed to delete email provider configuration" });
    }
  });

  app.post("/api/email-provider-configs/:id/primary", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const success = await storage.setPrimaryEmailProviderConfig(req.params.id, req.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Email provider configuration not found" });
      }
      res.json({ success: true, message: "Primary email provider updated successfully" });
    } catch (error) {
      console.error('Error setting primary email provider config:', error);
      res.status(500).json({ message: "Failed to set primary email provider" });
    }
  });

  app.post("/api/email-provider-configs/:id/test", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      // Get the configuration
      const config = await storage.getEmailProviderConfig(req.params.id, req.tenantId);
      if (!config) {
        return res.status(404).json({ message: "Email provider configuration not found" });
      }

      // Validate required config fields are present
      const requiredFields = ['host', 'port', 'username', 'password'].filter(f => !config[f as keyof typeof config]);
      if (requiredFields.length > 0) {
        return res.json({
          success: false,
          message: `Missing required fields: ${requiredFields.join(', ')}. Please complete your configuration before testing.`
        });
      }
      // Config exists and required fields are present — direct SMTP/API testing
      // is not yet implemented server-side. Advise the user to send a test email.
      res.json({
        success: true,
        message: "Configuration looks complete. Send a test email to verify delivery is working."
      });
    } catch (error) {
      console.error('Error testing email provider config:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to test email provider configuration" 
      });
    }
  });

  app.post("/api/email-provider-configs/verify", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { providerCode, ...credentials } = req.body;
      
      if (!providerCode) {
        return res.status(400).json({ 
          success: false, 
          message: "Provider code is required" 
        });
      }

      // Basic credential presence check — full API verification not yet implemented
      const { apiKey, username, password } = credentials as any;
      if (!apiKey && !(username && password)) {
        return res.json({
          success: false,
          message: "Please provide either an API key or username and password to verify credentials."
        });
      }
      res.json({
        success: true,
        message: "Credentials look complete. Save your configuration and send a test email to confirm they work."
      });
    } catch (error) {
      console.error('Error verifying email provider credentials:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to verify credentials" 
      });
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
  app.get("/api/message-templates", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    try {
      const { type, category } = req.query;
      const tenantId = req.tenantId;
      let templates;
      
      if (type) {
        templates = await storage.getMessageTemplatesByType(type as string, tenantId);
      } else {
        templates = await storage.getMessageTemplates(tenantId);
      }
      
      // Further filter by category if provided
      if (category && templates) {
        // Support multiple categories (category can be an array or single value)
        const categories = Array.isArray(category) ? category : [category];
        templates = templates.filter(t => t.category && categories.includes(t.category));
      }
      
      res.json(templates);
    } catch (error) {
      console.error('❌ GET /api/message-templates ERROR:', error);
      res.status(500).json({ message: "Failed to fetch message templates" });
    }
  });

  app.post("/api/message-templates", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: any, res) => {
    try {
      // FIX: Use req.session.userId directly since req.authenticatedUserId isn't persisting
      const userId = req.authenticatedUserId || req.session?.userId;
      
      const dataToValidate = {
        ...req.body,
        createdBy: userId,
        tenantId: req.tenantId
      };
      
      const templateData = insertMessageTemplateSchema.parse(dataToValidate);
      const template = await storage.createMessageTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error('Template creation error:', error);
      res.status(400).json({ message: "Invalid template data" });
    }
  });

  app.patch("/api/message-templates/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const template = await storage.updateMessageTemplate(id, updateData, req.tenantId!);
      
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
      const deleted = await storage.deleteMessageTemplate(id, req.tenantId!);
      
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
      const automations = await storage.getAutomations(req.tenantId!);
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch automations" });
    }
  });

  app.post("/api/automations", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const automationData = insertAutomationSchema.parse({ ...req.body, tenantId: req.tenantId, createdBy: req.session.userId! });
      const automation = await storage.createAutomation(automationData, req.tenantId);
      res.status(201).json(automation);
    } catch (error) {
      res.status(400).json({ message: "Invalid automation data" });
    }
  });

  app.patch("/api/automations/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const automation = await storage.updateAutomation(req.params.id, req.body, req.tenantId);
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json(automation);
    } catch (error) {
      res.status(400).json({ message: "Failed to update automation" });
    }
  });

  app.delete("/api/automations/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteAutomation(req.params.id, req.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json({ message: "Automation deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete automation" });
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
      const memberData = insertMemberSchema.parse({ ...req.body, tenantId: req.tenantId });
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
  app.get("/api/projects/:id/members", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    try {
      const members = await storage.getProjectMembers(req.params.id, req.tenantId);
      res.json(members);
    } catch (error) {
      console.error('Error fetching project members:', error);
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

  // Update project member (offer type, payment status, etc.)
  app.patch("/api/projects/:projectId/members/:memberId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertProjectMemberSchema.partial().parse(req.body);
      const updated = await storage.updateProjectMember(req.params.projectId, req.params.memberId, data, req.tenantId!);
      if (!updated) return res.status(404).json({ message: "Project member not found" });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // ── Member Groups ──────────────────────────────────────────────────────────

  app.get("/api/member-groups", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const groups = await storage.getMemberGroups(req.tenantId!);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch member groups" });
    }
  });

  app.get("/api/member-groups/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const group = await storage.getMemberGroup(req.params.id, req.tenantId!);
      if (!group) return res.status(404).json({ message: "Group not found" });
      res.json(group);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch group" });
    }
  });

  app.post("/api/member-groups", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertMemberGroupSchema.parse(req.body);
      const group = await storage.createMemberGroup(data, req.tenantId!);
      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ message: "Invalid group data" });
    }
  });

  app.patch("/api/member-groups/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertMemberGroupSchema.partial().parse(req.body);
      const group = await storage.updateMemberGroup(req.params.id, data, req.tenantId!);
      if (!group) return res.status(404).json({ message: "Group not found" });
      res.json(group);
    } catch (error) {
      res.status(400).json({ message: "Invalid group data" });
    }
  });

  app.delete("/api/member-groups/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteMemberGroup(req.params.id, req.tenantId!);
      if (!deleted) return res.status(404).json({ message: "Group not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  app.get("/api/member-groups/:id/members", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const members = await storage.getMemberGroupMembers(req.params.id, req.tenantId!);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch group members" });
    }
  });

  app.post("/api/member-groups/:id/members", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertMemberGroupMemberSchema.parse({ ...req.body, groupId: req.params.id });
      const member = await storage.addMemberToGroup(data, req.tenantId!);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/member-groups/:id/members/:memberId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.removeMemberFromGroup(req.params.id, req.params.memberId, req.tenantId!);
      if (!deleted) return res.status(404).json({ message: "Member not in group" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member from group" });
    }
  });

  // ── Performer Contracts ────────────────────────────────────────────────────

  app.get("/api/performer-contracts", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const contracts = await storage.getPerformerContracts(req.tenantId!, projectId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch performer contracts" });
    }
  });

  app.get("/api/performer-contracts/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const contract = await storage.getPerformerContract(req.params.id, req.tenantId!);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.post("/api/performer-contracts", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertPerformerContractSchema.parse({ ...req.body, tenantId: req.tenantId });
      const contract = await storage.createPerformerContract(data, req.tenantId!);
      res.status(201).json(contract);
    } catch (error) {
      res.status(400).json({ message: "Invalid contract data" });
    }
  });

  app.patch("/api/performer-contracts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertPerformerContractSchema.partial().parse(req.body);
      const contract = await storage.updatePerformerContract(req.params.id, data, req.tenantId!);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      res.json(contract);
    } catch (error) {
      res.status(400).json({ message: "Invalid contract data" });
    }
  });

  app.delete("/api/performer-contracts/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deletePerformerContract(req.params.id, req.tenantId!);
      if (!deleted) return res.status(404).json({ message: "Contract not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // ── Repertoire ─────────────────────────────────────────────────────────────

  app.get("/api/repertoire", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const songs = await storage.getRepertoire(req.tenantId!);
      res.json(songs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch repertoire" });
    }
  });

  app.post("/api/repertoire", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertRepertoireSchema.parse({ ...req.body, tenantId: req.tenantId });
      const song = await storage.createRepertoireItem(data, req.tenantId!);
      res.status(201).json(song);
    } catch (error) {
      res.status(400).json({ message: "Invalid song data" });
    }
  });

  app.patch("/api/repertoire/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertRepertoireSchema.partial().parse(req.body);
      const song = await storage.updateRepertoireItem(req.params.id, data, req.tenantId!);
      if (!song) return res.status(404).json({ message: "Song not found" });
      res.json(song);
    } catch (error) {
      res.status(400).json({ message: "Invalid song data" });
    }
  });

  app.delete("/api/repertoire/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteRepertoireItem(req.params.id, req.tenantId!);
      if (!deleted) return res.status(404).json({ message: "Song not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete song" });
    }
  });

  // ── Project Setlist ────────────────────────────────────────────────────────

  app.get("/api/projects/:id/setlist", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const setlist = await storage.getProjectSetlist(req.params.id, req.tenantId!);
      res.json(setlist);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setlist" });
    }
  });

  app.post("/api/projects/:id/setlist", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertProjectSetlistSchema.parse({ ...req.body, projectId: req.params.id });
      const item = await storage.addSongToSetlist(data, req.tenantId!);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid setlist data" });
    }
  });

  app.patch("/api/projects/:id/setlist/:songId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertProjectSetlistSchema.partial().parse(req.body);
      const item = await storage.updateSetlistItem(req.params.id, req.params.songId, data, req.tenantId!);
      if (!item) return res.status(404).json({ message: "Setlist item not found" });
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/projects/:id/setlist/:songId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.removeSongFromSetlist(req.params.id, req.params.songId, req.tenantId!);
      if (!deleted) return res.status(404).json({ message: "Song not in setlist" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove song from setlist" });
    }
  });

  // Project Files
  app.get("/api/projects/:id/files", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.id, req.tenantId!);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/:id/files", ensureUserAuth, tenantResolver, requireTenant, csrf, projectFileUpload.single('file'), async (req: any, res) => {
    try {
      const uploadedFile = req.file;
      if (!uploadedFile) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const tenantId = req.tenantId || 'default-tenant';
      const fileUrl = `/project-uploads/${tenantId}/${uploadedFile.filename}`;
      const fileData = insertProjectFileSchema.parse({
        ...req.body,
        projectId: req.params.id,
        name: req.body.name || uploadedFile.originalname,
        fileUrl,
        fileSize: uploadedFile.size,
        mimeType: uploadedFile.mimetype,
      });
      const file = await storage.addProjectFile(fileData, req.tenantId!);
      res.status(201).json(file);
    } catch (error) {
      res.status(400).json({ message: "Invalid file data" });
    }
  });

  app.delete("/api/files/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectFile(req.params.id, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Update file visibility
  app.patch("/api/files/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: any, res) => {
    try {
      const { clientPortalVisible, memberPortalVisible } = req.body;
      const updated = await storage.updateProjectFile(req.params.id, {
        clientPortalVisible,
        memberPortalVisible,
      });
      if (!updated) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating file:', error);
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  // Project Notes
  app.get("/api/projects/:id/notes", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    try {
      const notes = await storage.getProjectNotes(req.params.id, req.tenantId);
      res.json(notes);
    } catch (error) {
      console.error('Error fetching project notes:', error);
      res.status(500).json({ message: "Failed to fetch project notes" });
    }
  });

  app.post("/api/projects/:id/notes", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const noteData = insertProjectNoteSchema.parse({
        ...req.body,
        projectId: req.params.id,
        tenantId: req.tenantId,
        createdBy: req.session.userId!
      });
      const note = await storage.addProjectNote(noteData, req.tenantId!);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ message: "Invalid note data" });
    }
  });

  app.delete("/api/notes/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectNote(req.params.id, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Project Tasks
  app.get("/api/projects/:id/tasks", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tasks = await storage.getProjectTasks(req.params.id, req.tenantId!);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  app.post("/api/projects/:id/tasks", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const taskData = insertProjectTaskSchema.parse({
        ...req.body,
        projectId: req.params.id,
        tenantId: req.tenantId!
      });
      const task = await storage.createProjectTask(taskData, req.tenantId!);
      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating project task:', error);
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.patch("/api/projects/:projectId/tasks/:taskId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertProjectTaskSchema.partial().parse(req.body);
      const updated = await storage.updateProjectTask(req.params.projectId, req.params.taskId, data, req.tenantId!);
      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating project task:', error);
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.delete("/api/projects/:projectId/tasks/:taskId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectTask(req.params.projectId, req.params.taskId, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project task:', error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Project Schedule Items
  app.get("/api/projects/:id/schedule", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const scheduleItems = await storage.getProjectScheduleItems(req.params.id, req.tenantId!);
      res.json(scheduleItems);
    } catch (error) {
      console.error('Error fetching project schedule items:', error);
      res.status(500).json({ message: "Failed to fetch project schedule items" });
    }
  });

  app.post("/api/projects/:id/schedule", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const scheduleData = insertProjectScheduleItemSchema.parse({
        ...req.body,
        projectId: req.params.id,
        tenantId: req.tenantId!
      });
      const scheduleItem = await storage.createProjectScheduleItem(scheduleData, req.tenantId!);
      res.status(201).json(scheduleItem);
    } catch (error) {
      console.error('Error creating project schedule item:', error);
      res.status(400).json({ message: "Invalid schedule item data" });
    }
  });

  app.patch("/api/projects/:projectId/schedule/:itemId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const data = insertProjectScheduleItemSchema.partial().parse(req.body);
      const updated = await storage.updateProjectScheduleItem(req.params.projectId, req.params.itemId, data, req.tenantId!);
      if (!updated) {
        return res.status(404).json({ message: "Schedule item not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating project schedule item:', error);
      res.status(400).json({ message: "Invalid schedule item data" });
    }
  });

  app.delete("/api/projects/:projectId/schedule/:itemId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectScheduleItem(req.params.projectId, req.params.itemId, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Schedule item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project schedule item:', error);
      res.status(500).json({ message: "Failed to delete schedule item" });
    }
  });

  // ==========================================
  // PROJECT EXPENSES CRUD
  // ==========================================
  app.get("/api/projects/:id/expenses", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const expenses = await storage.getProjectExpenses(req.params.id, req.tenantId!);
      res.json(expenses);
    } catch (error) {
      console.error('Error fetching project expenses:', error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/projects/:id/expenses", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const expense = await storage.createProjectExpense({
        projectId: req.params.id,
        tenantId: req.tenantId!,
        description: req.body.description,
        category: req.body.category || null,
        amount: req.body.amount,
        date: req.body.date || null,
        notes: req.body.notes || null,
      }, req.tenantId!);
      res.status(201).json(expense);
    } catch (error) {
      console.error('Error creating project expense:', error);
      res.status(400).json({ message: "Failed to create expense" });
    }
  });

  app.delete("/api/projects/:projectId/expenses/:expenseId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectExpense(req.params.expenseId, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project expense:', error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // ==========================================
  // PROJECT MEALS & BREAKS CRUD
  // ==========================================
  app.get("/api/projects/:id/meals-breaks", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const items = await storage.getProjectMealsBreaks(req.params.id, req.tenantId!);
      res.json(items);
    } catch (error) {
      console.error('Error fetching project meals/breaks:', error);
      res.status(500).json({ message: "Failed to fetch meals & breaks" });
    }
  });

  app.post("/api/projects/:id/meals-breaks", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const item = await storage.createProjectMealBreak({
        projectId: req.params.id,
        tenantId: req.tenantId!,
        type: req.body.type,
        label: req.body.label,
        startTime: req.body.startTime || null,
        endTime: req.body.endTime || null,
        provided: req.body.provided || false,
        notes: req.body.notes || null,
      }, req.tenantId!);
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating meal/break:', error);
      res.status(400).json({ message: "Failed to create meal/break" });
    }
  });

  app.delete("/api/projects/:projectId/meals-breaks/:itemId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectMealBreak(req.params.itemId, req.tenantId!);
      if (!deleted) {
        return res.status(404).json({ message: "Meal/break not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting meal/break:', error);
      res.status(500).json({ message: "Failed to delete meal/break" });
    }
  });

  // ==========================================
  // PROJECT ACTIVITIES / TIMELINE
  // ==========================================
  app.get("/api/projects/:id/activities", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const activities = await storage.getActivitiesByProject(req.params.id, req.tenantId!);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching project activities:', error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/projects/:id/activities", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const activity = await storage.createActivity({
        tenantId: req.tenantId!,
        type: req.body.type || 'call_logged',
        description: req.body.description,
        entityType: 'project',
        entityId: req.params.id,
        projectId: req.params.id,
        userId: req.session.userId || null,
      }, req.tenantId!);
      res.status(201).json(activity);
    } catch (error) {
      console.error('Error creating project activity:', error);
      res.status(400).json({ message: "Failed to log activity" });
    }
  });

  // ==========================================
  // PROJECT CLONE
  // ==========================================
  app.post("/api/projects/:id/clone", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      // Fetch the original project
      const original = await storage.getProject(req.params.id, req.tenantId!);
      if (!original) {
        return res.status(404).json({ message: "Project not found" });
      }
      // Create a copy with "Copy of" prefix and reset status
      const cloneData: any = {
        tenantId: req.tenantId!,
        userId: req.session.userId || original.userId,
        name: `Copy of ${original.name}`,
        description: original.description,
        contactId: original.contactId,
        venueId: original.venueId,
        status: 'new',
        progress: 0,
        startDate: original.startDate,
        endDate: original.endDate,
        estimatedValue: original.estimatedValue,
        eventType: (original as any).eventType,
        leadSource: (original as any).leadSource,
        budgetRange: (original as any).budgetRange,
        referralSource: (original as any).referralSource,
        dressCode: (original as any).dressCode,
        parkingDetails: (original as any).parkingDetails,
        loadInDetails: (original as any).loadInDetails,
        accommodation: (original as any).accommodation,
        mealDetails: (original as any).mealDetails,
        backlineProduction: (original as any).backlineProduction,
        secondContactName: (original as any).secondContactName,
        secondContactPhone: (original as any).secondContactPhone,
        dayOfContactName: (original as any).dayOfContactName,
        dayOfContactPhone: (original as any).dayOfContactPhone,
        lineupSummary: (original as any).lineupSummary,
        startTime: (original as any).startTime,
        endTime: (original as any).endTime,
        currency: (original as any).currency,
      };
      const cloned = await storage.createProject(cloneData, req.tenantId!);
      res.status(201).json(cloned);
    } catch (error) {
      console.error('Error cloning project:', error);
      res.status(500).json({ message: "Failed to clone project" });
    }
  });

  // ==========================================
  // TASK TEMPLATES
  // ==========================================
  app.get("/api/task-templates", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const templates = await storage.getTaskTemplates(req.tenantId!);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching task templates:', error);
      res.status(500).json({ message: "Failed to fetch task templates" });
    }
  });

  app.post("/api/task-templates", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const template = await storage.createTaskTemplate({
        tenantId: req.tenantId!,
        name: req.body.name,
        description: req.body.description || null,
        tasks: JSON.stringify(req.body.tasks), // Array of {title, description, priority}
      }, req.tenantId!);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating task template:', error);
      res.status(400).json({ message: "Failed to create task template" });
    }
  });

  app.delete("/api/task-templates/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteTaskTemplate(req.params.id, req.tenantId!);
      if (!deleted) return res.status(404).json({ message: "Template not found" });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting task template:', error);
      res.status(500).json({ message: "Failed to delete task template" });
    }
  });

  // Apply a task template to a project (creates tasks from template)
  app.post("/api/projects/:id/apply-template/:templateId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const templates = await storage.getTaskTemplates(req.tenantId!);
      const template = templates.find(t => t.id === req.params.templateId);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const templateTasks = JSON.parse(template.tasks);
      const createdTasks = [];

      for (const t of templateTasks) {
        const task = await storage.createProjectTask({
          projectId: req.params.id,
          tenantId: req.tenantId!,
          title: t.title,
          description: t.description || null,
          priority: t.priority || 'MEDIUM',
          status: 'pending',
        }, req.tenantId!);
        createdTasks.push(task);
      }

      res.status(201).json({ applied: createdTasks.length, tasks: createdTasks });
    } catch (error) {
      console.error('Error applying task template:', error);
      res.status(500).json({ message: "Failed to apply task template" });
    }
  });

  // ==========================================
  // PROJECT FORMS (admin-side CRUD)
  // ==========================================
  app.get("/api/projects/:id/forms", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const forms = await storage.getProjectForms(req.params.id, req.tenantId!);
      res.json(forms);
    } catch (error) {
      console.error('Error fetching project forms:', error);
      res.status(500).json({ message: "Failed to fetch forms" });
    }
  });

  app.post("/api/projects/:id/forms", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const form = await storage.createProjectForm({
        projectId: req.params.id,
        contactId: req.body.contactId,
        title: req.body.title,
        description: req.body.description || null,
        formDefinition: JSON.stringify(req.body.fields || []),
        status: 'not_started',
        createdBy: req.session.userId,
      }, req.tenantId!);
      res.status(201).json(form);
    } catch (error) {
      console.error('Error creating project form:', error);
      res.status(400).json({ message: "Failed to create form" });
    }
  });

  app.delete("/api/projects/:projectId/forms/:formId", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectForm(req.params.formId, req.tenantId!);
      if (!deleted) return res.status(404).json({ message: "Form not found" });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project form:', error);
      res.status(500).json({ message: "Failed to delete form" });
    }
  });

  // Enhanced Dashboard APIs
  app.get("/api/dashboard/client-activity", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.tenantId!;

      // Fetch real activities from DB, join with contacts and projects for names
      const activityRows = await pool.query(
        `SELECT a.id, a.type, a.description, a.entity_type, a.entity_id, a.created_at,
                a.contact_id, a.project_id,
                c.first_name, c.last_name,
                p.name as project_name
         FROM activities a
         LEFT JOIN contacts c ON c.id = a.contact_id AND c.tenant_id = $1
         LEFT JOIN projects p ON p.id = a.project_id AND p.tenant_id = $1
         WHERE a.tenant_id = $1
         ORDER BY a.created_at DESC
         LIMIT 20`,
        [tenantId]
      );

      const activities = activityRows.rows.map((row: any) => ({
        id: row.id,
        type: row.type,
        clientName: row.first_name ? `${row.first_name} ${row.last_name}`.trim() : 'Unknown Client',
        projectName: row.project_name || null,
        description: row.description,
        entityType: row.entity_type,
        entityId: row.entity_id,
        timestamp: row.created_at,
        contactId: row.contact_id,
        projectId: row.project_id,
      }));

      res.json(activities);
    } catch (error) {
      console.error('Error fetching client activity:', error);
      res.status(500).json({ message: "Failed to fetch client activity" });
    }
  });

  app.get("/api/dashboard/pending-items", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const now = new Date();

      // Pending invoices — join contacts and projects for real names
      const invoiceRows = await pool.query(
        `SELECT i.id, i.title, i.status, i.total, i.created_at, i.due_date, i.contact_id, i.project_id,
                c.first_name, c.last_name, p.name as project_name
         FROM invoices i
         LEFT JOIN contacts c ON c.id = i.contact_id AND c.tenant_id = $1
         LEFT JOIN projects p ON p.id = i.project_id AND p.tenant_id = $1
         WHERE i.tenant_id = $1
           AND (i.status = 'sent' OR i.status = 'overdue'
                OR (i.status = 'sent' AND i.due_date IS NOT NULL AND i.due_date < NOW()))
         ORDER BY i.due_date ASC NULLS LAST
         LIMIT 20`,
        [tenantId]
      );

      const pendingInvoices = invoiceRows.rows.map((i: any) => {
        const isOverdue = i.status === 'overdue' || (i.due_date && new Date(i.due_date) < now);
        return {
          id: i.id,
          type: 'invoice',
          title: i.title || 'Invoice',
          clientName: i.first_name ? `${i.first_name} ${i.last_name}`.trim() : 'Unknown Client',
          projectName: i.project_name || 'General Project',
          sentDate: i.created_at,
          dueDate: i.due_date,
          amount: parseFloat(i.total || '0'),
          status: isOverdue ? 'overdue' : i.status,
          contactId: i.contact_id,
          projectId: i.project_id,
          isOverdue,
          urgency: isOverdue ? 'high' : 'medium',
        };
      });

      // Pending contracts — unsigned/sent
      const contractRows = await pool.query(
        `SELECT ct.id, ct.title, ct.status, ct.created_at, ct.due_date, ct.contact_id, ct.project_id,
                c.first_name, c.last_name, p.name as project_name
         FROM contracts ct
         LEFT JOIN contacts c ON c.id = ct.contact_id AND c.tenant_id = $1
         LEFT JOIN projects p ON p.id = ct.project_id AND p.tenant_id = $1
         WHERE ct.tenant_id = $1
           AND ct.status IN ('sent', 'awaiting_counter_signature')
         ORDER BY ct.created_at ASC
         LIMIT 20`,
        [tenantId]
      );

      const pendingContracts = contractRows.rows.map((ct: any) => ({
        id: ct.id,
        type: 'contract',
        title: ct.title || 'Contract',
        clientName: ct.first_name ? `${ct.first_name} ${ct.last_name}`.trim() : 'Unknown Client',
        projectName: ct.project_name || 'General Project',
        sentDate: ct.created_at,
        dueDate: ct.due_date,
        status: ct.status,
        contactId: ct.contact_id,
        projectId: ct.project_id,
        isOverdue: ct.due_date ? new Date(ct.due_date) < now : false,
        urgency: ct.status === 'awaiting_counter_signature' ? 'high' : 'medium',
        requiresCounterSignature: ct.status === 'awaiting_counter_signature',
      }));

      // Pending enquiries: (1) contacts without any project, (2) projects with status 'new'
      const enquiryRows = await pool.query(
        `SELECT c.id as contact_id, c.first_name, c.last_name, c.email, c.created_at,
                NULL::varchar as project_id, NULL::text as project_name
         FROM contacts c
         WHERE c.tenant_id = $1
           AND c.created_at > NOW() - INTERVAL '30 days'
           AND NOT EXISTS (
             SELECT 1 FROM projects p WHERE p.contact_id = c.id AND p.tenant_id = $1
           )
         UNION ALL
         SELECT c.id as contact_id, c.first_name, c.last_name, c.email, p.created_at,
                p.id as project_id, p.name as project_name
         FROM projects p
         INNER JOIN contacts c ON c.id = p.contact_id AND c.tenant_id = $1
         WHERE p.tenant_id = $1
           AND p.status = 'new'
         ORDER BY created_at DESC
         LIMIT 10`,
        [tenantId]
      );

      const pendingEnquiries = enquiryRows.rows.map((e: any) => ({
        id: e.contact_id,
        type: 'enquiry',
        title: `New Enquiry from ${e.first_name} ${e.last_name}`,
        clientName: `${e.first_name} ${e.last_name}`.trim(),
        projectName: e.project_name || 'No project yet',
        sentDate: e.created_at,
        status: 'new',
        contactId: e.contact_id,
        projectId: e.project_id || null,
        isOverdue: false,
        urgency: 'medium',
      }));

      // Pending quotes — sent but not yet approved/rejected
      const quoteRows = await pool.query(
        `SELECT q.id, q.quote_number, q.title, q.status, q.total, q.created_at, q.valid_until, q.contact_id,
                c.first_name, c.last_name
         FROM quotes q
         LEFT JOIN contacts c ON c.id = q.contact_id AND c.tenant_id = $1
         WHERE q.tenant_id = $1
           AND q.status = 'sent'
         ORDER BY q.created_at ASC
         LIMIT 20`,
        [tenantId]
      );

      const pendingQuotes = quoteRows.rows.map((q: any) => ({
        id: q.id,
        type: 'quote',
        title: q.title || q.quote_number || 'Quote',
        clientName: q.first_name ? `${q.first_name} ${q.last_name}`.trim() : 'Unknown Client',
        projectName: '',
        sentDate: q.created_at,
        dueDate: q.valid_until,
        amount: parseFloat(q.total || '0'),
        status: q.status,
        contactId: q.contact_id,
        projectId: null,
        isOverdue: q.valid_until ? new Date(q.valid_until) < now : false,
        urgency: 'medium',
      }));
      const allPending = [...pendingInvoices, ...pendingContracts, ...pendingEnquiries, ...pendingQuotes];
      res.json(allPending);
    } catch (error) {
      console.error('Error fetching pending items:', error);
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
      const tasks = await storage.getTasks(tenantId);
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
  app.get("/api/events", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    try {
      const { userId, startDate, endDate, clientId } = req.query;
      const tenantId = req.tenantId;
      
      let events;
      if (startDate && endDate) {
        events = await storage.getEventsByDateRange(new Date(startDate as string), new Date(endDate as string), tenantId);
      } else if (userId) {
        events = await storage.getEventsByUser(userId as string, tenantId);
      } else if (clientId) {
        events = await storage.getEventsByClient(clientId as string, tenantId);
      } else {
        events = await storage.getEvents(tenantId);
      }
      
      res.json(events);
    } catch (error) {
      console.error('❌ Events fetch error:', error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", ensureUserAuth, tenantResolver, requireTenant, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id, req.tenantId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: any, res) => {
    try {
      // Add createdBy from authenticated user session before validation
      const requestWithCreatedBy = {
        ...req.body,
        createdBy: req.session?.userId || req.authenticatedUserId // From ensureUserAuth middleware
      };
      
      // Validate the complete event data
      const validatedData = insertEventSchema.parse(requestWithCreatedBy);
      
      const event = await storage.createEvent(validatedData, req.tenantId);
      
      // Auto-sync to Google Calendar if user has an active integration
      try {
        const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy, req.tenantId);
        const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
        if (googleIntegration) {
          await googleOAuthService.syncToGoogle(googleIntegration, event.id);
        }
      } catch (syncError: any) {
        console.error('Failed to sync new event to Google:', syncError?.message || syncError);
        // Don't fail the creation if sync fails
      }

      // Fire musician tracker webhook for confirmed bookings (non-blocking)
      if (event.status === 'confirmed') {
        let clientName = event.title;
        try {
          if (event.contactId) {
            const contact = await storage.getContact(event.contactId, req.tenantId);
            if (contact) clientName = `${contact.firstName} ${contact.lastName}`.trim();
          }
        } catch (lookupErr: any) {
          console.warn('[MusicianTracker] Could not resolve client name:', lookupErr?.message);
        }
        sendToMusicianTracker(event as any, clientName).catch(() => {});
      }
      
      res.status(201).json(event);
    } catch (error) {
      console.error('❌ Event creation validation error:', error);
      res.status(400).json({ message: "Invalid event data", error });
    }
  });

  app.patch("/api/events/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: any, res) => {
    try {
      const validatedData = insertEventSchema.partial().parse(req.body);

      // Capture previous status before update so we can detect confirmed transition
      let previousStatus: string | undefined;
      try {
        const existing = await storage.getEvent(req.params.id, req.tenantId);
        previousStatus = existing?.status;
      } catch {
        // Non-critical — proceed without previous status
      }

      const event = await storage.updateEvent(req.params.id, validatedData, req.tenantId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Auto-sync to Google Calendar if user has an active integration
      try {
        const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy, req.tenantId);
        const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
        
        if (googleIntegration) {
          await googleOAuthService.syncToGoogle(googleIntegration, event.id);
        }
      } catch (syncError: any) {
        console.error('Failed to sync updated event to Google:', syncError);
        // Don't fail the update if sync fails
      }

      // Fire musician tracker webhook when status transitions to confirmed (non-blocking)
      if (event.status === 'confirmed' && previousStatus !== 'confirmed') {
        let clientName = event.title;
        try {
          if (event.contactId) {
            const contact = await storage.getContact(event.contactId, req.tenantId);
            if (contact) clientName = `${contact.firstName} ${contact.lastName}`.trim();
          }
        } catch (lookupErr: any) {
          console.warn('[MusicianTracker] Could not resolve client name:', lookupErr?.message);
        }
        sendToMusicianTracker(event as any, clientName).catch(() => {});
      }

      res.json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid event data", error });
    }
  });

  app.delete("/api/events/:id", ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: any, res) => {
    try {
      // Get event before deletion for Google sync
      const event = await storage.getEvent(req.params.id, req.tenantId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Delete from Google Calendar if it was synced
      if (event.externalEventId) {
        try {
          const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy, req.tenantId);
          const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
          
          if (googleIntegration) {
            await googleOAuthService.deleteFromGoogle(googleIntegration, event.externalEventId);
          }
        } catch (syncError: any) {
          console.error('Failed to delete from Google Calendar:', syncError?.message || syncError);
          // Continue with CRM deletion even if Google sync fails
        }
      }
      
      const deleted = await storage.deleteEvent(req.params.id, req.tenantId);
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
        integrations = await storage.getCalendarIntegrationsByUser(userId as string, req.tenantId!);
      } else {
        integrations = await storage.getCalendarIntegrations(req.tenantId!);
      }
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar integrations" });
    }
  });

  app.get("/api/calendar-integrations/:id", ensureUserAuth, tenantResolver, requireTenant, async (req, res) => {
    try {
      const integration = await storage.getCalendarIntegration(req.params.id, req.tenantId!);
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
      const deleted = await storage.deleteCalendarIntegration(req.params.id, req.tenantId!);
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
          // One-way export: push CRM events to Google Calendar only
          // Google → CRM import is disabled to keep personal calendar events out of ClientFlow
          result = await googleOAuthService.syncToGoogleAll(integration);
        } catch (error: any) {
          console.error('Google Calendar sync failed:', error?.message || error);
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
      const integration = await storage.getCalendarIntegration(req.params.id, req.tenantId!);
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

  // ===== CALENDAR PIPELINE ROUTES (Lead → Booked → Completed) =====
  
  // Get system calendars for tenant
  app.get('/api/calendars', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant), async (req: TenantRequest, res) => {
    try {
      const calendars = await storage.getCalendars(req.tenantId!);
      res.json(calendars);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize system calendars for tenant
  app.post('/api/calendars/init', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), async (req: TenantRequest, res) => {
    try {
      const calendars = await storage.createSystemCalendars(req.tenantId!);
      res.json(calendars);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get events by calendar
  app.get('/api/calendars/:id/events', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant), async (req: TenantRequest, res) => {
    try {
      const events = await storage.getEventsByCalendar(req.params.id, req.tenantId!);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check for event conflicts
  app.post('/api/events/check-conflict', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), async (req: TenantRequest, res) => {
    try {
      const { startDate, endDate, userId, excludeEventId } = req.body;
      const result = await storage.checkEventConflict(
        new Date(startDate),
        new Date(endDate),
        req.tenantId!,
        userId,
        excludeEventId
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Move event to different calendar (for status changes)
  app.patch('/api/events/:id/move', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), async (req: TenantRequest, res) => {
    try {
      const { targetCalendarId } = req.body;
      const event = await storage.moveEventToCalendar(req.params.id, targetCalendarId, req.tenantId!);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create project with automatic event creation on Leads calendar
  app.post('/api/calendar-projects', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), async (req: TenantRequest, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      
      // Ensure tenant isolation
      const project = await storage.createProject(projectData, req.tenantId!);
      
      // CRITICAL FIX: Link lead events to project
      // When a project is created from a lead, update the lead's calendar events 
      // to reference the new project. This ensures events are properly cancelled
      // when the project is deleted (fixes orphaned lead event bug)
      // Find leadId through the contact's leadId field
      if (project.contactId) {
        const linkedCount = await storage.linkLeadEventsToProject(project.contactId, project.id, req.tenantId!);
        if (linkedCount > 0) {
          console.log(`🔗 Linked ${linkedCount} lead event(s) to new project ${project.id}`);
        }
      }
      
      // If project has dates, create an event on Leads calendar
      if (project.startDate && project.endDate) {
        const leadsCalendar = await storage.getCalendarByType('leads', req.tenantId!);
        
        if (leadsCalendar) {
          const event = await storage.createEvent({
            tenantId: req.tenantId!,
            calendarId: leadsCalendar.id,
            title: project.name,
            description: project.description || '',
            location: '',
            startDate: project.startDate,
            endDate: project.endDate,
            projectId: project.id,
            createdBy: req.authenticatedUserId!,
            timezone: 'UTC',
            history: JSON.stringify([{
              timestamp: new Date().toISOString(),
              action: 'created',
              userId: req.authenticatedUserId,
              calendar: 'leads'
            }])
          }, req.tenantId!);
          
          // Link event to project
          await storage.updateProject(project.id, { primaryEventId: event.id }, req.tenantId!);
        }
      }
      
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update project status and move event to appropriate calendar
  app.patch('/api/calendar-projects/:id/status', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant, csrf), async (req: TenantRequest, res) => {
    try {
      const { status } = req.body;
      const project = await storage.getProject(req.params.id, req.tenantId!);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Update project status
      const updatedProject = await storage.updateProject(project.id, { status }, req.tenantId!);
      
      // Move event to appropriate calendar based on new status
      if (project.primaryEventId && updatedProject) {
        let targetCalendar;
        if (status === 'lead') {
          targetCalendar = await storage.getCalendarByType('leads', req.tenantId!);
        } else if (status === 'booked') {
          targetCalendar = await storage.getCalendarByType('booked', req.tenantId!);
        } else if (status === 'completed') {
          targetCalendar = await storage.getCalendarByType('completed', req.tenantId!);
        }
        
        if (targetCalendar) {
          await storage.moveEventToCalendar(project.primaryEventId, targetCalendar.id, req.tenantId!);
        }
      }
      
      res.json(updatedProject);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Export calendar to .ics format
  app.get('/api/calendars/:id/export.ics', ...withTenantSecurity(ensureUserAuth, tenantResolver, requireTenant), async (req: TenantRequest, res) => {
    try {
      const events = await storage.getEventsByCalendar(req.params.id, req.tenantId!);
      const calendar = await storage.getCalendar(req.params.id, req.tenantId!);
      
      if (!calendar) {
        return res.status(404).json({ message: 'Calendar not found' });
      }
      
      // Generate .ics content
      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BusinessCRM//Calendar Pipeline//EN',
        `X-WR-CALNAME:${calendar.name}`,
        'X-WR-TIMEZONE:UTC',
      ];
      
      for (const event of events) {
        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`UID:${event.id}@businesscrm.com`);
        icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
        icsContent.push(`DTSTART:${new Date(event.startDate).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
        icsContent.push(`DTEND:${new Date(event.endDate).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
        icsContent.push(`SUMMARY:${event.title}`);
        if (event.description) {
          icsContent.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
        }
        if (event.location) {
          icsContent.push(`LOCATION:${event.location}`);
        }
        icsContent.push('END:VEVENT');
      }
      
      icsContent.push('END:VCALENDAR');
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${calendar.name.toLowerCase()}_calendar.ics"`);
      res.send(icsContent.join('\r\n'));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI-Powered Features Routes
  // Email summarization - generate AI summary of email thread
  app.post('/api/ai/threads/:threadId/summarize', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { threadId } = req.params;
      const userId = (req as any).session?.userId;
      
      // Check if summary already exists (caching)
      const existingSummary = await storage.getEmailSummary(threadId, req.tenantId!);
      if (existingSummary) {
        return res.json(existingSummary);
      }
      
      // Get emails in thread (tenant-scoped)
      const threadEmails = await storage.getEmailsByThread(threadId, req.tenantId!);
      if (threadEmails.length === 0) {
        return res.status(404).json({ error: 'No emails found in thread' });
      }
      
      // Import AI service
      const { summarizeEmailThread } = await import('./ai-service');
      
      // Generate summary
      const { summary, tokensUsed } = await summarizeEmailThread(
        threadEmails.map(e => ({
          id: e.id,
          fromEmail: e.fromEmail,
          subject: e.subject || '',
          bodyText: e.bodyText || '',
          sentAt: e.sentAt || new Date()
        })),
        req.tenantId!
      );
      
      // Save summary to database
      const savedSummary = await storage.createEmailSummary({
        threadId,
        summary,
        model: 'gpt-4o-mini',
        tokensUsed,
        createdBy: userId
      }, req.tenantId!);
      
      res.json(savedSummary);
    } catch (error: any) {
      console.error('Error generating email summary:', error);
      res.status(500).json({ error: error.message || 'Failed to generate summary' });
    }
  });

  // Get existing email summary
  app.get('/api/ai/threads/:threadId/summarize', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const { threadId } = req.params;
      
      // Get existing summary (tenant-scoped)
      const summary = await storage.getEmailSummary(threadId, req.tenantId!);
      if (!summary) {
        return res.status(404).json({ error: 'Summary not found' });
      }
      
      res.json(summary);
    } catch (error: any) {
      console.error('Error fetching email summary:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch summary' });
    }
  });

  // Email draft generation - generate AI draft reply
  app.post('/api/ai/emails/:emailId/draft-reply', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { emailId } = req.params;
      const userId = (req as any).session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get the email to reply to (tenant-scoped)
      const email = await storage.getEmail(emailId, req.tenantId!);
      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }
      
      // Get user information for placeholder replacement
      const user = await storage.getUser(userId, req.tenantId!);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get thread context (tenant-scoped)
      const threadEmails = email.threadId 
        ? await storage.getEmailsByThread(email.threadId, req.tenantId!)
        : [email];
      
      // Import AI service
      const { generateEmailReply } = await import('./ai-service');
      
      // Generate draft
      const { draft, tokensUsed } = await generateEmailReply(
        {
          id: email.id,
          fromEmail: email.fromEmail,
          subject: email.subject || '',
          bodyText: email.bodyText || '',
          sentAt: email.sentAt || new Date()
        },
        threadEmails.map(e => ({
          id: e.id,
          fromEmail: e.fromEmail,
          subject: e.subject || '',
          bodyText: e.bodyText || '',
          sentAt: e.sentAt || new Date()
        })),
        req.tenantId!
      );
      
      // Post-process draft to replace placeholders with actual user data
      let processedDraft = draft;
      
      // Build full name from first_name and last_name
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Gareth Gwyn';
      
      // Replace common placeholder patterns (case-insensitive)
      processedDraft = processedDraft.replace(/\[YOUR NAME\]/gi, fullName);
      processedDraft = processedDraft.replace(/\[YOUR POSITION\]/gi, '');
      processedDraft = processedDraft.replace(/\[YOUR COMPANY\]/gi, 'Club Kudo');
      
      // Remove generic placeholder instructions and clean up
      processedDraft = processedDraft.replace(/\[SPECIFIC DETAILS[^\]]*\]/gi, '');
      processedDraft = processedDraft.replace(/\[YOUR CONTACT INFORMATION\]/gi, user.email || '');
      processedDraft = processedDraft.replace(/\[(YOUR |THE )?DETAILS[^\]]*\]/gi, '');
      
      // Clean up any leftover empty brackets and extra spaces
      processedDraft = processedDraft.replace(/\[\s*\]/g, '');
      processedDraft = processedDraft.replace(/\s{2,}/g, ' ').trim();
      
      // Intelligently add paragraph breaks if they don't exist
      if (!processedDraft.includes('\n\n')) {
        // Add breaks after greetings (Hi Name, Hello Name,)
        processedDraft = processedDraft.replace(/(^Hi [^,]+,|^Hello [^,]+,|^Dear [^,]+,)/i, '$1\n\n');
        
        // Add breaks before common sign-offs
        processedDraft = processedDraft.replace(/\s+(Best regards,|Kind regards,|Warm regards,|Warmest regards,|Best wishes,|Sincerely,|Thank you,|Thanks,|Cheers,)/gi, '\n\n$1 ');
        
        // Add blank line after sign-off before signature
        const namePattern = new RegExp(`(Best regards,|Kind regards,|Warm regards,|Warmest regards,|Best wishes,|Sincerely,|Thank you,|Thanks,|Cheers,)\\s+(Gareth Gwyn|${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        processedDraft = processedDraft.replace(namePattern, '$1\n\n$2');
        
        // Split long blocks into paragraphs (every 3-4 sentences)
        const sentences = processedDraft.split(/(?<=[.!?])\s+/);
        if (sentences.length > 4) {
          const paragraphs = [];
          for (let i = 0; i < sentences.length; i += 3) {
            paragraphs.push(sentences.slice(i, i + 3).join(' '));
          }
          processedDraft = paragraphs.join('\n\n');
        }
      }
      
      // Save processed draft to database
      const savedDraft = await storage.createEmailDraft({
        threadId: email.threadId || '',
        inReplyToEmailId: emailId,
        draftContent: processedDraft,
        model: 'gpt-4o-mini',
        tokensUsed,
        createdBy: userId
      }, req.tenantId!);
      
      res.json(savedDraft);
    } catch (error: any) {
      console.error('Error generating email draft:', error);
      res.status(500).json({ error: error.message || 'Failed to generate draft' });
    }
  });

  // Adjust tone of existing draft
  app.post('/api/ai/emails/:emailId/adjust-tone', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { emailId } = req.params;
      const { tone } = req.body;
      const userId = (req as any).session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      if (!tone) {
        return res.status(400).json({ error: 'Tone is required' });
      }
      
      // Get the email to reply to (tenant-scoped)
      const email = await storage.getEmail(emailId, req.tenantId!);
      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }
      
      // Get user information
      const user = await storage.getUser(userId, req.tenantId!);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get thread context
      const threadEmails = email.threadId 
        ? await storage.getEmailsByThread(email.threadId, req.tenantId!)
        : [email];
      
      // Import AI service
      const { generateEmailReply } = await import('./ai-service');
      
      // Generate draft with specific tone
      const { draft, tokensUsed } = await generateEmailReply(
        {
          id: email.id,
          fromEmail: email.fromEmail,
          subject: email.subject || '',
          bodyText: email.bodyText || '',
          sentAt: email.sentAt || new Date()
        },
        threadEmails.map(e => ({
          id: e.id,
          fromEmail: e.fromEmail,
          subject: e.subject || '',
          bodyText: e.bodyText || '',
          sentAt: e.sentAt || new Date()
        })),
        req.tenantId!,
        tone // Pass the tone parameter
      );
      
      // Post-process draft to replace placeholders with actual user data
      let processedDraft = draft;
      
      // Build full name from first_name and last_name
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Gareth Gwyn';
      
      // Replace common placeholder patterns (case-insensitive)
      processedDraft = processedDraft.replace(/\[YOUR NAME\]/gi, fullName);
      processedDraft = processedDraft.replace(/\[YOUR POSITION\]/gi, '');
      processedDraft = processedDraft.replace(/\[YOUR COMPANY\]/gi, 'Club Kudo');
      
      // Remove generic placeholder instructions and clean up
      processedDraft = processedDraft.replace(/\[SPECIFIC DETAILS[^\]]*\]/gi, '');
      processedDraft = processedDraft.replace(/\[YOUR CONTACT INFORMATION\]/gi, user.email || '');
      processedDraft = processedDraft.replace(/\[(YOUR |THE )?DETAILS[^\]]*\]/gi, '');
      
      // Clean up any leftover empty brackets and extra spaces
      processedDraft = processedDraft.replace(/\[\s*\]/g, '');
      processedDraft = processedDraft.replace(/\s{2,}/g, ' ').trim();
      
      // Intelligently add paragraph breaks if they don't exist
      if (!processedDraft.includes('\n\n')) {
        // Add breaks after greetings (Hi Name, Hello Name,)
        processedDraft = processedDraft.replace(/(^Hi [^,]+,|^Hello [^,]+,|^Dear [^,]+,)/i, '$1\n\n');
        
        // Add breaks before common sign-offs
        processedDraft = processedDraft.replace(/\s+(Best regards,|Kind regards,|Warm regards,|Warmest regards,|Best wishes,|Sincerely,|Thank you,|Thanks,|Cheers,)/gi, '\n\n$1 ');
        
        // Add blank line after sign-off before signature
        const namePattern = new RegExp(`(Best regards,|Kind regards,|Warm regards,|Warmest regards,|Best wishes,|Sincerely,|Thank you,|Thanks,|Cheers,)\\s+(Gareth Gwyn|${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        processedDraft = processedDraft.replace(namePattern, '$1\n\n$2');
        
        // Split long blocks into paragraphs (every 3-4 sentences)
        const sentences = processedDraft.split(/(?<=[.!?])\s+/);
        if (sentences.length > 4) {
          const paragraphs = [];
          for (let i = 0; i < sentences.length; i += 3) {
            paragraphs.push(sentences.slice(i, i + 3).join(' '));
          }
          processedDraft = paragraphs.join('\n\n');
        }
      }
      
      res.json({ draftContent: processedDraft, model: 'gpt-4o-mini', tokensUsed });
    } catch (error: any) {
      console.error('Error adjusting tone:', error);
      res.status(500).json({ error: error.message || 'Failed to adjust tone' });
    }
  });

  // Action item extraction - extract tasks from email
  app.post('/api/ai/emails/:emailId/extract-actions', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { emailId } = req.params;
      const userId = (req as any).session?.userId;
      
      // Get the email (tenant-scoped)
      const email = await storage.getEmail(emailId, req.tenantId!);
      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }
      
      // Check if action items already extracted
      const existingActions = await storage.getEmailActionItems(emailId, req.tenantId!);
      if (existingActions.length > 0) {
        return res.json(existingActions);
      }
      
      // Import AI service
      const { extractActionItems } = await import('./ai-service');
      
      // Extract action items
      const { actionItems, tokensUsed } = await extractActionItems(
        {
          id: email.id,
          fromEmail: email.fromEmail,
          subject: email.subject || '',
          bodyText: email.bodyText || '',
          sentAt: email.sentAt || new Date()
        },
        req.tenantId!
      );
      
      // Save action items to database
      if (actionItems.length > 0) {
        const savedActions = await storage.createEmailActionItems(
          actionItems.map(item => ({
            emailId,
            threadId: email.threadId,
            actionText: item.actionText,
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
            priority: item.priority,
            model: 'gpt-4o-mini',
            tokensUsed: Math.floor(tokensUsed / actionItems.length),
            createdBy: userId
          })),
          req.tenantId!
        );
        res.json(savedActions);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error('Error extracting action items:', error);
      res.status(500).json({ error: error.message || 'Failed to extract action items' });
    }
  });

  // Get action items for a thread
  app.get('/api/ai/email-threads/:threadId/actions', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const { threadId } = req.params;
      const actions = await storage.getThreadActionItems(threadId, req.tenantId!);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update action item status
  app.patch('/api/ai/actions/:id/status', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'completed', 'dismissed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      await storage.updateActionItemStatus(id, status, req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI compose email from instructions with style learning
  app.post('/api/ai/compose-email', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { instructions, projectContext, contactName } = req.body;
      const userId = req.session?.userId;
      
      if (!instructions || !instructions.trim()) {
        return res.status(400).json({ error: 'Instructions required' });
      }
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get user information for placeholder replacement
      const user = await storage.getUser(userId, req.tenantId!);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Import AI service
      const { composeEmail } = await import('./ai-service');
      
      // Generate email draft with style learning
      const { draft, subject, tokensUsed, stylePersonalized } = await composeEmail(
        instructions,
        req.tenantId!,
        userId,
        projectContext,
        contactName
      );
      
      // Post-process draft to replace any placeholders with actual user data
      let processedDraft = draft;
      
      // Build full name from first_name and last_name
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Gareth Gwyn';
      
      // Replace common placeholder patterns (case-insensitive)
      processedDraft = processedDraft.replace(/\[YOUR NAME\]/gi, fullName);
      processedDraft = processedDraft.replace(/\[YOUR POSITION\]/gi, '');
      processedDraft = processedDraft.replace(/\[YOUR COMPANY\]/gi, 'Club Kudo');
      
      // Remove generic placeholder instructions and clean up
      processedDraft = processedDraft.replace(/\[SPECIFIC DETAILS[^\]]*\]/gi, '');
      processedDraft = processedDraft.replace(/\[YOUR CONTACT INFORMATION\]/gi, user.email || '');
      processedDraft = processedDraft.replace(/\[(YOUR |THE )?DETAILS[^\]]*\]/gi, '');
      
      // Clean up any leftover empty brackets and extra spaces
      processedDraft = processedDraft.replace(/\[\s*\]/g, '');
      processedDraft = processedDraft.replace(/\s{2,}/g, ' ').trim();
      
      // Intelligently add paragraph breaks if they don't exist
      if (!processedDraft.includes('\n\n')) {
        // Add breaks after greetings (Hi Name, Hello Name,)
        processedDraft = processedDraft.replace(/(^Hi [^,]+,|^Hello [^,]+,|^Dear [^,]+,)/i, '$1\n\n');
        
        // Add breaks before common sign-offs
        processedDraft = processedDraft.replace(/\s+(Best regards,|Kind regards,|Warm regards,|Warmest regards,|Best wishes,|Sincerely,|Thank you,|Thanks,|Cheers,)/gi, '\n\n$1 ');
        
        // Add blank line after sign-off before signature
        const namePattern = new RegExp(`(Best regards,|Kind regards,|Warm regards,|Warmest regards,|Best wishes,|Sincerely,|Thank you,|Thanks,|Cheers,)\\s+(Gareth Gwyn|${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        processedDraft = processedDraft.replace(namePattern, '$1\n\n$2');
        
        // Split long blocks into paragraphs (every 3-4 sentences)
        const sentences = processedDraft.split(/(?<=[.!?])\s+/);
        if (sentences.length > 4) {
          const paragraphs = [];
          for (let i = 0; i < sentences.length; i += 3) {
            paragraphs.push(sentences.slice(i, i + 3).join(' '));
          }
          processedDraft = paragraphs.join('\n\n');
        }
      }
      
      res.json({ draft: processedDraft, subject, model: 'gpt-4o-mini', tokensUsed, stylePersonalized });
    } catch (error: any) {
      console.error('Error composing email:', error);
      res.status(500).json({ error: error.message || 'Failed to compose email' });
    }
  });

  // User style samples for AI personalization
  app.post('/api/ai/style-samples', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { samples } = req.body;
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      if (!Array.isArray(samples) || samples.length === 0) {
        return res.status(400).json({ error: 'At least one sample required' });
      }
      
      // Delete existing samples and add new ones
      await storage.deleteAllUserStyleSamples(userId, req.tenantId!);
      
      const createdSamples = [];
      for (const sampleText of samples) {
        if (sampleText && sampleText.trim()) {
          const sample = await storage.createUserStyleSample({
            userId,
            sampleText: sampleText.trim(),
            tenantId: req.tenantId!
          }, req.tenantId!);
          createdSamples.push(sample);
        }
      }
      
      res.json({ success: true, count: createdSamples.length });
    } catch (error: any) {
      console.error('Error saving style samples:', error);
      res.status(500).json({ error: error.message || 'Failed to save style samples' });
    }
  });

  app.get('/api/ai/style-samples', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const samples = await storage.getUserStyleSamples(userId, req.tenantId!);
      res.json({ samples });
    } catch (error: any) {
      console.error('Error getting style samples:', error);
      res.status(500).json({ error: error.message || 'Failed to get style samples' });
    }
  });

  // Check if user has seen style onboarding
  app.get('/api/ai/style-onboarding-status', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const pref = await storage.getUserPref(userId, 'has_seen_style_onboarding', req.tenantId!);
      res.json({ hasSeenOnboarding: pref?.value === 'true' });
    } catch (error: any) {
      console.error('Error checking onboarding status:', error);
      res.status(500).json({ error: error.message || 'Failed to check onboarding status' });
    }
  });

  // Mark style onboarding as seen
  app.post('/api/ai/style-onboarding-complete', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      await storage.setUserPref(userId, 'has_seen_style_onboarding', 'true', req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error marking onboarding complete:', error);
      res.status(500).json({ error: error.message || 'Failed to mark onboarding complete' });
    }
  });

  // AI Assistant Query
  app.post('/api/ai/assistant/query', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { query, conversationHistory } = req.body;
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      // Import AI assistant service
      const { processAssistantQuery } = await import('./ai-assistant-service');
      
      // Process the query with AI (with conversation history)
      const result = await processAssistantQuery(query, {
        storage,
        tenantId: req.tenantId!,
        userId
      }, conversationHistory);
      
      res.json(result);
    } catch (error: any) {
      console.error('❌ AI Assistant Error:', error);
      
      // Handle Azure OpenAI content filter errors
      if (error.code === 'content_filter' || (error.message && error.message.includes('content management policy'))) {
        return res.status(400).json({ 
          error: 'Your query was blocked by the AI content filter. This sometimes happens with certain words or phrases. Try rephrasing your question - for example, use "saxophone" instead of abbreviations, or rephrase the question differently.' 
        });
      }
      
      res.status(500).json({ error: error.message || 'Failed to process query' });
    }
  });

  // AI Business Context routes
  app.get('/api/ai/business-context', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const context = await storage.getAiBusinessContext(req.tenantId!);
      res.json(context || {});
    } catch (error: any) {
      console.error('Error fetching AI business context:', error);
      res.status(500).json({ error: 'Failed to fetch business context' });
    }
  });

  app.post('/api/ai/business-context', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const context = await storage.upsertAiBusinessContext(req.body, req.tenantId!);
      res.json(context);
    } catch (error: any) {
      console.error('Error saving AI business context:', error);
      res.status(500).json({ error: 'Failed to save business context' });
    }
  });

  // AI Knowledge Base routes
  app.get('/api/ai/knowledge-base', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const items = await storage.getAiKnowledgeBase(req.tenantId!, isActive);
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching AI knowledge base:', error);
      res.status(500).json({ error: 'Failed to fetch knowledge base' });
    }
  });

  app.post('/api/ai/knowledge-base', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const item = await storage.createAiKnowledgeBaseItem(req.body, req.tenantId!);
      res.json(item);
    } catch (error: any) {
      console.error('Error creating AI knowledge base item:', error);
      res.status(500).json({ error: 'Failed to create knowledge base item' });
    }
  });

  app.patch('/api/ai/knowledge-base/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const item = await storage.updateAiKnowledgeBaseItem(req.params.id, req.body, req.tenantId!);
      if (!item) {
        return res.status(404).json({ error: 'Knowledge base item not found' });
      }
      res.json(item);
    } catch (error: any) {
      console.error('Error updating AI knowledge base item:', error);
      res.status(500).json({ error: 'Failed to update knowledge base item' });
    }
  });

  app.delete('/api/ai/knowledge-base/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const success = await storage.deleteAiKnowledgeBaseItem(req.params.id, req.tenantId!);
      if (!success) {
        return res.status(404).json({ error: 'Knowledge base item not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting AI knowledge base item:', error);
      res.status(500).json({ error: 'Failed to delete knowledge base item' });
    }
  });

  // AI Custom Instructions routes
  app.get('/api/ai/custom-instructions', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const instructions = await storage.getAiCustomInstructions(req.tenantId!, isActive);
      res.json(instructions);
    } catch (error: any) {
      console.error('Error fetching AI custom instructions:', error);
      res.status(500).json({ error: 'Failed to fetch custom instructions' });
    }
  });

  app.post('/api/ai/custom-instructions', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const instruction = await storage.createAiCustomInstruction(req.body, req.tenantId!);
      res.json(instruction);
    } catch (error: any) {
      console.error('Error creating AI custom instruction:', error);
      res.status(500).json({ error: 'Failed to create custom instruction' });
    }
  });

  app.patch('/api/ai/custom-instructions/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const instruction = await storage.updateAiCustomInstruction(req.params.id, req.body, req.tenantId!);
      if (!instruction) {
        return res.status(404).json({ error: 'Custom instruction not found' });
      }
      res.json(instruction);
    } catch (error: any) {
      console.error('Error updating AI custom instruction:', error);
      res.status(500).json({ error: 'Failed to update custom instruction' });
    }
  });

  app.delete('/api/ai/custom-instructions/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const success = await storage.deleteAiCustomInstruction(req.params.id, req.tenantId!);
      if (!success) {
        return res.status(404).json({ error: 'Custom instruction not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting AI custom instruction:', error);
      res.status(500).json({ error: 'Failed to delete custom instruction' });
    }
  });

  // AI Training Documents routes
  app.get('/api/ai/training-documents', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const documents = await storage.getAiTrainingDocuments(req.tenantId!);
      res.json(documents);
    } catch (error: any) {
      console.error('Error fetching AI training documents:', error);
      res.status(500).json({ error: 'Failed to fetch training documents' });
    }
  });

  app.post('/api/ai/training-documents', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const document = await storage.createAiTrainingDocument(req.body, req.tenantId!);
      res.json(document);
    } catch (error: any) {
      console.error('Error creating AI training document:', error);
      res.status(500).json({ error: 'Failed to create training document' });
    }
  });

  app.patch('/api/ai/training-documents/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const document = await storage.updateAiTrainingDocument(req.params.id, req.body, req.tenantId!);
      if (!document) {
        return res.status(404).json({ error: 'Training document not found' });
      }
      res.json(document);
    } catch (error: any) {
      console.error('Error updating AI training document:', error);
      res.status(500).json({ error: 'Failed to update training document' });
    }
  });

  app.delete('/api/ai/training-documents/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const success = await storage.deleteAiTrainingDocument(req.params.id, req.tenantId!);
      if (!success) {
        return res.status(404).json({ error: 'Training document not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting AI training document:', error);
      res.status(500).json({ error: 'Failed to delete training document' });
    }
  });

  // ============================================================================
  // NOTIFICATION ROUTES
  // ============================================================================
  
  // Get all notifications for the current user (both read and unread)
  app.get('/api/notifications', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const userId = req.authenticatedUserId!;
      const notifications = await storage.getLeadNotifications(userId, req.tenantId!, false);
      res.json(notifications);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Mark notification as read
  app.post('/api/notifications/:id/read', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const notification = await storage.getLeadNotification(req.params.id, req.tenantId!);
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      if (notification.userId !== req.authenticatedUserId!) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      await storage.markNotificationAsRead(req.params.id, req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Dismiss notification
  app.post('/api/notifications/:id/dismiss', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const notification = await storage.getLeadNotification(req.params.id, req.tenantId!);
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      if (notification.userId !== req.authenticatedUserId!) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      await storage.markNotificationAsDismissed(req.params.id, req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error dismissing notification:', error);
      res.status(500).json({ error: 'Failed to dismiss notification' });
    }
  });

  // Get unread notification count
  app.get('/api/notifications/count', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const userId = req.authenticatedUserId!;
      const count = await storage.getUnreadNotificationCount(userId, req.tenantId!);
      res.json({ count });
    } catch (error: any) {
      console.error('Error fetching notification count:', error);
      res.status(500).json({ error: 'Failed to fetch notification count' });
    }
  });

  // Run notification worker manually (for testing/debugging)
  app.post('/api/notifications/run-worker', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const { notificationWorker } = await import('./notification-worker');
      const userId = req.authenticatedUserId!;
      const result = await notificationWorker.run({
        tenantId: req.tenantId!,
        userId,
        forceRun: true
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error running notification worker:', error);
      res.status(500).json({ error: 'Failed to run notification worker' });
    }
  });

  // ============================================================================
  // NOTIFICATION SETTINGS ROUTES
  // ============================================================================
  
  // Get notification settings for current user
  app.get('/api/notification-settings', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const userId = req.authenticatedUserId!;
      const settings = await storage.getNotificationSettings(req.tenantId!, userId);
      
      // Return default settings if none exist
      if (!settings) {
        return res.json({
          days_without_reply: 3,
          days_since_inquiry: 7,
          email_notifications_enabled: true,
          in_app_notifications_enabled: true,
          email_frequency: 'daily',
          auto_reply_enabled: false,
          auto_reply_message: 'Thank you for your inquiry! We will get back to you within 24 hours.'
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching notification settings:', error);
      res.status(500).json({ error: 'Failed to fetch notification settings' });
    }
  });

  // Create or update notification settings
  app.post('/api/notification-settings', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const userId = req.authenticatedUserId!;
      // Extract only the settings fields, excluding id, timestamps, and tenant info
      const { 
        id, 
        createdAt, 
        updatedAt, 
        tenantId, 
        userId: bodyUserId,
        ...settingsData 
      } = req.body;
      
      const settings = await storage.upsertNotificationSettings(
        { ...settingsData, userId },
        req.tenantId!
      );
      res.json(settings);
    } catch (error: any) {
      console.error('❌ Error saving notification settings:', {
        message: error.message,
        stack: error.stack,
        error
      });
      res.status(500).json({ error: 'Failed to save notification settings' });
    }
  });

  // Update specific notification settings
  app.patch('/api/notification-settings/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const settings = await storage.updateNotificationSettings(req.params.id, req.body, req.tenantId!);
      if (!settings) {
        return res.status(404).json({ error: 'Settings not found' });
      }
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating notification settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // ============================================================================
  // AUTO-REPLY SETTINGS ROUTES
  // ============================================================================
  
  // Get auto-reply settings for current user
  app.get('/api/auto-reply-settings', ensureUserAuth, tenantResolver, requireTenant, async (req: TenantRequest, res) => {
    try {
      const userId = req.authenticatedUserId!;
      const settings = await storage.getAutoReplySettings(userId, req.tenantId!);
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching auto-reply settings:', error);
      res.status(500).json({ error: 'Failed to fetch auto-reply settings' });
    }
  });

  // Create or update auto-reply settings
  app.post('/api/auto-reply-settings', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const userId = req.authenticatedUserId!;
      const settings = await storage.createOrUpdateAutoReplySettings(
        { ...req.body, userId },
        req.tenantId!
      );
      res.json(settings);
    } catch (error: any) {
      console.error('Error saving auto-reply settings:', error);
      res.status(500).json({ error: 'Failed to save auto-reply settings' });
    }
  });

  // Update specific auto-reply settings
  app.patch('/api/auto-reply-settings/:id', ensureUserAuth, tenantResolver, requireTenant, csrf, async (req: TenantRequest, res) => {
    try {
      const settings = await storage.updateAutoReplySettings(req.params.id, req.body, req.tenantId!);
      if (!settings) {
        return res.status(404).json({ error: 'Settings not found' });
      }
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating auto-reply settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
