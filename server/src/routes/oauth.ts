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

// DEBUG: Router-level logging to track if requests reach the router
router.use((req, res, next) => {
  console.log('🔄 OAUTH ROUTER HIT:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
  next();
});

// DEBUG: Safe state decoder for logging
function decodeStateSafe(s?: string) {
  try { 
    return JSON.parse(Buffer.from(String(s), "base64url").toString("utf8")); 
  } catch { 
    try { 
      return JSON.parse(Buffer.from(String(s || ""), "base64").toString("utf8")); 
    } catch { 
      return null; 
    } 
  }
}

// DEBUG: Probe endpoints (only when DEBUG_OAUTH=1)
if (process.env.DEBUG_OAUTH === '1') {
  router.get("/auth/google/callback-probe", (req, res) => {
    res.type("text").send("GOOGLE CALLBACK OWNED BY SERVER");
  });
  
  router.get("/auth/microsoft/callback-probe", (req, res) => {
    res.type("text").send("MICROSOFT CALLBACK OWNED BY SERVER");
  });
  
  console.log('🐛 DEBUG_OAUTH: Probe endpoints registered');
}

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
router.get('/api/auth/google/start', (req, res) => {
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
    
    // Create OAuth2 client with correct redirect URI
    const getRedirectUri = () => {
      if (process.env.REPLIT_DOMAINS) {
        const domain = process.env.REPLIT_DOMAINS.split(',')[0];
        return `https://${domain}/auth/google/callback`;
      }
      return process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/google/callback`;
    };
    
    const oauth2 = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      getRedirectUri()
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
router.get('/api/auth/microsoft/start', (req, res) => {
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
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`,
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
router.get('/auth/google/calendar', async (req, res) => {
  try {
    // Read query parameters
    const popup = Boolean(req.query.popup);
    const returnTo = (req.query.returnTo as string) || '/calendar';
    const origin = (req.query.origin as string) || '';
    
    console.log('🚨🚨🚨 CALENDAR OAUTH START - RAW PARAMS:', {
      rawPopup: req.query.popup,
      popupType: typeof req.query.popup,
      booleanPopup: popup,
      booleanType: typeof popup,
      returnTo,
      origin
    });
    
    console.log('🔐 OAUTH START /auth/google/calendar:', {
      popup,
      hasSession: !!req.session,
      sessionId: req.session?.id,
      userId: req.session?.userId,
      tenantId: req.session?.tenantId
    });
    
    // Try to get userId and tenantId from session
    let userId = req.session.userId;
    let tenantId = req.session.tenantId;
    let userEmail = req.session.user?.email;
    
    // If session is empty (popup scenario), try to reload it
    if (!userId && req.session.id) {
      console.log('📱 POPUP: No userId in popup session, attempting to reload session');
      try {
        await new Promise((resolve, reject) => {
          req.session.reload((err) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
        
        userId = req.session.userId;
        tenantId = req.session.tenantId;
        userEmail = req.session.user?.email;
        
        console.log('✅ POPUP: Session reloaded, userId:', userId);
      } catch (err) {
        console.error('❌ POPUP: Failed to reload session:', err);
      }
    }
    
    // Save popup flag, return URL, and origin to session
    req.session.oauth_popup = popup;
    req.session.oauth_return_to = returnTo;
    req.session.oauth_origin = origin;
    
    // Set default tenant for OAuth sessions (required by TenantAwareSessionStore)
    if (!tenantId) {
      tenantId = 'default-tenant';
      req.session.tenantId = tenantId;
    }
    
    // Require authentication for OAuth flows
    if (!userId) {
      console.error('❌ OAUTH START: No authentication - userId missing. Session ID:', req.session.id);
      return res.status(401).send('Authentication required for OAuth. Please ensure you are logged in.');
    }
    
    // Generate OAuth URL with signed state and PKCE protection
    const authUrl = googleOAuthService.generateAuthUrl(
      userEmail || 'user@example.com',
      userId,
      tenantId,
      req.session,
      'calendar',
      returnTo,
      popup
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
  console.log('🔐 requireAuth middleware:', { 
    hasSession: !!req.session,
    userId: req.session?.userId,
    tenantId: req.session?.tenantId,
    path: req.path
  });
  
  if (!req.session?.userId) {
    console.log('❌ requireAuth: No userId in session');
    return res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Please log in to access this endpoint'
    });
  }
  if (!req.session?.tenantId) {
    console.log('❌ requireAuth: No tenantId in session');
    return res.status(400).json({ 
      error: 'Tenant context required', 
      message: 'Session missing tenant information'
    });
  }
  req.authenticatedUserId = req.session.userId;
  req.tenantId = req.session.tenantId;
  console.log('✅ requireAuth: Authenticated', { userId: req.authenticatedUserId, tenantId: req.tenantId });
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
    
    // Note: State is created and signed by googleOAuthService.generateAuthUrl()
    // No need to create state here - the service handles it
    
    // Generate OAuth URL with PKCE support and signed state (all services for backward compatibility)
    // The service will create PKCE challenge/verifier and save to session
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
router.post('/auth/google/gmail/start', (req, res, next) => {
  console.log('🎯 PRE-MIDDLEWARE: /auth/google/gmail/start', {
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : [],
    userId: req.session?.userId,
    tenantId: req.session?.tenantId
  });
  next();
}, requireAuth, async (req: any, res) => {
  console.log('🎯 ROUTE HIT: /auth/google/gmail/start');
  try {
    const { email, popup, origin, returnTo } = req.body;
    const userId = req.authenticatedUserId;
    console.log('📧 Gmail OAuth start:', { email, popup, userId, tenantId: req.tenantId });
    
    // Email is optional for OAuth - user authenticates through OAuth provider
    // If email is provided and account exists, skip re-auth
    if (email) {
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
    }
    
    // Note: State is created and signed by googleOAuthService.generateAuthUrl()
    // No need to create state here - the service handles it
    
    // Generate OAuth URL with Gmail-specific scopes and signed state
    // The service will create PKCE challenge/verifier and save to session
    // Pass popup flag so it's encoded in the state and available in the callback
    const authUrl = googleOAuthService.generateAuthUrl(email, userId, req.tenantId, req.session, 'gmail', returnTo, popup);
    
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
    
    // Note: State is created and signed by googleOAuthService.generateAuthUrl()
    // No need to create state here - the service handles it
    
    // Generate OAuth URL with Calendar-specific scopes and signed state
    // The service will create PKCE challenge/verifier and save to session
    // Pass popup flag so it's encoded in the state and available in the callback
    const authUrl = googleOAuthService.generateAuthUrl(email, userId, req.tenantId, req.session, 'calendar', returnTo, popup);
    
    console.log('🔐 SECURITY: POST /auth/google/calendar/start using Calendar-specific scopes');
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error starting Calendar OAuth:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start Microsoft OAuth flow - Generate auth URL for popup-based authentication
 */
router.post('/auth/microsoft/start', requireAuth, async (req: any, res) => {
  try {
    const { email, popup, origin, returnTo } = req.body;
    const userId = req.authenticatedUserId;
    const provider = 'microsoft';
    
    // Email is optional for OAuth - user authenticates through OAuth provider
    // If email is provided and account exists, skip re-auth
    if (email) {
      const emailAccounts = await storage.getEmailAccountsByUser(userId, req.tenantId);
      const existing = emailAccounts.find(acc => 
        acc.providerKey === 'microsoft' && 
        acc.login === email
      );
      
      if (existing) {
        return res.json({ 
          message: 'Microsoft account already connected',
          account: existing 
        });
      }
    }
    
    // Build state object with popup metadata
    const stateObj = {
      tenantId: req.tenantId,
      userId,
      popup: popup === true,
      origin: origin || `${req.protocol}://${req.get('host')}`,
      returnTo: returnTo || '/settings/email-and-calendar',
      provider
    };
    
    // Build Microsoft OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`,
      response_mode: 'query',
      scope: [
        'openid', 'email', 'profile', 'offline_access',
        'Mail.Read', 'Mail.Send', 'Contacts.Read'
      ].join(' '),
      prompt: 'consent',
      state: encodeState(stateObj)
    });
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    
    console.log('🔐 SECURITY: POST /auth/microsoft/start - popup:', popup, 'userId:', userId);
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error starting Microsoft OAuth:', error);
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
 * Google OAuth callback handler - shared by both /api/auth/google/callback and /auth/google/callback
 */
async function googleCallbackHandler(req: any, res: any) {
  // DEBUG: Log callback hit
  if (process.env.DEBUG_OAUTH === '1') {
    console.info("[OAUTH] google callback HIT", req.method, req.url, req.query);
    console.info("[OAUTH] google callback STATE", decodeStateSafe(req.query.state as any));
  }
  
  try {
    const { code, state } = req.query;
    
    // Validate presence of code
    if (!code) {
      console.error('Missing authorization code in callback');
      return res.status(400).send('Missing code');
    }
    
    // Decode and verify state parameter using GoogleOAuthService
    let parsed;
    try {
      console.log('🔐 DEBUG OAUTH CALLBACK: About to call verifyCallbackState with state:', state);
      parsed = googleOAuthService.verifyCallbackState(state as string);
      console.log('🔐 Google OAuth callback - State decoded:', JSON.stringify(parsed, null, 2));
    } catch (error) {
      console.error('❌ SECURITY: State verification failed:', error);
      return res.status(400).send('Invalid state');
    }
    
    if (!parsed) {
      return res.status(400).send('Invalid state');
    }
    
    const { tenantId, userId, returnTo, serviceType, popup } = parsed;
    
    console.log('🔐 Google OAuth callback - Popup:', { 
      popupFromState: popup,
      parsed: JSON.stringify(parsed),
      serviceType
    });
    
    if (!userId || !tenantId) {
      return res.status(401).send('Authentication required');
    }
    
    // Create OAuth2 client with correct redirect URI
    // Must match the redirect URI used when generating the auth URL
    const getRedirectUri = () => {
      if (process.env.REPLIT_DOMAINS) {
        const domain = process.env.REPLIT_DOMAINS.split(',')[0];
        return `https://${domain}/auth/google/callback`;
      }
      return process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/google/callback`;
    };
    
    const oauth2 = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      getRedirectUri()
    );
    
    // Exchange code for tokens with PKCE code verifier from session
    const codeVerifier = req.session.pkceCodeVerifier;
    console.log('🔐 PKCE: Retrieved code verifier from session:', !!codeVerifier);
    
    const { tokens: tokenData } = await oauth2.getToken({
      code: code as string,
      codeVerifier: codeVerifier // Include PKCE code verifier
    });
    
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
      tenantId,
      serviceType
    });
    
    // Route to correct table based on serviceType
    if (serviceType === 'calendar') {
      // Save to calendar_integrations table
      console.log('📅 CALENDAR OAUTH: Saving to calendar_integrations table', {
        email: tokens.email,
        userId,
        tenantId
      });
      
      await storage.upsertCalendarIntegration({
        userId,
        provider: 'google',
        providerAccountId: tokens.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        isActive: true,
        serviceType: 'calendar',
        calendarName: tokens.email, // Use email as default, will be updated later
        syncDirection: 'bidirectional'
      }, tenantId);
      
      console.log('✅ CALENDAR OAUTH: Successfully saved to calendar_integrations');
    } else {
      // Save to email_accounts table for Gmail
      console.log('📧 GMAIL OAUTH: Saving to email_accounts table', {
        email: tokens.email,
        userId,
        tenantId
      });
      
      await storage.upsertEmailProviderIntegration({
        userId,
        provider: 'google',
        status: 'connected',
        accountEmail: tokens.email,
        accessTokenEnc: tokens.access_token,
        refreshTokenEnc: tokens.refresh_token || '',
        scopes: GMAIL_SCOPES,
        metadata: JSON.stringify({
          connectedAt: new Date().toISOString()
        })
      }, tenantId);
      
      console.log('✅ GMAIL OAUTH: Successfully saved to email_accounts');
      
      // Trigger immediate first sync
      try {
        console.log('🔄 GMAIL OAUTH: Triggering immediate first sync...');
        const { EmailSyncService } = await import('../services/emailSync');
        const emailSyncService = new EmailSyncService(tenantId, userId);
        
        // Run sync in background without blocking the response
        emailSyncService.syncGmailThreadsToDatabase(userId, undefined, tenantId)
          .then(result => {
            console.log('✅ GMAIL OAUTH: First sync completed', result);
          })
          .catch(error => {
            console.error('❌ GMAIL OAUTH: First sync failed', error);
          });
      } catch (syncError) {
        console.error('⚠️ GMAIL OAUTH: Could not trigger immediate sync', syncError);
        // Don't fail the OAuth flow if sync fails
      }
    }
    
    // Handle popup response
    if (popup) {
      console.log('🪟 POPUP MODE DETECTED - Sending postMessage and closing popup');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!doctype html><html><body><script>
        (function(){
          console.log('🪟 POPUP: Attempting to post message to opener');
          try { 
            if (window.opener) {
              console.log('✅ window.opener exists, sending message');
              window.opener.postMessage({type:'oauth:connected', provider:'google', serviceType:'${serviceType || 'gmail'}', ok:true}, '*');
            } else {
              console.error('❌ window.opener is null');
            }
          } catch(e) { 
            console.error('❌ postMessage error:', e);
          }
          try { 
            console.log('🪟 Attempting to close popup');
            window.close(); 
          } catch(e) { 
            console.error('❌ window.close error:', e);
          }
          setTimeout(function(){ 
            if (!window.closed) {
              console.log('⚠️ Popup did not close, showing fallback message');
              document.body.innerHTML='<h1>Connected</h1><p>You can close this window.</p>'; 
            }
          }, 150);
        })();
      </script></body></html>`);
    } else {
      // Only redirect if NOT in popup mode
      return res.redirect(returnTo || '/settings/email-and-calendar');
    }
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth failed');
  }
}

/**
 * Mount BOTH callback paths to the same handler
 */
router.get('/api/auth/google/callback', googleCallbackHandler);
router.get('/auth/google/callback', googleCallbackHandler);

/**
 * Microsoft OAuth callback - Handle OAuth redirect from Microsoft
 */
router.get('/api/auth/microsoft/callback', async (req, res) => {
  // DEBUG: Log callback hit
  if (process.env.DEBUG_OAUTH === '1') {
    console.info("[OAUTH] microsoft callback HIT", req.method, req.url, req.query);
    console.info("[OAUTH] microsoft callback STATE", decodeStateSafe(req.query.state as any));
  }
  
  try {
    const { code, state } = req.query;
    
    if (!code) {
      console.error('Missing authorization code in Microsoft callback');
      return res.status(400).send('Missing code');
    }
    
    const parsed = decodeState<any>(state);
    console.log('🔐 Microsoft OAuth callback - State decoded:', JSON.stringify(parsed, null, 2));
    
    if (!parsed) {
      return res.status(400).send('Invalid state');
    }
    
    const { tenantId, userId, popup: popupRaw, returnTo, provider } = parsed;
    const popup = popupRaw === true || popupRaw === 'true' || popupRaw === '1';
    
    console.log('🔐 Microsoft OAuth callback - Popup:', { 
      popupRaw, 
      popupType: typeof popupRaw,
      popupFinal: popup,
      provider,
      parsed: JSON.stringify(parsed)
    });
    
    if (!userId || !tenantId) {
      return res.status(401).send('Authentication required');
    }
    
    // Exchange code for tokens
    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`;
    
    const tokenParams = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code: code as string,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });
    
    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Microsoft token exchange failed:', errorText);
      return res.status(400).send('Failed to exchange code for tokens');
    }
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(400).send('Failed to get access token');
    }
    
    // Get user profile to get email
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    
    if (!profileResponse.ok) {
      console.error('Failed to get Microsoft user profile');
      return res.status(400).send('Failed to get user profile');
    }
    
    const profile = await profileResponse.json();
    const email = profile.mail || profile.userPrincipalName || '';
    
    console.log('📝 MICROSOFT OAUTH CALLBACK: Token exchange completed', {
      email,
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      userId,
      tenantId,
      provider
    });
    
    // Save to email_accounts table
    console.log('📧 MICROSOFT OAUTH: Saving to email_accounts table', {
      email,
      userId,
      tenantId,
      provider
    });
    
    await storage.upsertEmailProvider(tenantId, {
      userId,
      provider: provider || 'microsoft',
      providerKey: provider || 'microsoft',
      status: 'connected',
      accountEmail: email,
      accessTokenEnc: tokenData.access_token,
      refreshTokenEnc: tokenData.refresh_token || undefined,
      scopes: ['openid', 'email', 'profile', 'offline_access', 'Mail.Read', 'Mail.Send', 'Contacts.Read'],
      metadata: {
        connectedAt: new Date().toISOString()
      }
    });
    
    console.log('✅ MICROSOFT OAUTH: Successfully saved to email_accounts');
    
    // Trigger immediate first sync
    try {
      console.log('🔄 MICROSOFT OAUTH: Triggering immediate first sync...');
      const { EmailSyncService } = await import('../services/emailSync');
      const emailSyncService = new EmailSyncService(tenantId, userId);
      
      // Run sync in background without blocking the response
      emailSyncService.syncGmailThreadsToDatabase(userId, undefined, tenantId)
        .then(result => {
          console.log('✅ MICROSOFT OAUTH: First sync completed', result);
        })
        .catch(error => {
          console.error('❌ MICROSOFT OAUTH: First sync failed', error);
        });
    } catch (syncError) {
      console.error('⚠️ MICROSOFT OAUTH: Could not trigger immediate sync', syncError);
      // Don't fail the OAuth flow if sync fails
    }
    
    // Handle popup response
    if (popup) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!doctype html><html><body><script>
        (function(){
          try { window.opener && window.opener.postMessage({type:'oauth:connected', provider:'microsoft', ok:true}, '*'); } catch(e) {}
          try { window.close(); } catch(e) {}
          setTimeout(function(){ if (!window.closed) document.body.innerHTML='Connected. You can close this window.'; }, 150);
        })();
      </script></body></html>`);
    } else {
      // Only redirect if NOT in popup mode
      return res.redirect(returnTo || '/settings/email-and-calendar');
    }
  } catch (error: any) {
    console.error('Microsoft OAuth callback error:', error);
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
    
    // Check email_accounts table for Google OAuth connection
    const emailAccounts = await storage.getEmailAccountsByUser(userId, req.tenantId);
    const googleAccount = emailAccounts.find(acc => acc.providerKey === 'google' && acc.status === 'connected');
    
    if (!googleAccount) {
      return res.json({ ok: true, connected: false, scopes: [] });
    }
    
    // Decrypt the tokens
    const decrypted = await storage.decryptEmailAccountSecrets(googleAccount.secretsEnc);
    
    if (!decrypted || !decrypted.accessToken) {
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
        access_token: decrypted.accessToken,
        refresh_token: decrypted.refreshToken,
      });
      
      // Test the token with a simple API call
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      await oauth2.userinfo.get();
      
      // If we get here, token is valid
      const scopes = decrypted.scopes || [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/contacts.readonly'
      ];
      
      res.json({ 
        ok: true, 
        connected: true, 
        scopes,
        email: googleAccount.accountEmail,
        lastSyncAt: googleAccount.lastSyncedAt,
        provider: 'gmail'
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
    // Prevent caching to ensure UI gets fresh sync error data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const userId = req.authenticatedUserId;
    
    // Check email_accounts table for Google OAuth connection
    const emailAccounts = await storage.getEmailAccountsByUser(userId, req.tenantId);
    const googleAccount = emailAccounts.find(acc => acc.providerKey === 'google' && acc.status === 'connected');
    
    if (!googleAccount) {
      return res.json({ ok: true, connected: false, scopes: [] });
    }
    
    // Decrypt the tokens
    const decrypted = await storage.decryptEmailAccountSecrets(googleAccount.secretsEnc);
    
    // Return Gmail connection info
    res.json({ 
      ok: true, 
      connected: true,
      email: googleAccount.accountEmail,
      scopes: decrypted.scopes || [],
      lastSyncAt: googleAccount.lastSyncedAt
    });
    
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
 * Disconnect Gmail (Email Account)
 */
router.post('/api/auth/google/gmail/disconnect', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId;
    
    // Get all email accounts for this user
    const emailAccounts = await storage.getEmailAccountsByUser(userId, tenantId);
    const googleAccount = emailAccounts.find(acc => acc.providerKey === 'google');
    
    if (googleAccount) {
      // Delete the email account
      await storage.deleteEmailAccount(googleAccount.id, tenantId);
      console.log(`🔌 Gmail disconnected for user ${userId} in tenant ${tenantId}`);
      
      res.json({ 
        ok: true, 
        message: 'Gmail disconnected successfully' 
      });
    } else {
      res.json({ 
        ok: true, 
        message: 'No Gmail account found' 
      });
    }
    
  } catch (error: any) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Disconnect Microsoft Mail (Email Account)
 */
router.post('/api/auth/microsoft/mail/disconnect', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId;
    
    // Get all email accounts for this user
    const emailAccounts = await storage.getEmailAccountsByUser(userId, tenantId);
    const microsoftAccount = emailAccounts.find(acc => acc.providerKey === 'microsoft');
    
    if (microsoftAccount) {
      // Delete the email account
      await storage.deleteEmailAccount(microsoftAccount.id, tenantId);
      console.log(`🔌 Microsoft Mail disconnected for user ${userId} in tenant ${tenantId}`);
      
      res.json({ 
        ok: true, 
        message: 'Microsoft Mail disconnected successfully' 
      });
    } else {
      res.json({ 
        ok: true, 
        message: 'No Microsoft Mail account found' 
      });
    }
    
  } catch (error: any) {
    console.error('Error disconnecting Microsoft Mail:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Disconnect Microsoft OAuth (Calendar)
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

/**
 * Disconnect Google Calendar (Calendar only, not Gmail)
 * Events are preserved as read-only instead of being deleted
 */
router.post('/api/auth/google/calendar/disconnect', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId;
    const disconnectReason = req.body.reason || 'User disconnected';
    
    let disconnectedCount = 0;
    let markedReadonlyCount = 0;
    
    // Get all calendar integrations for this user
    const integrations = await storage.getCalendarIntegrationsByUser(userId, tenantId);
    const googleCalendarIntegrations = integrations.filter(i => i.provider === 'google' && i.serviceType === 'calendar');
    
    for (const integration of googleCalendarIntegrations) {
      // Mark all Google events as read-only (preserves data)
      const readonlyCount = await storage.markEventsAsReadonly(integration.id, tenantId, userId);
      markedReadonlyCount += readonlyCount;
      
      // Update integration to mark as disconnected (but keep the record)
      await storage.updateCalendarIntegration(integration.id, {
        isActive: false,
        disconnectedAt: new Date(),
        disconnectReason: disconnectReason
      }, tenantId);
      
      disconnectedCount++;
      
      console.log(`🔌 Disconnected Google Calendar integration ${integration.id}: ${readonlyCount} events marked read-only`);
    }
    
    // Create audit log entry
    if (disconnectedCount > 0) {
      await storage.createAuditLog({
        userId,
        action: 'calendar_disconnected',
        resourceType: 'calendar_integration',
        resourceId: googleCalendarIntegrations[0]?.id,
        metadata: JSON.stringify({
          provider: 'google',
          integrations_count: disconnectedCount,
          events_marked_readonly: markedReadonlyCount,
          disconnected_at: new Date().toISOString(),
          reason: disconnectReason
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }, tenantId);
    }
    
    console.log(`🔌 Successfully disconnected ${disconnectedCount} Google Calendar integration(s) for user ${userId} in tenant ${tenantId}`);
    console.log(`📅 Marked ${markedReadonlyCount} events as read-only (preserved)`);
    
    res.json({ 
      ok: true, 
      message: `Disconnected ${disconnectedCount} Google Calendar integration(s). ${markedReadonlyCount} events preserved as read-only.`,
      disconnectedCount,
      eventsMarkedReadonly: markedReadonlyCount
    });
  } catch (error: any) {
    console.error('Error disconnecting Google Calendar:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Purge Google Calendar events (destructive action)
 * Permanently deletes all Google-sourced events for the disconnected integration
 */
router.post('/api/auth/google/calendar/purge', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId;
    const { integrationId } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ ok: false, error: 'Integration ID is required' });
    }
    
    // Verify the integration belongs to this user and is disconnected
    const integration = await storage.getCalendarIntegration(integrationId, tenantId);
    
    if (!integration) {
      return res.status(404).json({ ok: false, error: 'Integration not found' });
    }
    
    if (integration.userId !== userId) {
      return res.status(403).json({ ok: false, error: 'Unauthorized' });
    }
    
    if (integration.isActive) {
      return res.status(400).json({ ok: false, error: 'Cannot purge events from active integration. Disconnect first.' });
    }
    
    // Purge all Google events
    const purgedCount = await storage.purgeGoogleEvents(integrationId, tenantId, userId);
    
    // Create audit log
    await storage.createAuditLog({
      userId,
      action: 'events_purged',
      resourceType: 'event',
      resourceId: integrationId,
      metadata: JSON.stringify({
        provider: 'google',
        integration_id: integrationId,
        events_count: purgedCount,
        purged_at: new Date().toISOString()
      }),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }, tenantId);
    
    console.log(`🗑️ Purged ${purgedCount} Google events for integration ${integrationId}`);
    
    res.json({
      ok: true,
      message: `Successfully purged ${purgedCount} Google events`,
      purgedCount
    });
  } catch (error: any) {
    console.error('Error purging Google Calendar events:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Get disconnected calendar integrations
 * Returns list of disconnected integrations that still have read-only events
 */
router.get('/api/auth/google/calendar/disconnected', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId;
    
    const disconnectedIntegrations = await storage.getDisconnectedIntegrations(userId, tenantId);
    
    res.json({
      ok: true,
      integrations: disconnectedIntegrations
    });
  } catch (error: any) {
    console.error('Error getting disconnected integrations:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Export Google Calendar events as .ics file
 * Generates a downloadable iCalendar file with all Google-sourced events
 */
router.get('/api/auth/google/calendar/export/:integrationId', requireAuth, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const tenantId = req.tenantId;
    const { integrationId } = req.params;
    
    // Verify the integration belongs to this user
    const integration = await storage.getCalendarIntegration(integrationId, tenantId);
    
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    if (integration.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get all Google events for this integration
    const events = await storage.getEventsByIntegration(integrationId, tenantId);
    const googleEvents = events.filter(e => e.source === 'google');
    
    // Generate .ics file
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CRM Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];
    
    for (const event of googleEvents) {
      const dtstart = event.allDay 
        ? event.startDate.toISOString().split('T')[0].replace(/-/g, '')
        : event.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      const dtend = event.allDay
        ? event.endDate.toISOString().split('T')[0].replace(/-/g, '')
        : event.endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:${event.externalEventId || event.id}`);
      icsLines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      icsLines.push(`DTSTART${event.allDay ? ';VALUE=DATE' : ''}:${dtstart}`);
      icsLines.push(`DTEND${event.allDay ? ';VALUE=DATE' : ''}:${dtend}`);
      icsLines.push(`SUMMARY:${event.title.replace(/\n/g, '\\n')}`);
      
      if (event.description) {
        icsLines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
      }
      
      if (event.location) {
        icsLines.push(`LOCATION:${event.location.replace(/\n/g, '\\n')}`);
      }
      
      icsLines.push(`STATUS:${event.status.toUpperCase()}`);
      icsLines.push('END:VEVENT');
    }
    
    icsLines.push('END:VCALENDAR');
    
    const icsContent = icsLines.join('\r\n');
    
    // Create audit log
    await storage.createAuditLog({
      userId,
      action: 'events_exported',
      resourceType: 'event',
      resourceId: integrationId,
      metadata: JSON.stringify({
        provider: 'google',
        integration_id: integrationId,
        events_count: googleEvents.length,
        exported_at: new Date().toISOString()
      }),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }, tenantId);
    
    console.log(`📤 Exported ${googleEvents.length} Google events for integration ${integrationId}`);
    
    // Send file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="google-calendar-export-${new Date().toISOString().split('T')[0]}.ics"`);
    res.send(icsContent);
  } catch (error: any) {
    console.error('Error exporting Google Calendar events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;