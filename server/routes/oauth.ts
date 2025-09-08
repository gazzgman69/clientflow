import { Router } from 'express';
import { randomUUID } from 'crypto';
import { googleOAuthService, getGoogleAuthUrl } from '../services/google-oauth';
import { storage } from '../storage';

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

/**
 * Start OAuth flow - Generate auth URL
 */
router.post('/auth/google/start', async (req, res) => {
  try {
    const { email } = req.body;
    const userIdHeader = req.headers['user-id'];
    const userId = typeof userIdHeader === 'string' ? userIdHeader : 'test-user'; // In production, get from session
    
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
    
    // Use test-user for now (TODO: Get from actual auth context)
    const userId = 'test-user';
    
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
      
      // Also sync Gmail emails after authentication
      try {
        const { gmailService } = await import('../src/services/gmail');
        
        console.log('🔄 Syncing Gmail emails after OAuth...');
        
        // Fetch recent email threads from Gmail
        const threadsResponse = await gmailService.listThreads(userId, { limit: 20 });
        if (threadsResponse.ok && threadsResponse.threads && threadsResponse.threads.length > 0) {
          console.log(`✅ Found ${threadsResponse.threads.length} Gmail threads after OAuth`);
          // Email threads are now accessible via Gmail API, no additional sync needed
        } else {
          console.log('ℹ️  No Gmail threads found or error occurred:', threadsResponse.error);
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
 * Webhook endpoint for Google Calendar changes
 */
router.post('/webhooks/google-calendar/:integrationId', async (req, res) => {
  try {
    const integration = await storage.getCalendarIntegration(req.params.integrationId);
    
    if (!integration) {
      return res.status(404).send('Integration not found');
    }
    
    // Trigger sync in background
    googleOAuthService.syncFromGoogle(integration).catch(console.error);
    
    // Acknowledge webhook immediately
    res.status(200).send();
  } catch (error: any) {
    console.error('Webhook error:', error);
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
 * Google Auth Status - Check if user has connected Google account
 */
router.get('/api/auth/google/status', async (req, res) => {
  try {
    const userIdHeader = req.headers['user-id'];
    const userId = typeof userIdHeader === 'string' ? userIdHeader : 'test-user';
    
    // Check if user has any active Google integrations
    const integrations = await storage.getCalendarIntegrationsByUser(userId);
    const googleIntegration = integrations.find(i => i.provider === 'google' && i.isActive);
    
    if (!googleIntegration || !googleIntegration.accessToken) {
      return res.json({ ok: true, connected: false, scopes: [] });
    }
    
    // Extract scopes from stored integration or default list
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
      email: googleIntegration.providerAccountId 
    });
  } catch (error: any) {
    console.error('Error checking Google auth status:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Google Auth Disconnect - Remove Google tokens for user  
 */
router.post('/api/auth/google/disconnect', async (req, res) => {
  try {
    const userIdHeader = req.headers['user-id'];
    const userId = typeof userIdHeader === 'string' ? userIdHeader : 'test-user';
    
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