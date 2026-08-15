# Business Feature Map — Bunkai (QA Lens)

> Generated: 2026-08-09 (v2 — synced to `upex-bunkai-tms` staging branch, tip `5e0134c`; refreshed 2026-08-13)
> Refreshed: 2026-08-15 (v4 — verified against `upex-bunkai-tms` branch `staging`, tip `de670c4`)
> Sources: `../upex-bunkai-tms/app/` (31 pages), `../upex-bunkai-tms/app/api/v1/` (65 route files), `../upex-bunkai-tms/supabase/migrations/` (0001–0070), `../upex-bunkai-tms/lib/`
> Cross-refs: `.context/business/business-data-map.md`, `.context/business/business-api-map.md`
> Delta vs v3 (2026-08-13): **FEAT-BUG-006 Defect detail read SHIPPED** (BK-337: GET /api/v1/bugs/{id}, BugDetailSchema with origin + module.archived_at); BK-466 evidence-link scheme guard (http/https only); 0070 bug detail composer RPC widening.

---

## 1. Inventory summary

| Category | Features | Status |
|----------|----------|--------|
| Auth & identity | 7 | **Stable (6)** + Planned (1) |
| Workspace & tenancy | 6 | Stable |
| Project & module tree | 6 | Stable (CRUD now via API) |
| ATC authoring | 7 | Stable (create/update/duplicate/usage/search) |
| Tests (chains) | 5 | **Stable (was Planned)** |
| Runs execution | 6 | **Stable (was Planned)** |
| Bugs / defects | 6 | **Stable (was Planned)** |
| Environments | 2 | **Stable (was Planned)** |
| Imports (Jira) | 2 | **Stable (was Planned)** |
| Milestones | 2 | **New — Stable** |
| Notifications | 4 | **New — Stable** |
| Activity stream | 1 | **New — Stable** |
| Coverage & traceability | 4 | **New — Stable** |
| API layer | 8 | Stable (scopes now enforced) |
| Token management | 3 | Stable |
| Search & discovery | 2 | Partial / WIP |
| Integrations | 2 | Planned |
| UI / experience | 9 | Mixed |
| **Total** | **~81** | |

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
| **Dependencies** | Supabase GoTrue (OTP) |
| **Evidence** | `app/(auth)/login/magic-link-form.tsx`, `app/api/v1/auth/magic-link/route.ts`, `lib/auth/login-errors.ts` |

- [x] Enter email → receive magic link
- [x] Click link → OTP exchange → session cookie set
- [x] Redirect to `/projects` or custom `next` path
- [x] Open-redirect guard on callback
- [x] Cross-device support (BK-400): stateless `verifyOtp` works on any device
- [x] **Anti-silent-signup (BK-175)**: `shouldCreateUser: false` — a magic link for an unknown email returns the same response as a known one (no account-existence oracle)
- [x] Login error toasts (`lib/auth/login-errors.ts`) for expired/invalid links
- [ ] Custom SMTP via Resend (configured but not wired)

#### Feature: Session-based auth (browser)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-002 |
| **Status** | Stable |
| **Endpoints** | None (middleware layer) |
| **UI** | All authenticated pages behind middleware gate |
| **Dependencies** | Supabase SSR (`@supabase/ssr`) |

- [x] Cookie-based session management
- [x] Protected route redirect to `/login?next=`
- [x] `AuthProvider` React context with `useAuth` hook
- [x] Sign-out flow

#### Feature: OAuth providers (GitHub, Google)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-003 |
| **Status** | **Stable — SHIPPED (was Planned)** |
| **Routes** | `/api/v1/auth/oauth/init` (server-initiated, provider redirect + CSRF state cookie), `/api/v1/auth/oauth/callback` |
| **UI** | `OAuthButtons` on login page (`app/(auth)/login/oauth-buttons.tsx`) — GitHub + Google enabled |
| **Dependencies** | Supabase GoTrue OAuth (PKCE, server-initiated), `app/auth/oauth/` |

- [x] GitHub OAuth sign-in/signup (enabled)
- [x] Google OAuth sign-in/signup (enabled)
- [x] CSRF state cookie on server-initiated flow
- [x] OAuth session via GoTrue (no email-OTP in this path); PAT minted separately via `/tokens`

#### Feature: SSO login

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-004 |
| **Status** | Planned (Phase 2) |

#### Feature: Personal Access Tokens (PATs)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-005 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/tokens`, `POST /api/v1/tokens`, `DELETE /api/v1/tokens/{id}` |
| **UI** | `/settings/tokens` (**NEW in staging**) |
| **Dependencies** | `access_tokens` + `access_token_secrets` split tables, SHA-256 hashing, `bearer.ts` middleware |

- [x] Issue PAT with scope selection (`atc:read`, `atc:write`, `run:execute`, `workspace:admin`)
- [x] List caller's active tokens
- [x] Soft-revoke token (sets `revoked_at`)
- [x] Token format `bk_pat_<prefix>.<secret>` — shown once
- [x] Bearer middleware validates on every request (hash in sibling `access_token_secrets`)
- [x] Workspace-scoped or cross-workspace tokens
- [x] TTL up to 365 days
- [x] `last_used_at` fire-and-forget touch
- [x] **Scopes NOW enforced** via `withApiHandler({ requires: [...] })` + `requireCapability()` (ADR-0001)

#### Feature: Headless sign-in + verification-first sign-up

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-006 |
| **Status** | **Stable — SIGNUP FLOW CHANGED (BK-166)** |
| **Endpoints** | `POST /api/v1/auth/signup` (202 pending_confirmation — NO session/PAT), `POST /api/v1/auth/confirm` (OTP 6–8 digits → mints session + PAT atomically), `POST /api/v1/auth/signin` (password + PAT in one response), `POST /api/v1/auth/resend`, `POST /api/v1/auth/check-email` |
| **Users** | CLI, CI/CD, AI agents, QA environments |

