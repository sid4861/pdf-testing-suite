---
type: Handoff
description: "Cold-start state of play for a successor session: in-flight work, constraints, lessons."
---

# Model handoff — the agent-succession record

*The departing model answers for the record, so whatever succeeds it inherits
the judgment and not just the files.*

**Standing instruction to every future model reading this: you are now the
maintainer of this document. When the project's direction, decisions or state
change, update it in the same change. Leave it better.**

## How to use this file

A state-of-play doc, not an end-of-session report. Keep it current **during**
the session. Write it for a different model arriving with zero other context,
mid-task. The four sections below are maintained; anything after them is
history. **A stale INTERVIEW at handoff is as serious as a missing worklog
entry.**

---

## 1 · State of play

*Updated 2026-10-13.* The work system is set up on branch `work-system-setup`.
The product — a React/Vite PDF comparison app (`src/`), a Node CLI (`packages/cli/`) and
a Python CLI (`cli-py/`, removed 2026-10-16) — predates it and has no records yet; W-01 owns every
product path until records claim them. **Ground it before you edit it** —
`git log`, the queue, the code.

*2026-10-14.* [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) maps the product
from the code — read it before W-01 to see where component boundaries fall.
Its **Watch** notes name known defects (app vs CLI verdict rules differ; Node
font rendering; scan races) that are **not yet backlog rows**.

*2026-10-14, later.* **Spec driven comparison is being re-aimed at Excel as the
truth** — [proposal](proposals/excel-spec-comparison.md), item
[W-02](open/W-02-excel-spec-comparison.md). Today the app takes JSON only and the
converter `tools/plan.md` relies on (`tools/spec-from-excel.py`) is not in the repo.
The fixture was `tools/samples/excel-spec-hierarchical/` (nested-layout workbook, matching PDF, PDF
with 12 known deviations, `generate.py`) — **replaced 2026-10-18** by
[`work/samples/excel-spec-template-v2/`](samples/excel-spec-template-v2/README.md), which carries the same
PDFs and expected results. It shows today's checker merges side-by-side text into one line.

*2026-10-16.* **Arpit ruled every Excel-spec question; four records hold the
answers** — [SR-SPEC-INTAKE](../records/0101_SPEC-intake.md) (upload, validation,
template v2 + legacy, spec JSON with source cells), [SR-SPEC-CHECK](../records/0102_SPEC-check.md)
(pages, fonts, colour, wording, coverage), [SR-CONSTANTS](../records/0103_CONSTANTS.md)
(one `packages/core/src/constants.ts`), [SR-STACK-TYPESCRIPT](../records/0104_STACK-typescript.md)
(product is TypeScript; `cli-py/` removed same day by W-03). Only SR-STACK-TYPESCRIPT is built. The proposal is
graduated. Real workbooks are confidential: never commit them, quote them or describe them.

## 2 · In flight, and the immediate next step

