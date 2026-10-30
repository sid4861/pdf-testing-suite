---
type: Handoff
name: W-13
description: "Arpit, 2026-10-18: open every PDF with pdf.js's bundled standard fonts and character maps, and the same substitution rules in the browser and in Node."
item: W-13
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-13 — One PDF loader: bundled standard fonts and CMaps, same rendering in app and CLI

## At a glance

| | |
|---|---|
| **What** | Open every PDF with pdf.js's bundled standard fonts and character maps, and the same substitution rules in the browser and in Node |
| **Why** | Today the CLI may not draw non-embedded text at all, the app draws it with whatever the machine has, and CJK text may not appear |
| **Done when** | Non-embedded and CJK fixtures render and extract identically in the app and the CLI |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-12 |
| **Who** | `agent` · Opus |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · opener"] --> S2["2 · assets"] --> S3["3 · parity"] --> S4["4 · baseline"] --> S5["5 · fixture"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 opener --> 2 assets --> 3 parity --> 4 baseline --> 5 fixture --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Opus: it changes how every page renders, so baselines move and must be re-justified.

## How it can be built — research, 2026-10-18

- **pdf.js ships the data:** `pdfjs-dist` 4.10.38 has `cmaps/` (1.7 MB) and `standard_fonts/` (804 KB); today nothing points at them.
- **One opener**, `openPdf(bytes)` in `src/services/`, used by Compare, Inspect and the CLI: `getDocument({ data, cMapUrl, cMapPacked: true, standardFontDataUrl, useSystemFonts: false })`.
- **`useSystemFonts: false` in the browser too** — the default is `true` on the web and `false` in Node, which is why app and CLI disagree. One rule everywhere makes the output deterministic.
- **Shipping the data:** copy both folders to `public/pdfjs/` for Vite and beside `cli/dist/index.js` for the CLI (as the worker already is); URLs with a trailing slash.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · opener | `openPdf` with the four options; every `getDocument` call outside `src/features/spec/` goes through it | ⏳ |
| 2 · assets | `cmaps/` and `standard_fonts/` copied into the app build and the CLI package; `npm pack` includes them | ⏳ |
| 3 · parity | the not-embedded and CJK fixtures render the same pixels in the app and the CLI | ⏳ |
| 4 · baseline | `cli/verify` baselines re-run; every moved number explained in the commit | ⏳ |
| 5 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 6 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

Ask the spec machine to set the same four options in `src/features/spec/pdfjs.ts` (it may not import the shared opener) and to depend on the same `pdfjs-dist` assets. The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-12** — its fictional fixture and the harness are what prove this item.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-13 in its *closed by* column.

## Hazards

- **Baselines move:** pages with non-embedded fonts will render differently — say so, do not hide it.
- **Package size** grows by about 2.5 MB.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` `loadPdf` · `cli/build.mjs` · `vite.config.ts`
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
