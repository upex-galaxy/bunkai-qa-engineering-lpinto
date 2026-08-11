# Shift-Left Refinement: BK-48 — TMS-Traceability | Filter the chain by verdict, module, and date range

**Status**: Final — All open items resolved by PO
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refreshed on**: 2026-08-10
**PO Decisions Applied**: 2026-08-11
**Modality**: Jira-native
**Supersedes**: 2026-06-16 refinement

---

## Phase 1 — Critical Analysis

### Business context

- **Primary persona affected**: Senior QA Engineer — needs to narrow the evidence chain (US → AC → ATC → Test → Run → Defect) to "what failed, where, and when" without scrolling full history.
- **Secondary personas (if any)**: QA Lead / Product Owner — consumes the filtered view during audit or release-readiness review.
- **Business value proposition**: Removes manual spreadsheet assembly / manual scrolling when answering "what's broken in module X this sprint" — directly supports the Epic's stated value of a "one-minute, data-backed answer to coverage and audit questions."
- **KPI(s) influenced**: Time-to-triage for failing evidence; audit response time.
- **User journey position**: A refinement layer ON TOP OF the BK-45 evidence-chain view. The user must already be looking at an assembled chain before they can filter it — this Story has no value in isolation.

### Technical context

- **Frontend**: The traceability chain view now exists (BK-45 shipped `traceability-chain.html` with filter bar, result toggles, module select, date range inputs, active-filter chips, "Filters excluded everything" panel, and row-level filtering). The filter bar is at `filter-bar` (lines 553-596 of the HTML mockup), with `applyFilters()` JS at lines 914-974.
- **Backend**: `GET /api/v1/projects/{id}/traceability` endpoint is LIVE (BK-45 shipped 2026-08-08). The filter is currently CLIENT-SIDE only in the mockup — no server-side predicate push-down in the mockup JS. D26/D27 confirm the export (BK-50) is also shipped.
- **External services**: None identified for this Story specifically.
- **Integration points specific to this Story**: Direct dependency on BK-45 (chain assembly) as the data source being filtered. BK-45 is now SHIPPED. Transitively on BK-24 (Tests), BK-30 (Manual Execution & Runs), BK-31 (Bugs & Defect Heatmap) — all shipped.

### Dependency status (CHANGED since 2026-06-16)

| Dependency | Old Status (2026-06-16) | Current Status | Impact |
|---|---|---|---|
| BK-45 (chain endpoint) | Not built, no endpoint | **SHIPPED** — `GET /api/v1/projects/{id}/traceability` live | Data source now exists |
| BK-50 (export) | Not built | **SHIPPED** (2026-08-08, D26/D27) | Export action on traceability screen exists |
| BK-24 (Tests) | Planned | **SHIPPED** | Test entity data layer exists |
| BK-30 (Runs) | Planned | **SHIPPED** | Run entity data layer exists |
| BK-31 (Bugs/Defects) | Planned | **SHIPPED** | Defect data layer exists |
| Mockup gate | Locked (no design) | **LIFTED 2026-07-30** | Design contract ratified |

### Story complexity

| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Low-Medium | Filter predicate logic (verdict equality, module exact-match, date-range bounds, AND semantics) is straightforward per the ratified mockup contract |
| Integration | Low | Client-side filtering over an already-assembled chain — no server-side filter endpoint needed |
| Data validation | Medium | Date-range boundary handling (inclusive, inverted range rejection), verdict enum validation, module exact-match against chain data |
| UI | Medium | Filter bar component with result toggles, module select, date range picker, active-filter chips, "n of m shown" notes, "Filters excluded everything" panel, Clear-all button — all defined in the ratified mockup |

**Estimated test effort**: Medium (15-20 outlines). The mockup contract resolves most ambiguities from the 2026-06-16 analysis. The remaining open items (3) are edge cases, not core-path blockers.

---

## Phase 2 — Story Quality Analysis

### Ambiguities — RESOLVED by design contract

