# Business Feature Map — Bunkai (QA Lens)

> Generated: 2026-06-19
> Sources: `../upex-bunkai-tms/src/app/`, `../upex-bunkai-tms/src/components/`, `../upex-bunkai-tms/supabase/migrations/`, `../upex-bunkai-tms/public/openapi.json`, `../upex-bunkai-tms/src/lib/`, `../upex-bunkai-tms/src/middleware.ts`
> Cross-refs: `.context/business/business-data-map.md`, `.context/business/business-api-map.md`

---

## 1. Inventory summary

| Category | Features | Status |
|----------|----------|--------|
| Auth & identity | 5 | Stable |
| Workspace & tenancy | 4 | Stable |
| Project & module tree | 3 | Stable |
| ATC authoring | 6 | Stable |
| API layer | 6 | Stable |
| Token management | 3 | Stable |
| Search & discovery | 2 | Planned / WIP |
| Execution engine | 2 | Planned |
| Integrations | 2 | Planned |
| UI / UX | 5 | Mixed (stable + planned) |
| **Total** | **38** | |

---

## 2. Feature catalog (by domain)

### 2.1 Auth & identity

#### Feature: Magic-link authentication

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-001 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/auth/magic-link` |
| **UI** | `MagicLinkForm` (email input + submit) |
| **Users** | Unauthenticated visitors |
| **Dependencies** | Supabase GoTrue (OTP) |
| **Evidence** | `app/(auth)/login/magic-link-form.tsx`, `app/api/v1/auth/magic-link/route.ts` |

**Capabilities:**
- [x] Enter email → receive magic link
- [x] Click link → OTP exchange → session cookie set
- [x] Redirect to `/projects` or custom `next` path
- [x] Open-redirect guard on callback
- [ ] Custom SMTP via Resend (configured but not wired)

#### Feature: Session-based auth (browser)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-002 |
| **Status** | Stable |
| **Endpoints** | None (middleware layer) |
| **UI** | All authenticated pages behind middleware gate |
| **Users** | Authenticated browser users |
| **Dependencies** | Supabase SSR (`@supabase/ssr`) |
| **Evidence** | `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts` |

**Capabilities:**
- [x] Cookie-based session management
- [x] Protected route redirect to `/login?next=`
- [x] `AuthProvider` React context with `useAuth` hook
- [x] Sign-out flow

#### Feature: OAuth providers (GitHub, Google)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-003 |
| **Status** | Planned ("next sprint") |
| **Endpoints** | None |
| **UI** | Disabled buttons on login page |
| **Users** | Unauthenticated visitors |
| **Evidence** | `app/(auth)/login/page.tsx` lines 136-155 |

**Capabilities:**
- [ ] GitHub OAuth button (disabled, "soon" label)
- [ ] Google OAuth button (disabled, "soon" label)

#### Feature: SSO login

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-004 |
| **Status** | Planned (Phase 2) |
| **Evidence** | Login page references |

#### Feature: Personal Access Tokens (PATs)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-005 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/tokens`, `POST /api/v1/tokens`, `DELETE /api/v1/tokens/{id}` |
| **UI** | Token management (planned in UI — API-only for now) |
| **Users** | Authenticated browser users (issuance), agents/CLI (consumption) |
| **Dependencies** | `access_tokens` table, SHA-256 hashing, `bearer.ts` middleware |
| **Evidence** | `app/api/v1/tokens/route.ts`, `lib/api/middleware/bearer.ts`, migration 0008 |

**Capabilities:**
- [x] Issue PAT with scope selection (`atc:read`, `atc:write`, `run:execute`, `workspace:admin`)
- [x] List caller's active tokens
- [x] Soft-revoke token (sets `revoked_at`)
- [x] Token format `bk_pat_<prefix>.<secret>` — shown once
- [x] Bearer middleware validates on every request
- [x] Workspace-scoped or cross-workspace tokens
- [x] TTL up to 365 days

---

### 2.2 Workspace & tenancy

