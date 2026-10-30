---
type: Handoff
name: W-26
description: "Arpit, 2026-10-18: a Document panel in Inspect — title, author, producer, dates, PDF version, PDF/A or PDF/X claims, tagged, encrypted, layers, attachments — and a properties section in Compare and the CLI."
item: W-26
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-26 — Document properties: the metadata panel

## At a glance

| | |
|---|---|
| **What** | A Document panel in Inspect — title, author, producer, dates, PDF version, PDF/A or PDF/X claims, tagged, encrypted, layers, attachments — and a properties section in Compare and the CLI |
| **Why** | Arpit's first Inspect question: read PDFs with and without metadata; today no surface reads any |
| **Done when** | Inspect shows every property for the fixtures, "not set" where absent; Compare lists property differences without failing on them |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-14 |
| **Who** | `agent` · Sonnet |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · read"] --> S2["2 · inspect"] --> S3["3 · compare"] --> S4["4 · cli"] --> S5["5 · fixture"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 read --> 2 inspect --> 3 compare --> 4 cli --> 5 fixture --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Sonnet: calls pdf.js already exposes, shown in one panel.

## How it can be built — research, 2026-10-18

- **pdf.js:** `getMetadata()` → `info` (Title, Author, Creator, Producer, dates, `PDFFormatVersion`, `IsLinearized`, `IsAcroFormPresent`, `IsXFAPresent`, `IsSignaturesPresent`) and XMP `metadata` (`pdfaid:part`, PDF/X keys); `getPageLabels()`, `getPermissions()`, `getMarkInfo()`, `getOptionalContentConfig()` (layers), `getAttachments()`.
- **Without metadata** is a normal case: every field says "not set", never blank.
- **Compare:** a properties table, golden vs candidate, informational — dates always differ, so never failing.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · read | one `documentProperties(pdf)` in the shared engine | ⏳ |
| 2 · inspect | a Document panel; "not set" where absent | ⏳ |
| 3 · compare | properties diff, informational | ⏳ |
| 4 · cli | a `document` block for each side in the CLI report | ⏳ |
| 5 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 6 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

None asked. The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-14** — the `src/services/pdfFacts.ts` reader this builds on.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-26 in its *closed by* column.

## Hazards

- Layers: text in a hidden layer may still be extracted — check on the fixture and note it in the SR.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/components/measure/MeasureView.tsx` · `src/services/pdfElements.ts`
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
