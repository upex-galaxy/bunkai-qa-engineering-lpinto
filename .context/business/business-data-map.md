# Business Data Map — Bunkai (QA Lens)

> Generated: 2026-08-09 (v2 — synced to `upex-bunkai-tms` staging branch, tip `5e0134c`)
> Sources: `../upex-bunkai-tms/supabase/migrations/` (0001–0068), `../upex-bunkai-tms/app/api/v1/`, `../upex-bunkai-tms/lib/`, `../upex-bunkai-tms/.context/business/events.md`
> Cross-refs: `.context/business/business-feature-map.md`, `.context/business/business-api-map.md`, `.context/business/domain-glossary.md`
> Delta vs v1 (2026-08-09, main branch): runs/tests/bugs/environments/imports/milestones/notifications/activity/coverage NOW REAL (were "planned"). Schema grew 0012 → 0068 migrations.

---

## 1. Entity Summary (31 tables + 4 secret tables)

| # | Entity | Layer | Create via (authoritative) | Key FK Constraints |
|---|--------|-------|---------------------------|-------------------|
| 1 | `workspaces` | Tenant | `POST /api/v1/workspaces` (wraps `bunkai_bootstrap_workspace` RPC) | — |
| 2 | `workspace_members` | RBAC | Invite accept (`POST /api/v1/invites/accept`), leave via `DELETE /api/v1/workspaces/{id}/membership` | workspace_id, user_id, role enum |
| 3 | `workspace_invites` | RBAC | `POST /api/v1/workspaces/{id}/invites` → token returned once | workspace_id, email, status |
| 4 | `access_tokens` | Auth | `POST /api/v1/tokens`, or auto-mint on `signin` / `confirm` | workspace_id (nullable), user_id, scopes text[] |
| 5 | `access_token_secrets` | Auth (secret) | Split from `access_tokens` (migration 0011) — hash isolated; called `sibling secret table` | token_id |
| 6 | `projects` | Taxonomy | `POST /api/v1/workspaces/{id}/projects` | workspace_id |
| 7 | `modules` | Taxonomy | `POST /api/v1/projects/{id}/modules`; tree ops `PATCH/DELETE /api/v1/modules/{id}` | project_id, parent_id (self) |
| 8 | `project_environments` | Config | `POST /api/v1/projects/{id}/environments`; rename/remove `PATCH/DELETE /api/v1/environments/{id}` | project_id, case-insensitive name |
| 9 | `user_stories` | Traceability | `POST /api/v1/modules/{id}/user-stories` | module_id |
| 10 | `acceptance_criteria` | Traceability | `POST /api/v1/user-stories/{id}/acceptance-criteria`; `PATCH/DELETE /api/v1/acceptance-criteria/{id}` | user_story_id |
| 11 | `atcs` | **Core** | `POST /api/v1/atcs` → `bunkai_create_atc` RPC | project_id, version int |
| 12 | `atc_steps` | Core | Embedded in ATC create/update RPC | atc_id |
| 13 | `atc_assertions` | Core | Embedded in ATC create/update RPC | atc_id |
| 14 | `atc_acceptance_criteria` | Join (M:N) | Embedded in ATC create/update RPC | atc_id, acceptance_criteria_id |
| 15 | `tests` | Core | `POST /api/v1/tests` → `bunkai_create_test` RPC | project_id |
| 16 | `test_steps` | Join | Chain created atomically with Test; reorder `PATCH /api/v1/tests/{id}/reorder` | test_id, atc_id, position, step_id surrogate |
| 17 | `runs` | Execution | `POST /api/v1/runs` → `bunkai_create_run` RPC (env snapshot) | test_id, project_environment_id, executor_id |
| 18 | `run_atcs` | Execution | Auto-snapshot inside `bunkai_create_run` (chain positions) | run_id, atc_id |
| 19 | `run_steps` | Execution | Auto-snapshot inside `bunkai_create_run`; results via `POST /api/v1/runs/{id}/steps/{stepId}/mark` → `bunkai_mark_run_step` | run_atc_id |
| 20 | `bugs` | Defect | `POST /api/v1/bugs` → `bunkai_create_bug` RPC; assign `POST /api/v1/bugs/{id}/assign`; triage `POST /api/v1/bugs/{id}/status` | run_id/run_step_id/atc_id (nullable provenance), module_id, project_id, assignee_user_id |
| 21 | `import_jobs` | Async | `POST /api/v1/imports` (202, Vercel `after()` worker) — one active per project | workspace_id, project_id, status |
| 22 | `milestones` | Planning | `POST /api/v1/projects/{id}/milestones`; `PATCH /api/v1/milestones/{id}` | project_id, name case-insensitive |
| 23 | `notifications` | Notify | Written by DB triggers (`bunkai_notify_bug_event`, `bunkai_notify_run_event`); read via `GET /api/v1/workspaces/{id}/notifications` | workspace_id, entity_type, read_at |
| 24 | `notification_preferences` | Notify | `GET/PATCH /api/v1/notification-preferences` | user_id, event_type |
| 25 | `activity_log` | Audit | Written ONLY via SECURITY DEFINER RPCs (no client INSERT policy); read `GET /api/v1/activity` | workspace_id, actor_user_id, entity_type, action |
| 26 | `idempotency_keys` | Safety | `POST /api/v1/runs`, `/tests`, `/atcs`, `/imports` (Idempotency-Key reconstruction NOW functional) | key (hash), workspace_id |
| 27 | `feature_flags` | Config | PostgREST/RPC only (no API) | workspace_id |
| 28 | `user_view_state` | Config | PostgREST, owner-only (auth.uid() = user_id) | user_id |
| 29 | `magic_link_tokens` | Auth | Supabase GoTrue OTP tracking | user_id/email |
| 30 | `magic_link_token_secrets` | Auth (secret) | Split from `magic_link_tokens` (0011) | token_id |
| 31 | `workspace_invite_secrets` | Auth (secret) | Split from `workspace_invites` (0011) | token_id |
| 32 | `integrations` | Config | **NOT PRESENT** — greenfield schema never shipped; Jira import uses `import_jobs` (0019) + `lib/jira/import-runner.ts` instead | — |