#### Feature: Workspace onboarding

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-001 |
| **Status** | Stable |
| **Endpoints** | RPC `bunkai_bootstrap_workspace()` |
| **UI** | `OnboardingForm` (name + slug) |
| **Users** | New users after first login |
| **Dependencies** | RLS helper functions (migration 0005) |
| **Evidence** | `app/(app)/onboarding/`, `lib/supabase/rpc.ts`, migration 0006 |

**Capabilities:**
- [x] Create workspace with slug (3-40 chars, lowercase/digits/hyphens)
- [x] Atomic creation of workspace + owner membership
- [x] Redirect to `/projects` on success

#### Feature: Workspace membership & RBAC

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-002 |
| **Status** | Stable (schema + RLS) |
| **UI** | No member management UI yet (API + DB only) |
| **Users** | Workspace admins/owners |
| **Dependencies** | `workspace_members` table, RLS helpers |
| **Evidence** | Migration 0001, migration 0005 |

**Roles:** viewer → member → admin → owner

**Capabilities:**
- [x] Role-based access via RLS on every table
- [x] SECURITY DEFINER helper functions prevent infinite recursion
- [ ] Member invite flow (planned - `workspace_invites` table exists but no UI)

#### Feature: Workspace/project switcher

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-003 |
| **Status** | Partial (UI exists, multi-workspace switching not wired) |
| **UI** | `WorkspaceSwitcher` component |
| **Evidence** | `components/layout/WorkspaceSwitcher.tsx` |

**Capabilities:**
- [x] Display current workspace + project name
- [ ] Multi-workspace selection (Phase E)

#### Feature: Cross-workspace isolation

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-004 |
| **Status** | Stable (RLS-enforced) |
| **Evidence** | All migrations, all RLS policies |

**Capabilities:**
- [x] Data isolation by `workspace_id` FK on all tenant entities
- [x] RLS policies using helper functions
- [x] PATs optionally scoped to single workspace

---

### 2.3 Project & module tree

#### Feature: Project management

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-001 |
| **Status** | Partial (schema exists, no creation UI) |
| **Endpoints** | PostgREST CRUD |
| **UI** | Project dashboard (listing + redirect) |
| **Users** | Workspace members |
| **Evidence** | Migration 0002, `app/(app)/projects/page.tsx` |

**Capabilities:**
- [x] View project dashboard with modules/ATCs/stories
- [x] Auto-redirect to first project on workspace entry
- [ ] Project creation UI (empty-state placeholder only)
- [ ] Project settings or deletion

#### Feature: Module tree

| Aspect | Value |
|-------|--------|
| **ID** | FEAT-PROJ-002 |
| **Status** | Stable |
| **UI** | `Sidebar` (expand/collapse tree), `AtcTable` (module path column) |
| **Users** | Workspace members |
| **Dependencies** | `buildModuleTree()` in `lib/tree.ts` |
| **Evidence** | `components/layout/Sidebar.tsx`, `lib/tree.ts`, migration 0002 |

**Capabilities:**
- [x] Self-referential tree (max depth 6)
- [x] Materialized path for fast ancestry queries
- [x] Expand/collapse in sidebar
- [x] Nested display: modules → user stories → ACs → ATCs

#### Feature: ATC table view

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-003 |
| **Status** | Stable |
| **UI** | `AtcTable` (sortable, `@tanstack/react-table`) |
| **Users** | Workspace members |
| **Evidence** | `components/atcs/AtcTable.tsx` |

**Capabilities:**
- [x] Sortable columns: ID, Title, Layer, Module path, Status, Tags
- [x] Layer chips (UI/API/Unit with color coding)
- [x] Status indicators (dot + chip)
- [x] ATC count per project
- [x] Click row → navigate to ATC editor

---

### 2.4 ATC authoring

#### Feature: ATC editor (full)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-001 |
| **Status** | Stable |
| **UI** | `AtcEditor` (title, layer, steps, assertions, tags, anchoring) |
| **Users** | Workspace members (role ≥ member) |
| **Dependencies** | `bunkai_save_atc` RPC, `saveAtcAction` Server Action |
| **Evidence** | `components/atcs/AtcEditor.tsx`, `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts` |

