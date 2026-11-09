#!/bin/sh
# Build a self-contained pdfsuite folder that runs with no npm install at all.
#
# For a machine that cannot reach the npm registry: copy the folder across, and
# run `node <folder>/dist/index.js compare …`. Nothing is installed, nothing is
# fetched, no global binary is registered.
#
# Two shapes, because the trade-off is network versus platform:
#
#   --lean      ~4 MB, runs on ANY platform, needs one `npm install` on arrival
#   (default)   ~40 MB, needs NO network ever, runs on ONE platform
#
# `@napi-rs/canvas` renders the pages and ships a compiled binary per platform.
# A sealed folder carries one, so it cannot move to another OS. A lean folder
# carries none and lets npm pick the right one wherever it lands — which is
# usually what you want unless the target machine cannot reach a registry.
#
#   sh scripts/make-portable.sh --lean                 any platform, npm install there
#   sh scripts/make-portable.sh                        sealed, this machine's platform
#   sh scripts/make-portable.sh --target darwin-arm64  sealed, built for a Mac
#   sh scripts/make-portable.sh --lean --out /some/dir
#
# Sealed targets: darwin-arm64 (Apple Silicon) · darwin-x64 (Intel Mac) ·
# linux-x64-gnu · win32-x64-msvc
#
# Run from the cli/ directory.

set -e

TARGET=""
DEST=".work"
LEAN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --lean) LEAN=1; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    --out) DEST="$2"; shift 2 ;;
    -*) printf 'STOP  unknown option: %s\n' "$1" >&2; exit 1 ;;
    *) DEST="$1"; shift ;;
  esac
done

[ "$LEAN" -eq 1 ] && [ -n "$TARGET" ] && {
  printf 'STOP  --lean and --target contradict each other: lean carries no binary,\n' >&2
  printf '      so npm picks the platform on arrival and there is nothing to target.\n' >&2
  exit 1
}

if [ "$LEAN" -eq 1 ]; then
  OUT="$DEST/pdfsuite-portable-lean"
else
  OUT="$DEST/pdfsuite-portable${TARGET:+-$TARGET}"
fi

die() { printf 'STOP  %s\n' "$1" >&2; exit 1; }

[ -f package.json ] || die "run this from the cli/ directory."
[ -d node_modules/@napi-rs/canvas ] || die "no node_modules/@napi-rs/canvas — run npm install first."

# The platform binary has to be the SAME version as the wrapper that loads it.
# `npm pack @napi-rs/canvas-darwin-arm64` without a version resolves to latest,
# which is a different major line and will not load.
CANVAS_VERSION=$(node -p "require('./node_modules/@napi-rs/canvas/package.json').version")
[ -n "$CANVAS_VERSION" ] || die "could not read the @napi-rs/canvas version."

# The bundle and its pdf.js worker.
npm run build

rm -rf "$OUT"
mkdir -p "$OUT/dist"
cp dist/index.js dist/pdf.worker.mjs "$OUT/dist/"
cp README.md "$OUT/"

# A distribution folder is not a checkout: strip the scripts and devDependencies,
# which name build files that are not here, so an `npm install` in this folder
# fetches the one thing it actually needs.
node -e "
  const p = require('./package.json');
  const out = {
    name: p.name, version: p.version, description: p.description,
    license: p.license, repository: p.repository, homepage: p.homepage,
    type: p.type, bin: p.bin, engines: p.engines,
    dependencies: p.dependencies,
  };
  require('fs').writeFileSync(
    process.argv[1], JSON.stringify(out, null, 2) + '\n'
  );
" "$OUT/package.json"

if [ "$LEAN" -eq 1 ]; then
  PLATFORM_NOTE="Built for: any platform — run 'npm install' in this folder first"
  SETUP_NOTE="npm-install"
  printf '  + package.json with one dependency, @napi-rs/canvas@%s\n' "$CANVAS_VERSION"
  printf '  - no compiled binary: npm picks the right one on arrival\n'
