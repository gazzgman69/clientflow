/**
 * CSRF protection middleware — HMAC-signed double-submit cookie pattern.
 * Replaces the deprecated `csurf` package.
 *
 * How it works:
 *   1. A random secret is stored in an httpOnly cookie (`_csrf_secret`).
 *   2. `req.csrfToken()` produces `timestamp.HMAC(secret, timestamp)`.
 *   3. State-changing requests must send that token back in the
 *      `X-CSRF-Token` (or `x-csrf-token`) header.
 *   4. The middleware re-derives the HMAC from the cookie secret and the
 *      timestamp embedded in the token, then compares using timing-safe
 *      equality.  Tokens older than `maxAgeMs` are rejected.
 *
 * This is safe because:
 *   - An attacker on a different origin can't read the httpOnly cookie.
 *   - The HMAC prevents forging a valid token without the secret.
 *   - The timestamp prevents indefinite replay.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// ── Configuration ───────────────────────────────────────────────────

interface CsrfOptions {
  /** Cookie name for the CSRF secret (default `_csrf_secret`) */
  cookieName?: string;
  /** Max token age in milliseconds (default 8 hours) */
  maxAgeMs?: number;
  /** Cookie options */
  cookie?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
  };
}

const SECRET_BYTES = 32;
const SEPARATOR = '.';

// ── Helpers ─────────────────────────────────────────────────────────

function generateSecret(): string {
  return crypto.randomBytes(SECRET_BYTES).toString('base64url');
}

function sign(secret: string, timestamp: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .digest('base64url');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ── Middleware factory ───────────────────────────────────────────────

export function csrfProtection(options: CsrfOptions = {}) {
  const {
    cookieName = '_csrf_secret',
    maxAgeMs = 8 * 60 * 60 * 1000, // 8 hours
    cookie: cookieOpts = {},
  } = options;

  const {
    httpOnly = true,
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'lax',
    path = '/',
  } = cookieOpts;

  /**
   * Ensure the request has a CSRF secret cookie. If not, generate one.
   * Always attach `req.csrfToken()` regardless of HTTP method.
   */
  function ensureSecret(req: Request, res: Response): string {
    let secret = req.cookies?.[cookieName];

    if (!secret || typeof secret !== 'string' || secret.length < 20) {
      secret = generateSecret();
      res.cookie(cookieName, secret, {
        httpOnly,
        secure,
        sameSite,
        path,
        maxAge: maxAgeMs,
      });
    }

    return secret;
  }

  return function csrf(req: Request, res: Response, next: NextFunction) {
    const secret = ensureSecret(req, res);

    // Attach token generator to the request (drop-in for csurf API)
    (req as any).csrfToken = (): string => {
      const ts = Date.now().toString(36);
      const sig = sign(secret, ts);
      return `${ts}${SEPARATOR}${sig}`;
    };

    // Safe methods don't need validation — just attach the generator
    const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
    if (safeMethods.has(req.method)) {
      return next();
    }

    // ── Validate token on state-changing requests ────────────────

    const token =
      req.headers['x-csrf-token'] as string | undefined ||
      req.headers['x-xsrf-token'] as string | undefined ||
      req.body?._csrf;

    if (!token || typeof token !== 'string') {
      return res.status(403).json({ error: 'Invalid CSRF token', message: 'CSRF token missing' });
    }

    const parts = token.split(SEPARATOR);
    if (parts.length !== 2) {
      return res.status(403).json({ error: 'Invalid CSRF token', message: 'Malformed CSRF token' });
    }

    const [ts, sig] = parts;

    // Check expiry
    const tokenTime = parseInt(ts, 36);
    if (isNaN(tokenTime) || Date.now() - tokenTime > maxAgeMs) {
      return res.status(403).json({ error: 'Invalid CSRF token', message: 'CSRF token expired' });
    }

    // Verify HMAC
    const expected = sign(secret, ts);
    if (!timingSafeEqual(sig, expected)) {
      return res.status(403).json({ error: 'Invalid CSRF token', message: 'CSRF token verification failed' });
    }

    next();
  };
}
