---
type: Handoff
name: W-46
description: "Arpit, 2026-10-18: the Specification tab shows the uploaded workbook as a sheet — sheetpane's sheet in View mode plus its error component — with what is wrong and what is right marked on the cells; sheetpane is Arpit's separate package, a dependency of pdfsuite."
item: W-46
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-09
updated_by: Siddharth
ball: agent
---

# W-46 — Specification: the workbook in sheetpane, its cells marked

## At a glance

| | |
|---|---|
| **What** | Add **sheetpane** (`@sheetpane/grid`) as a dependency; the Specification tab shows the uploaded workbook in `<sheetpane-excel>` (View mode) and `<sheetpane-errors>`, with validation and then pass/fail as marks on the cells |
| **Why** | Arpit: after upload, not a list of what is wrong — a view that looks and feels like the sheet, with wrong and right highlighted; sheetpane is the separate component he is building for it |
| **Done when** | The fixture workbook opens in sheetpane inside Specification with W-02's errors on their cells, then W-04's pass/fail after a check; selecting a cell highlights its element on the PDF page and back |
| **Status** | 🟢 **5 of 6 DoD done 2026-11-09** · DoD 6 part-done: the docs and the parity rows are in, its Playwright half waits on the browser-test harness item |
| **Waits on** | nothing — `@sheetpane/grid` 0.5.1 is on npm (checked 2026-11-09); W-02 and W-04 give it cells |
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
| 1 · dependency | `@sheetpane/grid` pinned exactly — **0.5.1**, the version `@sheetpane/import` is already pinned to — in `@pdfsuite/spec`'s `package.json` (the tab moved there with W-32); MIT checked against L2; SR-NPM-PACKAGES lists both as third-party runtime dependencies | ✅ |
| 2 · marks | one function maps W-02's validation report and W-04's results to sheetpane marks (`source.sheet`, `source.cell`); a test proves every mark lands on a cell sheetpane parsed | ✅ |
| 3 · validation view | after upload, sheetpane's sheet (View) and error component replace the list; sheet tabs carry counts | ✅ |
| 4 · results view | after a check, a *Validation · PDF check* switch shows pass/fail marks, with what the PDF measured | ✅ |
| 5 · sheet ↔ PDF | selecting a cell outlines its element on the PDF page; clicking a box selects its cell | ✅ |
| 6 · tests · docs | Playwright on the fixture (W-40), driving the sheet through `@sheetpane/testing`'s locators; `docs/ARCHITECTURE.md` spec diagram; SR-SURFACE-PARITY *sheet view* row (UI only) | 🟡 |

## What landed — 2026-11-09 (DoD 1–4)

- **`@sheetpane/grid` 0.5.1** pinned in `@pdfsuite/spec`, the same version as
  `@sheetpane/import`. MIT, and nothing is uploaded — the file is read in the tab, which
  matters more here than usual: a sheet viewer that posted the workbook anywhere would
  break *real spec workbooks never leave the spec machine* whatever its licence said.
- **`packages/spec/src/sheetMarks.ts`** — the join, and **no judgment of its own**: a
  mark's severity is the one the spec engine already decided, and a mark with no cell to
  land on is dropped rather than guessed at. Two layers (`validation`, `pdf`), so
  re-running a check replaces one and leaves the other.
- **`packages/spec/src/SheetView.tsx`** — the two elements in the tab, fed through a ref
  because React 18 sets attributes only. The plain-words list stays underneath: it says
  what the marks cannot (every *accepted* row as a sentence) and is W-48's contract.
- **`verify/spec-sheet-marks.ts` — 23 checks.** It caught a real bug: all ten validation
  marks were landing on a *sheet* instead of a cell, because an `IntakeNote` keeps
  `sheet` and `cell` apart while a `CheckResult` carries one qualified `Sheet!A1`. Result
  marks were fine, so only one side was wrong.

### Verified in the browser

The errors workbook and the deviations PDF, driven end to end: 104 marks in the pane,
19 errors · 82 passes · 3 not checked, and the panel's header reads
**All · Validation 10 · PDF check 9** — which is the *Validation · PDF check* switch DoD 4
asks for, provided by sheetpane itself rather than built here.

### Three React-18-isms, each found by running it

1. `results="summary"` cannot be written as a JSX attribute: `@types/react` has carried
   `results?: number` on every element since `<output>` had it, so the type collapses to
   `never`. It is the default anyway; the attribute is gone and the reason is in the file.
