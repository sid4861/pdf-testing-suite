---
type: Reference
description: "How the product works, in diagrams — the app shell, each workspace tab, the compare engine and the CLI commands. Drawn from the code."
---

# Architecture — PDF Comparison Suite

**What this is.** The app and the `pdfsuite` CLI, drawn from the code as it stands
(verified 2026-10-14). Every box names the real file or function. Where
[`README.md`](../README.md) disagrees with the code, these diagrams follow the code.

**Legend.** Solid border = built · dashed = behind a feature flag · dotted = planned, not built.

**Standalone SVGs.** Every diagram is also a self-contained SVG in [`docs/architecture/`](architecture/), linked under each diagram. They are rendered from the Mermaid blocks in this file — re-render them when a block changes.

**Contents**

- Part 1 · High level — [System overview](#system-overview) · [UI shell and state](#ui-shell-and-state) · [Feature flags](#feature-flags) · [Compare engine](#compare-engine-comparepage)
- Part 2 · Each tab — [Compare 2 PDFs](#compare-2-pdfs--loading-scanning-and-navigation) · [Side by side](#side-by-side) · [Overlapping](#overlapping) · [View report](#view-report) · [Export and Import ZIP](#export-menu-and-import-zip) · [Spec driven comparison](#spec-driven-comparison) · [Inspect PDF](#inspect-pdf) · [Batch compare](#batch-compare)
- Part 3 · CLI — [Build and engine reuse](#how-the-cli-is-built-and-reuses-the-engine) · [`generate`](#pdfsuite-generate) · [`compare`](#pdfsuite-compare) · [`pairs`](#pdfsuite-pairs) · [Verdict rules: app vs CLI](#verdict-rules-app-vs-cli)
- Part 4 · [Planned](#planned--excel--spec-conversion-and-deferred-cli-work)

---

# Part 1 · High level

## System overview

- **One engine, no React.** [`src/services`](../src/services/) holds all comparison logic; the four workspaces reach it through six Zustand stores.
- **The Node CLI imports the same engine files unchanged**, with a small DOM shim that swaps the browser canvas for `@napi-rs/canvas`.
- **There is one CLI, the Node one** — the product is TypeScript ([SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md)).

```mermaid
flowchart LR
  subgraph BROWSER["Browser app · Vite + React 18"]
    SHELL["App.tsx<br/>workspace tabs + export corner"]
    WS1["Compare 2 PDFs"]
    WS2["Spec driven comparison"]
    WS3["Inspect PDF"]
    WS4["Batch compare"]
    STORES["Zustand stores<br/>compare · annotation · ignore<br/>spec · measure · batch"]
    SHELL --> WS1 & WS2 & WS3 & WS4
    WS1 & WS2 & WS3 & WS4 --> STORES
  end
  subgraph ENGINE["Engine · src/services · no React"]
    CMPS["pdfCompare.ts<br/>loadPdf · comparePage"]
    CHG["changes.ts<br/>buildChanges · verdict"]
    SPC["specCheck.ts<br/>runSpec · validateSpec"]
    ELM["pdfElements.ts<br/>renderElements"]
    EXP["exportReport · exportMarkdown<br/>exportZip · importZip · batchExport"]
  end
  subgraph LIBS["Libraries"]
    PDFJS["pdfjs-dist<br/>parse · render · text"]
    PXM["pixelmatch"]
    DIF["diff"]
    ZL["jszip + pdf-lib"]
  end
  FLAGS["flag.env"] -->|"Vite plugin<br/>virtual:feature-flags"| SHELL
  STORES --> CMPS & CHG & SPC & ELM & EXP
  CMPS --> PDFJS & PXM & DIF
  SPC --> PDFJS
  ELM --> PDFJS
  EXP --> ZL
  subgraph CLIS["Command line"]
    NODE["Node pdfsuite<br/>cli/dist/index.js"]
    SEAM["platform/engine.ts<br/>+ dom-shim"]
  end
  API[("Render API<br/>JSON payload → PDF")]
  NODE -->|generate| API
  NODE -->|compare| SEAM
  SEAM -->|"imports unchanged"| CMPS
  SEAM --> CHG & EXP
```

[Open as SVG](architecture/01-system-overview.svg)

## UI shell and state

- **The workspace is plain `useState`** in [`src/App.tsx`](../src/App.tsx); each workspace owns one store, and Compare also uses the annotation and ignore stores.
- **Two effects drive Compare:** compute the visible page; run a full scan automatically when the larger PDF has 60 pages or fewer.
- **Stores meet in two places only:** Batch's "Open in Compare" (`adoptPair`) and Import ZIP (`adoptImported` + annotation `replaceAll`).

```mermaid
flowchart TB
  classDef flag stroke-dasharray: 6 4
  subgraph HEADER["Header · App.tsx"]
    TABS["Workspace tabs<br/>Batch compare · Compare 2 PDFs<br/>Spec driven comparison · Inspect PDF"]
    RIGHT["Export corner<br/>Compare: Import ZIP + ExportMenu<br/>Batch: BatchExportMenu<br/>Spec: SpecExportMenu<br/>Inspect: nothing"]
  end
  TABS -->|"ws state"| CWS & SWS & IWS & BWS
  CWS["Compare 2 PDFs<br/>mode tabs: Side by side · Overlapping · View report<br/>SummaryChip · PageNavigator · PageStrip"]
  SWS["SpecTestView"]
  IWS["MeasureView"]
  BWS["BatchView"]
  CWS --> CS[("compareStore<br/>sides · pageCache · summary<br/>mode · pixelThreshold · offsetThresholdIn · zoom")]
  CWS --> AS[("annotationStore<br/>comment pins")]
  CWS --> IS[("ignoreStore<br/>differences marked expected")]
  SWS --> SS[("specStore")]
  IWS --> MS[("measureStore")]
  BWS --> BS[("batchStore")]
  BWS -->|"Open in Compare<br/>adoptPair"| CS
  EF1["Effect: computePage(currentPage)<br/>reruns on page, threshold or AA change"] --> CS
  EF2["Effect: computeAll()<br/>auto when 60 pages or fewer"] --> CS
  class BWS flag
```

[Open as SVG](architecture/02-ui-shell-and-state.svg)

Code: `src/App.tsx` · `src/store/*.ts` · `src/main.tsx`

## Feature flags

- **`flag.env` → Vite plugin → `virtual:feature-flags`** ([`vite.config.ts`](../vite.config.ts)).
- **[`src/flags.ts`](../src/flags.ts) defaults every flag to on.** A missing key keeps the default; an unrecognised value warns and keeps the default.
- **Dev reloads the browser on save;** a production build bakes the values in.

```mermaid
flowchart LR
  FE["flag.env<br/>KEY=value"] --> VP["vite.config.ts plugin<br/>parseFlagEnv"]
  VP --> VM["virtual:feature-flags"]
  VM --> FT["src/flags.ts read()<br/>true/1/on/yes/enabled → on<br/>false/0/off/no/disabled → off<br/>missing or typo → default (on)"]
  FT --> G1["batchCompare → Batch tab"]
  FT --> G2["annotations → comment pins"]
  FT --> G3["layoutSideBySide → Overlapping side-by-side view"]
  FT --> G4["exportZip · exportMarkdown · exportJsonCsv<br/>→ Export menu entries"]
  FE -.-> W["dev server watcher"]
  W -->|"file changed"| INV["invalidate module<br/>full browser reload"]
```

[Open as SVG](architecture/03-feature-flags.svg)

| flag | key in `flag.env` | value in `flag.env` | controls |
|---|---|---|---|
| annotations | `FEATURE_ANNOTATIONS` | true | comment pins in Side by side and Overlapping side-by-side |
| exportZip | `FEATURE_EXPORT_ZIP` | true | ZIP bundle export |
| batchCompare | `FEATURE_BATCH_COMPARE` | false | Batch compare workspace tab |
| layoutSideBySide | `FEATURE_LAYOUT_SIDE_BY_SIDE` | false | side-by-side view inside Overlapping (otherwise it opens on Pixel diff) |
| exportJsonCsv | `FEATURE_EXPORT_JSON_CSV` | false | JSON and CSV entries in every Export menu |
| exportMarkdown | `FEATURE_EXPORT_MARKDOWN` | false | Markdown fix-list export and viewer tab |

## Compare engine: `comparePage`

- **The golden page fixes the target box:** 2 px per point (144 DPI), capped at 1600 px wide. Both pages draw into it, so their coordinates line up.
- **A page of a different shape is scaled and centred (letterboxed),** and its glyph sizes are then not compared.
- **Three signals per page:** word diff of the text, position match of text runs, pixel diff. `buildChanges` turns them into removed · added · moved · restyled.

```mermaid
flowchart TB
  IN["comparePage(pdfA, pdfB, pageIndex,<br/>pixelThreshold, includeAA)"]
  BOX["targetBox from the golden page<br/>scale = min(2, 1600 ÷ page width) px per pt<br/>pxPerInch = scale × 72"]
  IN --> BOX
  BOX --> RA["renderAndExtract · golden"] & RB["renderAndExtract · under test"]
  subgraph RX["renderAndExtract · same steps for each side"]
    R1["page.render to a temp canvas<br/>fitted inside the target box"] --> R2["centre on a white target canvas<br/>letterbox if aspect ratio differs"]
    R2 --> R3["getImageData (RGBA)<br/>toDataURL (PNG)"]
    R2 --> R4["extractItems<br/>text runs · x y w h · font · bold · italic"]
  end
  RA & RB --> TXT["reconstructReadingText A and B"]
  TXT --> DT["diffText · diffWords"] --> CM["contentMatchRatio"]
  RA & RB --> MI["matchItems<br/>+ reconcileSegmentation"]
  MI --> MO["matched · onlyA · onlyB · restyled<br/>maxOffset in px"]
  RA & RB --> SZ{"same pixel size?"}
  SZ -->|yes| PX["pixelDiff · pixelmatch<br/>ratio + diff image"]
  SZ -->|no| NP["pixel = null"]
  CM & MO & PX & NP --> PC["PageComparison<br/>images · texts · diff · contentMatch<br/>match · maxOffset · pixel · notes"]
  PC --> BC["buildChanges(pc, movedThresholdIn)<br/>removed · added · moved · restyled<br/>pair replacements · number groups · ignore key"]
  PC --> VD["pageHasChange / summaryPageDiffers<br/>missing page · content under 99.99%<br/>pixels over 0.2% · offset over 2 px"]
```

[Open as SVG](architecture/04-compare-engine.svg)

Code: [`src/services/pdfCompare.ts`](../src/services/pdfCompare.ts) · [`src/services/changes.ts`](../src/services/changes.ts) · [`src/types/compare.ts`](../src/types/compare.ts)

> **Watch.** Under Node, `loadPdf` sets no `standardFontDataUrl`. Text in non-embedded standard fonts may not be drawn, and the CLI hides that warning. CLI pixel results can therefore differ from the browser's.

---

# Part 2 · Each tab in detail

## Compare 2 PDFs — loading, scanning and navigation

- **Loading either side clears** the page cache, the summary and any imported report.
- **The visible page is compared first;** the background scan then fills the summary chip and the changed-page strip.
- **"Next change" compares forward until `pageHasChange` is true**, reusing cached pages.

```mermaid
sequenceDiagram
  actor U as User
  participant SLOT as PdfUploadSlot
  participant S as compareStore
  participant E as pdfCompare
  participant APP as App.tsx effects
  participant UI as Chip · Strip · Navigator
  U->>SLOT: drop golden PDF and PDF to test
  SLOT->>S: loadFile(side, file)
  S->>E: loadPdf(file) → pdfjs getDocument
  E-->>S: PDFDocumentProxy
  S->>S: set side · clear pageCache, summary, imported report
  APP->>S: computePage(currentPage)
  S->>E: comparePage(docA, docB, i)
  E-->>S: PageComparison → pageCache[i]
  APP->>S: computeAll() when 60 pages or fewer
  loop every page
    S->>E: comparePage, reusing cached pages
  end
  S-->>UI: summary → changed-page dots and count
  U->>UI: Next change
  UI->>S: jumpToChange(+1)
  loop until pageHasChange
    S->>E: comparePage(i + 1) if not cached
  end
  S-->>UI: currentPage = next differing page
```

[Open as SVG](architecture/05-compare-loading-navigation.svg)

Code: `PdfUploadSlot.tsx` · `PageNavigator.tsx` · `PageStrip.tsx` · `SummaryChip.tsx` · `src/store/compareStore.ts`

> **Watch.** Nothing cancels a scan in flight. If a file is swapped mid-scan, the old result can land on the new pair.

## Side by side

- **Built from `pageCache[currentPage]` and `buildChanges`;** changes marked "expected" are filtered out first.
- **Page highlight ↔ Changes row ↔ Diff word** are linked by hover.
- **"Mark expected" stores `changeRef(page, key)`** — change text plus a coarse vertical band — so it survives a recompute.

```mermaid
flowchart LR
  classDef flag stroke-dasharray: 6 4
  PC["pageCache[currentPage]"] --> BC["buildChanges(pc, offsetThresholdIn)"]
  IS[("ignoreStore")] -->|"ignoredRefsFor(page)"| FL["remove changes<br/>marked expected"]
  BC --> FL
  FL --> HL["Highlights on both pages<br/>red removed · green added<br/>violet moved · cyan restyled"]
  subgraph DRAWER["Drawer tabs"]
    D1["Changes<br/>numbered list · region · position in inches"]
    D2["Diff<br/>word diff in reading order"]
    D3["Ignored<br/>restore · add a reason"]
  end
  FL --> D1 & D2
  IS --> D3
  D1 -->|"Mark expected<br/>changeRef(page, key)"| IS
  HL <-->|"hover links page ↔ row ↔ word"| D1
  AN["AnnotationLayer<br/>click a page to pin a comment"] --> AS[("annotationStore<br/>x, y as a fraction of the page")]
  ZM["contentZoom 0.25–6×"] --> HL
  class AN flag
```

[Open as SVG](architecture/06-tab-side-by-side.svg)

Code: `src/components/compare/ContentCompareView.tsx` · `AnnotationLayer.tsx` · `src/store/ignoreStore.ts` · `src/store/annotationStore.ts`

> **Watch.** Restyled text is shown here but does not change the page verdict; neither does marking a change expected.

## Overlapping

- **Two views:** Side by side (flag, off in `flag.env` now) and Pixel diff. With the flag off the switcher is hidden and the tab opens on Pixel diff.
- **Pixel diff draws pixelmatch's diff image,** with one box per change group, coloured by its strongest cause: text › style › layout.
- **`MeasureOverlay` marks removed, added, moved and restyled runs** with Δx/Δy in inches; a geometry table lists matched runs and links to the page by hover.

```mermaid
flowchart TB
  classDef flag stroke-dasharray: 6 4
  PC["pageCache[currentPage]"] --> VM{"viewMode"}
  VM -->|"side-by-side"| SBS["Two rendered pages<br/>+ comment pins"]
  VM -->|"diff"| PD["Pixel diff image<br/>pc.pixel.diffDataUrl"]
  PC --> BC["buildChanges minus ignored"] --> HB["heatmapBoxes<br/>one box per change group"]
  HB --> BK["bucket by cause<br/>text (amber) › style (cyan) › layout (violet)"]
  BK --> PD
  BK --> CNT["bucket counts + legend"]
  PC --> MO["MeasureOverlay<br/>onlyA · onlyB · moved · styled<br/>Δx Δy in inches"]
  MO --> PD
  PC --> GT["Geometry table<br/>matched runs · hover links to page"]
  ZM["layoutZoom 0.25–6×"] --> PD & SBS
  NO["no pixel diff<br/>page missing or sizes differ"] -.-> PD
  class SBS flag
```

[Open as SVG](architecture/07-tab-overlapping.svg)

Code: `src/components/compare/LayoutCompareView.tsx` · `MeasureOverlay.tsx` · `changes.ts › heatmapBoxes`

## View report

- **An imported ZIP's own report is shown as it was saved.**
- **Otherwise the report is built once per comparison** and shown in a sandboxed iframe with scripts disabled.
- **Only failing pages get a detail section;** passing pages are counted in the header.

```mermaid
flowchart TB
  OPEN["Open View report"] --> IMP{"importedReportHtml?"}
  IMP -->|yes| SHOW["show the bundle's report as saved"]
  IMP -->|no| SUM{"summary ready?"}
  SUM -->|no| RUN["Run button → computeAll()<br/>progress bar"] --> SUM
  SUM -->|yes| BH["buildHtmlReport(summary, meta,<br/>pageCache, ignored)"]
  BH --> JP["judgePage per page<br/>= not summaryPageDiffers"]
  JP --> RP["reportPageRows + reportPageDetail<br/>failing pages only"]
  RP --> SH["shrinkDataUrl<br/>downscale page images"]
  SH --> HTML["standalone HTML"]
  SHOW --> IF
  HTML --> IF["iframe srcDoc<br/>sandbox without allow-scripts"]
  HTML --> DL["Download .html"]
  HTML --> PR["Print / save as PDF"]
```

[Open as SVG](architecture/08-tab-view-report.svg)

Code: `src/components/compare/CompareReport.tsx` · [`src/services/exportReport.ts`](../src/services/exportReport.ts)

> **Verdict.** Fixed, not adjustable: a page fails if it differs at all.

## Page pairing

- **The unit of comparison is a pair, not a page number.** Page 5 against page 5 is only right while both documents hold the same pages in the same order; one inserted or dropped page makes every later comparison meaningless.
- **`pairs[]` is the navigation sequence** and `currentPage` indexes into it. It defaults to the straight 1:1 list, so nothing changes until someone pairs the pages.
- **Pairing is done by hand, and nothing is inferred.** "Pair pages" opens a list of rows; clicking either side opens that PDF in a page picker, scrollable, with a size control. "No matching page" marks a page added or removed. Done applies it; the button then reads "Revert to page by page comparison".
- **An automatic aligner exists in `pagePairs.ts` and is deliberately unwired** — a suggestion that is subtly wrong is worse than no suggestion in a tool whose job is to be believed. It is kept, tested, and tree-shaken out of the build.
- **The editor warns rather than prevents:** a page used in two pairs is compared twice, and says so.

```mermaid
flowchart TB
  D["Two PDFs loaded"] --> SEQ[("pairs[] = sequentialPairs<br/>1:1, the actual page order")]
  SEQ --> CP
  BTN["⇄ Pair pages"] --> ED["Row editor<br/>golden cell ↔ tested cell"]
  ED -->|"click a cell"| PK["Page picker<br/>scroll · size control · 'No matching page'"]
  PK --> ED
  ED -->|"Done"| SET["setPairs — clears pageCache and summary"]
  SET --> CP["comparePage(pageIndexA, pageIndexB)"]
  CP --> V["Side by side · Overlapping · Report"]
  REV["Revert to page by page comparison"] --> SEQ
```

Code: [`src/services/pagePairs.ts`](../src/services/pagePairs.ts) · `src/components/compare/PagePairing.tsx` · `src/store/compareStore.ts`

## Export menu and Import ZIP

- **Every export reads the same inputs:** summary, page cache, ignored list, annotations. Only HTML is always on.
- **The ZIP holds the HTML report and both original PDFs.** Comments become real PDF `/Text` annotations; page content is untouched.
- **Import reverses it:** PDFs found by `golden__` / `candidate__` prefix, comments read back from the annotations, both sides loaded into Compare.

```mermaid
flowchart LR
  classDef flag stroke-dasharray: 6 4
  SRC["summary · pageCache · ignored<br/>annotations · both docs"] --> E1 & E2 & E3 & E4
  subgraph EXPORT["ExportMenu"]
    E1["HTML report<br/>exportHtmlReport"]
    E2["Markdown fix-list<br/>exportMarkdownReport"]
    E3["JSON · CSV<br/>exportJson · exportCsv"]
    E4["ZIP bundle<br/>exportZipBundle · loaded on demand"]
  end
  E4 --> Z1["reports/comparison-report.html"]
  E4 --> Z2["annotated-pdfs/golden__name.pdf<br/>annotated-pdfs/candidate__name.pdf<br/>original bytes + /Text annotations via pdf-lib"]
  Z1 & Z2 --> ZF[("bundle .zip")]
  ZF --> I1["Import ZIP<br/>readZipBundle · jszip"]
  I1 --> I2["first .html → importedReportHtml<br/>golden__ / candidate__ PDFs<br/>/Text annotations → comments"]
  I2 --> I3["loadPdf both sides"]
  I3 --> I4["adoptImported + annotation replaceAll"]
  I4 --> CS[("compareStore")]
  class E2,E3,E4 flag
```

[Open as SVG](architecture/09-export-import-zip.svg)

Code: `ExportMenu.tsx` · `ImportBundleButton.tsx` · [`src/services/exportZip.ts`](../src/services/exportZip.ts) · [`src/services/importZip.ts`](../src/services/importZip.ts) · `exportMarkdown.ts`

## Spec driven comparison

> **Sealed feature.** Everything below lives in `src/features/spec/` and shares no file
> with the rest of the app, because it is developed on a second machine that cannot push.
> Work flows one way — this repository out, a zip in — so **the copy of that folder here
> is a stale mirror; the live one is on the other machine.** The app imports `index.ts`;
> the CLI imports `engine.ts`. See
> [`src/features/spec/README.md`](../src/features/spec/README.md),
> `sh scripts/check-boundary.sh` and `sh scripts/update-from-zip.sh`.

- **No golden PDF:** a JSON spec lists each page's expected elements in inches, points or millimetres from the top-left ([`spec-standard.md`](../spec-standard.md)).
- **A spec workbook is read in the app.** An `.xlsx`/`.csv` is parsed in the browser and each sheet converted to a one-page spec; the reader pairs **a sheet** with **a PDF page** from two lists.
- **The conversion reports what it could not do** — a colour, a conditional rule, a wording cell that is all merge fields, an element with no measurement. Nothing is guessed.
- **Each element is checked on its own,** with expected-vs-actual values and a box on the page.
- **"One page" mode checks one spec page against any PDF page** — for single-sheet specs that always say `"page": 1`.

```mermaid
flowchart TB
  PDF["Generated PDF"] --> LP["loadPdfFile → loadPdf"]
  SJ["Spec .json"] --> LS["loadSpecFile"]
  XL[".xlsx / .csv"] --> RW["readSheetFile<br/>JSZip + DOMParser → cell grids"]
  RW --> PICK["pick a sheet"]
  PICK --> STS["sheetToSpec<br/>label vocabulary, not column position"]
  STS --> NOTES["conversion notes<br/>skipped · unconvertible · conditional"]
  LS --> VS["validateSpec<br/>non-empty pages · numeric page · elements array"]
  LP & VS & STS --> SS[("specStore")]
  MODE["Mode: All pages · or One page<br/>a sheet → a PDF page"] --> SS
  SS -->|"run()"| RS["runSpec(pdf, spec, options)"]
  RS --> G
  subgraph PERPAGE["for each selected spec page"]
    G["getPage(spec page or override)"] --> X1["extractItems<br/>text in points, top-left"]
    X1 --> GL["groupLines"]
    G --> X2["extractImages<br/>operator list + transform matrix"]
    G --> RPG["renderPage → PNG"]
    GL & X2 --> DIS{"element.type"}
    DIS --> CT["checkText<br/>present · left/top · font size · exact or contains"]
    DIS --> CI["checkImage<br/>present · left/top · width · height"]
    DIS --> CTB["checkTable<br/>present · left/top · width · rows/cols"]
    DIS --> CP["checkParagraph<br/>present · left/top · line spacing"]
  end
  ANC["Anchors: locate by a nearby label<br/>default within 2 in"] -.-> DIS
  TOL["Tolerances in points via unitToPt<br/>defaults 0.06 / 0.06 / 0.03"] -.-> DIS
  CT & CI & CTB & CP --> ER["ElementResult<br/>checks · expected box · actual box"]
  ER --> REP["SpecReport<br/>pass / fail per page and total"]
  REP --> VIEW["SpecTestView<br/>dashed expected box · actual box green or red"]
  REP --> SX["SpecExportMenu<br/>HTML · JSON (flag)"]
```

[Open as SVG](architecture/10-spec-driven-comparison.svg)

Code, all under [`src/features/spec/`](../src/features/spec/README.md): `index.ts` · `engine.ts` · `SpecTestView.tsx` · `specStore.ts` · `specCheck.ts` · `specExport.ts` · `sheetRead.ts` · `sheetSpec.ts` · `pdfjs.ts` · `types.ts` · `spec.css`

> **Watch.** Default tolerances are inch values applied in whatever unit the spec uses. The HTML export inserts `units` unescaped.

## Inspect PDF

- **One PDF; hover any text run or image to outline it, click to select it.**
- **Position** gives the distance to all four page edges in inches, with guide lines. **Font & paragraph** (text only) gives font, size, weight, style and line height.
- **No export.** Each page renders when first opened and is then cached.

```mermaid
flowchart TB
  F["PDF file or bundled sample"] --> L["measureStore.loadPdfFile"]
  L --> EP["ensurePage(currentPage)<br/>skips if already rendering"]
  EP --> R1
  subgraph RE["renderElements(pdf, i)"]
    R1["render at scale 2 → PNG"] --> R2["getTextContent<br/>runs in points, top-left"]
    R2 --> R3["resolveFont → name · bold · italic"]
    R1 --> R4["operator list → image boxes"]
  end
  R3 & R4 --> EPG["ElementsPage<br/>dataUrl · widthPt · heightPt · elements"]
  EPG --> MV["MeasureView"]
  MV --> HV["mousemove → toPoint in pt<br/>→ elementAt → hover outline"]
  HV --> SEL["click → selected element"]
  SEL --> POS["Position, inches<br/>left · top · width · height · right · bottom<br/>+ guide lines to page edges"]
  SEL --> FON["Font & paragraph, text only<br/>font · size pt · weight · style<br/>line height via adjacentLine · leading ratio"]
```

[Open as SVG](architecture/11-inspect-pdf.svg)

Code: `src/components/measure/MeasureView.tsx` · `src/store/measureStore.ts` · [`src/services/pdfElements.ts`](../src/services/pdfElements.ts)

## Batch compare

- **Add many PDFs to each side and pair them** — automatically by order or row by row. Pairs run in order, a page at a time.
- **Raw pixel buffers are dropped once a page is scored;** only PNG data URLs are kept.
- **"Open in Compare" hands the loaded documents** to the Compare workspace.

```mermaid
flowchart TB
  FA["Side A files · golden"] --> AF["addFiles → parseFiles<br/>loadPdf each · unreadable files skipped"]
  FB["Side B files · to test"] --> AF
  AF --> BS[("batchStore<br/>filesA · filesB · pairs · results")]
  PR["Pairing<br/>autoPairByOrder · or setPairSide per row"] --> BS
  BS -->|"run()"| P1
  subgraph LOOP["for each complete pair, in order"]
    P1["for each page<br/>comparePage(a, b, i)"] --> P2["drop raw RGBA buffers<br/>keep PNG data URLs"]
    P2 --> P3["PageSummary → CompareSummary"]
  end
  P3 --> RES["results[pairId]<br/>published after each pair"]
  RES --> OV["Overview table<br/>pairVerdict · worst page"]
  OV -->|"Open in Compare"| AD["compareStore.adoptPair<br/>switch workspace"]
  RES --> BX["BatchExportMenu<br/>HTML · Markdown (flag) · JSON / CSV (flag)"]
```

[Open as SVG](architecture/12-batch-compare.svg)

Code: `src/components/batch/BatchView.tsx` · `BatchExportMenu.tsx` · `src/store/batchStore.ts` · [`src/services/batchExport.ts`](../src/services/batchExport.ts)

> **Flag.** `FEATURE_BATCH_COMPARE=false` in `flag.env` now, so this tab is hidden.

---

# Part 3 · CLI

## How the CLI is built and reuses the engine

- **esbuild bundles `cli/src` plus the app's `src/services`** into `dist/index.js`, taking pdf.js's legacy build from the repo-root `node_modules` ([`cli/build.mjs`](../cli/build.mjs)).
- **[`cli/src/platform/engine.ts`](../cli/src/platform/engine.ts) is the only import from the app;** it loads the DOM shim first.
- **Options resolve flag › config file › default.** Exit codes: 0 OK · 1 the PDFs regressed · 2 the tool or job is broken.

```mermaid
flowchart TB
  subgraph BUILD["Build · cli/build.mjs · esbuild"]
    B1["cli/src/index.ts<br/>+ ../src/services"] --> B2["alias pdfjs-dist → legacy build<br/>?url plugin for the worker path"]
    B2 --> B3["dist/index.js · bin pdfsuite"]
  end
  RUNX["pdfsuite COMMAND"] --> GLB["global options<br/>--config · --no-config · -v"]
  GLB --> CFG["loadConfig<br/>find pdfsuite.config.json walking up<br/>reject unknown keys · expand ${ENV}"]
  CFG --> PICK["pick(): flag › config › default"]
  PICK --> GEN["generate"] & CMP["compare"] & PRS["pairs"]
  CMP --> ENG["platform/engine.ts<br/>the only import from the app"]
  ENG --> SHIM["dom-shim<br/>canvas · ImageData · Image<br/>DOMMatrix · Path2D via @napi-rs/canvas"]
  ENG --> LOGF["pdf-log filter<br/>hides pdf.js font warnings unless -v"]
  ENG --> SVC["src/services<br/>comparePage · changes<br/>exportReport · exportMarkdown"]
  GEN & CMP & PRS --> EXIT["exit codes<br/>0 OK · 1 comparison failed · 2 tool error"]
```

[Open as SVG](architecture/13-cli-build-and-engine.svg)

Code: `cli/src/index.ts` · `cli/src/core/config.ts` · `cli/src/core/exit.ts` · `cli/src/platform/dom-shim.ts`

> **Watch.** Commander exits 1 on bad arguments — the "PDFs regressed" code. The help text promises 2.

## `pdfsuite generate`

- **POSTs each `*.json` payload to the render API and saves the PDF.** Defaults assume a slow API: 4 in flight, 120 s timeout.
- **Retries only what a retry can fix:** 5xx and network errors. Timeouts only with `--retry-on-timeout`; 4xx never.
- **Writes `manifest.json`** (hashes, timings, redacted URL). Any failed document → exit 2, so a partial run never looks like a pass.

```mermaid
sequenceDiagram
  participant CLI as pdfsuite generate
  participant FS as payloads dir
  participant POOL as Worker pool
  participant API as Render API
  participant OUT as out dir
  CLI->>FS: list *.json payloads
  CLI->>POOL: start with --concurrency (default 4)
  Note over CLI: heartbeat line every 15 s
  loop each payload
    opt --skip-existing and the PDF is already there
      POOL->>OUT: reuse, no API call
    end
    POOL->>API: fetch(url, method, headers + auth, payload) · timeout 120 s
    alt 2xx
      API-->>POOL: response body
      POOL->>POOL: extractPdf by --response-mode<br/>json (responsePath) · binary · base64
      POOL->>POOL: check the PDF magic header
      POOL->>OUT: write name.pdf · sha256
    else 5xx or network error
      POOL->>POOL: retry up to --retries 2 · backoff 2 s, doubling
    else timeout
      POOL->>POOL: fail unless --retry-on-timeout
    else 4xx
      POOL->>POOL: fail, never retried
    end
  end
  POOL-->>CLI: results
  CLI->>OUT: manifest.json · redacted URL · hashes · timings
  CLI-->>CLI: exit 0 if all succeeded · exit 2 if any failed
```

[Open as SVG](architecture/14-cli-generate.svg)

Code: [`cli/src/commands/generate.ts`](../cli/src/commands/generate.ts) · `cli/src/core/manifest.ts` · `cli/mock-api/server.js`

## `pdfsuite compare`

- **Published to npm as `pdfsuite`.** `npm i -g pdfsuite`, then `pdfsuite compare <golden> <candidate> <pairs.json> <reports>`. The flags still work and override a positional.
- **`pairs.json` maps each golden file to its candidate,** and may skip pages. An unresolved pair stops the run before any compare.
- **Same engine *and* same verdict as the app** — `summaryPageDiffers` decides both, so the two cannot disagree (see [Verdict rules](#verdict-rules-app-vs-cli)).
- **`--format` picks the reports.** JUnit has one testsuite per pair id, so Jenkins keeps per-pair history.

```mermaid
flowchart TB
  IN["pdfsuite compare<br/>golden · candidate · pairs.json · reports<br/>positional, or the same four flags"] --> LP["loadPairs<br/>skipPages · relative paths only<br/>old threshold keys ignored, with a note"]
  LP --> TBL["print the pairing table"]
  TBL --> PB{"any pair unresolved?"}
  PB -->|yes| X2A["ToolError → exit 2"]
  PB -->|no| L1
  subgraph LOOP["for each pair, in order"]
    L1["loadPdf(fileFromPath) · A and B"] --> L2["comparePage for each page<br/>same engine as the app"]
    L2 --> L3["drop RGBA buffers"]
    L3 --> L4["judge(page)<br/>the app's summaryPageDiffers<br/>skipped pages always pass"]
  end
  L4 --> FMT{"--format<br/>default html,json,csv,junit"}
  FMT --> H["HTML · reuses reportPageDetail"]
  FMT --> J["report.json"]
  FMT --> C["CSV"]
  FMT --> JU["JUnit XML"]
  FMT --> MD["Markdown fix-list (md)"]
  L4 --> EX{"exit code"}
  EX -->|"a pair errored"| X2["2"]
  EX -->|"--fail-on none"| X0["0"]
  EX -->|"every pair passed"| X0B["0"]
  EX -->|"any pair failed"| X1["1"]
```

[Open as SVG](architecture/15-cli-compare.svg)

Code: [`cli/src/commands/compare.ts`](../cli/src/commands/compare.ts) · `cli/src/core/pairs.ts` · `cli/src/report/html.ts` · `cli/src/report/machine.ts` · `cli/fixtures/pairs.json`

## `pdfsuite pairs`

- **A dry run:** resolves `pairs.json` against both folders and prints the table. Nothing is compared.
- **All three options are required; this command ignores the config file.**

```mermaid
flowchart LR
  IN["pdfsuite pairs -r -c -P<br/>all three required"] --> LP["loadPairs"]
  LP --> T["formatPairTable → stdout"]
  LP --> Q{"problems?"}
  Q -->|yes| X2["exit 2"]
  Q -->|no| X0["exit 0"]
```

[Open as SVG](architecture/16-cli-pairs.svg)

## Verdict rules: app vs CLI

**Same engine, same judge.** `summaryPageDiffers` decides both, so a pair cannot FAIL in
the app and PASS in CI.

| check | app and CLI — `summaryPageDiffers` |
|---|---|
| content match | fails under 99.99% |
| pixels changed | fails over 0.2% |
| max text offset | fails over 2 px (≈0.014 in on Letter) |
| missing page | fails |
| tunable | **no** — the CLI's thresholds were removed; `skipPages` exempts a whole page, visibly |
| restyled text | ignored |

The CLI kept adjustable tolerances for a while after the app dropped them, which meant the
two disagreed about the same pair — and because esbuild strips types without checking them,
the drift went unnoticed until the HTML report crashed. `npm run build` in `cli/` now runs
`tsc --noEmit` first.

---

# Part 4 · Planned

## Planned — Excel → spec conversion, and deferred CLI work

Source: [`tools/plan.md`](../tools/plan.md) and [`cli/plan.md`](../cli/plan.md). **None of this is built.**

- **Three stages with a reviewable artifact in the middle** — a sheet the parser gets wrong is fixed once, and the fix is kept.
- **Only confident values become assertions;** weaker ones get wider tolerances, become notes, or appear only in the conversion report.
- **Deferred CLI work:** stem-match and manifest pairing, `bless` (promote candidates to goldens), worker-thread parallelism, a Docker image for stable fonts.

```mermaid
flowchart LR
  classDef plan stroke-dasharray: 2 3
  XL["Excel / CSV workbook<br/>one sheet per PDF page"] --> PARSE["Deterministic parser<br/>segment blocks · find labels<br/>normalise units once"]
  PARSE --> EXJ["extraction.json<br/>candidates · source cell · confidence tier"]
  LLM["LLM fallback<br/>only what the parser can't classify"] -.-> EXJ
  OVR["Per-tab overrides<br/>checked in beside the workbook"] --> EXJ
  HUM["Human fixes once<br/>result frozen"] -.-> EXJ
  EXJ --> TIER{"confidence tier"}
  TIER -->|Certain| HA["hard assertion"]
  TIER -->|Inferred| WA["assertion with wider tolerance"]
  TIER -->|Contextual| NOTE["note only"]
  TIER -->|Unusable| CR["conversion report only"]
  HA & WA --> SPEC["spec.json<br/>passes validateSpec"]
  BIND["Page binding by content<br/>→ pdfPageOverride"] -.-> SPEC
  SPEC --> APP["Spec driven comparison workspace"]
  SPEC -.-> CLIS["pdfsuite spec command"]
  class PARSE,EXJ,LLM,OVR,HUM,TIER,HA,WA,NOTE,CR,SPEC,BIND,CLIS plan
```

[Open as SVG](architecture/18-planned-spec-conversion.svg)
