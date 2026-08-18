# Comments for BK-212

[View in Jira](https://jira.upexgalaxy.com/browse/BK-212)

---

### Ely - 11/7/2026, 12:52:25

## PO Ratification — 2026-07-11

- N5 — The bug status vocabulary remains DEFERRED to the Bugs epic ([https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31)) lifecycle definitions; this deferral is itself the ratified decision. The dependency note in the Business Rules field stands as-is; no change needed.

---

### yxsinell acosta zambrano - 19/7/2026, 16:32:05

## Shift-Left Handoff — [https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212](https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212) ready for estimation review

Shift-Left refinement is complete for ***BK-212 — Notifications | Get notified on bug assignment and status changes***.

What was updated:

- Refined Acceptance Criteria were written to the Acceptance Criteria field.
- ATP DRAFT was written to the Acceptance Test Plan field.
- Labels added: `shift-left-reviewed`, `shift-left-2026-07-19`.
- Story Points set to ***8***.

Why these decisions were taken:

- This Story is not only UI copy in the inbox. It owns recipient decision logic for bug assignment/status events, self-notification suppression, dedupe, visibility enforcement, and deep links.
- [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) owns bug lifecycle/status vocabulary, so [https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212](https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212) must consume those events instead of inventing a parallel status model.
- [https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209](https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209) owns inbox rendering, so [https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212](https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212) must produce notifications compatible with that substrate instead of building a separate surface.

Implementation gate:

- Estimate is valid assuming [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) exposes bug events and [https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209](https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209) provides inbox persistence/rendering.
- If those dependencies are missing at implementation time, split or re-estimate as 13 SP.

---

### yxsinell acosta zambrano - 19/7/2026, 16:32:06

## Shift-Left Role Decisions — PO / Dev / Design answers

### PO decisions

| ***Question**** | ****Answer**** | ****Why*** |
| --- | --- | --- |
| Can [https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212](https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212) be developed before [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) ships bug lifecycle events? | No. Estimate now, but start implementation only after [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) exposes assignment/status events. | Without source events, QA cannot validate real notification behavior. |
| What happens when a bug has no run/test context attached? | Deep link lands on bug detail and shows available context only. | Prevents broken links while preserving the Story promise. |
| Should previous assignees be notified when reassigned away? | No. Only the new assignee is notified in this Story. | Keeps scope aligned with current Business Rules. |

### Dev decisions

| ***Question**** | ****Answer**** | ****Why*** |
| --- | --- | --- |
| Which event contract powers this Story? | `bug.assigned` and `bug.status_changed` from [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31). | Keeps notification logic tied to the bug domain source of truth. |
| How is duplicate delivery prevented? | Unique key: source event id + recipient id; build recipients as a set before insert. | Prevents duplicate inbox rows when reporter and assignee are the same user or retries happen. |
| Where is visibility enforced? | At recipient resolution and again when reading/opening inbox notifications. | Prevents stale notifications leaking inaccessible bug metadata. |

### Design decisions

| ***Question**** | ****Answer**** | ****Why*** |
| --- | --- | --- |
| What should the notification row show? | Bug icon, bug title, `Assigned to you` or `Status changed: <old> -> <new>`, and [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) severity chip when available. | Gives Sara enough context without opening the bug. |
| What if only next status is available? | Render `Status changed to <new>`. | Keeps UI robust if [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) event payload is minimal. |
| How should inaccessible bug links behave? | Hide inaccessible rows; stale clicked links use permission-safe not-found state. | Avoids bug metadata leakage. |

---

### yxsinell acosta zambrano - 19/7/2026, 16:32:06

## Estimate Rationale — [https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212](https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212) = 8 SP

Recommended and applied estimate: ***8 Story Points***.

Why not 5 SP:

- The work is more than rendering a notification row. Recipient logic changes by event type and must exclude the actor.
- Dedupe is required when reporter and assignee are the same person.
- Visibility must be checked so project/workspace access changes do not leak bug metadata.
- Deep links must land on bug detail with run/test context when available.

Why not 13 SP:

- [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) owns bug lifecycle/event source.
- [https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209](https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209) owns inbox surface/persistence/rendering.
- [https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212](https://jira.upexgalaxy.com/browse/BK-212#icft=BK-212) should consume those contracts, not build them.

Re-estimation trigger:

- If [https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31](https://jira.upexgalaxy.com/browse/BK-31#icft=BK-31) or [https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209](https://jira.upexgalaxy.com/browse/BK-209#icft=BK-209) foundations are not available when development starts, this becomes ***13 SP*** or should be split into event-source/inbox-consumer work.

---

### Ely - 30/7/2026, 13:29:35

Mockup — Notifications inbox — bug events. Source: .context/designs/bunkai-test-management-tool/bk-208-notifications/notifications-inbox.html · spec: master-design-plan §4.13



---

### Automation for Jira - 3/8/2026, 8:30:15

🔎 Pull Request created. Task is pending to ANALYZE and REVIEW by the team. Waiting for PR Approval.

---

### Automation for Jira - 3/8/2026, 12:40:52

✅ Test Suite is successfully AUTOMATED and MERGED for Regression Runs. 
QA Task is Done.

---

### Ely - 3/8/2026, 12:48:33

## Workload Forecast — Resolved (git-flow-master Step 4)

The Stage 1 plan forecast this change at ~585 lines (High risk per the >400 threshold) and left `Chain strategy: pending`. Resolved via the git-flow-master chained-PR decision tree:

Chain strategy: stacked-to-main

Decision trace: Q1=No (new domain logic — a trigger reading BK-264's activity*log writes and producing Notification rows — not a mechanical rename/format/codegen sweep) · Q2=Yes (the work splits cleanly into 2 independent, self-contained slices, each comfortably under 400 lines: Slice 1 = the DB trigger/RPC that turns a bug.assigned/reassigned/unassigned/status*changed activity*log row into a notifications row + its isolation tests (~300-350 lines); Slice 2 = any UI rendering delta for bug-type notifications (~100-150 lines, and possibly near-zero since BK-209 already ships a generic "entity no longer available" fallback for entity*type='bug' that degrades safely). Slice 1 is independently valuable and mergeable to staging on its own — bug-event notifications start appearing in the inbox even before any UI polish lands — so the strategy's own bar ("base always works after each merge") holds without needing a shared long-lived integration branch) → stacked-to-main

Decided by: /git-flow-master §Chained-PR decision tree (branching-strategies.md)

### Branch plan

- Slice 1 (DB producer): migration `0056*...` (trigger/function reading `activity*log` bug-lifecycle rows, writing `notifications` rows per BK-209's schema) + isolation tests → its own PR, branched off `staging`, merged to `staging` directly.
- Slice 2 (UI, only if a real gap remains after Slice 1 lands): any rendering delta for bug-type notifications beyond BK-209's existing fallback → its own PR, branched off `staging` (post-Slice-1), merged to `staging` directly.

Gate cleared. Stage 2 implementation may proceed under this branch plan.

---

### Ely - 3/8/2026, 15:29:59

## Ready for QA

Merged to `staging` via [PR #115](https://github.com/upex-galaxy/upex-bunkai-tms/pull/115), branch `feat/BK-212-bug-notifications`. Deployed and READY on staging: https://staging-upexbunkai.vercel.app

Depends on BK-209 (inbox) and BK-264 (bug assignment/status) — both already on staging.

@yxsinell acosta zambrano — shift-left owner for this story, assigned for QA verification.

---

### Luis Eduardo Flores Villarroel - 14/8/2026, 8:58:57

## Context from BK-264 testing (informational — not a BK-212 test result)

BK-264 (TMS-Defect Triage | Assign a defect to a workspace member and update its status) is now QA Approved on Staging. It's the prerequisite this story consumes: the `activity*log*notify*bug*event` trigger writes a `notifications` row on every bug assignment and status change, and that's the event this story subscribes to.

During BK-264 testing, I captured one concrete `notifications` row from a real assignment so whoever picks up BK-264 has the actual shape to build a test plan against, not a guess:

```json
{
  "id": "aeb386a5-d5ee-493a-9ef7-8f53fa2a2470",
  "workspace_id": "6646f244-a28c-441e-8486-9af33bdb5c11",
  "recipient*user*id": "c6a2b665-c090-4b74-b3df-6abcdae40c89",
  "event_type": "bug.assigned",
  "entity_type": "bug",
  "entity_id": "39d6834b-ae7b-4317-b6b7-5552928de6c3",
  "payload": {
    "title": "BK264 Primary happy-path chain defect",
    "run_id": null,
    "project_slug": "bk264-defect-triage",
    "assignee*user*id": "c6a2b665-c090-4b74-b3df-6abcdae40c89",
    "previous*assignee*user_id": null
  },
  "read_at": null,
  "created_at": "2026-08-14T11:37:07.610Z",
  "source*event*id": "a60cc106-d592-4e36-be3a-f632668f271c"
}
```

A few things worth flagging for the future BK-264 tester based on this row:

- `event*type` was `bug.assigned` for this capture — BK-264 also fires `bug.reassigned`, `bug.unassigned`, and `bug.status*changed` on the other actions, so expect the same shape with a different `event_type` and `payload` contents for those.
- `payload.previous*assignee*user_id` is `null` here because this was a first-time assignment (not a reassignment) — worth a distinct test case for the reassignment case where it should be populated.
- `recipient*user*id` is the newly assigned member, not the actor who performed the assignment — confirm who should actually receive the notification per this story's ACs.
- `run_id` is `null` in this payload — not populated by the bug-assignment flow, in case this story's notification rendering expects it.

This is purely context from BK-264's own testing pass, not a verdict on BK-212 itself.

---


_Synced from Jira by sync-jira-issues_
