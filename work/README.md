---
type: Index
description: "Map of work/ — the shared memory between sessions."
---

# `work/` — the shared memory between sessions

Everything here exists so a session that has never seen this repo can arrive
cold, learn the true state in minutes, do work, and leave the next session
better off. Every file has a trigger that says when it must change.

`docs/` and `records/` hold what the project **is**; `work/` holds what is
**happening to it**.

## The map

| file | what it is | when it changes |
|---|---|---|
| [`OPEN-WORK.md`](OPEN-WORK.md) | **read first** — the single live queue; the list only | in the **same change** as the work that affects it |
| [`BACKLOG.md`](BACKLOG.md) | the named-but-unclaimed, five classes; rules in [SR-WORK-BACKLOG](../records/0052_WORK-backlog.md). ⚠ its length is not a signal | a record names something outstanding, or a row is promoted — same change |
| [`WORKLOG.md`](WORKLOG.md) | append-only session log, newest first | **every** session, before it ends — chat-only ones too |
| [`INTERVIEW.md`](INTERVIEW.md) | the state-of-play doc a cold successor reads | **during** the session, not at the end |
| [`IMPLEMENTATION.md`](IMPLEMENTATION.md) | what shipped, when, and how it turned out | something lands |
| [`NOW.md`](NOW.md) | one line: current state and immediate next step | every transition; `idle` when stopping |
| [`BLOCKED.json`](BLOCKED.json) | the blocker file — [SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) | a session blocks or Siddharth or Arpit rules |
| [`LESSONS.md`](LESSONS.md) | dated lessons, newest first — a log, because the date is the lesson | a failure teaches something durable |
| [`MACHINE.md`](MACHINE.md) | environment and tooling quirks of wherever this runs | a surface breaks in a way the code did not cause |
| [`open/`](open/README.md) | one detail file per open `W-nn` | opened with the item, **archived** with it |
| [`compare/`](compare/README.md) | live forks — verdict + reopen-trigger | a fork opens, closes, or its trigger fires |
| [`design/`](design/README.md) | the UI designs and **Proof**, the design system — exported from the Design canvas; source for W-50 and W-51 | the canvas changes — re-export every file in one change |
| [`proposals/`](proposals/README.md) | parked ideas, not adopted | filed, graduates, or rejected |
| `samples/` | **fictional test samples** — spec workbooks, PDFs, planted errors and their expected results; product fixtures, each owned by a record in the register's table (Arpit, 2026-10-18). Never a real workbook | a sample is added, regenerated or retired — with its owning record |

**Records live in [`../records/`](../records/README.md), and nowhere else.**

**Fork or idea?** A live fork → `compare/`. An undecided idea → `proposals/`.
If you cannot tell, it is a proposal.

**Queue or backlog?** If somebody is doing it, or is about to, it is a `W-nn`
in `OPEN-WORK.md` with a ball and a detail file. If it has only been *named*,
it is a `B-nnn` row in `BACKLOG.md` and nothing else. **Never both.**

## Three cross-cutting rules

1. **Archive is not evidence.** One archive, [`../archive/`](../archive/README.md),
   at the repo root. A doc there may be *named*; it never backs a live claim.
2. **Concurrent sessions are real.** Before committing a change to any
   `work/*.md`, re-read the file and re-apply your edit.
3. **Ground truth over prose.** Before any status claim, check `git log`, the
   code, or a command that reproduces it.

## Starting a session here

1. Read [`../CLAUDE.md`](../CLAUDE.md).
2. Read [`INTERVIEW.md`](INTERVIEW.md) — state of play, in-flight work, next step.
3. Read [`OPEN-WORK.md`](OPEN-WORK.md), and [`BACKLOG.md`](BACKLOG.md) before
   filing anything new; reconcile the queue against
   [`IMPLEMENTATION.md`](IMPLEMENTATION.md) and the repo.
4. Do the work, updating `OPEN-WORK.md`, `NOW.md` and `INTERVIEW.md` as you go.
5. Append to [`WORKLOG.md`](WORKLOG.md) before you finish.