> NOTE: v1's entity #9 `integrations` (Jira webhook config) does NOT exist in any migration (0001–0068). Jira connectivity is real but implemented as async `import_jobs` + `lib/jira/import-runner.ts`, not a config table. The v1 "idempotency skeleton" is also outdated — idempotent writes (replay store) are now functional on runs/tests/atcs/imports.

---

## 2. Core Data Flows

### Flow A: Signup → Verify → First ATC (verification-first, BK-166)

```
POST /auth/signup {email, pwd} → 202 {status: pending_confirmation} (NO session, NO PAT)
  → email OTP (6-8 digits)
POST /auth/confirm {email, token} → mints session + PAT atomically (this is where credentials first exist)
  → workspace → project (POST /workspaces/{id}/projects) → module tree → US + AC → ATC
```

**Test data chain**: 1 auth user → confirm mints 1 PAT → 1 workspace → 1 project → 3 modules → 1 US → 2 ACs → 1 ATC

**Key deltas vs v1**: `signup` returns 202 with NO credentials; the auto-confirm backdoor is closed. Sign-in keeps `min(6)` password (legacy), signup/confirm enforce `min(8)`.

### Flow B: ATC Reuse (Edit Propagation, BK-21)

```
ATC created → chained in Test A + Test B (test_steps) → edit ATC → bunkai_update_atc
  computes affected_test_ids = DISTINCT test_steps.atc_id in the SAME transaction
  → activity_log event atc.updated { version: n, affected_test_ids: [...] }
```

**Critical test**: edit ATC → `GET /api/v1/tests/{id}` reflects change in both Tests; `atc.updated` payload carries the real affected Test set (not `[]`).

### Flow C: Manual Run (start → mark → finish/abort)

```
POST /runs {test_id, environment_id} (Idempotency-Key REQUIRED, 24h start_token window)
  → bunkai_create_run snapshots chain (run_atcs + run_steps) + module snapshot
POST /runs/{id}/steps/{stepId}/mark {status} → bunkai_mark_run_step → position status computed
POST /runs/{id}/finish {verdict} | POST /runs/{id}/abort {reason} → terminal states + events
```

**Test data chain**: 1 project env (Staging) → 1 test (3 ATCs) → 1 run → 3 run_atcs → N run_steps

### Flow D: Bug Filing + Triage (BK-40, BK-264)

```
POST /bugs {project_id, title, severity, ...} (derives module/run/step/ATC server-side from run_step_id)
  → bunkai_create_bug re-validates module ∈ project (45300 defense in depth)
POST /bugs/{id}/assign {assignee_user_id} → status-adjacency + assignee-eligibility backstops (45312/45313)
POST /bugs/{id}/status {status} → one-stage-at-a-time transitions (45310/45311)
```

