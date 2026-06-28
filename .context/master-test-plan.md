# Master Test Plan — Bunkai TMS

> What to test in this system, and why.

---

## 1. Executive Risk Map

Bunkai enforces structural traceability at the DB level — ATCs anchored to ACs, ACs to user stories, tests as ordered ATC chains, runs as execution instances. The deepest risk lies in **data integrity across these links**: if an ATC edit propagates incorrectly, every test that references it silently shows stale data. The second-critical surface is **tenant isolation**: a workspace A reading workspace B's data via a crafted ID or RLS gap is a hard security failure with no UI feedback. Third is **async resilience** — Jira imports, bug syncs, and run timeouts all depend on background jobs whose failure is invisible until data goes missing.

| Priority | Flow | Why it matters | Depends on / Affects |
|----------|------|----------------|----------------------|
| CRITICAL | ATC edit propagation | An ATC change silently reaches (or misses) every chained test — core trust mechanism | Tests, runs, bug context |
| CRITICAL | Tenant isolation (RLS) | Workspace B reading workspace A's data = data leak, no UI feedback | All entities gated by workspace_id |
| CRITICAL | Auth & token validation | Everything behind bearer token — if auth breaks, the whole API is open or locked | All API endpoints, agent execution |
| CRITICAL | Run execution state machine | Inconsistent run/step statuses produce unreliable reports — Bunkai's core value prop | Reporting, heatmap, traceability |
| HIGH | Jira import (async, heuristic) | 500-issue import with AC extraction — silent partial failure erodes trust in traceability | US + AC creation, workspace data |
| HIGH | Idempotency + retry safety | POST /runs with duplicate key creates duplicate data or state corruption | Agent execution, API reliability |
| HIGH | Bug → Jira sync (async backoff) | Filed bugs that never reach external tracker are invisible to dev workflow | Defect management, Jira integration |
| HIGH | Module tree integrity (depth, path, cascade) | Soft-delete cascade or path corruption breaks the taxonomy — tree view goes silent | Tree view, navigation, drill-down |
| MEDIUM | Jira bug sync retry / log | Exponential backoff without UI feedback — devs don't know sync is failing | Activity log, external tracker |

---

## 2. What to test first and why

### CRITICAL: ATC edit propagation

**Why it matters.** An ATC is referenced (not copied) by N tests. Editing its name, steps, or assertions must immediately reflect in every test chain. If propagation fails, a QA engineer sees stale data and makes a release decision based on it. This is the single most trust-critical mechanism in Bunkai — the reason ATCs exist as atomic units.

**What commonly breaks.** Partial propagation (some tests updated, some not), stale caching on the GET /tests/{id}?expand=atcs endpoint, race conditions when two edits hit the same ATC within seconds.

**Dependencies.** ATC CRUD (BK-010, BK-012), Test chain read (BK-017), Activity log (BK-038).

**What an experienced QA would check:**
- Edit an ATC name, then GET every test that references it — verify the name changed in all expanded responses
- Edit an ATC's step order, verify step order reflects in each test's expanded chain
- Edit while a run is in progress against that ATC — verify the run snapshot is NOT affected (run_atcs stores snapshots, not live references)
- Delete-and-restore an ATC mid-edit cycle — verify no orphaned references

### CRITICAL: Tenant isolation (RLS enforcement)

**Why it matters.** Bunkai uses Supabase Row-Level Security. Every entity has a workspace_id FK. A single missing RLS policy on a new endpoint or a JOIN that accidentally crosses workspace boundaries exposes all data. This is a **silent security failure** — no UI error, no log, no alert.

**What commonly breaks.** New endpoints added without RLS, bulk PATCH operations that skip policy checks, SELECT with crafted IDs that bypass the workspace filter, PAT tokens scoped to wrong workspace.

**Dependencies.** All entities (workspaces, projects, modules, US, AC, ATC, tests, runs, bugs, tokens, activity_log).

