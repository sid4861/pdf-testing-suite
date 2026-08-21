# pdfsuite — headless PDF comparison for CI

Runs the React app's comparison engine from the command line so PDF regression testing can
be driven from a shell script, Python, or a Jenkins job. The only requirement on the caller
is that Node 20+ is installed — everything else is flags, files, and exit codes.

**The React app is not modified.** This CLI imports the app's services directly and adapts
the platform underneath them (see [`plan.md`](plan.md)). The engine is not duplicated, so
the CLI and the app can never disagree about the same pair.

> 📖 **[docs.html](docs.html)** — an illustrated guide to running this locally: the pipeline
> diagram, an annotated walkthrough with real terminal output, and every flag explained.
> Open the file directly in a browser.

## Setup

```bash
cd cli
npm install
npm run build          # bundles to dist/index.js
npm link               # makes `pdfsuite` available as a command
```

`npm link` registers the `pdfsuite` binary globally, pointing at this checkout — rebuilds
take effect immediately, no re-linking. If you would rather not install anything globally,
every `pdfsuite …` below also works as `node dist/index.js …`.

Check it:

```bash
pdfsuite            # lists the commands, a typical run, and the exit codes
pdfsuite --help
pdfsuite compare --help
```

## Quick start

```bash
# 1. start the mock render API (separate terminal)
npm run mock-api

# 2. generate candidate PDFs from JSON payloads
#    (the API url comes from pdfsuite.config.json — no --api needed)
pdfsuite generate --payloads ./fixtures/payloads --out ./.work/candidates

# 3. compare them against the goldens
pdfsuite compare --reference ./fixtures/golden --candidate ./.work/candidates --pairs ./fixtures/pairs.json --report ./.work/reports
```

Short flags keep it to one readable line:

```bash
pdfsuite compare -r ./fixtures/golden -c ./.work/candidates -P ./fixtures/pairs.json -o ./.work/reports
```

## Configuration

Two kinds of setting, two homes:

| | Lives in | Why |
|---|---|---|
| **How to reach the API** — url, headers, timeouts, retries, concurrency | [`pdfsuite.config.json`](pdfsuite.config.json) | Stable, reviewed, version-controlled. Not something to retype in a Jenkins job config. |
| **What to process this run** — `--payloads`, `--out`, `--reference`, `--report` | CLI flags | Varies per invocation. |

The config file is **discovered automatically** by walking up from the working directory
(like `git` or `eslint`), so commands work from anywhere in the project. Override with
`--config <file>`, or ignore it entirely with `--no-config`. The path it loaded is printed
at the top of every run, so there is never a mystery about which settings applied.

```json
{
  "api": {
    "url": "https://render.internal.example.com/v1/documents",
    "headers": {
      "Authorization": "Bearer ${RENDER_API_TOKEN}",
      "X-Client": "pdfsuite-cli"
    },
    "responsePath": "data.document.content",

    "concurrency": 4,
    "timeout": 120000,
    "retries": 2,
    "retryOnTimeout": false,
    "retryBackoff": 2000,
    "heartbeat": 15000
  },

  "compare": {
    "format": "html,json,csv,junit",
    "pixelThreshold": 0.1,
    "includeAA": false,
    "failOn": "any"
  }
}
```

### Authentication

Four schemes, declared under `api.auth`. Each ultimately produces a header or a query
parameter, but declaring it keeps credentials out of hand-built strings — and `basic`
base64-encodes the credentials for you, which is exactly the thing that ends up wrong when
written by hand:

```json
{ "type": "bearer", "token": "${API_TOKEN}" }
{ "type": "basic",  "username": "svc-pdf", "password": "${API_PASS}" }
{ "type": "header", "name": "X-API-Key", "value": "${API_KEY}" }
{ "type": "query",  "name": "api_key",   "value": "${API_KEY}" }
```

Add arbitrary headers alongside it under `api.headers`, and arbitrary query parameters
under `api.query`. Precedence when they collide: `-H` flag > `auth` > `headers`.

