---
type: Handoff
name: W-46
description: "Arpit, 2026-10-18: the Specification tab shows the uploaded workbook as a sheet — sheetpane's sheet in View mode plus its error component — with what is wrong and what is right marked on the cells; sheetpane is Arpit's separate package, a dependency of pdfsuite."
item: W-46
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-19
updated_by: Arpit
ball: agent
---

# W-46 — Specification: the workbook in sheetpane, its cells marked

## At a glance

| | |
|---|---|
| **What** | Add **sheetpane** (`@sheetpane/grid`) as a dependency; the Specification tab shows the uploaded workbook in `<sheetpane-excel>` (View mode) and `<sheetpane-errors>`, with validation and then pass/fail as marks on the cells |
| **Why** | Arpit: after upload, not a list of what is wrong — a view that looks and feels like the sheet, with wrong and right highlighted; sheetpane is the separate component he is building for it |
| **Done when** | The fixture workbook opens in sheetpane inside Specification with W-02's errors on their cells, then W-04's pass/fail after a check; selecting a cell highlights its element on the PDF page and back |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | sheetpane on npm — not published yet, checked 2026-10-19 (arpitarya/sheetpane, MIT) · W-02 · W-04 |
| **Who** | `agent` · Opus |
| **Record** | SR-SPEC-INTAKE · SR-SPEC-CHECK (where results are shown) · SR-SURFACE-PARITY (UI-only row) · SR-NPM-PACKAGES (a third-party dependency) |

```mermaid
flowchart LR
  S1["1 · dependency<br/>pinned · licence"] --> S2["2 · marks<br/>sheet + A1"] --> S3["3 · validation view"] --> S4["4 · results view"] --> S5["5 · sheet ↔ PDF"] --> S6["6 · tests · docs"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 dependency --> 2 marks --> 3 validation view --> 4 results view --> 5 sheet <-> PDF --> 6 tests + docs
```

</details>

**Arpit, 2026-10-18:** *"When we upload the Excel, I don't want a view where it just says that this is
what is wrong in Excel … It actually looks and feels like an Excel sheet and over there we can
highlight what is wrong, what is right."* — and later: *"the Excel viewer editor and the error
component is a separate component named sheet pane. I'm working on it. It will be a dependency to
the PDF suite."*

**Model:** Opus: a boundary between two packages and two readers that must agree on every cell.

## The split

| | owns |
|---|---|
| **sheetpane** (arpitarya/sheetpane, Arpit, MIT) | **loading** the file (`@sheetpane/import`) and **showing** it (`@sheetpane/grid`: `<sheetpane-excel>` in View and Edit modes, `<sheetpane-errors>`, kept in sync by a shared `pane` id, in a tab or a dialog); formulas, styles and the rest are opt-in plugins — its own records |
| **pdfsuite** (this item) | the dependency, the **marks** it hands sheetpane — `{ sheet, ref (A1), kind, message, fix? }` with `kind` error · warning · info · pass · fail — and the link from a cell to the PDF page |

**One reader, one address.** Arpit, 2026-10-19: *"sheetpane is the one we are going to use to
load excel and display."* W-02's engine loads the workbook with `@sheetpane/import` (in the browser
and, for the CLI, under Node), and `@sheetpane/grid` reads every file through the same module — so
the validator and the screen see one `Workbook` (SR-SPEC-INTAKE decision 3). Marks still meet the
sheet on **sheet name + A1 reference**, never on row indexes, and a test still asserts that every
mark's cell exists in the loaded workbook.

## What pdfsuite needs from sheetpane

Written here so the two repos agree; sheetpane decides how in its own records.

1. A web component (any framework — Arpit, 2026-10-18).
2. Marks by sheet + A1, five kinds, each with a message and an optional fix ("what the
   correction should be").
3. The error component linked to the sheet: pick a line, the sheet goes to its cell; pick a
   cell, its line is highlighted.
4. Events for cell selected and cell changed (W-47), with sheet + A1.
5. Hidden sheets, rows and columns shown as hidden, since W-02 reports them.
6. An open-source licence (pdfsuite's L2) — **MIT, confirmed 2026-10-19** — and semver releases on npm (none yet).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · dependency | `@sheetpane/grid` pinned exactly in the app's `package.json`, at the same version as W-02's `@sheetpane/import`; MIT checked against L2; SR-NPM-PACKAGES lists both as third-party runtime dependencies | ⏳ |
| 2 · marks | one function maps W-02's validation report and W-04's results to sheetpane marks (`source.sheet`, `source.cell`); a test proves every mark lands on a cell sheetpane parsed | ⏳ |
| 3 · validation view | after upload, sheetpane's sheet (View) and error component replace the list; sheet tabs carry counts | ⏳ |
| 4 · results view | after a check, a *Validation · PDF check* switch shows pass/fail marks, with what the PDF measured | ⏳ |
| 5 · sheet ↔ PDF | selecting a cell outlines its element on the PDF page; clicking a box selects its cell | ⏳ |
| 6 · tests · docs | Playwright on the fixture (W-40), driving the sheet through `@sheetpane/testing`'s locators; `docs/ARCHITECTURE.md` spec diagram; SR-SURFACE-PARITY *sheet view* row (UI only) | ⏳ |

## Blockers

- 🟡 sheetpane's first npm release (Arpit, arpitarya/sheetpane — not on npm, checked 2026-10-19) · W-02 (validation report with cells) · W-04 (results with cells).

## Record affected

[SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md) — decision 14's validation report gains its
on-screen form. [SR-SPEC-CHECK](../../records/0102_SPEC-check.md) — results shown on the sheet.
[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) — sheetpane as a dependency.
[SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) — UI-only row.

## Hazards

- **The sealed folder:** the Specification tab lives in `src/features/spec/`; wiring sheetpane in
  happens on the spec machine, whose dependency allow-list (`src/features/spec/README.md`) must
  admit `@sheetpane/grid` and `@sheetpane/import` first.
- **Version drift:** `@sheetpane/grid` and W-02's `@sheetpane/import` at different versions are
  two readers again — pin both to one version and bump them together. The DoD 2 test is the guard.
- **Formatting:** fills and bold are sheetpane's opt-in styles plugin; without it an editing mark
  (a highlight fill, W-02 decision 11) reaches the screen only as a mark. Whether to load it is
  this item's call.

## Reference

- Designs: [`work/design/`](../design/README.md) — `Spec-Intake.dc.html`, `Spec-Results.dc.html`, `Components.dc.html`
- [arpitarya/sheetpane](https://github.com/arpitarya/sheetpane) · [W-02](W-02-excel-spec-comparison.md) · [W-04](W-04-spec-check-v2.md) · [W-47](W-47-sheet-editor.md) · [W-42](W-42-pdf-viewer-popup.md)
