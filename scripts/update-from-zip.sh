#!/bin/sh
# Refresh everything EXCEPT the spec feature from a GitHub zip.
#
# Run this on the machine that works on src/features/spec/ and cannot push.
# Work flows one way — the other machine pushes to GitHub, you download a zip —
# so this takes the whole repository from that zip while leaving your spec
# folder exactly as it is. That folder is the only copy of your work: it is
# copied to .spec-backup/ before anything is touched, and never overwritten.
#
#   sh scripts/update-from-zip.sh ~/Downloads/pdf-testing-suite-main.zip
#
# Prints the plan and changes nothing. Add --yes to carry it out.
# On Windows, run it from Git Bash.

set -e

# Run from a copy in a temp directory, so this file is closed by the time the
# working copy is cleared. Windows holds a lock on an open script, which makes
# `scripts/` neither movable nor overwritable while it is being read from here.
if [ "${PDFSUITE_RELOCATED:-}" != "1" ]; then
  RTMP=$(mktemp -d) || { printf 'STOP  could not make a temporary directory.\n' >&2; exit 1; }
  cp "$0" "$RTMP/update-from-zip.sh"
  PDFSUITE_RELOCATED=1 PDFSUITE_RTMP="$RTMP" export PDFSUITE_RELOCATED PDFSUITE_RTMP
  exec sh "$RTMP/update-from-zip.sh" "$@"
fi

ZIP="$1"
GO="$2"
FEAT="src/features/spec"
BACKUP=".spec-backup/$(date +%Y%m%d-%H%M%S)"

# Restored after the refresh: your feature, your packages, your local config.
PROTECT="$FEAT node_modules .git flag.env .spec-backup packages/cli/node_modules packages/cli/.work"

die() { printf 'STOP  %s\n' "$1" >&2; exit 1; }

[ -n "$ZIP" ] || die "give me the downloaded zip:  sh scripts/update-from-zip.sh <zip> [--yes]"
[ -f "$ZIP" ] || die "no such file: $ZIP"
[ -f package.json ] || die "run this from the repository root (no package.json here)."
[ -d "$FEAT" ] || die "$FEAT is missing. Wrong directory, or the feature is already gone — stopping rather than guessing."
command -v unzip >/dev/null 2>&1 || die "unzip is not on PATH. On Windows, run this from Git Bash."

TMP=$(mktemp -d) || die "could not make a temporary directory."
trap 'rm -rf "$TMP" "$PDFSUITE_RTMP" 2>/dev/null || true' EXIT

unzip -q "$ZIP" -d "$TMP" || die "could not unpack $ZIP"

# GitHub wraps the tree in one directory, e.g. pdf-testing-suite-main/.
ROOT=""
for candidate in "$TMP"/*/package.json "$TMP"/package.json; do
  [ -f "$candidate" ] && { ROOT=$(dirname "$candidate"); break; }
done
[ -n "$ROOT" ] || die "that zip has no package.json at its root — is it the repository?"
[ -d "$ROOT/src" ] || die "that zip has no src/ — is it the repository?"

ZIPFILES=$(find "$ROOT" -type f | wc -l | tr -d ' ')
MYFILES=$(find "$FEAT" -type f | wc -l | tr -d ' ')

printf '\n'
printf 'FROM   %s\n' "$ZIP"
printf 'INTO   %s\n' "$(pwd)"
printf '\n'
printf 'Yours, kept untouched:\n'
for k in $PROTECT; do [ -e "$k" ] && printf '  %s\n' "$k"; done
printf '\n'
printf 'Replaced from the zip: everything else (%s files).\n' "$ZIPFILES"
printf 'Backed up first: %s → %s (%s files)\n' "$FEAT" "$BACKUP" "$MYFILES"
printf '\n'

if [ "$GO" != "--yes" ]; then
  printf 'Nothing changed. Re-run with --yes to carry this out.\n\n'
  exit 0
fi

# 1. Back up the one copy of the spec work, before anything else happens.
mkdir -p "$BACKUP"
cp -R "$FEAT/." "$BACKUP/"
printf 'backed up    %s\n' "$BACKUP"

# 2. Hold everything that must survive the wipe.
HOLD="$TMP/hold"
for k in $PROTECT; do
  [ -e "$k" ] || continue
  mkdir -p "$HOLD/$(dirname "$k")"
  mv "$k" "$HOLD/$k"
done

# 3. Clear what is left. Anything here now either comes back from the zip or
#    was deleted upstream and should not linger.
find . -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true

# 4. Lay down the zip, then drop its copy of the spec feature: yours is newer
#    by definition, because that work never travels in this direction.
cp -R "$ROOT/." .
rm -rf "$FEAT"

# 5. Put your paths back.
for k in $PROTECT; do
  [ -e "$HOLD/$k" ] || continue
  mkdir -p "$(dirname "$k")"
  rm -rf "$k"
  mv "$HOLD/$k" "$k"
done

printf 'restored     %s\n' "$FEAT"
printf '\n'
if [ ! -f scripts/update-from-zip.sh ]; then
  printf 'NOTE  the zip has no scripts/update-from-zip.sh, so this script is gone\n'
  printf '      from the working copy. Keep a copy outside it.\n\n'
fi
printf 'Now:\n'
printf '  npm install                     # if package.json changed\n'
printf '  sh scripts/check-boundary.sh\n'
printf '  npm run build\n'
printf '\n'
printf 'If the build now fails inside %s, the app side changed something the\n' "$FEAT"
printf 'feature depends on. The allow-list is in %s/README.md.\n' "$FEAT"
printf 'Your previous copy is in %s if you need it back.\n\n' "$BACKUP"
