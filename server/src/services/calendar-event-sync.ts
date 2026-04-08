/**
 * Calendar Event Sync — keeps calendar events in sync with project status changes.
 *
 * Title progression:
 *   new           → "Enquiry • {name}"
 *   contacted     → "Contacted • {name}"
 *   proposal_sent → "Proposal Sent • {name}"
 *   booked        → "Booked ✓ {name}"
 *   hold          → "On Hold • {name}"
 *   lost/cancelled→ "(CANCELLED) {name}"   (handled by existing markEventsCancelledForProject)
 *   completed     → left as-is (no change)
 *
 * Status/transparency:
 *   new/contacted/proposal_sent → tentative + free
 *   booked                      → confirmed + busy
 *   hold                        → tentative + free
 */

import { storage } from '../../storage';
import { googleOutbox } from '../../services/googleOutbox';

// ── Title helpers ────────────────────────────────────────────────────

const STATUS_TITLE_PREFIX: Record<string, string> = {
  new: 'Enquiry',
  contacted: 'Contacted',
  proposal_sent: 'Proposal Sent',
  booked: 'Booked ✓',
  hold: 'On Hold',
};

/**
 * Extract the contact/lead name from an existing event title.
 * Handles formats like:
 *   "New Lead Project • John Smith"
 *   "Enquiry • John Smith"
 *   "Proposal Sent • John Smith"
 *   "(CANCELLED) Enquiry • John Smith"
 */
function extractNameFromTitle(title: string): string {
  // Strip any existing "(CANCELLED) " prefix
  let clean = title.replace(/^\(CANCELLED\)\s*/, '');
  // Split on bullet separator
  const parts = clean.split('•');
  if (parts.length >= 2) {
    return parts.slice(1).join('•').trim();
  }
  // Fallback — strip known prefixes
  for (const prefix of [...Object.values(STATUS_TITLE_PREFIX), 'New Lead Project']) {
    if (clean.startsWith(prefix)) {
      clean = clean.slice(prefix.length).trim();
      // Remove leading bullet/dash if present
      clean = clean.replace(/^[•\-–—]\s*/, '');
      return clean || 'Unknown';
    }
  }
  return clean || 'Unknown';
}

function buildTitle(status: string, name: string): string {
  const prefix = STATUS_TITLE_PREFIX[status];
  if (!prefix) return `${name}`; // Shouldn't happen, but safe fallback
  return `${prefix} • ${name}`;
}

// ── Calendar event status mapping ────────────────────────────────────

interface CalendarEventStatusFields {
  status: string;        // 'tentative' | 'confirmed' | 'cancelled'
  transparency: string;  // 'free' | 'busy'
}

function calendarFieldsForStatus(projectStatus: string): CalendarEventStatusFields {
  switch (projectStatus) {
    case 'booked':
      return { status: 'confirmed', transparency: 'busy' };
    case 'hold':
    case 'new':
    case 'contacted':
    case 'proposal_sent':
    default:
      return { status: 'tentative', transparency: 'free' };
  }
}

// ── Description builder for booked projects ──────────────────────────

async function buildBookedDescription(
  projectId: string,
  tenantId: string,
  existingDescription: string | null
): Promise<string> {
  try {
    const project = await storage.getProject(projectId, tenantId);
    if (!project) return existingDescription || '';

    const lines: string[] = [];

    // Venue info
    const venueName = (project as any).venueName || (project as any).venue_name;
    const venueAddress = (project as any).venueAddress || (project as any).venue_address;
    if (venueName) lines.push(`📍 Venue: ${venueName}`);
    if (venueAddress) lines.push(`   ${venueAddress}`);

    // Contact info
    if (project.contactId) {
      try {
        const contact = await storage.getContact(project.contactId, tenantId);
        if (contact) {
          const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
          if (contactName) lines.push(`👤 Contact: ${contactName}`);
          if (contact.email) lines.push(`📧 ${contact.email}`);
          if (contact.phone) lines.push(`📞 ${contact.phone}`);
        }
      } catch (e) {
        // Non-fatal — contact lookup failed
      }
    }

    // Event type (now stored as its own field on the project)
    if ((project as any).eventType) {
      lines.push(`🎯 Event type: ${(project as any).eventType}`);
    }

    // Project date
    if (project.projectDate) {
      const d = new Date(project.projectDate);
      lines.push(`📅 Date: ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
    }

    if (lines.length === 0) return existingDescription || '';

    // Preserve any original notes below a separator
    let result = lines.join('\n');
    if (existingDescription && existingDescription.trim()) {
      result += '\n\n---\nOriginal notes:\n' + existingDescription;
    }
    return result;
  } catch (e) {
    console.error('[CalendarEventSync] Failed to build booked description:', e);
    return existingDescription || '';
  }
}

// ── Main sync function ───────────────────────────────────────────────

/**
 * Called whenever a project's status changes.
 * Updates all linked calendar events with the new title, status, and transparency.
 * For "booked", also enriches the description with venue/contact data.
 *
 * Does NOT handle lost/cancelled/archived — those go through markEventsCancelledForProject.
 * Does NOT touch "completed" — event stays as booked.
 */
export async function syncCalendarEventsForStatusChange(
  projectId: string,
  tenantId: string,
  newStatus: string,
  previousStatus?: string
): Promise<void> {
  // Skip statuses that are handled elsewhere or shouldn't change events
  if (['lost', 'cancelled', 'archived', 'completed'].includes(newStatus)) {
    // lost/cancelled/archived → handled by markEventsCancelledForProject in the delete/status endpoint
    // completed → leave event as-is per user preference
    return;
  }

  try {
    const projectEvents = await storage.getEventsByProject(projectId);
    if (!projectEvents || projectEvents.length === 0) {
      console.log(`[CalendarEventSync] No events found for project ${projectId} — skipping`);
      return;
    }

    const calFields = calendarFieldsForStatus(newStatus);

    for (const event of projectEvents) {
      // Skip already-cancelled events
      if (event.isCancelled) continue;

      const name = extractNameFromTitle(event.title);
      const newTitle = buildTitle(newStatus, name);

      const updates: Record<string, any> = {
        title: newTitle,
        status: calFields.status,
        transparency: calFields.transparency,
      };

      // When booked, enrich the description with venue/contact details
      if (newStatus === 'booked') {
        updates.description = await buildBookedDescription(projectId, tenantId, event.description || null);
      }

      console.log(`[CalendarEventSync] Project ${projectId}: ${previousStatus || '?'} → ${newStatus} | Event ${event.id}: "${event.title}" → "${newTitle}" (${calFields.status}/${calFields.transparency})`);

      await storage.updateEvent(event.id, updates, tenantId);

      // Queue for Google Calendar push so the change shows up immediately
      googleOutbox.enqueue({ eventId: event.id, tenantId });
    }
  } catch (error) {
    console.error(`[CalendarEventSync] Error syncing events for project ${projectId}:`, error);
    // Non-fatal — don't break the status change
  }
}
