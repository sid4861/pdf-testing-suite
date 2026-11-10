---
type: Handoff
name: W-48
description: "Arpit, 2026-10-18: the workbook validation as a contract — every doubtful cell an error, each accepted row shown in plain words, the workbook handed back with its bad cells red, the same from the Specification tab and `pdfsuite spec --validate-only`, proven against a fixture with ten planted errors."
item: W-48
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-10
updated_by: Siddharth
ball: agent
---

# W-48 — the validation report: no guesswork, in plain words, handed back as the workbook

## At a glance

| | |
|---|---|
| **What** | One `validateWorkbook` result behind every surface, rows named by sheet and row number: errors with their cell (SR-SPEC-INTAKE decision 7a — a missing, in-value, unknown or disallowed unit is an error, never a guess), each accepted row as a plain-words assertion, and an **annotated `.xlsx`** with the bad cells filled red; shown in the Specification tab and written by `pdfsuite spec --validate-only` |
| **Why** | Arpit: *"If there is a value like 2 and it is in pixels, I want to be 100 % sure that's what it is. No guesswork. If it is wrong, throw an error."* — and a person must see exactly what the machine understood before a PDF is ever checked |
| **Done when** | `report-spec-with-errors.xlsx` yields exactly `expected-validation.json` through the tab and the CLI; the clean workbook yields no error and no warning; a blanked Unit cell yields one error and no assertion; the annotated workbook opens in Excel with only the error cells and a *Validation* sheet changed |
| **Status** | 🟢 done · 7 of 7 DoD done (2026-11-10) |
| **Waits on** | nothing — W-02 built the reader; this shaped its result |
| **Who** | `agent` · Sonnet |
| **Record** | SR-SPEC-INTAKE decisions 7a, 13, 14, 16 · SR-CLI (`--validate-only`) · SR-SURFACE-PARITY (one new core row) |

```mermaid
flowchart LR
  S1["1 · result shape"] --> S2["2 · plain words"] --> S3["3 · annotated xlsx"] --> S4["4 · tab"] --> S5["5 · CLI"] --> S6["6 · oracle"] --> S7["7 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 result shape --> 2 plain words --> 3 annotated xlsx --> 4 tab --> 5 CLI --> 6 oracle --> 7 record
```

</details>

**Arpit, 2026-10-18:** *"Read the sample Excel. See if anything can be improved … if there is a
value like 2 and it is in pixels, I want to be 100 % sure that's what it is. No guesswork. If
it is wrong, throw an error … how it can be made intuitive as well … file a work item to
create a tab to validate the Excel within the spec tab."*

**Model:** Sonnet — the rules are fixed in SR-SPEC-INTAKE and the fixture is the oracle; the
annotated-workbook writer is the one part that needs care (byte-preserving re-zip), and it is
specified below. Close to Opus for that part alone.

## How the pieces fit

- **W-02** builds the reader and the decision-7a validation (errors, warnings, info with cells).
- **This item** fixes the *shape* of that result and the three ways a person meets it: plain
  words, the annotated workbook, the CLI.
- **W-46** (`<pdfsuite-sheet-viewer>`) draws the same result as marks on the sheet in the
  browser; **W-47** edits it there. Both consume this item's result; neither replaces it — a
  reviewer who fixes the workbook in Excel needs the file back, and CI needs a file on disk.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · result shape | `ValidationResult` in the spec engine (`engine.ts`): `{ workbook: {name, sha256, templateVersion}, lines: [{severity, code, sheet, row, cell, parameter, message}], assertions: [{sheet, row, cell, element, part, words, tolerance, unit}], coverage, counts }` — a row is named by sheet and row number, no ID; codes are a closed list — `unit-missing`, `unit-in-value`, `unit-unknown`, `unit-disallowed`, `px-without-density`, `number-expected`, `approximate-value`, `range-and-tolerance`, `from-missing`, `parameter-unknown`, `colour-name-mismatch`, `label-blank-outside-merge`, `merge-over-values`, `hidden-listed`, `formula-cell`, … — one code per SR-SPEC-INTAKE decision-13 example | ✅ |
