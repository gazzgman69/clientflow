import { storage } from '../../storage';

/**
 * Get Google OAuth tokens for a specific user
 * Reuses the existing calendarIntegrations table which stores Google OAuth tokens
 */
export async function getUserGoogleTokens(userId: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}> {
  try {
    // Get user's Google calendar integrations (which contain the OAuth tokens)
    const integrations = await storage.getCalendarIntegrationsByUser(userId);
    
    // Find the active Google integration
    const googleIntegration = integrations.find(integration => 
      integration.provider === 'google' && 
      integration.isActive && 
      integration.accessToken
    );
    
    if (!googleIntegration) {
      throw new Error('No active Google integration found. Please connect your Google account through Calendar settings first.');
    }
    
    return {
      access_token: googleIntegration.accessToken || undefined,
      refresh_token: googleIntegration.refreshToken || undefined,
      expiry_date: undefined // Not stored in current schema
    };
  } catch (error) {
    throw new Error(`Failed to retrieve Google tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}