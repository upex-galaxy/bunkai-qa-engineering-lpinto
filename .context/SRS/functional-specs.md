# Functional Specs — Bunkai (QA Lens)

> Authoritative source: `../upex-bunkai-tms/.context/SRS/functional-specs.md` (40 FRs)
> Purpose: FR-to-test-approach mapping. Every FR gets verification strategy, priority, method.

---

| FR | Feature | Verification Strategy | Priority | Method |
|----|---------|---------------------|----------|--------|
| BK-001 | Sign-up validation (email format, password ≥8 chars) | Submit invalid forms, verify client + server validation rejection | P0 | API + UI |
| BK-002 | OAuth sign-up (Google/GitHub) | Mock OAuth flow, verify user created + redirected | P1 | UI |
| BK-003 | Workspace creation with slug uniqueness | Create duplicate slug → 409; verify slug is alphanumeric | P0 | API |
| BK-004 | Invite teammate (signed token, 24h expiry) | Create invite, accept, accept expired → 410 | P0 | API |
| BK-005 | Project creation within workspace | Create project, verify `workspace_id`, list projects | P0 | API |
| BK-006 | Module CRUD with depth max 6 | Create module, child, grandchild... depth 7 → error | P0 | API |
| BK-007 | US CRUD + markdown description | Create US, update, soft-delete, archive restore | P0 | API |
| BK-008 | AC CRUD + position rebalancing | Create ACs, reorder, delete mid-list → positions recalculated | P0 | API |
| BK-009 | Jira import (async, max 500, heuristic AC extraction) | Trigger import, poll status, verify US+ACs created | P1 | API |
| BK-010 | ATC creation requires ≥1 AC anchor | Create ATC without AC → rejected; with AC → success | P0 | API |
| BK-011 | ATC search via tsvector full-text | Create ATCs with specific terms, search, verify ts_rank ordering | P0 | API |
| BK-012 | ATC edit propagation (auto to all tests) | Edit ATC name/step, verify reflected in all chained tests | P0 | API + UI |
| BK-013 | ATC usage report | Create ATC used in 3 tests, GET usage → count=3 | P1 | API |
| BK-014 | ATC duplication | Duplicate ATC, verify new ATC with "copy" title, same steps | P1 | API |
| BK-015 | Test creation as ordered ATC chain | Create test with ATCs, verify order preserved | P0 | API |
| BK-016 | Test reorder (drag in UI) | Reorder ATCs, verify new order via GET | P0 | UI |
| BK-017 | Test expanded view (single join) | GET test with expanded ATCs → all ATC data in one query | P1 | API |
| BK-018 | Test tagging (smoke/sanity/regression) | Create test with tags, filter by tag | P1 | API |
| BK-019 | Start run → run_atcs + run_steps created pending | POST /runs, verify cascading row creation | P0 | API |
| BK-020 | Step result → recompute parent statuses | Pass all steps → run=passed; fail one → run=failed | P0 | API |
| BK-021 | Abort run → remaining steps = skipped | Abort mid-run, verify remaining status=skipped | P0 | API |
| BK-022 | Run history with cursor pagination | Create 25 runs, GET with limit=10, paginate | P1 | API |
| BK-023 | Project-wide run filter + aggregates | Filter by date/env/status, verify aggregate counts | P1 | API |
| BK-024 | Finish run validates no pending steps | Attempt finish with pending step → 422 | P0 | API |
| BK-025 | Bug filing auto-links to run + ATC + module | Create bug from run, verify context populated | P0 | API |
| BK-026 | Module-filtered bug listing + defect heatmap | File bugs in different modules, verify heatmap counts + trends | P1 | API |
| BK-027 | Jira sync (async, exponential backoff) | File bug, verify async sync attempt, check retry behavior | P1 | API |
| BK-028 | Jira sync failure → retry + log | Mock Jira 500, verify exponential backoff, activity logged | P2 | API |
| BK-029 | Tree view (recursive CTE) with status dots | Create module hierarchy, verify tree depth, status propagation | P0 | UI |
| BK-030 | Table view with filters, sort, bulk PATCH | Filter/sort entities, bulk archive, verify consistency | P1 | UI |
| BK-031 | Command palette multi-source search | Type "/" → search across US/ATC/test/module, verify weighting | P1 | UI |
| BK-032 | Persisted view state (filters, sort, scroll) | Set filters, refresh, verify state restored | P2 | UI |
| BK-033 | OpenAPI served at `/api/openapi.json` | GET openapi.json → 200, valid schema | P0 | API |
| BK-034 | Bearer token 32-byte random, `bk_pat_` prefix, SHA-256 hash | Create token, verify prefix, verify hash storage | P0 | API |
| BK-035 | CRUD under `/api/v1/` with `{ success, data, error }` | Every endpoint returns consistent envelope | P0 | API |
| BK-036 | CLI commands: auth login, atc list, run start/import | Smoke test CLI (if implemented) | P2 | CLI |
| BK-037 | Idempotency keys (24h TTL) | Same key within 24h → 200; after 24h → new resource | P0 | API |
| BK-038 | Audit-light activity log | Perform write ops, verify activity_log entries | P1 | API |
| BK-039 | Soft-delete with `archived_at` + `?include_archived` | Delete entity, GET without flag → not included; with flag → included | P0 | API |
| BK-040 | Realtime subscriptions on run/bug tables | Two browser tabs, run step update → both receive | P0 | UI |

## Priority Definitions

| Priority | Meaning | Target Coverage |
|----------|---------|-----------------|
| **P0** | Core MVP functionality — must test before release | 100% automated |
| **P1** | Important feature — should test, delays acceptable | Automated if ROI positive |
| **P2** | Nice-to-have — smoke test manually | Manual or deferred |

## Cross-Cutting Requirements

| Requirement | FRs | Test Approach |
|-------------|-----|---------------|
| Zod validation (client + server) | BK-001, BK-006, BK-010, BK-015 | Submit invalid data at both layers |
| RLS enforcement (workspace isolation) | All BK-* | Create data in workspace A, verify not listable from workspace B |
| Rate limiting (100 writes/min) | BK-037 | Burst 101 writes → 429 |
| Response envelope consistency | All BK-* | Every endpoint returns `{ success, data?, error? }` |
| API-only write path | All BK-* | Attempt direct `supabase.from(...).insert()` via PAT → verify RLS blocks |

## Cross-References

- `user-journeys.md` — journey-scenario to FR mapping
- `architecture-specs.md` — data flow details per FR
- `non-functional-specs.md` — performance/security FRs (BK-037+)
- Target `functional-specs.md` — full FR detail (input/processing/output/validation)
