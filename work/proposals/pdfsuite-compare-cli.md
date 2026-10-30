---
type: Proposal
title: pdfsuite compare, redesigned from a blank slate
description: The ideal `pdfsuite compare` — commands, pairing, verdict, exit codes, determinism, and the files a run writes. Tracked by W-07.
status: proposed
timestamp: 2026-10-18T09:35:00+05:30
---

# pdfsuite compare, redesigned from a blank slate

**Arpit, 2026-10-18:** *"Research and propose ideally how it should be, ignore what has
been built today."* … *"File this as a work item. Then propose … what all files should be
generated in the output."*

**Tracked by** [W-07](../open/W-07-pdfsuite-compare-redesign.md) — W-07 takes the place of
this proposal's `B-nnn` row (queue or backlog, never both). **Graduation trigger:** Siddharth's
or Arpit's ruling; it graduates into a CLI record plus build items.

**Ruled 2026-10-18 (Arpit):** §1–2 replaced by **one pair per command** (Option A; many pairs by
`--each`, ruled later that day) → W-09; §6 replaced by **three files** — report.html, result.json, manifest.json
→ W-09; the console block → W-08. §3–5 still open on W-07.

Prior art: comparepdf (text *or* visual, stops at the first difference, return code only
"indicative"); diff-pdf-visually (0 / 2, diff images left in a temp dir); BackstopJS
(reference → test → approve); Playwright (`--update-snapshots`). Lessons: report every
difference, document every exit code, make reports a first-class output, make "accept the
new output" its own audited command.

## 1 · Commands

```
pdfsuite compare <golden> <candidate> [--pairs pairs.json] [--out dir]
pdfsuite compare <golden> <candidate> --dry-run        # replaces `pairs`
pdfsuite approve <result.json> --pair <id> --reason "<why>"
pdfsuite report  <result.json> --format html,junit,md   # re-render, never recompute
pdfsuite doctor                                         # environment fingerprint
```

- Each argument is a **file or a folder**. Folders auto-pair by relative path; `pairs.json`
  is for exceptions only.
- `approve` promotes candidate → golden and appends hashes, reason, who and when to
  `approvals.log` beside the goldens.

## 2 · Pairing

- Files: relative path, then `pairs.json` overrides. **No silent orphans** — golden without
  candidate = *removed*, candidate without golden = *new*; both fail by default.
- Pages: 1:1 by default; `pairs.json` maps pages by hand (`"3": "2"`, `"4": null`). Nothing
  inferred.
- Skipped pages and masked regions need a reason and appear in every report.

## 3 · Verdict

- One fixed, versioned policy shared with the app; its id and hash are in every result.
- Accepted differences live in an `expected.json` ledger keyed by the finding's stable id,
  each with reason and author.
- Masks for generated content (dates, run ids) are declared boxes with reasons, drawn on
  the report.

## 4 · Exit codes

| code | meaning | who acts |
|---|---|---|
| 0 | every pair passes the policy | nobody |
| 1 | a pair differs, or a file is new or removed | document owner |
| 2 | bad arguments or invalid config | whoever wrote the command |
| 3 | runtime or input failure — unreadable/encrypted PDF, missing font, crash | pipeline owner |

## 5 · Determinism and scale

- Bundled standard fonts; environment fingerprint recorded; a fingerprint different from
  the goldens' warns.
- `--jobs N` worker threads; output order is stable whatever N is.
- `--only <pair>`, `--fail-fast`, `--changed-only`.
- Config precedence flag › `PDFSUITE_*` › config file › default; `--print-config` shows
  each value's source.
- No network in `compare`. `--redact-text` keeps extracted text out of every output.

## 6 · The files a run writes

One run = one folder (`--out`, default `./pdfsuite-report`).

```
pdfsuite-report/
  result.json        ALWAYS  the source of truth; every other file is a view of it
  manifest.json      ALWAYS  every file in this folder: path · bytes · SHA-256
  index.html         default run overview: verdict, pairs table, policy, environment
  junit.xml          default one testsuite per pair, one testcase per page
  summary.md         default ≤ 1 screen; paste-ready for a PR comment or CI job summary
  fixlist.md         default failing pages only, one actionable line per finding
  findings.csv       opt-in  one row per finding, for spreadsheets
  run.log            default stderr, verbose, for the pipeline owner
  pairs/<pair-id>/
    report.html               that pair, failing pages expanded, passing pages counted
    pages/p003.golden.png     failing pages only by default (--images failing|all|none)
    pages/p003.candidate.png
    pages/p003.diff.png
```

**Rules**

1. **`result.json` and `manifest.json` are always written; `--format` trims the rest.**
2. **The findings are byte-stable.** Wall-clock values sit only in `result.run`; same
   inputs + same tool + same environment → identical `result.pairs` and identical PNGs (no
   timestamp chunks). `result.findingsSha256` makes two runs comparable at a glance.
3. **Every finding has a stable id** — a hash of pair, page, type, text and a coarse band —
   used by `expected.json`, `approve` and the reports' anchors.
4. **A failed run still leaves a report.** Writes go to `.<out>.tmp` and are renamed at the
   end; a crash leaves `INCOMPLETE` and a `result.json` holding what finished plus the
   error, with exit 3. A pass still writes every default file.
5. **HTML is escaped everywhere and runs no script it does not ship.** `--single-file`
   embeds every image into one `report.html` for e-mail.
6. **`--out` is never clobbered blindly:** a non-empty folder without pdfsuite's marker is
   refused unless `--clean`.
7. **Redaction is total:** with `--redact-text`, no output file contains extracted text —
   boxes, ids and metrics only.

**`result.json` outline (schema `pdfsuite.result/1`)**

```
schema · tool{name, version, engine, pdfjs} · env{node, os, canvas, fonts}
run{id, startedAt, durationMs, argv, config+sources}            ← the only wall-clock
policy{id, version, sha256} · inputs{golden, candidate, pairs + sha256}
summary{pairs, passed, failed, new, removed, errors, pages, exitCode}
pairs[]{id, golden{path, sha256, pages}, candidate{…}, verdict, pagePairs, skipped[reason],
        masks[reason], pages[]{g, c, verdict, metrics{contentMatch, pixelRatio, maxOffsetPx},
        findings[]{id, type, text, boxIn, deltaIn, expectedRef}, images}}
errors[] · findingsSha256
```

**Console** — one line per pair, then one summary line:

```
pdfsuite 2.0.0 · policy strict@1 · 12 pairs · jobs 4
✗ invoice-standard    3 of 6 pages differ · 12 findings
✓ statement-summary   4 of 4
+ welcome-letter.pdf  new — no golden
FAIL · 1 differs · 1 new · 10 pass · report: pdfsuite-report/index.html · exit 1
```