**Bug status machine**: `open → in_progress → resolved → closed` — forward-only, one step at a time. Severity `P1..P4`. Evidence-limited.

### Flow E: Traceability & Coverage (measured, not aspirational)

```
GET /projects/{id}/coverage            → bunkai_report_project_coverage (real run execution source, 0050)
GET /workspaces/{id}/coverage          → Home roll-up (same RPCs — never disagrees with per-project)
GET /projects/{id}/traceability        → story chain US→AC→ATC→Test→Run→Bug (0068)
GET /projects/{id}/metrics/recovery-cycles → recurrence stats (0049)
GET /projects/{id}/bugs/heatmap        → module defect heatmap (0052)
```

### Flow F: Activity & Notifications (read surfaces)

```
DB event → activity_log (RPC-written) → GET /api/v1/activity?workspace_id=&limit=&cursor= (paged, 200-with-empty never 404)
DB event (bug/run) → notifications row → GET /workspaces/{id}/notifications + POST /notifications/{id}/read
```

---

## 3. State Machines (real, from migrations)

| Entity | States | Transitions | Terminal |
|--------|--------|-------------|----------|
| `runs.status` (run grain) | running → passed / failed / aborted | finish (verdict), abort (reason ≤500ch, free-text) | passed/failed/aborted |
| `run_atcs.status` (position grain) | pending → passed / failed / blocked / skipped | aggregated from child run_steps marks | passed/failed/blocked/skipped |
| `run_steps.status` | pending → passed / failed / blocked / skipped | single mark per step (`bunkai_mark_run_step`) | passed/failed/blocked/skipped |
| `bugs.status` | open → in_progress → resolved → closed | **forward-only adjacency** (45310 skip, 45311 backward) | closed |
| `bugs.assignee` | unassigned ↔ assigned (member role ≥ member; 45312/45313) | `bunkai_assign_bug` | — |
| `workspace_invites` | pending → accepted / revoked / expired | 24h TTL, rotate (+7d clears acceptance) | accepted/revoked/expired |
| `import_jobs` | pending → running → succeeded / failed | Vercel `after()` worker; one active per project (0019+0020) | succeeded/failed |
| `notifications` | unread → read | `POST /notifications/{id}/read`, read-all; preference-gated | read |
| `milestones` | (no status column) | create/update only; target_date validated (past → 45502, >5y → 45503) | — |

> **Invariant (BK-317/domain-glossary)**: `aborted` is run-grain ONLY; a step is `skipped`, never `aborted`. There are three distinct run-status grains — never harmonise them with the KATA/IQL vocabulary (TODO/EXECUTING/PASS/FAIL).

---

## 4. Automatic Processes

| Process | Trigger | Effect | Testable? |
|---------|---------|--------|-----------|
| `atc.updated` event + `affected_test_ids` | inside `bunkai_update_atc` transaction (0035) | propagation + audit atomically | Yes — edit ATC, check event payload |
| `test.created` / `test.reordered` / `test.tags_changed` events | inside Test RPCs (0024/0026/0030) | activity_log rows | Yes |
| `module.renamed/.moved/.archived/.description_updated` events | 3 SECURITY DEFINER module RPCs (0023) | atomic audit; no-op early returns emit nothing | Yes |
| `run.started/.aborted/.finished` events | Run RPCs (0031/0036/0037) | activity_log; `run.aborted.reason` never surfaced in activity feed (BK-49) | Yes |
| `milestone.created/.updated` events (0064) | milestone RPCs | activity rows (never notifications — `bunkai_notify_bug_event` bug-only) | Yes |
| `bunkai_notify_bug_event` (0056/0057) | bug assign/status RPCs | notifications rows w/ deep links | Yes |
| `bunkai_notify_run_event` (0066) | run finish/abort | notifications rows | Yes |
| `bunkai_bugs_check_consistency` table trigger (0046/0054) | INSERT/UPDATE `bugs` | status-adjacency + assignee-eligibility DB-level backstop | Yes — direct SQL attempt |
| `atcs.tsv` refresh | title/tag change (0004) | search vector | Yes |
| Run realtime replication (0043) | run row changes | live broadcast to browser | Yes — two-session test |
| Run timeout/24h `start_token` window | RPC level | abandoned runs abortable window | Yes |
| `import_jobs` worker | `after()` on `POST /api/v1/imports` | pages Jira, upserts stories+ACs | Yes — Jira mock |

