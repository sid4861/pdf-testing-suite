---
type: Log
description: "Dated lessons — what this project learned the hard way, newest first. A log, not a record: the date is part of the lesson."
---

# LESSONS — what this build learned the hard way

Newest first. A lesson whose remedy is a *rule* belongs in a record and is
named here only as the failure that produced it. A lesson whose remedy is
*judgment* lives here. ⚠ Nothing here is normative.

---

## 2026-11-09 — a rule about not losing data has to be run twice

**What happened.** `--sync` has four rules, and the one that matters is "never overwrite
a file the consumer edited". It passed on the first upgrade. Then the smoke test ran a
*second* upgrade on the same app, and three separate bugs appeared at once: the edited
file was silently overwritten, the deleted file came back, and in new mode
`package.json` would have been replaced wholesale — taking with it every dependency and
script the consumer had added.

**Why the first run proves nothing.** Each bug was in how the *record* was rewritten
after a successful sync, not in the rules themselves. The rules read correctly, ran
correctly, and then left behind a record that made the next run wrong. The worst of them
inverted the feature's one promise: hashing the files off disk recorded the consumer's
edit as "what pdfsuite wrote here", so the following upgrade saw a match and overwrote
it. A reviewer reading the diff would have seen four correct rules.

**The judgment.** Anything that decides *not* to touch something, based on state it also
maintains, has to be exercised until that state has been through at least two cycles.
"Run it twice" is cheap — it is one more line in the test — and it is the only thing
that distinguishes a rule from a rule plus the bookkeeping that keeps it true. The same
shape applies to the other side: the record a step writes should be built from what the
step **intended**, not from reading back whatever ended up on disk, because the disk also
contains everything the step deliberately left alone.

**Cost:** about an hour, nothing shipped wrong — the second run was in the test before
the feature was called done.

---

## 2026-11-06 — a driven click is not a mouse, and the app is not the first suspect

**What happened.** Verifying the Inspect tab after its measurements moved into the core,
I hovered an element (the outline appeared, the panel said *Selecting: Account 100482-7*)
and clicked it. Nothing selected. I tried it again with a second between the two, then at
other coordinates, then started reading my own diff for a state bug I had introduced.
There was none. Dispatching one `mousemove` and one `click` from a single
`javascript_tool` call selected it immediately, first try.

**Why.** `onClick` reads `hovered` out of its render closure. A real mouse produces a
long stream of `mousemove`s, so by the time the click lands React has re-rendered and the
handler closes over the current value. Two separate automation calls do not reliably
produce that: the click can run against a closure from before the hover committed. The UI
is correct for a human and wrong for a robot, which is a thing automation does and the
code does not.

**The judgment.** When a driven interaction does nothing and the *visible state* says the
app understood the step before it — the hover outline was drawn, the hint named the
element — the gap is between the two tool calls, not in the component. Collapse them:
dispatch the events together from one script, or verify through the state the app already
shows rather than through a second interaction. Read the diff only after that rules out.

**Cost:** four rounds and a partial re-read of a file I had just written.

---

## 2026-11-06 — the same defect in a third walker, and a fix that can prove itself

**What happened.** `pdfElements.ts` ignored a Form XObject's own `/Matrix`, so every
image inside a form was measured at the wrong place. This is the *third* copy of that
defect: W-04 found and fixed it twice in the spec walkers. It was found this time by
reading the two walkers side by side while moving code, not by a test — no fixture in the
repository has an image inside a form.

**Why it keeps happening.** pdf.js delivers a form's matrix as the first argument to
`paintFormXObjectBegin`, not as a `transform` op. Anyone writing an operator-list walker
tracks `save`, `restore` and `transform`, which looks complete, and is wrong only for
documents a quick fixture does not contain.

**The judgment.** Two things. A walker over pdf.js's operator list now has a known
checklist, and `/Matrix` is on it. And the fixture that proves the fix must be **assembled
by hand**: `pdf-lib` writes only an identity matrix, and identity is precisely the case
where the bug and the fix agree — W-04's first test passed with the fix reverted. The
fixture is now shared (`verify/fixtures-form-xobject.ts`) rather than copied, and the
habit that goes with it is cheap: **revert the fix and watch the test fail**, at the
numbers you predicted. Here it reported 0.2778″ where 0.4167″ is correct, which is what
made the test worth having.

---

## 2026-11-06 — a plugin boundary is a bundle boundary, so `instanceof` stops being true

**What happened.** W-30 makes `pdfsuite` load its `compare` command out of an installed
package. The first cut had the command module import `ToolError` from the host and throw
it, exactly as the command had done while it lived inside the host. That compiles, passes
every type check, and runs correctly in the workspace — because in the workspace both
sides resolve to the same file. Published, they do not: the module is bundled into
`@pdfsuite/compare/dist/cli.js` with its own copy of the class, and the host's
`err instanceof ToolError` is then false for every error the module raises. Every clean
"Error: no --out directory" would have printed as `Unexpected error:` with a stack, and
the exit code would still have been 2, so nothing would have failed loudly.

**Why it is easy to miss.** Nothing about the *import* is wrong. The mistake is in
believing one thing — "the host and the command share a type" — which is true of a
monorepo and false of an install. A workspace symlink is specifically designed to make
the difference invisible.

**The judgment.** The moment code is loaded at run time from somewhere else, ask what is
*shared* and what is *copied*. Values and classes crossing that line are copied; only the
shape survives. So: recognise by a brand (`err.brand === 'pdfsuite.ToolError/1'`), not by
identity; put what both sides genuinely need in a package they both depend on
(`@pdfsuite/core/node`); and import the host for **types only**, handing over anything
runtime through the interface it passes in. The same reasoning answers the other wall hit
that day — `createRequire` cannot resolve a TypeScript source, so a package whose command
is loaded at run time must ship built JavaScript, which means a `prepack` and a `files`
entry, which means the install test is the only thing that can prove it.

**Cost:** about forty minutes of design, nothing shipped wrong — the second wall is what
raised the first question.

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
