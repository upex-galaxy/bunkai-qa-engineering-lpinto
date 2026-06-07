# Project Configuration

> Project: Bunkai (BK)
> Generated: 2026-06-06
> Target: ../upex-bunkai-tms

## Repositories

| Repository | URL | Branch | Purpose |
|------------|-----|--------|---------|
| bunkai-qa-engineering-lpinto | (this repo) | main | QA automation + test framework |
| upex-bunkai-tms | `../upex-bunkai-tms` | main | Target app — Next.js + Supabase monorepo |

## Tech Stack

### Frontend
- Framework: Next.js 15 (App Router, RSC, `reactStrictMode: true`, `typedRoutes: true`)
- Language: TypeScript 5.9 (strict mode)
- Styling: Tailwind CSS (dark mode only; custom design tokens for surface/fg/stroke/accent/signal)
- UI Library: shadcn/ui (New York style) + lucide-react icons
- Fonts: Inter (sans), JetBrains Mono (mono), Noto Serif JP (kanji)
- Key libraries: Monaco Editor (ATC editor), TanStack Table (ATC listing), React Flow (mind-map, Phase 3), sonner (toasts), Scalar (API docs)

### Backend
- Framework: Next.js 15 API routes (`app/api/v1/`)
- Language: TypeScript 5.9
- ORM: None — direct Supabase client (`@supabase/supabase-js`, `@supabase/ssr`)
- API Layer: Custom handler wrapper (`withApiHandler` — structured logging, Zod validation, error envelope)
- Auth: Supabase Auth (magic-link + OAuth), PAT-based bearer tokens for AI/CI

### Database
- Type: PostgreSQL 16
- Provider: Supabase (project ref: `fmbpikzpkafptqximhxn`)
- Access: Supabase MCP / DBHub MCP
- Migrations: 8 SQL migrations in `supabase/migrations/`

### Infrastructure
- Cloud: Vercel (production + preview deployments)
- CI/CD: None yet (no `.github/workflows/`)
- Monitoring: Sentry (planned), PostHog (product analytics)
- Asset storage: Cloudflare R2 (run evidence, planned)
- Email: Resend (magic-link OTP emails)

## Environments

| Environment | URL | Purpose | Access |
|-------------|-----|---------|--------|
| Local | `http://localhost:3000` | Dev | Direct |
| Staging | `https://staging-upexbunkai.vercel.app` | Pre-prod testing | Vercel preview |
| Production | `https://upexbunkai.vercel.app` | Live | Read-only |

## Tools and Access

- Issue tracker: Jira — resolved via `[ISSUE_TRACKER_TOOL]`
- Project key: BK
- Database: Supabase MCP / DBHub MCP
- Docs: In-repo `.context/` (PRD, SRS, business maps)
- Email testing: Resend (magic-link flows)

## Access Checklist

- [x] Repository read access
- [ ] Database access (MCP or direct) — DBHUB_* vars in `.env` empty
- [x] Issue tracker access (ATLASSIAN vars populated in `.env`)
- [x] Staging environment reachable
- [ ] CI/CD visibility — no CI workflows configured yet

## Discovery Gaps

- [ ] DBHub MCP credentials: `.env` has `DBHUB_*` vars empty — cannot query Supabase schema directly without config
- [ ] No CI/CD workflows in target repo — cannot verify test pipeline behavior
- [ ] Team contacts: not provided — LOW priority for current scope
