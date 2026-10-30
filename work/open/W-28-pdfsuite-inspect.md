---
type: Handoff
name: W-28
description: "Arpit, 2026-10-18: under L3, Inspect's functions move into the core and the CLI gains `pdfsuite inspect`, calling the same functions as the Inspect tab."
item: W-28
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-28 — pdfsuite inspect: the Inspect tab's functions, shared with the CLI

## At a glance

| | |
|---|---|
| **What** | Move Inspect's extraction and measurements into the core, and add `pdfsuite inspect <pdf> --out <dir>` that calls the same functions |
| **Why** | L3: whatever the UI does, the CLI does with the same function. Inspect has no CLI, and its line-height and edge-distance maths lives inside a React component |
| **Done when** | The Inspect tab and `pdfsuite inspect` give identical element lists and measurements for the same PDF, from the same functions |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-09 |
| **Who** | `agent` · Sonnet |
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

- **Already in the engine:** `renderElements` in `src/services/pdfElements.ts` — text runs,
  images, font labels, positions in points.
- **Stuck in the UI:** `adjacentLine` (line height) and the edge-distance arithmetic live in
  `src/components/measure/MeasureView.tsx`; `elementAt` (hit-testing a click) is genuinely
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
| 1 · core | `inspectCore` in `@pdfsuite/core` (SR-INSPECT decision 1): elements, edge distances, line height — pure; `pdfElements.ts` and the maths from `MeasureView.tsx` move here | ⏳ |
| 2 · app | the Inspect tab calls the core; `MeasureView.tsx` keeps only hit-testing and drawing | ⏳ |
| 3 · command | `pdfsuite inspect <pdf> [--page n] --out <dir>` — a built-in command of `@pdfsuite/cli` calling `@pdfsuite/core` (SR-CLI, SR-INSPECT decision 2) | ⏳ |
| 4 · outputs | W-09's three files, built by the shared builders | ⏳ |
| 5 · parity | a `cli/verify` test: the app path and the CLI give a byte-identical `result.json` (outside `run`) for a fixture | ⏳ |
| 6 · record | SR-SURFACE-PARITY's Inspect rows rewritten; `docs/ARCHITECTURE.md` Inspect section and CLI part updated | ⏳ |

## Blockers

- 🟡 **Waiting on W-09** — its output files, writers and exit codes are what this command reuses.

## Record affected

[SR-INSPECT](../../records/0114_INSPECT.md) decisions 1–3 (accepted 2026-10-18); the Inspect rows of [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md); [SR-CLI](../../records/0115_CLI.md) already lists `inspect`.

## Hazards

- **Where it lives (SR-NPM-PACKAGES):** `inspect` is a built-in command of `@pdfsuite/cli`, calling `@pdfsuite/core`.
- **Points vs inches:** the core returns points; the report converts. One conversion, in one place.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too.

## Reference

- `src/services/pdfElements.ts` · `src/components/measure/MeasureView.tsx` `adjacentLine` · `src/store/measureStore.ts`
- [SR-LAW-3](../../records/0005_LAW-3-one-function-ui-and-cli.md) · [W-09](W-09-pdfsuite-compare-one-pair.md) · [W-26](W-26-document-properties.md)