---

## 5. Test Data Strategies

| Entity | Create via | Cleanup via | Isolation |
|--------|-----------|-------------|-----------|
| Auth user | `POST /api/v1/auth/signup` → confirm OTP | (no delete API — Supabase admin) | One user per suite |
| PAT | `POST /api/v1/auth/confirm|signin` (auto) or `POST /api/v1/tokens` | `DELETE /api/v1/tokens/{id}` | Per-user |
| Workspace | `POST /api/v1/workspaces` | (no delete API) | One per suite |
| Member | invite accept (email match REQUIRED) | `DELETE /api/v1/workspaces/{id}/membership` (self-leave) | Multiple per workspace |
| Project | `POST /api/v1/workspaces/{id}/projects` | — | One per suite |
| Module | `POST /api/v1/projects/{id}/modules` | `DELETE /api/v1/modules/{id}` (soft archive subtree, 0014/0023) | Tree per project |
| US + AC | `POST /api/v1/modules/{id}/user-stories`, `POST /api/v1/user-stories/{id}/acceptance-criteria` | `PATCH/DELETE ...` per id | Scoped to module |
| ATC | `POST /api/v1/atcs` | (no delete endpoint; archive?) | Scoped to project |
| Test (chain) | `POST /api/v1/tests` (Idempotency-Key required) | — | Scoped to project |
| Environment | `POST /api/v1/projects/{id}/environments` | `DELETE /api/v1/environments/{id}` — blocked while any run references it | Scoped to project |
| Run | `POST /api/v1/runs` (Idempotency-Key REQUIRED) | terminal via finish/abort | Ephemeral |
| Bug | `POST /api/v1/bugs` | — (lifecycle closed) | Scoped to project |

---

## 6. Cross-Workspace Isolation Tests

For each entity with `workspace_id` FK (direct or via project):
1. Create in Workspace A → list as Workspace B member → expect `[]` (200, never 404/403 leak)
2. READ by ID as B → 404/403 — and foreign/missing workspace collapses to the SAME empty result (non-disclosure convention observed in `/activity`, `/workspaces/{id}/coverage`, `/tests?tag=`)
3. DELETE as B → 403
4. PAT scoped to workspace A calling workspace B admin op → `assertWorkspaceContext` 403 (ADR-0006)

**Entities covered**: projects, modules, user_stories, acceptance_criteria, atcs, tests, test_steps, runs, run_atcs, run_steps, bugs, import_jobs, milestones, notifications, activity_log, environments.

---

## 7. New Entities & Changes Since v1 (staging sync)

| Change | Migration | Impact |
|--------|-----------|--------|
| Runs engine REAL | 0031, 0035–0043 | runs/run_atcs/run_steps + create/mark/finish/abort/history/report/realtime/module-snapshot RPCs |
| Tests REAL | 0024–0030 | tests/test_steps CRUD + reorder + tags + filter + read-expanded RPCs |
| Bugs REAL + triage | 0046, 0051, 0054, 0056–0057, 0055 | bugs CRUD + assign/status/heatmap + notifications + activity events |
| Coverage REAL | 0048, 0050, 0049, 0052, 0068 | per-project coverage (real execution source), recovery cycles, heatmap, story traceability |
| Notifications | 0053, 0062, 0066 | notifications + preferences + run-event triggers |
| Milestones | 0064 | create/update + events (no status, no delete) |
| Import jobs REAL | 0019, 0020 | async Jira import + one-active-per-project |
| Auth verification-first | 0033, 0034, BK-166 | signup 202 pending_confirmation; confirm mints session+PAT; admin scope never global (ADR-0005) |
| Versioned API expanded | — | 19 → 64 route files; ~81 handlers; idempotency functional; scopes enforced via `requires:` |
| Module/US/AC CRUD via API | 0013–0018, 0021–0023 | soft-delete, move, description, ordering, ready-to-test gate, activity events |

---

## Cross-References

- `domain-glossary.md` — canonical terminology (ATC = Acceptance Test Case, NOT "Atomic Test Component"); anti-glossary entries
- `business-feature-map.md` — feature catalog + CRUD matrix + endpoint inventory (64 routes)
- `business-api-map.md` — auth tiers, Principal model (ADR-0001), journeys
- Target `../upex-bunkai-tms/.context/business/events.md` — full event vocabulary (activity_log sink)
- `.context/master-test-plan.md` — what to test and why