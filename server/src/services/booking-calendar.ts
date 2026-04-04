/**
 * Booking Calendar Service
 *
 * Handles automatic creation, update, and deletion of Google Calendar events
 * when bookings are confirmed, rescheduled, or cancelled.
 */

import { storage } from '../../storage';
import { googleCalendarService } from './google-calendar';
import type { Booking, BookableService } from '@shared/schema';

/**
 * Build a Google Calendar event object from booking + service data.
 */
function buildGoogleEvent(booking: Booking, service: BookableService) {
  // Use startTime / endTime from the booking record
  const startIso = new Date(booking.startTime).toISOString();
  const endIso = new Date(booking.endTime).toISOString();

  const description = [
    booking.bookedEmail ? `Client email: ${booking.bookedEmail}` : '',
    booking.bookedPhone ? `Client phone: ${booking.bookedPhone}` : '',
    (service as any).locationDetails ? `Details: ${(service as any).locationDetails}` : '',
  ].filter(Boolean).join('\n');

  return {
    summary: `${service.name} — ${booking.bookedBy}`,
    description: description || undefined,
    location: service.location || undefined,
    start: {
      dateTime: startIso,
    },
    end: {
      dateTime: endIso,
    },
    attendees: booking.bookedEmail
      ? [{ email: booking.bookedEmail, displayName: booking.bookedBy || undefined }]
      : undefined,
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 60 }],
    },
  };
}

/**
 * Get the active Google Calendar integration for a tenant, if any.
 */
async function getActiveGoogleIntegration(tenantId: string) {
  const integrations = await storage.getCalendarIntegrationsByTenant(tenantId);
  return integrations.find(
    (i) => i.provider === 'google' && i.isActive && i.accessToken
  ) || null;
}

/**
 * Create a Google Calendar event for a confirmed booking.
 * Returns the Google event ID, or null if no calendar integration is active.
 */
export async function createBookingCalendarEvent(
  booking: Booking,
  tenantId: string
): Promise<string | null> {
  try {
    const integration = await getActiveGoogleIntegration(tenantId);
    if (!integration) {
      console.log(`📅 No active Google Calendar integration for tenant ${tenantId} — skipping event creation`);
      return null;
    }

    const service = await storage.getBookableService(booking.serviceId, tenantId);
    if (!service) {
      console.warn(`📅 Cannot create calendar event — service ${booking.serviceId} not found`);
      return null;
    }

    googleCalendarService.setCredentials({
      access_token: integration.accessToken!,
      refresh_token: integration.refreshToken || undefined,
    });

    const event = buildGoogleEvent(booking, service);
    const calendarId = integration.calendarId || 'primary';

    const created = await googleCalendarService.createEvent(calendarId, event);
    const googleEventId = (created as any).id as string;

    console.log(`📅 Google Calendar event created: ${googleEventId} for booking ${booking.id}`);
    return googleEventId;
  } catch (err) {
    console.error(`📅 Failed to create Google Calendar event for booking ${booking.id}:`, err);
    return null; // Non-fatal — booking still succeeds
  }
}

/**
 * Delete the Google Calendar event associated with a booking (on cancellation).
 */
export async function deleteBookingCalendarEvent(
  booking: Booking,
  tenantId: string
): Promise<void> {
  try {
    const googleEventId = (booking as any).googleEventId as string | null | undefined;
    if (!googleEventId) return;

    const integration = await getActiveGoogleIntegration(tenantId);
    if (!integration) return;

    googleCalendarService.setCredentials({
      access_token: integration.accessToken!,
      refresh_token: integration.refreshToken || undefined,
    });

    const calendarId = integration.calendarId || 'primary';
    await googleCalendarService.deleteEvent(calendarId, googleEventId);
    console.log(`📅 Google Calendar event deleted: ${googleEventId} for booking ${booking.id}`);
  } catch (err) {
    console.error(`📅 Failed to delete Google Calendar event for booking ${booking.id}:`, err);
    // Non-fatal
  }
}

/**
 * Update the Google Calendar event for a booking (e.g. reschedule).
 * If no event exists yet it will be created instead.
 */
export async function updateBookingCalendarEvent(
  booking: Booking,
  tenantId: string
): Promise<string | null> {
  try {
    const googleEventId = (booking as any).googleEventId as string | null | undefined;

    const integration = await getActiveGoogleIntegration(tenantId);
    if (!integration) return null;

    const service = await storage.getBookableService(booking.serviceId, tenantId);
    if (!service) return null;

    googleCalendarService.setCredentials({
      access_token: integration.accessToken!,
      refresh_token: integration.refreshToken || undefined,
    });

    const event = buildGoogleEvent(booking, service);
    const calendarId = integration.calendarId || 'primary';

    if (googleEventId) {
      await googleCalendarService.updateEvent(calendarId, googleEventId, event);
      console.log(`📅 Google Calendar event updated: ${googleEventId} for booking ${booking.id}`);
      return googleEventId;
    } else {
      const created = await googleCalendarService.createEvent(calendarId, event);
      const newEventId = (created as any).id as string;
      console.log(`📅 Google Calendar event created (via update): ${newEventId} for booking ${booking.id}`);
      return newEventId;
    }
  } catch (err) {
    console.error(`📅 Failed to update Google Calendar event for booking ${booking.id}:`, err);
    return null;
  }
}
