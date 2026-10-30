---
type: Standing Record
kind: process
name: SR-WORK-OPEN-QUEUE
title: "SR-WORK-OPEN-QUEUE (0051) — how OPEN-WORK.md works"
description: "The single live work queue: an item's lifecycle, the shape of a row, the balls, ordering, the Blocked-on inbox, and closing by archive."
status: accepted
date: 2026-10-13
feature: the work queue
owns: [scripts/check-open-work-inbox.py, .claude/hooks/guard-open-work-inbox.sh]
laws: [L0]
timestamp: 2026-10-13T12:51:43Z
content_sha: ""
---

# SR-WORK-OPEN-QUEUE — how OPEN-WORK.md works

## §1 — For humans

**`work/OPEN-WORK.md` is the one list of what is being done.** Each item is one
short row plus a detail file in `work/open/`; the row names who filed it. Every row opens with one ball
that says whether it can move: 🔴 waiting on Siddharth or Arpit, 🟣 waiting on a date, 🟡
waiting on another item, 🟢 free to pick up.

**The top of the file is the inbox** — every decision Siddharth or Arpit owes, with its age.
A closed item's row is deleted and its file moved to `archive/open/`; nothing
is ticked, nothing is lost.

```mermaid
flowchart LR
    B["B-nnn in BACKLOG"] --> W["W-nn file + row + ball"]
    W --> R{"ball"}
    R -->|🔴| I["inbox + ↳ blocks"]
    R -->|🟢| P["agent picks it"]
    P --> C["IMPLEMENTATION row → row deleted → file to archive/open/"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
   B-nnn ---> W-nn file + row + ball ---> 🔴 inbox + ↳ blocks
                                     \--> 🟢 agent picks it ---> IMPLEMENTATION row
                                                                 -> row deleted
                                                                 -> file to archive/open/
```

</details>

## §2 — For agents

### Context

A queue split across several documents goes stale in all but one; a queue
whose rows grow bodies stops being scannable; a blocker stated only in prose
gets walked past.

### The open-queue discipline (normative)

**A · What the file is**

1. `work/OPEN-WORK.md` is the single live queue. Ordering lives in it.
2. No second document names what to do next; a second one is the stale one.
3. Its length is the signal of how much is pending. It narrates no history.
4. It is an index: one or two lines per item; detail in `work/open/W-nn-slug.md`.

**B · An item's lifecycle**

5. Maintained **in the same change as the work**, never afterwards.
6. An item gets its file and id before it gets a row; the row gets its ball the
   day it is filed.
7. `W-nn` ids are never reused — including an id withdrawn before its file
   existed (the id is still spent; the rows are simply removed).
8. Completed items are **removed, never ticked**: the row is deleted and the
   detail file moves to `archive/open/`.
9. Closing is legal only once the outcome is in `work/IMPLEMENTATION.md`.
10. A resolved thing leaves the queue entirely — no tombstones, no DONE rows.
11. Before deleting a row, check what it was the only home of; move that
    statement to a record first.
12. On every execution — success, failure, blocked, interrupted, abandoned —
    the affected rows are updated before the session ends. A failed run records
    the failure with a one-line why. **Never mark an item done with failing
    checks.**

**C · The shape of a row**

13. One or two lines per item, always.
14. A row is: ball · optional 🧨 · optional 🔺 · `**W-nn**` · `` `lane` `` ·
    `filed by <name>` · what is open · `[detail](open/W-nn-slug.md)`.
14a. **The row's `filed by` is the item file's `filed_by`, word for word** —
    the person, never a model (SR-WORK-LIFECYCLE decision 4e).
15. At most 280 characters.
16. No body — no nested bullet, no table, no indented paragraph.
17. Every row links its own detail file, and the id in the row matches it.
18. A *Blocked on Siddharth or Arpit* row is short too.
19. Everything else — status, evidence, records, rulings, hazards, history —
    goes in the item's file.

**D · The balls**

20. A ball on every row, always, and exactly one.
21. 🔴 blocked on Siddharth's or Arpit's decision — directly, or through any chain of items
    ending at one.
22. 🟣 gated on a named date — the row that owns the gate names `YYYY-MM-DD`;
    a row behind it names the item it waits on.
23. 🟡 waiting on another item whose chain ends at neither Siddharth nor Arpit nor a date —
    the row says `waiting on W-mm`, the bare id right after the verb.
23a. **A 🟡 row names a queue item; if none exists, the same edit files one.**
    *"Waiting on a run"*, *"waiting on an endpoint"* — each is an unfiled item
    wearing a blocker's clothes. The filed item states what the missing thing
    is, what producing it takes, and who or what can produce it. **A blocker
    that cannot be turned into an item is a reason to close**, or to put the
    fork to Siddharth or Arpit — never a reason to stay 🟡.
24. 🟢 no blockers, good to go.
25. Red wins, then purple.
26. A date-gated item is not in the inbox.
27. **The chain is read from the row's own words, by a fixed verb list:**
    `blocked on` · `after` · `waiting on` · `waits on`, followed by the id.
28. When a state changes, re-ball that row and every row waiting on it.
29. 🧨 broken, or getting worse every day it waits. Any session sets or clears
    it, on any ball.
30. 🔺 do first — set and removed only by Siddharth or Arpit. An agent never adds one.
31. Mark order: the ball, then 🧨, then 🔺, then the id.
32. **An agent picks from 🟢 only:** 🟢🧨🔺 → 🟢🔺 → 🟢🧨 → 🟢. 🔴, 🟣 and 🟡
    wait. A Claude Code session never picks from the `research` section.
