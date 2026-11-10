---
type: Reference
description: "How the product works, in diagrams — the app shell, each workspace tab, the compare engine and the CLI commands as built, and the target the records rule. Parts 1–3 drawn from the code; Part 4 from the records."
---

# Architecture — PDF Comparison Suite

**What this is.** The app and the `pdfsuite` CLI, drawn from the code as it stands
(verified 2026-10-14; re-checked 2026-10-18), and — in Part 4 — the target the Standing
Records rule, which is **not built**. Every box names the real file or function, or the
record that rules it. Where [`README.md`](../README.md) disagrees with the code, these
diagrams follow the code. Where the code disagrees with a record, the record wins
([SR-LAW-0](../records/0002_LAW-0-authority.md)) and the gap is a work item in
[`work/OPEN-WORK.md`](../work/OPEN-WORK.md).

**Legend.** Solid border = built · dashed = behind a feature flag · dotted = ruled, not built.

**Standalone SVGs.** Every diagram is also a self-contained SVG in [`docs/architecture/`](architecture/), linked under each diagram. They are rendered from the Mermaid blocks in this file — re-render them when a block changes.

**Contents**

- Part 1 · High level — [System overview](#system-overview) · [UI shell and state](#ui-shell-and-state) · [Feature flags](#feature-flags) · [Compare engine](#compare-engine-comparepage)
- Part 2 · Each tab — [Compare](#compare--loading-scanning-and-navigation) · [Side by side](#side-by-side) · [Overlapping](#overlapping) · [View report](#view-report) · [Page pairing](#page-pairing) · [Export and Import ZIP](#export-menu-and-import-zip) · [Specification](#spec-driven-comparison) · [Inspect](#inspect) · [Compare · Many](#batch-compare)
- Part 3 · CLI — [Build and engine reuse](#how-the-cli-is-built-and-reuses-the-engine) · [`generate`](#pdfsuite-generate) · [`compare`](#pdfsuite-compare) · [`spec`](#pdfsuite-spec) · [Verdict rules: app vs CLI](#verdict-rules-app-vs-cli)
- Part 4 · Target — [Packages and surfaces](#packages-and-surfaces-l3--l4) · [One compare core](#one-compare-core) · [The three output files](#the-three-output-files) · [The command line](#the-pdfsuite-command-line) · [Create, sync and hosting](#create-sync-and-hosting) · [Specification, end to end](#spec-driven-comparison-end-to-end) · [Testing](#testing) · [The build order](#the-build-order)

---

# Part 1 · High level

## System overview

- **One engine, no React.** [`src/services`](../packages/ui/src/services/) holds the comparison logic; the four workspaces reach it through the Zustand stores.
- **The spec feature is a package** — [`@pdfsuite/spec`](../packages/spec/README.md), since **W-32** (2026-11-06): its own engine, store, view and CLI command behind three barrels. The app imports the package name; the host loads `@pdfsuite/spec/cli` at run time.
- **The Node CLI imports the same engine files unchanged**, with a small DOM shim that swaps the browser canvas for `@napi-rs/canvas`.
- **There is one CLI, the Node one** — the product is TypeScript ([SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md)).
- **Where this is heading:** [Part 4](#part-4--target--what-the-records-rule-not-yet-built) — one core in `@pdfsuite` packages, called by the app and the CLI alike (L3, L4).

```mermaid
flowchart LR
  subgraph BROWSER["Browser app · Vite + React 18"]
    SHELL["App.tsx<br/>workspace tabs + export corner"]
    WS1["Compare"]
    WS2["Specification"]
    WS3["Inspect"]
    WS4["Compare · Many"]
    STORES["Zustand stores<br/>compare · annotation · ignore · region<br/>measure · batch"]
    SHELL --> WS1 & WS2 & WS3 & WS4
    WS1 & WS3 & WS4 --> STORES
  end
  subgraph ENGINE["Engine · src/services · no React"]
    CMPS["pdfCompare.ts<br/>loadPdf · comparePage"]
    CHG["changes.ts<br/>buildChanges · verdict"]
    PP["pagePairs.ts<br/>sequentialPairs"]
    ELM["pdfElements.ts<br/>renderElements"]
    EXP["exportReport · exportMarkdown<br/>exportZip · importZip · batchExport"]
  end
  subgraph SEALED["Sealed feature · packages/spec"]
    SIDX["index.ts<br/>SpecTestView · specStore"]
    SENG["engine.ts<br/>runSpec · validateSpec<br/>readWorkbook · sheetToSpec"]
    SIDX --> SENG
  end
  subgraph LIBS["Libraries"]
    PDFJS["pdfjs-dist<br/>parse · render · text"]
    PXM["pixelmatch"]
    DIF["diff"]
    ZL["jszip + pdf-lib"]
  end
  FLAGS["flag.env"] -->|"Vite plugin<br/>virtual:feature-flags"| SHELL
  WS2 --> SIDX
  STORES --> CMPS & CHG & PP & ELM & EXP
  CMPS --> PDFJS & PXM & DIF
  SENG --> PDFJS & ZL
  ELM --> PDFJS
  EXP --> ZL
  subgraph CLIS["Command line · cli/"]
    NODE["Node pdfsuite 1.0.0<br/>packages/cli/dist/index.js"]
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

- **The screens are a package** since **W-33** (2026-11-06): [`@pdfsuite/ui`](../packages/ui/README.md). This repository's `src/` is `main.tsx` and nothing else — the smallest possible host, so anything that breaks when the screens move is caught here first ([SR-NPM-PACKAGES](../records/0107_NPM-packages.md) decision 7, L4 decision 5: `npm update` has to be able to deliver a new screen).
- **`<PdfSuiteApp config={…}/>` is the whole surface:** `tabs`, `initialTab` and `flags`, all optional. Nothing in it can change what a comparison *finds* — that would be a decision living in the UI package, which L3 forbids.
- **The workspace is plain `useState`** in [`PdfSuiteApp.tsx`](../packages/ui/src/PdfSuiteApp.tsx); each workspace owns one store, and Compare also uses the annotation, ignore and region stores.
- **Two effects drive Compare:** compute the visible page; run a full scan automatically when the larger PDF has 60 pages or fewer.
- **Stores meet in two places only:** *Many*'s "Open" (`adoptPair`, which also switches the scope to *One*) and Import ZIP (`adoptImported` + annotation `replaceAll`).
- **Feature flags are configuration, not a build-time edit.** The package owns the list and the defaults (all on); a host hands in what it wants changed. `flag.env` is still how *this* app does it: the shell reads the virtual module its own `vite.config.ts` synthesises and parses it with the package's `parseFlagEnv`. A package cannot read that module — the plugin is the host's.
- **Three tabs, in this order: Compare · Specification · Inspect** — ruled by Siddharth on 2026-11-09 (**W-06**). Most-used first, and the order a tester reaches for them: a golden PDF exists → Compare; only a spec exists → Specification; dig into one PDF → Inspect.
- **Comparing many pairs is Compare's *Many* scope**, not a fourth tab: it is the same question asked of a folder, and `compareMany` calls the same `comparePair`. A *One · Many* switch sits in Compare's sub-header, behind `FEATURE_BATCH_COMPARE`; "Open" on a pair loads it and switches to *One*. The internal ids keep the name `batch` — the store, the view, the CSS and the flag key — because renaming the key would silently reset an existing `flag.env`.

```mermaid
flowchart TB
  classDef flag stroke-dasharray: 6 4
  SHELL["src/main.tsx — the app<br/>reads flag.env, renders PdfSuiteApp"] --> HEADER
  subgraph HEADER["@pdfsuite/ui · PdfSuiteApp.tsx"]
    TABS["Workspace tabs, from config<br/>Compare · Specification · Inspect"]
    SCOPE["Compare's scope switch<br/>One · Many — flagged"]
    RIGHT["Export corner<br/>Compare · One: Import ZIP + ExportMenu<br/>Compare · Many: BatchExportMenu<br/>Specification: SpecExportMenu<br/>Inspect: nothing"]
  end
  TABS -->|"ws state"| CWS & SWS & IWS & BWS
  CWS["Compare<br/>mode tabs: Side by side · Overlapping · View report<br/>SummaryChip · PageNavigator · PageStrip · PagePairing"]
  SWS["SpecTestView<br/>(@pdfsuite/spec)"]
  IWS["MeasureView → inspectPage"]
  BWS["BatchView"]
  CWS --> CS[("compareStore<br/>sides · pairs · pageCache · summary<br/>mode · pixelThreshold · offsetThresholdIn · zoom")]
  CWS --> AS[("annotationStore<br/>comment pins")]
  CWS --> IS[("ignoreStore<br/>differences marked expected")]
  CWS --> RS[("regionStore<br/>ignored regions, kept per golden")]
  SWS --> SS[("specStore")]
  IWS --> MS[("measureStore")]
  BWS --> BS[("batchStore")]
  BWS -->|"Open in Compare<br/>adoptPair"| CS
  EF1["Effect: computePage(currentPage)<br/>reruns on page, threshold or AA change"] --> CS
  EF2["Effect: computeAll()<br/>auto when 60 pages or fewer"] --> CS
  class BWS flag
```

[Open as SVG](architecture/02-ui-shell-and-state.svg)

Code: `packages/ui/src/PdfSuiteApp.tsx` · `packages/ui/src/store/*.ts` · `src/main.tsx`

## Feature flags

- **`flag.env` → Vite plugin → `virtual:feature-flags`** ([`vite.config.ts`](../vite.config.ts)).
- **[`packages/ui/src/flags.ts`](../packages/ui/src/flags.ts) defaults every flag to on.** A missing key keeps the default; an unrecognised value warns and keeps the default.
- **Dev reloads the browser on save;** a production build bakes the values in.
- **Flags hide UI features and never change a result** — a ratified UI-only step ([SR-SURFACE-PARITY](../records/0106_SURFACE-parity.md)).

```mermaid
flowchart LR
  FE["flag.env<br/>KEY=value"] --> VP["vite.config.ts plugin<br/>parseFlagEnv"]
  VP --> VM["virtual:feature-flags"]
  VM --> FT["packages/ui/src/flags.ts read()<br/>true/1/on/yes/enabled → on<br/>false/0/off/no/disabled → off<br/>missing or typo → default (on)"]
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
| batchCompare | `FEATURE_BATCH_COMPARE` | false | Compare · Many workspace tab |
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

Code: [`packages/core/src/pdfCompare.ts`](../packages/core/src/pdfCompare.ts) · [`packages/compare/src/changes.ts`](../packages/compare/src/changes.ts) · [`packages/core/src/types.ts`](../packages/core/src/types.ts)

> **Watch.** Under Node, `loadPdf` sets no `standardFontDataUrl`. Text in non-embedded standard fonts may not be drawn, and the CLI hides that warning. CLI pixel results can therefore differ from the browser's. One opener with bundled fonts is **W-13** ([SR-PDF-SUPPORT](../records/0105_PDF-support.md)).

> **Watch.** Two "changed" rules exist: `pageHasChange` (the page strip and Next change — moved > 0.02 in ≈ 2.9 px) and `summaryPageDiffers` (the verdict — offset > 2 px). A 2.5 px shift fails the report but is skipped by Next change. One rule, `pageVerdict`, is **W-27** ([SR-COMPARE](../records/0111_COMPARE.md) decision 3).

---

# Part 2 · Each tab in detail

## Compare — loading, scanning and navigation

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

Code: `PdfUploadSlot.tsx` · `PageNavigator.tsx` · `PageStrip.tsx` · `SummaryChip.tsx` · `packages/ui/src/store/compareStore.ts`

> **Watch.** Nothing cancels a scan in flight. If a file is swapped mid-scan, the old result can land on the new pair.

## Side by side

- **Built from `pageCache[currentPage]` and `buildChanges`;** changes marked "expected" — one at a time, or by **ignored region** — are filtered out first.
- **Page highlight ↔ Changes row ↔ Diff word** are linked by hover.
- **"Mark expected" stores `changeRef(page, key)`** — change text plus a coarse vertical band — so it survives a recompute.
- **An ignored region is an area, not a difference:** drawn on the page, labelled ("holdings table"), kept against the golden so it carries to the next candidate; its changes are listed apart in the report. Neither kind of ignore changes pass/fail ([SR-SURFACE-PARITY](../records/0106_SURFACE-parity.md)).

```mermaid
flowchart LR
  classDef flag stroke-dasharray: 6 4
  PC["pageCache[currentPage]"] --> BC["buildChanges(pc, offsetThresholdIn)"]
  IS[("ignoreStore")] -->|"ignoredRefsFor(page)"| FL["remove changes<br/>marked expected"]
  RS[("regionStore<br/>regions per golden")] -->|"partitionByRegion"| FL
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
  DR["DataRegionLayer<br/>draw and label an area"] --> RS
  HL <-->|"hover links page ↔ row ↔ word"| D1
  AN["AnnotationLayer<br/>click a page to pin a comment"] --> AS[("annotationStore<br/>x, y as a fraction of the page")]
  ZM["contentZoom 0.25–6×"] --> HL
  class AN flag
```

[Open as SVG](architecture/06-tab-side-by-side.svg)

Code: `packages/ui/src/components/compare/ContentCompareView.tsx` · `AnnotationLayer.tsx` · `DataRegionLayer.tsx` · `packages/ui/src/store/ignoreStore.ts` · `packages/ui/src/store/regionStore.ts` · `packages/ui/src/store/annotationStore.ts`

> **Watch.** Restyled text is shown here but does not change the page verdict; neither does marking a change or a region expected. Whether accepted differences become a core-side `expected.json` ledger is open on **W-07**.

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

Code: `packages/ui/src/components/compare/LayoutCompareView.tsx` · `MeasureOverlay.tsx` · `changes.ts › heatmapBoxes`

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
  SUM -->|yes| BH["buildHtmlReport(summary, meta,<br/>pageCache, ignored, regions)"]
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

Code: `packages/ui/src/components/compare/CompareReport.tsx` · [`packages/ui/src/services/exportReport.ts`](../packages/ui/src/services/exportReport.ts)

> **Verdict.** Fixed, not adjustable: a page fails if it differs at all.

> **Target.** This builder and the CLI's writer become one `buildReportHtml(result)` in `@pdfsuite/core`, rendering only from `result.json` — [SR-REPORT-HTML](../records/0108_REPORT-html.md), **W-27**.

## Page pairing

- **The unit of comparison is a pair, not a page number.** Page 5 against page 5 is only right while both documents hold the same pages in the same order; one inserted or dropped page makes every later comparison meaningless.
- **`pairs[]` is the navigation sequence** and `currentPage` indexes into it. It defaults to the straight 1:1 list, so nothing changes until someone pairs the pages.
- **Pairing is done by hand, and nothing is inferred.** "Pair pages" opens a list of rows; clicking either side opens that PDF in a page picker, scrollable, with a size control. "No matching page" marks a page added or removed. Done applies it; the button then reads "Revert to page by page comparison".
- **An automatic aligner exists in `pagePairs.ts` and is deliberately unwired** — a suggestion that is subtly wrong is worse than no suggestion in a tool whose job is to be believed. It is kept, tested, and tree-shaken out of the build.
- **The editor warns rather than prevents:** a page used in two pairs is compared twice, and says so.
- **Target:** the same `PagePair[]` becomes the CLI's `--pages "1:1,2:-,3:2"` — one pairing input to one core ([SR-COMPARE](../records/0111_COMPARE.md) decision 2, **W-27**, **W-09**).

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

[Open as SVG](architecture/17-page-pairing.svg)

Code: [`packages/compare/src/pagePairs.ts`](../packages/compare/src/pagePairs.ts) · `packages/ui/src/components/compare/PagePairing.tsx` · `packages/ui/src/store/compareStore.ts`

## Export menu and Import ZIP

- **Every export reads the same inputs:** summary, page cache, ignored list, regions, annotations. Only HTML is always on.
- **The ZIP holds the HTML report and both original PDFs.** Comments become real PDF `/Text` annotations; page content is untouched.
- **Import reverses it:** PDFs found by `golden__` / `candidate__` prefix, comments read back from the annotations, both sides loaded into Compare.
- **Ratified UI-only** ([SR-SURFACE-PARITY](../records/0106_SURFACE-parity.md)): Markdown, CSV and the ZIP bundle stay in the app; the CLI writes the three files only. **Target:** the Export menu also offers `result.json`, `report.html` and `manifest.json` from the same builders as the CLI (**W-27** DoD 5).

```mermaid
flowchart LR
  classDef flag stroke-dasharray: 6 4
  SRC["summary · pageCache · ignored · regions<br/>annotations · both docs"] --> E1 & E2 & E3 & E4
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

Code: `ExportMenu.tsx` · `ImportBundleButton.tsx` · [`packages/ui/src/services/exportZip.ts`](../packages/ui/src/services/exportZip.ts) · [`packages/ui/src/services/importZip.ts`](../packages/ui/src/services/importZip.ts) · `exportMarkdown.ts`

## Specification

- **The workbook is shown as a workbook** since **W-46** (2026-11-09): `@sheetpane/grid`'s `<sheetpane-excel>` and `<sheetpane-errors>`, with W-02's refusals and W-04's checks marked on the cells they came from. Arpit asked for this rather than a list — *a view that looks and feels like the sheet, with wrong and right highlighted*.
- **Two review layers, not one list.** `validation` and `pdf` are replaced independently, so re-running a check leaves the refusals alone; the panel grows an **All · Validation · PDF check** switch of its own. Passes and not-checked cells are quiet until the panel's *On sheet* switch is on — a run makes hundreds of them.
- **The mapping makes no judgment** ([`sheetMarks.ts`](../packages/spec/src/sheetMarks.ts)): a mark's severity is the one the engine already decided, and a finding with no cell to land on is dropped rather than guessed at. Each result mark carries `meta: { page, box, elementId }`, which is the whole of the sheet ↔ PDF correspondence — a cell selects its element on the page, and an element's cell button scrolls the sheet to that row.
- **Nothing is uploaded:** sheetpane reads the file in the tab. That is what lets a real workbook be shown without breaking *real spec workbooks never leave the spec machine*.

> **A package, since W-32 (2026-11-06).** Everything below is `@pdfsuite/spec`
> (`packages/spec/`) behind three barrels: the package name for the app, `/engine` for a
> headless caller, `/cli` for the host's command loader. It was sealed to a second machine
> until Siddharth's ruling of 2026-11-03 (W-32, option B), then ordinary code here, and now
> a package this repository publishes. Real spec workbooks still never leave the spec
> machine — a rule about data, not code. See
> [`packages/spec/README.md`](../packages/spec/README.md), `sh scripts/check-boundary.sh`
> and `sh scripts/check-packages.sh`.

- **No golden PDF:** a spec lists each page's expected elements in inches, points or millimetres from the top-left ([`spec-standard.md`](../spec-standard.md)).
- **The workbook is the input; the JSON is what it becomes.** An `.xlsx` is read in the browser as **Template v2** — Pages List, Settings, Lists, one sheet per page — and compiled to a spec in which every value names its sheet and cell. The Pages List says which sheet describes which page, so there is nothing to pair by hand.
- **The validation report comes before any PDF is opened** — three severities, each line with its cell, how many rows became checks, and every accepted assertion in plain words. An error on the file or the Pages List stops the run; an error on one element only removes that element.
- **A legacy nested workbook is a migration input, never a spec.** It comes back as a **draft v2 workbook** with the inferred cells amber and the unreadable ones red, for a person to confirm. No guesswork reaches a result.
- **Which PDF page is which is decided by the Pages List, not by counting.** Each page is found by its own identifying text; an Optional page that is absent is noted, a Conditional one is never a failure, a Required one is an error, a variant group must match exactly one, a page out of order is a warning and is still checked, and a repeating page is counted against its Repeats range.
- **Each element is checked on its own,** with expected-vs-actual values, the **workbook cell** the expectation came from, and a box on the page. A limit of the reading — no text layer, an unnameable font, a single-line paragraph — is `unverifiable`, not a failure.
- **A run writes three files** — `result.json`, `report.html`, `manifest.json` — from one builder each, so `pdfsuite spec` (**W-11**) emits the same bytes. `result.json` is the answer; the HTML and the exit code are derived from it.
- **"One page" mode checks one spec page against any PDF page** — for a spec that says `"page": 1` and describes a page further in.
- **The ruled target** — intake, check, three files, the same from the tab and `pdfsuite spec` — is drawn in [Part 4](#spec-driven-comparison-end-to-end).

```mermaid
flowchart TB
  PDF["Generated PDF"] --> LP["loadPdfFile → loadPdf<br/>+ SHA-256 of the bytes"]
  SJ["Spec .json"] --> LS["loadSpecFile"]
  XL[".xlsx"] --> RSW["readSpecWorkbook<br/>@sheetpane/import · SHA-256 · keeps the bytes"]
  RSW --> ISV2{"Pages List?"}
  ISV2 -->|"no — legacy"| RL["readLegacy<br/>merged labels from declared ranges<br/>prose → Value / Unit / From<br/>read · inferred · unreadable"]
  RL --> DRAFT["writeDraftWorkbook<br/>draft v2 .xlsx · amber + red · Check? = Note"]
  DRAFT -.->|"a person confirms it in Excel"| XL
  ISV2 -->|"yes"| RT["readTemplate<br/>Lists · Settings · Pages List · page sheets<br/>one cell, one fact · no default unit or edge"]
  RT --> CS["compileSpec<br/>every assertion with source {sheet, cell}<br/>every edge → a distance from the top-left<br/>+ coverage: checked · noted · excluded · unreadable"]
  RT & CS --> BV["buildValidationReport<br/>error · warning · info, each with its cell<br/>+ every assertion in plain words"]
  BV --> VP["SpecValidation · every accepted row in plain words"]
  BV --> MK["sheetMarks · findings → marks on their own cells<br/>severity as the engine decided it · no judgment here"]
  MK --> SHEET["SheetView · @sheetpane/grid<br/>&lt;sheetpane-excel&gt; + &lt;sheetpane-errors&gt;<br/>layers: validation · pdf"]
  BV -->|"error on the file or the Pages List"| STOP["the run stops"]
  LS --> VS["validateSpec · shape only"]
  LP & VS & CS --> SS[("specStore")]
  SS -->|"run()"| RS["runSpec(pdf, spec, options)"]
  RS --> BIND["bindPages<br/>each page found by its identifying text<br/>Optional · Conditional · Required · variants<br/>order · repeats · uncovered pages"]
  BIND --> PF["pageFindings<br/>error · warning · note"]
  BIND --> G
  subgraph PERPAGE["for each bound page"]
    G["getPage · viewport applies /Rotate and the crop box"] --> X1["extractItems<br/>text in points, top-left<br/>+ font via commonObjs<br/>+ fill colour matched by position"]
    X1 --> GL["groupLines · by baseline, split on a column gutter"]
    G --> X2["extractImages<br/>operator list · CTM · form /Matrix"]
    G --> RPG["renderPage → PNG"]
    GL & X2 --> DIS{"element.type"}
    DIS --> CT["checkText<br/>wording (exact, or a note)<br/>· the edges it states · font size<br/>· font · colour by ΔE"]
    DIS --> CI["checkImage · edges · width · height"]
    DIS --> CTB["checkTable · edges · width · rows/cols"]
    DIS --> CP["checkParagraph · edges · line spacing"]
  end
  CT & CI & CTB & CP --> MK2["sheetMarks · each check on the cell it came from<br/>meta: page · box · elementId"]
  MK2 --> SHEET
  SHEET <-->|"a cell selects its element · an element its cell"| OVR["the page, with its boxes"]
  PS["pageSizeResult · pinned → error, else warning"] -.-> ER
  ANC["Anchors · locate by a nearby label"] -.-> DIS
  TOL["Tolerances: the row's own → Settings → SR-CONSTANTS,<br/>in the row's own unit"] -.-> DIS
  CT & CI & CTB & CP --> ER["ElementResult<br/>pass · fail · not-found · warning · unverifiable<br/>every check naming its cell"]
  ER & PF --> REP["SpecReport<br/>+ coverage · + the pair tested"]
  REP --> VIEW["SpecTestView<br/>findings band · dashed expected box · actual box"]
  REP --> RJ["buildResultJson<br/>pdfsuite.result/1 · byte-stable outside run"]
  RJ --> RH["buildReportHtml · no script, self-contained"]
  RJ & RH --> MAN["buildManifest · written last · no timestamp"]
  RJ --> FIX["buildFixList · Markdown · UI only"]
  RJ & RH & MAN --> ZIP["SpecExportMenu → the three files (.zip)"]
```

[Open as SVG](architecture/10-spec-driven-comparison.svg)

Code, all under [`packages/spec/src/`](../packages/spec/README.md): `index.ts` · `engine.ts` · `SpecTestView.tsx` · `SpecValidation.tsx` · `specStore.ts` · `specIntake.ts` · `specTemplate.ts` · `specValues.ts` · `specCompile.ts` · `specValidate.ts` · `specLegacy.ts` · `specDraft.ts` · `specCheck.ts` · `specFonts.ts` · `specColour.ts` · `specOutputs.ts` · `cli/` · `types.ts` · `spec.css`

> **Watch.** `@sheetpane/import` declares `engines: node >=22` while `pdfsuite` publishes `node >=20` — a ruling is owed (**W-02** §Hazards). The HTML export inserts `units` unescaped (**W-04** DoD 1). Container fills, image content and rich-text per-word styles are named and unbuilt.

## Inspect

- **One PDF; hover any text run or image to outline it, click to select it.**
- **Position** gives the distance to all four page edges in inches, with guide lines. **Font & paragraph** (text only) gives font, size, weight, style and line height.
- **Every number comes from `inspectPage` in `@pdfsuite/core`** since **W-28** (2026-11-06). It used to be computed in `MeasureView.tsx`'s JSX, which meant the CLI had nothing to call — the component now holds only hit-testing and drawing ([SR-INSPECT](../records/0114_INSPECT.md) decision 1, L3).
- **`pdfsuite inspect <file.pdf> [--page n] --out <dir>`** writes the same three files from the same functions; [`inspect-parity.ts`](../packages/cli/verify/inspect-parity.ts) proves the two `result.json` are identical outside `run`.
- **Units, once:** inches for positions and distances, points for font sizes, measured from the page's top-left — converted in the core and recorded in `result.json`'s `policy` so a reader never has to ask.
- **What is not stated is not guessed:** a font pdf.js cannot resolve is *not stated*, and so is the weight that would have been read off its name; a page with no text layer says so rather than looking empty.
- **No export from the tab.** Each page renders when first opened and is then cached.

```mermaid
flowchart TB
  F["PDF file or bundled sample"] --> L["measureStore.loadPdfFile"]
  L --> EP["ensurePage(currentPage)<br/>skips if already rendering"]
  EP --> R1
  subgraph RE["renderElements(pdf, i) · @pdfsuite/core"]
    R1["render at scale 2 → PNG"] --> R2["getTextContent<br/>runs in points, top-left"]
    R2 --> R3["resolveFont → name · bold · italic"]
    R1 --> R4["operator list → image boxes<br/>Form XObject /Matrix applied"]
  end
  R3 & R4 --> EPG["ElementsPage<br/>dataUrl · widthPt · heightPt · elements"]
  EPG --> IP["inspectPage · @pdfsuite/core — pure<br/>inches from all four edges · font or 'not stated'<br/>adjacentLine → line height · leading ratio"]
  IP --> MV["MeasureView · hit-testing and drawing only"]
  IP --> CLI["pdfsuite inspect"]
  MV --> HV["mousemove → toPoint in pt<br/>→ elementAt → hover outline"]
  HV --> SEL["click → selected element<br/>panel reads its measurement by id"]
  CLI --> OUT["result.json · report.html · manifest.json<br/>kind: inspect · no verdict"]
```

[Open as SVG](architecture/11-inspect-pdf.svg)

Code: `packages/ui/src/components/measure/MeasureView.tsx` · `packages/ui/src/store/measureStore.ts` · [`packages/core/src/pdfElements.ts`](../packages/core/src/pdfElements.ts)

> **Watch.** Line height and edge distances are computed inside `MeasureView.tsx`, so no CLI can give the same numbers today ([SR-SURFACE-PARITY](../records/0106_SURFACE-parity.md) Inspect rows). Weight comes from the font *name*, so stripped names read "Regular" — **W-15**.

## Compare · Many

- **Add many PDFs to each side and pair them** — automatically by order or row by row. Pairs run in order, a page at a time.
- **Raw pixel buffers are dropped once a page is scored;** only PNG data URLs are kept.
- **"Open in Compare" hands the loaded documents** to the Compare workspace.
- **Target:** the tab becomes Compare's *Many* scope (**W-06**, names owed Arpit's confirmation) and its loop becomes `compareMany` in `@pdfsuite/compare`, the function `pdfsuite compare --each` also calls ([SR-BULK-COMPARE](../records/0113_BULK-compare.md), **W-27**, **W-09**).

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

Code: `packages/ui/src/components/batch/BatchView.tsx` · `BatchExportMenu.tsx` · `packages/ui/src/store/batchStore.ts` · [`packages/ui/src/services/batchExport.ts`](../packages/ui/src/services/batchExport.ts)

> **Flag.** `FEATURE_BATCH_COMPARE=false` in `flag.env` now, so this tab is hidden.

---

# Part 3 · CLI

> **Status.** `pdfsuite` 2.0.0 as built. [SR-CLI](../records/0115_CLI.md) is mostly in: one pair per command with `--each` for many (**W-09**), the spec check (**W-11**), and the host that loads a command from its own package (**W-30**). `pairs.json`, folder inputs, the `pairs` command and the JUnit / CSV / Markdown writers are gone. Still owed: one console shape (**W-08**) and whether exit 2 splits into usage 2 / runtime 3 (**W-07**). The target is drawn in [Part 4](#the-pdfsuite-command-line).

## How the CLI is built and reuses the engine

- **`pdfsuite` is a host** since **W-30**: `packages/cli`, published as `@pdfsuite/cli`, depending on `@pdfsuite/core` and `@pdfsuite/agents` — and deliberately **not** on `compare` or `spec`. `scripts/check-packages.sh` fails a build where `packages/cli/src` imports either.
- **A command arrives with its package.** `pdfsuite compare` resolves `@pdfsuite/compare/cli` with `createRequire`, from the working directory first and from the host's own location second, and the module registers its own flags and help. Missing → exit 2 with the `npm i` to run, and still listed by `--help`. A version that is not the host's → exit 2, both numbers printed ([SR-NPM-PACKAGES](../records/0107_NPM-packages.md) decisions 3–4).
- **Two bundles, so two rules.** `createRequire` cannot resolve a TypeScript source, so `@pdfsuite/compare` builds `dist/cli.js`; and a class the host exports would be a *different class* inside that bundle, so `EXIT`, `ToolError` and `fileFromPath` live in `@pdfsuite/core/node` — shared by both — and a tool error is recognised by a brand string rather than by `instanceof`.
- **esbuild bundles each one,** from the shared [`scripts/bundle.mjs`](../scripts/bundle.mjs): pdf.js's legacy build aliased in from the repo-root `node_modules`, the worker copied beside the output, `@napi-rs/canvas` left external.
- **The host imports nothing from the app.** `platform/engine.ts` survives only as the verify suites' seam: it re-exports what they need from `core` with the DOM shim already installed. The spec feature went with **W-32**, the compare builders with **W-30**.
- **`compare` and `spec` are loaded; `generate` and `inspect` are built in.** `inspect` is built in because it needs only `@pdfsuite/core`, which the host already depends on — there is no `@pdfsuite/inspect` to install (SR-NPM-PACKAGES decision 3).
- **Options resolve flag › config file › default**, and the host owns `--config`: a command module is *handed* its section rather than reading the file, so the two cannot disagree. Exit codes: 0 OK · 1 the PDFs regressed · 2 the tool or job is broken.

```mermaid
flowchart TB
  subgraph BUILD["Build · scripts/bundle.mjs · esbuild"]
    B1["packages/cli/src/index.ts"] --> B2["alias pdfjs-dist → legacy build<br/>?url plugin for the worker path"]
    B2 --> B3["packages/cli/dist/index.js · bin pdfsuite"]
    B4["packages/compare/src/cli/index.ts<br/>packages/spec/src/cli/index.ts"] --> B2
    B2 --> B5["each package's dist/cli.js<br/>exports: ./cli"]
  end
  RUNX["pdfsuite COMMAND"] --> GLB["global options<br/>--config · --no-config · -v"]
  GLB --> CFG["loadConfig<br/>find pdfsuite.config.json walking up<br/>reject unknown keys · expand ${ENV}"]
  CFG --> PICK["pick(): flag › config › default"]
  PICK --> GEN["generate · inspect<br/>built in"] & DISC["compare · spec · loaded by name"]
  DISC --> RES["createRequire<br/>cwd, then beside the host"]
  RES -->|"found, same version"| REG["command.register(program, host)<br/>its own flags and help"]
  RES -->|"missing"| X2A["exit 2 + the npm i to run"]
  RES -->|"another version"| X2B["exit 2 + both numbers"]
  REG --> MOD["@pdfsuite/compare/cli — comparePair<br/>@pdfsuite/spec/cli — runSpec"]
  MOD --> SHIM["dom-shim<br/>canvas · ImageData · Image<br/>DOMMatrix · Path2D via @napi-rs/canvas"]
  MOD --> LOGF["pdf-log filter<br/>hides pdf.js font warnings unless -v"]
  GEN & MOD --> EXIT["exit codes<br/>0 OK · 1 comparison failed · 2 tool error"]
  X2A & X2B --> EXIT
```

[Open as SVG](architecture/13-cli-build-and-engine.svg)

Code: `packages/cli/src/index.ts` · `packages/cli/src/host.ts` · `packages/cli/src/core/discover.ts` · `packages/compare/src/cli/index.ts` · `packages/spec/src/cli/index.ts` · `packages/cli/src/platform/dom-shim.ts`

> **Watch.** Commander exits 1 on bad arguments — the "PDFs regressed" code. The help text promises 2.

## `pdfsuite generate`

- **POSTs each `*.json` payload to the render API and saves the PDF.** Defaults assume a slow API: 4 in flight, 120 s timeout.
- **Retries only what a retry can fix:** 5xx and network errors. Timeouts only with `--retry-on-timeout`; 4xx never.
- **Writes `manifest.json`** (hashes, timings, redacted URL). Any failed document → exit 2, so a partial run never looks like a pass.
- **Ratified CLI-only** ([SR-SURFACE-PARITY](../records/0106_SURFACE-parity.md)): it runs in CI against an API with credentials; a browser would expose them and meet CORS.

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

Code: [`packages/cli/src/commands/generate.ts`](../packages/cli/src/commands/generate.ts) · `packages/cli/src/core/manifest.ts` · `packages/cli/mock-api/server.js`

## `pdfsuite spec`

- **The same functions as the Spec tab**, reached through `packages/spec/src/engine.ts` and
  re-exported once in `packages/cli/src/platform/engine.ts`. The command resolves two files, calls
  them, and writes what they return — it decides nothing about a PDF itself (SR-LAW-3).
- **The spec is validated before the PDF is opened.** A blocking error stops the run with
  exit 2; element-level errors remove those rows and say so beside the verdict, because a
  PASS over a spec that is missing rows is the one outcome worth refusing to hide.
- **`--validate-only`** answers one question — does this spec read? — and exits 2 when any
  row is refused, so a pipeline can gate on the spec alone.
- **Three files, one builder each**, the same ones the tab exports: `result.json` is the
  answer, `report.html` and the exit code are derived from it (SR-REPORT-JSON decision 7).

```mermaid
flowchart TB
  A["pdfsuite spec &lt;spec&gt; &lt;pdf&gt; --out &lt;dir&gt;"] --> K{"spec kind"}
  K -->|".xlsx"| RW["readSpecWorkbook → readTemplate → compileSpec"]
  K -->|".json"| VS["validateSpec · shape only"]
  K -->|"anything else"| X2["exit 2 · refused by name"]
  RW --> LEG{"Pages List?"}
  LEG -->|"no"| XL["exit 2 · convert it in the app, confirm the draft"]
  LEG -->|"yes"| BV["buildValidationReport · printed with every cell"]
  BV -->|"blocking"| X2B["exit 2"]
  BV -->|"--validate-only"| VO["exit 0, or 2 if any row is refused"]
  BV & VS --> RUN["runSpec · Pages List binding, --pages overrides"]
  RUN --> R1["buildResultJson → result.json"]
  R1 --> R2["buildReportHtml → report.html"]
  R1 & R2 --> R3["buildManifest → manifest.json · written last"]
  R1 --> EX["exit = summary.exitCode · 0 pass · 1 fail"]
```

[Open as SVG](architecture/26-cli-spec.svg)

Code: [`packages/spec/src/cli/run.ts`](../packages/spec/src/cli/run.ts) ·
[`packages/cli/src/platform/engine.ts`](../packages/cli/src/platform/engine.ts) ·
`packages/cli/verify/spec-cli.ts` runs the built binary against the fictional fixture.

> **Watch.** `@sheetpane/import` declares `engines: node >=22` while `pdfsuite` publishes
> `>=20`; this command is what makes that bite, and the ruling is owed (**W-02** §Hazards).
> Until **W-30**, `spec` lives in the one `pdfsuite` binary rather than being loaded from
> `@pdfsuite/spec`.

## `pdfsuite compare`

- **One pair per command** since **W-09** (`pdfsuite` 2.0.0): `pdfsuite compare <golden.pdf> <candidate.pdf> --out <dir>`, and the exit code is that pair's verdict. A command that does one thing composes — a matrix in CI, a single pair re-run by hand after a fix.
- **`--each <golden-dir> <candidate-dir>`** runs every pair in one process, pairing by relative path, and **fails on an orphan**: a golden with no candidate means a document stopped being produced.
- **`--pages "1:1,2:-,3:2"`** states a page pairing, because a page added to the candidate and a page dropped from the golden look identical to any tool. `-` means that page has no partner; what you do not mention is paired 1:1, and nothing is guessed.
- **Three files, always** — `result.json`, `report.html`, `manifest.json` — from the builders the Compare tab calls, so the two surfaces write the same documents ([`compare-parity.ts`](../packages/cli/verify/compare-parity.ts) diffs them byte for byte).
- **Same engine *and* same verdict as the app** — `comparePair` and `pageVerdict` decide both (**W-27**), so they cannot disagree (see [Verdict rules](#verdict-rules-app-vs-cli)).
- **Gone in 2.0.0:** `pairs.json`, the folder-pair arguments, the `pairs` command, and the JUnit, CSV and Markdown writers. A pipeline that read JUnit reads `result.json`.

```mermaid
flowchart TB
  IN["pdfsuite compare<br/>&lt;golden.pdf&gt; &lt;candidate.pdf&gt; --out &lt;dir&gt;"] --> K{"--each?"}
  K -->|"yes"| E1["pdfsUnder both folders<br/>pair by relative path"]
  E1 --> E2["missing · new<br/>named, and they fail the run"]
  E1 --> ONE
  K -->|"no"| CHK{"two readable .pdf files?"}
  CHK -->|"a folder, or not a .pdf"| X2["ToolError → exit 2"]
  CHK -->|"yes"| ONE

  subgraph ONE["one pair"]
    L1["loadPdf · golden and candidate"] --> L2["comparePair<br/>@pdfsuite/compare — the app's loop<br/>--pages, or 1:1"]
    L2 --> L3["pageVerdict per page<br/>missing · one-sided · moved · content · pixels"]
    L3 --> R1["buildCompareResultJson<br/>pdfsuite.result/1 · byte-stable outside run<br/>every knob recorded in policy"]
    R1 --> R2["buildCompareReportHtml<br/>from result.json alone · no script<br/>changed pages imaged"]
    R1 & R2 --> R3["buildManifest · written last · no timestamp"]
  end

  ONE --> OUT["result.json · report.html · manifest.json"]
  E2 --> SUM["result.json across the pairs<br/>kind: compare-many · pairs · orphans"]
  OUT --> EX{"exit code"}
  SUM --> EX
  EX -->|"nothing changed, nothing missing"| X0["0"]
  EX -->|"a page or a pair changed, or a file appeared or vanished"| X1["1"]
  EX -->|"bad arguments, or a PDF that cannot be read"| X2B["2"]
```

[Open as SVG](architecture/15-cli-compare.svg)

Code: [`packages/compare/src/cli/pair.ts`](../packages/compare/src/cli/pair.ts) · `packages/cli/src/core/pairs.ts` · `packages/compare/src/reportHtml.ts` · `packages/compare/src/result.ts` · `packages/cli/fixtures/pairs.json`

> **Watch.** The page loop here is the third copy (Compare store, Batch store, this). `report.json` and the HTML writer differ from the app's exports. All of it is replaced by one core and three builders — **W-27**, then **W-09** rebuilds this command on them.

## Verdict rules: app vs CLI

**Same engine, same judge.** `pageVerdict` in `@pdfsuite/compare` decides both (**W-27**),
so a pair cannot FAIL in the app and PASS in CI — and the strip, Next change and the
verdict no longer disagree with each other either.

| check | app and CLI — `pageVerdict` |
|---|---|
| content match | fails under 99.99% |
| pixels changed | fails over 0.2% |
| max text offset | fails over 2 px (≈0.014 in on Letter) |
| missing page | fails |
| tunable | **no** — the CLI's thresholds were removed; `skipPages` exempts a whole page, visibly |
| restyled text | ignored |

The CLI kept adjustable tolerances for a while after the app dropped them, which meant the
two disagreed about the same pair — and because esbuild strips types without checking them,
the drift went unnoticed until the HTML report crashed. `npm run build` in `packages/cli/` now runs
`tsc --noEmit` first.

**What still disagrees (2026-10-18):** inside the app, the strip's `pageHasChange` (moved
> 0.02 in) and the verdict above; and the pixel sensitivity and anti-aliasing knobs, which
have the same defaults but separate controls on each surface. Both are **W-27**
([SR-SURFACE-PARITY](../records/0106_SURFACE-parity.md)); the knobs end up recorded in
`result.json`'s `policy` block ([SR-REPORT-JSON](../records/0109_REPORT-json.md)).

---

# Part 4 · Target — what the records rule, not yet built

**Source: the Standing Records**, accepted 2026-10-18 — [SR-LAW-3](../records/0005_LAW-3-one-function-ui-and-cli.md),
[SR-LAW-4](../records/0006_LAW-4-how-packages-work.md), [SR-NPM-PACKAGES](../records/0107_NPM-packages.md),
[SR-COMPARE](../records/0111_COMPARE.md), [SR-BULK-COMPARE](../records/0113_BULK-compare.md),
[SR-INSPECT](../records/0114_INSPECT.md), [SR-SPEC](../records/0112_SPEC.md), [SR-CLI](../records/0115_CLI.md),
[SR-REPORT-JSON](../records/0109_REPORT-json.md), [SR-REPORT-HTML](../records/0108_REPORT-html.md),
[SR-MANIFEST](../records/0110_MANIFEST.md), [SR-TESTING](../records/0116_TESTING.md),
[SR-PDF-SUPPORT](../records/0105_PDF-support.md). **None of this is built.** Every box names
its record; the item that builds it is in [`work/OPEN-WORK.md`](../work/OPEN-WORK.md). These
diagrams restate no rule — when a picture and a record disagree, the record is right and the
picture is redrawn.

## The workspace today

- **`packages/*` are npm workspaces** at one version, linked by npm. Nothing else is needed: no bundler aliases, no path mappings, no second tool.
- **Four of them hold code** — `@pdfsuite/core` (open a PDF, read and measure it, the numbers that judge it), `@pdfsuite/compare` (what changed between two of them, and how pages pair), `@pdfsuite/spec` (the rulebook check) and `@pdfsuite/cli` (the host). `agents`, `ui` and `create` are named shells so the graph is real while **W-10**, **W-33** and **W-31** fill them.
- **Everyone imports by name.** `scripts/check-packages.sh` fails a build that reaches into a package by path, lets a package import the app, leaves a package at a different version, or un-pins `pdfjs-dist` — two pdf.js builds in one install is two renderers, which cost a green suite once already.
- **Still in the app:** the report builders in `packages/ui/src/services/export*`, which the CLI's spike reads for the app's richer report — **B-018**, and the last named exception in that check. The spec feature left with **W-32**.

```mermaid
flowchart TB
  subgraph PKGS["packages/ · npm workspaces, one version"]
    CORE["@pdfsuite/core<br/>loadPdf · comparePage · renderElements<br/>constants · types"]
    CMP["@pdfsuite/compare<br/>buildChanges · heatmapBoxes<br/>pagePairs · the page-changed rule"]
    CLI["@pdfsuite/cli → bin pdfsuite<br/>the host: generate, and loading the rest"]
    SPEC["@pdfsuite/spec<br/>intake · compile · validate · runSpec<br/>the tab, the engine, the command"]
    UI["@pdfsuite/ui<br/>every screen + PdfSuiteApp<br/>React as a peer"]
    SHELLS["agents · create<br/>named shells — W-10, W-31"]
  end
  APP["src/main.tsx — the app<br/>reads flag.env, renders PdfSuiteApp"]

  CMP --> CORE
  CLI --> CORE
  UI --> CORE & CMP & SPEC
  SPEC --> CORE
  APP --> UI
  CMP & SPEC -.->|"types only"| CLI
  CLI -.->|"loads /cli at run time"| CMP & SPEC
```

[Open as SVG](architecture/27-workspace.svg)

## Packages and surfaces (L3 · L4)

- **L3 — one function, two surfaces.** Every step that produces a result lives once, in a package; the app and the CLI both import it. What stays on one side is listed and ratified in [SR-SURFACE-PARITY](../records/0106_SURFACE-parity.md).
- **L4 — pdfsuite is everything; a single package is a command line.** `npm create @pdfsuite` gives the web app and the CLI; `npm i @pdfsuite/compare` or `@pdfsuite/spec` alone gives that command for CI. One version across all seven; an upgrade never overwrites what a team changed.
- **Seven packages**, one repository, npm workspaces — **W-29** creates them; **W-44** writes SR-MONOREPO and settles the layout (`apps/web` for today's app, `packages/*` for the seven, room for a PDF viewer, designer and creator). This repository's own app becomes a `create` shell over `ui`.
- **L2 — only open-source, free dependencies**, dev tools included ([SR-LAW-2](../records/0004_LAW-2-open-source-only.md)): npm workspaces over Nx or Turborepo, whose hosted caches are paid.

```mermaid
flowchart TB
  classDef plan stroke-dasharray: 2 3
  subgraph SURF["The two surfaces — same functions (L3)"]
    UI["@pdfsuite/ui<br/>Compare · Compare · Many · Spec · Inspect<br/>React components + PdfSuiteApp"]
    CLI["@pdfsuite/cli<br/>pdfsuite host · console · exit codes · files on disk<br/>built in: inspect · generate · agents init"]
  end
  subgraph DOM["Domain packages — one capability each (L4)"]
    CMP["@pdfsuite/compare<br/>comparePair · compareMany · pairing · pageVerdict<br/>command: compare · compare --each · bin pdfsuite-compare"]
    SPC["@pdfsuite/spec<br/>readSpecWorkbook · compileSpec · validateSpec · runSpec<br/>command: spec · bin pdfsuite-spec"]
  end
  CORE["@pdfsuite/core<br/>openPdf (fonts · CMaps · password) · extraction · inspectCore<br/>document properties · buildResultJson · buildReportHtml · buildManifest · schemas"]
  AG["@pdfsuite/agents<br/>one source → files for Claude · Kiro · Codex · Copilot"]
  CR["@pdfsuite/create<br/>npm create @pdfsuite · --sync · --check"]
  UI --> CMP & SPC & CORE
  CLI --> CORE & AG
  CLI -. "loads when installed" .-> CMP & SPC
  CMP --> CORE & CLI
  SPC --> CORE & CLI
  CR -. "writes a thin shell that depends on" .-> UI
  class UI,CLI,CMP,SPC,CORE,AG,CR plan
```

[Open as SVG](architecture/19-target-packages-and-surfaces.svg)

| package | depends on | gives you | built by |
|---|---|---|---|
| `@pdfsuite/core` | `pdfjs-dist`, `pdf-lib` (exact) | a library | W-29 |
| `@pdfsuite/compare` | `core`, `cli` | `pdfsuite compare`, `--each`, `pdfsuite-compare` | W-29, W-27, W-09 |
| `@pdfsuite/spec` | `core`, `cli` | `pdfsuite spec`, `pdfsuite-spec` | W-32, W-11 |
| `@pdfsuite/cli` | `core`, `agents` | `pdfsuite` | W-30 |
| `@pdfsuite/agents` | — | `pdfsuite agents init` | W-10 |
| `@pdfsuite/ui` | `core`, `compare`, `spec`; React as a peer | the screens | W-33 |
| `@pdfsuite/create` | — | `npm create @pdfsuite` | W-31, W-34 |

The install table, the sync rules and the hosting rule are [SR-NPM-PACKAGES](../records/0107_NPM-packages.md) §1.

## One compare core

- **`comparePair` is the only entry** for one pair; **`compareMany`** is the only loop for many — Compare's **One** and **Many** scopes, `pdfsuite compare` and `--each` all call them ([SR-COMPARE](../records/0111_COMPARE.md), [SR-BULK-COMPARE](../records/0113_BULK-compare.md)).
- **One page rule, `pageVerdict`,** replaces `pageHasChange` and `summaryPageDiffers`; its limits live in the constants file ([SR-CONSTANTS](../records/0103_CONSTANTS.md), **W-05**). Every knob that moves it is recorded in `result.json`.
- **Pairing is an input** (`PagePair[]`) — the tab's editor and the CLI's `--pages` produce the same list; unpaired pages are reported as added or removed.
- **Three pure builders return strings;** the app wraps them in a download, the CLI writes them to disk — so both produce the same files, and a parity test proves it byte for byte.

```mermaid
flowchart TB
  classDef plan stroke-dasharray: 2 3
  subgraph IN["Inputs"]
    G["golden.pdf"]
    C["candidate.pdf"]
    PP["PagePair[]<br/>tab editor · --pages · default 1:1"]
    OPT["options<br/>pixel sensitivity · anti-aliasing"]
  end
  subgraph CORE["@pdfsuite/compare"]
    CP["comparePair(golden, candidate, opts)"]
    CM["compareMany(pairs, opts)<br/>pairs by relative path · orphans fail"]
    PG["comparePage × pages<br/>text · position · pixels"]
    BC["buildChanges<br/>removed · added · moved · restyled · …"]
    PV["pageVerdict — one rule<br/>missing · content under 99.99% · pixels over 0.2% · offset over 2 px"]
    RES["CompareResult<br/>pages · findings · verdicts · policy"]
    CM --> CP
    CP --> PG --> BC --> PV --> RES
  end
  subgraph BLD["@pdfsuite/core — pure builders"]
    J["buildResultJson(result)"]
    H["buildReportHtml(result)"]
    M["buildManifest(inputs, outputs)"]
  end
  G & C & PP & OPT --> CP
  RES --> J --> H
  J & H --> M
  subgraph APP["the app"]
    T1["Compare tab · strip · Next change · chip"]
    T2["Compare · Many scope"]
    DL["Export menu → download"]
  end
  subgraph CLIX["the CLI"]
    C1["pdfsuite compare a.pdf b.pdf --out dir"]
    C2["pdfsuite compare --each golden/ candidate/"]
    FS["files on disk · console line · exit code"]
  end
  T1 --> CP
  T2 --> CM
  C1 --> CP
  C2 --> CM
  J & H & M --> DL & FS
  PAR["parity test: app path and CLI<br/>byte-identical result.json outside run"] -.-> DL & FS
  class CP,CM,PG,BC,PV,RES,J,H,M,PAR plan
```

[Open as SVG](architecture/20-target-one-compare-core.svg)

Built by **W-27** (core, rule, pairing, builders, app and CLI on them), after **W-29**.

## The three output files

- **`result.json` is the answer**; everything else — `report.html`, the console line, the exit code — is derived from it ([SR-REPORT-JSON](../records/0109_REPORT-json.md)). Versioned schema `pdfsuite.result/1`, shipped in `@pdfsuite/core`; byte-stable outside the one `run` block; positions in inches, font sizes in points; stable finding ids.
- **`report.html` is the page a person reads** ([SR-REPORT-HTML](../records/0108_REPORT-html.md)): one self-contained file, no script, no request, images embedded for failing pages only, every value escaped, the same bytes from the app and the CLI for the same `result.json`.
- **`manifest.json` is the receipt** ([SR-MANIFEST](../records/0110_MANIFEST.md)): every input and output with bytes and SHA-256, written last, no timestamp, no absolute path.
- **Nothing else is written** — JUnit, CSV and Markdown left the CLI with the ruling; the app keeps Markdown, CSV and the ZIP as ratified UI-only views.

```mermaid
flowchart LR
  classDef plan stroke-dasharray: 2 3
  RUN["one run<br/>compare · compare-many · spec · inspect"] --> RJ
  subgraph OUT["--out dir, or the Export menu"]
    RJ["result.json · pdfsuite.result/1<br/>schema · kind · tool · env · run (the only wall-clock)<br/>policy · inputs · summary · body · findingsSha256"]
    RH["report.html<br/>rendered from result.json only<br/>self-contained · no script · escaped · failing pages drawn"]
    MF["manifest.json · pdfsuite.manifest/1<br/>inputs[] + outputs[] · bytes · SHA-256 · written last"]
  end
  RJ --> RH
  RJ --> CON["console summary line<br/>PASS / FAIL · counts · report path · exit code"]
  RJ --> EXIT["exit code<br/>summary.verdict is its only source"]
  IN["inputs<br/>PDFs · spec workbook"] --> MF
  RJ & RH --> MF
  SCH["schema/result.v1.json<br/>schema/manifest.v1.json<br/>in @pdfsuite/core · validated in tests"] -.-> RJ & MF
  class RJ,RH,MF,CON,EXIT,SCH plan
```

[Open as SVG](architecture/21-target-three-output-files.svg)

Built by **W-27** (the builders), **W-09** (compare writes them), **W-11** (spec), **W-28** (inspect); contracts tested by **W-39**.

## The `pdfsuite` command line

- **One host.** `@pdfsuite/cli` owns `pdfsuite`; `compare` and `spec` are loaded from their packages when installed — missing → exit 2 with the `npm i` to run; a different version → exit 2 ([SR-CLI](../records/0115_CLI.md), [SR-NPM-PACKAGES](../records/0107_NPM-packages.md) decisions 3–4, **W-30**).
- **One pair per command;** many by `--each`, the same function in one process. Inputs positional, options long flags, `--out` names the folder.
- **stdout carries only the console shape;** progress, tables and warnings go to stderr (**W-08**). Exit codes 0 pass · 1 fail · 2 broken; whether 2 splits into usage 2 / runtime 3 is open on **W-07**.
- **Secrets never on the command line** — `--password-env`, `--password-file` (**W-16**); redacted everywhere. No network except `generate`.

```mermaid
flowchart TB
  classDef plan stroke-dasharray: 2 3
  U["pdfsuite COMMAND … --out DIR"] --> HOST["@pdfsuite/cli host<br/>flag › PDFSUITE_* › config file › default"]
  HOST --> LOAD{"command"}
  LOAD -->|"compare · compare --each"| PC["@pdfsuite/compare command module<br/>comparePair · compareMany"]
  LOAD -->|"spec · --validate-only"| PS["@pdfsuite/spec command module<br/>intake · runSpec"]
  LOAD -->|"inspect"| PI["built in → @pdfsuite/core inspectCore"]
  LOAD -->|"generate"| PG["built in → render API"]
  LOAD -->|"agents init"| PA["built in → @pdfsuite/agents"]
  LOAD -->|"not installed · wrong version"| X2A["exit 2 + the npm i to run"]
  PC & PS & PI --> OUT["result.json · report.html · manifest.json"]
  OUT --> CON["stdout: header · one line per pair · summary line<br/>stderr: progress · tables · warnings"]
  OUT --> EX{"exit"}
  EX -->|"every check passes"| E0["0"]
  EX -->|"a page, pair, assertion or orphan fails"| E1["1"]
  EX -->|"bad arguments · unreadable file · wrong password"| E2["2"]
  E3["3? usage vs runtime split<br/>open on W-07"] -.-> E2
  BIN["pdfsuite-compare · pdfsuite-spec<br/>own bins for global installs"] -.-> PC & PS
  class HOST,LOAD,PC,PS,PI,PG,PA,X2A,OUT,CON,EX,E0,E1,E2,E3,BIN plan
```

[Open as SVG](architecture/22-target-cli.svg)

Built by **W-08** (console), **W-09** (compare, `--each`), **W-30** (host, bins, version check), **W-11** (spec), **W-28** (inspect), **W-16** (passwords), **W-10** (agents, publishing).

## Create, sync and hosting

- **`npm create @pdfsuite`** writes a thin shell over `@pdfsuite/ui` — built **W-31** (2026-11-09). An empty directory gets a whole Vite + React app of seven files, exactly one of them a component; a React app gets `src/pdfsuite/` and the dependencies. The mode comes from **what is on disk**, never a flag, and anything that is neither is refused with the reason ([SR-NPM-PACKAGES](../records/0107_NPM-packages.md) decision 7).
- **No existing file is changed, and it is measured:** [`check-create.sh`](../scripts/check-create.sh) hashes the whole project before and after add mode, and the only pre-existing file that differs is `package.json`, which gains `@pdfsuite/*` dependency entries and keeps its own keys and indentation.
- **Every file it writes is recorded** with its SHA-256 in `.pdfsuite/installed.json`, hashed off disk after writing; **`--sync`** replaces a file only while its hash still matches, writes `<file>.pdfsuite-new` beside an edited one, bumps every `@pdfsuite/*` to one version, and `--check` exits 1 when behind — the executable form of L4 decision 5 (**W-34**).
- **A created app's `build` is `vite build` alone.** The packages publish TypeScript source, so a consumer's `tsc` type-checks ours with their settings — **B-022**, and it should be fixed before anything is published.
- **The app is a static single-page app at any URL:** relative assets, hash routing by default, pdf.js worker, fonts and character maps served beside it; PDFs never leave the browser (**W-35**, **W-13**).

```mermaid
flowchart LR
  classDef plan stroke-dasharray: 2 3
  N["npm create @pdfsuite my-app"] --> D{"what is on disk?"}
  D -->|"empty"| NEW["new Vite + React app · 7 files<br/>main.tsx mounts PdfSuiteApp · pdfsuite.config.ts<br/>+ core · compare · spec · ui"]
  D -->|"files, no package.json<br/>or no React"| REF["refused, with the reason · exit 2"]
  E["npm create @pdfsuite .<br/>in an existing React app"] --> D
  D -->|"React"| ADD["src/pdfsuite/ added · deps added<br/>only package.json touched · router line printed"]
  NEW & ADD --> REC[".pdfsuite/installed.json<br/>version · every written file · SHA-256"]
  S["npm create @pdfsuite@latest -- --sync"] --> CHK{"per recorded file"}
  REC --> CHK
  CHK -->|"hash matches"| REP["replace"]
  CHK -->|"hash differs"| KEEP["keep · write file.pdfsuite-new · list it"]
  CHK -->|"deleted by the team"| DEL["stays deleted"]
  S --> VER["@pdfsuite/* → one exact version<br/>nothing else in package.json touched"]
  CI["--sync --check"] -.->|"exit 1 when behind"| CHK
  NEW --> HOST["static host, any URL or sub-path<br/>relative assets · hash routes · pdf.js assets beside the app<br/>no server · no network"]
  class NEW,ADD,REC,CHK,REP,KEEP,DEL,VER,CI,HOST plan
```

[Open as SVG](architecture/23-target-create-sync-hosting.svg)

Built by **W-33** (`ui`), **W-31** (`create`, both modes), **W-34** (`--sync`), **W-35** (any URL).

## Specification, end to end

- **Excel is the truth.** A Template v2 workbook is loaded with sheetpane's `@sheetpane/import` (browser and Node) and read in TypeScript, validated with every problem named by its cell, and compiled to a spec JSON in which every value names its sheet and cell; a spec JSON uploaded directly is used as is ([SR-SPEC-INTAKE](../records/0101_SPEC-intake.md), **W-02**). No converter in another language; no LLM — deterministic and auditable.
- **No guesswork (decision 7a).** One row, one value, one Unit cell from a closed list; a blank, in-value, unknown or disallowed unit — or `px` without a declared *Pixels per inch* — is an **error** that names the cell, never "probably inches". The legacy nested layout is only a migration input: it yields a draft v2 workbook for a person to confirm, never an assertion. The validation report, the plain-words preview and the annotated workbook are **W-48**; the in-place sheet view is **W-46**.
- **The checker runs spec JSON only** ([SR-SPEC-CHECK](../records/0102_SPEC-check.md), **W-04**): Pages List binding, order, missing and extra pages, fonts, colour by ΔE, wording, tolerances in the spec's units, coverage "N of M rows checked"; nothing passes silently.
- **The same functions from the Spec tab and `pdfsuite spec`**, through the feature's `engine.ts` ([SR-SPEC](../records/0112_SPEC.md), **W-11**); three files out, every finding with its cell. `.xlsx` on the command line waits on the reader moving to `@sheetpane/import`, which reads without a DOM.
- **Packaged as `@pdfsuite/spec`** by **W-32** (2026-11-06): three barrels, its own command module, `pdfsuite-spec` for a global install. Siddharth ruled on 2026-11-03 that it may be developed anywhere, so there is one copy and this repository holds it.

```mermaid
flowchart TB
  classDef plan stroke-dasharray: 2 3
  XL["spec.xlsx · Template v2<br/>one row, one value, one Unit cell"] --> RD["readWorkbook<br/>@sheetpane/import · visible cells · size limits"]
  LEG["legacy nested layout"] -.->|"draft v2 workbook<br/>a person confirms"| XL
  RD --> PARSE["sheetToSpec<br/>Pages List · page sheets · Lists · Settings"]
  PARSE --> VAL["validateSpec<br/>error · warning · info — each with its cell<br/>unit blank · in-value · unknown · px without density = error"]
  JS["spec.json<br/>used as is"] --> VAL
  VAL --> SJ["spec JSON<br/>every value: source {sheet, cell}<br/>workbook SHA-256 · template version"]
  SJ & PDF["report.pdf"] --> BIND["bind pages<br/>Pages List · order · missing · extra · optional · variants"]
  BIND --> READ["read the page<br/>geometry · fragments · fonts · colour · images · no text layer"]
  READ --> CMPX["compare each assertion<br/>wording rules · tolerances in the row's own unit"]
  CMPX --> COV["coverage<br/>checked · noted · unverifiable · excluded"]
  COV --> OUT["result.json · report.html · manifest.json<br/>every finding names its cell"]
  subgraph SURF["two surfaces, one engine.ts"]
    TAB["Spec tab<br/>upload · validation report · highlights on the page"]
    CLI["pdfsuite spec spec.xlsx report.pdf --out dir<br/>--pages · --validate-only"]
  end
  TAB & CLI --> RD
  PKG["@pdfsuite/spec<br/>W-32: the package, three barrels"] -.-> SURF
  class RD,PARSE,VAL,SJ,BIND,READ,CMPX,COV,OUT,TAB,CLI,PKG,LEG plan
```

[Open as SVG](architecture/18-target-spec-driven-comparison.svg)

Built by **W-05** (constants) → **W-02** (intake) and **W-04** (checker); **W-48** (the validation contract: plain words, annotated workbook, `--validate-only`); **W-11** (the command); **W-32** (the package). Fixtures: [`work/samples/excel-spec-template-v2/`](../work/samples/excel-spec-template-v2/README.md) — Template v2 with ten planted intake errors, the matching and deviating PDFs. No legacy-layout fixture is committed.

## Testing

- **A feature works when every numbered decision of its record has a test named after it**, and its veto condition runs as one; a check lists the unproven decisions ([SR-TESTING](../records/0116_TESTING.md), **W-36**). Runner: Node's built-in `node:test`.
- **A fictional, realistic sample set** — statements, invoices, letters as PDFs, a spec workbook — with deviations planted on purpose and listed in `expected.json`, generated deterministically in TypeScript (**W-37**); run end to end through the app path and the CLI and **scored** found · missed · extra — a miss fails (**W-38**).
- **Contracts and security** — schema (Ajv, dev-only), manifest hashes, exit codes, console shape, escaping fuzz, no network, no secret (**W-39**); **browser flows** in Playwright, dev-only (**W-40**). Both are open source (L1).
- **CI is GitHub Actions** (SR-TESTING decision 10): every check on each pull request; an approved release publishes every `@pdfsuite` package at one version with trusted publishing and provenance (**W-43**).
- **Blind batches** — an AI that has never seen this project writes the cases and the answer key from a prompt; the key lives in a sealed folder no agent may read; a person runs the judge (**W-41**).

```mermaid
flowchart TB
  classDef plan stroke-dasharray: 2 3
  subgraph PROOF["npm test — every commit, under two minutes"]
    REC["record decisions<br/>SR-X dN"] --> T["named tests<br/>unit · reference · known-answer · property · parity · contracts"]
    FIX["fixtures<br/>one change each · W-12 PDF kinds"] --> T
    COV["decision-coverage check<br/>decisions with no test = the unproven list"]
    REC --> COV
  end
  subgraph E2E["npm run test:samples · test:e2e · test:pack"]
    SAMP["sample set · W-37<br/>PDFs + .xlsx · planted deviations · expected.json"] --> RUNS["runs through the app path and the CLI"]
    RUNS --> SC["scorecard<br/>found · missed · extra · time · memory<br/>a miss fails"]
    PW["Playwright · each tab · exports · sub-path hosting<br/>any off-host request fails"]
    PACK["packed tarballs · create · --sync"]
  end
  subgraph BLIND["blind batches · W-41"]
    PR["PROMPT-compare.md · PROMPT-spec.md<br/>public contracts only"] --> AI["independent AI, fresh chat"]
    AI --> INZ["inputs.zip → blind:place"]
    AI --> ANZ["answers.zip → sealed folder<br/>git-ignored · deny rules · hooks · agent messages"]
    INZ --> BR["blind:run"] --> JD["blind:judge — a person only<br/>found · missed · extra · verdict agreement"]
    ANZ --> JD
    JD --> SPENT["batch spent → joins the sample set"]
  end
  SPENT -.->|"regression"| SAMP
  T & COV & SC --> GREEN["green = proven"]
  CI["GitHub Actions<br/>npm provenance for publishing"] -.-> PROOF & E2E
  class REC,T,FIX,COV,SAMP,RUNS,SC,PW,PACK,PR,AI,INZ,ANZ,BR,JD,SPENT,GREEN,CI plan
```

[Open as SVG](architecture/24-target-testing.svg)

Built by **W-36**, **W-37**, **W-38**, **W-39**, **W-40**, **W-41**; **W-12** supplies the PDF-kinds corpus.

## The build order

**Which item waits on which** — read from the `waits on` words of [`work/OPEN-WORK.md`](../work/OPEN-WORK.md)
on 2026-10-18. Green items can start now; red ones wait on a ruling in the inbox. The
PDF-kinds chain (right) closes each gap in [SR-PDF-SUPPORT](../records/0105_PDF-support.md).

```mermaid
flowchart LR
  classDef ready fill:#dff5e1,stroke:#2e7d32
  classDef ruling fill:#fde0e0,stroke:#c62828
  subgraph SPEC["spec"]
    W05["W-05 constants"] --> W02["W-02 spec intake"] & W04["W-04 spec checker"]
    W02 --> W48["W-48 validation contract"]
  end
  subgraph PKG["packages · core · CLI · UI"]
    W29["W-29 workspaces"] --> W27["W-27 one compare core"] & W30["W-30 CLI host"] & W33["W-33 ui package"]
    W27 --> W09["W-09 compare, one pair, --each"] & W39["W-39 contract + security tests"]
    W09 --> W10["W-10 agents + publish"] & W11["W-11 pdfsuite spec"] & W28["W-28 pdfsuite inspect"]
    W33 --> W31["W-31 npm create"] & W35["W-35 any URL"] & W40["W-40 Playwright"]
    W31 --> W34["W-34 --sync"]
    W32["W-32 @pdfsuite/spec"] -.-> W11
    W07["W-07 compare redesign, 6 points"] -.-> W09
  end
  subgraph TEST["testing · CI"]
    W37["W-37 sample set"] --> W38["W-38 scorecard"]
    W36["W-36 npm test"]
    W41["W-41 blind batches"]
    W43["W-43 CI/CD on GitHub Actions"]
  end
  subgraph KINDS["PDF kinds · SR-PDF-SUPPORT"]
    W12["W-12 kinds corpus + harness"] --> W13["W-13 one loader · fonts · CMaps"] & W17["W-17 form fields"] & W18["W-18 XFA"] & W19["W-19 annotations"] & W20["W-20 page kind"] & W21["W-21 tags"] & W22["W-22 colour"] & W23["W-23 geometry"] & W24["W-24 page sizes"]
    W13 --> W14["W-14 font embedding"] & W16["W-16 passwords"]
    W14 --> W15["W-15 weight from descriptor"] & W25["W-25 signatures"] & W26["W-26 document properties"]
  end
  subgraph REPO["repository"]
    W44["W-44 monorepo layout · SR-MONOREPO"] -.-> W29
    W45["W-45 rename the repository"]
  end
  W01["W-01 claim components"]
  W06["W-06 tab names"]
  W08["W-08 console output"]
  W42["W-42 PDF viewer pop-up"]
  class W05,W29,W36,W37,W41,W12,W01,W08,W43,W44 ready
  class W32,W07,W45,W42,W06 ruling
```

[Open as SVG](architecture/25-build-order.svg)

**Keystones:** **W-29** (everything in the packages lane hangs off it; **W-44** settles the layout it builds in), **W-05** (both spec items), **W-12** (thirteen PDF-kinds items), **W-37** (the scorecard). **Independent and ready:** W-01, W-08, W-36, W-41, W-43, W-44. **Owed a ruling:** W-07's six points, W-06 (tab names), W-42 (build or not), W-45 (name and owner), and the verdict effect of the new finding types (W-14, W-19, W-21, W-24, W-25, W-26 build with their stated defaults meanwhile).
