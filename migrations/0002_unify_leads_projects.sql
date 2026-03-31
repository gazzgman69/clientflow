-- Migration: Unify leads and projects
-- Every enquiry now creates a project directly. The leads table is kept
-- for reference but the leads page and conversion flow are removed.

-- 1. Add lead-specific columns to the projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_range text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency text DEFAULT 'GBP';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lost_reason_notes text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_expires_at timestamp;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_contact_at timestamp;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_manual_status_at timestamp;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_viewed_at timestamp;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS migrated_from_lead_id varchar;

-- 2. Add index for event_type filtering
CREATE INDEX IF NOT EXISTS projects_tenant_event_type_idx ON projects(tenant_id, event_type);

-- 3. Update existing project statuses: 'lead' -> 'new' (the old default)
UPDATE projects SET status = 'new' WHERE status = 'lead';

-- 4. Migrate existing leads into projects
-- For each lead that doesn't already have a linked project, create a project
INSERT INTO projects (
  tenant_id, user_id, name, contact_id, status,
  start_date, end_date, estimated_value, assigned_to,
  lead_source, event_type, budget_range, currency,
  lost_reason, lost_reason_notes, hold_expires_at,
  referral_source, last_contact_at, last_manual_status_at,
  last_viewed_at, migrated_from_lead_id, created_at, updated_at
)
SELECT
  l.tenant_id,
  l.user_id,
  COALESCE(l.event_type, '') || ' - ' || l.first_name || ' ' || l.last_name AS name,
  c.id AS contact_id,
  CASE
    WHEN l.status = 'converted' THEN 'booked'
    WHEN l.status IN ('new', 'contacted', 'hold', 'proposal_sent', 'lost', 'archived') THEN l.status
    ELSE 'new'
  END AS status,
  l.project_date AS start_date,
  l.project_date AS end_date,
  l.estimated_value,
  l.assigned_to,
  l.lead_source,
  l.event_type,
  l.budget_range,
  l.currency,
  l.lost_reason,
  l.lost_reason_notes,
  l.hold_expires_at,
  l.referral_source,
  l.last_contact_at,
  l.last_manual_status_at,
  l.last_viewed_at,
  l.id AS migrated_from_lead_id,
  l.created_at,
  l.updated_at
FROM leads l
-- Join to contacts to find matching contact by email + tenant
JOIN contacts c ON c.email = l.email AND c.tenant_id = l.tenant_id
-- Only migrate leads that don't already have a linked project
WHERE l.project_id IS NULL;
