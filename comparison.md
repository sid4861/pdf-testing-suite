# PDF Comparison Module — Feature Specification

A complete description of the PDF comparison module. Every feature, every behavior, every data
type, every threshold. Use this as a self-contained spec to re-implement the same module in
another application.

---

## 1. Purpose

The comparison module lets a user upload two PDF files and verify they match — both in **content**
(the actual text on every page) and in **layout** (pixel-level visual differences and precise
numeric position offsets for each text run). The primary use case is QA: an author recreates an
existing PDF as a template, generates a PDF from it, then compares the generated output against
the original to confirm they are identical.

**Side A** = the original / reference document.
**Side B** = the recreated / generated document.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────┐
│  UI layer (React components)                        │
│  CompareModal → PdfUploadSlot (×2)                  │
│              → PageNavigator                        │
│              → ContentCompareView                   │
│              → LayoutCompareView                    │
│                   └── MeasureOverlay                │
│              → CompareReport                        │
└────────────────────────┬────────────────────────────┘
                         │ reads / writes
┌────────────────────────▼────────────────────────────┐
│  compareStore  (Zustand)                            │
│  modal state · uploaded docs · navigation           │
│  layout controls · per-page cache · summary         │
└────────────────────────┬────────────────────────────┘
                         │ calls
┌────────────────────────▼────────────────────────────┐
│  pdfCompare engine  (framework-agnostic)            │
│  loadPdf · renderAndExtract · extractItems          │
│  reconstructReadingText · diffText                  │
│  contentMatchRatio · pixelDiff · matchItems         │
│  comparePage                                        │
└─────────────────────────────────────────────────────┘
         │                        │
   pdfjs-dist              pixelmatch + jsdiff
   (render + text)         (pixel diff + word diff)
```

The engine is loaded **lazily** (dynamic import) so its large dependency set (pdfjs-dist ~1.2 MB,
pixelmatch, jsdiff) only enters the bundle when the user actually opens the compare modal.

---

## 3. Dependencies

| Package | Version | Role |
|---------|---------|------|
| `pdfjs-dist` | 4.x | Parse uploaded PDFs, render pages to canvas, extract text content with per-item geometry |
| `pixelmatch` | 5.x | Per-pixel diff of two equal-size `ImageData` buffers; produces a diff heatmap |
| `diff` | 5.x (`diffWords`) | Word-level text diff producing `added`/`removed`/`equal` segments |

**PDF.js worker setup** (Vite): import the worker as a URL asset and assign it once globally:
```ts
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
```
Without this the worker falls back to a same-thread fake-worker, which is much slower.

---

## 4. Data types

All types are shared between the engine, the store, and the UI. They never touch React.

### 4.1 `TextItem`
A single extracted text run with its bounding box in device-space pixels.

```ts
interface TextItem {
  str: string;   // text content of the run (never empty — whitespace-only runs are skipped)
  x:   number;   // left edge in px, top-left origin
  y:   number;   // top edge in px, top-left origin (NOT baseline)
  w:   number;   // width in px
  h:   number;   // height in px (~font size at render scale)
}
```

Coordinates are always in the **target-box pixel space**: the shared canvas that both sides are
rendered into at the same pixel dimensions. This makes A and B coordinates directly comparable.

### 4.2 `DiffSegment`
One chunk from a word-level text diff.

```ts
interface DiffSegment {
  value:    string;
  added?:   boolean;   // only in B (insertion)
  removed?: boolean;   // only in A (deletion)
  // neither added nor removed → unchanged (equal)
}
```

### 4.3 `MatchedPair`
A text run found on both pages, with its position delta (B relative to A).

```ts
interface MatchedPair {
  str: string;       // the matched text (normalised)
  a: TextItem;       // run on side A
  b: TextItem;       // run on side B
  dx: number;        // b.x - a.x  (positive = B is to the right)
  dy: number;        // b.y - a.y  (positive = B is lower)
  dw: number;        // b.w - a.w
  dh: number;        // b.h - a.h
  offset: number;    // √(dx² + dy²) — Euclidean position offset
}
```

### 4.4 `ItemMatch`
Full result of matching two pages' text items.

```ts
interface ItemMatch {
  matched: MatchedPair[];   // runs present in both, with their offsets
  onlyA:   TextItem[];      // runs present in A but not B (removed content)
  onlyB:   TextItem[];      // runs present in B but not A (added content)
}
```

### 4.5 `PixelDiffResult`
Output of a pixelmatch comparison.

```ts
interface PixelDiffResult {
  diffDataUrl: string;   // PNG data URL of the heatmap (red pixels = changed)
  changed:     number;   // count of mismatched pixels
  total:       number;   // total pixels compared (width × height)
  ratio:       number;   // changed / total, 0–1
}
```

### 4.6 `RenderedPageImage`
A page rendered to a canvas, stored as both a data URL (for display) and raw `ImageData` (for
pixel diffing).

```ts
interface RenderedPageImage {
  dataUrl:     string;     // PNG data URL, display use
  imageData:   ImageData;  // raw RGBA bytes, passed to pixelmatch
  width:       number;     // target-box width in px
  height:      number;     // target-box height in px
  letterboxed: boolean;    // true if this side's native aspect differed from A's
}
```

### 4.7 `PageComparison`
The complete cached comparison result for one page. This is what is stored in the page cache.

```ts
interface PageComparison {
  pageIndex: number;               // 0-based

