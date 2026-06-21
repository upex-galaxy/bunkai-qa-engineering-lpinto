# Business API Map — Bunkai (QA Lens)

> Generated: 2026-06-19
> Sources: `../upex-bunkai-tms/public/openapi.json`, `../upex-bunkai-tms/src/app/api/v1/`, `../upex-bunkai-tms/src/middleware.ts`, `../upex-bunkai-tms/lib/api/middleware/bearer.ts`
> Last verified against OpenAPI on 2026-06-19

---

## 1. Executive summary

Bunkai's API lets two distinct operator types interact with the same test-management data model: **human QA engineers** through a browser-based web app, and **AI agents / CI pipelines** through bearer-authenticated programmatic calls. The API surface is intentionally minimal — only 5 documented REST endpoints exist in the versioned `/api/v1` layer. Most data access flows through Supabase PostgREST (auto-generated REST from PostgreSQL views/tables) and Server Actions (Next.js RPC-style mutations), both gated by Row-Level Security (RLS) on every table.

The auth model splits cleanly: session cookies for browser users (Supabase SSR magic-link flow), Personal Access Tokens (PATs) for scripts and agents. Workspace membership roles (viewer → member → admin → owner) control what each caller can do across the tenant boundary.

Three critical business journeys dominate: **onboarding a workspace** (signup → workspace → project), **authoring an ATC** (story binding → steps → assertions → save), and **executing a run** (agent API flow or manual UI flow). Each journey crosses the API boundary differently — some through the versioned REST layer, others through PostgREST or Server Actions, all protected by RLS.

---

## 2. Permission & auth model

### Tier table

| Tier | Who it applies to | How to acquire | Where enforced (code path) |
|------|-------------------|----------------|---------------------------|
| Public | Unauthenticated callers | None — no credential required | `middleware.ts` allows `/api/v1/health`, `/api/v1/auth/*`, `/auth/*`, `/login` |
| Session-authenticated | Browser users (human QAs) | Magic link OTP via `POST /api/v1/auth/magic-link` → click link → `supabase.auth.exchangeCodeForSession()` → cookie auto-set | `middleware.ts` checks `getUser()`, redirects to `/login` on protected paths |
| PAT-authenticated | AI agents, CI/CD, scripts | Issue PAT via `POST /api/v1/tokens` (session-gated) → send `Authorization: Bearer bk_pat_<prefix>.<secret>` | `lib/api/middleware/bearer.ts` — parses prefix, SHA-256 compares, checks `revoked_at`/`expires_at`, returns `BearerContext` |
| Role-gated (workspace) | Workspace members | Assigned at workspace join | RLS policies via `bunkai_is_workspace_member()`, `bunkai_can_write_workspace()`, `bunkai_is_workspace_admin()`, `bunkai_is_workspace_owner()` SECURITY DEFINER helpers |
| Scope-gated (PAT) | PAT holders | Scopes set at token creation: `atc:read`, `atc:write`, `run:execute`, `workspace:admin` | `requireScope(scope)` guard in bearer middleware — checked per-route |

### Workspace member roles

```
viewer (read-only)
  ↓
member (read + write ATCs, runs)
  ↓
admin (manage members, edit workspace settings)
  ↓
owner (delete workspace, transfer ownership)
```

### Token flow — PAT auth scheme

```
┌──────────┐     POST /api/v1/tokens (cookie)     ┌──────────────┐
│  Browser  │ ──────────────────────────────────→   │  Supabase DB │
│  (session) │  ←── { token: "bk_pat_..." } ──────  │  (SHA-256    │
└──────────┘     (shown once, not stored)           │   hashed)    │
                                                     └──────┬───────┘
                                                            │
┌──────────┐     GET /api/v1/...                            │
│  Agent    │ ─── Authorization: Bearer bk_pat_... ──────→  │
│  / CLI    │                                               │
└──────────┘     bearer.ts:                                  │
                 1. Parse "bk_pat_<prefix>.<secret>"          │
                 2. Lookup token_prefix (indexed)            │
                 3. SHA-256(secret) == stored_hash?           │
                 4. revoked_at? expires_at?                    │
                 5. Scopes contain required scope?             │
                 ↓ OK                                        │
                 BearerContext { userId, workspaceId, scopes, tokenId }
```

