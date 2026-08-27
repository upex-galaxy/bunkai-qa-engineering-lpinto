# Business API Map — Bunkai (QA Lens)

> Generated: 2026-08-09 (refreshed 2026-08-13)
> Refreshed: 2026-08-26 (v5 — verified against `upex-bunkai-tms` branch `staging`, tip post-pull 2026-08-26)
> Sources: `../upex-bunkai-tms/public/openapi.json`, `../upex-bunkai-tms/app/api/v1/` (69 route files, 92 handlers), `../upex-bunkai-tms/lib/api/handler.ts`, `../upex-bunkai-tms/lib/api/principal.ts`, `../upex-bunkai-tms/lib/api/middleware/bearer.ts`, `../upex-bunkai-tms/lib/api/capabilities.ts`, `../upex-bunkai-tms/lib/test-plans/validation.ts`, `../upex-bunkai-tms/lib/test-plans/errors.ts`, `../upex-bunkai-tms/middleware.ts`, `../upex-bunkai-tms/supabase/migrations/0001..0075`
> Last verified against OpenAPI on 2026-08-26 (route inventory verified via `route-capability-coverage.snapshot.json`)

---

## 1. Executive summary

Bunkai's API lets two distinct operator types drive the same test-management data model: **human QA engineers** through a session-cookie browser app, and **AI agents / CI pipelines** through bearer PATs. Since June 2026 the `/api/v1` surface grew roughly **5× — from 19 endpoints to 69 route files / 92 handlers** — and the product moved from "auth + tenancy skeleton" to a working test lifecycle: test chains, run execution, native bugs with triage, test plan grouping, coverage reporting, cross-entity search, workspace billing, notifications, and async Jira import all now have versioned endpoints over RPCs and RLS.

The auth model was rebuilt around a **unified Principal** (ADR-0001): `withApiHandler()` + `resolveIdentity()` collapse cookie and Bearer callers into one identity, and `requires:` scope gates are now **enforced** (previously `requireScope()` existed but no route called it). Signup is **verification-first** (BK-166): an unconfirmed account can do nothing — only email confirmation mints the session and first PAT. A password sign-in mints a PAT in the same call, so headless/agent flows never touch a browser. **OAuth (GitHub + Google) is live** via server-initiated GoTrue OAuth (CSRF state cookie); an OAuth session carries all cookie capabilities but does NOT auto-mint a PAT — headless callers issue one via `/tokens`.

Five product surfaces dominate the staging API: **run execution** (start → step-marking → finish/abort with state machines + triggers), **bug management** (provenance from run steps, forward-only triage), **test plan grouping** (BK-202: name/description/goal, open/close lifecycle, project-scoped), **coverage/traceability** (per-project and workspace roll-ups, export chain, filtered run reports), and **async Jira import** (202 + worker + poll). A **cross-entity search** surface (BK-398) unifies lookups across ATCs, tests, projects, modules, bugs, and runs. **Workspace billing** (BK-229) exposes plan, seats, and usage to admin/owner callers. Core authoring data (projects, modules, stories, ACs, ATCs) still flows mostly through Supabase PostgREST and `bunkai_*` RPCs, all RLS-gated.

---

## 2. Permission & auth model

### Tier table

| Tier | Who it applies to | How to acquire | Where enforced (code path) |
|------|-------------------|----------------|---------------------------|
| Public | Unauthenticated callers | None — no credential required | `middleware.ts` allows `/api/v1/health`, `/api/v1/auth/*` (signup/signin/confirm/resend/check-email/magic-link), `/api/v1` banner |
| Session-authenticated | Browser users (human QAs) | Signup → confirm OTP, **OAuth (GitHub/Google server-initiated, PKCE + CSRF state cookie)**, or legacy magic link → Supabase session cookie | `middleware.ts` `getUser()` + `lib/api/handler.ts` `auth: 'required'` |
| Bearer PAT | AI agents, CI/CD, scripts | Minted atomically by `POST /auth/signin` and `POST /auth/confirm`; managed via `/tokens` | `lib/api/middleware/bearer.ts` — prefix lookup, SHA-256 compare, `revoked_at`/`expires_at`, uniform 401 `"Invalid token."` |
| Principal (unified) | Any authenticated caller | Either flavor above; `resolveIdentity()` normalizes | `lib/api/principal.ts` — session JWT **or** PAT-JWT (`mintUserJwt`) → one `Principal { userId, kind: session\|pat, scopes }`; PAT path uses an **RLS-scoped client AS user, never service role** |
| Scope-gated (requires:) | PAT holders | Scopes fixed at mint: `atc:read`, `atc:write`, `run:execute`, `workspace:admin` (the latter **rejected at runtime**, ADR-0005) | `lib/api/handler.ts` `requires: ['atc:read', ...]` — enforced on every decorated route; cookie callers are treated as holding all capabilities |
| Role-gated (workspace) | Workspace members | Assigned at join/invite acceptance | RLS policies via `bunkai_is_workspace_member()`, `bunkai_can_write_workspace()`, `bunkai_is_workspace_admin()`, `bunkai_is_workspace_owner()` SECURITY DEFINER helpers + handler-level admin/owner gates |
| Active-workspace | Any authenticated user | `POST /api/v1/me/active-workspace` (membership-validated) → `bk_active_ws` httpOnly cookie; Bearer callers pass/derive `workspace_id` explicitly | `assertWorkspaceContext` (ADR-0006) — cookie and Bearer paths converge on the same workspace assertion |

### Workspace member roles

```
viewer (read-only)
  ↓
member (read + write tests, ATCs, runs, bugs)
  ↓
admin (manage members, invites, environments, milestones)
  ↓
owner (workspace settings, transfer/delete)
```

### Token flow — verification-first signup (BK-166)

