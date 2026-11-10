---
type: Register
description: "The SR register: the convention, the ownership table, and the state of every record."
---

# SRs — the decision records

**How to use this file.** The naming convention, the record shape, the
ownership table and the rules every record obeys. Read it before writing a
record, before citing one, and before adding a module under every tracked path in the repository (`src/`, `packages/cli/`, `public/`, `tools/` and the root files).

One record per completed feature or ruled measurement. **Every record is cited
by NAME in prose, never by number.**

## What an SR is — and what it is not

A Standing Record is a **maintained specification**, not a decision-log entry:
amended in the same change as the code (law zero); superseded records are
rewritten or deleted; retired records are archived (L1); cited by name because
the content moves; it **owns** components and carries a veto condition to check
*today*. The decision-log role lives in `work/compare/` (the fork, its verdict,
its reopen-trigger) and `work/WORKLOG.md`.

## One directory, one state

`records/` is the only home a LIVE record has. A superseded record is rewritten
or deleted in the change that supersedes it; a **retired** record is moved to
`archive/records/` with `status: archived`, a dated banner and an
`archive/README.md` row (L1), and from then on is named, never cited.

Three files here are NOT records and carry no number: this register,
`TEMPLATE.md`, and `RULE-SINCE`.

## The three kinds

Every record declares a `kind`; it answers *what would have to change for this
record to become wrong?*

| `kind` | becomes wrong when | the gate the kind selects |
|---|---|---|
| `law` | Siddharth or Arpit rules differently | precedence: a record conflicting with a law is void in the conflicting part |
| `component` | the code changes | `scripts/sr-guard.sh` — the owning record is touched in the same change |
| `process` | the way work is done changes | it owns its enforcement — a hook or script today, a test once tests exist |

## The convention

**Path.** `records/NNNN_<short-name>.md`, on three ranges:

| range | holds | a new record takes |
|---|---|---|
| `0001`–`0050` | the **Law** records only — `0001` SR-LAWS, `0002` SR-LAW-0, `0003` SR-LAW-1 | the next free number after the highest law |
| `0051`–`0100` | the **WORK** records only — how work is done | the next free number after the highest |
| `0101`– | every other record | the next free number after the highest |

Gaps are reservations; no placeholder files. The number is a filename ordinal,
**not an identity**. **Cite by NAME, never by number.**

### Frontmatter is the metadata, and the body never restates it

Keys, in this order: `type` · `kind` · `name` · `title` · `description` ·
`status` · `date` · `feature` · `owns` · `laws` · `timestamp` · `content_sha`;
optional `supersedes`, `ratifies`. See `TEMPLATE.md` for each value. **Quote
any value containing `: `.** The body opens at §1 and restates none of it.

### A record states what is true now. It carries no history.

No `Amended` sections. When a decision changes, rewrite the sentence in place,
in the same commit. The one exception is an argument that still binds — it
belongs in *Alternatives considered*.

### Two sections and a bibliography

**§1 — For humans**: one screen; a diagram (Mermaid and a collapsed ASCII
twin, updated together). **§2 — For agents**: Context · Decision (numbered) ·
Consequences · Alternatives considered · Reference (required) · Veto
condition. **References**: every source cited, grouped; nothing new; never an
archived document.

**The reference is grounded** — never an archived doc. **The veto condition is
a condition, not an event** — checkable today with a command.

**A record that restates a cross-cutting principle is a bug.** Each law lives
in its own `SR-LAW-n` record; every other record names it in `laws:` and moves
on.

### Records are kept current by a check, not by good intentions

| where | what it does |
|---|---|
| `scripts/sr-guard.sh` | a `commit-msg` hook: refuses a commit that changes an owned component without staging its owning record and every describer — unless the message carries `no SR affected` on its own line. Install: `ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg` |
| `records/RULE-SINCE` | the baseline commit sha from which the rule applies, for a CI replay once one exists |

**The escape hatch is a claim in git history under your name**, not a silent
skip. What none of this proves: that a touched record is **coherent**.

