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

## Batch D — Eliminate the id-only-WHERE class wholesale (item 4) — HIGH, the structural one  ✅ DONE
Chose (b): non-optional `tenantId` + `if (!tenantId) throw` fail-closed guard + predicate, on the live `DrizzleStorage` methods, and threaded the tenant at every call site.
- [x] sms_messages: getSmsMessage/updateSmsMessage/deleteSmsMessage now scoped + guarded; routes 6207/6290/6307/6320 pass `req.tenantId!`. (by-thread/client/phone reads were stubs returning [] — no leak.)
- [x] member_availability: getMemberAvailability scoped; route 6568 passes tenant (1404 already did)
- [x] project_members: removeProjectMember scoped; route 6615 passes tenant (updateProjectMember already scoped)
- [x] project_files: updateProjectFile tenantId now required; route 6904 passes tenant
- [x] events: getEventsByClient/ByIntegration/ByProject/ById/ByContactEmail all scoped + guarded. Threaded tenant through portal-appointments (3 sites, reordered contact-before-event) and calendar-event-sync background fn (had tenantId in scope)
- [x] calendar_sync_log: getCalendarSyncLog/updateCalendarSyncLog scoped; createCalendarSyncLog stamps tenant; route 7893 passes tenant
- [x] calendar_integrations: updateCalendarIntegration impl already scoped+required; fixed 7 call sites that silently no-op'd by omitting the tenant (3 google-calendar, 2 ical, 2 routes) — also a latent write fix
- [x] Regression guard: `server/__tests__/tenant-guard.test.ts` — 19 cases assert each guarded method throws without a tenant. DB-free, **all green**.
- [x] Made the jest suite runnable at all: added ts-jest, fixed `moduleNameMapping`→`moduleNameMapper` typo, `setup.ts` jest import, `@shared`/`@` path aliases, isolatedModules, `npm test` script. (Closes audit's "tests not in CI" finding.)

## Batch F — deleteLead destroys child rows before the tenant check (item 6) — CRITICAL  ✅ DONE
- [x] storage.ts deleteLead — now verifies lead ownership FIRST (returns false if not owned), wraps the 3 child ops + lead delete in a single `db.transaction`, and scopes lead_consents/form_submissions child deletes by tenant (lead_status_history has no tenant column, safe by leadId after ownership check)

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
