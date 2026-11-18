# Template v2 — the workbook structure, for converting a spec into it

> Converting a spec with an AI agent? [`PROMPT.md`](PROMPT.md) is the prompt; attach this
> file with it.

**What this file is.** A complete, self-contained description of the `.xlsx`
structure pdfsuite reads, taken from the working fixture
`report-spec-with-errors.xlsx` and from the reader itself. Hand this file to an
AI agent together with somebody's existing spec — a Word document, a PDF, a
differently shaped spreadsheet, a page of notes — and it has everything it needs
to produce a workbook this tool will accept.

**Read this first, because it is the whole philosophy:**

> **The reader never guesses.** A cell that is blank is blank, not "the usual
> value". A unit that is missing is an error, not an inch. A value that says
> "about 10" is an error, not 10. Every row that cannot be read exactly is
> **refused** — it produces no check at all — and the person is told which cell
> to fix.

So when you convert, **a row you are unsure about is better left out, or marked
`Check? = Note`, than filled in with a plausible guess.** A wrong guess becomes a
confident finding about a document that was fine.

---

## 1 · The workbook at a glance

Four kinds of sheet, in this order:

| # | Sheet | Required | What it is |
|---|---|---|---|
| 1 | **`Pages List`** | **yes** — the file is not Template v2 without it | one row per page of the report |
| 2 | **`Settings`** | yes | tolerances, page size, pixel density |
| 3 | **`Lists`** | yes | the vocabulary: which parameters exist and what each may hold |
| 4+ | **one sheet per page** | yes | the actual specification, one row per measurement |

The page sheets are named by the **`Tab`** value in `Pages List` — in the
fixture `1`, `2`, `3`, `4`. The name is a label, not a page number: it is simply
what the `Tab` column says.

> **Detection rule:** a workbook with no sheet called `Pages List`
> (case-insensitive) is treated as a *legacy* file. It is not rejected — it is
> read as best it can be and handed back as a **draft** Template v2 workbook with
> every inferred cell marked for a human to confirm. It is never checked against
> a PDF. So the presence of `Pages List` is what makes a workbook "the required
> structure".

---

## 2 · `Pages List`

Row 1 is the header. One row per page, from row 2 until the first **completely
blank row** — anything after that blank row is treated as free prose notes and
ignored.

| Col | Header | Required | Values |
|---|---|---|---|
| A | `Tab` | yes | the name of this page's sheet, e.g. `1` |
| B | `Page name` | yes | human name, e.g. `Fleet highlights` |
| C | `Page type` | yes | `Required` · `Optional` · `Conditional` |
| D | `Orientation` | no | `Landscape` · `Portrait` |
| E | `Variant group` | no | pages that are alternatives to one another share a group name |
| F | `Repeats` | no | `1`, `0–1`, `1+` … how many times the page may appear |
| G | `Identifying text` | **yes in practice** | text that appears on that page in the PDF |
| H | `Comments` | no | free text |

**`Identifying text` is how pages are matched, not the page number.** The checker
finds each spec page in the PDF by searching for this text, so a PDF with an
extra cover page still lines up. Give it something short and stable that appears
on that page and nowhere else — a heading, not a date.

**`Page type` decides what a missing page means:**

| Value | If the page is not in the PDF |
|---|---|
| `Required` | an **error** |
| `Optional` | a note — fine either way |
| `Conditional` | never a failure; it depends on the data |

A page found **out of order** is a warning and is still checked.

### Example

```
Tab | Page name            | Page type   | Orientation | Variant group | Repeats | Identifying text              | Comments
1   | Cover                | Required    | Landscape   |               | 1       | Fleet Operations Review       |
2   | Fleet highlights     | Required    | Landscape   |               | 1       | Fleet Highlights              |
3   | Delivery performance | Optional    | Landscape   |               | 0–1     | Delivery Performance by Region| Optional page
4   | Fuel efficiency trend| Conditional | Landscape   |               | 0–1     | Fuel Efficiency Trend         | Shown only when three or more months
```

---

## 3 · `Settings`

Four columns: `Setting`, `Value`, `Unit`, `Note`. These are the nine the reader
looks for.

