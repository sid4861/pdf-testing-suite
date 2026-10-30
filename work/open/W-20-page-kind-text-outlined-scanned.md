---
type: Handoff
name: W-20
description: "Arpit, 2026-10-18: classify every page — real text, outlined text, scanned image, or scan with an OCR layer — and say so wherever text-based results would mislead."
item: W-20
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-20 — Know what a page is: text, outlined, scanned or OCR

## At a glance

| | |
|---|---|
| **What** | Classify every page — real text, outlined text, scanned image, or scan with an OCR layer — and say so wherever text-based results would mislead |
| **Why** | Outlined and scanned pages give no text and no message; OCR pages give rough text that looks real |
| **Done when** | Each of the three fixtures is labelled correctly in every surface, and Compare says when its text diff does not apply |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-12 |
| **Who** | `agent` · Opus |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · classify"] --> S2["2 · inspect"] --> S3["3 · compare"] --> S4["4 · cli"] --> S5["5 · fixture"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 classify --> 2 inspect --> 3 compare --> 4 cli --> 5 fixture --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Opus: the classifier's thresholds decide what the text diff is trusted for.

## How it can be built — research, 2026-10-18

- **Signals, all deterministic:** text items from `getTextContent`; `setTextRenderingMode` 3 (invisible text) in the operator list; the largest image's share of the page area; the count of path-painting operators.
- **Kinds:** text · outlined (no text, many filled paths) · scanned (no text, one image ≥ 90 % of the page) · OCR (scanned + invisible text) · mixed.
- **Thresholds live in `specConstants.ts`** (SR-CONSTANTS), not in code.
- **Compare:** when either side has no real text, the text diff is marked "not applicable" and the verdict rests on pixels, visibly; text on one side and outlines on the other is itself a finding.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · classify | page kind per page in the shared engine; thresholds in `specConstants.ts` | ⏳ |
| 2 · inspect | a banner naming the page kind; OCR text marked as OCR | ⏳ |
| 3 · compare | text diff "not applicable" when a side has no real text; a kind mismatch is a finding | ⏳ |
| 4 · cli | page kind per page in the CLI report | ⏳ |
| 5 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 6 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

Ask the spec machine to report such elements as "unverifiable" (SR-SPEC-CHECK decision 6) using the same signals. The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-12** — its fictional fixture and the harness are what prove this item.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-20 in its *closed by* column.

## Hazards

- **No OCR in the product** (SR-SPEC-CHECK, alternatives) — detect and say, never recognise.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` · `src/services/pdfElements.ts` · [SR-CONSTANTS](../../records/0103_CONSTANTS.md)
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
