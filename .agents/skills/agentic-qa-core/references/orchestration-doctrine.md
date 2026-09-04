# Orchestration Doctrine

> **Mirror**: this file mirrors `AGENTS.md` §3 "Orchestration Mode — Permanently Active".
> If you change the doctrine, update both files. The root AGENTS.md is the canonical source.
> Rationale: subagents need to load this without pulling the full AGENTS.md into their context.

## Orchestration Mode — Permanently Active

> **Main conversation = command center. Subagents = executors.** Active EVERY session. Not optional.

> **WORKFLOW-SKILL DISPATCH IS NON-NEGOTIABLE (not subject to the "most efficient path" override):** `sprint-testing`, `shift-left-testing`, `test-documentation`, `test-automation`, `regression-testing`, `framework-development` run a FIXED per-stage subagent dispatch. The orchestrator MUST dispatch each stage via its `Role agent` (`subagent_type`) — `qa-plan` / `qa-bulk` / `qa-code` / `qa-write` / `qa-review` / `qa-vision` — and MUST NOT execute a stage's work inline (write ATP/ATR to Jira, run DB/API/UI exploration, file bugs, post comments, run transitions) just because the context is already loaded. The "most efficient path first" override and the "quick lookups / inline" carve-outs below do NOT apply to these six workflow skills' stage boundaries — they govern only *non-stage* work (memory reads/writes, task tracking, planning, asking the user, sprint-file bookkeeping). Symptom to self-catch: if you are about to write a Jira field, run a `dbhub`/`curl`/Playwright call, or transition an issue during a workflow skill's Stage 1/2/3, STOP and dispatch the stage's role agent instead.

**MOST EFFICIENT PATH FIRST (overrides the lists below)**: before every dispatch, the orchestrator picks the CHEAPEST path — main thread (inline) vs subagent — and uses it. Efficiency (tokens/latency) is the tie-breaker, never protocol ceremony. Prefer **inline** when the context is already loaded in the main thread and a briefing + re-read would duplicate tokens, or for quick lookups. Prefer a **subagent** when the work is heavy file reading whose context gets discarded on return, or mechanical/bulk work (bulk TC creation, verifiers, log reading). Subagents inherit the parent session's MCP servers and can execute MCP tools (`context7_*`, `tavily_*`, `playwright_*`, `dbhub_*`, `openapi_*`) — MCP-bound stages are delegable. Keep memory reads/writes and task tracking on the main thread (below).

**USE SUBAGENTS FOR**: reading/writing multiple files, MCP operations, research across repos, git operations, verification (tests/types/lint), multi-file edits, long-running tasks.

**DO NOT USE SUBAGENTS FOR**: quick lookups, memory reads/writes, task tracking, asking user, planning.

**7-COMPONENT BRIEFING (MANDATORY every dispatch)**:

1. **Goal** — one sentence
2. **Context docs** — files to read first
3. **Project Standards (auto-resolved)** — compact rules pulled from `.agents/skills/REGISTRY.md` (built by `bun run skills:registry`). Subagents trust these as authoritative for listed conventions and DO NOT re-read full SKILL.md unless explicitly told to. Protocol: `agentic-qa-core/references/skill-resolver.md`
4. **Skills to load** — explicit (e.g. `/playwright-cli`)
5. **Exact instructions** — step-by-step, not vague goals
6. **Report format** — what to return (files changed, tests passed, blockers)
7. **Rules** — relevant Critical Rules to follow

**EXECUTION PATTERNS**:

| Pattern | When | Example |
|---|---|---|
| Parallel | Independent tasks | Read 3 context files at once |
| Sequential | Dependent tasks | Plan → Code → Test |
| Background | Long-running | Test suite + plan next ticket |
| Single | Simple task | One file edit + verification |

**ERROR PROTOCOL**: On subagent error → STOP, report full context, DO NOT fix without approval, offer retry/skip/abort.

**WORKFLOW SKILL COMPLIANCE**: `shift-left-testing`, `sprint-testing`, `test-documentation`, `test-automation`, `regression-testing`, `framework-development` MUST have a `## Subagent Dispatch Strategy` section using the 7-component briefing. Reference / utility / generator skills are EXEMPT (no dispatch table needed): `agentic-qa-core`, `agentic-qa-onboard`, `acli`, `xray-cli`, `playwright-cli`, `playwright-best-practices`, `project-discovery`, `project-context`, `sync-ai-context`, `adapt-framework`, `jira-administration`, `git-flow-master`.

**DEEP DETAIL** (further references):

- `.agents/skills/agentic-qa-core/references/briefing-template.md` — 7-component briefing examples per pattern
- `.agents/skills/agentic-qa-core/references/dispatch-patterns.md` — when to Single / Parallel / Sequential / Background
