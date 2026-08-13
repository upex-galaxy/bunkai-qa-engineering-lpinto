# Business API Map — Bunkai (QA Lens)

> Generated: 2026-08-09 (refreshed 2026-08-13)
> Sources: `../upex-bunkai-tms/public/openapi.json`, `../upex-bunkai-tms/app/api/v1/` (64 route files, 82 handlers), `../upex-bunkai-tms/lib/api/handler.ts`, `../upex-bunkai-tms/lib/api/principal.ts`, `../upex-bunkai-tms/lib/api/middleware/bearer.ts`, `../upex-bunkai-tms/middleware.ts`, `../upex-bunkai-tms/supabase/migrations/0001..0068`
> Last verified against OpenAPI on 2026-08-13

---

## 1. Executive summary

Bunkai's API lets two distinct operator types drive the same test-management data model: **human QA engineers** through a session-cookie browser app, and **AI agents / CI pipelines** through bearer PATs. Since June 2026 the `/api/v1` surface grew roughly **3× — from 19 endpoints to 64 route files / 82 handlers** — and the product moved from "auth + tenancy skeleton" to a working test lifecycle: test chains, run execution, native bugs with triage, coverage reporting, notifications, and async Jira import all now have versioned endpoints over RPCs and RLS.

The auth model was rebuilt around a **unified Principal** (ADR-0001): `withApiHandler()` + `resolveIdentity()` collapse cookie and Bearer callers into one identity, and `requires:` scope gates are now **enforced** (previously `requireScope()` existed but no route called it). Signup is **verification-first** (BK-166): an unconfirmed account can do nothing — only email confirmation mints the session and first PAT. A password sign-in mints a PAT in the same call, so headless/agent flows never touch a browser.

Four product surfaces dominate the staging API: **run execution** (start → step-marking → finish/abort with state machines + triggers), **bug management** (provenance from run steps, forward-only triage), **coverage/traceability** (per-project and workspace roll-ups, export chain), and **async Jira import** (202 + worker + poll). Core authoring data (projects, modules, stories, ACs, ATCs) still flows mostly through Supabase PostgREST and `bunkai_*` RPCs, all RLS-gated.

---

## 2. Permission & auth model

### Tier table

| Tier | Who it applies to | How to acquire | Where enforced (code path) |
|------|-------------------|----------------|---------------------------|
| Public | Unauthenticated callers | None — no credential required | `middleware.ts` allows `/api/v1/health`, `/api/v1/auth/*` (signup/signin/confirm/resend/check-email/magic-link), `/api/v1` banner |
| Session-authenticated | Browser users (human QAs) | Signup → confirm OTP (or legacy magic link) → Supabase session cookie | `middleware.ts` `getUser()` + `lib/api/handler.ts` `auth: 'required'` |
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

**Endpoints**: `POST /api/v1/auth/signup`, `POST /api/v1/auth/confirm`, `POST /api/v1/auth/resend`, `POST /api/v1/auth/check-email` (all public). Legacy: `POST /api/v1/auth/magic-link` still exists.

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

**Endpoints**: `GET/POST /api/v1/tests`, `GET/PATCH/DELETE /api/v1/tests/{id}`, `POST /api/v1/tests/{id}/reorder`, `PUT /api/v1/tests/{id}/tags` (whole-set replace, `X-If-Match` optimistic lock → `bunkai_set_test_tags`), `POST /api/v1/tests/{id}/runs`, `POST /api/v1/runs`, `GET /api/v1/runs/{id}`, `POST /api/v1/runs/{id}/steps/{stepId}/mark`, `POST /api/v1/runs/{id}/finish`, `POST /api/v1/runs/{id}/abort`, `GET /api/v1/workspaces/{id}/active-runs`.

**Entities touched**: `tests`, `test_steps`, `project_environments`, `runs`, `run_atcs`, `run_steps`, `idempotency_keys`.

**Feature IDs**: FEAT-RUN-001..006, FEAT-TEST-001..005, FEAT-ENV-001..002, FEAT-API-003.

