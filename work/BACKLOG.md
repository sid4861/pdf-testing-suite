---
type: Queue
description: "The named-but-unclaimed: everything a record, proposal or compare doc says is outstanding and nobody is doing. The list only — its rules live in the record below."
governed_by: SR-WORK-BACKLOG
governed_by_path: records/0052_WORK-backlog.md
---

# BACKLOG — what has been named and is not being done

**This file is the LIST.** Everything else — what the backlog is, what feeds
it, the shape of a row, the five classes, how an item leaves, and the one
obligation it puts on every session — is stated once in
**[SR-WORK-BACKLOG](../records/0052_WORK-backlog.md)** and is not repeated here.

⚠ **Its length is not a signal.** `OPEN-WORK.md`'s length is how much is
pending; this file's length is how honest the records have been. Do not trim
it, and do not read it top-down as a priority order.

**Nothing here is in [`OPEN-WORK.md`](OPEN-WORK.md).**

---

## `unbuilt` — a ratified decision the code does not implement

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-008 | Stale-pair detection — warn when the workbook and the PDF look out of step (deferred by Arpit, 2026-10-16) | [SR-SPEC-INTAKE](../records/0101_SPEC-intake.md) Consequences | a ruling to build it, then a `W-nn` |
| B-009 | A Draft / Ready status per page sheet, so unfinished sheets are skipped (deferred by Arpit, 2026-10-16) | [SR-SPEC-INTAKE](../records/0101_SPEC-intake.md) Consequences | a ruling to build it, then a `W-nn` |
| B-010 | A version diff between two spec JSONs — what changed in the workbook (deferred by Arpit, 2026-10-16) | [SR-SPEC-INTAKE](../records/0101_SPEC-intake.md) Consequences | a ruling to build it, then a `W-nn` |
| B-015 | A standalone PDF viewer app — `apps/viewer` (Arpit, 2026-10-18: "in future"); the `@pdfsuite/viewer` package itself is W-42 | W-44 · SR-MONOREPO | a ruling to start it, then a `W-nn` |
| B-016 | A PDF designer — `apps/designer`, `@pdfsuite/template`, `@pdfsuite/designer` (Arpit, 2026-10-18: "in future") | W-44 · SR-MONOREPO | a ruling to start it, then a `W-nn` |
| B-017 | A PDF creator — `@pdfsuite/render`: template + data → PDF locally (Arpit, 2026-10-18: "in future") | W-44 · SR-MONOREPO | a ruling to start it, then a `W-nn` |

---

## `ungated` — a stated rule nothing mechanically checks

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-001 | The queue's row rules (13–19, 42, 45) are enforced by nothing but the inbox-shape hook | [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) Consequences | a test over `work/OPEN-WORK.md` rows, as a `W-nn` |
| B-002 | `owns:` ↔ Ownership table agreement is unchecked in either direction | [SR-WORK-OWNERSHIP](../records/0058_WORK-ownership.md) decision 2 | a test parsing both, as a `W-nn` |
| B-003 | The registry's decisions 5–8 are enforced by nothing | [SR-WORK-REGISTRY](../records/0060_WORK-registry.md) Consequences | a test over §3, as a `W-nn` |
| B-004 | A `W-nn` that resolves to neither `work/open/` nor `archive/open/` is caught by nobody | [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rules 7, 17 and 53 | a test, as a `W-nn` |
| B-005 | A second `archive/` directory anywhere is caught by nobody | [SR-WORK-ARCHIVE](../records/0057_WORK-archive.md) decision 1 | a test, as a `W-nn` |
| B-011 | "No tunable literal lives in engine code outside this file" is checked by nothing | [SR-CONSTANTS](../records/0103_CONSTANTS.md) decision 4 | a lint or test over `src/` and `cli/src/`, as a `W-nn` |
| B-012 | "No Python in the product" is checked by nothing | [SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md) decision 1 | a test over `git ls-files`, as a `W-nn` |
| B-013 | "One function for the UI and the CLI" is checked by nothing beyond W-27's Compare parity test | [SR-LAW-3](../records/0005_LAW-3-one-function-ui-and-cli.md) Consequences | a test that runs each core step from both surfaces on a fixture and diffs the output, as a `W-nn` |
| B-014 | "Only open-source dependencies" is checked by nothing | [SR-LAW-2](../records/0004_LAW-2-open-source-only.md) Consequences | a zero-dependency licence check over every installed package, in `npm test`, as a `W-nn` |

---

## `unmeasured` — a live default, constant or claim with no measurement behind it

| id | what is outstanding | named in | what closes it |
|---|---|---|---|

---

## `unruled` — a fork named and not decided

| id | what is outstanding | named in | what closes it |
|---|---|---|---|

---

## `cost` — a consequence accepted deliberately

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-006 | The guard proves a record was touched, never that it is coherent; L0 obligation (iii) is judgment | [SR-LAW-0](../records/0002_LAW-0-authority.md) decision 1a | never graduates; it is the stated price of a mechanical gate |
| B-007 | The `Stop` hook relents after three refusals, so a blocker can be walked past | [SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) decision 8 | never graduates; a hook that never relents is a hang |
