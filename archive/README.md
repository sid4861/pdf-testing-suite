# `archive/` — the one archive, and where each thing went

**There is exactly ONE archive directory, and it is this one, at the repo
root.** Anything archived is moved here, into a directory mirroring where it
came from. This README is the **map**: every archived doc gets a row naming its
**live successor**.

## Archive is not evidence

A doc in here may be *named*. It may never be *cited as backing a live claim*
— nothing guarantees an archived file was not overwritten after it was
retired. Entries are frozen; **relative links inside them are not repaired**.
Rules: [SR-WORK-ARCHIVE](../records/0057_WORK-archive.md).

## Layout — the archive mirrors the live tree

| directory | holds |
|---|---|
| `open/` | closed work items' detail files, byte for byte |
| `records/` | retired records (L1) |
| `compare/` | decided forks whose triggers were ported into a record |
| `proposals/` | implemented or rejected proposals |
| `worklog/` | worklog slices cut at each major release |
| `bootstrap/` | the bootstrap document a work system was set up from, if one is ever archived |
| `docs/architecture/` | superseded standalone diagrams, when a diagram is replaced rather than re-rendered |

## `open/`

| file | closed | where the live answer lives now |
|---|---|---|
| [W-03-remove-cli-py.md](open/W-03-remove-cli-py.md) | 2026-10-16 — shipped | [SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md) |

## `records/`

| file | retired | ruling | successor |
|---|---|---|---|

## `compare/`

| file | decided | the trigger lives in |
|---|---|---|

## `proposals/`

| file | outcome | successor |
|---|---|---|

## `docs/architecture/`

| file | superseded | where the live answer lives now |
|---|---|---|
| [18-planned-spec-conversion.svg](docs/architecture/18-planned-spec-conversion.svg) | 2026-10-18 — the plan it drew (LLM fallback, confidence tiers) was replaced by the ruled pipeline | [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §Spec driven comparison, end to end — `18-target-spec-driven-comparison.svg`; rules in SR-SPEC-INTAKE, SR-SPEC-CHECK, SR-SPEC |

## `bootstrap/`

| file | archived | successor |
|---|---|---|
