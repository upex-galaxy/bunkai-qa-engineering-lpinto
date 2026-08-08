# TMS-ATC Library | Browse, search, and filter ATCs across every project

**Jira Key:** [BK-267](https://jira.upexgalaxy.com/browse/BK-267)
**Epic:** [BK-13](https://jira.upexgalaxy.com/browse/BK-13) (ATC Library (Acceptance Test Cases))
**Type:** Story
**Status:** Estimation
**Priority:** Medium
**Story Points:** -

---

## Overview

## User story

***As a*** Senior QA Engineer
***I want to*** browse, search, and filter every ATC in the workspace from a single cross-project index
***So that*** I can confirm whether a reusable ATC already exists before writing a duplicate, and jump straight into its owning Project to open it

## Definition of done

- [ ] Feature works end-to-end against staging
- [ ] Covered by an ATC chain anchored to a User Story + Acceptance Criterion
- [ ] Acceptance Criteria verified by QA
- [ ] Demoed to the team

---

## QA Refinements (Shift-Left Analysis)

> Added by QA — Shift-Left pre-sprint batch session | 2026-08-07

***Story quality verdict***: Significant Issues — ACs confirmed from PO source of truth. API contract for cross-project scope and design file remain as pre-sprint blockers.

***22 test outlines drafted*** across: Positive (9) · Negative (5) · Boundary (4) · Security/Integration (4). Full ATP DRAFT in the `🧪 Acceptance Test Plan (ATP)` field.

### Critical gaps before sprint

- API contract: `GET /api/v1/atcs/search` requires `project_id` (BK-20) — a new cross-project endpoint or optional parameter is needed before implementation.
- Design file: `.context/designs/bunkai-test-management-tool/bk-13-atc-library-global/atc-library-global.html` does not exist locally. UI assertions are ungrounded without it.
- Route: No `/atc-library` page exists yet in `app/(app)/`.

### PO sign-off needed

1. Badge count semantics (total workspace ATCs vs. user-accessible ATCs vs. filtered count)
2. Filter state persistence on browser Back
3. Exact route URL for the ATC Library

---

## Metadata

- **Created:** 4/8/2026
- **Updated:** 7/8/2026
- **Reporter:** Ely
- **Assignee:** Facu Barea
- **Labels:** shift-left-2026-08-07, shift-left-reviewed

---

_Synced from Jira by sync-jira-issues_
