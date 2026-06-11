-- Batch C: add tenant isolation to the six quote/admin tables that had no tenant column.
-- Audit: TENANT_ISOLATION_AUDIT_2026-06-11.md, item 3.
--
-- IMPORTANT: run this on the Replit Postgres BEFORE deploying the matching code
-- (server/storage.ts scopes these tables by tenant_id; the column must exist first).
-- Run inside a transaction; it is idempotent on the ADD COLUMN steps.

BEGIN;

-- 1) Add the columns (nullable first so we can backfill existing rows).
ALTER TABLE quote_packages              ADD COLUMN IF NOT EXISTS tenant_id varchar REFERENCES tenants(id);
ALTER TABLE quote_addons                ADD COLUMN IF NOT EXISTS tenant_id varchar REFERENCES tenants(id);
ALTER TABLE quote_signatures            ADD COLUMN IF NOT EXISTS tenant_id varchar REFERENCES tenants(id);
ALTER TABLE quote_extra_info_fields     ADD COLUMN IF NOT EXISTS tenant_id varchar REFERENCES tenants(id);
ALTER TABLE quote_extra_info_config     ADD COLUMN IF NOT EXISTS tenant_id varchar REFERENCES tenants(id);
ALTER TABLE quote_extra_info_responses  ADD COLUMN IF NOT EXISTS tenant_id varchar REFERENCES tenants(id);

-- 2) Backfill the four tables that have a clean parent (quote / user).
UPDATE quote_signatures s
   SET tenant_id = q.tenant_id
  FROM quotes q
 WHERE q.id = s.quote_id AND s.tenant_id IS NULL;

UPDATE quote_extra_info_config c
   SET tenant_id = q.tenant_id
  FROM quotes q
 WHERE q.id = c.quote_id AND c.tenant_id IS NULL;

UPDATE quote_extra_info_responses r
   SET tenant_id = q.tenant_id
  FROM quotes q
 WHERE q.id = r.quote_id AND r.tenant_id IS NULL;

-- Custom extra-info fields belong to their owning user's tenant.
-- Rows with user_id IS NULL are GLOBAL STANDARD fields and intentionally keep tenant_id NULL.
UPDATE quote_extra_info_fields f
   SET tenant_id = u.tenant_id
  FROM users u
 WHERE u.id = f.user_id AND f.user_id IS NOT NULL AND f.tenant_id IS NULL;

-- 3) Backfill quote_packages / quote_addons. These have NO parent link, so there is no
--    automatic way to know which tenant owns the existing global pricing rows.
--    DECISION REQUIRED: if there is exactly one real (non 'default-tenant') tenant we
--    assign to it; otherwise we STOP so a human assigns them deliberately.
DO $$
DECLARE
  owner_tenant varchar;
  tenant_count int;
BEGIN
  SELECT count(*) INTO tenant_count FROM tenants WHERE id <> 'default-tenant';
  IF tenant_count = 1 THEN
    SELECT id INTO owner_tenant FROM tenants WHERE id <> 'default-tenant';
    UPDATE quote_packages SET tenant_id = owner_tenant WHERE tenant_id IS NULL;
    UPDATE quote_addons    SET tenant_id = owner_tenant WHERE tenant_id IS NULL;
    RAISE NOTICE 'quote_packages/quote_addons assigned to sole tenant %', owner_tenant;
  ELSIF (SELECT count(*) FROM quote_packages WHERE tenant_id IS NULL) = 0
    AND (SELECT count(*) FROM quote_addons WHERE tenant_id IS NULL) = 0 THEN
    RAISE NOTICE 'quote_packages/quote_addons already backfilled';
  ELSE
    RAISE EXCEPTION 'Ambiguous owner for quote_packages/quote_addons (% tenants). Assign tenant_id manually, e.g.: UPDATE quote_packages SET tenant_id = ''<TENANT_ID>'' WHERE tenant_id IS NULL; then re-run.', tenant_count;
  END IF;
END $$;

-- 4) Enforce NOT NULL now that rows are backfilled (extra_info_fields stays nullable for
--    the global standard rows).
ALTER TABLE quote_packages              ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE quote_addons                ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE quote_signatures            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE quote_extra_info_config     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE quote_extra_info_responses  ALTER COLUMN tenant_id SET NOT NULL;

-- 5) Helpful indexes.
CREATE INDEX IF NOT EXISTS quote_packages_tenant_id_idx             ON quote_packages(tenant_id);
CREATE INDEX IF NOT EXISTS quote_addons_tenant_id_idx               ON quote_addons(tenant_id);
CREATE INDEX IF NOT EXISTS quote_signatures_tenant_id_idx           ON quote_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS quote_extra_info_fields_tenant_id_idx    ON quote_extra_info_fields(tenant_id);
CREATE INDEX IF NOT EXISTS quote_extra_info_config_tenant_id_idx    ON quote_extra_info_config(tenant_id);
CREATE INDEX IF NOT EXISTS quote_extra_info_responses_tenant_id_idx ON quote_extra_info_responses(tenant_id);

COMMIT;
