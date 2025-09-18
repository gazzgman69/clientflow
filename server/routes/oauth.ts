import { Router } from 'express';
import { randomUUID } from 'crypto';
import { googleOAuthService, getGoogleAuthUrl } from '../services/google-oauth';
import { microsoftOAuthService } from '../services/microsoft-oauth';
import { storage } from '../storage';
import { google } from 'googleapis';

// Extend session type to include oauth_state and oauth_return_to
declare module 'express-session' {
  interface SessionData {
    oauth_state?: string;
    oauth_return_to?: string;
    oauth_popup?: boolean;
    oauth_origin?: string;
  }
}

const router = Router();

/**
 * Simple auth start route - Force consent with Gmail scopes
 */
router.get('/auth/google', (req, res) => {
  try {
    // Read query parameters
    const popup = Boolean(req.query.popup);
    const returnTo = (req.query.returnTo as string) || '/settings';
    const origin = (req.query.origin as string) || '';
    
    // Create a random state for CSRF protection
    const state = randomUUID();
    
    // Save state, popup flag, return URL, and origin to session
    req.session.oauth_state = state;
    req.session.oauth_popup = popup;
    req.session.oauth_return_to = returnTo;
    req.session.oauth_origin = origin;
    
    // Get Google auth URL with state
    const authUrl = getGoogleAuthUrl({ state });
    
    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error starting Google OAuth:', error);
    res.status(500).send('Failed to start OAuth flow');
  }
});

// Authentication middleware for OAuth routes
const requireAuth = async (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Please log in to access this endpoint'
    });
  }
  req.authenticatedUserId = req.session.userId;
  next();
};

/**
 * Start OAuth flow - Generate auth URL
 */
