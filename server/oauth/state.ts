import crypto from 'crypto';

// HMAC secret for signing OAuth state - use environment variable or fallback
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.SESSION_SECRET || 'default-oauth-secret-change-in-production';

/**
 * Sign OAuth state with HMAC for tamper protection
 * This replaces the insecure base64-only encoding
 */
export function encodeState(obj: unknown): string {
  const stateJson = JSON.stringify({
    ...obj as Record<string, any>,
    timestamp: Date.now() // Add timestamp for replay attack prevention
  });
  
  const signature = crypto
    .createHmac('sha256', OAUTH_STATE_SECRET)
    .update(stateJson)
    .digest('hex');
  
  // Format: base64(json).signature
  const signedState = `${Buffer.from(stateJson).toString('base64url')}.${signature}`;
  return signedState;
}

/**
 * Verify and decode OAuth state from signed state parameter
 * Throws error if signature is invalid or state has expired
 */
export function decodeState<T = any>(s?: string | string[] | null): T | null {
  if (!s || Array.isArray(s)) return null;
  
  try {
    const parts = s.split('.');
    if (parts.length !== 2) {
      console.warn('⚠️ SECURITY: Invalid state format - missing signature');
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
      console.error('❌ SECURITY: Invalid state signature - state may have been tampered with');
      console.error('🔍 CALLED FROM STACK:', new Error().stack);
      throw new Error('Invalid state signature - state may have been tampered with');
    }

    const state = JSON.parse(stateJson);
    
    // Check timestamp to prevent replay attacks (24 hour expiry)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (state.timestamp && Date.now() - state.timestamp > maxAge) {
      console.error('❌ SECURITY: OAuth state has expired');
      throw new Error('OAuth state has expired - please restart the authorization flow');
    }

    console.log('✅ SECURITY: OAuth state signature verified successfully');
    return state as T;
  } catch (error) {
    // Log security errors but don't expose details to client
    console.error('❌ SECURITY: State verification failed:', error instanceof Error ? error.message : 'Unknown error');
    
    // Fallback: try legacy base64 decode for backward compatibility during migration
    // TODO: Remove this fallback after all OAuth flows use signed state
    try {
      const legacyState = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
      console.warn('⚠️ SECURITY: Using legacy unsigned state - this should be migrated to signed state');
      return legacyState as T;
    } catch {
      // Try standard base64 as last resort
      try {
        const legacyState = JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
        console.warn('⚠️ SECURITY: Using legacy unsigned state (standard base64) - this should be migrated to signed state');
        return legacyState as T;
      } catch {
        return null;
      }
    }
  }
}
