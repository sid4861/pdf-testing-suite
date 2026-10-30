---
type: Handoff
name: W-24
description: "Arpit, 2026-10-18: when golden and candidate pages differ in size, report it as a finding and compare positions and text sizes in inches and points."
item: W-24
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-24 — Name a page-size difference and compare in physical units

## At a glance

| | |
|---|---|
| **What** | When golden and candidate pages differ in size, report it as a finding and compare positions and text sizes in inches and points |
| **Why** | Today a different page size is silently letterboxed; glyph sizes are not compared and the pixel diff is skipped |
| **Done when** | On the Letter-vs-A4 fixture, Compare reports the size change and real position offsets in inches |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-12 |
| **Who** | `agent` · Opus |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · finding"] --> S2["2 · align"] --> S3["3 · pixels"] --> S4["4 · cli"] --> S5["5 · fixture"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 finding --> 2 align --> 3 pixels --> 4 cli --> 5 fixture --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Opus: it changes how two differently shaped pages are aligned and judged.

## How it can be built — research, 2026-10-18

- **Finding:** "page size: 8.5 × 11 in → 210 × 297 mm" on every such page; failing by default — the page did change.
- **Align top-left in physical units** instead of centring a scaled copy; offsets are then real inches and glyph sizes real points.
- **Pixel diff:** run on the overlapping area at a common scale, labelled partial.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · finding | page-size finding, failing | ⏳ |
| 2 · align | positions and sizes compared in physical units, top-left aligned | ⏳ |
| 3 · pixels | partial pixel diff on the common area, labelled | ⏳ |
| 4 · cli | the same in the CLI report | ⏳ |
| 5 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 6 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

SR-SPEC-CHECK decision 4 (page-size check) is W-04's, on the spec machine. The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-12** — its fictional fixture and the harness are what prove this item.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-24 in its *closed by* column.

## Hazards

- **Verdict change:** pairs that passed only because letterboxing hid the difference will fail — intended; say so.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` target box and letterbox · `src/services/changes.ts`
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
