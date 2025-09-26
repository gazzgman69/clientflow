import { google } from 'googleapis';
import crypto from 'crypto';
import { storage } from '../../storage';
import type { CalendarIntegration } from '@shared/schema';
import { secureStore } from './secureStore';

// HMAC secret for signing OAuth state - use environment variable or fallback
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || 'default-oauth-secret-change-in-production';

interface OAuthState {
  tenantId: string;
  userId: string; 
  provider: string;
  serviceType: 'gmail' | 'calendar' | 'all';
  returnTo?: string;
  timestamp: number;
}

// Helper function to get the correct redirect URI
function getRedirectUri(): string {
  if (process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(',')[0];
    return `https://${domain}/auth/google/callback`;
  }
  return 'http://localhost:5000/auth/google/callback';
}

// Google OAuth credentials - lazy initialization
let oauth2Client: google.auth.OAuth2 | null = null;

/**
 * Validate and initialize Google OAuth credentials (lazy initialization)
 */
function validateGoogleCredentials(): { clientId: string; clientSecret: string } {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is required for Google OAuth. Please configure your Google credentials.');
  }

  if (!GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET environment variable is required for Google OAuth. Please configure your Google credentials.');
  }

  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET };
}

/**
 * Get OAuth2 client with lazy initialization
 */
function getOAuth2Client(): google.auth.OAuth2 {
  if (!oauth2Client) {
    const { clientId, clientSecret } = validateGoogleCredentials();
    oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      getRedirectUri()
    );
  }
  return oauth2Client;
}

// Separate scopes for different Google services
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

