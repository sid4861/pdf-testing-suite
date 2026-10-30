#!/usr/bin/env bash
# PostToolUse(Write|Edit|MultiEdit|NotebookEdit|Bash) — catches an open item
# file that does not open with its At-a-glance table, or whose Status row has
# drifted from the queue or its DoD, the moment a session writes it.
# The rule is SR-WORK-LIFECYCLE decisions 4a–4c — stated once there, NOT here.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -f scripts/check-work-items.sh ] || exit 0

REASON=$(bash scripts/check-work-items.sh 2>/dev/null | head -5 | tr '\n' ';')
[ -z "$REASON" ] && exit 0

jq -n --arg r "$REASON" '{hookSpecificOutput:{hookEventName:"PostToolUse",decision:"block",
  reason:($r + " — fix the item file to match SR-WORK-LIFECYCLE decisions 4a–4c (template: work/open/README.md) before continuing.")}}'
exit 0
