# Business Data Map — Bunkai (QA Lens)

> Authoritative source: `../upex-bunkai-tms/.context/business/business-data-map.md` (831 lines, 28 entities)
> Orchard: QA-oriented — entities, flows, state machines, test data strategies

---

## 1. Entity Summary

| # | Entity | Layer | Test Data Strategy | Key FK Constraints |
|---|--------|-------|-------------------|-------------------|
| 1 | `workspaces` | Tenant | Bootstrap via `bunkai_bootstrap_workspace()` RPC | — |
| 2 | `workspace_members` | RBAC | User invites + role assignment | workspace_id, user_id |
| 3 | `workspace_invites` | RBAC | Signed token, 24h expiry | workspace_id |
| 4 | `access_tokens` | Auth | PATs for API auth: `bk_pat_` prefix, SHA-256 hash | workspace_id, user_id |
| 5 | `projects` | Taxonomy | Create per workspace for test isolation | workspace_id |
| 6 | `modules` | Taxonomy | Self-referential tree, max depth 6 | project_id, parent_id (self) |
| 7 | `environments` | Config | Named targets (staging, prod) | project_id |
| 8 | `integrations` | Config | Jira webhook config | workspace_id |
| 9 | `user_stories` | Traceability | Jira import or direct creation | module_id |
| 10 | `acceptance_criteria` | Traceability | Gherkin-style, position-ordered | user_story_id |
| 11 | `atcs` | **Core** | Atomic test components, tsvector search | project_id |
| 12 | `atc_steps` | Core | Ordered steps, jsonb data | atc_id |
| 13 | `atc_assertions` | Core | Ordered assertions, jsonb expected | atc_id |
| 14 | `atc_acceptance_criteria` | Join (M:N) | ATC ↔ AC linking | atc_id, acceptance_criteria_id |
| 15 | `tests` | Core | Named ATC chain container | project_id |
| 16 | `test_steps` | Join | Ordered ATC references (not copies) | test_id, atc_id |
| 17 | `runs` | Execution | Test execution instance | test_id, executor_id |
| 18 | `run_atcs` | Execution | Per-ATC rollup (snapshot) | run_id, atc_id |
| 19 | `run_steps` | Execution | Per-step result (snapshot) | run_atc_id |
| 20 | `bugs` | Defect | Native defect linked to run/atc/module | run_id, atc_id, project_id |
| 21 | `activity_log` | Audit | Lightweight audit stream | workspace_id |
| 22 | `idempotency_keys` | Safety | POST replay guard (24h TTL) | key (hash) |
| 23 | `feature_flags` | Config | Phase-2 feature toggles | workspace_id |
| 24 | `imports` | Async | Jira import job tracking | workspace_id |

## 2. Core Data Flows

### Flow A: Setup → First ATC

```
Sign up → Workspace created → Project → Module tree → US + AC → ATC (with steps + assertions + anchored)
```

**Test data chain**: 1 auth record → 1 workspace → 1 project → 3 modules (depth 2) → 1 US → 2 ACs → 1 ATC (2 steps, 1 assertion)

### Flow B: ATC Reuse (Edit Propagation)

```
ATC created → Referenced in Test A and Test B → Edit ATC → Both tests reflect change
```

**Critical test**: Verify test A and test B both show updated ATC data via `GET /tests/{id}?expand=atcs`

### Flow C: Manual Run → Bug

```
Start run → Step A (pass) → Step B (fail) → File bug → Finish run (aborted)
```

**Test data chain**: 1 test (3 ATCs) → 1 run → 3 run_atcs → 5 run_steps → 1 bug

### Flow D: Agent API Run

```
PAT auth → GET test (expanded) → POST run (idempotency-key) → POST step results → POST finish
```

**Key diff from Flow C**: No UI interaction, idempotency key required, responses must be deterministic

## 3. State Machines

| Entity | States | Transitions | Init | Terminal |
|--------|--------|-------------|------|----------|
| `runs` | running → passed / failed / aborted | Pass all steps, fail any, abort | running | passed/failed/aborted |
| `run_atcs` | pending → running → pass / fail / block / skipped | Derived from child steps | pending | pass/fail/block/skipped |
| `run_steps` | pending → pass / fail / block / skipped | Single user/agent write | pending | pass/fail/block/skipped |
| `bugs` | open → in_progress → resolved → closed (↻ open) | Triaged, fixed, verified, reopened | open | closed |
| `workspace_invites` | pending → accepted / expired / revoked | 24h TTL, manual revoke | pending | accepted/expired/revoked |
| `imports` | pending → running → succeeded / failed | Async job lifecycle | pending | succeeded/failed |
| `access_tokens` | active → revoked / expired | Scope-based or TTL-based | active | revoked/expired |

## 4. Automatic Processes

| Process | Trigger | Effect | Testable? |
|---------|---------|--------|-----------|
| `run_atcs.status` recomputation | INSERT/UPDATE on `run_steps` | CASE WHEN aggregates child statuses | Yes — verify via API |
| `runs.progress_pct` | UPDATE on `run_atcs` | Percentage of completed run_atcs | Yes |
| `module_defect_stats` MV refresh | Nightly cron | Heatmap recalculated | Yes — force refresh |
| `atcs.search_vector` refresh | INSERT/UPDATE on `atcs` | tsvector index for full-text search | Yes |
| `modules.path` update | INSERT/UPDATE on `modules` | Materialized path for tree queries | Yes |
| Soft-delete cascade | UPDATE `archived_at` | Children also archived | Yes |
| Idempotency cleanup | Hourly cron | DELETE expired keys | Indirect (no side effect) |
| Run timeout sweeper | Every 15 min | Abandoned runs auto-aborted | Yes — wait-and-verify |
| Jira bug sync retry | Every 5 min | Exponential backoff on failed syncs | Yes — mock Jira failure |

## 5. Test Data Strategies

| Entity | Create via | Cleanup via | Isolation Strategy |
|--------|-----------|-------------|-------------------|
| Workspace | `bunkai_bootstrap_workspace()` RPC | Delete workspace (Owner only) | One workspace per test suite |
| Project | `POST /api/v1/projects` | Soft-delete project | Multiple projects per workspace |
| Module | `POST /api/v1/modules` | Soft-delete module | Tree per project |
| US + AC | `POST /api/v1/user-stories` | Cascade delete via module | Scoped to module |
| ATC | Server Action: `saveAtcAction` | Soft-delete ATC | Scoped to project |
| Test (chain) | `POST /api/v1/tests` | Soft-delete test | Scoped to project |
| Run | `POST /api/v1/runs` | Auto-cleanup via sweeper | Ephemeral (no manual cleanup) |
| Bug | `POST /api/v1/bugs` | DELETE bug | Scoped to project |
| PAT | `POST /api/v1/tokens` | DELETE token | Per-test-user |

## 6. Cross-Workspace Isolation Tests

For each entity:
1. Create entity in Workspace A
2. Attempt to LIST entities as Workspace B member → expect 0 results or empty array
3. Attempt to READ entity by ID as Workspace B member → expect 403 or 404
4. Attempt to DELETE entity as Workspace B member → expect 403

## Cross-References

- `domain-glossary.md` — entity definitions, ERD, business rules
- `functional-specs.md` — FR-to-test mapping
- `architecture-specs.md` — data flow assertions per entity
- Target `business-data-map.md` — full 28-entity detail, RLS policy, edition variance