**Capabilities:**
- [x] Title input
- [x] Layer toggle (UI / API / Unit)
- [x] Steps editor (Monaco, markdown, numbered list parser)
- [x] Assertions editor (Monaco, YAML, bullet parser)
- [x] Tags input (enter-to-add, click-to-remove)
- [x] Anchoring panel (user story + AC binding)
- [x] Save disabled until anchored to story + AC + title present
- [x] Atomic save via `bunkai_save_atc` RPC (version bump + full-replace)
- [x] Server Action → RPC → DB → revalidate

#### Feature: ATC anchoring

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-002 |
| **Status** | Stable |
| **UI** | `AnchoringPanel` (story search + AC checkboxes) |
| **Evidence** | `components/atcs/AnchoringPanel.tsx` |

**Capabilities:**
- [x] Search filter for user stories
- [x] Selectable story → shows AC checklist
- [x] M:N binding via `atc_acceptance_criteria` join table
- [x] Visual "valid/missing" status indicator

#### Feature: ATC step/assertion parsing

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-003 |
| **Status** | Stable |
| **Evidence** | `lib/atc-parse.ts` |

**Capabilities:**
- [x] Markdown numbered list → structured `AtcStep[]`
- [x] YAML bullet list → structured `AtcAssertion[]`
- [x] Round-trip serialization (data → markdown/YAML)

#### Feature: Monaco code editor

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-004 |
| **Status** | Stable |
| **UI** | `StepEditor` (dynamic import, SSR disabled) |
| **Evidence** | `components/atcs/StepEditor.tsx` |

**Capabilities:**
- [x] Configurable height
- [x] Line numbers
- [x] Word wrap
- [x] Dynamic import (no SSR)

#### Feature: ATC versioning

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-005 |
| **Status** | Stable (basic — version bump on save, no history) |
| **Evidence** | Migration 0004 (`atcs.version`), migration 0007 (`bunkai_save_atc` bumps version) |

**Capabilities:**
- [x] Version increment on every save
- [ ] Version history or rollback (not implemented)
- [ ] Diff between versions (not implemented)

#### Feature: ATC status management

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-006 |
| **Status** | Stable (schema + database trigger for tsv refresh) |
| **Evidence** | Migration 0004 (`atcs.status` enum: pass/fail/blocked/skipped/running/unrun) |

**Capabilities:**
- [x] Status enum with 6 states
- [x] `tsvector` search column refreshed on title/tag change
- [x] GIN index for full-text search
- [ ] Status transitions via API (planned for runs engine)

---

### 2.5 API layer

#### Feature: API error envelope

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-001 |
| **Status** | Stable |
| **Endpoints** | All `/api/v1/*` routes |
| **Evidence** | `lib/api/error-envelope.ts`, `lib/api/handler.ts` |

**12 error codes:** `bad_request`, `validation_failed`, `unauthorized`, `forbidden`, `not_found`, `method_not_allowed`, `conflict`, `idempotency_key_required`, `idempotency_key_invalid`, `rate_limited`, `internal_error`, `upstream_error`

**Capabilities:**
- [x] Consistent `{ error: { code, message, details?, request_id? } }` shape
- [x] ZodError → 422 with details
- [x] Request ID in responses and logs

#### Feature: Request lifecycle middleware

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-002 |
| **Status** | Stable |
| **Endpoints** | All `/api/v1/*` routes via `withApiHandler()` |
| **Evidence** | `lib/api/handler.ts`, `lib/api/request-id.ts`, `lib/api/logging.ts` |

**Capabilities:**
- [x] `x-request-id` generation and propagation
- [x] Structured JSON logging (single line, stdout/stderr)
- [x] Centralized error mapping
- [x] Request duration tracking

