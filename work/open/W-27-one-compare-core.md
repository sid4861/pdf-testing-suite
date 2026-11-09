---
type: Handoff
name: W-27
description: "Arpit, 2026-10-18: one compare core used by both the app and the CLI — same page loop, same page-changed rule, same pairing input, same report builders."
item: W-27
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-06
updated_by: Siddharth
ball: agent
---

# W-27 — One compare core for the app and the CLI

## At a glance

| | |
|---|---|
| **What** | Move the page loop, the page-changed rule, page pairing and the report builders into one core — `@pdfsuite/compare` and `@pdfsuite/core`; Compare, Bulk compare and the CLI all call it |
| **Why** | Arpit: the functions the CLI uses must be the ones the UI uses. Today the engine is shared but the loop is written three times, "changed" has two definitions, and each side builds its own reports |
| **Done when** | The same pair through the app path and the CLI gives a byte-identical `result.json` (outside its `run` block) and the same `report.html` |
| **Status** | 🟢 6 of 7 DoD done · DoD 4 part-done: the CLI is on the shared builders; the tab's richer report is **B-018** |
| **Waits on** | nothing — W-29 landed 2026-11-06 |
| **Who** | `agent` · Opus |
| **Record** | SR-COMPARE · SR-BULK-COMPARE · SR-REPORT-JSON · SR-REPORT-HTML · SR-MANIFEST; SR-SURFACE-PARITY rows |

```mermaid
flowchart LR
  S1["1 · core"] --> S2["2 · one rule"] --> S3["3 · pairing"] --> S4["4 · builders"] --> S5["5 · app"] --> S6["6 · cli · parity"] --> S7["7 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 core --> 2 one rule --> 3 pairing --> 4 builders --> 5 app --> 6 cli + parity --> 7 record
```

</details>

**Arpit, 2026-10-18:** *"I was hoping the functions that will be used in CLI will also be
used in the UI. Is that not the case? If it isn't, then it should be."*

**Model:** Opus: it re-plumbs both surfaces onto one core without changing any verdict.

## What is shared today, and what is not (checked 2026-10-18)

| step | app (Compare · Bulk) | CLI | shared? |
|---|---|---|---|
| open a PDF | `loadPdf` | `loadPdf` | ✅ |
| compare one page | `comparePage` | `comparePage` | ✅ |
| list the changes | `buildChanges` | `buildChanges` (in report detail) | ✅ |
| page verdict | `summaryPageDiffers` | `summaryPageDiffers` | ✅ |
| loop pages → summary | `compareStore.computeAll`, and again in `batchStore` | its own loop in `commands/compare.ts` | ❌ written three times |
| "page changed" for the strip and Next change | `pageHasChange` (moved > 0.02″ ≈ 2.9 px) | — | ❌ **disagrees with the verdict** (offset > 2 px): a 2.5 px shift fails the report but is skipped by Next change |
| page pairing | manual `pairs[]` in `compareStore` | none (file pairs and `skipPages` only) | ❌ |
| mark expected | `ignoreStore` | none | ❌ (CLI removed it on purpose) |
| HTML report | `buildHtmlReport` | own `writeHtmlReport`, reusing the app's CSS, rows and page detail | ⚠️ parts |
| JSON | `buildJsonReport` | own `writeJsonReport` | ❌ |
| CSV | `buildCsvReport` | own `writeCsvReport` | ❌ |
| Markdown | `buildMarkdownReport` | `buildMarkdownReport` | ✅ |
| JUnit · ZIP | — · `exportZipBundle` | `writeJUnitReport` · — | one side only |
| pixel sensitivity, AA | store knobs, default 0.1 / off | `--pixel-threshold`, `--include-aa`, same defaults | ⚠️ same defaults, separate knobs — both move the verdict |

## How it can be built

