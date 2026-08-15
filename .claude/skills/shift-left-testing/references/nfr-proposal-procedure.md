# NFR Proposal Procedure — Shift-Left

> When a Story is silent on Non-Functional Requirements (performance, accessibility, scalability), shift-left MUST NOT invent formal ACs. It proposes NFRs as test outlines + edge scenarios marked `NEEDS PO/DEV CONFIRMATION` — PO/Dev confirmation upgrades them to contract. Canon: `agentic-qa-core/references/defect-management-doctrine.md` (Improvement vs Defect classification by feature lifecycle stage).

## 1. Detect NFR gaps (during Phase 2 — Story Quality Analysis)

Scan the Story for missing NFR dimensions. Common triggers:

| Dimension | Detection trigger | Example probe |
|---|---|---|
| Performance | Volume/latency claims without numbers ("real time", "large history") | Delivery latency SLA under concurrent load; history load time for 10,000+ messages |
| Accessibility | No WCAG target; keyboard-only interactions implied but unspecified | Keyboard navigation (focus visible, Enter to send); screen reader announcements (live regions); presence not color-only |
| Scalability | Concurrency mentioned without bounds | N members sending simultaneously; history retention with growth |
| Security | Auth/RBAC present but no performance under auth load | Not usually an NFR — keep in Security-RBAC outlines |

**Rule**: an NFR gap is a *proposal*, never a silent assumption. Do NOT write it as a formal refined AC with a number you invented — write it as an outline + a proposed scenario, and make Dev/PO answer for the number.

## 2. Classification doctrine (binding)

- **Before PO/Dev confirmation**: failures against the proposed NFR are **Improvements** (under-/un-specified AC surfaced by test-beyond-AC).
- **After PO/Dev confirmation** (in Jira, e.g. Technical Question answered or scenario ratified): the NFR becomes **contract** → failures are **Defects**.
- The `NEEDS PO/DEV CONFIRMATION` marker on every proposed scenario is what preserves this classification boundary.

## 3. What to produce (Option B — no formal ACs)

### 3.1 Description — proposed edge scenarios (code block, after edge cases E1-E3)

```gherkin
Scenario E4 (High): Should meet delivery latency SLA under concurrent load (NFR - Performance)
  Given [N] members have the channel open and send messages simultaneously.
  When All messages are delivered to all members.
  Then Message delivery latency stays within the agreed SLA (scenario 1.1: under 2 seconds). NEEDS PO/DEV CONFIRMATION.

Scenario E5 (Medium): Should load large message histories within a defined time (NFR - Performance)
  Given The channel contains 10,000+ messages.
  When A member opens the channel.
  Then The history loads within a defined time budget (e.g., under 3 seconds). NEEDS PO/DEV CONFIRMATION.

Scenario E6 (High): Should support keyboard-only navigation (NFR - Accessibility, WCAG 2.1 AA)
  Given A user navigates the panel with keyboard only.
  When They interact with the message list, composer, and roster.
  Then All interactions are keyboard-accessible with visible focus (send on Enter, newline on Shift+Enter). NEEDS PO/DEV CONFIRMATION.

Scenario E7 (Medium): Should announce new messages to screen readers (NFR - Accessibility, WCAG 2.1 AA)
  Given A screen reader user has the channel open.
  When A new message arrives or presence changes.
  Then New messages are announced via a live region and presence indicators are not color-only. NEEDS PO/DEV CONFIRMATION.
```

- Priority pairing: 2 High + 2 Medium per dimension pair is the proven shape (Performance + Accessibility); adapt counts to the Story.
- Every scenario ends with `NEEDS PO/DEV CONFIRMATION.` — mandatory marker.

### 3.2 Description — Technical Questions for Dev (append)

1. `What performance SLAs apply to message delivery and history loading? — Blocks NFR performance outlines (NFR1, NFR2).`
2. `Will the panel meet WCAG 2.1 AA accessibility (keyboard navigation, screen reader)? — Blocks NFR accessibility outlines (NFR3, NFR4).`

Numbering continues from the existing list.

### 3.3 ATP DRAFT — Non-Functional outlines section (after State-Transition)

```
#### Non-Functional (4) — NEEDS PO/DEV CONFIRMATION
| #    | Outline | Preconditions | Expected Result |
|------|---------|---------------|-----------------|
| NFR1 | Should deliver messages within the latency SLA under concurrent load | [N] members send simultaneously | All messages delivered within the agreed SLA (2 seconds) |
| NFR2 | Should load large message history within a defined time | Channel has 10,000+ messages | History loads within the agreed time budget (e.g., 3 seconds) |
| NFR3 | Should support keyboard-only navigation of the channel panel | User navigates with keyboard only | All interactions keyboard-accessible with visible focus (WCAG 2.1 AA) |
| NFR4 | Should announce new messages to screen readers | Screen reader user has channel open | New messages announced via live region; presence not color-only (WCAG 2.1 AA) |
```

## 4. Numerical consistency (MANDATORY — all 6 places must agree)

| Place | Change |
|---|---|
| Coverage Estimate | Add `Non-Functional \| 4 \| Performance + Accessibility summary` row |
| Coverage Estimate Total | Bump Total by the NFR count (e.g. 26 → 30) |
| Traceability Map | Add rows `E4-E7 → NFR1-NFR4` with `needs PO confirmation` |
| Exit Criteria | Add `[ ] NFR verification executed (performance latency/load, accessibility keyboard/screen reader)` |
| Risk-Based Prioritization | Add `NFR1-NFR4` to the highest relevant tier + rationale mention |
| Risks & mitigation | Add risk row: `NFRs undefined (performance SLA, accessibility) — QA cannot assert non-functional acceptance` → Medium/Medium → `NFR1-NFR4, Technical Questions #10, #11` |

**Verify**: after syncing, the Exit Criteria "All N outlines executed" count MUST equal the Coverage Total. A mismatch is a sync error, not a formatting nuance.

## 5. Jira sync gotchas (learned — ADF)

1. **Jira ADF tables require `tableHeader`** cells (not `tableCell` + `marks: strong`) for header rows — `tableCell` headers cause HTTP 400 `INVALID_INPUT`. Replicate the structure of an existing table in the same field when in doubt.
2. **After a `splice()` in the ADF array, all subsequent indexes shift** — re-map remaining anchors before further edits, or edit bottom-up.
3. **Backup before PUT** (save the current field ADF JSON); **verify after PUT** (expect HTTP 204, then GET and assert the new content + no stale cross-references).

## 6. Follow-up (Phase 3 handoff / next steps)

- Add the NFR confirmation to Next Steps: `[ ] PO/Dev confirm NFR proposals (E4-E7, NFR1-NFR4) — confirmation upgrades them to contract`.
- When confirmed in Jira (answer to Technical Question or ratified scenario), the marker is removed and the outlines become executable acceptance targets — future failures = Defect.