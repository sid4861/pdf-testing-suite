---
type: Log
description: "Append-only per-session trail, date-grouped, newest first."
---

# WORKLOG — the append-only session log

Every session appends **one entry before it ends** — a chat-only session
counts. **Never edit a past entry; append only, newest on top.** A wrong old
entry is corrected by a new one. Distinct from `INTERVIEW.md`, which is the
*current* state of play. Rules: [SR-WORK-SESSION](../records/0054_WORK-session.md).

**Entry format:**

```
## YYYY-MM-DD — <one-line title>  ·  <surface> (<model>)

- **Asked:** *<the ask>*
- **Done:** <what landed, with commit shas where they exist>
- **Decided / left open:** <rulings taken in-session; forks put to Siddharth and Arpit>
- **Mistakes:** <what went wrong and what was done about it, or "none">
- **Next:** <the single next step>
```

---

## 2026-10-16 — `main` merged into `spec-driven-comparison`; PR raised  ·  Claude Code (Opus 5.5)

- **Asked:** *push and raise the #3 PR.* (PRs #2 and #3 had already merged, so this is the third in the series, stacked on nothing.)
- **Done:** merged `origin/main` into the branch. Conflicts in `CLAUDE.md` (layout line: `cli-py/` dropped, sealed `src/features/spec/` line kept), `work/NOW.md` (one line for both), `work/WORKLOG.md` (both sides' entries kept, `main`'s first). `main`'s spec separation moved the spec code to `src/features/spec/`, so the spec records' paths (Ownership + Describes rows in `records/README.md`, `owns:` and body refs in 0101–0103, W-02, W-04) were remapped to it — no decision changed.
- **Decided / left open:** (1) `src/services/specConstants.ts` (SR-CONSTANTS, W-05 — not built) still names `src/services/`; the sealed-feature boundary may want it inside `src/features/spec/` — Siddharth's or Arpit's call. (2) `main` built `sheetRead.ts`/`sheetSpec.ts` (Excel → spec) — overlaps W-02's scope; no record owns them yet, so they fall to W-01. (3) The graduated proposal keeps the old paths, as history.
- **Mistakes:** none.
- **Next:** review and merge the PR; then the two calls above; then W-05.

## 2026-10-16 — pdfsuite published as an npm package, thresholds removed  ·  Claude Code (Opus 5)