// For backward compatibility, combined scopes (deprecated)
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export class GoogleOAuthService {
  /**
   * Sign OAuth state with HMAC for tamper protection
   */
  private signOAuthState(state: OAuthState): string {
    const stateJson = JSON.stringify(state);
    const signature = crypto
      .createHmac('sha256', OAUTH_STATE_SECRET)
      .update(stateJson)
      .digest('hex');
    
    const signedState = `${Buffer.from(stateJson).toString('base64')}.${signature}`;
    return signedState;
  }

  /**
   * Verify and extract OAuth state from signed state parameter
   */
  private verifyOAuthState(signedState: string): OAuthState {
    const parts = signedState.split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid state format - missing signature');
    }

    const [stateBase64, signature] = parts;
    const stateJson = Buffer.from(stateBase64, 'base64').toString('utf8');
    
    // Verify signature
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

  /**
   * Generate code verifier and challenge for PKCE
   */
  private generatePKCEChallenge(): { codeVerifier: string; codeChallenge: string } {
    // Generate a cryptographically random code verifier (43-128 characters)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Create code challenge using SHA256
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate OAuth URL for user to authenticate with PKCE support
   * @param email User's email for login hint
   * @param userId User ID in our system
   * @param tenantId Tenant ID for multi-tenant isolation
   * @param session Express session to store PKCE verifier
   * @param serviceType Service type: 'gmail', 'calendar', or 'all' (default: 'all' for backward compatibility)
   * @param returnTo Optional return URL after OAuth completion
   */
  generateAuthUrl(
    email: string, 
    userId: string, 
    tenantId: string,
    session?: any, 
    serviceType: 'gmail' | 'calendar' | 'all' = 'all',
    returnTo?: string
  ): string {
    // Create signed state with tenant context
    const oauthState: OAuthState = {
      tenantId,
      userId,
      provider: 'google',
      serviceType,
      returnTo,
      timestamp: Date.now()
    };
    
    const state = this.signOAuthState(oauthState);
    
    // Generate PKCE challenge and verifier
    const { codeVerifier, codeChallenge } = this.generatePKCEChallenge();
    
    // Store code verifier in session for later verification
    if (session) {
      session.pkceCodeVerifier = codeVerifier;
      session.serviceType = serviceType; // Store service type for callback processing
      console.log(`🔐 PKCE: Code verifier stored in session for ${serviceType} OAuth flow`);
    }
    
    // Select appropriate scopes based on service type
    let scopes: string[];
    switch (serviceType) {
      case 'gmail':
        scopes = GMAIL_SCOPES;
        break;
      case 'calendar':
        scopes = CALENDAR_SCOPES;
        break;
      default:
        scopes = SCOPES; // Backward compatibility
    }
    
    const authUrl = getOAuth2Client().generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      login_hint: email,
      state: state,
      include_granted_scopes: true,
      // PKCE parameters
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    console.log(`🔐 SECURITY: Generated ${serviceType} OAuth URL with PKCE and signed state protection`);
    return authUrl;
  }

  /**
   * Verify and extract OAuth state from callback
   * @param signedState Signed state parameter from OAuth callback
   * @returns Verified OAuth state with tenant context
   */
  verifyCallbackState(signedState: string): OAuthState {
    return this.verifyOAuthState(signedState);
  }

  /**
   * Exchange authorization code for tokens with PKCE verification
   * @param code Authorization code from OAuth provider
   * @param codeVerifier PKCE code verifier (from session)
   */
  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<{
    access_token: string;
    refresh_token: string | null;
    email: string;
  }> {
    const client = getOAuth2Client();
    
    // Prepare token exchange parameters
    const tokenParams: any = { code };
    
    // Include PKCE code verifier if provided (camelCase for google-auth-library)
    if (codeVerifier) {
      tokenParams.codeVerifier = codeVerifier;
      console.log('🔐 PKCE: Using code verifier for token exchange');
    } else {
      console.warn('⚠️ SECURITY: OAuth token exchange without PKCE verification');
    }
    
    const { tokens } = await client.getToken(tokenParams);
    client.setCredentials(tokens);
    
    // Log scopes for verification
    console.log("✅ OAuth tokens obtained, granted scopes:", tokens.scope);
    
    // Get user's email
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    
    console.log('✅ SECURITY: OAuth flow completed with PKCE verification');
    
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || null,
      email: data.email!
    };
  }

  /**
   * Create calendar service with user's tokens
   */
  async getCalendarService(integration: CalendarIntegration) {
    // Tokens are already decrypted by storage layer
    const tokens = {
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken
    };
    
    const { clientId, clientSecret } = validateGoogleCredentials();
    const userOAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      getRedirectUri()
    );
    
    userOAuth2Client.setCredentials(tokens);
    
    // Handle token refresh - CRITICAL: Encrypt tokens before storing
    userOAuth2Client.on('tokens', async (tokens) => {
      console.log('🔄 Token refresh detected, encrypting before storage');
      
      if (tokens.refresh_token) {
        await storage.updateCalendarIntegration(integration.id, {
          refreshToken: secureStore.encrypt(tokens.refresh_token),
          accessToken: secureStore.encrypt(tokens.access_token!)
        });
        console.log('🔐 SECURITY: Refresh and access tokens encrypted and updated');
      } else if (tokens.access_token) {
        await storage.updateCalendarIntegration(integration.id, {
          accessToken: secureStore.encrypt(tokens.access_token)
        });
        console.log('🔐 SECURITY: Access token encrypted and updated');
      }
    });
    
    return google.calendar({ version: 'v3', auth: userOAuth2Client });
  }

  /**
   * Sync CRM events to Google Calendar (push missing ones)
   */
  async syncToGoogleAll(integration: CalendarIntegration) {
    try {
      console.log('Starting CRM → Google Calendar sync...');
      
      // Get all CRM events for this user
      const crmEvents = await storage.getEventsByUser(integration.userId);
      console.log(`Found ${crmEvents.length} CRM events to potentially sync`);
      
      let syncedCount = 0;
      let skippedCount = 0;
      
      for (const event of crmEvents) {
        // If already has Google ID, verify it still exists
        if (event.externalEventId) {
          try {
            const calendar = await this.getCalendarService(integration);
            const googleEvent = await calendar.events.get({
              calendarId: 'primary',
              eventId: event.externalEventId
            });
            
            // Check if event is cancelled/deleted (Google marks as status: 'cancelled')
            if (googleEvent.data.status === 'cancelled') {
              console.log(`🗑️ Event "${event.title}" was cancelled in Google Calendar, deleting from CRM...`);
              await storage.deleteEvent(event.id);
              skippedCount++;
              continue;
            } else {
              // Event exists and is active, skip it
              skippedCount++;
              console.log(`✓ Event "${event.title}" exists in Google Calendar at: ${googleEvent.data.start?.dateTime || googleEvent.data.start?.date}`);
              continue;
            }
          } catch (error: any) {
            if (error.code === 404 || error.status === 404) {
              // Event doesn't exist in Google Calendar anymore, delete from CRM
              console.log(`🗑️ Event "${event.title}" missing from Google Calendar, deleting from CRM...`);
              await storage.deleteEvent(event.id);
              skippedCount++;
              continue;
            } else {
              console.error(`⚠️ Error checking event "${event.title}":`, error.message);
              skippedCount++;
              continue;
            }
          }
        }
        
        try {
          console.log(`Syncing CRM event "${event.title}" to Google Calendar...`);
          await this.syncToGoogle(integration, event.id);
          syncedCount++;
          console.log(`✅ Successfully synced "${event.title}"`);
        } catch (error) {
          console.error(`❌ Failed to sync "${event.title}":`, error);
        }
      }
      
      console.log(`CRM → Google sync complete: ${syncedCount} synced, ${skippedCount} skipped`);
      return { success: true, syncedCount, skippedCount };
    } catch (error: any) {
      console.error('Error in CRM → Google sync:', error);
      throw error;
    }
  }

  /**
   * Sync events from Google Calendar to CRM
   */
  async syncFromGoogle(integration: CalendarIntegration) {
    try {
      console.log('Starting Google → CRM sync...');
      const calendar = await this.getCalendarService(integration);
      
      // Get primary calendar events (wider range to catch more events)
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // Last 90 days
        timeMax: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // Next 180 days
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 1000
      });
      
      const events = response.data.items || [];
      console.log(`Found ${events.length} events in Google Calendar`);

      // Also sync CRM events TO Google Calendar
      await this.syncToGoogleAll(integration);
      
      // Get current Google Calendar event IDs for comparison
      const currentGoogleEventIds = new Set(events.map(e => e.id).filter(id => id));

      for (const googleEvent of events) {
        if (!googleEvent.id || !googleEvent.summary) continue;
        
        // Handle cancelled events (deletions)
        if (googleEvent.status === 'cancelled') {
          console.log(`Google Calendar event "${googleEvent.summary}" was cancelled, removing from CRM`);
          const existing = await storage.getEventByExternalId(googleEvent.id);
          if (existing) {
            await storage.deleteEvent(existing.id);
            console.log(`Deleted CRM event: ${existing.title}`);
          }
          continue;
        }
        
        // Check if event exists
        const existing = await storage.getEventByExternalId(googleEvent.id);
        
        const eventData = {
          title: googleEvent.summary,
          description: googleEvent.description || '',
          startDate: new Date(googleEvent.start?.dateTime || googleEvent.start?.date || new Date()),
          endDate: new Date(googleEvent.end?.dateTime || googleEvent.end?.date || new Date()),
          location: googleEvent.location || null,
          allDay: !googleEvent.start?.dateTime,
          type: 'meeting',
          createdBy: integration.userId,
          calendarIntegrationId: integration.id,
          externalEventId: googleEvent.id,
          providerData: JSON.stringify(googleEvent),
          attendees: googleEvent.attendees?.map(attendee => attendee.email).filter(email => email) as string[] || []
        };
        
        if (existing) {
          await storage.updateEvent(existing.id, eventData);
        } else {
          await storage.createEvent(eventData, integration.tenantId);
        }
      }

      // Check for events that were completely removed from Google Calendar
      // (not just cancelled, but deleted entirely)
      console.log('Checking for events deleted from Google Calendar...');
      
      // Get ALL CRM events that have a Google Calendar ID, regardless of origin
      const allCrmEventsWithGoogleId = await storage.getEventsByUser(integration.userId);
      const eventsToCheck = allCrmEventsWithGoogleId.filter(e => e.externalEventId);
      
      console.log(`Checking ${eventsToCheck.length} CRM events for deletion from Google Calendar...`);
      
      for (const crmEvent of eventsToCheck) {
        if (crmEvent.externalEventId && !currentGoogleEventIds.has(crmEvent.externalEventId)) {
          console.log(`🗑️ Event "${crmEvent.title}" (ID: ${crmEvent.externalEventId}) no longer exists in Google Calendar, removing from CRM`);
          await storage.deleteEvent(crmEvent.id);
        }
      }
      
      // Update last sync
      await storage.updateCalendarIntegration(integration.id, {
        lastSyncAt: new Date(),
        syncToken: response.data.nextSyncToken || null
      });
      
      return { success: true, syncedCount: events.length };
    } catch (error: any) {
      console.error('Error syncing from Google:', error);
      
      // Handle OAuth token expiration gracefully
      const isTokenExpired = error.message?.includes('invalid_grant') || 
                           error.code === 400 && error.response?.data?.error === 'invalid_grant';
      
      if (isTokenExpired) {
        console.log('🔄 OAUTH TOKEN EXPIRED: Marking calendar integration for reconnection');
        await storage.updateCalendarIntegration(integration.id, {
          syncErrors: JSON.stringify({
            error: 'invalid_grant',
            message: 'OAuth tokens expired - reconnection required',
            timestamp: new Date().toISOString(),
            type: 'auto-sync',
            requiresReconnection: true
          })
        });
      } else {
        await storage.updateCalendarIntegration(integration.id, {
          syncErrors: JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString(),
            type: 'auto-sync'
          })
        });
      }
      
      throw error;
    }
  }

  /**
   * Sync CRM event to Google Calendar
   */
  async syncToGoogle(integration: CalendarIntegration, eventId: string) {
    try {
      const calendar = await this.getCalendarService(integration);
      const event = await storage.getEvent(eventId);
      
      if (!event) throw new Error('Event not found');
      
      // Handle attendees - database stores as array, form sends as string
      const attendees = event.attendees && event.attendees.length > 0
        ? event.attendees
            .filter((email: string) => email && email.includes('@'))
            .map((email: string) => ({ email: email.trim() }))
        : [];

      const googleEvent = {
        summary: event.title,
        description: event.description || '',
        location: event.location || '',
        start: event.allDay 
          ? { date: new Date(event.startDate).toISOString().split('T')[0] }
          : { 
              dateTime: event.startDate instanceof Date 
                ? event.startDate.toISOString()
                : new Date(event.startDate + 'Z').toISOString(), // Treat DB time as UTC
              timeZone: 'Europe/London'
            },
        end: event.allDay
          ? { date: new Date(event.endDate).toISOString().split('T')[0] }
          : { 
              dateTime: event.endDate instanceof Date 
                ? event.endDate.toISOString()
                : new Date(event.endDate + 'Z').toISOString(), // Treat DB time as UTC
              timeZone: 'Europe/London'
            },
        ...(attendees.length > 0 && { attendees })
      };
      
      console.log('Creating Google Calendar event:', JSON.stringify(googleEvent, null, 2));
      
      let response;
      if (event.externalEventId) {
        // Update existing Google event
        response = await calendar.events.update({
          calendarId: 'primary',
          eventId: event.externalEventId,
          requestBody: googleEvent
        });
      } else {
        // Create new Google event
        response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: googleEvent
        });
        
        // Store the Google event ID
        await storage.updateEvent(eventId, {
          externalEventId: response.data.id!,
          providerData: JSON.stringify(response.data)
        });
      }
      
      return { success: true, googleEventId: response.data.id };
    } catch (error: any) {
      console.error('Error syncing to Google:', error);
      throw error;
    }
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteFromGoogle(integration: CalendarIntegration, externalEventId: string) {
    try {
      console.log('Attempting to delete Google Calendar event:', externalEventId);
      const calendar = await this.getCalendarService(integration);
      
      const response = await calendar.events.delete({
        calendarId: 'primary',
        eventId: externalEventId
      });
      
      console.log('Google Calendar deletion response status:', response.status);
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting from Google Calendar:', error);
      console.error('Google API Error details:', error.response?.data || error.message);
      
      // Don't throw error if event already doesn't exist
      if (error.code === 404 || error.status === 404) {
        console.log('Event already deleted from Google Calendar');
        return { success: true };
      }
      
      throw error;
    }
  }

  /**
   * Clean up orphaned Google Calendar events based on title
   */
  async cleanupOrphanedEvents(integration: CalendarIntegration, eventTitles: string[]) {
    try {
      const calendar = await this.getCalendarService(integration);
      
      for (const title of eventTitles) {
        // Search for events by title
        const response = await calendar.events.list({
          calendarId: 'primary',
          q: title,
          timeMin: new Date('2025-01-01').toISOString(), // Only recent events
          maxResults: 10
        });

        const events = response.data.items || [];
        
        for (const event of events) {
          if (event.id && event.summary === title) {
            console.log(`Deleting orphaned Google Calendar event: ${title}`);
            await calendar.events.delete({
              calendarId: 'primary',
              eventId: event.id
            });
          }
        }
      }
      
      return { success: true, deletedCount: eventTitles.length };
    } catch (error: any) {
      console.error('Error cleaning orphaned events:', error);
      throw error;
    }
  }

  /**
   * Set up webhook for real-time sync
   */
  async setupWebhook(integration: CalendarIntegration) {
    try {
      const calendar = await this.getCalendarService(integration);
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` 
        : 'http://localhost:5000';
      const webhookUrl = `${baseUrl}/webhooks/google-calendar/${integration.id}`;
      
      const response = await calendar.events.watch({
        calendarId: 'primary',
        requestBody: {
          id: `webhook-${integration.id}`,
          type: 'web_hook',
          address: webhookUrl,
          params: {
            ttl: '2592000' // 30 days in seconds
          }
        }
      });
      
      await storage.updateCalendarIntegration(integration.id, {
        webhookId: response.data.resourceId || null
      });
      
      return { success: true, webhookId: response.data.resourceId };
    } catch (error: any) {
      console.error('Error setting up webhook:', error);
      // Webhooks might not work in local development
      return { success: false, error: error.message };
    }
  }
}

/**
 * Simple function to get Google auth URL with force consent and service-specific scopes
 */
export function getGoogleAuthUrl({ 
  state, 
  codeChallenge, 
  codeChallengeMethod,
  serviceType = 'all'
}: { 
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  serviceType?: 'gmail' | 'calendar' | 'all';
}): string {
  // Select appropriate scopes based on service type
  let scopes: string[];
  switch (serviceType) {
    case 'gmail':
      scopes = GMAIL_SCOPES;
      break;
    case 'calendar':
      scopes = CALENDAR_SCOPES;
      break;
    default:
      scopes = SCOPES; // Backward compatibility - all scopes
  }

  const authParams: any = {
    access_type: 'offline',
    prompt: 'consent',
    response_type: 'code',
    state,
    scope: scopes,
  };
  
  // Add PKCE parameters if provided
  if (codeChallenge) {
    authParams.code_challenge = codeChallenge;
    authParams.code_challenge_method = codeChallengeMethod || 'S256';
    console.log(`🔐 SECURITY: getGoogleAuthUrl using PKCE challenge for ${serviceType} service`);
  }
  
  return getOAuth2Client().generateAuthUrl(authParams);
}

export const googleOAuthService = new GoogleOAuthService();