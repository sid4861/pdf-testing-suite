---
type: Handoff
name: W-01
description: "Opened at work-system setup so no component is unowned: every product path is owned by this item until a record claims it."
item: W-01
filed: 2026-10-13
ball: agent
---

# W-01 — claim every component with a record

**Arpit, 2026-10-13:** *"Code folders the records should cover: everything in the repo."*

**Model:** Opus: deciding where one component's decision ends and another's begins is design judgment that no test checks.

## Goal

Replace every `W-01` owner in the register's Ownership table with a Standing
Record (`0101`+) that states the decisions behind that component.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · app | records for `src/` (and `index.html`, `vite.config.ts`, `tsconfig*`, `package*.json`, `flag.env`), split where decisions differ (e.g. feature flags, annotations, ignore-difference). **Spec paths done 2026-10-16:** SR-SPEC-INTAKE, SR-SPEC-CHECK, SR-CONSTANTS — moved to the sealed `src/features/spec/` by `main`'s spec separation; still unclaimed there: `sheetRead.ts`, `sheetSpec.ts` (likely SR-SPEC-INTAKE), `engine.ts`, `pdfjs.ts`, `index.ts`, `spec.css`, `README.md`. Also new on `main`: `pagePairs.ts`, `PagePairing.tsx`, `regionStore.ts`, `DataRegionLayer.tsx` | ⏳ |
| 2 · CLIs | a record for `cli/`; `cli-py/` was removed by W-03 on 2026-10-16 (SR-STACK-TYPESCRIPT) | ⏳ |
| 3 · static | records for `public/` and `tools/` (`public/samples/spec-sample.*` and `tools/samples/excel-spec-hierarchical/` done 2026-10-16) | ⏳ |
| 4 · docs | `README.md`, `spec-standard.md` (done: SR-SPEC-INTAKE), `comparison.md`, `presentation-script.md`, `docs/ARCHITECTURE.md`, `docs/architecture/` owned by the record they describe, or a docs record | ⏳ |
| 5 · strays | `.tmp-old-block.txt`, `.gitignore`, `.claude/launch.json` owned or removed (a removal is Siddharth's or Arpit's call) | ⏳ |
| 6 · table | no `W-01` left in the Ownership table; each record's `owns:` matches it | ⏳ |

## Blockers

None. DoD 5's removals need a ruling only if a file is to be deleted.

## Record affected

Creates new records `0101`+; updates the register's Ownership table
([SR-WORK-OWNERSHIP](../../records/0058_WORK-ownership.md) decision 2).

## Hazards

- Until this closes, every product commit must stage this file or say `no SR
  affected` — the guard treats `W-01` as the owner.
- `spec-standard.md` and `comparison.md` may already carry decisions; move
  them into records rather than restating them (L0).

## Reference

- [`records/README.md`](../../records/README.md) §Ownership
- [SR-WORK-LIFECYCLE](../../records/0053_WORK-lifecycle.md) decision 9
