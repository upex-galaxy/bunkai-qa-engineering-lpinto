# Master Test Plan — Bunkai TMS

> What to test in this system, and why.

---

## 1. Executive Risk Map

Bunkai enforces structural traceability at the DB level, but the system is in **early stage** — of 24 data-map entities, only `atcs` and `access_tokens` have full CRUD via the versioned API. The rest rely on PostgREST auto-endpoints (read-only or not yet migrated). The deepest risk today is **tenant isolation (RLS)**: a single missing policy on any table leaks data across workspaces with zero UI feedback. Second is **ATC save integrity**: the `bunkai_save_atc` RPC is a single atomic write that bundles header, steps, assertions, and AC bindings — a rollback failure loses the entire ATC. Third is **auth middleware quality**: the bearer middleware exists (`requireBearerToken`) but zero routes call it — effectively dead code.

The planned run execution engine, testing chains, Jira sync, and defect management are **not yet implemented** (see §10 Discovery Gaps). Risk scoring below reflects what's testable today.

| Priority | Flow | Why it matters | Depends on / Affects | Testable Today? |
|----------|------|----------------|----------------------|-----------------|
| CRITICAL | Tenant isolation — RLS (FEAT-WS-004) | Sole auth mechanism — one missing policy = cross-workspace data leak | All entities gated by workspace_id | ✅ Yes (manual API) |
| CRITICAL | ATC save integrity (FEAT-ATC-001) | Atomic `bunkai_save_atc` RPC — partial failure loses header/steps/assertions/AC links | ATC authoring, edit propagation | ✅ Yes (API) |
| CRITICAL | Auth — session middleware (FEAT-AUTH-002) | Edge middleware is the gate — bypass or stale cookie = unauthorized access | All authenticated pages, API routes | ✅ Yes (E2E) |
| HIGH | PAT auth (FEAT-AUTH-005) | Token hash storage, revoke-then-create race, missing scope enforcement on routes | API endpoints, future agent execution | ✅ Yes (API) |
| HIGH | ATC anchoring integrity (FEAT-ATC-002) | M:N binding via `atc_acceptance_criteria` — orphaned links, duplicate bindings | ATC ↔ AC traceability | ✅ Yes (API) |
| HIGH | Module tree integrity (FEAT-PROJ-002) | Self-referential FK + materialized path — cycle detection, depth-6 enforcement | Sidebar tree view, navigation | ✅ Yes (API) |
| HIGH | Bearer middleware — dead code gap | `requireBearerToken()` exists but no route calls it (FEAT-API-006) | All future API routes | ⚠️ No routes wired |
| MEDIUM | ATC versioning (FEAT-ATC-005) | Version bump on save but no history UI — silent regression detection | Edit propagation audit | ✅ Yes (DB) |
| MEDIUM | API error envelope consistency (FEAT-API-001) | Bearer middleware returns raw 401, not `ErrorEnvelope` — inconsistent shape | Developer experience | ✅ Yes (API) |
| MEDIUM | Idempotency (FEAT-API-003) | Skeleton only — header validates, no replay store. Duplicate POSTs not caught | Future run creation (agent) | ⚠️ Not functional |
| PLANNED | ATC edit propagation | Core trust mechanism — but `tests`/`test_steps` not yet migrated | Planned Phase 2 | ❌ Not testable |
| PLANNED | Run execution state machine | Inconsistent run/step statuses produce unreliable reports | Planned Phase 2 | ❌ Not testable |
| PLANNED | Jira bug sync (async backoff) | Bugs never reach external tracker | Planned Phase 3 | ❌ Not testable |

---

## 2. What to test first and why

### CRITICAL: Tenant isolation — RLS (FEAT-WS-004)

**Why it matters.** Bunkai uses Supabase Row-Level Security as its **sole** authorization mechanism. Every entity has a workspace_id FK. A single missing RLS policy on any table — or a SECURITY DEFINER helper regression — exposes all data across workspaces. This is a **silent security failure** — no UI error, no log, no alert. The feature-map confirms RLS policies exist across 9+ tables with zero automated test coverage.

**What commonly breaks.** New PostgREST endpoints added without RLS (easy to miss when tables are auto-exposed), SECURITY DEFINER helper functions with infinite recursion or wrong `current_workspace_id()` resolution, bulk PATCH operations that skip policy checks, SELECT with crafted IDs that bypass the workspace filter.

**Dependencies.** All entities, every table with workspace_id FK.

