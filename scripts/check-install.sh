#!/bin/sh
# W-30 DoD 5, W-32 DoD 4 — does an install give the commands SR-NPM-PACKAGES §1 promises?
#
# Everything else about W-30 can be checked inside the workspace, where every
# package is a symlink and every import resolves because the repository is
# laid out that way. None of that is what a user gets. The two facts this
# whole item rests on only exist across a real install:
#
#   * a **local** install links a dependency's bin into `node_modules/.bin`,
#     so `npm i @pdfsuite/compare` is what puts `npx pdfsuite` in a project;
#   * a **global** install links only the top package's own bin, which is the
#     entire reason `pdfsuite-compare` and `pdfsuite-spec` exist (decision 4).
#
# So this packs the tarballs and installs them twice: into a fresh project and
# into a fresh global prefix. It asserts the table in §1 — what you run, what
# you get — and nothing else.
#
# It is not in the hooks. It downloads pdf.js and a native canvas build from
# the registry and takes minutes; it is run before publishing, and whenever
# anything about a package's `bin`, `exports` or `files` changes.
#
#   sh scripts/check-install.sh          — pack, install, assert, clean up
#   KEEP=1 sh scripts/check-install.sh   — leave the sandbox for poking at

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SANDBOX=$(mktemp -d 2>/dev/null || mktemp -d -t pdfsuite-install)
TARBALLS="$SANDBOX/tarballs"
PROJECT="$SANDBOX/project"
GLOBAL="$SANDBOX/global"

pass=0
fail=0
ok() {
  if [ "$2" = "0" ]; then
    pass=$((pass + 1)); printf '  OK    %s\n' "$1"
  else
    fail=$((fail + 1)); printf '  FAIL  %s\n' "$1"
  fi
}
section() { printf '\n  %s\n\n' "$1"; }

cleanup() {
  if [ "${KEEP:-}" = "1" ]; then
    printf '\n  sandbox kept: %s\n' "$SANDBOX"
  else
    rm -rf "$SANDBOX"
  fi
}
trap cleanup EXIT

printf '\n  pdfsuite — what an install gives you (W-30 DoD 5)\n'
printf '  sandbox: %s\n' "$SANDBOX"

# ── pack ─────────────────────────────────────────────────────────────
# Every package in the dependency closure, because none of them is published
# yet: `compare` needs `cli` and `core`, and `cli` needs `core` and `agents`.
section 'npm pack'

mkdir -p "$TARBALLS"
for p in core agents cli compare spec; do
  (cd "$ROOT/packages/$p" && npm pack --pack-destination "$TARBALLS" >/dev/null 2>&1) \
    || { printf '  FAIL  could not pack %s\n' "$p"; exit 1; }
  printf '  packed %s\n' "$p"
done

tgz() { ls "$TARBALLS"/pdfsuite-"$1"-*.tgz | head -1; }

# The tarball is the contract. A `files` list that forgets the bundle is a
# package that installs and then cannot run its own command.
tar -tzf "$(tgz compare)" > "$SANDBOX/compare.list"
grep -q 'package/dist/cli.js' "$SANDBOX/compare.list"; ok 'compare ships dist/cli.js' $?
grep -q 'package/bin/pdfsuite-compare.mjs' "$SANDBOX/compare.list"; ok 'and its bin' $?
tar -tzf "$(tgz cli)" > "$SANDBOX/cli.list"
grep -q 'package/dist/index.js' "$SANDBOX/cli.list"; ok 'cli ships dist/index.js' $?
grep -q 'package/dist/pdf.worker.mjs' "$SANDBOX/cli.list"; ok 'and the pdf.js worker beside it' $?
grep -q 'package/src/host.ts' "$SANDBOX/cli.list"; ok 'and the host types a command package imports' $?
tar -tzf "$(tgz spec)" > "$SANDBOX/spec.list"
grep -q 'package/dist/cli.js' "$SANDBOX/spec.list"; ok 'spec ships dist/cli.js' $?
grep -q 'package/bin/pdfsuite-spec.mjs' "$SANDBOX/spec.list"; ok 'and its bin' $?
# The app imports `@pdfsuite/spec` as TypeScript through Vite, so the source
# and the stylesheet are part of the tarball, not just the CLI bundle.
grep -q 'package/src/index.ts' "$SANDBOX/spec.list"; ok 'and the UI barrel and stylesheet' $?
grep -q 'package/src/spec.css' "$SANDBOX/spec.list"; ok 'for a consumer that renders the tab' $?

# ── a fresh project ──────────────────────────────────────────────────
section 'npm i @pdfsuite/compare @pdfsuite/spec  — in a project'

mkdir -p "$PROJECT"
(cd "$PROJECT" && npm init -y >/dev/null 2>&1)
# Installed by file path, which is what `npm i @pdfsuite/compare` will do
# once these are published; npm resolves the @pdfsuite deps between them.
(cd "$PROJECT" && npm i --silent "$(tgz compare)" "$(tgz spec)" "$(tgz cli)" "$(tgz core)" "$(tgz agents)" >/dev/null 2>&1) \
  || { printf '  FAIL  install failed\n'; exit 1; }

