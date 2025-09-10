import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { calendarAutoSyncService } from "./services/calendar-auto-sync";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
      if (capturedJsonResponse) {
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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
  }, () => {
    log(`serving on port ${port}`);
    
    // Start calendar auto-sync service after server is ready
    calendarAutoSyncService.start();

    // Start Gmail auto-sync service after server is ready
    const startGmailAutoSync = async () => {
      try {
        console.log('🚀 Starting Gmail auto-sync service (every 3 minutes)');
        const { emailSyncService } = await import('./src/services/emailSync');
        
        // Run initial sync after 30 seconds
        setTimeout(async () => {
          try {
            console.log('🔄 Running initial Gmail sync...');
            await emailSyncService.backgroundSync('test-user');
          } catch (error) {
            console.error('❌ Initial Gmail sync failed:', error);
            // Don't crash the app on initial sync failure
          }
        }, 30000);
        
        // Run sync every 3 minutes for continuous email updates
        setInterval(async () => {
          try {
            console.log('🔄 Running scheduled Gmail sync...');
            await emailSyncService.backgroundSync('test-user');
          } catch (error) {
            console.error('❌ Scheduled Gmail sync failed:', error);
            // Log the error but don't let it crash the app
            if (error instanceof Error) {
              console.error('Error details:', error.message);
              console.error('Stack trace:', error.stack);
            }
          }
        }, 3 * 60 * 1000); // 3 minutes
        
        console.log('✅ Gmail auto-sync service started successfully');
      } catch (error) {
        console.error('❌ Failed to start Gmail auto-sync service:', error);
      }
    };

    // Start Gmail sync service
    startGmailAutoSync();

    // Start lead automation service
    const startLeadAutomation = async () => {
      try {
        console.log('🚀 Starting lead automation service (every 5 minutes)');
        const { leadAutomationService } = await import('./src/services/lead-automation');
        // Service auto-starts in constructor, but let's ensure it's running
        console.log('✅ Lead automation service started successfully');
      } catch (error) {
        console.error('❌ Failed to start lead automation service:', error);
      }
    };

    // Start lead automation service
    startLeadAutomation();
  });
})();
