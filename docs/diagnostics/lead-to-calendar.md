# Lead Capture → Calendar Event Flow Diagnostic

**Last Updated:** 07/10/2025  
**Status:** ✅ Working (after sync order fix)

## Executive Summary

The lead capture to calendar event flow creates automatic calendar events when leads are submitted with a project date. Events use the 17hats format: "New Lead Project • [Lead Name]" and are stored locally in the CRM calendar system before syncing to Google Calendar.

**Critical Fix Applied:** Google Calendar sync order reversed to prevent duplicate event creation.

---

## Flow Architecture

### 1. Lead Submission Endpoint

**Route:** `POST /api/leads/public/:slug/submit`  
**File:** `server/routes/lead-forms.ts`  
**Handler:** `submitLeadForm()`

```typescript
// Simplified flow
app.post("/api/leads/public/:slug/submit", async (req, res) => {
  // 1. Resolve form and tenant
  const form = await storage.getLeadFormBySlug(slug);
  const tenantId = form.tenantId;
  
  // 2. Create lead
  const lead = await storage.createLead({
    fullName, email, phone, projectDate, venueType,
    tenantId, formSlug: slug, status: 'new'
  });
  
  // 3. Create project
  const project = await storage.createProject({
    name: `${lead.fullName} - ${lead.venueType}`,
    leadId: lead.id,
    eventDate: lead.projectDate,
    tenantId
  });
  
  // 4. Create calendar event (if projectDate exists)
  if (lead.projectDate && leadsCalendar) {
    await storage.createEvent({
      title: `New Lead Project • ${lead.fullName}`,
      type: 'lead',
      leadId: lead.id,
      projectId: project.id,
      calendarId: leadsCalendar.id,
      startDate: lead.projectDate,
      endDate: lead.projectDate,
      contactId: null, // CRITICAL: Prevents CASCADE delete
      tenantId
    });
  }
});
```

### 2. Project Creation Logic

**File:** `server/routes/lead-forms.ts:85-95`

When a lead is created via form submission, a corresponding project is automatically created:

```typescript
const project = await storage.createProject({
  name: `${lead.fullName} - ${lead.venueType || 'Project'}`,
  status: 'lead',
  leadId: lead.id,
  eventDate: lead.projectDate || null,
  details: { leadId: lead.id },
  tenantId
}, tenantId);
```

### 3. Event Creation Logic

**File:** `server/routes/lead-forms.ts:98-119`  
**Condition:** `if (lead.projectDate)`

```typescript
// Find system "Leads Calendar"
const leadsCalendar = await storage.getCalendarByType('leads', tenantId);

if (lead.projectDate && leadsCalendar) {
  const calendarEvent = await storage.createEvent({
    title: `New Lead Project • ${lead.fullName}`, // 17hats format
    description: `Lead capture: ${lead.fullName}`,
    type: 'lead',
    startDate: lead.projectDate,
    endDate: lead.projectDate,
    allDay: true,
    leadId: lead.id,
    projectId: project.id,
    calendarId: leadsCalendar.id,
    contactId: null, // IMPORTANT: Prevents deletion on contact removal
    createdBy: req.authenticatedUserId,
    tenantId
  }, tenantId);
}
```

### 4. Google Calendar Sync

**File:** `server/src/services/google-oauth.ts`  
**Function:** `syncGoogleCalendarEvents()`

**Critical Fix (07/10/2025):** Sync order reversed to prevent duplicates

```typescript
// BEFORE (BROKEN - created duplicates):
// 1. Import FROM Google Calendar
// 2. Push CRM events TO Google Calendar
// ❌ Result: CRM lead events imported as duplicates because no externalEventId yet

// AFTER (FIXED):
// 1. Push CRM events TO Google Calendar ← FIRST
// 2. Import FROM Google Calendar
// ✅ Result: Lead events get externalEventId, then import recognizes them
```

**Key Protection:** Lead events (`type='lead'`) are protected from deletion during sync:

```typescript
// Deletion check - skip lead events
if (crmEvent.type === 'lead') {
  console.log(`🛡️ Skipping deletion check for lead event: ${crmEvent.title}`);
  continue; // Never delete lead-originated events
}
```

---

## Database Schema

### Events Table
```typescript
export const events = pgTable('events', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').references(() => tenants.id).notNull(),
  title: varchar('title').notNull(),
  type: varchar('type').notNull(), // 'lead' | 'meeting' | 'task'
  leadId: varchar('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  calendarId: varchar('calendar_id').references(() => calendars.id).notNull(),
  contactId: varchar('contact_id').references(() => contacts.id, { onDelete: 'cascade' }), // Should be NULL for lead events
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  externalEventId: varchar('external_event_id'), // Google Calendar ID
  isOrphaned: boolean('is_orphaned').default(false),
  createdAt: timestamp('created_at').defaultNow()
});
```

