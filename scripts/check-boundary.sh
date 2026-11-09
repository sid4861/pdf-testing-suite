#!/bin/sh
# Verify @pdfsuite/spec stays a package the app only reaches through a barrel.
#
# History, because it explains the shape: the folder was once *sealed* — a
# mirror of a feature developed on one machine. Siddharth lifted that on
# 2026-11-03 (W-32 option B), and on 2026-11-06 the folder became
# `packages/spec`, a real npm workspace. What this file still protects is the
# part that was never about machines: three barrels are the contract, and the
# package must not scatter its CSS into the app's stylesheet.
#
# `scripts/check-packages.sh` covers the package graph; this covers the one
# package whose surface is a UI barrel, a headless barrel and a stylesheet.
#
# Run from the repo root:   sh scripts/check-boundary.sh
# Exit 0 = separable. Exit 1 = a crossing, printed.

FEAT="packages/spec/src"
fail=0

say() { printf '%s\n' "$1"; }
bad() { say "FAIL  $1"; fail=1; }

[ -d "$FEAT" ] || { say "FAIL  $FEAT is missing."; exit 1; }

# 1. Nothing outside the package may reach inside it. Three barrels are the
#    contract: `@pdfsuite/spec` for the app (React + CSS), `/engine` for a
#    headless caller, and `/cli` for the host's command loader. A path import
#    would also fail `check-packages.sh` rule 1; this names it in the terms
#    the package surface is written in.
hits=$(grep -rnE "(from|import\()[[:space:]]*'@pdfsuite/spec/" \
  --include='*.ts' --include='*.tsx' src packages 2>/dev/null \
  | grep -v "^$FEAT/" \
  | grep -vE "@pdfsuite/spec/(engine|cli|spec\.css)'" || true)
if [ -n "$hits" ]; then
  bad "something imports a subpath of @pdfsuite/spec that is not a barrel"
  say "      (allowed: @pdfsuite/spec, @pdfsuite/spec/engine, @pdfsuite/spec/cli)"
  printf '%s\n' "$hits"
fi

# 2. The package may import its own folder and its declared dependencies, and
#    nothing else — in particular nothing in `src/`, which is the app that
#    depends on *it*. `@pdfsuite/cli` is there for types only (W-30).
#    `node:` builtins are allowed because the CLI barrel reads and writes files;
#    `../` stays inside the package, which rule 1 already covers.
ALLOWED='react|react-dom|zustand|pdfjs-dist|jszip|@sheetpane/|@pdfsuite/core|@pdfsuite/cli|node:|\.\./'
hits=$(grep -rn "from '" "$FEAT" --include='*.ts' --include='*.tsx' \
  | grep -v "from '\./" | grep -vE "from '($ALLOWED)" || true)
if [ -n "$hits" ]; then
  bad "the feature imports something outside its allow-list:"
  printf '%s\n' "$hits"
fi

# 3. Feature-owned CSS must not appear in the shared stylesheet, and the shared
#    classes the package only reads must not be redefined inside it.
#
#    The shared stylesheet moved with the screens: it is `@pdfsuite/ui`'s now
#    (W-33), not the app's.
SHARED_CSS="packages/ui/src/styles.css"
hits=$(grep -nE '^\s*\.(sp-|spec-|target-|remap-note)' "$SHARED_CSS" || true)
if [ -n "$hits" ]; then
  bad "spec-owned selectors are defined in the shared stylesheet:"
  printf '%s\n' "$hits"
fi
hits=$(grep -nE '^\s*\.(card|btn|slot|tabs|chip|empty-state|upload-row|spinner)\s*\{' "$FEAT/spec.css" || true)
if [ -n "$hits" ]; then
  bad "the feature redefines a shared component class (read-only contract):"
  printf '%s\n' "$hits"
fi

# 4. No file may live in both halves. A spec file left behind in the app is
#    the shape a bad merge takes — and `src/features/spec/` is now one of
#    those places, because that is where this package used to be.
for stray in src/features/spec src/services/specCheck.ts src/services/specExport.ts \
             src/services/sheetRead.ts src/services/sheetSpec.ts src/store/specStore.ts \
             src/components/spec; do
  [ -e "$stray" ] && bad "$stray belongs in packages/spec; it is part of @pdfsuite/spec."
done

if [ "$fail" -eq 0 ]; then
  say "OK  @pdfsuite/spec and the app are separable."
  say "    package: $(find "$FEAT" -type f | wc -l | tr -d ' ') files · barrels: index, engine, cli"
fi
exit $fail
