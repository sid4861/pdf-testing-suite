# PDF Spec Standard

Reference for the JSON spec format consumed by the **Spec driven comparison** workspace and the
`pdfsuite` CLI.

Written to be used two ways: as the authority on what each field means, and as the
description of **Template v2**, the Excel workbook the app compiles into that JSON
(§7). Nobody writes the JSON by hand: it is what the workbook becomes, and every value
in it names the cell it came from.

---

## 1. What a spec is

A spec describes what a page **should** contain — text, images, tables, paragraphs — and
where. The checker renders the actual PDF, extracts its real content, and reports every
element as `pass`, `fail`, `not-found`, `warning` or `unverifiable`, with expected-vs-actual
values for each check. The last two matter: a page size that differs without being pinned is
a **warning**, and something the reading could not establish — no text layer, a font the PDF
does not name, a single-line paragraph — is **unverifiable**, never a failure of the document.

A spec is not a template and is not compared against another PDF. It is a standalone
statement of intent, which is what makes it usable when there is no reference document.

---

## 2. File structure

```json
{
  "title": "Monthly Statement Template v3",
  "units": "in",
  "pageSize": { "width": 8.5, "height": 11 },
  "tolerance": { "position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2 },
  "pages": [
    { "page": 1, "elements": [ /* … */ ] },
    { "page": 2, "elements": [ /* … */ ] }
  ]
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `title` | no | — | Shown on the report. Use the template name and version. |
| `units` | no | `"in"` | `"in"`, `"pt"`, or `"mm"`. Applies to **every** measurement except `fontSize`. |
| `pageSize` | no | — | Documentation only; not currently asserted. |
| `tolerance` | no | see §4 | Defaults for all elements. |
| `pages` | **yes** | — | Non-empty array. One entry per page you want checked. |

`pages[].page` is **1-based** and must be a number.

> **You do not have to renumber a single-page spec.** A spec exported from one sheet will say
> `"page": 1`. In the app, switch **Spec driven comparison** to **One page** and point it at whichever
> PDF page it actually describes — the spec is left alone, and the report records the mapping.
 Pages not listed are not checked. A
page number beyond the end of the PDF is reported as `not-found` for every element on it.

---

## 3. Coordinate system

- Origin is the **top-left corner of the page**.
- `top` increases **downward**, `left` increases **rightward**.
- Values are in `units` (inches by default).
- `fontSize` is always in **points**, regardless of `units`.

> **Excel note.** If your sheet records positions from the *bottom* of the page (some
> layout tools do), convert with `top = pageHeight − bottom − height` during export. The
> checker has no way to detect that mistake; everything will simply fail on `Top`.

---

## 4. Tolerances

```json
"tolerance": { "position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2 }
```

| Key | Default | Units | Applies to |
|---|---|---|---|
| `position` | `0.06` | spec units | `Left`, `Top` checks |
| `size` | `0.06` | spec units | `Width`, `Height` checks |
| `spacing` | `0.03` | spec units | paragraph `Line spacing` |
| `fontSize` | `2` | **points** | text `Font size` |

**Precedence:** element `tolerance` → spec-level `tolerance` → built-in default. Each key
resolves independently, so an element can override `position` alone and still inherit the
rest.

Set tolerances from what your renderer actually achieves. Too tight produces noise nobody
acts on; too loose lets real regressions through.

---

## 5. Element types

Every element carries these:

| Field | Required | Meaning |
|---|---|---|
| `type` | **yes** | `text` \| `image` \| `table` \| `paragraph` |
| `id` | **yes** | Stable identifier. Reporting only — **never used to find the element**. Keep it stable across revisions so results stay comparable. |
| `label` | no | Human name in the report. Defaults to the text (for `text`) or the `id`. |
| `top`, `left`, `right`, `bottom`, `baseline` | **at least one** | Expected position, spec units, **always from the page's top-left**, whatever edge the workbook measured from: the compiler knows the page size and converts, so `Right 0.5 in from right of page` on an 11 in page arrives as `right: 10.5`. Only the edges the workbook stated are present, and only those are checked — an element placed from the bottom-right is not silently also claiming a top. An element that states none cannot be found and is excluded with that said. |
| `tolerance` | no | Per-element override (§4). |
| `anchor` | no | Locate relative to a nearby label instead of by position (§6). |

### 5.1 `text`

A single line of static text.

```json
{
  "type": "text",
  "id": "statement-title",
  "label": "Statement title",
  "text": "MONTHLY STATEMENT",
  "match": "exact",
  "top": 0.75,
  "left": 0.75,
  "fontSize": 20
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `text` | **yes** | — | The string to find. Whitespace is collapsed and case is ignored. |
| `match` | no | `"contains"` | `"exact"` compares the whole line; `"contains"` matches a substring. |
| `fontSize` | no | — | Points. Omit to skip the font-size check entirely. |
| `font` | no | — | Family as the workbook writes it, e.g. `"Helvetica"`. A subset prefix (`BCDEEE+`) and the weight and slant words in the PDF's own font name are read and compared separately, so `Roboto-Light`, `Roboto Light` and `RobotoLight` are one font. |
| `bold`, `italic` | no | — | From the element's own rows. An explicit `bold: true` beats the family string. |
| `colour` | no | — | Hex, e.g. `"#0B3C5D"`. Compared as CIEDE2000 ΔE against the workbook's threshold (default 2.0), not as equal bytes — one digit apart is invisible and is not a defect. |

**How it is located:** all lines whose text matches are collected, then the one nearest the
expected `top` wins. Content is the anchor, position is the assertion — so an element that
moved is still *found*, and correctly reported as a `Top`/`Left` failure.

**Checks produced:** `Present`, `Left`, `Top`, and `Font size`, `Font` and `Colour` when
those are given. A neighbouring weight — Regular against Medium — is reported as a
*warning*, not a failure: it is usually a substituted font, and calling it a defect
teaches people to ignore the report. Where the PDF does not state a font or a fill colour
for that text, the check is **unverifiable** — a limit of the reading, never a verdict
about the document.

> `match: "contains"` is the default and is usually what you want for values that vary
> (dates, amounts, account numbers): specify the stable label portion only. Use `"exact"`
> for fixed headings where an accidental suffix should fail.

### 5.2 `image`

```json
{
  "type": "image",
  "id": "brand-logo",
  "label": "Brand logo",
  "top": 0.55,
  "left": 6.4,
  "width": 1.6,
  "height": 0.6,
  "anchor": { "text": "MONTHLY STATEMENT", "position": "right", "within": 6 }
}
```

| Field | Required | Meaning |
|---|---|---|
| `width`, `height` | **yes** | Expected size in spec units. |

**How it is located:** images carry no text, so without an `anchor` the checker picks the
image nearest the expected top-left. On a page with one image that always "finds" it —
useful for reporting drift, but it cannot detect the *wrong* image. On a page with several,
a large enough move can match a neighbour. **Use an `anchor` whenever a page has more than
one image.**

**Checks produced:** `Anchor` (if used), `Present`, `Left`, `Top`, `Width`, `Height`.

### 5.3 `table`

```json
{
  "type": "table",
  "id": "charges-table",
  "label": "Charges table",
  "top": 3.0,
  "left": 0.75,
  "width": 7.0,
  "rows": 5,
  "columns": 4
}
```

| Field | Required | Meaning |
|---|---|---|
| `width` | **yes** | Expected overall width in spec units. |
| `rows` | no | Expected row count, **including the header row**. Omit to skip. |
| `columns` | no | Expected column count. Omit to skip. |

**How it is located:** there are no ruling lines to rely on, so rows are inferred from text
— lines with **two or more** items falling inside the horizontal span. The first row must
start near the expected `top` (or near the anchor, if given); subsequent rows are collected
while the vertical gap stays under `max(rowHeight × 2, 24pt)`, which is what stops it
running on into the paragraph below.

**Checks produced:** `Anchor` (if used), `Present` (with the row count found), `Left`,
`Top`, `Width`, plus `Rows`/`Columns` when specified.

> Tables whose row count varies with data are the common case. Omit `rows` and assert
> position, width and `columns` only — otherwise the spec fails every time the data
> changes, which trains people to ignore it.

### 5.4 `paragraph`

```json
{
  "type": "paragraph",
  "id": "payment-terms",
  "label": "Payment terms",
  "text": "Payment is due within",
  "top": 6.2,
  "left": 0.75,
  "lineSpacing": 0.18
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `text` | **yes** | — | A **starting snippet**, not the whole paragraph. Used to locate the first line. |
| `match` | no | `"contains"` | As for `text`. |
| `lineSpacing` | **yes** | — | Expected distance between consecutive baselines, in spec units. |

Give enough of the opening words to be unique on the page, and no more — quoting the whole
paragraph makes the spec fail on any wording edit, which is what the Compare workspace is
for.

**Checks produced:** `Present`, `Left`, `Top`, `Line spacing`.

---

## 6. Anchors — locating by label instead of coordinates

An `anchor` ties an element to text that actually appears on the page. Add it whenever an
element's position depends on how much content sits above it.

```json
"anchor": {
  "text": "Statement period",
  "position": "below",
  "within": 2,
  "match": "contains",
  "occurrence": 1
}
```

| Field | Required | Default | Meaning |
|---|---|---|---|
| `text` | **yes** | — | Label to find. Case-insensitive, whitespace collapsed. |
| `position` | no | `"below"` | Where the element sits relative to the label: `above`, `below`, `left`, `right`. |
| `within` | no | `2` | Search distance from the label, in spec units. |
| `match` | no | `"contains"` | How `text` is matched. |
| `occurrence` | no | `1` | Which occurrence to use (1-based, reading order) when the label repeats. |

### What an anchor does and does not change

An anchor changes **how the element is found**, never **what is asserted**. `top` and
`left` are still required and still checked — so a correct anchor plus a wrong position
reports a clean `Top` failure instead of an uninformative `not-found`.

Measured on the sample statement, with the table's `top` deliberately set 2.5in wrong:

| Spec | Result |
|---|---|
| position only | `not-found` — no information about what went wrong |
| with `anchor` | `Present: ok`, `Top: FAIL` — found it, and said exactly how far off it is |

### When the anchor text is missing

The element reports `not-found` with a single failing `Anchor` check naming the text it
looked for. It deliberately does **not** fall back to position matching: silently matching
a neighbour is worse than saying "the label I key off is gone".

### Choosing an anchor

- Pick a **static** label, never a value. `"Statement period"` is a good anchor;
  `"Statement period: June 2026"` breaks every month.
- Pick the **nearest** label, so `within` can stay small.
- Set `position` to the true geometric relationship. A logo beside a title is `"right"`,
  not `"above"` — anchoring the wrong side makes the element unfindable.
- Raise `within` when a legitimately large gap separates the label from the element. The
  default of `2` suits a label directly above its element; it is **too small** for
  side-by-side relationships across a page. A logo 2.8in right of its title needs
  `"within": 6`, and without it you get `Anchor: ok` with `Present: FAIL`.

---

## 7. The workbook — Template v2

The format people actually write. The app reads it, says what it understood, and
compiles it; the JSON above is the output, not an input anyone types.

### The sheets

| Sheet | What it holds |
|---|---|
| **Pages List** | One row per PDF page, in order: Tab · Page name · Page type (Required / Optional / Conditional) · Orientation · Variant group · Repeats · Identifying text · Comments. **A sheet not listed here is not read**, and a listed tab with no sheet is an error. |
| **Settings** | This workbook's own tolerances, page size, colour threshold and *Pixels per inch*, read by name in the first column — never by row position. |
| **Lists** | The closed vocabulary: the groups, units, From edges, Check? values, cases, fonts, colour names with their hex, and the parameter table every row is checked against. A parameter not on this sheet is an error on the row that used it. |
| **Page sheets** | One per page named in the Pages List. |

### A page sheet's columns

Element · Part · Group · Parameter · Value · Unit · From · Check? · Tolerance ·
Exact text · Pattern · Notes · Description.

- **One cell, one fact.** A position is Parameter `Top`, Value `5.75`, Unit `in`,
  From `top of page` — never the sentence "5.75 inches from top of page". A baseline, a
  wrap point, a line break and a line spacing are each their own row.
- **A row is identified by its sheet and row number.** There is no ID column; every
  report and every `source` cell already names the row.
- **Element, Part and Group are merged and centred** over the rows they label. A merge is
  a declared range in the file and is read as exactly that — the reader never
  forward-fills, so a genuinely missing label is an error rather than a copy of the one
  above it. A merge reaching Parameter or any column to its right is an error.
- **There is no default unit and no default edge.** A length with a blank Unit is an
  error; so is a position with a blank From, a unit inside the Value, a unit the
  parameter does not allow, and `px` without *Pixels per inch* on the Settings sheet.
- **Check?** is the author's instruction: `Yes` asserts the row, `Note` records it
  without asserting it, `No` excludes it. It is read before the element is built, so a
  row marked Note is never asserted by a side door.
- **A value may be approximate only by being a range.** `5.4–5.6` is a band; `~10` is an
  error, because a check cannot be run on "about". A range *and* a Tolerance is an error
  too — a range is already the tolerance.

### What the app says back

Before any PDF is opened, the tab shows the **validation report**: three severities, each
line naming its sheet and cell, how many of the workbook's rows became checks, the rows
that did not and why, and every accepted assertion **in plain words** — "Report title:
top edge 5.75 in from the top of the page, ± 0.06 in". That sentence is the point: it
can be read back against the workbook and disagreed with.

An error on the file or on the Pages List stops the run. An error on one element only
removes that element; the rest of the page is still worth checking.

### The legacy nested layout

Older specs were written as prose with the labels merged down the left. They are accepted
as a **migration input only**: the app reads what it can, marks every cell it inferred
amber and every cell it could not read red, and hands back a **draft Template v2
workbook** with Check? set to `Note` on every row. Nothing is checked against a PDF until
a person confirms that draft and uploads it. No guesswork reaches a result.

---

## 8. Validation and common mistakes

**Validation happens on the workbook**, not on the JSON (§7). A row that cannot be read
is refused there, with its cell, before any PDF is opened — which is the only place a
person can act on it.

The JSON path is the loose one, and deliberately so: a spec JSON uploaded directly is
checked for shape only.

- the spec is a JSON object;
- `pages` is a non-empty array;
- every page has a numeric `page` and an `elements` array.

**Element fields are not validated on that path.** A misspelled key, a string where a
number belongs, or a missing `width` will not be rejected — it will produce a confusing
failure, or silently skip a check. A JSON this app wrote is safe; one written by hand is
not, which is why the workbook is the supported route and nobody hand-edits the JSON.

| Mistake | Symptom |
|---|---|
| `top`/`left` as strings | Everything fails on position with nonsensical expected values |
| Measured from the page bottom **without saying so** | Every `Top` fails by a consistent amount. Say `From: bottom of page` and the compiler converts it. |
| `fontSize` in spec units instead of points | Font-size check always fails |
| `text` too long for a paragraph | `not-found` after any wording change |
| `rows` set on a data-driven table | Fails whenever the data changes |
| Anchor text includes a variable value | Passes this month, `not-found` next month |
| Wrong `anchor.position` | `Anchor: ok` but `Present: FAIL` — the label was found, the element was not where you said |
| `anchor.within` too small | `Anchor: ok` but `Present: FAIL`. The default reach is **2 spec units**; a logo across the page from its label needs `within` raised. Measure the real gap and add margin. |
| Blank exported as `""` rather than omitted | Matches the first line on the page |

### Pre-flight checklist for a generated spec

- [ ] Parses as JSON
- [ ] `units` set, and every measurement uses it
- [ ] Every element has `type`, `id`, and at least one of `top` / `left` / `right` / `bottom` / `baseline`
- [ ] `text` present on every `text` and `paragraph`
- [ ] `width`/`height` present on every `image`; `width` on every `table`
- [ ] `lineSpacing` present on every `paragraph`
- [ ] No `null`, no `""`, no numeric strings
- [ ] `anchor` present only where an anchor text was given
- [ ] `id` unique within each page
- [ ] Run it against one known-good PDF and confirm it passes before rolling it out

That last step matters most. A spec that has never passed against a correct document is not
a spec — it is a list of assumptions.

---

## 9. Quick reference

```jsonc
{
  "title":     "string",              // optional
  "units":     "in" | "pt" | "mm",    // default "in"
  "pageSize":  { "width": 0, "height": 0 },   // optional
  "pageSizePinned": true,             // optional; a different size is then an error, not a warning
  "colourThreshold": 2.0,             // optional; CIEDE2000 ΔE, default 2.0
  "tolerance": { "position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2 },
  "pages": [{
    "page": 1,                        // 1-based, required
    "elements": [{
      "type":  "text" | "image" | "table" | "paragraph",   // required
      "id":    "string",              // required, reporting only
      "label": "string",              // optional
      "top":   0, "left": 0,          // spec units, from the page's top-left
      "right": 0, "bottom": 0,        // the element's right and bottom edges, also from top-left
      "baseline": 0,                  // text only; the baseline, from the page's top
                                      //   — at least one of these five

      // text / paragraph
      "text":  "string",
      "match": "exact" | "contains",  // default "contains"
      "fontSize":    0,               // text only, POINTS
      "font":  "string",              // text only, family as the workbook writes it
      "bold":  true, "italic": true,  // text only, from their own rows
      "colour": "#0B3C5D",            // text only, compared by CIEDE2000 ΔE
      "lineSpacing": 0,               // paragraph only, required

      // image / table
      "width":   0,                   // image + table
      "height":  0,                   // image only
      "rows":    0, "columns": 0,     // table only, optional

      // optional on any type
      "anchor": {
        "text":       "string",       // required within anchor
        "position":   "above" | "below" | "left" | "right",  // default "below"
        "within":     2,              // spec units, default 2
        "match":      "exact" | "contains",                  // default "contains"
        "occurrence": 1               // default 1
      },
      "tolerance": { "position": 0, "size": 0, "spacing": 0, "fontSize": 0 },

      // written by the compiler, one per parameter: the cell this came from
      "source": { "top": { "sheet": "1", "cell": "E12" } }
    }]
  }]
}
```
