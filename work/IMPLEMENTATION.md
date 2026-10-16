---
type: Log
description: "What shipped, when, and how it turned out — the evidence store the queue reconciles against."
---

# IMPLEMENTATION — what has landed

A row is earned by **landing**, never by being planned. The queue reconciles
against this file before an item may be closed
([SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rule 9). Newest first.

| date | item | what landed | outcome | evidence |
|---|---|---|---|---|
| 2026-10-16 | W-03 | `cli-py/` removed; Python wrapper section and diagram 17 dropped from `docs/ARCHITECTURE.md`, diagram 01 re-rendered; references removed from the presentation, script, `CLAUDE.md`, register and registry | shipped | `git ls-files 'cli-py/**'` empty; every Mermaid block renders; grep for `cli-py` hits only records, history and the archived item |
| 2026-10-16 | W-02 | records SR-SPEC-INTAKE, SR-SPEC-CHECK, SR-CONSTANTS, SR-STACK-TYPESCRIPT (accepted, built = no); W-02 rescoped; W-03, W-04, W-05 filed; proposal graduated; spec paths moved from W-01 in the Ownership table | landed — commit ca83f3e, records only, no code | the files; every Mermaid block renders; links resolve |
| 2026-10-16 | W-02 | `tools/samples/excel-spec-hierarchical/`: nested-layout spec workbook (Pages List + 4 page sheets) + matching 4-page landscape PDF + PDF with 12 known deviations + image assets, all from `generate.py` | landed, uncommitted | matching PDF 0.000 in off on 25 elements (column-aware pdf.js measurement); deviations measure as tabled in its README; byte-identical across runs. Replaces `tools/samples/excel-spec/`, which is no longer in the tree |
| 2026-10-14 | W-02 | `tools/samples/excel-spec/`: synthetic 3-page spec workbook + matching PDF + PDF with 9 known deviations, all from `generate.py` | landed, uncommitted | matching PDF measures 0.000 in off on 23 elements with pdf.js; the 8 checkable deviations measure as listed in its README; output is byte-identical across runs |
| 2026-10-14 | — | `docs/architecture/`: 18 standalone SVGs, one per diagram in `docs/ARCHITECTURE.md`, linked under each | landed — PR #3 (branch `architecture-diagrams-records`) | the files; plain SVG text (no foreignObject), white background; spot-checked 01, 05, 10 as images |
| 2026-10-14 | — | `docs/ARCHITECTURE.md`: 18 Mermaid diagrams — app shell, flags, engine, every tab, every CLI command, app-vs-CLI verdict rules, planned work | landed — PR #3 (branch `architecture-diagrams-records`) | the file; all 18 diagrams render (mermaid 10.9.1) |
| 2026-10-13 | — | the work system: records 0001–0003, 0051–0060; `work/`; `archive/`; hooks; the commit guard | set up | the setup commit |
