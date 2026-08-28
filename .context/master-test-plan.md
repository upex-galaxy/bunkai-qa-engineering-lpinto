# Master Test Plan — Bunkai TMS

> What to test in this system, and why.
> Regenerated: 2026-08-28 (synced to staging branch, tip `de670c4`, migrations 0001–0075)

---

## 1. Executive Risk Map

Bunkai's API surface has grown to **69 route files / ~89+ handlers** covering a full test lifecycle: ATC authoring, test chains, run execution, native bug triage, coverage reporting, notifications, and async Jira import. The auth model was rebuilt around a **unified Principal** (ADR-0001) where cookie and bearer callers resolve to identical rows, and **scopes are now enforced** via `requires:`. Verification-first signup (BK-166) means unconfirmed accounts can do nothing.

The deepest risk today is **tenant isolation (RLS)** — a single missing policy on any table leaks data across workspaces with zero UI feedback, and the dual-path auth (cookie vs PAT→`mintUserJwt`) must produce identical RLS outcomes on every route. Second is **run execution integrity** — the state machine spans four tables (`runs`, `run_atcs`, `run_steps`, triggers) with cascading recomputation; a trigger failure leaves inconsistent run status. Third is **idempotency correctness** — now functional on runs/tests/atcs/imports, but the 24h `start_token` window vs HTTP key interplay is untested at boundaries. Fourth is **traceability chain filter correctness** (BK-48) — module identity (0069) + client-side filtering must stay synchronized with the chain content. Fifth is **magic-link cross-device** (BK-400) — stateless verification via `verifyOtp` works on any device, but the legacy PKCE flow still coexists.

Since the last generation (v5, migrations 0001–0075), five surfaces shipped and are now testable: **⌘K cross-entity search** (BK-398, 0071), **workspace billing overview** (BK-229, 0072), **test plans** (BK-202, 0073/0074), **bug detail read** with evidence scheme guard (BK-337/466, 0070), and the **abandoned-run sweep** (BK-269, 0075). Two migrations are in the tree but NOT applied — **0067** (run finish/abort `via` + SECURITY DEFINER rewrites) and **0058** (ATC title length CHECK) — so QA must not assume either constraint holds at runtime.

| Priority | Flow | Why it matters | Depends on / Affects | Testable Today? |
|----------|------|----------------|----------------------|-----------------|
| CRITICAL | Tenant isolation — RLS (FEAT-WS-004) | Sole auth mechanism — one missing policy = cross-workspace data leak | All entities gated by workspace_id | ✅ Yes (API) |
| CRITICAL | Dual-path RLS parity (cookie vs PAT) | `mintUserJwt` + RLS AS user must resolve identical rows to session | Every authenticated route, bearer middleware | ✅ Yes (API) |
| CRITICAL | Run execution state machine (FEAT-RUN-001..006) | Cascading triggers recompute run_atcs/run_steps status; trigger failure = inconsistent state | Tests, coverage, activity, notifications | ✅ Yes (API) |
| CRITICAL | Verification-first signup (FEAT-AUTH-006) | Unconfirmed accounts cannot do anything; OTP flow must be airtight | Auth, workspace bootstrap, all downstream | ✅ Yes (API) |
| HIGH | Bug triage lifecycle (FEAT-BUG-001..005) | Forward-only adjacency enforced by DB trigger + RPC double layer; disagreement = silent corruption | Activity, notifications, heatmap | ✅ Yes (API) |
| HIGH | Scope enforcement via `requires:` (FEAT-API-006) | PAT holders must be rejected on insufficient scope; cookie callers hold all caps | All versioned API endpoints | ✅ Yes (API) |
| HIGH | ATC save + edit propagation (FEAT-ATC-001, FEAT-ATC-005) | Atomic RPC bundles header+steps+assertions+AC bindings; propagation to chained tests | Tests, coverage traceability | ✅ Yes (API) |
| HIGH | Coverage roll-up invariant (FEAT-COV-001) | `sum(ac_bound)/sum(ac_total)` — never mean-of-percentages; Home page and API share code | Home dashboard, project metrics | ✅ Yes (API) |
| HIGH | Idempotency correctness (FEAT-API-003) | Runs/tests/atcs/imports have replay store; 24h `start_token` window interplay with HTTP key | Run creation, concurrent agents | ✅ Yes (API) |
| HIGH | Traceability chain filters (BK-48) | Module identity (0069) + client-side filtering must stay synchronized; filter state diverging from chain = stale data | Traceability UI, export, coverage | ✅ Yes (API + UI) |
| HIGH | Magic-link cross-device (BK-400) | Stateless `verifyOtp` works on any device, but legacy PKCE flow still coexists; test both rails | Auth, session management | ✅ Yes (API) |
| MEDIUM | Async Jira import (FEAT-IMPORT-001..002) | One active per project; worker crash leaves `running` forever | Import lifecycle, story/AC data | ✅ Yes (API) |
| MEDIUM | Cross-workspace notifications (FEAT-NOTIF-001..004) | `entity_available` per-row RLS; member must never see notifications for hidden entities | Inbox, read-all races | ✅ Yes (API) |
| MEDIUM | Activity feed integrity (FEAT-ACT-001) | Cursor pagination; `run.aborted.reason` redacted from feed; empty = 200 never 404 | Activity UI, audit trail | ✅ Yes (API) |
| MEDIUM | Abort-reason redaction (FEAT-RUN-003) | `run.aborted.reason` must be dropped from activity feed (0067) | Activity, notifications | ✅ Yes (API) |
| MEDIUM | ⌘K cross-entity search (FEAT-SEARCH-001) | Server-side workspace scope + GIN indexes; any wrong resolution leaks cross-workspace results | Search RPC (0071), cookie/bearer workspace context | ✅ Yes (API) |
| MEDIUM | Test plans (FEAT-PLAN-001) | New planning entity: case-insensitive unique names, open→closed machine, NBSP whitespace (BK-591) | `test_plans` (0073), create/update RPCs | ✅ Yes (API) |
| MEDIUM | Bug detail read + evidence guard (FEAT-BUG-006) | `origin` provenance + archived module + http/https evidence scheme (BK-466) | `bunkai_bug_json` (0070), BugDetailSchema | ✅ Yes (API) |
| MEDIUM | Abandoned-run sweep (FEAT-RUN-007) | pg_cron auto-aborts idle runs; silent, no HTTP route, not yet installed | `bunkai_close_abandoned_runs` (0075), pg_cron | ✅ Yes (SQL) |
| LOW | Workspace billing overview (FEAT-BILLING-001) | Admin-gated read-only; non-disclosure 404-never-403 | `bunkai_workspace_billing_overview` (0072) | ✅ Yes (API) |

