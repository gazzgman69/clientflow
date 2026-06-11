# ClientFlow Tenant-Isolation Audit

## Verdict

No. ClientFlow is not safe to put paying multi-tenant customers on yet. The audit confirmed a broad, systemic failure of tenant isolation across the storage layer: dozens of routes either drop the resolved `req.tenantId` before calling storage, call storage methods whose implementations silently ignore the tenant argument their own interface declares, or operate on tables that have no tenant column and no parent-ownership check. The single biggest risk is the SMS and email read endpoints (`GET /api/sms`, `GET /api/emails`), where any authenticated user of any tenant gets the entire cross-tenant table back in one request, plus the calendar-integration sync IDOR that hands an attacker another tenant's decrypted Google OAuth tokens. There is no database-layer safety net: row-level security is `ENABLE`d on ~20 tables but has zero `CREATE POLICY` statements and no `FORCE`, and the app connects as the table owner, so RLS is completely inert. The application layer is the only isolation boundary and it is full of holes.

## Confirmed cross-tenant vulnerabilities

Ranked by severity. Root causes that recur across many sites are grouped.

---

### 1. Bulk cross-tenant data dump: list endpoints return every tenant's rows — CRITICAL

Three list endpoints call a storage method that runs a `SELECT` with no `WHERE` tenant predicate at all. Any authenticated user of any tenant gets the entire table back.

- `GET /api/sms` → `storage.getSmsMessages()` — `server/routes.ts:6134`, impl `server/storage.ts:6796`. Returns every tenant's SMS bodies, phone numbers, Twilio SIDs.
- `GET /api/emails` → `storage.getEmails()` (and `?clientId=` → `getEmailsByClient`) — `server/routes.ts:5879`, impl `server/storage.ts:6091`. Returns every tenant's email subjects, bodies, contact links. The same unscoped `getEmails()` is also called by `GET /api/dashboard/recent-emails` at `server/routes.ts:7564`.
- `GET /api/calendar-sync-logs` → `storage.getCalendarSyncLogs()` — `server/routes.ts:7870`, impl `server/storage.ts:6971`. Returns every tenant's sync history, integration ids, error payloads.

**What an attacker can do:** log in as any tenant, issue one GET with no query params, and exfiltrate the full table across all tenants. This is the highest-impact, lowest-effort breach in the codebase — no id guessing required.

**Fix:** make `getSmsMessages`, `getEmails`, and `getCalendarSyncLogs` require a non-optional `tenantId` parameter and add `eq(table.tenantId, tenantId)` to the `WHERE`. Remove the `tenantId ? ... : noPredicate` optional fallback pattern in `getEmails`/`getEmailsByClient` entirely — an absent tenant should fail closed, not return everything. Update the three routes to pass `req.tenantId`. Then grep the whole storage layer for `db.select().from(` with no tenant predicate and audit each.

---

### 2. Cross-tenant Google OAuth token theft + calendar write via sync IDOR — CRITICAL

`POST /api/calendar-integrations/:id/sync` (`server/routes.ts:7823`/`7827`) calls `storage.getCalendarIntegration(integrationId)` with no `req.tenantId`. The impl (`server/storage.ts:3962`) makes `tenantId` optional and, when omitted, filters by `id` alone — then returns the row with `accessToken`/`refreshToken` **decrypted**. The handler passes that foreign integration into `googleOAuthService.syncToGoogleAll(integration)`, which authenticates to Google with the victim's tokens.

**What an attacker can do:** with a tenant-B integration UUID, POST to the sync endpoint and (a) cause a read/write sync against tenant B's connected Google Calendar using B's credentials, and (b) the handler decrypts B's OAuth tokens server-side. Combined with the calendar-sync-log and iCal leaks (which expose integration ids), the UUID is discoverable. The `iCal export` route at `server/routes.ts:8120` and the duplicate sync handler at `7964` share the same one-arg call.

**Fix:** change `getCalendarIntegration(id, tenantId?)` to require `tenantId` and always AND it into the WHERE. Update every call site to pass `req.tenantId!` (the sibling routes at `7777` and `8057` already do this correctly — copy that pattern). Remove the duplicate/shadowed sync handler at `7961`.

