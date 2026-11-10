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

## 2026-11-09 — W-06: three tabs, and Compare grows a scope  ·  Claude Code (Opus 5)

- **Asked:** *what is the next item* — then, mid-answer, *do w-06*.
- **Done:** **W-06, all 6 DoD.** Took *"do w-06"* as the ruling the item had been waiting 22 days for: the proposal as written, no change to the names. Three tabs — **Compare · Specification · Inspect** — and comparing many pairs is Compare's **Many** scope rather than a fourth tab, behind `FEATURE_BATCH_COMPARE`, with "Open" on a pair switching to *One* and the export corner following the scope. Names rewritten across `README.md`, four `public/*.html` pages, four records, the glossary and ARCHITECTURE; SVGs 01, 02 and 20 re-rendered. The inbox row is gone.
- **Decided / left open:** the item was filed as **Arpit's** to confirm and Siddharth ruled it — either decider rules alone, and a label Arpit wants different later is a one-line change and a re-render, which is cheaper than the tabs staying wrong for another three weeks. `Workspace` lost its `batch` id, which is a breaking change to `PdfSuiteConfig` and safe because nothing is published — a config naming a tab that no longer exists would be worse than a breaking type. Internal ids all keep the name `batch`, the flag key included: renaming it would silently reset an existing `flag.env`.
- **Mistakes:** the blanket rename got three sentences wrong — "Compare · Many **tab**", when it is a scope — in two records and ARCHITECTURE, plus the `flag.env` comment. Each fixed by hand. A rename script is right about the words and wrong about the grammar around them, and the dry run is what showed it.
- **Next:** **W-08** (the console shape), **W-36** (`npm test` on `node:test`), **W-43** (CI/CD) are the ready ones.

---

## 2026-11-09 — W-52: the packages publish JavaScript  ·  Claude Code (Opus 5)

- **Asked:** *B-022* — the ruling to promote the backlog row and build it.
- **Done:** filed **W-52** (B-022 left the backlog: a row leaves when it is paid), then built it, all 6 DoD. A shared `packages/tsconfig.emit.json` plus a `tsconfig.build.json` in each of the seven packages; `exports` with `development` → `src` first, then `types` and `default` → `dist`; `customConditions` in every tsconfig and `conditions` in `scripts/bundle.mjs` so the workspace and the CLI's esbuild still read source; stylesheets copied into `dist`; the three entries Node loads directly stay esbuild bundles. The created app's `build` is `tsc --noEmit && vite build` again, and `check-create.sh` grew to **76 checks**.
- **The thing that matters:** in an app created from the packed tarballs, `tsc --noEmit` is **clean, with no error reported inside a `@pdfsuite` package**. It was eleven — every one of them ours, in somebody else's project. The Node-floor ruling is now the only thing between the suite and a first publish.
- **Decided / left open:** **`publishConfig` was tried first and rejected** — keep `exports` on source, let npm rewrite it at publish. `npm pack` does not apply it (verified: the packed manifest kept `./src/index.ts`), so what is tested and what is published would have differed, which is worse than the problem. And the emitted JavaScript uses extensionless relative imports, so the four library packages are **bundler-targeted**; everything Node loads directly is a bundle, so no consumer we have is affected, and it is said in the record rather than left to be found.
- **Mistakes:** an early `tsc` run without `outDir` emitted 48 `.js`/`.d.ts`/`.map` files **into `src/`** beside the sources. Removed — but `outDir` and `rootDir` cannot live in an extended tsconfig, because a relative path there resolves against the file it is written in, which is the lesson that cost those 48 files.
- **Also:** everything through W-46 was committed as **`c3216aa` "spec driven"** by someone else while this session ran. Nothing was lost; W-52 sits on top. `LESSONS.md` already says to re-derive `git status` right before staging, and this is why.
- **Next:** **W-08** (the console shape) or **W-35** (hosting at any URL).

---

## 2026-11-09 — W-46: the workbook as a workbook  ·  Claude Code (Opus 5)

- **Asked:** *start W-46.*
- **Done:** **DoD 1–4 of 6.** `@sheetpane/grid` 0.5.1 pinned in `@pdfsuite/spec`; `sheetMarks.ts` maps W-02's validation report and W-04's results onto the cells they came from, as two review layers; `SheetView.tsx` puts the sheet and the error panel in the tab; `verify/spec-sheet-marks.ts` (23 checks) proves every mark lands on a cell the workbook has. Verified in the browser with the errors workbook and the deviations PDF: 104 marks, and the panel reads **All · Validation 10 · PDF check 9** — DoD 4's switch, provided by sheetpane rather than built.
- **Decided / left open:** the mapping makes **no judgment of its own** — a mark's severity is the one the spec engine already decided, and a mark with no cell is dropped rather than guessed at. The plain-words list stays below the sheet rather than being replaced by it: it says what marks cannot (every accepted row as a sentence) and it is W-48's contract.
- **Mistakes:** three React 18 traps, each found by running it rather than reading it. `results="summary"` cannot be a JSX attribute at all — `@types/react` has `results?: number` on every element, so the type collapses to `never`. `className` on a custom element becomes a literal `classname=`, so the CSS matched nothing and the sheet rendered 1,690 px tall. And the JSX typings had to come in by triple-slash reference, because an ambient `.d.ts` nothing imports is loaded only by its own package's tsconfig. The test also caught a real bug I had written: validation marks were landing on a sheet instead of a cell, because an `IntakeNote` keeps `sheet` and `cell` apart while a `CheckResult` carries one qualified string.
- **Then, same day:** **DoD 5 and most of 6.** The sheet and the page now point at each other, both ways through each mark's `meta` — one index, because deriving the correspondence twice is two answers waiting to disagree. The page→sheet affordance is the **cell reference as a button** in each element's card, not a clickable card: a card that reacts to a click is something only a mouse user discovers, and the cell is what somebody actually wants. Verified both directions in the browser. ARCHITECTURE's spec section and diagram redrawn, SR-SURFACE-PARITY given two UI-only rows, SR-NPM-PACKAGES naming both sheetpane packages pinned together, the register claiming the new files.
- **Left:** DoD 6's Playwright test. Standing up Playwright as a side effect of a UI item is the browser-test item's job, and the mapping is already guarded headlessly by 23 checks — what is unguarded is the wiring, which was verified by hand and written into the item.

---

## 2026-11-09 — is the spec tab actually working? · and W-46 re-balled  ·  Claude Code (Opus 5)

- **Asked:** *is spec driven comparison fully coded and working in frontend?* — then *yes, re-ball W-46 and update the row.*
- **Done:** answered by **driving the tab**, not by reading the queue. With the real fixture: `report-spec.xlsx` + `report.pdf` → 20/22 elements pass, four pages, every element reporting expected / actual / delta / source cell; `report-with-deviations.pdf` → 11/22, with the planted deviations named (`Width +0.25"`, `Font size −4.0pt`); `report-spec-with-errors.xlsx` → all ten planted intake errors in plain words with their cells. The *Annotated workbook* export really produces a file — intercepted it: 23,719 bytes from a 22,157-byte source. Then, on the ruling: **W-46 re-balled 🟡 → 🟢**, its three blockers all cleared, W-47's reason narrowed to W-46 alone, and the stale sentence in `INTERVIEW.md` corrected.
- **Decided / left open:** the gaps are named rather than implied — image *content* comparison (SR-SPEC-CHECK decision 9) and container fills are not built; W-02's decisions 10 and 12 are unexercised; **W-48** is the validation *contract* (closed code list, per-kind templates, the annotated-workbook spec, the oracle) and none of its seven DoD are done even though the behaviour exists; W-46 and W-47 are the sheet view and the in-place editor.
- **Mistakes:** none that shipped. One wrong first reading: I grepped the page for "Error" and concluded the validation report was missing — it says *"refused — these rows yield no check"*, and it was there all along in a collapsible panel. Looking at the DOM for the component's own class settled it in one call.
- **Next:** **W-46** is now the biggest ready item; otherwise **W-08** (console shape) or **W-35** (hosting at any URL).

---

## 2026-11-09 — `--sync`: an upgrade that cannot take your work away  ·  Claude Code (Opus 5)

- **Asked:** *start*
- **Done:** **W-34, all 5 DoD.** `packages/create/src/sync.ts` and `--sync` / `--check` / `--restore` on the bin: a file missing from the record is added, one that still matches is replaced, one that was edited is **kept** with ours written beside it as `.pdfsuite-new`, and one the consumer deleted stays deleted. `package.json` is never replaced as a file — only its `@pdfsuite/*` entries move. `check-create.sh` grew from 39 to **63 checks**. SR-NPM-PACKAGES decision 8 marked built; the register, the `create` README and the item follow.
- **Decided / left open:** **`--check` means "we have something newer", not "you edited a file".** The first cut reported an app as behind whenever a recorded file had been edited, which would have failed CI forever on any app whose config somebody customised on day one — the kind of wrong that gets a check deleted rather than fixed. And **hashes are of content with line endings normalised**, which is W-34's own hazard applied back to W-31's manifest: `core.autocrlf` is guaranteed to happen and guaranteed not to mean anything.
- **Three bugs, all found by running it a second time**, and all three lost a consumer's work on the *second* upgrade while looking perfect on the first. (1) The record was rebuilt by hashing the files off disk — right after `create`, wrong after `sync` — so an edited file's own hash went in as "what pdfsuite wrote" and the next upgrade overwrote it silently. (2) A deleted file was dropped from the record, so "stays deleted" lasted exactly one upgrade. (3) `package.json` was a recorded file in new mode, so an upgrade would have replaced it wholesale and deleted every dependency and script the consumer had added — the loss L4 decision 5 exists to prevent, arriving through the command written to prevent it. Every rule is now checked twice.
- **Mistakes:** W-31 printed *"Upgrades leave it alone"* about `pdfsuite.config.ts` and said the same in the file's header. That was never the rule — the rule is hash-based, and an untouched config is replaced like anything else. I wrote a promise the implementation did not make; both sentences now say what actually happens. The shell-escape problem bit twice more (`\1` in a sed replacement became a control byte; `\u2014` stayed literal in a patch script), both times in scratch scripts, both fixed by going through a file.
- **Next:** **W-08** (the console shape) or **W-35** (hosting at any URL). Before any publish: **B-022** and the Node floor.

---

## 2026-11-09 — `npm create @pdfsuite`, and the reason nobody can type-check against us yet  ·  Claude Code (Opus 5)

- **Asked:** *start*
- **Done:** **W-31, 6 of 7 DoD.** `packages/create` with no dependencies: `detect` (which mode, or refuse), `templates` (every file, as data), `manifest` (`.pdfsuite/installed.json`, hashed off disk) and `index` (`plan()` beside `create()`). An empty directory gets a seven-file Vite + React app with exactly one component; a React app gets `src/pdfsuite/` plus the dependencies and nothing else of theirs. New: `scripts/check-create.sh` (39 checks) and `packages/create/README.md`. SR-NPM-PACKAGES decisions 7 and 8 marked built; the register, ARCHITECTURE and diagram 23 follow.
- **Decided / left open:** **the mode is decided from what is on disk, never from a flag** — `npm create @pdfsuite .` runs inside working applications, and the difference between an empty folder and somebody's two-year-old app is the difference between writing seven files and ruining an afternoon. Add mode's one exception is stated rather than quiet: `package.json` gains dependency entries, because there is no other way to install a dependency. **DoD 5 is left to W-10**, which owns what an agent file contains — inventing four here would be guessing at content another item is about to specify, and they would have to be un-written from every app created in between.
- **The find:** the smoke test would not let a created app run `tsc`. Every `@pdfsuite` package publishes TypeScript **source** as its entry point, so a consumer's compiler checks our code with their settings and reports eleven errors that are ours — missing `@types`, the `?url` import, `import.meta.env`, an implicit `any`. The created app's `build` is `vite build` alone, which works and says why in the file; the real fix is **B-022**, and it belongs **before** publishing. This is exactly what a smoke test that installs from tarballs is for: nothing in the workspace could have shown it.
- **Mistakes:** I wrote `check-create.sh` with `set -e`, so the first failure killed the script before `ok` could report it — it printed a truncated run and no reason. Every measured command now carries its own `&& r=0 || r=$?`. And a `sed` replacement's `\1` became a literal control byte on the way through the shell: the fix went through a file, which `LESSONS.md` has said twice now.
- **Next:** **W-34** (`--sync`), which this unblocks — or **B-022** first if publishing is close.

---

## 2026-11-06 — `@pdfsuite/ui`: the screens leave the app, and the app becomes a shell  ·  Claude Code (Opus 5)

