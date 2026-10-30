---
type: Log
description: "Dated lessons — what this project learned the hard way, newest first. A log, not a record: the date is part of the lesson."
---

# LESSONS — what this build learned the hard way

Newest first. A lesson whose remedy is a *rule* belongs in a record and is
named here only as the failure that produced it. A lesson whose remedy is
*judgment* lives here. ⚠ Nothing here is normative.

---

## 2026-10-18 — items filed in parallel go stale against same-day records

**What happened.** On one day, sessions filed 34 work items and wrote 12 records. By evening
twelve item files still named "a new CLI record", "six packages", "the README batch script" or
`src/services/` paths — all superseded by SR-CLI, SR-NPM-PACKAGES (seven), `--each` and the
packages layout, written the same day by other sessions.

**Lesson.** An item's *Record* row and DoD text are claims about the records; check them
against the records they name before ruling on the item or picking it up. The record is the
spec; the item file is a pointer that can lag.

## 2026-10-18 — a section rewrite drops what a concurrent session added inside it

**What happened.** A review session rewrote the whole *Blocked on* block of `OPEN-WORK.md`
from a read taken earlier; another session had filed W-42's inbox row in between. The row was
lost and had to be restored by the session that noticed.

**Lesson.** In `work/*.md`, edit the row you mean, never the section around it, and re-read the
file immediately before writing — SR-WORK-SESSION decision 10 applies to every write, not
only to commits.