**Numbered narrative**:
1. Runs snapshot chain content (`run_atcs`, `run_steps`) — later ATC edits never corrupt history.
2. `start_token` (24h window) + idempotency key make replays detectable — **now functional** (FEAT-API-003), not a skeleton.
3. Position grain (`run_atcs.status`: pending/passed/failed/blocked/skipped) recomputes via trigger; run grain (`runs.status`: running/passed/failed/aborted) is terminal via finish/abort — `aborted` never appears at position grain (see domain-glossary run-status grain split).
4. `via` parameter records the executor (manual/agent/ci) on terminal transitions (migration 0067).
5. Environments are project-scoped with unique names; removal blocked while any Run references them (history preservation).

**What breaks if the API hangs here**: duplicate runs (idempotency leak), inconsistent run status if trigger cascades fail, finish/abort accepting `via` values that break the activity feed's redaction contract.

---

### Journey 4: Native bug reporting & triage

**Business purpose**: A QA files a bug anchored to a module, ATC and run **inside the test cycle** — no Jira hand-off — and triages it through a forward-only lifecycle.

```
QA                  API                                 DB (trigger + RPC backstop)
 │  POST /bugs { module_id, run_step_id, summary, ... }      │
 │ ────────────────────────────────────────────────────────►│  provenance derived server-side
 │                                                          │  from run_step_id; module ∈ project
 │                                                          │  re-validated (45300)
 │  ← 200 { bug_id, status: open }                          │
 │  POST /bugs/{id}/assign { user_id }                      │
 │ ────────────────────────────────────────────────────────►│  assignee must be member (45312)
 │                                                          │  viewer cannot be assigned (45313)
 │  POST /bugs/{id}/status { status }                       │
 │ ────────────────────────────────────────────────────────►│  forward-only adjacency:
 │                                                          │  open→in_progress→resolved→closed
 │                                                          │  (45310 skip, 45311 backward)
 │  GET /projects/{id}/bugs  ·  GET /projects/{id}/bugs/heatmap
 │  GET /workspaces/{id}/open-bugs                          │
```

**Endpoints**: `POST /api/v1/bugs`, `GET /api/v1/workspaces/{id}/open-bugs`, `POST /api/v1/bugs/{id}/assign`, `POST /api/v1/bugs/{id}/status`, `GET /api/v1/projects/{id}/bugs`, `GET /api/v1/projects/{id}/bugs/heatmap`.

**Entities touched**: `bugs`, `run_steps`, `modules`, `workspace_members`.

**Feature IDs**: FEAT-BUG-001..005.

**Numbered narrative**:
1. Bug provenance (module + ATC + run) is derived server-side from `run_step_id` — a bug cannot be filed against an unrelated module (re-validation 45300).
2. Lifecycle is **forward-only**, enforced twice: DB trigger (`bunkai_bugs_check_consistency`) + RPC; SQLSTATEs 45310/45311 reject skips/backwards.
3. Assignee eligibility is checked (workspace member, not viewer) — 45312/45313.
4. Heatmap aggregates by module — feeds defect trends without needing Jira.

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
3. Recovery-cycle metric derives from bug timestamps (open → resolved) — depends on upstream bug lifecycle correctness.

