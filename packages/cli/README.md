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

## Install

`pdfsuite` is a **host**. It owns the command, the config file and the exit codes; the
work lives in packages it loads by name when they are installed. So you install the thing
you want to do, and the command comes with it.

| you run | you get |
|---|---|
| `npm i @pdfsuite/compare` | `npx pdfsuite compare`, `npx pdfsuite compare --each` |
| `npm i @pdfsuite/spec` | `npx pdfsuite spec` |
| `npm i -g @pdfsuite/compare` | `pdfsuite-compare` on your PATH |
| `npm i -g @pdfsuite/spec` | `pdfsuite-spec` on your PATH |
| `npm i @pdfsuite/cli` | the host alone: `generate` and `inspect`, and the `--help` that says what else to install |

Install both and `pdfsuite` has both commands. Install neither and it still lists them,
with the `npm i` to run.

### 1. From npm

```bash
npm i --save-dev @pdfsuite/compare
npx pdfsuite compare ./golden/invoice.pdf ./candidates/invoice.pdf --out ./reports/invoice
```

Installing `@pdfsuite/compare` pulls in `@pdfsuite/cli` as a dependency, and a local
install links a dependency's bin, so `npx pdfsuite` is there without naming the host.

Globally, it is the other way round — a global install links only the installed package's
own bin, not its dependencies' — so compare brings its own:

```bash
npm i -g @pdfsuite/compare
pdfsuite-compare ./golden/invoice.pdf ./candidates/invoice.pdf --out ./reports/invoice
```

`pdfsuite-compare` is a forwarder: same arguments, same config file, same exit codes, with
`compare` filled in. Install `@pdfsuite/cli` globally as well if you want the bare `pdfsuite` command on your
PATH too. `@pdfsuite/spec` works the same way — `pdfsuite spec` locally,
`pdfsuite-spec` globally.

Two paths, positional: the **golden** PDF and the **candidate**, with `--out` for the
three files it writes. Two folders instead, with `--each`, compares every pair in one
process.

**If a command's package is not installed**, the host says so and exits 2 with the
`npm i` to run — never "unknown command", because the command is known:

```text
$ pdfsuite compare a.pdf b.pdf --out reports

Error: `pdfsuite compare` needs @pdfsuite/compare, which is not installed.
  Run: npm i @pdfsuite/compare@2.0.0  (or npm i -g @pdfsuite/compare@2.0.0 for a global install)
```

The suite is published as one version, so a package at a different number is also exit 2,
with both numbers printed.

Up to 1.x this was one package called `pdfsuite` that took four paths and a `pairs.json`;
2.0.0 changed the packaging, the shape and the outputs. If you are upgrading, read
*Moving from 1.x* at the foot of this file first.

### 2. From a tarball

```bash
npm pack                       # in cli/ — writes pdfsuite-1.0.0.tgz
npm install -g ./pdfsuite-1.0.0.tgz
```

The tarball is four files and about 700 KB. It still needs the registry (or a warm npm
cache) for `@napi-rs/canvas`, so it is not an offline install.

### 3. Copy a folder

Two shapes, and the trade-off is **network versus platform**:

| | size | platform | network |
|---|---|---|---|
| `--lean` | ~3.4 MB | **any** | one `npm install` on arrival |
| sealed *(default)* | ~40 MB | **one** | never |

Lean is the one to reach for — it goes to a Mac, a Linux box or Windows unchanged, and
`npm install` picks the right compiled renderer wherever it lands:

```bash
sh scripts/make-portable.sh --lean   # in cli/ — builds .work/pdfsuite-portable-lean/
```

Then on the receiving machine, once:

```bash
cd pdfsuite-portable-lean && npm install
```

Its `package.json` is trimmed to the one runtime dependency, so that install fetches
`@napi-rs/canvas` and nothing else — no build toolchain. After it, the folder is
self-contained, and a copy of it *is* a sealed folder for that platform.

Sealed is for a machine that cannot reach a registry at all:

```bash
npm run portable                     # in cli/ — builds .work/pdfsuite-portable/
```

Copy that folder anywhere — a share, a USB stick, another machine — and run it:

```bash
node /path/to/pdfsuite-portable/dist/index.js compare ./golden/invoice.pdf ./candidates/invoice.pdf --out ./reports/invoice
```

No `npm install`, no global binary, no network. Node 20+ is the only requirement. The paths
you pass are relative to **your** working directory, not to the folder.

The folder carries its own **`START-HERE.html`** — open it in a browser. It explains the
whole thing for someone who has never seen the tool, and builds the command from fields
you fill in. It is self-contained (system fonts, no external
requests), so it works on a machine with no network, and it is stamped with the platform the
folder was built for. `RUN-ME.txt` says the same in plain text for a machine with no browser.