### Token flow — Session cookie scheme

```
User enters email → POST /api/v1/auth/magic-link
  → Supabase GoTrue sends OTP email
  → User clicks link → GET /auth/callback?code=...
  → exchangeCodeForSession() → sb-*-auth-token cookie set
  → middleware.ts reads cookie → getUser() → session.user
  → Server Components / Route Handlers use supabase SSR client
  → RLS policies resolve via auth.uid()
```

### Protected API surface (by auth tier)

| Endpoint | Auth required | Scope required |
|----------|--------------|----------------|
| `GET /api/v1/health` | None | — |
| `POST /api/v1/auth/magic-link` | None | — |
| `GET /api/v1/tokens` | Session cookie | — |
| `POST /api/v1/tokens` | Session cookie | — |
| `DELETE /api/v1/tokens/{id}` | Session cookie | — |
| All `/api/v1/projects`, `/api/v1/modules`, etc. (PostgREST) | Session cookie or PAT bearer | RLS-enforced |

---

## 3. Critical business journeys

### Journey 1: User onboarding (Signup → First project)

**Business purpose**: A new user authenticates, creates a workspace, and lands on their first project ready to author ATCs.

```
  User             Browser           API Gateway        Supabase Auth      Supabase DB
   │                  │                  │                  │                  │
   │  Enter email     │                  │                  │                  │
   │────────────────→│                  │                  │                  │
   │                  │ POST /api/v1     │                  │                  │
   │                  │  /auth/magic-link│                  │                  │
   │                  │────────────────→│                  │                  │
   │                  │                  │                  │                  │
   │                  │                  │  signInWithOtp()│                  │
   │                  │                  │────────────────→│                  │
   │                  │                  │                  │── OTP email ──→  │
   │  Click magic     │                  │                  │                  │
   │  link            │                  │                  │                  │
   │────────────────→│                  │                  │                  │
   │                  │ GET /auth/callback?code=...          │                  │
   │                  │────────────────→│                  │                  │
   │                  │                  │ exchangeCodeForSession()           │
   │                  │                  │────────────────→│                  │
   │                  │                  │  ←── session cookie ──────────→   │
   │                  │                  │                  │                  │
   │                  │ Redirect /onboarding                │                  │
   │                  │←───────────────│                  │                  │
   │                  │                  │                  │                  │
   │  Fill workspace  │                  │                  │                  │
   │  name + slug     │                  │                  │                  │
   │────────────────→│                  │                  │                  │
   │                  │ Server Action:  │                  │                  │
   │                  │ bunkai_bootstrap_workspace() RPC    │                  │
   │                  │──────────────────────────────────────────────────────→│
   │                  │                  │                  │                  │
   │                  │                  │                  │  Create workspace│
   │                  │                  │                  │  + owner member  │
   │                  │                  │                  │  (atomic tx)     │
   │                  │                  │                  │                  │
   │                  │ Redirect /projects                  │                  │
   │                  │←───────────────│                  │                  │
```

**Endpoints involved**:
- `POST /api/v1/auth/magic-link` — public
- `GET /auth/callback?code=` — Supabase Auth handler
- Server Action: `bunkai_bootstrap_workspace(p_slug, p_name)` RPC

**Entities touched**: `auth.users`, `workspaces`, `workspace_members`

**Feature IDs**: Feature-map pending — no existing feature-map to cross-reference.

**Numbered narrative**:
1. User submits email via magic-link form → browser POSTs to `/api/v1/auth/magic-link`
2. API handler calls `supabase.auth.signInWithOtp()` → Supabase GoTrue sends email with one-time code
3. User clicks link → lands on `/auth/callback?code=...` → server calls `exchangeCodeForSession()` which sets the `sb-*-auth-token` session cookie
4. Middleware detects auth → redirects to `/projects`; since user has no workspace, middleware redirects to `/onboarding`
5. User fills workspace form (name + slug) → Server Action calls `bunkai_bootstrap_workspace()` RPC which atomically creates the workspace row + owner membership row
6. On success → redirect to `/projects` with workspace context in session

**What breaks if the API hangs here**: User is stuck at onboarding, cannot proceed to authoring. Cross-workspace isolation unverified → potential data leak.