**What an experienced QA would check:**
- Create entity in workspace A, attempt to READ/LIST/UPDATE/DELETE from workspace B — expect 403 or empty list for every entity type
- Attempt to reference workspace A's project ID when creating a resource authenticated as workspace B — expect 403
- Test PAT tokens: a token issued in workspace A must not list workspace B's resources
- Test the `?include_archived` flag does not bypass RLS to expose archived data from other workspaces

### CRITICAL: Auth and token validation

**Why it matters.** Every API call except sign-up/login goes through bearer token or session auth. If the middleware is misconfigured, either all endpoints are open (data leak) or all are locked (no one works). BK-84 (staging PAT bearer auth regression) already proved this breaks in the real world.

**What commonly breaks.** New routes registered outside the auth middleware, PAT tokens with wrong scope (workspace:admin issued to member role — BK-135), token validation skipping on certain HTTP methods, expired tokens returning 200 instead of 401.

**Dependencies.** Everything behind API — all P0 endpoints, agent execution, bulk operations.

**What an experienced QA would check:**
- Every `/api/v1/` endpoint responds 401 with no/invalid/expired bearer token
- Token with `workspace:member` role cannot perform admin operations (BK-135 regression)
- Session auth and PAT auth are mutually exclusive but non-clobbering — logged-in session + PAT header must not interfere
- Password sign-in (BK-166) and magic-link sign-in (BK-2) both produce valid sessions

### CRITICAL: Run execution state machine

**Why it matters.** Runs are the output of the entire system — pass/fail/aborted statuses feed reporting, heatmaps, and traceability. A single illegal transition (e.g., passed → running) produces unreliable reports that poison every downstream decision.

**What commonly breaks.** run_atcs.status computed from run_steps but a race condition leaves it in running forever; finish endpoint accepts with pending steps (BK-024); abort leaves some steps in pending instead of skipped.

**Dependencies.** Run CRUD (BK-019–BK-024), Bug filing (BK-025), Reporting (BK-023), Heatmap (BK-026).

**What an experienced QA would check:**
- Pass all steps → run_atcs.status = pass, runs.status = passed
- Fail one step → run_atcs.status = fail, runs.status = failed
- Abort mid-run → remaining steps = skipped, run_atcs for incomplete ATCs = skipped
- Attempt to finish with a pending step → 422
- Concurrent step results from agent + human → no double-count or inconsistent state
- Run timeout sweeper abandons stale runs after 15 min

### HIGH: Jira import (async, 500-issue limit, AC heuristic)

**Why it matters.** The import is the primary data-population path for new workspaces. If it silently imports 300 of 500 issues, or extracts ACs incorrectly, the team trusts a partial picture. The heuristic AC extraction is especially fragile — it parses unstructured markdown.

**What commonly breaks.** Jira API credentials misconfigured (BK-142), import of 501+ issues truncates without warning, AC extraction misses edge-case formats, async job failure is invisible to the user.

**Dependencies.** BK-017 Jira import, activity_log, user_stories, acceptance_criteria.

**What an experienced QA would check:**
- Import exactly 500 issues → all imported
- Import 501 → first 500 imported, clear error for the 501st
- Import with invalid Jira credentials → async job fails, error logged, user notified
- Verify AC extraction on varied markdown formats (Gherkin, bullet list, numbered list, plain paragraphs)
- Poll import status mid-flight → status transitions pending → running → succeeded/failed

### HIGH: Idempotency + retry safety

**Why it matters.** Agentic execution (Karim) relies on idempotency keys to retry safely. If a duplicate POST /runs with the same key creates a second run, the agent cannot distinguish "first attempt failed" from "first attempt succeeded, retry creates a second". For bugs, the same applies to POST /bugs.

**What commonly breaks.** 24h TTL not enforced (old keys accepted), key collision across different workspaces, idempotency key on non-idempotent endpoints, different request bodies for same key returning stale data.

