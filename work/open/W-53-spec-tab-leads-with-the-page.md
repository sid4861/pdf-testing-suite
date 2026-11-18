---
type: Handoff
name: W-53
description: "Siddharth, 2026-11-18: the Specification tab is laid out like Compare — the PDF in the middle with the differences drawn on it, the workbook one click away, and one header row instead of two."
item: W-53
filed: 2026-11-18
filed_by: Siddharth
updated: 2026-11-18
updated_by: Siddharth
ball: agent
---

# W-53 — the Specification tab leads with the page

## At a glance

| | |
|---|---|
| **What** | Lay the Specification tab out like Compare: the rendered PDF centre stage on a grey stage with zoom, the expected and actual boxes drawn on it, the per-element results in a right rail — and the workbook behind a **Page · Workbook** switch rather than above everything. Everything that was on the second row moves onto the app header beside Export |
| **Why** | **Siddharth, 2026-11-18:** *"change the ui design of the spec driven, make it similar to the compare tab, instead of excel pdf should be shown in middle with differences highlighted on the pdf"* — then *"we do not need 2 rows, move everything on row 2 in row 1 beside the export button"*. The thing being judged is the PDF; the tab was opening on the workbook and giving the page a 460px column |
| **Done when** | The tab opens on the page, drawn large with its overlays; the workbook is one click away and still carries every refusal on its own cell; no refusal is hidden by the switch; one header row |
| **Status** | 🟢 done · 12 of 12 DoD done (2026-11-18) |
| **Waits on** | nothing |
| **Who** | `agent` · Opus |
| **Record** | [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) — the sheet row's ruling · [W-46](W-46-sheet-viewer.md) built the sheet this moves |

## The ruling it reverses

**Arpit, 2026-10-18:** *"not a list — a view that looks and feels like the sheet"*, recorded
against the sheet row in [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) and the
whole basis of [W-46](W-46-sheet-viewer.md).

**Siddharth, 2026-11-18** rules the other way on *which view the tab opens on*. Either
decider rules alone, as on [W-06](W-06-rename-workspace-tabs.md).

