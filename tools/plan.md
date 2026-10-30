# Spec conversion — plan

Turning an Excel/CSV specification workbook (one sheet per PDF page) into the JSON
specs the **Spec driven comparison** workspace and the `pdfsuite` CLI consume.

Written to be picked up cold. Read §1 and §2 before writing any code.

---

## 1. Where things stand

### 1.1 Files that already exist

| File | What it holds |
|---|---|
| `spec-standard.md` | The authority on the JSON format. §6 covers anchors, §7 covers Excel → JSON conversion, including workbook conventions, the recommended column layout, conversion rules and a worked example. |
| `src/types/spec.ts` | `PdfSpec`, element types (`text` / `image` / `table` / `paragraph`), `SpecAnchor`. |
| `src/services/specCheck.ts` | `runSpec(pdf, spec, options)` and `validateSpec(json)`. Anchors are implemented. |
| `src/components/spec/SpecTestView.tsx` | The workspace UI, including **All pages** / **One page** targeting with a PDF-page stepper and a spec-page selector. |
| `cli/verify/spec-target.ts` | Page-targeting regression suite, 8 checks. Run with `cd cli && npm run verify:spec`. |
| `work/samples/` | Where a worked example tab and its expected output belong (moved from `tools/samples/` 2026-10-18). |

`RunSpecOptions` is `{ onProgress?, specPageIndex?, pdfPageOverride? }` — it checks one
spec page against any PDF page, which is what lets a single-sheet spec saying `"page": 1`
be pointed at whichever PDF page it actually describes.

### 1.2 Files that may not be in your checkout

Confirm these are present before starting. If they are missing, obtain them and place them
first — Step 0.

| File | Why it matters |
|---|---|
| `tools/spec-from-excel.py` | The existing converter, ~586 lines. §1.3 describes it. |
| Font checks in `src/types/spec.ts` and `src/services/specCheck.ts` | `fontName`, `fontBold` and `fontItalic` on `text` elements. Check with `grep -c fontName src/services/specCheck.ts` — zero means they are absent. |
| The `spec-standard.md` sections documenting those font fields | The `text` element table should list `fontName`, `fontBold`, `fontItalic` alongside `fontSize`. |

These three go together: the converter emits font assertions that the checker must
understand and the standard must document.

### 1.3 What the existing converter already does

From reading `tools/spec-from-excel.py`:

- Reads `.csv` with the stdlib; `.xlsx` via `openpyxl` behind an optional import with a
  clear install message. Can list sheet names.
- Unit normalisation: `parse_inches`, `parse_points`, `parse_edge`, `parse_bool`,
  `clean_font_name`
- `usable_text` — `<<placeholder>>` handling and a minimum-fragment rule, so a wording
  cell that is entirely placeholders yields no assertion
- `Block` + `parse_sheet` — element segmentation
- `to_top_left` — converts bottom-edge measurements to the top-left origin the format uses
- `CONDITIONAL_PHRASES` + `conditional_note` — plain substring matching, so
  "should only be displayed on prospect documents" is recorded as a note rather than
  asserted
- `UNCHECKABLE_PARAMS` / `UNCHECKABLE_GROUPS` (colour, background) + `note_unconvertible`,
  feeding a conversion report
- `DEFAULT_PAGE` for portrait/landscape page sizes

**Its limitation, and the reason for this plan:** `parse_sheet` and `Block` are built
around the single tab that was sampled. They assume that sheet's column layout.

Also: keep `tools/__pycache__/` out of version control.

---

## 2. The problem this plan solves

The checker and the JSON format are done. The hard part is that the specs are
**semi-structured human documents**: the tabs share no fixed standard, though there are
recurring patterns.

The load-bearing insight: **the stable thing across tabs is vocabulary, not geometry.**
Different authors put "Font size" in different cells, but they all write "Font size".
So parse by label, not by column position.

Expect a converter to handle **70–85%** of a typical tab. Design the workflow so the
remaining 15–30% is *visible and cheap to correct*, rather than silently guessed.

---