| 2 · plain words | every accepted row rendered as one sentence from a per-kind template, tolerance and unit resolved, e.g. *"Report title: top edge 5.75 in from the top of the page, ± 0.06 in (sheet 1, row 17)"*, *"Reporting period: the word "Quarter" italic, the rest upright (sheet 1, row 31)"*; a `Note` row reads *"noted, not checked"*; grouped by element in sheet order | ✅ |
| 3 · annotated xlsx | `annotateWorkbook(bytes, result)` on `jszip`: the uploaded `.xlsx` returned with each error cell filled red (a `dxf`-free solid fill style added to `styles.xml`), a cell comment carrying the message, and a new last sheet **Validation** listing every line; every other part of the zip byte-identical; opens in Excel and LibreOffice; re-uploading the annotated file validates the same (the Validation sheet is ignored by name) | ✅ |
| 4 · tab | in the Specification tab, before any PDF is loaded: counts (errors · warnings · info · rows accepted), the lines table (errors first, filter by severity, each line's cell), the plain-words list, and two downloads — *validation report* (`.json`, decision 14) and *annotated workbook* (`.xlsx`); built here — `packages/spec/` has been an ordinary workspace package since W-32 and 2026-11-06; W-46 adds the in-place marks later | ✅ |
| 5 · CLI | `pdfsuite spec <spec.xlsx> --validate-only --out <dir>` writes `validation.json` and `<stem>.annotated.xlsx`, prints the counts line on stdout, exits **0** (clean) or **2** (errors, or the file does not read) — see *What shipped* for why not the 0/1/2 first written here; same function through `engine.ts` (L3); W-11 owns the command, this item its `--validate-only` outputs | ✅ |
| 6 · oracle | a test: `work/samples/excel-spec-template-v2/report-spec-with-errors.xlsx` → exactly the ten lines of `expected-validation.json` (sheet, cell, code), through the engine and through the CLI; `report-spec.xlsx` → 0 errors, 0 warnings, every row accepted; the clean workbook with one Unit cell blanked in memory → one `unit-missing`, and no assertion for that row (SR-SPEC-INTAKE veto condition) | ✅ |
| 7 · record | SR-SPEC-INTAKE decision 14 marked built; a core row *"Validate the workbook, render its plain words, annotate it"* in SR-SURFACE-PARITY (the tab and the CLI call it); `packages/cli/README.md` and `docs/ARCHITECTURE.md` §Spec driven comparison, end to end | ✅ |

## What shipped, and where it differs from the sketch

**DoD 1 · the result shape.** `INTAKE_CODES` in `specIntake.ts` is the closed list
and `IntakeNote.code` carries it; a refusal cannot be emitted with a code that is
not on the list, and the oracle asserts every error has one. Two deliberate
differences from the sketch in the table:

- A line is `{severity, code?, sheet, row, cell, message}` — **no `parameter`
  field**. The parameter's name is already in the message, where the person reads
  it, and a second copy of it is a second source that can disagree
  ([SR-LAW-0](../../records/0002_LAW-0-authority.md)). A caller that needs to
  group by parameter has the cell.
- An assertion is `{page, element, sentence, sheet?, cell?}` — `part`,
  `tolerance`, `unit` and `words` collapsed into **one `sentence`**, which is what
  DoD 2 asks a person to read. Splitting it again would mean two renderings of the
  same fact and no way to keep them agreeing.

**Codes are on errors only.** `hidden-listed`, `formula-cell` and
`merge-over-values` from the sketch are *warnings*, and warnings carry no code yet
— nothing in the queue branches on one. Named as **B-023** in
[`work/BACKLOG.md`](../BACKLOG.md) so it is a decision rather than an omission.

**The report is derived, never stored.** `toValidationResult` builds it from the
extraction each time, so it cannot drift from the workbook, and two builds of the
same workbook are byte-identical — which is what makes a committed report
diffable.

**DoD 3 · the annotated workbook.** For the ten-error fixture it adds five parts —
the *Validation* sheet and the four a cell comment needs (`xl/comments{n}.xml`,
the VML drawing, the sheet's rels, the content-type declaration; Excel shows
nothing if any is missing) — and rewrites eight: `[Content_Types].xml`,
`xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, and the **four
worksheets that carry an error**, no others. The author's media and `docProps`
come through byte for byte. The oracle asserts all of that, and that re-reading
the annotated file yields the same ten errors.

**DoD 4 · the tab.** `SpecValidation` carries the counts and coverage line, the
lines grouped by severity — errors open, the rest collapsed, which is the filter —
each with its `sheet!cell`, and the plain-words list. `SpecExportMenu` now offers
*Validation report (JSON)* beside the HTML one; the annotated workbook was already
there. **Verified in the browser, 2026-11-10.** The ten-error workbook renders all ten
refusals with their cells — including the corrected *“inch is not a unit this
suite knows”* — and the clean workbook plus `report-with-deviations.pdf` runs
the check through to **✗ 11/22 elements pass**, per page, each row showing
expected, actual, delta and its source cell. Both downloads were clicked and
their bytes read back: `validation.json` is `pdfsuite.validation/1`, 75 KB,
`report-spec.xlsx`, 0/0/0 with 105 assertions; the annotated workbook is 22,988
bytes of `…spreadsheetml.sheet`. No console errors.

**DoD 5 · the exit codes are 0 and 2, not the 0/1/2 this item first wrote.**
[SR-CLI](../../records/0115_CLI.md) §exit codes already gave `--validate-only`
rows-that-will-not-be-checked the value `2`. The record is the spec; the item was
wrong and has been corrected.

**DoD 6 · the oracle earned itself immediately.**
`packages/cli/verify/spec-validation-oracle.ts`, **71 checks**, `npm run
verify:spec-oracle-v` in `packages/cli`. `2!F71` writes its unit as `inch`, and
the reader refused it as `unit-disallowed` — *“cannot be given in inch; allowed:
in, mm, cm, pt, px, %”*, which lists the fix as allowed while rejecting the typo.
Read aloud it is nonsense. `unit-unknown` (a spelling to fix) is now separate from
`unit-disallowed` (a real unit this parameter does not take). A smoke test would
have passed it.


## Blockers

- None. W-02 built the reader; this item shaped its result.
- **Corrected, 2026-11-10:** this item was filed saying DoD 4 was spec-machine
  work and *"this machine does not edit that folder"*. **Siddharth, 2026-11-03:**
  *"package can be developed on any machine now, remove this constraint"* —
  W-32 unsealed it, and on 2026-11-06 the folder became the workspace package
  `packages/spec/`, edited here like any other code. What has not changed is the
  rule about **data**: real spec workbooks never leave the spec machine, and
  every fixture in this repository is fictional.

## Record affected

[SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md) decisions 7a, 13, 14, 16 ·
[SR-CLI](../../records/0115_CLI.md) (the `--validate-only` outputs of `pdfsuite spec`) ·
[SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) (one new core row, filed with DoD 7).

## Hazards

- **No inference leaks through a message.** A message may *name* the likely fix ("use pt") but the row stays an error with no assertion; "assumed pt" must never appear anywhere.
- **The annotated workbook must not become a second reader.** It edits XML parts by string in the parts it touches and copies every other part byte for byte — if a part must be re-serialised, that is the finding; stop and raise it.
- **`px` is only ever a declared conversion.** Settings · *Pixels per inch* is read as a number with the unit `px/in`; a workbook that declares none makes every `px` row an error — do not default to 72, 96 or 144.
- **Confidential:** only the fictional fixtures in tests and docs; real workbooks are validated on the spec machine and their reports stay there.
- The touched engine and CLI files are W-01's until their records claim them (W-09, W-32), so commits stage `work/open/W-01-claim-components.md` too.

## Reference

- [`work/samples/excel-spec-template-v2/README.md`](../../work/samples/excel-spec-template-v2/README.md) — the fixture, the unit rule, the ten planted errors
- [`work/samples/excel-spec-template-v2/expected-validation.json`](../../work/samples/excel-spec-template-v2/expected-validation.json) — the oracle
- [SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md) · [W-02](W-02-excel-spec-comparison.md) · [W-11](W-11-pdfsuite-spec-cli.md) · [W-46](W-46-sheet-viewer.md) · [W-47](W-47-sheet-editor.md)