Start from `TEMPLATE.md`.

---

## The register

**built** is `yes` when every decision in the record is in the product, `partly` when
some are and the record's Consequences name the rest, `no` when none are.

| # | name | title | status | built |
|---|------|-------|--------|-------|
| [0001](0001_LAWS.md) | **SR-LAWS** | The laws have exactly one home each; this record routes the handles | accepted | yes |
| [0002](0002_LAW-0-authority.md) | **SR-LAW-0** | **L0** — records are the only source of truth; Law records outrank every other record | accepted | yes |
| [0003](0003_LAW-1-retired-records-archived.md) | **SR-LAW-1** | **L1** — a retired record is archived, never deleted | accepted | yes |
| [0004](0004_LAW-2-open-source-only.md) | **SR-LAW-2** | **L2** — only open-source dependencies; nothing paid | accepted | no |
| [0005](0005_LAW-3-one-function-ui-and-cli.md) | **SR-LAW-3** | **L3** — the UI and the CLI run the same functions; every difference is named and ratified | accepted | no |
| [0006](0006_LAW-4-how-packages-work.md) | **SR-LAW-4** | **L4** — pdfsuite is UI + CLI; a single package is its CLI only; one version; upgrades never overwrite your changes | accepted | no |
| [0051](0051_WORK-open-queue.md) | **SR-WORK-OPEN-QUEUE** | How `OPEN-WORK.md` works — the queue discipline in eight groups | accepted | yes |
| [0052](0052_WORK-backlog.md) | **SR-WORK-BACKLOG** | How `BACKLOG.md` works — the named-but-unclaimed in five classes | accepted | yes |
| [0053](0053_WORK-lifecycle.md) | **SR-WORK-LIFECYCLE** | How a feature travels — compare, proposal, handoff in the item file opening with its At-a-glance table, the model line, one record | accepted | yes |
| [0054](0054_WORK-session.md) | **SR-WORK-SESSION** | What a session owes before it ends; the two-strikes rule | accepted | yes |
| [0055](0055_WORK-docs.md) | **SR-WORK-DOCS** | The documentation contract — form, steering-file edits, the documents every task updates | accepted | yes |
| [0056](0056_WORK-blockers.md) | **SR-WORK-BLOCKERS** | A blocker is a file, not a remark — `work/BLOCKED.json` and the three hooks | accepted | yes |
| [0057](0057_WORK-archive.md) | **SR-WORK-ARCHIVE** | One archive; named, never cited | accepted | yes |
| [0058](0058_WORK-ownership.md) | **SR-WORK-OWNERSHIP** | `owns` and `describes`, and the commit guard | accepted | yes |
| [0059](0059_WORK-governance.md) | **SR-WORK-GOVERNANCE** | The governance map — which file governs what; no counts | accepted | yes |
| [0060](0060_WORK-registry.md) | **SR-WORK-REGISTRY** | The doc registry — rules in §2, the table in §3 | accepted | yes |
| [0101](0101_SPEC-intake.md) | **SR-SPEC-INTAKE** | The spec workbook, its validation, and its conversion to spec JSON | accepted | partly |
| [0102](0102_SPEC-check.md) | **SR-SPEC-CHECK** | Checking a PDF against spec JSON — pages, reading, comparing, coverage | accepted | partly |
| [0103](0103_CONSTANTS.md) | **SR-CONSTANTS** | One constants file for every default and limit | accepted | yes |
| [0104](0104_STACK-typescript.md) | **SR-STACK-TYPESCRIPT** | The product is TypeScript; the Python CLI is removed | accepted | yes |
| [0105](0105_PDF-support.md) | **SR-PDF-SUPPORT** | Which kinds of PDF each tab and CLI can read — today's table, every gap tied to its work item | accepted | yes |
| [0106](0106_SURFACE-parity.md) | **SR-SURFACE-PARITY** | Every step and where it lives — core, UI only or CLI only — each exception ratified | accepted | no |
| [0107](0107_NPM-packages.md) | **SR-NPM-PACKAGES** | The seven `@pdfsuite` packages — what each installs; how an app is created, synced and hosted; which tab uses which | accepted | partly |
| [0108](0108_REPORT-html.md) | **SR-REPORT-HTML** | report.html — what it shows and how it looks; one self-contained, script-free file from result.json | accepted | partly |
| [0109](0109_REPORT-json.md) | **SR-REPORT-JSON** | result.json — the source of truth: schema, stable ids, wall-clock in one block | accepted | partly |
| [0110](0110_MANIFEST.md) | **SR-MANIFEST** | manifest.json — every input and output with size and SHA-256 | accepted | partly |
| [0111](0111_COMPARE.md) | **SR-COMPARE** | How comparing one pair works — pairing, three signals, changes, one page rule | accepted | no |
| [0112](0112_SPEC.md) | **SR-SPEC** | Spec-driven checking end to end — routes to SR-SPEC-INTAKE and SR-SPEC-CHECK | accepted | partly |
| [0113](0113_BULK-compare.md) | **SR-BULK-COMPARE** | How comparing many pairs works — pairing by name, compareMany, orphans fail | accepted | no |
| [0114](0114_INSPECT.md) | **SR-INSPECT** | How inspecting one PDF works — elements, measurements, document properties | accepted | partly |
| [0115](0115_CLI.md) | **SR-CLI** | The pdfsuite command line — commands, console, exit codes, outputs | accepted | partly |
| [0116](0116_TESTING.md) | **SR-TESTING** | How pdfsuite is tested — every decision proven; a realistic sample set scored end to end | accepted | no |

