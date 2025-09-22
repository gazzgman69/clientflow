import { Client } from '@microsoft/microsoft-graph-client';
import { storage } from '../../storage';
import type { CalendarIntegration } from '@shared/schema';

let connectionSettings: any;

async function getAccessToken(tenantId?: string, userId?: string, requireExplicitConnection: boolean = true) {
  // SECURITY HARDENING: Prevent automatic token linking without explicit user consent
  if (requireExplicitConnection) {
    throw new Error('🚫 SECURITY: Microsoft OAuth tokens cannot be auto-linked. User must explicitly connect via OAuth flow for security compliance.');
  }

  console.warn('⚠️ SECURITY WARNING: Attempting to access Microsoft tokens without explicit OAuth validation. This should only be used for system-level operations.');
  
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    console.log('🔐 SECURITY: Using cached Microsoft connector token (expires:', connectionSettings.settings.expires_at, ')');
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('🚫 SECURITY: X_REPLIT_TOKEN not found - cannot access Microsoft connector without proper authentication');
  }

  console.log('🔐 SECURITY: Fetching Microsoft connector tokens from Replit connector system...');
  
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
    throw new Error('🚫 SECURITY: Microsoft connector not properly configured or no valid tokens available');
  }
  
  console.log('⚠️ SECURITY: Microsoft connector token retrieved from environment - this bypasses user consent validation');
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableOutlookClient(options: {
  tenantId?: string;
  userId?: string;
  requireExplicitConnection?: boolean;
  isSystemOperation?: boolean;
} = {}) {
  const { tenantId, userId, requireExplicitConnection = true, isSystemOperation = false } = options;
  
  // SECURITY: Allow system operations to bypass explicit connection requirement
  const shouldRequireConnection = requireExplicitConnection && !isSystemOperation;
  
  const accessToken = await getAccessToken(tenantId, userId, shouldRequireConnection);

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export class MicrosoftOAuthService {
  /**
   * Check if Microsoft Outlook is connected
   * @param options Security options for connection validation
   */
  async isConnected(options: {
    tenantId?: string;
    userId?: string;
    requireExplicitConnection?: boolean;
    isSystemOperation?: boolean;
  } = {}): Promise<boolean> {
    try {
      const { tenantId, userId, requireExplicitConnection = true, isSystemOperation = false } = options;
      const shouldRequireConnection = requireExplicitConnection && !isSystemOperation;
      
      await getAccessToken(tenantId, userId, shouldRequireConnection);
      return true;
    } catch (error: any) {
      console.log('🔐 SECURITY: Microsoft connection check failed:', error.message);
      return false;
    }
  }

  /**
   * Get user's profile information
   * @param options Security options for profile access
   */
  async getUserProfile(options: {
    tenantId?: string;
    userId?: string;
    requireExplicitConnection?: boolean;
    isSystemOperation?: boolean;
  } = {}) {
    const client = await getUncachableOutlookClient(options);
    const user = await client.api('/me').get();
    return {
      email: user.mail || user.userPrincipalName,
      name: user.displayName,
      id: user.id
    };
  }

  /**
   * Create calendar service with Microsoft Graph
   * @param options Security options for calendar service access
   */
  async getCalendarService(options: {
    tenantId?: string;
    userId?: string;
    requireExplicitConnection?: boolean;
    isSystemOperation?: boolean;
  } = {}) {
    const client = await getUncachableOutlookClient(options);
    return client;
  }

  /**
   * Get mail service with Microsoft Graph
   * @param options Security options for mail service access
   */
  async getMailService(options: {
    tenantId?: string;
    userId?: string;
    requireExplicitConnection?: boolean;
    isSystemOperation?: boolean;
  } = {}) {
    const client = await getUncachableOutlookClient(options);
    return client;
  }

  /**
   * Test the connection by making a simple API call
   * @param options Security options for connection testing
   */
  async testConnection(options: {
    tenantId?: string;
    userId?: string;
    requireExplicitConnection?: boolean;
    isSystemOperation?: boolean;
  } = {}): Promise<{ success: boolean; email?: string; error?: string }> {
    try {
      const profile = await this.getUserProfile(options);
      return {
        success: true,
        email: profile.email
      };
    } catch (error: any) {
      console.log('🔐 SECURITY: Microsoft connection test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get access token for webhook verification or direct API calls
   * @param options Security options for token access
   */
  async getAccessToken(options: {
    tenantId?: string;
    userId?: string;
    requireExplicitConnection?: boolean;
    isSystemOperation?: boolean;
  } = {}): Promise<string> {
    const { tenantId, userId, requireExplicitConnection = true, isSystemOperation = false } = options;
    const shouldRequireConnection = requireExplicitConnection && !isSystemOperation;
    
    return await getAccessToken(tenantId, userId, shouldRequireConnection);
  }
}

// Export singleton instance
export const microsoftOAuthService = new MicrosoftOAuthService();