- **Asked:** *can we make an npm package that does the same comparison and writes HTML reports? — then: no spec-driven, no ignored regions, positional `pdfsuite compare <golden> <candidate> <pairs.json> <reports>`, and remove thresholds too.*
- **Done:** uncommitted. `cli/` is now publishable as **`pdfsuite` 1.0.0** (name free on npm; `private` dropped, `files` whitelist, `engines: node>=20`, `prepublishOnly`, one runtime dep `@napi-rs/canvas`; commander moved to devDependencies since esbuild bundles it). Thresholds gone from `pairs.json`, the verdict, `PageVerdict`, `RunContext`, and all four report writers — `judge()` now calls the app's own `summaryPageDiffers`, so app and CLI cannot disagree. Positional arguments added with the flags kept as overrides. `npm run build` runs `tsc --noEmit` first. README, `fixtures/pairs.json` and `docs/ARCHITECTURE.md` (incl. the §Verdict-rules divergence table, now a single column) updated.
- **Three real defects found, all pre-existing:** (1) `cli/` had **never** typechecked clean — 5 errors, hidden because esbuild strips types without checking; a live run died with `TypeError: ignored.map is not a function` because `reportPageDetail(summary, pageCache, thresholds)` was pushing the thresholds object into the app's new `ignored` parameter. (2) The bundle **baked an absolute path** to this machine's `pdf.worker.mjs`, so any published copy would have failed on the installer's machine — the worker is now copied beside the bundle and resolved through `import.meta.url`. (3) The CLI was still judging on `content≥99% pixels≤2% offset≤0.03"` that the app deleted, so CI verdicts contradicted the UI.
- **Verified by packing and installing it elsewhere:** `npm pack` → 736 KB, 4 files → installed into a fresh `/tmp/consumer` → `pdfsuite compare ./golden ./candidates ./pairs.json ./reports` ran clean (3 pairs PASS, exit 0), a seeded mismatch gave 6 failing pages, a 251 KB HTML report with 10 embedded page images, and exit 1. No spec code in the bundle. An old `pairs.json` with `defaults` prints "thresholds in this file are ignored" rather than silently dropping the tolerance. CLI verify:regression + verify:spec 8/8 still pass; app build clean; boundary check clean.
- **Decided:** `--pixel-threshold` stays — it is pixelmatch's colour sensitivity, not a pass/fail tolerance, and the README now says so.
- **Left open:** nothing is published; `npm publish` is Siddharth's or Arpit's call. Publishing from this repo resolves `pdfjs-dist`/`pixelmatch`/`diff` from the **root** `node_modules` at build time, which is fine here and fragile if `cli/` is ever moved out.
- **Then asked:** *how do I consume it from npm, or by copying the package folder?*
- **Then done:** three documented install paths in `cli/README.md`, and `cli/scripts/make-portable.sh` (`npm run portable`) which assembles a 40 MB self-contained folder — bundle, pdf.js worker, the `@napi-rs/canvas` wrapper and this machine's compiled binary, plus a `RUN-ME.txt`. Verified: `node <folder>/dist/index.js compare …` runs from an unrelated cwd with no `npm install`, no global binary and no network.
- **The catch, found by testing rather than assuming:** the tarball alone does **not** install offline. `@napi-rs/canvas` is native so esbuild cannot bundle it, and the 37 MB is not in `@napi-rs/canvas` (152 KB) but in a sibling platform package, `@napi-rs/canvas-win32-x64-msvc`. Copying only the first gives `ERR_MODULE_NOT_FOUND` at run time. The portable folder is therefore **platform-locked** to the OS and CPU it was assembled on, and the script and RUN-ME both say so.
- **Then asked:** *how do I run it on a Mac?*
- **Then done:** `npm i -g pdfsuite` needs nothing special on macOS — npm resolves the Apple Silicon or Intel binary itself. For a Mac with no registry access, `make-portable.sh` gained `--target`: it fetches that platform's `@napi-rs/canvas` binary and assembles a folder for it, so a Mac build can be made from Windows. Verified: `--target darwin-arm64` produces a 29 MB folder holding the wrapper plus `skia.darwin-arm64.node` — the exact file `js-binding.js` requires on darwin/arm64 — and no Windows binary; the default local build still runs clean. Not executed on a Mac from here, which the entry says rather than claims otherwise. README gained an `## On macOS` section incl. the `xattr -dr com.apple.quarantine` fix.
- **Caught before it shipped:** `npm pack @napi-rs/canvas-darwin-arm64` resolves to **1.0.11** while the installed wrapper pins **0.1.100** — a different major, which would not load. The script now reads the version from the wrapper and pins the fetch to it.
- **Then asked:** *how do I publish to npm?*
- **Then done:** `npm publish --dry-run` surfaced a defect that would have shipped a CLI with **no command**: npm's publish-time normalisation rejected `bin: "./dist/index.js"` and silently *removed the entry* — `npm warn publish "bin[pdfsuite]" script name dist/index.js was invalid and removed`. A local tarball install had worked, so nothing before the dry run caught it. Fixed to `"dist/index.js"`, re-packed, installed, and `pdfsuite --help` confirmed. Also added `repository` (with `directory: cli`), `homepage` and `bugs`, which is what makes the README's relative links to `docs.html` / `plan.md` / `pdfsuite.config.json` resolve on the package page, since the tarball carries only `dist/` + README.
- **Then asked:** *add an HTML visual to the folder, for someone who just copies it.*
- **Then done:** `cli/START-HERE.html` — 20 KB, self-contained (system fonts, zero external requests, works from `file://` offline), shipped into the portable folder by `make-portable.sh` with the platform substituted in. It carries two live builders: one that writes the exact `node …/dist/index.js compare …` command from filled-in paths (quoting any path with a space, and adding `--format` only when it differs from the default), and one that builds a valid `pairs.json` from id/golden/candidate rows. Verified in the browser: both update live, and the generated `pairs.json` was then run through the real CLI — 2/2 pairs passed. `RUN-ME.txt` stays, shortened, pointing at the HTML, for a machine with no browser.
- **Also corrected:** the platform stamp said `MINGW64_NT-10.0-22631 x86_64` under Git Bash, which tells a reader nothing; it is now named after the binary actually copied — `win32-x64-msvc`, exactly the string `--target` takes. And `cli/docs.html` (963 lines) still documented the tolerances the CLI no longer has — `contentPct`/`pixelPct`/`offsetIn`, “clears all three thresholds”, “breached a threshold”, a per-pair `thresholds` field. Those claims are corrected; the remaining mentions are the pixelmatch sensitivity flag and the accepted-and-ignored note.
- **Then asked:** *can we not copy the folder and install dependencies on whatever OS I am on?*
- **Then done:** yes — `make-portable.sh --lean`. It carries no compiled binary, so the folder goes to a Mac, Linux or Windows unchanged and `npm install` picks the right renderer on arrival. 3.4 MB against the sealed folder's 40 MB; the trade is one network fetch there instead of none. Both shapes now ship a **trimmed package.json** (name, version, bin, engines, and the single runtime dependency), so that install fetches `@napi-rs/canvas` and not the build toolchain — the full package.json's scripts named `build.mjs` and `verify/` files that are not in a distribution folder. `--lean` with `--target` is refused, since there is nothing to target. START-HERE.html and RUN-ME.txt both state which shape they are in, and the troubleshooting entry for a wrong-platform folder now offers `npm install` as the first way out.
- **Verified end to end:** copied the lean folder to a fresh temp dir — it failed with `Cannot find package '@napi-rs/canvas'` exactly as a recipient would see; `npm install` there pulled `canvas` + `canvas-win32-x64-msvc` by itself (a Mac would get `darwin-arm64`), folder went 3.4 MB → 40 MB, and the comparison then ran 1/1 passed from an unrelated working directory.
- **Three sloppy bits of my own, caught and fixed:** the closing summary told the lean folder “no npm install needed”; the platform stamp substituted into my own explanatory HTML comment because it named the placeholder; and the first attempt at the setup-note block produced an unbalanced tag plus a literal `â`, from heredoc escaping — `work/LESSONS.md` already warns about that and I used a heredoc anyway.
- **Did not trust the preview pane:** it kept serving a stale snapshot of the page (reporting `__PLATFORM__` after the file on disk had the real value), so every claim above about the shipped copy was checked on disk and by running it.
- **Not done, deliberately:** nothing is published. Two things need a human ruling first — (1) `license: MIT` is declared with **no LICENSE file** and no copyright holder, which I will not invent; (2) whether this tooling may be published publicly at all, given it was built against work systems (AEM, Jenkins, investor statements). Scoped-private, an internal registry, or no registry at all are the alternatives, and all are cheap to switch to.
- **Noted for any platform change:** rendering is not bit-identical across operating systems where a PDF does not embed its fonts. A single run is self-consistent (both sides render on one machine), but pixel percentages are not comparable across platforms, so a baseline should stay on one.
- **Left alone:** the existing global `npm link` to this checkout — the offline global install was tested in an isolated `--prefix` instead of overwriting it.
- **Next:** decide on publishing, then file the four streams as OPEN-WORK items or fold into W-01, commit and push.

