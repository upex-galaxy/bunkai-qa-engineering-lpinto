# Executive Summary — Bunkai (QA Lens)

> Authoritative source: `../upex-bunkai-tms/.context/PRD/executive-summary.md`
> Purpose: QA-oriented product overview — test strategy implications, not repetition

## Problem (from QA perspective)

Existing TMS tools (Xray, Zephyr, TestRail, qTest) produce:
- **Unreliable reports**: Pass/fail stats without structural traceability
- **Lost bug context**: Bug filed manually, separate from test data
- **Untestable data models**: Free-form steps, duplicated across tests, no enforced structure

Bunkai's data model enforces what QA teams do by convention: **structural traceability at the DB level**.

## Solution — Testing Implications

| Bunkai Feature | QA Verification Focus |
|----------------|-----------------------|
| ATCs as atomic reusable units | Verify ATC reuse across tests; verify edit propagation |
| Mandatory anchor: ATC → AC → User Story | Verify cascading delete/reference integrity |
| Ordered chains of ATCs (not free-form) | Verify reorder, insert, remove in chain |
| Native bug management | Verify bug lifecycle + context inheritance |
| REST API + OpenAPI | API-first contract testing |
| AI agent execution (Karim) | Verify idempotency, rate limiting, token auth |
| Supabase Realtime | Verify concurrent run updates via WebSocket |

## MVP Success Metrics — Testability

| Metric | Target | How We Test It |
|--------|--------|----------------|
| Activation rate | >60% | Could test sign-up → first ATC funnel |
| ATCs/workspace | >10 in week 1 | Bulk ATC creation + import |
| Tests-per-ATC ratio | <1.0 at day 30 | ATC-usage analytics endpoint |
| Week-4 retention | >40% | Not directly testable (longitudinal) |
| Structural correctness | 100% | RLS + FK constraint verification |
| GitHub stars | >500 | Not testable (community metric) |
| Docker Compose installs | >20 in 60 days | Not testable (community metric) |

## Non-Goals for MVP — Testing Exclusions

The following are explicitly out-of-MVP scope. We should NOT write tests for these:

| Non-Goal | Track via | Notes |
|----------|-----------|-------|
| Mind-map view | Feature flag (post-MVP) | |
| Semantic search (pgvector) | Feature flag | Not deployed in MVP DB |
| Agentic execution protocol | Post-MVP | MVP API is manual trigger only |
| CI/CD import adapters | Post-MVP | Only Jira import in MVP |
| SSO/SAML | Enterprise tier | |
| Self-hosted Docker | Phase 2 | |
| Parameterization UI | Post-MVP | |
| Marketplace | Phase 3 | |

## Cross-References

- Target PRD executive-summary.md — full product problem/solution/market context
- `user-personas.md` — who we test for
- `user-journeys.md` — what flows we test
- `.context/SRS/functional-specs.md` — FR-to-test mapping
