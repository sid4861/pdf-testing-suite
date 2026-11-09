---
type: Contract
description: "@pdfsuite/ui — the screens as React components and <PdfSuiteApp/>, what a host may configure, and what may never live in here."
---

# `@pdfsuite/ui`

**The screens.** Compare, Bulk compare, Specification and Inspect, as React components,
and one `<PdfSuiteApp/>` that mounts them behind a tab strip.

```tsx
import { PdfSuiteApp } from '@pdfsuite/ui';

export default function App() {
  return <PdfSuiteApp />;
}
```

That is the whole of a created app's UI. It is a package rather than files copied into
your project for one reason, which is [L4](../../records/0006_LAW-4-how-packages-work.md)
decision 5: **`npm update` has to be able to deliver you a new screen.** Copies cannot be
synced; a package name can.

## Configuration, not edits

A host never edits a component. Everything it can change is a prop, and all of it is
optional — `<PdfSuiteApp />` with nothing gives the whole suite with every feature on.

```tsx
<PdfSuiteApp config={{
  tabs: ['compare', 'measure'],        // which tabs exist, in this order
  initialTab: 'measure',               // which opens first
  flags: { exportZip: false },         // anything not named keeps its default
}} />
```

Nothing in that object can change what a comparison *finds*. A knob that moved a verdict
would be a decision living in the UI package, which [L3](../../records/0005_LAW-3-one-function-ui-and-cli.md)
and L4 decision 3 both forbid: the CLI would then disagree with the app and neither would
be wrong.

### Feature flags

The package owns the flag list and its defaults, which are **all on** — a missing or
misspelled key should never quietly remove a feature. A host that keeps its flags in an
env file can use the package's own parser rather than reinventing the spelling:

```tsx
import { PdfSuiteApp, parseFlagEnv } from '@pdfsuite/ui';

<PdfSuiteApp config={{ flags: parseFlagEnv(myEnv) }} />
```

That is exactly what this repository's own `src/main.tsx` does with `flag.env`.

## What it exports

| export | what |
|---|---|
| `PdfSuiteApp` | every screen behind a tab strip; takes `config` |
| `CompareView` · `LayoutCompareView` · `CompareReport` | the Compare screens, for a host laying out its own shell |
| `BulkCompareView` | many pairs at once |
| `InspectView` | one PDF, every element measured |
| `useCompareStore` · `useMeasureStore` · `useBatchStore` | the stores, to drive a screen from outside it |
| `DEFAULT_FLAGS` · `FLAG_ENV_KEYS` · `parseFlagEnv` · `configureFlags` | the flag contract |

The stylesheet is imported by the barrel, so importing the package styles it. It is also
reachable on its own at `@pdfsuite/ui/styles.css`.

## What may never live in here

**Anything that decides something about a PDF.** This package may render a result, let
somebody page through one and export one; it may not compute one. The three that do:

| it needs | it imports |
|---|---|
| open a PDF, read and measure a page | `@pdfsuite/core` |
| what changed between two PDFs | `@pdfsuite/compare` |
| whether a PDF matches its workbook | `@pdfsuite/spec` |

Each screen imports its own package and nothing else of another package than its public
exports (SR-NPM-PACKAGES decision 6). `sh scripts/check-packages.sh` is the check.

## Known debts

- **B-021** — the stylesheet defines `.card`, `.btn`, `.tabs` and friends as *global*
  class names. Dropped into a host application that has its own CSS, they collide both
  ways. Prefixing them is a large mechanical rename and is owed a ruling.
- **B-020** — each screen's *Load example* fetches its sample from `samples/…` relative
  to the app's base URL, so those files must sit in the consumer's `public/` folder. An
  undocumented requirement until it is either bundled or dropped.
- **B-018** — `services/exportReport.ts` builds the Compare tab's richer HTML report,
  which shows the heatmap, annotations and ignored regions that `result.json` does not
  carry. It is a second report builder beside `@pdfsuite/compare`'s, and either the
  result grows those fields or the difference gets ratified.

## Working on it

```bash
cd packages/ui && npx tsc --noEmit   # stricter than the app's tsconfig
cd ../.. && npm run build            # the repository's own app, which is a shell over this
sh scripts/check-packages.sh
```

This repository's `src/` is `main.tsx` and nothing else, on purpose: it is the smallest
possible host, so anything that stops working when the screens move is caught here first.
