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
| `pdfsuite compare`, six open points: exit code 3 · `approve` · `expected.json` ledger · masks · `--redact-text` · `--jobs` / `--only` / `--fail-fast` — [W-07](open/W-07-pdfsuite-compare-redesign.md) §*Still open* | either | 2026-10-18 | 0 days |
| ↳ **blocks:** W-07 | | | |
| `@pdfsuite/spec`: build it on the spec machine (A), move the checker off the seal (B), or publish the mirror as preview (C) — [W-32](open/W-32-spec-package.md) | either | 2026-10-18 | 0 days |
| ↳ **blocks:** W-32 | | | |
| Confirm the tab names and order: **Compare** (One · Many) · **Specification** · **Inspect** — [W-06](open/W-06-rename-workspace-tabs.md) | Arpit | 2026-10-18 | 0 days |
| ↳ **blocks:** W-06 | | | |
| Build `<pdfsuite-pdf-viewer>` — any PDF in a pop-up instead of a new tab — Arpit says when — [W-42](open/W-42-pdf-viewer-popup.md) | Arpit | 2026-10-18 | 0 days |
| ↳ **blocks:** W-42 | | | |
| L4 ruling: `@pdfsuite/viewer` as a **web-component package** outside `ui` (recommended), or the viewer inside `ui` — [W-42](open/W-42-pdf-viewer-popup.md) | either | 2026-10-18 | 0 days |
| ↳ **blocks:** W-42 | | | |
| Repository name and owner — `pdfsuite` under `sid4861` (recommended), under a new GitHub organisation (the account `pdfsuite` is taken), or a new name — [W-45](open/W-45-rename-repository.md) | either | 2026-10-18 | 0 days |
| ↳ **blocks:** W-45 | | | |
| Verdict effect of the new finding types — font embedding (W-14, default reported), annotations (W-19, fails), tags (W-21, informational), page size (W-24, fails), signatures and versions (W-25, informational), document properties (W-26, informational) — [SR-COMPARE](../records/0111_COMPARE.md) §1 *Not failing* | either | 2026-10-18 | 0 days |
| ↳ **blocks:** nothing else in the queue — each item builds with its default; the ruling flips one flag in `pageVerdict` | | | |

---

## Open items

### build