---

### Journey 2: ATC authoring (Create ATC with steps + assertions)

**Business purpose**: A QA engineer creates a structured Acceptance Test Case bound to a user story and its acceptance criteria.

```
  QA Engineer         Browser (SSR)        Supabase PostgREST      Database
       │                    │                     │                   │
       │  Navigate to       │                     │                   │
       │  project page      │                     │                   │
       │─────────────────→  │                     │                   │
       │                    │  GET /rest/v1/      │                   │
       │                    │  modules?project_id=│                   │
       │                    │────────────────────→│                   │
       │                    │                     │───SELECT─────────→│
       │                    │  ←── module tree ───│                   │
       │                    │                     │                   │
       │                    │  GET /rest/v1/      │                   │
       │                    │  user_stories?      │                   │
       │                    │  module_id=in.(...)  │                   │
       │                    │────────────────────→│                   │
       │                    │                     │───SELECT─────────→│
       │                    │  ←── story list ────│                   │
       │                    │                     │                   │
       │  Open ATC editor   │                     │                   │
       │─────────────────→  │                     │                   │
       │                    │                     │                   │
       │  Write steps +     │                     │                   │
       │  assertions        │                     │                   │
       │─────────────────→  │                     │                   │
       │                    │ Server Action:      │                   │
       │                    │ saveAtcAction()     │                   │
       │                    │  → bunkai_save_atc  │                   │
       │                    │    RPC (atomic)     │                   │
       │                    │──────────────────────────────────────→│
       │                    │                     │                   │
       │                    │  ←── success ───────│                   │
       │  ←── UI updated ──│                     │                   │
```

**Endpoints involved**:
- Supabase PostgREST (auto-generated): `GET /rest/v1/modules`, `GET /rest/v1/user_stories`, etc.
- Server Action: `saveAtcAction` → `bunkai_save_atc()` RPC (not a REST endpoint)

**Entities touched**: `modules`, `user_stories`, `acceptance_criteria`, `atcs`, `atc_steps`, `atc_assertions`, `atc_acceptance_criteria`

**Feature IDs**: Feature-map pending.

**Numbered narrative**:
1. QA navigates to `/projects/{slug}` — page loads modules tree via PostgREST query (RLS-gated to workspace members)
2. QA selects module → stories load via PostgREST query filtered by module
3. QA opens ATC editor → fills title, layer (UI/API/Unit), steps (numbered markdown), assertions (YAML bullets), binds to user story + ACs
4. On save → Server Action calls `bunkai_save_atc` RPC which atomically replaces ATC header, steps, assertions, and AC bindings in one transaction
5. Components revalidate (`revalidatePath`) → UI reflects saved state

**What breaks if the API hangs here**: ATC creation fails silently (user loses work). RLS misconfiguration could leak ATCs across workspaces.

---

### Journey 3: Agent API run (Programmatic test execution)

**Business purpose**: An AI agent or CI pipeline executes a test by fetching its ATC chain, posting step results, and completing the run — all through bearer-authenticated API calls.

```
  Agent/CLI            API Gateway        Middleware         Database
       │                    │                 │                │
       │  GET /api/v1/      │                 │                │
       │  tests/{id}        │                 │                │
       │  ?expand=atcs      │                 │                │
       │─────────────────→  │                 │                │
       │                    │ bearer.ts:      │                │
       │                    │ validate PAT    │                │
       │                    │ check scopes    │                │
       │                    │ requireScope()  │                │
       │                    │ {'atc:read'}    │                │
       │                    │                 │                │
       │                    │  SELECT tests   │                │
       │                    │  + atcs + steps │                │
       │                    │  (RLS-gated)    │                │
       │                    │──────────────────────────────→  │
       │  ←── test with    │                 │                │
       │  expanded ATCs ───│                 │                │
       │                    │                 │                │
       │  POST /api/v1/     │                 │                │
       │  runs              │                 │                │
       │  Idempotency-Key:  │                 │                │
       │  uuid              │                 │                │
       │─────────────────→  │                 │                │
       │                    │ bearer.ts:      │                │
       │                    │ {'run:execute'} │                │
       │                    │ idempotency.ts  │                │
       │                    │  (skeleton)     │                │
       │                    │                 │                │
       │                    │  INSERT run     │                │
       │                    │  INSERT run_atcs│                │
       │                    │──────────────────────────────→  │
       │  ←── run_id ──────│                 │                │
       │                    │                 │                │
       │  POST /api/v1/     │                 │                │
       │  runs/{id}/steps   │                 │                │
       │  {step_id,status}  │                 │                │
       │─────────────────→  │                 │                │
       │                    │  UPDATE         │                │
       │                    │  run_steps      │                │
       │                    │  (cascade       │                │
       │                    │   recompute)    │                │
       │                    │──────────────────────────────→  │
       │                    │                 │                │
       │  POST /api/v1/     │                 │                │
       │  runs/{id}/finish  │                 │                │
       │─────────────────→  │                 │                │
       │                    │  UPDATE runs    │                │
       │                    │  status →       │                │
       │                    │  passed/failed  │                │
       │                    │──────────────────────────────→  │
       │  ←── run result ──│                 │                │
```

