#!/usr/bin/env bash
# Switchboard subagent status line.
#
# Shows each running Switchboard sub-agent with its emoji in Claude Code's live
# subagent panel, e.g.:  🔥 developer-backend · running   🧪 testing-qa · running
#
# This is OPTIONAL and opt-in. To enable it, point "subagentStatusLine" in your
# own Claude Code settings at this script (see docs/install.md). The shipped
# plugin does not turn it on by default.
#
# Contract: Claude Code invokes the status-line command with a JSON object on
# stdin that includes a "tasks" array (one entry per running sub-agent, each with
# at least "name" and "status"). This script reads that and prints one line.
# Requires: jq. On any error or if jq is missing, it prints nothing (harmless).

set -o pipefail

emoji_for() {
  case "${1##*:}" in            # strip any "plugin:" prefix on the agent name
    architect)          printf '🏛️'  ;;
    business-analyst)   printf '🔮'  ;;
    designer)           printf '🎨'  ;;
    developer-backend)  printf '🔥'  ;;
    developer-frontend) printf '🔨'  ;;
    reviewer-code)      printf '⚖️'  ;;
    reviewer-security)  printf '🛡️'  ;;
    testing-qa)         printf '🧪'  ;;
    testing-pentester)  printf '⚡'  ;;
    testing-red-team)   printf '💀'  ;;
    writer-technical)   printf '📜'  ;;
    release-manager)    printf '📯'  ;;
    loki)               printf '🎭'  ;;
    *)                  printf '•'   ;;
  esac
}

input="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

printf '%s' "$input" \
  | jq -r '.tasks[]? | [(.name // "agent"), (.status // "")] | @tsv' 2>/dev/null \
  | while IFS=$'\t' read -r name status; do
      [ -n "$name" ] || continue
      printf '%s %s' "$(emoji_for "$name")" "${name##*:}"
      [ -n "$status" ] && printf ' · %s' "$status"
      printf '   '
    done
