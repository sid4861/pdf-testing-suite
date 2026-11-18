---
type: Handoff
name: W-54
description: "Siddharth, 2026-11-18: a fourth tab, Create spec — lay a page out on a canvas and a Template v2 workbook is written underneath, so a spec is authored visually instead of typed into Excel."
item: W-54
filed: 2026-11-18
filed_by: Siddharth
updated: 2026-11-18
updated_by: Siddharth
ball: agent
---

# W-54 — Create spec: author the workbook by drawing the page

## At a glance

| | |
|---|---|
| **What** | A fourth workspace after **Inspect**, called **Create spec**. A page-sized canvas with drag-and-drop elements — text with its full typography, tables with rows, columns and widths set by number or by dragging an edge, images from a file or base64, a layer stack and page background — and **a Template v2 workbook written underneath as you draw**. A **Workbook** view in the same tab shows it in sheetpane |
| **Why** | **Siddharth, 2026-11-18:** *"this feature is useful in creating the spec in a visual way rather than creating it in excel."* Authoring the workbook by hand is the hardest part of the product. A canvas also **cannot produce most of the errors the format exists to catch**: a dragged element has an exact position in a known unit, a font size comes from a number field, so `unit-missing`, `unit-in-value`, `approximate-value` and `number-expected` are structurally impossible |
| **Done when** | A page drawn on the canvas produces a workbook that `pdfsuite spec --validate-only` accepts with **zero errors**, and that workbook checks a matching PDF |
| **Status** | 🟡 in progress · 7 of 9 DoD done (2026-11-18) · three rulings answered **provisionally**, below |
| **Waits on** | nothing to build; three rulings to confirm or overturn |
| **Who** | `agent` · Opus |
| **Record** | [SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md) (the format it writes) · [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) (one new UI-only row) · a new SR for the canvas itself |

## Ruled, 2026-11-18

**Siddharth**, in answer to the six questions put to him:

1. **The canvas is the source of truth.** Not a two-way sync.
2. **Stacking is canvas-only.** *"Stacking is more on the canvas to make it look a certain
   way; overlapping info is not needed in the sheet."* No z-order parameter, so **no record
   change**. What *is* recorded is each element on its own terms — his example: a sidebar
   with a background image records the sidebar's width, height and position; a heading on
   that sidebar records its own text, properties and position, as a separate part.
3. **The CLI does not get this feature.**
4. **Image content is not compared**, so an image element records position, size and file
   name only.
5. **Measurements in inches, font sizes in points.**

### What ruling 1 means in practice

The **Workbook** view inside this tab is **read-only**. It has to be: two editable surfaces
over one model means whichever is the source silently overwrites the other, and the person
loses work they watched themselves do. To hand-edit a generated workbook, download it and
open it in the **Specification** tab, which is already built for exactly that — at which
point it is a workbook like any other and the canvas is no longer its author.

A consequence worth stating plainly: **a workbook cannot be read back into the canvas.** The
mockup needs its own saved format, because the workbook does not carry stacking, the image
bytes, or anything else the canvas knows and the spec deliberately does not.

### What ruling 5 means in practice

The canvas is **never** in screen pixels. It works in inches at the page size from
`Settings`, and font sizes in `pt`. `Settings · Pixels per inch` stays blank and no row ever
carries `px`, so `px-without-density` cannot arise.

## Answered provisionally, 2026-11-18

Siddharth said **“start development”** with these three outstanding. Each is built the way
the item recommended, and each is cheap to overturn — they are noted here so the decision is
visible rather than buried in code.

| # | Question | Built as | Cost to change |
|---|---|---|---|
| 1 | how a page declares its `Identifying text` | a checkbox on a text element, *“this text identifies the page”*; with none marked the cell is left **blank**, never guessed | small — one field |
| 2 | are the pickers restricted to `Lists`? | **yes**: font and colour are dropdowns over the document's own vocabulary, which is what makes `colour-name-mismatch` unreachable | small — swap a `select` for an input |
| 3 | where the mockup is saved | a sidecar `<name>.pdfsuite-spec.json`, downloadable and re-openable | medium — embedding it in the `.xlsx` instead is a writer change |

## The questions as originally put

