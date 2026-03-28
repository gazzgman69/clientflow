import crypto from 'crypto';
import { db } from '../../db';
import { authTokens } from '@shared/schema';
import { eq, and, lt, isNull } from 'drizzle-orm';

/**
 * Database-backed auth token service.
 * Replaces in-memory Maps for portal access and password reset tokens.
 * Tokens are stored as SHA-256 hashes; the raw token is only returned to the caller once.
 */

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// ── Portal access tokens ────────────────────────────────────────────

export async function createPortalToken(contactId: string, email: string, tenantId: string, ttlMinutes = 15): Promise<string> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await db.insert(authTokens).values({
    tokenHash,
    tokenType: 'portal_access',
    contactId,
    tenantId,
    email,
    expiresAt,
  });

  return rawToken;
}

export async function verifyPortalToken(rawToken: string): Promise<{ contactId: string; email: string; tenantId: string } | null> {
  const tokenHash = hashToken(rawToken);

  const rows = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.tokenType, 'portal_access'),
        isNull(authTokens.usedAt),
      )
    );

  const row = rows[0];
  if (!row || row.expiresAt < new Date()) return null;
  if (!row.contactId || !row.tenantId) return null;

  return { contactId: row.contactId, email: row.email || '', tenantId: row.tenantId };
}

export async function consumePortalToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.tokenHash, tokenHash));
}

// ── Password reset tokens ───────────────────────────────────────────

export async function createResetToken(userId: string, ttlMinutes = 15): Promise<string> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await db.insert(authTokens).values({
    tokenHash,
    tokenType: 'password_reset',
    userId,
    expiresAt,
  });

  return rawToken;
}

export async function verifyResetToken(rawToken: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(rawToken);

  const rows = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.tokenType, 'password_reset'),
        isNull(authTokens.usedAt),
      )
    );

  const row = rows[0];
  if (!row || row.expiresAt < new Date()) return null;
  if (!row.userId) return null;

  return { userId: row.userId };
}

export async function consumeResetToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.tokenHash, tokenHash));
}

// ── Housekeeping ────────────────────────────────────────────────────

/** Delete all expired or consumed tokens older than retentionHours (default 24h). */
export async function purgeExpiredTokens(retentionHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
  const result = await db
    .delete(authTokens)
    .where(lt(authTokens.expiresAt, cutoff))
    .returning();
  return result.length;
}