[ -x "$PROJECT/node_modules/.bin/pdfsuite" ] || [ -f "$PROJECT/node_modules/.bin/pdfsuite" ]
ok 'installing compare puts `pdfsuite` in node_modules/.bin' $?

out=$(cd "$PROJECT" && npx pdfsuite --help 2>&1 || true)
printf '%s' "$out" | grep -q 'Compare one PDF against its golden'
ok '`npx pdfsuite --help` lists compare, loaded from its package' $?

# The command actually runs, against a PDF taken from the repository's
# fixtures — fictional, like every fixture here (SR-NPM-PACKAGES 13).
cp "$ROOT/packages/cli/fixtures/golden/invoice-original.pdf" "$PROJECT/a.pdf"
cp "$ROOT/packages/cli/fixtures/golden/invoice-original.pdf" "$PROJECT/b.pdf"
(cd "$PROJECT" && npx pdfsuite compare a.pdf b.pdf --out reports >"$SANDBOX/run.log" 2>&1)
ok '`npx pdfsuite compare a.pdf b.pdf --out reports` exits 0 on an unchanged pair' $?
[ -f "$PROJECT/reports/result.json" ] && [ -f "$PROJECT/reports/report.html" ] \
  && [ -f "$PROJECT/reports/manifest.json" ]
ok 'and writes the three files' $?

[ -f "$PROJECT/node_modules/.bin/pdfsuite-compare" ]
ok '`pdfsuite-compare` is linked locally too (it is compare’s own bin)' $?

out=$(cd "$PROJECT" && npx pdfsuite --help 2>&1 || true)
printf '%s' "$out" | grep -q 'Check one PDF against a spec workbook'
ok '`npx pdfsuite --help` lists spec, loaded from its package' $?

# `inspect` is a built-in of the host, so installing *anything* that brings
# the host brings it. This is the other half of decision 3, and the only
# place it is checked across a real install.
printf '%s' "$out" | grep -q 'Read one PDF and report every element'
ok '`inspect` is there too, built into the host' $?
(cd "$PROJECT" && npx pdfsuite inspect a.pdf --page 1 --out insp >>"$SANDBOX/run.log" 2>&1)
ok '`npx pdfsuite inspect a.pdf --page 1 --out insp` exits 0' $?
[ -f "$PROJECT/insp/result.json" ] && grep -q '"kind": "inspect"' "$PROJECT/insp/result.json"
ok 'and writes a result.json that says what kind of run it was' $?

# `--template` is the one spec run that needs no PDF and no workbook: it writes
# a blank Template v2 workbook. Enough to prove the command is wired through.
(cd "$PROJECT" && npx pdfsuite spec --template blank.xlsx >>"$SANDBOX/run.log" 2>&1)
ok '`npx pdfsuite spec --template blank.xlsx` exits 0' $?
[ -s "$PROJECT/blank.xlsx" ]
ok 'and writes a workbook to start a spec from' $?

# ── a fresh global prefix ────────────────────────────────────────────
section 'npm i -g @pdfsuite/compare @pdfsuite/spec  — on the PATH'

mkdir -p "$GLOBAL"
npm i -g --silent --prefix "$GLOBAL" "$(tgz compare)" "$(tgz spec)" "$(tgz cli)" "$(tgz core)" "$(tgz agents)" >/dev/null 2>&1 \
  || { printf '  FAIL  global install failed\n'; exit 1; }

# npm puts bins in <prefix>/bin on POSIX and directly in <prefix> on Windows.
GBIN="$GLOBAL/bin"
[ -d "$GBIN" ] || GBIN="$GLOBAL"

ls "$GBIN" | grep -q '^pdfsuite-compare'
ok '`pdfsuite-compare` reaches the PATH' $?

out=$(cd "$SANDBOX" && node "$GLOBAL/lib/node_modules/@pdfsuite/compare/bin/pdfsuite-compare.mjs" --help 2>&1 \
  || node "$GLOBAL/node_modules/@pdfsuite/compare/bin/pdfsuite-compare.mjs" --help 2>&1 || true)
printf '%s' "$out" | grep -q '\-\-each'
ok 'and it is the compare command, with its own flags' $?

ls "$GBIN" | grep -q '^pdfsuite-spec'
ok '`pdfsuite-spec` reaches the PATH' $?

out=$(cd "$SANDBOX" && node "$GLOBAL/lib/node_modules/@pdfsuite/spec/bin/pdfsuite-spec.mjs" --help 2>&1 \
  || node "$GLOBAL/node_modules/@pdfsuite/spec/bin/pdfsuite-spec.mjs" --help 2>&1 || true)
printf '%s' "$out" | grep -q '\-\-validate-only'
ok 'and it is the spec command, with its own flags' $?

printf '\n  %s/%s checks passed\n' "$pass" "$((pass + fail))"
[ "$fail" = "0" ] || exit 1