```
┌──────────┐  POST /api/v1/auth/signup        ┌──────────────────────┐
│  Browser │  { email, password }             │  Supabase Auth       │
│          │ ────────────────────────────────►│  Admin API createUser│
└──────────┘                                  │  (email_confirm:f)   │
        │                                     └──────────┬───────────┘
        │  ← 202 { ok, "pending_confirmation" }          │ (no session,
        │     (NO session, NO PAT at this point)         │  no PAT yet)
        │                                               ▼
        │  POST /api/v1/auth/confirm { email, otp } ────►  GoTrue verifyOtp
        │                                               │
        │  ← 200 { user, session, pat: { token,         │ session + PAT
        │       scopes, expires_at } }  ◄── minted      │ minted ATOMICALLY
        │              (bk_pat_... + sb-*-auth-token)   └─────────────────
```

### Token flow — headless sign-in (PAT minted in the same call)

```
Agent/CLI → POST /api/v1/auth/signin { email, password }
  → Supabase signInWithPassword (legacy min(6))
  → response: { user, session, pat: { token, scopes, expires_at } }
  → subsequent calls: Authorization: Bearer bk_pat_<prefix>.<secret>
```

### Token flow — OAuth (GitHub / Google) — server-initiated, SHIPPED

```
Browser → GET /api/v1/auth/oauth/init?provider=github|google&next=...
  → server sets CSRF state cookie → redirect to provider
Provider callback → /api/v1/auth/oauth/callback (state validated)
  → GoTrue exchanges code → user session cookie (supabase-ssr)
  → full cookie capabilities (all scopes); NO PAT auto-minted
  → headless follow-up: POST /api/v1/tokens to issue a bearer PAT
```

### Token flow — PAT verification (any subsequent call)

```
Agent → Authorization: Bearer bk_pat_<12-prefix>.<secret>
  bearer.ts:
  1. parse prefix + remainder → fullSecret
  2. lookup token_prefix (indexed access_tokens)
  3. fetch sibling hashes from access_token_secrets (least-privilege table)
  4. SHA-256(fullSecret) == stored hash?
  5. revoked_at null? expires_at not past?
  ↓ OK → resolver mints user-scoped JWT (`mintUserJwt`) → db client AS user
  ↓      → RLS applies exactly like a session (same rows, same policies)
  ↓ FAIL → uniform 401 "Invalid token." (never leaks which check failed)
  (fire-and-forget last_used_at touch)
```

**Key invariant (QA-critical)**: a PAT never escalates — the downstream DB client runs with the owner's `auth.uid` under normal RLS, and `requires:` scopes are checked per-route. Authorization is user-identity + token-scope, not token-only.

---

## 3. Critical business journeys

### Journey 1: Verification-first signup (BK-166)

**Business purpose**: A new user creates an account; no capability (session, PAT, workspace) exists until the email is confirmed — preventing mass unconfirmed account creation.

```
User            Browser            API            GoTrue Auth
 │  email+pass   │                 │                 │
 │──────────────►│  POST /auth/signup               │
 │               │────────────────►│  createUser()   │
 │               │                 │────────────────►│
 │  ← 202 pending_confirmation    │                 │
 │◄──────────────│                 │                 │
 │  open inbox → OTP (6–8 digits)  │                 │
 │  enter OTP    │  POST /auth/confirm { email, otp }│
 │──────────────►│────────────────►│  verifyOtp()    │
 │               │                 │────────────────►│
 │               │                 │  mint session + PAT (atomic tx)
 │  ← 200 { user, session, pat }  │                 │
 │◄──────────────│                 │                 │
 │  POST /auth/resend (if expired) │  re-send OTP    │
 │  POST /auth/check-email         │  pre-submit check (public)
```

**Endpoints**: `POST /api/v1/auth/signup`, `POST /api/v1/auth/confirm`, `POST /api/v1/auth/resend`, `POST /api/v1/auth/check-email`, `GET /api/v1/auth/oauth/init`, `GET /api/v1/auth/oauth/callback` (all public). Legacy: `POST /api/v1/auth/magic-link` still exists.

**Entities touched**: `auth.users` (`access_tokens`, `access_token_secrets` minted at confirm).

**Feature IDs**: FEAT-AUTH-006, FEAT-AUTH-001..005, FEAT-API-006.

**Numbered narrative**:
1. Signup returns **202 `pending_confirmation`** — no session, no PAT, even on success (BK-166 contract).
2. Password rules are **asymmetric by design**: `min(8)` at signup, `min(6)` legacy at signin.
3. Duplicate email → **409 without echoing account existence** (no account-enumeration oracle).
4. Confirm validates the OTP and mints **session + PAT in the same transaction** — the account is unusable before this call succeeds.
5. Resend/confirm asymmetry and OTP expiry are the QA-critical edges (wrong OTP, expired OTP, rate limits).

**What breaks if the API hangs here**: unconfirmed accounts silently stuck; OTP expiry races; 409-no-echo abused as an enumeration oracle if error wording leaks.

---

### Journey 2: Workspace & member onboarding

**Business purpose**: A new user materializes their first workspace and brings teammates in with scoped roles.

```
User              API                    DB (RPC)              Invitee
 │  POST /workspaces { name, slug }       │                      │
 │ ──────────────────────────────────────►│  bunkai_bootstrap_   │
 │                                       │  workspace() (atomic  │
 │                                       │  ws + owner member)   │
 │  ← 200 { id, slug } (409 if slug taken)│                      │
 │  POST /workspaces/{id}/invites { email, role }                │
 │ ──────────────────────────────────────►                       │
 │  ← 200 { token, accept_url } (token returned exactly once)    │
 │  (URL shared out-of-band)                                     │
 │                                        │                      │  GET /invites/accept?token=...
 │                                        │                      │  POST /api/v1/invites/accept
 │                                        │                      │  (cookie OR bearer; email MUST
 │                                        │                      │   match invite → 403 otherwise)
 │                                        │  INSERT membership    │
 │                                        │  stamp accepted_at    │
 │                                        │◄─────────────────────│
 │                                        │  200 { workspace_id, role } ──► redirect /home
```