#### Feature: Idempotency key validation

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-003 |
| **Status** | Partial (skeleton — validates header format only) |
| **Evidence** | `lib/api/idempotency.ts` |

**Capabilities:**
- [x] Header shape validation
- [ ] Replay store (`idempotency_keys` table exists but unused)

#### Feature: OpenAPI spec generation

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-004 |
| **Status** | Stable |
| **Endpoints** | `GET /api/openapi` (static file, force-cached 300s), `GET /api/docs` (Scalar UI) |
| **Dependencies** | `@asteasolutions/zod-to-openapi`, `@scalar/api-reference-react` |
| **Evidence** | `lib/openapi/registry.ts`, `scripts/openapi-gen.ts`, `app/api/openapi/route.ts` |

**Capabilities:**
- [x] Auto-generated OpenAPI 3.1 spec from Zod schemas
- [x] 3 registered tags: Health, Auth, Tokens
- [x] Bearer + cookie security schemes documented
- [x] Interactive docs UI at `/api/docs`
- [x] Reusable components: `ErrorEnvelope`, `MagicLinkBody/Response`, `CreateTokenBody/Response`, `HealthResponse`, `TokenSummary`

#### Feature: API health probe

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-005 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/health` |
| **Evidence** | `app/api/v1/health/route.ts` |

**Capabilities:**
- [x] Returns `{ ok, service, env, ts }`
- [x] Public — no auth required
- [x] Environment-aware (local/staging/production)

#### Feature: Bearer token middleware

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-006 |
| **Status** | Stable (code exists, no route uses it yet) |
| **Evidence** | `lib/api/middleware/bearer.ts` |

**Capabilities:**
- [x] PAT prefix lookup (indexed, O(1))
- [x] SHA-256 hash comparison
- [x] `revoked_at` / `expires_at` check
- [x] `requireScope()` guard per route
- [ ] No route handler currently calls `requireBearerToken()`

---

### 2.6 Search & discovery

#### Feature: Full-text ATC search

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-SEARCH-001 |
| **Status** | Partial (DB infrastructure ready, no search UI) |
| **Evidence** | Migration 0004 (`tsv` column, GIN index, `atcs_refresh_tsv` trigger) |

**Capabilities:**
- [x] `tsvector` column auto-refreshed on title/tag changes
- [x] GIN index for performant full-text search
- [ ] Search UI (command palette stub exists but fuzzy search not wired)

#### Feature: Command palette (⌘K)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-SEARCH-002 |
| **Status** | WIP (stub UI, no fuzzy search) |
| **UI** | `CommandPalette` component |
| **Evidence** | `components/layout/CommandPalette.tsx` |

---

### 2.7 Token management

#### Feature: Issue PAT

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TOKEN-001 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/tokens` |
| **Evidence** | `app/api/v1/tokens/route.ts` |

