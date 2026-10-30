---
type: Handoff
name: W-08
description: "Arpit, 2026-10-18: give `pdfsuite compare` the agreed console output — a header line, one line per pair, one summary line ending in the report path and exit code."
item: W-08
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-08 — pdfsuite compare: console output

## At a glance

| | |
|---|---|
| **What** | `pdfsuite compare` prints a header, one line per pair and one summary line; everything else goes to stderr |
| **Why** | Arpit agreed this console format; today's output mixes progress, tables and results on stdout |
| **Done when** | A run over `cli/fixtures` prints exactly the agreed shape; the build passes; exit codes unchanged |
| **Status** | 🟢 ready · 0 of 6 DoD done |
| **Waits on** | nothing |
| **Who** | `agent` · Sonnet |
| **Record** | SR-CLI decision 4 — stdout carries only this shape |

```mermaid
flowchart LR
  S1["1 · header"] --> S2["2 · pair lines"] --> S3["3 · summary"] --> S4["4 · streams"] --> S5["5 · plain terminals"] --> S6["6 · check"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 header --> 2 pair lines --> 3 summary --> 4 streams --> 5 plain terminals --> 6 check
```

</details>


**Arpit, 2026-10-18:** *"For console output, whatever you have looks good. So file a work
item for the console output."*

**Model:** Sonnet: a formatting change in one command, with the format fixed below.

## Goal

`pdfsuite compare` prints exactly this shape, and nothing else on stdout:

```
pdfsuite 1.0.0 · 3 pairs
✗ invoice-standard    3 of 6 pages differ · 12 findings
✓ statement-summary   4 of 4
! broken-letter       error — unreadable PDF
FAIL · 1 differs · 1 error · 1 pass · report: reports/index.html · exit 1
```

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · header | one line: tool and version · pair count | ⏳ |
| 2 · pair lines | one per pair, ids padded to one column: `✓` pass (`n of n`), `✗` differs (`k of n pages differ · m findings`), `!` error (one-line why) | ⏳ |
| 3 · summary | one line: `PASS` or `FAIL` · counts · report path · exit code; the exit code printed is the one returned | ⏳ |
| 4 · streams | stdout carries only the lines above; the pairing table, progress, "wrote …" lines and pdf.js warnings go to stderr; `--verbose` adds detail there, never to stdout | ⏳ |
| 5 · plain terminals | without a TTY or with `NO_COLOR`: no colour, no `\r` progress, same characters | ⏳ |
| 6 · check | `npm run build` in `cli/` passes; a run over `cli/fixtures` matches the shape above; exit codes unchanged | ⏳ |

## Out of scope

The single-file command, the output files and the exit-code split — those are
[W-07](W-07-pdfsuite-compare-redesign.md). If W-07 makes `compare` one pair per run, this
format holds with one pair line.

## Blockers

None.

## Record affected

[SR-CLI](../../records/0115_CLI.md) decision 4 — stdout carries only this shape, everything else
goes to stderr. W-01 owns the touched files until SR-CLI's `owns:` claims `cli/` (W-09 DoD 1).

## Hazards

- Anything that parses today's stdout (`[1/3] id … PASS`, `n/m pair(s) passed`) breaks;
  say so in `cli/README.md`.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too.

## Reference

- `cli/src/commands/compare.ts` — today's `console.log` / `process.stdout.write` calls
- [proposal](../proposals/pdfsuite-compare-cli.md) §6 · Console