**Endpoints**: `POST /api/v1/workspaces` (+ `GET`), `GET/PATCH /api/v1/workspaces/{id}`, `GET/POST /api/v1/workspaces/{id}/invites`, `DELETE /api/v1/workspaces/{id}/invites/{inviteId}`, `POST /api/v1/invites/accept`, `GET /api/v1/me`, `POST /api/v1/me/active-workspace`, `GET /api/v1/workspaces/{id}/membership`.

**Entities touched**: `workspaces`, `workspace_members`, `workspace_invites`, `workspace_invite_secrets`.

**Feature IDs**: FEAT-WS-001..006, FEAT-API-008.

**Numbered narrative**:
1. Workspace creation is one atomic RPC (workspace + owner member); slug conflicts → 409, validated 3–40 chars.
2. Invites are pending with a 24h TTL; token returned once; email match is mandatory at redemption (403 mismatch, 409 non-pending/expired).
3. Accept works with **cookie OR bearer** — this is the first dual-auth surface QA must test for identical RLS outcomes.
4. `active-workspace` sets `bk_active_ws` cookie; membership-validated on every write. Bearer callers instead assert `workspace_id` per call (`assertWorkspaceContext`, ADR-0006).

**What breaks if the API hangs here**: token replay after acceptance (stamped + status check is the guard); stale `bk_active_ws` showing another tenant's context; rapid double-switch race before cookie write lands.

---

### Journey 3: Agentic test execution (run lifecycle)

**Business purpose**: An agent or CI executes a Test's ATC chain against a Project Environment and produces a comparable, traceable Run — the "three execution modes, one data model" promise.

```
Agent/CI              API                                DB (RPCs + triggers)
 │  GET /tests/{id} (full chain read)                       │
 │ ────────────────────────────────────────────────────────►│  bunkai_get_test_expanded
 │  ← 200 { test, chain: [atc_id, steps, assertions...] }   │
 │  POST /runs { test_id, environment_id, start_token? }    │
 │  (Idempotency detectable: HTTP key or 24h start_token)   │
 │ ────────────────────────────────────────────────────────►│  bunkai_create_run (45200..)
 │  ← 200 { run_id, run_atcs }   (run_atcs snapshot per position grain) 
 │  POST /runs/{id}/steps/{stepId}/mark { status }          │
 │ ────────────────────────────────────────────────────────►│  trigger recomputes run_atcs.status
 │  POST /runs/{id}/finish { via }                          │
 │ ────────────────────────────────────────────────────────►│  runs.status → passed | failed (terminal)
 │  POST /runs/{id}/abort { via }                           │
 │ ────────────────────────────────────────────────────────►│  runs.status → aborted (terminal)
 │  GET /runs/{id} (expanded)  ────────────────────────────►│  bunkai_get_run_expanded
 │  ← 200 { run, run_atcs, run_steps, env, executor }       │
```

**Endpoints**: `GET/POST /api/v1/tests`, `GET/PATCH/DELETE /api/v1/tests/{id}`, `POST /api/v1/tests/{id}/reorder`, `PUT /api/v1/tests/{id}/tags` (whole-set replace, `X-If-Match` optimistic lock → `bunkai_set_test_tags`), `POST /api/v1/tests/{id}/runs`, `POST /api/v1/runs`, `GET /api/v1/runs/{id}`, `POST /api/v1/runs/{id}/steps/{stepId}/mark`, `POST /api/v1/runs/{id}/finish`, `POST /api/v1/runs/{id}/abort`, `GET /api/v1/workspaces/{id}/active-runs`, `GET /api/v1/projects/{id}/runs/report` (BK-38, BK-499).

**Entities touched**: `tests`, `test_steps`, `project_environments`, `runs`, `run_atcs`, `run_steps`, `idempotency_keys`.

**Feature IDs**: FEAT-RUN-001..006, FEAT-TEST-001..005, FEAT-ENV-001..002, FEAT-API-003.

**Numbered narrative**:
1. Runs snapshot chain content (`run_atcs`, `run_steps`) — later ATC edits never corrupt history.
2. `start_token` (24h window) + idempotency key make replays detectable — **now functional** (FEAT-API-003), not a skeleton.
3. Position grain (`run_atcs.status`: pending/passed/failed/blocked/skipped) recomputes via trigger; run grain (`runs.status`: running/passed/failed/aborted) is terminal via finish/abort — `aborted` never appears at position grain (see domain-glossary run-status grain split).
4. `via` parameter records the executor (manual/agent/ci) on terminal transitions (migration 0067).
5. Environments are project-scoped with unique names; removal blocked while any Run references them (history preservation).
6. **BK-38/BK-499 filtered run report** (`GET /api/v1/projects/{id}/runs/report`): date range, module, status, and executor filters (AND-composed); pass/fail totals recomputed from the SAME filtered set (not all-time). Requires `atc:read`; uses `createAdminClient()` path; `bunkai_report_project_runs` RPC rechecks membership. Non-disclosure: missing/foreign projects collapse to generic 404.

**What breaks if the API hangs here**: duplicate runs (idempotency leak), inconsistent run status if trigger cascades fail, finish/abort accepting `via` values that break the activity feed's redaction contract.

---

### Journey 4: Native bug reporting & triage

**Business purpose**: A QA files a bug anchored to a module, ATC and run **inside the test cycle** — no Jira hand-off — and triages it through a forward-only lifecycle. BK-337 adds a single-defect detail read with full provenance and archived-module tagging.

