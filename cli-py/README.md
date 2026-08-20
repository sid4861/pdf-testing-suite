# pdfsuitepy — PDF regression testing from Python

A Python CLI and library for the same PDF comparison pipeline as [`../cli`](../cli).
Install with pip, drive it from a script, a pytest suite, or CI.

> 📖 **[docs.html](docs.html)** — illustrated guide: architecture diagram, annotated
> walkthrough with real terminal output, library recipes, and every flag.

```bash
cd cli-py
pip install -e .
pdfsuitepy --version
```

---

## What was implemented

### The split, and why

The two commands are not equally portable, so they are implemented differently:

| Command | Implementation | Needs Node? |
|---|---|---|
| `generate` | **Native Python** (stdlib only) | No |
| `compare` | **Delegates** to the Node engine | Yes |
| `pairs` | Delegates | Yes |

**`generate` contains no comparison logic** — it is HTTP, base64, and file writes. Porting
it carries zero fidelity risk, and it means a Python-only workflow can fetch candidate PDFs
without a JS runtime present.

**`compare` is entirely engine.** Every number it produces comes from pdf.js rendering. A
Python port using PyMuPDF or pypdfium2 would rasterize differently — different
anti-aliasing, font hinting and subpixel positioning — so pixel ratios, content-match
percentages and offsets would all drift from what the React app shows for the same pair.
Thresholds tuned in the app would be wrong here, and goldens blessed with one tool would
fail with the other. Delegating keeps one source of truth: **a verdict from this package is
the verdict the app would show.**

`pdfsuitepy --version` reports which engine was found, so that is never a mystery:

```
pdfsuitepy 1.0.0
  engine: node v20.12.2 · C:\…\cli\dist\index.js
```

### Zero runtime dependencies

`pyproject.toml` declares no dependencies. This tool drops into arbitrary CI environments
and existing Python projects, where an added dependency is a version conflict waiting to
happen. `urllib` from the stdlib covers everything `generate` needs.

### Shared configuration

Reads **the same `pdfsuite.config.json`** the Node CLI does — same discovery (walking up
from the working directory), same `${ENV_VAR}` expansion, same validation, same precedence
(explicit flag > config file > built-in default). Configuration does not fork between
implementations, so switching does not silently change behaviour.

Also shares `pairs.json` unchanged.

### Feature parity in `generate`

Everything the Node implementation does, reimplemented to match:

- **Auth** — `bearer`, `basic` (base64-encodes for you), `header`, `query`
- **Response modes** — `json` (base64 at a dot-path), `binary` (body is the PDF), `base64`
  (bare base64 body)
- **Methods** — GET / POST / PUT / PATCH / DELETE; GET and DELETE send no body
- **Arbitrary headers and query parameters**, merged with the same precedence
  (`-H` flag > `auth` > config `headers`)
- **`%PDF-` magic-number check** before writing, so a misconfigured endpoint returning an
  HTML error page fails with a clear message instead of producing a "corrupt PDF" two
  commands later
- **Credential redaction** in the run log and manifest (`api_key=***`); header values are
  never printed, only header names
- **Slow-API tuning** — 120s default timeout, timeouts not retried by default, 2s scaling
  backoff, 15s heartbeat with ETA, `--skip-existing` resume
- **Manifest** written with the Node CLI's field names, plus `producedBy` so you can tell
  which implementation produced a run

### Library API

The main reason to use this over `subprocess.run` yourself — typed results:

```python
from pdfsuite import compare, generate

generate(payloads="./payloads", out="./candidates",
         api="https://render.example.com/v1/documents", quiet=True)

result = compare(reference="./golden", candidate="./candidates",
                 pairs="./pairs.json", report="./reports", quiet=True)

if not result.passed:
    for pair in result.failures:
        worst = pair.worst_page
        print(pair.id, "page", worst.page, worst.breaches)
```

```
invoice-standard page 5 ['content 83.91% < 99%', 'pixels 9.92% > 2%', 'offset 2.181" > 0.03"']
```

Exposed types: `CompareResult`, `PairResult`, `PageVerdict`, `GenerateResult`,
`GeneratedDoc`, plus `Exit` and `ToolError`.

### Exit codes — identical to the Node CLI

| Code | Meaning |
|---|---|
| `0` | every pair passed |
| `1` | a pair breached its thresholds — the PDFs changed |
| `2` | tool error — bad args, unreachable API, unmatched pair, nothing to compare |

