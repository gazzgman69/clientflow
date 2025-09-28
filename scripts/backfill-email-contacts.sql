-- Backfill Migration: Associate existing emails with contacts and projects
-- Goal: Implement contacts-only email ingestion by linking orphaned emails

-- Step 1: Backfill contact_id for existing emails where possible
UPDATE emails e
SET contact_id = c.id
FROM contacts c
WHERE e.tenant_id = c.tenant_id
  AND e.contact_id IS NULL
  AND e.from_email = c.email;

-- Log results of contact backfill
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Backfilled contact_id for % emails', updated_count;
END $$;

-- Step 2: Backfill project_id for emails linked to contacts with active projects
UPDATE emails e
SET project_id = p.id
FROM projects p
WHERE e.contact_id = p.contact_id
  AND e.tenant_id = p.tenant_id
  AND p.status = 'active'
  AND e.project_id IS NULL
  AND e.contact_id IS NOT NULL;

-- Log results of project backfill
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Backfilled project_id for % emails', updated_count;
END $$;

-- Step 3: Log orphaned emails that will be quarantined
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count 
    FROM emails 
    WHERE contact_id IS NULL;
    
    RAISE NOTICE 'Found % orphaned emails without contact_id (will be quarantined)', orphaned_count;
END $$;

-- Step 4: Create quarantine table for orphaned emails (if not exists)
CREATE TABLE IF NOT EXISTS emails_quarantine (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR,
    user_id VARCHAR,
    thread_id VARCHAR,
    provider TEXT,
    provider_message_id TEXT,
    direction TEXT,
    from_email TEXT NOT NULL,
    to_emails TEXT[],
    subject TEXT,
    body_text TEXT,
    sent_at TIMESTAMP,
    quarantined_at TIMESTAMP DEFAULT NOW(),
    quarantine_reason TEXT DEFAULT 'no_contact_match'
);

-- Step 5: Move orphaned emails to quarantine
INSERT INTO emails_quarantine (
    id, tenant_id, user_id, thread_id, provider, provider_message_id,
    direction, from_email, to_emails, subject, body_text, sent_at,
    quarantined_at, quarantine_reason
)
SELECT 
    id, tenant_id, user_id, thread_id, provider, provider_message_id,
    direction, from_email, to_emails, subject, body_text, sent_at,
    NOW(), 'no_contact_match'
FROM emails 
WHERE contact_id IS NULL;

-- Log quarantine operation
DO $$
DECLARE
    quarantined_count INTEGER;
BEGIN
    GET DIAGNOSTICS quarantined_count = ROW_COUNT;
    RAISE NOTICE 'Quarantined % orphaned emails', quarantined_count;
END $$;

-- Step 6: Delete orphaned emails from main table
DELETE FROM emails WHERE contact_id IS NULL;

-- Log deletion
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % orphaned emails from main table', deleted_count;
END $$;

-- Final verification queries
SELECT 
    'FINAL VERIFICATION:' as status,
    (SELECT COUNT(*) FROM emails WHERE contact_id IS NULL) as emails_without_contact,
    (SELECT COUNT(*) FROM emails WHERE project_id IS NOT NULL) as emails_with_project,
    (SELECT COUNT(*) FROM emails_quarantine) as quarantined_emails;