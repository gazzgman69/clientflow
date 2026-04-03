import { storage } from '../../storage';
import { db } from '../../db';
import { emailAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get Google OAuth tokens for a specific user from email_accounts table
 * Gmail OAuth connections are stored in email_accounts with provider_key='google'
 */
export async function getUserGoogleTokens(userId: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}> {
  try {
    // Query by userId only — do not hardcode tenantId, as it varies per deployment
    const accounts = await db
      .select()
      .from(emailAccounts)
      .where(and(
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.providerKey, 'google'),
        eq(emailAccounts.status, 'connected')
      ))
      .limit(1);
    const googleAccount = accounts[0] || null;
    
    if (!googleAccount) {
      throw new Error('No active Gmail connection found. Please connect your Gmail account first.');
    }
    
    // Decrypt secrets using storage layer's decryption method
    const decrypted = await storage.decryptEmailAccountSecrets(googleAccount.secretsEnc);
    
    if (!decrypted || !decrypted.accessToken) {
      throw new Error('Failed to decrypt OAuth tokens');
    }
    
    return {
      access_token: decrypted.accessToken,
      refresh_token: decrypted.refreshToken,
      expiry_date: undefined // Not stored in current schema
    };
  } catch (error) {
    throw new Error(`Failed to retrieve Google tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}