**Dependencies.** BK-037 idempotency keys, BK-019 run creation, BK-025 bug filing.

**What an experienced QA would check:**
- POST /runs with idempotency key → 201. Same key again → 200 (same run returned, not duplicate)
- Same key after 24h+1s → 201 new resource (TTL expired)
- Same key, different request body → 200 with original resource (first-wins semantics)
- Idempotency key on a GET endpoint → should be ignored or rejected

---

## 3. State machines that matter

### Runs: running → passed / failed / aborted

**Why transitions matter.** The runs state machine is the single source of truth for "did this test pass?". An illegal transition (e.g., re-open a passed run) invalidates the whole heatmap.

**Transitions most likely to be broken.** Abort while a step POST is in-flight (race: step writes after abort). Finish with pending steps (BK-024 guards this but must be enforced at the API level, not just UI).

**Terminal / forbidden states.** Once passed/failed/aborted, a run MUST NOT accept further step results. Re-opening a terminal run must be an explicit new run.

**How corruption would be detected (or not).** If run_atcs.status is computed via CASE WHEN trigger on run_steps, a missing trigger means the status never updates — no UI alert, report silently shows stale "running" or wrong pass rate.

### Run ATCs: pending → running → pass / fail / block / skipped

**Why transitions matter.** This is the per-ATC rollup that powers the exec view. If it stays "running" after all children are "pass", the exec progress bar is stuck.

**Transitions most likely to be broken.** "block" state on a child step should cascade to parent ATC = block. "skipped" should only appear after abort (or explicit skip) — a user skipping a step accidentally marks the whole ATC.

**How corruption would be detected (or not).** The UI shows progress_pct. If it stays at 50% after all steps are done, visible but only if someone looks at the exact number.

### Bugs: open → in_progress → resolved → closed (↻ open)

**Why transitions matter.** A resolved → open reopen is valid (bug reproduced again after fix). But closed → in_progress is illegal (closed is terminal unless reopened first). If the state machine allows closed → in_progress, the bug count in the heatmap is silently wrong.

**Transitions most likely to be broken.** Missing validation on the reopen transition; closed → open without audit trail.

### Workspace invites: pending → accepted / expired / revoked

**Why transitions matter.** Accepting an expired invite (24h TTL, BK-004) is a security gap. The 24h expiry is enforced at the DB level via a check constraint, but if the clock is off or the expiry column is nullable, the guard is bypassed.

---

## 4. Silent killers — automated processes

| Process | What it does | What breaks if it fails | Detection | QA strategy |
|---------|-------------|------------------------|-----------|-------------|
| run_atcs.status recomputation | CASE WHEN trigger on run_steps INSERT/UPDATE | Run status never updates, report shows stale values | No alert, log only | Synthetic probe: POST step result, verify parent status updated via API |
| runs.progress_pct | Computed from run_atcs completion | Progress bar stuck, user sees wrong % | Visible in UI (if someone looks) | Verify after each step result |
| module_defect_stats MV | Nightly cron to refresh heatmap | Heatmap shows yesterday's data | Manual "last refreshed" timestamp | Force-refresh API + verify delta |
| atcs.search_vector refresh | tsvector on INSERT/UPDATE ATC | ATC search returns stale/no results | User says "can't find ATC" | Search after ATC create, verify ranked result |
| modules.path update | Materialized path computed on INSERT/UPDATE module | Tree view shows wrong nesting | Silent — tree renders wrong | Create depth-3 tree, verify paths via DB or admin endpoint |
| Soft-delete cascade | UPDATE children archived_at when parent archived | Orphaned visible data | None — invisible until queried | Archive project, verify children also archived |
| Idempotency cleanup cron | DELETE expired keys every hour | Expired keys block legitimate retries (false 200) | None — agent sees 200, assumes already done | Wait >24h+1m, send same key, verify new resource created |
| Run timeout sweeper | Auto-abort runs with no activity for 15 min | Abandoned runs stay "running" forever, skew reporting | None — only visible in run list | Start run, wait 16 min, verify auto-aborted |
| Jira bug sync retry | Exponential backoff on failed syncs | Bugs never reach external tracker | activity_log shows retry attempts (if someone checks) | Mock Jira failure, verify retry pattern + logged |