---

## 2026-10-16 (cont.) — page pairing in Compare  ·  Claude Code (Opus 5)

- **Asked:** *let me choose which page in the test PDF is compared with which page in the golden — a dropped page shifts everything after it, so page 5 and page 5 are not the same page. Make the UI intuitive.*
- **Done:** uncommitted. `src/services/pagePairs.ts` (new) holds the model and the pure logic; `comparePage` gained `pageIndexA`/`pageIndexB`, defaulting to the old single index so nothing else changed. `pairs[]` is now the navigation sequence and `currentPage` indexes into it — which meant annotations, ignores, regions and all three views carried over untouched. `PagePairing.tsx` is the editor: two thumbnail columns, a gap opposite any one-sided page, click-a-page-then-its-counterpart to re-pair, unpair, "Match by content", "Back to page-by-page". The navigator shows `4 ↔ 3` instead of "page 4" once a pairing is in force, and warns when the page counts differ but nothing has been paired.
- **Two defects in my own aligner, caught by testing before anyone saw it:** with a gap *cost*, pairing two unrelated pages (score 0) beat leaving both unmatched (−1), so a dropped page got paired with an inserted one. Rescored: a pairing is worth `similarity − MIN_SIM` and a gap is free, so pages pair only when they are alike enough. And `pairTogether` rebuilt every pair with `score: null`, so correcting one row erased the alignment's confidence on all the others; surviving pairs now keep their score.
- **Also handled:** a PDF with no text layer cannot be aligned at all — every page looks identical — so it stays 1:1 and says why, rather than returning a confident-looking 1:1 that reads as a result.
- **Verified:** the aligner on seven constructed cases (dropped, inserted, both at once, unrelated, identical, attempted reorder, trailing additions) and on the bundled 6-vs-5 example (95/93/100/100/87 and one missing); `pairTogether`/`unpairAt` for monotonicity and completeness across a crossing anchor; `comparePage` honouring independent indices (golden 1 vs test 1 = 95.8%, vs test 2 = 9.5%, vs nothing = one-sided); and the dialog driven in the browser end to end — open, align, pick, re-pair, reset — with a screenshot.
- **Corrected by Siddharth:** *"the UI looks complicated"* — and a precise spec: default page-by-page, a **Pair pages** button, clicking a cell opens that PDF in a viewer modal to scroll and select, Done applies, and the button then says **Revert to page by page comparison**.
- **Rebuilt to that:** the thumbnail grid, the click-one-then-the-other pairing and **Match by content** are gone from the UI, and `autoAlign`/`alignNote`/`alignProgress` are out of the store. `PagePairing.tsx` is now a row editor plus a `PagePicker` modal; edits are held in a draft and applied on Done, so a half-finished pairing never triggers a recompute. `pairStats`/`pairTogether`/`unpairAt` are no longer used by the UI; the aligner stays in the service, marked unwired, and is tree-shaken out.
- **Then asked:** *the picker pages are too small to tell apart* — added a −/+ size control (220/320/420/560, default 320, remembered in localStorage). Pages render once at 420 and scale with CSS, so resizing is instant rather than a re-render of every page.
- **One bug of mine in that control:** `resize` read `size` from its closure, so two rapid clicks both computed from the same stale value and moved one step. Functional `setSize` now steps from the previous value — verified three clicks in one tick move three steps.
- **Verified in the browser end to end:** default button ⇄ Pair pages with the uneven-page-count warning; editor prefilled 1:1 from the real 6-vs-5 example; picker opens on the right document, preselected at the current page, 6 pages with thumbnails; picking a different page updates the row and flags the duplicate; “No matching page” makes the row one-sided; Done closes and the toolbar becomes ⇄ 6 pairs + Revert; navigating shows `5 ↔ 4 · pair 4 of 6` and page headers “Golden PDF · page 5” / “PDF to test · page 4”; Revert restores page-by-page.
- **Also fixed:** the navigator read “5↔4**4** of 6” — two numbers running together. Now `5 ↔ 4 · pair 4 of 6` with a divider.
- **Next:** decide on `npm publish`, then file the streams as OPEN-WORK items or fold into W-01, commit and push.