| Setting | Value | Unit | What it does |
|---|---|---|---|
| `Template version` | `2` | | must be `2` |
| `Position tolerance` | `0.06` | `in` | used by any position row whose own `Tolerance` is blank |
| `Size tolerance` | `0.06` | `in` | same, for sizes |
| `Font size tolerance` | `2` | `pt` | same, for font sizes |
| `Line spacing tolerance` | `0.03` | `in` | same, for line spacing |
| `Colour threshold` | *(blank)* | `ΔE` | perceptual colour distance; blank = the tool default |
| `Page width` | `11` | `in` | a PDF page of another size is a finding |
| `Page height` | `8.5` | `in` | |
| `Pixels per inch` | *(blank)* | `px/in` | **see below** |

### The `px` rule — the one that catches people

**`px` is only ever a declared conversion.** If `Pixels per inch` is blank, then
**every row whose unit is `px` is an error** — the reader will not assume 72, 96
or 144.

So when converting: if the source spec uses pixels, you must either

- fill in `Pixels per inch` with the number the source actually states, or
- convert the values to a physical unit yourself and write that unit, or
- leave the row refused and let a human decide.

Never invent a density.

---

## 4 · `Lists` — the vocabulary

This sheet is what makes a workbook self-describing: it declares which parameter
names exist and the rules for each. The reader checks every page-sheet row
against it, so **a parameter not listed here cannot be used**.

Columns, each an independent list read downwards from row 2:

| Col | Header | Contents |
|---|---|---|
| A | `Group` | `Position` `Size` `Image` `Text` `Font` `Colour` `Table` `Graph` `Data` `Note` |
| C | `Unit` | `in` `mm` `cm` `pt` `px` `%` `count` — every unit the suite knows |
| E | `Parameter` | the parameter name (table below) |
| F | `Kind` | `length` `points` `count` `lengths` `text` `list` `font` `colour` `yesno` |
| G | `Units allowed` | space-separated, e.g. `in mm cm pt px %`; blank = no unit |
| H | `Unit required` | `yes` / `no` |
| I | `Number?` | `yes` / `no` — must `Value` parse as a number |
| J | `From required` | `yes` / `no` — must the `From` column be filled |
| K | `From` | `top of page` `left of page` `right of page` `bottom of page` `top of container` `left of container` `right of container` `bottom of container` |
| M | `Check?` | `Yes` `Note` `No` |
| N | `Case` | `Title` `Sentence` `Upper` `Lower` |
| O | `Font` | `Helvetica` `Times` `Courier` — the font names this spec uses |
| P | `Colour name` | the palette's names |
| Q | `Hex` | the hex for each name, same row as P |

### The parameter catalogue

| Parameter | Kind | Units allowed | Unit req. | Numeric | `From` req. |
|---|---|---|---|---|---|
| `Top` | length | in mm cm pt px % | yes | yes | **yes** |
| `Left` | length | in mm cm pt px % | yes | yes | **yes** |
| `Right` | length | in mm cm pt px % | yes | yes | **yes** |
| `Bottom` | length | in mm cm pt px % | yes | yes | **yes** |
| `Baseline` | length | in mm cm pt px % | yes | yes | **yes** |
| `Wrap at` | length | in mm cm pt px % | yes | yes | **yes** |
| `Width` | length | in mm cm pt px % | yes | yes | no |
| `Height` | length | in mm cm pt px % | yes | yes | no |
| `Row height` | length | in mm cm pt px % | yes | yes | no |
| `Weight` | points | pt | yes | yes | no |
| `Font size` | points | pt | yes | yes | no |
| `Line spacing` | points | pt | yes | yes | no |
| `Columns` | count | count | yes | yes | no |
| `Rows` | count | count | yes | yes | no |
| `Column widths` | lengths | in mm cm pt px % | yes | no | no |
| `Wording` | text | — | no | no | no |
| `Alternative wording` | text | — | no | no | no |
| `Line break after` | text | — | no | no | no |
| `Italic words` | text | — | no | no | no |
| `File name` | text | — | no | no | no |
| `Column headers` | text | — | no | no | no |
| `Chart type`, `Title`, `Categories`, `Series 1`, `Series 2`, `Y axis`, `Gridlines`, `Legend`, `Data label`, `Data`, `Note` | text | — | no | no | no |
| `Case` | list | — | no | no | no |
| `Column alignment` | list | — | no | no | no |
| `Font` | font | — | no | no | no |
| `Colour` | colour | — | no | no | no |
| `Fill` | colour | — | no | no | no |
| `Bold` | yesno | — | no | no | no |
| `Italic` | yesno | — | no | no | no |
| `Underline` | yesno | — | no | no | no |

