import { Client } from '@microsoft/microsoft-graph-client';
import { storage } from '../storage';
import type { CalendarIntegration } from '@shared/schema';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableOutlookClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export class MicrosoftOAuthService {
  /**
   * Check if Microsoft Outlook is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's profile information
   */
  async getUserProfile() {
    const client = await getUncachableOutlookClient();
    const user = await client.api('/me').get();
    return {
      email: user.mail || user.userPrincipalName,
      name: user.displayName,
      id: user.id
    };
  }

  /**
   * Create calendar service with Microsoft Graph
   */
  async getCalendarService() {
    const client = await getUncachableOutlookClient();
    return client;
  }

  /**
   * Get mail service with Microsoft Graph
   */
  async getMailService() {
    const client = await getUncachableOutlookClient();
    return client;
  }

  /**
   * Test the connection by making a simple API call
   */
  async testConnection(): Promise<{ success: boolean; email?: string; error?: string }> {
    try {
      const profile = await this.getUserProfile();
      return {
        success: true,
        email: profile.email
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get access token for webhook verification or direct API calls
   */
  async getAccessToken(): Promise<string> {
    return await getAccessToken();
  }
}

// Export singleton instance
export const microsoftOAuthService = new MicrosoftOAuthService();