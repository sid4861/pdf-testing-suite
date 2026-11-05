---
type: Contract
description: "What the spec-driven comparison feature is, what it may depend on, and the surface it publishes as @pdfsuite/spec."
---

# The spec-driven comparison feature

Everything this feature is lives in this folder, and the rest of the app reaches
it only through two barrels. That is not a wall — it is the shape of a package:
**W-32** publishes this folder as `@pdfsuite/spec`, and a surface that is already
narrow is a surface that can be lifted out without a rewrite.

**Siddharth, 2026-11-03:** *“package can be developed on any machine now, remove
this constraint”* — the ruling owed on
[W-32](../../../work/open/W-32-spec-package.md), option B. This folder **used to
be sealed**: developed on a second machine, never edited here, and refreshed one
way from a zip. That is over. It is ordinary code in this repository, and this
repository holds the live version.

### What did not change

**Real spec workbooks never leave the spec machine.** That is a rule about data,
not about code — every fixture in this repository is fictional
([SR-NPM-PACKAGES](../../../records/0107_NPM-packages.md) decision 13). Nothing
confidential belongs in this folder, and nothing confidential is in it.

Run `sh scripts/check-boundary.sh` to prove the surface is still narrow. It
checks four things: the app and the CLI import only a barrel, this feature
imports nothing outside its allow-list, its CSS stays in `spec.css`, and no file
of its has drifted back into `src/services/`.

## The whole public surface

```ts
import { SpecTestView, SpecExportMenu } from './features/spec';
```

[`index.ts`](index.ts) exports those two components and imports
[`spec.css`](spec.css). That is the entire contract. Importing a file *inside*
this folder from anywhere else is the thing the boundary check forbids.

## What is in here

| file | what it is |
|---|---|
| `index.ts` | the barrel — the only import point |
| `SpecTestView.tsx` | the tab: uploads, the sheet → page pairing, results |
| `SpecExportMenu.tsx` | the header export menu for this tab |
| `specStore.ts` | all state for the tab (Zustand) |
| `specCheck.ts` | the checker: runs a spec against a PDF page |
| `specExport.ts` | JSON and printable-HTML output of results |
| `sheetRead.ts` | `.xlsx` / `.xlsm` / `.csv` → grids of cell text |
| `sheetSpec.ts` | one sheet → a one-page spec, by label vocabulary |
| `pdfjs.ts` | this feature's own pdf.js worker setup and loader |
| `types.ts` | the spec format and result types |
| `spec.css` | every style this feature owns |

## What it is allowed to depend on

This is `@pdfsuite/spec`'s dependency list in draft, which is why it is kept
short. The boundary check enforces it:

1. **npm packages** — `react`, `zustand`, `pdfjs-dist`, `jszip`, and
   **`@sheetpane/import`** (pinned exactly; SR-SPEC-INTAKE decision 3 makes it the one
   workbook reader, in the browser and under Node).
2. **The project's shared code** — `src/services/` (what becomes
   `@pdfsuite/core`), `src/types/`, `src/store/`, and `src/flags.ts`. Adding a
   *new* flag touches `src/flags.ts` and `flag.env`, which the whole app shares.
3. **The design tokens** in `src/styles.css` — `--indigo`, `--border`,
   `--panel`, `--radius`, `--shadow` and the rest of `:root`. Read-only: restyling
   them is the app's call.
4. **The shared component classes** — `.card`, `.btn`, `.slot`, `.tabs`,
   `.chip`, `.summary-chip`, `.empty-state`, `.upload-row`, `.spinner`,
   `.zoom-group`, `.overlay-legend`, `.pagestrip`, `.subtoolbar`. Use them;
   never redefine them here. Extending one with an owned modifier is fine —
   `.empty-state.sp-compact`, `.overlay-legend .dot.exp`.

`pdfjs.ts` duplicates about ten lines of `src/services/pdfCompare.ts`. That was
the right trade while the seal stood — a shared file across it was the more
expensive mistake. With the seal gone it is just duplication; W-29 replaces it
with a dependency on `@pdfsuite/core`.

### CSS naming rule

Everything this feature defines is prefixed **`sp-`**, **`spec-`** or
**`target-`** (plus `.remap-note`). The prefix is what makes the boundary
checkable, and it is not decoration: `.pair-list` and `.pair-row` were in use by
Batch compare before this feature borrowed the same two names.

## Working on it

Like any other code in this repository. Before you finish:

```bash
npx tsc --noEmit
npm run build
sh scripts/check-boundary.sh
```

The CLI imports this feature too, through `engine.ts`, so a change to that
barrel's shape means `cd cli && npm run build && npm run verify:spec`.

## What becomes `@pdfsuite/spec`

W-32 moves this folder to `packages/spec` once W-29 creates the workspace. Two
things change then and are worth not pre-empting:

- `pdfjs.ts` duplicates the loader in `src/services/pdfCompare.ts`. It was
  duplicated to avoid a shared file across the old seal; with the seal gone it
  should become a dependency on `@pdfsuite/core` rather than a copy. W-29 does
  that — removing it now would just move the duplication.
- The allow-list below is the package's dependency list in draft. Anything added
  to it is something `@pdfsuite/spec` will have to declare.
