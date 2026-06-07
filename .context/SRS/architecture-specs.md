# Architecture Specs — Bunkai (QA Lens)

> Authoritative source: `../upex-bunkai-tms/.context/SRS/architecture-specs.md`
> Full detail: C4 diagrams, ERD, tech stack, data flows, RLS policy summary in target repo.
> Purpose: Architecture from a testability perspective — what to verify at each layer.

---

## System Context (C4 L1)

```
┌─────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Browser     │────>│  Next.js 15       │────>│  Supabase        │
│  (React SPA) │     │  (Vercel Edge)    │     │  ─ PostgreSQL 16 │
│              │     │  Route Handlers   │     │  ─ Auth          │
│              │     │  Server Components│     │  ─ Realtime      │
│              │     │  RSC              │     │  ─ Storage       │
├─────────────┤     └───────────────────┘     └──────────────────┘
│  AI / CLI   │──────────────┘                     │
│  (REST API  │                              ┌─────┴──────┐
│   consumers)│                              │ Cloudflare  │
└─────────────┘                              │ R2 (blobs) │
                                             └────────────┘
```

## Testing Layers & Approach

| Layer | Technology | What to Test | Tool |
|-------|-----------|-------------|------|
| **UI** | React 19 + shadcn/ui + Tailwind | Component rendering, user interactions, form validation, keyboard nav, empty/error/loading states | Playwright (KATA Page components) |
| **Route Handlers** | Next.js 15 App Router (`app/api/`) | Request parsing, Zod validation, auth checks, response formatting | Playwright `APIRequestContext` (KATA Api components) |
| **API Gateway** | RLS policies per table | Permission enforcement by role; data isolation per workspace | KATA Api + DBHub (direct RLS assertion) |
| **Database** | Supabase PostgreSQL 16 | FK constraints, cascading deletes, tsvector search, recursive CTEs, triggers | DBHub MCP (once configured) |
| **Auth** | Supabase Auth + Bearer PATs | JWT session flow, PAT creation/validation, scope enforcement, token expiry | KATA Api + Playwright auth fixture |
| **Realtime** | Supabase Realtime | WebSocket subscriptions on run/bug tables, event propagation | Playwright (multi-tab/multi-user) |
| **Async Jobs** | Jira import (REST worker) | Queue behavior, error handling, retry, webhook callbacks | KATA Api (poll import_job status) |
| **External Integrations** | Jira, Sentry, PostHog | Webhook reliability, error handling, backpressure | KATA Api (mock external) |

## Database Testing Map

| Entity | FK Verifications | RLS Policy | Cascade Behavior |
|--------|-----------------|------------|-----------------|
| `workspaces` | — | Owner manages | — |
| `workspace_members` | workspace_id → workspaces, user_id → auth.users | Viewer: read own | CASCADE on workspace delete |
| `projects` | workspace_id → workspaces | Viewer: read; Member: CRUD; Owner: delete | CASCADE on workspace delete |
| `modules` | project_id → projects, parent_id → self | Same as project | RESTRICT if children exist |
| `user_stories` | module_id → modules | Same as project | CASCADE on module delete |
| `acceptance_criteria` | user_story_id → user_stories | Same as project | CASCADE on US delete |
| `atcs` | project_id → projects | Same as project | RESTRICT if linked to tests |
| `atc_acceptance_criteria` | atc_id → atcs, acceptance_criteria_id → acs | Same as project | CASCADE on either deletion |
| `atc_steps` | atc_id → atcs | Same as project | CASCADE on ATC delete |
| `atc_assertions` | atc_id → atcs | Same as project | CASCADE on ATC delete |
| `tests` (chains) | project_id → projects | Same as project | — |
| `test_steps` | test_id → tests, atc_id → atcs | Same as project | CASCADE on test delete |
| `runs` | test_id → tests, executor_id → users | Same as project | — |
| `run_atcs` | run_id → runs, atc_id → atcs | Same as project | CASCADE on run delete |
| `run_steps` | run_atc_id → run_atcs | Same as project | CASCADE on run_atc delete |
| `bugs` | run_id → runs (nullable), atc_id → atcs (nullable), project_id → projects | Member: CRUD own; Admin: CRUD all | SET NULL on run delete |
| `access_tokens` | workspace_id → workspaces, user_id → auth.users | Admin/Owner: read/revoke own workspace | CASCADE on workspace delete |
| `environments` | project_id → projects | Same as project | CASCADE on project delete |
| `activity_log` | workspace_id → workspaces (denormalized) | Viewer: read own workspace | — |
| `idempotency_keys` | — (key → hash) | Service role operations | TTL expiry (24h) |

## Data Flow: ATC Creation (Testable Paths)

1. User fills form → 2. Zod validation (client) → 3. POST `/api/v1/atcs` → 4. Route handler validates (Zod server) → 5. RLS check → 6. Transaction (insert atc + steps + assertions + junction) → 7. Realtime broadcast → 8. 201 response

**What to assert at each step:**
- Step 2: Invalid data → client-side error shown immediately
- Step 3: Request without auth → 401
- Step 4: Missing required fields → 422 with `details[]`
- Step 5: User without write permission → 403
- Step 6: FK violation (invalid AC id) → 409
- Step 7: Other workspace members receive Realtime event
- Step 8: Response contains full ATC with steps + assertions + linked ACs

## Data Flow: Manual Run Step Result (Testable Paths)

1. Click pass/fail → 2. POST `/api/v1/runs/{id}/steps/{step_id}/result` → 3. Route handler validates → 4. RLS check → 5. Update `run_steps.status` → 6. Recompute `run_atcs.status` (CASE WHEN) → 7. Recompute `runs.status` → 8. Success response

**What to assert at each step:**
- Step 1: Optimistic UI update immediately
- Step 5: Status transition valid (pending → pass/fail/block; no pass → fail reversal)
- Step 6: All child steps pass → run_atc = passed; any fail → run_atc = failed; any block → run_atc = blocked
- Step 7: All run_atcs complete → run = passed/failed/blocked
- Step 8: Response includes computed parent statuses

## Auth Matrix (What to Test per Role)

| Action | Viewer | Member | Admin | Owner |
|--------|--------|--------|-------|-------|
| Read workspace/project/module | ✓ | ✓ | ✓ | ✓ |
| Create/update entity | ✗ | ✓ | ✓ | ✓ |
| Delete entity | ✗ | ✗ | ✓ | ✓ |
| Manage members | ✗ | ✗ | ✓ | ✓ |
| Manage PATs | ✗ | ✗ | ✓ | ✓ |
| Delete workspace | ✗ | ✗ | ✗ | ✓ |
| Manage billing | ✗ | ✗ | ✗ | ✓ |

## Cross-References

- `functional-specs.md` — FR details for each data flow
- `non-functional-specs.md` — performance/security verification
- `.context/business/domain-glossary.md` — entity definitions + ERD
- Target `architecture-specs.md` — full C4, data flows, ADRs