---

## 2. What to test first and why

### CRITICAL: Tenant isolation — RLS (FEAT-WS-004)

**Why it matters.** Bunkai uses Supabase Row-Level Security as its **sole** authorization mechanism. Every entity has a `workspace_id` FK (direct or via project). A single missing RLS policy on any table — or a SECURITY DEFINER helper regression — exposes all data across workspaces. This is a **silent security failure** — no UI error, no log, no alert.

**What commonly breaks.** New PostgREST endpoints added without RLS (easy to miss when tables are auto-exposed), SECURITY DEFINER helper functions with infinite recursion or wrong `current_workspace_id()` resolution, bulk PATCH operations that skip policy checks, SELECT with crafted IDs that bypass the workspace filter.

**Dependencies.** All entities, every table with workspace_id FK.

**What an experienced QA would check:**
- Create entity in workspace A, attempt to READ/LIST/UPDATE/DELETE from workspace B — expect 403 or empty list for EVERY entity type
- Attempt to reference workspace A's project ID when creating a resource authenticated as workspace B — expect 403
- Test PAT tokens: a token issued in workspace A must not list workspace B's resources
- Verify RLS security definer helpers (`current_workspace_id()`) do not return wrong workspace_id on session switch
- Test `?include_archived` flag does not bypass RLS

### CRITICAL: Dual-path RLS parity (cookie vs PAT)

**Why it matters.** The unified Principal (ADR-0001) collapses cookie and bearer callers into one identity via `resolveIdentity()`. For bearer callers, `mintUserJwt` creates a per-request JWT and runs the DB client AS the user under normal RLS. If `mintUserJwt` produces a JWT with wrong claims, or the RLS-scoped client doesn't match the session path, every bearer call leaks or over-restricts data.

**What commonly breaks.** JWT claims missing `workspace_id`, PAT JWT expiry not matching token expiry, RLS client using service role instead of user-scoped, workspace context not propagated to the DB client.

**Dependencies.** `principal.ts`, `bearer.ts`, `assertWorkspaceContext` (ADR-0006), every versioned API route.

**What an experienced QA would check:**
- Create entity as cookie session → read same entity as PAT bearer → expect identical result
- Create PAT scoped to workspace A → call workspace B endpoint → expect 403
- Verify `assertWorkspaceContext` blocks bearer callers from cross-workspace admin ops
- Test that cookie callers hold ALL capabilities while PATs hold declared subset
- Verify `workspace:admin` scope on PAT is rejected at runtime (ADR-0005)

### CRITICAL: Run execution state machine (FEAT-RUN-001..006)

**Why it matters.** The run lifecycle spans `runs`, `run_atcs`, `run_steps` with cascading triggers that recompute status at each grain. A trigger failure leaves `run_atcs.status` stale while `runs.status` advances, producing reports that disagree with execution reality. The `via` parameter (0067) records executor mode (manual/agent/ci) on terminal transitions.

**What commonly breaks.** Trigger cascade failure on step mark, finish accepting invalid verdicts, abort reason leaking into activity feed, `start_token` 24h window not enforced, concurrent step marks from agent + human.

**Dependencies.** `tests`, `test_steps`, `project_environments`, all run RPCs, activity_log triggers, notification triggers.

**What an experienced QA would check:**
- Pass all steps → run_atcs.status = passed, runs.status = passed
- Fail one step → run_atcs.status = failed, runs.status = failed
- Abort mid-run → remaining steps = skipped, abort reason never in activity feed
- Finish with a pending step → 422
- Concurrent step results from agent + human → no inconsistent state
- POST /runs with same Idempotency-Key → idempotent replay (200), not duplicate
- Start run with expired `start_token` (>24h) → new run created

