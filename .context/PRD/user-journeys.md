# User Journeys — Bunkai (QA Lens)

> Authoritative source: `../upex-bunkai-tms/.context/PRD/user-journeys.md`
> Purpose: Testing scenarios derived from each journey — smoke, happy-path, edge-case, failure

---

## Journey 1: First-Time Setup (Elena)

### Flow

Sign up → Workspace home → Create project → Build module tree → Import user story from Jira → Create first ATC

### Test Scenarios

| ID | Scenario | Type | Verification |
|----|----------|------|-------------|
| J1-H1 | Sign up with email/password + create workspace | Happy path | Workspace created, redirected to home |
| J1-H2 | Invite teammate via email | Happy path | Invite sent, recipient can accept |
| J1-H3 | Create project, add modules (depth ≤6) | Happy path | Tree renders correctly |
| J1-H4 | Import user story from Jira | Happy path | Story + ACs imported, heuristic extraction |
| J1-H5 | Create ATC anchored to US + AC | Happy path | ATC saved, link verified |
| J1-E1 | Sign up with existing email | Edge | 409 Conflict, meaningful error |
| J1-E2 | OAuth flow blocked (popup blocker) | Edge | Fallback to email/password |
| J1-E3 | Expired invite link | Edge | 410 Gone, "request new invite" |
| J1-E4 | Module depth >6 | Edge | Rejected, clear error message |
| J1-E5 | Jira import without valid credentials | Edge | Async job fails, error logged, user notified |
| J1-E6 | Jira import of 501+ issues | Edge | First 500 imported, remaining rejected |
| J1-E7 | ATC creation without AC anchor | Edge | Rejected, "must anchor to at least one AC" |

### API Variant

| ID | Scenario | Endpoint |
|----|----------|----------|
| J1-A1 | Create workspace + project via API | `POST /workspaces`, `POST /projects` |
| J1-A2 | Create module tree via API | `POST /modules` (children with `parent_id`) |
| J1-A3 | Create ATC via API with linked AC | `POST /atcs` |

---

## Journey 2: Manual Execution + Bug Filing (Elena, Day 3)

### Flow

Find test → Start run → Walk ATCs → Hit failure on discount code → File bug from run → Manager dashboard view

### Test Scenarios

| ID | Scenario | Type | Verification |
|----|----------|------|-------------|
| J2-H1 | Start run, pass all steps sequentially | Happy path | Run status = passed, timestamps recorded |
| J2-H2 | Start run, fail a step, file bug | Happy path | Bug created with auto-context (run, ATC, module) |
| J2-H3 | Start run, abort mid-way | Happy path | Remaining steps = skipped, run aborted |
| J2-E1 | Browser refresh mid-run | Edge | Run state persisted, resume from current step |
| J2-E2 | Two concurrent runs on same test | Edge | Both runs independent, no state corruption |
| J2-E3 | Network drop during step result POST | Edge | Optimistic UI, retry on reconnect |
| J2-E4 | Jira sync failure on bug filing | Edge | Bug saved locally, async retry with backoff |
| J2-E5 | Empty test (no ATCs in chain) | Edge | Run cannot start, clear error |
| J2-E6 | All steps blocked | Edge | Run status = blocked, partial results preserved |

### API Variant

| ID | Scenario | Endpoint |
|----|----------|----------|
| J2-A1 | Start run with idempotency key | `POST /runs` + `Idempotency-Key` |
| J2-A2 | Report step pass | `POST /runs/{id}/steps/{step_id}/result` |
| J2-A3 | Report step fail + file bug | `POST /runs/{id}/steps/{step_id}/result`, `POST /bugs` |

---

## Journey 3: AI Agent API Run (Karim)

### Flow

Authenticate → Fetch test contract → Start run with idempotency key → Report step results → Handle failure via bug API → Close run

### Test Scenarios

| ID | Scenario | Type | Verification |
|----|----------|------|-------------|
| J3-H1 | Full run via API: auth → start → steps → finish | Happy path | All endpoints respond correctly, run closed |
| J3-H2 | Idempotent retry (same key, same payload) | Happy path | 200, same run_id, no duplicate |
| J3-H3 | Start run, report step fail, file bug | Happy path | Bug created, linked to run |
| J3-E1 | Duplicate idempotency key, different payload | Edge | 409 Conflict, "key already used" |
| J3-E2 | Expired PAT | Edge | 401, "token expired" |
| J3-E3 | PAT with insufficient scope (no `run:execute`) | Edge | 403, "insufficient permission" |
| J3-E4 | Start run on nonexistent test | Edge | 404, "test not found" |
| J3-E5 | Report step result after run aborted | Edge | 422, "run already aborted" |
| J3-E6 | Finish run with pending steps | Edge | 422, "cannot finish run with pending steps" |
| J3-E7 | Rate limit exceeded (101st write in 1 min) | Edge | 429, retry-after header |
| J3-E8 | Abandoned run (agent crashes, no activity >30min) | Edge | Run eventually times out, cleanup |

### AI-Specific Verification

| Concern | Test Approach |
|---------|---------------|
| Response determinism | Same request → same response shape every time |
| Error message consistency | All errors: `{ success: false, error: { code, message } }` |
| Token auth on every endpoint | Every protected endpoint rejects missing/invalid tokens |
| Idempotency TTL (24h) | Same key after 24h → treated as new request |
| Cursor pagination on listings | `GET /runs?limit=10&before=<cursor>` returns consistent results |

---

## Cross-Journey Observations

| Observation | Testing Implication |
|-------------|---------------------|
| Same data model for human and agent flows | API ATC CRUD + UI ATC CRUD must produce identical data |
| Every write path goes through the API | No bypass-UI direct DB writes allowed (RLS enforces this) |
| Realtime via Supabase Realtime on run/bug tables | Verify WebSocket updates reach all connected clients |
| Idempotency on runs + bugs | Both POST endpoints must implement idempotency contract |
| PAT auth for API; JWT session for UI | Two parallel auth paths, one RLS enforcement |

## Cross-References

- `user-personas.md` — who executes each journey
- `.context/SRS/functional-specs.md` — FR mapping for each scenario
- `.context/business/business-model.md` — business impact of journey failures