| # | Question | Why it matters |
|---|---|---|
| 1 | **How a page declares its `Identifying text`** — most likely by marking one text element as the page's identifier | Pages are bound to the PDF by this text, not by page number. Without it the generated workbook cannot be checked at all |
| 2 | **Do the font and colour pickers offer only what `Lists` declares, or anything?** | Free choice generates `colour-name-mismatch` and fonts the vocabulary does not know. Restricting them is the stricter, better answer, but it means the canvas edits `Lists` too |
| 3 | **Where the mockup is saved** — a `.pdfsuite-spec.json` beside the workbook, or embedded in the workbook as a part Excel ignores | Decides whether a person can reopen their own mockup, and whether sending someone the `.xlsx` sends the mockup with it |

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · the model | `create/model.ts` — the mockup: pages, box/text/image/table elements, their properties, the vocabulary. **Inches and points throughout; the word `px` appears nowhere**, so the canvas cannot emit a row that needs a density | ✅ |
| 2 · the generator | `create/toWorkbook.ts` — mockup → `Pages List` · `Settings` · `Lists` · one sheet per page, with **real merged ranges** on Element/Part/Group. The shared writer in `specDraft.ts` gained `merges` for it | ✅ |
| 3 · the proof | **`verify:create-spec` — 18/18.** A drawn page goes through the real writer and back through the real reader and yields **zero errors**, with a named check for each rule the canvas is supposed to make unreachable | ✅ |
| 4 · the tab | **Create spec** after Inspect: a page-sized canvas in inches, drag to move, corner handles to resize, snapping to a sixteenth (Alt for free), a properties panel per kind, a layer list with raise/lower/delete, page settings, and image load from a file | ✅ |
| 5 · the workbook view | a **Canvas · Workbook** switch in the header; Workbook renders the generated file in sheetpane and says in words that it is **read-only** and why | ✅ |
| 6 · the record | an SR for the canvas and its mapping; the UI-only row in SR-SURFACE-PARITY with its reason | ⏳ |
| 7 · a mockup, not a form | **edit on the page**: double-click text to type it, double-click a table to type its column headers, click an empty image frame to choose a picture, drag a column edge to move width between two columns. Stacking reorders by **swapping**, so the canvas matches the layer list | ✅ |
| 8 · the keys and the history | **Delete**/Backspace removes · **arrows** nudge a sixteenth, Shift a quarter · **Enter**/F2 edits · **Tab** cycles the stack · **Ctrl+D** duplicates · **Ctrl+[ / ]** restack · **Esc** backs out · **Ctrl+Z / Ctrl+Shift+Z** undo and redo, with buttons beside the zoom. A drag is **one** undo step, not forty. Editing focuses the caret and selects what is there | ✅ |
| 9 · the rest | multi-select; marquee select; dragging a row's height; alignment guides | ⏳ |

### Verified end to end in the app, 2026-11-18

Drew a box, a text and a table in **Create spec**, downloaded the workbook, uploaded it in
**Specification**: **zero problems**. Before marking a text element as the page's
identifier it reported exactly **one** — the blank `Identifying text` — and marking it took
that to none. That is the design working: the generator leaves the cell blank rather than
guessing at it, and the reader says so.

## How the canvas maps onto the format

Not a DoD — the shape, so the open questions above are read in context. The fixture's own
`Title block` is exactly this pattern already:

| On the canvas | In the workbook |
|---|---|
| a container (his sidebar) | `Element` = its name, `Part` = `Container`; rows for `Position · Top/Left` and `Size · Width/Height` |
| something on that container | a second `Part` under the same `Element`, with its own rows |
| a text element | `Text · Wording`, `Case`; `Font · Font`, `Font size`, `Bold`, `Italic`, `Underline`; `Colour · Colour` |
| a table | `Table · Columns`, `Rows`, `Row height`, `Column widths`, `Column headers` |
| an image | `Position`, `Size`, and `Image · File name` — **content is not compared** |
| a fill | `Colour · Fill` — carried, not checked (W-04 DoD 3) |
| z-order, the image bytes, canvas guides | nothing. Canvas-only state |

**The canvas should show which properties are checked and which are only recorded**, rather
than implying everything drawn is verified. Fills and image content are carried as rows that
check nothing, and a person drawing a page deserves to know that while they draw.

## Hazards

- **`contentEditable` focuses nothing.** Setting it makes a box typable and leaves the
  caret where it was, so a double-click looked like it did nothing — the outline appeared and
  the keystrokes went to the window. It has to be focused and its contents selected. The same
  trap caught me twice: I verified the first version by **dispatching** events, which puts
  focus nowhere and still passes.
- **`z += 1` is not a reorder.** It was, and it produced ties — two elements with the same
  `z`, decided by DOM order — so *bring forward* appeared to do nothing and a text sat behind
  an image the layer list said it was above. Reordering swaps with the neighbour and
  renumbers `0..n-1`, which keeps `z` a strict order. Anything that writes `z` must keep it
  one.
- **Two editable surfaces over one model is the trap**, and ruling 1 avoids it. Keep the
  Workbook view read-only; the moment it accepts an edit, this item has two sources of truth.
- **Every generated row must be one the reader accepts.** The measure of this feature is not
  that it draws nicely but that `--validate-only` returns **0 errors** on its output. That
  belongs in the DoD as a test over a drawn fixture, not as a manual check.
- **UI-only needs ratifying.** [L3](../../records/0005_LAW-3-one-function-ui-and-cli.md) says
  the UI and the CLI run the same functions and every difference is named. Ruling 3 is the
  ruling; it still needs its row and reason in SR-SURFACE-PARITY — authoring is not checking,
  and a command line is not where anyone lays out a page.
- **Fonts and colours are a vocabulary, not free text.** See open ruling 2.

## Reference

- [`TEMPLATE-V2-STRUCTURE.md`](../samples/excel-spec-template-v2/TEMPLATE-V2-STRUCTURE.md) — the
  format this writes, every column and every refusal rule
- [W-02](W-02-excel-spec-comparison.md) the reader · [W-04](W-04-spec-check-v2.md) the checker ·
  [W-46](W-46-sheet-viewer.md) the sheet view this tab reuses ·
  [W-47](W-47-sheet-editor.md) editing in sheetpane, which this deliberately does **not** use
- [W-50](W-50-proof-design-system.md) — the design system a canvas should be built on
