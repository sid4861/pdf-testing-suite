---
type: Handoff
name: W-17
description: "Arpit, 2026-10-18: treat AcroForm field values as content: inspectable in Inspect, compared field by field in Compare, reported in the CLI."
item: W-17
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-17 — Read fillable form fields as content

## At a glance

| | |
|---|---|
| **What** | Treat AcroForm field values as content: inspectable in Inspect, compared field by field in Compare, reported in the CLI |
| **Why** | Field values are drawn on the page but never extracted, so a changed value is caught only by the pixel diff and the Spec tab cannot find it |
| **Done when** | On the form fixture, Inspect shows each field's name and value, and Compare reports a changed value as a field finding |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-12 |
| **Who** | `agent` · Opus |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · extract"] --> S2["2 · inspect"] --> S3["3 · compare"] --> S4["4 · cli"] --> S5["5 · fixture"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 extract --> 2 inspect --> 3 compare --> 4 cli --> 5 fixture --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Opus: a new element kind and a new change type across the engine.

## How it can be built — research, 2026-10-18

- **pdf.js:** `page.getAnnotations()` returns widgets with `fieldName`, `fieldType` (Tx, Btn, Ch, Sig), `fieldValue`, `rect`, `readOnly`; `pdf.getFieldObjects()` gives every field by name.
- **Inspect:** fields become elements of kind `field` — outline, name, type, value, position.
- **Compare:** match fields by fully qualified name; report value changed, added, removed, moved as **field findings**; keep the pixel diff as today.
- **Flag it:** "unflattened form — N fields" in the page summary.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · extract | field elements from `getAnnotations` in the shared engine | ⏳ |
| 2 · inspect | fields selectable with name, type, value and position | ⏳ |
| 3 · compare | field findings by name; shown in Side by side and the report | ⏳ |
| 4 · cli | the same findings in the CLI report | ⏳ |
| 5 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 6 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

Ask the spec machine to match spec text against field values too (today: "field text not found"). The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-12** — its fictional fixture and the harness are what prove this item.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-17 in its *closed by* column.

## Hazards

- Radio groups and checkboxes have export values, not visible text — show both.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` · `src/services/pdfElements.ts` · `src/services/changes.ts`
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