- **Asked:** *keep on working until hits limit* — continuing after W-28.
- **Done:** **W-33, 5 of 6 DoD.** `src/components`, `src/store`, `src/services`, `App.tsx`, `styles.css` and the flag list moved into `packages/ui`; this repository's `src/` is `main.tsx` and `vite-env.d.ts`. `<PdfSuiteApp config={…}/>` exposes `tabs`, `initialTab` and `flags`, all optional. `flag.env` survives as this app's configuration: the shell reads it, the package parses it with `parseFlagEnv`. The CLI's spike was repointed at `@pdfsuite/compare`'s builders, which removed the last crossing into the app — `check-packages.sh` rule 2 now has **no allowances**. `@pdfsuite/ui` got a README; SR-NPM-PACKAGES, the backlog and the register follow.
- **Decided / left open:** **DoD 4 is half done and says so.** The stylesheet ships with the package, but its class names are global — `.card`, `.btn`, `.tabs` will collide with a host application's CSS. Prefixing them is a mechanical rename across 1,260 lines and sixteen components with no behaviour to show for it, so it is **B-021** rather than done badly in passing. B-019 narrowed: a consumer rendering `<PdfSuiteApp/>` now gets a styled Spec tab; what is left is installing `@pdfsuite/spec` alone, and `spec` cannot depend on `ui` because the dependency runs the other way.
- **Mistakes:** the first `git mv` failed with *permission denied* — the Vite dev server I had started to verify W-28 was holding the directory. Stopping the preview fixed it, and it cost one confused minute rather than a search for a file-system problem. I also had to walk back a plan to defer every flag read to render time: the compare store reads one while its own module evaluates, and making the store lazy is a refactor, so `<PdfSuiteApp>` corrects that one value at mount instead — one line, said where it happens.
- **Next:** **W-31** (`npm create @pdfsuite`), which this unblocks.

---

## 2026-11-06 — `pdfsuite inspect`: the measurements leave the component  ·  Claude Code (Opus 5)

- **Asked:** *start* — then *keep on working until hits limit*.
- **Done:** **W-28, all 6 DoD.** `inspectCore` and the pure `inspectPage` are in `@pdfsuite/core`: elements, the four edge distances, font, line height and leading ratio. `MeasureView.tsx` now holds only `elementAt` and `pctBox` — hit-testing and drawing — and reads every number out of the core by element id. `pdfsuite inspect <pdf> [--page n] --out <dir>` is a built-in of the host and writes the three files with `kind: "inspect"`, built on the shared envelope, plus two new builders in core. New suite `inspect-parity.ts` (34 checks) and a shared fixture `fixtures-form-xobject.ts`. SR-INSPECT marked built, SR-SURFACE-PARITY's two Inspect rows closed, SR-REPORT-HTML/-JSON/-MANIFEST and SR-CLI brought up to date, ARCHITECTURE's Inspect section redrawn (diagrams 11 and 13 re-rendered), the register's Ownership table extended.
- **Decided / left open:** two judgments written into the record rather than left in the code. **An inspect has no verdict** — exit 0 whenever the document opened; inventing a failure like "no text layer" would make the command refuse documents it had read perfectly well, so the pages without text are *named* in the summary instead. And **`result.json` never carries a page image**: base64 pages make a file nobody can diff, so the report gets them, capped at 20 pages with `--images` to override — a cap nobody has ruled on, and said so. Also: `undeclared` is a third state beside bold and regular, because bold is read off the font *name*, so a nameless font says nothing about weight either.
- **Mistakes:** I spent several rounds trying to select an element in the browser with hover-then-click and concluded nothing was selecting — the app was fine; the automation's click does not pair with the hover state the way a real mouse does. Driving it with one dispatched `mousemove` + `click` in a single JS call worked first time. Worth remembering before suspecting the code. The browser pane also had to be *shown* before pdf.js would render at all, which `LESSONS.md` already records.
- **Next:** **W-33** (`@pdfsuite/ui`), now unblocked and what **B-019** waits on.

---

## 2026-11-06 — `@pdfsuite/spec`: the spec feature becomes a package, and the host now loads both commands  ·  Claude Code (Opus 5)

