---
type: Handoff
name: W-32
description: "Arpit, 2026-10-18: @pdfsuite/spec — the spec feature as a package the Spec tab and `pdfsuite spec` both import; where its source lives and who publishes it is owed a ruling."
item: W-32
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-06
updated_by: Siddharth
ball: agent
---

# W-32 — `@pdfsuite/spec`: the spec feature as a package

## At a glance

| | |
|---|---|
| **What** | Package the spec feature as `@pdfsuite/spec` (depends on core and cli); the Spec tab and `pdfsuite spec` import it |
| **Why** | Arpit: the Spec tab uses the spec package, and installing spec brings the CLI |
| **Done when** | The Spec tab and `pdfsuite spec` import `@pdfsuite/spec`; `npm i @pdfsuite/spec` gives `npx pdfsuite spec` |
| **Status** | 🟢 **5 of 5 DoD done 2026-11-06** · ruled 2026-11-03 (B) |
| **Waits on** | nothing — W-29 landed 2026-11-06 |
| **Who** | `agent` · Opus |
| **Record** | SR-NPM-PACKAGES |

```mermaid
flowchart LR
  S1["1 · ruling"] --> S2["2 · package"] --> S3["3 · tab"] --> S4["4 · command"] --> S5["5 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 ruling --> 2 package --> 3 tab --> 4 command --> 5 record
```

</details>

**Arpit, 2026-10-18:** *"The compare tab and spec tab should use compare package and spec
package respectively."*

**Model:** Opus: it moves the sealed boundary.

## The ruling — settled

**Siddharth, 2026-11-03:** *“package can be developed on any machine now, remove this constraint”* — **option B**. Real workbooks still never leave the spec machine; that is a rule about data, not code.

The seal is lifted: `packages/spec/src/` is edited here like any other code, and this
repository holds the live version rather than a mirror. CLAUDE.md, the feature README and
`scripts/check-boundary.sh` follow it; the check now guards the *packaging* surface (two
barrels, no CSS leakage) instead of a machine boundary, and the feature may import the
project's shared code — which is what becomes `@pdfsuite/core`.

What that unblocked immediately: **W-05** finished (its last three constants moved out of
`specCheck.ts`), and **W-02, W-04, W-48** can now be built here.

It did: `pdfjs.ts` is gone and `specCheck.ts` imports `loadPdf` from
`@pdfsuite/core`. One loader, not two.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · ruling | Siddharth or Arpit pick A, B or C; the sealed-feature README and `scripts/update-from-zip.sh` follow it | ✅ B, 2026-11-03 |
| 2 · package | `packages/spec`: depends on core and cli; exports today's `engine.ts` surface plus a pure report builder | ✅ |
| 3 · tab | the Spec tab imports `@pdfsuite/spec` only | ✅ |
| 4 · command | `pdfsuite spec` and `pdfsuite-spec` from the package (W-11's command) | ✅ |
| 5 · record | the ruling is decision **14**, not 10 (the record was renumbered); SR-SPEC-CHECK and SR-SPEC-INTAKE paths updated | ✅ |

## What landed — 2026-11-06

- **`git mv src/features/spec → packages/spec/src`**, and it cost almost nothing, which is
  the whole return on the two barrels: the folder imported *nothing* from the app, so
  no code had to be untangled. What moved instead were the references — 19 CLI files, 107
  lines of records and docs, and the two checks.
- **Three barrels, not two.** `@pdfsuite/spec` (React + CSS) for the tab, `/engine` for a
  headless caller, and `/cli` for the host's command loader — plus
  `/schema/result.v1.json`, so the verify suite reads the schema by name rather than by
  path.
- **`pdfsuite spec` is discovered** (W-30's machinery), so **W-30's one departure is
  closed**: the host now knows both commands by name and neither by code, and `generate`
  is the only thing it still runs itself. `pdfsuite-spec` forwards for global installs.
- **One loader.** `pdfjs.ts` duplicated ten lines of the comparison engine because a shared
  file across the old seal was the more expensive mistake. The seal is gone and `core` is a
  dependency, so the copy is too.
- **The host now imports nothing from a command package.** `platform/engine.ts` kept the
  spec re-exports until this item; `check-packages.sh` rule 6 would have failed the build,
  which is what it is for.
- **Proved:** `verify/cli-discovery.ts` grew to **24 checks** and now covers both commands
  the same way (an installed one, a mismatched one, and a missing one); the spec suites run
  **19/19** against the built binary and **279 checks** across the eighteen engine suites;
  `scripts/check-install.sh` is **21 checks** — both tarballs into a fresh project and a
  fresh global prefix, with `npx pdfsuite spec --template` writing a workbook.

### Two debts the move made visible, both filed

- **B-019** — the package styles itself with the app's design tokens and shared component
  classes, so it is not self-contained for anyone else. It waits on `@pdfsuite/ui` (W-33).
- **B-020** — `loadExample()` fetches two sample files from the consumer's `public/` folder
  through `import.meta.env.BASE_URL`.

### One dead declaration found

`SpecValidation.tsx` declared `WORD` and never read it. The app's tsconfig does not check
for that; the package's does. Deleted.

## Blockers

- None. W-29 landed 2026-11-06, and the ruling that blocked this item was settled
  2026-11-03.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decision 10; SR-SPEC-CHECK and SR-SPEC-INTAKE (`owns:` paths).

## Hazards

- **Confidential:** whatever moves, real workbooks never leave the spec machine. Still
  true, and the only part of the old seal that survives.
- `scripts/update-from-zip.sh` no longer protects the folder from being overwritten — it
  has no live-only copy to protect. The script still refreshes a machine that cannot pull,
  and now has one more path it knows nothing about.

## Reference

- [`packages/spec/README.md`](../../packages/spec/README.md) · [W-11](W-11-pdfsuite-spec-cli.md) · [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md)