33. A session names every 🔴 decision in its first output, 🔺 first.
34. A 🔺 item waiting on an item without 🔺 is flagged to Siddharth or Arpit, never fixed by
    giving the blocker a 🔺.

**E · Ordering**

35. Three lanes, ordered independently: `human` · `agent` · `cowork`.
36. Priority is damage that accrues with elapsed time, above damage that is
    merely present.
37. Grouped by what closing it takes — `build` (code) · `testing` (a run or a
    harness) · `record update` (a ruling or a record; no code) · `research`
    (a proposal or compare doc reached by reading; no code; closes on Siddharth or Arpit
    picking a shape).
37a. **The `research` section runs in a chat/Cowork session, never in Claude
    Code.** Its rows' lane is `cowork`; its files say `**Model:** Cowork`.
38. Each item's file names the record its change will update, or says
    **"no SR affected"** out loud.

**F · The Blocked-on-Siddharth or Arpit inbox**

39. The header carries the inbox; each item's file carries its `filed` date.
40. `age` is arithmetic — today minus `filed`, recomputed on every read, never
    copied.
41. Any inbox row older than 5 days is named, with its age, in the session's
    first output.
42. Every inbox row is followed by a `↳ **blocks:**` sub-row naming every item
    the decision holds up, or `nothing else in the queue`.
43. An item waiting on a decision joins that sub-row in the same edit.
44. An inbox row is always 🔴.
45. A row points only at things that exist.
45a. **The inbox section carries its table and nothing else.** When rulings are
    owed, the table has rows and the section closes. When none is owed, the
    table stays (header + separator only) and the line directly beneath it
    begins `*Empty since YYYY-MM-DD` and names the next gate. **Nothing else
    follows the table** — no recap, no summary. (Enforced in-session by
    `.claude/hooks/guard-open-work-inbox.sh`.)

**G · Standing, and forbidden**

46. The markers are assertions, not evidence. Reconcile against
    `work/IMPLEMENTATION.md` and the repo before treating anything as pending
    or done.
47. **No git housekeeping, ever.** Nothing in the queue says what is or is not
    committed, staged or pushed. If repo state blocks work, name what the work
    needs.
48. A WORKLOG entry per substantive exchange — a chat-only session counts.
49. The queue and the item file on any status change; INTERVIEW kept current
    *during* the session.
50. Reconcile before you report.
51. Records are cited by name, never by number.
52. No behaviour change lands without its record updated in the same change.

**H · Closing an item — archive, never delete**

53. An item's detail file is **never deleted**. Closing moves
    `work/open/W-nn-slug.md` to `archive/open/`, byte for byte, in the same
    change that deletes its row.
54. Every closure archives, whatever the outcome — shipped, superseded,
    renumbered, merged, withdrawn, won't-do. A closure with no code is still a
    closure, and its file is the one worth most.
55. The mover is the noticer: an item some other change already closed is
    archived by the session that notices it.
56. Archiving is not done until `archive/README.md` §`open/` names a
    successor — the file, the close date, and where the live answer lives now.
57. `archive/open/` is history, not evidence.

**I · Who an inbox row waits on**

58. The inbox table is `| what they decide | who | filed | age |`. `who` is
    `Siddharth`, `Arpit`, or `either` — `either` unless the blocker names one
    of them. Who may rule, and the default, is
    [SR-WORK-BLOCKERS](0056_WORK-blockers.md) decision 11.

**The legend** — the one rule text the queue carries, exactly these two lines
under its header:

```text
**A ball on every row, always one:** 🔴 blocked on Siddharth or Arpit, directly or through another item · 🟣 gated on a named date, directly or through another item · 🟡 waiting on another item · 🟢 no blockers.
**Optional, after the ball:** 🧨 broken or getting worse · 🔺 do first (Siddharth or Arpit only). Full legend: [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rules 20–34.
```

### Consequences

- **Enforced today:** rule 45a, by `.claude/hooks/guard-open-work-inbox.sh`
  running `scripts/check-open-work-inbox.py`; rule 33 is prompted by
  `.claude/hooks/inject-inbox.sh`; rule 14a, by `scripts/check-work-items.sh`
  (SR-WORK-LIFECYCLE's check, which this record describes).
- **Judgment today:** every other rule. The row rules (13–19, 42, 45) are
  backlog row B-001; an id resolving nowhere is B-004.

### Alternatives considered

- A ticked checklist — rejected: ticked rows accumulate and the length stops
  meaning anything.
- Priority by a single global order — rejected: lanes need different hands and
  cannot be ranked against each other.

### Reference (required)

- [`work/OPEN-WORK.md`](../work/OPEN-WORK.md) — the queue this record governs.
- [`scripts/check-open-work-inbox.py`](../scripts/check-open-work-inbox.py) — rule 45a.

### Veto condition

**Reopen this decision if:** a second live document names what to do next, or
`work/OPEN-WORK.md` carries a row without a ball.

**How to check it:** `grep -nE '^- ' work/OPEN-WORK.md | grep -vE '^[0-9]+:- (🔴|🟣|🟡|🟢)'`

---

## References

**Records** — [SR-LAW-0](0002_LAW-0-authority.md) · [SR-WORK-BACKLOG](0052_WORK-backlog.md) · [SR-WORK-ARCHIVE](0057_WORK-archive.md)

**Code**

- [`scripts/check-open-work-inbox.py`](../scripts/check-open-work-inbox.py)
- [`.claude/hooks/guard-open-work-inbox.sh`](../.claude/hooks/guard-open-work-inbox.sh)

**Project docs**

- [`work/OPEN-WORK.md`](../work/OPEN-WORK.md) · [`work/open/README.md`](../work/open/README.md)
