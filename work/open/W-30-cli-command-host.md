---
type: Handoff
name: W-30
description: "Arpit, 2026-10-18: @pdfsuite/cli hosts the pdfsuite command and loads compare and spec from their packages; installing compare or spec brings the CLI, with pdfsuite-compare and pdfsuite-spec for global installs."
item: W-30
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-30 — the CLI as a command host; compare and spec bring it with them

## At a glance

| | |
|---|---|
| **What** | `@pdfsuite/cli` owns `pdfsuite` and loads `compare` / `spec` from their packages; `compare` and `spec` depend on `cli` and add `pdfsuite-compare` / `pdfsuite-spec` |
| **Why** | Arpit: installing compare (or spec) must make everything available through the CLI |
| **Done when** | `npm i @pdfsuite/compare` gives `npx pdfsuite compare` in a project and `npm i -g` gives `pdfsuite-compare`; a missing or mismatched package exits 2 with the fix |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-29 |
| **Who** | `agent` · Sonnet |
| **Record** | SR-NPM-PACKAGES |

```mermaid
flowchart LR
  S1["1 · host"] --> S2["2 · discovery"] --> S3["3 · bins"] --> S4["4 · version check"] --> S5["5 · install test"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 host --> 2 discovery --> 3 bins --> 4 version check --> 5 install test --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"If compare is being installed, then compare internally should
install CLI as well so that everything is available through CLI. Same thing goes for spec."*

**Model:** Sonnet: module resolution and two small bins, with the design fixed in the record.

## How it can be built — research, 2026-10-18

- **Measured:** a local install links a dependency's bin into `node_modules/.bin`; a global
  install links only the top package's own bin. Hence decision 4's extra bins.
- **Discovery:** `pdfsuite compare` resolves `@pdfsuite/compare/cli` with `createRequire`
  from the working directory, then from the CLI's own location (covers global installs).
- **Built-in commands:** `inspect` (core), `generate`, `agents init` (agents).
- **Bins:** `compare`'s `bin: { "pdfsuite-compare": … }` forwards to the host with
  `compare` prefixed; the same for `spec`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · host | `packages/cli` owns `pdfsuite`; depends on core and agents only | ⏳ |
| 2 · discovery | `pdfsuite compare` / `spec` load their package's command module; missing → exit 2 with the `npm i` to run | ⏳ |
| 3 · bins | `pdfsuite-compare` in compare, `pdfsuite-spec` in spec; both depend on `@pdfsuite/cli` | ⏳ |
| 4 · version check | a command package whose version differs from the host's → exit 2, both versions printed | ⏳ |
| 5 · install test | `npm pack` all; a fresh project and a fresh global prefix give exactly the commands in SR-NPM-PACKAGES §1 | ⏳ |
| 6 · record | SR-NPM-PACKAGES decisions 3–4 marked built; `cli/README.md` install section | ⏳ |

## Blockers

- 🟡 **Waiting on W-29** — the packages must exist first.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decisions 2–4.

## Hazards

- **W-09 builds the compare command** — as `@pdfsuite/compare`'s command module, not inside the host.
- The spec side waits on W-32; until then `pdfsuite spec` reports "not installed".

## Reference

- [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) · [W-09](W-09-pdfsuite-compare-one-pair.md) · [W-11](W-11-pdfsuite-spec-cli.md)
