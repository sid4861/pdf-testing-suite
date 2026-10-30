#!/usr/bin/env bash
# Validates every open item file, work/open/W-*.md, against SR-WORK-LIFECYCLE
# decisions 4a–4c and 4e: the file opens with `## At a glance`, its table
# carries the seven rows in order, its Status row agrees with the item's ball
# in work/OPEN-WORK.md and with its Definition-of-done table, and its front
# matter names the people (filed_by, updated, updated_by). Also
# SR-WORK-OPEN-QUEUE rule 14a: the queue row's `filed by` matches filed_by.
# This script states no rule of its own — the record does.
#
# Read-only. Exit 0, silent, when every file conforms; exit 1 with one line
# per defect on stdout otherwise.
#
#     bash scripts/check-work-items.sh            # every open item
#     bash scripts/check-work-items.sh FILE...    # just these
#
# POSIX awk only: it runs under macOS's awk as well as gawk.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 0
QUEUE=work/OPEN-WORK.md

if [ "$#" -gt 0 ]; then set -- "$@"; else set -- work/open/W-*.md; fi

PROG='
function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
function err(m)  { print FILENAME " — " m; bad = 1 }
BEGIN {
  nk = split("What|Why|Done when|Status|Waits on|Who|Record", K, "|")
  state = "front"; seen = 0; got = 0; trows = 0; dodrows = 0; done = 0; bad = 0
}
state == "front" && NR == 1 && $0 == "---" { infm = 1; next }
infm {
  if ($0 == "---") { infm = 0; next }
  i = index($0, ":")
  if (i > 0) { k = trim(substr($0, 1, i - 1)); v = trim(substr($0, i + 1)); gsub(/^"|"$/, "", v); FM[k] = v }
  next
}
state == "front" { if ($0 ~ /^# /) state = "title"; next }
state == "title" {
  if ($0 ~ /^[ \t]*$/) next
  if ($0 == "## At a glance") { state = "glance"; seen = 1; next }
  err("decision 4a: the first thing under the title must be `## At a glance` — found: " substr($0, 1, 60))
  state = "body"
}
state == "glance" {
  if ($0 ~ /^## /) { state = "body" }
  else if (!tdone && $0 ~ /^\|/) {
    trows++
    if (trows > 2) {
      n = split($0, c, "|"); key = trim(c[2]); gsub(/\*/, "", key); key = trim(key)
      got++; G[got] = key; V[key] = trim(c[3])
    }
    next
  }
  else { if (trows > 0) tdone = 1; next }
}
state == "body" && $0 == "## At a glance" { err("decision 4a: a second `## At a glance` — one per item"); next }
state == "body" && $0 ~ /^## / { indod = ($0 == "## Definition of done"); dodt = 0; next }
state == "body" && indod {
  if ($0 ~ /^\|/) {
    dodt++
    if (dodt > 2) {
      dodrows++
      n = split($0, c, "|"); last = ""
      for (i = n; i >= 1; i--) { t = trim(c[i]); if (t != "") { last = t; break } }
      if (index(last, "✅") > 0) done++
    }
  } else if (dodt > 0) indod = 0
}
END {
  # decision 4e — the people in the front matter
  for (j = 1; j <= 3; j++) {
    k = (j == 1 ? "filed_by" : (j == 2 ? "updated" : "updated_by"))
    if (FM[k] == "") err("decision 4e: the front matter has no `" k ":`")
  }
  for (j = 1; j <= 2; j++) {
    k = (j == 1 ? "filed_by" : "updated_by"); v = tolower(FM[k])
    if (v != "" && (v ~ /claude|opus|sonnet|haiku|cowork|agent|model|gpt|</ ))
      err("decision 4e: `" k ": " FM[k] "` must name a person, not a model, a surface or a placeholder")
  }
  if (FM["updated"] != "" && FM["updated"] !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/)
    err("decision 4e: `updated:` must be YYYY-MM-DD")
  else if (FM["updated"] != "" && FM["filed"] != "" && FM["updated"] < FM["filed"])
    err("decision 4e: `updated: " FM["updated"] "` is earlier than `filed: " FM["filed"] "`")
  # SR-WORK-OPEN-QUEUE rule 14a — the queue row repeats filed_by
  if (row != "") {
    pf = index(row, "filed by ")
    if (pf == 0) err("SR-WORK-OPEN-QUEUE rule 14a: the OPEN-WORK row for " id " does not say `filed by <name>`")
    else {
      r = substr(row, pf + 9); cut = length(r) + 1
      q = index(r, " — "); if (q > 0 && q < cut) cut = q
      q = index(r, " · "); if (q > 0 && q < cut) cut = q
      rf = trim(substr(r, 1, cut - 1))
      if (FM["filed_by"] != "" && rf != FM["filed_by"])
        err("SR-WORK-OPEN-QUEUE rule 14a: the OPEN-WORK row says `filed by " rf "` but `filed_by:` is `" FM["filed_by"] "`")
    }
  }
  if (!seen) { if (!bad) err("decision 4a: no `## At a glance` section"); exit 1 }
  if (trows < 3) { err("decision 4b: `## At a glance` has no table"); exit 1 }
  order = ""; want = ""
  for (i = 1; i <= nk; i++) want = want (i > 1 ? " · " : "") K[i]
  for (i = 1; i <= got; i++) order = order (i > 1 ? " · " : "") G[i]
  if (order != want) err("decision 4b: the glance rows must be exactly `" want "` — found `" order "`")
  s = V["Status"]
  if (s == "") { exit bad }
  sb = ""
  split("🔴 🟣 🟡 🟢", B, " ")
  for (i = 1; i <= 4; i++) if (index(s, B[i]) == 1) sb = B[i]
  if (sb == "") err("decision 4c: the Status row must open with the item ball (🔴 🟣 🟡 🟢)")
  else if (ball != "" && sb != ball) err("decision 4c: the Status ball is " sb " but the OPEN-WORK row for " id " says " ball)
  if (dodrows == 0) err("decision 4c: no `## Definition of done` table to count")
  else if (!match(s, /[0-9]+ of [0-9]+ DoD done/)) err("decision 4c: the Status row must say `N of M DoD done`")
  else {
    frag = substr(s, RSTART, RLENGTH); split(frag, P, " ")
    if (P[1] + 0 != done || P[3] + 0 != dodrows)
      err("decision 4c: Status says `" frag "` but the Definition of done has " done " of " dodrows " rows ✅")
  }
  exit bad
}'

rc=0
for f in "$@"; do
  [ -f "$f" ] || continue
  id=$(basename "$f" | grep -oE '^W-[0-9]+' || true)
  ball=""; row=""
  if [ -n "$id" ] && [ -f "$QUEUE" ]; then
    row=$(grep -E "^- .*\*\*$id\*\*" "$QUEUE" | head -1)
    ball=$(printf '%s\n' "$row" | awk '{print $2}')
  fi
  awk -v id="$id" -v ball="$ball" -v row="$row" "$PROG" "$f" || rc=1
done
exit $rc