**You may add rows to `Lists`.** The palette (`Colour name` / `Hex`), the font
list and the group names are this report's, not the tool's — replace them with
the ones the source spec actually uses. Adding a brand-new *parameter* only makes
sense if the checker knows how to measure it, so prefer the ones above.

---

## 5 · The page sheets

One sheet per row of `Pages List`, named by its `Tab`. Row 1 is the header; rows
are read from row 2 until the **first completely blank row** (prose notes may
follow it and are ignored).

| Col | Header | What goes in it |
|---|---|---|
| A | `Element` | the thing on the page, e.g. `Title block` |
| B | `Part` | a part of it, e.g. `Report title` |
| C | `Group` | from `Lists!A` |
| D | `Parameter` | from `Lists!E` |
| E | `Value` | the expected value — **the number only** |
| F | `Unit` | the unit — **never inside `Value`** |
| G | `From` | which edge a distance is measured from |
| H | `Check?` | `Yes` · `Note` · `No` |
| I | `Tolerance` | a number; blank means "use the Settings default" |
| J | `Exact text` | `Yes` / `No` — must the wording match exactly |
| K | `Pattern` | for dynamic text, e.g. `Quarter {n} {yyyy}` |
| L | `Notes` | free text for a human |
| M | `Description` | free text |

### Labels are merged, not repeated

`Element`, `Part` and `Group` are **merged cells** spanning the rows they cover.
The reader resolves a blank `Element`/`Part`/`Group` by looking up the merge the
file declares — **not** by copying the last non-blank value downwards. Those two
produce the same answer in a tidy file and different answers in a messy one.

So: when you write the workbook, **declare real merged ranges**. A blank label
cell that is not inside a merge is an error (`label-blank-outside-merge`).

### `Check?` — what the row is for

| Value | Meaning |
|---|---|
| `Yes` | check this against the PDF |
| `Note` | record it, do not check it — for things stated but not measurable |
| `No` | excluded on purpose |

### A worked block

From sheet `1`, the `Title block` element (merged `Element` across rows 7–27,
merged `Part` across each sub-block):

```
Element     | Part         | Group    | Parameter   | Value                  | Unit | From         | Check? | Exact text | Notes
Title block | Container    | Position | Top         | 4.75                   | in   | top of page  | Yes    |            |
            |              |          | Left        | 0.75                   | in   | left of page | Yes    |            |
            |              | Size     | Height      | 2.25                   | in   |              | Yes    |            |
            |              |          | Width       | 9.5                    | in   |              | Yes    |            |
            |              | Colour   | Fill        | #E4E9F2                |      |              | Yes    |            | Cloud Grey
            | Report title | Position | Top         | 5.75                   | in   | top of page  | Yes    |            |
            |              |          | Left        | 1                      | in   | left of page | Yes    |            |
            |              | Text     | Wording     | Fleet Operations Review|      |              | Yes    | Yes        |
            |              |          | Case        | Title                  |      |              | Yes    |            |
            |              | Font     | Font        | Helvetica              |      |              | Yes    |            |
            |              |          | Font size   | 28                     | pt   |              | Yes    |            |
            |              |          | Bold        | Yes                    |      |              | Yes    |            |
            |              | Colour   | Colour      | #0B3C5D                |      |              | Yes    |            | Kestrel Navy
```

### Dynamic text

Text that changes per run is written as the literal `<<dynamic>>` in `Value`,
with `Pattern` giving its shape and `Check?` usually `Note`:

```
Reporting period | Text | Wording | <<dynamic>> |  |  | Note | No | Quarter {n} {yyyy} | sample value: Quarter 3 2026
```

`<<dynamic>>` with no `Pattern` is a warning.

---

## 6 · The rules that refuse a row

These are the whole difference between a workbook that works and one that is
half-refused. Each is an **error**: the row produces no check, and the message
names its cell.