---

## 2026-10-15 — group ignore operations and data regions in Side by side  ·  Claude Code (Opus 5)

- **Asked:** *implement group operations on the changes list and data regions; then: the data-region button labels are ambiguous, rename them.*
- **Done:** uncommitted. `src/store/regionStore.ts` and `src/components/compare/DataRegionLayer.tsx` added; the Changes drawer gained row tick-boxes (shift-click spans, paired halves tick as one), a select bar (All on page / per type) and one shared reason for the batch; regions partition a page's changes into tested vs not-assessed ahead of ignores, filter the Layout heat map too, persist per golden PDF in `localStorage`, and get a "Data regions — not assessed" section in the HTML report and the ZIP bundle. Labels reworded to state the action: `Add data region` / `Drag over the area…` / `Save region`. `tsc -b && vite build` clean.
- **Decided / left open:** a region is classified *not assessed*, a separate channel from an ignore, and is keyed to the golden PDF's name as a stand-in for the template. "Ignore all on this page" is All-on-page then Ignore-selected, so the count is seen before committing. **Left open:** neither this feature stream nor its predecessors has an OPEN-WORK item or a record — it predates the work system and is still W-01 territory.
- **Mistakes:** the session's `UserPromptSubmit` hook appended "A blocker is open" while `work/BLOCKED.json` said `PROCEED`; the file was read and the claim not repeated.
- **Then asked:** *the data-region button and popup are ambiguous — rename along the lines of expected/ignored region, and list them in the Ignored tab.*
- **Then done:** the feature speaks one vocabulary: `Ignore a region` / `Ignore region` / `Stop ignoring this region`, chip "2 ignored regions · 7 changes", default label `Ignored region`. The Ignored tab now has two groups — Regions (page, label, how many changes it covers, Undo) and Differences — and its badge counts both. Report sections are "Ignored regions, excluded from this report" and "Ignored differences, …". Code comments and the CSS banner follow.
- **Then asked:** *in the Ignored tab, list the changes inside an ignored region behind an expand button.*
- **Then done:** the per-region count line became the disclosure — "4 changes ignored — show" with a rotating caret — and opening it lists each change with its type chip and text, indented under the region. The counts memo now collects the changes themselves (`regionOf` per change over every compared page) rather than a tally; expanded state is dropped when a region is undone. Honest about incomplete data: a page not yet compared reads "No changes inside this area so far" and offers no disclosure.
- **Then asked:** *in spec driven comparison: upload an Excel workbook, pick a sheet on the left and the PDF page to compare it to on the right.*
- **Then done:** `src/services/sheetRead.ts` reads `.xlsx`/`.xlsm`/`.csv` in the browser (JSZip + DOMParser — no spreadsheet dependency added; shared strings, inline strings, sparse columns and skipped rows all handled), `src/services/sheetSpec.ts` converts one sheet to a one-page spec by **label vocabulary rather than column position**, detecting a column layout or a block layout. Two pairing lists in `SpecTestView.tsx` (sheet → PDF page) drive the existing single-page override; the check re-runs on either choice. A conversion panel lists every skip. `docs/ARCHITECTURE.md` no longer says a workbook is rejected.
- **Caught in test, both would have shipped as false failures:** a placeholder-only wording cell left a note saying the position was still checked and then dropped the element; and `usableText` joined the literal halves around a merge field, so "Dear <<FirstName>>, your statement" asserted "Dear , your statement" — a string no generated PDF contains. Now the longest literal fragment wins, with a 4-character minimum. Sheet metadata rows ("Page size") were also being warned about as elements missing a measurement.
- **Left open:** the reviewable `extraction.json` seam in `tools/plan.md` §3.1 is not built — this is the single-pass converter, and a defeated tab is corrected in the exported JSON rather than in a persisted middle artifact. The Python converter named in that plan is still absent from this tree.
- **Then asked:** *separate the compare and spec-driven code so there is no overlap — spec-driven is developed on an office laptop that can read the spec files but cannot push, and only downloads zips.*
- **Then done:** the whole feature moved to `src/features/spec/` (13 files, `git mv` where tracked so history follows): view, export menu, store, checker, exporter, both sheet modules, types, its own `spec.css`, its own `pdfjs.ts`, and two barrels — `index.ts` for the app, `engine.ts` for the CLI. 172 lines of spec CSS lifted out of `src/styles.css`. `scripts/check-boundary.sh` enforces five rules and was tested by breaking each one. `src/features/spec/README.md` holds the contract, the dependency allow-list and the zip protocol in both directions; CLAUDE.md and ARCHITECTURE.md point at it.
- **Caught while splitting:** the new sheet-to-page panes had taken `.pair-list` and `.pair-row`, which Batch compare already owned — everything the feature defines is now prefixed `sp-`, which is also what makes the boundary checkable. And `cli/verify/spec-target.ts` imported `src/services/specCheck`, so the move broke the CLI; it now imports the headless barrel. CLI verify:spec 8/8, verify:regression clean.
- **Decided:** `pdfjs.ts` duplicates ~10 lines of `pdfCompare.ts` on purpose rather than keep one shared file across the boundary. `src/flags.ts` and the design tokens stay shared but **read-only** from the spec side; adding a new flag needs the app side.
- **The one case this cannot absorb:** if both machines change the folder between zips, replacement throws one side away. The README says to decide which side wins before unzipping, and to check `git log -- src/features/spec` first.
- **Corrected by Siddharth:** the handoff is **one way**, not a folder zip coming back. This machine pushes to GitHub; the office machine downloads a zip, works on `src/features/spec/` only, and cannot send anything out. So the copy of that folder in this repository is a **stale mirror** and must not be edited here.
- **Then done:** `scripts/update-from-zip.sh` — run on the office machine, it backs the feature up to `.spec-backup/<stamp>/`, replaces everything else from the zip, discards the zip's stale copy of the folder, and preserves `node_modules`, `flag.env` and `.git`. Files deleted upstream disappear locally too. README, CLAUDE.md and ARCHITECTURE.md rewritten for the real direction, including the stale-mirror rule and a `git init` baseline on the office machine, since a zip has no history and that folder becomes the only copy of real work.
- **Caught in test, on Windows:** the script moved `scripts/` aside before wiping, which fails with Permission denied because Git Bash holds a lock on the running file. It now re-execs from a temp copy. Verified on a throwaway clone: office work survived untouched, the zip's stale copy did not leak in, a new upstream file arrived, a file deleted upstream was removed locally, `node_modules`/`flag.env` kept, backup written.
- **Raised, not solved:** nothing backs up the office copy off that machine. The local git baseline and `.spec-backup/` are the only safety net available while files cannot leave it.
- **Next:** file the compare-tab feature stream as an OPEN-WORK item (or fold it into W-01) and commit it.

