# PDF Comparison Suite

A React app for comparing two PDFs — by **content** (text on every page), **layout** (pixel-level
visual diff + precise text-position offsets), and a roll-up **pass/fail report** — then **exporting**
the results.

Built from the spec in [`comparison.md`](comparison.md).

## Executive overview

A polished, non-technical overview page for leadership lives at [public/overview.html](public/overview.html).
Run the app and open [`/overview.html`](http://localhost:5173/overview.html) (or open the file directly),
and its "Launch PDF Compare" button links straight into the tool.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

Click **Load example invoices** on the empty state to try it with the bundled sample PDFs, or drop
your own into Side A (original) and Side B (recreated).

### The bundled example

The sample is a deliberately complex 6-page invoice (Side A) vs a 5-page recreation (Side B), built to
exercise every feature:

| Page | Exercises |
|------|-----------|
| 1 | Summary with a ruled/shaded table; text changes **and** pixel-only changes (recoloured header bar, a shifted rule line) that have no text delta |
| 2 | Long itemized table (~100 text runs) with cell edits, a whole column nudged right, and a removed row that cascades every row below → many position shifts |
| 3 | **Identical** — jump-to-change skips it; reports as PASS |
| 4 | A vector-only chart with **no text layer**; bars differ (pixel-only change) |
| 5 | **Landscape** page compared against a portrait one → letterboxing note + large offsets |
| 6 | Exists only in the original → page-count mismatch / missing-page handling |

Tip: page 4's 1.5% pixel change passes the default 2% threshold — lower **pixels ≤** to `1` in the
Report tab to see it flip to FAIL.

## Features

- **Content tab** — side-by-side rendered pages with every change highlighted **in place**
  (red = removed, green = added, amber = moved), a linked "Changes on this page" list with each
  change's region + pixel position, and a word-level diff reconstructed in reading order. Hovering a
  highlight, list row, or diff word links them together.
- **Jump to next / previous change** — in the page navigator, skip straight to the next page that
  actually differs (handy for long documents with many identical pages).
- **Layout tab** — three sub-views:
  - *Side by side* — the two rendered pages.
  - *Overlay* — B stacked over A with an opacity slider, plus a drag-to-measure tool.
  - *Pixel diff* — a pixelmatch heatmap with adjustable sensitivity + anti-aliasing toggle.
  - A **geometry table** listing every matched text run's Δx / Δy / offset, flagging large offsets.
- **Report tab** — compares all pages, applies user-set PASS thresholds
  (content ≥ %, pixels ≤ %, offset ≤ px), and shows an overall PASS/FAIL verdict. Rows drill into
  the Layout view.

## Export

From the Report tab, the **Export** menu produces:

| Format | Contents |
|--------|----------|
| **HTML report** | Standalone, printable page with the metrics table, the overall verdict, and for every page an annotated A/B pair with the change highlights + a per-page change list. Open it and *Print → Save as PDF* for a shareable report. |
| **JSON** | Full machine-readable metrics, thresholds, and per-page pass/fail. |
| **CSV** | Per-page metrics table for spreadsheets. |

## Architecture

```
src/
  types/compare.ts              Shared interfaces (no React)
  services/pdfCompare.ts        Engine: loadPdf, comparePage, diff/match/pixel helpers
  services/exportReport.ts      JSON / CSV / HTML report exporters
  store/compareStore.ts         Zustand store (sides, cache, controls, report)
  components/compare/           UI: upload slots, navigator, content/layout/report views, measure overlay
public/samples/                 Bundled example invoice PDFs
```

The engine is framework-agnostic and touches the DOM only for `<canvas>` work. All rendering,
text extraction, and geometry live in a single consistent pixel coordinate space (Side A defines
the target box; Side B is letterboxed to fit), so text-position deltas between the two are directly
comparable.

Built with **pdfjs-dist** (parse/render/extract), **pixelmatch** (pixel diff), and **diff** (word diff).
