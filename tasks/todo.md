# ClientFlow Tenant-Isolation Remediation

Source: `TENANT_ISOLATION_AUDIT_2026-06-11.md` (63 confirmed cross-tenant vulns).
Goal: make ClientFlow safe for paying multi-tenant customers. Work batched in the audit's recommended fix order, most bang-for-buck first. Verify each batch (tenant tests + targeted curl) before committing. One commit per batch.

Status legend: [ ] todo  [~] in progress  [x] done + verified

---

## Batch A — Kill the bulk-dump list endpoints (item 1) — CRITICAL, low effort  ✅ DONE
The biggest, cheapest win. Each currently returned every tenant's rows in one request.
- [x] `getSmsMessages()` (DrizzleStorage:6796) — now requires `tenantId`, fails closed, `eq(sms.tenantId, tenantId)`; `GET /api/sms` passes `req.tenantId!`
- [x] `getEmails(tenantId?)` (DrizzleStorage:6091) — `tenantId` now required, optional-fallback removed (throws if absent); `GET /api/emails` + `GET /api/dashboard/recent-emails` updated
- [x] `getEmailsByClient` (DrizzleStorage:6110) + `getEmailsByThread` (already scoped) — call sites now pass `req.tenantId!`
- [x] `getCalendarSyncLogs` (DrizzleStorage:6971) — now requires `tenantId`, optional `integrationId`; `GET /api/calendar-sync-logs` passes both
- Note: the live class is `DrizzleStorage` (line 3789+). `MemStorage` is dead (never instantiated) — flagged for removal.
- [~] Verify: esbuild bundle PASSES. Cross-tenant curl deferred to consolidated post-deploy check.

## Batch B — Calendar-integration sync IDOR + the documented gap (item 2) — CRITICAL  ✅ DONE
- [x] `getCalendarIntegration` (DrizzleStorage:3962) — `tenantId` now required and ANDed into WHERE; fails closed (was the decrypted-token IDOR). The "duplicate" at 3027 was the dead MemStorage copy, not an in-class dup.
- [x] Passed `req.tenantId!` in live sync handler (routes.ts:7827), iCal export (8120), iCal getEvents x3, and ai-features calendar-checks (754)
- [x] Removed the shadowed duplicate sync handler (was routes.ts:7960-8052, 94 lines, dead because the 7823 route registers first)
- [~] Verify: esbuild bundle PASSES. Cross-tenant curl deferred to consolidated post-deploy check.
- Deferred to Batch D: `updateCalendarIntegration` tenant scoping (12+ background-service callers need `integration.tenantId` threaded through).

## Batch C — Admin pricing/quote tables need a tenant column (item 3) — CRITICAL  ⚠ external step
Tables: quote_packages, quote_addons, quote_signatures, quote_extra_info_fields, quote_extra_info_config, quote_extra_info_responses
- [ ] Add `tenantId` column to each in schema.ts
- [ ] Write migration + backfill (derive tenant from creating user / parent quote)  ⚠ must run against live Replit DB
- [ ] Add `eq(table.tenantId, tenantId)` to every method on these tables
- [ ] Mount `tenantResolver, requireTenant` on the `/api/admin/...` routes; stop using global `getUser` as de-facto cross-tenant access
- [ ] Verify: tenant A's admin cannot read/modify tenant B's packages/addons/signatures

## Batch D — Eliminate the id-only-WHERE class wholesale (item 4) — HIGH, the structural one
Decision needed: (a) route storage calls through `storage.withTenant(req.tenantId)` everywhere, or (b) make every `tenantId` param non-optional + add predicate. Leaning (b) for the listed sites + (a) as the default going forward.
- [ ] sms_messages: getSmsMessage/updateSmsMessage/deleteSmsMessage (storage.ts:6799/6810/6814) + routes 6304/6207/6290
- [ ] member_availability: getMemberAvailability (storage.ts:6377) + routes 6566, 1400
- [ ] project_members: removeProjectMember (storage.ts:6362) + route 6613
- [ ] project_files: updateProjectFile (storage.ts:6532) + route 6904
- [ ] events: getEventsByClient/getEventById/etc (storage.ts:6960-6968, 7279, 7284) + route 7605 (`?clientId=`)
- [ ] calendar_sync_log: getCalendarSyncLog/updateCalendarSyncLog (storage.ts:6974/6985) + route 7890
- [ ] Add a test asserting each DrizzleStorage method's arity matches its IStorage declaration (prevents regression of this whole class)
- [ ] Verify: tenant tests green

## Batch E — Apply the parent-ownership check uniformly (item 5) — HIGH
- [ ] ai-features.ts schedule services routes (600/612/630) + rules routes (646/658/678/699): add `getAvailabilitySchedule(scheduleId, req.tenantId)` 404-guard
- [ ] portal_forms routes (routes.ts:7303/7313/7331): add `getProject(id, req.tenantId)` guard
- [ ] Verify: cross-tenant scheduleId/projectId returns 404

## Batch F — deleteLead destroys child rows before the tenant check (item 6) — CRITICAL
- [ ] storage.ts:4719 — verify lead ownership first; wrap all 4 statements in a transaction; scope child deletes by tenant
- [ ] Verify: DELETE of tenant-B lead id from tenant-A session touches nothing

## Batch G — Stop trusting body `tenantId` on inserts (item 7) — HIGH/MEDIUM
- [ ] POST /api/sms (6155), POST /api/members/:id/availability (6581), POST /api/projects/:id/members (6600): force `tenantId: req.tenantId` in parse
- [ ] Fix `orphanPreventionMiddleware` `/api`-prefix path bug (use req.originalUrl/baseUrl)
- [ ] Apply `preventCrossTenantAccess` globally, not only inside withTenantSecurity

## Batch H — Lower-severity confirmed holes (item 8) — LOW/MEDIUM
- [ ] chat lastMessageAt scope (storage.ts:9362); venues `/public` projection (424); invoice create-payment-intent DiD (4422); sms webhook tenant lookup (6259); portal confirm-payment ownership (portal-payments.ts:150); iCal calendarName leak (8120)

## Batch I — Make RLS real (defense in depth) — do LAST  ⚠ external step
- [ ] Add `CREATE POLICY` per tenant-owned table keyed on `app.current_tenant_id`; `FORCE ROW LEVEL SECURITY`
- [ ] Connect app as a non-owner DB role  ⚠ Replit DB role change, staged carefully so it can't lock out the app
- [ ] Wrap `setTenantContext` `SET LOCAL` in an explicit per-request transaction so it actually binds
- [ ] Verify: a deliberately-unscoped query returns zero rows at the DB layer

## Batch J — Re-audit (ultracode verification sweep)
- [ ] Re-run the tenant-isolation audit workflow against the fixed code to confirm closure and catch any missed sibling sites