---

## 5. External integrations — failure points

### Supabase (Postgres + Auth + Realtime)

| Aspect | Impact | Notes |
|--------|--------|-------|
| RLS policy gap | Data leak across workspaces | Single missing policy = all data exposed — test every entity |
| Realtime subscription drop | UI doesn't update on concurrent run changes | Two tabs on run detail, close one — other must continue receiving |
| Auth session expiry | User kicked mid-workflow | Session must refresh silently via Supabase's auto-refresh; test after 1h idle |

### Jira (import + bug sync)

| Aspect | Impact | Notes |
|--------|--------|-------|
| Import credentials missing (BK-142) | Import fails silently | Async job must show error status, user must be notified |
| Bug sync timeout/down | Bugs never reach Jira | Exponential backoff + activity_log + retry visibility |
| AC extraction heuristic | Wrong or missing ACs | Extract from various markdown formats — Gherkin, free-text, bullet lists |

### OAuth providers (GitHub / Google)

| Aspect | Impact | Notes |
|--------|--------|-------|
| Provider down (BK-3) | Sign-up blocked for that provider | Must fall back gracefully to email/password or show clear error |
| Popup blocker | OAuth flow never completes | Non-blocking message, alternative sign-up path visible |
| Account linking | Same email via OAuth + password | Must not create duplicate user — link accounts or reject with clear message |

---

## 6. Dependency cascade between flows

```
Sign-up / Auth
    │
    ▼
Workspace creation ──► Invite teammate ──► Project ──► Module tree
    │                                                    │
    │                                                    ▼
    │                                           User Story + ACs
    │                                                    │
    │                                                    ▼
    │                                             ATC creation
    │                                                    │
    │                                                    ▼
    │                                         Test (ATC chain)
    │                                                    │
    │                                                    ▼
    │                                         Run execution ──► Bug filing ──► Jira sync
    │                                                                              │
    ▼                                                                              ▼
Heatmap / Reports ◄────────────────────────────────────────────────────── Jira (external)
```

**Critical chains to verify end-to-end:**
- `Sign-up → Workspace → Project → Module → US → AC → ATC → Test → Run → Pass` — the happy path. If the chain breaks at any link, no value is delivered.
- `Run → Fail step → Bug → Jira sync` — the defect pipeline. If bug context is missing or Jira sync fails silently, the dev team never sees the bug.
- `ATC edit → Propagate to Test A and Test B → Both show updated data` — trust in edit propagation. If only Test A updates, the next Test B run uses stale ATC.

---

## 7. Edge cases developers commonly forget

### Concurrency
- Two agents posting step results simultaneously on the same run — must not double-count or produce inconsistent status
- Human editing an ATC while an agent run references that ATC — run snapshots must be isolated
- Two users creating the same project slug in different workspaces — must be allowed (slugs are workspace-scoped)

### Data limits
- 501 issues in Jira import → 500 imported, error for 501st (BK-009)
- Module depth >6 → rejected (BK-006)
- Description >50 KB → rejected (BK-099)
- PAT token with wrong scope for the operation → 403 (BK-135)
- Rate limit at 100 writes/min → 429 on 101st (BK-037)

### Timezone / DST
- Invite token TTL (24h) crossing DST boundary — must use UTC internally
- Activity log timestamps — verify all stored as UTC, UI renders in user's timezone
- Run timeout sweeper (15 min no activity) — must not be affected by system clock changes

