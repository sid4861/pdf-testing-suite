# CLAUDE.md — the agent contract for pdf-testing-suite

This file is binding. It carries **pointers, never rules**: every rule lives in
exactly one record under [`records/`](records/README.md) and nothing here
restates one ([SR-LAW-0](records/0002_LAW-0-authority.md)). Read this, then
[`work/INTERVIEW.md`](work/INTERVIEW.md), before your first substantive change.

## Law zero — the records are always up to date

Stated once in [SR-LAW-0](records/0002_LAW-0-authority.md) decision 1a — three
obligations; the third cannot be enforced and is the only thing covering
coherence. The gate for the first two is [SR-WORK-OWNERSHIP](records/0058_WORK-ownership.md)
decisions 3 and 6. Install its `commit-msg` hook once:

```bash
ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg
```

## Triage first — a human-blocked queue stops the session

**Before any work, read [`work/OPEN-WORK.md`](work/OPEN-WORK.md)** and ask: *is
any item agent-closable right now?* If none is, the session's **first** output
is the blocked-on-Siddharth or Arpit list and it then **stops**. What the first output must
name, the inbox, the 5-day rule, the `↳ blocks:` sub-row and which balls an
agent may pick from are [SR-WORK-OPEN-QUEUE](records/0051_WORK-open-queue.md)
rules 32–34 and 39–45. **Claude Code never picks from the `research` section**
(rule 37a). **Two strikes → a gate**: [SR-WORK-SESSION](records/0054_WORK-session.md)
decision 13.

## Where the state of play lives

| you want | read |
|---|---|
| what to work on next | [`work/OPEN-WORK.md`](work/OPEN-WORK.md) — **the single live queue** |
| what has been named and nobody is doing | [`work/BACKLOG.md`](work/BACKLOG.md) |
| the judgment behind the current state | [`work/INTERVIEW.md`](work/INTERVIEW.md) |
| what has actually shipped | [`work/IMPLEMENTATION.md`](work/IMPLEMENTATION.md) |
| the spec for anything | [the register](records/README.md) |
| a closed fork and its reopen-trigger | [`work/compare/`](work/compare/README.md) |
| a word you don't recognise | [`docs/GLOSSARY.md`](docs/GLOSSARY.md) |
| how the product is built — app, tabs, CLI | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| why a command fails on *this* machine | [`work/MACHINE.md`](work/MACHINE.md) |
| the stages a feature moves through | [SR-WORK-LIFECYCLE](records/0053_WORK-lifecycle.md) |
| what a session owes before it ends, and how long an answer may be | [SR-WORK-SESSION](records/0054_WORK-session.md) |
| what a task owes the documentation | [SR-WORK-DOCS](records/0055_WORK-docs.md) |
| what to do when you cannot proceed without Siddharth or Arpit | [SR-WORK-BLOCKERS](records/0056_WORK-blockers.md) |
| whether a claim may be grounded in an archived doc | [SR-WORK-ARCHIVE](records/0057_WORK-archive.md) |
| which record owns a module | [`records/README.md`](records/README.md) §Ownership |
| which file governs what | [SR-WORK-GOVERNANCE](records/0059_WORK-governance.md) |
| the whole set of rules about how work is done | the **WORK** records `0051`–`0060` |

Any work item that starts, finishes, blocks or is descoped updates
`OPEN-WORK.md` **in the same change as the work**. The record is the spec;
OPEN-WORK is the state; `IMPLEMENTATION.md` is the record of what landed.

## The laws

Each law is stated in exactly one record and is **not restated here**:

- **L0** — SRs are the only source of truth; Law records outrank every other record — [SR-LAW-0](records/0002_LAW-0-authority.md)
- **L1** — a retired record is archived, never deleted — [SR-LAW-1](records/0003_LAW-1-retired-records-archived.md)

[SR-LAWS](records/0001_LAWS.md) assigns the handles and routes each to its
record; that is all it does. Add a law by adding a record in the law range and
a line here, on Siddharth's or Arpit's ruling named in the record.

## Documentation (required)

Three rule groups, one home — [SR-WORK-DOCS](records/0055_WORK-docs.md): how a
doc is written (decisions 1–5); who may edit the agent-steering files, this one
included, and under what two obligations (6–8 — **read before editing
`CLAUDE.md`**); the documents every task updates before it is done (10). The
registry is [SR-WORK-REGISTRY](records/0060_WORK-registry.md) §3.

**The shared memory between sessions is [`work/`](work/README.md)**; `docs/`
holds what the project *is*. Read `work/README.md` once; it is the map.

## Session continuity (required)

The worklog entry (a chat-only session counts), the interview kept current
*during* the session, the one-line `work/NOW.md`, the transition markers and
how long an answer may be — [SR-WORK-SESSION](records/0054_WORK-session.md).

## Blockers stop the session (required)

A blocker is a file — [`work/BLOCKED.json`](work/BLOCKED.json) — and the
session stops. Its shape, the four values, the prohibition on working around
one and the hooks that enforce it — [SR-WORK-BLOCKERS](records/0056_WORK-blockers.md).

## Archive is not evidence

One archive, [`archive/`](archive/README.md), at the repo root. What may be
named, what may never be cited — [SR-WORK-ARCHIVE](records/0057_WORK-archive.md).

## The sealed feature boundary

`src/features/spec/` is developed on a second machine that can read the real
spec workbooks, cannot push, and cannot send files out. Work goes **one way**:
this machine pushes to GitHub, that machine downloads a zip and refreshes
everything *except* that folder with `scripts/update-from-zip.sh`.

**The copy of `src/features/spec/` in this repository is a stale mirror.** The
live version is on the other machine and does not come back. It is kept here so
the app builds and the tab runs. **Do not edit it from this machine** — an edit
here is work the other machine will never see.

The folder therefore shares **no file** with the rest of the repository, and the
rest of the repository reaches it only through `index.ts` (app) or `engine.ts`
(CLI). The contract, the dependency allow-list, the CSS prefix rule and both
machines' procedures are stated once in
[`src/features/spec/README.md`](src/features/spec/README.md).

Before changing anything under `src/` or `cli/`:

```bash
sh scripts/check-boundary.sh
```

If a task seems to need both sides, that is the finding — raise it rather than
editing across.

## Hard-won build knowledge

Dated lessons live in [`work/LESSONS.md`](work/LESSONS.md), newest first.
Three that bind hard enough to name here: **re-derive `git status` right before
staging** — concurrent sessions commit too; **ground truth over prose** — a doc
repeating another doc is not a second source; **a loaded machine produces a
clean, localised anomaly** that reads like a finding — say what you are
running.

## Layout

```
work/        THE SHARED MEMORY between sessions — start at work/README.md
records/     THE STANDING RECORDS — the register, the template, the laws, the WORK records
docs/        WHAT THE PROJECT IS — the glossary, the architecture diagrams
archive/     THE ONE ARCHIVE — everything retired, mirroring the live tree
scripts/     the commit guard, the inbox check, the boundary check, the zip refresh
.claude/     hooks and their wiring
src/ cli/ public/ tools/   the product — owned by W-01 until each has a record
src/features/spec/   A SEALED FEATURE — its own contract, see its README.md
```
