# Business Model — Bunkai (QA Perspective)

> Product: **Bunkai** (分解) — open-core Test Management System
> Source: Discovered from target repo `../upex-bunkai-tms/.context/business/business-model.md` + source code analysis
> Confidence: **High** — target has extensive documented business model

## Problem Statement

Bunkai addresses the structural failure of existing TMS tools (Xray, Zephyr, TestRail, qTest) which are "document vaults with execution glued on top." Key pain points: unstructured test cases, impossible maintenance, broken traceability, misleading reports, and delegated bug management. The core insight: **structural traceability should be enforced by the data model, not by convention**.

Source: `business-model.md` lines 11-21

## Business Model Canvas

### 1. Customer Segments

| Segment | Description | QA Relevance |
|---------|-------------|--------------|
| Indie QA engineers + small QA-led teams (2-10 QAs) | Power users feeling Xray/Zephyr friction daily | Test self-service flows, onboarding, ATC creation UX |
| Mid-market engineering orgs (50-500 devs) | Teams on Jira + Xray/Zephyr frustrated by maintenance | Test multi-user, RBAC, scale, Jira sync |
| Regulated-industry enterprises | Fintech/healthtech/legaltech needing data sovereignty | Test self-hosted deployment, SSO, audit log, RLS |
| QA training audience | Bootcamps, certification programs | Test educational flows, demo data, import/export |

Found in: `business-model.md` §1 lines 35-43

### 2. Value Propositions

- One-edit-many-tests (ATC reuse)
- Structural traceability enforced by data model
- Three execution modes (Manual, Agentic, Automated) sharing one data model
- Native defect management with module heatmaps
- API-first for AI operators (REST + OpenAPI + CLI)
- Open-source + self-hostable
- VS Code-feel UI (tree + table + mind-map)

Found in: `business-model.md` §2 lines 46-53

### 3. Channels

GitHub-led distribution, content-led inbound, conference talks/podcasts, UPEX Galaxy integration, Bunkai Cloud landing page.

Found in: `business-model.md` §3 lines 55-61

### 4. Customer Relationships

Self-serve (Community), community-driven support, SLA-backed support (Cloud/Enterprise), co-creation with design partners.

Found in: `business-model.md` §4 lines 63-67

### 5. Revenue Streams

Open Core: Community (free, self-hosted), Cloud (per-seat ~$20-30/mo), Enterprise (annual license, SSO/SAML, audit). Secondary marketplace for integrations/ATC packs.

Found in: `business-model.md` §5 lines 69-80

### 6. Key Resources

Open-source codebase, founder's QA reputation (UPEX Galaxy), KATA/IQL methodology, Bunkai brand.

Found in: `business-model.md` §6 lines 81-87

### 7. Key Activities

Building/maintaining open-source core, operating Cloud infra, documentation, community management, content production.

Found in: `business-model.md` §7 lines 89-94

### 8. Key Partners

Vercel, Supabase, browser automation ecosystem (Playwright/Cypress/Jest/JUnit), Jira (Atlassian), UPEX Quality LLC.

Found in: `business-model.md` §8 lines 96-103

### 9. Cost Structure

Engineering time, cloud infra (Vercel, Supabase, Upstash, R2), domains, ops services (Sentry, PostHog), marketing, legal.

Found in: `business-model.md` §9 lines 105-110

## QA Relevance

| Business Aspect | Testing Implication |
|-----------------|---------------------|
| Structural traceability enforced by data model | Must verify RLS + FK constraints prevent orphan data; test cascade deletes |
| Three execution modes sharing one data model | Run results from manual/agentic/automated modes must produce comparable output schemas |
| API-first for AI operators | All features must be testable via API before UI — critical for `test-automation` skill |
| ATC reuse (one-edit-many-tests) | Verify edit propagation across all chaining tests; test versioning edge cases |
| Native defect management | Test bug lifecycle (open → triage → fix → verify) within Bunkai; verify module heatmap accuracy |
| Open-source + self-hostable | Test Docker Compose install, migration path, env var validation, upgrade path |
| Jira bidirectional sync | Test async webhook reliability, conflict resolution, field mapping |
| Per-seat subscription (Cloud) | Test billing integration, seat limits, overage handling |
| Self-hosted for regulated industries | Test air-gapped install, offline operation, backup/restore |

## Discovery Gaps

- [ ] Direct DB access via DBHub not yet configured — cannot verify RLS policies or FK constraints directly
- [ ] Target repo has no CI workflows — cannot observe deployment pipeline behavior
- [ ] License decision (Apache 2.0 vs MIT) pending — affects how test framework references Bunkai licensing
- [ ] Detailed pricing not finalized — cannot test billing flows yet
