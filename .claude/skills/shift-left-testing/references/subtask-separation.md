# Subtask Separation Pattern — 4-Subtask Structure per Story

> **Reference for**: Phase 2 (cross-role resolution) + Phase 3 (Handoff). Defines the 4-subtask pattern created under each refined Story.

---

## Overview

Every refined Story gets up to 4 subtasks (Task type, `issuetype.id: 10018`, parent = Story key):

| # | Subtask Name | When Created | Content |
|---|---|---|---|
| 1 | `{STORY_KEY} - User Story - Refinement Draft` | **Always** | Description BEFORE cross-role resolution (draft with `NEEDS PO/DEV CONFIRMATION`) |
| 2 | `{STORY_KEY} - User Story - Refined` | **Only if cross-role accepted** | Description AFTER cross-role resolution (all questions answered, all conflicts resolved) |
| 3 | `{STORY_KEY} - ATP Draft - Refinement Draft` | **Always** | ATP DRAFT BEFORE cross-role resolution (draft with `NEEDS PO/DEV CONFIRMATION`) |
| 4 | `{STORY_KEY} - ATP Draft - Refined` | **Only if cross-role accepted** | ATP DRAFT AFTER cross-role resolution (all confirmed, all resolved) |

---

## Creation Rules

### Draft subtasks (#1, #3) — ALWAYS created

- Created in Phase 3 (Handoff), step 0
- Populated with the output of Phase 2 (Refinement subagent)
- **NEVER overwritten after creation** — they are the "before" snapshot
- Content includes `NEEDS PO/DEV CONFIRMATION` markers where applicable

### Refined subtasks (#2, #4) — Only if cross-role accepted

- Created ONLY if the user accepts the cross-role question in Phase 2
- Populated with the output of the cross-role subagents (PO Senior, Dev Senior, UX/UI Designer)
- Content includes `CONFIRMED` markers with Q# references
- Ambiguities marked `RESOLVED`, gaps marked `FILLED`, contradictions marked `RESOLVED`

---

## Cross-Role Resolution Flow

```
Phase 2.0 — Refinement subagent produces draft content
    ↓
Phase 2.1 — Present summary to user → WAIT for OK
    ↓
Phase 2.2 — ASK cross-role question:
    "¿Querés que lance subagentes cross-role (PO Senior, Dev Senior, UX/UI Designer)
     para responder las preguntas abiertas para resolver ambigüedades, gaps,
     conflictos y contradicciones?"
    ↓
    ┌─── YES ───┐                    ┌─── NO ───┐
    │            │                    │           │
    ▼            │                    ▼           │
Phase 2.3a      │                    Phase 2.3b  │
Launch 3        │                    Skip cross- │
subagents       │                    role        │
in parallel:    │                    resolution  │
• PO Senior     │                    │           │
• Dev Senior    │                    │           │
• UX/UI Designer│                    │           │
    │           │                    │           │
    ▼           │                    │           │
Phase 2.4      │                    │           │
Integrate      │                    │           │
answers:        │                    │           │
• NEEDS → CONFIRMED                  │           │
• Ambiguities → RESOLVED             │           │
• Gaps → FILLED                      │           │
• Conflicts → RESOLVED               │           │
    │           │                    │           │
    ▼           │                    │           │
Phase 3 — Handoff:                    │           │
Create 4 subtasks (#1-#4)            Create 2 subtasks (#1, #3 only)
```

---

## Jira Creation Payload

### Subtask #1: User Story - Refinement Draft

```json
{
  "fields": {
    "project": { "key": "{{PROJECT_KEY}}" },
    "parent": { "key": "<<STORY_KEY>>" },
    "issuetype": { "id": "10018" },
    "summary": "<<STORY_KEY>> - User Story - Refinement Draft",
    "description": "<ADF content of Description BEFORE cross-role resolution>"
  }
}
```

### Subtask #2: User Story - Refined

```json
{
  "fields": {
    "project": { "key": "{{PROJECT_KEY}}" },
    "parent": { "key": "<<STORY_KEY>>" },
    "issuetype": { "id": "10018" },
    "summary": "<<STORY_KEY>> - User Story - Refined",
    "description": "<ADF content of Description AFTER cross-role resolution>"
  }
}
```

### Subtask #3: ATP Draft - Refinement Draft

```json
{
  "fields": {
    "project": { "key": "{{PROJECT_KEY}}" },
    "parent": { "key": "<<STORY_KEY>>" },
    "issuetype": { "id": "10018" },
    "summary": "<<STORY_KEY>> - ATP Draft - Refinement Draft",
    "description": "<ADF content of ATP DRAFT BEFORE cross-role resolution>"
  }
}
```

### Subtask #4: ATP Draft - Refined

```json
{
  "fields": {
    "project": { "key": "{{PROJECT_KEY}}" },
    "parent": { "key": "<<STORY_KEY>>" },
    "issuetype": { "id": "10018" },
    "summary": "<<STORY_KEY>> - ATP Draft - Refined",
    "description": "<ADF content of ATP DRAFT AFTER cross-role resolution>"
  }
}
```

---

## ADF Conversion

All subtask descriptions must be converted from Markdown to ADF before PUT:

```bash
# Convert markdown to ADF
bun .claude/skills/acli/scripts/md-to-adf.ts input.md output.adf.json

# Create issue
curl -sS -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
  -X POST "$ATLASSIAN_URL/rest/api/3/issue" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  --data-binary @payload.json
```

---

## Gotchas

1. **Draft subtasks are immutable after creation.** Do NOT update #1 or #3 after they are created — they are the "before" snapshot.
2. **Refined subtasks are created AFTER cross-role resolution.** #2 and #4 are populated with the resolved content, not the draft.
3. **Issue type is Task (10018).** This is subtask-only in BK project. Parent must be the Story key.
4. **Content must fit Jira's 32KB description limit.** If content exceeds, compress tables to bullet lists or split into multiple sections. Do NOT create extra subtasks for overflow.
5. **Verify after creation.** Check HTTP 201 response and read back the issue to confirm content landed.
