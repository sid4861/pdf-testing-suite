---
type: Index
description: "The UI designs and the Proof design system, exported from the Design canvas 'PDF Suite — Proof redesign' — what each file is and which work item builds it."
---

# `work/design/` — the designs and the design system

An export of the Claude Design canvas **PDF Suite — Proof redesign** (Arpit's, private),
taken 2026-10-18. **The canvas is the source; this folder is its copy in the repo.** When
the canvas changes, re-export every file here in one change.

## What is here

| file | what it is | built by |
|---|---|---|
| `proof.css` | **Proof**, the design system — colour, type, spacing tokens and every component class the screens use | W-50 |
| `Main.dc.html` | the design-system board: principles, colours, type, space, components | W-50 |
| `canvas.json` | the canvas index: artboard sizes, positions, titles | — |
| `Compare-Load.dc.html` | Compare › One — the empty state | W-51 · W-06 |
| `Compare-SideBySide.dc.html` | Compare › One — side by side, changes panel | W-51 |
| `Compare-Overlapping.dc.html` | Compare › One — pixel diff and geometry | W-51 |
| `Compare-Report.dc.html` | Compare › One — report and the Export menu | W-51 |
| `Compare-PairPages.dc.html` | Compare › One — the pair-pages dialog | W-51 |
| `Bulk.dc.html` | Compare › Many (was Bulk compare) | W-51 · W-06 |
| `Spec-Intake.dc.html` | Specification — the workbook in sheetpane with validation marks and the error list | W-46 · W-02 |
| `Spec-Results.dc.html` | Specification — pass/fail on the sheet beside the PDF page | W-46 · W-04 |
| `Sheet-Editor.dc.html` | Specification — fixing the workbook in sheetpane's Edit mode | W-47 |
| `Inspect.dc.html` | Inspect — element, document properties, fonts, annotations | W-51 · W-14…W-26 |
| `Viewer.dc.html` | `<pdfsuite-pdf-viewer>` opened from any app | W-42 |
| `Viewer-Suite.dc.html` | the same viewer opened from a pdfsuite finding | W-42 |
| `Viewer-Levels.dc.html` | the viewer's sources, element and four levels | W-42 |
| `Components.dc.html` | the web components — pdfsuite's PDF viewer and sheetpane | W-42 · W-46 · W-47 |
| `States.dc.html` | password, XFA, scanned page, page-size states | W-16 · W-18 · W-20 · W-24 |

## Reading the files

- A `*.dc.html` file is a Design Component: HTML plus a small logic block. It renders in
  the Design canvas, which supplies `support.js`; it does **not** open on its own in a browser.
- `proof.css` is plain CSS and is the part a build copies from (W-50).
- Fonts are IBM Plex Sans and IBM Plex Mono (SIL Open Font License — L2). The boards load
  them from Google Fonts; the app must ship them locally (W-35: nothing from a CDN).

## What the designs settle, and what they do not

- **Settled in the designs, owed rulings in the queue:** tab names and order (W-06), the
  viewer package (W-42).
- **sheetpane** ([arpitarya/sheetpane](https://github.com/arpitarya/sheetpane)) owns the
  sheet and the error list; its tag names and API in these boards are illustrative until
  sheetpane publishes its own.
- The page contents drawn on each board are grey placeholder lines, not real documents;
  every number is sample data.
