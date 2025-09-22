// @ts-ignore - node-ical doesn't have TypeScript definitions
import ical from 'node-ical';
import { storage } from '../../storage';
import type { Event, InsertEvent, CalendarIntegration } from '@shared/schema';

interface ICalEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: Date;
  end?: Date;
  rrule?: any;
  datetype?: string;
  attendees?: any[];
  organizer?: any;
  status?: string;
  transparency?: string;
  class?: string;
}

class ICalService {
  /**
   * Parse iCal data from URL or file content
   */
  async parseICalData(data: string | Buffer): Promise<ICalEvent[]> {
    try {
      const events: ICalEvent[] = [];
      const parsed = await ical.async.parseICS(data.toString());
      
      for (const key in parsed) {
        const component = parsed[key];
        if (component.type === 'VEVENT') {
          events.push(component as ICalEvent);
        }
      }
      
      return events;
    } catch (error) {
      console.error('Error parsing iCal data:', error);
      throw new Error('Failed to parse iCal data');
    }
  }
  
  /**
   * Fetch and parse iCal data from URL
   */
  async parseICalFromUrl(url: string): Promise<ICalEvent[]> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.text();
      return this.parseICalData(data);
    } catch (error) {
      console.error('Error fetching iCal from URL:', error);
      throw new Error('Failed to fetch iCal data from URL');
    }
  }
  
  /**
   * Convert iCal event to CRM event
   */
  convertICalEventToCRMEvent(icalEvent: ICalEvent, integrationId: string): Omit<InsertEvent, 'createdBy'> {
    const startDate = icalEvent.start || new Date();
    const endDate = icalEvent.end || new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default
    
    // Check if it's an all-day event
    const allDay = icalEvent.datetype === 'date' || 
                   (icalEvent.start && icalEvent.end && 
                    icalEvent.start.getHours() === 0 && icalEvent.start.getMinutes() === 0 &&
                    icalEvent.end.getHours() === 0 && icalEvent.end.getMinutes() === 0);
    
    return {
      title: icalEvent.summary || 'Untitled Event',
      description: icalEvent.description || null,
      location: icalEvent.location || null,
      startDate,
      endDate,
      allDay,
      type: 'meeting',
      status: this.mapICalStatusToCRMStatus(icalEvent.status),
      priority: 'medium',
      externalEventId: icalEvent.uid || null,
      calendarIntegrationId: integrationId,
      attendees: this.extractAttendeeEmails(icalEvent.attendees),
      reminderMinutes: 15, // Default reminder
      recurring: !!icalEvent.rrule,
      recurrenceRule: icalEvent.rrule ? this.convertRRuleToString(icalEvent.rrule) : null
    };
  }
  
  /**
   * Convert CRM event to iCal format
   */
  convertCRMEventToICalEvent(crmEvent: Event): string {
    const lines: string[] = [];
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${crmEvent.externalEventId || crmEvent.id}`);
    lines.push(`DTSTAMP:${this.formatICalDate(new Date())}`);
    lines.push(`SUMMARY:${this.escapeICalText(crmEvent.title)}`);
    
    if (crmEvent.description) {
      lines.push(`DESCRIPTION:${this.escapeICalText(crmEvent.description)}`);
    }
    
    if (crmEvent.location) {
      lines.push(`LOCATION:${this.escapeICalText(crmEvent.location)}`);
    }
    
    if (crmEvent.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${this.formatICalDate(crmEvent.startDate, true)}`);
      lines.push(`DTEND;VALUE=DATE:${this.formatICalDate(crmEvent.endDate, true)}`);
    } else {
      lines.push(`DTSTART:${this.formatICalDate(crmEvent.startDate)}`);
      lines.push(`DTEND:${this.formatICalDate(crmEvent.endDate)}`);
    }
    
    if (crmEvent.recurrenceRule) {
      lines.push(`RRULE:${crmEvent.recurrenceRule}`);
    }
    
    if (crmEvent.attendees && crmEvent.attendees.length > 0) {
      crmEvent.attendees.forEach(email => {
        lines.push(`ATTENDEE:mailto:${email}`);
      });
    }
    
    lines.push(`STATUS:${this.mapCRMStatusToICalStatus(crmEvent.status)}`);
    lines.push('END:VEVENT');
    
    return lines.join('\r\n');
  }
  
  /**
   * Generate complete iCal feed for CRM events
   */
  async generateICalFeed(events: Event[], calendarName: string = 'CRM Calendar'): Promise<string> {
    const lines: string[] = [];
    
    // Calendar header
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//CRM System//Calendar//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');
    lines.push(`X-WR-CALNAME:${this.escapeICalText(calendarName)}`);
    lines.push(`X-WR-CALDESC:${this.escapeICalText('Calendar feed from CRM system')}`);
    
    // Add events
    events.forEach(event => {
      const eventLines = this.convertCRMEventToICalEvent(event).split('\r\n');
      lines.push(...eventLines);
    });
    
    // Calendar footer
    lines.push('END:VCALENDAR');
    
    return lines.join('\r\n');
  }
  
  /**
   * Import events from iCal integration
   */
  async importFromICal(integration: CalendarIntegration, userId: string): Promise<{
    eventsCreated: number;
    eventsUpdated: number;
    eventsDeleted: number;
  }> {
    if (!integration.settings) {
      throw new Error('No iCal URL configured for integration');
    }
    
    try {
      const settings = JSON.parse(integration.settings);
      const icalUrl = settings.icalUrl;
      
      if (!icalUrl) {
        throw new Error('No iCal URL found in integration settings');
      }
      
      // Fetch and parse iCal data
      const icalEvents = await this.parseICalFromUrl(icalUrl);
      
      let eventsCreated = 0;
      let eventsUpdated = 0;
      let eventsDeleted = 0;
      
      // Get existing CRM events from this integration
      const existingEvents = await storage.getEvents();
      const integrationEvents = existingEvents.filter(e => 
        e.calendarIntegrationId === integration.id
      );
      
      // Create a map of existing events by UID
      const existingEventMap = new Map(
        integrationEvents.map(e => [e.externalEventId, e])
      );
      
      // Process each iCal event
      for (const icalEvent of icalEvents) {
        if (!icalEvent.uid) continue;
        
        const crmEventData = this.convertICalEventToCRMEvent(icalEvent, integration.id);
        const existingEvent = existingEventMap.get(icalEvent.uid);
        
        if (existingEvent) {
          // Update existing event
          await storage.updateEvent(existingEvent.id, crmEventData);
          eventsUpdated++;
          existingEventMap.delete(icalEvent.uid); // Mark as processed
        } else {
          // Create new event
          await storage.createEvent({
            ...crmEventData,
            createdBy: userId
          });
          eventsCreated++;
        }
      }
      
      // Delete events that are no longer in the iCal feed
      for (const [uid, event] of Array.from(existingEventMap.entries())) {
        await storage.deleteEvent(event.id);
        eventsDeleted++;
      }
      
      // Update last sync time
      await storage.updateCalendarIntegration(integration.id, {
        lastSyncAt: new Date()
      });
      
      return {
        eventsCreated,
        eventsUpdated,
        eventsDeleted
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error importing from iCal:', error);
      
      // Log sync error
      await storage.updateCalendarIntegration(integration.id, {
        syncErrors: JSON.stringify({ error: errorMessage, timestamp: new Date() })
      });
      
      throw error;
    }
  }
  
  /**
   * Helper methods
   */
  private mapICalStatusToCRMStatus(icalStatus?: string): 'confirmed' | 'tentative' | 'cancelled' {
    switch (icalStatus?.toUpperCase()) {
      case 'CONFIRMED': return 'confirmed';
      case 'TENTATIVE': return 'tentative';
      case 'CANCELLED': return 'cancelled';
      default: return 'confirmed';
    }
  }
  
  private mapCRMStatusToICalStatus(crmStatus: string): string {
    switch (crmStatus) {
      case 'confirmed': return 'CONFIRMED';
      case 'tentative': return 'TENTATIVE';
      case 'cancelled': return 'CANCELLED';
      default: return 'CONFIRMED';
    }
  }
  
  private extractAttendeeEmails(attendees?: any[]): string[] | null {
    if (!attendees || attendees.length === 0) return null;
    
    return attendees.map(attendee => {
      if (typeof attendee === 'string') {
        // Extract email from "mailto:email@domain.com" format
        const match = attendee.match(/mailto:([^;]+)/);
        return match ? match[1] : attendee;
      }
      return attendee.val || attendee.email || attendee;
    }).filter(Boolean);
  }
  
  private convertRRuleToString(rrule: any): string {
    if (typeof rrule === 'string') return rrule;
    
    // Convert rrule object to string format
    const parts: string[] = [];
    
    if (rrule.freq) parts.push(`FREQ=${rrule.freq}`);
    if (rrule.interval) parts.push(`INTERVAL=${rrule.interval}`);
    if (rrule.count) parts.push(`COUNT=${rrule.count}`);
    if (rrule.until) parts.push(`UNTIL=${this.formatICalDate(rrule.until)}`);
    if (rrule.byday) parts.push(`BYDAY=${rrule.byday}`);
    if (rrule.bymonth) parts.push(`BYMONTH=${rrule.bymonth}`);
    
    return parts.join(';');
  }
  
  private formatICalDate(date: Date, dateOnly = false): string {
    if (dateOnly) {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    }
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  
  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }
}

export const icalService = new ICalService();
export default icalService;