---
type: Handoff
name: W-06
description: "Arpit, 2026-10-18: the workspace tabs — order, names, and Bulk compare folded into Compare as its Many scope — in the app and everywhere a user reads them; names owed Arpit's confirmation."
item: W-06
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: human
---

# W-06 — workspace tabs: order, names, and Compare's two scopes

## At a glance

| | |
|---|---|
| **What** | Three tabs in this order — **Compare · Specification · Inspect**; Bulk compare becomes Compare's **Many** scope beside **One**; *Spec driven comparison* becomes **Specification** |
| **Why** | Arpit: better names, the best order, and Compare and Bulk compare should read as one thing |
| **Done when** | The header shows the three tabs in order; Compare has a One · Many switch; every user doc, report footer and record says the new names; the build passes |
| **Status** | 🔴 needs a ruling — Arpit confirms the names · 0 of 6 DoD done |
| **Waits on** | Arpit confirming the names (inbox row) |
| **Who** | `agent` · Sonnet |
| **Record** | SR-BULK-COMPARE §1 · SR-SURFACE-PARITY · SR-NPM-PACKAGES · SR-LAW-4 wording — names only, no decision changes |

```mermaid
flowchart LR
  S1["1 · ruling<br/>names confirmed"] --> S2["2 · app<br/>tabs · scope switch"] --> S3["3 · user docs"] --> S4["4 · records · glossary"] --> S5["5 · architecture<br/>doc · SVGs"] --> S6["6 · check"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 ruling --> 2 app --> 3 user docs --> 4 records + glossary --> 5 architecture --> 6 check
```

</details>

**Arpit, 2026-10-18 (first ask):** *"Rather than calling it batch compare, we will call it bulk
compare. And where it says compare 2 PDFs, let's just call it compare. The work item is
more about renaming the tabs through UX designs."*

**Arpit, 2026-10-18 (second ask, supersedes the names above):** *"At the top, the tabs that we
have, what will be the best order to put them in? And can we rename spec-driven comparison
to something better and bulk compare to something else? And is there a way bulk compare and
compare can seem like they are related? … Update the designs and the work items as per this."*

**Arpit, 2026-10-18 (third pass):** *"Rather than calling it spec check, can we just call it a specification? … And where it says one pair and many pair, can we call it just one and bulk? Or many is a better term? You decide."* — decided in session: **One · Many**.

**Model:** Sonnet: labels, one segmented control and copy across known files; the build and a
look at the header catch a slip.

## The proposal — answered in the Cowork session of 2026-10-18, owed Arpit's confirmation

| today | proposed | why |
|---|---|---|
| tab order *Batch · Compare · Spec driven comparison · Inspect* | **Compare · Specification · Inspect** | most-used first, and the order a tester reaches for them: a golden PDF exists → Compare; only a spec exists → Specification; dig into one PDF → Inspect |
| *Batch compare* / *Bulk compare* tab | **Compare › Many** — a scope switch *One · Many* in Compare's sub-header | *One · Many* over *One · Bulk*: two plain words that pair, where *bulk* is jargon; one tab, one engine (`compareMany` calls the same compare, SR-BULK-COMPARE); "Open" on a pair switches to *One* with that pair loaded, so the relation is visible |
| *Spec driven comparison* | **Specification** | Arpit's pick on the second pass (*Specification* was the first proposal) |
| *Inspect* | **Inspect** | already right |

Designs: the *PDF Suite — Proof redesign* canvas (Compare boards carry the scope switch;
*Compare · Many* replaces the Bulk board).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · ruling | Arpit confirms or changes the names; this item re-balled 🟢 and its inbox row removed | ⏳ |
| 2 · app | `src/App.tsx` `WORKSPACE_TABS` → `compare` · `spec` · `measure`, labels *Compare* · *Specification* · *Inspect*; Compare's sub-header gains a *One · Many* segmented control (hidden when `FEATURE_BATCH_COMPARE` is off); *Many* renders `BatchView`; "Open" on a pair switches to *One*; `batchExport.ts` footer and user-facing "Batch" text read *Many* | ⏳ |
| 3 · user docs | `README.md`, `public/manual.html`, `public/demo.html`, `public/overview.html`, `public/presentation.html`: the new names and order | ⏳ |
| 4 · records · glossary | user-facing names amended — SR-BULK-COMPARE §1 *Where you see it*, SR-SURFACE-PARITY section headings, SR-NPM-PACKAGES tab table, SR-LAW-4 §1 and decision 1 wording (tab list only), `docs/GLOSSARY.md`; record handles unchanged | ⏳ |
| 5 · architecture | `docs/ARCHITECTURE.md` prose and Mermaid labels; SVGs 01, 02, 05, 10, 12 re-rendered | ⏳ |
| 6 · check | `npm run build` passes; `sh scripts/check-boundary.sh` clean; the header seen with `FEATURE_BATCH_COMPARE` on and off | ⏳ |

## Out of scope, unless Arpit or Siddharth says otherwise

- **Internal identifiers stay:** the `batch` / `spec` / `measure` workspace ids, `batchStore`,
  `BatchView`, `batch-*` CSS classes, file names, and the `FEATURE_BATCH_COMPARE` key
  (renaming the key would silently reset anyone's `flag.env`).
- Record handles (SR-BULK-COMPARE stays SR-BULK-COMPARE) and the CLI's command names.
- Text inside the sealed `src/features/spec/` folder.

## Blockers

- 🔴 **Arpit confirms the names** — inbox row. Nothing else.

## Record affected

Names only, no decision changes: [SR-BULK-COMPARE](../../records/0113_BULK-compare.md) §1,
[SR-SURFACE-PARITY](../../records/0106_SURFACE-parity.md), [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md),
[SR-LAW-4](../../records/0006_LAW-4-how-packages-work.md) (the law's tab list — wording, not
substance; Arpit's confirmation is the ruling). W-01 owns the touched files until W-33 claims them.

## Hazards

- **The sealed folder:** `src/features/spec/README.md` mentions "Batch compare". Do not edit
  it from this machine; it changes on the other machine or not at all.
- **Deep links:** W-35 adds hash routes per tab; *Many* needs its own route
  (`#/compare/many`) so a bookmark still lands there.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too.
- HTML report text changes; nothing asserts on it today, but `cli/verify/` must still pass.

## Reference

- [`src/App.tsx`](../../src/App.tsx) `WORKSPACE_TABS`
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §UI shell and state, §Batch compare
