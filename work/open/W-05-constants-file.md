---
type: Handoff
name: W-05
description: "Arpit, 2026-10-16: create packages/ui/src/services/specConstants.ts — one file for every default and limit — and move today's scattered literals into it."
item: W-05
filed: 2026-10-16
filed_by: Arpit
updated: 2026-11-03
updated_by: Siddharth
ball: agent
---

# W-05 — one constants file

## At a glance

| | |
|---|---|
| **What** | One file, `packages/ui/src/services/specConstants.ts`, for every default and limit; today's scattered values move into it unchanged |
| **Why** | The same value lives in up to three places today, and W-02 and W-04 need one place to read theirs from |
| **Done when** | Every engine and CLI module reads from the one file, both builds pass, and the CLI regression run gives the same verdicts |
| **Status** | 🟢 5 of 5 DoD done · closed 2026-11-03 |
| **Waits on** | nothing — W-02 and W-04 are free to start |
| **Who** | `agent` · Sonnet |
| **Record** | SR-CONSTANTS |

```mermaid
flowchart LR
  S1["1 · file<br/>specConstants.ts"] --> S2["2 · move<br/>literals, values unchanged"] --> S3["3 · CLI<br/>same file via engine seam"] --> S4["4 · check<br/>both builds · same verdicts"] --> S5["5 · record<br/>SR-CONSTANTS built"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 file --> 2 move --> 3 CLI --> 4 check --> 5 record
```

</details>

**Arpit, 2026-10-16:** *"Make sure there is one common file … constants … used by the
whole project."* … *"Go for it."*

**Model:** Sonnet: moving literals into one typed file without changing a value is
mechanical; the type check and the existing tests catch a slip.

## Goal

`packages/ui/src/services/specConstants.ts` exists, holds every default and hard limit in
SR-CONSTANTS decision 2 plus the literals listed in its *Context*, and every engine and
CLI module reads from it. No value changes.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · file | `packages/ui/src/services/specConstants.ts`: zero dependencies, every key typed and required, the defaults in SR-CONSTANTS decision 2 | ✅ |
| 2 · move | all of them, values unchanged: `BASE_SCALE` ×3 (`pdfCompare.ts`, `pdfElements.ts`, `specCheck.ts`), `MAX_PAGE_WIDTH`, the page-verdict limits (`changes.ts`), `MOVED_OFFSET_IN` (`exportReport.ts`), `AUTO_SCAN_MAX_PAGES` (`App.tsx`), `DEFAULT_TOL` and `DEFAULT_ANCHOR_WITHIN` (`specCheck.ts`, after the 2026-11-03 ruling). `DEFAULT_THRESHOLDS` no longer exists | ✅ |
| 3 · CLI | the CLI build imports the same file through its engine seam | ✅ `packages/cli/src/platform/engine.ts` re-exports it |
| 4 · check | `npm run build` and the CLI build pass; the CLI regression run gives the same verdicts as before | ✅ both build, `verify:regression` unchanged, `verify:spec` 8/8 |
| 5 · record | SR-CONSTANTS `built` set to yes in the register; its Consequences updated | ✅ |

## Blockers

**DoD 2 is part-done and the rest is blocked on W-32.** Moved: `BASE_SCALE` ×2,
`MAX_PAGE_WIDTH`, the page-verdict limits, `MOVED_OFFSET_IN`, `AUTO_SCAN_MAX_PAGES`.

Not moved, and not movable from this machine: `DEFAULT_TOL`, `DEFAULT_ANCHOR_WITHIN` and
the third `BASE_SCALE`, all in `packages/spec/src/specCheck.ts`. That folder is sealed —
CLAUDE.md §*The sealed feature boundary* forbids editing it here, and
`scripts/check-boundary.sh` rule 2 forbids it importing from `packages/ui/src/services/`, which is
what reading the shared file would require. Doing it anyway breaks the build check and
writes work the spec machine never receives.

**W-32 decides it.** Option B (move the checker off the seal) dissolves this; under A or C
the spec checker keeps its own constants and SR-CONSTANTS decision 4 needs amending to
say so.

`DEFAULT_THRESHOLDS` in `packages/cli/src/core/pairs.ts` is named in the DoD but no longer exists —
thresholds came out of the CLI on 2026-10-16.

## Record affected

[SR-CONSTANTS](../../records/0103_CONSTANTS.md) decisions 1, 2, 4, 5.

## Hazards

- **Two rules disagree inside the app today** — the strip's `pageHasChange` (moved > 0.02 in)
  and the verdict's `summaryPageDiffers` (offset > 2 px, also the CLI's judge). Move both
  values as they are; W-27 unifies them into `pageVerdict` (SR-COMPARE decision 3).
- **W-29 moves the engine into `packages/core`** — this file moves with it and SR-CONSTANTS's
  `owns:` path follows (W-29 DoD 6). Land this first; it is small.
- The moved literals sit in files W-01 still owns, so those commits stage
  `work/open/W-01-claim-components.md` too.

## Reference

- [SR-CONSTANTS](../../records/0103_CONSTANTS.md)
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §Verdict rules: app vs CLI