---

### 3. Cross-tenant write/destroy on global "admin" pricing tables (quote_packages, quote_addons) — CRITICAL/HIGH

`quote_packages` and `quote_addons` have **no tenant column at all** and their `/api/admin/...` routes are gated only by `ensureAdminAuth, csrf` — no `tenantResolver`, and the admin check is a global `getUser(userId)` so **any tenant's admin passes**. The storage CRUD methods all drop the `tenantId` the interface declares.

Sites (all `server/routes.ts` route → `server/storage.ts` impl):
- `GET /api/admin/quote-packages` (`4960` → `7294`), `GET /:id` (`4970` → `7300`) — cross-tenant read of pricing tiers.
- `PATCH /api/admin/quote-packages/:id` (`4994` → `7314`), `DELETE /:id` (`5008` → `7322`) — cross-tenant write/soft-delete of another tenant's pricing.
- `quote_addons` full CRUD (`5022`–`5081` → `7331`–`7365`) — read/write/delete every tenant's add-on pricing, plus inject add-ons into the shared pool that surface in every tenant's public quotes (`getQuoteByToken` fans these out at `storage.ts:7442`).

**What an attacker can do:** an admin of any tenant reads competitors' pricing, sets another tenant's `basePrice` to `0.01`, flips `isActive=false` to make their packages vanish, or plants add-ons into everyone's quote builder.