### Calendars Table
```typescript
export const calendars = pgTable('calendars', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').references(() => tenants.id).notNull(),
  name: varchar('name').notNull(),
  type: varchar('type'), // 'leads' | 'booked' | 'completed'
  isSystem: boolean('is_system').default(false),
  isActive: boolean('is_active').default(true)
});
```

---

## Event Creation Decision Tree

```
Lead Submitted
├─ Has projectDate?
│  ├─ YES
│  │  ├─ System "Leads Calendar" exists?
│  │  │  ├─ YES → Create Event ✅
│  │  │  │  ├─ Title: "New Lead Project • {fullName}"
│  │  │  │  ├─ Type: 'lead'
│  │  │  │  ├─ contactId: null (prevents CASCADE delete)
│  │  │  │  └─ Sync to Google Calendar (if connected)
│  │  │  └─ NO → Skip event creation ⚠️
│  └─ NO → Skip event creation (TBD date)
└─ Project Created
```

---

## Current Environment

**Feature Flags:** None  
**Queue System:** None (synchronous event creation)  
**Authentication:** Session-based, tenant-scoped  
**Provider Integration:** Google Calendar OAuth2 (optional)

---

## Reproduction Commands

### 1. Ensure System Calendars Exist

```sql
-- Check for system calendars
SELECT id, name, type, is_system, tenant_id 
FROM calendars 
WHERE tenant_id = 'default-tenant' AND is_system = true;

-- If missing, create them
INSERT INTO calendars (id, tenant_id, name, type, is_system, is_active)
VALUES 
  ('leads-cal-1', 'default-tenant', 'Leads Calendar', 'leads', true, true),
  ('booked-cal-1', 'default-tenant', 'Booked Calendar', 'booked', true, true),
  ('completed-cal-1', 'default-tenant', 'Completed Calendar', 'completed', true, true);
```

### 2. Submit Test Lead

```bash
# Get form slug first
curl http://localhost:5000/api/leads/forms \
  -H "Cookie: connect.sid=YOUR_SESSION"

# Submit lead (replace FORM_SLUG)
curl -X POST http://localhost:5000/api/leads/public/FORM_SLUG/submit \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Lead Name",
    "email": "test@example.com",
    "phone": "1234567890",
    "projectDate": "2025-12-15",
    "venueType": "wedding",
    "eventType": "wedding",
    "guestCount": "100"
  }'
```

### 3. Verify Event Creation

```bash
# Check events API
curl http://localhost:5000/api/events \
  -H "Cookie: connect.sid=YOUR_SESSION"

# Or query database directly
```

```sql
SELECT 
  e.id, e.title, e.type, e.start_date,
  l.full_name as lead_name,
  p.name as project_name
FROM events e
LEFT JOIN leads l ON e.lead_id = l.id
LEFT JOIN projects p ON e.project_id = p.id
WHERE e.tenant_id = 'default-tenant'
  AND e.type = 'lead'
ORDER BY e.created_at DESC
LIMIT 5;
```

---

## Known Issues & Fixes

### ✅ FIXED: Duplicate Event Creation
**Problem:** Google Calendar sync created duplicate events  
**Root Cause:** Sync imported FROM Google before pushing TO Google  
**Fix:** Reversed sync order - push first, then import  
**File:** `server/src/services/google-oauth.ts:453-456`

### ✅ FIXED: Lead Events Deleted on Sync
**Problem:** Lead events deleted when not found in Google Calendar  
**Root Cause:** Deletion check didn't exclude lead-type events  
**Fix:** Added type check to skip lead events during deletion  
**File:** `server/src/services/google-oauth.ts:526-530`

### ✅ FIXED: Events Not Appearing in UI
**Problem:** Events stored in DB but not returned by API  
**Root Cause:** Orphaned event filter was excluding valid events  
**Resolution:** Events correctly filtered by tenant and orphaned status

---

## Debug Mode

Run diagnostic script with full details:

```bash
DEBUG=1 npm run diagnose-lead-calendar
```

Enable verbose API logging:

```bash
LOG_LEVEL=debug npm run dev
```

---

## Idempotency

**Lead Submission:** Each form submission creates a new lead (no deduplication)  
**Event Creation:** One event per lead (linked via `leadId`)  
**Google Sync:** Events matched by `externalEventId` to prevent duplicates

---

## Critical Code Paths

1. **Lead Form Handler:** `server/routes/lead-forms.ts:42` → `submitLeadForm()`
2. **Event Creation:** `server/routes/lead-forms.ts:98` → `storage.createEvent()`
3. **Google Sync:** `server/src/services/google-oauth.ts:415` → `syncGoogleCalendarEvents()`
4. **Event API:** `server/routes.ts:4817` → `GET /api/events`

---

## Contact

For issues with lead capture or calendar events, check:
- Server logs for `📅 EVENT CREATION` messages
- Database `events` table for `type='lead'` records  
- Google Calendar sync logs for `syncGoogleCalendarEvents` output