elif [ -n "$TARGET" ]; then
  # Cross-build: fetch the target platform's binary at the pinned version.
  mkdir -p "$OUT/node_modules/@napi-rs"
  cp -R node_modules/@napi-rs/canvas "$OUT/node_modules/@napi-rs/"
  printf '  + @napi-rs/canvas@%s\n' "$CANVAS_VERSION"
  PKG="@napi-rs/canvas-$TARGET@$CANVAS_VERSION"
  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT
  printf '  fetching %s …\n' "$PKG"
  ( cd "$TMP" && npm pack "$PKG" >/dev/null 2>&1 ) \
    || die "could not fetch $PKG. Check the target name and that npm is reachable."
  TGZ=$(ls "$TMP"/*.tgz 2>/dev/null | head -1)
  [ -n "$TGZ" ] || die "npm pack produced nothing for $PKG."
  mkdir -p "$OUT/node_modules/@napi-rs/canvas-$TARGET"
  tar xzf "$TGZ" -C "$OUT/node_modules/@napi-rs/canvas-$TARGET" --strip-components=1
  printf '  + @napi-rs/canvas-%s@%s\n' "$TARGET" "$CANVAS_VERSION"
  PLATFORM_NOTE="Built for: $TARGET"
  SETUP_NOTE="ready"
else
  # This machine's binary, whichever it is.
  mkdir -p "$OUT/node_modules/@napi-rs"
  cp -R node_modules/@napi-rs/canvas "$OUT/node_modules/@napi-rs/"
  printf '  + @napi-rs/canvas@%s\n' "$CANVAS_VERSION"
  found=0
  for d in node_modules/@napi-rs/*; do
    [ -d "$d" ] || continue
    case "$(basename "$d")" in
      canvas) continue ;;
    esac
    cp -R "$d" "$OUT/node_modules/@napi-rs/"
    printf '  + %s\n' "$(basename "$d")"
    found=1
  done
  [ "$found" -eq 1 ] || die "no @napi-rs platform binary beside the wrapper — run npm install."
  # Name the platform after the binary that was actually copied, not after uname:
  # under Git Bash `uname -s` says MINGW64_NT-10.0-22631, which tells a reader
  # nothing, while the package name is exactly what --target would take.
  LOCAL_TARGET=$(basename "$(ls -d node_modules/@napi-rs/canvas-* | head -1)" | sed 's/^canvas-//')
  PLATFORM_NOTE="Built for: $LOCAL_TARGET"
  SETUP_NOTE="ready"
fi

# The visual guide, for whoever finds the folder on a shared drive and has not
# seen this tool before. Self-contained on purpose — system fonts, no external
# requests — because the machine it lands on may have no network at all.
[ -f START-HERE.html ] || die "START-HERE.html is missing from cli/."
if [ "$SETUP_NOTE" = "npm-install" ]; then
  SETUP_HTML='<div class="note"><b>One step first.</b> This build carries no compiled renderer, so it runs on any platform once npm has fetched the right one for yours. Run this in <b>this folder</b>, once: <code>npm install</code><br /><span class="faint">About 40 MB, and the only time anything is downloaded. After that the folder is self-contained, and a copy of it is a sealed folder for this platform.</span></div>'
  SETUP_TEXT='FIRST, ONCE, IN THIS FOLDER:   npm install'
else
  SETUP_HTML='<p class="muted">Nothing to install — this build already carries its renderer.</p>'
  SETUP_TEXT='Nothing to install — this build already carries its renderer.'
fi
sed -e "s|__PLATFORM__|$PLATFORM_NOTE|g" -e "s|<!--SETUP-->|$SETUP_HTML|" \
  START-HERE.html > "$OUT/START-HERE.html"
printf '  + START-HERE.html\n'

# And the same thing in plain text, for a machine with no browser.
cat > "$OUT/RUN-ME.txt" <<EOF
pdfsuite — portable.

  >> Open START-HERE.html in a browser. It explains everything, and builds the
     command and the pairs.json for you.

$SETUP_TEXT

The short version:

    node dist/index.js compare <golden> <candidate> <pairs.json> <reports>

Run it from anywhere; the paths above are relative to YOUR working directory,
not to this folder. Needs Node 20 or newer, and nothing else.

    node dist/index.js --help
    node dist/index.js compare --help

$PLATFORM_NOTE

It carries one compiled binary, for one operating system and CPU. On any other
platform it reports a missing @napi-rs/canvas binding; rebuild it with
  sh scripts/make-portable.sh --target <platform>

Full documentation: README.md
EOF

printf '\n%s\n' "$OUT"
if [ "$LEAN" -eq 1 ]; then
  printf '  %s · any platform · run `npm install` in the folder on arrival\n' \
    "$(du -sh "$OUT" | cut -f1)"
else
  printf '  %s · %s · no npm install, ever\n' \
    "$(du -sh "$OUT" | cut -f1)" "${TARGET:-$LOCAL_TARGET}"
fi
printf '  open %s/START-HERE.html\n' "$OUT"
printf '  node %s/dist/index.js compare <golden> <candidate> <pairs.json> <reports>\n\n' "$OUT"
