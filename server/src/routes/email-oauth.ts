import { Router } from 'express';
import crypto from 'crypto';
import { storage } from '../../storage';
import { google } from 'googleapis';

const router = Router();

// Helper to get redirect URI
function getRedirectUri(provider: 'gmail' | 'microsoft'): string {
  if (process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(',')[0];
    const path = provider === 'gmail' ? '/api/auth/google/gmail/callback' : '/api/auth/microsoft/mail/callback';
    return `https://${domain}${path}`;
  }
  const path = provider === 'gmail' ? '/api/auth/google/gmail/callback' : '/api/auth/microsoft/mail/callback';
  return `http://localhost:5000${path}`;
}

/**
 * Gmail OAuth Callback - Store tokens in email_provider_integrations
 */
router.get('/auth/google/gmail/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing authorization code or state');
  }

  try {
    // Verify state (signed by GoogleOAuthService)
    const { googleOAuthService } = await import('../services/google-oauth');
    const verifiedState = googleOAuthService['verifyOAuthState'](state as string);
    
    const { tenantId, userId } = verifiedState;
    
    // Exchange code for tokens
    const pkceCodeVerifier = req.session.pkceCodeVerifier;
    if (!pkceCodeVerifier) {
      throw new Error('Missing PKCE verifier');
    }
    
    const tokens = await googleOAuthService.exchangeCodeForTokens(code as string, pkceCodeVerifier);
    
    // Store in email_provider_integrations
    await storage.upsertEmailProviderIntegration({
      tenantId,
      userId,
      provider: 'google',
      status: 'connected',
      accountEmail: tokens.email,
      scopes: ['gmail.send', 'gmail.modify'],
      accessTokenEnc: tokens.access_token,
      refreshTokenEnc: tokens.refresh_token || '',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      metadata: JSON.stringify({ tokenType: 'Bearer' })
    }, tenantId);

    // Log event
    console.log(JSON.stringify({
      event: 'email_oauth_connected',
      provider: 'google',
      tenantId,
      userId,
      accountEmail: tokens.email,
      timestamp: new Date().toISOString()
    }));

    // Clear session PKCE
    delete req.session.pkceCodeVerifier;

    // Redirect
    const returnTo = req.session.oauth_return_to || '/settings';
    res.redirect(returnTo);
  } catch (error: any) {
    console.error('❌ Gmail OAuth callback failed:', error);
    res.status(500).send(`Gmail OAuth failed: ${error.message}`);
  }
});

/**
 * Gmail OAuth Status
 */
router.get('/auth/google/gmail/status', async (req, res) => {
  try {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.json({ ok: true, connected: false, scopes: [] });
    }

    // Check email_accounts table for Google OAuth connection
    const emailAccounts = await storage.getEmailAccountsByUser(req.session.userId, req.session.tenantId);
    const googleAccount = emailAccounts.find(acc => acc.providerKey === 'google' && acc.status === 'connected');

    if (!googleAccount) {
      return res.json({ ok: true, connected: false, scopes: [] });
    }

    // Decrypt the tokens to get scopes
    const decrypted = await storage.decryptEmailAccountSecrets(googleAccount.secretsEnc);

    res.json({
      ok: true,
      connected: true,
      email: googleAccount.accountEmail,
      lastSyncAt: googleAccount.lastSyncAt,
      scopes: decrypted.scopes || []
    });
  } catch (error: any) {
    console.error('❌ Gmail status check failed:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * Gmail OAuth Disconnect
 */
router.post('/auth/google/gmail/disconnect', async (req, res) => {
  try {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await storage.disconnectEmailProvider(
      req.session.userId,
      req.session.tenantId,
      'google'
    );

    // Log event
    console.log(JSON.stringify({
      event: 'email_oauth_disconnected',
      provider: 'google',
      tenantId: req.session.tenantId,
      userId: req.session.userId,
      timestamp: new Date().toISOString()
    }));

    res.json({ ok: true, disconnected: result });
  } catch (error: any) {
    console.error('❌ Gmail disconnect failed:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * Microsoft OAuth Callback - Store tokens in email_provider_integrations
 */
router.get('/auth/microsoft/mail/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing authorization code or state');
  }

  try {
    // Parse state (should be signed similar to Google)
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { tenantId, userId } = stateData;
    
    // Exchange code for tokens
    const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
    const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;

    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured');
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code: code as string,
      redirect_uri: getRedirectUri('microsoft'),
      grant_type: 'authorization_code'
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();

    // Get user profile for email
    const { Client } = await import('@microsoft/microsoft-graph-client');
    const client = Client.init({
      authProvider: (done) => done(null, tokens.access_token)
    });
    const profile = await client.api('/me').get();

    // Store in email_provider_integrations
    await storage.upsertEmailProviderIntegration({
      tenantId,
      userId,
      provider: 'microsoft',
      status: 'connected',
      accountEmail: profile.mail || profile.userPrincipalName,
      scopes: ['Mail.Read', 'Mail.Send', 'offline_access'],
      accessTokenEnc: tokens.access_token,
      refreshTokenEnc: tokens.refresh_token || '',
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      metadata: JSON.stringify({ tokenType: 'Bearer' })
    }, tenantId);

    // Log event
    console.log(JSON.stringify({
      event: 'email_oauth_connected',
      provider: 'microsoft',
      tenantId,
      userId,
      accountEmail: profile.mail || profile.userPrincipalName,
      timestamp: new Date().toISOString()
    }));

    // Redirect
    const returnTo = req.session.oauth_return_to || '/settings';
    res.redirect(returnTo);
  } catch (error: any) {
    console.error('❌ Microsoft OAuth callback failed:', error);
    res.status(500).send(`Microsoft OAuth failed: ${error.message}`);
  }
});

/**
 * Microsoft OAuth Status
 */
router.get('/auth/microsoft/status', async (req, res) => {
  try {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.json({ ok: true, connected: false });
    }

    const integration = await storage.getEmailProviderIntegration(
      req.session.userId,
      req.session.tenantId,
      'microsoft'
    );

    if (!integration || integration.status !== 'connected') {
      return res.json({ ok: true, connected: false });
    }

    res.json({
      ok: true,
      connected: true,
      accountEmail: integration.accountEmail,
      lastSyncedAt: integration.lastSyncedAt,
      scopes: integration.scopes,
      needsReconnect: integration.status === 'error'
    });
  } catch (error: any) {
    console.error('❌ Microsoft status check failed:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * Microsoft OAuth Disconnect
 */
router.post('/auth/microsoft/mail/disconnect', async (req, res) => {
  try {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await storage.disconnectEmailProvider(
      req.session.userId,
      req.session.tenantId,
      'microsoft'
    );

    // Log event
    console.log(JSON.stringify({
      event: 'email_oauth_disconnected',
      provider: 'microsoft',
      tenantId: req.session.tenantId,
      userId: req.session.userId,
      timestamp: new Date().toISOString()
    }));

    res.json({ ok: true, disconnected: result });
  } catch (error: any) {
    console.error('❌ Microsoft disconnect failed:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