---

## Ownership — which record owns which component

**This table is the answer, not a judgement call.** Every component under
every tracked path in the repository appears here exactly once. Most specific wins; a carve-out is
justified by a *different decision*. A component with no decision yet is owned
by an open `W-nn`. A record's `owns:` key and this table agree in both
directions.

<!-- OWNERSHIP-TABLE-START -->

| component | owner | note |
|---|---|---|
| `scripts/sr-guard.sh` | SR-WORK-OWNERSHIP | the guard is the executable form of decisions 3 and 6 |
| `scripts/check-open-work-inbox.py` | SR-WORK-OPEN-QUEUE | rule 45a's check |
| `.claude/hooks/guard-open-work-inbox.sh` | SR-WORK-OPEN-QUEUE | rule 45a, in-session |
| `.claude/hooks/inject-inbox.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/stop-if-blocked.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/session-lock.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/require-progress.sh` | SR-WORK-SESSION | decision 5 |
| `scripts/check-work-items.sh` | SR-WORK-LIFECYCLE | decisions 4a–4c and 4e's check |
| `.claude/hooks/guard-work-items.sh` | SR-WORK-LIFECYCLE | decisions 4a–4c, in-session |
| `src/` | W-01 | the React/Vite PDF compare app — no record yet |
| `packages/spec/src/specCheck.ts` | SR-SPEC-CHECK | the spec checker |
| `packages/spec/src/specStore.ts` | SR-SPEC-CHECK | the spec tab's state |
| `packages/spec/src/SpecTestView.tsx` | SR-SPEC-CHECK | the spec tab |
| `packages/spec/src/SpecExportMenu.tsx` | SR-SPEC-CHECK | the spec tab's export menu |
| `packages/spec/src/types.ts` | SR-SPEC-INTAKE | the spec JSON type |
| `packages/spec/src/specIntake.ts` | SR-SPEC-INTAKE | the one workbook reader (decisions 1–6) |
| `packages/spec/src/sheetMarks.ts` | SR-SPEC-INTAKE | findings → sheetpane marks, two layers (W-46) |
| `packages/spec/src/SheetView.tsx` | SR-SPEC-CHECK | the workbook as a sheet, its cells marked (W-46) |
| `packages/spec/src/specTemplate.ts` | SR-SPEC-INTAKE | Template v2 (decisions 7, 7a) |
| `packages/spec/src/specValues.ts` | SR-SPEC-INTAKE | reading values (decisions 9, 11) |
| `packages/spec/src/specCompile.ts` | SR-SPEC-INTAKE | the spec JSON, every value with its cell (decision 14) |
| `packages/spec/src/specValidate.ts` | SR-SPEC-INTAKE | the validation report (decisions 13, 14) |
| `packages/spec/src/SpecValidation.tsx` | SR-SPEC-INTAKE | that report, in the tab |
| `packages/spec/src/specLegacy.ts` | SR-SPEC-INTAKE | the legacy nested layout (decision 8) |
| `packages/spec/src/specDraft.ts` | SR-SPEC-INTAKE | the draft v2 workbook it produces (decision 8) |
| `packages/spec/src/specOutputs.ts` | SR-SPEC-INTAKE | the four downloads (decision 14) |
| `packages/spec/src/specPages.ts` | SR-SPEC-CHECK | binding the Pages List to the PDF (decisions 1–3) |
| `packages/spec/src/specFonts.ts` | SR-SPEC-CHECK | font names and weights (decision 7) |
| `packages/spec/src/specColour.ts` | SR-SPEC-CHECK | colour by CIEDE2000 (decision 8) |
| `packages/spec/src/specFixList.ts` | SR-SPEC-CHECK | the Markdown fix-list, a UI-only view (decision 15) |
| `packages/spec/src/cli/` | SR-CLI | the `spec` command, in its own package (W-32) |
| `packages/spec/src/specResult.ts` | SR-REPORT-JSON | `buildResultJson` for a spec run |
| `packages/spec/src/schema/result.v1.json` | SR-REPORT-JSON | the shipped schema (decision 2) |
| `packages/spec/src/specReportHtml.ts` | SR-REPORT-HTML | `buildReportHtml` for a spec run |
| `packages/spec/src/specManifest.ts` | SR-MANIFEST | `buildManifest` for a spec run |
| `packages/core/src/constants.ts` | SR-CONSTANTS | every default and limit — created by W-05, moved into the core package by W-29 |
| `packages/core/` | W-01 | `@pdfsuite/core` — the loader, extraction and types; no record of its own yet |
| `packages/compare/` | SR-COMPARE | `@pdfsuite/compare` — the page rule, the page loop, changes and pairing (claimed by W-27) |
| `packages/compare/src/comparePair.ts` | SR-BULK-COMPARE | `compareMany`, the one loop over many pairs |
| `packages/agents/` | W-10 | `@pdfsuite/agents` — a named shell until W-10 fills it |
| `packages/ui/` | W-33 | `@pdfsuite/ui` — a named shell until W-33 fills it |
| `packages/create/` | W-31 | `@pdfsuite/create` — a named shell until W-31 fills it |
| `scripts/check-packages.sh` | SR-NPM-PACKAGES | decisions 1 and 2's check |
| `packages/cli/` | SR-CLI | `@pdfsuite/cli` — the `pdfsuite` command (claimed by W-09) |
| `public/` | W-01 | static pages and samples — no record yet |
| `public/samples/spec-sample.json` | SR-SPEC-CHECK | the in-app spec sample |
| `public/samples/report-spec-with-errors.xlsx` | SR-SPEC-CHECK | the Specification tab’s *load an example* workbook — a copy of the W-48 fixture |
| `public/samples/report-with-deviations.pdf` | SR-SPEC-CHECK | the PDF that example is checked against — a copy of the W-48 fixture |
| `public/samples/spec-sample.pdf` | SR-SPEC-CHECK | the in-app spec sample |
| `tools/` | W-01 | planning notes — no record yet |
| `work/samples/excel-spec-template-v2/` | SR-SPEC-INTAKE | the spec sample: a Template v2 workbook (explicit units, merged labels, dropdowns, red cells), ten planted intake errors and their oracle, and the matching and deviating PDFs |
| `index.html` | W-01 | app entry — no record yet |
| `vite.config.ts` | W-01 | build config — no record yet |
| `tsconfig.json` | W-01 | build config — no record yet |
| `tsconfig.tsbuildinfo` | W-01 | build artefact — no record yet |
| `package.json` | W-01 | dependencies — no record yet |
| `LICENSE` | SR-NPM-PACKAGES | the repository's MIT licence (decision 15) |
| `package-lock.json` | W-01 | dependencies — no record yet |
| `flag.env` | W-01 | feature flags — no record yet |
| `README.md` | W-01 | product docs — no record yet |
| `spec-standard.md` | SR-SPEC-INTAKE | the spec JSON format and the workbook template |
| `comparison.md` | W-01 | product docs — no record yet |
| `presentation-script.md` | W-01 | product docs — no record yet |
| `docs/ARCHITECTURE.md` | W-01 | product architecture diagrams — no record yet |
| `docs/architecture/` | W-01 | standalone SVGs rendered from `docs/ARCHITECTURE.md` — no record yet |
| `.tmp-old-block.txt` | W-01 | stray file — no record yet |
| `.gitignore` | W-01 | repo config — no record yet |
| `.claude/launch.json` | W-01 | dev launch config — no record yet |