**Endpoints involved**:
- `GET /api/v1/tests/{id}?expand=atcs` (planned — not yet in OpenAPI)
- `POST /api/v1/runs` with `Idempotency-Key` header (planned)
- `POST /api/v1/runs/{id}/steps` (planned)
- `POST /api/v1/runs/{id}/finish` (planned)
- `GET /api/v1/tokens` — bearer token used here

**Entities touched**: `tests`, `test_steps`, `runs`, `run_atcs`, `run_steps`

**Feature IDs**: Feature-map pending.

**Numbered narrative**:
1. Agent authenticates with PAT via `Authorization: Bearer bk_pat_<prefix>.<secret>` — bearer middleware validates token, extracts `BearerContext`
2. Agent fetches test with expanded ATCs → API returns the ATC chain with steps and expected outcomes
3. Agent creates a run with idempotency key → API creates `runs` + `run_atcs` rows in pending state
4. Agent iterates through ATCs, POSTing each step result → API inserts `run_steps`, DB trigger recomputes `run_atcs.status`
5. Agent POSTs finish → API transitions `runs.status` to `passed` or `failed` based on aggregated results

**What breaks if the API hangs here**: Duplicate runs (idempotency key not yet implemented). Inconsistent run status if cascade recompute fails.

---

### Journey 4: Manual run + bug filing

**Business purpose**: A QA manually executes a test in the browser, marks steps pass/fail, and files a bug when a step fails — all within the Bunkai UI.

```
  QA (browser)          UI (SSR)           Supabase PostgREST       DB
       │                    │                     │                  │
       │  Open test page    │                     │                  │
       │─────────────────→  │                     │                  │
       │                    │  GET /rest/v1/       │                  │
       │                    │  tests?expand=atcs   │                  │
       │                    │────────────────────→│                  │
       │                    │                     │───SELECT────────→│
       │  ←── test tree ───│                     │                  │
       │                    │                     │                  │
       │  Start run         │                     │                  │
       │─────────────────→  │                     │                  │
       │                    │  POST /rest/v1/runs  │                  │
       │                    │────────────────────→│                  │
       │                    │                     │───INSERT────────→│
       │  Step A: pass      │                     │                  │
       │─────────────────→  │                     │                  │
       │                    │  PATCH /rest/v1/     │                  │
       │                    │  run_steps/{id}     │                  │
       │                    │────────────────────→│                  │
       │                    │                     │───UPDATE────────→│
       │  Step B: fail      │                     │                  │
       │─────────────────→  │                     │                  │
       │                    │  PATCH run_steps     │                  │
       │                    │────────────────────→│                  │
       │                    │                     │───UPDATE────────→│
       │                    │                     │  trigger:        │
       │                    │                     │  recompute       │
       │                    │                     │  run_atcs.status │
       │  File bug          │                     │                  │
       │─────────────────→  │                     │                  │
       │                    │  POST /rest/v1/bugs  │                  │
       │                    │────────────────────→│                  │
       │                    │                     │───INSERT────────→│
       │  ←── bug created  │                     │                  │
```

**Endpoints involved**:
- Supabase PostgREST: `GET /rest/v1/tests`, `POST /rest/v1/runs`, `PATCH /rest/v1/run_steps`, `POST /rest/v1/bugs`

