import { Router } from 'express';
import crypto from 'crypto';
import { googleOAuthService } from '../services/google-oauth';
import { microsoftOAuthService } from '../services/microsoft-oauth';
import { storage } from '../../storage';
import { google } from 'googleapis';
import { db } from '../../db';
import { calendarIntegrations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { encodeState, decodeState } from '../../oauth/state';
import { OAuth2Client } from 'google-auth-library';

// Extend session type to include oauth_state and oauth_return_to
declare module 'express-session' {
  interface SessionData {
    oauth_state?: string;
    oauth_return_to?: string;
    oauth_popup?: boolean;
    oauth_origin?: string;
    pkceCodeVerifier?: string; // PKCE code verifier for OAuth security
  }
}

const router = Router();

// Gmail OAuth scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/contacts.readonly',
  'openid',
  'email',
  'profile',
];

/**
 * Unified Gmail OAuth start route - Use this for email provider modal
 */
router.get('/auth/google/start', (req, res) => {
  try {
    // Require authentication for OAuth flows
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required for OAuth' });
    }
    
    const tenantId = req.session.tenantId || 'default-tenant';
    const userId = req.session.userId;
    
    // Build state object with popup metadata
    const popupValue = req.query.popup === '1';
    const stateObj = {
      tenantId,
      userId,
      popup: popupValue,
      origin: (req.query.origin as string) || `${req.protocol}://${req.get('host')}`,
      returnTo: '/settings/email-and-calendar'
    };
    
    console.log('🔐 Google OAuth START:', { 
      popupQuery: req.query.popup, 
      popupValue,
      userId, 
      tenantId,
      stateObj: JSON.stringify(stateObj)
    });
    
    // Create OAuth2 client
    const oauth2 = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/google/callback`
    );
    
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: GMAIL_SCOPES,
      state: encodeState(stateObj)
    });
    
    console.log('🔐 Redirecting to Google OAuth with encoded state');
    res.redirect(url);
  } catch (error: any) {
    console.error('Error starting Google OAuth:', error);
    res.status(500).send('Failed to start OAuth flow');
  }
});

/**
 * Unified Microsoft OAuth start route - Use this for email provider modal
 */
router.get('/auth/microsoft/start', (req, res) => {
  try {
    // Require authentication for OAuth flows
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required for OAuth' });
    }
    
    const tenantId = req.session.tenantId || 'default-tenant';
    const userId = req.session.userId;
    const provider = (req.query.provider as string) || 'microsoft';
    
    // Build state object with popup metadata
    const stateObj = {
      tenantId,
      userId,
      popup: req.query.popup === '1',
      origin: (req.query.origin as string) || `${req.protocol}://${req.get('host')}`,
      returnTo: '/settings/email-and-calendar',
      provider
    };
    
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/microsoft/callback`,
      response_mode: 'query',
      scope: [
        'openid', 'email', 'profile', 'offline_access',
        'Mail.Read', 'Mail.Send', 'Contacts.Read'
      ].join(' '),
      prompt: 'consent',
      state: encodeState(stateObj)
    });
    
    console.log('🔐 Microsoft OAuth start:', { popup: stateObj.popup, userId, tenantId, provider });
    res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`);
  } catch (error: any) {
    console.error('Error starting Microsoft OAuth:', error);
    res.status(500).send('Failed to start Microsoft OAuth flow');
  }
});

/**
 * Simple auth start route - Force consent with Gmail scopes with PKCE (backward compatibility)
 */
router.get('/auth/google', (req, res) => {
  try {
    // Read query parameters
    const popup = Boolean(req.query.popup);
    const returnTo = (req.query.returnTo as string) || '/settings';
    const origin = (req.query.origin as string) || '';
    
    // Save popup flag, return URL, and origin to session
    req.session.oauth_popup = popup;
    req.session.oauth_return_to = returnTo;
    req.session.oauth_origin = origin;
    
    // Set default tenant for OAuth sessions (required by TenantAwareSessionStore)
    if (!req.session.tenantId) {
      req.session.tenantId = 'default-tenant';
    }
    
    // Require authentication for OAuth flows
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required for OAuth' });
    }
    
    // Generate OAuth URL with signed state and PKCE protection
    const authUrl = googleOAuthService.generateAuthUrl(
      req.session.user?.email || 'user@example.com',
      req.session.userId,
      req.session.tenantId,
      req.session,
      'all',
      returnTo
    );
    
    console.log('🔐 SECURITY: GET /auth/google now using signed state and PKCE protection with all services');
    
    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error starting Google OAuth:', error);
    res.status(500).send('Failed to start OAuth flow');
  }
});