2. `className` on a custom element becomes a literal `classname=` attribute, so the CSS
   matched nothing and the sheet rendered 1,690 px tall. Both elements are styled by tag
   inside `.sp-sheet` now.
3. The JSX tags come from `@sheetpane/grid/jsx` through a triple-slash reference in
   `SheetView.tsx`, not a tsconfig `include` — this package is compiled by whoever imports
   it, and an ambient `.d.ts` nothing imports is loaded only by its own tsconfig.

## DoD 5 — both directions, 2026-11-09

One index, both ways, built from the marks that already exist: `meta.elementId` says
which element a row describes and `meta.page` which page it is on. Deriving the
correspondence a second time would be a second answer waiting to disagree with the
first.

- **Sheet → page.** `sheetpane-select` finds the mark for that cell, moves the page
  strip to *the report's* page order (not the PDF's — `--pages` can bind them out of
  order) and highlights the element.
- **Page → sheet.** Each element card carries its cell as a **button** (`1!E19`), which
  scrolls the sheet to that row. A button rather than a clickable card: a card that
  reacts to a click is an affordance only a mouse user finds, and the cell reference is
  the thing somebody actually wants — the row to go and change.

**Verified in the browser.** Clicking `1!E51` fired `sheetpane-select` with the right
value (*"For internal planning use…"*). Selecting `2!E10` on the sheet moved the tab from
PDF page 1 to page 2 and lit both overlay boxes for `left-sidebar-page-title`.

## What is left

**DoD 6's browser test only.** The ARCHITECTURE spec section and diagram are redrawn and
re-rendered, SR-SURFACE-PARITY has its two UI-only rows (*the workbook as a sheet* and
*sheet ↔ PDF*), SR-NPM-PACKAGES names both sheetpane packages as third-party runtime
dependencies pinned together, and the register claims the two new files. What is missing
is a Playwright test driving the sheet through `@sheetpane/testing`'s locators — the
harness is the browser-test item, which has not started. Writing one here would mean
standing up Playwright as a side effect of a UI item, which is that item's job.

The 23-check `spec-sheet-marks.ts` covers the mapping itself headlessly, so what the
browser test would add is the wiring: that a click on a cell really moves the page. That
was verified by hand today and is written down above; it is not yet guarded.

## Blockers

- **None, as of 2026-11-09.** All three cleared:
  - **sheetpane is published** — `@sheetpane/grid` **0.5.1**, MIT, the same version as the
    `@sheetpane/import` the spec intake already uses. Its README documents
    `<sheetpane-excel>`, `<sheetpane-errors>` and `mode="edit"`, so W-47's half is
    published too. (Checked against the registry, not against memory.)
  - **W-02 gives it the validation cells** — confirmed by driving the tab on
    `report-spec-with-errors.xlsx`: ten refused rows, each in plain words with its cell
    (`1!F15`, `2!G31`, …).
  - **W-04 gives it the result cells** — same run on `report-with-deviations.pdf`: every
    element reports expected, actual, delta and the cell it came from.

## Record affected

[SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md) — decision 14's validation report gains its
on-screen form. [SR-SPEC-CHECK](../../records/0102_SPEC-check.md) — results shown on the sheet.
[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) — sheetpane as a dependency.
[SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) — UI-only row.

## Hazards

- **The sealed folder:** the Specification tab lives in `packages/spec/src/`; wiring sheetpane in
  happens on the spec machine, whose dependency allow-list (`packages/spec/README.md`) must
  admit `@sheetpane/grid` and `@sheetpane/import` first.
- **Version drift:** `@sheetpane/grid` and W-02's `@sheetpane/import` at different versions are
  two readers again — pin both to one version and bump them together. The DoD 2 test is the guard.
- **Formatting:** fills and bold are sheetpane's opt-in styles plugin; without it an editing mark
  (a highlight fill, W-02 decision 11) reaches the screen only as a mark. Whether to load it is
  this item's call.

## Reference

- Designs: [`work/design/`](../design/README.md) — `Spec-Intake.dc.html`, `Spec-Results.dc.html`, `Components.dc.html`
- [arpitarya/sheetpane](https://github.com/arpitarya/sheetpane) · [W-02](W-02-excel-spec-comparison.md) · [W-04](W-04-spec-check-v2.md) · [W-47](W-47-sheet-editor.md) · [W-42](W-42-pdf-viewer-popup.md)