**What an experienced QA would check:**
- Create entity in workspace A, attempt to READ/LIST/UPDATE/DELETE from workspace B — expect 403 or empty list for EVERY entity type (workspaces, projects, modules, US, AC, ATC, tokens)
- Attempt to reference workspace A's project ID when creating a resource authenticated as workspace B — expect 403
- Test PAT tokens: a token issued in workspace A must not list workspace B's resources
- Verify RLS security definer helpers (`current_workspace_id()`) do not return wrong workspace_id on session switch
- Test `?include_archived` flag does not bypass RLS

### CRITICAL: ATC save integrity (FEAT-ATC-001)

**Why it matters.** The `bunkai_save_atc` RPC is the single atomic write that persists ATC header + steps + assertions + AC bindings in one server action. If the RPC fails mid-flight — network drop, DB constraint violation, or a version collision — the entire ATC is lost. The feature-map confirms this is the **only** entity with full versioned CRUD, making it the single most value-critical surface in the system.

**What commonly breaks.** Race condition when two editors save the same ATC simultaneously (version bump collision), Monaco editor content not serialized correctly before the server action, AC binding links lost on re-save, markdown/YAML parsing mismatch on round-trip.

**Dependencies.** ATC CRUD (FEAT-ATC-001), ATC anchoring (FEAT-ATC-002), Step/assertion parsing (FEAT-ATC-003).

**What an experienced QA would check:**
- Create ATC with 5 steps, 3 assertions, 2 AC anchors → verify all persisted via GET
- Edit title, save → verify version bumped
- Concurrent save from two browser tabs → second save fails gracefully (version conflict)
- Remove all steps → save → verify empty steps persisted (or rejected)
- Corrupt YAML in assertions field → verify 422 with clear error

### HIGH: PAT auth — token lifecycle (FEAT-AUTH-005)

**Why it matters.** PATs are the auth mechanism for API consumers and future agent execution. The feature-map reveals a critical finding: the bearer middleware (`requireBearerToken`, `requireScope`) exists but **zero route handlers currently call it** (FEAT-API-006). This means PAT auth is dead code — no route enforces bearer validation. BK-84 and BK-135 proved real regressions on staging.

**What commonly breaks.** Token hash storage leak in logs, revoke-then-create race (old token still valid), `workspace:admin` scope issued to `member` role (BK-135), `revoked_at` or `expires_at` not checked on lookup.

**Dependencies.** `access_tokens` table, bearer middleware, all future API routes.

**What an experienced QA would check:**
- POST /api/v1/tokens → create PAT, verify `bk_pat_` prefix and SHA-256 hash storage
- DELETE /api/v1/tokens/{id} → soft-revoke, verify cannot list/use the token after
- Create PAT with `workspace:member` role → attempt admin operation → expect 403
- Token format: `bk_pat_<prefix>.<secret>` shown once, never again
- TTL enforcement: set PAT with 1-day TTL, verify expired after

### ⚠️ PLANNED — Run execution engine (FEAT-RUN-001)

**Not yet testable.** The run execution engine — `runs`, `run_atcs`, `run_steps`, `bugs`, `tests`, `test_steps` tables — does not exist yet. The `run:execute` scope is defined in migration 0008 but no routes, no state machine, no timeout sweeper, no cascading triggers are deployed. This section is placeholder for Phase 2.

**What an experienced QA would check once available:**
- Pass all steps → run_atcs.status = pass, runs.status = passed
- Fail one step → run_atcs.status = fail, runs.status = failed
- Abort mid-run → remaining steps = skipped
- Attempt to finish with a pending step → 422
- Concurrent step results from agent + human → no inconsistent state
- Run timeout sweeper abandons stale runs

### HIGH: ATC anchoring integrity (FEAT-ATC-002)

**Why it matters.** Every ATC requires at least one AC anchor before it can be saved. The M:N binding via `atc_acceptance_criteria` join table is the structural traceability backbone — if binding is lost on re-save, or duplicate bindings are created, the US → AC → ATC chain is broken. The feature-map flags this as MEDIUM-HIGH risk.

**What commonly breaks.** Re-saving an ATC drops existing AC bindings (full-replace semantics), duplicate anchor entries on concurrent saves, anchoring to ACs from a different user story not allowed but not validated, story search not finding existing ACs.

**Dependencies.** `atc_acceptance_criteria` join table, `saveAtcAction` Server Action, `AnchoringPanel` UI.

