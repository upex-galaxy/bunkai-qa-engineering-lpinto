# Comments for BK-205

[View in Jira](https://jira.upexgalaxy.com/browse/BK-205)

---

### Ely - 11/7/2026, 12:52:48

## PO Ratification — 2026-07-11

- T1 ratified: milestone name 1–100 chars, unique per project (case-insensitive) — now a PO-final rule, no longer convention-derived. Business Rules field updated accordingly.
- T4 confirmed: target date must be today or a future date at creation; overdue signaling once the date passes with readiness incomplete is covered in the readiness story.

---

### Carlos Alcala - 22/7/2026, 23:31:04

## Acceptance Test Plan (ATP) — Shift-Left DRAFT ready for review

The ATP DRAFT lives in the 🧪 Acceptance Test Plan (ATP) field on this Story.

Action Required: review ambiguities, answer critical questions, confirm edge-case behavior, validate parametrization.

Refined on: 2026-07-22 — QA Shift-Left batch session
Local working copy: `.context/PBI/epics/EPIC-BK-201-test-plans-milestones/stories/STORY-BK-205-tms-milestone-create-a-milestone-with-a-target-dat/shift-left-refinement.md`

---

### Carlos Alcala - 24/7/2026, 3:32:45

## Acceptance Criteria updated after Three Amigos follow-up (2026-07-24)

@@Ely — 7 of the 9 remaining "needs confirmation" items were closed without a new decision, because they followed directly from things already agreed in the Three Amigos session (the name/date "required" rules already ratified, and Backend's exact uniqueness index `UNIQUE(project_id, lower(trim(name)))`). Only 2 genuinely need your call.

### Closed by inference (no action needed)

- Empty name / whitespace-only name / missing target date → rejected (already-ratified required-field rules)
- Target date exactly one day before today → rejected / exactly today → accepted (boundary of the already-answered "today or later" rule)
- Duplicate name differing only by leading/trailing whitespace → rejected (Backend's index trims edges)
- Same name allowed in two different projects → accepted (Backend's index is scoped by `project_id`)

### Still open — need your decision

1. ***Is there a maximum target date (upper bound), or is any future date acceptable?***

No existing decision answers this — PO capped the **description** at 500 characters, but the **target date** was never addressed, in shift-left or in Three Amigos.

1. ***Should a name that differs from an existing one only by internal whitespace (e.g. "Release 2.4" vs "Release  2.4") be allowed as a distinct milestone, or treated as a duplicate?***

This one is tied to the uniqueness requirement as a whole, not just the AC. Backend's current index — `UNIQUE(project_id, lower(trim(name)))` — only strips leading/trailing spaces, so "Release 2.4" and "Release  2.4" collide as distinct rows today. If the answer is "should be treated as duplicate", the index itself needs to change (e.g. collapse internal whitespace before comparing, not just trim edges) — this is a joint product + implementation call, not just an AC wording question. Kept open on purpose.

Full scenario-by-scenario detail: `acceptance_criteria` field on this Story.

---

### Ely - 30/7/2026, 13:29:17

Mockup — Milestones board. Source: .context/designs/bunkai-test-management-tool/bk-201-test-plans-milestones/milestones-board.html · spec: master-design-plan §4.11



---


_Synced from Jira by sync-jira-issues_