*Updated 2026-10-18.* Nothing in flight. Order: **W-05** (constants file) unblocks
**W-02** (spec intake) and **W-04** (spec checker — its DoD 1 defect fixes need only
W-05); **W-03** is closed. **W-06** (filed 2026-10-18, 🟢, independent): rename the
workspace tabs — Batch compare → Bulk compare, Compare 2 PDFs → Compare. **W-07** (filed
2026-10-18, 🔴): a blank-slate redesign of `pdfsuite compare`, incl. the files a run writes —
`work/proposals/pdfsuite-compare-cli.md`, awaiting a ruling (inbox). Arpit's steer: one pair per
command (batch = a user script), outputs = HTML + JSON + manifest only. **W-08** (🟢): the
agreed console output, independent of W-07. Arpit ruled 2026-10-18: Option A — **W-09** (🟢):
`pdfsuite compare` one pair per command, three files out. **W-10** (🟡 on W-09): npm package
with agent files for Claude, Kiro, Codex, Copilot. **W-11** (🟡 on W-09): `pdfsuite spec`,
taking over W-04's CLI DoD; `.xlsx` once the reader is on `@sheetpane/import` (DOM-free) on the spec machine. **SR-PDF-SUPPORT**
(0105, 2026-10-18) states which kinds of PDF each surface reads today; **W-12** (🟢, testing)
builds the fictional fixture corpus and the harness that proves the table; **W-13–W-26**
(🟡) close each gap, chained W-12 → W-13 → W-14 for the loader and the facts reader. **W-27** (🟢, filed 2026-10-18): one
compare core shared by app and CLI — W-09 now waits on it. Found: the strip / Next change
(`pageHasChange`, 0.02″) and the verdict (`summaryPageDiffers`, 2 px) disagree. **L3** (SR-LAW-3,
2026-10-18): the UI and the CLI run the same functions; every one-sided step is a row in
**SR-SURFACE-PARITY** with a reason, ratified by Siddharth or Arpit — the owed rows are one
inbox decision. **W-28** (🟡 on W-09): `pdfsuite inspect`. **SR-NPM-PACKAGES**
(2026-10-18): six packages — `@pdfsuite/core`, `compare`, `spec`, `cli`, `agents`, `create`;
installing compare or spec brings the CLI; each tab imports its package. Chain: **W-29**
(🟢, workspaces) → W-27 → W-09; W-29 → **W-30** (CLI host) → **W-31** (`npm create
@pdfsuite`); **W-32** (`@pdfsuite/spec`) 🔴 on where the spec package is built. Then, same day: **L4**
(SR-LAW-4) — pdfsuite is UI + CLI, a single package is its CLI, one version, sync never
overwrites; `@pdfsuite/ui` added (W-33), `create` new/existing modes (W-31), `--sync` (W-34),
static hosting at any URL (W-35); bulk ruled as `pdfsuite compare --each` (W-09, W-27
`compareMany`). Eight feature records (0108–0115: HTML, JSON, manifest, compare,
spec, bulk, inspect, CLI) — **accepted 2026-10-18** (review session, below). **SR-TESTING** (0116,
accepted): every record decision gets a named test, veto conditions run as tests, and a
fictional realistic sample set (PDFs + `.xlsx`, planted deviations, `expected.json`) is
scored end to end. Testing lane: **W-36** (🟢 `npm test`), **W-37** (🟢 sample set), W-38
(scorecard), W-39 (contracts, security), W-40 (Playwright); tools ruled 2026-10-18 — Ajv dev-only, Playwright dev-only, GitHub Actions (SR-TESTING decision 10). **W-41** (🟢):
blind batches — an independent AI generates inputs and the answer key from a prompt; the key
lives in a sealed folder (Arpit's choice of place, with hooks, deny rules and agent
messages); a person-run judge marks our reports (SR-TESTING decisions 11–16). **W-42**
(🔴 on Arpit): a PDF viewer pop-up in the app — pdf.js's own viewer components in a native
`<dialog>`; researched, not to be built until Arpit says so. **Laws, as of 2026-10-18 (second renumbering):** L0 authority (`0002`) · L1 retired
records archived (`0003`) · **L2 only open-source, free dependencies** (`0004`) · L3 one
function for UI and CLI (`0005`) · L4 how packages work (`0006`) — file number and handle now
line up. Earlier worklog entries keep the handles they were written with. **MIT `LICENSE`** added
(root and `packages/cli/`; SR-NPM-PACKAGES decision 15). **W-43** (🟢): CI/CD on GitHub Actions — every
check on each pull request; approval-gated release with npm trusted publishing. **W-44** (🟢):
monorepo — SR-MONOREPO, `apps/web` + `packages/` on npm workspaces, room for a viewer,
designer and creator (B-015–B-017; the creator's package is `@pdfsuite/render`, not
`create`). **W-45** (🔴): rename the repository — `pdfsuite` recommended; the GitHub account
`pdfsuite` is taken.