| Code | What triggers it | How to write it instead |
|---|---|---|
| `unit-missing` | a numeric parameter with a blank `Unit` | put the unit in `F` |
| `unit-in-value` | `Value` reads `14 pt`, `5.75 in` | `Value` = `14`, `Unit` = `pt` |
| `unit-unknown` | a unit the suite does not know, e.g. `inch` | use `in` `mm` `cm` `pt` `px` `%` `count` |
| `unit-disallowed` | a real unit this parameter does not take | use one from `Units allowed` |
| `px-without-density` | `Unit` is `px` and `Settings!Pixels per inch` is blank | declare the density, or convert |
| `number-expected` | `Value` is not a number where one is required, e.g. `7 including the header row` | `Value` = `7`, the rest to `Notes` |
| `approximate-value` | `~10`, `about 10`, `approx 10` | state the number and a `Tolerance` |
| `range-reversed` | `5.6–5.4` | smaller number first |
| `range-and-tolerance` | a range **and** a `Tolerance` | a range *is* a tolerance — give one |
| `from-missing` | `Top`/`Left`/`Right`/`Bottom`/`Baseline`/`Wrap at` with a blank `From` | fill `From` from the `Lists!K` list |
| `parameter-unknown` | a `Parameter` not in `Lists!E` (e.g. `Fnt size`) | fix the spelling, or add it to `Lists` |
| `colour-name-mismatch` | a hex in `Value` that disagrees with the name in `Notes` | make them agree, or drop the note |
| `check-unknown` | `Check?` is not `Yes`/`Note`/`No` | use one of the three |
| `label-blank-outside-merge` | a blank `Element`/`Part`/`Group` not covered by a merge | merge the cells properly |
| `settings-unreadable` · `pages-list-unreadable` · `sheet-missing` · `template-version-unknown` | the sheet is missing or its header is wrong | fix the sheet |

Ranges **are** supported where the source genuinely gives one: `5.4–5.6` in
`Value`, with `Tolerance` left blank.

---

## 7 · Converting an existing spec — the procedure

1. **Inventory the pages.** One row of `Pages List` per page. For each, pick
   `Identifying text` that really appears on the page and is unlikely to change.
   Mark anything the source calls "if applicable" as `Optional` or `Conditional`.
2. **Fill `Settings`.** Copy the page size and any tolerances the source states.
   If the source gives no tolerance, keep the defaults above. **Only fill
   `Pixels per inch` if the source states a density.**
3. **Fill `Lists`.** Replace the colour palette and font list with the source's
   own. Keep the parameter catalogue as-is unless you have a reason.
4. **One sheet per page.** Walk the source top to bottom, turning each statement
   into one row per *measurable fact*. "The title sits 5.75 in from the top, in
   28pt Helvetica Bold, Kestrel Navy" is **five** rows, not one.
5. **Split every value from its unit.** This is the single most common conversion
   error.
6. **Merge the label columns** for runs of rows belonging to one element or part.
7. **Anything you had to interpret** — a sentence like "roughly a third of the
   way down", a unit you inferred, a colour you matched by eye — set `Check?` to
   `Note` and say so in `Notes`. Do not turn it into a measurement.

### Self-check before handing the file over

- [ ] A sheet named exactly `Pages List` exists.
- [ ] Every `Tab` in `Pages List` has a sheet of that name, and every page sheet
      is listed.
- [ ] `Settings!Template version` is `2`.
- [ ] No `Value` cell contains a unit.
- [ ] Every row whose parameter is numeric has a `Unit` from its `Units allowed`.
- [ ] No `px` anywhere unless `Pixels per inch` is filled.
- [ ] Every `Top`/`Left`/`Right`/`Bottom`/`Baseline`/`Wrap at` row has a `From`.
- [ ] Every `Parameter` appears in `Lists!E`; every `Group` in `Lists!A`.
- [ ] `Check?` is `Yes`, `Note` or `No` in every row.
- [ ] Blank `Element`/`Part`/`Group` cells are inside declared merges.
- [ ] No `~`, "about", "approx", "roughly" in any `Value`.

### Then verify it for real

```bash
pdfsuite spec <your-workbook>.xlsx --validate-only --out ./out
```

Exit `0` means every row reads. Exit `2` means some rows were refused; `out/validation.json`
lists each one with its sheet, cell and code, and `out/<name>.annotated.xlsx` is your
workbook back with those cells filled red and the message on the cell. Fix and run again.

The same thing happens in the app's **Specification** tab: upload the workbook on its own
and it reports before any PDF is involved.

---

## 8 · Fixtures in this folder

| File | What it is |
|---|---|
| `report-spec.xlsx` | a clean workbook — 0 errors, 0 warnings, 105 checkable rows |
| `report-spec-with-errors.xlsx` | the same workbook with **ten planted errors**, one per rule above |
| `expected-validation.json` | exactly which ten, with their cells and codes — the oracle |
| `report.pdf` · `report-with-deviations.pdf` | the PDFs those specs are checked against |

Every one of them is **fictional**. Real spec workbooks never leave the spec
machine; that is a rule about data, not about code.
