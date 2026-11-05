---
type: Log
description: "Dated lessons — what this project learned the hard way, newest first. A log, not a record: the date is part of the lesson."
---

# LESSONS — what this build learned the hard way

Newest first. A lesson whose remedy is a *rule* belongs in a record and is
named here only as the failure that produced it. A lesson whose remedy is
*judgment* lives here. ⚠ Nothing here is normative.

---

## 2026-11-05 — a hidden browser pane freezes `requestAnimationFrame`, and pdf.js then never finishes

**What happened.** After wiring page binding into `runSpec`, the Spec tab sat on
“Checking the PDF against the spec…” forever, while the same code passed 25/25 in Node.
Half an hour went into bisecting a change that was not at fault: the binder was proved
correct in the browser, the old by-number path hung too, and `getTextContent` and
`getOperatorList` both returned fine. `page.render()` was the one call that never
resolved — as the *first* operation on a fresh document, with nothing before it.

**Why.** Claude's window was behind another window, so the Browser pane's page was
treated as a background page and `requestAnimationFrame` stopped firing. pdf.js's canvas
renderer waits on it, so the render promise never settles. Screenshots had started timing
out at the same moment, with a message saying exactly this — and it read as unrelated
flakiness.

**The judgment.** A hang that reproduces in the pane and not in Node is a question about
the *pane* before it is a question about the code. One line settles it:

```js
await Promise.race([
  new Promise(r => requestAnimationFrame(() => r('fired'))),
  new Promise(r => setTimeout(() => r('NEVER'), 3000)),
])
```

`NEVER` means the page is not being drawn, and anything that waits on a frame — pdf.js
rendering, canvas work, a CSS transition's end event, screenshots — will hang rather than
fail. Showing the preview pane (`show_pane`) unfreezes it. Note also what *did* work while
frozen: timers, promises, network, and every headless pdf.js call. A frozen pane is not a
dead pane, which is why it reads as a bug in the code.

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