Query-string credentials are **redacted** (`api_key=***`) from the run log and from
`manifest.json`, since both are routinely archived as CI artifacts. Header values are never
printed at all — only header *names*, so "did my auth actually apply?" stays answerable:

```
POST         https://render.example.com/v1/documents?tenant=acme&api_key=***
headers      Content-Type, X-Client, Authorization
response     json at "data.document.content"
```

### Response shape

`api.responseMode` covers the three ways a PDF comes back:

| Mode | Response | |
|---|---|---|
| `json` *(default)* | `{"pdfBase64": "…"}` | base64 string at `api.responsePath` |
| `binary` | the body **is** the PDF | `Content-Type: application/pdf` |
| `base64` | body is a bare base64 string | no JSON wrapper |

`api.method` defaults to `POST`; `GET` and `DELETE` send no body, so such an API is
expected to key off the URL and `api.query`.

Whatever the mode, the decoded bytes are checked for the `%PDF-` magic number before
anything is written. A misconfigured endpoint very often returns `200` with an HTML error
page or a JSON envelope, and writing that to a `.pdf` turns a clear configuration problem
into a confusing "corrupt PDF" failure two commands later. Getting the mode wrong says so
directly:

```
✗ invoice-standard — Response is not JSON — it looks like a raw PDF; set api.responseMode to "binary"
```

### Where the PDFs go

`--out` (or `paths.out` in the config). Each `<name>.json` in `--payloads` is written as
`<name>.pdf` there, alongside a `manifest.json` recording status, timing, attempts, and the
sha256 of both payload and output.

**Secrets stay out of the file.** Any string value expands `${ENV_VAR}` from the
environment, so the committed config references a token that only exists on the CI agent:

```bash
export RENDER_API_TOKEN=…
pdfsuite generate --payloads ./payloads --out ./candidates
```

A referenced variable that is not set is a **hard error**, not an empty string — sending
`Authorization: Bearer ` would produce a 401 and a confusing hunt far from the real cause.

**Precedence:** an explicitly passed flag always wins, then the config file, then the
built-in default. `-H` headers merge over the config's `headers` object, so a one-off
override does not require editing the committed file.

**Unknown keys are rejected at every level.** A typo like `"comapre"` or `api.timout`
fails loudly, listing the keys that *are* valid there — rather than being silently ignored
while the CLI quietly uses a default you did not intend. Keys beginning with `$`
(`$schema`, `$comment`, `$comment_anything`) are treated as metadata and left alone.

The bundled fixtures deliberately produce a mixed result — `invoice-standard` fails,
`invoice-identical` and `statement-summary` pass — so you can see both outcomes and confirm
the tool is not passing (or failing) everything indiscriminately.

## Commands

### `generate`

POSTs each `*.json` in `--payloads` to the render API and writes `<stem>.pdf` into `--out`,
plus a `manifest.json` recording status, timing, and sha256 of both payload and output.

Everything below `--out` also reads from the config file — the `[config: …]` column is the
key it maps to. Passing the flag overrides the file.

| Flag | Default | Config key | |
|---|---|---|---|
| `-p, --payloads <dir>` | *required* | `paths.payloads` | directory of JSON payloads |
| `-o, --out <dir>` | *required* | `paths.out` | where to write PDFs |
| `-a, --api <url>` | — | `api.url` | render endpoint |
| `-X, --method <verb>` | `POST` | `api.method` | GET, POST, PUT, PATCH, DELETE |
| `--response-mode <mode>` | `json` | `api.responseMode` | `json` / `binary` / `base64` |
| `-c, --concurrency <n>` | `4` | `api.concurrency` | requests in flight |
| `-t, --timeout <ms>` | `120000` | `api.timeout` | per-request timeout |
| `-r, --retries <n>` | `2` | `api.retries` | retries on 5xx / network error |
| `--retry-on-timeout` | off | `api.retryOnTimeout` | also retry timeouts (see below) |
| `--retry-backoff <ms>` | `2000` | `api.retryBackoff` | base backoff, doubled per attempt |
| `--heartbeat <ms>` | `15000` | `api.heartbeat` | progress line while in flight; `0` disables |
| `--response-path <path>` | `pdfBase64` | `api.responsePath` | dot-path to the base64 PDF |
| `-H, --header <h...>` | — | `api.headers` | extra headers; CLI merges over config |
| `--skip-existing` | off | — | reuse PDFs already on disk (resume a partial run) |
| `--fail-fast` | off | — | stop at the first failure |