The sheet is **not** removed, and that is the part worth holding on to: it is still the only
place a refusal sits on the cell it came from, which is the thing a reviewer has to go and
change. What changed is which of the two the tab leads with. Arpit's ruling survives inside
the **Workbook** view; if he wants the tab to open there, that is one line.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · the page leads | `.spec-grid` reversed — the page column first and wide, results in a 300–400px rail; the page on a `.stage` with `.stage-content`, as Compare does | ✅ |
| 2 · differences on the page | expected (dashed indigo) and actual (green pass / red fail) boxes drawn over the render, hover from either side; zoom −/+/Fit, the overlays following because they are percentages of the wrapper | ✅ |
| 3 · the workbook behind a switch | a **Page · Workbook** group; `SheetView` and the plain-words report render only under *Workbook*, the stage and the page furniture only under *Page* — each view is whole, neither is a strip on top of the other | ✅ |
| 4 · no refusal is hidden | the Workbook tab carries a count badge, and the page view's summary carries a **`n refused`** chip that switches to it. A refusal is not a failing check — it is a row that was never checked — so hiding the workbook must not hide it | ✅ |
| 5 · one header row | the sub-toolbar is gone: slots, the view switch and the verdict chip sit in `.app-header` beside Export, the same way Compare's slots already did. `SpecUpload` moves to its own file and `view` moves into the store, because the header and the body are now two components sharing it | ✅ |
| 6 · paging in the header | **All pages · One page** removed; `‹ Page n of m ›` in the header beside Export, as Compare has, clamped at both ends; the elements-pass pill removed — the page's own summary and the strip's colour already say how the page did | ✅ |
| 7 · the results are a rail | it opens and closes — closed, the page takes the whole width (912 → 1328px at 1440) — and it scrolls **inside itself**: `max-height` matching the stage plus `overscroll-behavior: contain`, so reading the results no longer drags the page it describes out of view. **Fixed 2026-11-18 after review:** the rail is a flex column, and a flex item shrinks by default — with a capped height every card was squeezed to fit instead of the rail scrolling, and because `.spec-el` clips, a card showed its title and the *header* of its checks with the checks gone. `.spec-results > * { flex: 0 0 auto }`. Verified across all four pages: 2 · 7 · 5 · 5 cards, **0 clipped**, 95 check rows | ✅ |
| 8 · hover, both ways | hovering a result rings its boxes and **fades every other overlay to 0.18**, so one thing has colour; and a card on the page gives the element, its verdict and its failing checks as **spec → pdf** with the delta — *Font size 28pt → 24pt −4.0pt* — the same before/after Compare shows. It flips above the box in the lower quarter of the page so it is never off the stage. **Replaced after review:** the bespoke pill was a lookalike; the toggle is now Compare's own `.view-changes` + `.drawer-ico`, class for class — solid indigo closed, soft indigo open, reading *View results · n* | ✅ |
| 9 · four named columns | **Spec · PDF · Difference · Cell**, with the row's own ✓/✗ on its label and the sixth tick column gone; the cell is a button that opens the workbook at that cell. `table-layout: fixed` with every column declared — left to itself the table sized to its content, ran past the card, and the clip ate the **Cell** column, the one thing in the row you act on, and “DIFFERENCE” wrapped to two lines. **And it goes to the right place:** the click landed the workbook on its *first* tab, the Pages List, because the select arrives before the sheet has parsed — switching view mounts `SheetView` in the same render, so `loaded` was still false and `el.select` was dropped. The request is held and replayed on `sheetpane-load`; `3!E4` now opens sheet **3** at **E4** | ✅ |
| 10 · the rail slides, and hover works both ways | the rail stays mounted and animates `flex-basis` 400 → 0 while it fades and slides right, the page growing into the space — measured **400 → 360 → 194 → 74 → 22 → 4px over ~225ms**, and back. Hovering an element **on the PDF** now lights its card in the rail with an indigo ring and scrolls it into view, the mirror of hovering the card | ✅ | | 9 · four named columns | **Spec · PDF · Difference · Cell**, with the row's own ✓/✗ on its label and the sixth tick column gone; the cell is a button that opens the workbook at that cell — which now also switches to the Workbook view, because selecting a cell on a sheet nobody can see is a click that does nothing | ✅ |
| 11 · less of it, and all of the height | the per-page summary card, the report block under the sheet and the Workbook tab's red count all removed as repetition (Siddharth: *this info is not useful*); the problems panel became a closable rail like the page's, sharing one `railOpen`; the workbook fills the window instead of sitting in a 420px box; and the panel was trimmed through sheetpane's own API — `readonly`, `results="off"`, and `errorTypes` so a row reads *“Refused — this row yields no check”* instead of the raw id `spec-refused` | ✅ |
| 12 · the shell stops jumping | the app header is one height in every workspace — it was **65 · 77 · 65**, because an upload slot is 12px taller than a tab button, so every switch shunted the page down and back; `min-height: 77px` on `.app-header`, the tallest state setting it for all. The body is keyed on the workspace and cross-fades up 6px (`wsIn`), the header's own contents fade (`headerIn`), and the tab pill transitions instead of snapping — all behind `prefers-reduced-motion` | ✅ |

## What this cost elsewhere

- **Nothing on screen now says a row was refused** unless you open the Workbook view. The
  summary card's `n refused` chip and the tab's count badge were both removed on 2026-11-18.
  W-48's contract is still kept by the two downloads and by the panel itself; DoD 4's
  promise — *the switch must never swallow a refusal* — is the thing that gave way, and it
  gave way on a ruling, not by accident.