**What an experienced QA would check:**
- Create ATC anchored to AC-1, save → verify `atc_acceptance_criteria` has 1 row
- Edit ATC, add AC-2 anchor, save → verify 2 rows (old binding preserved)
- Remove AC-1, save → verify 1 row (AC-2 only, AC-1 removed)
- Attempt to save ATC without any AC anchor → rejected
- Search for user story in anchoring panel → verify ACs load correctly

### MEDIUM: Module tree integrity (FEAT-PROJ-002)

**Why it matters.** The module tree is self-referential (parent_id on modules) with a max depth of 6 and a materialized path computed via trigger. The sidebar tree view, ATC table module-path column, and all tree navigation depend on it. The feature-map confirms this is stable but has no creation UI — modules are created via PostgREST directly or not at all.

**What commonly breaks.** Cycle detection missing (module A parent of module B, module B parent of module A), depth >6 not rejected, materialized path not updated after parent move, soft-delete cascade not archiving children.

**Dependencies.** `modules` table tree builder, PostgREST endpoints, Sidebar UI component.

**What an experienced QA would check:**
- Create module depth 1 → 6 → verify tree renders (max depth = 6)
- Attempt depth 7 → verify rejected
- Create root module, child, grandchild → verify materialized path ancestry
- Attempt to set parent_id creating a cycle → verify rejected
- Soft-delete a parent module → verify children also archived (cascade)

---

## 3. State machines that matter

### Workspace invites: pending → accepted / expired / revoked

**Why transitions matter.** Accepting an expired invite (24h TTL) is a security gap. The feature-map confirms the `workspace_invites` table exists but the invite flow has no UI — the state machine is schema-only.

**Transitions most likely to be broken.** Expiry not enforced at API level (only DB check constraint), nullable `expires_at` bypasses the guard, revoked invites still actionable.

**How corruption would be detected (or not).** Only visible if someone checks the invite status before accepting. No UI notification for revoked/expired invites.

### ATC version: bump on save (no history)

**Why transitions matter.** The `atcs.version` column increments on every save but there is no history table or rollback. If a corrupt save overwrites a good version, the previous state is unrecoverable.

**Transitions most likely to be broken.** Concurrent saves causing version collision (lost update), negative version numbers (DB constraint might not prevent), version not incremented on partial edits.

### Planned — Run state machine (not yet implemented)

Not yet testable. The runs engine (`running → passed / failed / aborted`) with cascading `run_atcs` and `run_steps` status triggers is planned for Phase 2.

### Planned — Bug state machine (not yet implemented)

Not yet testable. The bug lifecycle (`open → in_progress → resolved → closed → open`) is planned with the defect management module.

---

## 4. Silent killers — automated processes

| Process | What it does | What breaks if it fails | Detection | QA strategy | Status |
|---------|-------------|------------------------|-----------|-------------|--------|
| atcs.search_vector refresh | tsvector on INSERT/UPDATE ATC | ATC search returns stale/no results | User says "can't find ATC" | Search after ATC create, verify ranked result | ✅ Active |
| modules.path update | Materialized path computed on INSERT/UPDATE module | Tree view shows wrong nesting | Silent — tree renders wrong | Create depth-3 tree, verify paths via DB | ✅ Active |
| Soft-delete cascade | UPDATE children archived_at when parent archived | Orphaned visible data | None — invisible until queried | Archive project, verify children also archived | ✅ Active |
| Idempotency cleanup cron | DELETE expired keys every hour | Expired keys block legitimate retries (false 200) | None — agent sees 200 | ⚠️ Not migrated yet — no idempotency table | ❌ Planned |
| Run timeout sweeper | Auto-abort runs with no activity for 15 min | Abandoned runs stay "running" forever | None — only visible in run list | Not testable — runs engine not implemented | ❌ Planned |
| Jira bug sync retry | Exponential backoff on failed syncs | Bugs never reach external tracker | activity_log shows retry attempts | Not testable — Jira sync not implemented | ❌ Planned |
| run_atcs.status recomputation | CASE WHEN trigger on run_steps | Run status never updates | No alert, log only | Not testable — runs engine not implemented | ❌ Planned |
| module_defect_stats MV | Nightly cron to refresh heatmap | Heatmap shows yesterday's data | Manual "last refreshed" | Not testable — heatmap not implemented | ❌ Planned |

---

## 5. External integrations — failure points

The feature-map confirms only **Supabase** is actively integrated. All other services (Resend, Jira, Tavily, n8n) have env vars configured but zero application code consuming them. This dramatically reduces the integration testing surface.

### Supabase (Postgres + Auth + Realtime) — ACTIVE