`--api` has no built-in default: it comes from `api.url` in the config, or the flag. If
neither is set the run fails immediately with an explanatory error rather than attempting
a request against nothing.

`--response-path` is what adapts this to a real API without code changes — e.g.
`--response-path data.document.content`.

## Working with a slow render API

The defaults assume a **slow** API — 20–40s per document is typical for real PDF
rendering. Four things follow from that, and they are the difference between a run that
works and one that fails for reasons unrelated to your PDFs.

**Timeout sits well above the worst response time.** Default `120000` (2 min) against a
40s API. A timeout that fires on a healthy-but-slow response is far more damaging than
waiting — it turns a working pipeline red. Raise it further if your p99 is worse; there is
no penalty for a generous timeout, only for a tight one.

**Timeouts are not retried by default.** If a request blew past an already-generous
timeout, the retry almost certainly will too — you have tripled the wall clock and still
failed. Measured on the mock API: 8 documents timing out take 5.3s to fail with the
default, versus 16.8s with `--retry-on-timeout` (16 wasted attempts). Against a real 40s
API with a 2-minute timeout, that is the difference between failing in 2 minutes and 6+.
5xx responses and network faults *are* retried, because a retry can actually fix those.

**A heartbeat runs every 15s.** With 40s calls a run is otherwise silent for minutes,
which reads as a hang — and CI runners routinely kill jobs that produce no output for N
minutes. The heartbeat is what keeps a long job alive and legible:

```
  …  3 in flight · longest acme-invoice-feb 30.0s · 3/8 done · ETA ~60.1s
```

The ETA is projected from completed API calls only, so it is absent on the first wave and
accurate afterwards. Set `--heartbeat 0` to disable.

**`--skip-existing` is the recovery path.** When each call costs 40s, re-running a
200-document batch from scratch to recover 3 failures is not viable. `--skip-existing`
reuses what is already on disk and only fetches what is missing — reruns cost the failures
only. Reused files are excluded from the timing statistics, so `average` and `slowest`
still describe real API calls.

Concurrency caveat: if the API is slow because rendering is CPU-bound, raising
`--concurrency` may just queue requests server-side and push them *all* past the timeout at
once. Start at `4` and increase only if you have measured that it helps.

Node's own `fetch` imposes no ceiling below ~5 minutes (verified empirically at 45s), so
`--timeout` is the binding constraint.

### `compare`

Runs the comparison engine over every pair and writes reports.

| Flag | Default | Config key | |
|---|---|---|---|
| `-r, --reference <dir>` | *required* | `paths.reference` | golden PDFs |
| `-c, --candidate <dir>` | *required* | `paths.candidate` | PDFs to check |
| `-P, --pairs <file>` | *required* | `paths.pairs` | `pairs.json` |
| `-o, --report <dir>` | *required* | `paths.report` | where to write reports |
| `-f, --format <list>` | `html,json,csv,junit` | `compare.format` | which reports to emit |
| `--pixel-threshold <n>` | `0.1` | `compare.pixelThreshold` | pixelmatch sensitivity |
| `--include-aa` | off | `compare.includeAA` | count anti-aliased pixels as differences |
| `--fail-on <mode>` | `any` | `compare.failOn` | `none` = report only, always exit 0 |

### `pairs`

Resolves and prints the pairing table, then exits — answers "why did it compare *those
two*?" without waiting for a full run.

## `pairs.json`

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
- `id` is required and must be **stable**. It becomes the JUnit `<testsuite name>`, the
  report anchor, and the asset path. CI keys test history off the suite name, so renaming
  an id silently discards that pair's trend history.
- `thresholds` merges over `defaults`, which merges over the built-in defaults.
- `skipPages` is 1-based — for pages that always differ (generated dates, barcodes).

