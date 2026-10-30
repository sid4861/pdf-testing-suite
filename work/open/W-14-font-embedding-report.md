---
type: Handoff
name: W-14
description: "Arpit, 2026-10-18: every surface says which fonts are not embedded and what was drawn instead; Compare reports when embedding differs between golden and candidate."
item: W-14
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-14 — Report font embedding — and whether it differs between the two PDFs

## At a glance

| | |
|---|---|
| **What** | Every surface says which fonts are not embedded and what was drawn instead; Compare reports when embedding differs between golden and candidate |
| **Why** | Arpit: a substituted font must at least be reported, so a reader knows whether there is a difference |
| **Done when** | Inspect labels a non-embedded font and its substitute; Compare and the CLI list an embedding difference as a finding |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-13 |
| **Who** | `agent` · Opus |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · facts"] --> S2["2 · inspect"] --> S3["3 · compare"] --> S4["4 · cli"] --> S5["5 · fixture"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 facts --> 2 inspect --> 3 compare --> 4 cli --> 5 fixture --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Opus: it adds a new finding type and decides its verdict effect.

## How it can be built — research, 2026-10-18

- **pdf.js already knows:** after a page renders, `page.commonObjs.get(fontName)` exposes `missingFile` (not embedded), `fallbackName` and `systemFontInfo` (what was drawn instead) and `isType3Font` — exported by default in 4.10.38.
- **The file says it too:** a font with no `FontFile` / `FontFile2` / `FontFile3` in its `FontDescriptor` is not embedded. Read it with pdf-lib in a new `src/services/pdfFacts.ts`, walking page and Form XObject resources — the facts reader W-15, W-25 and W-26 reuse.
- **Compare:** a document-level **font finding** — "Helvetica: embedded in golden, not in candidate", or a font present on one side only.
- **Verdict:** reported, not failing, by default; whether it fails is the open question below.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · facts | `src/services/pdfFacts.ts`: per page, every font with name, subtype, embedded yes/no — deterministic, pdf-lib only | ⏳ |
| 2 · inspect | selected text shows "Helvetica — not embedded, drawn with <substitute>"; a document font list | ⏳ |
| 3 · compare | font findings when embedding or the font set differs; shown in Side by side and the report | ⏳ |
| 4 · cli | the same findings in the CLI's JSON and HTML report | ⏳ |
| 5 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 6 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

Ask the spec machine to show the same "not embedded" note next to font assertions (SR-SPEC-CHECK decision 7). The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-13** — the shared PDF opener (`openPdf`) this builds on.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-14 in its *closed by* column.

## Hazards

- **In the inbox (2026-10-18):** does an embedding difference fail the pair? Ruled with the other new finding types in one row of `OPEN-WORK.md`. Build with the default — reported, not failing — the ruling flips one flag in `pageVerdict`.
- **pdf-lib cannot read encrypted files** — report "font facts unavailable (encrypted)" until W-16.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` `resolveStyle` · `src/services/pdfElements.ts` `resolveFont` · `src/services/changes.ts`
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