A *sealed* folder carries one compiled canvas binary, so it runs on **one platform**: the
one it was built for. `--target` builds for another, which is how a Mac folder gets
assembled on Windows:

```bash
sh scripts/make-portable.sh --target darwin-arm64    # macOS, Apple Silicon
sh scripts/make-portable.sh --target darwin-x64      # macOS, Intel
sh scripts/make-portable.sh --target linux-x64-gnu   # Linux and most CI images
sh scripts/make-portable.sh --target win32-x64-msvc  # Windows
```

That fetches the target's binary from npm at the version the local wrapper pins, so the
*build* needs network even though the *result* does not. On the wrong platform the folder
reports a missing `@napi-rs/canvas` binding rather than misbehaving. `--lean` and
`--target` contradict each other and the script says so.

### Why there is a native dependency

`@napi-rs/canvas` renders the pages. It cannot be bundled into the JavaScript the way
everything else is, because it is a compiled binary. Both the pixel diff and the report's
page images come from it, so there is no smaller install that still produces a visual
report.

### From this checkout instead

```bash
cd cli
npm install
npm run build          # typechecks, bundles to dist/index.js, copies the pdf.js worker
npm link               # makes `pdfsuite` available as a command
```

`npm link` points the global binary at this checkout, so rebuilds take effect immediately.
Everything below also works as `node dist/index.js …`.

Publishing from here resolves `pdfjs-dist`, `pixelmatch` and `diff` from the **repository
root's** `node_modules` at build time and bundles them, so `npm install` at the root has to
have been run first.

Check it:

```bash
pdfsuite            # lists the commands, a typical run, and the exit codes
pdfsuite --help
pdfsuite compare --help
```

## On macOS

Nothing special for the normal install — `npm install -g pdfsuite` resolves the Apple
Silicon or Intel binary by itself:

```bash
npm install -g pdfsuite
pdfsuite compare ./golden/invoice.pdf ./candidates/invoice.pdf --out ./reports/invoice
```

From this checkout, the same as anywhere: `cd cli && npm install && npm run build`. The
shell scripts are POSIX `sh` and need no adaptation.

To hand a Mac a folder rather than an npm package, build a **lean** one anywhere —
`sh scripts/make-portable.sh --lean` — copy it over, and run `npm install` inside it there.
That needs no knowledge of which Mac it is.

If the Mac cannot reach a registry either, build a sealed folder for it. `uname -m` on the
Mac says which: `arm64` or `x86_64`.

```bash
sh scripts/make-portable.sh --target darwin-arm64   # or darwin-x64 on Intel
```

Copy the folder over, then

```bash
node /path/to/pdfsuite-portable-darwin-arm64/dist/index.js compare ./golden/invoice.pdf ./candidates/invoice.pdf --out ./reports/invoice
```

macOS may quarantine a binary that arrived by download or share rather than through npm. If
it refuses to load, clear the flag on the folder:

```bash
xattr -dr com.apple.quarantine /path/to/pdfsuite-portable-darwin-arm64
```

One caveat that applies to any platform change: page rendering is not bit-identical across
operating systems, because a PDF that does not embed all its fonts falls back to the host's.
Both sides of a comparison are rendered on the same machine, so a run is always
self-consistent — but a pixel percentage from a Mac and one from Windows are not strictly
comparable, so pick one platform for a baseline and stay on it.

## Quick start

```bash
# 1. start the mock render API (separate terminal)
npm run mock-api

# 2. generate candidate PDFs from JSON payloads
#    (the API url comes from pdfsuite.config.json — no --api needed)
pdfsuite generate --payloads ./fixtures/payloads --out ./.work/candidates

# 3. compare them against the goldens
pdfsuite compare --each ./fixtures/golden ./.work/candidates --out ./.work/reports
```

Short flags keep it to one readable line:

```bash
pdfsuite compare ./fixtures/golden/invoice-original.pdf ./.work/candidates/invoice-standard.pdf --out ./.work/reports/invoice
```

## What counts as a difference

A page fails if **anything** changed: wording, pixels, or position. There is no tolerance to
tune — the question a report answers is "did anything change?", and a knob that lets a real
change be declared acceptable only hides it. A page present on one side only fails too.

`--pixel-threshold` is not a tolerance despite the name: it is pixelmatch's colour
sensitivity, how different two pixels must be before they count as different at all.

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

Compares **one pair** and writes three files. The exit code is that pair's verdict.

```bash
pdfsuite compare ./golden/invoice.pdf ./candidate/invoice.pdf --out ./reports/invoice
```

| Argument | What |
|---|---|
| `<golden>` | the golden PDF — or, with `--each`, the folder of them |
| `<candidate>` | the PDF to check — or, with `--each`, the folder of them |
| `-o, --out <dir>` | where `result.json`, `report.html` and `manifest.json` are written |
| `--pages <map>` | `"1:1,2:-,3:2"` — golden page : candidate page; `-` means that page has no partner |
| `--each` | compare every pair in two folders, one sub-folder of three files per pair |
| `--pixel-threshold <n>` | pixelmatch sensitivity, default `0.1` |
| `--include-aa` | count anti-aliased pixels as differences |