```
QA                  API                                 DB (trigger + RPC backstop)
 │  POST /bugs { module_id, run_step_id, summary, ... }      │
 │ ────────────────────────────────────────────────────────►│  provenance derived server-side
 │                                                          │  from run_step_id; module ∈ project
 │                                                          │  re-validated (45300)
 │  ← 200 { bug_id, status: open }                          │
 │  GET /bugs/{id}                                           │
 │ ────────────────────────────────────────────────────────►│  bunkai_bug_json (0070 widened)
 │  ← 200 { bug: { ...origin, module.archived_at } }        │  SECURITY INVOKER, RLS-scoped
 │  POST /bugs/{id}/assign { user_id }                      │
 │ ────────────────────────────────────────────────────────►│  assignee must be member (45312)
 │                                                          │  viewer cannot be assigned (45313)
 │  POST /bugs/{id}/status { status }                       │
 │ ────────────────────────────────────────────────────────►│  forward-only adjacency:
 │                                                          │  open→in_progress→resolved→closed
 │                                                          │  (45310 skip, 45311 backward)
 │  GET /projects/{id}/bugs  ·  GET /projects/{id}/bugs/heatmap
 │  GET /workspaces/{id}/open-bugs
```

**Endpoints**: `POST /api/v1/bugs`, `GET /api/v1/bugs/{id}` (BK-337), `GET /api/v1/workspaces/{id}/open-bugs`, `POST /api/v1/bugs/{id}/assign`, `POST /api/v1/bugs/{id}/status`, `GET /api/v1/projects/{id}/bugs`, `GET /api/v1/projects/{id}/bugs/heatmap`.

**Entities touched**: `bugs`, `run_steps`, `modules`, `workspace_members`.

**Feature IDs**: FEAT-BUG-001..005.

**Numbered narrative**:
1. Bug provenance (module + ATC + run) is derived server-side from `run_step_id` — a bug cannot be filed against an unrelated module (re-validation 45300).
2. Lifecycle is **forward-only**, enforced twice: DB trigger (`bunkai_bugs_check_consistency`) + RPC; SQLSTATEs 45310/45311 reject skips/backwards.
3. Assignee eligibility is checked (workspace member, not viewer) — 45312/45313.
4. Heatmap aggregates by module — feeds defect trends without needing Jira.
5. **BK-337 single-defect read** (`GET /api/v1/bugs/{id}`): `bunkai_bug_json` RPC (widened by migration 0070) returns full composed record with `origin` (provenance: run_id, step position, ATC title/layer) and `module.archived_at`. SECURITY INVOKER — runs under caller's own RLS; missing/foreign bug collapses to generic 404 (non-disclosing). Archived-module bugs still render (PO ruling: tag, never 404). POST /bugs, POST /bugs/{id}/assign, POST /bugs/{id}/status also return `BugDetailSchema` (not the plain `BugSchema`).
6. **BK-466 evidence-link scheme guard**: `evidence_url` and `evidence_urls` now reject non-http(s) schemes (`javascript:`, `data:`, etc.) at both filing time (Zod `z.url({ protocol: z.regexes.httpProtocol })`) and render time (`isHttpUrl` helper).

**What breaks if the API hangs here**: trigger/RPC double layer disagreeing on a transition; assignment to a viewer silently accepted; heatmap totals diverging from `bugs` rows.

---

### Journey 5: Coverage, traceability & recovery metrics

**Business purpose**: Leadership and QA need trustworthy numbers: what % of acceptance criteria is covered, the full US→AC→ATC→Test→Run chain, and defect recovery cadence.

```
Consumer             API                                      DB (report RPCs)
 │  GET /projects/{id}/coverage                                 │
 │ ───────────────────────────────────────────────────────────►│  sum(ac_bound)/sum(ac_total)
 │  ← 200 { per-module + project totals }  (NOT mean of %)     │
 │  GET /workspaces/{id}/coverage                               │
 │ ───────────────────────────────────────────────────────────►│  workspace-wide roll-up
 │  ← 200 { workspace totals }        (same sum/sum rule)      │
 │  GET /projects/{id}/traceability                             │
 │ ───────────────────────────────────────────────────────────►│  full US↔AC↔ATC↔Test↔Run chain
 │  ← 200 { export-ready chain }   (BK-50)                     │
 │  GET /projects/{id}/metrics/recovery-cycles                  │
 │ ───────────────────────────────────────────────────────────►│  bug open→resolved cadence
 │  ← 200 { recovery cycles }                                  │
 │  GET /atcs/{id}/usage · POST /atcs/{id}/duplicate            │
 │  GET /atcs/search (tsvector)                                 │
```

**Endpoints**: `GET /api/v1/projects/{id}/coverage`, `GET /api/v1/workspaces/{id}/coverage`, `GET /api/v1/projects/{id}/traceability`, `GET /api/v1/projects/{id}/metrics/recovery-cycles`, `GET /api/v1/atcs/{id}/usage`, `POST /api/v1/atcs/{id}/duplicate`, `GET /api/v1/atcs/search`, `GET /api/v1/atcs`, `GET/PATCH/DELETE /api/v1/atcs/{id}`.

**Entities touched**: `acceptance_criteria`, `atcs`, `atc_acceptance_criteria`, `test_steps`, `runs`, `bugs`.

**Feature IDs**: FEAT-COV-001..004, FEAT-ATC-001..007, FEAT-API-004.

**Numbered narrative**:
1. **Coverage invariant (QA-critical)**: roll-ups are `sum(ac_bound)/sum(ac_total)`, never a mean of percentages — Home page and API share `lib/home/coverage.ts` (incl. workspace scope), so both must return identical numbers.
2. Traceability export (BK-50) materializes the full bidirectional chain — regression of links (orphan ACs, broken ATC↔AC joins) shows up here first.
3. **Traceability chain filters (BK-48)**: ATCs now carry `module: {id, name}` identity (0069 migration). Client-side filter functions (`atcMatchesFilters`, `distinctModules`, `isFilteringActive`) enable filtering by verdict/module/date-range. `StoryChainViewState` distinguishes zero-ac vs zero-coverage empty states.
4. Recovery-cycle metric derives from bug timestamps (open → resolved) — depends on upstream bug lifecycle correctness.

**What breaks if the API hangs here**: Home/API coverage divergence (sum/sum vs mean bug), stale traceability after ATC repoint, recovery metrics feeding minutes off a wrong bug state, filter state diverging from chain content (module identity missing or stale).