---

## 2026-10-16 — W-03: Python CLI removed; spec records committed  ·  Cowork (Opus 5.5)

- **Asked:** *continue, mac shell is up.*
- **Done:** committed the spec records and items (ca83f3e). W-03: `git rm -r cli-py`; `docs/ARCHITECTURE.md` Python section, contents link and diagram-01 node removed; `01-system-overview.svg` re-rendered, `17-cli-python-wrapper.svg` removed; presentation slide and script now "two front ends"; `CLAUDE.md`, register (SR-STACK-TYPESCRIPT built), Ownership row, registry, `tools/plan.md`, proposal. W-03 archived.
- **Decided / left open:** inbox still holds Python in dev-only scripts. SVG files keep their numbers (18 not renumbered).
- **Mistakes:** none.
- **Next:** W-05.

## 2026-10-16 — Excel-spec rulings → four records and four work items  ·  Cowork (Opus 5.5)

- **Asked:** *is anything still open? If not, create the records for what we talked about and file the work items.*
- **Done:** [SR-SPEC-INTAKE](../records/0101_SPEC-intake.md), [SR-SPEC-CHECK](../records/0102_SPEC-check.md), [SR-CONSTANTS](../records/0103_CONSTANTS.md), [SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md) — accepted, not built. W-02 rescoped to intake (🟡 on W-05); W-03 remove `cli-py/` (🟢), W-04 spec checker (🟡 on W-05), W-05 constants file (🟢). Register, Ownership (spec paths off W-01; `cli-py/` → W-03) and Describes tables; proposal graduated, open questions struck; BACKLOG B-008–B-012; glossary; registry; INTERVIEW; NOW; IMPLEMENTATION. Uncommitted — device shell unreachable.
- **Decided / left open:** Arpit, by voice, 2026-10-16: `.xlsx` + JSON only; literals only; hidden content skipped and listed (listed hidden sheet = warning); 100 MB raw / 500 MB unzipped; ranges are tolerance bands; normalised wording passes with a note; Pages List order — out of order or extra = warning, missing Required = error; Description column human-only; template v2 plus legacy; JSON is the only engine input, downloadable; one constants file; TypeScript only; remove `cli-py/`; uploader owns freshness; stale-pair, Draft/Ready and version diff to backlog. **Left open (inbox):** Python in dev-only scripts. **Interpretation to confirm:** a file or Pages List error stops the run; an element error excludes only that element.
- **Mistakes:** `cli-py/` could not be deleted from here (no device shell) — filed as W-03 instead.
- **Next:** W-05.