- [x] Signup triggers email OTP — **no auto-confirm, no session, no PAT** (closes v1's admin-create backdoor)
- [x] Confirm/signin mint a fresh Bearer PAT atomically (default least-privilege scopes; `workspace:admin` rejected → ADR-0005)
- [x] Sign-up + confirm enforce `min(8)` password; sign-in keeps `min(6)` for legacy accounts
- [x] 409 conflict on existing email WITHOUT echoing it (no account-existence leak)
- [x] Uniform 401 on bad OTP/credentials (never distinguishes "no such pending signup" from "wrong code")
- [x] Rate-limit mapping (429 → `rate_limited` envelope)

#### Feature: Auth email-status probe

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-AUTH-007 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST /api/v1/auth/check-email` → `auth_email_status` RPC (0034) |
| **Users** | Login page — resolves "sign up" vs "sign in" copy |
| **Detail** | Enumeration tradeoff ratified in ADR-0007: the probe deliberately answers "does this email exist" only through a SECURITY DEFINER RPC (never raw table reads) and collapses unknown/error to a uniform response |

---

### 2.2 Workspace & tenancy

#### Feature: Workspace onboarding

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-001 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/workspaces` (wraps `bunkai_bootstrap_workspace()` RPC) |
| **UI** | `/onboarding` — `OnboardingForm` (name + slug) |

- [x] Create workspace with slug (3–40 chars)
- [x] Atomic workspace + owner membership (single transaction via RPC)
- [x] Slug auto-generation + manual override
- [x] `409 conflict` friendly handling when slug taken

#### Feature: Workspace membership & RBAC

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-002 |
| **Status** | Stable (schema + RLS + member management UI) |
| **UI** | `/workspaces/[id]/members` — invite form, member list, pending invites |

**Roles:** viewer → member → admin → owner

- [x] Role-based access via RLS on every table
- [x] SECURITY DEFINER helper functions prevent infinite recursion
- [x] Invite generation UI with role selection (viewer/member/admin)
- [x] Invite revoke + rotate (+7 days expiry)
- [x] **Leave workspace (NEW)**: `DELETE /api/v1/workspaces/{id}/membership` → `bunkai_leave_workspace` (0044)

#### Feature: Workspace/project switcher

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-003 |
| **Status** | Stable |
| **UI** | `WorkspaceSwitcher` component (dropdown, `/api/v1/me`) |

- [x] List all workspaces (from `/api/v1/me`)
- [x] Switch via `POST /api/v1/me/active-workspace` → `bk_active_ws` httpOnly cookie
- [x] Active workspace checkmark + "Manage members & invites" quick link
- [x] Supabase JWT untouched — separate cookie, no re-auth

#### Feature: Cross-workspace isolation

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-004 |
| **Status** | Stable (RLS-enforced) |

- [x] Data isolation by `workspace_id` on all tenant entities
- [x] RLS policies + helper functions
- [x] PATs optionally scoped to a workspace; `assertWorkspaceContext` (ADR-0006) blocks cross-workspace admin ops
- [x] Non-disclosure convention: foreign/missing workspace collapses to empty 200 on read endpoints

#### Feature: Invite lifecycle

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-005 |
| **Status** | Stable |
| **Endpoints** | `POST/GET /api/v1/workspaces/{id}/invites`, `POST/DELETE /api/v1/workspaces/{id}/invites/{inviteId}` (rotate/revoke), `POST /api/v1/invites/accept` |
| **UI** | `app/invites/accept/` public redemption page |

- [x] One-time invite token + accept_url, returned exactly once
- [x] Status machine: pending → accepted / revoked / expired (24h TTL)
- [x] Rotate: new secret + expiry +7d, clears prior acceptance
- [x] Accept requires signed-in caller with **matching email**
- [x] Invite-equals-role enforcement

#### Feature: Home dashboard (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-WS-006 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/workspaces/{id}/recent-projects`, `GET /api/v1/workspaces/{id}/active-runs`, `GET /api/v1/workspaces/{id}/open-bugs`, `GET /api/v1/workspaces/{id}/coverage` |
| **UI** | `app/(app)/home/page.tsx` — recent projects, active runs, open bugs, coverage stat card |

- [x] Coverage roll-up rule: `sum(ac_bound) / sum(ac_total)` per workspace — NOT the mean of per-project percentages
- [x] Same `summarizeWorkspaceCoverage` shared by Home + API route (never disagrees)
- [x] Migration-backed indexes (0059, 0060, 0061)

---

### 2.3 Project & module tree

#### Feature: Project management

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-001 |
| **Status** | **Stable (creation now via API)** |
| **Endpoints** | `POST /api/v1/workspaces/{id}/projects` |
| **UI** | `/projects` listing, `/projects/new` (**NEW**), `/projects/[slug]` |

- [x] Create project with name/slug
- [x] Project dashboard with module tree + ATC inventory
- [x] Auto-redirect to first project on workspace entry
- [x] Empty-state placeholders (no projects, no bugs)

#### Feature: Module tree (CRUD + move/archive, NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-002 |
| **Status** | **Stable — expanded** |
| **Endpoints** | `POST /api/v1/projects/{id}/modules`, `PATCH/DELETE /api/v1/modules/{id}` |
| **RPCs** | `bunkai_update_module`, `bunkai_move_module`, `bunkai_archive_module_subtree` (→ soft-delete, subtree archive + events) |

- [x] Self-referential tree (max depth 6)
- [x] Materialized path for fast ancestry
- [x] Description field (0013) + rename (0014) + move (0015) + archive subtree
- [x] Expand/collapse sidebar; nested display modules → stories → ACs → ATCs
- [x] Module events: renamed / moved / archived / description_updated (0023)

#### Feature: ATC table view

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-003 |
| **Status** | Stable |
| **UI** | `AtcTable` (sortable, `@tanstack/react-table`) |

- [x] Sortable columns: ID, Title, Layer, Module path, Status, Tags
- [x] Layer chips (UI/API/Unit), status indicators
- [x] Click row → ATC editor

#### Feature: User story & AC CRUD (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-004 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST/GET /api/v1/modules/{id}/user-stories`, `GET/PATCH/DELETE /api/v1/user-stories/{id}`, `POST/GET /api/v1/user-stories/{id}/acceptance-criteria`, `GET/PATCH/DELETE /api/v1/acceptance-criteria/{id}` |
| **RPCs** | `bunkai_insert/move/archive_acceptance_criterion` (0017), `bunkai_set_user_story_status` (ready-to-test gate, 0018) |

- [x] US uniqueness per module (0016)
- [x] AC ordering + archive (0017), ready-to-test status gate (0018)

#### Feature: Project metrics & reporting (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-005 |
| **Status** | **New — Stable** |
| **UI** | `/projects/[slug]/metrics` (recovery cycles), `/projects/[slug]/bugs` (heatmap), `/projects/[slug]/traceability` (evidence chain), `/projects/[slug]/coverage` |
| **Evidence** | 0048/0049/0050/0052/0068 RPCs |

#### Feature: Project environments UI (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-PROJ-006 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET/POST /api/v1/projects/{id}/environments`, `PATCH/DELETE /api/v1/environments/{id}` |
| **RPCs** | `bunkai_create/rename/delete_environment` (0032, cross-workspace 404 fix 0063) |
| **UI** | Project explorer rail (BK-148) |

- [x] Seeded Staging + Production per project (0031); names case-insensitive unique
- [x] Removal blocked while any Run references the environment

---

### 2.4 ATC authoring

#### Feature: ATC editor (full)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-001 |
| **Status** | Stable |
| **UI** | `AtcEditor` (title, layer, steps, assertions, tags, anchoring) |
| **Endpoints** | `POST /api/v1/atcs` (create), `PATCH /api/v1/atcs/{id}` (update) — RPCs `bunkai_create_atc` / `bunkai_update_atc` |

- [x] Title (min length 0058), layer toggle (UI/API/Unit)
- [x] Steps + assertions editors (Monaco, markdown/YAML parsers)
- [x] Tags (enter-to-add, click-to-remove; cap guard 0065)
- [x] Anchoring panel (story + AC binding, M:N)
- [x] Atomic save via RPC (version bump + full-replace + activity event)
- [x] Optimistic lock via `X-If-Match: <version>` (409 w/ `current_version`)

#### Feature: ATC anchoring

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-002 |
| **Status** | Stable |
| **UI** | `AnchoringPanel` (story search + AC checkboxes) |

#### Feature: ATC step/assertion parsing

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-003 |
| **Status** | Stable |
| **Evidence** | `lib/atc-parse.ts` |

#### Feature: Monaco code editor

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-004 |
| **Status** | Stable |
| **UI** | `StepEditor` (dynamic import, SSR disabled) |

#### Feature: ATC versioning

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-005 |
| **Status** | Stable (version bump on save, `X-If-Match` optimistic locking) |
- [ ] Version history or rollback (not implemented)

#### Feature: ATC duplicate (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-006 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST /api/v1/atcs/{id}/duplicate` → `bunkai_duplicate_atc` (0028) |

- [x] Clone ATC + steps + assertions + AC bindings

#### Feature: ATC usage & search (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ATC-007 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/atcs/{id}/usage` → `bunkai_atc_usage` (0029), `GET /api/v1/atcs/search` → `bunkai_search_atcs` (0027) |

- [x] Which Tests chain this ATC (usage count)
- [x] Full-text ATC search over `tsv` column

---

### 2.5 Tests (chains) — was Planned

#### Feature: Test CRUD

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TEST-001 |
| **Status** | **Stable (was Planned)** |
| **Endpoints** | `POST /api/v1/tests` (Idempotency-Key REQUIRED), `GET /api/v1/tests/{id}`, `GET /api/v1/tests?tag=<tag>` |
| **RPCs** | `bunkai_create_test` (0024), `bunkai_get_test_expanded` (0025), `bunkai_filter_tests_by_tag` (0030) |

- [x] Create named Test chaining ≥1 ATC in order (references, not copies)
- [x] Read expanded (chain + ATC content)
- [x] Tag filtering via GIN `@>` containment — `Smoke` matches `smoke`

#### Feature: Chain reorder (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TEST-002 |
| **Status** | **New — Stable** |
| **Endpoints** | `PATCH /api/v1/tests/{id}/reorder` → `bunkai_reorder_test_steps` (0026) |

- [x] Permute `step_id`s (surrogate per-position handle — same ATC may repeat)
- [x] Emits `test.reordered` event

#### Feature: Test tags (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TEST-003 |
| **Status** | **New — Stable** |
| **Endpoints** | `PUT /api/v1/tests/{id}/tags` → `bunkai_set_test_tags` (0030) — PUT = whole-set replace |

- [x] Normalize (trim, reserved-lowercase, dedupe), shape rules, no-op detection (no event/version bump)
- [x] Optimistic lock via `X-If-Match`; emits `test.tags_changed`

#### Feature: Test run history (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TEST-004 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/tests/{id}/runs` → `bunkai_list_test_runs` (0038/0039, actor-guarded) |
| **UI** | `/projects/[slug]/tests/[testId]/runs` |

#### Feature: Test pages (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-TEST-005 |
| **Status** | **New — Stable** |
| **UI** | `/projects/[slug]/tests/new`, `/projects/[slug]/tests/[testId]`, `/projects/[slug]/tests/[testId]/runs` |

---

### 2.6 Runs execution — was Planned

#### Feature: Start a manual Run (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-001 |
| **Status** | **Stable (was Planned)** |
| **Endpoints** | `POST /api/v1/runs` (Idempotency-Key REQUIRED, `run:execute` bearer scope) |
| **RPCs** | `bunkai_create_run` (0031) + module-snapshot variant (0040) |

- [x] Snapshot chain (run_atcs + run_steps) + module snapshot at start — edits never corrupt history
- [x] Environment validation (45201), executor mode (manual/agent/ci), executable-steps check (45202)
- [x] 24h same-token idempotency window (`start_token`), distinct from HTTP Idempotency-Key
- [x] Emits `run.started` event + realtime replication (0043)

#### Feature: Mark run step (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-002 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST /api/v1/runs/{id}/steps/{stepId}/mark` → `bunkai_mark_run_step` (0042) |

- [x] Position-grain statuses: pending → passed / failed / blocked / skipped
- [x] Emits `run_step.marked` (out of MVP activity-feed scope, BK-49 — would drown the feed)

#### Feature: Finish / Abort Run (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-003 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST /api/v1/runs/{id}/finish` → `bunkai_finish_run` (0037/0067 `via` param), `POST /api/v1/runs/{id}/abort` → `bunkai_abort_run` (0036/0067) |

- [x] Run-grain terminal states: passed / failed / aborted
- [x] Abort reason: free-text ≤500 chars — **never surfaced in activity feed** (BK-49 Decision 3)
- [x] Events `run.finished` { verdict, skipped_steps } / `run.aborted` { reason, skipped_steps }
- [x] Run-event notifications (0066)

#### Feature: Run expanded read (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-004 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/runs/{id}` → `bunkai_get_run_expanded` |
| **UI** | `/projects/[slug]/runs/[runId]` run execution view |

#### Feature: Run reporting (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-005 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/projects/{id}/runs/report` → `bunkai_report_project_runs` (0041) |
| **UI** | `/projects/[slug]/runs` filtered by pass/fail (BK-38) |

#### Feature: Active runs (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-RUN-006 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/workspaces/{id}/active-runs` (Home + run filtering) |

---

### 2.7 Bugs / defects — was Planned

#### Feature: File bug (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-BUG-001 |
| **Status** | **Stable (was Planned)** |
| **Endpoints** | `POST /api/v1/bugs` → `bunkai_create_bug` (0046) |
| **UI** | `/projects/[slug]/bugs` |

- [x] Native defect record: title, severity P1–P4, evidence (limit-guarded), provenance links (run/step/ATC nullable)
- [x] Module/run context derived server-side from `run_step_id`; RPC re-validates module ∈ project (45300)
- [x] Consistency table trigger (workspace/project/run/step NFC checks 45304–45307)

#### Feature: Bug list + filters (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-BUG-002 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/bugs` → `bunkai_list_bugs` (0051/0054: severity+status filters, cursor pagination, summary counts), `GET /api/v1/projects/{id}/bugs` |
| **UI** | `/projects/[slug]/bugs` |

#### Feature: Bug assign (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-BUG-003 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST /api/v1/bugs/{id}/assign` → `bunkai_assign_bug` (0054) |

- [x] Assignee must be active workspace member with role ≥ member (45312/45313)
- [x] Events `bug.assigned` / `bug.unassigned` + notifications

#### Feature: Bug status triage (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-BUG-004 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST /api/v1/bugs/{id}/status` → `bunkai_transition_bug_status` (0054) |

- [x] Forward-only adjacency: open → in_progress → resolved → closed (45310 skip, 45311 backward)
- [x] Notifications + activity events

#### Feature: Defect heatmap (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-BUG-005 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/projects/{id}/bugs/heatmap` → `bunkai_report_project_defect_heatmap` (0052) |
| **UI** | `/projects/[slug]/bugs` heatmap view |

#### Feature: Defect detail read (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-BUG-006 |
| **Status** | **New — Stable (BK-337)** |
| **Endpoints** | `GET /api/v1/bugs/{id}` → `bunkai_bug_json` (widened by 0070_bug_detail_composer.sql) |
| **UI** | `/projects/[slug]/bugs/[bugId]` (read-only defect detail page) |

- [x] Full composed record: title, severity, status, evidence, provenance (origin), module (with `archived_at`)
- [x] `origin` object: `run_id`, `run_step_position` (0-based), `atc_id`, `atc_title`, `atc_layer` — null for standalone defects (filed manually)
- [x] Archived-module bugs render with `module.archived_at` set (PO ruling: tag, never 404)
- [x] SECURITY INVOKER: `bunkai_bug_json` runs under caller's RLS; missing/foreign bug → generic 404 (non-disclosing)
- [x] POST /bugs, POST /bugs/{id}/assign, POST /bugs/{id}/status also return `BugDetailSchema` (not plain `BugSchema`)
- [x] Evidence-link scheme guard (BK-466): `evidence_urls` restricted to http/https at filing (Zod) and render time (`isHttpUrl`)

---

### 2.8 Environments / imports / milestones / notifications / activity / coverage

#### Feature: Environments CRUD

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ENV-001 |
| **Status** | **Stable (was Planned)** |
| **Endpoints** | `GET/POST /api/v1/projects/{id}/environments`, `PATCH/DELETE /api/v1/environments/{id}` |

#### Feature: Environment binding guard

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ENV-002 |
| **Status** | **New — Stable** |
| **Detail** | Cross-workspace 404 collapse (0063); delete blocked while runs reference it (0032/ADR-0004) |

#### Feature: Async Jira import

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-IMPORT-001 |
| **Status** | **Stable (was Planned)** |
| **Endpoints** | `POST /api/v1/imports` (202 + job id; Vercel `after()` worker pages Jira → upserts stories + ACs), `GET /api/v1/imports/{id}` (poll status + counts + errors) |

- [x] One active import per project (0020 → 409 serialized)
- [x] Member-only (import_jobs INSERT policy member+)

#### Feature: Import lifecycle

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-IMPORT-002 |
| **Status** | **New — Stable** |
| **States** | pending → running → succeeded / failed |

#### Feature: Milestones

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-MILESTONE-001 |
| **Status** | **New — Stable** (BK-205) |
| **Endpoints** | `GET/POST /api/v1/projects/{id}/milestones` → `bunkai_create_milestone`, `PATCH /api/v1/milestones/{id}` → `bunkai_update_milestone` (0064) |
| **UI** | `/projects/[slug]/milestones`, `/projects/[slug]/milestones/[milestoneId]` |

- [x] Name (normalized, unique case-insensitive per project), target_date (past → 45502, >5y → 45503), description ≤500ch
- [x] Events `milestone.created` / `milestone.updated` (positive-only projection)
- [x] No delete RPC; no status column (readiness derived from plan progress)

#### Feature: Milestone planning UI

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-MILESTONE-002 |
| **Status** | **New — Stable** |

#### Feature: Notification inbox

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-NOTIF-001 |
| **Status** | **New — Stable** (0053) |
| **Endpoints** | `GET /api/v1/workspaces/{id}/notifications` → `bunkai_list_notifications` (paged, unread count, entity-visibility-respecting RLS projection) |
| **UI** | `/settings/notifications`, `/activity` |

#### Feature: Mark read / read-all

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-NOTIF-002 |
| **Status** | **New — Stable** |
| **Endpoints** | `POST /api/v1/notifications/{id}/read`, `POST /api/v1/workspaces/{id}/notifications/read-all` |

#### Feature: Notification preferences

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-NOTIF-003 |
| **Status** | **New — Stable** (0062) |
| **Endpoints** | `GET/PATCH /api/v1/notification-preferences` |

#### Feature: Bug/run notification triggers

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-NOTIF-004 |
| **Status** | **New — Stable** |
| **Detail** | `bunkai_notify_bug_event` (0056, deep links 0057), `bunkai_notify_run_event` (0066); milestone events never notify |

#### Feature: Activity stream

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-ACT-001 |
| **Status** | **New — Stable** (BK-49) |
| **Endpoints** | `GET /api/v1/activity?workspace_id=&limit=&cursor=` → `bunkai_list_activity` (0045/0047/0055) |
| **UI** | `/activity` |

- [x] Cursor-paginated (malformed cursor → 400); empty page = 200 `{items: []}` — never 404
- [x] Actor resolution via `bunkai_resolve_activity_actors` (0045, scoped 0047, ADR-0011)
- [x] MVP allowlist of event actions — `run_step.marked` deliberately excluded (volume)
- [x] `run.aborted.reason` dropped outright from the feed projection

#### Feature: Coverage report

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-COV-001 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/projects/{id}/coverage` → `bunkai_report_project_coverage` (0048 → real-execution-source 0050) |
| **UI** | `/projects/[slug]/metrics`, `/projects/[slug]` coverage chip |

#### Feature: Story traceability export

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-COV-002 |
| **Status** | **New — Stable** (BK-44/45/48/50) |
| **Endpoints** | `GET /api/v1/projects/{id}/traceability` → `bunkai_report_story_traceability` (0068) |
| **UI** | `/projects/[slug]/traceability` — full US→AC→ATC→Test→Run→Bug evidence chain + HTML export (BK-50) |
| **Dependencies** | `TraceabilityModule` interface (0069), `TraceabilityFilterState` (BK-48), `StoryChainViewState` |

- [x] Full bidirectional chain (US→AC→ATC→Test→Run→Bug)
- [x] Module identity per ATC (`module: {id, name}`) — 0069 migration
- [x] Client-side filtering by verdict/module/date-range (BK-48)
- [x] Empty-state distinction: zero-ac vs zero-coverage (AC-03/AC-07)
- [x] HTML export (BK-50)

#### Feature: Recovery cycles

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-COV-003 |
| **Status** | **New — Stable** |
| **Endpoints** | `GET /api/v1/projects/{id}/metrics/recovery-cycles` → `bunkai_report_project_recovery_cycles` (0049) |

#### Feature: Open bugs index (Home)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-COV-004 |
| **Status** | **New — Stable** |

---

### 2.8 API layer

#### Feature: API error envelope

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-001 |
| **Status** | Stable |
| **12 error codes** | `bad_request`, `validation_failed`, `unauthorized`, `forbidden`, `not_found`, `method_not_allowed`, `conflict`, `idempotency_key_required`, `idempotency_key_invalid`, `rate_limited`, `internal_error`, `upstream_error` |

#### Feature: Request lifecycle middleware

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-002 |
| **Status** | Stable |
| **Detail** | `x-request-id`, JSON logging, error mapping, CORS preflight, **secure-by-default auth** (`auth: 'required'` unless explicitly `auth: 'public'`) |

#### Feature: Idempotency key validation

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-003 |
| **Status** | **Stable (was skeleton)** |
| **Endpoints** | runs / tests / atcs create, imports |
| **Detail** | `beginIdempotentRequest` / `recordIdempotencyResult` / `discardIdempotencyResult` — replay store functional, request-level guard (distinct from run `start_token` domain window) |

#### Feature: OpenAPI spec generation

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-004 |
| **Status** | Stable |
| **Detail** | Zod schemas → OpenAPI 3.1; tags for auth/tenancy/identity + 65 route files; bearer + cookie schemes; Scalar UI at `/api/docs` |

#### Feature: API health probe

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-005 |
| **Status** | Stable |

#### Feature: Unified Principal auth (NEW)

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-006 |
| **Status** | **Stable — major upgrade (ADR-0001)** |
| **Detail** | `resolveIdentity()` collapses cookie OR bearer into one `Principal` { userId, workspaceId, capabilities, via, tokenId, db }. `db` = RLS-scoped client authenticated AS the user (PAT path uses per-request user JWT via `mintUserJwt` — never service role). **`requires: ['atc:read'|'atc:write'|'run:execute'|'workspace:admin']` enforced before handlers run** — scope vocabulary is NOW exercised. Cookie sessions hold ALL capabilities; PATs hold their declared subset. `assertWorkspaceContext` (ADR-0006) binds bearer ops to token workspace. |

#### Feature: Identity introspection

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-007 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/me`, `POST /api/v1/me/active-workspace` |

#### Feature: Versioned workspace CRUD

| Aspect | Value |
|--------|-------|
| **ID** | FEAT-API-008 |
| **Status** | Stable + **expanded** |
| **Endpoints** | workspaces CRUD + invites + membership (leave) + recent-projects + projects + open-bugs + active-runs + notifications + coverage |
| **Detail** | 65 route files, ~84+ handlers |

---

### 2.9 UI / experience — new pages

| Feature | ID | Status | Pages (staging) |
|---------|-----|--------|-----------------|
| Onboarding docs | FEAT-UI-006 | Stable | `/qa`, `/about`, `/design-tokens` |
| Settings suite | FEAT-UI-007 | **New** | `/settings`, `/settings/account`, `/settings/notifications`, `/settings/tokens`, `/settings/workspaces` |
| Bugs UI | FEAT-UI-008 | **New** | `/projects/[slug]/bugs` |
| Runs UI | FEAT-UI-009 | **New** | `/projects/[slug]/runs`, `/runs/[runId]` (execution view) |
| Tests UI | FEAT-UI-010 | **New** | `/tests`, `/tests/new`, `/tests/[testId]`, `/tests/[testId]/runs` |
| Traceability chain | FEAT-UI-011 | **New** | `/projects/[slug]/traceability` |
| Metrics | FEAT-UI-012 | **New** | `/projects/[slug]/metrics` |
| Milestones UI | FEAT-UI-013 | **New** | `/milestones`, `/milestones/[milestoneId]` |
| Activity UI | FEAT-UI-014 | **New** | `/activity` |
| Home | FEAT-UI-015 | **New** | `/home` |
| Members UI | FEAT-UI-016 | Stable | `/workspaces/[id]/members` |

---

## 3. CRUD matrix (staging)

| Entity | Create | Read | Update | Delete | Evidence |
|--------|--------|------|--------|--------|----------|
| `workspaces` | ✅ `POST /api/v1/workspaces` | ✅ `GET` + `GET/{id}` | ⚠️ Owner PATCH (name) | ❌ Not exposed | versioned API |
| `workspace_members` | ✅ invite accept | ✅ members UI | ❌ Role change | ✅ Leave (`DELETE /workspaces/{id}/membership`) | 0044 |
| `workspace_invites` | ✅ | ✅ | ⚠️ Rotate (new token) | ✅ Revoke | 0010 + API |
| `access_tokens` | ✅ POST /tokens + signin/confirm mint | ✅ GET /tokens | ❌ | ⚠️ Soft-revoke DELETE | 0008/0011/0012 |
| `projects` | ✅ `POST /workspaces/{id}/projects` | ✅ | ❌ | ❌ | — |
| `modules` | ✅ `POST /projects/{id}/modules` | ✅ | ✅ PATCH (rename/description) | ✅ DELETE (archive subtree) | 0013–0015, 0023 |
| `project_environments` | ✅ POST | ✅ GET | ✅ PATCH | ✅ DELETE (referenced-blocked) | 0032, 0063 |
| `user_stories` | ✅ `POST /modules/{id}/user-stories` | ✅ | ✅ PATCH | ✅ DELETE | 0016–0018 |
| `acceptance_criteria` | ✅ `POST /user-stories/{id}/acceptance-criteria` | ✅ | ✅ PATCH | ✅ DELETE (archive) | 0017/0018 |
| `atcs` | ✅ POST /atcs | ✅ + search | ✅ PATCH (opt-lock) | ❌ (archive TBD) | 0021, 0027–0029, 0065 |
| `tests` | ✅ POST /tests | ✅ GET/{id} + tag filter | ✅ reorder + tags | ❌ | 0024–0026, 0030 |
| `runs` | ✅ POST /runs | ✅ GET/{id} + history + report | ⚠️ steps mark/finish/abort | ❌ | 0031–0043 |
| `bugs` | ✅ POST /bugs | ✅ list + project + heatmap + detail read (BK-337) | ✅ assign + status | ❌ (lifecycle) | 0046, 0051, 0052, 0054, 0070 |
| `import_jobs` | ✅ POST /imports | ✅ GET/{id} | ❌ | ❌ | 0019/0020 |
| `milestones` | ✅ POST | ✅ GET | ✅ PATCH | ❌ (no delete RPC) | 0064 |
| `notifications` | ⚠️ DB-trigger only | ✅ list | ✅ mark read/read-all | ❌ | 0053, 0057, 0066 |
| `notification_preferences` | ✅ implicit | ✅ GET | ✅ PATCH | ❌ | 0062 |
| `activity_log` | ⚠️ RPC-only | ✅ GET /activity | ❌ | ❌ | 0045, 0047, 0055 |
| `idempotency_keys` | ✅ internal | ❌ | ✅ internal | ✅ internal TTL | 0009 |
| `user_view_state` | ✅ RLS-owner | ✅ | ✅ | ✅ | 0009 |
| `feature_flags` | ❌ | ⚠️ RPC | ❌ | ❌ | 0009 |

**Key observation v2**: The product surface is now essentially fully CRUD via the versioned API — the "planned" wall of v1 is gone. Remaining gaps: member role change (invite-time only), workspace delete/slug rotation, ATC delete/archive, Test delete, Bug delete (lifecycle-only), project update/delete.

---

## 4. API endpoint inventory (65 route files, ~84+ handlers)

### Versioned REST (`/api/v1`) — by domain

| Method | Endpoint | Purpose | Auth / Scope |
|--------|----------|---------|--------------|
| `GET` | `/api/v1` | Version banner | Public |
| `GET` | `/api/v1/health` | Liveness | Public |
| `POST` | `/api/v1/auth/magic-link` | OTP email | Public |
| `POST` | `/api/v1/auth/signup` | Verification-first signup → **202 pending_confirmation** | Public |
| `POST` | `/api/v1/auth/confirm` | Verify OTP → session + PAT minted | Public |
| `POST` | `/api/v1/auth/signin` | Password → session + PAT | Public |
| `POST` | `/api/v1/auth/resend` | Resend OTP | Public |
| `POST` | `/api/v1/auth/check-email` | `auth_email_status` probe | Public |
| `GET/POST` | `/api/v1/tokens` | List / issue PAT | Session or Bearer |
| `DELETE` | `/api/v1/tokens/{id}` | Soft-revoke PAT | Session or Bearer |
| `POST` | `/api/v1/invites/accept` | Redeem invite (email match) | Session or Bearer |
| `GET` | `/api/v1/me` | Identity + workspaces + active ws | Session or Bearer |
| `POST` | `/api/v1/me/active-workspace` | Set `bk_active_ws` cookie | Session or Bearer |
| `GET/POST` | `/api/v1/workspaces` | List / create | Session or Bearer |
| `GET/PATCH` | `/api/v1/workspaces/{id}` | Get / update (owner) | Session or Bearer |
| `GET` | `/api/v1/workspaces/{id}/recent-projects` | Home recent projects | Session or Bearer (`atc:read`) |
| `POST` | `/api/v1/workspaces/{id}/projects` | Create project | Session or Bearer |
| `DELETE` | `/api/v1/workspaces/{id}/membership` | Leave workspace | Session or Bearer |
| `GET` | `/api/v1/workspaces/{id}/open-bugs` | Home open bugs | Session or Bearer (`atc:read`) |
| `GET` | `/api/v1/workspaces/{id}/active-runs` | Home active runs | Session or Bearer (`atc:read`) |
| `GET` | `/api/v1/workspaces/{id}/coverage` | Workspace coverage roll-up | Session or Bearer (`atc:read`) |
| `GET/POST` | `/api/v1/workspaces/{id}/invites` | List (admin) / issue (admin/owner) | Session or Bearer |
| `POST/DELETE` | `/api/v1/workspaces/{id}/invites/{inviteId}` | Rotate / revoke | Session or Bearer (admin/owner) |
| `GET` | `/api/v1/workspaces/{id}/notifications` | Inbox (paged, unread count) | Session or Bearer |
| `POST` | `/api/v1/workspaces/{id}/notifications/read-all` | Mark all read | Session or Bearer |
| `GET/PATCH` | `/api/v1/notification-preferences` | Preferences | Session or Bearer |
| `POST` | `/api/v1/notifications/{id}/read` | Mark one read | Session or Bearer |
| `GET` | `/api/v1/activity` | Activity feed (paged cursor) | Session or Bearer |
| `POST` | `/api/v1/imports` | Enqueue Jira import (202) | Session or Bearer |
| `GET` | `/api/v1/imports/{id}` | Poll import job | Session or Bearer |
| `POST` | `/api/v1/atcs` | Create ATC | Session or Bearer (`atc:write`) |
| `PATCH` | `/api/v1/atcs/{id}` | Update ATC (X-If-Match) | Session or Bearer (`atc:write`) |
| `GET` | `/api/v1/atcs/search` | Full-text ATC search | Session or Bearer |
| `POST` | `/api/v1/atcs/{id}/duplicate` | Clone ATC | Session or Bearer |
| `GET` | `/api/v1/atcs/{id}/usage` | Chaining Tests | Session or Bearer |
| `POST` | `/api/v1/projects/{id}/modules` | Create module | Session or Bearer |
| `PATCH/DELETE` | `/api/v1/modules/{id}` | Rename/description / archive subtree | Session or Bearer |
| `POST/GET` | `/api/v1/modules/{id}/user-stories` | Create / list stories | Session or Bearer |
| `GET/PATCH/DELETE` | `/api/v1/user-stories/{id}` | Story read / update / archive | Session or Bearer |
| `POST/GET` | `/api/v1/user-stories/{id}/acceptance-criteria` | Create / list ACs | Session or Bearer |
| `GET/PATCH/DELETE` | `/api/v1/acceptance-criteria/{id}` | AC read / update / archive | Session or Bearer |
| `GET/POST` | `/api/v1/projects/{id}/environments` | List / create env | Session or Bearer |
| `PATCH/DELETE` | `/api/v1/environments/{id}` | Rename / remove (run-referenced → blocked) | Session or Bearer |
| `GET/POST` | `/api/v1/tests` | List (tag) / create | Session or Bearer (`atc:read`/`atc:write`) |
| `GET` | `/api/v1/tests/{id}` | Expanded test | Session or Bearer |
| `PATCH` | `/api/v1/tests/{id}/reorder` | Reorder chain (step_ids) | Session or Bearer |
| `PUT` | `/api/v1/tests/{id}/tags` | Whole-set tag replace (X-If-Match) | Session or Bearer (`atc:write`) |
| `GET` | `/api/v1/tests/{id}/runs` | Per-test run history | Session or Bearer |
| `POST` | `/api/v1/runs` | Start run (Idempotency-Key) | Session or Bearer (`run:execute`) |
| `GET` | `/api/v1/runs/{id}` | Expanded run | Session or Bearer |
| `POST` | `/api/v1/runs/{id}/steps/{stepId}/mark` | Mark step result | Session or Bearer (`run:execute`) |
| `POST` | `/api/v1/runs/{id}/finish` | Finish run (verdict via) | Session or Bearer (`run:execute`) |
| `POST` | `/api/v1/runs/{id}/abort` | Abort run (reason) | Session or Bearer (`run:execute`) |
| `GET` | `/api/v1/projects/{id}/runs/report` | Project run report | Session or Bearer |
| `POST` | `/api/v1/bugs` | File bug | Session or Bearer (`atc:write`) |
| `GET` | `/api/v1/bugs/{id}` | Read single defect (BK-337) | Session or Bearer |
| `GET` | `/api/v1/bugs` | List + filter (severity/status, cursor) | Session or Bearer |
| `GET` | `/api/v1/projects/{id}/bugs` | Project bug list | Session or Bearer |
| `GET` | `/api/v1/projects/{id}/bugs/heatmap` | Defect heatmap | Session or Bearer |
| `POST` | `/api/v1/bugs/{id}/assign` | Assign bug | Session or Bearer |
| `POST` | `/api/v1/bugs/{id}/status` | Triage status | Session or Bearer |
| `GET/POST` | `/api/v1/projects/{id}/milestones` | List / create milestone | Session or Bearer |
| `PATCH` | `/api/v1/milestones/{id}` | Update milestone | Session or Bearer |
| `GET` | `/api/v1/projects/{id}/coverage` | Project coverage | Session or Bearer |
| `GET` | `/api/v1/projects/{id}/metrics/recovery-cycles` | Recovery cycles | Session or Bearer |
| `GET` | `/api/v1/projects/{id}/traceability` | Story traceability chain | Session or Bearer |

### Pages (staging)

`/`, `(auth)/login`, `(app)/onboarding`, `(app)/home`, `(app)/projects`, `(app)/projects/new`, `(app)/projects/[slug]`, `…/atcs/new`, `…/atcs/[atcId]`, `…/tests/new`, `…/tests/[testId]`, `…/tests/[testId]/runs`, `…/runs`, `…/runs/[runId]`, `…/bugs`, `…/milestones`, `…/milestones/[milestoneId]`, `…/metrics`, `…/traceability`, `…/settings/{account,notifications,tokens,workspaces}`, `(app)/activity`, `invites/accept`, `about`, `qa`, `design-tokens`, `api/docs`

---

## 5. Third-party integrations

| Service | Purpose | Status | Features using it |
|---------|---------|--------|-------------------|
| Supabase Auth (GoTrue) | OTP magic-link, password, sessions, **OAuth (GitHub/Google)** | **Active** | AUTH-001/002/003/006 |
| Supabase PostgREST | Auto-generated REST | **Active** | UI reads, RLS |
| Supabase PostgreSQL | Primary DB (31 tables) | **Active** | All |
| Supabase Realtime | Run row broadcast (0043) | **Active (runs)** | RUN-001 |
| Atlassian Jira | **Async US import (real)** — `lib/jira/import-runner.ts` | **Active (import one-way)** | IMPORT-001 |
| Resend | Transactional email | Configured only | magic-link (GoTrue default) |
| Tavily / n8n | MCPs | Configured only | Not wired |

**Key insight v2**: Jira moved from "planned" to a real one-way async import (stories + ACs via JQL). Bug→Jira sync remains future work. Resend still not wired (GoTrue handles OTP email).

---

## 6. Feature flags and WIP

| Feature | Evidence | Status |
|---------|----------|--------|
| ~~OAuth providers~~ | **SHIPPED** — `app/auth/oauth/*` + login `OAuthButtons` | ~~Planned next sprint~~ → **Stable** |
| Magic-link anti-silent-signup | `shouldCreateUser: false` (BK-175) | Stable |
| Workspace slug rotation | PATCH only allows name | Post-MVP |
| Member role change | Invite-time role only | Not scheduled |
| ATC/Test delete or archive UI | Not exposed | Not scheduled |
| Bug→Jira sync | import one-way only | Phase 3 |
| Resend email integration | `RESEND_API_KEY` in env, no SDK | Phase 2 |
| ATC version history | Bump only, no history UI | Not scheduled |
| Migrations 0058/0067 | In tree, NOT applied (pending approval) | Pending |

---

## 7. QA relevance

### Feature test coverage matrix (highlights)

| Feature ID | Name | Unit (DB) | Integration (API) | E2E (UI) | Status |
|------------|------|-----------|-------------------|-----------|--------|
| FEAT-AUTH-006 | Verification-first signup/confirm | — | ✅ API contract (202 no-creds → confirm mints) | ✅ Login page | **HIGH — new behavior** |
| FEAT-API-006 | Unified Principal + scope enforcement | ✅ RLS + JWT | ✅ `requires:` now enforced | — | **HIGH — security** |
| FEAT-RUN-001..006 | Runs engine | ✅ RPCs + state machines | ✅ 8 run endpoints | ⚠️ Runner UI | **HIGH — was untestable, now real** |
| FEAT-BUG-001..006 | Bugs + triage + detail | ✅ triggers + adjacency | ✅ 7 bug endpoints | ⚠️ Bugs UI | **HIGH — was untestable** |
| FEAT-TEST-001..005 | Tests/chains | ✅ RPCs | ✅ 6 test endpoints | ⚠️ Tests UI | **HIGH — was untestable** |
| FEAT-COV-001..004 | Coverage/traceability | ✅ 5 report RPCs | ✅ 5 endpoints | ⚠️ Metrics/Traceability UI | **HIGH — audit-facing** |
| FEAT-NOTIF-001..004 | Notifications | ✅ triggers | ✅ 4 endpoints | ✅ Settings UI | **HIGH — cross-entity** |
| FEAT-IMPORT-001 | Jira async import | ✅ one-active constraint | ✅ 202 + poll | ❌ | **MEDIUM — worker timing** |
| FEAT-WS-004 | Cross-workspace isolation | ✅ RLS | ✅ versioned endpoints | ❌ | **CRITICAL** |
| FEAT-WS-006 | Home dashboard | ✅ indexes | ✅ 4 endpoints | ✅ Home UI | MEDIUM |

### High-risk features (prioritize testing)

| Feature | Risk | Reason |
|---------|------|--------|
| FEAT-WS-004 cross-workspace isolation | **CRITICAL** | RLS sole authorization; PAT impersonation path (`mintUserJwt`) must resolve identical rows to cookie sessions |
| FEAT-AUTH-006 verification-first | **HIGH** | OTP flow: resend/confirm asymmetry, 409 no-echo, `min(8)` vs `min(6)` asymmetry, rate limits |
| FEAT-API-006 scope enforcement | **HIGH** | Every authenticated route via `resolveIdentity`; cookie holds ALL caps — misdecorated route = silent privilege hole |
| FEAT-RUN-003 finish/abort | **HIGH** | Terminal-state transitions, `via` param (0067), abort reason redaction from activity feed |
| FEAT-BUG-004 status triage | **HIGH** | Forward-only adjacency backstops (45310/45311); DB trigger + RPC double layer must agree |
| FEAT-COV-001 coverage roll-up | **HIGH** | `sum/sum` not mean-of-percentages rule; Home page vs API never disagree |
| FEAT-BUG-001 bug provenance | **HIGH** | Server-side derivation from `run_step_id`; module ∈ project re-validation (45300) |
| FEAT-API-003 idempotency | **HIGH** | Now functional: hard-replay detection on runs/tests/atcs; 24h start_token window vs HTTP key |

### Discovery gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| RLS audit manual-only | HIGH | PAT impersonation client (`impersonatingClient`) must be covered by isolation suites |
| Activity feed allowlist | MEDIUM | Verify BK-49's allowlist excludes `run_step.marked` and `run.aborted.reason` never renders |
| Notifications entity-visibility | MEDIUM | RLS projection respects entity visibility — member must never see notifications for hidden entities |
| Import worker timing | MEDIUM | `after()` async — test 202 → poll until succeeded; one-active 409 |
| OpenAPI spec vs 65 routes | MEDIUM | Spec coverage of new domains (runs/bugs/imports/milestones) must match shipped handlers |
| No workspace delete/slug rotation | LOW | Multi-tenant lifecycle incomplete |
| Resend/Jira-sync absent | LOW | Email still GoTrue; bug sync future |

---

## 8. Discovery gaps — updated

| Gap | v1 verdict | v2 verdict |
|-----|-----------|-----------|
| Runs engine | "Planned — not testable" | **REAL — testable** |
| Bugs | "Planned — not testable" | **REAL — testable** |
| Tests | "Planned" | **REAL — testable** |
| Idempotency | "Skeleton only" | **Functional** |
| Scope enforcement | "Defined, unused" | **Enforced (`requires:`)** |
| PostgREST-only CRUD for taxonomy | "Projects/stories/ACs read-only" | **Full versioned API CRUD** |