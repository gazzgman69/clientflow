import { db } from '../../db';
import { emailAccounts } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { secureStore } from '../services/secureStore';

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
    // Get user's Gmail OAuth account from email_accounts table
    const gmailAccounts = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.userId, userId),
          eq(emailAccounts.providerKey, 'google'),
          eq(emailAccounts.status, 'connected')
        )
      )
      .limit(1);
    
    if (gmailAccounts.length === 0) {
      throw new Error('No active Gmail connection found. Please connect your Gmail account first.');
    }
    
    const account = gmailAccounts[0];
    
    // Decrypt and parse encrypted secrets to get tokens
    const decryptedSecrets = account.secretsEnc ? secureStore.decrypt(account.secretsEnc) : '{}';
    const secrets = JSON.parse(decryptedSecrets);
    
    return {
      access_token: secrets.accessToken || undefined,
      refresh_token: secrets.refreshToken || undefined,
      expiry_date: secrets.expiresAt ? new Date(secrets.expiresAt).getTime() : undefined
    };
  } catch (error) {
    throw new Error(`Failed to retrieve Google tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}