## 3. Architecture

### 3.1 Three stages, with a reviewable artifact in the middle

```
sheet  →  extraction.json  →  spec.json  →  check results
             ↑ corrected by a human or a model, once
```

The middle artifact is the point. When a tab defeats the parser, someone fixes it **once**
and the fix persists, instead of the tab being re-mangled on every run. Without that seam
you get a converter people stop trusting.

`extraction.json` holds candidate elements, the properties found for each, the source cell
of every value, and a confidence tier. `spec.json` is the validated output that
`validateSpec` accepts.

### 3.2 Parse by label vocabulary

Replace "column C is the measurement" with:

1. **Segment into element blocks** — a heading row and the property rows beneath it
2. **Scan every cell in a block for known property labels**, taking the value from wherever
   it sits: same row to the right, the cell below, or parsed out of prose in the same cell
3. **Normalise units once, at the edge** — `2 1/8"`, `2.125 in`, `54mm`, `13pt` all become
   inches or points in one place (the existing `parse_*` helpers already do this)

Element segmentation and property extraction are **two independent failure modes**. Report
them separately: a block found but empty is a very different problem from a block never
detected.

### 3.3 Grade the assertions — do not assert everything extracted

| Tier | Example | Becomes |
|---|---|---|
| **Certain** | explicit wording + explicit measurement | a hard assertion |
| **Inferred** | measurement parsed from prose, ambiguous unit | assertion with a wider `tolerance` |
| **Contextual** | "only on prospect documents" | recorded as a note, never asserted |
| **Unusable** | colour, "per brand guidelines" | listed in the conversion report only |

This decides whether people act on the report. A spec check that fails on things the sheet
never really pinned down trains people to ignore it — the same failure mode that led to
removing the tunable pass/fail thresholds from the app.

`conditional_note` and `UNCHECKABLE_PARAMS` already implement the bottom two tiers.

### 3.4 Let anchors carry the weak specs

Where a tab gives reliable *wording* but shaky *coordinates* — expected to be common — an
anchored assertion still has value:

- "Start at 3.4 inches from left" → assert `left`
- No usable position but text is given → assert presence, anchored to a nearby label

See `spec-standard.md` §6. This is the difference between a tab converting to four weak
assertions and converting to nothing.

**Trap, already documented:** the default anchor `within` is 2 inches. An element further
from its anchor than that fails on `Present`. The worked example in the standard needed
`within: 6`.

### 3.5 The tab → page mapping is its own feature

Tab names will not reliably say "page 3", and page order drifts between document variants.

1. **A mapping file** — explicit, boring, always correct, needs maintaining
2. **Tab order** — fragile the first time someone inserts a sheet
3. **Identify the page by content** — take each tab's most distinctive text, find which PDF
   page contains it, bind there

**Build (3) with (1) as an override.** It removes a whole class of spec churn: the spec
stops needing to know page numbers at all. The **One page** mode in the workspace is the
manual version of this, and `RunSpecOptions.pdfPageOverride` is the API it would drive.

### 3.6 Per-tab overrides, checked in

A small file per tab, beside the workbook, that supplements or corrects the extraction. A
tab that resists automation then costs ten minutes once, not every run. It is also where
things a spreadsheet cannot express go: that an element is conditional, that two rows are
really one element.

### 3.7 Where an LLM fits

A **fallback inside the pipeline**, not the pipeline. Deterministic parser first; whatever
it cannot classify goes to a model with `spec-standard.md` as the contract; the output
lands in `extraction.json`, never straight into an assertion. Non-determinism is acceptable
when a human confirms once and the result is frozen.

---

## 4. Sequencing

Each step ships something useful on its own.

### Step 0 — Assemble the starting point

Make sure everything in §1.2 is present and consistent: the converter, the font checks in
`src/types/spec.ts` and `src/services/specCheck.ts`, and the standard-doc sections covering
them. Add `tools/__pycache__/` to `.gitignore`.

