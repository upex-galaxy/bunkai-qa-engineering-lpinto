# AI Model Routing Strategy

Canonical mapping of QA tasks to subagent roles to models. This file is the
single source of truth; the harness configs (`.opencode/agents/`,
`.codex/agents/`, `.claude/agents/`) bind each role to a model, and the routing
rule in `AGENTS.md` maps each task to its role.

## Routing decision order (read first)

Before mapping a task to a role → model, the orchestrator decides the CHEAPEST
path and uses it — efficiency over protocol ceremony:

1. **Main thread (inline)** when the context is already loaded in the main
   thread and a briefing + re-read would duplicate tokens, or for quick lookups.
2. **Subagent** when the work is heavy file reading (context discarded on
   return) or mechanical/bulk (bulk TC creation, verifiers, log reading) — then
   route to the role/model table below.

Subagents inherit the parent session's MCP servers (`context7_*`, `tavily_*`,
`playwright_*`, `dbhub_*`, `openapi_*`) and can execute MCP tools, so MCP-bound
stages are delegable. Keep memory reads/writes and task tracking on the main
thread.

## Role agents

| Role | Task type | Model (opencode) |
|---|---|---|
| `qa-plan` | Reasoning: shift-left AC refinement, ATP/TC design, ROI prioritization, failure classification, GO/NO-GO verdicts, review verdicts | `opencode-go/deepseek-v4-pro` |
| `qa-code` | Code: KATA/Playwright/TypeScript components, fixtures, Gherkin, test files | `opencode-go/kimi-k2.7-code` |
| `qa-bulk` | Mechanical: bulk TC creation, verifiers (test/types/lint), CI monitor, log reading, CLI ops | `opencode/mimo-v2.5-free` |
| `qa-vision` | Visual: screenshots, bug annotation, UI verification | `opencode-go/deepseek-v4-flash-vision-exp` |
| `qa-write` | Prose: Jira comments, ATR/ATP bodies, reports | `opencode/hy3-free` |

## Model bindings per harness

| Role | opencode | codex | Claude Code |
|---|---|---|---|
| `qa-plan` | `opencode-go/deepseek-v4-pro` | `opencode-go/deepseek-v4-pro` | `opus` |
| `qa-code` | `opencode-go/kimi-k2.7-code` | `opencode-go/kimi-k2.7-code` | `sonnet` |
| `qa-bulk` | `opencode/mimo-v2.5-free` | `opencode-go/mimo-v2.5` | `haiku` |
| `qa-vision` | `opencode-go/deepseek-v4-flash-vision-exp` | `opencode-go/deepseek-v4-flash-vision-exp` | `sonnet` |
| `qa-write` | `opencode/hy3-free` | `opencode-go/hy3` | `haiku` |

codex uses paid cheap equivalents (`mimo-v2.5`, `hy3`) for bulk/write because the
free `opencode/` Zen models live on a separate endpoint that is not wired; swap
them to the free IDs once the Zen free endpoint is configured.

- **opencode** binds roles to opencode-go/zen models natively.
- **codex** reaches opencode-go via the OpenAI-compatible endpoint declared in
  `.codex/config.toml` `[model_providers.opencode-go]` — requires the Go API key
  in `OPENCODE_GO_API_KEY`. Verify the `model_providers` schema against the codex
  docs if the provider does not resolve.
- **Claude Code** cannot reach opencode-go per-subagent without a model router;
  roles map to Anthropic-native tiers (`opus`/`sonnet`/`haiku`) as equivalents.

## Peak-hours model swap

`qa-plan` uses `deepseek-v4-pro`. Peak hours are `01:00–04:00` and `06:00–10:00`
UTC Mon–Fri (price ×2). During peak, switch `qa-plan` to
`opencode-go/glm-5.3` (paid, no peak surcharge). Free models are NOT a
reasoning fallback: the shift-left mini-eval scored Nemotron 3 Ultra Free 8/12
vs DeepSeek V4 Pro 12/12 — free models fabricate specifics under ambiguity.
Free models are reserved for mechanical/bulk work only.

## Verified model IDs (`opencode models`, 2026-08-27)

### OpenCode Go (paid, subscription)

`deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`,
`glm-5.3`, `glm-5.3-flash`, `glm-5.2`, `glm-5.1`, `gpt-5.6-luna`, `grok-4.6`,
`kimi-k3`, `kimi-k2.7-code`, `kimi-k2.6`, `longcat-2.0`, `mimo-v2.5`,
`mimo-v2.5-pro`, `minimax-m3`, `minimax-m2.7`, `muse-spark-1.2-contributor`,
`qwen3.8-max`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-plus`, `hy3`.

### OpenCode Zen (free)

`hy3-free`, `mimo-v2.5-free`, `muse-spark-1.2-contributor-free`,
`nemotron-3-ultra-free`, `nemotron-3.5-lightning-free`, `big-pickle`.

Discrepancies vs the original free-model list: **`Laguna S 2.1 Free` is not
available**; the actual free set includes `big-pickle` instead.

## Privacy constraints

- `muse-spark-1.2-contributor*` trains on your prompts/responses — never use
  with client code or customer data.
- `grok-4.6` and `gpt-5.6-luna` retain data 30 days (abuse monitoring).
  Everything else retains 0 days.
- Client-sensitive work routes through 0-day models: deepseek, glm, kimi, qwen,
  minimax, hy3, mimo, longcat, nemotron.

## codex setup (OpenCode Go models)

codex reaches OpenCode Go models through the OpenAI-compatible provider declared
in `.codex/config.toml` `[model_providers.opencode-go]`.

1. Subscribe to OpenCode Go at <https://opencode.ai/auth> and copy the Go API key.
2. Add it to `.env` as `OPENCODE_GO_API_KEY=<key>` (entry already in `.env.example`).
3. Launch codex with the repo wrapper so the key is loaded: `bun run codex`
   (wraps `codex` with dotenv-cli; or use direnv on Mac/Linux).
4. Verify the provider resolves: run codex, dispatch a QA subagent (e.g. ask it
   to plan a test), and confirm the model responds. If the provider does not
   resolve, check the `model_providers` schema (`wire_api`, `base_url`) against
   the current codex docs — the field names are version-sensitive.

Caveats:

- Only the paid Go models (`opencode-go/*`) are wired. The free `opencode/` Zen
  models live on a separate endpoint and are not reachable from codex yet; the
  bulk/write roles use paid cheap equivalents (`mimo-v2.5`, `hy3`) until that
  endpoint is configured.
- Claude Code cannot use OpenCode Go models per-subagent without a model router;
  its QA agents map to Anthropic tiers instead.
