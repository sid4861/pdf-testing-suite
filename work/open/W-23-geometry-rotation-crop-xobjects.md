---
type: Handoff
name: W-23
description: "Arpit, 2026-10-18: place images correctly when a page is rotated, cropped, or draws them inside Form XObjects."
item: W-23
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-23 — Correct image boxes on rotated, cropped and Form XObject pages

## At a glance

| | |
|---|---|
| **What** | Place images correctly when a page is rotated, cropped, or draws them inside Form XObjects |
| **Why** | Image boxes are computed in raw PDF space: they ignore `/Rotate`, the crop-box offset and Form XObject matrices |
| **Done when** | On the rotated, cropped and nested-XObject fixtures, every image box is within 1 pt of the truth in Inspect and Compare |
| **Status** | 🟡 waiting · 0 of 5 DoD done |
| **Waits on** | W-12 |
| **Who** | `agent` · Opus |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · xobject"] --> S2["2 · viewport"] --> S3["3 · shared"] --> S4["4 · fixture"] --> S5["5 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 xobject --> 2 viewport --> 3 shared --> 4 fixture --> 5 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Opus: matrix bookkeeping that is wrong in subtle cases.

## How it can be built — research, 2026-10-18

- **Form XObjects:** on `paintFormXObjectBegin` push the matrix and multiply in its `matrix` argument; pop on `paintFormXObjectEnd`. Today only `save` / `restore` / `transform` are tracked.
- **Rotation and crop box:** map image corners through `page.getViewport({ scale: 1 }).transform` — as text already is — instead of `height − y`.
- **One helper** for both `pdfCompare.ts` and `pdfElements.ts`, which repeat the same loop today.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · xobject | Form XObject matrices tracked | ⏳ |
| 2 · viewport | image corners mapped through the viewport transform | ⏳ |
| 3 · shared | one helper used by Compare and Inspect | ⏳ |
| 4 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 5 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

W-04 DoD 1 already lists Form XObject images; ask the spec machine to apply the viewport mapping too (SR-SPEC-CHECK decision 4). The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-12** — its fictional fixture and the harness are what prove this item.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-23 in its *closed by* column.

## Hazards

- Compare baselines with images may shift — explain each moved number.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` image loop · `src/services/pdfElements.ts` image loop
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
