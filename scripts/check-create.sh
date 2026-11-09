#!/bin/sh
# W-31 DoD 6 — does `npm create @pdfsuite` give somebody a working app?
#
# Everything else about W-31 can be checked by reading a plan. None of that is
# what a user gets. Three things only exist across a real install:
#
#   * a created app **builds** against the published packages, not against
#     this workspace's symlinks;
#   * add mode leaves somebody's project **byte-identical** apart from the one
#     file it is allowed to touch — which is checked here by hashing the whole
#     tree before and after;
#   * `npx pdfsuite compare` works inside both, because the command line
#     arrives with `@pdfsuite/compare`.
#
# It packs every package and installs from the tarballs, so nothing here can
# accidentally resolve through the workspace.
#
# Not in the hooks: it runs several npm installs and takes minutes. Run it
# before publishing, and whenever `create`, a template, or any package's
# `files`/`exports` changes.
#
#   sh scripts/check-create.sh          — pack, create, build, assert, clean up
#   KEEP=1 sh scripts/check-create.sh   — leave the sandbox for poking at

set -u
# NOT `set -e`: almost every line here is a measurement whose failure must be
# reported by `ok`, not fatal. The few genuinely fatal steps exit explicitly.

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SANDBOX=$(mktemp -d 2>/dev/null || mktemp -d -t pdfsuite-create)
TARBALLS="$SANDBOX/tarballs"
NEWAPP="$SANDBOX/new-app"
EXISTING="$SANDBOX/existing-app"

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

printf '\n  npm create @pdfsuite — what somebody actually gets (W-31)\n'
printf '  sandbox: %s\n' "$SANDBOX"

# ── pack ─────────────────────────────────────────────────────────────
section 'npm pack'

mkdir -p "$TARBALLS"
for p in core agents cli compare spec ui create; do
  (cd "$ROOT/packages/$p" && npm pack --pack-destination "$TARBALLS" >/dev/null 2>&1) \
    || { printf '  FAIL  could not pack %s\n' "$p"; exit 1; }
  printf '  packed %s\n' "$p"
done

tgz() { ls "$TARBALLS"/pdfsuite-"$1"-*.tgz | head -1; }
ALL="$(tgz core) $(tgz agents) $(tgz cli) $(tgz compare) $(tgz spec) $(tgz ui)"

tar -tzf "$(tgz create)" > "$SANDBOX/create.list"
grep -q 'package/dist/index.js' "$SANDBOX/create.list"; ok 'create ships its built entry' $?
grep -q 'package/bin/create-pdfsuite.mjs' "$SANDBOX/create.list"; ok 'and its bin' $?
tar -tzf "$(tgz ui)" > "$SANDBOX/ui.list"
grep -q 'package/src/styles.css' "$SANDBOX/ui.list"; ok 'ui ships its stylesheet' $?
grep -q 'package/src/PdfSuiteApp.tsx' "$SANDBOX/ui.list"; ok 'and the component a shell mounts' $?

CREATE_DIR="$SANDBOX/create-pkg"
mkdir -p "$CREATE_DIR"
tar -xzf "$(tgz create)" -C "$CREATE_DIR"
CREATE_BIN="$CREATE_DIR/package/bin/create-pdfsuite.mjs"

# ── a new app ────────────────────────────────────────────────────────
section 'an empty directory — a whole app'

mkdir -p "$NEWAPP"
(cd "$NEWAPP" && node "$CREATE_BIN" . >"$SANDBOX/new.log" 2>&1) && r=0 || r=$?
ok 'create runs and exits 0' "$r"

for f in package.json index.html vite.config.ts tsconfig.json src/main.tsx src/pdfsuite.config.ts .pdfsuite/installed.json; do
  [ -f "$NEWAPP/$f" ]; ok "it wrote $f" $?
done

# The shell must stay a shell: a component written here could never be
# delivered to this app later by `npm update` (L4 decision 5).
count=$(find "$NEWAPP/src" -name '*.tsx' | wc -l | tr -d ' ')
[ "$count" = "1" ]; ok 'src/ holds exactly one .tsx — the entry point' $?
grep -q '@pdfsuite/ui' "$NEWAPP/src/main.tsx"; ok 'which mounts PdfSuiteApp from the package' $?

