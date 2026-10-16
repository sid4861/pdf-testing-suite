---
type: Handoff
name: W-05
description: "Arpit, 2026-10-16: create src/services/specConstants.ts — one file for every default and limit — and move today's scattered literals into it."
item: W-05
filed: 2026-10-16
ball: agent
---

# W-05 — one constants file

**Arpit, 2026-10-16:** *"Make sure there is one common file … constants … used by the
whole project."* … *"Go for it."*

**Model:** Sonnet: moving literals into one typed file without changing a value is
mechanical; the type check and the existing tests catch a slip.

## Goal

`src/services/specConstants.ts` exists, holds every default and hard limit in
SR-CONSTANTS decision 2 plus the literals listed in its *Context*, and every engine and
CLI module reads from it. No value changes.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · file | `src/services/specConstants.ts`: zero dependencies, every key typed and required, the defaults in SR-CONSTANTS decision 2 | ⏳ |
| 2 · move | `DEFAULT_TOL`, `DEFAULT_ANCHOR_WITHIN` (`specCheck.ts`), `BASE_SCALE` (three copies: `pdfCompare.ts`, `pdfElements.ts`, `specCheck.ts`), `MAX_PAGE_WIDTH` (`pdfCompare.ts`), the page-verdict limits (`changes.ts`), `MOVED_OFFSET_IN` (`exportReport.ts`), `AUTO_SCAN_MAX_PAGES` (`App.tsx`), `DEFAULT_THRESHOLDS` (`cli/src/core/pairs.ts`) moved with values unchanged | ⏳ |
| 3 · CLI | the CLI build imports the same file through its engine seam | ⏳ |
| 4 · check | `npm run build` and the CLI build pass; the CLI regression run gives the same verdicts as before | ⏳ |
| 5 · record | SR-CONSTANTS `built` set to yes in the register; its Consequences updated | ⏳ |

## Blockers

None.

## Record affected

[SR-CONSTANTS](../../records/0103_CONSTANTS.md) decisions 1, 2, 4, 5.

## Hazards

- **The app's and the CLI's page verdicts differ today.** Move both values as they are;
  do not unify them here (`docs/ARCHITECTURE.md` §Verdict rules).
- The moved literals sit in files W-01 still owns, so those commits stage
  `work/open/W-01-claim-components.md` too.

## Reference

- [SR-CONSTANTS](../../records/0103_CONSTANTS.md)
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §Verdict rules: app vs CLI