**What breaks if the API hangs here**: Home/API coverage divergence (sum/sum vs mean bug), stale traceability after ATC repoint, recovery metrics feeding minutes off a wrong bug state.

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
│  ROUTE HANDLER LAYER (Next.js 15 App Router, 64 route files)         │
│   withApiHandler({ auth, requires }) → Principal (resolveIdentity)   │
│    ├─ cookie session (supabase-ssr) ──┐  ┌─ bearer.ts (PAT verify)   │
│    └──────┬────────────────────┬──────┘  └──► mintUserJwt (AS user)  │
│   Session paths                │           Agent paths               │
│   (mutations, UI)              ▼                                     │
│                      unified Principal → handler logic               │
└───────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────────────┐
│  DATA ACCESS LAYER                                                    │
│   PostgREST (UI reads, RLS) · bunkai_* RPCs (~91, SECURITY DEFINER)  │
│   assertWorkspaceContext (ADR-0006) · RLS (auth.uid, helpers)        │
└───────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────────────┐
│  PERSISTENCE LAYER — Supabase (Postgres, 31 tables + auth + realtime)│
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
| Versioned REST (`/api/v1`) | Public API surface | Supabase Auth + RPCs + PostgREST reads | Thin wrapper — role gates in handlers, RLS underneath; 82 handlers to keep in contract tests |
| `bunkai_*` RPCs (~91) | Mutation/report layer | SECURITY DEFINER functions, SQLSTATEs (45200.., 45300.., 45500..) | RPC + trigger double layers must agree; SQLSTATE mapping to HTTP codes is a contract |
| PostgREST | Auto-generated REST | All 31 tables with RLS | Default UI read path — RLS bug = data leak |
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
| `runs` / `run_atcs` / `run_steps` | `/api/v1/runs*` (+ `tests/{id}/runs`) | `business-data-map.md` §1 runs cluster |
| `bugs` | `/api/v1/bugs*` (+ status, assign, heatmap, open-bugs) | `business-data-map.md` §1 bugs cluster |
| `atcs` + children | `/api/v1/atcs*` (+ search, usage, duplicate) | `business-data-map.md` §1 atcs cluster |
| `modules` / `user_stories` / `acceptance_criteria` | `/api/v1/modules*`, `/user-stories*`, `/acceptance-criteria*` + PostgREST | `business-data-map.md` §1 authoring cluster |
| `milestones` | `/api/v1/milestones*`, `/projects/{id}/milestones` | `business-data-map.md` §1 milestones |
| `import_jobs` | `/api/v1/imports*` | `business-data-map.md` §1 imports |
| `activity_log` / `notifications` / `notification_preferences` | `/activity`, `/notifications*`, `/notification-preferences` | `business-data-map.md` §1 collaboration cluster |

### Feature-map features this API backs

| Journey | Feature IDs |
|---------|-------------|
| Verification-first signup (J1) | FEAT-AUTH-001..007, FEAT-API-006 |
| Workspace & member onboarding (J2) | FEAT-WS-001..006, FEAT-API-008 |
| Run execution (J3) | FEAT-RUN-001..006, FEAT-TEST-001..005, FEAT-ENV-001..002, FEAT-API-003 |
| Bugs + triage (J4) | FEAT-BUG-001..005 |
| Coverage / traceability (J5) | FEAT-COV-001..004, FEAT-ATC-001..007 |
| Jira import (J6) | FEAT-IMPORT-001..002 |
| Activity / notifications (J7) | FEAT-ACT-001, FEAT-NOTIF-001..004, FEAT-WS-006 |

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
| OpenAPI spec vs 64 routes drift | MEDIUM | Not every route file may be documented in `public/openapi.json`; contract tests should diff route inventory against the spec (9 of 64+ endpoints verified by grep only). |
| Abort-reason redaction | MEDIUM | Run abort writes a reason that must be redacted from activity feed (0067). Untested cross-surface consistency (run detail vs feed). |
| Idempotency window semantics | MEDIUM | HTTP key vs 24h `start_token` interplay on `POST /runs`: hard-replay detection is functional now — test key reuse across/concurrent calls, and expiry at the 24h boundary. |
| Magic-link legacy coexistence | MEDIUM | `POST /auth/magic-link` coexists with verification-first confirm; canonical path unknown. Both must be tested, and the 409-no-echo invariant verified on both. |
| Jira import resilience | MEDIUM | No retry/backoff evidence in `import-runner`; crash leaves `running` forever; concurrent-import 409 is the only guard. Worker-failure simulation needed. |
| Notifications cross-workspace leak | MEDIUM | `entity_available` per-row RLS: verify a member never receives notifications for entities outside their workspaces, and read-all races. |
| Rate limiting | LOW | No application-layer rate limiting; 429s come from Supabase only. |
| Run timeout sweeper | LOW | Auto-abort of abandoned runs (15-min cron) is DB-level; no API endpoint exposes its state — QA must test via DB, not API. |

---