/**
 * Gmail-specific OAuth start route
 */
router.get('/auth/google/gmail', (req, res) => {
  try {
    // Read query parameters
    const popup = Boolean(req.query.popup);
    const returnTo = (req.query.returnTo as string) || '/settings';
    const origin = (req.query.origin as string) || '';
    
    // Save popup flag, return URL, and origin to session
    req.session.oauth_popup = popup;
    req.session.oauth_return_to = returnTo;
    req.session.oauth_origin = origin;
    
    // Set default tenant for OAuth sessions (required by TenantAwareSessionStore)
    if (!req.session.tenantId) {
      req.session.tenantId = 'default-tenant';
    }
    
    // Require authentication for OAuth flows
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required for OAuth' });
    }
    
    // Generate OAuth URL with signed state and PKCE protection
    const authUrl = googleOAuthService.generateAuthUrl(
      req.session.user?.email || 'user@example.com',
      req.session.userId,
      req.session.tenantId,
      req.session,
      'gmail',
      returnTo
    );
    
    console.log('🔐 SECURITY: GET /auth/google/gmail using signed state and PKCE protection with Gmail scopes only');
    
    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error starting Google Gmail OAuth:', error);
    res.status(500).send('Failed to start Gmail OAuth flow');
  }
});

/**
 * Calendar-specific OAuth start route
 */
router.get('/auth/google/calendar', (req, res) => {
  try {
    // Read query parameters
    const popup = Boolean(req.query.popup);
    const returnTo = (req.query.returnTo as string) || '/calendar';
    const origin = (req.query.origin as string) || '';
    
    // Save popup flag, return URL, and origin to session
    req.session.oauth_popup = popup;
    req.session.oauth_return_to = returnTo;
    req.session.oauth_origin = origin;
    
    // Set default tenant for OAuth sessions (required by TenantAwareSessionStore)
    if (!req.session.tenantId) {
      req.session.tenantId = 'default-tenant';
    }
    
    // Require authentication for OAuth flows
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required for OAuth' });
    }
    
    // Generate OAuth URL with signed state and PKCE protection
    const authUrl = googleOAuthService.generateAuthUrl(
      req.session.user?.email || 'user@example.com',
      req.session.userId,
      req.session.tenantId,
      req.session,
      'calendar',
      returnTo
    );
    
    console.log('🔐 SECURITY: GET /auth/google/calendar using signed state and PKCE protection with Calendar scopes only');
    
    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error starting Google Calendar OAuth:', error);
    res.status(500).send('Failed to start Calendar OAuth flow');
  }
});

/**
 * Microsoft Mail OAuth start route
 */
router.get('/auth/microsoft/mail', (req, res) => {
  try {
    // Read query parameters
    const popup = Boolean(req.query.popup);
    const returnTo = (req.query.returnTo as string) || '/settings';
    const origin = (req.query.origin as string) || '';
    
    // Save popup flag, return URL, and origin to session
    req.session.oauth_popup = popup;
    req.session.oauth_return_to = returnTo;
    req.session.oauth_origin = origin;
    
    // Set default tenant for OAuth sessions (required by TenantAwareSessionStore)
    if (!req.session.tenantId) {
      req.session.tenantId = 'default-tenant';
    }
    
    // Require authentication for OAuth flows
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required for OAuth' });
    }
    
    // For now, redirect to Microsoft connector setup since full OAuth isn't implemented yet
    // This maintains the user's expectation of re-authentication
    const connectorUrl = process.env.REPLIT_CONNECTORS_HOSTNAME 
      ? `https://${process.env.REPLIT_CONNECTORS_HOSTNAME}/outlook`
      : '/settings';
    
    console.log('🔐 SECURITY: GET /auth/microsoft/mail redirecting to Microsoft connector setup');
    console.log('🔐 NOTE: Full Microsoft OAuth implementation pending - using connector approach');
    
    // For development, show a message about Microsoft OAuth
    res.redirect(`${returnTo}?message=${encodeURIComponent('Microsoft re-authentication requires setup through Microsoft connector')}`);
    
  } catch (error: any) {
    console.error('Error starting Microsoft Mail OAuth:', error);
    res.status(500).send('Failed to start Microsoft Mail OAuth flow');
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
  if (!req.session?.tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context required', 
      message: 'Session missing tenant information'
    });
  }
  req.authenticatedUserId = req.session.userId;
  req.tenantId = req.session.tenantId;
  next();
};

