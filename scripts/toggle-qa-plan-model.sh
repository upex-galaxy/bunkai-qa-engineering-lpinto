#!/usr/bin/env bash
# Toggle qa-plan agent model between glm-5.3 (peak hours) and deepseek-v4-pro (off-peak).
# Peak hours: 01:00-04:00 + 06:00-10:00 UTC Mon-Fri.
# Covers OpenCode (.opencode/agents/) and Codex (.codex/agents/).
# Zero LLM tokens — pure filesystem operation.
# Cross-platform: Linux, macOS (BSD sed), Git Bash on Windows.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

AGENT_FILES=(
  "$REPO_ROOT/.opencode/agents/qa-plan.md"
  "$REPO_ROOT/.codex/agents/qa-plan.md"
)

HOUR=$(date -u +%H)
DOW=$(date -u +%u)  # 1=Mon, 7=Sun

is_peak() {
  local h=$1 d=$2
  (( d > 5 )) && return 1
  (( h >= 1 && h < 4 )) && return 0
  (( h >= 6 && h < 10 )) && return 0
  return 1
}

if is_peak "$HOUR" "$DOW"; then
  TARGET_MODEL="opencode-go/glm-5.3"
else
  TARGET_MODEL="opencode-go/deepseek-v4-pro"
fi

# Cross-platform sed in-place: BSD sed (macOS) needs space between -i and extension,
# GNU sed (Linux/Git Bash) treats -i.bak as one arg. Detect and handle both.
sed_inplace() {
  local expr=$1 file=$2
  if sed --version 2>/dev/null | grep -q 'GNU'; then
    sed -i "$expr" "$file"
  else
    sed -i '' "$expr" "$file"
  fi
}

UPDATED=0
SKIPPED=0

for AGENT_FILE in "${AGENT_FILES[@]}"; do
  if [[ ! -f "$AGENT_FILE" ]]; then
    echo "WARN: $AGENT_FILE not found, skipping" >&2
    continue
  fi

  CURRENT_MODEL=$(sed -n 's/^[[:space:]]*model:[[:space:]]*//p' "$AGENT_FILE" | head -n1 || echo "unknown")

  if [[ "$CURRENT_MODEL" == "$TARGET_MODEL" ]]; then
    echo "OK: $(basename "$(dirname "$AGENT_FILE")")/qa-plan.md already on $TARGET_MODEL"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  sed_inplace "s|^[[:space:]]*model:.*|model: $TARGET_MODEL|" "$AGENT_FILE"
  echo "SWAPPED: $(basename "$(dirname "$AGENT_FILE")")/qa-plan.md $CURRENT_MODEL -> $TARGET_MODEL"
  UPDATED=$((UPDATED + 1))
done

echo "DONE: $UPDATED swapped, $SKIPPED unchanged (UTC $(date -u +%H:%M), dow=$DOW)"
