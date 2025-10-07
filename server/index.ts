import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import csrf from "csurf";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { calendarAutoSyncService } from "./src/services/calendar-auto-sync";
import { tenantResolver } from "./middleware/tenantResolver";
import { tenantMonitoringMiddleware } from "./src/middleware/tenantMonitoring";
import { orphanPreventionMiddleware, responseValidationMiddleware } from "./src/middleware/orphanPrevention";
import { initializeFileStorage } from "./src/services/fileStorageService";
import { validateProductionSecrets, validateTenantConfiguration } from "./src/services/productionValidation";

const app = express();

// CRITICAL: Validate production secrets before starting any services
try {
  validateProductionSecrets();
  validateTenantConfiguration();
} catch (error: any) {
  console.error('❌ Production validation failed. Server startup aborted.');
  console.error(error.message);
  if (error.details) {
    error.details.forEach((detail: string) => console.error(`  - ${detail}`));
  }
  console.error('\n📋 Required environment variables:');
  console.error('  - DATABASE_URL (PostgreSQL connection string)');
  console.error('  - SESSION_SECRET (32+ characters)');
  console.error('  - ENCRYPTION_MASTER_KEY (32+ characters)');
  console.error('  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
  console.error('  - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET');
  console.error('\n🔧 Please configure all required secrets and restart the server.');
  process.exit(1);
}

// Trust proxy MUST be set before rate limiting for correct client IPs
app.set('trust proxy', 1);

// Security headers - environment-specific CSP
// Environment-specific CSP configuration
const isProduction = process.env.NODE_ENV === 'production';
const cspConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https:"],
      scriptSrc: isProduction 
        ? ["'self'", "https://www.google.com", "https://www.gstatic.com"] 
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.google.com", "https://www.gstatic.com", "https://replit.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: isProduction 
        ? ["'self'", "wss://your-domain.com", "https://api.stripe.com", "https://www.google.com"]
        : ["'self'", "wss:", "https:", "http://localhost:*"],
      frameSrc: ["'self'", "https://www.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", "*"], // Allow form submissions from any origin for development
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

app.use(helmet(cspConfig));

// Rate limiting - protect against DDoS and brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (general)
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit auth attempts to 50 per 15 minutes
  message: { error: 'Too many authentication attempts, please try again later' },
  skipSuccessfulRequests: true, // Don't count successful requests
});

app.use(limiter); // Apply general rate limiting to all routes

// Make auth limiter available to routes
(app as any).authLimiter = authLimiter;

app.use(cookieParser()); // Required for CSRF

// Global request debugging - catch ALL requests BEFORE body parsing
app.use((req, res, next) => {
  // Global request debugging - catch ALL requests
  if (req.path.includes('/public/') || req.method === 'POST') {
    console.log(`🌍 GLOBAL REQUEST: ${req.method} ${req.url} from ${req.ip}`);
    console.log(`📝 GLOBAL HEADERS:`, JSON.stringify(req.headers, null, 2));
  }
  next();
});

// CRITICAL: Webhook routes need raw body data for signature verification
// Mount webhook routes with raw parsing BEFORE global JSON parsing
app.use('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '5mb' }));

app.use(express.json({ limit: '10mb' })); // Add size limit for security  
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Body parser error handler - catch parsing errors that cause 500s
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('💥 BODY PARSER ERROR:', {
      message: err.message,
      url: req.url,
      method: req.method,
      contentType: req.headers['content-type'],
      bodySize: req.headers['content-length']
    });
    return res.status(400).json({ 
      error: 'Invalid JSON payload',
      message: 'Request body contains malformed JSON'
    });
  }
  next(err);
});

// CSRF Protection - applied after sessions are configured
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
});

// DEBUG: CSRF error handler
app.use((err: any, req: any, res: any, next: any) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('🛡️ CSRF TOKEN ERROR:', {
      url: req.url,
      method: req.method,
      csrfToken: req.headers['x-csrf-token'],
      cookie: req.headers.cookie
    });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
});

// CSRF token endpoint - apply CSRF middleware to generate token and cookie
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});


// Public venue endpoints for lead capture forms (no auth, no tenant required)
app.post('/api/venues/suggest', async (req, res) => {
  console.log('✅ Public venue suggest route hit (before tenant resolver)');
  try {
    const { venuesService } = await import('./src/services/venues');
    const { z } = await import('zod');
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
        types: validatedData.types,
        publicOnly: true // Skip database cache for public requests
      }
    );
    
    res.json({ predictions: suggestions });
  } catch (error) {
    console.error('Error getting venue suggestions:', error);
    if (error && typeof error === 'object' && 'errors' in error) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: (error as any).errors 
      });
    } else {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get venue suggestions'
      });
    }
  }
});

