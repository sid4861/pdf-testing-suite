---
type: Handoff
name: W-27
description: "Arpit, 2026-10-18: one compare core used by both the app and the CLI — same page loop, same page-changed rule, same pairing input, same report builders."
item: W-27
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-27 — One compare core for the app and the CLI

## At a glance

| | |
|---|---|
| **What** | Move the page loop, the page-changed rule, page pairing and the report builders into one core — `@pdfsuite/compare` and `@pdfsuite/core`; Compare, Bulk compare and the CLI all call it |
| **Why** | Arpit: the functions the CLI uses must be the ones the UI uses. Today the engine is shared but the loop is written three times, "changed" has two definitions, and each side builds its own reports |
| **Done when** | The same pair through the app path and the CLI gives a byte-identical `result.json` (outside its `run` block) and the same `report.html` |
| **Status** | 🟡 waiting · 0 of 7 DoD done |
| **Waits on** | W-29 — the core is built inside `packages/compare` |
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
| 1 · core | `comparePair` and `compareMany` in `@pdfsuite/compare` — pure, typed, one result shape; orphans reported by `compareMany` | ⏳ |
| 2 · one rule | `pageVerdict` replaces `pageHasChange` and `summaryPageDiffers`; strip, Next change and verdict agree on every page | ⏳ |
| 3 · pairing | `pages: PagePair[]` input; the app's pairing passes it; unpaired pages reported as missing | ⏳ |
| 4 · builders | `buildResultJson`, `buildReportHtml`, `buildManifest` as pure string builders; the app's JSON/CSV builders and the CLI's own writers removed or reduced to I/O | ⏳ |
| 5 · app | `compareStore` and `batchStore` call `comparePair`; their own loops gone; the Export menu offers `result.json`, `report.html` and `manifest.json` — the CLI's three files, from the same builders | ⏳ |
| 6 · cli · parity | the CLI calls `comparePair` and the shared builders; a `cli/verify` test runs one pair both ways and diffs the outputs byte for byte (outside `run`) | ⏳ |
| 7 · record | SR-COMPARE and SR-BULK-COMPARE's `owns:` claim `packages/compare`; SR-REPORT-JSON, SR-REPORT-HTML and SR-MANIFEST claim their builders in `packages/core`; the register's table releases W-01's claim; every SR-SURFACE-PARITY row naming W-27 rewritten; `docs/ARCHITECTURE.md` redrawn | ⏳ |

## Blockers

- 🟡 **Waiting on W-29** — `comparePair` and the builders are written in `packages/compare` and `packages/core`, not in `src/services/` (SR-NPM-PACKAGES).
- **W-09 waits on this** — the single-pair CLI is built on `comparePair` and the
shared builders, not on today's CLI loop.

## Record affected

[SR-COMPARE](../../records/0111_COMPARE.md) and [SR-BULK-COMPARE](../../records/0113_BULK-compare.md) (the core), [SR-REPORT-JSON](../../records/0109_REPORT-json.md), [SR-REPORT-HTML](../../records/0108_REPORT-html.md) and [SR-MANIFEST](../../records/0110_MANIFEST.md) (the builders) — all accepted 2026-10-18 — and the [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) rows naming W-27, rewritten as each closes. Governed by [SR-LAW-3](../../records/0005_LAW-3-one-function-ui-and-cli.md). SR-PDF-SUPPORT is unaffected.

## Hazards

- **No verdict may change by accident.** Run `cli/verify` before and after; the one
  intended change is DoD 2 — pages where the strip and the verdict disagreed. List them.
- **W-05 moves the same limits** into `specConstants.ts`; whichever lands second rebases.
- **The sealed spec feature is not part of this.** It reaches the CLI through `engine.ts`
  only; W-11 asks the spec machine for a pure report builder so the Spec tab and
  `pdfsuite spec` share theirs the same way.
- The touched files are W-01's until DoD 7, so commits stage `work/open/W-01-claim-components.md`.

## Reference

- `src/store/compareStore.ts` `computeAll`, `jump` · `src/store/batchStore.ts` · `cli/src/commands/compare.ts`
- `src/services/changes.ts` `pageHasChange`, `summaryPageDiffers` · `src/services/exportReport.ts` · `cli/src/report/`
- [W-09](W-09-pdfsuite-compare-one-pair.md) · [W-11](W-11-pdfsuite-spec-cli.md) · [W-05](W-05-constants-file.md)