**The pairing is yours to state.** A page added to the candidate and a page dropped from
the golden look identical to a page that moved, and nothing in the files says which it
was — so `--pages` takes what you know and infers nothing. Unmapped runs are 1:1.

```bash
# golden page 2 was dropped; candidate page 4 is new
pdfsuite compare ./golden.pdf ./new.pdf --out ./out --pages "1:1,2:-,3:2,-:4"
```

**Many pairs, one process.** `--each` pairs by relative path and **fails on an orphan** —
a golden with no candidate means a document stopped being produced, which is the
regression most worth catching and the easiest to lose in a loop of your own:

```bash
pdfsuite compare --each ./golden ./candidate --out ./reports
```

```
2 pairs · 1 missing

  [1/2] PASS invoice.pdf — 0 of 6 pages changed
  [2/2] FAIL statement.pdf — 2 of 4 pages changed
  MISSING   receipt.pdf — in golden, not in candidate

  FAIL  1/2 pairs unchanged · 1 missing · 0 new
```

### `spec`

Check one PDF against the spec that describes it — for the case where there is no golden
PDF to compare against, only a written specification.

```bash
pdfsuite spec ./report-spec.xlsx ./report.pdf --out ./reports/report
```

| Argument | What |
|---|---|
| `<spec>` | a Template v2 workbook (`.xlsx`) or a spec JSON |
| `[pdf]` | the PDF to check — omit it with `--validate-only` |
| `-o, --out <dir>` | where `result.json`, `report.html` and `manifest.json` are written |
| `--pages <map>` | `"1:2,2:3"` — spec page : PDF page, overriding the Pages List |
| `--validate-only` | read the spec, report on it, open no PDF |

With `--validate-only --out <dir>` the report is **two files** as well as a console read:

| File | What it is for |
|---|---|
| `validation.json` | the whole report for something that has to act on it — schema `pdfsuite.validation/1`, every line with its sheet, row, cell and **code**, every accepted row in plain words, the coverage and the counts |
| `<stem>.annotated.xlsx` | the workbook you uploaded, with each refused cell filled red and carrying its message as a cell comment, and a last **Validation** sheet listing every line — fix it in Excel and run it again |

Both are written even when nothing is wrong: a CI job that keeps the clean report has
something to diff next time. Two runs over the same workbook produce byte-identical
JSON, so a committed report only changes when the workbook or the reader does.

Each refusal carries a **code** from a closed list — `unit-missing`, `px-without-density`,
`range-and-tolerance` and the rest — so a script can branch on the code and leave the
English sentence to the person reading it. A code that is not on the list cannot be
emitted; the list is `INTAKE_CODES`.

**The spec is validated before any PDF is opened.** Every refused row names its own cell,
so the fix is made in Excel rather than guessed at:

```
Spec    report-spec-with-errors.xlsx
        112 of 290 rows checked · 26 excluded · 152 noted · 0 unreadable

Refused — these rows yield no check (10)
  1!F23          “Font size” needs a unit; the Unit cell is blank. There is no default.
  2!G31          “Top” is measured from an edge; the From cell is blank. There is no default.
```

**Which PDF page is which is decided by the Pages List**, by each page's identifying text,
not by counting: an Optional page that is absent is noted, a Conditional one is never a
failure, a Required one is an error, and a page out of order is a warning and is still
checked. `--pages` overrides that for the document that is right but whose identifying
text has been edited.

**A legacy workbook is refused here.** One with no Pages List is the old nested layout;
open it in the app, which hands back a draft Template v2 workbook with every inferred cell
highlighted, confirm it in Excel, and pass the confirmed workbook to the CLI. Nothing is
guessed at on the command line.

**Real spec workbooks never leave the machine that holds them.** Every fixture in this
repository is fictional, and this command is how a real one is checked where it already
lives — no file is uploaded anywhere.

### `inspect`

**Where is this on the page, and what is it?** No golden, no spec — one PDF and a question.
It is the command to reach for when you know what the document should look like and want
the numbers, and it is what an agent runs to answer *“where is the total on page 3”*.

```bash
pdfsuite inspect ./report.pdf --out ./reports/report

# one page, which is usually what you want
pdfsuite inspect ./report.pdf --page 3 --out ./out

# the numbers only
pdfsuite inspect ./report.pdf --out ./out --no-images
```

| Argument | What |
|---|---|
| `<file>` | the PDF to read |
| `-o, --out <dir>` | where `result.json`, `report.html` and `manifest.json` are written |
| `-p, --page <n>` | one page only, counting from 1 |
| `--images` / `--no-images` | embed page images in the report. On by default up to 20 pages |

