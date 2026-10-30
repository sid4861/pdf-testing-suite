#!/usr/bin/env bash
# sr-guard — refuse a commit that changes an SR-owned component without
# touching its OWNING record (and every DESCRIBING record). The rule is
# SR-WORK-OWNERSHIP decisions 3 and 6; this is its executable form.
#
# Install as a `commit-msg` hook, not `pre-commit`: the escape hatch has to be
# read from the commit message, which does not exist at pre-commit time.
#
#     ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg
#
# Escape hatch, on its own line of the commit message:
#     no SR affected
#
# That is a claim written into git history under your name, not a silent skip.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
REGISTER="$ROOT/records/README.md"
[ -f "$REGISTER" ] || exit 0

staged="$(git --no-optional-locks diff --cached --name-only)"
[ -n "$staged" ] || exit 0

msg_file="${1:?sr-guard.sh must run as a commit-msg hook with the message file as \$1}"
[ -f "$msg_file" ] || exit 0

# SR-WORK-LIFECYCLE decisions 4a–4c: an open item file must not land without
# its At-a-glance table. Checked before the escape hatch — `no SR affected` is a
# claim about ownership, not about this. The rule lives in that record.
if grep -qE '^work/(open/W-[0-9]+-[^/]*\.md|OPEN-WORK\.md)$' <<<"$staged"; then
  if ! glance="$(bash "$ROOT/scripts/check-work-items.sh")"; then
    printf '\n  Item-file check (SR-WORK-LIFECYCLE decisions 4a–4c):\n%s\n\n' "$glance" >&2
    exit 1
  fi
fi

if grep -qiE '^[[:space:]]*(no[ -]sr[ -]affected|\[no-sr\])[[:space:]]*$' "$msg_file"; then
  exit 0
fi

# component<TAB>owner from the Ownership table, most specific component first.
table() {
  awk -F'|' -v start="$1" -v end="$2" '
    index($0, start) { on=1; next }
    index($0, end)   { on=0 }
    on && /^\|/ {
      comp=$2; owner=$3
      gsub(/[` \t]/, "", comp); gsub(/[*` \t]/, "", owner)
      sub(/::.*$/, "", comp); sub(/\/$/, "", comp)
      if (comp != "" && comp != "component" && comp !~ /^-+$/) print comp "\t" owner
    }
  ' "$REGISTER" | awk -F'\t' '{ print length($1), $0 }' | sort -rn | cut -d" " -f2-
}
owned="$(table '<!-- OWNERSHIP-TABLE-START -->' '<!-- OWNERSHIP-TABLE-END -->')"
described="$(table '<!-- DESCRIBES-TABLE-START -->' '<!-- DESCRIBES-TABLE-END -->')"

# SR-NAME<TAB>filename from the register table.
names="$(grep -oE '\[[0-9]{4}\]\([^)]*\) \| \*\*SR-[A-Z0-9-]+\*\*' "$REGISTER" | \
  sed -E 's/\[[0-9]{4}\]\(([^)]*)\) \| \*\*(SR-[A-Z0-9-]+)\*\*/\2\t\1/')"

resolve() {  # owner name -> repo-relative record path, or empty
  local owner="$1" record=""
  if [[ "$owner" == SR-* ]]; then
    while IFS=$'\t' read -r name link; do
      [ "$name" = "$owner" ] || continue
      case "$link" in */*) ;; *) record="records/$link" ;; esac
      break
    done <<<"$names"
  elif [[ "$owner" =~ ^W-[0-9]+$ ]]; then
    for cand in "$ROOT"/work/open/"$owner"-*.md; do
      [ -f "$cand" ] || continue
      record="work/open/$(basename "$cand")"; break
    done
  fi
  printf '%s' "$record"
}

hits=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  # the owner: first (most specific) match
  owner=""
  while IFS=$'\t' read -r p o; do
    [ -n "$p" ] || continue
    case "$f" in "$p"|"$p"/*) owner="$o"; break ;; esac
  done <<<"$owned"
  demanded=""
  [ -n "$owner" ] && demanded="$owner"
  # every describer
  while IFS=$'\t' read -r p o; do
    [ -n "$p" ] || continue
    case "$f" in "$p"|"$p"/*) demanded="$demanded"$'\n'"$o" ;; esac
  done <<<"$described"
  [ -n "$demanded" ] || continue
  while IFS= read -r who; do
    [ -n "$who" ] || continue
    record="$(resolve "$who")"
    [ -n "$record" ] || continue
    if ! grep -qxF "$record" <<<"$staged"; then
      hits="$hits  $f -> $who, whose record is $record (not staged)"$'\n'
    fi
  done <<<"$demanded"
done <<<"$staged"

if [ -n "$hits" ]; then
  cat >&2 <<MSG

  SR guard: this commit changes an SR-owned or SR-described component and
  does not update the record that owns or describes it.

$hits
  Either update that record and stage it in this same commit, or say so in
  the commit message, on its own line:

      no SR affected

  Saying so explicitly is the rule. Skipping silently is not.

MSG
  exit 1
fi
exit 0
