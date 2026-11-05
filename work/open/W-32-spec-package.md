---
type: Handoff
name: W-32
description: "Arpit, 2026-10-18: @pdfsuite/spec — the spec feature as a package the Spec tab and `pdfsuite spec` both import; where its source lives and who publishes it is owed a ruling."
item: W-32
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-03
updated_by: agent
ball: agent
---

# W-32 — `@pdfsuite/spec`: the spec feature as a package

## At a glance

| | |
|---|---|
| **What** | Package the spec feature as `@pdfsuite/spec` (depends on core and cli); the Spec tab and `pdfsuite spec` import it |
| **Why** | Arpit: the Spec tab uses the spec package, and installing spec brings the CLI |
| **Done when** | The Spec tab and `pdfsuite spec` import `@pdfsuite/spec`; `npm i @pdfsuite/spec` gives `npx pdfsuite spec` |
| **Status** | 🟡 ruled 2026-11-03 (B) · 1 of 5 DoD done · waits on W-29 |
| **Waits on** | W-29 (npm workspaces) for `packages/` to exist |
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

The seal is lifted: `src/features/spec/` is edited here like any other code, and this
repository holds the live version rather than a mirror. CLAUDE.md, the feature README and
`scripts/check-boundary.sh` follow it; the check now guards the *packaging* surface (two
barrels, no CSS leakage) instead of a machine boundary, and the feature may import the
project's shared code — which is what becomes `@pdfsuite/core`.

What that unblocked immediately: **W-05** finished (its last three constants moved out of
`specCheck.ts`), and **W-02, W-04, W-48** can now be built here.

Still to do here: the package may now drop the pdf.js loader it duplicates
(`src/features/spec/pdfjs.ts`) once it can depend on `@pdfsuite/core` — W-29.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · ruling | Siddharth or Arpit pick A, B or C; the sealed-feature README and `scripts/update-from-zip.sh` follow it | ✅ B, 2026-11-03 |
| 2 · package | `packages/spec`: depends on core and cli; exports today's `engine.ts` surface plus a pure report builder | ⏳ |
| 3 · tab | the Spec tab imports `@pdfsuite/spec` only | ⏳ |
| 4 · command | `pdfsuite spec` and `pdfsuite-spec` from the package (W-11's command) | ⏳ |
| 5 · record | SR-NPM-PACKAGES decision 10 rewritten to the ruling; SR-SPEC-CHECK and SR-SPEC-INTAKE paths updated | ⏳ |

## Blockers

- 🟡 **W-29** — `packages/` does not exist yet, so there is nowhere to put
  `packages/spec`. The ruling that blocked this item is settled.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decision 10; SR-SPEC-CHECK and SR-SPEC-INTAKE (`owns:` paths).

## Hazards

- **Confidential:** whatever moves, real workbooks never leave the spec machine. Still
  true, and the only part of the old seal that survives.
- `scripts/update-from-zip.sh` no longer protects `src/features/spec/` from being
  overwritten — it has no live-only copy to protect. The script still refreshes a machine
  that cannot pull.

## Reference

- [`src/features/spec/README.md`](../../src/features/spec/README.md) · [W-11](W-11-pdfsuite-spec-cli.md) · [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md)