| # | Old Ambiguity (2026-06-16) | Resolution (mockup contract) | Contract citation |
|---|---|---|---|
| 1 | "Result" filter target — Run verdict vs ATC status? | **RESOLVED**: Result filter targets the chain row's `data-status` attribute (the latest-run outcome). Six-value set: `pass \| fail \| blocked \| skipped \| aborted \| running`. Mockup CSS defines 5 variants (omits `aborted`); D27 mandates six-wide. | HTML lines 559-563 (result toggles); master-design-plan §4.7 D27 |
| 2 | Tree-pruning vs row-level filtering? | **RESOLVED**: ROW-LEVEL. Filtering hides individual chain rows. AC card hidden ONLY when ALL its rows are filtered out. Per-AC note "n of m shown" appears when filtering. Partially-matching parents stay visible. | HTML lines 939-949 (applyFilters AC logic) |
| 3 | Module filter — tree-scoped vs exact-match? | **RESOLVED**: Exact-match on the row's `data-module` attribute. `row.dataset.module !== mod` → hide. NOT tree-scoped in mockup JS. | HTML line 926 (module filter) |
| 4 | Date range — which timestamp? Inclusive/exclusive? | **RESOLVED**: Filters row `data-date` (the LATEST RUN's date). INCLUSIVE bounds: `d < from` / `d > to` hide. Rows with no date are excluded when date filter is active. | HTML lines 928-933 (date filter) |
| 5 | AND vs OR filter combination? | **RESOLVED**: AND across result + module + date (sequential `if show` checks in mockup JS). | HTML lines 914-936 (applyFilters sequential checks) |
| 6 | Active filter display — exact copy? | **RESOLVED**: `Active filters:` + chips (Result: `<vals>`, Module: `<mod>`, From `<date>`, To `<date>`) + Clear all button (`#btn-clear`, `#btn-clear-2`). `aria-live` row count "n of m chain entries shown". | HTML lines 588-595 (active-summary); lines 960-973 (applyFilters chip generation) |
| 7 | Empty result vs zero-coverage — distinct? | **RESOLVED**: THREE distinct empty states: (a) "Filters excluded everything" panel — data exists but filter matched none (`#filtered-empty`); (b) "No coverage anywhere on this story" banner (`data-tone="gap"`) — ACs exist but no ATCs bound; (c) "No acceptance criteria yet" panel — zero ACs on the story. | HTML lines 805-812 (filtered-empty); lines 767-771 (zero-coverage); lines 797-802 (zero-AC) |

### Gaps — ALL RESOLVED

| # | Item | Resolution | Source |
|---|------|-----------|--------|
| 1 | **Filter-state persistence** | RESOLVED: URL query params. Shareability, back button, zero cost. | PO Decision 2026-08-11 |
| 2 | **Archived-module behavior** | RESOLVED: Excluded from dropdown. Archived = inactive = not shown. | PO Decision 2026-08-11 |
| 3 | **Shipped-chain alignment** | RESOLVED: Assume fields exist. Frontend defensive validation for missing attrs. | PO Decision 2026-08-11 |

### Edge cases not in Story — RESOLVED by contract

| # | Scenario | Resolution | Contract citation |
|---|---|---|---|
| E1 | Inverted date range (from after to) | **RESOLVED**: Rejected inline with `role="alert"` error: "From date is after to date. Date filter ignored until fixed." `aria-invalid` set on both inputs. Filter is IGNORED (not applied, not auto-swapped) while invalid; other filters unaffected. | HTML lines 581-583 (date-error); lines 906-911 (dateRange validation) |
| E2 | Archived-module behavior | **RESOLVED**: Excluded from dropdown. PO Decision 2026-08-11. | N/A | Covered in AC2 Scenario 2.2 |
| E3 | Verdict filter value with zero matching runs | **RESOLVED**: Resolves to the AC3 empty-result state ("Filters excluded everything"), not an error. | HTML lines 951-958 (zeroMatch logic) |
| E4 | Date-range boundary (exact match at from/to) | **RESOLVED**: Inclusive on both ends. `d < from` hides, `d > to` hides — so `d === from` and `d === to` are included. | HTML lines 931-932 (date boundary checks) |

### Contradictions

No contradictions between the Story description, the 3 ACs, and the design contract. The mockup contract resolves all ambiguities from the 2026-06-16 analysis.

### Testability validation

**Verdict**: Yes (refreshed)

The 2026-06-16 verdict was "No" due to non-existent dependencies (BK-45 chain, BK-24 Tests, BK-30 Runs, BK-31 Bugs). All dependencies are now SHIPPED. The mockup contract provides concrete UI selectors, filter behavior, empty-state copy, and validation messages. The Story is now testable against the shipped chain data.

---

## Phase 3 — Refined Acceptance Criteria

### AC1 — Result filter (multi-select toggle buttons, row-level, six-value verdict)

#### Scenario 1.1: Should filter chain rows by single verdict value when a result toggle is pressed (Type: Positive, Priority: High)

- Given a user story with chain rows having mixed outcomes (pass, fail, blocked, skipped, running)
- When the Senior QA Engineer presses the "Fail" result toggle (`data-result="fail"`, `aria-pressed="true"`)
- Then only chain rows with `data-status="fail"` are visible (`data-hidden="false"`); all other rows are hidden (`data-hidden="true"`)
- And the AC card remains visible if it has at least one visible row; hidden if zero visible rows
- And a per-AC note shows "n of m shown ·" in the AC header (`span.fnote`)
- And the active-filter summary shows `Active filters: Result: fail` chip

#### Scenario 1.2: Should filter chain rows by multiple verdict values when multiple toggles are pressed (Type: Positive, Priority: High)

- Given chain rows with outcomes pass, fail, blocked, skipped
- When the Senior QA Engineer presses "Fail" AND "Blocked" toggles (both `aria-pressed="true"`)
- Then only rows with `data-status="fail"` OR `data-status="blocked"` are visible
- And active-filter summary shows `Result: fail, blocked`

#### Scenario 1.3: Should support all six verdict values per D27 mandate (Type: Positive, Priority: High)

- Given the result filter bar
- When inspecting the available toggle buttons
- Then six toggles exist: Pass, Fail, Blocked, Skipped, Aborted, Running — per D27 the real filter must be six-wide even though the mockup CSS only defines five variants (omits `aborted`)

**NEEDS PO/DEV CONFIRMATION** — verify the real BK-45 chain endpoint exposes all six outcome values; the mockup demo data only shows five.

### AC2 — Module filter (exact-match select) + date range (inclusive, latest-run date)

#### Scenario 2.1: Should filter chain rows by exact module value when a module is selected (Type: Positive, Priority: High)

- Given chain rows with modules MOD-001, MOD-002, MOD-008
- When the Senior QA Engineer selects `MOD-001` from the module dropdown (`#f-module`)
- Then only rows with `data-module="MOD-001"` are visible
- And the active-filter summary shows `Module: MOD-001`

#### Scenario 2.2: Should filter chain rows by inclusive date range on latest-run date (Type: Positive, Priority: High)

- Given chain rows with `data-date` values spanning multiple dates (e.g. "2026-07-18", "2026-07-21", "2026-07-24", "2026-07-28")
- When the Senior QA Engineer enters From `2026-07-20` and To `2026-07-25`
- Then only rows with `data-date` between "2026-07-20" and "2026-07-25" inclusive are visible (rows with date "2026-07-21" and "2026-07-24" visible; "2026-07-18" and "2026-07-28" hidden)
- And rows with empty `data-date` are excluded when date filter is active

#### Scenario 2.3: Should apply AND logic across result + module + date filters (Type: Positive, Priority: High)

- Given chain rows with mixed modules, outcomes, and dates
- When the Senior QA Engineer selects module `MOD-001`, presses "Fail" toggle, and enters a date range
- Then only rows matching ALL THREE criteria are visible (AND, not OR)
- And the active-filter summary shows all three chips: `Result: fail`, `Module: MOD-001`, `From <date>`, `To <date>`

#### Scenario 2.4: Should reject inverted date range inline without breaking other filters (Type: Negative, Priority: High)

- Given the date filter inputs
- When the Senior QA Engineer enters From `2026-07-25` and To `2026-07-20` (inverted)
- Then the error message "From date is after to date. Date filter ignored until fixed." appears (`#date-error`, `role="alert"`)
- And both date inputs get `aria-invalid="true"`
- And the date filter is IGNORED (not applied, not auto-swapped) — rows are NOT filtered by date
- And other filters (result, module) continue to work unaffected

#### Scenario 2.5: Should hide AC card only when ALL its rows are filtered out (Type: Positive, Priority: Medium)

- Given AC with 2 rows (one pass, one fail)
- When the Senior QA Engineer filters by result "fail"
- Then AC card remains visible with 1 of 2 rows shown
- And the per-AC note shows "1 of 2 shown ·"

### AC3 — Zero-match state ("Filters excluded everything")

#### Scenario 3.1: Should show distinct "Filters excluded everything" panel when filters match no rows (Type: Negative, Priority: High)

- Given chain rows exist but a filter combination matches none of them
- When the Senior QA Engineer applies that filter combination
- Then the `#filtered-empty` panel appears with title "Filters excluded everything", body copy, and "Clear all filters" button (`#btn-clear-2`)
- And the chain column headers and story head are hidden
- And this panel is visually distinct from the zero-coverage banner (`data-tone="gap"`) and the zero-AC empty panel

### AC4 — Active-filter summary and Clear-all

#### Scenario 4.1: Should display active-filter chip summary when any filter is applied (Type: Positive, Priority: Medium)

- Given one or more filters active
- When the Senior QA Engineer looks at the filter bar
- Then the `#active-summary` bar appears with `Active filters:` text + filter chips
- And each active filter shows as a chip: `Result: <vals>`, `Module: <mod>`, `From <date>`, `To <date>`
- And the `#row-count` element shows "N of M chain entries shown" via `aria-live="polite"`

#### Scenario 4.2: Should clear all filters when Clear-all is pressed (Type: Positive, Priority: Medium)

- Given one or more filters active
- When the Senior QA Engineer presses "Clear all" (`#btn-clear` or `#btn-clear-2`)
- Then all result toggles reset to `aria-pressed="false"`
- And module select resets to "all"
- And date inputs clear to empty
- And the full unfiltered chain is restored
- And the active-filter summary hides

---

## Phase 4 — ATP DRAFT (outline names only)

### Coverage estimate

| Type | Count | Notes |
|------|-------|-------|
| Positive | 14 | Single/multi verdict, six values, module, archived exclusion, date, AND, URL persist, URL restore, partial URL, open-ended date, keyboard nav (result/module/date), focus mgmt, aria-live |
| Negative | 4 | Inverted date, zero-match, invalid URL params, browser native date validation |
| Boundary | 3 | Date inclusive edges, empty-date exclusion, AC card hide rule |
| Integration | 1 | Real BK-45 chain data alignment |
| Accessibility | 4 | Keyboard nav (result/module/date), focus mgmt, aria-live |
| **Total** | **26** | Drives PO estimation |

**Rationale**: PO decisions on 2026-08-11 resolved all 3 remaining open items. Added AC5 (URL persistence, 6 scenarios) and AC6 (defensive validation for data-date, 1 scenario). Scenario 6.1 removed — duplicate of 1.4 (missing data-status); "no console error" detail moved to 1.4. Added 10 a11y/PO scenarios (keyboard nav, focus mgmt, aria-live, partial URL, open-ended ranges).

### Outline list (NAMES ONLY)

#### Positive

- **Should filter chain to single verdict when one result toggle is pressed** — Pre: chain with mixed outcomes. Expected: only matching rows visible, AC card stays if has visible rows, "n of m shown" note appears.
- **Should filter chain by multiple verdict values when multiple toggles are pressed** — Pre: chain with pass/fail/blocked/skipped rows. Expected: rows matching any pressed toggle visible, active chips show all values.
- **Should support all six verdict values (pass/fail/blocked/skipped/aborted/running) per D27** — Pre: chain with rows having all six outcomes. Expected: each toggle filters correctly.
- **Should filter chain by exact module value** — Pre: chain with rows across MOD-001, MOD-002, MOD-008. Expected: only selected module rows visible.
- **Should exclude archived modules from the module dropdown** — Pre: active + archived modules exist. Expected: only active modules in dropdown.
- **Should filter chain by inclusive date range on latest-run date** — Pre: chain with rows dated across a month. Expected: only rows within range (inclusive) visible; empty-date rows excluded.
- **Should apply AND logic across result + module + date** — Pre: chain with mixed modules, outcomes, dates. Expected: only rows matching ALL criteria visible.
- **Should persist filter state in URL query params** — Pre: filters applied. Expected: URL contains ?result=...&module=...&from=...&to=...
- **Should restore filter state from URL query params on page load** — Pre: URL with filter params. Expected: filters auto-applied on load.

#### Negative

- **Should reject inverted date range with inline error without breaking other filters** — Pre: From date after To date. Expected: "From date is after to date" error, date filter ignored, result/module filters still work.
- **Should show "Filters excluded everything" panel when filter matches no rows** — Pre: filter combination with zero matches. Expected: distinct panel with copy "The data is still there: this is a filter result, not a coverage gap."
- **Should handle invalid URL params gracefully** — Pre: URL with invalid params. Expected: params silently ignored, full chain shown.

#### Boundary

- **Should include rows exactly at date-range inclusive boundaries (from and to)** — Pre: row with `data-date` equal to From or To value. Expected: row visible (inclusive bounds).
- **Should exclude rows with empty date when date filter is active** — Pre: row with `data-date=""` and date filter active. Expected: row hidden.
- **Should hide AC card only when ALL its rows are filtered out** — Pre: AC with 2 rows, filter hides 1. Expected: AC card stays, "1 of 2 shown" note.

#### Integration

- **Should filter over real BK-45 chain data without client-side divergence** — Pre: BK-45 endpoint returns chain with `data-status` and `data-date` per row. Expected: filter binds to the shipped chain contract, not only mockup demo data.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | Resolved by contract? | Criticality | Action |
|---|-----------|----------------------|-------------|--------|
| E1 | Inverted date range | YES — inline rejection, role="alert", filter ignored | N/A | Covered in AC2 Scenario 2.4 |
| E2 | Archived-module behavior | NO | High | **NEEDS PO/DEV CONFIRMATION** — picker shows demo modules only; behavior when soft-archived module selected or passed via URL undefined |
| E3 | Verdict value with zero matching runs | YES — resolves to "Filters excluded everything" panel | N/A | Covered in AC3 Scenario 3.1 |
| E4 | Date-range inclusive boundary | YES — inclusive on both ends | N/A | Covered in Phase 4 Boundary outline |
| E5 | Rows with `data-status="none"` or empty date | YES — "no data yet" (skipped pill) vs "uncovered" (fail strip) | Low | Distinct from filtered-out; no test needed beyond existing empty states |
| E6 | Filter-state persistence (URL vs local) | **RESOLVED**: URL query params. PO Decision 2026-08-11. | N/A | Covered in AC5 (4 scenarios) |
| E7 | Shipped-chain alignment (real data vs mockup) | **RESOLVED**: Assume fields exist + defensive frontend. PO Decision 2026-08-11. | N/A | Covered in AC6 (1 scenario: missing data-date) |

---

## Story Quality Assessment

**Verdict**: Good (all ambiguities resolved)

**Key findings**:

- All dependencies (BK-45, BK-24, BK-30, BK-31, BK-50) now SHIPPED.
- The ratified mockup contract (2026-07-30) resolves 7 of 9 original ambiguities.
- PO decisions on 2026-08-11 resolve remaining 3 items (URL persistence, archived module, chain alignment).
- Frontend defensive validation covers missing data attributes (AC6).
- Story is fully testable against real chain data. Ready for sprint planning.
- Coverage estimate: 18 outlines (up from 14).

---

## Critical Questions for PO — ALL RESOLVED

> Resolved by PO decisions on 2026-08-11.

1. **Filter-state persistence: URL query params vs local component state?**
   - **Resolution**: URL query params. Shareability, back button, zero implementation cost.
   - **Format**: `?result=fail&module=MOD-001&from=2026-07-20&to=2026-07-25`

2. **Archived-module behavior: excluded from picker, or resolves to empty-result state?**
   - **Resolution**: Excluded from dropdown. Archived = inactive = not shown.
   - **Future improvement**: "Include archived" checkbox if needed.

3. **Shipped-chain alignment: does BK-45 expose latest-Run date per row and all six outcomes?**
   - **Resolution**: Assume fields exist (mockup defines them, endpoint is live). Frontend defensive validation for missing attrs.
   - **Validation**: Missing data-status/date/module → exclude from filtered, show in full view.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Is the filter client-side only (as in mockup) or server-side?** — Context: Mockup JS filters in the browser. For large chains, server-side predicate push-down may be needed. Testing impact: determines whether performance outlines test the API or only the UI.

2. **What is the `data-status` value for "aborted" rows?** — Context: D27 mandates six outcomes; mockup CSS defines five variants (omits `aborted`). The `aborted` chip needs a CSS variant (likely reuse `--blocked` token per §4.8 convention). Testing impact: determines whether the "Aborted" toggle renders correctly.

3. **Does the real BK-45 chain expose `data-date` (latest-Run date) as ISO date string or something else?** — Context: Mockup JS compares `row.dataset.date` with `<input type="date">` values (YYYY-MM-DD strings). Testing impact: determines date-format assertions.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | AC1 says "filters the chain by result 'failed'" | "filters chain rows by the latest-run outcome using multi-select toggle buttons (pass/fail/blocked/skipped/aborted/running); row-level filtering; AC card hidden only when ALL rows filtered out" | Aligns with ratified mockup contract; removes ambiguity |
| 2 | AC2 says "filters by a module and a date range" | "filters by module (exact-match on chain row's data-module) AND latest-run date (inclusive range on data-date); AND logic across all three filter types" | Aligns with mockup JS behavior |
| 3 | AC3 says "active filters clearly stated" | "shows 'Active filters:' + chips (Result: vals, Module: mod, From date, To date) + Clear all button + aria-live row count" | Makes assertion deterministic with concrete copy |
| 4 | No AC on Clear-all behavior | Add AC: "Clear all button resets all filters, restores full chain, hides active-filter summary" | Prevents users stuck in filtered dead-end |

---

## Data feasibility flags

**No data feasibility risks identified.** All dependencies (BK-45 chain endpoint, BK-24 Tests, BK-30 Runs, BK-31 Bugs) are SHIPPED. The mockup gate is LIFTED. The filter is client-side over existing chain data.

---

## Recommended testing strategy

### Pre-implementation
- Verify BK-45 chain endpoint exposes `data-status` and `data-date` per row
- Verify all six verdict values (pass/fail/blocked/skipped/aborted/running) are present in the chain data
- Confirm filter persistence contract with PO (URL params vs local state)

### During implementation
- Test filter bar rendering against mockup HTML (`traceability-chain.html` lines 553-596)
- Test `applyFilters()` JS logic against mockup behavior (lines 914-974)
- Verify three distinct empty states render correctly
- Verify inverted date range rejection with `role="alert"` and `aria-invalid`

### Post-implementation (in-sprint by /sprint-testing)
- Smoke: filter by each verdict value, by module, by date range, by AND combination
- Exploration: large chain performance, archived-module edge case, URL persistence
- Regression: Clear-all reset, filter state after navigation, "n of m shown" accuracy

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|----------------|
| 1 | BK-45 chain data diverges from mockup contract (missing `data-date` or `data-status` fields) | Medium | High | Integration outline: "filter over real BK-45 chain data" |
| 2 | `aborted` verdict value missing from chain data or CSS | Medium | Low | Positive outline: "six verdict values per D27" |
| 3 | Filter performance degrades on very large chains (client-side filtering) | Low | Medium | Positive outline: "AND combination" (largest row set intersection) |

---

## Next steps

- [x] PO answers Critical Questions (filter persistence, archived-module behavior, chain alignment) — RESOLVED 2026-08-11
- [ ] Dev answers Technical Questions (client vs server filter, `aborted` CSS variant, date format)
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)
