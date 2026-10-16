---
type: Reference
description: "A nested-layout Excel spec (Pages List + one sheet per page) and the 4-page landscape PDFs built from it — images, graphs, tables and text. Fixtures for W-02."
---

# Nested-layout Excel spec — Pages List, page sheets, and their PDFs

**What this is.** A fictional 4-page landscape report (*Fleet Operations Review*) with
images, two graphs, three tables and text, plus the Excel spec it is built from. It
uses the nested sheet layout that production spec workbooks commonly use. Built for
[W-02](../../../work/open/W-02-excel-spec-comparison.md); the design is in
[the proposal](../../../work/proposals/excel-spec-comparison.md).

| file | what it is |
|---|---|
| `report-spec.xlsx` | **the spec, and the truth.** Sheet `Pages List`, then sheets `1`–`4`, one per PDF page |
| `report.pdf` | matches the spec: every measured element is 0.000 in off |
| `report-with-deviations.pdf` | the same report with the 12 deviations listed below |
| `assets/*.png` | the images the spec names by file name |
| `generate.py` | builds everything from one data definition — deterministic |

**Regenerate:** `python tools/samples/excel-spec-hierarchical/generate.py` — needs
`openpyxl`, `reportlab`, `pillow`, `matplotlib`.

## How the workbook is laid out

- **`Pages List`** — one row per PDF page: tab, page name, **page type** (Required ·
  Optional · Conditional, also shown as the tab colour), orientation, comments.
- **One sheet per page** — title row, an optional **IMPORTANT NOTE** box, then a table:

| A · Element | B · Sub-element | C · Item | D · Parameter group | E · Parameter | F · Description |
|---|---|---|---|---|---|
| Title block | Contents | Report title | Alignment | Vertical | 5.75 inches from top of page |
| | | | | Horizontal | 1 inches from left of page |
| | | | Text | Wording | Fleet Operations Review |
| | | | | Font size | 28 |
| | | | | Font color | #0B3C5D (Kestrel Navy)   R11 G60 B93 |

- **A–D are merged cells** spanning their children; the hierarchy lives in the merges.
- **Values are prose**, with units inside: `".75 inches from left of page"`, `"14 pt"`
  next to a bare `"28"`, `"0.4 inches from bottom of page to the text baseline"`.
- **Parameter groups:** Alignment · Size · Color · Image · Text · Table · Graph.

## What the sample exercises

| feature | where |
|---|---|
| **Images** by file name, position and size | cover artwork, logo (p1); depot map (p2) |
| **Containers** — coloured boxes whose contents are positioned inside them | title block (p1); left sidebar (p2) |
| **Graph drawn as vectors** — bars, axes and labels are PDF drawing and text | bar chart (p3) |
| **Graph embedded as an image** | fuel trend line chart (p4) |
| **Tables** — columns, widths, alignment, row height, header fill, bold last row | p2, p3, p4 |
| **Paragraphs** — wrap point, line spacing | every page |
| **Partial styling** — only one word italic | "Quarter" in the reporting period (p1) |
| **Dynamic text** — `<<dynamic>>` plus rules and a sample value | reporting period, prepared for (p1); table data |
| **Conditional wording** — `NOTE: IF … use the wording …` | report title (p1) |
| **Line break rule** inside one text | sidebar page title (p2) |
| **Optional and conditional pages** | p3 optional; p4 conditional, with its rule in the IMPORTANT NOTE |
| **Cross-page consistency rule** in an IMPORTANT NOTE | p2 and p4 notes |
| Things **no check covers today**: colours, font names, bold, italic, case, graph series and axes | throughout |

## Expected results

Measured with pdf.js as the app reads PDFs (`top` = baseline minus font size).

### `report.pdf` — the matching PDF

All 25 measured elements are **0.000 in** off when text is grouped into lines within each
column. **The app's checker will still report three false failures today.** It groups text
into lines across the whole page width, so text side by side on the same baseline becomes
one line:

| page | what merges | effect today |
|---|---|---|
| 2 | sidebar title "Fleet" / "Highlights" with the highlights table's header and first row | title lines and the table header are mis-measured |
| 3 | graph title "Deliveries by region" with the regional table's header | table header row is lost; Top and Rows go wrong |

This is a checker defect for W-02 P1, left in the sample on purpose.

### `report-with-deviations.pdf`

| # | page | element | spec says | PDF has | expected result |
|---|---|---|---|---|---|
| 1 | 1 | Report title | 28 pt | 24 pt | **Font size FAIL** |
| 2 | 1 | Company logo | width 1.75 in | 2.0 in | **Width FAIL** |
| 3 | 1 | Reporting period | only "Quarter" italic | whole line italic | not detectable today |
| 4 | 1 | Title block container | #EEF1F4 | #E4E9F2 | not detectable today |
| 5 | 2 | Highlights table | 3.25 in from left | 3.45 in | **Left FAIL** |
| 6 | 2 | Summary paragraph | line spacing 15 pt | 12 pt | **Line spacing FAIL** |
| 7 | 2 | Depot map | height 2.4 in | 2.1 in | **Height FAIL** |
| 8 | 3 | Deliveries graph | series 1 blue, series 2 orange | swapped | not detectable today |
| 9 | 3 | Regional table | 7 rows | 6 (Central missing) | **Rows FAIL** |
| 10 | 3 | Footnote | "…one-hour window." | "…two-hour window." | **not found** |
| 11 | 4 | Fuel graph image | 1.3 in from top | 1.5 in | **Top FAIL** |
| 12 | 4 | Page number | "Page 4 of 4" | missing | **not found** |

Rows 3, 4 and 8 must show up as **unchecked** in spec coverage, never as a pass.