#### Feature: List PATs

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TOKEN-002 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/tokens` |
| **Evidence** | `app/api/v1/tokens/route.ts` |

#### Feature: Revoke PAT

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TOKEN-003 |
| **Status** | Stable |
| **Endpoints** | `DELETE /api/v1/tokens/{id}` |
| **Evidence** | `app/api/v1/tokens/[id]/route.ts` |

---

### 2.8 Planned features

#### Feature: Run execution engine

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-001 |
| **Status** | Planned (Phase 2+) |
| **Evidence** | `run:execute` scope defined (migration 0008), no run infrastructure in code |

**Capabilities:**
- [ ] Create run from test chain
- [ ] POST step results
- [ ] Finish run (passed/failed/aborted)
- [ ] Idempotent replay

#### Feature: Jira bidirectional sync

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-INT-001 |
| **Status** | Planned (Phase 3) |
| **Evidence** | `integrations` table exists (migration 0008), `ATLASSIAN_*` env vars configured |

#### Feature: Resend email integration

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-INT-002 |
| **Status** | Planned (configured but not wired) |
| **Evidence** | `RESEND_API_KEY` in `.env.example`, no `resend` SDK in `package.json` |

#### Feature: Agentic execution mode

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-002 |
| **Status** | Planned (Phase 2) |
| **Evidence** | `phase2.agentic_mode` flag documented in SRS |

#### Feature: Semantic search

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-SEARCH-003 |
| **Status** | Planned (Phase 2) |
| **Evidence** | `phase2.semantic_search` flag documented in SRS |

#### Feature: Mind-map visualization

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-UI-005 |
| **Status** | Planned (Phase 2) |
| **Evidence** | `phase2.mind_map` flag documented in SRS |

---

## 3. CRUD matrix

| Entity | Create | Read | Update | Delete | Evidence |
|--------|--------|------|--------|--------|----------|
| `workspaces` | ✅ RPC `bunkai_bootstrap_workspace()` | ✅ RLS-gated | ⚠️ Owner only | ⚠️ Owner only | Migration 0001, 0006 |
| `workspace_members` | ⚠️ Via invite (planned) | ✅ Self/admin | ⚠️ Admin/owner | ⚠️ Admin/owner | Migration 0001 |
| `workspace_invites` | ❌ Planned | ❌ | ❌ | ❌ | Migration 0001 (table only) |
| `access_tokens` | ✅ `POST /api/v1/tokens` | ✅ `GET /api/v1/tokens` | ❌ No update | ⚠️ Soft-revoke `DELETE /api/v1/tokens/{id}` | Migration 0008 |
| `projects` | ❌ No creation UI | ✅ | ⚠️ Soft-delete | ⚠️ Soft-delete | Migration 0002 |
| `modules` | ❌ No creation UI | ✅ | ❌ | ❌ | Migration 0002 |
| `user_stories` | ❌ No creation UI | ✅ | ❌ | ❌ | Migration 0003 |
| `acceptance_criteria` | ❌ No creation UI | ✅ | ❌ | ❌ | Migration 0003 |
| `atcs` | ✅ `saveAtcAction` (first save = create) | ✅ | ✅ `saveAtcAction` (full-replace) | ⚠️ Soft-delete planned | Migration 0004, 0007 |
| `atc_steps` | ✅ Embedded in ATC save | ✅ Embedded in ATC | ✅ Embedded in ATC save | ✅ Embedded in ATC save | Migration 0004, 0007 |
| `atc_assertions` | ✅ Embedded in ATC save | ✅ Embedded in ATC | ✅ Embedded in ATC save | ✅ Embedded in ATC save | Migration 0004, 0007 |
| `atc_acceptance_criteria` | ✅ Embedded in ATC save | ✅ Embedded in ATC | ✅ Embedded in ATC save | ✅ Embedded in ATC save | Migration 0004, 0007 |
| `tests` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |
| `test_steps` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |
| `runs` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated (scope exists) |
| `run_atcs` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |
| `run_steps` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |
| `bugs` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |
| `activity_log` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |
| `idempotency_keys` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated (table ref'd in code) |
| `feature_flags` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |
| `imports` | ❌ Planned | ❌ | ❌ | ❌ | Not yet migrated |

**Legend:** ✅ Full, ⚠️ Partial/conditional, ❌ Not available

**Key observation:** Only `access_tokens` and `atcs` have full CRUD via the versioned API. All other entities are read-only through PostgREST (RLS-gated) with no creation/update UI. The system is in early stage — CRUD for remaining entities is planned for Phase 2.

---

## 4. API endpoint inventory

### Health

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/v1/health` | Liveness probe — `{ ok, service, env, ts }` | Public |

### Auth

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `POST` | `/api/v1/auth/magic-link` | Send OTP email via Supabase GoTrue | Public |
| `GET` | `/auth/callback` | Exchange OTP code for session cookie | Public (code-based) |

### Tokens

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/v1/tokens` | List caller's PATs (no secret hash) | Session cookie |
| `POST` | `/api/v1/tokens` | Issue new PAT — returns raw secret once | Session cookie |
| `DELETE` | `/api/v1/tokens/{id}` | Soft-revoke PAT (sets `revoked_at`) | Session cookie |

### OpenAPI

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/openapi` | Serve auto-generated OpenAPI 3.1 spec | Public |
| `GET` | `/api/docs` | Scalar interactive API reference UI | Public |