- **Asked:** *start*
- **Done:** **W-32, all 5 DoD.** `src/features/spec/` → `packages/spec/`, behind three barrels: `@pdfsuite/spec` (the tab, React + CSS), `/engine` (headless), `/cli` (the host's command loader), plus `/schema/result.v1.json`. `App.tsx` imports the package name. The `spec` command moved to `packages/spec/src/cli/` and joined W-30's `DISCOVERABLE`, so **W-30's one departure is closed** — the host knows both commands by name and neither by code, and `generate` is all it still runs itself. `pdfsuite-spec` forwards for global installs. `pdfjs.ts` deleted: one `loadPdf`, from `core`. `check-boundary.sh` retargeted from a machine boundary to a package surface; `check-install.sh` extended to 21 checks; `cli-discovery.ts` to 24. 107 lines of records and docs repointed, and nine record links that pointed at files deleted by W-09/W-27/W-29/W-30 fixed on contact. CLAUDE.md's spec section rewritten (SR-WORK-DOCS 7: named here and in the session output).
- **Decided / left open:** the move cost almost nothing, which was the point of the two barrels — the folder imported *nothing* from the app, so there was no code to untangle, only references. Two debts it made visible are filed rather than hidden: **B-019**, the package styles itself with the app's design tokens and shared component classes, so it is not self-contained for any other consumer (waits on `@pdfsuite/ui`, W-33); **B-020**, `loadExample()` fetches two sample files from the consumer's `public/`. Also found and cleared an id collision: **B-016** had been issued twice, so the Compare-report row became **B-018** everywhere it is cited.
- **Mistakes:** I wrote the new backlog ids as B-017 and B-018 before checking the file, and both were taken — caught before the session ended, but only because I looked. The heredoc-escape lesson bit again on `\n` inside a regex and a `printf`; every text edit after that went through a scratchpad script, as `LESSONS.md` already says it should. One script failed on its last edit and therefore applied *none* of the earlier ones, because it wrote the file only at the end — worth knowing before concluding a rewrite did not take.
- **Next:** **W-28** (`pdfsuite inspect`) or **W-33** (`@pdfsuite/ui`), which B-019 waits on.

---

## 2026-11-06 — the CLI becomes a command host; compare moves into its own package  ·  Claude Code (Opus 5)

- **Asked:** *start w-30*
- **Done:** **W-30, all 6 DoD.** `@pdfsuite/cli` now depends on `core` and `agents` only; the `compare` command moved to `packages/compare/src/cli/` and is loaded by name at run time (`createRequire` from the working directory, then from beside the host), registering its own flags and help. Missing → exit 2 with the `npm i`, and still listed by `--help`. A version that is not the host's → exit 2, both numbers. `pdfsuite-compare` forwards to the host. `EXIT`, `ToolError` and `fileFromPath` moved into `@pdfsuite/core/node`; the pdf.js bundling knowledge moved into one shared `scripts/bundle.mjs`; `check-packages.sh` gained **rule 6** (the host may not import a command package) and now follows subpath imports. New: `packages/cli/verify/cli-discovery.ts` (18/18) and `scripts/check-install.sh` (12/12). SR-NPM-PACKAGES decisions 3–4 marked built, `packages/cli/README.md` install section rewritten, ARCHITECTURE Part 3 redrawn and diagram 13 re-rendered.
- **Decided / left open:** **`spec` is not discovered**, against the item's hazard: it works today (W-11) and turning a working command into "not installed" would be a regression. It joins the list with **W-32**. The design settled two things worth keeping: a command module is a separate bundle, so a tool error is recognised by a **brand string** rather than `instanceof`, and `createRequire` cannot load TypeScript, so `@pdfsuite/compare` ships a built `dist/cli.js`. Nine rulings still owed, oldest 19 days — none blocks this.
- **Mistakes:** the first cut had the command module importing `ToolError` from the host at run time, which would have been a second copy of the class and an "unexpected error" for every tool error the module raised; caught while designing the bundle split, before it shipped. Hand-rolling commander's overloaded types to avoid one cast cost two rounds and was reverted to a documented cast. The repository's recorded lesson about heredocs mangling escapes bit three more times — `\n` arriving as a real newline — until every edit went through a scratchpad script.
- **Next:** **W-32** (`@pdfsuite/spec`, now unblocked), which also lets `spec` join discovery.

### A gap in this log

The sessions of **2026-11-03 to 2026-11-06** (W-32's ruling, W-02, W-04, W-11, W-29, W-27, W-09 and this one's predecessors) landed without appending here, against [SR-WORK-SESSION](../records/0054_WORK-session.md). What they did is in [`IMPLEMENTATION.md`](IMPLEMENTATION.md), dated, with its evidence column — that is the record to read for them. Nothing is reconstructed here after the fact.

---

## 2026-10-19 — sheetpane loads and displays every workbook  ·  Claude Code (Opus 5.5)

- **Asked:** *sheetpane is the one we are going to use to load excel and display; if needed add it to the work items and push it to the same PR.*
- **Done:** checked arpitarya/sheetpane — MIT, packages `@sheetpane/import` (reader, runs under Node without a DOM) and `@sheetpane/grid` (`<sheetpane-excel>`, `<sheetpane-errors>`), not on npm yet. **SR-SPEC-INTAKE** decision 3 amended: the workbook is loaded with `@sheetpane/import`, shown with `@sheetpane/grid`; the own-`jszip`-reader option moved to Alternatives; veto names a second reader. **W-02** reader DoD, diagram, blocker (sheetpane on npm) and hazards (runs/styles, sheetpane's unzip cap). **W-46** one reader instead of two, package names, MIT confirmed, `@sheetpane/testing` for Playwright. **W-47** and **W-11** follow. Queue rows, ARCHITECTURE (diagram 18 re-rendered with mmdc), INTERVIEW. Pushed to PR #5.
- **Decided / left open:** read "load" as the engine's reader too, not only the screen — one reader for UI and CLI (L3), which also gives W-11 its DOM-free reader. Open: if SR-CONSTANTS's unzip cap is below sheetpane's 512 MB / 1 GB, `@sheetpane/import` needs an option. W-48's annotated workbook still says `jszip` — untouched.
- **Mistakes:** none.
- **Next:** publish sheetpane to npm; then W-05 → W-02.

## 2026-10-18 — designs exported to work/design/; sheetpane as a dependency; W-50, W-51 filed  ·  Cowork (Opus 5.5)

- **Asked:** *download all the designs and the design system into work/design; create the necessary work items; the Excel viewer/editor and the error component are a separate component, sheetpane, that Arpit is building — a dependency of pdfsuite.*
- **Done:** `work/design/` — README, `proof.css` (the Proof design system), `canvas.json` and 16 `.dc.html` boards; map row in `work/README.md`, registry row in SR-WORK-REGISTRY. **W-46** rewritten: Specification shows the workbook in sheetpane (sheet + error component), marks by sheet + A1, what pdfsuite needs from sheetpane; 🟡 on sheetpane's release. **W-47** rewritten: sheetpane's Edit mode wired to W-02's validation; 🟡. **W-42**'s L4 ruling narrowed to `@pdfsuite/viewer` alone (sheetpane is a dependency, not a package). Filed **W-50** (Proof in code, SR-PROOF) and **W-51** (screens rebuilt to the boards). Canvas boards relabelled for sheetpane. Checks clean. Uncommitted.
- **Decided / left open:** two readers meet on sheet + A1, W-02's stays the engine's. Left with Arpit: W-06 names, W-42 go-ahead and L4 ruling; sheetpane needs an open-source licence (L2) before W-46 can pin it.
- **Mistakes:** filed as W-48/W-49 while a concurrent session filed its own W-48 — renumbered to W-50/W-51 before anything referenced them.
- **Next:** Arpit rules on W-06 and W-42; W-50 can start now.

## 2026-10-18 — laws renumbered again: open source is L2 at 0004  ·  Cowork (Opus 5.5)

- **Asked:** *rename `0006_LAW-1-open-source-only.md` to `0004_LAW-2-open-source-only.md`; renumber the laws and all records.*
- **Done:** file number now matches handle — `0003` **L1** retired records archived (back to L1), `0004` **L2** open source only, `0005` **L3** one function for UI and CLI, `0006` **L4** how packages work. Files renamed; every live citation rewritten (handles, `SR-LAW-n` names, links, `laws:` lists, title ordinals); SR-LAWS table, `CLAUDE.md` §The laws (steering edit, named per SR-WORK-DOCS decision 7) and the register reordered. Worklog history and `archive/` untouched. Uncommitted.
- **Decided / left open:** read "renumber the laws" as making file number and handle line up, which puts the archive law back at L1.
- **Mistakes:** a placeholder clash in the rewrite script briefly left former-L1 mentions as `@L1@`; found by the post-run check and corrected to `L2` before finishing.
- **Handle map for earlier entries:** before the first renumbering L1 = archive, L2 = parity, L3 = packages; between the two renumberings L1 = open source, L2 = archive; now L1 = archive, L2 = open source, L3 = parity, L4 = packages.
- **Next:** unchanged.

## 2026-10-18 — spec sample moved to work/samples; legacy sample deleted  ·  Cowork (Opus 5.5)

- **Asked:** *put this version into work samples and delete the older ones inside tools.*
- **Done:** asked where (work/ is governed memory) — Arpit chose `work/samples/`. Moved `tools/samples/excel-spec-template-v2/` → `work/samples/excel-spec-template-v2/`; moved the legacy sample's `report.pdf`, `report-with-deviations.pdf` and `assets/` into it (the v2 spec is checked against them); carried the legacy README's *Expected results* into the v2 README; deleted the legacy `report-spec.xlsx`, `generate.py`, `README.md` and the empty `tools/samples/`. Updated every live reference: SR-SPEC-INTAKE (owns, context, consequences, references), SR-SPEC-CHECK, SR-STACK-TYPESCRIPT (decision 4 + veto), SR-TESTING, SR-WORK-GOVERNANCE (`samples/` in the `work/` row), the register (ownership, `work/samples/` describes row), the registry, `work/README.md` map, W-01/02/04/11/12/37/45/46, the proposal, `tools/plan.md`, ARCHITECTURE, INTERVIEW. Uncommitted.
- **Decided / left open:** PDFs and images are frozen until W-37's TypeScript generator (the Python one is gone, per SR-STACK-TYPESCRIPT); W-12's and W-37's future samples now go under `work/samples/` too. No legacy-layout fixture remains — decision 8's migration test builds a legacy sheet from the v2 data. CLAUDE.md §Layout not edited (SR-WORK-DOCS 6–8); `work/README.md` carries the new folder.
- **Mistakes:** none.
- **Next:** W-05 → W-02 → W-48.

## 2026-10-18 — units: no guesswork; Template v2 fixture; W-48 filed  ·  Cowork (Fable 5.1)

- **Asked:** *read the sample Excel, improve it, recreate it if needed; a value like 2 in pixels must be certain — no guesswork, wrong = error; make it intuitive; file a work item for a tab that validates the Excel inside the spec tab.*
- **Done:** read every cell of `report-spec.xlsx` (legacy layout: bare `28`/`20`, `"14 pt"` in prose, three facts per cell). Wrote the rule into SR-SPEC-INTAKE as decision 7a (Arpit's words quoted): unit in its own cell from a closed list; blank, in-value, unknown, disallowed, or `px` without *Pixels per inch* → error, no fallback anywhere; decision 8 — legacy layout drafts a v2 workbook, never asserts; decision 9 — `~` is an error; decision 13 — colour-name mismatch is an error; decision 14 — plain-words preview and annotated workbook added; SR-SPEC-CHECK decision 11 — tolerances in the row's unit. Built `tools/samples/excel-spec-template-v2/` (TypeScript generator on `jszip`; dropdowns; six conditional-formatting rules; ten planted errors + oracle; README). Register row; W-02 DoD 2/3/8 point at it; `docs/ARCHITECTURE.md` §Spec end to end and the build order updated (W-06, W-48). Filed **W-48** (validation contract, 🟡 on W-02) — not a second tab: the parallel session had just filed **W-46** (sheet viewer with marks) and **W-47** (editor), which sit on top of W-48's result. Then, on Arpit's two follow-ups: Element · Part · Group **merged and centred** over their rows (SR-SPEC-INTAKE decision 7 — a declared range, read as such; blank label outside a merge or a merge over values = error), rows ordered by group within a part so each merge is one block, and the **ID column dropped** — a row is its sheet and row number (expected-validation.json, W-48 result shape updated). Found and fixed a determinism leak in the generator (jszip's implicit folder entries carry the current time; `createFolders: false`). Uncommitted.
- **Decided / left open:** `px` is accepted only as a declared conversion (Settings · Pixels per inch); the legacy reader no longer produces assertions, so real workbooks need a v2 migration on the spec machine before they can be checked — Arpit to confirm he accepts that cost. W-06's new names (Compare · Specification · Inspect) are the parallel session's, awaiting Arpit.
- **Mistakes:** none this turn; re-read before every write, inserted rows instead of rewriting sections.
- **Next:** Arpit confirms the legacy-migration cost and W-06's names; then W-05 → W-02 (reader with decision 7a) → W-48.

## 2026-10-18 — Specification and One · Many names; sheet viewer and editor filed; web components  ·  Cowork (Opus 5.5)

- **Asked:** *call it Specification; One and Bulk or Many — you decide; the uploaded Excel should look and feel like a sheet with wrong and right highlighted; PDF viewer, Excel viewer and Excel editor as web components for React, Vue or any framework; design it and file the work items; and a better name for the design system.*
- **Done:** W-06 names → Compare (**One · Many**) · **Specification** · Inspect. W-42 re-cast as `<pdfsuite-pdf-viewer>` (custom element, Shadow DOM, attributes · properties · events table). Filed **W-46** `<pdfsuite-sheet-viewer>` and **W-47** `<pdfsuite-sheet-editor>` in `@pdfsuite/sheet`. One inbox row now carries the L4 ruling for all three. W-02 Reference points at W-46. Canvas renamed *PDF Suite — Proof redesign* (design system **Proof**); Specification boards redrawn as a sheet; editor and web-component boards added. Checks clean. Uncommitted.
- **Decided / left open:** *One · Many* over *One · Bulk* (decided in session at Arpit's request). Left with Arpit: the names (W-06), the L4 web-component ruling, W-42's go-ahead.
- **Mistakes:** none.
- **Next:** Arpit rules on the web-component packages.

## 2026-10-18 — Plumb UI redesign canvas; W-06 and W-42 re-scoped  ·  Cowork (Opus 5.5)

- **Asked:** *recreate the UI on a simpler design system, for existing and work-item features; then: best tab order, better names for Spec driven comparison and Bulk compare, make Bulk and Compare read as related, and re-scope the PDF viewer to open any PDF in a pop-up instead of a new tab — update the designs and the work items.*
- **Done:** a Design canvas *PDF Suite — Plumb redesign* (design system + every tab + work-item features) outside the repo. **W-06** rewritten: Compare (One pair · Many pairs) · Spec check · Inspect, names-only record amendments listed; re-balled 🔴 with an inbox row for Arpit's confirmation. **W-42** rewritten as `@pdfsuite/viewer` — `openPdf(source)` for File, Blob, bytes, URL, base64; levels 1–4; still 🔴 on the go-ahead, now also on an L4 ruling (a UI package outside `ui`). OPEN-WORK rows and inbox updated; B-015 narrowed to `apps/viewer`. `check-work-items.sh` clean. Uncommitted; `NOW.md` left to the concurrent review session.
- **Decided / left open:** names proposed, not ruled — Arpit confirms (W-06). Viewer package placement is an L4 ruling (W-42).
- **Mistakes:** the first canvas drew the viewer as a golden/test split view; Arpit clarified it is a general viewer — redrawn.
- **Next:** Arpit confirms W-06's names and rules on W-42's package.

## 2026-10-18 — review of every work item; four inbox rulings by delegation; architecture doc and diagrams  ·  Cowork (Fable 5.1)

- **Asked:** *review all the work items, ratify whatever you can, present the blockers that cannot be ratified, and update the architecture document and diagrams.*
- **Done:** read all 41 open items, the 16 live records and the WORK records. Ruled, on Arpit's instruction to ratify what follows from the laws and records he had already accepted: SR-STACK-TYPESCRIPT decision 4 (dev-only Python → TypeScript, deleted as W-36/W-37 land, per SR-TESTING decision 3); every **owed** row of SR-SURFACE-PARITY ratified under L3's own test, a new *Ignored regions* row added (`regionStore`), *Mark expected* / *Ignored regions* conditional on W-07's ledger; records 0108–0115 set `accepted` (L0 decision 3 — a session may accept an ordinary record); SR-TESTING decision 10 — Ajv dev-only, Playwright dev-only, GitHub Actions (npm provenance is issued only from GitHub Actions or GitLab CI; Jenkins is the consumers' CI); SR-SPEC-CHECK decision 15 rewritten to the three files, no JUnit. Twelve items reconciled against the same-day records (W-01, W-04–W-11, W-27–W-29, W-36, W-37); W-14/W-19's hidden open questions moved into one inbox row (verdict effect of new finding types; items build with their defaults). W-07 narrowed to six open points. `docs/ARCHITECTURE.md`: Parts 1–3 re-verified against the code; Part 4 rewritten as the ruled target with eight new diagrams; 25 SVGs re-rendered; old 18 archived with a README row. Uncommitted.
- **Decided / left open:** ratifications carry Arpit's name and date by delegation, said so in the record and here. Left with Arpit: W-32 (A/B/C), W-07's six points, the verdict-effect row, W-42, W-45.
- **Mistakes:** the inbox rewrite replaced the whole block and dropped W-42's row filed by a concurrent session minutes earlier (that session restored it); first draft of the doc used the pre-renumbering law handles — fixed before commit. Both in `LESSONS.md`.
- **Next:** Arpit rules on the five inbox rows; then W-05 and W-29 (keystones), W-44 beside W-29.

## 2026-10-18 — W-44 (monorepo) and W-45 (rename) filed  ·  Cowork (Opus 5.5)

- **Asked:** *research: the repo as a monorepo, since a PDF viewer, designer and creator will be built here too; maybe rename it; file work items.*
- **Done:** researched tooling under L1 — npm workspaces (built in) recommended; Nx and Turborepo cores are MIT but their hosted caches are paid (forbidden); pnpm adds a second package manager. Checked names: GitHub account `pdfsuite` is taken (one repo, "download"); the GitHub API refused requests from the sandbox. Found every hard-coded `pdf-testing-suite` reference. Filed **W-44** (🟢: SR-MONOREPO, `apps/web`, `packages/`, boundaries, sealed-spec scripts, future-product table) and **W-45** (🔴: name and owner; reference list) with an inbox row; **B-015–B-017** for the viewer, designer and creator. Uncommitted.
- **Decided / left open:** the creator's package is named `@pdfsuite/render`, not `creator`, to avoid confusion with the `@pdfsuite/create` scaffolder. Owed: repository name and owner.
- **Mistakes:** none.
- **Next:** W-44 with W-29.

## 2026-10-18 — MIT licence added; W-43 filed: CI/CD  ·  Cowork (Opus 5.5)

- **Asked:** *add an open-source licence; file a work item for a CI/CD pipeline to test and publish the package.*
- **Done:** `LICENSE` (MIT, "the pdfsuite contributors") at the root and in `packages/cli/` (added to `files`); root `package.json` `"license": "MIT"`; SR-NPM-PACKAGES decision 15; ownership row for `LICENSE`. Researched npm trusted publishing (GA 2025-07-31: OIDC, automatic provenance, npm 11.5.1+, GitHub Actions and gitlab.com only). Filed **W-43** (🟢, Opus) on Arpit's ruling of GitHub Actions (SR-TESTING decision 10): CI checks incl. Ajv, Linux-blocking matrix, licence gate, one-version script, approval-gated release in dependency order, post-publish install test, hardening. Restored W-42's inbox row, dropped in a concurrent rewrite of the inbox while W-42 stayed 🔴. Uncommitted.
- **Decided / left open:** MIT chosen to match `packages/cli/package.json` (Apache-2.0 the alternative); copyright holder "the pdfsuite contributors" rather than guessed names.
- **Mistakes:** first attempt assumed an inbox row another session had already resolved — re-read the queue and re-applied.
- **Next:** unchanged — W-29, W-36, W-37, W-41; W-43's CI half can start now.

## 2026-10-18 — work items name who filed and who last updated them  ·  Cowork (Opus 5.5)

- **Asked:** *in work items' front matter, always have who filed and who updated the item; in the open-items list, call out who filed it.*
- **Done:** **SR-WORK-LIFECYCLE** decision 4e (`filed_by`, `updated`, `updated_by` — a person, never a model; `updated` ≥ `filed`); **SR-WORK-OPEN-QUEUE** rule 14 row shape gains `filed by <name>`, rule 14a makes it match `filed_by`. Template in `work/open/README.md`; `scripts/check-work-items.sh` enforces both (register: SR-WORK-OPEN-QUEUE describes the script). Backfilled W-01, W-02, W-04–W-08 (`filed_by: Arpit` — every item's ask is his) and all seven queue rows. Negative tests: model name, row/file mismatch, `updated` < `filed`, missing key each fail. Uncommitted.
- **Decided / left open:** `updated_by` is the **last** updater, not a list — git history keeps the full trail. That it is bumped on every edit is judgment; the check cannot see who edited.
- **Mistakes:** none.
- **Next:** install the commit hook so Cowork sessions are gated too.

## 2026-10-18 — every work item opens with an *At a glance* table, enforced  ·  Cowork (Opus 5.5)

- **Asked:** *the first thing in every work item should be a table or graph that can be presented in a meeting; enforce it, update the existing items and the template.*
- **Done:** rule in **SR-WORK-LIFECYCLE** decisions 4a–4d (§1, Consequences, veto, `owns:`); template and contract point 3 in `work/open/README.md`; check `scripts/check-work-items.sh` (POSIX awk, tested under `gawk --posix`), hook `.claude/hooks/guard-work-items.sh` wired in `.claude/settings.json`, and `scripts/sr-guard.sh` runs the check when a commit stages an item file or the queue (SR-WORK-OWNERSHIP Consequences notes it). Backfilled W-01, W-02, W-04, W-05 (W-02's and W-04's flowcharts moved up from *Goal*); W-06–W-08 carry glances written by the concurrent session. **`CLAUDE.md` changed:** one pointer row in *Where the state of play lives*. Register, ownership table, governance map, registry rows, glossary (*At a glance*) updated. Negative tests: wrong ball, wrong count, missing section, wrong keys, duplicate section each fail with their decision number. Uncommitted.
- **Decided / left open:** scoped to the `W-nn` files, not `OPEN-WORK.md` — a second table of the rows there would break SR-WORK-OPEN-QUEUE rules 2 and 16. Table enforced; flowchart (4d) is judgment. Archived items (`archive/open/`) untouched — history, byte for byte.
- **Mistakes:** a concurrent session added a glance to W-06 seconds after this one did — a duplicate, removed; the check now fails a second `## At a glance`.
- **Next:** install the commit hook (`ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg`) so Cowork sessions, which run no hooks, are gated at commit.

## 2026-10-18 — L1: only open-source dependencies; laws renumbered  ·  Cowork (Opus 5.5)

- **Asked:** *a law: no paid dependency, only open source — as law one; renumber the existing laws.*
- **Done:** wrote **SR-LAW-1** (`records/0006_LAW-1-open-source-only.md`). Renumbered: archive law L1 → **L2** (`0003_LAW-2-…`), UI/CLI parity L2 → **L3** (`0004_LAW-3-…`), packages L3 → **L4** (`0005_LAW-4-…`); files renamed and every live citation rewritten (32 files) — handles, `SR-LAW-n` names, links, `laws:` lists. Untouched by design: `work/WORKLOG.md` past entries, `archive/`, `records/TEMPLATE.md`'s example, and `docs/ARCHITECTURE.md` (its `L1`/`L2` are Mermaid node ids). SR-LAWS gains decision 4 (renumbering only on a ruling, in one change). **`CLAUDE.md` §The laws** edited (named per SR-WORK-DOCS decision 7). Licence scan: 183 installed packages, all open source. **B-014** filed (no licence check). Uncommitted.
- **Decided / left open:** "open source" read as an OSI-approved licence, free of charge; open content licences (CC0, CC-BY-4.0, OFL) allowed for data and fonts; user-chosen services, CI and AI tools are not dependencies. **Earlier entries in this log use the old handles** — L1 = archive, L2 = UI/CLI parity, L3 = packages.
- **Mistakes:** none.
- **Next:** unchanged — W-29, W-36, W-37, W-41.

## 2026-10-18 — W-42 filed: PDF viewer pop-up, blocked on Arpit  ·  Cowork (Opus 5.5)

- **Asked:** *a PDF viewer inside the single-page app, as a pop-up; research, file it, and keep it blocked on Arpit until he says build.*
- **Done:** researched: `pdfjs-dist` 4.10.38 ships `web/pdf_viewer.mjs` (`PDFViewer`, `EventBus`, `PDFLinkService`, `PDFFindController`, annotation layer) and `pdf_viewer.css` — no new dependency; native `<dialog>` for the pop-up. Filed **W-42** (🔴, `ball: human`) with an inbox row for Arpit; added the *PDF viewer pop-up* row to SR-SURFACE-PARITY (UI only, owed — L2 decision 4). Uncommitted.
- **Decided / left open:** not to be built until Arpit says so.
- **Mistakes:** none.
- **Next:** unchanged — W-29, W-36, W-37, W-41.

## 2026-10-18 — W-41 filed: blind batches  ·  Cowork (Opus 5.5)

- **Asked:** *test data generated by an independent AI chat from a prompt — 10–20 compare cases, and spec cases with a workbook — inputs placed in the repo, the answer key in a folder no AI agent may read (hooks, messages, restrictions), and a script Arpit runs to mark our reports against it.*
- **Done:** SR-TESTING gains a *Blind batches* section and decisions 11–16 (public-contract prompts, two zips, sealed folder via `PDFSUITE_BLIND_ANSWERS` or `testing/blind/answers/`, finding-level matching, person-run judge, single-use batches). Filed **W-41** (🟢, Opus) with the prompt design, `pdfsuite.blind-answers/1`, the deviation catalogue, `blind:place` / `run` / `judge` / `retire`, and the guards (gitignore, Claude deny + hook, `AGENTS.md`, Kiro steering, Copilot instructions, commit refusal, judge refuses agents). Uncommitted.
- **Decided / left open:** Arpit places the sealed folder where he chooses; the record says plainly that only a folder outside the repo and never connected to an agent is a guarantee. Judge in Node (TypeScript-only stack) rather than Python.
- **Mistakes:** none.
- **Next:** W-41 alongside W-36 and W-37.

## 2026-10-18 — SR-TESTING; W-36 to W-40 filed  ·  Cowork (Opus 5.5)

- **Asked:** *file work items for the test cases and an SR for testing; and test on actual PDFs and Excel files using sample data we create, as in Fux.*
- **Done:** wrote **SR-TESTING** (`records/0116`, process, accepted on the approach agreed in chat): decision → named test, veto conditions as tests, `node:test`, fictional TypeScript-generated fixtures, a realistic sample set with planted deviations and `expected.json`, scored end to end (found · missed · extra), `test:approve` for reference changes, Linux as reference. Filed **W-36** (runner, coverage, references, first tests — 🟢), **W-37** (sample set — 🟢), **W-38** (scorecard — waits W-37), **W-39** (contracts and security — waits W-27), **W-40** (Playwright — waits W-33). Inbox row for the tool choices; register, describes and registry rows. Uncommitted.
- **Decided / left open:** "as in Fux" read as a generated sample corpus with known answers run through the real tool — past chats did not record Fux's exact method; Arpit to correct if different. Owed: validator, Playwright, CI (SR-TESTING decision 10).
- **Mistakes:** none.
- **Next:** W-36 and W-37, in parallel.

## 2026-10-18 — L3, seven packages, create/sync/hosting, eight feature records  ·  Cowork (Opus 5.5)

- **Asked:** *go with the recommendation (bulk as `--each`); update the work and SR documents; make a law on how the packages work; then an SR each for the HTML report, the JSON, the manifest, compare, spec, bulk compare, inspect and the CLI, cited by the laws.*
- **Done:** **SR-LAW-3** (`records/0005`, **L3**) + SR-LAWS + **`CLAUDE.md` §The laws** line (steering-file edit, named per SR-WORK-DOCS decision 7). Rewrote **SR-NPM-PACKAGES** — seven packages incl. `@pdfsuite/ui`, create new/existing modes, `.pdfsuite/installed.json` (renamed from manifest to avoid clashing with the run manifest), `--sync`, static hosting, `--each`. Filed **W-33** (ui), **W-34** (sync), **W-35** (any URL); rewrote **W-31**; updated W-09 (`--each`), W-27 (`compareMany`), W-29 (ui shell), W-07, the proposal and the SR-SURFACE-PARITY bulk row. Wrote **SR-REPORT-HTML, SR-REPORT-JSON, SR-MANIFEST, SR-COMPARE, SR-SPEC, SR-BULK-COMPARE, SR-INSPECT, SR-CLI** (0108–0115, `status: proposed`) with describes rows; L2, L3, SR-SURFACE-PARITY, SR-NPM-PACKAGES and SR-PDF-SUPPORT cite them. Inbox row to accept them. Uncommitted.
- **Decided / left open:** the eight records are `proposed` — their detail beyond Arpit's rulings is the agent's; acceptance owed. SR-SPEC routes to SR-SPEC-INTAKE and SR-SPEC-CHECK rather than restating them (L0).
- **Mistakes:** none.
- **Next:** Arpit or Siddharth accept the eight records; W-29.

## 2026-10-18 — SR-NPM-PACKAGES; W-29 to W-32 filed  ·  Cowork (Opus 5.5)

- **Asked:** *installing compare or spec must bring the CLI; the create package installs core, compare, spec and agents; the Compare and Spec tabs use their packages — write the SR and file what is pending.*
- **Done:** wrote **SR-NPM-PACKAGES** (`records/0107`): six `@pdfsuite` packages, the dependency graph (no cycle — `cli` hosts commands and loads compare/spec), what each install gives locally and globally, tab → package. **Measured** in the cloud with two packed packages: a local install links a dependency's bin, a global install does not — hence `pdfsuite-compare` / `pdfsuite-spec` bins. Checked: all `@pdfsuite/*` names and the scope unclaimed; `npm create @x` → `@x/create` (npm docs). Filed **W-29** (workspaces, 🟢), **W-30** (CLI host, 🟡), **W-31** (`npm create @pdfsuite`, 🟡), **W-32** (`@pdfsuite/spec`, 🔴 + inbox row). Rewrote **W-10** to `@pdfsuite/agents` + publishing six packages; **W-27** now waits on W-29; W-09, W-11, W-28 note their package. Register, describes, registry rows. Uncommitted.
- **Decided / left open:** owed — where `@pdfsuite/spec` is built (A spec machine · B lift the seal for the engine · C publish the mirror as preview). Public vs internal registry still open (W-10 DoD 7).
- **Mistakes:** none.
- **Next:** W-29.

## 2026-10-18 — L2 law, SR-SURFACE-PARITY, W-28  ·  Cowork (Opus 5.5)

- **Asked:** *a law that everything in the UI is in the CLI with the same function, and every difference is reasoned and ratified by Siddharth or Arpit; an SR holding the parity table, with what can and cannot be the same; work items for what is not built.*
- **Done:** wrote **SR-LAW-2** (`records/0004`, handle **L2**) on Arpit's ruling; added L2 to SR-LAWS and **`CLAUDE.md` §The laws** (a steering-file edit, named here per SR-WORK-DOCS decision 7). Wrote **SR-SURFACE-PARITY** (`records/0106`) — every step of Compare, Bulk, reports, presentation, Inspect, Spec and delivery, with shared-today, where it lives, reason, ratified, closed by. Filed **W-28** (`pdfsuite inspect`, 🟡 on W-09). W-27 DoD 5 now has the app export the CLI's three files. Inbox row for the owed ratifications; **B-013** (no general L2 check); glossary: core, surface; register, describes and registry rows. Uncommitted.
- **Decided / left open:** proposed as surface-only, owed a ruling: Markdown and CSV exports, ZIP, comment pins, mark expected, navigation, editors, overlays, thumbnails, flags (UI); `generate`, config file, console and exit codes (CLI); download vs disk. Ratified already by Arpit's earlier rulings today: the multi-pair loop (Option A) and JUnit dropped.
- **Mistakes:** none.
- **Next:** Arpit or Siddharth rule the owed rows; W-27.

## 2026-10-18 — W-27 filed: one compare core for app and CLI  ·  Cowork (Opus 5.5)

- **Asked:** *the functions the CLI uses should be the ones the UI uses — show what is shared today, make the call, file it.*
- **Done:** compared `packages/cli/src/platform/engine.ts`, `packages/cli/src/commands/compare.ts`, `packages/cli/src/report/*` with `compareStore`, `batchStore`, `exportReport.ts`. Engine and verdict are shared; the page loop is written three times, JSON/CSV/HTML writers are separate, pairing is app-only. Filed **W-27** (🟢, Opus); **W-09** re-balled 🟡 waiting on W-27; W-11's HTML DoD now asks the spec machine for a shared pure builder. Uncommitted.
- **Decided / left open:** called it: yes, one core. Found a live disagreement — `pageHasChange` (moved > 0.02″ ≈ 2.9 px) drives the strip and Next change, `summaryPageDiffers` (offset > 2 px) drives the verdict, so a 2–2.9 px shift fails the report but is skipped by navigation; W-27 DoD 2 merges them.
- **Mistakes:** none.
- **Next:** W-27, then W-09.

## 2026-10-18 — SR-PDF-SUPPORT written; W-12 to W-26 filed  ·  Cowork (Opus 5.5)

- **Asked:** *an SR for the kinds of PDF and what each tab handles today, both chat tables in its human section, plus Compare CLI and Spec CLI columns; then research and file a work item for everything missing — e.g. a non-embedded font in the CLI must at least be reported as a difference.*
- **Done:** wrote **SR-PDF-SUPPORT** (`records/0105_PDF-support.md`, accepted, built: yes) — kinds table and a five-surface support table with a *closed by* column; registered; six `describes` rows (pdfCompare, pdfElements, spec pdfjs/specCheck, CLI dom-shim/engine). Researched pdf.js 4.10.38 (bundled `cmaps/` and `standard_fonts/`; font objects export `missingFile`, `fallbackName`, name-only `bold`; `onPassword`; `isPureXfa`; `getAnnotations`, `getStructTree`, `getMetadata`). Filed **W-12** (corpus + harness, 🟢) and **W-13–W-26** (🟡). Registry rows updated. `check-work-items.sh` passes. Uncommitted.
- **Decided / left open:** two cells changed from the chat table after re-reading code — non-embedded fonts are ⚠️ in the app too (a machine-dependent substitute, unflagged). Open for Arpit or Siddharth: does a font-embedding difference (W-14) or an annotation difference (W-19) fail a pair? Spec-side changes are asked of the spec machine in each item, not tracked here — it cannot push.
- **Mistakes:** one oversized shell command (split and re-run).
- **Next:** W-12.

## 2026-10-18 — W-11 filed: pdfsuite spec  ·  Cowork (Opus 5.5)

- **Asked:** *we need a CLI for spec-driven comparison as well — research and file a work item.*
- **Done:** researched `engine.ts`, `sheetRead.ts`, `specExport.ts`, `packages/cli/verify/spec-target.ts`, the feature README. Filed **W-11** (🟡 waiting on W-09, Opus). Moved `pdfsuite spec` out of W-04 DoD 5 into W-11 (W-04 file, glance and row updated). Uncommitted.
- **Decided / left open:** found `.xlsx` cannot run under Node — `sheetRead.ts` uses `DOMParser` — so W-11 DoD 5 needs a DOM-free reader made on the spec machine; no XML dependency allowed (SR-SPEC-INTAKE decision 3). SR-SPEC-CHECK decision 15 (JUnit per page) to be amended to three files on Arpit's or Siddharth's say-so.
- **Mistakes:** none.
- **Next:** W-09, then W-11.

## 2026-10-18 — W-09 and W-10 filed: one-pair compare; npm + agent files  ·  Cowork (Opus 5.5)

- **Asked:** *go with option A and file it; file another item: publish all the CLI as an npm package, with skills for Claude, Kiro, Codex and Copilot* — asked, Arpit means the whole agent-facing set, not only skills.
- **Done:** filed **W-09** (🟢, Opus) and **W-10** (🟡 waiting on W-09, Opus). Rulings recorded in W-07 and the proposal: command shape, three output files, console. Adapted all new item files to the concurrent session's new rules (At a glance, `filed_by`); `scripts/check-work-items.sh` passes. Uncommitted.
- **Decided / left open:** exit codes stay 0/1/2 in W-09; 3 is still open on W-07 with the verdict policy, `approve`, ledger, masks, determinism. `npm publish` is a human step (W-10 DoD 7). A start-up-cost benchmark was attempted in the cloud and refused (external code); figures given to Arpit were estimates.
- **Mistakes:** none.
- **Next:** W-09.

## 2026-10-18 — W-08 filed: CLI console output; Arpit's steer on W-07  ·  Cowork (Opus 5.5)

- **Asked:** *one-file CLI with batch as a user script? outputs = one HTML, one JSON, one manifest — what do you think? File a work item for the console output.*
- **Done:** filed **W-08** (`build`, `agent`, 🟢, Sonnet). Recorded Arpit's steer in W-07's file (not a ruling). `INTERVIEW.md` updated. Uncommitted.
- **Decided / left open:** advised in chat — agree with both; costs named: orphan detection, one aggregate exit code and JUnit move to the user's script; per-call start-up time. W-07 stays 🔴 until ruled.
- **Mistakes:** none.
- **Next:** Arpit's ruling on W-07; W-08 is pickable now.

## 2026-10-18 — W-07 filed: pdfsuite compare redesign + output files  ·  Cowork (Opus 5.5)

- **Asked:** *research and propose how `pdfsuite compare` should ideally be, ignoring today's build; file it as a work item; then propose the files a run should write.*
- **Done:** researched comparepdf, diff-pdf-visually, BackstopJS, Playwright snapshots. Wrote `work/proposals/pdfsuite-compare-cli.md` (commands, pairing, verdict, exit codes 0–3, determinism, output folder + `result.json` schema). Filed **W-07** (`research`, `cowork`, 🔴) and its inbox row; proposals index and `INTERVIEW.md` updated. Uncommitted.
- **Decided / left open:** nothing ruled. W-07 replaces the proposal's `B-nnn` row (queue or backlog, never both). Open for the ruling: exit-code split (2 usage / 3 runtime), one verdict policy shared with the app, `approve`, `expected.json` ledger.
- **Mistakes:** none.
- **Next:** Siddharth's or Arpit's ruling on W-07.

## 2026-10-18 — W-06 filed: rename the workspace tabs  ·  Cowork (Opus 5.5)

- **Asked:** *file a work item — Batch compare becomes Bulk compare, Compare 2 PDFs becomes Compare; it is about renaming the tabs through UX design.*
- **Done:** filed **W-06** (`work/open/W-06-rename-workspace-tabs.md`, 🟢, `build`, `agent`, Sonnet); row in `OPEN-WORK.md`; `INTERVIEW.md` §2 updated. Uncommitted.
- **Decided / left open:** found the code already labels the tab `Compare` (and `Inspect`) — only the prose says *Compare 2 PDFs*; the earlier answer in this session repeated the docs, corrected in chat. Assumed internal ids and the `FEATURE_BATCH_COMPARE` key stay as they are — stated as out of scope in the file for Arpit or Siddharth to overrule.
- **Mistakes:** answered "what are the four tabs" from `docs/ARCHITECTURE.md` rather than `src/App.tsx` — ground truth over prose.
- **Next:** W-05, then W-06 whenever an agent session is free.

## 2026-10-18 — research: what the tool needs tested  ·  Cowork (Opus 5.5)

- **Asked:** *research and propose what all things need to be tested in the tool.*
- **Done:** chat-only. Read ARCHITECTURE, SR-SPEC-INTAKE/-CHECK, W-04, BACKLOG, `packages/cli/verify/*`. Proposed a test plan in chat: one `npm test` (node:test, no new deps) over engine, verdict boundaries, spec intake/check, exports, CLI contract, app↔CLI parity, a PDF robustness corpus, then Playwright E2E. No file other than this entry changed.
- **Decided / left open:** nothing ruled. Suggested the inbox item (Python dev scripts) resolve as "port to TypeScript with pdf-lib", since pdf-lib is already a dependency — Siddharth's or Arpit's call.
- **Mistakes:** none.
- **Next:** if Arpit adopts it, file the plan under `work/proposals/` and open the first `testing`-lane `W-nn` (one `npm test` wiring the existing verify scripts + verdict boundary tests).

## 2026-10-16 — `main` merged into `spec-driven-comparison`; PR raised  ·  Claude Code (Opus 5.5)

- **Asked:** *push and raise the #3 PR.* (PRs #2 and #3 had already merged, so this is the third in the series, stacked on nothing.)
- **Done:** merged `origin/main` into the branch. Conflicts in `CLAUDE.md` (layout line: `cli-py/` dropped, sealed `src/features/spec/` line kept), `work/NOW.md` (one line for both), `work/WORKLOG.md` (both sides' entries kept, `main`'s first). `main`'s spec separation moved the spec code to `src/features/spec/`, so the spec records' paths (Ownership + Describes rows in `records/README.md`, `owns:` and body refs in 0101–0103, W-02, W-04) were remapped to it — no decision changed.
- **Decided / left open:** (1) `src/services/specConstants.ts` (SR-CONSTANTS, W-05 — not built) still names `src/services/`; the sealed-feature boundary may want it inside `src/features/spec/` — Siddharth's or Arpit's call. (2) `main` built `sheetRead.ts`/`sheetSpec.ts` (Excel → spec) — overlaps W-02's scope; no record owns them yet, so they fall to W-01. (3) The graduated proposal keeps the old paths, as history.
- **Mistakes:** none.
- **Next:** review and merge the PR; then the two calls above; then W-05.

## 2026-10-16 — pdfsuite published as an npm package, thresholds removed  ·  Claude Code (Opus 5)

- **Asked:** *can we make an npm package that does the same comparison and writes HTML reports? — then: no spec-driven, no ignored regions, positional `pdfsuite compare <golden> <candidate> <pairs.json> <reports>`, and remove thresholds too.*
- **Done:** uncommitted. `packages/cli/` is now publishable as **`pdfsuite` 1.0.0** (name free on npm; `private` dropped, `files` whitelist, `engines: node>=20`, `prepublishOnly`, one runtime dep `@napi-rs/canvas`; commander moved to devDependencies since esbuild bundles it). Thresholds gone from `pairs.json`, the verdict, `PageVerdict`, `RunContext`, and all four report writers — `judge()` now calls the app's own `summaryPageDiffers`, so app and CLI cannot disagree. Positional arguments added with the flags kept as overrides. `npm run build` runs `tsc --noEmit` first. README, `fixtures/pairs.json` and `docs/ARCHITECTURE.md` (incl. the §Verdict-rules divergence table, now a single column) updated.
- **Three real defects found, all pre-existing:** (1) `packages/cli/` had **never** typechecked clean — 5 errors, hidden because esbuild strips types without checking; a live run died with `TypeError: ignored.map is not a function` because `reportPageDetail(summary, pageCache, thresholds)` was pushing the thresholds object into the app's new `ignored` parameter. (2) The bundle **baked an absolute path** to this machine's `pdf.worker.mjs`, so any published copy would have failed on the installer's machine — the worker is now copied beside the bundle and resolved through `import.meta.url`. (3) The CLI was still judging on `content≥99% pixels≤2% offset≤0.03"` that the app deleted, so CI verdicts contradicted the UI.
- **Verified by packing and installing it elsewhere:** `npm pack` → 736 KB, 4 files → installed into a fresh `/tmp/consumer` → `pdfsuite compare ./golden ./candidates ./pairs.json ./reports` ran clean (3 pairs PASS, exit 0), a seeded mismatch gave 6 failing pages, a 251 KB HTML report with 10 embedded page images, and exit 1. No spec code in the bundle. An old `pairs.json` with `defaults` prints "thresholds in this file are ignored" rather than silently dropping the tolerance. CLI verify:regression + verify:spec 8/8 still pass; app build clean; boundary check clean.
- **Decided:** `--pixel-threshold` stays — it is pixelmatch's colour sensitivity, not a pass/fail tolerance, and the README now says so.
- **Left open:** nothing is published; `npm publish` is Siddharth's or Arpit's call. Publishing from this repo resolves `pdfjs-dist`/`pixelmatch`/`diff` from the **root** `node_modules` at build time, which is fine here and fragile if `packages/cli/` is ever moved out.
- **Then asked:** *how do I consume it from npm, or by copying the package folder?*
- **Then done:** three documented install paths in `packages/cli/README.md`, and `packages/cli/scripts/make-portable.sh` (`npm run portable`) which assembles a 40 MB self-contained folder — bundle, pdf.js worker, the `@napi-rs/canvas` wrapper and this machine's compiled binary, plus a `RUN-ME.txt`. Verified: `node <folder>/dist/index.js compare …` runs from an unrelated cwd with no `npm install`, no global binary and no network.
- **The catch, found by testing rather than assuming:** the tarball alone does **not** install offline. `@napi-rs/canvas` is native so esbuild cannot bundle it, and the 37 MB is not in `@napi-rs/canvas` (152 KB) but in a sibling platform package, `@napi-rs/canvas-win32-x64-msvc`. Copying only the first gives `ERR_MODULE_NOT_FOUND` at run time. The portable folder is therefore **platform-locked** to the OS and CPU it was assembled on, and the script and RUN-ME both say so.
- **Then asked:** *how do I run it on a Mac?*
- **Then done:** `npm i -g pdfsuite` needs nothing special on macOS — npm resolves the Apple Silicon or Intel binary itself. For a Mac with no registry access, `make-portable.sh` gained `--target`: it fetches that platform's `@napi-rs/canvas` binary and assembles a folder for it, so a Mac build can be made from Windows. Verified: `--target darwin-arm64` produces a 29 MB folder holding the wrapper plus `skia.darwin-arm64.node` — the exact file `js-binding.js` requires on darwin/arm64 — and no Windows binary; the default local build still runs clean. Not executed on a Mac from here, which the entry says rather than claims otherwise. README gained an `## On macOS` section incl. the `xattr -dr com.apple.quarantine` fix.
- **Caught before it shipped:** `npm pack @napi-rs/canvas-darwin-arm64` resolves to **1.0.11** while the installed wrapper pins **0.1.100** — a different major, which would not load. The script now reads the version from the wrapper and pins the fetch to it.
- **Then asked:** *how do I publish to npm?*
- **Then done:** `npm publish --dry-run` surfaced a defect that would have shipped a CLI with **no command**: npm's publish-time normalisation rejected `bin: "./dist/index.js"` and silently *removed the entry* — `npm warn publish "bin[pdfsuite]" script name dist/index.js was invalid and removed`. A local tarball install had worked, so nothing before the dry run caught it. Fixed to `"dist/index.js"`, re-packed, installed, and `pdfsuite --help` confirmed. Also added `repository` (with `directory: cli`), `homepage` and `bugs`, which is what makes the README's relative links to `docs.html` / `plan.md` / `pdfsuite.config.json` resolve on the package page, since the tarball carries only `dist/` + README.
- **Then asked:** *add an HTML visual to the folder, for someone who just copies it.*
- **Then done:** `packages/cli/START-HERE.html` — 20 KB, self-contained (system fonts, zero external requests, works from `file://` offline), shipped into the portable folder by `make-portable.sh` with the platform substituted in. It carries two live builders: one that writes the exact `node …/dist/index.js compare …` command from filled-in paths (quoting any path with a space, and adding `--format` only when it differs from the default), and one that builds a valid `pairs.json` from id/golden/candidate rows. Verified in the browser: both update live, and the generated `pairs.json` was then run through the real CLI — 2/2 pairs passed. `RUN-ME.txt` stays, shortened, pointing at the HTML, for a machine with no browser.
- **Also corrected:** the platform stamp said `MINGW64_NT-10.0-22631 x86_64` under Git Bash, which tells a reader nothing; it is now named after the binary actually copied — `win32-x64-msvc`, exactly the string `--target` takes. And `packages/cli/docs.html` (963 lines) still documented the tolerances the CLI no longer has — `contentPct`/`pixelPct`/`offsetIn`, “clears all three thresholds”, “breached a threshold”, a per-pair `thresholds` field. Those claims are corrected; the remaining mentions are the pixelmatch sensitivity flag and the accepted-and-ignored note.
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

## 2026-11-06 (cont. 3) — W-09: `pdfsuite compare` is one pair per command  ·  Claude Code (Opus 5)

- **Asked:** *“start W-09”.*
- **Done:** all 7 DoD. `pdfsuite compare <golden.pdf> <candidate.pdf> --out <dir>` with `--pages` for a pairing the person states and `--each` for two folders; three files always, from the shared builders, with `buildCompareReportHtml` rendering from `result.json` alone. `pairs.json`, the folder inputs, the `pairs` command and the JUnit/CSV/Markdown writers are deleted — `core/pairs.ts` and `src/report/` with them — and every `@pdfsuite` package is **2.0.0**. `compare-cli.ts` 23/23 joins `compare-parity.ts`; 24 suites green. W-27 reaches 6 of 7 with it. Uncommitted.
- **Decided / left open:** all six packages went to 2.0.0, not just the CLI — SR-NPM-PACKAGES decision 1 and L4 say one version, published together, and a breaking change in `compare` is a breaking change of the suite. My own `check-packages.sh` caught the attempt to bump one. The Compare tab's richer HTML report stays: it shows the heatmap, annotations and ignored regions, which `result.json` does not carry, so either the result grows those fields or the difference is ratified — filed as **B-016** rather than dropped or quietly left.
- **The defect the test found:** `comparePair` was turning a stated `null` in a pairing back into “the page at this index” (`pair.b ?? i`), so `--pages "2:-"` — *golden page 2 was dropped* — compared it against candidate page 2 and reported no change. A pairing the person had written down was being ignored. `comparePage` had always told `undefined` from `null`; my own W-27 code collapsed them.
- **Mistakes:** none that shipped. The docs took three passes — `cli/README.md`, the portable folder's `START-HERE.html` and the illustrated `docs.html` all taught 1.x, and the last is linked from the README as *the* guide, so leaving it would have been worse than no guide.
- **Next:** **W-30** (the `pdfsuite` host that loads `compare` and `spec` from their packages) or **W-32** (the spec package).

## 2026-11-06 (cont. 2) — W-27 DoD 4: one result.json, proved against itself  ·  Claude Code (Opus 5)

- **Asked:** *“continue with DoD 4”.*
- **Done:** the `result.json` envelope — schema, tool, env, run, policy, inputs — and the manifest builder now live in `@pdfsuite/core`, and the **spec run was rewritten onto the same envelope** rather than keeping its own copy. `buildCompareResultJson` in `@pdfsuite/compare` writes the compare body. The Compare tab downloads `result.json` + `manifest.json`; the CLI writes them per pair. `packages/cli/verify/compare-parity.ts` 7/7, in `npm run verify` (23 suites). 5 of 7 DoD. Uncommitted.
- **Decided / left open:** `report.html` is **not** shared yet. The app's report is mature and image-heavy and the CLI already reuses parts of it; replacing it wholesale to satisfy a DoD would risk a report people rely on, and **W-09** reshapes the CLI's outputs around those builders anyway. Named in the item rather than quietly skipped. The CLI's own `report.json` also stays: it describes a *many-pairs* run, which is `kind: compare-many` and W-09's to write.
- **The test worth having:** the parity check runs the **built binary as a process** and the builders as the tab calls them, then diffs. It cannot pass by calling one builder twice — one side comes off disk. It excludes exactly three blocks and says why: `run` is the clock, and `tool` and `env` are *meant* to differ between a browser and a command line.
- **Mistakes:** none that shipped. `sha256` came from `@sheetpane/import` — a workbook reader — for hashing PDFs and JSON; it is now core's own, on Web Crypto, so the app and the CLI hash identically without a spreadsheet library in the path.
- **Next:** **W-09** — `pdfsuite compare` as one pair per command, which finishes the HTML builder and W-27 with it.

## 2026-11-06 (cont.) — W-27: one page loop, one page rule  ·  Claude Code (Opus 5)

- **Asked:** *“start”* — W-29 had unblocked W-27, which I had named as the follow-on.
- **Done:** `pageVerdict`, `comparePair` and `compareMany` in `@pdfsuite/compare`. The Compare tab's `computeAll`, the Bulk tab's `run` and the CLI's pair function all call the shared loop; `summaryPageDiffers` and `pageHasChange` are deleted and every call site — strip, Next change, chip, both reports, the CLI — answers from `pageVerdict`. `packages/cli/verify/compare-verdict.ts` 17/17, wired into `npm run verify` (22 suites). 3 of 7 DoD, 5–7 part-done. Uncommitted.
- **Decided / left open:** the one intended behaviour change is the band the two rules disagreed about — a page that moved between **2 px** (the verdict) and **2.9 px** (the strip's 0.02 in) failed the report while Next change skipped it. The stricter limit wins, so no page that counted as changed stops counting. `comparePair` gained `reuse` for pages a surface has already compared: without it the shared loop would be slower than the three it replaces, which is how a shared core gets abandoned. A summary deliberately does **not** claim to know about one-sided items — only a full comparison can see them, and answering “none” would quietly weaken the rule.
- **Mistakes:** none that shipped.
- **Remainder:** DoD 4, the shared string builders. The app and the CLI still write their own reports, and until they share them there is nothing for DoD 6's byte-for-byte parity test to diff. **W-09** reshapes the CLI's outputs around exactly those builders, so the two should be done together.
- **Next:** W-27 DoD 4 with W-09, or W-32 (the spec package) now that `packages/` exists.

## 2026-11-06 — W-29: the repository becomes npm workspaces  ·  Claude Code (Opus 5)

- **Asked:** *“start W-29”.*
- **Done:** `packages/core` (the loader, extraction, constants and shared types), `packages/compare` (changes and pairing), `packages/cli` (today's `cli/`, published as `pdfsuite`) and named shells for `agents`, `ui` and `create` — six workspaces at one version. The app, the spec feature and the CLI import `@pdfsuite/core` and `@pdfsuite/compare` by name across 30 files. `scripts/check-packages.sh` fails a path import, a package importing the app, a version drift or an un-pinned `pdfjs-dist`. Records, the Ownership table, `CLAUDE.md`'s Layout and ARCHITECTURE (new diagram 27) follow. 5 of 6 DoD; **W-27, W-30, W-32 and W-33 are unblocked**. Uncommitted.
- **Decided / left open:** the report builders stay in the app. They import the app's stores, so moving them unchanged would have dragged the stores into core — W-09 and W-27 rewrite them, and until then `check-packages.sh` names them as an allowed crossing rather than pretending they are not one. The same goes for the spec feature until W-32.
- **Mistakes:** two, both about versions. I pinned `pdfjs-dist` to `4.7.76` because that was the caret floor in `package.json` — but the repository had been *resolving* 4.10.38, so the pin silently moved the CLI back three minors and 4.7's Node canvas factory broke every render. Before that, the root range against the packages' pin installed **two copies of pdf.js**, which TypeScript caught as two incompatible `PDFDocumentProxy` types. Pinned everywhere to the version actually in use, and the check now refuses a range.
- **The discipline that paid:** no number moved — 21 verify suites green on the same figures, including the 24/24 classification and the sample-corpus regression.
- **Next:** **W-27** (one compare core) is the natural follow-on, or **W-32** (the spec package) now that `packages/` exists.

## 2026-11-05 (cont. 9) — W-02 DoD 3: a blank workbook to start a spec from  ·  Claude Code (Opus 5)

- **Asked:** *“do the next thing”* — triaged the queue and took the smallest gap that closes a DoD outright.
- **Done:** `writeBlankTemplate()` in `specDraft.ts` — Pages List, Settings, the full Lists vocabulary and one page sheet with three example rows. In the Spec tab's Export menu, which now opens whether or not anything is loaded, and as `pdfsuite spec --template <file>`. `packages/cli/verify/spec-blank-template.ts` 10/10. W-02 is 9 of 10. Uncommitted.
- **Decided / left open:** the example rows carry real values but `Check? = Note`, so the shape is there to copy and a template uploaded before anyone edits it cannot test somebody else's placeholder numbers. It is written by the same `writeWorkbook` as the legacy draft — one container, so the starter and the draft cannot drift. The Export menu is no longer gated on having uploaded something: the thing you start from should not require the thing you are starting.
- **Mistakes:** the first version left the example rows empty, and they read back as three *unreadable* rows — a starter that looks broken the first time it is checked. Caught by reading the workbook back through our own reader, which is what the test now does.
- **Next:** W-02's remaining gap is decisions 10 and 12, and no fixture row exercises either, so it needs a fixture change first. The bigger unlock in the queue is **W-29** (npm workspaces), which frees W-27, W-30, W-32 and W-33.

## 2026-11-05 (cont. 8) — W-11: `pdfsuite spec`, 8 of 8  ·  Claude Code (Opus 5)

- **Asked:** *“start W-11”.*
- **Done:** `packages/cli/src/commands/spec.ts` — `pdfsuite spec <spec> [pdf] --out <dir>` with `--pages` and `--validate-only`, reaching the feature only through `engine.ts` (re-exported once in `packages/cli/src/platform/engine.ts`). The spec is validated before any PDF is opened, every line naming its cell; the three files come from the feature's own builders; exit codes are taken from `result.summary.exitCode`. `packages/cli/verify/spec-cli.ts` 19/19 runs the built binary as a process. Records and docs updated: SR-SPEC and SR-CLI say **partly** built, `packages/cli/README.md` has a `spec` section, and ARCHITECTURE Part 3 gains a `pdfsuite spec` section with diagram 26 and its SVG. Uncommitted.
- **Decided / left open:** two of this item's stated dependencies were stale and are recorded as such — W-09's shared writers were overtaken by W-04 DoD 5's builders (the tab and the CLI now call the same functions, which is what the dependency was for), and DoD 5's “needs the spec machine” was overtaken by Siddharth's 2026-11-03 ruling. `--validate-only` **exits 2 when any row is refused**: it asks one question, and a pipeline gating on it should not be told a spec with ten refused rows is fine. A legacy workbook is refused on the command line with the route out, rather than drafted there, because a draft needs a person to confirm it.
- **Mistakes:** none that shipped, but the CLI's stricter tsconfig found two older defects as unused variables — **a neighbouring font weight still failed the element** (decision 7 says warning; the flag was computed and never used) and **line-end hyphenation was never rejoined** (decision 5's last clause; `joinHyphenated` had sat uncalled since DoD 1). Both fixed, with `packages/cli/verify/spec-hyphenation.ts` 3/3 proving the second in both directions — “road-”/“works” joins, “North-”/“South” does not.
- **Owed:** the Node floor. `@sheetpane/import` declares `>=22`, `pdfsuite` publishes `>=20`, and `spec` is the command that makes it bite. It blocks publishing, not building.
- **Next:** that ruling, then W-30/W-32 (the host and the package) or W-09.

## 2026-11-05 (cont. 7) — W-04 DoD 7: the records catch up, and Form XObjects  ·  Claude Code (Opus 5)

- **Asked:** *“continue with DoD 7”*, then *“finish DoD 7”*.
- **Done:** a Form XObject's own `/Matrix` is applied in both operator-list walkers (it was ignored, so anything drawn inside a form was measured at the page's transform) — `packages/cli/verify/spec-form-xobject.ts` 4/4. SR-SPEC-CHECK set to **partly** built, its Consequences naming decisions 1–8, 10–14 and 15-from-the-tab as in and decision 9's image content, container fills and `pdfsuite spec` as out; SR-PDF-SUPPORT's five Spec cells updated; the ARCHITECTURE spec diagram redrawn and its SVG re-rendered; the fourteen new spec files claimed in the Ownership table. Uncommitted.
- **Decided / left open:** `partly` again rather than `yes` — decision 9 is real and unbuilt. The new files are claimed by the records whose decisions they implement rather than left under `src/` → W-01, which also means this commit can satisfy the guard honestly instead of using `no SR affected`.
- **Mistakes:** the pdf-lib route could not prove the Form XObject fix — `embedPdf` always writes an identity matrix, and the first test passed with the fix reverted. Caught by reverting deliberately; the second case is a PDF assembled by hand with `/Matrix [1 0 0 1 10 5]`.
- **Next:** commit this sequence, then **W-11** — `pdfsuite spec`, which calls the builders this work put behind `engine.ts`.

## 2026-11-05 (cont. 6) — W-04 DoD 6: the fixture becomes the acceptance test  ·  Claude Code (Opus 5)

- **Asked:** *“continue with DoD 6”.*
- **Done:** `packages/cli/verify/spec-fixture.ts` drives `work/samples/excel-spec-template-v2/README.md`'s deviations table row by row — nine detectable deviations on the named check, nothing else, and the three undetectable ones as neither a finding nor a pass; `report.pdf` reports no failure and no page finding. The README's *known false failures* section is deleted and its “not detectable today” note now gives each of the three its own reason. 18/18, in `npm run verify`. Uncommitted.
- **Decided / left open:** positions are converted to a distance from the page's **top-left at compile time**, where the page size is known, rather than teaching the checker about edges — otherwise every check would have to carry the page around to understand what the spec meant. Only the edges a workbook stated are checked: an element placed from the bottom-right does not silently also claim a top.
- **Mistakes:** two of my own regexes, not the product's — deviation 4 matched its siblings and deviation 11 used a label the workbook does not use. Both read as product failures for a few minutes.
- **The finding:** the compiler **dropped every element placed from the bottom or the right**, with the reason “states no Top and Left” — the fixture's own three page-number footers among them, which is a whole class of page furniture never checked. The README tabled deviation 12 as a result the product could not produce, and no test had noticed. Fixed: `report.pdf` goes 17/19 → 20/22 elements with still no failure, coverage 91 → 112 of 290 rows.
- **Next:** W-04 DoD 7 — the record: SR-SPEC-CHECK's built status and the ARCHITECTURE diagram.

## 2026-11-05 (cont. 5) — W-04 DoD 5: result.json, report.html, manifest.json  ·  Claude Code (Opus 5)

- **Asked:** *“continue with DoD 5”.*
- **Done:** one builder each, in `src/features/spec/` behind `engine.ts` so **W-11**'s `pdfsuite spec` calls the same functions rather than growing a second writer: `buildResultJson` (`pdfsuite.result/1`, with `schema/result.v1.json` shipped beside it), `buildReportHtml` (reads `result.json` and nothing else), `buildManifest` (written last, no timestamp) and `buildFixList`, which stays a UI-only view per SR-SURFACE-PARITY. The Export menu offers the three as one zip plus the fix list. `packages/cli/verify/spec-outputs-run.ts` 25/25. Uncommitted.
- **Decided / left open:** `specExport.ts` is **deleted** rather than kept beside the new builders — it wrote its own HTML and its own JSON shape, and two report formats from one tab is exactly what “one builder” exists to prevent. The schema is validated by a small checker inside the test instead of adding a JSON Schema library: the claim being tested is that the file matches the shipped schema, not that we own a validator. These three records now say **partly** built in the register, with the spec kind named and compare and inspect still owed.
- **Mistakes:** none that survived. One weak test caught while writing it — “images only for failing pages” was exercised on a document where every page failed, so it compared `true === true`; it now runs against the clean fixture, where no page may carry an image unless asked.
- **Not verified:** the Export click itself. The window is closed, so the pane's `requestAnimationFrame` is frozen and no run can finish (the lesson filed earlier today). The builders were run in the browser directly, which proves `crypto.subtle` and the env detection there.
- **Next:** W-04 DoD 6 — fixtures.

## 2026-11-05 (cont. 4) — W-04 DoD 4: wording, tolerances, source cells, coverage, the pair  ·  Claude Code (Opus 5)

- **Asked:** *“continue with DoD 4”.*
- **Done:** SR-SPEC-CHECK decisions 10–14. Wording became its own `Text` check — a line is located with everything normalised but judged strictly, so Exact text = Yes is character for character and a match that only appears after normalising passes with a note. `CheckResult` gained `cell` and `note`; one `withSource` mapping fills the cell for every check, so a new check cannot quietly arrive without one. `SpecReport` gained `coverage` and `pair`; the store hashes the PDF as it loads it. The tab shows the cell beside each check, the coverage line beside the verdict and the pair beneath it. `packages/cli/verify/spec-comparing.ts` 15/15, in `npm run verify`. Uncommitted.
- **Decided / left open:** locating and judging are deliberately different strictnesses — locating a line with raw text would report a non-breaking space as *missing*, which is a worse answer than a qualified one; judging it loosely would let the report say two strings agree when they do not.
- **Mistakes:** a real defect found by writing the test, not by reading the code: **a row's Tolerance cell was read in the spec's unit rather than the row's**, so a 2 mm band compiled to 2 inches — twenty-five times too permissive, in the direction that hides defects. No fixture row has a Tolerance cell, so the whole suite was blind to it. Fixed and covered.
- **Not verified:** the app-level view of this one. The window was closed, so the Browser pane's `requestAnimationFrame` is frozen and pdf.js never finishes a render (the lesson filed earlier today). The engine is proven in Node and both builds are clean; the three new UI bits are unseen.
- **Next:** W-04 DoD 5 — outputs: the three files of SR-REPORT-JSON, SR-REPORT-HTML and SR-MANIFEST.

## 2026-11-05 (cont. 3) — W-04 DoD 2: the Pages List decides which page is which  ·  Claude Code (Opus 5)

- **Asked:** *“continue with W-04 DoD 2”.*
- **Done:** `specPages.ts` — SR-SPEC-CHECK decisions 1–3. Each Pages List entry is bound to a PDF page by its **identifying text**: Optional absent is noted, Conditional absent is never a failure, Required absent is an error, a variant group must match exactly one, a page out of order is a warning and is still checked, an unclaimed PDF page is a warning, and a repeating page is counted against its Repeats range. `SpecPage` carries the Pages List, `SpecReport` carries `pageFindings`, `runSpec` walks bindings. `packages/cli/verify/spec-pages.ts` 25/25, in `npm run verify`. Uncommitted.
- **Decided / left open:** occurrences past the top of a Repeats range are still bound and checked, and the range breach is reported as an error — the first draft stopped consuming at the maximum, which turned “three where two are allowed” into the weaker and wrong finding “a PDF page nobody claimed”. Page findings live in their own list rather than among the element results, because they are not spec rows and coverage must not count them. A spec JSON with no Pages List keeps the old by-number behaviour.
- **Mistakes:** half an hour lost to a hang that was not in the code — see `work/LESSONS.md`, 2026-11-05: a backgrounded Browser pane freezes `requestAnimationFrame`, so pdf.js's `page.render()` never settles while every headless call still works.
- **Next:** W-04 DoD 4 — comparing and coverage.

## 2026-11-05 (cont. 2) — W-02 DoD 7: the four downloads, the annotated workbook among them  ·  Claude Code (Opus 5)

- **Asked:** *“continue with DoD 7”.*
- **Done:** `specOutputs.ts` — the validation report as printable HTML, the extraction JSON, the spec JSON, and `annotateWorkbook`, which marks up **the uploaded file** instead of rebuilding one: one fill and one format appended to `styles.xml`, `s=` set on each error cell (inserting the `<c>` element in column order where the cell is blank), and a `Validation` sheet appended. `readSpecWorkbook` now keeps the uploaded bytes. All four are in the Spec tab's Export menu, which opens as soon as a workbook is read rather than waiting for a check. `packages/cli/verify/spec-outputs.ts` 19/19, in `npm run verify`. Uncommitted.
- **Decided / left open:** the annotated workbook edits the author's own file because rebuilding it would throw away their formatting, their Notes column and their screenshots — most of what makes it theirs. The Export menu gained two headings, *From the workbook* and *From the check*: three of the four outputs exist to fix a workbook that never got as far as a check, so gating them on a report would have made them unreachable exactly when they are needed.
- **Mistakes:** none that survived. Two bits of first-draft debris in `specOutputs.ts` — a no-op anchor in the cell-insertion path and a sheet count where a maximum `sheetId` belonged — were cleaned up before the test ran.
- **Not verified:** that **Excel itself opens the annotated workbook**. Our reader reads it back whole — 290 rows identical, the same ten errors, the ten cells red — but no copy of Excel has opened it here.
- **Next:** W-04 DoD 2 (pages), then 4, 5, 6, 7.

## 2026-11-05 (cont.) — W-02 finished to 7 of 10: legacy drafts, the oracle, the docs  ·  Claude Code (Opus 5)

- **Asked:** the same — one DoD after another, no checking in.
- **Done:** DoD 8 (`packages/cli/verify/spec-oracle.ts` freezes the extraction, spec and coverage of the clean fixture; `--update` re-freezes deliberately), DoD 4 (`specLegacy.ts` + `specDraft.ts`: a legacy workbook returns a draft v2 `.xlsx`, amber where inferred, red where unreadable, Check? = Note throughout, and asserts nothing — `sheetRead.ts` and `sheetSpec.ts` deleted), DoD 9 (`spec-standard.md` §7 replaced; the ARCHITECTURE spec diagram re-drawn and its SVG re-rendered; glossary marked built) and DoD 10 (the record's Consequences; the register says **partly**). Suite 8/7/15/17/28/26/22/21/7/17, both builds and the boundary check clean. Uncommitted.
- **Decided / left open:** the register's `built` column gained a third value, **partly**, with its meaning stated above the table — decisions 10 and 12 and three of decision 14's four downloads are unbuilt, and `yes` would have been a false claim. DoD 8's legacy clause is covered by DoD 4 landing in the same session. `updated_by: agent` on W-02 and W-04 changed to `Siddharth` per SR-WORK-LIFECYCLE 4e; W-05 and W-32 still say `agent` and were not touched.
- **Mistakes:** two caught by the new tests rather than by reading. The oracle found `mark()` naming a **refused** cell as an assertion's source (Rows, Columns, Font size were marked whether or not the value parsed). Writing the draft found **Check? = Note being asserted anyway** when the row was one the compiler consumes — the column was read only after the element had been built. Both fixed. The spec SVG was rendered twice: mermaid 11 defaults to `foreignObject` labels, which every other SVG in the folder avoids because they render blank outside a browser.
- **Next:** W-02 DoD 7's four downloads and the re-upload round trip, then W-04 DoD 2.

## 2026-11-05 — W-04 DoD 3 (fonts, colour) and W-02 DoD 6 (the validation report)  ·  Claude Code (Opus 5)

- **Asked:** *“start and finish one by one, but do not ask me again and again”* — the DoDs, sequentially, without checking in.
- **Done:** `specFonts.ts` and `specColour.ts` (subset prefixes, weight words, CIEDE2000) with the reading wired into `extractItems`, and `specValidate.ts` + `SpecValidation.tsx` — the three severities, coverage, and every assertion in plain words with its cell. The Spec tab's upload now goes `readSpecWorkbook → readTemplate → compileSpec`; the pre-v2 per-sheet reader is kept only for a workbook with no Pages List. `packages/cli/verify/spec-fonts-colour.ts` 22/22 and `packages/cli/verify/spec-validation.ts` 21/21, both in `npm run verify`. Uncommitted.
- **Decided / left open:** a sentence states the band **actually applied**, falling back to the Settings sheet's figure — the first pass omitted it where the element had no Tolerance cell, which reads as a stricter claim than the check being run. Colour is matched to text by **position**, not by order: the fixture's page 2 has 60 text items against 35 paint operations, so counting lines them up silently wrongly. Decision 13's `info` goes to coverage, so the tab lists the unchecked rows from coverage rather than inventing a fourth note list.
- **Mistakes:** staged everything with `git add -A` without being asked; unstaged it. A dead `+ (…)` after a `;` had meant a pinned page-size difference never reached `failCount` — found and fixed, `spec-reading` now asserts it.
- **Next:** W-02 DoD 8 — freeze the expected extraction and spec JSON as an oracle, with a test that fails on drift.

## 2026-11-04 (cont. 2) — W-02 DoD 5 and 7: workbook → spec JSON, end to end  ·  Claude Code (Opus 5)

- **Asked:** *continue with DoD 5 and DoD 7.*
- **DoD 5, decision 9:** `specValues.ts` reads the spellings (`2 1/8`, `0,5`, `.5`, `3/8`) and refuses the two things that are *not* spellings — `~10` ("state the number and a Tolerance") and a range **plus** a Tolerance ("a range is already the tolerance"). A range becomes a band whose half-width is the tolerance. Decision 11's strikethrough comes from the style tables: a struck row is listed and not checked.
- **DoD 7:** `specCompile.ts` turns the extraction into the spec JSON — every element carrying `source: {sheet, cell}`, plus the workbook's SHA-256, its template version and its own tolerances. Coverage accounts for **all 290 rows** as checked, noted, excluded or unreadable.
- **The result that matters:** compiled from the workbook, the fixture's matching PDF reports **0 failures**, and the deviations PDF reports **8 of the 9 detectable deviations** its README tables — title font size, logo width, table left, summary line spacing, map height, table rows, footnote wording, graph top.
- **Four compiler defects, all the same mistake — asserting what the sheet does not support.** A filled container and a vector graph were compiled as **images**, sending the checker after pictures that are not there; `Line break after` was ignored, so "Fleet Highlights" was asserted as one line when the workbook says it is two; and a paragraph's whole text was asserted when `ParagraphSpec.text` is documented as the *starting snippet* — no single line ever contains a wrapped paragraph. Each now goes to coverage or is narrowed.
- **One checker change:** a paragraph found on a single line reported a failed line spacing. One line has no gap to measure, so that is **unverifiable**, not a defect in the document.
- **Two mistakes of mine, caught by the tests:** I patched the single-line rule into `checkImage` instead of `checkParagraph` (an over-broad match on a `return`), and I asserted that a range yields a per-element tolerance against the *clean* workbook, which states no range — the range is in the errors fixture. That test moved to the parser, where it belongs.
- **One real gap the oracle exposed:** 18 of 290 rows were missing from coverage, because an element whose wording had nothing matchable noted only its wording row and dropped the rest. Decision 13 says nothing passes silently; all 290 are now accounted for.
- **Checked:** spec-compile 26/26, spec-template 28/28, spec-intake 17/17, spec-reading 14/14, spec-columns 7/7, verify:spec 8/8, regression unchanged, app build and boundary check clean.
- **Not done, and named:** decision 10 (rich-text per-word styles) and decision 12 (relative values) — no fixture row exercises either, so building them would be writing untested guesses. Deviation 12, the missing page number, is not reported; worth a look with DoD 6. The downloads and the re-upload round trip are UI work.
- **Next:** **W-04 is unblocked** — its DoD 2, 4 and 6 were waiting on exactly this spec JSON.

---

## 2026-11-04 (cont.) — W-02 DoD 3: Template v2 reads  ·  Claude Code (Opus 5)

- **Asked:** *continue with DoD 3.*
- **Looked at the real workbook before writing a parser.** Pages List stops at the first blank row (what follows is the sheet's own prose). Settings is name/value, so it is read by name — inserting a row cannot shift every value by one. **Lists is seven short tables side by side across 17 columns** (groups, units, parameters with kind/allowed units/required flags, edges, Check?, Case, fonts, named colours with hex). Page sheets carry real merge ranges like `A2:A6`.
- **`specTemplate.ts`** reads all four kinds. The rule under everything: read what the sheet states, never what it implies. A merged label is taken from the **declared range** — forward-filling the last non-blank value would give the same answer on this fixture and a wrong one the moment a label is genuinely missing, which is a mistake worth catching.
- **Decision 7a in full:** blank unit on a unit-taking parameter, a unit written inside Value, a unit the parameter cannot take, `px` with no *Pixels per inch*, a non-numeric value where the kind needs a number, an unknown parameter, a missing From — each an error on its own cell, each removing the row from the check rather than guessing it.
- **Result against the oracle:** the clean fixture reads **0 errors, 0 warnings, 290 rows, 4 pages** — 290 is exactly what its README states. The with-errors fixture yields **exactly its ten**, none missed, none extra.
- **Three gaps the oracle exposed, all fixed:** I had no colour-name check (the Notes cell names the colour and Lists holds its hex — `Cloud Grey` is `#EEF1F4`, not `#E4E9F2`); I had *From missing* as a warning when the oracle calls it an error; and a unit written into Value produced **two** messages on one cell, which would have had the reviewer fix one defect twice.
- **Checked:** `packages/cli/verify/spec-template.ts` 28/28, plus spec-intake 17/17, spec-reading 14/14, spec-columns 7/7, verify:spec 8/8, regression unchanged, app build and boundary check clean.
- **Noted, not inferred:** the fixture marks the page size as pinned only in a human *Note* column ("pinned: a PDF page of another size is a finding"). There is no Settings row for it, and parsing prose to decide is what decision 7 forbids — so it reads as not pinned (a warning, per W-04). Either the template needs a *Page size pinned* row or the record should say the Note carries it.
- **Still to remove:** `sheetRead.ts` and `sheetSpec.ts`. The Template v2 parser can replace them now, but the Spec tab still calls them; they go with the UI pass.
- **Next:** DoD 5 (values — ranges, `~`, rich text, editing marks, relative values) and DoD 7 (the spec JSON with every value's source cell).

---

## 2026-11-04 — W-02 started: spec intake, DoD 1 and 2  ·  Claude Code (Opus 5)

- **Asked:** *start W-02.*
- **Checked the blockers first rather than assuming.** Both are gone: W-05 landed yesterday, and `@sheetpane/import` is now on npm — **0.5.1, MIT, Arpit's repo** (it was absent when this was last checked on 2026-10-19). Installed with `--save-exact`, as decision 3 requires.
- **Built `src/features/spec/specIntake.ts`:** `uploadKind` decides on the extension before a byte is read, giving `.xls`, `.xlsm` and `.csv` three *different* ways out rather than one shared refusal. `readSpecWorkbook` checks the raw size against `MAX_UPLOAD_BYTES` before unzipping, passes `MAX_UNZIPPED_BYTES` as the reader's `maxTotalSize`, maps every `ImportError` to a message naming the fix, and accounts for everything it did not read — hidden sheets, hidden rows, filtered rows, hidden columns, formula cells — each with its sheet and cell. Exported from `engine.ts`, so W-11's CLI uses the same reader.
- **A defect the test caught:** `read()` also accepts CSV and decides partly on the bytes, so a file *named* `.xlsx` that is not a zip came back as a one-sheet CSV instead of a refusal — a reviewer would have been handed a nonsense spec built from parsed text. Now refused on `wb.source !== 'xlsx'`.
- **Two hazards resolved, one new:** the "unzipped cap is sheetpane's" hazard is settled — 0.5.1 takes `maxTotalSize`, so no upstream change is needed. But `@sheetpane/import` declares **`engines: node >=22`** while `packages/cli/package.json` publishes **`node >=20`**; filed in the inbox, because it bites when W-11 puts the spec check on the CLI.
- **The boundary check earned its keep twice:** it caught the new dependency before it went in undeclared (now in the allow-list and the feature README), and caught my test importing a file inside the feature instead of the barrel.
- **Checked:** `packages/cli/verify/spec-intake.ts` 17/17 — which also proves the reader runs under Node, as decision 3 requires — plus spec-reading 14/14, spec-columns 7/7, verify:spec 8/8, regression unchanged, app build and boundary check clean.
- **Still there, to be removed when DoD 3 lands:** `sheetRead.ts` and `sheetSpec.ts`, the jszip reader and heuristic converter from before this record existed. Decision 3's "one reader" is not met while both are in the tree; they still back today's Spec tab, so they go when the Template v2 parser can replace them.
- **Next:** DoD 3 — Pages List, page sheets, Lists and Settings per decision 7, and units per 7a.

---

## 2026-11-03 (cont. 3) — W-04: DoD 1 finished, DoD 3 part-done  ·  Claude Code (Opus 5)

- **Asked:** *continue with DoD 1 remainder and DoD 3.*
- **A real bug, decision 11:** tolerances resolved in the wrong unit. SR-CONSTANTS states 0.06 **inches**, but the fallback was multiplied by the spec's unit — on a millimetre workbook that is 0.06 mm, a tolerance seventeen times tighter than the record. A row's *own* stated tolerance is in its unit and still converts; only the constant is absolute. New `tolPt` separates the two.
- **Decision 4:** the page size was never checked. Now reported — a **warning**, because every position is measured from the top-left corner so a wrong page size does not invalidate them, but it explains a whole page being off at once. An error when the workbook pins the size.
- **Decisions 5 and 10:** `normalize` was whitespace and case only. Now soft hyphens dropped, ligatures expanded, smart quotes and dashes folded, NBSP and zero-widths handled, line-end hyphenation rejoined only when the next line is lower-case. ®, ™ and superscripts deliberately left exact, per decision 10.
- **Decision 6:** a page with images and no text layer reported every text element as *not found* — a limit of the method presented as a defect in the document. Those elements are now **unverifiable**.
- **Two type changes the record already required:** `status` gained `warning` and `unverifiable` (decision 13 names them), and `failCount` excludes both — otherwise a page-size warning would have failed the CLI's exit code.
- **My own error, caught by the test:** I first pushed the page-size result into `elements`, which inflated `elementCount` and broke positional access. Coverage counts the workbook's rows, and a page-size finding is not one — it moved to its own `pageSize` field. The two test failures that exposed it were my test's indexing, not the checker's behaviour; I checked before claiming either way.
- **Not done, and why:** fonts (7), colour (8) and image content (9). `TextSpec` carries no font, weight or colour field, so there is nothing for a checker to compare against until W-02's intake emits them. Writing the checks now would mean writing them against data that cannot exist. Form XObject images likewise — no fixture contains one.
- **Checked:** `packages/cli/verify/spec-reading.ts` (new, 14/14), `spec-columns` 7/7, `verify:spec` 8/8, `verify:regression` unchanged, both builds, both typechecks, boundary check.
- **Next:** W-02 is the gate for the rest of W-04. Six rulings still owed, oldest 16 days.

---

## 2026-11-03 (cont. 2) — W-04 DoD 1: lines grouped within a column  ·  Claude Code (Opus 5)

- **Asked:** *start* — W-04, the spec checker.
- **Picked DoD 1 first**, as its own Hazards section says: a correct PDF must not fail, and until that lands the fixture false-fails. DoD 2, 4 and 6 need W-02's spec JSON, which does not exist yet; DoD 1 and 3 do not.
- **Measured before changing anything.** Loaded the fixture's `report.pdf` through pdf.js and printed every baseline run with its horizontal gaps. Two defects, both silent mis-measurement rather than an error: on page 3 the graph title and y-axis labels sit **327 and 391 points** from the regional table on the same baselines and were merged into its rows; and the vertical tolerance was taken from the *current* item's height against the line's `top`, so a 20pt sidebar heading absorbed an 11pt table line nine points below it.
- **The design question I nearly got wrong:** my first instinct was to detect page columns by gutter. The fixture killed it — a table's own inter-cell gaps (194pt on page 2) are wider than some genuine column gaps, so no page-wide threshold separates them. The spec already states each element's Left and Width, which is better evidence than a gutter. So: **split on geometry, re-join on what the spec declares** — fragments become column segments, and `rowsWithin` rebuilds a table row from the declared box.
- **Result on the fixture's matching PDF, against `report-spec.xlsx`'s own values:** regional table Left 6.75″, Top 1.40″, Width 3.50″, Rows 7, Columns 4 — every one exact; graph title and sidebar heading each their own line. `packages/cli/verify/spec-columns.ts` (new, 7/7) is in `npm run verify`.
- **My mistake:** I invented the sidebar's coordinates (7.6″/0.78″) instead of reading them, and reported a failure that was my test's, not the code's — the workbook says 0.4″/0.75″ under *Left sidebar*, which is exactly what the checker had read. Corrected before claiming anything.
- **Not done, and why:** DoD 6 wants the *whole* fixture checked from the workbook, which needs W-02's converter; this test carries two elements written out by hand. The fixture README's *known false failures* section stays until that runs.
- **Checked:** `verify:spec` 8/8, `verify:regression` unchanged, both typechecks and builds, boundary check.
- **Next:** DoD 1's remainder (unit-aware tolerances, HTML escaping, Form XObject images) and DoD 3 (fonts, colour by ΔE, no-text-layer) — neither needs W-02.

---

## 2026-11-03 (cont.) — the seal is lifted; W-05 done  ·  Claude Code (Opus 5)

- **Ruled by Siddharth:** *"package can be developed on any machine now, remove this constraint"* — **W-32 option B**, the ruling owed since 2026-10-18 (16 days).
- **Scope I held to:** the seal was on *code*. **Real spec workbooks still never leave the spec machine** — a rule about data, which I did not touch, and which is now stated in every place the old seal was.
- **Unsealed:** CLAUDE.md §*The sealed feature boundary* → §*The spec feature's boundary*; `src/features/spec/README.md` rewritten from a two-machine protocol into a package contract; `docs/ARCHITECTURE.md` (four places); SR-NPM-PACKAGES decision 14. `scripts/check-boundary.sh` now guards the **packaging** surface rather than a machine boundary — same four rules, but the allow-list admits `src/services/`, `src/types/`, `src/store/`, which is the `@pdfsuite/core` dependency W-32 wants.
- **W-05 finished (5 of 5):** `DEFAULT_TOL`, `DEFAULT_ANCHOR_WITHIN` and the third `BASE_SCALE` moved out of `specCheck.ts` into `src/services/specConstants.ts`, values unchanged. SR-CONSTANTS decision 4 now holds and the register reads `built = yes`.
- **Checked:** `tsc --noEmit` clean app and CLI; `npm run build` and the CLI build pass; **`verify:spec` 8/8 and `verify:regression` unchanged on the sample corpus** — the spec checker's verdicts did not move; boundary check clean.
- **Queue:** the W-32 inbox row is gone (six left). W-02 🔴→🟡 (only sheetpane on npm left), W-04 🔴→🟢, W-48 unblocked through W-02, W-32 🔴→🟡 waiting on W-29 for `packages/`. W-05 closed to `IMPLEMENTATION.md`.
- **Left deliberately:** `src/features/spec/pdfjs.ts` still duplicates ten lines of `pdfCompare.ts`. Removing it now would just move the duplication — W-29 makes it a dependency on `@pdfsuite/core`. Noted in the README and on W-32.
- **Next:** W-04 is 🟢 and Opus-sized — the spec checker's false failures. Six rulings still owed, oldest 16 days.

---

## 2026-11-03 — W-05 built as far as the seal allows; the spec stream is blocked  ·  Claude Code (Opus 5)

- **Asked:** *start implementing the work items for spec driven comparison.*
- **Triage:** seven items blocked on Siddharth or Arpit, filed 2026-10-18 — **16 days**, not the "0 days" the inbox table showed; the age column was stale and is corrected.
- **The finding, raised rather than worked around:** every spec-driven item names files inside `src/features/spec/` — W-02 (`types.ts`, `SpecTestView.tsx`), W-04 (`specCheck.ts`, `specExport.ts`), W-48, W-46, W-47, and three of W-05's constants. That folder is **sealed**: CLAUDE.md forbids editing it from this machine, and `scripts/check-boundary.sh` rule 2 forbids it importing from `src/services/`, which is exactly what reading a shared constants file requires. **None of the spec stream can be built here.** W-32's ruling decides it — option B (move the checker off the seal) unblocks all four at once. OPEN-WORK now says so on the W-32 row, and W-02/W-04 moved 🟡 → 🔴.
- **Built anyway, the part outside the seal — W-05, 4 of 5 DoD:** `src/services/specConstants.ts` holds every key in SR-CONSTANTS decision 2. Moved with values unchanged: `BASE_SCALE` (`pdfCompare.ts`, `pdfElements.ts`), `MAX_PAGE_WIDTH`, the page-verdict limits (`changes.ts`), `MOVED_OFFSET_IN` (`exportReport.ts`), `AUTO_SCAN_MAX_PAGES` (`App.tsx`). `packages/cli/src/platform/engine.ts` re-exports it, so the CLI reads the same file through the seam (DoD 3).
- **Checked:** `npm run build` and the CLI build pass, `tsc --noEmit` clean on both, `verify:regression` **unchanged on the sample corpus**, `verify:spec` 8/8, boundary check clean.
- **Two stale specs found:** `DEFAULT_THRESHOLDS` is named in W-05's DoD and SR-CONSTANTS's Context/Reference but no longer exists — thresholds came out of the CLI on 2026-10-16. And SR-CONSTANTS decision 4 ("no tunable literal outside this file") cannot be satisfied while the checker is sealed; the record's Consequences now say so, and `built` in the register is **partly**, not yes.
- **Mistakes:** a bare `export { X } from` in `exportReport.ts` does not bind the name locally, and that file uses `MOVED_OFFSET_IN` twice — caught by the typecheck, fixed with an import plus a re-export.
- **Next:** the W-32 ruling. With B, W-05's remainder is minutes and W-02/W-04 open up. Unrelated and still open: `npm publish` for `pdfsuite` needs a LICENSE holder and a public/private ruling.

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
- **Caught while splitting:** the new sheet-to-page panes had taken `.pair-list` and `.pair-row`, which Batch compare already owned — everything the feature defines is now prefixed `sp-`, which is also what makes the boundary checkable. And `packages/cli/verify/spec-target.ts` imported `src/services/specCheck`, so the move broke the CLI; it now imports the headless barrel. CLI verify:spec 8/8, verify:regression clean.
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