### Permission boundaries
- Workspace member cannot delete workspace (owner only)
- Workspace member cannot invite new members (admin+ only)
- Viewer role can read but not create/edit/delete anything
- PAT tokens inherit the role of the issuing user at creation time — role changes after issuance must NOT affect existing tokens

### Orphaned states
- Delete a user — their active runs must be handled (abort? reassign?)
- Delete a project — all modules, US, AC, ATC, tests, runs under that project must cascade
- Archive a module — children must also archive (soft-delete cascade)
- Delete an ATC referenced by a test — test_steps reference must break? Or block the delete?

### Idempotency
- Same idempotency key across different workspaces — must not collide (key should incorporate workspace_id or be scoped)
- Same key after 24h+1s — must create new resource, not return stale data
- Same key with different body — must return original, not overwrite

---

## 8. Pre-release checklist (priority-ordered)

1. Verify RLS on every entity: create in workspace A, read/update/delete from workspace B → 403
2. Verify every `/api/v1/` endpoint returns 401 with expired/invalid/missing bearer token
3. Run the setup-to-pass chain: sign-up → workspace → project → module → US → AC → ATC → test → run → all steps pass → run status = passed
4. Edit an ATC that's referenced by 2+ tests — verify all tests reflect the change
5. Verify run state machine: pass all → passed; fail one → failed; abort → remaining = skipped; finish with pending → 422
6. Start a run, wait 16 min — verify timeout sweeper auto-aborts it
7. POST /runs with idempotency key → 201; same key → 200 (not 201); same key after >24h → 201
8. Import 501 Jira issues — verify 500 created, 501st rejected with clear error
9. File a bug from a run — verify bug auto-links run, ATC, module; verify Jira sync attempt is logged
10. Create a module at depth 7 → rejected; create at depth 6 → success
11. Set a PAT with workspace:member role → cannot perform admin operations (BK-135 regression)
12. Verify workspace isolation for `?include_archived` — soft-deleted entities from other workspaces must not appear
13. Test concurrent step result POSTs from two agents — no inconsistent status on run_atcs
14. Rate-limit burst: 101 writes/min → 429 on 101st
15. Mock Jira API failure during bug sync — verify <50ms local response, async retry logged

---

## 9. What is NOT in this plan

- Flow-level diagrams and state-machine transition tables → `.context/business/business-data-map.md`
- Feature catalog, CRUD matrix, feature flags → `.context/business/business-feature-map.md` (not yet generated — run `/business-feature-map`)
- API endpoint inventory / contracts → `bun run api:sync` + `/business-api-map`
- Detailed test case definitions and traceability → TMS (see `/test-documentation`)
- Sprint-level execution order → `.context/reports/SPRINT-{N}-TESTING.md` (see `/sprint-testing`)
- MVP out-of-scope features → `.context/PRD/executive-summary.md` (mind-map, semantic search, SSO, agentic protocol, self-hosted Docker)

---

## 10. Discovery gaps

- The feature-map (`business-feature-map.md`) was not available at generation time. This plan reflects `business-data-map.md`, PRD, SRS, and user journeys only. Angles missed: CRUD-coverage gaps, feature-flag risk, per-feature QA-relevance tagging. Run `/business-feature-map` and re-run `/master-test-plan` for the complete picture.
- No incident data from the Jira bug tracker was consulted — the 29 bugs synced from the BK board (BK-51 through BK-182) were not ingested into the risk model. Run `jira:sync-issues pull --include-comments` and re-analyze bug patterns to validate risk scores.
- External integration SLAs (Supabase, Jira API, OAuth providers) not documented. Rate limits, uptime SLAs, and timeout values should be sourced from provider docs and cross-referenced in §5.
- Module_defect_stats MV refresh frequency assumed nightly — confirm with dev team.
- Run timeout sweeper interval assumed 15 min — confirm current cron schedule in DB.
- Agent execution protocol (Karim) assumed POST-based — confirm if WebSocket or SSE channels exist for real-time step reporting.
