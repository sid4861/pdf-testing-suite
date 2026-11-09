---
type: Contract
description: "@pdfsuite/create — npm create @pdfsuite: a new app, or pdfsuite added to one you have, with nothing of yours edited."
---

# `@pdfsuite/create`

```bash
npm create @pdfsuite my-app     # a whole app
npm create @pdfsuite .          # pdfsuite added to the React app you have
```

**In an empty directory** you get a Vite + React app: the screens, the command line, and
one file to configure. **In a React app** you get `src/pdfsuite/` and the dependencies,
and not one line of yours is edited.

## It decides the mode from what is on disk

Never from a flag. `npm create @pdfsuite .` is run inside working applications, and the
difference between "an empty folder" and "something I have been building for two years"
is the difference between writing seven files and ruining an afternoon.

| what is there | what happens |
|---|---|
| nothing, or only `.git` / `.gitignore` / `README.md` / editor noise | **new** — a whole app |
| a `package.json` that depends on React | **add** — `src/pdfsuite/` and the dependencies |
| files but no `package.json` | **refused**, saying what was found |
| a `package.json` without React | **refused**, saying what was missing |
| pdfsuite already here | **refused**, pointing at `--sync` |

## What a new app is

Seven files, exactly one of which is a component — the entry point.

```
package.json  index.html  vite.config.ts  tsconfig.json  .gitignore
src/main.tsx              mounts <PdfSuiteApp config={config} />
src/pdfsuite.config.ts    the only file you are expected to edit
.pdfsuite/installed.json  what was written, and its hashes
```

Every screen comes from `@pdfsuite/ui`, so `npm update` delivers new ones. A screen
written into your project by a scaffolder could never be delivered to you later — that is
[L4](../../records/0006_LAW-4-how-packages-work.md) decision 5, and the whole reason this
package writes a shell rather than an application.

`npx pdfsuite compare a.pdf b.pdf --out reports` works inside it too: the command line
arrives with `@pdfsuite/compare`.

## Add mode changes nothing of yours

One folder, and one exception that is stated rather than quiet: **`package.json` gains
`@pdfsuite/*` dependency entries**, because there is no other way to install a dependency.
Its own keys, its own indentation and its own trailing newline are preserved, so the diff
is the lines that were added and nothing else.

It then prints the one line for your router:

```tsx
import PdfSuitePage from './pdfsuite/PdfSuitePage';
<Route path="/pdfsuite" element={<PdfSuitePage />} />
```

Printed, not written. A wrong edit to somebody else's router is worse than a line they
paste (SR-NPM-PACKAGES decision 7).

[`scripts/check-create.sh`](../../scripts/check-create.sh) measures this rather than
claiming it: it hashes the whole project before and after and asserts that `package.json`
is the only pre-existing file that differs.

## `.pdfsuite/installed.json`

Every file written, with its SHA-256 and size, hashed **off disk** after writing — not
from the strings that were about to be written. The difference matters: anything between
the string and the bytes, a line-ending conversion say, would leave `--sync` comparing
against a file that never existed, and every file would look edited on the first upgrade.

That manifest is what makes an upgrade safe (SR-NPM-PACKAGES decision 8, **W-34**):
`--sync` replaces a file only while its hash still matches, writes `<file>.pdfsuite-new`
beside one you have edited, and leaves a file you deleted deleted.

Your `package.json` is deliberately **not** in it. Sync must never treat a consumer's own
manifest as a file it may replace.

## Upgrading: `--sync`

```bash
npm create @pdfsuite@latest -- --sync     # upgrade
npm create @pdfsuite@latest -- --sync --check    # for CI: exit 1 if behind
npm create @pdfsuite@latest -- --sync --restore  # also bring back files you deleted
```

Four rules, one per state a file can be in:

| the file | what happens |
|---|---|
| new in this version | **added** |
| exactly as pdfsuite wrote it | **replaced** |
| **you edited it** | **kept** — ours is written beside it as `<file>.pdfsuite-new`, and named in the report |
| you deleted it | **stays deleted** — `--restore` brings it back |

`package.json` is never replaced as a file. Only its `@pdfsuite/*` entries move, all to
one exact version; your dependencies, scripts and keys are untouched.

"Edited" is decided by content with line endings normalised, so a `core.autocrlf`
checkout is not an edit — otherwise every file would look edited and an upgrade would
deliver nothing.

`--check` exits 1 only when **we** have something newer. An app whose config you
customised on day one is not "behind", and must not fail your build forever.

## Known gaps

- **`npm run build` is `vite build`, not `tsc --noEmit && vite build`.** The `@pdfsuite`
  packages still publish TypeScript source, so `tsc` in your project type-checks *our*
  source with *your* settings and reports our problems as yours. The app builds and runs
  correctly; the fix is for the packages to publish built JavaScript with declarations,
  filed as **B-022**.
- **No agent files yet.** `--no-agents` is parsed so the default does not change later,
  but nothing is written: **W-10** owns what a file for Claude, Kiro, Codex or Copilot
  contains, and inventing four of them here would be guessing at content another item is
  about to specify.

## Zero dependencies

`node:fs`, `node:path`, `node:crypto`. It runs before anything is installed, so it cannot
afford to need anything.
