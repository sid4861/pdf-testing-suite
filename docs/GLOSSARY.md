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
| At a glance | the section every `W-nn` file opens with: a seven-row table (what · why · done when · status · waits on · who · record) and, for a plan of three or more steps, its flowchart — the screen shown in a meeting; SR-WORK-LIFECYCLE decisions 4a–4d |
| ball | the one marker every queue row opens with: 🔴 🟣 🟡 🟢 |
| decider | Siddharth or Arpit — either one rules alone; see SR-WORK-BLOCKERS decision 11 |
| core | the shared functions both the app and the CLI call — since W-29 the packages `@pdfsuite/core`, `compare` and `spec`, not a folder in the app; SR-LAW-3 |
| surface | the app or the CLI — what a person or a pipeline uses; it owns only presentation and delivery; SR-SURFACE-PARITY |
| host | `@pdfsuite/cli`: the package that owns the `pdfsuite` binary, the config file and the exit codes, and owns no PDF work. It loads its commands from other packages — SR-NPM-PACKAGES decision 3 · **built** (W-30) |
| command module | what a package exports at `./cli` so the host can add its command: `{ name, version, register(program, host) }`. It registers its own flags and help, because the host does not know what its command takes. It is a **separate bundle**, so what crosses from the host is copied, not shared · **built** (W-30, W-32) |
| barrel | the one file a package publishes a surface through, so nothing outside imports past it. `@pdfsuite/spec` has three — the tab, the engine, the command — and `scripts/check-boundary.sh` is the check |
| discovered | of a command: it exists because its package is installed, not because the host was built with it. A missing package is exit 2 with the `npm i` to run, and is still listed by `--help` · **built** |
| blocker | `work/BLOCKED.json` with a decision other than `PROCEED` |
| veto condition | the checkable condition under which a decision reopens |
| golden PDF | the reference PDF (side A); its page sets the target box every comparison draws into |
| candidate | the PDF under test (side B); the CLI's `--candidate` folder |
| spec JSON | the only input the spec checker runs: assertions compiled from a workbook (or uploaded directly), each with `source: {sheet, cell}`, plus the workbook's hash and template version — SR-SPEC-INTAKE · **built** |
| extraction JSON | every row the workbook reader saw: sheet, cell, raw text, parsed value, status (parsed · note · excluded · unreadable) — SR-SPEC-INTAKE · **built**, frozen as a fixture oracle |
| validation report | the error · warning · info lines found in an uploaded spec before any PDF check, each with its cell, and every accepted assertion in plain words — SR-SPEC-INTAKE · **built**, shown in the Spec tab |
| template v2 | the spec workbook format for new and edited sheets: Pages List, Settings and Lists sheets, one page sheet per page, one row per parameter, one cell one fact; Element, Part and Group merged over the rows they label and read from the declared range — SR-SPEC-INTAKE · **built** |
| Pages List | the workbook's first sheet: one row per PDF page — tab, name, type (Required · Optional · Conditional), variant group, repeats, identifying text. Its absence is what marks a workbook as legacy · **built** |
| inferred | a value the reader worked out rather than read — from a legacy prose sheet. It never becomes an assertion: it is written into a **draft v2 workbook**, amber, for a person to confirm · **built** |
| draft v2 workbook | what a legacy upload produces instead of a check: Template v2 with the inferred cells amber, the unreadable ones red and Check? = Note throughout — SR-SPEC-INTAKE decision 8 · **built** |
| spec coverage | every spec row ends as checked, noted, unverifiable or excluded, each with its cell — shown beside pass/fail ("N of M rows checked") — SR-SPEC-CHECK · **built** |
| letterbox | scaling a candidate page of a different shape to fit the golden page's box, centred; its glyph sizes are then not compared |