Every entry must resolve to files that exist. An unmatched entry is a **hard failure**, not
a warning: a missing candidate means generation silently dropped a document, which is
exactly the regression worth catching.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | every pair passed |
| `1` | at least one pair breached its thresholds |
| `2` | tool error — bad args, unreachable API, unreadable PDF, unmatched pair, zero pairs resolved |

`1` vs `2` is the distinction that lets a pipeline tell "the PDFs regressed" from "the job
is broken". Zero resolved pairs is an error, never a pass.

## Reports

Written to `--report`:

- **`report.html`** — the full visual report, built from the app's own exporters: annotated
  A/B pages, the pixel-diff heatmap with layout/text colour coding, before→after labels,
  and a per-page change list. Open it, or Print → Save as PDF to share.
- **`report.json`** — per-pair and per-page metrics, verdicts, and the specific thresholds
  breached.
- **`report.csv`** — one row per pair × page.
- **`junit.xml`** — one `<testsuite>` per pair, one `<testcase>` per page. Jenkins, GitLab
  and GitHub Actions render this natively, giving per-page pass/fail history and
  "what newly broke" for free.

## Jenkins

The API url and headers come from the committed `pdfsuite.config.json`; only the token is
injected from credentials, and only paths are passed as flags.

CI invokes `node dist/index.js` rather than the linked `pdfsuite` binary — `npm link`
creates global state that is fragile in an ephemeral container, and the explicit path has
no such dependency.

```groovy
stage('PDF regression') {
  environment {
    RENDER_API_TOKEN = credentials('render-api-token')   // ${RENDER_API_TOKEN} in config
  }
  steps {
    sh 'cd cli && npm ci && npm run build'
    sh 'cd cli && node dist/index.js generate -p $WORKSPACE/payloads -o $WORKSPACE/.work/candidates'
    sh 'cd cli && node dist/index.js compare -r $WORKSPACE/golden -c $WORKSPACE/.work/candidates -P $WORKSPACE/pairs.json -o $WORKSPACE/.work/reports'
  }
  post {
    always {
      junit '.work/reports/junit.xml'
      archiveArtifacts artifacts: '.work/reports/report.html', allowEmptyArchive: true
    }
  }
}
```

Point a different environment at a different backend with one flag —
`--config ./config/staging.json` — rather than editing the job.

Calling from Python is the same shape:

```python
import subprocess
r = subprocess.run(
    ["node", "cli/dist/index.js", "compare",
     "--reference", "golden", "--candidate", "candidates",
     "--pairs", "pairs.json", "--report", "reports"],
    check=False,
)
# 0 = all passed · 1 = PDFs regressed · 2 = tool/config error
if r.returncode == 2:
    raise RuntimeError("pdfsuite failed to run")
```

## Mock API

`npm run mock-api` starts an Express stand-in on port 4000 that serves the PDFs already
bundled with the React app.

```
POST /render   { "template": "invoice-recreated", ... }  →  { "pdfBase64": "..." }
GET  /health
```

Templates: `invoice-original`, `invoice-recreated`, `statement-original`,
`statement-recreated`. Pointing a payload at `invoice-recreated` vs `invoice-original` is
the difference between a failing and a passing pair.

Test affordances: `?fail=1` returns 500 (exercises `--retries`), `?latency=2000` delays the
response (exercises `--timeout`).

Swapping in the real API should be a matter of `--api` and `--response-path`, not a code
change.

## Notes

- **Font availability affects rendering.** pdf.js substitutes missing fonts, which shifts
  pixels. Goldens blessed on one machine can fail on a CI agent with a different font set.
  Pin comparison runs to a container image with a known font set. Not yet handled here.
- pdf.js emits noisy font warnings on these samples; they are filtered unless `--verbose`
  is passed. Rendering is unaffected — `spike/run-engine.ts` verifies the CLI's metrics
  match the browser's exactly.
- `spike/run-engine.ts` doubles as the smoke test: run it after any change to the app's
  services to confirm the CLI still works.
  `node build.mjs --entry spike/run-engine.ts --out .work/spike.js && node .work/spike.js`