app.post('/api/venues/place-details', async (req, res) => {
  console.log('✅ Public venue place-details route hit (before tenant resolver)');
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

// Tenant resolution middleware - identifies tenant context from subdomain/domain/user
app.use('/api', tenantResolver);

// Real-time tenant monitoring and orphan prevention (Task 3 Security)
app.use('/api', tenantMonitoringMiddleware);
app.use('/api', orphanPreventionMiddleware);
app.use('/api', responseValidationMiddleware);

// API response logging middleware - logs API calls with timing
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only log response body in development to prevent data leakage
      if (capturedJsonResponse && process.env.NODE_ENV !== 'production') {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// DEBUG: Catch ALL requests to /auth/ routes before registerRoutes
app.use('/auth', (req, res, next) => {
  console.log('🔴 SERVER/INDEX.TS: /auth/* HIT BEFORE registerRoutes', {
    method: req.method,
    path: req.path,
    url: req.url,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  next();
});

(async () => {
  const server = await registerRoutes(app, csrfProtection);

  // DEBUG: Express route dump (only when DEBUG_OAUTH=1)
  if (process.env.DEBUG_OAUTH === '1') {
    function listRoutes(app: any) {
      const routes: any[] = [];
      app._router?.stack?.forEach((mw: any) => {
        if (mw.route) {
          routes.push({ method: Object.keys(mw.route.methods)[0]?.toUpperCase(), path: mw.route.path });
        } else if (mw.name === "router" && mw.handle?.stack) {
          mw.handle.stack.forEach((h: any) => {
            if (h.route) {
              routes.push({ method: Object.keys(h.route.methods)[0]?.toUpperCase(), path: h.route.path });
            }
          });
        }
      });
      console.info("[ROUTES]", JSON.stringify(routes, null, 2));
    }
    listRoutes(app);
    
    // Environment sanity check
    console.info("\n📋 OAUTH ENVIRONMENT CHECK:");
    console.info(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅' : '❌'}`);
    console.info(`GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅' : '❌'}`);
    console.info(`GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI || 'Not set (will use dynamic)'}`);
    console.info(`MICROSOFT_CLIENT_ID: ${process.env.MICROSOFT_CLIENT_ID ? '✅' : '❌'}`);
    console.info(`MICROSOFT_CLIENT_SECRET: ${process.env.MICROSOFT_CLIENT_SECRET ? '✅' : '❌'}`);
    console.info(`MICROSOFT_REDIRECT_URI: ${process.env.MICROSOFT_REDIRECT_URI || 'Not set (will use dynamic)'}`);
    console.info(`DEBUG_OAUTH: ${process.env.DEBUG_OAUTH || '❌'}`);
    console.info("\n");
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error for debugging but don't throw after responding to prevent crash
    console.error('Express error handler:', err);
    
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // API 404 handler - ensure API requests get JSON responses, not HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize file storage system
    try {
      const storageInitialized = await initializeFileStorage();
      if (!storageInitialized) {
        console.warn('⚠️ File storage initialization failed - continuing with degraded functionality');
      }
    } catch (error) {
      console.error('❌ File storage initialization error:', error);
    }

    // Initialize jobs service for background task management
    try {
      console.log('📋 Initializing job queue service...');
      const { jobs } = await import('./src/services/jobsService');
      await jobs.initialize();
      console.log('📋 Job queue service initialized successfully');
      
      // Schedule recurring background jobs using the job queue
      // Note: These jobs are multi-tenant aware and process all tenants internally
      console.log('📅 Scheduling recurring background jobs...');
      
      // Calendar auto-sync: every 1 minute (60000ms) - processes all tenants
      await jobs.enqueueRecurring('calendar-sync', {}, 1 * 60 * 1000, { tenantId: 'system' });
      console.log('✅ Calendar auto-sync job scheduled (every 1 minute)');
      
      // Email auto-sync: every 3 minutes (180000ms) - processes all tenants
      await jobs.enqueueRecurring('email-sync', {}, 3 * 60 * 1000, { tenantId: 'system' });
      console.log('✅ Email auto-sync job scheduled (every 3 minutes)');
      
      // Lead automation: every 5 minutes (300000ms) - processes all tenants
      await jobs.enqueueRecurring('lead-automation', {}, 5 * 60 * 1000, { tenantId: 'system' });
      console.log('✅ Lead automation job scheduled (every 5 minutes)');
      
      // Auto-responder worker: every 30 seconds (30000ms)
      const { autoResponderWorker } = await import('./src/services/auto-responder-worker');
      autoResponderWorker.start();
      console.log('✅ Auto-responder worker started (every 30 seconds)');
      
      // Daily encrypted database backup: 02:00 Europe/London
      try {
        const { scheduleDailyBackup } = await import('./src/services/backupScheduler');
        await scheduleDailyBackup();
        console.log('✅ Daily encrypted backup scheduled (02:00 Europe/London)');
      } catch (backupError) {
        console.error('⚠️ Failed to schedule daily backup:', backupError);
        console.log('🔧 Backup can be run manually or scheduled later');
      }
      
      console.log('🎉 All background jobs successfully scheduled via job queue');
      
    } catch (error) {
      console.error('❌ Failed to initialize jobs service:', error);
      console.log('⚠️ Falling back to direct background service startup');
      
      // Fallback to old direct service startup if jobs service fails
      calendarAutoSyncService.start();
      
      const { emailAutoSyncService } = await import('./src/services/email-auto-sync');
      emailAutoSyncService.start();
      
      const { leadAutomationService } = await import('./src/services/lead-automation');
      console.log('🚀 Starting lead automation service (every 5 minutes)');
      console.log('✅ Lead automation service started successfully');
    }
  });
})();
