# Business Model — Bunkai (QA Perspective)

> Product: **Bunkai** (分解) — open-core Test Management System
> Source: Discovered from target repo `../upex-bunkai-tms/.context/business/business-model.md` (verified 2026-08-09 against staging state) + source code analysis
> Confidence: **High** — target has extensive documented business model
> Status note (2026-08-09): target file states "vision locked. MVP scope cut." — post-MVP epics (BK-201/208/210/221/224: Test Plans, Milestones, Notifications, Chat, Billing) tracked in `.context/PBI/`, unreleased.

## Problem Statement

Bunkai addresses the structural failure of existing TMS tools (Xray, Zephyr, TestRail, qTest) which are "document vaults with execution glued on top." Key pain points: unstructured test cases, impossible maintenance, broken traceability, misleading reports, and delegated bug management. The core insight: **structural traceability should be enforced by the data model, not by convention**.

Source: `business-model.md` lines 9-21

## Business Model Canvas

### 1. Customer Segments

| Segment | Description | QA Relevance |
|---------|-------------|--------------|
| Indie QA engineers + small QA-led teams (2-10 QAs) | Power users feeling Xray/Zephyr friction daily | Test self-service flows, onboarding, ATC creation UX |
| Mid-market engineering orgs (50-500 devs) | Teams on Jira + Xray/Zephyr frustrated by maintenance | Test multi-user, RBAC, scale, Jira import |
| Regulated-industry enterprises | Fintech/healthtech/legaltech needing data sovereignty | Test self-hosted deployment, SSO, audit log, RLS |
| QA training audience | Bootcamps, certification programs | Test educational flows, demo data, import/export |

Found in: `business-model.md` §1

### 2. Value Propositions

- One-edit-many-tests (ATC reuse)
- Structural traceability enforced by data model
- Three execution modes (Manual, Agentic, Automated) sharing one data model
- Native defect management with module heatmaps
- API-first for AI operators (REST + OpenAPI + CLI)
- Open-source + self-hostable
- VS Code-feel UI (tree + table + mind-map)

Found in: `business-model.md` §2

### 3. Channels

GitHub-led distribution, content-led inbound, conference talks/podcasts, UPEX Galaxy integration, Bunkai Cloud landing page.

Found in: `business-model.md` §3

### 4. Customer Relationships

Self-serve (Community), community-driven support, SLA-backed support (Cloud/Enterprise), co-creation with design partners.

Found in: `business-model.md` §4

### 5. Revenue Streams

Open Core (locked decision per founder conversation): Community (free, self-hosted — Apache 2.0 vs MIT pending), Cloud (per-seat ~$20-30/mo), Enterprise (annual license, SSO/SAML, audit). Secondary marketplace for integrations/ATC packs.

Found in: `business-model.md` §5

### 6. Key Resources

Open-source codebase, founder's QA reputation (UPEX Galaxy), KATA/IQL methodology, Bunkai brand.

Found in: `business-model.md` §6

### 7. Key Activities

Building/maintaining open-source core, operating Cloud infra, documentation, community management, content production.

Found in: `business-model.md` §7

### 8. Key Partners

Vercel, Supabase, browser automation ecosystem (Playwright/Cypress/Jest/JUnit), Jira (Atlassian), UPEX Quality LLC.

Found in: `business-model.md` §8

### 9. Cost Structure

Engineering time, cloud infra (Vercel, Supabase, Upstash, R2), domains, ops services (Sentry, PostHog), marketing, legal.

Found in: `business-model.md` §9

## QA Relevance

| Business Aspect | Testing Implication |
|-----------------|---------------------|
| Structural traceability enforced by data model | Must verify RLS + FK constraints prevent orphan data; test cascade deletes |
| Three execution modes sharing one data model | Run results from manual/agentic/automated modes must produce comparable output schemas |
| API-first for AI operators | All features must be testable via API before UI — critical for `test-automation` skill |
| ATC reuse (one-edit-many-tests) | Verify edit propagation across all chaining tests; test versioning edge cases |
| Native defect management | Test bug lifecycle (open → triage → fix → verify) within Bunkai; verify module heatmap accuracy |
| Open-source + self-hostable | Test Docker Compose install, migration path, env var validation, upgrade path |
| Jira integration | One-way import is LIVE on staging (async `import_jobs` + worker); Jira write-back still vision-only |
| Per-seat subscription (Cloud) | Test billing integration, seat limits, overage handling |
| Self-hosted for regulated industries | Test air-gapped install, offline operation, backup/restore |

## Staging verification status (2026-08-09)

- ✅ Shipped on staging and exercised in the business maps: verification-first signup (BK-166), unified Principal auth + enforced scopes (ADR-0001), run/steps environment engine (BK-287), bug triage state machine, coverage roll-ups, activity + notifications, async Jira import, milestones, project environments.
- 🔲 Not yet verifiable: billing (no code), chat channels/messages (post-MVP), email digests (Resend configured, wiring unverified), license decision (Apache 2.0 vs MIT), self-hosted distribution.

## Discovery Gaps

- [ ] Direct DB access via DBHub not yet configured — cannot verify RLS policies or FK constraints directly
- [ ] Target repo has no CI workflows on staging — cannot observe deployment pipeline behavior
- [ ] License decision (Apache 2.0 vs MIT) pending — affects how test framework references Bunkai licensing
- [ ] Detailed pricing not finalized — cannot test billing flows yet