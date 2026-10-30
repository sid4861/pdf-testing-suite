---
type: Reference
description: "The Fleet Operations Review spec as a Template v2 workbook — one row per parameter, every unit explicit, labels merged and centred over their rows, dropdowns and red-cell rules built in — plus a copy with ten planted intake errors and the validation the tool must produce. Fixtures for W-02, W-46 and W-48."
---

# Template v2 spec workbook — explicit units, no guesswork

**What this is.** A fictional 4-page landscape *Fleet Operations Review* — images, a graph
drawn as vectors, a graph embedded as an image, three tables, paragraphs — its spec as a
**Template v2** workbook, and the two PDFs it is checked against. The spec uses the layout of [SR-SPEC-INTAKE](../../../records/0101_SPEC-intake.md) decisions 7
and 7a: one row per parameter, a number in *Value* and its unit in *Unit* chosen from a short
list, and the labels — Element, Part, Group — **merged and centred** over the rows they cover
instead of repeated on every line. A row is named by its sheet and row number; there is no ID
column.

**The only spec sample.** It replaced the legacy nested-layout sample
(`tools/samples/excel-spec-hierarchical/`, deleted 2026-10-18 on Arpit's instruction; it is in
git history before that date). The PDFs and images moved here unchanged.

**Arpit, 2026-10-18:** *"If there is a value like 2 and it is in pixels, I want to be 100 %
sure that's what it is. No guesswork. If it is wrong, throw an error."*

| file | what it is |
|---|---|
| `report-spec.xlsx` | **the spec, and the truth** — `Pages List`, `Settings`, `Lists`, then sheets `1`–`4`; validates clean |
| `report-spec-with-errors.xlsx` | the same workbook with **ten planted intake errors** (table below) |
| `expected-validation.json` | the sheet, cell, id, code and message the validator must report for each of the ten; zero errors for the clean file |
| `generate.ts` | builds all three from one data definition — TypeScript, `jszip` only, deterministic |
| `report.pdf` | matches the spec: every measured element is 0.000 in off |
| `report-with-deviations.pdf` | the same report with the 12 deviations tabled under *Expected results* |
| `assets/*.png` | the images the spec names by file name |

