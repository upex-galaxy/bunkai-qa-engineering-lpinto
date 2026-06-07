# User Personas — Bunkai (QA Lens)

> Authoritative source: `../upex-bunkai-tms/.context/PRD/user-personas.md`
> Purpose: Testing behavior notes per persona — how each persona uses the system, what to verify from their perspective

---

## Elena Vargas — Senior QA

| Attribute | Value |
|-----------|-------|
| Role | Power user, manual + automation |
| Stack | VS Code, keyboard shortcuts, Playwright |
| Pain | Step duplication in Xray, untrustworthy reports, lost bug context |
| Wants | Provable traceability, shift-left, AI delegation |

### Testing Behavior

| What She Does | How We Test It |
|---------------|----------------|
| Creates ATCs with keyboard shortcuts | Keyboard navigation, hotkeys, accessibility |
| Reuses ATCs across tests | ATC chain editing, edit propagation |
| Files bugs during run execution | Bug-from-run flow, context auto-population |
| Searches ATC library via command palette | Global search, autocomplete, tsvector ranking |
| Imports stories from Jira | Jira import async job, max 500 issues, AC heuristic extraction |

### Edge Cases from This Persona
- Browser refresh mid-run — verify run state persisted
- Network drop during bug filing — verify optimistic UI + retry
- Concurrent runs on same test — verify isolation

---

## Mateo Silva — QA Lead

| Attribute | Value |
|-----------|-------|
| Role | Coverage oversight, audit, reporting |
| Industry | Fintech/healthtech (regulated) |
| Pain | Can't answer "what does this sprint cover?", audit anxiety |
| Wants | Coverage answers <1 minute, compliance-ready story |

### Testing Behavior

| What He Does | How We Test It |
|---------------|----------------|
| Reviews module heatmap for defects | Defect heatmap materialized view, trends |
| Exports traceability reports | US → AC → ATC → Test → Run chain |
| Audits role-based access | RLS policy verification, RBAC matrix |
| Monitors workspace activity | Activity log, audit trail |

### Edge Cases from This Persona
- Empty workspace — verify empty states on all views
- Workspace with 10K+ ATCs — verify tree view pagination, heatmap performance
- Archived modules — verify soft-delete behavior, `?include_archived` flag

---

## Sara Iglesias — Full-Stack Developer

| Attribute | Value |
|-----------|-------|
| Role | Developer, consumes test data |
| Stack | PRs, GitHub, Jira |
| Pain | Context-switching, bugs with no repro context |
| Wants | "Is my feature covered?" from PR, bug-to-PR links |

### Testing Behavior

| What She Does | How We Test It |
|---------------|----------------|
| Checks test coverage for her module | Tree view per module, coverage indicators |
| Views bug linked to PR | Bug detail with external_id, Jira backlinks |
| Reviews ATC for acceptance criteria | ATC detail with linked ACs |
| Searches for existing tests before adding | Search across user stories, ATCs |

### Edge Cases from This Persona
- No tests exist yet in module — verify "no coverage" empty state
- Jira sync fails — verify error state, retry mechanism
- PR refers to nonexistent Jira issue — verify graceful error handling

---

## Karim — AI Test Agent

| Attribute | Value |
|-----------|-------|
| Role | Non-human API consumer |
| Stack | REST API + Bearer token |
| Pain | Non-deterministic APIs, fragile integrations |
| Wants | Deterministic API, idempotency, stable semver |

### Testing Behavior

| What It Does | How We Test It |
|---------------|----------------|
| Authenticates via PAT | Bearer token auth, SHA-256 hash, `bk_pat_` prefix |
| Fetches test contract (ATC chain) | GET test with expanded ATCs |
| Starts run with idempotency key | POST /runs with Idempotency-Key header |
| Reports step results | POST step result (pass/fail/block) |
| Files bug on failure | Bug creation with auto-context |
| Finishes run | POST /runs/{id}/finish, validates no pending steps |

### Edge Cases from This Persona
- Duplicate idempotency key — verify 200 (not 409) on retry
- Expired PAT — verify 401 with meaningful error
- Concurrent human+agent on same run — verify conflict handling
- Rate limit exceeded — verify 429 response
- Abandoned run (agent crashes) — verify timeout/cleanup

---

## Persona-to-Test Matrix

| Feature | Elena | Mateo | Sara | Karim |
|---------|-------|-------|------|-------|
| Workspace CRUD | ✓ | ✓ | | |
| Module tree | ✓ | ✓ | ✓ | |
| ATC creation/search | ✓ | | ✓ | ✓ |
| Test chain editing | ✓ | ✓ | ✓ | ✓ |
| Manual execution | ✓ | | | |
| Bug filing | ✓ | | ✓ | ✓ |
| Reports/heatmaps | | ✓ | | |
| API auth | | | | ✓ |
| Jira import | ✓ | ✓ | | |
| Activity log | | ✓ | | ✓ (via API) |

## Cross-References

- `user-journeys.md` — flows each persona executes
- `.context/business/domain-glossary.md` — entity definitions
- `.context/SRS/functional-specs.md` — FR-to-test mapping per feature