/**
 * Start OAuth flow - Generate auth URL (backward compatibility - all services)
 */
router.post('/auth/google/start', requireAuth, async (req: any, res) => {
  try {
    const { email, popup, origin, returnTo } = req.body;
    const userId = req.authenticatedUserId;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if integration already exists (backward compatibility - look for any Google integration)
    const existing = await storage.getCalendarIntegrationByEmail(email, userId, req.tenantId);
    if (existing && existing.refreshToken) {
      return res.json({ 
        message: 'Already connected',
        integration: existing 
      });
    }
    
    // Create a random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Generate PKCE challenge and verifier for security
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    // Save state, popup flag, return URL, origin, and PKCE verifier to session
    req.session.oauth_state = state;
    req.session.oauth_popup = popup || true; // Default to popup for POST route
    req.session.oauth_return_to = returnTo || '/settings';
    req.session.oauth_origin = origin || '';
    req.session.pkceCodeVerifier = codeVerifier;
    req.session.serviceType = 'all'; // Backward compatibility
    
    // Generate OAuth URL with PKCE support and signed state (all services for backward compatibility)
    const authUrl = googleOAuthService.generateAuthUrl(email, userId, req.tenantId, req.session, 'all', returnTo);
    
    console.log('🔐 SECURITY: POST /auth/google/start now using PKCE protection with all services');
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error starting OAuth:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start Gmail OAuth flow - Generate auth URL for Gmail-specific scopes
 */
router.post('/auth/google/gmail/start', requireAuth, async (req: any, res) => {
  try {
    const { email, popup, origin, returnTo } = req.body;
    const userId = req.authenticatedUserId;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if Gmail integration already exists for this email
    const integrations = await storage.getCalendarIntegrationsByUser(userId, req.tenantId);
    const existing = integrations.find(i => 
      i.provider === 'google' && 
      i.providerAccountId === email && 
      (i.serviceType === 'gmail' || !i.serviceType) && // Handle existing records without serviceType
      i.refreshToken
    );
    
    if (existing) {
      return res.json({ 
        message: 'Gmail already connected',
        integration: existing 
      });
    }
    
    // Create a random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Generate PKCE challenge and verifier for security
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    // Save state, popup flag, return URL, origin, and PKCE verifier to session
    req.session.oauth_state = state;
    req.session.oauth_popup = popup || true; // Default to popup for POST route
    req.session.oauth_return_to = returnTo || '/settings';
    req.session.oauth_origin = origin || '';
    req.session.pkceCodeVerifier = codeVerifier;
    req.session.serviceType = 'gmail';
    
    // Generate OAuth URL with Gmail-specific scopes and signed state
    const authUrl = googleOAuthService.generateAuthUrl(email, userId, req.tenantId, req.session, 'gmail', returnTo);
    
    console.log('🔐 SECURITY: POST /auth/google/gmail/start using Gmail-specific scopes');
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error starting Gmail OAuth:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start Calendar OAuth flow - Generate auth URL for Calendar-specific scopes
 */
router.post('/auth/google/calendar/start', requireAuth, async (req: any, res) => {
  try {
    const { email, popup, origin, returnTo } = req.body;
    const userId = req.authenticatedUserId;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if Calendar integration already exists for this email
    const integrations = await storage.getCalendarIntegrationsByUser(userId, req.tenantId);
    const existing = integrations.find(i => 
      i.provider === 'google' && 
      i.providerAccountId === email && 
      (i.serviceType === 'calendar' || !i.serviceType) && // Handle existing records without serviceType
      i.refreshToken
    );
    
    if (existing) {
      return res.json({ 
        message: 'Calendar already connected',
        integration: existing 
      });
    }
    
    // Create a random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Generate PKCE challenge and verifier for security
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    // Save state, popup flag, return URL, origin, and PKCE verifier to session
    req.session.oauth_state = state;
    req.session.oauth_popup = popup || true; // Default to popup for POST route
    req.session.oauth_return_to = returnTo || '/settings';
    req.session.oauth_origin = origin || '';
    req.session.pkceCodeVerifier = codeVerifier;
    req.session.serviceType = 'calendar';
    
    // Generate OAuth URL with Calendar-specific scopes and signed state
    const authUrl = googleOAuthService.generateAuthUrl(email, userId, req.tenantId, req.session, 'calendar', returnTo);
    
    console.log('🔐 SECURITY: POST /auth/google/calendar/start using Calendar-specific scopes');
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error starting Calendar OAuth:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check scope sufficiency and suggest repair if needed
 */
router.get('/auth/google/scope-check', async (req, res) => {
  try {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.session.userId;
    const tenantId = req.session.tenantId;

    // Get all user's calendar integrations
    const integrations = await storage.getCalendarIntegrationsByUser(userId, tenantId);
    const googleIntegrations = integrations.filter(i => i.provider === 'google' && i.isActive);

    console.log('🔍 SCOPE CHECK: Checking scope sufficiency for integrations', {
      userId,
      tenantId,
      integrationCount: googleIntegrations.length
    });

    const result = {
      needsRepair: false,
      integrations: [],
      insufficientScopes: []
    };

    for (const integration of googleIntegrations) {
      try {
        // Try to create calendar service and make a test call
        const calendarService = await googleOAuthService.getCalendarService(integration);
        await calendarService.calendars.get({ calendarId: 'primary' });
        
        result.integrations.push({
          id: integration.id,
          email: integration.providerAccountId,
          serviceType: integration.serviceType || 'calendar',
          status: 'sufficient'
        });
      } catch (error: any) {
        console.log('⚠️ SCOPE CHECK: Insufficient scopes detected', {
          integrationId: integration.id,
          email: integration.providerAccountId,
          error: error.message
        });

        result.needsRepair = true;
        result.integrations.push({
          id: integration.id,
          email: integration.providerAccountId,
          serviceType: integration.serviceType || 'calendar',
          status: 'insufficient',
          error: error.message
        });

        if (error.message.includes('insufficient authentication scopes')) {
          result.insufficientScopes.push(integration.serviceType || 'calendar');
        }
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error in scope check:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * OAuth callback - Exchange code for tokens
 */
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Validate presence of code
    if (!code) {
      console.error('Missing authorization code in callback');
      return res.status(400).send('Missing code');
    }
    
    // Decode state parameter
    const parsed = decodeState<any>(state);
    console.log('🔐 Google OAuth callback - State decoded:', JSON.stringify(parsed, null, 2));
    
    if (!parsed) {
      return res.status(400).send('Invalid state');
    }
    
    const { tenantId, userId, popup, returnTo } = parsed;
    console.log('🔐 Google OAuth callback - Popup mode:', popup, '(type:', typeof popup, ')');
    
    if (!userId || !tenantId) {
      return res.status(401).send('Authentication required');
    }
    
    // Create OAuth2 client
    const oauth2 = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/google/callback`
    );
    
    // Exchange code for tokens
    const { tokens: tokenData } = await oauth2.getToken(code as string);
    
    if (!tokenData.access_token) {
      return res.status(400).send('Failed to get access token');
    }
    
    // Get user info to get email
    oauth2.setCredentials(tokenData);
    const oauth2Client = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: userInfo } = await oauth2Client.userinfo.get();
    
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || undefined,
      email: userInfo.email || ''
    };
    
    // Log token scopes for verification
    console.log('📝 OAUTH CALLBACK: Token exchange completed', {
      email: tokens.email,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      userId,
      tenantId
    });
    
    // Save to email_accounts table
    console.log('📧 GMAIL OAUTH: Saving to email_accounts table', {
      email: tokens.email,
      userId,
      tenantId
    });
    
    await storage.upsertEmailProvider(tenantId, {
      userId,
      provider: 'google',
      providerKey: 'google',
      status: 'connected',
      accountEmail: tokens.email,
      accessTokenEnc: tokens.access_token,
      refreshTokenEnc: tokens.refresh_token || undefined,
      scopes: GMAIL_SCOPES,
      metadata: {
        connectedAt: new Date().toISOString()
      }
    });
    
    console.log('✅ GMAIL OAUTH: Successfully saved to email_accounts');
    
    // Handle popup response
    if (popup) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!doctype html><html><body><script>
        (function(){
          try { window.opener && window.opener.postMessage({type:'oauth:connected', provider:'google', ok:true}, '*'); } catch(e) {}
          try { window.close(); } catch(e) {}
          setTimeout(function(){ if (!window.closed) document.body.innerHTML='Connected. You can close this window.'; }, 150);
        })();
      </script></body></html>`);
    }
    
    return res.redirect(returnTo || '/settings/email-and-calendar');
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth failed');
  }
});

/**
 * Manual sync trigger
 */
router.post('/calendar-integrations/:id/sync', requireAuth, async (req: any, res) => {
  try {
    const integration = await storage.getCalendarIntegration(req.params.id, req.tenantId);
    
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

/** START TEMP CODE TO DELETE **/
function TEMP_DEADCODE() {
    // Tenant-scoped lookup by (tenant_id, provider, provider_account_id)

/**
 * Manual sync trigger
 */
router.post('/calendar-integrations/:id/sync', requireAuth, async (req: any, res) => {
  try {
    const integration = await storage.getCalendarIntegration(req.params.id, req.tenantId);
    
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
router.post('/events/:id/sync-to-google', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.body;
    const eventId = req.params.id;
    
    const integration = await storage.getCalendarIntegration(integrationId, req.tenantId);
    
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
const verifyGoogleWebhook = async (req: any, res: any, next: any) => {
  try {
    // Get Google webhook headers
    const channelId = req.headers['x-goog-channel-id'];
    const channelToken = req.headers['x-goog-channel-token']; 
    const resourceId = req.headers['x-goog-resource-id'];
    const messageNumber = req.headers['x-goog-message-number'];
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceUri = req.headers['x-goog-resource-uri'];
    
    // Log webhook verification attempt
    console.log('🔐 Google webhook verification:', {
      channelId,
      resourceId,
      messageNumber,
      resourceState,
      integrationId: req.params.integrationId
    });
    
    // Verify required headers are present
    if (!channelId || !resourceId) {
      console.error('❌ Google webhook missing required headers');
      return res.status(400).send('Missing required Google webhook headers');
    }
    
    // Get the integration to verify the webhook belongs to this tenant/user
    const integrationId = req.params.integrationId;
    if (!integrationId) {
      console.error('❌ Google webhook missing integration ID');
      return res.status(400).send('Missing integration ID');
    }
    
    // Get integration without tenantId for webhook verification - security validation done later
    const integration = await db.select().from(calendarIntegrations).where(eq(calendarIntegrations.id, integrationId));
    if (!integration[0]) {
      console.error('❌ Google webhook integration not found:', integrationId);
      return res.status(404).send('Integration not found');
    }
    const integrationData = integration[0];
    if (!integration) {
      console.error('❌ Google webhook integration not found:', integrationId);
      return res.status(404).send('Integration not found');
    }
    
    // Verify the resourceId matches the stored webhook ID for this integration
    if (integrationData.webhookId && integrationData.webhookId !== resourceId) {
      console.error('❌ Google webhook resource ID mismatch:', {
        expected: integrationData.webhookId,
        received: resourceId,
        integrationId
      });
      return res.status(403).send('Webhook resource ID mismatch');
    }
    
    // Verify channel token if configured (cryptographic validation)
    if (channelToken && integrationData.webhookId) {
      try {
        // Create expected signature using webhook secret + resource ID + channel ID
        const crypto = require('crypto');
        const webhookSecret = process.env.GOOGLE_WEBHOOK_SECRET || integrationData.webhookId;
        
        // Create signature payload: method + url + timestamp + body
        const payload = `${req.method}${req.originalUrl}${messageNumber || ''}${JSON.stringify(req.body || {})}`;
        
        // Generate expected signature using HMAC-SHA256
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(payload)
          .digest('hex');
        
        // Compare signatures using timing-safe comparison
        const providedSignature = channelToken;
        
        // For Google webhooks, the channel token is not necessarily a signature
        // Instead, we validate that it matches our stored expectation
        if (integrationData.settings) {
          try {
            const settings = JSON.parse(integrationData.settings);
            if (settings.expectedChannelToken && settings.expectedChannelToken !== channelToken) {
              console.error('❌ Google webhook channel token mismatch');
              return res.status(403).send('Invalid webhook channel token');
            }
          } catch (parseError) {
            console.warn('⚠️ Could not parse integration settings for webhook verification');
          }
        }
        
        console.log('🔐 Webhook channel token verification: validated');
      } catch (signatureError: any) {
        console.error('❌ Google webhook signature verification failed:', signatureError.message);
        return res.status(403).send('Invalid webhook signature');
      }
    }
    
    // Verify webhook is from Google by checking resource URI pattern
    if (resourceUri && !resourceUri.includes('googleapis.com')) {
      console.error('❌ Google webhook invalid resource URI:', resourceUri);
      return res.status(403).send('Invalid webhook source');
    }
    
    // Log successful verification
    console.log('✅ Google webhook verification passed:', {
      integrationId,
      userId: integrationData.userId,
      resourceState
    });
    
    // Add integration context to request for webhook handler
    req.webhookIntegration = integrationData;
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
    // Integration already verified in webhook verification middleware
    const integration = req.webhookIntegration;
    
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
router.delete('/calendar-integrations/:id', requireAuth, async (req: any, res) => {
  try {
    const success = await storage.deleteCalendarIntegration(req.params.id, req.tenantId);
    
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
    // Prevent caching to ensure UI gets fresh sync error data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const userId = req.authenticatedUserId;
    
    // Check if user has any active Google integrations
    const integrations = await storage.getCalendarIntegrationsByUser(userId, req.tenantId);
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
        lastSyncAt: googleIntegration.lastSyncAt,
        syncErrors: googleIntegration.syncErrors
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

/**
 * Gmail Auth Status - Check if user has connected Gmail specifically
 */
router.get('/api/auth/google/gmail/status', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    // Check if user has active Gmail integrations
    const integrations = await storage.getCalendarIntegrationsByUser(userId, req.tenantId);
    const gmailIntegration = integrations.find(i => 
      i.provider === 'google' && 
      i.isActive && 
      (i.serviceType === 'gmail' || (!i.serviceType && i.accessToken)) // Handle legacy records
    );
    
    if (!gmailIntegration || !gmailIntegration.accessToken) {
      return res.json({ 
        ok: true, 
        connected: false, 
        service: 'gmail',
        scopes: [] 
      });
    }
    
    // Test token validity by making a simple API call
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        access_token: gmailIntegration.accessToken,
        refresh_token: gmailIntegration.refreshToken,
      });
      
      // Test the token with a simple API call
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      await oauth2.userinfo.get();
      
      // If we get here, token is valid - return Gmail-specific scopes
      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly'
      ];
      
      res.json({ 
        ok: true, 
        connected: true,
        service: 'gmail', 
        scopes,
        email: gmailIntegration.providerAccountId,
        lastSyncAt: gmailIntegration.lastSyncAt
      });
      
    } catch (tokenError: any) {
      // Token is invalid or expired
      console.log(`🔒 Gmail token validation failed for user ${userId}:`, tokenError.message);
      
      if (tokenError.message && (tokenError.message.includes('invalid_grant') || 
                                  tokenError.message.includes('invalid_token') ||
                                  tokenError.message.includes('expired'))) {
        return res.json({ 
          ok: true, 
          connected: false,
          service: 'gmail', 
          needsReconnect: true,
          error: 'Token expired or revoked',
          scopes: [] 
        });
      }
      
      return res.json({ 
        ok: true, 
        connected: false,
        service: 'gmail', 
        error: 'Token validation failed',
        scopes: [] 
      });
    }
    
  } catch (error: any) {
    console.error('Error checking Gmail auth status:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Calendar Auth Status - Check if user has connected Google Calendar specifically
 */
router.get('/api/auth/google/calendar/status', requireAuth, async (req: any, res) => {
  try {
    // Prevent caching to ensure UI gets fresh sync error data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const userId = req.authenticatedUserId;
    
    // Check if user has active Calendar integrations
    const integrations = await storage.getCalendarIntegrationsByUser(userId, req.tenantId);
    const calendarIntegration = integrations.find(i => 
      i.provider === 'google' && 
      i.isActive && 
      (i.serviceType === 'calendar' || (!i.serviceType && i.accessToken)) // Handle legacy records
    );
    
    if (!calendarIntegration || !calendarIntegration.accessToken) {
      return res.json({ 
        ok: true, 
        connected: false, 
        service: 'calendar',
        scopes: [] 
      });
    }
    
    // Test token validity by making a simple API call
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        access_token: calendarIntegration.accessToken,
        refresh_token: calendarIntegration.refreshToken,
      });
      
      // Test the token with a simple API call
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      await oauth2.userinfo.get();
      
      // If we get here, token is valid - return Calendar-specific scopes
      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ];
      
      res.json({ 
        ok: true, 
        connected: true,
        service: 'calendar', 
        scopes,
        email: calendarIntegration.providerAccountId,
        lastSyncAt: calendarIntegration.lastSyncAt,
        syncErrors: calendarIntegration.syncErrors
      });
      
    } catch (tokenError: any) {
      // Token is invalid or expired
      console.log(`🔒 Calendar token validation failed for user ${userId}:`, tokenError.message);
      
      if (tokenError.message && (tokenError.message.includes('invalid_grant') || 
                                  tokenError.message.includes('invalid_token') ||
                                  tokenError.message.includes('expired'))) {
        return res.json({ 
          ok: true, 
          connected: false,
          service: 'calendar', 
          needsReconnect: true,
          error: 'Token expired or revoked',
          scopes: [] 
        });
      }
      
      return res.json({ 
        ok: true, 
        connected: false,
        service: 'calendar', 
        error: 'Token validation failed',
        scopes: [] 
      });
    }
    
  } catch (error: any) {
    console.error('Error checking Calendar auth status:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// Microsoft OAuth status endpoint - tenant/user scoped
router.get('/api/auth/microsoft/status', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    // Check if user has active Microsoft integrations for this tenant
    const integrations = await storage.getCalendarIntegrationsByUser(userId, tenantId);
    const microsoftIntegration = integrations.find(i => 
      i.provider === 'microsoft' && 
      i.isActive &&
      i.tenantId === tenantId
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

    // SECURITY HARDENING: Microsoft OAuth now requires explicit connection validation
    // No auto-linking from connector system without explicit user consent
    try {
      const connectionTest = await microsoftOAuthService.testConnection({
        tenantId,
        userId,
        requireExplicitConnection: true, // Security: Block auto-linking
        isSystemOperation: false
      });
      
      if (connectionTest.success) {
        try {
          // Verify we can get user profile (tests permissions)
          const profile = await microsoftOAuthService.getUserProfile({
            tenantId,
            userId,
            requireExplicitConnection: true, // Security: Block auto-linking
            isSystemOperation: false
          });
          
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
    
    let deletedCount = 0;
    
    try {
      // Try to get integrations normally first
      const integrations = await storage.getCalendarIntegrationsByUser(userId, req.tenantId);
      const googleIntegrations = integrations.filter(i => i.provider === 'google');
      
      for (const integration of googleIntegrations) {
        const success = await storage.deleteCalendarIntegration(integration.id, req.tenantId);
        if (success) deletedCount++;
      }
      
      console.log(`🔌 Successfully disconnected ${deletedCount} Google integration(s) for user ${userId}`);
    } catch (decryptionError: any) {
      console.warn('⚠️ Token decryption failed, using direct database cleanup:', decryptionError.message);
      
      // If decryption fails, delete Google integrations directly from database
      // This handles corrupted tokens that can't be decrypted
      const { calendarIntegrations, events } = await import('@shared/schema');
      const { eq, and, inArray } = await import('drizzle-orm');
      const { neon } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-http');
      
      const sql = neon(process.env.DATABASE_URL!);
      const db = drizzle(sql);
      
      // First, get all Google calendar integration IDs for this user
      const googleIntegrations = await db.select({ id: calendarIntegrations.id })
        .from(calendarIntegrations)
        .where(and(
          eq(calendarIntegrations.userId, userId),
          eq(calendarIntegrations.provider, 'google')
        ));
      
      if (googleIntegrations.length > 0) {
        const integrationIds = googleIntegrations.map(i => i.id);
        
        // Delete related calendar events first to avoid foreign key constraint
        const deletedEvents = await db.delete(events)
          .where(inArray(events.calendarIntegrationId, integrationIds))
          .returning({ id: events.id });
        
        console.log(`🗑️ Deleted ${deletedEvents.length} calendar events before removing Google integrations`);
        
        // Now delete the calendar integrations
        const result = await db.delete(calendarIntegrations)
          .where(and(
            eq(calendarIntegrations.userId, userId),
            eq(calendarIntegrations.provider, 'google')
          ))
          .returning({ id: calendarIntegrations.id });
        
        deletedCount = result.length;
        console.log(`🔌 Direct database cleanup: removed ${deletedCount} corrupted Google integration(s) for user ${userId}`);
      } else {
        console.log(`🔌 No Google integrations found for user ${userId}`);
      }
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

/**
 * Manual Google Calendar Sync
 */
router.post('/api/auth/google/sync', requireAuth, async (req: any, res) => {
  try {
    // Feature flag: CAL_SYNC_NOW_ENABLED=1 enables manual sync endpoint
    const syncNowEnabled = process.env.CAL_SYNC_NOW_ENABLED === '1';
    if (!syncNowEnabled) {
      console.log('🚫 SYNC NOW: Manual sync endpoint disabled', {
        featureFlag: 'CAL_SYNC_NOW_ENABLED',
        currentValue: process.env.CAL_SYNC_NOW_ENABLED,
        requiredValue: '1',
        userId: req.authenticatedUserId,
        tenantId: req.tenantId
      });
      return res.status(404).json({ 
        error: 'Manual sync feature is not available' 
      });
    }
    
    const userId = req.authenticatedUserId;
    
    console.log('🔄 SYNC NOW: Manual sync triggered', {
      action: 'manual_sync_triggered',
      userId,
      tenantId: req.tenantId,
      featureFlag: 'CAL_SYNC_NOW_ENABLED=1',
      timestamp: new Date().toISOString()
    });
    
    // Get active Google integrations for this user
    const integrations = await storage.getCalendarIntegrationsByUser(userId, req.tenantId);
    const activeGoogleIntegrations = integrations.filter(i => 
      i.provider === 'google' && i.isActive
    );
    
    if (activeGoogleIntegrations.length === 0) {
      return res.status(400).json({ 
        error: 'No active Google Calendar integrations found' 
      });
    }
    
    // Trigger sync for all active Google integrations
    let syncCount = 0;
    let errors: string[] = [];
    
    for (const integration of activeGoogleIntegrations) {
      try {
        await googleOAuthService.syncFromGoogle(integration);
        syncCount++;
        console.log(`✅ Manual sync completed for integration ${integration.id}`);
      } catch (syncError: any) {
        console.error(`❌ Manual sync failed for integration ${integration.id}:`, syncError);
        errors.push(`${integration.calendarName}: ${syncError.message}`);
      }
    }
    
    // Update last sync time for successful integrations
    await Promise.all(
      activeGoogleIntegrations.slice(0, syncCount).map(integration =>
        storage.updateCalendarIntegration(integration.id, {
          lastSyncAt: new Date()
        }, req.tenantId)
      )
    );
    
    if (errors.length > 0 && syncCount === 0) {
      // All syncs failed
      return res.status(500).json({ 
        error: 'All calendar syncs failed',
        details: errors
      });
    }
    
    res.json({ 
      success: true, 
      message: `Successfully synced ${syncCount} of ${activeGoogleIntegrations.length} calendar(s)`,
      syncCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Manual Google sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;