---

### Journey 6: Async Jira import

**Business purpose**: A workspace migrates stories/tests from Jira Cloud into Bunkai without blocking the UI — one active import per project, polled to completion.

```
Client              API                         Worker (Vercel after())
 │  POST /imports { jira_project_key, ... }          │
 │ ────────────────────────────────────────────────► │  202 accepted immediately
 │  ← 202 { import_id }                              │  (409 if another import is
 │                                                   │   still active for the project)
 │                                                   │  after() → lib/jira/import-runner
 │  GET /imports/{id}  ◄─── polling ────────────────►│  writes progress/result rows
 │  ← 200 { status: running | done | failed, ... }   │
 │            (200-empty/wrong-state semantics, not 404-style surprises)
```

**Endpoints**: `POST /api/v1/imports`, `GET /api/v1/imports/{id}`.

**Entities touched**: `import_jobs` (0019/0020), Jira Cloud REST (outbound, one-way).

**Feature IDs**: FEAT-IMPORT-001..002.

**Numbered narrative**:
1. One active import per project (DB constraint) → 409 on concurrent attempt.
2. Worker executes in the request's `after()` — UI is never blocked; client polls `GET /imports/{id}`.
3. Failure modes live in worker timing: crash mid-import leaves `running`; poll must surface terminal states honestly.

**What breaks if the API hangs here**: worker crash → stuck `running` forever; replaying the same project import corrupting stories (dedup proof needed).

---

### Journey 7: Day-2 attention surfaces (activity + notifications)

**Business purpose**: Teams see what changed (activity stream) and get notified of events they can actually see (RLS-aware notifications).

```
User            API                                          DB
 │  GET /activity?limit=&cursor= (workspace context)             │
 │ ────────────────────────────────────────────────────────────►│  activity_log (RLS-filtered)
 │  ← 200 { items, next_cursor? }  (empty items = valid 200)    │
 │  GET /workspaces/{id}/notifications                          │
 │ ────────────────────────────────────────────────────────────►│  unread_count + rows
 │  POST /workspaces/{id}/notifications/read-all                │
 │  POST /notifications/{id}/read                               │
 │  GET/PUT /notification-preferences                           │
 │  GET /workspaces/{id}/recent-projects · open-bugs · active-runs (Home widgets)
```

**Endpoints**: `GET /api/v1/activity`, `GET /api/v1/workspaces/{id}/notifications`, `POST /api/v1/workspaces/{id}/notifications/read-all`, `POST /api/v1/notifications/{id}/read`, `GET/PUT /api/v1/notification-preferences`, `GET /api/v1/workspaces/{id}/recent-projects`, `GET /api/v1/workspaces/{id}/open-bugs`, `GET /api/v1/workspaces/{id}/active-runs`.

**Entities touched**: `activity_log`, `notifications`, `notification_preferences`.

**Feature IDs**: FEAT-ACT-001, FEAT-NOTIF-001..004, FEAT-WS-006.

**Numbered narrative**:
1. Activity cursor pagination: `workspace_id` required for Bearer callers (422 otherwise); **empty items = 200, never 404**; RLS collapses rows the caller cannot see (no leak).
2. Notifications respect entity visibility — `entity_available` computed per row; a member is never notified about entities they cannot see; abort reason is redacted from the feed on run abort (0067).
3. Preferences (PUT) control which event categories land in the inbox.

**What breaks if the API hangs here**: cursor loops or duplicates on paginated activity; notifications leaking entity context across workspace boundaries; read-all stamping races.

---

### Journey 8: Test plan grouping (BK-202)

**Business purpose**: QA organizes tests under named plans with a release goal — creating a lightweight grouping that predates (and is distinct from) milestones. Plans have an open/close lifecycle; no delete path exists.

```
QA                  API                                  DB (RPCs)
 │  POST /projects/{id}/test-plans { name, description, goal }
 │ ──────────────────────────────────────────────────────────────►│  bunkai_create_test_plan
 │                                                               │  (normalize, length checks,
 │                                                               │   case-insensitive unique,
 │                                                               │   activity_log audit)
 │  ← 201 { test_plan: { id, status: 'open', ... } }
 │  GET /projects/{id}/test-plans
 │ ──────────────────────────────────────────────────────────────►│  RLS-scoped query
 │  ← 200 { test_plans: [...] }
 │  PATCH /test-plans/{id} { name, description, goal }
 │ ──────────────────────────────────────────────────────────────►│  bunkai_update_test_plan
 │                                                               │  (enforces status = 'open',
 │                                                               │   self-exclusion on rename)
 │  ← 200 { test_plan: { ... } }
```

**Endpoints**: `GET /api/v1/projects/{id}/test-plans`, `POST /api/v1/projects/{id}/test-plans`, `PATCH /api/v1/test-plans/{id}`.

**Entities touched**: `test_plans` (0073), `activity_log`.

**Feature IDs**: FEAT-TP-001..003.

**Numbered narrative**:
1. Test plans are **project-scoped** — the RPC resolves workspace from project and role-gates via `bunkai_can_write_workspace`.
2. Name uniqueness is **case-insensitive + whitespace-collapsed** (0073 CHECK constraints); duplicate → 409 `test_plan_name_taken`.
3. **No DELETE path** — ratified decision T4: Close is the only exit from Open (status = 'closed'). Pre-mapped SQLSTATE 45603 (`test_plan_not_open`) blocks edits on closed plans.
4. `created_by` is audit-only (FK → `auth.users`); any member can edit any plan — creator restriction does not apply.
5. **NBSP whitespace fix (BK-591, 0074)**: `regexp_replace` now uses explicit `[\t\n\v\f\r ]+` instead of `\s+` to avoid collapsing NBSP-padded names onto their unpadded twin.
6. Full-replace semantics: omitting `description` or `goal` clears them (they default to empty string).