### Supabase PostgREST (auto-generated, used by UI)

| Method | Endpoint pattern | Purpose | Auth |
|--------|-----------------|---------|------|
| `GET` | `/rest/v1/modules?project_id=eq.{id}` | Load module tree | RLS |
| `GET` | `/rest/v1/user_stories?module_id=in.(...)` | Load stories for module | RLS |
| `GET` | `/rest/v1/acceptance_criteria?user_story_id=eq.{id}` | Load ACs for story | RLS |
| `GET` | `/rest/v1/atcs?project_id=eq.{id}` | Load ATCs for project | RLS |
| `POST` | `/rest/v1/runs` | Create manual run | RLS |
| `PATCH` | `/rest/v1/run_steps/{id}` | Update step result | RLS |
| `POST` | `/rest/v1/bugs` | File bug | RLS |

### Server Actions

| Action | Called from | Purpose | Auth |
|--------|-------------|---------|------|
| `saveAtcAction` | ATC editor | Atomic save ATC (header + steps + assertions + AC bindings) | Session (Server Action) |

---

## 5. UI component inventory

### Forms

| Component | Route | Purpose | Fields |
|-----------|-------|---------|--------|
| `MagicLinkForm` | `/login` | Sign in via email | `email` (text), submit button |
| `OnboardingForm` | `/onboarding` | Create workspace | `name` (text), `slug` (auto-generated), validation |
| `AtcEditor` | `/projects/[slug]/atcs/[id]` | Full ATC authoring | `title`, `layer` (toggle), `steps` (Monaco markdown), `assertions` (Monaco YAML), `tags` (chips) |

### Dashboards / Views

| Component | Route | Purpose | Data loaded |
|-----------|-------|---------|-------------|
| `AtcTable` | `/projects/[slug]` | Sortable ATC inventory | `atcs`, `modules`, `user_stories` |
| `Sidebar` | `/projects/[slug]` | Project tree explorer | `modules`, `user_stories`, `acceptance_criteria`, `atcs` |
| `Topbar` | `/projects/[slug]` | Navigation + breadcrumb | Project context |
| `WorkspaceSwitcher` | `/projects/[slug]` | Workspace/project display | Workspace + project name |
| `DesignTokens` | `/design-tokens` | Design system reference | Static |

### Actions / Modals / Dialogs

| Component | Route | Purpose |
|-----------|-------|---------|
| `AnchoringPanel` | `/projects/[slug]/atcs/[id]` | User story + AC binding (side panel) |
| `CommandPalette` | `/projects/[slug]` | ⌘K command search (stub) |
| `StepEditor` | `/projects/[slug]/atcs/[id]` | Monaco code editor (steps + assertions) |
| `Wordmark` | All | Brand display (kanji + latin) |

---

## 6. Third-party integrations

| Service | Purpose | Package | Status | Features using it |
|---------|---------|---------|--------|-------------------|
| Supabase Auth (GoTrue) | Magic-link OTP, session management | `@supabase/ssr`, `@supabase/supabase-js` | **Active** | FEAT-AUTH-001, FEAT-AUTH-002 |
| Supabase PostgREST | Auto-generated REST API (DB → HTTP) | Built into Supabase | **Active** | All read queries, manual run/bug CRUD |
| Supabase PostgreSQL | Primary database (24 tables) | Built into Supabase | **Active** | All features |
| Resend | Transactional email (magic links, invites) | Not in `package.json` | **Configured only** | FEAT-AUTH-001 (planned), FEAT-INT-002 (planned) |
| Atlassian Jira | Issue tracking sync | Not in `package.json` | **Configured only** | FEAT-INT-001 (planned Phase 3) |
| Tavily | Web search MCP | `TAVILY_API_KEY` in env | **Configured only** | Not wired in app code |
| n8n | Workflow automation | `N8N_API_URL` in env | **Configured only** | Not wired in app code |