- **The plain-words list is off the screen.** `SpecValidation` is still built and still
  exported, and the sentences are still in *Validation report (HTML)* and *(JSON)*, but
  SR-SPEC-INTAKE decision 14 asks for them to be *shown*. Putting it behind a disclosure is
  a render, not a rebuild.
- **Four filter rows in the problems panel cannot be removed from here.** Severity
  (`All 19 · ✕19 · !0 · i0`) and author (`Anyone · People · Workbook rules`) live in
  `<sheetpane-errors>`'s shadow DOM, and the element exposes only `root` and `detail` as CSS
  parts. Removing them means an option upstream in `@sheetpane/grid` (Arpit's) or replacing
  the panel with our own list off `sheetMarks` — **not** a fork.

- **One page mode is gone from the UI** (Siddharth, 2026-11-18: *"no need to have all pages
  one page"*). It was the only way **in the app** to point one spec page at a different PDF
  page. The normal path is untouched — the Pages List binds each page by its own identifying
  text — and the CLI keeps `--pages`, so a one-off override is now a command-line job. The
  store keeps `mode`, `targetPdfPage` and `targetSpecPage`, so putting the controls back is
  rendering, not rebuilding.

- **`view` is store state, not local.** Not tidiness — the switch is rendered by the header
  and read by the body, and two components cannot share a `useState`.
- **`SpecUpload` has its own file.** Two importers; nothing about it changed.
- **`SpecHeaderBar` is a third export** from `@pdfsuite/spec`'s app barrel. The contract was
  two components; it is three. Anyone embedding the tab renders it in their own header, or
  does not — it returns `null` until something is loaded.

## Hazards

- **`key={ws}` remounts the workspace, so nothing durable may live in a view's own state.**
  It does not today — the report, the files, the view and the rail are all in the store — and
  a round trip through Compare and back was checked to keep the results and not re-run the
  check. Put a result in a `useState` inside a view and a tab switch will throw it away.
- **This is `@pdfsuite/ui`'s shell, not the Specification tab.** The header is W-06's; the
  fix landed here because the jump was found here.

- **`grid-template-columns` does not animate here.** It is listed as animatable, and sampled
  frame by frame it held the old value for ~100ms and then snapped. So did `flex` shorthand
  with a `min()` basis. The rail slides on three flex **longhands** with a plain-length
  `flex-basis`; keep it that way.
- **A `select` before `sheetpane-load` is silently dropped.** Anything that opens the
  workbook at a cell has to survive the mount, which is why the request is held in a ref and
  replayed on load — one frame later, so the sheet's own first paint does not take the view
  back to its tab.
- **`theme="auto"` is wrong while the app has no dark mode.** The sheet followed the OS and
  rendered dark inside a light page. Pinned to `light` until the app itself follows.
- **The overlay boxes stay `pointer-events: none`.** A 1.5px border is not a hover target and
  the dashed expected box usually sits under the actual one, so the page-side hover is a
  separate hit area over the element's own footprint.

- **`goToCell` must switch the view, not just select.** W-53 put the sheet behind a tab; a
  `setSelectedCell` on its own silently does nothing. Every path into the workbook — the
  element's cell button, a check's cell, the refused chip — goes through it.

- **The switch must never swallow a refusal.** DoD 4 exists for this: a reviewer who only
  ever looks at the page must still be told that ten rows were never checked.
- **`.tab-count` and `.sp-refused-chip` are new global class names**, so they land in
  [B-021](../BACKLOG.md)'s lap along with the rest of the unprefixed stylesheet.
- The page stage is capped at `min(78vh, 900px)`; a taller page scrolls inside the stage
  rather than the window, which is what Compare does and what makes the rail stay put.

## Reference

- [W-46](W-46-sheet-viewer.md) — the sheet this moves behind a switch
- [W-51](W-51-screens-to-proof.md) — the Proof rebuild, which will restyle both views
- [SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md) · [SR-SPEC-CHECK](../../records/0102_SPEC-check.md)