**What breaks if the API hangs here**: case-insensitive uniqueness violation under concurrent creates; edits on closed plans silently accepted; NBSP-padded names colliding with unpadded twins (fixed by 0074).

---

### Journey 9: Cross-entity search (BK-398)

**Business purpose**: A single search surface that unifies lookups across all entity types — no more navigating to individual list views.

```
QA/Agent            API                                   DB (RPC)
 │  GET /search?q=login+button&limit=10
 │ ──────────────────────────────────────────────────────►│  workspace-scoped search
 │                                                       │  (max 5 per entity type)
 │  ← 200 { data: [...], truncated: false }
 │    data[i]: { entity_type, id, name, project_id,
 │              project_slug, project_name, href }
```

**Endpoint**: `GET /api/v1/search`.

**Entities touched**: Cross-entity query across `atcs`, `tests`, `projects`, `modules`, `bugs`, `runs`.

**Feature IDs**: FEAT-SEARCH-001.

**Numbered narrative**:
1. Query `q` must be ≥2 chars after trim; `limit` is 1–20 (default 20) — per-request ceiling only.
2. **RPC-enforced cap**: max 5 results per entity type (ATC, Test, Project, Module, Bug, Run); `truncated: true` when any group hits its 5-row cap.
3. **Scope model**: workspace resolved server-side from session cookie (`bk_active_ws`) or PAT scope — no workspace param exposed. Unknown/inaccessible workspace returns `200 { data: [], truncated: false }` (no 403/404 disclosure).
4. **`href` field**: server-built navigation path — clients never reconstruct URLs client-side.
5. Returns `200` with empty data for scope failures (non-disclosure) — 422 only for validation errors or unbound Bearer PAT.

**What breaks if the API hangs here**: search leaking entity context across workspace boundaries; `href` pointing to inaccessible routes; truncation flag not matching actual result count.

---

### Journey 10: Workspace billing overview (BK-229)

**Business purpose**: Workspace admins/owners view their current plan tier, seat count, and usage — a read-only summary that drives upgrade decisions without exposing internal billing state.

```
Admin/Owner         API                                   DB (RPC)
 │  GET /workspaces/{id}/billing
 │ ──────────────────────────────────────────────────────►│  bunkai_workspace_billing_overview
 │                                                       │  (SECURITY INVOKER, admin/owner gate,
 │                                                       │   tier ladder from TypeScript constants)
 │  ← 200 { plan, seats, usage }  (or 404 non-disclosing)
```

**Endpoint**: `GET /api/v1/workspaces/{id}/billing`.

**Entities touched**: `workspaces`, `workspace_members`.

**Feature IDs**: FEAT-WS-007.

**Numbered narrative**:
1. **Admin/owner only** — `bunkai_is_workspace_admin()` gates access; non-admin callers get 404 (never 403 — no existence disclosure).
2. **Tier ladder lives in code** (`lib/billing/plan-tiers.ts`), not a DB table — per ADR-0012 / BK-267 binding decision.
3. **SECURITY INVOKER** — the RPC reads `auth.uid()` indirectly via the admin-check helper; no caller-supplied identity parameter. Route must use `getAuth(ctx).db`, never `createAdminClient()`.
4. **Non-disclosing 404**: unknown workspace, non-visible workspace, and non-admin caller all return identical 404.

**What breaks if the API hangs here**: billing info leaking to non-admin members; tier values diverging between code and any future DB-backed source; wrong 403 leaking workspace existence.

---

## 4. Architecture behind the API

### Layered diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                         │
│   Browser (React) · CLI (curl) · CI/CD · AI Agent (MCP client)       │
└───────────┬───────────────────────────────┬──────────────────────────┘
            │ cookie                        │ Bearer bk_pat_...
┌───────────▼───────────────────────────────▼──────────────────────────┐
│  EDGE / GATEWAY — Vercel Edge + middleware.ts                        │
│   public prefixes: /login /auth* /invites /api/v1/auth* /api/v1/health│
└───────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────────────┐
│  ROUTE HANDLER LAYER (Next.js 15 App Router, 69 route files)         │
│   withApiHandler({ auth, requires }) → Principal (resolveIdentity)   │
│    ├─ cookie session (supabase-ssr) ──┐  ┌─ bearer.ts (PAT verify)   │
│    └──────┬────────────────────┬──────┘  └──► mintUserJwt (AS user)  │
│   Session paths                │           Agent paths               │
│   (mutations, UI)              ▼                                     │
│                      unified Principal → handler logic               │
└───────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────────────┐
│  DATA ACCESS LAYER                                                    │
│   PostgREST (UI reads, RLS) · bunkai_* RPCs (~93, SECURITY DEFINER)  │
│   assertWorkspaceContext (ADR-0006) · RLS (auth.uid, helpers)        │
└───────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────────────┐
│  PERSISTENCE LAYER — Supabase (Postgres, 32 tables + auth + realtime)│
│   triggers (status recompute, consistency) · idempotency_keys        │
│   access_tokens + access_token_secrets (split, least-privilege)      │
└───────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────────────┐
│  EXTERNAL — GoTrue (auth) · Jira Cloud (import, one-way) ·           │
│  Vercel after() workers · Resend (email, configured)                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Component table