### CRITICAL: Verification-first signup (FEAT-AUTH-006)

**Why it matters.** Since BK-166, signup returns **202 `pending_confirmation`** — no session, no PAT. Only email confirmation (OTP 6–8 digits) mints session + PAT atomically. An unconfirmed account can do nothing. The `min(8)` password at signup vs `min(6)` legacy at signin is an asymmetric contract.

**What commonly breaks.** Duplicate email leaking account existence (must return 409 without echo), wrong OTP returning distinguishable errors (must be uniform 401), OTP expiry races, resend/confirm asymmetry, rate limiting (429 mapping).

**Dependencies.** Supabase GoTrue, `access_tokens`, `access_token_secrets`, all downstream auth.

**What an experienced QA would check:**
- Signup → 202 `pending_confirmation` (NO session, NO PAT)
- Confirm with correct OTP → 200 with session + PAT atomically
- Confirm with wrong OTP → uniform 401 (no "no such pending signup" vs "wrong code" distinction)
- Duplicate email → 409 without echoing account existence
- Resend OTP → new OTP generated, old OTP invalidated
- Password rules: signup enforces `min(8)`, signin keeps `min(6)` legacy

### HIGH: Bug triage lifecycle (FEAT-BUG-001..005)

**Why it matters.** Bugs are native defect records anchored to module + ATC + run. The lifecycle is **forward-only** (`open → in_progress → resolved → closed`), enforced twice: DB trigger (`bunkai_bugs_check_consistency`) + RPC. Skip or backward transitions are rejected (45310/45311). Assignee eligibility is checked (workspace member, not viewer — 45312/45313).

**What commonly breaks.** Trigger/RPC double layer disagreeing on a transition, assignment to a viewer silently accepted, heatmap totals diverging from `bugs` rows, bug provenance (module + ATC + run) derived incorrectly from `run_step_id`.

**Dependencies.** `run_steps`, `modules`, `workspace_members`, activity_log, notifications.

**What an experienced QA would check:**
- File bug with `run_step_id` → verify module/ATC/run derived server-side
- Attempt skip transition (open → resolved) → 45310
- Attempt backward transition (resolved → in_progress) → 45311
- Assign to viewer → 45313
- Assign to non-member → 45312
- Heatmap totals match `bugs` row count per module

### HIGH: Scope enforcement via `requires:` (FEAT-API-006)

**Why it matters.** PAT holders are gated by scopes fixed at mint: `atc:read`, `atc:write`, `run:execute`, `workspace:admin` (rejected at runtime, ADR-0005). `withApiHandler({ requires: [...] })` enforces scope before handlers run. Cookie callers hold ALL capabilities. A misdecorated route (`requires` missing) = silent privilege hole.

**What commonly breaks.** Route missing `requires:` annotation, scope vocabulary mismatch between mint and enforcement, `workspace:admin` accepted at mint but rejected at runtime without clear error.

**Dependencies.** `withApiHandler`, `requireCapability()`, `bearer.ts`, every decorated route.

**What an experienced QA would check:**
- PAT with `atc:read` scope → call `atc:write` endpoint → 403
- PAT with no scopes → call any `requires:` endpoint → 403
- Cookie session → call any endpoint → succeeds (all capabilities)
- PAT with `workspace:admin` → rejected at runtime (ADR-0005)
- Verify every versioned route has correct `requires:` annotation

### HIGH: ATC save + edit propagation (FEAT-ATC-001, FEAT-ATC-005)

**Why it matters.** The `bunkai_create_atc` / `bunkai_update_atc` RPCs are atomic writes that bundle header + steps + assertions + AC bindings. Version bump + full-replace + activity event happen in one transaction. `X-If-Match: <version>` provides optimistic locking (409 on conflict). Edit propagation computes `affected_test_ids` in the same transaction (0035).

**What commonly breaks.** Race condition on concurrent saves (version collision), AC bindings lost on re-save (full-replace semantics), propagation `affected_test_ids` empty when it shouldn't be, steps/assertions parsing mismatch on round-trip.

**Dependencies.** `atc_acceptance_criteria` join table, `test_steps` (propagation targets), activity_log.

**What an experienced QA would check:**
- Create ATC with 5 steps, 3 assertions, 2 AC anchors → verify all persisted
- Edit title → verify version bumped
- Concurrent save from two tabs → second fails with version conflict (409)
- Edit ATC → verify `affected_test_ids` in activity event matches chained tests
- Remove all AC anchors → save → verify rejected (orphan ATC)

### HIGH: Coverage roll-up invariant (FEAT-COV-001)

**Why it matters.** Coverage is `sum(ac_bound)/sum(ac_total)` — **never** a mean of per-project percentages. Home page and API route share `lib/home/coverage.ts`, so both must return identical numbers. The workspace roll-up uses the same RPCs as per-project.

**What commonly breaks.** Home page computing mean-of-percentages while API computes sum/sum, workspace roll-up disagreeing with sum of project totals, stale coverage after ATC repoint.

**Dependencies.** `acceptance_criteria`, `atc_acceptance_criteria`, `test_steps`, `runs`, `run_steps`.

