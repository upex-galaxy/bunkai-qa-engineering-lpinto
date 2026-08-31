#!/usr/bin/env bash
# Add to .bashrc / .zshrc / Git Bash profile to auto-toggle qa-plan model.
# Checks every 5 minutes while terminal is open. Dies with the terminal.
# Usage: source /path/to/qa-model-toggle-init.sh
#
# One-liner to install:
#   echo 'source "/path/to/repo/scripts/qa-model-toggle-init.sh"' >> ~/.bashrc

_REPO_TOGGLE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/toggle-qa-plan-model.sh"

if [[ -f "$_REPO_TOGGLE_SCRIPT" ]]; then
  # Run once immediately on shell open
  bash "$_REPO_TOGGLE_SCRIPT" 2>/dev/null &

  # Then check every 5 min in background
  (
    while true; do
      sleep 300
      bash "$_REPO_TOGGLE_SCRIPT" 2>/dev/null
    done
  ) &
  disown
fi

unset _REPO_TOGGLE_SCRIPT