**Done when:** `npm run build` passes, `cd cli && npm run verify` passes (classification
24/24, spec-target 8/8), and `tools/spec-from-excel.py` runs on `work/samples/`.

### Step 1 — Survey every tab *(highest value, ~1 day, no commitments)*

A script that only observes and reports:

- Distinct property labels with frequencies — `Font ×34`, `Distance from top ×31`,
  `Position from left ×12`, `Left margin ×9` …
- How elements appear to be separated — blank row, bold row, value-in-column-A-only
- Which tabs match the shape the current converter handles
- Cells nothing can classify

**Done when:** you know whether there are 3 recurring shapes or 30. Everything below
depends on the answer; building the converter first is guessing.

### Step 2 — Generalise the parser

Move `parse_sheet` from column positions to the label scanning in §3.2. Keep the existing
`parse_*` helpers unchanged — they are the good part.

**Done when:** the sampled tab still converts identically (fixtures, Step 6) and at least
one differently-shaped tab converts.

### Step 3 — Extraction artifact and conversion report

Emit `extraction.json` per §3.1 and a report with the tiers from §3.3: what converted, what
was recorded but not asserted, what could not be read at all, each with its source cell.

**Done when:** for any tab, a reader can answer "why is this element missing?" without
opening the script.

### Step 4 — Content-based page binding

Per §3.5, with a mapping-file override.

**Done when:** a multi-tab workbook binds to the right PDF pages with no page numbers in
the specs.

### Step 5 — Per-tab overrides

Per §3.6.

### Step 6 — Regression fixtures

Pick 8–10 tabs spanning the shapes Step 1 found, freeze their expected JSON, re-run on
every converter change. Follow `cli/verify/` — that pattern is why the classification suite
still catches things. Add an npm script beside `verify:classification` / `verify:spec`.

**Done when:** a deliberate regression in the parser fails the suite.

### Step 7 — LLM fallback

Last, once you know what actually remains. Per §3.7.

---

## 5. Constraints and conventions

- **The app consumes JSON.** A `.csv` dropped on the spec slot is rejected with a message
  pointing at this converter. Converting in-browser would mean porting this to TypeScript —
  a separate decision, not assumed here.
- **Python, stdlib-first.** `.csv` needs nothing; `.xlsx` needs `openpyxl` behind an
  optional import. (Superseded: the spec pipeline is TypeScript only — SR-STACK-TYPESCRIPT.)
- **Do not edit `src/` from the converter's side** beyond what Step 0 assembles. The engine
  and the converter are separate deliverables.
- **Coordinates** are inches from the page's **top-left**; `fontSize` is always points.
  `spec-standard.md` §3.
- **Tolerances** default to position `0.06in`, size `0.06in`, spacing `0.03in`, fontSize
  `2pt`. Widen per element for inferred values rather than globally.
- **Verify with the repo's own suites**, not ad-hoc scripts: `cd cli && npm run verify`.

---

## 6. Open questions — answer before Step 2

1. **How many tabs, and how many authors?** Ten tabs by one person is a different problem
   from two hundred by fifteen. Step 1 answers the first half.
2. **Is the workbook the source of truth, or a transcription?** If a design system or AEM
   template metadata sits behind it, converting *that* may beat parsing spreadsheets
   entirely — worth ten minutes of asking before weeks of parser work.
3. **CSV or XLSX as the working format?** CSVs are one file per sheet, so the sheet name
   must survive as metadata. `.xlsx` keeps the tabs together but needs `openpyxl`, which was
   not installed on the machine this was last tested on.
4. **Which categories genuinely cannot be checked?** Known so far: colour, case, underline,
   box geometry. Confirm against a real sample before promising coverage.

---

## 7. Acceptance criteria for the feature as a whole

- A multi-sheet workbook converts to one JSON spec per page, with no manual renumbering
- Every tab produces either a spec or a report line saying precisely why it did not
- Nothing the sheet did not pin down is asserted
- Specs bind to the right PDF pages without page numbers written into them
- A tab that needs hand-correction is corrected once, in a checked-in file
- The fixture suite fails when the parser regresses
