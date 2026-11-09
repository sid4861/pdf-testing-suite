---
type: Contract
description: "@pdfsuite/spec — what the package is, the three barrels it publishes, what it may depend on, and the CSS prefix rule."
---

# `@pdfsuite/spec`

**Check a PDF against the workbook that describes it.** Read a Template v2
`.xlsx` (or a spec JSON), validate it, check a document page by page, and report
what failed with the cell it came from. It is the library behind the
Specification tab and behind `pdfsuite spec`, which are the same functions
([L3](../../records/0005_LAW-3-one-function-ui-and-cli.md)).

```bash
npm i @pdfsuite/spec        # and `npx pdfsuite spec` exists
npm i -g @pdfsuite/spec     # and `pdfsuite-spec` is on your PATH
```

## How it got here

This was `src/features/spec/` — a **sealed** folder: developed on a second
machine, never edited in this repository, refreshed one way from a zip. Two
rulings ended that:

- **Siddharth, 2026-11-03** (W-32, option B): *“package can be developed on any
  machine now, remove this constraint”*. The seal came off and this repository
  began holding the live version.
- **2026-11-06** (W-32): the folder became `packages/spec`, a workspace package,
  and the `spec` command moved in with it.

**What did not change: real spec workbooks never leave the spec machine.** That
is a rule about *data*, not about code — every fixture in this repository is
fictional ([SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decision 13).
Nothing confidential belongs in this package, and nothing confidential is in it.

## The three barrels

That narrow surface is the whole reason the move was cheap, and it is still the
contract. Anything not exported from one of these is internal, and may be
renamed or removed without warning to the rest of the repository.

| import | what it is | who uses it |
|---|---|---|
| `@pdfsuite/spec` | [`src/index.ts`](src/index.ts) — two React components, and `spec.css` | the app's Specification tab |
| `@pdfsuite/spec/engine` | [`src/engine.ts`](src/engine.ts) — the headless surface: read, validate, compile, check, report | anything without a DOM, and this repository's verify suites |
| `@pdfsuite/spec/cli` | [`src/cli/index.ts`](src/cli/index.ts) — the `spec` command as a module | `@pdfsuite/cli`, which loads it at run time |

```ts
import { SpecTestView, SpecExportMenu } from '@pdfsuite/spec';
import { runSpec, readSpecWorkbook, compileSpec } from '@pdfsuite/spec/engine';
```

`sh scripts/check-boundary.sh` proves the surface is still narrow: only a barrel
is imported from outside, this package imports nothing outside its dependency
list, its CSS stays in `spec.css`, and nothing of its has drifted back into the
app.

### A note on the CLI barrel

`exports["./cli"]` points at `dist/cli.js`, not at the TypeScript. The host
resolves it with `createRequire` at run time, and `createRequire` cannot load a
TypeScript source — so `npm run build` (or `prepack`) must have run. Everything
else ships as TypeScript, because what consumes it compiles it anyway.

## What is in here

| file | what it is |
|---|---|
| `index.ts` · `engine.ts` · `cli/index.ts` | the three barrels |
| `SpecTestView.tsx` | the tab: uploads, the sheet → page pairing, results |
| `SpecValidation.tsx` | the plain-words validation report |
| `SpecExportMenu.tsx` | the header export menu for this tab |
| `specStore.ts` | all state for the tab (Zustand) |
| `specIntake.ts` | the one workbook reader, over `@sheetpane/import` |
| `specTemplate.ts` · `specValues.ts` · `specCompile.ts` | Template v2 → a compiled spec |
| `specValidate.ts` | the validation report, before any PDF is opened |
| `specLegacy.ts` · `specDraft.ts` | the legacy nested layout → a **draft** workbook, never a spec |
| `specCheck.ts` | the checker: runs a compiled spec against a PDF |
| `specPages.ts` · `specFonts.ts` · `specColour.ts` | page binding, font and colour judgment |
| `specResult.ts` · `specReportHtml.ts` · `specOutputs.ts` · `specFixList.ts` | the three files a run writes, and the fix list |
| `cli/run.ts` | `pdfsuite spec`: resolve two files, call the above, write the three |
| `schema/result.v1.json` | the `result.json` schema, published at `@pdfsuite/spec/schema/result.v1.json` |
| `types.ts` | the spec format and result types |
| `spec.css` | every style this package owns |

## What it depends on

Short on purpose, and enforced by the boundary check:

1. **npm** — `react` (a peer, optional: the engine and CLI barrels need no
   React), `zustand`, `pdfjs-dist` (pinned exactly), `jszip`, and
   **`@sheetpane/import`** (pinned exactly; [SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md)
   decision 3 makes it the one workbook reader, in the browser and under Node).
2. **`@pdfsuite/core`** — `loadPdf`, the element reader, the constants and the
   `result.json` envelope. This package used to carry its own ten-line copy of
   `loadPdf`, because a shared file across the old seal was the more expensive
   mistake; the seal is gone, so the copy is too.
3. **`@pdfsuite/cli`** — **types only**, for the command module's shape. It is a
   real dependency because `bin/pdfsuite-spec.mjs` forwards to the host at run
   time, but nothing in `src/` imports a value from it: that bundle is separate
   from the host's, so a value would be a second copy. See
   [`packages/cli/src/host.ts`](../cli/src/host.ts).
4. **Design tokens and shared component classes from the app's stylesheet** —
   `--indigo`, `--border`, `--panel`, `--radius`, `--shadow`; `.card`, `.btn`,
   `.slot`, `.tabs`, `.chip`, `.summary-chip`, `.empty-state`, `.upload-row`,
   `.spinner`, `.zoom-group`, `.overlay-legend`, `.pagestrip`, `.subtoolbar`.
   Read-only: use them, never redefine them here. Extending one with an owned
   modifier is fine — `.empty-state.sp-compact`, `.overlay-legend .dot.exp`.
   **This is a debt, not a design** — a package that needs its consumer's
   stylesheet is not self-contained. It is filed as **B-019**, and it waits on
   `@pdfsuite/ui` (W-33), which is where those shared classes belong.

### CSS naming rule

Everything this package defines is prefixed **`sp-`**, **`spec-`** or
**`target-`** (plus `.remap-note`). The prefix is what makes the boundary
checkable, and it is not decoration: `.pair-list` and `.pair-row` were in use by
the Bulk compare tab before this feature borrowed the same two names.

## Working on it

```bash
cd packages/spec && npx tsc --noEmit    # stricter than the app's tsconfig
npm run build                           # typecheck + dist/cli.js
sh ../../scripts/check-boundary.sh
sh ../../scripts/check-packages.sh
```

The CLI's verify suites exercise `@pdfsuite/spec/engine` directly, so a change
to that barrel's shape means `cd ../cli && npm run build && npm run verify:spec`.
A change to the command means `npm run verify:spec-cli`, which runs the built
binary as a process, and `npm run verify:discovery`, which checks that the host
still finds this package.