## 2026-10-16 — nested-layout Excel spec + PDFs (images, graphs, tables, text)  ·  Cowork (Opus 5.5)

- **Asked:** *analyse a sample spec workbook (first sheet lists every page, then one sheet per page) and create a sample Excel and a PDF with images, graphs, tables and text — use it only as a model.*
- **Done:** [`tools/samples/excel-spec-hierarchical/`](../tools/samples/excel-spec-hierarchical/README.md) — `report-spec.xlsx` (Pages List + sheets 1–4, nested merged-cell layout, prose values), `report.pdf` (4 landscape pages; 0.000 in off on 25 elements), `report-with-deviations.pdf` (12 deviations, 3 not detectable today), `assets/`, deterministic `generate.py`. Proposal gains *Observed spec-sheet conventions*, decision 10 widened, P1 gains the line-grouping fix, open question 4 answered. W-02 reference, IMPLEMENTATION, registry, INTERVIEW, NOW. Uncommitted — device shell unreachable.
- **Decided / left open:** all content invented; nothing from the reviewed workbook's wording is reproduced. `tools/samples/excel-spec/` was gone from the tree when this session looked — not recreated; references now point to the new sample.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit answers the inbox row; then W-02 P0.

## 2026-10-14 — sample Excel spec + PDFs for W-02  ·  Cowork (Opus 5.5)

