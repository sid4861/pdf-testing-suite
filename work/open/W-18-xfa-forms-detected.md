---
type: Handoff
name: W-18
description: "Arpit, 2026-10-18: detect dynamic XFA forms and stop with a clear message instead of showing pdf.js's fallback page."
item: W-18
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-18 — Detect XFA forms and say they are not supported

## At a glance

| | |
|---|---|
| **What** | Detect dynamic XFA forms and stop with a clear message instead of showing pdf.js's fallback page |
| **Why** | Today an XFA PDF shows a placeholder page and is compared as if it were the document |
| **Done when** | The XFA fixture shows "XFA form — not supported; save it as a flat PDF first" in every surface; the CLI exits 2 |
| **Status** | 🟡 waiting · 0 of 5 DoD done |
| **Waits on** | W-12 |
| **Who** | `agent` · Sonnet |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · detect"] --> S2["2 · surfaces"] --> S3["3 · cli"] --> S4["4 · fixture"] --> S5["5 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 detect --> 2 surfaces --> 3 cli --> 4 fixture --> 5 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Sonnet: a detection and a message, no new engine behaviour.

## How it can be built — research, 2026-10-18

- **pdf.js detects it:** `pdf.isPureXfa`, and `getMetadata().info.IsXFAPresent`.
- **Do not render XFA:** `enableXfa: true` makes pdf.js render HTML, not a canvas — incompatible with pixel diffing and measurement.
- **Message, not a guess:** each surface stops for that file with the reason and the fix (flatten, or print to PDF).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · detect | XFA detected on load in the shared loader | ⏳ |
| 2 · surfaces | Inspect, Compare and the report show the message; nothing is compared | ⏳ |
| 3 · cli | exit 2 with the message | ⏳ |
| 4 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 5 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

Ask the spec machine to show the same message in the Spec tab. The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-12** — its fictional fixture and the harness are what prove this item.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-18 in its *closed by* column.

## Hazards

- Hybrid forms (AcroForm + XFA) render their AcroForm part — refuse only pure XFA, warn on hybrid.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` `loadPdf`
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