| Component | Role | Persistence / Integrations touched | Why it matters for QA |
|-----------|------|-----------------------------------|-----------------------|
| `middleware.ts` | Edge auth gate | Supabase SSR `getUser()`, public-prefix allowlist | Session expiry mid-flow redirects; subtle drift in public prefix list = auth bypass |
| `withApiHandler()` | Request lifecycle | Structured logging, error mapping, `auth` + `requires` resolution | Consistent error envelopes; a misdecorated route (`auth` missing) = silent privilege hole |
| `principal.ts` | Unified identity | Session JWT or `mintUserJwt` (PAT → RLS client AS user) | **The dual-path pivot** — cookie vs Bearer must resolve identical rows on every route |
| `bearer.ts` | PAT validation | `access_tokens` + `access_token_secrets` | Immediate revocation (DB read per request); uniform 401 contract |
| `workspace-cookie.ts` | Active-workspace context | `bk_active_ws` httpOnly cookie | Membership validated on every write; stale cookie = wrong tenant |
| Versioned REST (`/api/v1`) | Public API surface | Supabase Auth + RPCs + PostgREST reads | Thin wrapper — role gates in handlers, RLS underneath; 92 handlers to keep in contract tests |
| `bunkai_*` RPCs (~69) | Mutation/report layer | SECURITY DEFINER functions, SQLSTATEs (45200.., 45300.., 45500.., 45600..) | RPC + trigger double layers must agree; SQLSTATE mapping to HTTP codes is a contract |
| PostgREST | Auto-generated REST | All 32 tables with RLS | Default UI read path — RLS bug = data leak |
| DB triggers | Recomputation + consistency | `run_atcs.status`, `bunkai_bugs_check_consistency`, `activity_log` sink, realtime (0043) | Cascade failures produce inconsistent run/bug states |
| Vercel `after()` workers | Async work | `import_jobs` (Jira import) | Worker crash leaves `running` forever — poll UX contract |
| OpenAPI pipeline | API documentation | Zod → `scripts/openapi-gen.ts` → `public/openapi.json` | Spec vs implementation drift — contract tests source of truth |

---

## 5. External integrations

| Service | Trigger | Direction | Failure mode (user-visible) | Journeys affected |
|---------|---------|-----------|-----------------------------|-------------------|
| Supabase GoTrue (Auth) | `POST /auth/signup|signin|confirm|resend|magic-link` | Outbound sync | 5xx → email/OTP not delivered, account unusable; rate limits 429 | J1, J2 |
| Supabase GoTrue (Auth) | OTP verification callback | Inbound | OTP exchange fails → no session, blank page | J1 |
| Jira Cloud | `POST /imports` → `lib/jira/import-runner` | Outbound (one-way import) | Worker crash → import stuck `running`; partial imports deduped? | J6 |
| Vercel `after()` | Async import processing | Internal async | Import never completing without a UI error | J6 |
| Supabase Realtime | Trigger broadcast (0043) | Internal | Stale live views if channel auth misconfigured | J3, J7 |
| Resend (email) | Notifications/digests (configured; wiring not verified) | Outbound async | Not yet evidenced in staging code paths | J7 (future) |
| Supabase PostgREST | All UI CRUD reads | Auto-generated | 5xx → blank pages | All |

**Current state**: no third-party SDKs beyond Supabase; the only external HTTP integration evidenced in staging code is the **Jira import runner** (one-way). Jira write-back and Resend delivery remain configured-but-unverified.

---

## 6. Cross-references

### Data-map entities this API exposes

| Entity | How API exposes it | Data-map anchor |
|--------|-------------------|-----------------|
| `workspaces` / `workspace_members` / `workspace_invites` (+ secrets) | Workspace + invites + membership endpoints (J2) | `business-data-map.md` §1 workspace cluster |
| `access_tokens` / `access_token_secrets` | `/api/v1/tokens` + mint on signin/confirm | `business-data-map.md` §1 auth cluster |
| `tests` / `test_steps` | `/api/v1/tests*` (incl. reorder, tags with `X-If-Match`) | `business-data-map.md` §1 tests cluster |
| `project_environments` | `/api/v1/environments*`, `/api/v1/projects/{id}/environments` | `business-data-map.md` §1 environments |
| `runs` / `run_atcs` / `run_steps` | `/api/v1/runs*` (+ `tests/{id}/runs`, `projects/{id}/runs/report` BK-38/BK-499) | `business-data-map.md` §1 runs cluster |
| `bugs` | `/api/v1/bugs*` (+ detail read BK-337, status, assign, heatmap, open-bugs) | `business-data-map.md` §1 bugs cluster |
| `atcs` + children | `/api/v1/atcs*` (+ search, usage, duplicate) | `business-data-map.md` §1 atcs cluster |
| `modules` / `user_stories` / `acceptance_criteria` | `/api/v1/modules*`, `/user-stories*`, `/acceptance-criteria*` + PostgREST | `business-data-map.md` §1 authoring cluster |
| `milestones` | `/api/v1/milestones*`, `/projects/{id}/milestones` | `business-data-map.md` §1 milestones |
| `import_jobs` | `/api/v1/imports*` | `business-data-map.md` §1 imports |
| `activity_log` / `notifications` / `notification_preferences` | `/activity`, `/notifications*`, `/notification-preferences` | `business-data-map.md` §1 collaboration cluster |
| `test_plans` | `/api/v1/projects/{id}/test-plans`, `/api/v1/test-plans/{id}` (BK-202) | `business-data-map.md` §1 test_plans (new) |
| Cross-entity search | `/api/v1/search` (BK-398) | Derived — queries across atcs, tests, projects, modules, bugs, runs |

### Feature-map features this API backs

| Journey | Feature IDs |
|---------|-------------|
| Verification-first signup (J1) | FEAT-AUTH-001..007, FEAT-API-006 |
| Workspace & member onboarding (J2) | FEAT-WS-001..006, FEAT-API-008 |
| Run execution (J3) | FEAT-RUN-001..006, FEAT-TEST-001..005, FEAT-ENV-001..002, FEAT-API-003 |
| Bugs + triage (J4) | FEAT-BUG-001..006 |
| Coverage / traceability (J5) | FEAT-COV-001..004, FEAT-ATC-001..007 |
| Jira import (J6) | FEAT-IMPORT-001..002 |
| Activity / notifications (J7) | FEAT-ACT-001, FEAT-NOTIF-001..004, FEAT-WS-006 |
| Test plan grouping (J8) | FEAT-TP-001..003 |
| Cross-entity search (J9) | FEAT-SEARCH-001 |
| Workspace billing overview (J10) | FEAT-WS-007 |

### OpenAPI spec location

