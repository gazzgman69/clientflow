import crypto from 'crypto';

// HMAC secret for signing OAuth state - use environment variable or fallback
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.SESSION_SECRET || 'default-oauth-secret-change-in-production';

export interface OAuthState {
  tenantId: string;
  userId: string;
  provider: string;
  returnTo?: string;
  timestamp: number;
}

/**
 * Sign OAuth state with HMAC for tamper protection
 */
export function signOAuthState(state: OAuthState): string {
  const stateJson = JSON.stringify(state);
  const signature = crypto
    .createHmac('sha256', OAUTH_STATE_SECRET)
    .update(stateJson)
    .digest('hex');
  
  const signedState = `${Buffer.from(stateJson).toString('base64url')}.${signature}`;
  return signedState;
}

/**
 * Verify and extract OAuth state from signed state parameter
 */
export function verifyOAuthState(signedState: string): OAuthState {
  const parts = signedState.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid state format - missing signature');
  }

  const [stateBase64, signature] = parts;
  const stateJson = Buffer.from(stateBase64, 'base64url').toString('utf8');
  
  // Verify signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac('sha256', OAUTH_STATE_SECRET)
    .update(stateJson)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
    throw new Error('Invalid state signature - state may have been tampered with');
  }

  const state: OAuthState = JSON.parse(stateJson);
  
  // Check timestamp to prevent replay attacks (24 hour expiry)
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  if (Date.now() - state.timestamp > maxAge) {
    throw new Error('OAuth state has expired - please restart the authorization flow');
  }

  return state;
}
