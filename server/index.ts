import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import csrf from "csurf";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { calendarAutoSyncService } from "./services/calendar-auto-sync";
import { tenantResolver } from "./middleware/tenantResolver";
import { initializeFileStorage } from "./src/services/fileStorageService";

const app = express();

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
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: isProduction 
        ? ["'self'"] 
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval only for Vite dev
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: isProduction 
        ? ["'self'", "wss://your-domain.com", "https://api.stripe.com"] // Restrict in production
        : ["'self'", "wss:", "https:", "http://localhost:*"], // Allow dev servers
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
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

// CRITICAL: Webhook routes need raw body data for signature verification
// Mount webhook routes with raw parsing BEFORE global JSON parsing
app.use('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '5mb' }));

app.use(express.json({ limit: '10mb' })); // Add size limit for security  
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CSRF Protection - applied after sessions are configured
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
});

// CSRF token endpoint - apply CSRF middleware to generate token and cookie
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Tenant resolution middleware - identifies tenant context from subdomain/domain/user
app.use('/api', tenantResolver);

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

(async () => {
  const server = await registerRoutes(app, csrfProtection);

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
      console.log('📋 Initializing centralized job processing system...');
      const { jobs } = await import('./src/services/jobsService');
      await jobs.initialize();
      
      // Schedule recurring background jobs using the job queue
      console.log('📅 Scheduling recurring background jobs...');
      
      // Calendar auto-sync: every 5 minutes (300000ms)
      await jobs.enqueueRecurring('calendar-sync', {}, 5 * 60 * 1000);
      console.log('✅ Calendar auto-sync job scheduled (every 5 minutes)');
      
      // Email auto-sync: every 3 minutes (180000ms)
      await jobs.enqueueRecurring('email-sync', {}, 3 * 60 * 1000);
      console.log('✅ Email auto-sync job scheduled (every 3 minutes)');
      
      // Lead automation: every 5 minutes (300000ms)
      await jobs.enqueueRecurring('lead-automation', {}, 5 * 60 * 1000);
      console.log('✅ Lead automation job scheduled (every 5 minutes)');
      
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
