#!/bin/sh
# Verify the workspace packages stay packages.
#
# A package is only a package while everyone talks to it by name. The moment
# one import says `../../packages/core/src/pdfCompare`, the name is decoration:
# the file can be renamed and nothing warns, the published tarball can omit it
# and nothing notices, and the dependency graph in SR-NPM-PACKAGES stops being
# true. This is the executable form of SR-NPM-PACKAGES decisions 1 and 2.
#
# Run from the repo root:   sh scripts/check-packages.sh
# Exit 0 = the packages hold. Exit 1 = a crossing, printed.

set -eu

fail=0
bad() { printf '\nFAIL  %s\n' "$1" >&2; fail=1; }
say() { printf '%s\n' "$1"; }

PKGS=$(ls -d packages/*/ 2>/dev/null | sed 's#packages/##; s#/##' || true)
[ -n "$PKGS" ] || { say 'No packages yet.'; exit 0; }

# 1. Nobody reaches into a package by path. The package name is the only door,
#    and that includes one package reaching into another.
hits=$(grep -rn "from '[^']*packages/" \
  --include='*.ts' --include='*.tsx' --include='*.mjs' \
  src packages 2>/dev/null || true)
if [ -n "$hits" ]; then
  bad 'something imports a package by path instead of by name:'
  printf '%s\n' "$hits"
fi

# 2. A package may not import the app. The dependency runs one way — the app
#    and the CLI depend on the packages, never the reverse (decision 2).
#
#    One `../` never leaves a package, so only two or more are a crossing.
#    **There are no allowances left.** `src/features/spec/engine` went with
#    **W-32** and `src/services/export*` with **W-33**, which moved the
#    screens and their services into `@pdfsuite/ui`. The app now depends on
#    the packages and nothing depends on the app, which is what decision 2
#    always said. An allowance added here needs an item to retire it.
ALLOWED_INTO_APP="^$"
hits=$(grep -rnE "from '(\.\./){2,}src/" packages --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -vE "$ALLOWED_INTO_APP" || true)
if [ -n "$hits" ]; then
  bad 'a package imports the application:'
  printf '%s\n' "$hits"
  say '      (there are no allowances left — the app depends on the packages, never the reverse)'
fi

# 3. Every package declares the @pdfsuite packages it imports, so `npm ls`
#    tells the truth and a published package installs what it needs.
for p in $PKGS; do
  manifest="packages/$p/package.json"
  [ -f "$manifest" ] || { bad "packages/$p has no package.json"; continue; }
  used=$(grep -rho "from '@pdfsuite/[a-z]*'" "packages/$p/src" 2>/dev/null \
    | sed "s/from '//; s/'//" | sort -u || true)
  for dep in $used; do
    grep -q "\"$dep\"" "$manifest" || bad "packages/$p imports $dep and does not depend on it"
  done
done

# 4. One version across the workspace (decision 1: one version, published
#    together). A package left behind at an older number is a package nobody
#    can reason about.
versions=$(for p in $PKGS; do
  sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "packages/$p/package.json" | head -1
done | sort -u)
count=$(printf '%s\n' "$versions" | wc -l | tr -d ' ')
if [ "$count" != "1" ]; then
  bad "the packages are at different versions: $(printf '%s ' $versions)"
fi

# 5. pdfjs-dist is pinned exactly, everywhere it is named. Two pdf.js builds in
#    one install is two renderers, which is the one thing a comparison tool
#    cannot have — it cost a green suite once already.
hits=$(grep -rn '"pdfjs-dist": "[\^~]' package.json packages/*/package.json 2>/dev/null || true)
if [ -n "$hits" ]; then
  bad 'pdfjs-dist must be pinned exactly, not by range:'
  printf '%s\n' "$hits"
fi

# 6. The host does not depend on a command package (decision 3, W-30).
#    `pdfsuite compare` exists because `@pdfsuite/compare` is installed, not
#    because the host was built with it. The moment `packages/cli/src` imports
#    it, that stops being true and nothing else notices: the workspace would
#    still build, the command would still run here, and a published `cli`
#    would carry a copy of compare that a user's install can never update.
hits=$(grep -rn "from '@pdfsuite/\(compare\|spec\)" packages/cli/src \
  --include='*.ts' 2>/dev/null || true)
if [ -n "$hits" ]; then
  bad 'the CLI host imports a command package instead of loading it:'
  printf '%s\n' "$hits"
  say '      (it may import their *types*; everything else arrives through HostApi)'
fi

if [ "$fail" = "0" ]; then
  say "OK  the packages hold."
  say "    $(printf '%s ' $PKGS)· one version · pdfjs pinned · the host hosts"
fi
exit "$fail"