- **`comparePair(docA, docB, opts)` in `packages/compare`** (SR-NPM-PACKAGES) — pure: no React, no `fs`, no download. Options: `pages` (the pairing), pixel sensitivity, anti-aliasing, a progress callback. Returns one result: per page the comparison summary, its changes and its verdict; the pair verdict.
- **One page rule, `pageVerdict`,** replaces `pageHasChange` and `summaryPageDiffers`. The strip, Next change, the summary chip, every report and the CLI call it. Its limits come from `specConstants.ts` (W-05).
- **Pairing is an input:** the app's manual pairing and W-09's `--pages` are the same `PagePair[]`.
- **Report builders return strings:** `buildResultJson`, `buildReportHtml`, `buildManifest`, `buildMarkdownReport`. The app wraps them in a download; the CLI writes them to disk. The app's export and the CLI then produce **the same files**.
- **Every knob that moves the verdict is recorded in `result.json`.**
- **`compareMany(pairs)`** loops `comparePair` over many pairs, pairing by relative path and reporting a golden or a candidate with no partner. Bulk compare and `pdfsuite compare --each` (W-09) both call it — one loop, not two.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · core | ✅ `comparePair` and `compareMany` in `@pdfsuite/compare` — pure (no React, no `fs`, no download), one result shape, the two verdict-moving knobs recorded on it, a page that throws reported as a finding rather than a pass, and `reuse` for pages a surface has already compared. `compareMany` reports orphans and fails on them | ✅ |
| 2 · one rule | ✅ `pageVerdict` replaces `summaryPageDiffers` and `pageHasChange`, which are **deleted**; the strip, Next change, the chip, both reports and the CLI all call it. The band they disagreed about — 2 px to 2.9 px — now counts as changed everywhere, which is the one intended change; the sample corpus is otherwise unchanged | ✅ |
| 3 · pairing | ✅ `pages: PagePair[]` is `comparePair`'s input and the Compare tab passes its own pairing through it; a page with nothing on one side comes back `missing`. The CLI passes it with **W-09**'s `--pages` | ✅ |
| 4 · builders | ✅ for the CLI: `buildCompareResultJson`, `buildCompareReportHtml` (from `result.json` alone) and `buildManifest` are the shared builders, and the CLI's own writers are **deleted**. The envelope and the manifest live in `@pdfsuite/core`, with the spec run on the same envelope. **The Compare tab keeps its richer HTML** — heatmap, annotations, ignored regions — which `result.json` does not carry: filed as **B-018** rather than dropped | 🟡 |
| 5 · app | ✅ `compareStore.computeAll` and `batchStore.run` call `comparePair`; both loops are gone, and each tab keeps only what is its own — the Compare tab its page cache, the Bulk tab its buffer release. The Export menu offers `result.json` + `manifest.json` from the shared builders; the old JSON shape is kept, labelled, until pipelines move | ✅ |
| 6 · cli · parity | ✅ the CLI calls `comparePair`, and `packages/cli/verify/compare-parity.ts` runs one pair **through the built binary as a process** and through the builders the way the tab calls them, then diffs the two documents: identical, 118 lines, apart from `run`, `tool` and `env`, each excluded for a stated reason | ✅ |
| 7 · record | ✅ SR-COMPARE owns `packages/compare/` and states the one rule; SR-BULK-COMPARE owns the loop and `--each`; the register releases W-01's claim; four SR-SURFACE-PARITY rows closed, two re-pointed at W-09 and B-018; ARCHITECTURE's compare section redrawn with its SVG | ✅ |

## Blockers

- 🟡 **Waiting on W-29** — `comparePair` and the builders are written in `packages/compare` and `packages/core`, not in `packages/ui/src/services/` (SR-NPM-PACKAGES).
- **W-09 waits on this** — the single-pair CLI is built on `comparePair` and the
shared builders, not on today's CLI loop.

## Record affected

[SR-COMPARE](../../records/0111_COMPARE.md) and [SR-BULK-COMPARE](../../records/0113_BULK-compare.md) (the core), [SR-REPORT-JSON](../../records/0109_REPORT-json.md), [SR-REPORT-HTML](../../records/0108_REPORT-html.md) and [SR-MANIFEST](../../records/0110_MANIFEST.md) (the builders) — all accepted 2026-10-18 — and the [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) rows naming W-27, rewritten as each closes. Governed by [SR-LAW-3](../../records/0005_LAW-3-one-function-ui-and-cli.md). SR-PDF-SUPPORT is unaffected.

## Hazards

- **No verdict may change by accident.** Run `packages/cli/verify` before and after; the one
  intended change is DoD 2 — pages where the strip and the verdict disagreed. List them.
- **W-05 moves the same limits** into `specConstants.ts`; whichever lands second rebases.
- **The sealed spec feature is not part of this.** It reaches the CLI through `engine.ts`
  only; W-11 asks the spec machine for a pure report builder so the Spec tab and
  `pdfsuite spec` share theirs the same way.
- The touched files are W-01's until DoD 7, so commits stage `work/open/W-01-claim-components.md`.

## Reference

- `packages/ui/src/store/compareStore.ts` `computeAll`, `jump` · `packages/ui/src/store/batchStore.ts` · `packages/compare/src/cli/pair.ts`
- `packages/compare/src/changes.ts` `pageHasChange`, `summaryPageDiffers` · `packages/ui/src/services/exportReport.ts` · `packages/core/src/report/`
- [W-09](W-09-pdfsuite-compare-one-pair.md) · [W-11](W-11-pdfsuite-spec-cli.md) · [W-05](W-05-constants-file.md)