**Key insight:** The only active integration is **Supabase** (which bundles auth, DB, and REST). All other services are configured via env vars but have zero application code consuming them.

---

## 7. Feature flags and WIP

### Planned feature flags (from SRS — not yet migrated)

| Flag | Description | Default | Phase |
|------|-------------|---------|-------|
| `phase2.semantic_search` | Vector-based ATC search | `false` | Phase 2 |
| `phase2.agentic_mode` | AI agent execution mode | `false` | Phase 2 |
| `phase2.mind_map` | Mind-map visualization | `false` | Phase 2 |
| `phase3.jira_bidirectional` | Jira sync both directions | `false` | Phase 3 |

### Planned / WIP features

| Feature | Evidence | Status |
|---------|----------|--------|
| OAuth providers | Disabled buttons with "soon" labels, login page | Planned next sprint |
| Multi-workspace switching | Comment on project redirect | Phase E |
| Project creation UI | Empty-state placeholder | Phase E |
| Command palette (⌘K + fuzzy search) | Stub component, search not wired | Phase D |
| Rate-limit middleware | Comment in magic-link route | Phase F |
| Idempotency replay store | Skeleton validator, no replay | Phase F |
| Run execution engine | Scope defined, no routes/tables | Phase 2+ |
| Jira bidirectional sync | Env vars set, no code | Phase 3 |
| Resend email integration | `RESEND_API_KEY` in env, no SDK | Phase 2 |
| ATC version history | Version bump on save, no history UI | Not scheduled |
| Member invite flow | `workspace_invites` table exists, no UI | Not scheduled |
| Activity log | Table referenced in SRS, not migrated | Not scheduled |

---

## 8. QA relevance

### Feature test coverage matrix

| Feature ID | Name | Unit (DB) | Integration (API) | E2E (UI) | Status |
|------------|------|-----------|-------------------|-----------|--------|
| FEAT-AUTH-001 | Magic-link auth | — | ✅ API contract | ✅ Login flow | Needs E2E |
| FEAT-AUTH-002 | Session auth | — | ❌ Middleware not tested | ❌ No E2E | Not tested |
| FEAT-AUTH-005 | PAT management | — | ✅ API contract | ⚠️ No token UI | Needs E2E |
| FEAT-WS-001 | Workspace onboarding | — | ✅ RPC contract | ✅ Onboarding flow | Needs E2E |
| FEAT-WS-002 | Workspace RBAC | ✅ RLS policies | ⚠️ No versioned API | ❌ No E2E | Needs integration |
| FEAT-WS-004 | Cross-workspace isolation | ✅ RLS policies | ⚠️ No versioned API | ❌ No E2E | High priority |
| FEAT-PROJ-001 | Project management | ✅ Schema | ⚠️ PostgREST only | ❌ No E2E | Needs integration |
| FEAT-PROJ-002 | Module tree | ✅ Schema + tree builder | ⚠️ PostgREST only | ❌ No E2E | Needs integration |
| FEAT-PROJ-003 | ATC table view | ✅ Schema | ⚠️ PostgREST only | ❌ No E2E | Needs integration |
| FEAT-ATC-001 | ATC editor | — | ✅ Server Action | ❌ No E2E | Critical |
| FEAT-ATC-002 | ATC anchoring | — | ✅ Server Action | ❌ No E2E | Critical |
| FEAT-ATC-005 | ATC versioning | ✅ DB trigger | ⚠️ Implicit | ❌ No E2E | Medium |
| FEAT-API-001 | Error envelope | — | ✅ API contract | — | Good |
| FEAT-API-004 | OpenAPI spec | — | ✅ Spec coverage | — | Good |
| FEAT-API-006 | Bearer middleware | — | ⚠️ No route uses it | — | Untestable until routes exist |
| FEAT-TOKEN-* | PAT CRUD | — | ✅ API contract | ❌ No UI | Good |
| FEAT-SEARCH-001 | Full-text search | ✅ GIN index + trigger | ❌ No endpoint | ❌ No UI | Not testable |
| FEAT-RUN-* | Run execution | ❌ Not migrated | ❌ Not implemented | ❌ Not implemented | Not testable |
| FEAT-INT-* | Integrations | ❌ Not migrated | ❌ Not implemented | ❌ Not implemented | Not testable |

