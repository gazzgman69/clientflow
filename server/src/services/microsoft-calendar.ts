import { getUncachableOutlookClient } from './microsoft-oauth';
import type { Event, InsertEvent } from '@shared/schema';

interface MicrosoftCalendarEvent {
  id?: string;
  subject?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
  location?: {
    displayName?: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  isAllDay?: boolean;
  recurrence?: any;
  showAs?: string;
}

export class MicrosoftCalendarService {
  /**
   * Get user's calendar events
   */
  async getEvents(calendarId: string = 'primary', timeMin?: Date, timeMax?: Date): Promise<Event[]> {
    const client = await getUncachableOutlookClient();
    
    let query = '/me/events';
    const params: string[] = [];
    
    if (timeMin) {
      params.push(`startDateTime=${timeMin.toISOString()}`);
    }
    
    if (timeMax) {
      params.push(`endDateTime=${timeMax.toISOString()}`);
    }
    
    if (params.length > 0) {
      query += `?${params.join('&')}`;
    }

    const response = await client.api(query).get();
    const events = response.value || [];

    return events.map((event: MicrosoftCalendarEvent) => this.convertToEvent(event));
  }

  /**
   * Create a new calendar event
   */
  async createEvent(eventData: InsertEvent, calendarId: string = 'primary'): Promise<Event> {
    const client = await getUncachableOutlookClient();
    
    const microsoftEvent = this.convertFromEvent(eventData);
    const response = await client.api('/me/events').post(microsoftEvent);
    
    return this.convertToEvent(response);
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(eventId: string, eventData: Partial<InsertEvent>, calendarId: string = 'primary'): Promise<Event> {
    const client = await getUncachableOutlookClient();
    
    const microsoftEvent = this.convertFromEvent(eventData);
    const response = await client.api(`/me/events/${eventId}`).patch(microsoftEvent);
    
    return this.convertToEvent(response);
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    const client = await getUncachableOutlookClient();
    await client.api(`/me/events/${eventId}`).delete();
  }

  /**
   * Get user's calendars
   */
  async getCalendars(): Promise<Array<{ id: string; name: string; primary: boolean }>> {
    const client = await getUncachableOutlookClient();
    const response = await client.api('/me/calendars').get();
    const calendars = response.value || [];

    return calendars.map((calendar: any) => ({
      id: calendar.id,
      name: calendar.name,
      primary: calendar.isDefaultCalendar || false
    }));
  }

  /**
   * Convert Microsoft Graph event to our Event format
   */
  private convertToEvent(microsoftEvent: MicrosoftCalendarEvent): Event {
    return {
      id: microsoftEvent.id || '',
      title: microsoftEvent.subject || '',
      description: microsoftEvent.body?.content || '',
      startTime: microsoftEvent.start?.dateTime || '',
      endTime: microsoftEvent.end?.dateTime || '',
      location: microsoftEvent.location?.displayName || '',
      attendees: microsoftEvent.attendees?.map(attendee => 
        attendee.emailAddress.address
      ) || [],
      isAllDay: microsoftEvent.isAllDay || false,
      status: this.mapMicrosoftStatus(microsoftEvent.showAs),
      source: 'microsoft',
      sourceEventId: microsoftEvent.id || '',
      userId: '', // Will be set by caller
      tenantId: '', // Will be set by caller
      calendarId: 'primary' // Default calendar
    };
  }

  /**
   * Convert our Event format to Microsoft Graph event
   */
  private convertFromEvent(eventData: Partial<InsertEvent>): Partial<MicrosoftCalendarEvent> {
    const microsoftEvent: Partial<MicrosoftCalendarEvent> = {
      subject: eventData.title,
      body: {
        content: eventData.description || '',
        contentType: 'text'
      },
      isAllDay: eventData.allDay || false,
      showAs: (eventData as any).transparency === 'free' ? 'free' : 'busy'
    };

    if (eventData.startDate) {
      microsoftEvent.start = {
        dateTime: eventData.startDate.toISOString(),
        timeZone: 'UTC'
      };
    }

    if (eventData.endDate) {
      microsoftEvent.end = {
        dateTime: eventData.endDate.toISOString(),
        timeZone: 'UTC'
      };
    }

    if (eventData.location) {
      microsoftEvent.location = {
        displayName: eventData.location
      };
    }

    if (eventData.attendees && eventData.attendees.length > 0) {
      microsoftEvent.attendees = eventData.attendees.map(attendee => ({
        emailAddress: {
          address: attendee,
          name: attendee
        }
      }));
    }

    return microsoftEvent;
  }

  /**
   * Map Microsoft status to our status format
   */
  private mapMicrosoftStatus(showAs?: string): string {
    switch (showAs) {
      case 'free':
        return 'confirmed';
      case 'busy':
        return 'confirmed';
      case 'tentative':
        return 'tentative';
      case 'oof':
        return 'cancelled';
      default:
        return 'confirmed';
    }
  }
}

// Export singleton instance
export const microsoftCalendarService = new MicrosoftCalendarService();