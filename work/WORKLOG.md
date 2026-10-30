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
- **Done:** `LICENSE` (MIT, "the pdfsuite contributors") at the root and in `cli/` (added to `files`); root `package.json` `"license": "MIT"`; SR-NPM-PACKAGES decision 15; ownership row for `LICENSE`. Researched npm trusted publishing (GA 2025-07-31: OIDC, automatic provenance, npm 11.5.1+, GitHub Actions and gitlab.com only). Filed **W-43** (🟢, Opus) on Arpit's ruling of GitHub Actions (SR-TESTING decision 10): CI checks incl. Ajv, Linux-blocking matrix, licence gate, one-version script, approval-gated release in dependency order, post-publish install test, hardening. Restored W-42's inbox row, dropped in a concurrent rewrite of the inbox while W-42 stayed 🔴. Uncommitted.
- **Decided / left open:** MIT chosen to match `cli/package.json` (Apache-2.0 the alternative); copyright holder "the pdfsuite contributors" rather than guessed names.
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
- **Done:** compared `cli/src/platform/engine.ts`, `cli/src/commands/compare.ts`, `cli/src/report/*` with `compareStore`, `batchStore`, `exportReport.ts`. Engine and verdict are shared; the page loop is written three times, JSON/CSV/HTML writers are separate, pairing is app-only. Filed **W-27** (🟢, Opus); **W-09** re-balled 🟡 waiting on W-27; W-11's HTML DoD now asks the spec machine for a shared pure builder. Uncommitted.
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
- **Done:** researched `engine.ts`, `sheetRead.ts`, `specExport.ts`, `cli/verify/spec-target.ts`, the feature README. Filed **W-11** (🟡 waiting on W-09, Opus). Moved `pdfsuite spec` out of W-04 DoD 5 into W-11 (W-04 file, glance and row updated). Uncommitted.
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
- **Done:** chat-only. Read ARCHITECTURE, SR-SPEC-INTAKE/-CHECK, W-04, BACKLOG, `cli/verify/*`. Proposed a test plan in chat: one `npm test` (node:test, no new deps) over engine, verdict boundaries, spec intake/check, exports, CLI contract, app↔CLI parity, a PDF robustness corpus, then Playwright E2E. No file other than this entry changed.
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