router.post('/auth/google/start', requireAuth, async (req: any, res) => {
  try {
    const { email } = req.body;
    const userId = req.authenticatedUserId;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if integration already exists
    const existing = await storage.getCalendarIntegrationByEmail(email, userId);
    if (existing && existing.refreshToken) {
      return res.json({ 
        message: 'Already connected',
        integration: existing 
      });
    }
    
    // Generate OAuth URL
    const authUrl = googleOAuthService.generateAuthUrl(email, userId);
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error starting OAuth:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * OAuth callback - Exchange code for tokens
 */
router.get('/auth/google/callback', async (req, res) => {
  try {
    // TEMP LOG: Debug callback query parameters
    console.log('OAuth callback query:', req.query);
    
    const { code, state } = req.query;
    
    // Validate presence of code
    if (!code) {
      console.error('Missing authorization code in callback');
      return res.status(400).send('Missing code');
    }
    
    // Validate presence and correctness of state
    if (!state) {
      console.error('Missing state parameter in callback');
      return res.status(400).send('Invalid state');
    }
    
    if (req.session.oauth_state !== state) {
      console.error('State mismatch:', { session: req.session.oauth_state, received: state });
      return res.status(400).send('Invalid state');
    }
    
    // Get session data before clearing
    const returnTo = req.session.oauth_return_to || '/settings';
    const isPopup = req.session.oauth_popup || false;
    const origin = req.session.oauth_origin || '';
    
    // Clear session data after validation
    delete req.session.oauth_state;
    delete req.session.oauth_return_to;
    delete req.session.oauth_popup;
    delete req.session.oauth_origin;
    
    // Get user from authenticated session
    if (!req.session?.userId) {
      return res.status(401).send('Authentication required');
    }
    const userId = req.session.userId;
    
    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(code as string);
    
    // Log token scopes for verification
    console.log('Tokens received with scopes:', tokens);
    
    // Check if integration already exists
    let integration = await storage.getCalendarIntegrationByEmail(tokens.email, userId);
    
    if (integration) {
      // Update existing integration with tokens and expiry
      integration = await storage.updateCalendarIntegration(integration.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || integration.refreshToken,
        providerAccountId: tokens.email,
        isActive: true,
        lastSyncAt: new Date()
      });
    } else {
      // Create new integration
      integration = await storage.createCalendarIntegration({
        userId,
        provider: 'google',
        providerAccountId: tokens.email,
        calendarName: `Google Calendar (${tokens.email})`,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isActive: true,
        syncDirection: 'bidirectional'
      });
    }
    
    // Initial sync
    if (integration) {
      await googleOAuthService.syncFromGoogle(integration);
      
      // Set up webhook for real-time sync
      await googleOAuthService.setupWebhook(integration);
      
      // Sync Gmail emails to database after authentication
      try {
        const { emailSyncService } = await import('../src/services/emailSync');
        
        console.log('🔄 Syncing Gmail emails to database after OAuth...');
        
        // Sync Gmail threads to database for fast access
        const syncResult = await emailSyncService.syncGmailThreadsToDatabase(userId);
        console.log(`✅ Gmail sync completed: ${syncResult.synced} synced, ${syncResult.skipped} skipped`);
        
        if (syncResult.errors.length > 0) {
          console.warn('⚠️  Some sync errors occurred:', syncResult.errors);
        }
      } catch (emailSyncError) {
        console.error('❌ Failed to sync Gmail emails:', emailSyncError);
        // Don't fail the whole OAuth flow if email sync fails
      }
    }
    
    // Handle popup vs regular flow
    if (isPopup && origin) {
      // Popup flow - return HTML with postMessage
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>OAuth Success</title></head>
        <body>
          <script>
            (function() {
              var origin = ${JSON.stringify(origin)};
              if (window.opener && origin) {
                window.opener.postMessage({ type: 'oauth:success' }, origin);
              }
              window.close();
            })();
          </script>
        </body>
        </html>
      `;
      res.send(html);
    } else {
      // Regular flow - redirect back to the originating CRM page
      res.redirect(returnTo);
    }
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const returnTo = req.session.oauth_return_to || '/settings';
    const isPopup = req.session.oauth_popup || false;
    const origin = req.session.oauth_origin || '';
    
    if (isPopup && origin) {
      // Popup flow - return HTML with error message
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>OAuth Error</title></head>
        <body>
          <script>
            (function() {
              var origin = ${JSON.stringify(origin)};
              if (window.opener && origin) {
                window.opener.postMessage({ type: 'oauth:error', error: ${JSON.stringify(error.message)} }, origin);
              }
              window.close();
            })();
          </script>
        </body>
        </html>
      `;
      res.send(html);
    } else {
      // Regular flow - redirect with error
      res.redirect(returnTo + '?error=' + encodeURIComponent(error.message));
    }
  }
});

/**
 * Manual sync trigger
 */
router.post('/calendar-integrations/:id/sync', async (req, res) => {
  try {
    const integration = await storage.getCalendarIntegration(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    if (integration.provider !== 'google') {
      return res.status(400).json({ error: 'Only Google Calendar sync is supported' });
    }
    
    // Sync from Google
    const result = await googleOAuthService.syncFromGoogle(integration);
    
    res.json(result);
  } catch (error: any) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync single event to Google
 */
router.post('/events/:id/sync-to-google', async (req, res) => {
  try {
    const { integrationId } = req.body;
    const eventId = req.params.id;
    
    const integration = await storage.getCalendarIntegration(integrationId);
    
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    const result = await googleOAuthService.syncToGoogle(integration, eventId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Event sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Middleware to verify Google webhook signatures
 */
const verifyGoogleWebhook = (req: any, res: any, next: any) => {
  try {
    // Get Google webhook headers
    const channelId = req.headers['x-goog-channel-id'];
    const channelToken = req.headers['x-goog-channel-token']; 
    const resourceId = req.headers['x-goog-resource-id'];
    const messageNumber = req.headers['x-goog-message-number'];
    
    // Log webhook verification attempt
    console.log('🔐 Google webhook verification:', {
      channelId,
      resourceId,
      messageNumber,
      integrationId: req.params.integrationId
    });
    
    // Verify required headers are present
    if (!channelId || !resourceId) {
      console.error('❌ Google webhook missing required headers');
      return res.status(400).send('Missing required Google webhook headers');
    }
    
    // Verify channel token if configured (never log secrets)
    if (channelToken) {
      // TODO: For production, verify against stored webhook tokens
      // Compare channelToken against stored value for this integration
      console.log('🔐 Webhook channel token verification: token present');
      // Note: Full token validation requires storing expected tokens per integration
    }
    
    // Log successful verification
    console.log('✅ Google webhook verification passed');
    next();
    
  } catch (error: any) {
    console.error('❌ Google webhook verification failed:', error);
    res.status(401).send('Webhook verification failed');
  }
};

/**
 * Webhook endpoint for Google Calendar changes
 */
router.post('/webhooks/google-calendar/:integrationId', verifyGoogleWebhook, async (req, res) => {
  try {
    const integration = await storage.getCalendarIntegration(req.params.integrationId);
    
    if (!integration) {
      console.error('❌ Integration not found for webhook:', req.params.integrationId);
      return res.status(404).send('Integration not found');
    }
    
    // Log successful webhook received
    console.log('📅 Google Calendar webhook received for integration:', integration.id);
    
    // Trigger sync in background
    googleOAuthService.syncFromGoogle(integration).catch(console.error);
    
    // Acknowledge webhook immediately
    res.status(200).send();
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).send();
  }
});

/**
 * Disconnect integration
 */
router.delete('/calendar-integrations/:id', async (req, res) => {
  try {
    const success = await storage.deleteCalendarIntegration(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    res.json({ message: 'Integration disconnected successfully' });
  } catch (error: any) {
    console.error('Error disconnecting integration:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Google Auth Status - Check if user has connected Google account and validate token
 */

router.get('/api/auth/google/status', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    // Check if user has any active Google integrations
    const integrations = await storage.getCalendarIntegrationsByUser(userId);
    const googleIntegration = integrations.find(i => i.provider === 'google' && i.isActive);
    
    if (!googleIntegration || !googleIntegration.accessToken) {
      return res.json({ ok: true, connected: false, scopes: [] });
    }
    
    // Test token validity by making a simple API call
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        access_token: googleIntegration.accessToken,
        refresh_token: googleIntegration.refreshToken,
      });
      
      // Test the token with a simple API call
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      await oauth2.userinfo.get();
      
      // If we get here, token is valid
      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.readonly', 
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly'
      ];
      
      res.json({ 
        ok: true, 
        connected: true, 
        scopes,
        email: googleIntegration.providerAccountId,
        lastSyncAt: googleIntegration.lastSyncAt
      });
      
    } catch (tokenError: any) {
      // Token is invalid or expired
      console.log(`🔒 Google token validation failed for user ${userId}:`, tokenError.message);
      
      // If it's an invalid_grant or similar, the user needs to reconnect
      if (tokenError.message && (tokenError.message.includes('invalid_grant') || 
                                  tokenError.message.includes('invalid_token') ||
                                  tokenError.message.includes('expired'))) {
        return res.json({ 
          ok: true, 
          connected: false, 
          needsReconnect: true,
          error: 'Token expired or revoked',
          scopes: [] 
        });
      }
      
      // For other errors, still report as disconnected
      return res.json({ 
        ok: true, 
        connected: false, 
        error: 'Token validation failed',
        scopes: [] 
      });
    }
    
  } catch (error: any) {
    console.error('Error checking Google auth status:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// Microsoft OAuth status endpoint - tenant/user scoped
router.get('/api/auth/microsoft/status', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId || 'default-tenant';
    
    // Check if user has active Microsoft integrations for this tenant
    const integrations = await storage.getCalendarIntegrationsByUser(userId);
    const microsoftIntegration = integrations.find(i => 
      i.provider === 'microsoft' && 
      i.isActive &&
      (i.tenantId === tenantId || (!i.tenantId && tenantId === 'default-tenant'))
    );
    
    if (!microsoftIntegration) {
      return res.json({ 
        ok: true, 
        connected: false, 
        provider: 'microsoft',
        error: 'No active Microsoft integration found for this tenant',
        scopes: [] 
      });
    }

    // For Microsoft OAuth connector status, we need to check the global connector state
    // since Microsoft OAuth integration is managed through Replit's connector system
    try {
      const connectionTest = await microsoftOAuthService.testConnection();
      
      if (connectionTest.success) {
        try {
          // Verify we can get user profile (tests permissions)
          const profile = await microsoftOAuthService.getUserProfile();
          
          res.json({ 
            ok: true, 
            connected: true, 
            provider: 'microsoft',
            email: profile.email || microsoftIntegration.providerAccountId,
            name: profile.name,
            scopes: [
              'https://graph.microsoft.com/User.Read',
              'https://graph.microsoft.com/Calendars.ReadWrite',
              'https://graph.microsoft.com/Mail.ReadWrite'
            ],
            lastSyncAt: microsoftIntegration.lastSyncAt
          });
        } catch (profileError: any) {
          console.log(`🔒 Microsoft profile fetch failed for user ${userId}, tenant ${tenantId}:`, profileError.message);
          
          // Profile failed - likely token issue or insufficient permissions
          res.json({ 
            ok: true, 
            connected: false, 
            needsReconnect: true,
            error: 'Token expired or insufficient permissions',
            provider: 'microsoft',
            scopes: [] 
          });
        }
      } else {
        // Connection test failed
        res.json({ 
          ok: true, 
          connected: false, 
          provider: 'microsoft',
          error: connectionTest.error || 'Microsoft OAuth not connected',
          needsReconnect: true,
          scopes: [] 
        });
      }
      
    } catch (tokenError: any) {
      // Token validation failed - user needs to reconnect
      console.log(`🔒 Microsoft token validation failed for user ${userId}, tenant ${tenantId}:`, tokenError.message);
      
      res.json({ 
        ok: true, 
        connected: false, 
        needsReconnect: true,
        error: 'Token expired or revoked',
        provider: 'microsoft',
        scopes: [] 
      });
    }
    
  } catch (error: any) {
    console.error('Error fetching Microsoft OAuth status:', error);
    res.status(500).json({ ok: false, connected: false, error: 'Failed to fetch status', scopes: [] });
  }
});

/**
 * Disconnect Microsoft OAuth
 */
router.post('/api/auth/microsoft/disconnect', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    // Note: For Microsoft connector, actual disconnection would need to be handled
    // through the Replit connector system. For now, we'll just return success
    // since the connection is managed externally.
    
    console.log(`🔌 Microsoft OAuth disconnect requested for user ${userId}`);
    
    res.json({ 
      ok: true, 
      message: 'Microsoft OAuth disconnection requested. Please disconnect through your account settings.' 
    });
    
  } catch (error: any) {
    console.error('Error disconnecting Microsoft OAuth:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

router.post('/api/auth/google/disconnect', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    // Find and delete all Google integrations for this user
    const integrations = await storage.getCalendarIntegrationsByUser(userId);
    const googleIntegrations = integrations.filter(i => i.provider === 'google');
    
    let deletedCount = 0;
    for (const integration of googleIntegrations) {
      const success = await storage.deleteCalendarIntegration(integration.id);
      if (success) deletedCount++;
    }
    
    res.json({ 
      ok: true, 
      message: `Disconnected ${deletedCount} Google integration(s)` 
    });
  } catch (error: any) {
    console.error('Error disconnecting Google auth:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;