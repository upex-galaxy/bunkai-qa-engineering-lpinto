# Backend Infrastructure — Bunkai (QA Lens)

> Source: Target repo source code analysis (supabase/, app/api/, lib/api/)
> Purpose: Backend architecture for test context — route handlers, auth, middleware, DB layer

---

## Stack Overview

| Layer | Technology | Test Approach |
|-------|-----------|---------------|
| Framework | Next.js 15 App Router | Route Handler smoke tests |
| API runtime | Route Handlers (Edge-compatible) | KATA Api components |
| Auth (browser) | Supabase SSR (cookie session) | Playwright auth fixture |
| Auth (API) | Bearer PAT (`bk_pat_` prefix, SHA-256 hash) | KATA Api auth fixture |
| Validation | Zod (client + server) | Invalid payload fuzzing |
| Database | Supabase PostgreSQL 16 | KATA Api + DBHub MCP |
| ORM/Query | Raw SQL via supabase-js | Direct via RPC wrappers |
| Realtime | Supabase Realtime (WebSockets) | Multi-tab Playwright |

## Auth Architecture

```
 Browser                          CLI / AI Agent
    |                                  |
    v                                  v
 Supabase Auth JWT (HttpOnly cookie)   Bearer bk_pat_<prefix>.<secret>
    |                                  |
    v                                  v
 middleware.ts (refresh session)    lib/api/middleware/bearer.ts (hash lookup)
    |                                  |
    v                                  v
 Server Component (RLS)            Route Handler (RLS)
```

### Test Coverage Required

| Auth Mechanism | What to Test |
|---------------|--------------|
| Session cookie | Login, auto-refresh, expiry, redirect to `/login` when expired |
| PAT creation | `POST /api/v1/tokens` → verify prefix + hash, cannot retrieve secret |
| PAT validation | Valid token → 200; expired token → 401; wrong prefix → 401 |
| PAT scope enforcement | Token without `run:execute` → 403 on `POST /runs` |
| Cross-workspace isolation | Workspace A PAT → Workspace B endpoint → 403 |

## Route Handler Architecture

```
lib/api/
  handler.ts        # withApiHandler() — wraps handlers with request-id, logging, error mapping
  error-envelope.ts # ApiError class, standard codes, errorResponse()
  idempotency.ts    # requireIdempotencyKey() — header validation
  request-id.ts     # x-request-id propagation
  logging.ts        # JSON structured logging
  middleware/
    bearer.ts       # requireBearerToken() — PAT validation + scope check

app/api/v1/
  health/route.ts
  auth/magic-link/route.ts
  tokens/route.ts       # GET (list), POST (create)
  tokens/[id]/route.ts  # DELETE (revoke)
```

### Testable Characteristics

| Characteristic | Verification |
|---------------|-------------|
| Every handler wrapped in `withApiHandler()` | Uniform error envelope on all errors |
| `x-request-id` on every response | Header present, matches request header or UUID format |
| Request logging to stdout | JSON log output (verify via log capture) |
| Zod validation before DB access | 422 on invalid input, 5xx never on user error |
| Idempotency key required on POST runs + bugs | 400 if missing, 200 on replay (NOT 409) |

## Database Layer

### Supabase Client Modules

| Module | Use | RLS? | Test Note |
|--------|-----|------|-----------|
| `lib/supabase/client.ts` | Browser (anon key) | Yes | Used in UI tests |
| `lib/supabase/server.ts` | Server Component (cookie auth) | Yes | Used in RSC reads |
| `lib/supabase/admin.ts` | Server-only (service role) | No | Used in async jobs only |
| `lib/supabase/rpc.ts` | Typed RPC wrappers | Depends | `bunkai_save_atc` = INVOKER, `bunkai_bootstrap_workspace` = DEFINER |
| `lib/supabase/with-workspace.ts` | Workspace-scoped query builder | Yes | Defence-in-depth helper |

### Database Functions (RPCs)

| Function | SECURITY | What to Test |
|----------|----------|-------------|
| `bunkai_bootstrap_workspace` | DEFINER | Creates workspace + membership atomically |
| `bunkai_save_atc` | INVOKER | Full ATC save (header + full child replace), rolls back on error |
| Helper functions (4) | DEFINER | Used by RLS policies, test via permission boundary violations |

### Migration Strategy

Forward-only migrations under `supabase/migrations/`. Each migration is additive:
- `0001_tenancy.sql` — workspaces, members, roles
- `0002_projects_modules.sql` — projects, modules (self-ref tree)
- `0003_authoring.sql` — user stories, acceptance criteria
- `0004_atcs.sql` — ATCs, steps, assertions, anchoring, tsvector search
- `0005_rls_helpers.sql` — SECURITY DEFINER helpers, RLS refactor (fixes 42P17 recursion)
- `0006_bootstrap_workspace.sql` — workspace bootstrap RPC
- `0007_save_atc.sql` — ATC save RPC
- `0008_access_tokens.sql` — PAT tokens

**Test**: Apply all migrations to clean DB → verify schema, RLS, RPCs, functions all present. Verify rollback unsupported.

## Backend Test Patterns

### API Test Fixture Pattern

```typescript
// Example: KATA Api component for auth/tokens
@atc('BK-AUTH-TOKEN-01', 'Create PAT with valid scopes')
async createPat(workspaceId: string, scopes: string[]) {
  // POST /api/v1/tokens → verify bk_pat_ prefix
  // Verify hash stored, secret returned only at creation
}
```

### Auth Contexts for RBAC Tests

| Context | How to Get It |
|---------|---------------|
| Owner | Bootstrap workspace → owner membership |
| Admin | Owner promotes user → admin |
| Member | Owner invites user → member |
| Viewer | Owner invites user → viewer |
| PAT | `POST /api/v1/tokens` with desired scopes |

## Cross-References

- `frontend.md` — how API connects to UI
- `infrastructure.md` — deployment, CI/CD, env vars
- `architecture-specs.md` — C4 system context
- `functional-specs.md` — FR-to-test mapping