**Entities touched**: `tests`, `runs`, `run_atcs`, `run_steps`, `bugs`

**Feature IDs**: Feature-map pending.

**Numbered narrative**:
1. QA opens a test page — UI fetches test with expanded ATCs via PostgREST
2. QA clicks "Start run" → POST creates `runs` row with status `running`, creates child `run_atcs` in `pending`
3. QA marks each step pass/fail → PATCH updates `run_steps`, DB trigger recomputes parent `run_atcs.status` via `CASE WHEN` aggregation
4. When a step fails → QA can file a bug via POST to `bugs` table, linked to `run_id` + `atc_id` + `module_id`
5. Run completes → status transitions to `passed` (all pass) or `failed` (any fail)

**What breaks if the API hangs here**: Lost step results if PATCH fails mid-run. Bug without run context if POST fails after step result.

---

### Journey 5: Cross-workspace isolation

**Business purpose**: Verify that workspace B users cannot see, modify, or delete data belonging to workspace A — the core tenancy guarantee.

**API boundary**: Every PostgREST query goes through RLS policies that check `bunkai_is_workspace_member(ws_id)` and role-based helpers. PATs are scoped to workspace. Session cookies resolve to `auth.uid()` which RLS uses to check `workspace_members`.

**Endpoints involved**: All `/rest/v1/*` PostgREST endpoints (enforced by RLS, not by application middleware)

**Entities touched**: All tables with `workspace_id` FK — `projects`, `modules`, `user_stories`, `atcs`, `tests`, `runs`, `bugs`

**Feature IDs**: Feature-map pending.

**Cross-workspace test pattern**:
1. Create entity in Workspace A
2. As Workspace B member → LIST entities → expect 0 results
3. As Workspace B member → READ entity by ID → expect 403 or 404
4. As Workspace B member → DELETE entity → expect 403

---

## 4. Architecture behind the API

