# `public/samples/` — what the *load an example* links load

These files ship with the app. Each one exists because a tab offers to load it;
nothing here is a test fixture, and nothing here is a real document.

| file | loaded by | what it is |
|---|---|---|
| `report-spec-with-errors.xlsx` | **Specification** · *load an example workbook + PDF* | a Template v2 workbook with **ten planted errors**, so one click shows both halves of the tab: the rows refused before any PDF is opened, each naming its own cell, and the 96 that are still checkable |
| `report-with-deviations.pdf` | **Specification** (the same link) | the 4-page report that workbook is checked against, with deliberate deviations so the run ends in a verdict rather than a clean pass |
| `spec-sample.pdf` | **Inspect**, and **Compare · Many** | a 2-page statement |
| `spec-sample.json` | `verify/spec-target.ts` | a spec JSON — kept because the CLI suite reads it |
| `invoice-original.pdf`, `invoice-recreated.pdf` | **Compare · One** | two renderings of one invoice |

## The two Specification files are copies

They are copied from
[`work/samples/excel-spec-template-v2/`](../../work/samples/excel-spec-template-v2/README.md),
which is where they are generated and where the oracle reads them. A copy can
drift from its source, so when the generator changes, refresh them:

```bash
cp work/samples/excel-spec-template-v2/report-spec-with-errors.xlsx work/samples/excel-spec-template-v2/report-with-deviations.pdf public/samples/
```

Serving them from `work/` instead would work in the dev server, which happens to
serve the repository, and fail everywhere else — `public/` is the only folder
that ships.

## They are fictional

Every workbook and PDF here is invented. Real spec workbooks never leave the
spec machine ([SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decision 13),
and that rule is about the data, not the code.
