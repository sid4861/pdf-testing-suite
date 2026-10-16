---
type: Glossary
description: "Recurring terms, defined once."
---

# Glossary

| term | meaning |
|---|---|
| Standing Record (SR) | a maintained specification in `records/`, cited by name; see the register |
| Law | a rule that outranks every other record; `SR-LAW-n` |
| W-nn | an open work item — a queue row plus a detail file |
| B-nnn | a backlog row — named, unclaimed, no file |
| ball | the one marker every queue row opens with: 🔴 🟣 🟡 🟢 |
| decider | Siddharth or Arpit — either one rules alone; see SR-WORK-BLOCKERS decision 11 |
| blocker | `work/BLOCKED.json` with a decision other than `PROCEED` |
| veto condition | the checkable condition under which a decision reopens |
| golden PDF | the reference PDF (side A); its page sets the target box every comparison draws into |
| candidate | the PDF under test (side B); the CLI's `--candidate` folder |
| spec JSON | the only input the spec checker runs: assertions compiled from a workbook (or uploaded directly), each with `source: {sheet, cell}`, plus the workbook's hash and template version — SR-SPEC-INTAKE |
| extraction JSON | every row the workbook reader saw: sheet, cell, raw text, parsed value, status (parsed · note · excluded · unreadable) — SR-SPEC-INTAKE |
| validation report | the error · warning · info lines found in an uploaded spec before any PDF check, each with its cell — SR-SPEC-INTAKE |
| template v2 | the spec workbook format for new and edited sheets: Pages List, one row per parameter, no merged cells, Lists and Settings sheets — SR-SPEC-INTAKE |
| Pages List | the workbook's first sheet: one row per PDF page — tab, name, type (Required · Optional · Conditional), variant group, repeats, identifying text |
| inferred | a spec value read with lower confidence — from a legacy prose sheet, a `~`, or rich-text formatting |
| spec coverage | every spec row ends as checked, noted, unverifiable or excluded, each with its cell — shown beside pass/fail ("N of M rows checked") — SR-SPEC-CHECK |
| letterbox | scaling a candidate page of a different shape to fit the golden page's box, centred; its glyph sizes are then not compared |
