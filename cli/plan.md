# PDF Comparison CLI — implementation plan

Headless, language-agnostic CLI wrapping the existing comparison engine so PDF regression
testing can run from Python, a shell script, or a Jenkins job.

## Hard constraints

1. **The React app is not modified.** Zero edits to anything under `src/`, `public/`,
   `index.html`, `vite.config.ts`, or the root `package.json`. The app must build and run
   exactly as it does today.
2. **The comparison logic is not duplicated.** The CLI imports the app's services directly
   (`../src/services/*`) and adapts the *platform* underneath them. A forked engine would
   let the CLI and the app disagree about the same pair, which destroys the point of
   automating the check.
3. **Language agnostic.** The only requirement on the caller is that Node is installed.
   Everything is driven by flags, files, stdout, and exit codes.

## Why import-and-shim rather than copy

The engine is pure logic apart from a small, well-defined set of browser calls:

| Location | Browser dependency |
|---|---|
| `pdfCompare.ts` `renderAndExtract()` | `document.createElement('canvas')`, `getImageData`, `toDataURL` |
| `pdfCompare.ts` `pixelDiff()` | same |
| `exportReport.ts` `shrinkDataUrl()` | `new Image()` + canvas |
| `exportReport.ts` `download()` | `Blob`, `URL.createObjectURL`, synthetic `<a>` click |
| `pdfCompare.ts` line 6 | `import ... from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` (Vite-only) |

`changes.ts` is already fully pure. The task #16 refactor also already exports the report
building blocks (`REPORT_CSS`, `reportPageRows`, `reportPageDetail`, `judgePage`, `pct`,
`inchStr`, `escapeHtml`, `stamp`) as strings — so the CLI assembles its own HTML and writes
it with `fs`, and never calls `download()` at all.

That leaves a ~50-line global shim plus two bundler-level fixes, all living inside `cli/`.

## Risks, highest first

**R1 — `?url` import (build-time, not shimmable).** `?url` is a Vite transform; Node cannot
resolve it. Fixed with an esbuild plugin in `cli/build.mjs` that resolves `?url` imports to
a plain file-path string. Contained entirely in the CLI build config.

**R2 — pdf.js in Node.** The app imports `from 'pdfjs-dist'`, whose browser build may touch
DOM at import time. Mitigation: alias `pdfjs-dist` → `pdfjs-dist/legacy/build/pdf.mjs` in
the esbuild config, and point the worker at the legacy worker file. Confirmed present in
`node_modules/pdfjs-dist/legacy/build/`.

**R3 — `new Image()` with a data URL.** `@napi-rs/canvas` `Image` takes a Buffer, not a
data URL string. Mitigation: the shim provides a small `Image` class that decodes
`data:image/*;base64,` into a Buffer, calls `loadImage()`, and fires `onload`.

**R4 — font availability.** pdf.js substitutes missing fonts, which shifts pixels. Goldens
blessed on one machine can fail on a CI agent with a different font set. Out of scope for
now; to be handled by pinning a container image. Noted so it is not a surprise later.

**Spike gate:** R1–R3 are proven with a throwaway script that runs `comparePage()` on the
two sample invoices under Node *before* any command code is written. If the spike fails,
fall back to a thin adapter layer in `cli/` rather than forking the engine.

## Layout

```
cli/
  plan.md            this file
  package.json       own deps — not installed by the web app
  tsconfig.json      Node types + DOM lib (types only, nothing DOM at runtime)
  build.mjs          esbuild bundle: ?url plugin + pdfjs legacy alias
  src/
    index.ts             commander entry
    platform/
      dom-shim.ts        canvas / Image / ImageData globals — imported first
      engine.ts          imports app services after the shim, re-exports
    core/
      pairs.ts           load + resolve pairs.json
      config.ts          thresholds + precedence
      manifest.ts        read/write generation manifest
    commands/
      generate.ts
      compare.ts
      pairs.ts           dry-run: print resolved pairing, run nothing
    report/
      html.ts json.ts csv.ts junit.ts
  mock-api/
    server.js          Express stand-in for the real render API
  fixtures/
    payloads/*.json    inputs for `generate`
    golden/*.pdf       reference PDFs, copied from public/samples
    pairs.json         explicit pairing
```

Nothing in `cli/` is imported by the app; the dependency direction is one-way.

## Commands

### `generate`