### High-risk features (prioritize testing)

| Feature | Risk | Reason |
|---------|------|--------|
| Cross-workspace isolation (FEAT-WS-004) | **CRITICAL** | RLS is sole authorization mechanism — a policy bug = data leak across tenants |
| ATC authoring (FEAT-ATC-001) | **HIGH** | Core user value — corrupt save = data loss. `bunkai_save_atc` RPC is a single atomic operation; rollback failure could leave partial state |
| PAT auth (FEAT-AUTH-005) | **HIGH** | Token hash storage, revoke-then-create race, missing scope enforcement on current routes |
| Session middleware (FEAT-AUTH-002) | **HIGH** | Edge middleware is the gate — bypass or stale cookie = unauthorized access |
| ATC anchoring (FEAT-ATC-002) | **MEDIUM** | M:N binding integrity — orphaned AC links or duplicate bindings |
| Module tree (FEAT-PROJ-002) | **MEDIUM** | Self-referential FK + materialized path — cycle detection and depth limit enforcement |
| Idempotency (FEAT-API-003) | **MEDIUM** | Skeleton only — no replay protection. Once runs endpoints land, missing idempotency = duplicate test runs |
| API error envelope consistency (FEAT-API-001) | **MEDIUM** | Bearer middleware currently returns raw 401, not `ErrorEnvelope`. Inconsistent error shape |

---

## 9. Discovery gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| CRUD coverage is low | HIGH | Of 24 data-map entities, only `access_tokens` and `atcs` have full CRUD via the versioned API. Most entities are read-only through PostgREST with no creation/update/deletion UI. 8+ planned tables not yet migrated. Testing is limited to read operations for most of the domain. |
| Bearer middleware untested in production | HIGH | `requireBearerToken()` and `requireScope()` exist in code but no route handler currently calls them. The middleware is effectively dead code — cannot be verified through the API. |
| RLS policy audit — manual only | MEDIUM | All authorization relies on RLS policies across 9+ tables. No automated test validates that each policy correctly isolates workspaces. A regression in any SECURITY DEFINER helper could silently break tenancy. |
| No runs execution engine | MEDIUM | The `run:execute` scope is defined but no `runs`/`run_atcs`/`run_steps` tables or routes exist. The agent API run journey (business-api-map.md J3) is entirely speculative — cannot be tested. |
| OpenAPI spec is incomplete | MEDIUM | Only 5 endpoints documented. PostgREST endpoints, Server Actions, and the entire UI data layer are absent from the spec. Contract testing coverage is ~20%. |
| Business-model feature parity gap | MEDIUM | SRS mentions 24 entities; only 9 are migrated. The `bugs`, `activity_log`, `imports`, `idempotency_keys`, `feature_flags`, `tests`, `test_steps`, `runs`, `run_atcs`, `run_steps` tables do not exist yet. The system is running ahead of its database. |
| No UI for entity creation | LOW | Projects, modules, user stories, and ACs have no creation form — they appear to be created through external imports (Jira) or direct DB inserts. The ATC cannot be created without first having a story + AC to anchor to. |
| Idempotency not functional | LOW | Header validation only — no replay store. Once write endpoints land, duplicate POSTs will not be caught. |
| Resend email not wired | LOW | `RESEND_API_KEY` configured but no SDK installed. Magic-link delivery uses Supabase GoTrue's default email provider — cannot customize or test transactional email flow. |
| Jira sync not started | LOW | `integrations` table exists, `ATLASSIAN_*` env vars set, but zero sync code. Bug filing is native-only with no external push. |