  imageA:  RenderedPageImage | null;   // null if that page doesn't exist on this side
  imageB:  RenderedPageImage | null;

  textA:        string;            // reconstructed reading-order text for A
  textB:        string;
  diff:         DiffSegment[];     // word-level diff between textA and textB
  contentMatch: number;            // 0–1, share of characters unchanged

  match:     ItemMatch;            // geometry matching result
  maxOffset: number;               // largest matched-pair offset in px

  pixel: PixelDiffResult | null;   // null if one side is missing or sizes differ

  notes: string[];                 // non-fatal warnings surfaced in the UI
}
```

### 4.8 `PageSummary` and `CompareSummary`
Roll-up across all pages (used by the Report view).

```ts
interface PageSummary {
  pageIndex:    number;
  contentMatch: number;   // 0–1
  pixelRatio:   number;   // 0–1 (share of changed pixels)
  maxOffset:    number;   // px
  missing:      boolean;  // page absent from one of the two sides
}

interface CompareSummary {
  pages:      PageSummary[];
  pageCountA: number;
  pageCountB: number;
}
```

### 4.9 Enum-like types

```ts
type CompareSide      = 'A' | 'B';
type CompareMode      = 'content' | 'layout' | 'report';
type LayoutViewMode   = 'side-by-side' | 'overlay' | 'diff';
```

---

## 5. Engine functions (`pdfCompare`)

All functions are pure or near-pure; they use the DOM only for `<canvas>` operations (rendering
and pixelmatch). No React, no store access.

### 5.1 `loadPdf(file: File): Promise<PDFDocumentProxy>`

Reads the file as an `ArrayBuffer`, copies it into a `Uint8Array` (the copy is important because
`pdfjs.getDocument` transfers/detaches the original buffer), and calls `pdfjs.getDocument({ data })`.

Returns a `PDFDocumentProxy`. The `.numPages` property gives the page count.

**Error handling**: any parse failure throws; the store catches it and sets the side's `error` state.

### 5.2 `renderAndExtract(page, targetW, targetH)` _(internal)_

Renders one PDF page into a canvas of exactly `targetW × targetH` pixels and extracts its text
items in the same pixel space.

**Algorithm**:
1. Get the page's natural viewport at `scale=1` to find its aspect ratio.
2. Compute a `scale` that fits the page within `(targetW, targetH)` while maintaining aspect:
   `scale = Math.min(targetW / vp1.width, targetH / vp1.height)`.
3. Render at that scale onto a **temporary** canvas sized to the fitted dimensions.
4. Create the **target** canvas (`targetW × targetH`), fill it white, then composite the rendered
   page centered (letterboxed) into it.
5. Call `extractItems` with the same viewport and the centering offsets `(offsetX, offsetY)`.
6. Return `{ image: RenderedPageImage, items: TextItem[] }`.

The letterboxing ensures both pages are always in the same pixel-coordinate frame regardless of
their native sizes.

### 5.3 `extractItems(page, viewport, scale, offsetX, offsetY)` _(internal)_

Extracts text runs from `page.getTextContent()` and converts each item's PDF text-matrix into
device-space pixel coordinates (top-left origin):

- For each `item` with a non-empty `str`:
  - Transform: `m = pdfjs.Util.transform(viewport.transform, item.transform)`
  - `fontHeight = Math.hypot(m[2], m[3])` — device-space glyph height from the matrix
  - `x = m[4] + offsetX`
  - `y = m[5] - fontHeight + offsetY` — m[5] is the baseline; subtract height to get the top edge
  - `w = item.width * scale`
  - `h = fontHeight`

Skips marked-content markers (items without `str`) and whitespace-only runs.

### 5.4 `reconstructReadingText(items: TextItem[]): string` _(exported)_

PDF.js returns text items in glyph/draw order, which is often not reading order. This function
reconstructs human reading order:

1. Sort all items by `y` ascending, then `x` ascending.
2. Compute a **line tolerance**: `max(4, median(item heights) × 0.6)` — items within this vertical
   distance of the current line Y are considered the same line.
3. Group items into lines using the tolerance.
4. Within each line, sort items by `x` ascending.
5. Join items within a line with a space; join lines with `\n`; collapse multiple spaces.

Returns a single string. Returns `''` for an empty items array.

### 5.5 `diffText(textA: string, textB: string): DiffSegment[]` _(exported)_

Calls `diffWords(textA, textB)` from the `diff` package and maps the output to `DiffSegment[]`.
Segments where neither `added` nor `removed` is true represent unchanged (equal) content.

### 5.6 `contentMatchRatio(diff: DiffSegment[]): number` _(exported)_

Computes the share of characters that are unchanged:
`same / total` where `same = Σ len of equal segments`, `total = Σ len of all segments`.
Returns `1` (100% match) if total is 0 (both texts are empty).

### 5.7 `pixelDiff(a: ImageData, b: ImageData, opts): PixelDiffResult` _(exported)_

Calls `pixelmatch(a.data, b.data, diff, width, height, { threshold, includeAA, alpha: 0.4 })`.

- `threshold` (default `0.1`): per-channel difference threshold 0–1. Lower = more sensitive.
- `includeAA` (default `false`): when false, anti-aliased pixels are not counted as different.
- `alpha: 0.4`: unchanged pixels are rendered at 40% opacity in the heatmap.

Paints the diff buffer onto a `<canvas>` and captures it as a PNG data URL for display.

**Precondition**: `a` and `b` must have identical dimensions. The caller is responsible for
ensuring this; `comparePage` only calls `pixelDiff` when both images have the same dimensions.

### 5.8 `matchItems(itemsA: TextItem[], itemsB: TextItem[]): ItemMatch` _(exported)_

Greedy nearest-position string-match between two pages' text items:

1. Normalize each string: `s.replace(/\s+/g, ' ').trim().toLowerCase()`.
2. Bucket all B items by their normalized string.
3. For each A item:
   - Find all B candidates with the same normalized string that haven't been used yet.
   - If none → `onlyA`.
   - If one or more → pick the **nearest** by Euclidean distance `(bx-ax)² + (by-ay)²`.
   - Mark the chosen B item as used; record a `MatchedPair` with dx/dy/dw/dh/offset.
4. All unused B items with non-empty normalized strings → `onlyB`.

`matched` is sorted by largest `offset` in the UI for surfacing the biggest discrepancies first.

### 5.9 `comparePage(pdfA, pdfB, pageIndex, opts): Promise<PageComparison>` _(exported)_

Orchestrates a full comparison for one 0-based page index:

1. Check whether each side has the requested page (`pageIndex < pdf.numPages`).
2. Side A defines the shared target box dimensions (pixels). If A is missing, use B's dimensions.
3. Render + extract both sides using `renderAndExtract`. Missing sides produce `null` images,
   empty item arrays, and a `notes` entry.
4. Detect and note: no text layer (empty items on a loaded side), page-size mismatch (letterboxed).
5. Call `reconstructReadingText` on both item arrays → `textA`, `textB`.
6. Call `diffText` + `contentMatchRatio` → `diff`, `contentMatch`.
7. Call `matchItems` → `match`; compute `maxOffset = max(all matched offsets)`.
8. Call `pixelDiff` if both images exist and have identical dimensions → `pixel`.
9. Return assembled `PageComparison`.

---

## 6. Rendering tunables

| Constant | Value | Meaning |
|----------|-------|---------|
| `BASE_SCALE` | `2` | Default pdfjs render scale (~144 DPI: 1pt = 2px) |
| `MAX_PAGE_WIDTH` | `1600` | Cap on the target-box width in px |

The effective scale is `min(BASE_SCALE, MAX_PAGE_WIDTH / page.naturalWidth)` so very wide pages
are capped instead of blown up.

---

## 7. Store (`compareStore`)

Single Zustand store that owns all comparison state. The engine is accessed only through this
store (no component calls engine functions directly).

### 7.1 Modal state

| Field / action | Type | Description |
|---------------|------|-------------|
| `isCompareOpen` | `boolean` | Whether the modal is rendered |
| `openCompare()` | `() => void` | Set `isCompareOpen = true` |
| `closeCompare()` | `() => void` | Set `isCompareOpen = false` |

### 7.2 Uploaded sides

Each side has a loaded state, a loading flag, and an error string.

```ts
interface LoadedSide {
  name:      string;           // original filename
  doc:       PDFDocumentProxy; // opaque pdfjs ref — not serialized
  pageCount: number;           // doc.numPages
}
```

| Field / action | Type | Description |
|---------------|------|-------------|
| `sideA` | `LoadedSide \| null` | Side A (original) |
| `sideB` | `LoadedSide \| null` | Side B (recreated) |
| `loadingA` / `loadingB` | `boolean` | Parsing in progress |
| `errorA` / `errorB` | `string \| null` | Parse error message |
| `loadFile(side, file)` | async action | Call `engine.loadPdf`, store doc + pageCount, reset `pageCache` / `summary` / `currentPage` on success, set error on failure |
| `clearSide(side)` | action | Set that side to `null`, reset cache / summary / page |

**Cache invalidation**: any time either side changes, `pageCache` and `summary` are reset to
empty/null. This forces recomputation on the next page view.

### 7.3 Built-in example

| Field / action | Type | Description |
|---------------|------|-------------|
| `loadingExample` | `boolean` | Fetch in progress |
| `loadExample()` | async action | Fetch two bundled sample PDFs from `<BASE_URL>samples/invoice-original.pdf` and `invoice-recreated.pdf`, wrap each as a `File`, pass to `loadFile`. Reuses the normal per-side loading logic. |

The sample files are plain PDF files served as static assets. They show the same invoice with
a handful of intentional differences so the user can explore all comparison views without
uploading their own documents.

### 7.4 Navigation and mode

| Field / action | Type | Description |
|---------------|------|-------------|
| `currentPage` | `number` | 0-based page index currently displayed |
| `mode` | `CompareMode` | Active tab: `'content'`, `'layout'`, or `'report'` |
| `setCurrentPage(i)` | action | Clamps `i` to `[0, maxPages-1]` before setting |
| `setMode(m)` | action | Switch active tab |

`maxPages(sideA, sideB) = Math.max(sideA?.pageCount ?? 0, sideB?.pageCount ?? 0)`.
When page counts differ, navigation goes up to the larger count; missing pages on the shorter
side are gracefully handled (null image, empty text, a note).

### 7.5 Layout-view controls

| Field / action | Type | Default | Description |
|---------------|------|---------|-------------|
| `viewMode` | `LayoutViewMode` | `'side-by-side'` | Which layout sub-view is active |
| `overlayOpacity` | `number` 0–1 | `0.5` | Opacity of the B image in overlay mode |
| `pixelThreshold` | `number` 0–1 | `0.1` | pixelmatch sensitivity (lower = more sensitive) |
| `includeAA` | `boolean` | `false` | Whether anti-aliased pixels are flagged as different |
| `offsetThresholdPx` | `number` | `2` | Geometry table: rows with `offset > this` are highlighted red |
| `setViewMode(v)` | action | — | Switch layout sub-view |
| `setOverlayOpacity(n)` | action | — | Update overlay opacity |
| `setPixelThreshold(n)` | action | — | Update pixel sensitivity; **invalidates pageCache + summary** |
| `setIncludeAA(b)` | action | — | Toggle anti-aliasing flag; **invalidates pageCache + summary** |
| `setOffsetThreshold(n)` | action | — | Update geometry-table flag threshold; no cache invalidation |

`pixelThreshold` and `includeAA` invalidate the cache because they affect the pixelmatch result.
`offsetThresholdPx` does not because it only changes which rows are highlighted; the underlying
data is unchanged.

### 7.6 Per-page comparison cache

| Field / action | Type | Description |
|---------------|------|-------------|
| `pageCache` | `Record<number, PageComparison>` | Keyed by 0-based page index |
| `computing` | `boolean` | `true` while a single page is being computed |
| `computePage(i)` | async action | If `pageCache[i]` already exists, returns immediately (no recompute). Otherwise calls `engine.comparePage(sideA.doc, sideB.doc, i, { pixelThreshold, includeAA })`, stores result in `pageCache[i]`. Only runs if both sides are loaded. |

The modal's `useEffect` calls `computePage(currentPage)` whenever `currentPage`, `mode`,
`pixelThreshold`, or `includeAA` change (and mode ≠ `'report'`). Because `computePage` is a
no-op when the result is already cached, subsequent visits to the same page are instant.

### 7.7 Roll-up report

| Field / action | Type | Description |
|---------------|------|-------------|
| `summary` | `CompareSummary \| null` | Computed report; null until `computeAll()` runs |
| `computingSummary` | `boolean` | `true` while `computeAll` is running |
| `summaryProgress` | `{ current, total } \| null` | Progress counter for the UI |
| `computeAll()` | async action | Iterates all `maxPages` pages; for each, uses the cached result if available or calls `engine.comparePage`; builds `CompareSummary`; updates `summaryProgress` after each page. Failed pages are skipped (no crash). |

### 7.8 Selector helpers (exported)

```ts
useBothLoaded(): boolean   // true when both sideA and sideB are non-null
useTotalPages(): number    // maxPages(sideA, sideB)
```

---

## 8. UI components

### 8.1 `CompareModal`

Full-screen dialog that acts as the shell for the entire comparison workspace.

**Dialog behavior**:
- Implemented as a Radix `Dialog.Root` with `open={isCompareOpen}`.
- `onOpenChange` calls `closeCompare()` so pressing Escape or clicking the backdrop closes it.
- The overlay is at `z-index: 100`; the content at `z-index: 101`.
- The content fills the viewport with a 16px inset margin (`position: fixed; inset: 16px`).
- Has `border-radius: 12px` and `max-height: calc(100vh - 32px)`.

**Layout** (top to bottom):
1. **Header bar** (always visible):
   - Title with a compare icon.
   - Two `PdfUploadSlot` components side-by-side.
   - An `×` close button.

2. **Sub-toolbar** (visible only when both sides are loaded):
   - Three mode tabs: Content · Layout · Report (each with an icon).
   - `PageNavigator` (hidden in Report mode).

3. **Body** (scrollable/flex-fill):
   - When neither side is loaded: an empty-state screen with instructions and a
     "Load example invoices" button.
   - `mode === 'content'` → `ContentCompareView`.
   - `mode === 'layout'`  → `LayoutCompareView`.
   - `mode === 'report'`  → `CompareReport`.

**Auto-compute**: a `useEffect` triggers `computePage(currentPage)` whenever the modal is open,
both sides are loaded, mode is not `'report'`, or `currentPage` / `pixelThreshold` / `includeAA`
change.

---

### 8.2 `PdfUploadSlot`

One drop-zone / click-to-browse slot for a single comparison side.

**Props**: `side: 'A' | 'B'`, `label: string`, `hint: string`.

**States**:
- **Empty / idle**: dashed-border drop zone showing `hint` text. Clicking opens a hidden
  `<input type="file" accept=".pdf,application/pdf">`.
- **Dragging**: border and background change color (indigo for A, emerald for B) while a file
  is being dragged over.
- **Loading**: spinner + "Reading PDF…" text.
- **Loaded**: solid-border card showing the filename (truncated), page count badge (e.g. "3p"),
  and a clear (`×`) button.
- **Error**: red alert icon + error message below the slot.

**File acceptance**: accepts via drag-and-drop (`onDrop`) or file picker (`onChange`). Files are
passed to `store.loadFile(side, file)` which handles reading and error propagation. The MIME type
is not strictly validated before passing to the engine — it is accepted and any parse failure
becomes an error message.

**Color coding**: side A uses indigo; side B uses emerald.

---

### 8.3 `PageNavigator`

Prev/next page buttons + "Page X of N" label + optional mismatch warning.

**Behavior**:
- Returns `null` if total pages is 0.
- Prev button disabled at page 0; next button disabled at last page.
- Calls `store.setCurrentPage(currentPage ± 1)` on click (the store clamps to valid range).
- When `sideA.pageCount !== sideB.pageCount`, shows a warning badge:
  `⚠ {countA} vs {countB}` with a tooltip explaining the mismatch.
  Navigation still works up to `max(countA, countB)`; missing pages on the shorter side are
  handled gracefully by the engine.

---

### 8.4 `ContentCompareView`

Per-page text comparison. Reads `store.pageCache[store.currentPage]`.

Shows a loading spinner (`computing` flag) while the page is being computed.

**Layout** (top to bottom, scrollable container):

1. **Rendered pages** — two `<img>` elements side-by-side, each labelled "A · Original" or
   "B · Recreated". Uses `image.dataUrl` from the `PageComparison`. If a page is missing on one
   side, shows a placeholder div: "No page N on this side."

2. **Notes** — if `pc.notes.length > 0`, an amber alert box listing each note (e.g.
   "No selectable text layer in A (scanned image?)", "Page B has a different size/aspect ratio
   and was scaled to fit A.", "This page exists only in the recreated PDF (B).").

3. **Content match score** — a single line showing:
   - The match percentage to one decimal place (e.g. "98.3%").
   - Color coding: ≥99.9% → emerald; ≥90% → amber; <90% → red.
   - Added/removed counts: "− N removed" (red) and "+ N added" (green), from
     `match.onlyA.length` and `match.onlyB.length`.

4. **Word-level diff** — a `<pre>`-style box with monospace text. Each `DiffSegment` is a
   `<span>`:
   - `added` (green background, dark green text): text present in B but not A.
   - `removed` (red background, red text, strikethrough): text present in A but not B.
   - Neither: plain gray text (unchanged).
   - If both texts are empty: shows "No selectable text on this page to diff."

---

### 8.5 `LayoutCompareView`

Visual + geometric layout comparison. Reads `store.pageCache[store.currentPage]`.

Shows a loading spinner while computing.

**Controls bar** (always visible, changes by `viewMode`):

- **View mode tabs**: `Side by side` · `Overlay` · `Pixel diff` (icon + label buttons).
- When `viewMode === 'overlay'`:
  - "B opacity" range slider (0–1, step 0.05), value label in %.
- When `viewMode === 'diff'`:
  - "Sensitivity" range slider (0–0.5, step 0.01); lower = more sensitive.
  - "Flag anti-aliasing" checkbox.
  - Pixel-different score badge (top-right of controls bar): percentage of changed pixels,
    color-coded: <0.5% → emerald; <5% → amber; ≥5% → red.

**Image stage** (flex-fill, gray background, scrollable, center-aligned):

Display scale: pages are fitted to `MAX_DISPLAY_H = 460px` while maintaining aspect ratio.
`dispScale = min(1, 460 / image.height)`.

- `side-by-side`: two images labelled A and B, side-by-side with a gap. Missing pages show a
  placeholder of the same dimensions.
- `overlay`: a single stacked container at `(dispW × dispH)`. Side A image is fully opaque
  underneath; side B is on top at `opacity = overlayOpacity`. `MeasureOverlay` is rendered over
  the stack.
- `diff`: shows `pc.pixel.diffDataUrl` as a single image at `(dispW × dispH)`. If pixel diff
  is unavailable (one side missing or different page sizes), shows a text notice. `MeasureOverlay`
  is rendered over it.

**Geometry table** (fixed-height panel at the bottom, max 34% of container height, scrollable):

- Header: "Text position offsets · N matched runs · max offset Mpx" + a "Flag > [N] px" input.
- Rows are sorted by `offset` descending (largest offsets first).
- At most 200 rows rendered for performance.
- Each row: `text` | `Δx` | `Δy` | `offset` (all in px, integer-rounded).
- Rows where `offset > offsetThresholdPx` are highlighted with a red background and red
  `offset` text.
- If no matched runs: "No matching text runs to measure (no text layer, or no shared text)."

---

### 8.6 `MeasureOverlay`

A transparent interactive layer rendered on top of any page image (used in `overlay` and `diff`
views). Lets the user drag to measure distances on the page.

**Behavior**:
- Covers its parent absolutely (`position: absolute; inset: 0`). Cursor is crosshair.
- **Pointer down**: capture the pointer; record the start point in CSS pixels.
- **Pointer move**: update the end point in CSS pixels.
- **Pointer up**: if the drag was less than 3 CSS pixels, treat as a click and clear the
  measurement. Otherwise keep it.
- Converts CSS pixel coordinates to **natural pixel coordinates** (the same space as the geometry
  table) by scaling by `naturalWidth / element.clientWidth`.

**Visual** (when a measurement exists):
- A dashed red SVG line from start to end, with red circles (r=3) at each endpoint.
- A tooltip label near the midpoint showing: `{dist}px · Δx {dx} · Δy {dy}` (all in natural px,
  integer-rounded).

**Props**: `naturalWidth: number` — the unscaled pixel width of the rendered page image. Used to
compute the CSS→natural scaling factor.

---

### 8.7 `CompareReport`

All-pages roll-up view. Requires `computeAll()` to be run explicitly.

**Controls row**:
- "Compare all pages" / "Re-run all pages" button (triggers `computeAll()`). While running,
  shows a spinner and "Comparing X/N…" progress text.
- Three PASS threshold inputs (user-adjustable, retained in local component state):
  - `content ≥ [N]%` (default 99).
  - `pixels ≤ [N]%` (default 2).
  - `offset ≤ [N]px` (default 3).
- Overall PASS/FAIL badge (visible once summary is available): green PASS with a checkmark, or
  red FAIL with an X. The verdict is `summary.pages.every(judge)` where `judge` checks all three
  thresholds.

**Per-page table** (scrollable, bordered):
- Columns: Page | Content match | Pixels different | Max offset | Result.
- Values formatted to one decimal place (`87.3%`) or integer px (`4px`).
- "Missing" pages show `—` in all metric columns and an amber "missing" badge in Result.
- Result column: ✓ (emerald) for PASS, ✗ (red) for FAIL.
- Each row is **clickable**: clicking navigates to that page (`store.setCurrentPage`) and switches
  to the Layout tab (`store.setMode('layout')`), providing a direct drill-down from the report.

**Empty state**: before `computeAll()` is run, the table area shows "Run a full comparison to
see the per-page report."

---

## 9. Coordinate system

All geometry (text item coordinates, pixel diff, measure tool) uses a single consistent space:

- **Origin**: top-left of the rendered page canvas.
- **Units**: CSS pixels at the render scale (BASE_SCALE × natural page dimensions, capped at MAX_PAGE_WIDTH wide).
- **Both sides share the same target box**: Side A's pixel dimensions define the box; Side B is
  scaled and letterboxed to fit. This means a `TextItem` from A and the same text run from B
  can be directly compared (Δx, Δy are meaningful).
- **Letterboxing**: when page B has a different aspect ratio from A, B is scaled uniformly to
  fit inside A's box and centered with white padding. The `letterboxed` flag on
  `RenderedPageImage` signals this; a note is added to `PageComparison.notes`.

---

## 10. Edge cases and graceful degradation

| Situation | Behavior |
|-----------|----------|
| Different page counts (A has 3p, B has 5p) | Navigation goes up to `max(3,5) = 5`. Pages 4 and 5 have `imageA = null`, empty `textA`, and a note "This page exists only in the recreated PDF (B)." Page counts shown in `PageNavigator` with a ⚠ badge. |
| Page absent on one side | `comparePage` renders only the available side; `pixel = null` (no diff possible). The missing side's items are empty; the `match` has all of the present side's items in `onlyA` or `onlyB`. |
| Scanned / image-only PDF (no text layer) | `extractItems` returns `[]`; `textA`/`textB` is `''`. `diff` is trivially empty. `match.matched` is empty. A note: "No selectable text layer in A (scanned image?)." The pixel diff still works. |
| Different page sizes | B is letterboxed to fit A's pixel box. `image.letterboxed = true`. A note is added. Pixel diff is valid (both canvases are the same size). Geometry offsets include the letterbox offset, which may be large and misleading — the note warns the user. |
| pixelThreshold or includeAA change | The entire `pageCache` and `summary` are invalidated (reset to `{}`/`null`). On next page view, `computePage` recomputes from scratch with the new settings. |
| `computeAll()` while page render fails | The failing page is skipped (the try/catch in the loop catches it and continues). That page will have `contentMatch: 0, pixelRatio: 0, maxOffset: 0` in the summary (default values), and will likely FAIL. |
| Very large pages | `BASE_SCALE` is reduced to keep width ≤ `MAX_PAGE_WIDTH`. Memory is still bounded; pages narrower than 800 natural points render at 2× (144 DPI). |
| `computeAll()` called again (re-run) | Recomputes all pages, using the existing cache for any pages already computed at the current settings. Clears and rebuilds the summary from scratch. |

---

## 11. File structure

```
src/
  types/
    compare.ts              ← All shared interfaces (TextItem, PageComparison, …)
  services/
    pdfCompare.ts           ← Engine: loadPdf, comparePage, and helpers
  store/
    compareStore.ts         ← Zustand store (modal, sides, cache, controls, report)
  components/
    compare/
      CompareModal.tsx      ← Full-screen dialog shell
      PdfUploadSlot.tsx     ← Drag/click upload slot (×2, one per side)
      PageNavigator.tsx     ← Prev/next + mismatch warning
      ContentCompareView.tsx← Side-by-side images + word diff + score
      LayoutCompareView.tsx ← Visual views + geometry table
      MeasureOverlay.tsx    ← Drag-to-measure tool
      CompareReport.tsx     ← All-pages table + PASS/FAIL verdict
public/
  samples/
    invoice-original.pdf    ← Bundled example (Side A)
    invoice-recreated.pdf   ← Bundled example (Side B)
```

---

## 12. Wiring into the host app

The module is self-contained. Two things are needed to wire it in:

1. **Trigger**: call `useCompareStore.getState().openCompare()` from any button/menu item.

2. **Render the modal**: place `<CompareModal />` unconditionally somewhere near the root of the
   app (outside any conditional renders). It renders nothing when `isCompareOpen` is false.

```tsx
// In your root layout or toolbar component:
import { useCompareStore } from '@/store/compareStore';
import CompareModal from '@/components/compare/CompareModal';

// Trigger:
<button onClick={() => useCompareStore.getState().openCompare()}>Compare PDFs</button>

// Modal (place once, outside of conditions):
<CompareModal />
```

No props are required on `CompareModal`. All state flows through the store.