- **Generated spec**: `../upex-bunkai-tms/public/openapi.json` (OpenAPI 3.1) — served at `GET /api/openapi`, UI at `GET /api/docs` (Scalar)
- **TypeScript types**: `api/schemas/` via `bun run api:sync`
- **Auth vocabulary**: `lib/api/handler.ts`, `lib/api/principal.ts`, `lib/api/middleware/bearer.ts`

---

## 7. Discovery gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| Dual-path RLS parity untested | HIGH | Every route resolving cookie vs Bearer to the same rows (`mintUserJwt` + RLS AS user) needs a consent QA suite; PAT impersonation of a session user is the top auth risk. |
| `workspace:admin` scope accepted-but-rejected | HIGH | ADR-0005: minted PATs may carry `workspace:admin`, but `requires:` rejects it at runtime. Verify the rejection is consistent across all routes and that creating such a PAT doesn't advertise a capability that never works. |
| Coverage roll-up invariant unverified | HIGH | `sum/sum` (never mean-of-percentages) shared Home/API `lib/home/coverage.ts` — parity test between Home page and both coverage endpoints required (FEAT-COV-001). |
| OpenAPI spec vs 69 routes drift | MEDIUM | Not every route file may be documented in `public/openapi.json`; contract tests should diff route inventory against the spec (route-capability-coverage.snapshot.json tracks 92 handlers). |
| Abort-reason redaction | MEDIUM | Run abort writes a reason that must be redacted from activity feed (0067). Untested cross-surface consistency (run detail vs feed). |
| Idempotency window semantics | MEDIUM | HTTP key vs 24h `start_token` interplay on `POST /runs`: hard-replay detection is functional now — test key reuse across/concurrent calls, and expiry at the 24h boundary. |
| Magic-link legacy coexistence | MEDIUM | `POST /auth/magic-link` coexists with verification-first confirm; canonical path unknown. Both must be tested, and the 409-no-echo invariant verified on both. BK-400 added stateless verification via `verifyOtp` (works cross-device) — test both PKCE (legacy) and implicit (new) flows. |
| OAuth session surface | MEDIUM | OAuth path bypasses email-OTP and auto-mint: verify a fresh OAuth user can reach all session-capability surfaces, and that `/tokens` issues a correct-scope PAT for a user who only has an OAuth session. |
| Jira import resilience | MEDIUM | No retry/backoff evidence in `import-runner`; crash leaves `running` forever; concurrent-import 409 is the only guard. Worker-failure simulation needed. |
| Notifications cross-workspace leak | MEDIUM | `entity_available` per-row RLS: verify a member never receives notifications for entities outside their workspaces, and read-all races. |
| Rate limiting | LOW | No application-layer rate limiting; 429s come from Supabase only. |
| Test plan concurrency safety | MEDIUM | `bunkai_create_test_plan` uses DB unique index as sole concurrency guard — verify concurrent creates for the same project + name produce exactly one 409, not a silent duplication or deadlock. |
| Test plan close-not-edit guard | LOW | Closed plans must reject edits (SQLSTATE 45603 → 409 `test_plan_not_open`); verify PATCH on a closed plan returns 409, not 200 with stale data. |
| Search scope disclosure | MEDIUM | `/search` returns 200 with empty data for scope failures (no 403/404 disclosure); verify a Bearer PAT scoped to workspace A returns empty results (not 403) for queries hitting workspace B entities. |
| Run auto-sweep (BK-269) | LOW | `bunkai_sweep_abandoned_runs` runs every 15min via pg_cron, threshold 4h; no API endpoint exposes sweep state — QA must test via DB. Verify sweep does not abort runs with recent step activity, and that `SKIP LOCKED` + per-run isolation prevents one bad run from stranding the pass. |
| NBSP whitespace normalization parity | LOW | TypeScript (`validation.ts`) uses explicit `[\t\n\v\f\r ]+`; SQL (0074) now matches. Verify no remaining `regexp_replace` with `\s+` pattern in test_plans RPCs or CHECK constraints. |
| BugDetailSchema vs BugSchema drift | MEDIUM | BK-337: POST /bugs, POST /bugs/{id}/assign, POST /bugs/{id}/status now return `BugDetailSchema` (origin + module.archived_at); list endpoints still return `BugSchema` (no origin, no archived_at). Verify no route accidentally uses the wrong schema. |
| Evidence-link scheme guard | LOW | BK-466: `evidence_url` restricted to http/https at API edge (Zod) and render time (`isHttpUrl`). Verify consistent rejection of `javascript:`/`data:` across filing, marking, and rendering surfaces. |
| Capability vocabulary sync | LOW | `lib/api/capabilities.ts` defines 4 scopes (`atc:read`, `atc:write`, `run:execute`, `workspace:admin`); must stay in sync with the `scopes` CHECK constraint in migration `0008_access_tokens.sql`. Verify adding a new capability widens the CHECK before any PAT can mint it. |
| Billing endpoint admin-only gate | MEDIUM | `GET /workspaces/{id}/billing` returns 404 for non-admin/non-owner; verify the 404 is identical for unknown workspace, non-visible workspace, and non-admin caller (non-disclosure). |
| Run report filter parity | MEDIUM | `GET /projects/{id}/runs/report` filters (date/module/status/executor) must compose AND; verify empty-filter returns same totals as unfiltered run-history endpoint. |

---

## 8. Change log

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-06-20 | Initial generation |
| v2 | 2026-07-08 | OAuth, unified Principal, bugs, coverage |
| v3 | 2026-08-12 | Jira import, BK-337 bugs, BK-466 evidence |
| v4 | 2026-08-15 | Post-pull refresh, BK-166, ADR-0005/0006 |
| v5 | 2026-08-26 | Test plan grouping (BK-202), cross-entity search (BK-398), run report (BK-38/BK-499), workspace billing (BK-229), NBSP fix (BK-591), auto-sweep (BK-269); corrected counts (69 routes, 92 handlers, ~69 RPCs, 32 tables, 75 migrations) |