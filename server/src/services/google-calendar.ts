import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { storage } from '../../storage';
import type { Event, InsertEvent, CalendarIntegration } from '@shared/schema';

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  status?: string;
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  
  constructor() {
    // Initialize OAuth2 client with credentials
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
    );
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }
  
  /**
   * Generate OAuth URL for calendar access
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }
  
  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }
    
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
    };
  }
  
  /**
   * Set credentials for API calls
   */
  setCredentials(tokens: { access_token: string; refresh_token?: string; expiry_date?: number }) {
    this.oauth2Client.setCredentials(tokens);
  }
  
  /**
   * Get user's calendar list
   */
  async getCalendarList(): Promise<Array<{
    id: string;
    summary: string;
    description?: string;
    primary?: boolean;
    accessRole: string;
  }>> {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      throw new Error('Failed to fetch calendar list');
    }
  }
  
  /**
   * Get events from Google Calendar
   */
  async getEvents(calendarId: string, options: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    syncToken?: string;
  } = {}): Promise<{
    events: GoogleCalendarEvent[];
    nextSyncToken?: string;
  }> {
    try {
      const params: any = {
        calendarId,
        maxResults: options.maxResults || 250,
        singleEvents: true,
        orderBy: 'startTime'
      };
      
      if (options.timeMin) {
        params.timeMin = options.timeMin.toISOString();
      }
      
      if (options.timeMax) {
        params.timeMax = options.timeMax.toISOString();
      }
      
      if (options.syncToken) {
        params.syncToken = options.syncToken;
      }
      
      const response = await this.calendar.events.list(params);
      
      return {
        events: response.data.items || [],
        nextSyncToken: response.data.nextSyncToken
      };
    } catch (error) {
      console.error('Error fetching events:', error);
      throw new Error('Failed to fetch events from Google Calendar');
    }
  }
  
  /**
   * Create event in Google Calendar
   */
  async createEvent(calendarId: string, event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        resource: event
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error('Failed to create event in Google Calendar');
    }
  }
  
  /**
   * Update event in Google Calendar
   */
  async updateEvent(calendarId: string, eventId: string, event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        resource: event
      });
      
      return response.data;
    } catch (error) {
      console.error('Error updating event:', error);
      throw new Error('Failed to update event in Google Calendar');
    }
  }
  
  /**
   * Delete event from Google Calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      throw new Error('Failed to delete event from Google Calendar');
    }
  }
  
  /**
   * Convert Google Calendar event to CRM event
   */
  convertGoogleEventToCRMEvent(googleEvent: GoogleCalendarEvent, integrationId: string): Omit<InsertEvent, 'createdBy'> {
    const startDate = googleEvent.start?.dateTime 
      ? new Date(googleEvent.start.dateTime)
      : googleEvent.start?.date 
      ? new Date(googleEvent.start.date)
      : new Date();
    
    const endDate = googleEvent.end?.dateTime 
      ? new Date(googleEvent.end.dateTime)
      : googleEvent.end?.date 
      ? new Date(googleEvent.end.date)
      : new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default
    
    const allDay = !googleEvent.start?.dateTime; // If no time, it's all-day
    
    return {
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      startDate,
      endDate,
      allDay,
      type: 'meeting',
      status: googleEvent.status === 'cancelled' ? 'cancelled' : 'confirmed',
      priority: 'medium',
      externalEventId: googleEvent.id || null,
      calendarIntegrationId: integrationId,
      attendees: googleEvent.attendees?.map(attendee => attendee.email) || null,
      reminderMinutes: googleEvent.reminders?.overrides?.[0]?.minutes || 15,
      recurring: (googleEvent.recurrence && googleEvent.recurrence.length > 0) || false,
      recurrenceRule: googleEvent.recurrence?.[0] || null
    };
  }
  
  /**
   * Convert CRM event to Google Calendar event
   */
  convertCRMEventToGoogleEvent(crmEvent: Event): GoogleCalendarEvent {
    const googleEvent: GoogleCalendarEvent = {
      summary: crmEvent.title,
      description: crmEvent.description || undefined,
      location: crmEvent.location || undefined,
      status: crmEvent.status === 'cancelled' ? 'cancelled' : 'confirmed'
    };
    
    if (crmEvent.allDay) {
      googleEvent.start = {
        date: crmEvent.startDate.toISOString().split('T')[0]
      };
      googleEvent.end = {
        date: crmEvent.endDate.toISOString().split('T')[0]
      };
    } else {
      googleEvent.start = {
        dateTime: crmEvent.startDate.toISOString()
      };
      googleEvent.end = {
        dateTime: crmEvent.endDate.toISOString()
      };
    }
    
    if (crmEvent.attendees && crmEvent.attendees.length > 0) {
      googleEvent.attendees = crmEvent.attendees.map(email => ({ email }));
    }
    
    if (crmEvent.reminderMinutes) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: [{
          method: 'popup',
          minutes: crmEvent.reminderMinutes
        }]
      };
    }
    
    if (crmEvent.recurrenceRule) {
      googleEvent.recurrence = [crmEvent.recurrenceRule];
    }
    
    return googleEvent;
  }
  
  /**
   * Sync events from Google Calendar to CRM
   */
  async syncFromGoogle(integration: CalendarIntegration, userId: string): Promise<{
    eventsCreated: number;
    eventsUpdated: number;
    eventsDeleted: number;
    nextSyncToken?: string;
  }> {
    if (!integration.accessToken) {
      throw new Error('No access token available for integration');
    }
    
    // Set credentials
    this.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken || undefined,
    });
    
    try {
      // Get events from Google Calendar
      const { events: googleEvents, nextSyncToken } = await this.getEvents(
        integration.calendarId!,
        {
          syncToken: integration.syncToken || undefined,
          timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          timeMax: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)  // Next 180 days
        }
      );
      
      let eventsCreated = 0;
      let eventsUpdated = 0;
      let eventsDeleted = 0;
      
      for (const googleEvent of googleEvents) {
        if (!googleEvent.id) continue;
        
        // Check if event already exists in CRM
        const existingEvents = await storage.getEvents();
        const existingEvent = existingEvents.find(e => 
          e.externalEventId === googleEvent.id && 
          e.calendarIntegrationId === integration.id
        );
        
        if (googleEvent.status === 'cancelled') {
          // Delete event if it exists
          if (existingEvent) {
            await storage.deleteEvent(existingEvent.id);
            eventsDeleted++;
          }
        } else {
          // Convert Google event to CRM event
          const crmEventData = this.convertGoogleEventToCRMEvent(googleEvent, integration.id);
          
          if (existingEvent) {
            // Update existing event
            await storage.updateEvent(existingEvent.id, crmEventData);
            eventsUpdated++;
          } else {
            // Create new event
            await storage.createEvent({
              ...crmEventData,
              createdBy: userId
            }, integration.tenantId);
            eventsCreated++;
          }
        }
      }
      
      // Update sync token
      if (nextSyncToken) {
        await storage.updateCalendarIntegration(integration.id, {
          syncToken: nextSyncToken,
          lastSyncAt: new Date()
        });
      }
      
      return {
        eventsCreated,
        eventsUpdated,
        eventsDeleted,
        nextSyncToken
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error syncing from Google Calendar:', error);
      
      // Log sync error
      await storage.updateCalendarIntegration(integration.id, {
        syncErrors: JSON.stringify({ error: errorMessage, timestamp: new Date() })
      });
      
      throw error;
    }
  }
  
  /**
   * Sync events from CRM to Google Calendar
   */
  async syncToGoogle(integration: CalendarIntegration): Promise<{
    eventsCreated: number;
    eventsUpdated: number;
    eventsDeleted: number;
  }> {
    if (!integration.accessToken) {
      throw new Error('No access token available for integration');
    }
    
    // Set credentials
    this.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken || undefined,
    });
    
    try {
      // Get CRM events that should be synced
      const crmEvents = await storage.getEvents();
      const eventsToSync = crmEvents.filter(event => 
        event.calendarIntegrationId === integration.id ||
        (!event.calendarIntegrationId && !event.externalEventId)
      );
      
      let eventsCreated = 0;
      let eventsUpdated = 0;
      let eventsDeleted = 0;
      
      for (const crmEvent of eventsToSync) {
        const googleEventData = this.convertCRMEventToGoogleEvent(crmEvent);
        
        try {
          if (crmEvent.externalEventId) {
            // Update existing Google event
            await this.updateEvent(
              integration.calendarId!,
              crmEvent.externalEventId,
              googleEventData
            );
            eventsUpdated++;
          } else {
            // Create new Google event
            const createdEvent = await this.createEvent(
              integration.calendarId!,
              googleEventData
            );
            
            // Update CRM event with external ID
            await storage.updateEvent(crmEvent.id, {
              externalEventId: createdEvent.id,
              calendarIntegrationId: integration.id
            });
            
            eventsCreated++;
          }
        } catch (error) {
          console.error(`Error syncing event ${crmEvent.id}:`, error);
          // Continue with other events
        }
      }
      
      return {
        eventsCreated,
        eventsUpdated,
        eventsDeleted
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error syncing to Google Calendar:', error);
      
      // Log sync error
      await storage.updateCalendarIntegration(integration.id, {
        syncErrors: JSON.stringify({ error: errorMessage, timestamp: new Date() })
      });
      
      throw error;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;