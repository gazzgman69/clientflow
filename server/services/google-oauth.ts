import { google } from 'googleapis';
import { storage } from '../storage';
import type { CalendarIntegration } from '@shared/schema';

// Helper function to get the correct redirect URI
function getRedirectUri(): string {
  if (process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(',')[0];
    return `https://${domain}/auth/google/callback`;
  }
  return 'http://localhost:5000/auth/google/callback';
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  getRedirectUri()
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email'
];

export class GoogleOAuthService {
  /**
   * Generate OAuth URL for user to authenticate
   * @param email User's email for login hint
   * @param userId User ID in our system
   */
  generateAuthUrl(email: string, userId: string): string {
    const state = Buffer.from(JSON.stringify({ email, userId })).toString('base64');
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      login_hint: email,
      state: state,
      include_granted_scopes: true
    });
    
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string | null;
    email: string;
  }> {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user's email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    
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
    const tokens = {
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken
    };
    
    const userOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID',
      process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
      getRedirectUri()
    );
    
    userOAuth2Client.setCredentials(tokens);
    
    // Handle token refresh
    userOAuth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await storage.updateCalendarIntegration(integration.id, {
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token!
        });
      } else if (tokens.access_token) {
        await storage.updateCalendarIntegration(integration.id, {
          accessToken: tokens.access_token
        });
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
        // Skip if already synced to Google
        if (event.externalEventId) {
          skippedCount++;
          continue;
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
          attendees: googleEvent.attendees?.map(attendee => attendee.email).filter(email => email) || []
        };
        
        if (existing) {
          await storage.updateEvent(existing.id, eventData);
        } else {
          await storage.createEvent(eventData);
        }
      }

      // Check for events that were completely removed from Google Calendar
      // (not just cancelled, but deleted entirely)
      console.log('Checking for events deleted from Google Calendar...');
      const crmEventsFromGoogle = await storage.getEventsByIntegration(integration.id);
      
      for (const crmEvent of crmEventsFromGoogle) {
        if (crmEvent.externalEventId && !currentGoogleEventIds.has(crmEvent.externalEventId)) {
          console.log(`Event "${crmEvent.title}" no longer exists in Google Calendar, removing from CRM`);
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
      await storage.updateCalendarIntegration(integration.id, {
        syncErrors: error.message
      });
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
              dateTime: new Date(event.startDate).toISOString(),
              timeZone: 'Europe/London' // Set proper timezone
            },
        end: event.allDay
          ? { date: new Date(event.endDate).toISOString().split('T')[0] }
          : { 
              dateTime: new Date(event.endDate).toISOString(),
              timeZone: 'Europe/London' // Set proper timezone
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

export const googleOAuthService = new GoogleOAuthService();