Every element — each text run and each image — comes back with its distance from all four
page edges, its width and height, and for text its font, size, weight, style, line height
and leading ratio:

```json
{
  "id": "t0", "kind": "text", "label": "INVOICE",
  "box": { "fromLeftIn": 0.6944, "fromTopIn": 0.1111, "widthIn": 1.4849,
           "heightIn": 0.3611, "fromRightIn": 6.3207, "fromBottomIn": 10.5278 },
  "font": { "name": "Helvetica-Bold", "sizePt": 26, "weight": "bold", "style": "normal" },
  "lineHeight": { "pt": 53, "ratio": 2.04, "neighbourId": "t3" }
}
```

**Positions in inches, font sizes in points, measured from the page's top-left.** The
conversion happens once, in the core, and `result.json` records the units in its `policy`
so nobody has to ask.

**What is not stated is not guessed.** A font pdf.js cannot resolve comes back as
`"name": null` with a reason, and its weight as `"undeclared"` rather than `"regular"` —
because bold is read off the font *name*, so a nameless font says nothing about weight
either. A page with no text layer says so instead of looking empty.

**An inspect has no verdict.** It exits 0 whenever the document opened, and 2 when it did
not. Nothing here passes or fails, because the command answers a question rather than
making a judgement — so there is no `1`.

These are the same functions the Inspect tab calls.
[`inspect-parity.ts`](verify/inspect-parity.ts) measures one page both ways and checks the
two `result.json` are the same document.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | nothing changed. With `--each`: no pair changed, and no file is missing or new. For `spec`: no failed assertion (warnings, notes and unverifiable elements are listed and allowed) |
| `1` | a page changed — or, with `--each`, a pair changed or a file appeared or vanished. For `spec`: a failed assertion, or an error finding such as a Required page missing |
| `2` | tool error — bad arguments, an unreachable API, a PDF that cannot be read. For `spec`: the spec itself does not read, or `--validate-only` found rows that will not be checked |

`inspect` uses only `0` and `2`: it answers a question, and a question does not fail.

`1` vs `2` is the distinction that lets a pipeline tell "the PDFs regressed" from "the job
is broken". A folder with nothing in it is an error, never a pass — and so is a file that
is in the golden folder and not the candidate one.

## The three files

Written to `--out`, and the same three the Compare tab downloads — from the same
builders, so a report mailed from a laptop and one produced by CI are the same document.
`packages/cli/verify/compare-parity.ts` proves it byte for byte.

- **`result.json`** — **the answer.** Every page with its verdict, *why* in words, its
  metrics, and every change with a box on each side in inches; both input files with their
  SHA-256; and every knob that moved the verdict. Versioned (`pdfsuite.result/1`) and
  byte-stable apart from its `run` block, so two runs over the same files `diff` cleanly.
- **`report.html`** — the same thing to read: self-contained, no script, no external
  request, changed pages imaged. It is rendered from `result.json` and nothing else, so
  the page cannot know something the machine-readable answer does not.
- **`manifest.json`** — every input and output with its size and SHA-256, written last
  over the final bytes of the other two.

With `--each`, each pair gets its own sub-folder of three files and a `result.json`
across them (`kind: "compare-many"`) listing the pairs and the orphans.

## Moving from 1.x

`compare` changed shape in **2.0.0**, and it is a breaking change:

| 1.x | 2.0.0 |
|---|---|
| `compare -r <dir> -c <dir> -P pairs.json -o <dir>` | `compare <golden.pdf> <candidate.pdf> --out <dir>` |
| the same, for many pairs | `compare --each <golden-dir> <candidate-dir> --out <dir>` |
| `pairs.json` | gone — `--each` pairs by relative path; `--pages` states a page pairing |
| the `pairs` command | gone — the pairing is in `result.json` |
| `--format html,json,csv,junit,md` | gone — the three files are always written |
| `junit.xml` for Jenkins | read `result.json`; it says more and is versioned |
| `--fail-on none` | gone — ignore the exit code if you want the report only |

A pair that was skipped with `skipPages` is now a pairing question: pair the page with
`-` to say it has no partner, or compare the pages you mean to compare.

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
    sh 'cd packages/cli && npm ci && npm run build'
    sh 'cd packages/cli && node dist/index.js generate -p $WORKSPACE/payloads -o $WORKSPACE/.work/candidates'
    sh 'cd packages/cli && node dist/index.js compare --each $WORKSPACE/golden $WORKSPACE/.work/candidates --out $WORKSPACE/.work/reports'
  }
  post {
    always {
      // There is no JUnit any more: `result.json` says more and is versioned.
      archiveArtifacts artifacts: '.work/reports/**/report.html, .work/reports/**/result.json', allowEmptyArchive: true
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