**What an experienced QA would check:**
- `GET /projects/{id}/coverage` matches Home page coverage chip
- `GET /workspaces/{id}/coverage` = sum of project coverages (not mean of percentages)
- Edit AC anchoring → coverage recalculates on next read
- Project with zero ATCs → coverage = 0 (not NaN or error)

### HIGH: Idempotency correctness (FEAT-API-003)

**Why it matters.** Runs, tests, atcs, and imports have functional replay stores. HTTP `Idempotency-Key` header is required on `POST /runs`, `POST /tests`, `POST /atcs`. The 24h `start_token` window on runs provides domain-level idempotency distinct from the HTTP key.

**What commonly breaks.** Same key with different body → should return stored result (not re-execute), key expiry at 24h boundary, concurrent requests with same key (race), replay store not cleaned up.

**Dependencies.** `idempotency_keys` table, all create endpoints.

**What an experienced QA would check:**
- POST /runs with key → 201; same key → 200 (stored result); same key + different body → 409
- POST /runs with `start_token` → 201; same token within 24h → idempotent replay; same token after 24h → new run
- Concurrent POST /runs with same key → exactly one succeeds, others get stored result
- POST /tests, /atcs, /imports with key → same idempotent behavior

### HIGH: Traceability chain filters (BK-48)

**Why it matters.** The traceability chain now carries module identity (`module: {id, name}`) per ATC row (0069 migration). Client-side filter functions (`atcMatchesFilters`, `distinctModules`, `isFilteringActive`) enable filtering by verdict/module/date-range. `StoryChainViewState` distinguishes zero-ac vs zero-coverage empty states. If filter state diverges from chain content, users see stale or incorrect data.

**What commonly breaks.** Module identity missing or stale after ATC edit, filter state not resetting on story change, date-range inversion not caught, distinctModules returning archived modules, zero-ac vs zero-coverage empty states collapsing into one message.

**Dependencies.** `TraceabilityModule` interface (0069), `TraceabilityFilterState`, `StoryChainViewState`, `atcMatchesFilters`, `distinctModules`.

**What an experienced QA would check:**
- Load traceability chain → verify each ATC has `module: {id, name}`
- Edit ATC module → chain reflects new module identity on next load
- Filter by module → only ATCs from that module shown
- Filter by verdict → only ATCs with matching run status shown
- Filter by date-range → only ATCs with runs in that range shown
- Invert date-range (from > to) → expect validation error or auto-correction
- Story with zero ACs → expect "zero-ac" empty state (not "zero-coverage")
- Story with ACs but zero ATCs → expect "zero-coverage" empty state
- Archived module → not in distinctModules list

### HIGH: Magic-link cross-device (BK-400)

**Why it matters.** Magic-link authentication now uses stateless `verifyOtp` instead of PKCE `exchangeCodeForSession`, so emailed links work on any device. The legacy PKCE flow still coexists for links already in flight. Both rails must be tested, and login error toasts (`lib/auth/login-errors.ts`) must render correctly.

**What commonly breaks.** PKCE link opened on different device → fails silently (old behavior), token_hash verification fails with wrong error code, expired link shows wrong toast message, OAuth error codes leaking into magic-link rail.

**Dependencies.** `app/auth/callback/route.ts`, `lib/auth/login-errors.ts`, Supabase GoTrue OTP, `VERIFIABLE_OTP_TYPES` allow-list.

**What an experienced QA would check:**
- Request magic link on desktop → open on phone → session created (cross-device works)
- Request magic link → click expired link → toast "That sign-in link no longer works"
- Request magic link → click already-used link → same toast (indistinguishable from expired)
- OAuth consent denied → toast shows "oauth_denied" (not magic-link error)
- Magic link with invalid token_hash → toast "magic_link_invalid"
- Magic link with missing code → toast "missing_code"
- Verify `VERIFIABLE_OTP_TYPES` only allows `magiclink` and `email` (not `signup`, `invite`, `recovery`)

### MEDIUM: ⌘K cross-entity search (FEAT-SEARCH-001)

**Why it matters.** The ⌘K palette searches across six entity types (ATCs, tests, projects, modules, bugs, runs) via GIN expression indexes. Workspace scope is resolved server-side — never from a path segment — so a wrong resolution leaks cross-workspace results, and the non-disclosure convention demands every failure path collapse into the same `200 {data:[], truncated:false}`.

**What commonly breaks.** Query normalization off (leading/trailing whitespace), the `q` min-2-char backstop regressing, the 5-per-group cap or total `limit` exceeding bounds, GIN indexes going stale after title edits, a foreign workspace leaking results instead of the empty 200.

**Dependencies.** `bunkai_search_workspace` RPC (0071), GIN expression indexes, cookie `ACTIVE_WORKSPACE_COOKIE` / Bearer `principal.workspaceId`.

**What an experienced QA would check:**
- Search as workspace A member → never returns workspace B entities
- `q` shorter than 2 chars after trim → rejected (defensive backstop)
- `limit` outside 1..20 → rejected; default 20 applied
- Foreign/missing workspace → 200 empty, never 403/404
- Edit an ATC title → search reflects the new title (GIN index refreshed)
- Verify which entity types are actually indexed — the maps disagree (see §10)

### LOW: Workspace billing overview (FEAT-BILLING-001)

