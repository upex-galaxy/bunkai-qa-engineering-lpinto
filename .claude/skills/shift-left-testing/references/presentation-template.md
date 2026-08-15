# HTML Presentation (Phase 5 — final step, MANDATORY)

> AFTER all phases complete (Phase 3 handoff + Phase 4 market comparison if opted in), generate a **dark-mode HTML presentation** containing EVERY piece of content added to the User Story. Runs once per refined Story, per Story. NEVER skip it — it is the visible deliverable of the shift-left pass.

## 1. Output contract

| Attribute | Value |
|---|---|
| File | `{STORY_KEY}-shift-left-presentation.html` (e.g. `BK-215-shift-left-presentation.html`) |
| Location | The Story's PBI folder: `.context/PBI/epics/EPIC-<EPIC_KEY>-<slug>/stories/STORY-<STORY_KEY>-<slug>/` (same folder as `shift-left-refinement.md`) |
| Language | English (artifact rule — CLAUDE.md §1 Rule #14) |
| Style | Dark mode ONLY — Tokyo Night palette (see §2) |
| Status | NON-Jira working artifact — NOT synced, NOT pushed to Jira, lives in `.context/PBI/**` (gitignored). Author it locally. |
| Scope | ALL content added to the Story: full `shift-left-refinement.md` body + the Jira-mirrored fields (Description + ATP DRAFT) + Phase 4 market comparison output if it ran |

## 2. Dark-mode design (Tokyo Night)

Reuse the proven Tokyo Night palette (same as `BK-215-shift-left-presentation.html`):

```
--bg-primary: #1a1b26;    --bg-secondary: #24283b;   --bg-tertiary: #2f3349;
--text-primary: #c0caf5;  --text-secondary: #a9b1d6; --text-muted: #565f89;
--accent-blue: #7aa2f7;   --accent-cyan: #7dcfff;    --accent-green: #9ece6a;
--accent-yellow: #e0af68; --accent-orange: #ff9e64;  --accent-red: #f7768e;
--accent-purple: #bb9af7; --border-color: #3b4261;
```

Structure rules:
- Single self-contained file (inline `<style>`, no external assets — works offline, survives Jira-less environments)
- `header` with `<h1>` = `{STORY_KEY} {story title}`, subtitle "Shift-Left Analysis", meta line (status, sprint, date, Epic)
- One `<section>` per top-level section, `<h2>` per section, `<h3>`/`<h4>` for sub-structure
- Tables for any tabular content (ambiguities, gaps, traceability, coverage, risks)
- `badge` pills for: scenario Type (Positive/Negative/Boundary/Edge/Integration/Security-RBAC/State-Transition/NFR), Priority (Critical/High/Medium/Low), and `NEEDS PO/DEV CONFIRMATION` markers
- `gherkin` code blocks for refined ACs and E-scenarios

## 3. Section checklist — NOTHING may be omitted

Every section below MUST be present. Check each against `shift-left-refinement.md` AND the synced Jira fields (description + ATP DRAFT) before declaring the file complete.

### 3.1 Story meta + analysis
- [ ] Header: `{STORY_KEY}` + story title + "Shift-Left Analysis" subtitle + meta (status, sprint, date, Epic)
- [ ] Story Quality Assessment (veredicto + justification)
- [ ] Critical Analysis: Business Context / Technical Context / Evidence-confirmed Facts / Proposals & Pending Decisions
- [ ] Story Complexity
- [ ] Epic-level Inheritance
- [ ] Critical Findings (numbered table: finding / impact / action)

### 3.2 Quality + gaps
- [ ] Ambiguities (table: location / question / testing impact / suggested clarification)
- [ ] Gaps — missing info (table: type / why critical / what to add / risk if omitted)
- [ ] Edge cases not in Story (E1..EN with Type + Priority)
- [ ] Clarified Business Rules (table: rule / clarification)
- [ ] Contradictions (if any)
- [ ] Testability validation

### 3.3 Refined Acceptance Criteria — EVERY scenario
- [ ] ALL original AC groups (AC1..ACN), each with EVERY refined scenario (1.1, 1.2, ...) — Gherkin block + Type badge + Priority badge
- [ ] ALL new scenarios surfaced (E1..EN) with the `NEEDS PO/DEV CONFIRMATION` badge
- [ ] NFR scenarios (E4-E7 / NFR outlines) exactly as proposed — markers preserved

### 3.4 Questions + improvements
- [ ] Critical Questions for PO (table with context / impact / suggestion)
- [ ] Technical Questions for Dev (blocking implementation)
- [ ] Design Questions
- [ ] Open Questions — Proposed Answers (table: # / question / proposed answer / source)
- [ ] Suggested Story Improvements (table: current state / suggested change / benefit)
- [ ] Data feasibility flags (if any)
- [ ] Recommended testing strategy (pre / during / post-implementation)
- [ ] Assumptions and Blockers
- [ ] Next Steps

### 3.5 ATP DRAFT — complete
- [ ] Coverage Estimate table — ALL rows (Positive / Negative / Boundary / Integration / Security-RBAC / State-Transition / Non-Functional / Total) — numbers match `shift-left-refinement.md`
- [ ] Test Outlines — ALL groups (Positive / Negative / Boundary / Integration / Security-RBAC / State-Transition / Non-Functional) with EVERY outline name + 1-line precondition + 1-line expected
- [ ] Traceability Map — AC ↔ refined scenarios ↔ outlines (all rows)
- [ ] Test Data Requirements
- [ ] Test Environment Requirements
- [ ] Entry Criteria
- [ ] Exit Criteria — "All N outlines executed" MUST equal Coverage Total (NFR numerical consistency)
- [ ] Risk-Based Prioritization (P1 / P2 / P3 + NFRs)
- [ ] Open Items for Sprint
- [ ] Risks & mitigation (numbered, includes NFR risk row if proposed)

### 3.6 Phase 4 output (ONLY if market comparison ran)
- [ ] Gap table (market dimension / in Story? / where / proposal / source) with ✅/⚠️/❌ verdicts
- [ ] Decisions taken per gap (option chosen + rationale)
- [ ] Any approved Jira changes reflected in the corresponding sections above

### 3.7 Handoff status
- [ ] Handoff summary: labels added (`shift-left-reviewed`, `shift-left-{YYYY-MM-DD}`), transition reached (`estimation`), trace verification status, ATP DRAFT container (field or Test Plan link)

## 4. Verification (mandatory before declaring done)

1. Walk the checklist §3 against `shift-left-refinement.md` + synced Jira fields — every item ticked, no section invented, no section dropped.
2. **Numerical cross-check**: Coverage Total == number of outlines listed == Exit Criteria count == Traceability rows count. NFR row present iff NFR outlines exist.
3. Open the file in a browser (or capture via `/playwright-cli`) to confirm dark-mode render + no broken markup.
4. Report the file path in the session footer (repo-relative), per session-footer-contract.

## 5. Bookkeeping

- Append `## Phase 5 — HTML Presentation — <ts>` to `.session/shift-left-testing/<batch-id>/progress.md` with `status: completed`, `artifacts_touched: [<STORY_KEY>-shift-left-presentation.html]`.
- The file lives in the Story's PBI folder — it moves with the Story, NOT with the session archive.
- NO git commit, NO Jira mutation: Jira is canonical and the presentation is a derived local artifact (same rule as `shift-left-refinement.md`).