# Installed from the tarballs, so nothing resolves through this workspace.
(cd "$NEWAPP" && npm i --silent $ALL >>"$SANDBOX/new.log" 2>&1 && npm i --silent >>"$SANDBOX/new.log" 2>&1) && r=0 || r=$?
ok 'npm install succeeds from the packed packages' "$r"

(cd "$NEWAPP" && npm run build >>"$SANDBOX/new.log" 2>&1) && r=0 || r=$?
ok 'npm run build succeeds — the app compiles and bundles' "$r"
[ "$r" = "0" ] || tail -25 "$SANDBOX/new.log"
[ -f "$NEWAPP/dist/index.html" ]; ok 'and produces dist/index.html' $?

# Every tab's code has to be in the bundle, or the app builds and shows three
# empty tabs. Grepping the output is crude and it is also exactly the failure
# worth catching.
BUNDLE=$(cat "$NEWAPP"/dist/assets/*.js 2>/dev/null | tr -d '\n')
printf '%s' "$BUNDLE" | grep -q 'Spec driven comparison'; ok 'the bundle contains the Spec tab' $?
printf '%s' "$BUNDLE" | grep -q 'Inspect'; ok 'and the Inspect tab' $?

[ -x "$NEWAPP/node_modules/.bin/pdfsuite" ] || [ -f "$NEWAPP/node_modules/.bin/pdfsuite" ]
ok '`pdfsuite` is on the project PATH — it arrived with compare' $?

cp "$ROOT/packages/cli/fixtures/golden/invoice-original.pdf" "$NEWAPP/a.pdf"
cp "$ROOT/packages/cli/fixtures/golden/invoice-original.pdf" "$NEWAPP/b.pdf"
(cd "$NEWAPP" && npx pdfsuite compare a.pdf b.pdf --out reports >>"$SANDBOX/new.log" 2>&1) && r=0 || r=$?
ok '`npx pdfsuite compare` runs in the created app and exits 0' "$r"
[ -f "$NEWAPP/reports/result.json" ]; ok 'and writes result.json' $?

# ── an app somebody already has ──────────────────────────────────────
section 'a React app — added, not merged'

mkdir -p "$EXISTING/src/components"
cat > "$EXISTING/package.json" <<'JSON'
{
    "name": "someones-app",
    "private": true,
    "version": "4.2.0",
    "scripts": { "build": "echo built" },
    "dependencies": {
        "react": "^18.3.1",
        "react-dom": "^18.3.1"
    }
}
JSON
printf 'export default function App() { return <div>mine</div>; }\n' > "$EXISTING/src/App.tsx"
printf 'body { color: rebeccapurple }\n' > "$EXISTING/src/app.css"
printf '# Our app\n' > "$EXISTING/README.md"
printf 'export const X = 1;\n' > "$EXISTING/src/components/thing.ts"

# Hash every file before, so "nothing of yours changed" is measured.
# `sha256sum` writes `hash *path` in binary mode here, so the `*` is stripped
# before anything is compared — otherwise every path differs from itself.
hashtree() {
  ( cd "$1" && find . -type f | sort | xargs sha256sum ) 2>/dev/null \
    | awk '{ sub(/^[*]/, "", $2); print $1, $2 }'
}
hashtree "$EXISTING" > "$SANDBOX/before.txt"

(cd "$EXISTING" && node "$CREATE_BIN" . >"$SANDBOX/add.log" 2>&1) && r=0 || r=$?
ok 'create runs in a React app and exits 0' "$r"

[ -f "$EXISTING/src/pdfsuite/PdfSuitePage.tsx" ]; ok 'it wrote src/pdfsuite/PdfSuitePage.tsx' $?
[ -f "$EXISTING/src/pdfsuite/pdfsuite.config.ts" ]; ok 'and its config beside it' $?
[ -f "$EXISTING/.pdfsuite/installed.json" ]; ok 'and the installed manifest' $?

hashtree "$EXISTING" > "$SANDBOX/after.txt"
# Everything that existed before must still hash the same, except package.json.
CHANGED=$(join -j 2 -o 0,1.1,2.1 \
  <(sed 's/^\([a-f0-9]*\)  /\1 /' "$SANDBOX/before.txt" | sort -k2) \
  <(sed 's/^\([a-f0-9]*\)  /\1 /' "$SANDBOX/after.txt" | sort -k2) \
  | awk '$2 != $3 { print $1 }')
[ "$CHANGED" = "./package.json" ]
ok 'the only pre-existing file that changed is package.json' $?
printf '        changed: %s\n' "${CHANGED:-nothing}"

grep -q 'rebeccapurple' "$EXISTING/src/app.css"; ok 'their stylesheet is untouched' $?
grep -q '"version": "4.2.0"' "$EXISTING/package.json"; ok 'their package.json kept its own keys' $?
grep -q '    "' "$EXISTING/package.json"; ok 'and its own four-space indentation' $?
grep -q '"@pdfsuite/ui"' "$EXISTING/package.json"; ok 'the @pdfsuite dependencies were added' $?
grep -q "import PdfSuitePage from './pdfsuite/PdfSuitePage'" "$SANDBOX/add.log"
ok 'and it printed the one line to add, resolvable from src/' $?

# Re-running must refuse rather than overwrite a config somebody has edited.
printf '\n// my edit\n' >> "$EXISTING/src/pdfsuite/pdfsuite.config.ts"
(cd "$EXISTING" && node "$CREATE_BIN" . >"$SANDBOX/again.log" 2>&1) && again=0 || again=$?
[ "$again" = "2" ]; ok 'running it again is refused, not an overwrite' $?
grep -q 'my edit' "$EXISTING/src/pdfsuite/pdfsuite.config.ts"; ok 'and the edited config survives' $?
grep -q -- '--sync' "$SANDBOX/again.log"; ok 'the refusal names the command that can upgrade' $?

# ── refusals ─────────────────────────────────────────────────────────
section 'targets it will not touch'

mkdir -p "$SANDBOX/junk" && printf 'notes\n' > "$SANDBOX/junk/notes.txt"
(cd "$SANDBOX/junk" && node "$CREATE_BIN" . >"$SANDBOX/junk.log" 2>&1) && j=0 || j=$?
[ "$j" = "2" ]; ok 'a non-empty directory with no package.json is refused' $?
grep -q 'no package.json' "$SANDBOX/junk.log"; ok 'and the reason names what was missing' $?

mkdir -p "$SANDBOX/vue" && printf '{"name":"v","dependencies":{"vue":"^3"}}\n' > "$SANDBOX/vue/package.json"
(cd "$SANDBOX/vue" && node "$CREATE_BIN" . >"$SANDBOX/vue.log" 2>&1) && v=0 || v=$?
[ "$v" = "2" ]; ok 'a project without React is refused' $?
grep -q 'does not depend on React' "$SANDBOX/vue.log"; ok 'and says so' $?

# ── --sync: upgrade without overwriting ──────────────────────────────
#
# Four rules, one per state a file can be in, and the third is the one L4
# decision 5 exists for. Each is checked **twice** — a bug that only shows
# on the second upgrade is the kind nobody finds in review, and two of them
# were in the first cut of this feature: an edited file's own hash went into
# the record (so the *next* sync overwrote it), and a deleted file was
# dropped from the record (so the next sync wrote it back).
section 'npm create @pdfsuite -- --sync'

SYNCAPP="$SANDBOX/sync-app"
mkdir -p "$SYNCAPP"
(cd "$SYNCAPP" && node "$CREATE_BIN" . >/dev/null 2>&1) && r=0 || r=$?
ok 'an app to upgrade' "$r"

# Nothing to upgrade, and it says so rather than doing something.
mkdir -p "$SANDBOX/no-record"
(cd "$SANDBOX/no-record" && node "$CREATE_BIN" . --sync >"$SANDBOX/norec.log" 2>&1) && r=0 || r=$?
[ "$r" = "2" ]; ok 'sync with no record exits 2' $?
grep -q 'nothing here to upgrade' "$SANDBOX/norec.log"; ok 'and says to run create first' $?

# The consumer edits one file, deletes another, and adds a dependency.
printf '\n// OUR OWN TWEAK\n' >> "$SYNCAPP/src/pdfsuite.config.ts"
rm "$SYNCAPP/.gitignore"
node -e '
const fs = require("fs"), p = process.argv[1] + "/package.json";
const d = JSON.parse(fs.readFileSync(p, "utf8"));
d.dependencies.lodash = "^4.17.21";
d.scripts.lint = "eslint .";
fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
' "$SYNCAPP"

# --check writes nothing. At the same version with only a local edit the app
# is *not* behind: `--check` is for CI, and an app whose config somebody
# customised must not fail every build forever.
before=$(cat "$SYNCAPP/src/pdfsuite.config.ts")
(cd "$SYNCAPP" && node "$CREATE_BIN" . --sync --check >"$SANDBOX/check1.log" 2>&1) && r=0 || r=$?
[ "$r" = "0" ]; ok '--check at the same version: not behind' $?
[ "$before" = "$(cat "$SYNCAPP/src/pdfsuite.config.ts")" ]; ok 'and it wrote nothing' $?

(cd "$SYNCAPP" && node "$CREATE_BIN" . --sync --check --version 9.9.9 >"$SANDBOX/check2.log" 2>&1) && r=0 || r=$?
[ "$r" = "1" ]; ok '--check against a newer version exits 1' $?
grep -q 'behind' "$SANDBOX/check2.log"; ok 'and says the app is behind' $?
grep -q '"@pdfsuite/ui": "2.0.0"' "$SYNCAPP/package.json"; ok 'still having written nothing' $?

# The upgrade itself, twice.
for v in 9.9.9 9.9.10; do
  (cd "$SYNCAPP" && node "$CREATE_BIN" . --sync --version "$v" >"$SANDBOX/sync-$v.log" 2>&1) && r=0 || r=$?
  ok "sync to $v exits 0" "$r"
done

grep -q 'OUR OWN TWEAK' "$SYNCAPP/src/pdfsuite.config.ts"
ok 'the edited file survived both upgrades' $?
[ ! -f "$SYNCAPP/.gitignore" ]
ok 'the deleted file stayed deleted through both' $?
grep -q '"lodash"' "$SYNCAPP/package.json"; ok 'their own dependency is still there' $?
grep -q '"lint"' "$SYNCAPP/package.json"; ok 'and their own script' $?
grep -q '"@pdfsuite/ui": "9.9.10"' "$SYNCAPP/package.json"
ok 'every @pdfsuite dependency moved to the new version' $?
grep -q '"version": "9.9.10"' "$SYNCAPP/.pdfsuite/installed.json"
ok 'and the record says which version it is now at' $?

# --restore is the way back for a file somebody deleted.
(cd "$SYNCAPP" && node "$CREATE_BIN" . --sync --restore --version 9.9.11 >"$SANDBOX/restore.log" 2>&1) && r=0 || r=$?
ok '--restore exits 0' "$r"
[ -f "$SYNCAPP/.gitignore" ]; ok 'and brings the deleted file back' $?
grep -q 'OUR OWN TWEAK' "$SYNCAPP/src/pdfsuite.config.ts"
ok 'without touching the edited one' $?

# Both sides moved: they edited a file *and* we have a newer version of it.
# Simulated by making the record disagree with both, which is what an
# upgrade across a real version change looks like.
KEPT="$SANDBOX/kept-app"
mkdir -p "$KEPT"
(cd "$KEPT" && node "$CREATE_BIN" . >/dev/null 2>&1)
node -e '
const fs = require("fs"), dir = process.argv[1];
const at = dir + "/.pdfsuite/installed.json";
const m = JSON.parse(fs.readFileSync(at, "utf8"));
for (const f of m.files) if (f.path === "src/main.tsx") f.sha256 = "0".repeat(64);
fs.writeFileSync(at, JSON.stringify(m, null, 2) + "\n");
fs.appendFileSync(dir + "/src/main.tsx", "\n// THEIR CHANGE\n");
' "$KEPT"
(cd "$KEPT" && node "$CREATE_BIN" . --sync --version 9.9.9 >"$SANDBOX/kept.log" 2>&1) && r=0 || r=$?
ok 'sync runs when both sides changed a file' "$r"
grep -q 'THEIR CHANGE' "$KEPT/src/main.tsx"; ok 'their version is kept' $?
[ -f "$KEPT/src/main.tsx.pdfsuite-new" ]; ok 'ours is written beside it' $?
grep -q 'main.tsx.pdfsuite-new' "$SANDBOX/kept.log"; ok 'and the report names it' $?
(cd "$KEPT" && node "$CREATE_BIN" . --sync --version 9.9.10 >>"$SANDBOX/kept.log" 2>&1)
grep -q 'THEIR CHANGE' "$KEPT/src/main.tsx"
ok 'and a second upgrade still does not overwrite it' $?

printf '\n  %s/%s checks passed\n' "$pass" "$((pass + fail))"
[ "$fail" = "0" ] || exit 1
