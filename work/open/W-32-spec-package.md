---
type: Handoff
name: W-32
description: "Arpit, 2026-10-18: @pdfsuite/spec — the spec feature as a package the Spec tab and `pdfsuite spec` both import; where its source lives and who publishes it is owed a ruling."
item: W-32
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: human
---

# W-32 — `@pdfsuite/spec`: the spec feature as a package

## At a glance

| | |
|---|---|
| **What** | Package the spec feature as `@pdfsuite/spec` (depends on core and cli); the Spec tab and `pdfsuite spec` import it |
| **Why** | Arpit: the Spec tab uses the spec package, and installing spec brings the CLI |
| **Done when** | The Spec tab and `pdfsuite spec` import `@pdfsuite/spec`; `npm i @pdfsuite/spec` gives `npx pdfsuite spec` |
| **Status** | 🔴 needs a ruling · 0 of 5 DoD done |
| **Waits on** | Siddharth's or Arpit's ruling (inbox) |
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

## The ruling owed

The live spec feature exists only on the spec machine, which **cannot push and cannot send
files out**. A package published from this machine would ship the stale mirror. Options:

| option | what it means |
|---|---|
| **A · the spec machine builds the package** | `src/features/spec/` becomes `packages/spec/` there; it publishes only if its network allows `npm publish` |
| **B · lift the seal for the engine** | the checker (no confidential data in code) moves to this machine; only real workbooks stay on the spec machine |
| **C · publish the mirror, labelled preview** | ships now, knowingly behind the live version |

Whichever is chosen, the package may then depend on `@pdfsuite/core` — removing the loader
the feature duplicates today (`src/features/spec/pdfjs.ts`).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · ruling | Siddharth or Arpit pick A, B or C; the sealed-feature README and `scripts/update-from-zip.sh` follow it | ⏳ |
| 2 · package | `packages/spec`: depends on core and cli; exports today's `engine.ts` surface plus a pure report builder | ⏳ |
| 3 · tab | the Spec tab imports `@pdfsuite/spec` only | ⏳ |
| 4 · command | `pdfsuite spec` and `pdfsuite-spec` from the package (W-11's command) | ⏳ |
| 5 · record | SR-NPM-PACKAGES decision 10 rewritten to the ruling; SR-SPEC-CHECK and SR-SPEC-INTAKE paths updated | ⏳ |

## Blockers

- 🔴 **Siddharth's or Arpit's ruling** — the inbox row in `OPEN-WORK.md`.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decision 10; SR-SPEC-CHECK and SR-SPEC-INTAKE (`owns:` paths).

## Hazards

- **Confidential:** whatever moves, real workbooks never leave the spec machine.
- **Never edit `src/features/spec/` from this machine** until the ruling says otherwise.

## Reference

- [`src/features/spec/README.md`](../../src/features/spec/README.md) · [W-11](W-11-pdfsuite-spec-cli.md) · [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md)