| Aspect | Impact | Notes |
|--------|--------|-------|
| RLS policy gap | Data leak across workspaces | Single missing policy = all data exposed — test every entity with workspace_id |
| Auth session expiry | User kicked mid-workflow | Session must refresh silently via Supabase's auto-refresh |
| PostgREST auto-endpoints | Read/write bypasses versioned API | Tables auto-exposed — RLS is the only guard on most entities |

### Jira (import) — Configured only, no code

| Aspect | Impact | Notes |
|--------|--------|-------|
| Import credentials missing (BK-142) | Import endpoint exists but may fail | `ATLASSIAN_*` env vars set but Jira sync code not implemented |
| AC extraction heuristic | Not yet built | Planned Phase 3 |

### OAuth providers (GitHub / Google) — Planned next sprint

| Aspect | Impact | Notes |
|--------|--------|-------|
| Provider down | Sign-up blocked for that provider | Must fall back gracefully to email/password or show clear error |
| Popup blocker | OAuth flow never completes | Non-blocking message, alternative sign-up path visible |

### Resend — Configured only, not wired

| Aspect | Impact | Notes |
|--------|--------|-------|
| No SDK in package.json | Magic-link delivery uses Supabase GoTrue default provider | Cannot customize or test transactional email flow — FEAT-INT-002 |

---

## 6. Dependency cascade between flows

```
Sign-up / Auth
    │
    ▼
Workspace creation ──► Project ──► Module tree
    │                                    │
    │                                    ▼
    │                           User Story + ACs
    │                                    │
    │                                    ▼
    │                             ATC creation  ◄── (current system boundary)
    │                                    │
    │                       ┌────────────┴────────────┐
    │                       ▼                         ▼
    │              Planned Phase 2:           Planned Phase 3:
    │           Test (ATC chain) ──►       Jira bug sync
    │           Run execution
    │           Bug filing
    │           Heatmap
    │
    ▼
Reports / dashboard (PostgREST)
```

**Critical chains to verify end-to-end (testable today):**
- `Sign-up → Workspace → Project → Module → US → AC → ATC` — the setup chain. If it breaks at any link, no ATC can be authored. This is the only complete end-to-end flow available in the current system.
- `ATC create → Edit → Verify version bump` — the write cycle. A corrupt save loses the entire ATC.
- `Workspace A ↔ Workspace B isolation` — RLS is the only auth mechanism on most tables. Test every entity.

**Planned chains (not testable until Phase 2+):**
- `ATC edit → Propagate to Test A and Test B` — requires `tests` table migration.
- `Run → Fail step → Bug → Jira sync` — requires runs engine + bugs table + Jira sync code.

---

## 7. Edge cases developers commonly forget

### Concurrency
- Two users saving the same ATC simultaneously — version collision must produce a clear conflict error, not silent overwrite (FEAT-ATC-005)
- Two users creating the same project slug in different workspaces — must be allowed (slugs are workspace-scoped)
- Revoke PAT while a request is in-flight using that token — must check `revoked_at` on every request

### Data limits
- Module depth >6 → rejected (FEAT-PROJ-002)
- Description >50 KB → should be rejected (BK-099 — not yet enforced)
- Workspace slug 3-40 chars, lowercase/digits/hyphens only (FEAT-WS-001)
- PAT TTL up to 365 days — verify expiry enforcement (FEAT-AUTH-005)

### Timezone / DST
- Invite token TTL (24h) crossing DST boundary — must use UTC internally
- Activity log timestamps — not yet migrated but design must store UTC

### Permission boundaries (FEAT-WS-002)
- Workspace member cannot delete workspace (owner only)
- Workspace member cannot invite new members (admin+ only)
- Viewer role can read but not create/edit/delete anything
- PAT tokens inherit the role of the issuing user at creation time — role changes after issuance must NOT affect existing tokens (BK-135 regression)
- Bearer middleware `requireScope()` must reject insufficient-scope tokens

### Orphaned states
- Delete a user — what happens to their ATCs? Orphaned ownership.
- Archive a module — children must also archive (soft-delete cascade confirmed in data-map)
- Delete a project — all modules, US, AC, ATC under that project cascade?
- Delete an ATC referenced by nothing — clean delete allowed? (No `tests` table to be referenced by)

### ATC save edge cases
- Empty steps array — should save with zero steps
- Empty assertions array — should save with zero assertions
- Same AC anchored twice — should deduplicate or reject
- ATC title with special characters — must not break the Monaco editor
- Steps markdown with code blocks — must survive round-trip parse/serialize (FEAT-ATC-003)