### Layered diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Browser  │  │  CLI     │  │  CI/CD   │  │  AI Agent        │  │
│  │ (React)  │  │  (curl)  │  │ (GitHub) │  │  (MCP Client)    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘  │
│       │             │             │                 │              │
│  ┌────▼─────────────▼─────────────▼─────────────────▼──────────┐  │
│  │  EDGE / GATEWAY                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  Vercel Edge Network (CDN + middleware.ts)             │  │  │
│  │  │  - Auth redirects (session check)                     │  │  │
│  │  │  - Static asset serving                               │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API / ROUTE HANDLER LAYER (Next.js 15 App Router)          │  │
│  │                                                              │  │
│  │  ┌────────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │  Versioned REST API    │  │  Server Actions            │  │  │
│  │  │  (/api/v1/*)           │  │  (saveAtcAction, etc.)     │  │  │
│  │  │                        │  │                            │  │  │
│  │  │  - withApiHandler()    │  │  - Direct RPC calls        │  │  │
│  │  │  - bearer middleware   │  │  - revalidatePath()        │  │  │
│  │  │  - idempotency (skel)  │  │  - Session-only (no PAT)   │  │  │
│  │  │  - request ID + log    │  │                            │  │  │
│  │  └───────────┬────────────┘  └───────────┬────────────────┘  │  │
│  │              │                            │                    │  │
│  │  ┌───────────▼────────────────────────────▼────────────────┐  │  │
│  │  │  Supabase PostgREST (auto-generated REST)               │  │  │
│  │  │  - Read queries for UI (modules, stories, ATCs, etc.)  │  │  │
│  │  │  - CRUD on runs, steps, bugs                            │  │  │
│  │  │  - RLS policies on EVERY row                            │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PERSISTENCE LAYER (Supabase — managed Postgres 16)         │  │
│  │                                                              │  │
│  │  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │  │
│  │  │  PostgreSQL │  │  GoTrue  │  │  Storage │  │  Realtime │  │  │
│  │  │  (24 tbls)  │  │  Auth    │  │  (future)│  │  (future) │  │  │
│  │  │             │  │          │  │          │  │           │  │  │
│  │  │  - RLS      │  │  Magic   │  │          │  │           │  │  │
│  │  │  - Triggers │  │  link    │  │          │  │           │  │  │
│  │  │  - Sec def  │  │  OTP     │  │          │  │           │  │  │
│  │  │    helpers   │  │          │  │          │  │           │  │  │
│  │  └─────────────┘  └──────────┘  └──────────┘  └───────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  EXTERNAL INTEGRATIONS (planned / configured)                │  │
│  │  ┌──────────┐  ┌──────────┐                                  │  │
│  │  │  Resend  │  │  Jira    │                                  │  │
│  │  │  (email) │  │  (sync)  │                                  │  │
│  │  └──────────┘  └──────────┘                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Component table

| Component | Role | Persistence / Integrations touched | Why it matters for QA |
|-----------|------|-----------------------------------|-----------------------|
| `middleware.ts` | Edge auth gate | Supabase SSR `getUser()` | Session expiry redirects users mid-flow |
| `withApiHandler()` | Request lifecycle | Structured logging, error mapping | Consistent error envelopes — test against `ErrorEnvelope` schema |
| `bearer.ts` | PAT validation | `access_tokens` table (indexed `token_prefix`) | Token revocation lag is immediate (DB read per request) |
| Versioned REST (`/api/v1`) | Public API surface | Supabase Auth + DB via RPC | Thin wrapper — most business logic is in RLS, not in handlers |
| Server Actions | Browser mutations | Supabase RPC (`bunkai_save_atc`) | Not callable from PAT — only session flows. Agentic paths bypass this layer |
| PostgREST | Auto-generated REST | All 24 tables with RLS | Default data access path for UI — RLS bugs = data leaks |
| RLS policies | Row-level authorization | All tables via SECURITY DEFINER helpers | **Single most critical component** — a bug here is a data leak |
| DB triggers | Status recomputation | `run_steps` → `run_atcs` → `runs` | Cascade failures produce inconsistent run states |
| OpenAPI spec | API documentation | Auto-generated from Zod schemas | Source of truth for contract — spec vs implementation drift |

---

## 5. External integrations

| Service | Trigger | Direction | Failure mode (user-visible) | Journeys affected |
|---------|---------|-----------|-----------------------------|-------------------|
| Supabase GoTrue (Auth) | `POST /api/v1/auth/magic-link` | Outbound sync | 5xx → email not sent, user cannot log in | User onboarding (J1) |
| Supabase GoTrue (Auth) | `GET /auth/callback` | Inbound | OTP exchange fails → blank page, no session | User onboarding (J1) |
| Resend (email) | Planned — magic-link delivery via SMTP | Outbound async | N/A — not yet wired in code | N/A |
| Jira (Atlassian) | Planned — webhook sync | Bidirectional | N/A — not yet wired in code | N/A |
| Supabase PostgREST | All UI CRUD queries | Auto-generated | 5xx → blank pages, save failures | All journeys |
| Supabase DB triggers | `run_steps` INSERT/UPDATE | Internal | Non-atomic cascade → stale run status | Agent run (J3), Manual run (J4) |

**Current state**: Zero external third-party SDKs in `package.json`. Supabase is the sole backend dependency — auth, database, and auto-generated REST are all within the Supabase ecosystem. Resend and Jira are configured in `.env.example` but not wired in application code.

---

## 6. Cross-references

### Data-map entities this API exposes

| Entity | How API exposes it | Data-map anchor |
|--------|-------------------|-----------------|
| `workspaces` | PostgREST + RPC `bunkai_bootstrap_workspace()` | `business-data-map.md` §1 #1 |
| `workspace_members` | PostgREST (RLS-gated) | `business-data-map.md` §1 #2 |
| `workspace_invites` | Planned PostgREST | `business-data-map.md` §1 #3 |
| `access_tokens` | `GET/POST /api/v1/tokens`, `DELETE /api/v1/tokens/{id}` | `business-data-map.md` §1 #4 |
| `projects` | PostgREST | `business-data-map.md` §1 #5 |
| `modules` | PostgREST | `business-data-map.md` §1 #6 |
| `environments` | PostgREST | `business-data-map.md` §1 #7 |
| `integrations` | PostgREST | `business-data-map.md` §1 #8 |
| `user_stories` | PostgREST | `business-data-map.md` §1 #9 |
| `acceptance_criteria` | PostgREST | `business-data-map.md` §1 #10 |
| `atcs` | PostgREST + Server Action `saveAtcAction` → RPC | `business-data-map.md` §1 #11 |
| `atc_steps` | Embedded in ATC save RPC | `business-data-map.md` §1 #12 |
| `atc_assertions` | Embedded in ATC save RPC | `business-data-map.md` §1 #13 |
| `atc_acceptance_criteria` | Embedded in ATC save RPC | `business-data-map.md` §1 #14 |
| `tests` | PostgREST (planned `/api/v1/tests` endpoint) | `business-data-map.md` §1 #15 |
| `test_steps` | PostgREST | `business-data-map.md` §1 #16 |
| `runs` | PostgREST (planned `/api/v1/runs` endpoint) | `business-data-map.md` §1 #17 |
| `run_atcs` | PostgREST (auto-created by trigger) | `business-data-map.md` §1 #18 |
| `run_steps` | PostgREST | `business-data-map.md` §1 #19 |
| `bugs` | PostgREST | `business-data-map.md` §1 #20 |
| `activity_log` | PostgREST | `business-data-map.md` §1 #21 |
| `idempotency_keys` | Planned (skeleton middleware exists) | `business-data-map.md` §1 #22 |
| `feature_flags` | PostgREST | `business-data-map.md` §1 #23 |
| `imports` | PostgREST | `business-data-map.md` §1 #24 |

### Feature-map features this API backs

**Feature-map does not exist yet.** No FEAT-IDs to cross-reference. See §Discovery Gaps.

### OpenAPI spec location

- **Generated spec**: `../upex-bunkai-tms/public/openapi.json` (OpenAPI 3.1, 529 lines)
- **Served at**: `GET /api/openapi` (force-static, cached 300s)
- **UI**: `GET /api/docs` — Scalar API reference
- **Generation pipeline**: Zod schemas → `@asteasolutions/zod-to-openapi` → `scripts/openapi-gen.ts` → `public/openapi.json`
- **TypeScript types**: `api/schemas/` via `bun run api:sync` (OpenAPI → TypeScript)

### Event / webhook surface

- **No webhooks implemented yet.** The OpenAPI spec lists an empty `webhooks: {}` section. The `integrations` table schema exists but no webhook dispatch code is wired.

---

## 7. Discovery gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| `business-feature-map.md` missing | MEDIUM | Journey-to-feature cross-references are placeholders. No FEAT-IDs to anchor against. Generate via `/business-feature-map` command. |
| `/api/v1/runs` endpoints not yet in OpenAPI | HIGH | Agent API Run journey (J3) is traced from planned endpoints — the actual route files do not exist yet. Contract testing cannot begin. |
| Idempotency middleware is skeleton-only | MEDIUM | `idempotency.ts` validates header format but has no replay store (`idempotency_keys` table is unused). Duplicate POST detection is absent — QA must test with deliberate replays. |
| Auth code paths for PAT not fully observable | LOW | The `bearer.ts` middleware exists and is importable, but no versioned endpoint currently uses `requireBearerToken()` + `requireScope()`. The middleware is effectively untested in production. |
| Resend email integration not wired | LOW | `RESEND_API_KEY` is in `.env.example` but no `resend` SDK is in `package.json`. Magic-link delivery relies entirely on Supabase GoTrue's built-in email (no custom SMTP). |
| Jira sync not implemented | LOW | `integrations` table and `Jira` env vars exist but no sync code. Bug filing is native (Bunkai `bugs` table) with no external push. |
| RLS policy audit needed | MEDIUM | Authorization relies entirely on RLS policies. If a future endpoint bypasses PostgREST (e.g., adds a new `/api/v1` route with direct DB access), it must re-implement the same checks or risk data leaks. |
| No rate limiting | LOW | Rate limits are mentioned in OpenAPI (429 for magic-link OTP) but enforced by Supabase, not by the application layer. No application-level rate limiting exists. |
| Run timeout sweeper not inspectable via API | LOW | The auto-abort mechanism for abandoned runs (every 15 min) is a DB-level cron — no API endpoint exposes its state or allows manual trigger. |
