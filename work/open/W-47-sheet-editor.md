---
type: Handoff
name: W-47
description: "Arpit, 2026-10-18: fix the spec workbook inside the Specification tab with sheetpane's Edit mode — re-validated as you type, saved as .xlsx, and the check re-run on the saved copy."
item: W-47
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-19
updated_by: Arpit
ball: agent
---

# W-47 — Specification: fix the workbook in sheetpane's Edit mode

## At a glance

| | |
|---|---|
| **What** | An *Edit workbook* action in Specification opens sheetpane in Edit mode; every change re-runs W-02's validation and refreshes the marks; *Save .xlsx* hands the file back and the check uses it |
| **Why** | Arpit: the Excel editor is part of sheetpane, used by pdfsuite |
| **Done when** | On the fixture, a wrong unit is fixed in the browser, its error mark clears without a reload, and the saved workbook's SHA-256 is the one the next report records |
| **Status** | 🟡 waiting · 0 of 5 DoD done |
| **Waits on** | W-46 · sheetpane on npm (`mode="edit"` is in arpitarya/sheetpane, unpublished) |
| **Who** | `agent` · Sonnet |
| **Record** | SR-SPEC-INTAKE (an edited workbook is validated like an uploaded one) |

```mermaid
flowchart LR
  S1["1 · edit action"] --> S2["2 · live validation"] --> S3["3 · save"] --> S4["4 · provenance"] --> S5["5 · tests · docs"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 edit action --> 2 live validation --> 3 save --> 4 provenance --> 5 tests + docs
```

</details>

**Arpit, 2026-10-18:** *"the Excel viewer editor and the error component is a separate component
named sheet pane. I'm working on it. It will be a dependency to the PDF suite."*

**Model:** Sonnet: wiring sheetpane's change events to the existing validator.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · edit action | *Edit workbook* switches sheetpane to Edit mode; *Discard* returns to the uploaded file | ⏳ |
| 2 · live validation | sheetpane's cell-changed event re-runs W-02's validation (debounced) and refreshes marks and the error component | ⏳ |
| 3 · save | *Save .xlsx* takes sheetpane's file, offers the download, and makes it the workbook the next check reads | ⏳ |
| 4 · provenance | the report records the workbook's SHA-256 and says "edited in pdfsuite" when it was | ⏳ |
| 5 · tests · docs | Playwright: fix one cell, mark clears, saved hash differs only by that edit; docs and SR-SURFACE-PARITY row | ⏳ |

## Blockers

- 🟡 W-46 · sheetpane on npm — `<sheetpane-excel mode="edit">` exists in the repo, not yet published (checked 2026-10-19).

## Record affected

[SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md) — names the in-app editor as a source of a
workbook; validation rules unchanged.

## Hazards

- **Two copies of the spec:** a workbook edited here drifts from the one on a shared drive; the
  report's SHA-256 and the "edited in pdfsuite" note say which copy was used.
- **The sealed folder:** wiring happens on the spec machine (W-46's hazard).
- **Formulas:** sheetpane's download is the original file with only the edited cells patched in;
  an edited cell that held a formula becomes a value — say so before saving.

## Reference

- Designs: [`work/design/`](../design/README.md) — `Sheet-Editor.dc.html`
- [W-46](W-46-sheet-viewer.md) · [W-02](W-02-excel-spec-comparison.md) · [arpitarya/sheetpane](https://github.com/arpitarya/sheetpane)
