---
type: Handoff
name: W-28
description: "Arpit, 2026-10-18: under L3, Inspect's functions move into the core and the CLI gains `pdfsuite inspect`, calling the same functions as the Inspect tab."
item: W-28
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-06
updated_by: Siddharth
ball: agent
---

# W-28 — pdfsuite inspect: the Inspect tab's functions, shared with the CLI

## At a glance

| | |
|---|---|
| **What** | Move Inspect's extraction and measurements into the core, and add `pdfsuite inspect <pdf> --out <dir>` that calls the same functions |
| **Why** | L3: whatever the UI does, the CLI does with the same function. Inspect has no CLI, and its line-height and edge-distance maths lives inside a React component |
| **Done when** | The Inspect tab and `pdfsuite inspect` give identical element lists and measurements for the same PDF, from the same functions |
| **Status** | 🟢 **6 of 6 DoD done 2026-11-06** |
| **Waits on** | nothing — W-09 landed 2026-11-06 |
| **Who** | `agent` · Opus |
| **Record** | SR-INSPECT; SR-SURFACE-PARITY's Inspect rows |

```mermaid
flowchart LR
  S1["1 · core"] --> S2["2 · app"] --> S3["3 · command"] --> S4["4 · outputs"] --> S5["5 · parity"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 core --> 2 app --> 3 command --> 4 outputs --> 5 parity --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"Everything that will be used in the UI will be present in the CLI
as well. The function should always be the same … Whatever is not built today, file work
items for those."*

**Model:** Sonnet: moving existing functions out of a component and wiring a command shaped
like W-09's.

## How it can be built — research, 2026-10-18

- **Already in the engine:** `renderElements` in `packages/core/src/pdfElements.ts` — text runs,
  images, font labels, positions in points.
- **Stuck in the UI:** `adjacentLine` (line height) and the edge-distance arithmetic live in
  `packages/ui/src/components/measure/MeasureView.tsx`; `elementAt` (hit-testing a click) is genuinely
  UI and stays.
- **Split rendering from data:** extraction must not need a page image; the image is
  optional, for the HTML report.
- **Command:** `pdfsuite inspect <file.pdf> [--page n] --out <dir>` writes W-09's three files:
  `result.json` (every element: kind, text, font, weight, box in inches, distances to the four
  edges, line height; document properties once W-26 lands), `report.html` (pages with outlined
  elements), `manifest.json`. Exit 0 on success, 2 on bad input.
- **For agents (W-10):** this is the command an agent runs to answer "where is X on page 3".

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · core | `inspectCore` in `@pdfsuite/core` (SR-INSPECT decision 1): elements, edge distances, line height — pure; `pdfElements.ts` and the maths from `MeasureView.tsx` move here | ✅ |
| 2 · app | the Inspect tab calls the core; `MeasureView.tsx` keeps only hit-testing and drawing | ✅ |
| 3 · command | `pdfsuite inspect <pdf> [--page n] --out <dir>` — a built-in command of `@pdfsuite/cli` calling `@pdfsuite/core` (SR-CLI, SR-INSPECT decision 2) | ✅ |
| 4 · outputs | W-09's three files, built by the shared builders | ✅ |
| 5 · parity | a `packages/cli/verify` test: the app path and the CLI give a byte-identical `result.json` (outside `run`) for a fixture | ✅ |
| 6 · record | SR-SURFACE-PARITY's Inspect rows rewritten; `docs/ARCHITECTURE.md` Inspect section and CLI part updated | ✅ |

## What landed — 2026-11-06

- **`inspectCore` and `inspectPage`** in `packages/core/src/inspect.ts`. `inspectPage` is
  pure — no pdf.js, no canvas, no clock — so the tab (which already holds an
  `ElementsPage` for drawing) and the CLI (which has just extracted one) run the identical
  arithmetic rather than agreeing by inspection. The line-height rule moved with it,
  including the two judgments inside it that are the reason it is a function: neighbours
  must share a column, and a gap under 40% of the font size is the *same* line, not
  leading of nearly zero.
- **The tab holds no arithmetic.** `MeasureView.tsx` keeps `elementAt` and `pctBox` —
  hit-testing and drawing — and reads every number out of `inspectPage` by element id.
- **`pdfsuite inspect <file.pdf> [--page n] --out <dir>`**, a built-in of the host because
  it needs only `@pdfsuite/core` (SR-NPM-PACKAGES decision 3): there is no
  `@pdfsuite/inspect` to install and nothing to discover.
- **The three files**, with `kind: "inspect"` on the shared envelope. Two judgments worth
  naming: an inspect **has no verdict** (it answers a question, so exit 0 whenever the
  document opened — inventing "no text layer is a failure" would refuse documents it had
  read), and `result.json` **never carries a page image** (base64 pages make a file nobody
  can diff; the report gets them instead, capped at 20 pages with `--images` to override).
- **Decision 4 is visible in the output.** A font pdf.js cannot resolve is `name: null`
  with a reason, and its weight is `"undeclared"` — because bold is read off the font
  *name*, so a nameless font says nothing about weight either. The tab prints *not stated*
  for both, which is not the same cell as "Regular".

### Proved

`packages/cli/verify/inspect-parity.ts` — **34 checks**, and `scripts/check-install.sh`
grew three: `inspect` is listed by a fresh install's `--help`, runs, and writes a
`result.json` that says `kind: "inspect"` — the built-in half of SR-NPM-PACKAGES
decision 3, which nothing else checked across a real install. One page measured both ways: the
built binary as a process, and `renderElements → inspectPage` exactly as the tab calls
them. The two `result.json` are **identical outside `run`, 760 lines**, with the same
findings hash. It also reads the arithmetic back off the file — left + width + right must
be the page width, and top + height + bottom the page height — which is the check a
mirrored axis fails. The tab was driven in the browser as well: selecting the sample's
heading gives 0.75″ / 0.75″ / 3.15″ / 0.28″ / 4.60″ / 9.97″, Helvetica-Bold 20 pt, line
height 23.4 pt, leading 1.17×.

### A third copy of a defect, found and this time proved

`pdfElements.ts`'s image walker tracked `transform` ops but not a **Form XObject's own
`/Matrix`**, which pdf.js delivers as an argument to `paintFormXObjectBegin`. Every image
inside a form was measured at the wrong place. The same defect had been found and fixed
twice in the spec walkers (W-04); this one was found by reading them side by side.

The fixture that proves it is shared rather than copied — `verify/fixtures-form-xobject.ts`,
a PDF assembled by hand so the form carries `/Matrix [1 0 0 1 10 5]`, because `pdf-lib`
writes only identity and identity is the one case where the bug and the fix agree. **The
test was run with the fix reverted**: it fails, reporting 0.2778″ where 0.4167″ is correct
— the exact numbers the bug produces.

## Blockers

- None. W-09 landed 2026-11-06.

## Record affected

[SR-INSPECT](../../records/0114_INSPECT.md) decisions 1–3 (accepted 2026-10-18); the Inspect rows of [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md); [SR-CLI](../../records/0115_CLI.md) already lists `inspect`.

## Hazards

- **Where it lives (SR-NPM-PACKAGES):** `inspect` is a built-in command of `@pdfsuite/cli`, calling `@pdfsuite/core`.
- **Points vs inches:** the core returns points; the report converts. One conversion, in one place.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too. Done: the register's Ownership table now names `packages/core/src/inspect.ts`, the two inspect report builders and `packages/cli/src/commands/inspect.ts`.

## Reference

- `packages/core/src/pdfElements.ts` · `packages/ui/src/components/measure/MeasureView.tsx` `adjacentLine` · `packages/ui/src/store/measureStore.ts`
- [SR-LAW-3](../../records/0005_LAW-3-one-function-ui-and-cli.md) · [W-09](W-09-pdfsuite-compare-one-pair.md) · [W-26](W-26-document-properties.md)