**Regenerate:** `node --experimental-strip-types work/samples/excel-spec-template-v2/generate.ts`
(Node 22.6+; `jszip` from the repository's `node_modules`). Same bytes every run. **The PDFs
and images are frozen:** their Python generator went with the legacy sample, and SR-STACK-TYPESCRIPT
forbids bringing it back — W-37's TypeScript generator rebuilds them byte for byte.

## How the workbook is laid out

**`Pages List`** — Tab · Page name · Page type (Required · Optional · Conditional, also the
tab colour) · Orientation · Variant group · Repeats · Identifying text · Comments.

**`Settings`** — tolerances, pinned page size, colour threshold, **Pixels per inch** (blank
until a sheet needs `px`), template version. **No default unit lives here.**

**`Lists`** — the vocabulary every dropdown reads: groups; **parameters with their kind,
allowed units, and whether a unit, a number or a From is required**; units; edges; fonts;
named colours with their hex.

**Page sheets `1`–`4`** — one row per parameter; Element, Part and Group are merged cells
spanning their rows (shown once here, as in the sheet):

| row | Element | Part | Group | Parameter | Value | Unit | From | Check? | Tolerance | Exact text | Pattern | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 17 | Title block | Report title | Position | Top | 5.75 | in | top of page | Yes | | | | |
| 18 | ⋮ | ⋮ | ⋮ | Left | 1 | in | left of page | Yes | | | | |
| 19 | ⋮ | ⋮ | Text | Wording | Fleet Operations Review | | | Yes | | Yes | | |
| 23 | ⋮ | ⋮ | Font | Font size | 28 | pt | | Yes | | | | |
| 27 | ⋮ | ⋮ | Colour | Colour | #0B3C5D | | | Yes | | | | Kestrel Navy |
| 30 | ⋮ | Reporting period | Text | Wording | `<<dynamic>>` | | | Note | | No | Quarter {n} {yyyy} | sample value: Quarter 3 2026 |

Sheet `2`, row 84: Footer · Page number · Position · **Baseline** · 0.4 · in · bottom of page.

**Merges are read, never guessed.** A merged range is a declared fact in the file
(`<mergeCell ref="A7:A47"/>`), so the reader applies the label to exactly those rows. Merges
are allowed in Element, Part and Group only; a merge that reaches Parameter or any column to
its right is an error, and so is a blank Element, Part or Group cell that is not inside a
merge — the reader never forward-fills a blank. Excel refuses to sort a range whose merges
differ in size, and a row inserted inside a merge extends it; a row inserted at a merge's edge
has blank labels and is an error until the merge is extended over it. Within one Element ·
Part the rows run in the Lists sheet's group order — Position · Size · Image · Text · Font ·
Colour · … — so each merged Group block is one contiguous run.

**One cell, one fact.** The legacy cell `"0.4 inches from bottom of page to the text
baseline"` is now *Parameter* `Baseline` · *Value* `0.4` · *Unit* `in` · *From* `bottom of
page`. `"Wrap to next line at 10.25 inches"` is its own `Wrap at` row; `"Line break after
"Fleet", 26 pt baseline to baseline"` is a `Line break after` row and a `Line spacing` row.
A table's header styling is rows with *Part* = `Header row`.

## The unit rule — what is an error

| parameter kind | examples | Unit must be | Value must be | From |
|---|---|---|---|---|
| length | Top · Left · Right · Bottom · Baseline · Wrap at · Width · Height · Row height | `in` `mm` `cm` `pt` `px` `%` | a number | required for positions |
| points | Font size · Line spacing · Weight | `pt` | a number | — |
| count | Columns · Rows | `count` | a number | — |
| lengths | Column widths | `in` `mm` `cm` `pt` `px` `%` | numbers separated by `\|` | — |
| text · yes/no · colour · font · list | Wording · Bold · Colour · Font · Case … | blank | as the kind says | — |

Each of these is an **error on that row** — the row is removed from the check and listed
with its cell, never read as "probably inches":

- a unit-taking parameter with a **blank Unit**
- a unit **written inside the Value** (`14 pt`), or any text where a number is required
- a Unit **not on the Lists sheet** (`inch`), or one the parameter cannot take
- `px` while *Settings · Pixels per inch* is blank
- an **approximate** value (`~10`, `about 10`) — state a Tolerance instead
- a **range and a Tolerance** on the same row
- a **Parameter not on the Lists sheet** (the nearest name is suggested)
- a **position with no From**
- a colour whose name on the Lists sheet has a **different hex**

Nothing falls back to the Settings sheet, the row above, the column header or the
parameter's usual unit (SR-SPEC-INTAKE decision 7a).

## What Excel catches before the upload does

The workbook carries its own guard rails — Excel data validation and conditional formatting,
plain `.xlsx` XML, no macros:

| guard | how it shows |
|---|---|
| Group · Parameter · Unit · From · Check? · Exact text · Page type · Orientation | dropdowns fed by `Lists`; a typed value off the list is refused |
| Element · Part · Group | merged and centred over their rows — the hierarchy is visible, and nothing is repeated |
| Unit blank where the parameter needs one | **Unit cell red** |
| Unit not allowed for that parameter | **Unit cell red** |
| `px` with no *Pixels per inch* in Settings | **Unit cell red** |
| text in a Value that must be a number | **Value cell red** |
| Parameter not on the Lists sheet | **Parameter cell red** |
| position with no From | **From cell red** |

The upload repeats every one of these and adds the ones Excel cannot see: a colour name whose
hex disagrees with `Lists`, an approximate value, a range plus a Tolerance, a blank label outside
a merge, a merge reaching a value column, hidden rows, formulas (decision 13). The **Validate tab** (W-46) shows that report, the
assertion each accepted row became in plain words, and hands back the workbook with the bad
cells filled red.

## `report-spec-with-errors.xlsx` — the ten planted errors

| # | sheet · cell | row | what is wrong | code |
|---|---|---|---|---|
| 1 | 1 · F23 | Report title · Font size `28` | Unit blank | `unit-missing` |
| 2 | 1 · E34 | Reporting period · Font size `14 pt` | unit inside the Value | `unit-in-value` |
| 3 | 1 · F15 | Company logo · Width `168 px` | `px` but Settings · Pixels per inch is blank | `px-without-density` |
| 4 | 1 · E11 | Container · Fill `#E4E9F2`, Notes *Cloud Grey* | Cloud Grey is `#EEF1F4` on Lists | `colour-name-mismatch` |
| 5 | 1 · E55 | Disclaimer · Line spacing `~10` | approximate value | `approximate-value` |
| 6 | 2 · F71 | Image · Height `2.4 inch` | `inch` is not a unit on Lists | `unit-unknown` |
| 7 | 2 · G31 | Highlights table · Top `0.75 in`, From blank | a position needs its edge | `from-missing` |
| 8 | 3 · D7 | Title · `Fnt size` | parameter not on Lists (nearest: Font size) | `parameter-unknown` |
| 9 | 3 · E41 | Regional table · Rows `7 including the header row` | prose where a number is required | `number-expected` |
| 10 | 4 · E42 | Paragraph · Top `5.4–5.6`, Tolerance `0.1` | a range and a Tolerance | `range-and-tolerance` |

Rows 1, 2, 3, 6, 7, 8 and 9 show red in Excel; 4, 5 and 10 are caught by the upload only.
`expected-validation.json` is the oracle; W-02 DoD 8 freezes it, and the clean workbook must
produce no error and no warning.

## Expected results against the PDFs

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

This is a checker defect W-04 DoD 1 fixes, left in the sample on purpose.

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

### In this layout

The three "not detectable today" deviations are explicit rows: *Italic words* `Quarter`
(sheet 1, row 31) and *Fill* `#EEF1F4` (sheet 1, row 11) are **Check? = Yes** and become
findings once W-04 lands fonts and colour; the graph series colours are **Check? = Note** rows
and sit in coverage, never as a pass.
