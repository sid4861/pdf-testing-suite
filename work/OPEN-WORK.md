---
type: Queue
description: "The single live work queue, three lanes, plus the Blocked-on-Siddharth or Arpit inbox. The list only — its rules live in the record below."
governed_by: SR-WORK-OPEN-QUEUE
governed_by_path: records/0051_WORK-open-queue.md
---

# OPEN-WORK — what is still open

**This file is the LIST, plus the legend below.** Everything else — what the
queue is, an item's lifecycle, the shape of a row, ball precedence, ordering,
how the inbox works, and what every session owes — is stated once in
**[SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md)** and is not repeated
here. Read that record before changing anything below it.

**A ball on every row, always one:** 🔴 blocked on Siddharth or Arpit, directly or through another item · 🟣 gated on a named date, directly or through another item · 🟡 waiting on another item · 🟢 no blockers.
**Optional, after the ball:** 🧨 broken or getting worse · 🔺 do first (Siddharth or Arpit only). Full legend: [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rules 20–34.

---

## Blocked on Siddharth or Arpit

| what they decide | who | filed | age |
|---|---|---|---|
| Python in dev-only scripts (`tools/samples/*/generate.py`, `cli/verify/make-cases.py`): port to TypeScript or keep as dev-only — [SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md) decision 4 | either | 2026-10-16 | 0 days |
| ↳ **blocks:** nothing else in the queue | | | |

---

## Open items

### build

- 🟢 **W-05** · `agent` — one constants file, `src/services/specConstants.ts`; move today's scattered tunables into it, values unchanged. **Sonnet.** [detail](open/W-05-constants-file.md)
- 🟡 **W-02** · `agent` — spec intake: upload `.xlsx` or JSON, validate it, compile to spec JSON with every value's cell. Waiting on W-05. **Opus.** [detail](open/W-02-excel-spec-comparison.md)
- 🟡 **W-04** · `agent` — spec checker per SR-SPEC-CHECK: fix today's false failures, then pages, fonts, colour, coverage, `pdfsuite spec`. Waiting on W-05. **Opus.** [detail](open/W-04-spec-check-v2.md)

### testing

### record update

- 🟢 **W-01** · `agent` — claim every product component with a record; W-01 owns them all until then. **Opus.** [detail](open/W-01-claim-components.md)

### research

---