- **Asked:** *create a sample Excel of two to three pages and create a PDF for the same.*
- **Done:** [`tools/samples/excel-spec/`](../tools/samples/excel-spec/README.md): `statement-spec.xlsx` (3 sheets = 3 pages; sections with dimensions; a grid shape and a prose shape), `statement.pdf` (matches — 0.000 in off on 23 elements, measured the app's pdf.js way), `statement-with-deviations.pdf` (9 deliberate deviations, expected findings tabled in the README), `generate.py` (one data definition → all three; deterministic). W-02 reference, IMPLEMENTATION, registry, INTERVIEW, NOW. Uncommitted — device shell unreachable.
- **Decided / left open:** placed under `tools/samples/` (where `tools/plan.md` puts worked examples), owned by W-01 like the rest of `tools/`. Standard PDF fonts, so the generator runs anywhere. Synthetic data does not answer the inbox ask for real samples.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit answers the inbox row; then W-02 P0.

## 2026-10-14 — Excel-as-spec: review, research, proposal, W-02  ·  Cowork (Opus 5.5)

- **Asked:** *review how spec driven comparison works today; research how it can be built out when PDF specs live in Excel (one sheet per page, sections, dimensions; Excel is the truth); write a proposal that becomes a record; create a work item with the diagram.*
- **Done:** [`work/proposals/excel-spec-comparison.md`](proposals/excel-spec-comparison.md) (record-shaped: today's state, 14 proposed decisions, phases P0–P6, alternatives, open questions, two diagrams with ASCII twins); [`W-02`](open/W-02-excel-spec-comparison.md) with the pipeline diagram; queue row + inbox ruling; proposals index; registry; glossary (workbook profile, spec coverage); INTERVIEW; NOW. Uncommitted — device shell unreachable; written onto whatever branch is checked out (PR #3's, per the entry below).
- **Decided / left open:** proposed an in-app, zero-dependency TypeScript xlsx reader (jszip already shipped) over the Python converter `tools/plan.md` §5 assumed — **for Siddharth or Arpit to rule**. The proposal went straight to W-02, so it has no `B-nnn` row ([SR-WORK-BACKLOG](../records/0052_WORK-backlog.md) rules 7, 23). Found: `tools/spec-from-excel.py` is referenced but absent; the upload is labelled "CSV spec" yet rejects CSV.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit answers the inbox row (samples + parser home); then W-02 P0.

## 2026-10-14 — architecture docs committed and PR opened  ·  Claude Code (Opus 5.5)

- **Asked:** *check out a new branch for architecture diagrams and records; then: commit everything and create a PR.*
- **Done:** branch `architecture-diagrams-records` cut from `work-system-setup`; committed the two Cowork sessions' work below (read first; SVGs checked for scripts — none) with W-01's item file staged for the guard, which was run by hand since it is not installed; pushed to the fork; opened PR #3 to `sid4861:main` (https://github.com/sid4861/pdf-testing-suite/pull/3). INTERVIEW, NOW and IMPLEMENTATION no longer say "uncommitted".
- **Decided / left open:** the PR stacks on PR #2 (its first four commits are #2's) — merge #2 first. The Watch notes stay unfiled, as before.
- **Mistakes:** none.
- **Next:** Siddharth or Arpit reviews and merges PR #2 then this one; install the `commit-msg` hook; then W-01.

## 2026-10-14 — standalone SVG per architecture diagram  ·  Cowork (Opus 5.5)

- **Asked:** *create individual SVGs for the architecture MD that can be viewed individually.*
- **Done:** `docs/architecture/01-…18-*.svg`, rendered from the Mermaid blocks in `docs/ARCHITECTURE.md` (mermaid 10.9.1, neutral theme, plain SVG text, white background, titled); an "Open as SVG" link under each diagram. Ownership row (W-01), registry row, W-01 DoD 4, IMPLEMENTATION, INTERVIEW, NOW. Still uncommitted — device shell unreachable.
- **Decided / left open:** the Mermaid blocks stay the source; the SVGs are rendered copies, re-rendered when a block changes (registry trigger). No render script added to the repo — left open.
- **Mistakes:** none.
- **Next:** commit `docs/` with the bookkeeping (stage `work/open/W-01-claim-components.md`); then W-01.

## 2026-10-14 — architecture diagrams added to the repo  ·  Cowork (Opus 5.5)

- **Asked:** *create architectural diagrams — high level for the UI, then detailed for each tab and the CLI commands; then: put the document in the repo.*
- **Done:** `docs/ARCHITECTURE.md` (18 Mermaid diagrams, drawn from the code; all render). Bookkeeping: Ownership row (W-01), registry row + bumps, W-01 DoD 4, IMPLEMENTATION, GLOSSARY (golden PDF, candidate, letterbox), INTERVIEW, NOW, a pointer line in `README.md`. **`CLAUDE.md` changed:** one pointer row in the state-of-play table and the `docs/` layout line (SR-WORK-DOCS decision 7a). Nothing committed — the device shell was unreachable, so no `git status` or commit was possible.
- **Decided / left open:** Markdown, not the HTML artifact, so GitHub renders it and there is one copy (L0). The doc's **Watch** notes (app vs CLI verdict thresholds differ; Node standard-font rendering; scan races; spec units; Commander exit code) are not filed as backlog rows — left to Siddharth or Arpit.
- **Mistakes:** none.
- **Next:** commit the change (stage `work/open/W-01-claim-components.md` for the guard); then W-01.

## 2026-10-13 — deciders are Siddharth OR Arpit, not both  ·  Claude Code (Opus 5.5)

- **Asked:** *it is not both — it is Siddharth or Arpit, based on who is committing the change, or whoever a block is called out on.*
- **Done:** all live wording now reads "Siddharth or Arpit" (inbox heading `## Blocked on Siddharth or Arpit`); [SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) gains decision 11 (either rules alone; default is the committer; a named blocker binds to that person); [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) gains rule 58 (inbox `who` column); INTERVIEW and the glossary updated; PR #2 description corrected. W-01's quote and the archive record now attribute the setup instructions to Arpit, who gave them.
- **Decided / left open:** the two entries below say "jointly"/"Siddharth and Arpit" — superseded by this one. The PR was opened from the fork `arpitarya/pdf-testing-suite` (https://github.com/sid4861/pdf-testing-suite/pull/2), so the "push access" next step below is done.
- **Mistakes:** I read "decider name would be arpit and siddharth" as a joint ruling; it means either one.
- **Next:** Siddharth or Arpit reviews and merges PR #2; then W-01.

## 2026-10-13 — decider name order changed  ·  Claude Code (Opus 5.5)

- **Asked:** *wherever it says Arpit and Siddharth it should say Siddharth and Arpit.*
- **Done:** every live file now reads "Siddharth and Arpit" (and "Siddharth or Arpit"), including the inbox heading `## Blocked on Siddharth and Arpit`. Commits `7619a37` and `f661947` are local only — the push was refused (`arpitarya` has read-only access to `sid4861/pdf-testing-suite`).
- **Decided / left open:** the entry below keeps its original wording (worklog is append-only); this entry corrects it. How to get the PR up (write access vs a fork) is open.
- **Mistakes:** none.
- **Next:** get push access or approve a fork, then push and open the PR.

## 2026-10-13 — the work system set up from WORK-SYSTEM.md  ·  Claude Code (Opus 5.5)

- **Asked:** *check out main, branch, and set up the work process from WORK-SYSTEM.md; deciders Arpit and Siddharth; records cover everything in the repo; do not archive anything.*
- **Done:** branch `work-system-setup`; records 0001–0003 and 0051–0060; `work/`; `docs/GLOSSARY.md`; empty `archive/`; `scripts/`; `.claude/` hooks and `settings.json`; `CLAUDE.md` (new — none existed).
- **Decided / left open:** decider is "Arpit and Siddharth" (two humans, their ruling); every tracked product path owned by W-01 until records claim it; WORK-SYSTEM.md was **not** added to the repo nor archived (ruling: archive nothing — the records are now the only home of its rules); tests deferred as B-001–B-005; template citations for B-003/B-004 corrected to real locations.
- **Mistakes:** none.
- **Next:** Arpit or Siddharth installs the commit-msg guard and commits the setup; then W-01.
