# Market Best-Practices Comparison (Phase 4 — optional, opt-in)

> AFTER Phase 3 handoff fully populates the Story's Description + ATP DRAFT fields, ASK the user whether to run an exhaustive web research on what a user story should contain after a shift-left testing pass, and compare the findings against the Story being refined. Keeps the process current by adopting market best practices. NEVER runs without explicit user opt-in; NEVER applies changes without explicit approval.

## 1. Opt-in gate (MANDATORY)

After Phase 3 handoff completes (Jira description + ATP DRAFT + labels + transition verified), ask the user:

> "¿Querés que haga una búsqueda exhaustiva en internet sobre qué debería tener una user story luego de un shift-left testing, para comparar los resultados con la story que estamos refinando?"

- **User declines** → record it in `progress.md` (`status: declined`) and move to batch report / archive. No research runs.
- **User accepts** → run Phase 4 for the refined Story(ies). Per-Story, sequentially, same cadence as Phase 2.

## 2. Research (exhaustive web search)

Use `[WEB_SEARCH_TOOL]` (Tavily — primary) with **multiple parallel queries** covering the dimensions a post-shift-left story must satisfy. Proven query set (expand per Story domain):

1. `user story best practices after shift-left testing refinement`
2. `acceptance criteria structure INVEST 3Cs user story`
3. `non-functional requirements in user stories performance accessibility`
4. `user story dependencies scope out-of-scope definition of ready`
5. `test plan coverage traceability user story refinement QA`
6. Story-specific: `"<feature>" acceptance criteria edge cases` (2-3 queries)

Research depth: **exhaustive** (search_depth `advanced`, 3-5 results per query, follow authoritative sources: Scrum/Agile canon, ISTQB, QA blogs, engineering blogs). Collect per-dimension: what the market recommends + source.

## 3. Comparison table (gap analysis)

Produce a **gap table** mapping each market dimension to the refined Story:

| Market dimension (best practice) | In refined Story? | Where (field/section) | Gap / improvement proposal | Source |
|---|---|---|---|---|
| INVEST-shaped story | ✅ / ⚠️ / ❌ | Description — User Story | ... | [source] |
| Measurable Gherkin ACs | ✅ | Description — Refined ACs | — | |
| NFRs (perf/accessibility/scalability) | ⚠️ (proposed only) | ATP DRAFT — Non-Functional | Needs PO/Dev confirmation | |
| Explicit scope / out-of-scope | ✅ si field nativo poblado | Field `Scope` / `Out Of Scope` (sync `scope.md` / `out-of-scope.md`) | — (duplicar en Description/ATP es redundante — Jira es la fuente de verdad) | |
| Explicit dependencies | ✅ si field nativo existe y está poblado · ❌ si no existe | Field nativo o Description | Proponer sección SOLO si el proyecto no tiene field nativo; nunca duplicar | |
| Entry/exit criteria | ✅ | ATP DRAFT | — | |
| ... (add rows per finding) | | | | |

Rules:
- **✅ / ⚠️ / ❌ verdict per dimension** — no prose walls.
- Cite the source per row (URL or publication).
- **Native Jira fields count as covered.** A dimension backed by a populated native field (Scope, Out Of Scope, Dependencies, etc.) is ✅ — do NOT duplicate it in Description/ATP DRAFT (Jira is the source of truth; duplication violates anti-pattern L7). Only propose a new section when the project has no native field for it.
- NEVER invent content as already-present; read the actual synced Story fields (description + ATP DRAFT + native fields like `scope.md` / `out-of-scope.md`) before judging.

## 4. Present + wait (NO changes without approval)

Present to the user:
1. Gap table (above).
2. **Explicit options** for each material gap — e.g. *Option A: add formal ACs* · *Option B: add as proposed outlines + NEEDS PO/DEV CONFIRMATION* (default — preserves Defect/Improvement classification per `nfr-proposal-procedure.md`) · *Option C: leave as-is*.
3. Recommendation with justification.

**WAIT for user decision.** NEVER push changes to Jira during this phase without the user explicitly choosing an option. Approved changes follow the same mutation protocol as Phase 3 (backup → PUT → verify GET, content separation Description = WHAT / ATP DRAFT = HOW, `tableHeader` for ADF tables, numerical consistency — see `nfr-proposal-procedure.md` §4-5).

## 5. Post-phase bookkeeping

- Append `## Phase 4 — Market Comparison — <ts>` to `progress.md` with `status: completed | declined`, `artifacts_touched: [.session/shift-left-testing/<batch-id>/market-comparison.md]`.
- Persist the research output at `.session/shift-left-testing/<batch-id>/market-comparison.md` (gap table + sources + decisions) — session artifact, NOT a Jira field.
- If approved changes were applied to Jira, they follow the Phase 3 handoff rules (backup, verify, labels unchanged, NO re-transition needed — Story stays at `estimation`).
- Archive: the market-comparison.md moves with the session folder per `agentic-qa-core/references/session-management.md` §8.