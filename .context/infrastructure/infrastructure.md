# Infrastructure — Bunkai (QA Lens)

> Source: Target repo source code analysis (config files, .env.example, deployment patterns)
> Purpose: Deployment, CI/CD, environment, and tooling context for test planning

---

## Environment Landscape

| Environment | URL | Database | Auth | Test Against? |
|-------------|-----|----------|------|---------------|
| **Local** | `http://localhost:3000` | Local Supabase (CLI) | Local Supabase Auth | Yes — primary for dev |
| **Staging** | `https://staging-upexbunkai.vercel.app` | Supabase project (staging) | Supabase Auth (staging) | Yes — primary for CI |
| **Production** | `https://upexbunkai.vercel.app` | Supabase project (prod) | Supabase Auth (prod) | Smoke only |

**Detection** (from `lib/urls.ts`):
- `production` = `VERCEL_ENV === 'production'`
- `staging` = `VERCEL_ENV === 'preview'`
- `local` = fallback (no VERCEL_ENV)

## Deployment

### Current State: Vercel (implicit config)

| Aspect | Detail |
|--------|--------|
| Platform | Vercel (Next.js native) |
| Config | None (`vercel.json` absent — all defaults) |
| Preview | Auto-deploys on push to any branch |
| Production | Deploys from `main` |
| Git | GitHub (repo not found in subagent scan) |

### CI/CD: None

**Target repo has zero CI workflows** — no `.github/` directory. QA testing must be triggered from our QA boilerplate repo's workflows:
- `.github/workflows/build.yml`
- `.github/workflows/smoke.yml`
- `.github/workflows/sanity.yml`
- `.github/workflows/regression.yml`

These run independently of the target repo's deployment pipeline.

### Self-Hosted: Phase 2

| Component | Cloud (MVP) | Self-hosted (Phase 2) |
|-----------|-------------|----------------------|
| Web server | Vercel Edge | Docker container (Next.js standalone) |
| Database | Supabase PostgreSQL | Direct PostgreSQL |
| Auth | Supabase Auth | Better Auth |
| Storage | Cloudflare R2 | MinIO |
| Realtime | Supabase Realtime | Redis + BullMQ |
| Background jobs | Supabase pg_graphql | Redis + BullMQ |

## Environment Variables

### Required (from `.env.example`)

| Variable | Used By | Test Impact |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | Must match target env |
| `SUPABASE_PUBLISHABLE_KEY` | Browser (anon key) | Safe for CI |
| `SUPABASE_SECRET_KEY` | Server only | Keep secret, use service role for admin ops |
| `SUPABASE_JWT_SECRET` | Auth verification | For custom token testing |
| `NEXT_PUBLIC_APP_URL` | Auth redirects | Must match test origin |
| `POSTGRES_*` (7 vars) | Direct DB access | DBHub MCP needs these |
| `SUPABASE_ACCESS_TOKEN` | Supabase MCP | Control plane ops |
| `RESEND_API_KEY` | Transactional email | Magic link email verification |

### QA Boilerplate Env Vars (from `.env`)

| Variable | Status | Notes |
|----------|--------|-------|
| `LOCAL_USER_EMAIL` | ✅ Set | Test user for local |
| `STAGING_USER_PASSWORD` | ✅ Set | Test user for staging |
| `PRODUCTION_USER_PASSWORD` | ✅ Set | Test user for prod |
| `ATLASSIAN_*` | ✅ Set | Jira/Xray integration |
| `TAVILY_API_KEY` | ✅ Set | Web search MCP |
| `RESEND_API_KEY` | ✅ Set | Email testing |
| `DBHUB_*` | ❌ Empty | DB access not configured |
| `N8N_*` | ❌ Empty | n8n MCP not configured |

## MCPs Available

| MCP | Config Source | Needed For |
|-----|--------------|------------|
| Context7 | `.mcp.json` / `opencode.jsonc` | Library docs |
| Tavily | `.mcp.json` / `opencode.jsonc` | Web search |
| Supabase | `.mcp.json` / `opencode.jsonc` | DB management, migration ops |
| n8n | `.mcp.json` / `opencode.jsonc` | Workflow automation |
| Atlassian | `.mcp.json` (opt-in) | Jira/Xray integration |
| OpenAPI | `.mcp.json` | API contract exploration |
| Playwright | `.mcp.json` | Browser automation |
| DBHub | `.mcp.json` | Direct DB querying |
| Postman | `.mcp.json` | API collection execution |

## Code Quality Infrastructure

| Tool | Config | CI Gate? |
|------|--------|----------|
| ESLint | `eslint.config.js` (`@antfu/eslint-config` + `@next/eslint-plugin-next`) | Pre-commit + pre-push |
| Prettier | `.prettierrc` (semi, single, tabWidth 2, trailingComma es5, printWidth 100) | Pre-commit + pre-push |
| TypeScript | `tsconfig.json` (strict) | Pre-commit + pre-push |
| Husky | `pre-commit` + `pre-push` | Client-side only |
| lint-staged | ESLint fix on TS/TSX/JS/JSX | Pre-commit |
| EditorConfig | `.editorconfig` (UTF-8, LF, 2-space) | Editor-level |

### Pre-Commit Gate

```
bunx lint-staged     # ESLint --fix on staged *.ts/*.tsx/*.js/*.jsx
types:check          # tsc --noEmit
vars:check           # Env var validation
skills:check         # Skill registry validation
skills:registry:check # Conditional (only if manifest exists)
```

### Pre-Push Gate

```
bun run repo:check   # format:check + lint:check + types:check + vars:check + skills:check + skills:registry:check
```

## Security Infrastructure

| Layer | Detail | Test |
|-------|--------|------|
| TLS | Vercel-managed (TLS 1.3, auto) | Verify HTTPS redirect |
| Auth | Supabase Auth (JWT) + Bearer PATs | See `backend.md` |
| RLS | Every table has `workspace_id`-based RLS | Cross-workspace isolation |
| CSP | Configured via metadata (Vercel) | Verify response headers |
| Rate limiting | 100 req/min writes, 600 req/min reads | See `non-functional-specs.md` |
| Input validation | Zod (client + server) | Fuzz test every endpoint |
| Secrets | `.env` only, not committed | Verify .gitignore coverage |

## Monitoring

| Tool | What It Monitors | Test Integration |
|------|-----------------|-----------------|
| Sentry | Error tracking | Verify error events sent |
| PostHog | Product analytics | Verify events fired on key actions |
| Supabase Logs | DB/API queries | Manual investigation |
| Vercel Analytics | Page views, Web Vitals | Verify RUM data collected |

## Infrastructure Test Matrix

| Test Scope | Prerequisites | Environment |
|------------|--------------|-------------|
| Migration apply | Clean Supabase project | Local |
| Env var validation | Required vars populated | All |
| HTTPS redirect | Deployed URL | Staging |
| CORS headers | Deployed URL | Staging |
| Rate limiting | Realistic load generation | Staging |
| Webhook delivery | External endpoint | Staging |
| Magic link email | RESEND_API_KEY configured | Staging |
| S3/R2 blob upload | R2 bucket configured | Staging |

## Cross-References

- `backend.md` — server-side architecture
- `frontend.md` — client-side architecture
- `non-functional-specs.md` — performance, security, reliability NFRs
- `architecture-specs.md` — C4 system context
- `project-config.md` — environment URLs, current configuration state