**Review session, 2026-10-18 (Cowork, on Arpit's instruction to ratify what can be ratified):**
four inbox rulings closed by delegation — Python dev scripts ported to TypeScript (SR-STACK-TYPESCRIPT
decision 4; W-36, W-37 delete the `.py` files as they land); every owed SR-SURFACE-PARITY row
ratified (plus a new *Ignored regions* row; *Mark expected* and *Ignored regions* hold only until W-07
rules on the ledger); records 0108–0115 accepted (L0 decision 3); SR-TESTING decision 10 ruled.
SR-SPEC-CHECK decision 15 amended to the three files, no JUnit. W-07 narrowed to six open points.
**New inbox row:** the verdict effect of the new finding types (W-14, W-19, W-21, W-24, W-25, W-26 —
each builds with its stated default meanwhile). Twelve items reconciled against the records written the
same day (stale "a new CLI record", "six packages", "README batch script", `packages/ui/src/services/` paths).
`docs/ARCHITECTURE.md` re-verified against the code (tab labels, sealed spec, `regionStore`), Part 4
rewritten as the ruled target — eight new diagrams (17–25), old 18 archived. **Still with Arpit:** W-32
(where `@pdfsuite/spec` is built), W-07's six points, the verdict-effect row, W-42, W-45.

**Units ruled, 2026-10-18 (Arpit: "no guesswork — if it is wrong, throw an error"):** SR-SPEC-INTAKE
decision 7a — a unit is its own cell from a closed list; blank, in-value, unknown or disallowed, or
`px` without *Pixels per inch* in Settings, is an error on that row, never inferred from Settings,
the row above or the parameter. The legacy nested layout (decision 8) now yields only a draft v2
workbook for a person to confirm — never an assertion. `~` and colour-name mismatches are errors.
SR-SPEC-CHECK decision 11: tolerances apply in the row's own unit. New fixture
`work/samples/excel-spec-template-v2/` — the Fleet report as a Template v2 workbook (TypeScript
`generate.ts` on `jszip`, deterministic; dropdowns and red-cell conditional formatting built in),
plus `report-spec-with-errors.xlsx` with ten planted intake errors and `expected-validation.json`
as the oracle. **Moved to `work/samples/` and the legacy sample deleted, 2026-10-18 (Arpit)** — PDFs
and images moved with it and are frozen until W-37; `tools/` now holds only `plan.md`. Arpit, same day: Element · Part · Group are **merged and centred** over their rows (a
declared range, read as such; blank label outside a merge = error) and there is **no ID column** — a
row is its sheet and row number. **W-48** (🟡 on W-02) is the validation contract — plain-words preview, annotated
`.xlsx` handed back, `pdfsuite spec --validate-only` parity; W-46/W-47 (parallel session) are the
in-place sheet viewer and editor on top of it. **Arpit, 2026-10-19: sheetpane loads and displays
every workbook** — `@sheetpane/import` is the one reader (browser and Node, so the CLI too) and
`@sheetpane/grid` the view; SR-SPEC-INTAKE decision 3 amended (was: own reader on `jszip`). sheetpane
is MIT, and **published since: `@sheetpane/import` and `@sheetpane/grid` are both at 0.5.1 on npm** (checked 2026-11-09), which unblocked W-46 and the dependency half of W-47. The intake has used `@sheetpane/import` since W-02. Real workbooks on the spec machine must be migrated
to v2 before they are checked — the legacy path only drafts.

**2026-11-03 → 2026-11-06 — the packaging became real, and this section had stopped
keeping up.** Nothing between 2026-10-19 and this paragraph was written here while it
happened, against [SR-WORK-SESSION](../records/0054_WORK-session.md); the ledger
([`IMPLEMENTATION.md`](IMPLEMENTATION.md)) carries those days with their evidence, and
nothing is reconstructed here after the fact. The state they left:

- **The spec feature is unsealed** (Siddharth, 2026-11-03, W-32 option B): it is edited in
  this repository like any other code, and this repository holds the live version. *Real
  spec workbooks still never leave the spec machine* — a rule about data, not code.
- **The workspace is real** (W-29): `packages/core`, `compare`, `cli`, `agents`, `ui`,
  `create`, all at **2.0.0**, importing each other by name, with
  `scripts/check-packages.sh` as the gate. `pdfjs-dist` is pinned exactly — a range once
  installed two copies of pdf.js and broke every render.
- **One compare core** (W-27): `pageVerdict` and `comparePair` decide for the Compare tab,
  the Bulk tab and the CLI alike; `compare-parity.ts` diffs the tab's `result.json` against
  the built binary's byte for byte. 6 of 7 DoD — the tab's richer report is **B-018**.
- **`pdfsuite compare` and `pdfsuite spec` are built** (W-09, W-11): one pair per command,
  `--each` for folders, three files always; `pairs.json`, the `pairs` command and the
  JUnit/CSV/Markdown writers are gone.
- **The CLI is a host** (W-30, 2026-11-06): `compare` lives in `@pdfsuite/compare` and is
  loaded by name at run time, so installing compare is what makes the command exist. The
  judgment that cost the most to find: *a plugin boundary is a bundle boundary* — what
  crosses it is copied, not shared, so a tool error is recognised by a brand string and
  never by `instanceof` ([`LESSONS.md`](LESSONS.md), 2026-11-06). `spec` stays compiled
  into the host until **W-32**, because reporting a working command as "not installed"
  would be a regression.
- **The spec feature is a package** (W-32, 2026-11-06): `packages/spec/`, three barrels,
  its own command module. Both CLI commands are now *loaded by name* — `generate` is the
  only thing the host runs itself — and installing `@pdfsuite/compare` or `@pdfsuite/spec`
  is what makes its command exist. The move was cheap because the folder imported nothing
  from the app; what it cost was references. It also showed what a package boundary
  exposes that a folder hides: the tab is styled with the *app's* classes (**B-019**).
- **All four CLI commands are in** (W-28, 2026-11-06): `generate` and `inspect` built into
  the host, `compare` and `spec` loaded from their packages. Inspect was the last surface
  with maths in a component — the edge distances and the line-height rule lived in
  `MeasureView.tsx`'s JSX, so there was nothing for a CLI to call. They are
  `inspectPage` in core now, and `inspect-parity.ts` diffs the tab's document against the
  binary's. The item also turned up a **third** copy of the Form XObject `/Matrix`
  defect; this time the fix was proved by reverting it, which is the lesson W-04 paid for.
- **The app is a shell** (W-33, 2026-11-06). Every screen is in `@pdfsuite/ui`; `src/` is
  `main.tsx`. The dependency now runs one way with nothing left over: **no package
  reaches into the app**, and `check-packages.sh` rule 2 has no allowances. The question
  the move forced, and the answer worth keeping: a package cannot read a *virtual module*
  its host's build config synthesises, so `flag.env` became this app's configuration and
  the flag list became the package's — which is the shape every "how do I configure it"
  question in `ui` should take.
- **`npm create @pdfsuite` works** (W-31, 2026-11-09), and finding that out turned up the
  thing that now gates publication as much as the Node floor does: **the packages ship
  TypeScript source**, so a consumer running `tsc` compiles ours with their settings and
  gets our errors in their project (**B-022**). It is invisible from inside the
  workspace — only an install from packed tarballs shows it, which is what
  `check-create.sh` does.
- **L4 decision 5 is enforced** (W-34, 2026-11-09): `--sync` upgrades a created app and
  cannot take anybody's work away. The judgment that generalises beyond this item: **a
  rule about not losing data has to be run twice before it is believed.** All three bugs
  in the first cut were invisible on the first upgrade and destructive on the second —
  an edit laundered into the record, a deletion forgotten, a `package.json` replaced
  wholesale. None would have been found by reading the code.
- **The tabs are settled** (W-06, Siddharth 2026-11-09): **Compare · Specification ·
  Inspect**, with many-pair comparison as Compare's **Many** scope. The judgment behind
  it, which is Arpit's: comparing a folder is the same question as comparing a pair, so
  it should not be somewhere else to go. One engine, one tab, a switch.
- **Publishing is no longer blocked on the packaging** (W-52, same day): every package
  ships built JavaScript with `.d.ts`, and a created app type-checks clean. The
  **Node-floor ruling** is the only thing left.
- **Owed before publishing:** the Node-floor ruling (`@sheetpane/import` wants `>=22`,
  pdfsuite publishes `>=20`). It bites only at publish, so it blocks W-10, not the work.
- **Next:** **W-32** (`@pdfsuite/spec`, now unblocked by W-29) — which is also what lets
  `spec` join discovery — or **W-28** (`pdfsuite inspect`).

`docs/ARCHITECTURE.md` and its SVGs were first landed on branch
`architecture-diagrams-records`, PR #3, stacked on PR #2. The 2026-10-14→16 spec work and W-03
are committed on branch `spec-driven-comparison`, not pushed.

## 3 · Standing constraints

- The deciders are **Siddharth or Arpit — either one rules alone**, by default whoever
  is committing the change, or the one a blocker names
  ([SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) decision 11).
- The laws: L0 (records are the only source; links, never restatements), L1
  (retired records are archived). See `records/0001_LAWS.md`.
- The queue is the list; a blocker is a file; nothing closed is deleted.
- **Every `W-nn` file opens with `## At a glance`** — a seven-row table (what · why ·
  done when · status · waits on · who · record) plus the plan's flowchart for three or
  more steps; it is what Arpit puts on screen in meetings. Rule: SR-WORK-LIFECYCLE
  decisions 4a–4d (Arpit, 2026-10-18); template `work/open/README.md`; check
  `bash scripts/check-work-items.sh` (hook in-session, `sr-guard.sh` at commit). A
  change to a row's ball or a DoD state updates the glance's Status in the same edit.
- **Every `W-nn` file names its people** in front matter — `filed_by`, `updated`,
  `updated_by` (a person, never a model) — and its queue row says `filed by <name>`
  (SR-WORK-LIFECYCLE 4e, SR-WORK-OPEN-QUEUE 14a; Arpit, 2026-10-18). Any edit to an item
  file bumps `updated` / `updated_by`; the check proves the shape, not the bump.
- Tests are not yet in place (`BACKLOG.md` B-001–B-005); the hooks and the
  commit guard are the only mechanical enforcement.
- Until W-01 closes, every product commit stages `work/open/W-01-*.md` or says
  `no SR affected` — except the spec paths, which now stage their SR-SPEC-* or
  SR-CONSTANTS record.

## 4 · Lessons learned

- **2026-10-18 — items filed in parallel go stale against records written the same day.** Twelve W-nn files still said "a new CLI record", "six packages" or "the README batch script" hours after SR-CLI, SR-NPM-PACKAGES and `--each` existed. Before ruling on or picking an item, diff its *Record* row and DoD text against the records it names. (`LESSONS.md`)
- **2026-10-18 — a section rewrite drops what a concurrent session added inside it.** Replacing the whole inbox block dropped W-42's row, filed minutes earlier by another session; that session restored it. Edit rows, not sections, in `work/*.md`; re-read right before every write. (`LESSONS.md`)
