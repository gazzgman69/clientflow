import { Router } from 'express';
import { googleOAuthService } from '../services/google-oauth';
import { storage } from '../storage';

const router = Router();

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
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('Missing authorization code or state');
    }
    
    // Decode state to get user info
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { email, userId } = stateData;
    
    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(code as string);
    
    // Check if integration already exists
    let integration = await storage.getCalendarIntegrationByEmail(tokens.email, userId);
    
    if (integration) {
      // Update existing integration
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
    }
    
    // Redirect back to app with success message
    res.redirect('/?calendar=connected');
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect('/?calendar=error&message=' + encodeURIComponent(error.message));
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

export default router;