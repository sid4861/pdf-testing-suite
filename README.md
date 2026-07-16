# PDF Comparison Suite

A React app with two workspaces:

- **Compare PDFs** — compare a recreated PDF against a reference by **content** (text on every page),
  **layout** (pixel-level visual diff + precise text-position offsets), and a roll-up **pass/fail
  report** — then **export** the results.
- **Test new pages** — when there's no reference PDF, only a **JSON spec**, validate a generated PDF
  against the spec (expected static text, image sizes/positions, table position/width, paragraph line
  spacing) with an annotated pass/fail report.

Built from the spec in [`comparison.md`](comparison.md).

## User manual &amp; demo

- **User manual** — a full feature reference at [public/manual.html](public/manual.html)
  (open [`/manual.html`](http://localhost:5173/manual.html) or the file directly).
- **Demo &amp; walkthrough** — a self-contained, offline explainer at [public/demo.html](public/demo.html)
  ([`/demo.html`](http://localhost:5173/demo.html)) that lists every feature and walks the full flow of
  both workspaces with faithful UI panels and captions — useful when you can't run the app.

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

## Test new pages (validate against a JSON spec)

Switch to the **Test new pages** workspace when you don't have a reference PDF — only a design spec.
Upload the generated **PDF** and a **JSON spec**, and the checker validates the PDF against it,
element by element, with an annotated pass/fail report you can export.

The spec describes, per page, the elements a page should contain, positioned in inches:

| Element | Checks |
|---------|--------|
| `text` | present, left/top position, optional font size, exact/contains match |
| `image` | present, left/top position, width, height |
| `table` | present, left/top position, width, optional row/column count |
| `paragraph` | present, left/top position, **line spacing** |

Each element gets expected-vs-actual values with deltas and a per-check ✓/✗; the rendered page shows
the **expected** box (dashed) and the **actual** box (green pass / red fail) so deviations are visible
at a glance. Tolerances default to 0.06″ position / 0.06″ size / 0.03″ spacing and can be overridden
globally or per element.

Click **Load example spec + PDF** to try it: a 2-page statement (`spec-sample.pdf`) checked against
[`spec-sample.json`](public/samples/spec-sample.json), with intentional deviations (a too-tall logo,
a too-narrow table, wrong line spacing, and a missing watermark) so every check type is demonstrated.
Export the result as an **HTML report** (annotated pages + checks) or **JSON**.

## Export

From the Report tab, the **Export** menu produces:

| Format | Contents |
|--------|----------|
| **HTML report** | Standalone, printable page with the metrics table, the overall verdict, and for every page an annotated A/B pair with the change highlights, the pixel-diff heatmap with always-on *before → after* labels on each replaced text, and a per-page change list. Open it and *Print → Save as PDF* for a shareable report. |
| **JSON** | Full machine-readable metrics, thresholds, and per-page pass/fail. |
| **CSV** | Per-page metrics table for spreadsheets. |

## Architecture

```
src/
  types/compare.ts              Shared interfaces (no React)
  types/spec.ts                 Spec + result interfaces for "Test new pages"
  services/pdfCompare.ts        Compare engine: loadPdf, comparePage, diff/match/pixel helpers
  services/exportReport.ts      Compare JSON / CSV / HTML exporters
  services/specCheck.ts         Spec engine: extract text/images (points), evaluate elements
  services/specExport.ts        Spec JSON / HTML exporters
  store/compareStore.ts         Zustand store (compare: sides, cache, controls, report)
  store/specStore.ts            Zustand store (spec: pdf + spec + results)
  components/compare/           Compare UI: slots, navigator, content/layout/report, measure overlay
  components/spec/              Spec UI: SpecTestView (upload, overlay viz, results, export)
public/samples/                 Bundled examples: invoice PDFs + spec-sample.pdf/.json
```

The engine is framework-agnostic and touches the DOM only for `<canvas>` work. All rendering,
text extraction, and geometry live in a single consistent pixel coordinate space (Side A defines
the target box; Side B is letterboxed to fit), so text-position deltas between the two are directly
comparable.

Built with **pdfjs-dist** (parse/render/extract), **pixelmatch** (pixel diff), and **diff** (word diff).