```
pdfsuite generate --payloads ./fixtures/payloads --out ./.work/candidates \
                  [--api http://localhost:4000/render] [--concurrency 4] \
                  [--response-path pdfBase64] [--timeout 30000] [--retries 2] \
                  [--header "Authorization: Bearer …"] [--skip-existing]
```

Reads every `*.json` in `--payloads`, POSTs each to the API, writes
`<payload-stem>.pdf` into `--out`, and emits `--out/manifest.json` recording payload name,
payload sha256, HTTP status, duration, output path, byte size, and output sha256.

`--response-path` is a dot-path into the JSON response so the real API's shape can be
configured rather than coded. The mock returns `{ pdfBase64 }`, hence the default.

### `compare`

```
pdfsuite compare --reference ./fixtures/golden --candidate ./.work/candidates \
                 --pairs ./fixtures/pairs.json --report ./.work/reports \
                 [--format html,json,csv,junit] [--inline-assets] [--fail-on any|none]
```

Pairing is **explicit via `pairs.json`** (see schema below). Stem-match and manifest-based
pairing are deliberately deferred — explicit pairing first, since it is the form that has
to exist anyway for renamed goldens and per-pair tuning.

### `pairs`

```
pdfsuite pairs --reference … --candidate … --pairs …
```

Resolves and prints the pairing table, then exits. Answers "why did it compare *those two*"
without waiting for a full run.

## `pairs.json` schema

```json
{
  "defaults": { "contentPct": 99, "pixelPct": 2, "offsetIn": 0.03 },
  "pairs": [
    {
      "id": "invoice-standard",
      "name": "Invoice · standard layout",
      "reference": "invoice-original.pdf",
      "candidate": "invoice-standard.pdf",
      "thresholds": { "pixelPct": 5 },
      "skipPages": [6]
    }
  ]
}
```

- `reference` resolves against `--reference`, `candidate` against `--candidate`. Always
  relative, never absolute — the file stays portable across machines and CI workspaces.
- `id` is required and must be stable. It becomes the JUnit `<testsuite name>`, the asset
  folder, and the report anchor. Jenkins keys test history off the suite name, so a
  changing id silently throws away that pair's trend history.
- `thresholds` merges over `defaults`; `defaults` merges over built-ins.
- `skipPages` is 1-based, for pages that always differ (generated dates, barcodes).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | every pair passed |
| `1` | at least one pair failed its thresholds |
| `2` | tool error — bad args, unreadable PDF, API unreachable, **zero pairs resolved**, unmatched entry |

Separating `1` from `2` is what lets a pipeline distinguish "the PDFs regressed" from "the
job is broken". Zero resolved pairs is an error, not a pass — a job that compares nothing
and exits `0` is the failure mode this whole tool exists to prevent.

## Report outputs

Written to `--report`:

- `report.html` — the existing visual report, assembled from the app's own builders, so it
  is byte-for-byte the same layout the app produces
- `report.json` — machine-readable, for scripts
- `report.csv` — one row per pair × page
- `junit.xml` — one `<testsuite>` per pair, one `<testcase>` per page, `<failure>` naming
  the breached metric. Jenkins/GitLab/GitHub render this natively, giving per-page history
  and "what newly broke" for free.

Assets default to separate files under `report/assets/<pair-id>/` (better for CI
archiving); `--inline-assets` produces the single-file version for emailing.

## Mock API

`POST /render` accepts arbitrary JSON and returns `{ pdfBase64 }`. It maps a `template`
field in the payload to a file in the app's `public/samples/`, so the fixtures exercise a
real generate→compare loop without needing a PDF generator.

Deliberate test affordances, so the pipeline can be proven to actually catch a regression:

- `template` selects which sample is returned — pointing a payload at `invoice-recreated`
  vs `invoice-original` is the difference between a failing and a passing pair
- `?fail=1` / `?latency=ms` to exercise retry and timeout paths

Contract is documented so swapping in the real API is a flag change, not a code change.

## Sequence

1. Spike R1–R3 (gate — everything else depends on it)
2. Scaffold `package.json` / `tsconfig` / `build.mjs`
3. Mock API + fixtures (payloads, goldens copied, `pairs.json`)
4. `generate`
5. `pairs` resolution + `compare`
6. Report writers
7. End-to-end run + `cli/README.md`

## Deferred

Stem-match and manifest-identity pairing; `bless` for promoting candidates to goldens;
per-pair parallelism via `worker_threads`; Docker image for font determinism.