**Why it matters.** A read-only, admin-gated endpoint returning plan / seats / project count / oldest run age. The gate is a SECURITY DEFINER helper (`bunkai_is_workspace_admin`), and non-disclosure means a non-admin or foreign workspace collapses to 404 — never 403 — because revealing "billing exists but you can't see it" leaks workspace existence.

**What commonly breaks.** Non-admin resolving 200, a foreign workspace returning 403 instead of 404, tier-ladder math (community/cloud/enterprise seat and project caps) drifting from `lib/billing/plan-tiers.ts`.

**Dependencies.** `bunkai_workspace_billing_overview` RPC (0072), `bunkai_is_workspace_admin`, `lib/billing/plan-tiers.ts`.

**What an experienced QA would check:**
- Owner/admin → 200 with plan + seat/project counts
- Viewer/member (non-admin) → 404 (not 403)
- Foreign workspace → 404
- Tier boundaries (community 5 seats / 3 projects; cloud 25 / 50) enforced at the edge

### MEDIUM: Test plans (FEAT-PLAN-001)

**Why it matters.** New planning entity with an `open → closed` status machine (close is the sole exit — no DELETE) and case-insensitive unique names per project. The NBSP whitespace bug (BK-591, 0074) means normalization that collapses ASCII whitespace but preserves U+00A0 has subtle round-trip behavior.

**What commonly breaks.** Duplicate name differing only by case/whitespace, NBSP collapsing when it shouldn't, the member+ gate leaking to viewers on create/update, a SECURITY DEFINER RPC reading the wrong `auth.uid()` (the route must use `getAuth(ctx).db`, never `createAdminClient()`).

**Dependencies.** `test_plans` table (0073), `bunkai_create_test_plan` / `bunkai_update_test_plan` RPCs, `lib/test-plans/validation.ts`.

**What an experienced QA would check:**
- Create plan with a valid name → 201; empty or over-limit → rejected (45600)
- Two plans with the same name (case/whitespace variants) → 23505 unique violation
- Viewer can list but cannot create/update (member+ gate)
- NBSP in name is preserved; ASCII whitespace is collapsed
- No DELETE — close (BK-207) is the only exit; PATCH on a closed plan → 45603 (once shipped)

### MEDIUM: Bug detail read + evidence scheme guard (FEAT-BUG-006)

**Why it matters.** `GET /bugs/{id}` now returns the full composed record including `origin` provenance (run_id, step position, ATC title/layer) and `module.archived_at`. It runs SECURITY INVOKER under RLS, so a hidden or foreign bug collapses to a non-disclosing 404. Evidence links are scheme-guarded to http/https (BK-466).

**What commonly breaks.** An archived-module bug rendering with `archived_at` but no tag (PO ruling: tag, never 404), a standalone bug returning a malformed `origin` instead of a clean null, an evidence URL with a `javascript:`/`data:` scheme slipping through, provenance leaking another workspace's run.

**Dependencies.** `bunkai_bug_json` (0070), `BugDetailSchema`, `isHttpUrl` render guard.

**What an experienced QA would check:**
- Bug from a run step → origin carries run_id + 0-based step position + ATC title/layer
- Standalone bug → origin is null (clean, not partial)
- Archived module → detail renders with `module.archived_at` set, never 404
- Foreign/missing bug → generic 404 (non-disclosing)
- Evidence URL with a non-http scheme → rejected at filing and render

### MEDIUM: Abandoned-run sweep (FEAT-RUN-007)

**Why it matters.** A pg_cron job sweeps idle `running` runs into `aborted` (reason `abandoned`, `via: 'sweep'`). It has no HTTP route and no UI feedback — a silent killer that keeps run state from rotting forever. pg_cron is available but not yet installed on the live instance, so the sweep is inert until installed.

**What commonly breaks.** The sweep missing a run (idle threshold off), double-sweeping an already-finished run (must be idempotent), `via: 'sweep'` surfacing in the activity feed (should be redacted like a manual abort), notification spam on a bulk sweep.

**Dependencies.** `bunkai_close_abandoned_runs` (0075), the pg_cron scheduler, `bunkai_notify_run_event`.

**What an experienced QA would check:**
- Idle run past threshold → aborted with reason `abandoned`
- Already-finished run → skipped (idempotent)
- Swept run emits `run.aborted` (notifications via the same trigger as a manual abort)
- Abort reason never leaks into the activity feed
- Confirm the sweep threshold (15 vs 30 min — maps disagree, see §10) against the actual function

---

## 3. State machines that matter

### Run status — three grains

**Why transitions matter.** Three distinct run-status enumerations coexist at three different grains (BK-317). Mixing them produces incorrect reports.

| Grain | States | Transitions | Terminal |
|-------|--------|-------------|----------|
| Run grain (`runs.status`) | running → passed / failed / aborted | finish (verdict), abort (reason ≤500ch) | passed/failed/aborted |
| Position grain (`run_atcs.status`) | pending → passed / failed / blocked / skipped | aggregated from child run_steps marks | passed/failed/blocked/skipped |
| Step grain (`run_steps.status`) | pending → passed / failed / blocked / skipped | single mark per step | passed/failed/blocked/skipped |

