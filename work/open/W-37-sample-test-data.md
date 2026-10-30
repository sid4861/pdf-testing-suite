---
type: Handoff
name: W-37
description: "Arpit, 2026-10-18: generate fictional, realistic documents — golden PDFs, variants with planted deviations, a bulk folder pair with orphans, a spec workbook with a matching and a deviating PDF — each with `expected.json` and a README."
item: W-37
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-37 — The sample set: realistic PDFs and Excel workbooks with planted deviations

## At a glance

| | |
|---|---|
| **What** | Generate fictional, realistic documents — golden PDFs, variants with planted deviations, a bulk folder pair with orphans, a spec workbook with a matching and a deviating PDF — each with `expected.json` and a README |
| **Why** | Arpit: test on actual PDFs and Excel files, from sample data we create |
| **Done when** | `npm run samples` rebuilds every file byte-for-byte; each set's `expected.json` lists every planted deviation; a person can read the same list in its README |
| **Status** | 🟢 ready · 0 of 6 DoD done |
| **Waits on** | nothing |
| **Who** | `agent` · Opus |
| **Record** | SR-TESTING |

```mermaid
flowchart LR
  S1["1 · generator"] --> S2["2 · compare set"] --> S3["3 · bulk set"] --> S4["4 · spec set"] --> S5["5 · readme"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 generator --> 2 compare set --> 3 bulk set --> 4 spec set --> 5 readme --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"Let's go ahead and create a work item for all these test cases and create an SR document for testing as well … Can we run testing on actual PDFs and Excel file? We can create some sample test data and then we can go ahead and test it out."*

**Model:** Opus: planting deviations that are realistic, separable and each attributable to one rule is design judgment.

## How it can be built

- **Documents:** a fictional bank statement (4 pages: summary, transactions table, chart image, disclosures), an invoice (2 pages), a letter (1 page) — real-looking layouts, made-up names.
- **Compare variants,** one file per theme, each deviation listed: changed word and number, moved block, font family and weight, colour, image swapped, row added to a table, page missing, page extra, page order swapped.
- **Bulk:** `golden/` and `candidate/` folders of those documents, one golden with no candidate and one candidate with no golden.
- **Spec:** a workbook in the Template v2 layout (SR-SPEC-INTAKE) with Pages List and one sheet per page, a PDF that matches it exactly, and one with planted deviations — including the cases SR-SPEC-CHECK names: page out of order, optional page absent, tolerance in mm, ligature, ® exactness.
- **How:** PDFs with pdf-lib, workbooks written as Office Open XML with jszip — both already dependencies; fixed timestamps and IDs so bytes repeat.
- **`expected.json` per set:** deviation id, page, type, position in inches, cell (spec), and whether today's engine is expected to catch it.
- **The fleet-report sample** (`work/samples/excel-spec-template-v2/`, 12 PDF deviations, 10 intake errors) joins the set; its PDFs and images are frozen (the Python generator was deleted 2026-10-18) — this item's TypeScript generator rebuilds them.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · generator | `work/samples/generate.ts` — one command, `npm run samples`, deterministic | ⏳ |
| 2 · compare set | three documents, golden plus themed variants, every deviation in `expected.json` | ⏳ |
| 3 · bulk set | two folders with one orphan on each side | ⏳ |
| 4 · spec set | `.xlsx` workbook, matching PDF, deviating PDF, cells in `expected.json` | ⏳ |
| 5 · readme | per set: what it contains and the expected results as a table | ⏳ |
| 6 · record | SR-TESTING sample-set table matches the files | ⏳ |

## Blockers

None.

## Record affected

[SR-TESTING](../../records/0116_TESTING.md) — the decisions this item enforces.

## Hazards

- **Fictional only:** no real client name, number or template — never derived from a real workbook.
- **One deviation, one cause:** two planted changes must never overlap, or a miss cannot be attributed.
- Fictional data only; never a real workbook or PDF in this repository.

## Reference

- [`work/samples/excel-spec-template-v2/README.md`](../../work/samples/excel-spec-template-v2/README.md) · [SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md) · [SR-SPEC-CHECK](../../records/0102_SPEC-check.md)