**Fix:** these tables are treated as per-tenant business data by the interface, so they need a `tenantId` column. Add it (backfill from the creating user's tenant), then add `eq(table.tenantId, tenantId)` to every method and mount `tenantResolver, requireTenant` on these admin routes so `req.tenantId` is available to pass through. Until the column exists, the data is structurally un-isolatable.

---

### 4. Storage methods silently ignore the `tenantId` their interface declares (id-only WHERE) — root cause behind ~20 sites, HIGH

This is the dominant pattern. The `IStorage` interface declares a method like `getX(id, tenantId)`, but the live `DrizzleStorage` implementation takes fewer params and filters by `id` (or an FK) alone. Because the project runs transpile-only (tsx/esbuild), the type mismatch never blocks the build, and the route's resolved `req.tenantId` is dropped on the floor. None of these tables have an RLS backstop. Each lets a tenant-A user read or mutate a tenant-B row by supplying its id.

Grouped by table:

**SMS (`sms_messages`)** — `getSmsMessage`/`updateSmsMessage`/`deleteSmsMessage` filter by id only (`storage.ts:6799`, `6810`, `6814`).
- `GET /api/sms/:id/status` (`routes.ts:6304`) — cross-tenant read of body/phones/Twilio SID **and** a status write.
- `PATCH /api/sms/:id` (`routes.ts:6207`) — cross-tenant overwrite of arbitrary fields.
- `POST /api/sms/status/:id` (`routes.ts:6290`) — cross-tenant status/error write.

**Member availability (`member_availability`)** — `getMemberAvailability(memberId)` drops tenant (`storage.ts:6377`). This table is not even in the RLS `ENABLE` list, so zero DB cover.
- `GET /api/members/:id/availability` (`routes.ts:6566`) and `GET /api/portal/musician/availability` (`routes.ts:1400`) — cross-tenant read of a musician's booking calendar, linked projectIds, and notes.

**Project members (`project_members`)** — `removeProjectMember(projectId, memberId)` drops tenant (`storage.ts:6362`).
- `DELETE /api/projects/:projectId/members/:memberId` (`routes.ts:6613`) — cross-tenant delete of a membership row. (Sibling `getProjectMembers`/`updateProjectMember` are correctly scoped — this one is the outlier.)

**Project files (`project_files`)** — `updateProjectFile(id, updates)` falls to id-only WHERE when tenant omitted (`storage.ts:6532`).
- `PATCH /api/files/:id` (`routes.ts:6904`) — flip another tenant's `clientPortalVisible`/`memberPortalVisible`, changing what their portal exposes. (Sibling `deleteProjectFile` passes `req.tenantId!` — copy it.)

**Events (`events`)** — `getEventsByClient`/`getEventsByIntegration`/`getEventsByProject`/`getEventById`/`getEventsByContactEmail` filter by FK only (`storage.ts:6960`–`6968`, `7279`, `7284`).
- `GET /api/events?clientId=<id>` (`routes.ts:7605`) — cross-tenant read of events (titles, locations, fees, attendee emails) for a known contactId. (The `oauth.ts:1909` integration path and `portal-appointments.ts` paths are transitively protected by prior tenant checks, so the `clientId` list is the live hole.)

**Calendar sync logs (`calendar_sync_log`)** — `getCalendarSyncLog(id)`/`updateCalendarSyncLog(id, log)` filter by id only (`storage.ts:6974`, `6985`); `createCalendarSyncLog` doesn't stamp tenant.
- `PATCH /api/calendar-sync-logs/:id` (`routes.ts:7890`) — mutate another tenant's sync-log row. `POST` lets the client control `tenantId` via the body.

**Calendar integrations (`calendar_integrations`)** — `getCalendarIntegration` IDOR (covered in #2); also `updateCalendarIntegration(id, updates)` at `routes.ts:7800` drops tenant. The update happens to no-op today because `eq(tenantId, undefined)` compiles to `tenant_id = NULL` and matches zero rows, but it is a latent write hole that fails open the moment that binding behavior changes (adjusted to MEDIUM for that reason).

**Quote signatures / extra-info fields & responses** — same `/api/admin/...` + global-admin-check pattern as #3, on tables with no working tenant predicate:
- `GET /api/admin/quotes/:id/signatures` (`routes.ts:5167`, `storage.ts:7492`) — cross-tenant read of e-signature PII (signer name, email, IP, user-agent) by quote id.
- `GET`/`PATCH`/`DELETE /api/admin/extra-info-fields/:id` (`routes.ts:5191`/`5225`/`5250`, `storage.ts:7538`/`7573`/`7581`) — read/rewrite/delete another tenant's custom contract-intake field definitions.
- `GET /api/admin/quotes/:id/extra-info-responses` (`routes.ts:5414`, `storage.ts:7627`) — cross-tenant read of client-submitted PII responses.

**Fix (one structural change covers all of them):** Stop calling base `storage.*` directly from routes. Either (a) route every storage call through the existing `TenantScopedStorage` wrapper (`storage.withTenant(req.tenantId)`) so the tenant is injected automatically, or (b) make the `tenantId` parameter non-optional on every interface method and add the `eq(table.tenantId, tenantId)` predicate to every implementation, then fix the call sites that pass too few arguments. For the admin routes specifically, also add `tenantResolver, requireTenant` to the middleware chain and stop relying on a global `getUser` for authorization. A CI step that asserts each `DrizzleStorage` method's arity matches its `IStorage` declaration would catch this entire class going forward.

---

### 5. Child-table operations with no parent-ownership check — HIGH

These tables have no tenant column of their own; their only tenant linkage is a parent FK. The safe pattern (used correctly by sibling routes in the same files) is to first load the parent with a tenant-scoped query and 404 if it doesn't belong to `req.tenantId`. These routes skip that.

**Availability schedule services & rules (`schedule_services`, `availability_rules`)** — all in `server/src/routes/ai-features.ts`, calling unscoped methods in `server/storage.ts`:
- `GET /schedules/:scheduleId/services` (`600`), `POST` (`612`), `DELETE /:serviceId` (`630`) — read/inject/unlink services on another tenant's booking schedule.
- `GET /schedules/:scheduleId/rules` (`646`), `POST` (`658`), `PATCH /rules/:id` (`678`), `DELETE /rules/:id` (`699`) — read/create/update/delete another tenant's availability rules, corrupting their public bookable hours.

The same file's `calendar-checks` and `team-members` routes (lines `719`–`860`) **do** call `getAvailabilitySchedule(scheduleId, tenantId)` first — these rule/service routes are the inconsistent ones.

**Portal forms (`portal_forms`)** — `getProjectForms`/`createProjectForm`/`deleteProjectForm` ignore the tenant arg (`storage.ts:6774`/`6780`/`6789`); routes do no parent check:
- `GET /api/projects/:id/forms` (`routes.ts:7303`) — cross-tenant read of client form submissions (PII).
- `DELETE /api/projects/:projectId/forms/:formId` (`routes.ts:7331`) — delete any tenant's form by id (the `:projectId` segment is never validated against the form).
- `POST /api/projects/:id/forms` (`routes.ts:7313`) — plant a form under another tenant's project/contact, injecting content into their client portal.

**Fix:** in each handler, call the tenant-scoped parent loader (`getAvailabilitySchedule(scheduleId, req.tenantId)` / `getProject(projectId, req.tenantId)`) and return 404 before touching the child table. This is the rubric's canonical child-table pattern and it already exists in the codebase — apply it uniformly.

---

### 6. `deleteLead` destroys child rows before the tenant check — CRITICAL

`DrizzleStorage.deleteLead(id, tenantId)` (`server/storage.ts:4719`) deletes/updates three child tables by `leadId` alone — **before** the final tenant-scoped lead delete, with no surrounding transaction:

```
await this.db.delete(leadConsents).where(eq(leadConsents.leadId, id));
await this.db.update(formSubmissions).set({ leadId: null }).where(eq(formSubmissions.leadId, id));
await this.db.delete(leadStatusHistory).where(eq(leadStatusHistory.leadId, id));
const result = await this.db.delete(leads).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
```

**What an attacker can do:** `DELETE /api/leads/:id` (`routes.ts:950`) with a tenant-B lead id. The final lead delete matches zero rows and returns 404 — but the three child statements have already committed against tenant B's data, silently destroying GDPR consent records, nulling form-submission links, and deleting status history. `lead_consents` and `form_submissions` even carry their own tenantId that is ignored here.

**Fix:** verify ownership first — load the lead with `and(eq(leads.id, id), eq(leads.tenantId, tenantId))` and return false/404 if absent, before any child deletes. Wrap all four statements in a single transaction. Add `eq(tenantId, tenantId)` to the `lead_consents`/`form_submissions` child statements as defense in depth.

---

### 7. Client-controlled `tenantId` on insert — HIGH / MEDIUM

A few write paths trust a client-supplied `tenantId` (or fail to stamp the server one) because `preventCrossTenantAccess` is **not** in their middleware chain — it only ships bundled inside `withTenantSecurity(...)`, which these routes don't use.

- `POST /api/sms` (`routes.ts:6155`) — `insertSmsMessageSchema.parse(req.body)` keeps `tenantId`, and `createSmsMessage` spreads it verbatim. Body `{"tenantId":"<tenant-B>"}` plants an SMS row under tenant B and sends a message attributed to them. (Contrast the adjacent `POST /api/emails` which forces `tenantId: req.tenantId` — copy that.) HIGH.
- `POST /api/members/:id/availability` (`routes.ts:6581`) — passes a client `tenantId` straight into `setMemberAvailability`; cross-tenant availability write. HIGH.
- `POST /api/projects/:id/members` (`routes.ts:6600`) — `addProjectMember` doesn't inject `req.tenantId`; a client `tenantId` in the body is written. The global `orphanPreventionMiddleware` that should block this is dead on this path because Express strips the `/api` mount prefix from `req.path`, so its `startsWith('/api/projects')` check is always false. MEDIUM.

**Fix:** for every insert into a tenant-owned table, build the payload as `schema.parse({ ...req.body, tenantId: req.tenantId })` and have the storage method overwrite `tenantId` from a trusted argument — never trust the body. Fix the `orphanPreventionMiddleware` path check to account for the `/api` mount (use `req.originalUrl` or `req.baseUrl + req.path`), and apply `preventCrossTenantAccess` globally rather than only inside `withTenantSecurity`.

---

### 8. Lower-severity confirmed holes — LOW/MEDIUM

- `createChatMessage` bumps `chat_conversations.lastMessageAt` by `conversationId` only (`storage.ts:9362`); reachable via `POST /api/ai-features/conversations/:conversationId/messages`. Only a foreign timestamp nudge. LOW.
- `GET /api/venues/:id/public` (`routes.ts:424`) — intentionally public, returns any tenant's venue name + address + coordinates by id. Limited non-sensitive projection. LOW.
- `POST /api/invoices/:invoiceId/create-payment-intent` (`routes.ts:4422`) — loads the invoice with an unscoped query, then enforces `invoice.tenantId !== tenantId` in memory. No leak today; defense-in-depth contract violation. LOW.
- `POST /api/sms/webhook` (`routes.ts:6259`) — inbound Twilio message inserted with no `tenantId`, no phone-to-tenant lookup. Orphaned/failing insert, not a cross-tenant read. LOW.
- `POST /api/portal/payments/confirm-payment` (`portal-payments.ts:150`) — updates a payment session + invoice keyed only by a client-supplied Stripe `sessionId`, no contact/tenant ownership check. Bounded because `pi_...` ids are high-entropy and there's no per-tenant Stripe Connect isolation. MEDIUM.
- iCal export `getEvents()` with no tenant (`routes.ts:8129`) — events query returns empty by NULL-binding accident, but the integration lookup at `8120` leaks another tenant's `calendarName`. MEDIUM/LOW.

## The unscoped-tables verdict

This directly answers "are the missing tenant columns actually a problem." A table without a `tenantId` column is only safe if every code path that touches it first verifies the tenant-owned parent.

| Table | Verdict | Why |
|---|---|---|
| `quote_packages` | **VULNERABLE** | No tenant column, no parent FK, admin routes skip `tenantResolver` and use a global admin check — full cross-tenant CRUD. |
| `quote_addons` | **VULNERABLE** | Same as above; also fanned into every tenant's public quote view. |
| `quote_signatures` | **VULNERABLE** | No tenant column; storage filters a non-existent `tenantId` field and the route does no parent-quote ownership check — cross-tenant PII read. |
| `quote_extra_info_fields` | **VULNERABLE** | No tenant column; by-id read/update/delete with no owner check on the admin route. |
| `quote_extra_info_responses` | **VULNERABLE** | No tenant column; admin GET reads client PII by quote id with no parent check. |
| `portal_forms` | **VULNERABLE** | No tenant column; routes query/delete/insert by `projectId`/`id` with no `getProject(id, tenantId)` parent check. |
| `schedule_services` | **VULNERABLE** | No tenant column; ai-features routes read/insert/delete by `scheduleId` with no parent-schedule tenant check. |
| `availability_rules` | **VULNERABLE** | No tenant column; rule routes read/write/delete by `scheduleId`/`id` with no parent check (sibling routes do check — these don't). |
| `lead_status_history` | **VULNERABLE** | No tenant column; reached via `deleteLead`'s unverified `leadId` before the tenant check runs. |
| `payment_sessions` | **SAFE-BY-PARENT** | No tenant column, but every reachable path goes through `ensurePortalAuth` re-loading the contact tenant-scoped — except `confirm-payment` which keys on a high-entropy Stripe id (the one bounded gap, item 8). |
| `quote_packages`/`quote_addons` as referenced by the **public token quote view** | **SAFE-BY-PARENT** (read path) | `getQuoteByToken` is secret-token-gated; the leak there is that the catalog is global, not that the token is bypassable. |
| `quote_extra_info_config` | **SAFE (fails closed)** | No tenant column; the broken `tenantId` predicate produces malformed SQL that throws 500 before any read/write — refuted as exploitable. |
| `email_provider_catalog` and similar reference lookups | **GLOBAL-REFERENCE** | Genuinely global-by-design catalog data; no tenant scoping needed. |

Bottom line: the missing tenant columns are a real problem for 9 tables. They are not a cosmetic schema gap — they are the root cause of items 3 and 5. Four of them (`quote_packages`, `quote_addons`, `quote_signatures`, the extra-info tables) need a `tenantId` column added; the rest (`portal_forms`, `schedule_services`, `availability_rules`, `lead_status_history`) can stay column-less if and only if every route enforces the parent-ownership check uniformly.

## Calendar integration gap

The previously-documented HIGH-RISK calendar gap is **still real, and it is worse than "high" in one spot.** `POST /api/calendar-integrations/:id/sync` calls `getCalendarIntegration(id)` with no tenant argument; the optional-`tenantId` implementation falls back to an id-only lookup and returns the row with **decrypted Google OAuth access/refresh tokens**, which are then used to drive a live sync against the victim tenant's Google Calendar (item 2, CRITICAL). The same one-arg call appears in the duplicate/shadowed sync handler and the iCal export route. The surrounding calendar surface is also compromised: `calendar_sync_log` has full unscoped read/write (items 1 and 4), and `getCalendarIntegration`'s `PATCH` path is a latent write that only no-ops today by NULL-binding accident. The correctly-scoped sibling routes (`GET /api/calendar-integrations/:id` at `routes.ts:7777`, the cleanup route at `8057`) prove the fix is a one-line change — pass `req.tenantId!` — repeated across the sync, iCal, and sync-log handlers, plus making `tenantId` non-optional on `getCalendarIntegration` so the fail-open default disappears.

## Uncertain / needs a human look

None. Every finding was settled to confirmed or refuted; the `uncertain` bucket is empty.

## Cleared (refuted) — for trust

23 suspected issues were investigated and cleared because the codebase already had a real upstream control. Credit where due: `validateTenantSession` correctly re-checks `user.tenantId` on email/auth routes; the Google OAuth callback that matters cryptographically validates the signed `state` and threads the server-derived tenant into a properly-scoped `upsertCalendarIntegration`; `updateEvent`/`deleteEvent` throw on a missing tenant rather than running unscoped; several flagged methods (`updateMemberAvailability`, `deleteMemberAvailability`, `updateProjectNote`, `updateProjectMemberRole`, `storage.deleteTemplate`) turned out to be dead code with no reachable caller; the message-thread paths fail closed via NULL-binding plus `orphanPreventionMiddleware`; and the public quote-config queries fail closed on malformed SQL. The isolation design is sound in patches — the problem is that the safe patterns are applied inconsistently, not that they're absent.

## Recommended fix order

Most bang-for-buck first.

1. **Kill the three bulk-dump list endpoints (item 1).** Make `getSmsMessages`/`getEmails`/`getCalendarSyncLogs` require `tenantId`, add the predicate, remove the optional-fallback in `getEmails`/`getEmailsByClient`. This is the single highest-impact, lowest-effort fix — one request currently exfiltrates whole tables.
2. **Fix the calendar-integration sync IDOR (item 2 / calendar gap).** Make `getCalendarIntegration` require `tenantId`; pass `req.tenantId!` in the sync, duplicate-sync, and iCal handlers; delete the shadowed duplicate route. Stops decrypted OAuth token theft.
3. **Lock down the admin pricing/quote tables (item 3).** Add `tenantId` columns to `quote_packages`/`quote_addons`/`quote_signatures`/extra-info tables, add the predicate to every method, and mount `tenantResolver, requireTenant` on the `/api/admin/...` routes so the global-admin auth stops doubling as cross-tenant access.
4. **Eliminate the id-only-WHERE class wholesale (item 4).** Route all storage calls through `TenantScopedStorage` (`storage.withTenant(req.tenantId)`) or make every `tenantId` parameter non-optional with the predicate enforced. Add a CI/test that asserts each `DrizzleStorage` method's arity matches its `IStorage` declaration so this class never regresses.
5. **Apply the parent-ownership check uniformly (item 5).** Add `getAvailabilitySchedule(id, tenantId)` / `getProject(id, tenantId)` 404-guards to the ai-features schedule routes and the portal-forms routes, matching the sibling routes that already do it.
6. **Fix `deleteLead` (item 6).** Verify lead ownership first, wrap the four statements in a transaction, scope the child deletes.
7. **Stop trusting body `tenantId` on inserts (item 7).** Force `tenantId: req.tenantId` in the parse step everywhere; fix the `orphanPreventionMiddleware` `/api`-prefix path bug; apply `preventCrossTenantAccess` globally.
8. **(Defense in depth, after the above) Make RLS real.** Add `CREATE POLICY` statements keyed on `app.current_tenant_id` for every tenant-owned table, add `FORCE ROW LEVEL SECURITY`, and connect the app as a non-owner role — and wrap `setTenantContext`'s `SET LOCAL` in an explicit per-request transaction so it actually binds. This is the safety net that should have caught all of the above; right now it catches nothing. Do it last, because it must not become an excuse to skip the application-layer fixes.