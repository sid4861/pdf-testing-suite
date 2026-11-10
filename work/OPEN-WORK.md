---
type: Queue
description: "The single live work queue, three lanes, plus the Blocked-on-Siddharth or Arpit inbox. The list only — its rules live in the record below."
governed_by: SR-WORK-OPEN-QUEUE
governed_by_path: records/0051_WORK-open-queue.md
---

# OPEN-WORK — what is still open

**This file is the LIST, plus the legend below.** Everything else — what the
queue is, an item's lifecycle, the shape of a row, ball precedence, ordering,
how the inbox works, and what every session owes — is stated once in
**[SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md)** and is not repeated
here. Read that record before changing anything below it.

**A ball on every row, always one:** 🔴 blocked on Siddharth or Arpit, directly or through another item · 🟣 gated on a named date, directly or through another item · 🟡 waiting on another item · 🟢 no blockers.
**Optional, after the ball:** 🧨 broken or getting worse · 🔺 do first (Siddharth or Arpit only). Full legend: [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rules 20–34.

---

## Blocked on Siddharth or Arpit

| what they decide | who | filed | age |
|---|---|---|---|
| `pdfsuite compare`, six open points: exit code 3 · `approve` · `expected.json` ledger · masks · `--redact-text` · `--jobs` / `--only` / `--fail-fast` — [W-07](open/W-07-pdfsuite-compare-redesign.md) §*Still open* | either | 2026-10-18 | 22 days |
| ↳ **blocks:** W-07 | | | |
| `@sheetpane/import` declares `engines: node >=22`; `pdfsuite` publishes `node >=20`. Raise pdfsuite's floor to 22, or ask Arpit for 20 upstream — [W-02](open/W-02-excel-spec-comparison.md) §Hazards | either | 2026-11-04 | 5 days |
| ↳ **blocks:** nothing yet — it bites when W-11 puts the spec check on the CLI | | | |
| Build `<pdfsuite-pdf-viewer>` — any PDF in a pop-up instead of a new tab — Arpit says when — [W-42](open/W-42-pdf-viewer-popup.md) | Arpit | 2026-10-18 | 22 days |
| ↳ **blocks:** W-42 | | | |
| L4 ruling: `@pdfsuite/viewer` as a **web-component package** outside `ui` (recommended), or the viewer inside `ui` — [W-42](open/W-42-pdf-viewer-popup.md) | either | 2026-10-18 | 22 days |
| ↳ **blocks:** W-42 | | | |
| Repository name and owner — `pdfsuite` under `sid4861` (recommended), under a new GitHub organisation (the account `pdfsuite` is taken), or a new name — [W-45](open/W-45-rename-repository.md) | either | 2026-10-18 | 22 days |
| ↳ **blocks:** W-45 | | | |
| Verdict effect of the new finding types — font embedding (W-14, default reported), annotations (W-19, fails), tags (W-21, informational), page size (W-24, fails), signatures and versions (W-25, informational), document properties (W-26, informational) — [SR-COMPARE](../records/0111_COMPARE.md) §1 *Not failing* | either | 2026-10-18 | 22 days |
| ↳ **blocks:** nothing else in the queue — each item builds with its default; the ruling flips one flag in `pageVerdict` | | | |

---

## Open items

### build


- 🟢 **W-02** · `agent` · filed by Arpit — spec intake. **9 of 10 DoD done** (2026-11-05): workbook → validation report → spec JSON → a checked PDF, all four downloads, a legacy workbook returned as a draft, the fixture frozen as an oracle, and a **blank Template v2 workbook** to start from. **Open:** decisions 10 (rich text) and 12 (relative values), neither exercised by any fixture row. **Opus.** [detail](open/W-02-excel-spec-comparison.md)
- 🟢 **W-04** · `agent` · filed by Arpit — spec checker per SR-SPEC-CHECK. **6 of 7 DoD done** (2026-11-05); DoD 3 ✅ except image content, which SR-SPEC-CHECK now names as unbuilt along with container fills. The item is finished bar decision 9; the CLI half is W-11. **Opus.** [detail](open/W-04-spec-check-v2.md)
- 🟢 **W-48** · `agent` · filed by Arpit — the workbook validation as a contract. **7 of 7 DoD done 2026-11-10.** Every refusal now carries a **code** from a closed list (`INTAKE_CODES`), the report is derived not stored and byte-stable, and it leaves as two files from both surfaces: `validation.json` (`pdfsuite.validation/1`) and the uploaded `.xlsx` back with its error cells red, the message on the cell as a comment, and a *Validation* sheet — from the Specification tab's export menu and from `pdfsuite spec <wb> --validate-only --out <dir>` (exit 2 on errors, per SR-CLI, not the 0/1/2 the item first wrote). The oracle is **71 checks** against the ten planted errors, and it caught a real one: `unit-unknown` (a spelling to fix) was being reported as `unit-disallowed` (a unit this parameter does not take), giving the nonsense *“cannot be given in inch; allowed: in, …”*. **Verified end to end in the browser:** ten refusals with their cells, the clean workbook + deviations PDF running to ✗ 11/22 elements pass, and both downloads clicked and read back. **Sonnet.** [detail](open/W-48-validation-report-contract.md)
- 🟢 **W-06** · `agent` · filed by Arpit — workspace tabs. **6 of 6 DoD done 2026-11-09**, ruled by Siddharth the same day: three tabs — **Compare · Specification · Inspect** — with comparing many pairs folded into Compare as its **Many** scope, behind the existing flag; "Open" on a pair switches to *One*. Names updated across the README, the four `public/*.html` pages, four records, the glossary and ARCHITECTURE (SVGs 01, 02, 20 re-rendered). Verified with the flag on and off. **Sonnet.** [detail](open/W-06-rename-workspace-tabs.md) 
- 🟢 **W-08** · `agent` · filed by Arpit — `pdfsuite compare` console output: header, one line per pair, one summary line with report path and exit code; everything else to stderr. **Sonnet.** [detail](open/W-08-cli-console-output.md)
- 🟢 **W-27** · `agent` · filed by Arpit — one compare core. **6 of 7 DoD done 2026-11-06**: one page loop, one page rule, one `result.json` and now one `report.html` on the CLI side. **Remainder:** the Compare tab keeps its richer report, which shows what `result.json` does not carry — filed as **B-018**. **Opus.** [detail](open/W-27-one-compare-core.md)
- 🟢 **W-09** · `agent` · filed by Arpit — `pdfsuite compare`, one pair per command. **7 of 7 DoD done 2026-11-06**: two PDFs in, three files out, `--pages` for a pairing you state, `--each` for two folders with orphans named and failing. `pairs.json`, the `pairs` command and the JUnit/CSV/Markdown writers are gone; every package is **2.0.0** with a migration note. **Opus.** [detail](open/W-09-pdfsuite-compare-one-pair.md)
- 🟡 **W-10** · `agent` · filed by Arpit — `@pdfsuite/agents` (files for Claude, Kiro, Codex, Copilot from one source) and publishing all six packages together. Waiting on W-09. **Opus.** [detail](open/W-10-npm-package-agent-files.md)
- 🟢 **W-43** · `agent` · filed by Arpit — CI/CD on GitHub Actions: every check on each pull request; approved releases publish all `@pdfsuite` packages at one version with trusted publishing. **Opus.** [detail](open/W-43-ci-cd-test-publish.md)
- 🟢 **W-44** · `agent` · filed by Arpit — monorepo layout: SR-MONOREPO, `apps/web` + `packages/` on npm workspaces, boundaries, room for the viewer, designer and creator. **Opus.** [detail](open/W-44-monorepo-layout.md)
- 🔴 **W-45** · `agent` · filed by Arpit — rename the repository (recommended `pdfsuite`) and every reference in one change; name and owner owed. **Sonnet.** [detail](open/W-45-rename-repository.md)
- 🟢 **W-11** · `agent` · filed by Arpit — `pdfsuite spec <spec> <pdf> --out <dir>`: **8 of 8 DoD done 2026-11-05.** The spec check runs on the command line from the same functions as the tab, writes the three files, and exits 0/1/2. `.xlsx` works — the spec machine and W-09's writers were both overtaken. **Ready to close** once the Node-floor ruling lands (it only bites at publish). **Opus.** [detail](open/W-11-pdfsuite-spec-cli.md)
- 🟢 **W-28** · `agent` · filed by Arpit — `pdfsuite inspect`. **6 of 6 DoD done 2026-11-06**: `inspectCore` and the pure `inspectPage` are in `@pdfsuite/core`, the tab keeps only hit-testing and drawing, and `pdfsuite inspect <pdf> [--page n] --out <dir>` is a built-in of the host writing the three files with `kind: inspect` and no verdict. `inspect-parity.ts` (34 checks) measures one page both ways and the documents are identical outside `run`. Found a third copy of the Form XObject `/Matrix` defect and proved the fix by reverting it. **Opus.** [detail](open/W-28-pdfsuite-inspect.md)
- 🟢 **W-29** · `agent` · filed by Arpit — npm workspaces. **5 of 6 DoD done 2026-11-06**: `packages/core`, `compare`, `cli` and the `agents`/`ui`/`create` shells, one version, everything importing by name, with `check-packages.sh` holding the line. **W-27, W-30, W-32 and W-33 are unblocked.** DoD 2 part-done: the report builders move into core with W-09 and W-27. **Opus.** [detail](open/W-29-npm-workspaces-packages.md)
- 🟢 **W-30** · `agent` · filed by Arpit — the CLI as a command host. **6 of 6 DoD done 2026-11-06**: `@pdfsuite/cli` depends on core and agents only; `compare` lives in its own package and is loaded by name at run time, so installing compare is what makes the command exist. Missing → exit 2 with the `npm i`, still listed by `--help`; a different version → exit 2 with both numbers; `pdfsuite-compare` for a global install. Proved by 18 discovery checks against the built binary and a 12-check pack-and-install test. **One departure:** `spec` stays compiled into the host until its package exists, rather than reporting “not installed”. **Opus.** [detail](open/W-30-cli-command-host.md)
- 🟢 **W-31** · `agent` · filed by Arpit — `npm create @pdfsuite`. **6 of 7 DoD done 2026-11-09**: an empty directory gets a seven-file Vite + React app with exactly one component; a React app gets `src/pdfsuite/` and the dependencies, with **only `package.json` touched** — hashed before and after to prove it. The mode comes from what is on disk, never a flag; the other targets are refused with the reason. 39-check smoke test from packed tarballs: the app installs, builds, and runs `npx pdfsuite compare`. It found a packaging defect — the packages publish TypeScript source, so a consumer's `tsc` fails on *our* code (**B-022**, fix before publishing). **DoD 5 (agent files) waits on W-10.** **Opus.** [detail](open/W-31-create-pdfsuite-app.md)
- 🟢 **W-32** · `agent` · filed by Arpit — `@pdfsuite/spec`. **5 of 5 DoD done 2026-11-06**: `src/features/spec/` is now `packages/spec/`, behind three barrels — the tab, the engine, the command. The Specification tab imports the package name; `pdfsuite spec` is loaded by name like `compare`, which closes W-30's one departure; `pdfsuite-spec` covers a global install; the duplicated pdf.js loader is gone. Two debts the move made visible are filed as **B-019** (it styles itself with the app's classes) and **B-020**. **Opus.** [detail](open/W-32-spec-package.md)
- 🟢 **W-33** · `agent` · filed by Arpit — `@pdfsuite/ui`. **5 of 6 DoD done 2026-11-06**: every screen, store and service moved into the package, this repository's `src/` is `main.tsx` and nothing else, and `<PdfSuiteApp config={…}/>` takes the tabs and the feature flags as configuration — `flag.env` is now *this app's* config, parsed by the package's own `parseFlagEnv`. All three tabs verified in the browser. **DoD 4 part-done:** the stylesheet ships but its class names are global, filed as **B-021**. **Opus.** [detail](open/W-33-ui-package.md)
- 🟢 **W-34** · `agent` · filed by Arpit — `--sync`. **5 of 5 DoD done 2026-11-09**: four rules — added, replaced, kept with `.pdfsuite-new`, stays-deleted — plus `--check` for CI and `--restore`. `package.json` is never replaced, only its `@pdfsuite/*` entries move. Found three bugs by running it **twice**, each of which lost a consumer's work on the *second* upgrade; `check-create.sh` is now 63 checks and runs every rule twice. L4 decision 5 is enforced rather than stated. **Opus.** [detail](open/W-34-create-sync.md)
- 🟡 **W-35** · `agent` · filed by Arpit — the app as a static single-page app at any URL and sub-path: relative assets, hash routing, pdf.js assets beside it. Waiting on W-33. **Sonnet.** [detail](open/W-35-spa-any-url.md)
- 🔴 **W-42** · `agent` · filed by Arpit — `<pdfsuite-pdf-viewer>` web component: any PDF (file, URL, bytes, base64) in a pop-up instead of a new tab, from any framework and every pdfsuite tab; level by level; blocked on Arpit's go-ahead and the L4 ruling. **Sonnet.** [detail](open/W-42-pdf-viewer-popup.md)
- 🟢 **W-46** · `agent` · filed by Arpit — the workbook in **sheetpane**. **5 of 6 DoD done 2026-11-09**: `@sheetpane/grid` 0.5.1 pinned, `sheetMarks.ts` mapping W-02's refusals and W-04's checks onto their own cells in two layers, the sheet and error panel in the tab, and **sheet ↔ PDF both ways** — a cell moves the page strip and lights the element, an element's cell button scrolls the sheet to that row. Verified in the browser; 23-check headless test on the mapping. **Left:** DoD 6's Playwright test, which needs the browser-test harness item; its docs and parity rows are done. **Opus.** [detail](open/W-46-sheet-viewer.md)
- 🟢 **W-52** · `agent` · filed by Siddharth — the packages publish **JavaScript** with `.d.ts`. **6 of 6 DoD done 2026-11-09**: `tsc` emits `dist` for all seven, `exports` has `development` → src (first, so the workspace reads source and a stale `dist` can never become anyone's types), `types`/`default` → dist. A created app now runs `tsc --noEmit` **clean, with no error inside a `@pdfsuite` package** — it was eleven. `check-create.sh` is 76 checks. Promoted from B-022. **Opus.** [detail](open/W-52-packages-publish-javascript.md)
- 🟡 **W-47** · `agent` · filed by Arpit — fix the workbook in sheetpane's Edit mode inside Specification: re-validated as you type, saved `.xlsx` used by the next check. Waiting on W-46 only — `mode="edit"` ships in `@sheetpane/grid` 0.5.1. **Sonnet.** [detail](open/W-47-sheet-editor.md)
- 🟢 **W-50** · `agent` · filed by Arpit — **Proof**, the design system, in code: tokens, local IBM Plex, stroke icons, component styles; SR-PROOF. **Sonnet.** [detail](open/W-50-proof-design-system.md)
- 🟡 **W-51** · `agent` · filed by Arpit — rebuild Compare (One · Many), Inspect and the edge states to the boards in `work/design/`; behaviour unchanged. Waiting on W-50, W-06. **Opus.** [detail](open/W-51-screens-to-proof.md)
- 🟡 **W-13** · `agent` · filed by Arpit — one PDF loader: bundled standard fonts and CMaps, `useSystemFonts: false`, same rendering in app and CLI. Waiting on W-12. **Opus.** [detail](open/W-13-pdf-loader-fonts-cmaps.md)
- 🟡 **W-14** · `agent` · filed by Arpit — report fonts that are not embedded, their substitute, and any embedding difference between the two PDFs as a finding. Waiting on W-13. **Opus.** [detail](open/W-14-font-embedding-report.md)
- 🟡 **W-15** · `agent` · filed by Arpit — font weight and italic from the font descriptor (`FontWeight`, `Flags`, `ItalicAngle`), "unknown" instead of a guess. Waiting on W-14. **Sonnet.** [detail](open/W-15-font-weight-from-descriptor.md)
- 🟡 **W-16** · `agent` · filed by Arpit — open password-protected PDFs: a prompt in the app, `--password-env` / `--password-file` in the CLI, never stored. Waiting on W-13. **Sonnet.** [detail](open/W-16-password-protected-pdfs.md)
- 🟡 **W-17** · `agent` · filed by Arpit — fillable form fields as content: Inspect shows name and value, Compare reports field changes, the CLI lists them. Waiting on W-12. **Opus.** [detail](open/W-17-fillable-form-fields.md)
- 🟡 **W-18** · `agent` · filed by Arpit — detect XFA forms and refuse them with a clear message in every surface; the CLI exits 2. Waiting on W-12. **Sonnet.** [detail](open/W-18-xfa-forms-detected.md)
- 🟡 **W-19** · `agent` · filed by Arpit — comments and annotations: listed in Inspect, compared apart from page content, reported in the CLI. Waiting on W-12. **Opus.** [detail](open/W-19-annotations-comments.md)
- 🟡 **W-20** · `agent` · filed by Arpit — classify each page as text, outlined, scanned or OCR, and say so wherever a text-based result would mislead. Waiting on W-12. **Opus.** [detail](open/W-20-page-kind-text-outlined-scanned.md)
- 🟡 **W-21** · `agent` · filed by Arpit — tagged PDFs: each element's tag and alt text in Inspect; tag changes reported by Compare. Waiting on W-12. **Opus.** [detail](open/W-21-tagged-pdf-structure.md)
- 🟡 **W-22** · `agent` · filed by Arpit — colour: text and fill colour in Inspect, "recoloured" changes in Compare, by perceptual distance. Waiting on W-12. **Opus.** [detail](open/W-22-colour-readout.md)
- 🟡 **W-23** · `agent` · filed by Arpit — correct image boxes on rotated and cropped pages and inside Form XObjects, in Inspect and Compare. Waiting on W-12. **Opus.** [detail](open/W-23-geometry-rotation-crop-xobjects.md)
- 🟡 **W-24** · `agent` · filed by Arpit — mixed page sizes: report a size difference as a finding and compare positions and text sizes in physical units. Waiting on W-12. **Opus.** [detail](open/W-24-mixed-page-sizes.md)
- 🟡 **W-25** · `agent` · filed by Arpit — signatures and earlier versions: shown in Inspect, differences reported by Compare; signatures never claimed valid. Waiting on W-14. **Sonnet.** [detail](open/W-25-signatures-revisions.md)
- 🟡 **W-26** · `agent` · filed by Arpit — document properties: a Document panel in Inspect (info, XMP, PDF/A–X, layers, attachments) and a properties diff in Compare and the CLI. Waiting on W-14. **Sonnet.** [detail](open/W-26-document-properties.md)

### testing

- 🟢 **W-12** · `agent` · filed by Arpit — PDF-kinds fixture corpus (fictional) and a harness that regenerates SR-PDF-SUPPORT's table from running files. **Opus.** [detail](open/W-12-pdf-kinds-corpus.md)
- 🟢 **W-36** · `agent` · filed by Arpit — `npm test` on `node:test`: today's `packages/cli/verify` checks ported, decision coverage, reference outputs with `test:approve`, first unit and property tests. **Sonnet.** [detail](open/W-36-test-runner-decision-coverage.md)
- 🟢 **W-37** · `agent` · filed by Arpit — the sample set: fictional realistic PDFs and `.xlsx` workbooks with planted deviations and `expected.json`, generated in TypeScript. **Opus.** [detail](open/W-37-sample-test-data.md)
- 🟡 **W-38** · `agent` · filed by Arpit — run the sample set end to end through the app path and the CLI; score found · missed · extra against `expected.json`; fail on a miss. Waiting on W-37. **Opus.** [detail](open/W-38-sample-set-runs-scorecard.md)
- 🟡 **W-39** · `agent` · filed by Arpit — contract and security tests: schema, manifest hashes, exit codes, console shape, escaping fuzz, no network, no secrets. Waiting on W-27. **Sonnet.** [detail](open/W-39-contract-security-tests.md)
- 🟡 **W-40** · `agent` · filed by Arpit — Playwright: each tab's main flow on the sample set, exports, and hosting at a sub-path; fails on any off-host request. Waiting on W-33. **Sonnet.** [detail](open/W-40-browser-tests-playwright.md)
- 🟢 **W-41** · `agent` · filed by Arpit — blind batches: prompts for an independent AI, sealed answer key behind hooks and agent messages, `blind:place` / `run` / person-run `judge`. **Opus.** [detail](open/W-41-blind-batches.md)

### record update

- 🟢 **W-01** · `agent` · filed by Arpit — claim every product component with a record; W-01 owns them all until then. **Opus.** [detail](open/W-01-claim-components.md)

### research

- 🔴 **W-07** · `cowork` · filed by Arpit — redesign `pdfsuite compare` from a blank slate; command, outputs, console, policy and determinism ruled; six points await a ruling. **Cowork.** [detail](open/W-07-pdfsuite-compare-redesign.md)

---
