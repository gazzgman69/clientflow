import { storage } from '../../storage';

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
    // Get user's Gmail OAuth account from email_accounts table via storage layer
    const emailAccounts = await storage.getEmailAccountsByUser(userId, 'default-tenant');
    const googleAccount = emailAccounts.find(acc => acc.providerKey === 'google' && acc.status === 'connected');
    
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