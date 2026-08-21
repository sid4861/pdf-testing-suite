# PDF Spec Standard

Reference for the JSON spec format consumed by the **Test new pages** workspace and the
`pdfsuite` CLI.

Written to be used two ways: as the authority on what each field means, and as the
conversion guide for turning an Excel workbook (one tab per PDF page) into a JSON spec.

---

## 1. What a spec is

A spec describes what a page **should** contain — text, images, tables, paragraphs — and
where. The checker renders the actual PDF, extracts its real content, and reports every
element as `pass`, `fail`, or `not-found`, with expected-vs-actual values for each check.

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

`pages[].page` is **1-based** and must be a number. Pages not listed are not checked. A
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
| `top`, `left` | **yes** | Expected position, spec units, from the page's top-left. |
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

**How it is located:** all lines whose text matches are collected, then the one nearest the
expected `top` wins. Content is the anchor, position is the assertion — so an element that
moved is still *found*, and correctly reported as a `Top`/`Left` failure.

**Checks produced:** `Present`, `Left`, `Top`, and `Font size` when `fontSize` is given.

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

## 7. Excel → JSON conversion

### Workbook conventions

- **One tab per PDF page.** Name tabs `Page 1`, `Page 2`, … — the trailing number becomes
  `pages[].page`.
- **One row per element.**
- A tab with no element rows should be **omitted** from `pages` rather than emitted with an
  empty `elements` array.

### Recommended column layout

| Column | Maps to | Applies to | Notes |
|---|---|---|---|
| `Type` | `type` | all | `text` / `image` / `table` / `paragraph`, lower-case |
| `ID` | `id` | all | Required, unique within the page, stable across revisions |
| `Label` | `label` | all | Optional |
| `Text` | `text` | text, paragraph | Required for those two; leave blank otherwise |
| `Match` | `match` | text, paragraph | Blank → `contains` |
| `Top` | `top` | all | Number, spec units |
| `Left` | `left` | all | Number, spec units |
| `Width` | `width` | image, table | Number |
| `Height` | `height` | image | Number |
| `Rows` | `rows` | table | Blank → omit the check |
| `Columns` | `columns` | table | Blank → omit the check |
| `Line spacing` | `lineSpacing` | paragraph | Required for paragraph |
| `Font size (pt)` | `fontSize` | text | Blank → omit the check |
| `Anchor text` | `anchor.text` | all | Blank → no anchor at all |
| `Anchor position` | `anchor.position` | all | Blank → `below` |
| `Anchor within` | `anchor.within` | all | Blank → `2` |
| `Anchor occurrence` | `anchor.occurrence` | all | Blank → `1` |
| `Tol position` | `tolerance.position` | all | Blank → inherit |
| `Tol size` | `tolerance.size` | all | Blank → inherit |
| `Tol spacing` | `tolerance.spacing` | all | Blank → inherit |
| `Tol font size` | `tolerance.fontSize` | all | Blank → inherit |

### Conversion rules

1. **Omit blanks; never emit `null` or `""`.** The checker treats a *missing* optional
   field as "skip this check", but an empty string as a value to match — so a blank `Text`
   exported as `""` makes every line match.
2. **Numbers must be JSON numbers**, not strings. `"top": "1.5"` will not work. Strip unit
   suffixes Excel may have added (`1.5"` → `1.5`).
3. **Only emit `anchor` when `Anchor text` is filled.** Do not emit
   `"anchor": { "text": "" }`.
4. **Only emit `tolerance` when at least one `Tol *` column is filled**, and include only
   the filled keys.
5. **Round to a sensible precision** — 3 decimal places in inches is well below any
   tolerance you would set.
6. **`id` must be unique within a page.** Duplicates are not rejected but make the report
   ambiguous.
7. **Set `units` once at the top level**, and make sure the whole workbook uses it.

### Worked example

| Type | ID | Text | Top | Left | Width | Height | Anchor text | Anchor position | Anchor within |
|---|---|---|---|---|---|---|---|---|---|
| text | title | MONTHLY STATEMENT | 0.75 | 0.75 | | | | | |
| image | logo | | 0.55 | 6.4 | 1.6 | 0.6 | MONTHLY STATEMENT | right | 6 |
| table | charges | | 3.0 | 0.75 | 7.0 | | Statement period | below | |

becomes:

```json
{
  "title": "Monthly Statement Template v3",
  "units": "in",
  "pages": [
    {
      "page": 1,
      "elements": [
        {
          "type": "text",
          "id": "title",
          "text": "MONTHLY STATEMENT",
          "top": 0.75,
          "left": 0.75
        },
        {
          "type": "image",
          "id": "logo",
          "top": 0.55,
          "left": 6.4,
          "width": 1.6,
          "height": 0.6,
          "anchor": { "text": "MONTHLY STATEMENT", "position": "right", "within": 6 }
        },
        {
          "type": "table",
          "id": "charges",
          "top": 3.0,
          "left": 0.75,
          "width": 7.0,
          "anchor": { "text": "Statement period", "position": "below" }
        }
      ]
    }
  ]
}
```

---

## 8. Validation and common mistakes

The checker's own validation is **deliberately shallow**. It enforces only:

- the spec is a JSON object;
- `pages` is a non-empty array;
- every page has a numeric `page` and an `elements` array.

**Element fields are not validated.** A misspelled key, a string where a number belongs, or
a missing `width` will not be rejected — it will produce a confusing failure, or silently
skip a check. Your conversion script is the real validation layer, so make it strict.

| Mistake | Symptom |
|---|---|
| `top`/`left` as strings | Everything fails on position with nonsensical expected values |
| Measured from the page bottom | Every `Top` fails by a consistent amount |
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
- [ ] Every element has `type`, `id`, `top`, `left`
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
  "pageSize":  { "width": 0, "height": 0 },   // optional, documentation only
  "tolerance": { "position": 0.06, "size": 0.06, "spacing": 0.03, "fontSize": 2 },
  "pages": [{
    "page": 1,                        // 1-based, required
    "elements": [{
      "type":  "text" | "image" | "table" | "paragraph",   // required
      "id":    "string",              // required, reporting only
      "label": "string",              // optional
      "top":   0, "left": 0,          // required, spec units, from top-left

      // text / paragraph
      "text":  "string",
      "match": "exact" | "contains",  // default "contains"
      "fontSize":    0,               // text only, POINTS
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
      "tolerance": { "position": 0, "size": 0, "spacing": 0, "fontSize": 0 }
    }]
  }]
}
```
