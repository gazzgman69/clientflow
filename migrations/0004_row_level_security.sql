-- Batch I: Postgres Row-Level Security as a defense-in-depth backstop under the
-- application-layer tenant scoping. Audit: TENANT_ISOLATION_AUDIT_2026-06-11.md, item 8.
--
-- ⚠️ DO NOT run this blindly. It changes how the database enforces access and CAN lock
-- the app out of its own data if the runtime is not prepared first. Read the runbook
-- below, run on a staging copy, and verify before production.
--
-- WHY RLS DOES NOTHING TODAY:
--   * RLS is ENABLEd on ~20 tables but has zero policies (default-deny would apply only
--     if a policy existed; with none and RLS enabled, owners still bypass).
--   * The app connects as the TABLE OWNER, and a table owner bypasses RLS unless
--     FORCE ROW LEVEL SECURITY is set. So today RLS is inert.
--
-- PREREQUISITES (do these FIRST, in order):
--   1) The app must set the tenant on every request, inside a transaction:
--        BEGIN; SET LOCAL app.current_tenant_id = '<tenant>'; ...queries...; COMMIT;
--      server/utils/tenantContext.ts already issues `SET LOCAL app.current_tenant_id`,
--      but SET LOCAL only persists within an explicit transaction — wrap each tenant
--      request in one (e.g. db.transaction(...)) or the setting is lost immediately.
--   2) Decide the DB role. Either keep connecting as owner + rely on FORCE (below), or
--      (better) create a non-owner role the app connects as:
--        CREATE ROLE app_rw LOGIN PASSWORD '...';
--        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
--        -- then point DATABASE_URL at app_rw
--   3) Background workers (calendar-auto-sync, job queue, etc.) run without a request
--      tenant. They must set app.current_tenant_id per tenant inside their own
--      transactions, or run as a role that is BYPASSRLS. Audit those before enabling.
--
-- Run on a STAGING database first and confirm the app still works end to end.

BEGIN;

-- Apply a uniform tenant-isolation policy to every table that has a tenant_id column.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
     WHERE c.column_name = 'tenant_id'
       AND c.table_schema = 'public'
       AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t.table_name);
    -- Reads/writes are limited to the current tenant. Rows with a NULL tenant_id (e.g.
    -- global standard quote_extra_info_fields) remain readable by all tenants.
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true))
    $f$, t.table_name);
  END LOOP;
END $$;

-- The `tenants` table itself is the tenant root; do not force-isolate it.
ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenants;

COMMIT;

-- VERIFY (in a fresh session, as the app role):
--   BEGIN;
--   SET LOCAL app.current_tenant_id = '<tenant A>';
--   SELECT count(*) FROM contacts;            -- only tenant A's rows
--   SELECT count(*) FROM contacts WHERE tenant_id = '<tenant B>';  -- expect 0
--   ROLLBACK;
-- And with NO tenant set, a SELECT should return zero rows (current_setting(..., true)
-- returns NULL, so the USING clause matches nothing except NULL-tenant rows).
