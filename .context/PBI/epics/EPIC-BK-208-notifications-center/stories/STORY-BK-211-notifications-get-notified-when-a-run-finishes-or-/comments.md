# Comments for BK-211

[View in Jira](https://jira.upexgalaxy.com/browse/BK-211)

---

### Ely - 11/7/2026, 12:52:24

## PO Ratification — 2026-07-11

- N4 — The recipient of a run's terminal events is ratified as the member who started the run (v1). Broader watcher/participant audiences are explicitly out of scope for this iteration and belong to a future story. The Business Rules field already reflects this; no change needed.

---

### Carlos Alberto Chiavassa - 18/7/2026, 10:12:57

## Shift-Left QA Close-Out — Estimation & Handoff

> ***WARNING:**** ****Depends on BK-30 (Manual Execution & Runs, currently in Planning).*** The notification-creation logic
(self-suppression, executor parity, visibility filter) can be built now, but there is no real
run-terminal trigger to hook into until [https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30](https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30) ships. Flagging this prominently so PO can decide
sequencing — this story should not be picked up assuming the trigger already exists.

### PO Questions Resolved (QA refinement decisions, revisable by PO)

***Q1 — Visibility loss (GAP-1) — RESOLVED.*** When a run starter loses access to the workspace/project, her run-lifecycle notification stops being listed in the inbox — no visual mark, no explanatory message. Silent removal, not a degraded/placeholder state.
Precedent: [https://jira.upexgalaxy.com/browse/BK-27#icft=BK-27](https://jira.upexgalaxy.com/browse/BK-27#icft=BK-27) resolved the equivalent case for foreign-resource access as "identical 404 to a nonexistent resource — no disclosure," and the Class 3 RLS probe requires that user A only ever sees rows belonging to A. Consistent with the workspace-scoped pattern used throughout Bunkai.

***Q2 — Run-trigger automation surface (GAP-2) — RESOLVED.*** No `RunsApi`-equivalent trigger exists today. Declared an explicit upstream dependency on [https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30](https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30) (Planning, already diagnosed during BK-46's shift-left session) and a precondition for Stage 2 (`/test-automation`) — not a blocker to grooming or estimating this story now.
Precedent: [https://jira.upexgalaxy.com/browse/BK-27#icft=BK-27](https://jira.upexgalaxy.com/browse/BK-27#icft=BK-27) — "only 1 ATC in staging blocks 6/19 outlines" was documented as a precondition on the affected outlines, not treated as a reason to halt estimation. Same treatment applied here.

***Q3 — Self-suppression vs. executor parity (AMB-2) — QA-proposed, pending PO ratification (since 2026-07-17).*** An agent finishing a run at the starter's own request counts as an executor under the parity rule, not as the starter's own action — it notifies. Self-suppression stays scoped to the starter manually finishing/aborting herself. Not a fresh decision from this session — carried over, still awaiting PO sign-off.

### Estimation: 5 (Fibonacci)

| ***Perspective**** | ****Assessment*** |
| --- | --- |
| PO | Recipient scope already ratified (N4), clear business value, but the whole feature is sequenced behind [https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30](https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30) — a sequencing risk, not a requirements gap |
| Dev | Creation logic has 3 interacting rules (self-suppression x executor parity x silent visibility filter) against an event source that doesn't exist yet ([https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30](https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30)) — real business-rule complexity, not plain CRUD |
| QA | 4 ATCs, but 2 of 4 (the triggers) are blocked until [https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30](https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30) ships — today's automatable surface is thin; the decision table has 3 interacting factors vs. a simpler 2-factor grid elsewhere in this epic |

Kept at 5 rather than 3: resolving Q1/Q2 did not shrink this story the way it did for a sibling story in this epic — it turned an open ambiguity into a concrete rule to build (Q1) and confirmed a real, non-removable external dependency (Q2). Kept at 5 rather than 8: the inbox UI is 100% reused from the sibling display story (no new Page component), the preference gate is 100% reused from the sibling preferences story (no new logic there), and the [https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30](https://jira.upexgalaxy.com/browse/BK-30#icft=BK-30) dependency is a sequencing risk, not an implementation-complexity multiplier once the event exists.

Full detail: `shift-left-refinement.md` §5 / §5.1.

---

### Ely - 30/7/2026, 13:29:32

Mockup — Notifications inbox — run events. Source: .context/designs/bunkai-test-management-tool/bk-208-notifications/notifications-inbox.html · spec: master-design-plan §4.13



---


_Synced from Jira by sync-jira-issues_