<!-- OWNERSHIP-TABLE-END -->

## Describes — which record's subject REACHES INTO a component it does not own

Ownership stays one record per component; **describes is any number**, and the
guard demands the owner **and every describer**. Every row states its reason.
A component may be narrowed to symbols: `` `path::name,name` ``.

<!-- DESCRIBES-TABLE-START -->

| component | describer | why |
|---|---|---|
| `packages/spec/src/specStore.ts` | SR-SPEC-INTAKE | holds the uploaded spec and its validation (decisions 1, 2, 13) |
| `packages/spec/src/SpecTestView.tsx` | SR-SPEC-INTAKE | the spec upload — accepted types, label, downloads (decisions 1, 14) |
| `packages/spec/src/specCheck.ts::validateSpec` | SR-SPEC-INTAKE | validates an uploaded spec JSON (decision 2) |
| `scripts/check-work-items.sh` | SR-WORK-OPEN-QUEUE | checks a queue row's `filed by` against its item file (rule 14a) |
| `packages/core/src/pdfCompare.ts` | SR-PDF-SUPPORT | its loader, text, style and image extraction decide the Compare and compare-CLI cells |
| `packages/core/src/pdfElements.ts` | SR-PDF-SUPPORT | its text, font and image extraction decide the Inspect cells |
| `packages/core/src/pdfCompare.ts` | SR-PDF-SUPPORT | the one `loadPdf`; the spec copy went with W-32 |
| `packages/spec/src/specCheck.ts` | SR-PDF-SUPPORT | the spec reader decides the Spec cells (decision 4) |
| `packages/cli/src/platform/dom-shim.ts` | SR-PDF-SUPPORT | Node rendering decides the compare-CLI cells |
| `packages/cli/src/platform/engine.ts` | SR-PDF-SUPPORT | the CLI's door to the engine decides the compare-CLI cells |
| `packages/ui/src/store/compareStore.ts` | SR-SURFACE-PARITY | its page loop, "page changed" rule and pairing are parity rows |
| `packages/ui/src/store/batchStore.ts` | SR-SURFACE-PARITY | its page loop and multi-pair loop are parity rows |
| `packages/ui/src/store/regionStore.ts` | SR-SURFACE-PARITY | its ignored regions are a parity row |
| `packages/ui/src/services/exportReport.ts` | SR-SURFACE-PARITY | its report builders are parity rows |
| `packages/ui/src/components/measure/MeasureView.tsx` | SR-SURFACE-PARITY | holds Inspect measurements that belong in the core |
| `packages/compare/src/cli/` | SR-SURFACE-PARITY | the `compare` command; its page loop is a parity row |
| `packages/core/src/report/` | SR-SURFACE-PARITY | its report writers are parity rows |
| `packages/cli/package.json` | SR-NPM-PACKAGES | today's single package, split into seven by W-29 |
| `package.json` | SR-NPM-PACKAGES | gains the workspaces (W-29) |
| `packages/ui/src/services/exportReport.ts` | SR-REPORT-HTML | today's app HTML builder |
| `packages/compare/src/reportHtml.ts` | SR-REPORT-HTML | today's CLI HTML writer |
| `packages/ui/src/services/exportReport.ts::buildJsonReport` | SR-REPORT-JSON | today's app JSON builder |
| `packages/compare/src/result.ts` | SR-REPORT-JSON | today's CLI JSON writer |
| `packages/cli/src/core/manifest.ts` | SR-MANIFEST | today's manifest writer (generate) |
| `packages/core/src/pdfCompare.ts` | SR-COMPARE | the page comparison |
| `packages/compare/src/changes.ts` | SR-COMPARE | changes and the page rule |
| `packages/ui/src/store/compareStore.ts` | SR-COMPARE | the Compare tab's loop and pairing |
| `packages/spec/src/engine.ts` | SR-SPEC | the spec feature's headless surface |
| `packages/ui/src/store/batchStore.ts` | SR-BULK-COMPARE | the Bulk tab's loop |
| `packages/ui/src/services/batchExport.ts` | SR-BULK-COMPARE | the Bulk tab's exports |
| `packages/core/src/pdfElements.ts` | SR-INSPECT | element extraction |
| `packages/ui/src/components/measure/MeasureView.tsx` | SR-INSPECT | Inspect's measurements and view |
| `packages/cli/src/index.ts` | SR-CLI | commands and options |
| `packages/cli/src/core/exit.ts` | SR-CLI | exit codes |
| `packages/cli/src/commands/` | SR-CLI | the commands the host still runs itself — `generate` |
| `packages/cli/src/host.ts` | SR-NPM-PACKAGES | what a command module may use (decision 3) |
| `packages/cli/src/core/discover.ts` | SR-NPM-PACKAGES | loading a command package by name (decisions 3–4) |
| `packages/core/src/node/` | SR-NPM-PACKAGES | exit codes, `ToolError`, `fileFromPath` — shared across both bundles |
| `packages/core/src/inspect.ts` | SR-INSPECT | `inspectCore` — elements, edge distances, line height (decision 1) |
| `packages/core/src/report/inspectResult.ts` | SR-REPORT-JSON | `result.json` with `kind: "inspect"` |
| `packages/core/src/report/inspectReportHtml.ts` | SR-REPORT-HTML | an inspect's `report.html` |
| `packages/cli/src/commands/inspect.ts` | SR-INSPECT | `pdfsuite inspect` — a built-in of the host (decision 2) |
| `scripts/bundle.mjs` | SR-NPM-PACKAGES | the one place that knows how to bundle pdf.js for Node |
| `scripts/check-install.sh` | SR-NPM-PACKAGES | what an install gives you (§1) |
| `packages/create/src/detect.ts` | SR-NPM-PACKAGES | new vs add vs refuse (decision 7) |
| `packages/create/src/templates.ts` | SR-NPM-PACKAGES | every file a created app gets |
| `packages/create/src/manifest.ts` | SR-NPM-PACKAGES | `.pdfsuite/installed.json` (decision 8) |
| `scripts/check-create.sh` | SR-NPM-PACKAGES | a created app **type-checks** and builds; add mode changes nothing else; the four sync rules |
| `packages/tsconfig.emit.json` | SR-NPM-PACKAGES | the shared emit settings every package extends (W-52) |
| `packages/create/src/sync.ts` | SR-NPM-PACKAGES | `--sync`, `--check`, `--restore` (decision 8) |
| `packages/cli/verify/` | SR-TESTING | today's hand-run checks, ported into `npm test` by W-36 |
| `work/samples/` | SR-TESTING | the sample set and its expected results |

<!-- DESCRIBES-TABLE-END -->