**Invariant:** `aborted` is run-grain ONLY; a step is `skipped`, never `aborted`.

**Transitions most likely to be broken.** Trigger cascade failure on step mark (position grain doesn't recompute), finish accepting `via` values that break activity feed redaction, abort reason surfacing in activity feed (BK-49).

### Bug lifecycle — forward-only

**Why transitions matter.** `open → in_progress → resolved → closed` is enforced by DB trigger + RPC. Skip or backward = 45310/45311. Assignee eligibility (member role ≥ member) enforced by 45312/45313.

**Transitions most likely to be broken.** Direct SQL bypassing the trigger, assignee change without status transition, heatmap computed from stale bug states.

### Workspace invites — TTL-gated

**Why transitions matter.** `pending → accepted / revoked / expired` with 24h TTL. Expired invite acceptance = security gap. Rotate (+7d) clears prior acceptance.

**Transitions most likely to be broken.** Expiry not enforced at API level (only DB check), revoked invite still actionable, email mismatch at redemption.

### Import jobs — async lifecycle

**Why transitions matter.** `pending → running → succeeded / failed` with one active per project. Worker crash leaves `running` forever.

**Transitions most likely to be broken.** Worker crash → stuck `running`, concurrent import attempt → 409 (must be serialized), partial import data on failure.

### Test plans — open/closed

**Why transitions matter.** `open → closed` is forward-only and close is the sole exit (no DELETE — BK-207 not yet shipped). Closing a plan before its tests execute orphans its run linkage, and the case-insensitive unique name must hold across both statuses.

**Transitions most likely to be broken.** Reopening a closed plan, PATCH on a closed plan (45603 — unreachable until BK-207 ships), name uniqueness breaking across open/closed plans.

---

## 4. Silent killers — automated processes

| Process | What it does | What breaks if it fails | Detection | QA strategy | Status |
|---------|-------------|------------------------|-----------|-------------|--------|
| `run_atcs.status` recomputation | CASE WHEN trigger on run_steps marks | Run position status stale | No alert — reports disagree with execution | Mark step → verify run_atcs.status updates atomically | ✅ Active |
| `bunkai_bugs_check_consistency` | Table trigger on bugs INSERT/UPDATE | Invalid transitions accepted | SQLSTATE 45310/45311 on violation | Direct SQL attempt invalid transition | ✅ Active |
| `atc.updated` event + `affected_test_ids` | Inside `bunkai_update_atc` transaction (0035) | Activity log missing propagation | Event payload has empty `affected_test_ids` | Edit ATC chained in 2+ tests, verify event | ✅ Active |
| `bunkai_notify_bug_event` | Bug assign/status RPCs → notifications rows | Members not notified of bug changes | No notification in inbox | Assign bug → verify notification created | ✅ Active |
| `bunkai_notify_run_event` | Run finish/abort → notifications rows | Members not notified of run outcomes | No notification in inbox | Finish run → verify notification created | ✅ Active |
| `activity_log` sink | SECURITY DEFINER RPCs write activity rows | Activity feed empty or stale | Feed shows no recent events | Perform actions → verify activity feed updated | ✅ Active |
| `atcs.tsv` refresh | tsvector on title/tag change (0004) | ATC search returns stale/no results | User says "can't find ATC" | Search after ATC create/update | ✅ Active |
| Run realtime replication (0043) | Run row changes → broadcast | Live views stale | Browser shows old run status | Two-session test: start run → verify realtime | ✅ Active |
| Run timeout/24h `start_token` | RPC level | Abandoned runs abortable window | Runs stuck `running` | Wait >24h → verify new run can be started | ✅ Active |
| `import_jobs` worker | `after()` on POST /imports | Import stuck `running` forever | Poll shows `running` indefinitely | POST import → poll until succeeded/failed | ✅ Active |
| Idempotency cleanup | TTL-based cleanup of expired keys | Expired keys block legitimate retries | Agent sees stored result instead of fresh | Wait for key expiry → verify fresh execution | ✅ Active |
| `bunkai_close_abandoned_runs` | pg_cron every 5 min closes idle `running` Runs as `aborted` | Runs rot in `running` forever; reports count them active | None today — pg_cron not yet installed on live | Direct SQL call with mock data | ⚠️ Inert (pg_cron not installed) |

---

## 5. External integrations — failure points

### Supabase (Postgres + Auth + Realtime) — ACTIVE

| Aspect | Impact | Notes |
|--------|--------|-------|
| RLS policy gap | Data leak across workspaces | Single missing policy = all data exposed — test every entity with workspace_id |
| Auth session expiry | User kicked mid-workflow | Session must refresh silently via Supabase's auto-refresh |
| PostgREST auto-endpoints | Read/write bypasses versioned API | Tables auto-exposed — RLS is the only guard on most entities |
| GoTrue OTP delivery | Signup/confirm blocked | Rate limits (429), email provider down |
| Realtime broadcast | Live run views stale | Channel auth misconfigured → no broadcast |

### Jira Cloud — ACTIVE (one-way import)

| Aspect | Impact | Notes |
|--------|--------|-------|
| Worker crash → import stuck `running` | Poll shows `running` forever | No retry/backoff evidence in `import-runner` |
| Concurrent import 409 | Only guard against duplicate imports | One active per project (DB constraint 0020) |
| Jira API rate limits | Partial import | Worker pages Jira API — rate limit = incomplete data |

### Resend — CONFIGURED ONLY

| Aspect | Impact | Notes |
|--------|--------|-------|
| No SDK in package.json | Magic-link delivery uses Supabase GoTrue default | Cannot customize or test transactional email flow |

### Supabase pg_cron — AVAILABLE, NOT INSTALLED

| Aspect | Impact | Notes |
|--------|--------|-------|
| Abandoned-run sweep inert | Idle runs never auto-abort | `bunkai_close_abandoned_runs` (0075) is defined but pg_cron is not installed on the live instance — the sweep is dormant until the scheduler is installed |

---

## 6. Dependency cascade between flows

```
Sign-up / Auth (verification-first)
    │
    ▼
Workspace creation ──► Project ──► Module tree
    │                                    │
    │                                    ▼
    │                           User Story + ACs
    │                                    │
    │                                    ▼
    │                             ATC creation
    │                                    │
    │                       ┌────────────┴────────────┐
    │                       ▼                         ▼
    │              Test (ATC chain)            Jira import (async)
    │                       │
    │                       ▼
    │              Run execution ──► Bug filing
    │                       │              │
    │                       ▼              ▼
    │              Coverage / Traceability  Activity + Notifications
    │
    ▼
Home dashboard (aggregates all above)
```

**Critical chains to verify end-to-end:**
- `Signup → Workspace → Project → Module → US → AC → ATC → Test → Run → Bug` — the complete lifecycle. If it breaks at any link, the downstream entity cannot be created.
- `ATC edit → Propagate to Test A and Test B` — edit propagation must update all chained tests atomically.
- `Run step mark → trigger recomputes run_atcs → finish → activity + notification` — cascade must be atomic.
- `Workspace A ↔ Workspace B isolation` — RLS is the only auth mechanism on most tables. Test every entity.

---

## 7. Edge cases developers commonly forget

### Concurrency
- Two users saving the same ATC simultaneously — version collision must produce 409, not silent overwrite
- Two agents starting runs with the same Idempotency-Key — must be idempotent
- Revoke PAT while a request is in-flight using that token — must check `revoked_at` on every request
- Concurrent step marks on the same run — trigger must handle race

### Data limits
- Module depth >6 → rejected (FEAT-PROJ-002)
- ATC title min length (0058) — verify enforcement
- ATC tags cap guard (0065) — verify enforcement
- Abort reason ≤500 chars — verify truncation or rejection
- Workspace slug 3–40 chars, lowercase/digits/hyphens only (FEAT-WS-001)
- PAT TTL up to 365 days — verify expiry enforcement

### Timezone / DST
- Invite token TTL (24h) crossing DST boundary — must use UTC internally
- `start_token` 24h window — must use UTC
- Activity log timestamps — must store UTC

### Permission boundaries (FEAT-WS-002)
- Workspace member cannot delete workspace (owner only)
- Workspace member cannot invite new members (admin+ only)
- Viewer role can read but not create/edit/delete anything
- PAT tokens inherit the role of the issuing user at creation time — role changes after issuance must NOT affect existing tokens (BK-135 regression)
- Bearer middleware `requires:` must reject insufficient-scope tokens
- `workspace:admin` scope accepted at mint but rejected at runtime (ADR-0005)

### Orphaned states
- Delete a user — what happens to their ATCs? Orphaned ownership.
- Archive a module — children must also archive (soft-delete cascade confirmed in data-map)
- Delete a project — all modules, US, AC, ATC under that project cascade?
- Delete an ATC referenced by 2+ tests — propagation must handle gracefully
- Bug with deleted run_step_id — provenance links nullable, but UI must handle

### ATC save edge cases
- Empty steps array — should save with zero steps
- Empty assertions array — should save with zero assertions
- Same AC anchored twice — should deduplicate or reject
- ATC title with special characters — must not break Monaco editor
- Steps markdown with code blocks — must survive round-trip parse/serialize

### Auth edge cases
- Session cookie expired mid-session — Supabase auto-refresh must work silently
- PAT with `bk_pat_` prefix but malformed hash — expect 401, not 500
- Token from another workspace's scope — expect 403 on cross-workspace read
- Signup with existing email → 409 without echoing account existence
- Wrong OTP → uniform 401 (no distinguishable error messages)

### New-surface edge cases (search / billing / plans / sweep / bug-detail)
- Search `q` trimmed below 2 chars → rejected; `limit` outside 1..20 → rejected
- Test-plan name 1–100 chars, description ≤500, goal ≤100, case-insensitive unique (verify against the map — see §10)
- Billing tier boundaries: community 5 seats / 3 projects, cloud 25 / 50
- Two concurrent test-plan creates with the same name → 23505 (one wins)
- Sweep racing a manual abort on the same run → idempotent, no double terminal
- Billing endpoint: non-admin or foreign workspace → 404 (never 403)
- Test-plan create/update: member+ only; viewer read-only
- Evidence URL with a `javascript:`/`data:` scheme → rejected (BK-466)

---

## 8. Pre-release checklist (priority-ordered)

### CRITICAL
1. Verify RLS on every entity with workspace_id: create in workspace A, read/update/delete from workspace B → 403 or empty result
2. Verify dual-path RLS parity: create entity as cookie session → read as PAT bearer → identical result
3. Run the complete lifecycle: signup → confirm → workspace → project → module → US → AC → ATC → test → run → bug
4. Verify run state machine: pass all → passed; fail one → failed; abort → skipped; finish with pending → 422
5. Verify verification-first signup: 202 pending_confirmation → confirm OTP → session + PAT atomically

### HIGH
6. Verify bug triage lifecycle: forward-only transitions (45310/45311), assignee eligibility (45312/45313)
7. Verify scope enforcement: PAT with `atc:read` → call `atc:write` → 403
8. Verify ATC save: create with steps+assertions+AC anchors → edit → verify version bump + propagation
9. Verify coverage invariant: Home page coverage chip = `GET /projects/{id}/coverage` = `GET /workspaces/{id}/coverage`
10. Verify idempotency: POST /runs with key → 201; same key → 200; same key + different body → 409

### MEDIUM
11. Verify async import: POST /imports → 202 → poll until succeeded/failed; concurrent → 409
12. Verify notifications: assign bug → notification created; finish run → notification created
13. Verify activity feed: cursor pagination, empty = 200 never 404, abort reason redacted
14. Verify cross-workspace notifications: member never sees notifications for hidden entities
15. Verify module tree: depth 6 → success; depth 7 → rejected; archive cascade

### NEW SHIPPED (BK-398 / 229 / 202 / 337 / 269)
16. Verify ⌘K search: workspace A never sees workspace B; foreign workspace → 200 empty
17. Verify test plans: case-insensitive unique name, NBSP preserved, member+ gate, no DELETE
18. Verify bug detail read: origin provenance, archived-module tag-not-404, evidence http/https guard
19. Verify billing: admin 200, non-admin/foreign 404 (never 403)
20. Verify abandoned-run sweep: idle run → aborted `abandoned`, idempotent, reason redacted

---

## 9. What is NOT in this plan

- Flow-level diagrams and state-machine transition tables → `.context/business/business-data-map.md`
- Feature catalog, CRUD matrix, feature flags → `.context/business/business-feature-map.md`
- API endpoint inventory / contracts → `business-api-map.md` + `bun run api:sync`
- Detailed test case definitions and traceability → TMS (see `/test-documentation`)
- Sprint-level execution order → `.context/reports/SPRINT-{N}-TESTING.md` (see `/sprint-testing`)
- MVP out-of-scope features → `.context/PRD/executive-summary.md`

---

## 10. Discovery gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Dual-path RLS parity untested | HIGH | Every route resolving cookie vs Bearer to the same rows needs a consent QA suite; PAT impersonation is the top auth risk |
| `workspace:admin` scope accepted-but-rejected | HIGH | ADR-0005: minted PATs may carry `workspace:admin`, but `requires:` rejects it at runtime — verify consistency |
| Coverage roll-up invariant unverified | HIGH | `sum/sum` shared Home/API — parity test required |
| OpenAPI spec vs 69 routes drift | MEDIUM | Not every route may be documented in `public/openapi.json` |
| Abort-reason redaction | MEDIUM | Run abort writes reason that must be redacted from activity feed (0067) — cross-surface consistency untested |
| Idempotency window semantics | MEDIUM | HTTP key vs 24h `start_token` interplay — boundary testing needed |
| Jira import resilience | MEDIUM | No retry/backoff evidence; worker crash leaves `running` forever |
| Notifications cross-workspace leak | MEDIUM | `entity_available` per-row RLS — verify entity visibility respected |
| Rate limiting | LOW | No application-layer rate limiting; 429s from Supabase only |
| Run timeout sweeper | MEDIUM | Shipped as 0075 but pg_cron not installed on live — sweep is dormant until the scheduler is installed; idle threshold (15 vs 30 min) unverified |
| No workspace delete/slug rotation | LOW | Multi-tenant lifecycle incomplete |
| Resend email wiring | LOW | Configured but not wired — GoTrue handles OTP email |
| Migration 0067 (`via` + SECURITY DEFINER rewrites) NOT applied | HIGH | finish/abort `via` executor recording is defined but the DEFINER rewrite is pending human approval — do not assume executor mode is recorded at runtime |
| Migration 0058 (ATC title length CHECK) NOT applied | MEDIUM | Title min-length constraint is in the tree but not live — ATC title validation may be client/Zod-only |
| Search entity-type count discrepancy | MEDIUM | data-map lists 6 types (atcs/tests/projects/modules/bugs/runs); feature-map §2.12 lists 4 (atcs/bugs/user_stories/tests) — reconcile which types are actually indexed |
| Abandoned-run threshold discrepancy | MEDIUM | data-map says 15 min inactivity; feature-map says >30 min — confirm the real hardcoded threshold in 0075 |
| Test-plan field-limit discrepancy | MEDIUM | data-map: name 1–100, desc ≤500, goal ≤100, codes 45600–45603; feature-map §2.11: name ≤200, desc ≤2000, codes 45801/45802 — reconcile before writing ATCs |