### Auth edge cases
- Session cookie expired mid-session — Supabase auto-refresh must work silently
- PAT with `bk_pat_` prefix but malformed hash — expect 401, not 500
- Token from another workspace's scope — expect 403 on cross-workspace read

---

## 8. Pre-release checklist (priority-ordered)

### Testable today (system boundary = ATC authoring)

1. Verify RLS on every entity with workspace_id: create in workspace A, read/update/delete from workspace B → 403 or empty result
2. Run the setup chain: sign-up → workspace → project → module → US → AC → ATC → verify ATC persisted with all anchors
3. Create ATC with 5 steps, 3 assertions, 2 AC anchors → verify GET returns all data
4. Edit ATC title → verify version incremented
5. Concurrent save on same ATC from two tabs → second save fails with version conflict
6. Create module at depth 7 → rejected; depth 6 → success; verify materialized path
7. Soft-delete a module (archive) → verify children also archived
8. Create PAT, list tokens, revoke, verify revoked token not listed
9. Create PAT with `workspace:member` scope → attempt admin operation → 403 (BK-135 regression)
10. Create entity in workspace A → verify workspace B cannot access via crafted ID (RLS)
11. Verify API error envelope consistency: invalid input → 422 with `{ error: { code, message, details } }`
12. Attempt ATC save without AC anchor → rejected (FEAT-ATC-002)

### Planned (not testable until Phase 2+)

13. Edit ATC referenced by 2+ tests — verify all tests reflect the change (requires `tests` table)
14. Run state machine: pass all → passed; fail one → failed; abort → skipped; finish with pending → 422
15. POST /runs with idempotency key → 201; same key → 200; same key after >24h → 201
16. Import 501 Jira issues → 500 created, 501st rejected
17. File bug from run → verify auto-context + Jira sync attempt
18. Rate-limit burst: 101 writes/min → 429 on 101st

---

## 9. What is NOT in this plan

- Flow-level diagrams and state-machine transition tables → `.context/business/business-data-map.md`
- Feature catalog, CRUD matrix, feature flags → `.context/business/business-feature-map.md`
- API endpoint inventory / contracts → `bun run api:sync` + `/business-api-map`
- Detailed test case definitions and traceability → TMS (see `/test-documentation`)
- Sprint-level execution order → `.context/reports/SPRINT-{N}-TESTING.md` (see `/sprint-testing`)
- MVP out-of-scope features → `.context/PRD/executive-summary.md` (mind-map, semantic search, SSO, agentic protocol, self-hosted Docker)

---

## 10. Discovery gaps

- **CRUD coverage is critically low** — of 24 data-map entities, only `atcs` and `access_tokens` have full CRUD via the versioned API. Most entities are read-only through PostgREST with no creation/update/deletion UI. The runs engine, tests, bugs, activity_log, imports, and 5+ other tables are not yet migrated. The system is running ahead of its database — testing is constrained to read operations and ATC/token flows.
- **Bearer middleware is dead code** — `requireBearerToken()` and `requireScope()` exist in `lib/api/middleware/bearer.ts` but no route handler currently calls them. PAT auth cannot be verified end-to-end through the API; only token CRUD endpoints can be tested (creation, listing, revocation). Middleware enforcement is speculative until routes are wired.
- **No incident data from Jira bug tracker ingested** — 29 bugs from the BK board (BK-51 through BK-182) were not analyzed against this plan. Historical bug patterns could validate or adjust risk scores. Run `jira:sync-issues pull --include-comments` and cross-reference.
- **OpenAPI spec is incomplete** — only 5 endpoints documented (Health, Auth, Tokens). PostgREST endpoints, Server Actions, and the entire UI data layer are absent from the spec. Contract testing coverage is ~20%.
- **Idempotency not functional** — header validation only, no replay store. Once write endpoints land in Phase 2, duplicate POSTs will not be caught.
- **No UI for entity creation** — projects, modules, user stories, and ACs have no creation form. They appear to be created through external imports (Jira) or direct DB inserts. ATCs cannot be created without first having a story + AC to anchor to — this is a bootstrap dependency that must be tested manually.
- **External integration SLAs not documented** — rate limits and timeouts for Supabase Auth, PostgREST, and OAuth providers are not sourced.
- **Agent execution protocol** (Karim) assumed POST-based — confirm if WebSocket or SSE channels exist for real-time step reporting when runs engine lands.