- 🟢 **W-05** · `agent` · filed by Arpit — one constants file, `src/services/specConstants.ts`; move today's scattered tunables into it, values unchanged. **Sonnet.** [detail](open/W-05-constants-file.md)
- 🟡 **W-02** · `agent` · filed by Arpit — spec intake: upload `.xlsx` or JSON, validate it, compile to spec JSON with every value's cell; loaded with sheetpane's `@sheetpane/import`. Waiting on W-05 and sheetpane on npm. **Opus.** [detail](open/W-02-excel-spec-comparison.md)
- 🟡 **W-04** · `agent` · filed by Arpit — spec checker per SR-SPEC-CHECK: fix today's false failures, then pages, fonts, colour, coverage. Waiting on W-05. **Opus.** [detail](open/W-04-spec-check-v2.md)
- 🟡 **W-48** · `agent` · filed by Arpit — the workbook validation as a contract: every doubtful unit an error, each accepted row in plain words, the `.xlsx` handed back with red cells; same from the tab and `pdfsuite spec --validate-only`. Waiting on W-02. **Sonnet.** [detail](open/W-48-validation-report-contract.md)
- 🔴 **W-06** · `agent` · filed by Arpit — workspace tabs: Compare · Specification · Inspect, with Bulk compare folded into Compare as *Many*; names owed Arpit's confirmation. **Sonnet.** [detail](open/W-06-rename-workspace-tabs.md)
- 🟢 **W-08** · `agent` · filed by Arpit — `pdfsuite compare` console output: header, one line per pair, one summary line with report path and exit code; everything else to stderr. **Sonnet.** [detail](open/W-08-cli-console-output.md)
- 🟡 **W-27** · `agent` · filed by Arpit — one compare core for app and CLI: one page loop, one page-changed rule, one pairing input, shared report builders. Waiting on W-29. **Opus.** [detail](open/W-27-one-compare-core.md)
- 🟡 **W-09** · `agent` · filed by Arpit — `pdfsuite compare` as one pair per command (Option A): `--pages`, three files out (report.html, result.json, manifest.json), many pairs by `--each`. Waiting on W-27. **Opus.** [detail](open/W-09-pdfsuite-compare-one-pair.md)
- 🟡 **W-10** · `agent` · filed by Arpit — `@pdfsuite/agents` (files for Claude, Kiro, Codex, Copilot from one source) and publishing all six packages together. Waiting on W-09. **Opus.** [detail](open/W-10-npm-package-agent-files.md)
- 🟢 **W-43** · `agent` · filed by Arpit — CI/CD on GitHub Actions: every check on each pull request; approved releases publish all `@pdfsuite` packages at one version with trusted publishing. **Opus.** [detail](open/W-43-ci-cd-test-publish.md)
- 🟢 **W-44** · `agent` · filed by Arpit — monorepo layout: SR-MONOREPO, `apps/web` + `packages/` on npm workspaces, boundaries, room for the viewer, designer and creator. **Opus.** [detail](open/W-44-monorepo-layout.md)
- 🔴 **W-45** · `agent` · filed by Arpit — rename the repository (recommended `pdfsuite`) and every reference in one change; name and owner owed. **Sonnet.** [detail](open/W-45-rename-repository.md)
- 🟡 **W-11** · `agent` · filed by Arpit — `pdfsuite spec <spec> <pdf> --out <dir>`: the spec check on the command line, same three files as W-09; `.xlsx` once the reader runs under Node. Waiting on W-09. **Opus.** [detail](open/W-11-pdfsuite-spec-cli.md)
- 🟡 **W-28** · `agent` · filed by Arpit — `pdfsuite inspect`: Inspect's extraction and measurements moved to the core, called by the tab and the CLI alike (L3). Waiting on W-09. **Sonnet.** [detail](open/W-28-pdfsuite-inspect.md)
- 🟢 **W-29** · `agent` · filed by Arpit — npm workspaces: `packages/core`, `compare`, `cli`, `agents`, `create`; engine moved unchanged; Compare and Bulk import `@pdfsuite/compare`. **Opus.** [detail](open/W-29-npm-workspaces-packages.md)
- 🟡 **W-30** · `agent` · filed by Arpit — `@pdfsuite/cli` hosts `pdfsuite` and loads compare and spec; they depend on it and add `pdfsuite-compare` / `pdfsuite-spec`. Waiting on W-29. **Sonnet.** [detail](open/W-30-cli-command-host.md)
- 🟡 **W-31** · `agent` · filed by Arpit — `npm create @pdfsuite`: a new app, or pdfsuite added to an existing one, as a thin shell over `@pdfsuite/ui`. Waiting on W-33. **Opus.** [detail](open/W-31-create-pdfsuite-app.md)
- 🔴 **W-32** · `agent` · filed by Arpit — `@pdfsuite/spec`: the spec feature as a package used by the Spec tab and `pdfsuite spec`; where it is built is owed a ruling. **Opus.** [detail](open/W-32-spec-package.md)
- 🟡 **W-33** · `agent` · filed by Arpit — `@pdfsuite/ui`: the screens as React components and `<PdfSuiteApp/>`; this repo's app becomes a thin shell. Waiting on W-29. **Opus.** [detail](open/W-33-ui-package.md)
- 🟡 **W-34** · `agent` · filed by Arpit — `--sync`: upgrade a created app — versions bumped together, untouched files replaced, edited ones never overwritten. Waiting on W-31. **Sonnet.** [detail](open/W-34-create-sync.md)
- 🟡 **W-35** · `agent` · filed by Arpit — the app as a static single-page app at any URL and sub-path: relative assets, hash routing, pdf.js assets beside it. Waiting on W-33. **Sonnet.** [detail](open/W-35-spa-any-url.md)
- 🔴 **W-42** · `agent` · filed by Arpit — `<pdfsuite-pdf-viewer>` web component: any PDF (file, URL, bytes, base64) in a pop-up instead of a new tab, from any framework and every pdfsuite tab; level by level; blocked on Arpit's go-ahead and the L4 ruling. **Sonnet.** [detail](open/W-42-pdf-viewer-popup.md)
- 🟡 **W-46** · `agent` · filed by Arpit — Specification shows the workbook in **sheetpane** (Arpit's MIT package — loads and displays every workbook, Arpit 2026-10-19): `@sheetpane/grid`'s sheet and error component, validation and pass/fail marked on cells, cell ↔ PDF. Waiting on sheetpane's release, W-02, W-04. **Opus.** [detail](open/W-46-sheet-viewer.md)
- 🟡 **W-47** · `agent` · filed by Arpit — fix the workbook in sheetpane's Edit mode inside Specification: re-validated as you type, saved `.xlsx` used by the next check. Waiting on W-46. **Sonnet.** [detail](open/W-47-sheet-editor.md)
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
- 🟢 **W-36** · `agent` · filed by Arpit — `npm test` on `node:test`: today's `cli/verify` checks ported, decision coverage, reference outputs with `test:approve`, first unit and property tests. **Sonnet.** [detail](open/W-36-test-runner-decision-coverage.md)
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