Running `pdfsuitepy` bare prints help and exits **0** — asking what a tool does is not an
error.

---

## Commands

### `generate` (native Python)

```bash
pdfsuitepy generate --payloads ./payloads --out ./candidates
```

| Flag | Default | Config key |
|---|---|---|
| `-p, --payloads DIR` | *required* | `paths.payloads` |
| `-o, --out DIR` | *required* | `paths.out` |
| `-a, --api URL` | — | `api.url` |
| `-X, --method VERB` | `POST` | `api.method` |
| `--response-mode` | `json` | `api.responseMode` |
| `--response-path` | `pdfBase64` | `api.responsePath` |
| `-c, --concurrency N` | `4` | `api.concurrency` |
| `-t, --timeout MS` | `120000` | `api.timeout` |
| `-r, --retries N` | `2` | `api.retries` |
| `--retry-on-timeout` | off | `api.retryOnTimeout` |
| `--retry-backoff MS` | `2000` | `api.retryBackoff` |
| `--heartbeat MS` | `15000` | `api.heartbeat` |
| `-H, --header H` | — | `api.headers` |
| `--skip-existing` | off | — |
| `--fail-fast` | off | — |

### `compare` (delegates)

```bash
pdfsuitepy compare -r ./golden -c ./candidates -P ./pairs.json -o ./reports
```

| Flag | Default | Config key |
|---|---|---|
| `-r, --reference DIR` | *required* | `paths.reference` |
| `-c, --candidate DIR` | *required* | `paths.candidate` |
| `-P, --pairs FILE` | *required* | `paths.pairs` |
| `-o, --report DIR` | *required* | `paths.report` |
| `-f, --format LIST` | `html,json,csv,junit` | `compare.format` |
| `--pixel-threshold N` | `0.1` | `compare.pixelThreshold` |
| `--include-aa` | off | `compare.includeAA` |
| `--fail-on any\|none` | `any` | `compare.failOn` |

### `pairs`

Resolves and prints the pairing table without comparing anything.

### Common

`--config FILE`, `--no-config`, `-v/--verbose`, `-q/--quiet`.

---

## Environment overrides

| Variable | Purpose |
|---|---|
| `PDFSUITE_NODE` | path to the node executable, when it is not on PATH |
| `PDFSUITE_NODE_BUNDLE` | path to `cli/dist/index.js`, when it is not beside this checkout |

By default the bundle is found by walking up from the package and from the working
directory, so a source checkout works with no configuration.

---

## Verification

Everything below was run against the bundled mock API.

**Byte-identical output.** PDFs produced by `pdfsuitepy generate` were sha256-compared
against both the Node CLI's output and the original sample files, across all four response
shapes:

```
json     3 pdfs  byte-identical to source
binary   3 pdfs  byte-identical to source
base64   3 pdfs  byte-identical to source
nested   3 pdfs  byte-identical to source
```

**Identical comparison metrics.** `pdfsuitepy compare` reproduces the Node CLI's numbers
exactly — 95.82% / 92.94% / 0.264″ / 83.91% / 9.92% / 2.181″ — because it is the same
engine, not a reimplementation.

**Manifest schema parity.** Field-by-field diff against a Node-produced manifest: no
differing entry fields, and only the additive `producedBy` key at the top level.

**Credential redaction.** `api_key=***` in both the log and the manifest, byte-for-byte
matching the Node output; grepping the artifacts for the real key finds nothing.

**16/16 parity checks passed** — four auth schemes, four response modes, compare/pairs
delegation, `--fail-on none`, and five misconfiguration cases all producing the same exit
codes as the Node CLI.

---

## Known limitations

- **`compare` requires Node ≥ 20.** Checked up front with an actionable error rather than a
  cryptic failure from the bundle. `generate` needs nothing but Python.
- **The Node bundle must be built** (`cd cli && npm install && npm run build`) before
  `compare` will work.
- **Font availability still applies.** pdf.js substitutes missing fonts, which shifts
  pixels — goldens blessed on one machine can fail on an agent with a different font set.
  Unchanged from the Node CLI; pin comparison runs to a container image with a known font
  set.
- **No pytest plugin yet.** The library API supports it (`assert result.passed`), but a
  first-class fixture with per-pair test IDs is not built.
