---
type: Handoff
name: W-30
description: "Arpit, 2026-10-18: @pdfsuite/cli hosts the pdfsuite command and loads compare and spec from their packages; installing compare or spec brings the CLI, with pdfsuite-compare and pdfsuite-spec for global installs."
item: W-30
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-06
updated_by: Siddharth
ball: agent
---

# W-30 — the CLI as a command host; compare and spec bring it with them

## At a glance

| | |
|---|---|
| **What** | `@pdfsuite/cli` owns `pdfsuite` and loads `compare` / `spec` from their packages; `compare` and `spec` depend on `cli` and add `pdfsuite-compare` / `pdfsuite-spec` |
| **Why** | Arpit: installing compare (or spec) must make everything available through the CLI |
| **Done when** | `npm i @pdfsuite/compare` gives `npx pdfsuite compare` in a project and `npm i -g` gives `pdfsuite-compare`; a missing or mismatched package exits 2 with the fix |
| **Status** | 🟢 **6 of 6 DoD done 2026-11-06** · one departure, stated below |
| **Waits on** | nothing — W-29 landed 2026-11-06 |
| **Who** | `agent` · Opus |
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
| 1 · host | `packages/cli` owns `pdfsuite`; depends on core and agents only | ✅ |
| 2 · discovery | `pdfsuite compare` loads its package's command module; missing → exit 2 with the `npm i` to run | ✅ |
| 3 · bins | `pdfsuite-compare` in compare, depending on `@pdfsuite/cli` | ✅ |
| 4 · version check | a command package whose version differs from the host's → exit 2, both versions printed | ✅ |
| 5 · install test | `npm pack` all; a fresh project and a fresh global prefix give exactly the commands in SR-NPM-PACKAGES §1 | ✅ |
| 6 · record | SR-NPM-PACKAGES decisions 3–4 marked built; `packages/cli/README.md` install section | ✅ |

## What landed — 2026-11-06

- **The host is a host.** `@pdfsuite/cli` depends on `core` and `agents` only; the
  `compare` command moved out of `packages/cli/src/commands/` into
  `packages/compare/src/cli/`, and `platform/engine.ts` stopped re-exporting anything
  from `@pdfsuite/compare`. `scripts/check-packages.sh` gained **rule 6**, which fails a
  build where `packages/cli/src` imports a command package — the one thing here that
  would silently undo itself.
- **Discovery.** `createRequire` from the working directory, then from the host's own
  location; the module registers its own flags, help and `--pages` parsing. A missing
  package is exit 2 with the `npm i`, and is still **listed** by `--help` with what to
  install, because "unknown command" would be a lie about a command the host knows.
- **Two findings the design had to absorb.** `createRequire` cannot resolve a TypeScript
  source, so `@pdfsuite/compare` builds `dist/cli.js` (`exports: { "./cli": … }`,
  `prepack`), and the host marks it external. And a command module is a *separate
  bundle*: a class the host exports is a different class inside it, so `EXIT`,
  `ToolError` and `fileFromPath` moved to `@pdfsuite/core/node` — shared by both — and
  the host now recognises a tool error by a brand string, not by `instanceof`. The pdf.js
  bundling knowledge moved to one shared `scripts/bundle.mjs` rather than being copied
  into a second build script.
- **`pdfsuite-compare`** is a forwarder: it splices `compare` into `argv` and imports
  `@pdfsuite/cli/bin`, so one place still parses arguments and decides exit codes (L3).
- **Proved twice.** `packages/cli/verify/cli-discovery.ts` (18 checks) runs the **built
  binary** against stand-in installs — right version, wrong version, no command module,
  wrong command name, and not installed at all, the last from a copy of the binary in a
  temporary directory outside the repository so the fallback finds nothing either.
  `scripts/check-install.sh` (12 checks) packs all four tarballs and installs them into a
  fresh project and a fresh global prefix, and runs a real comparison through `npx`.

### The one departure — closed 2026-11-06 by W-32

**`spec` is not discovered.** The hazard below said it would report "not installed" until
W-32. It works today (**W-11**), and turning a working command into an error message is a
regression, not a step towards one — so `spec` stays compiled into the host and joins the
discovery list when `@pdfsuite/spec` exists. Nothing else about the command changes when it
moves; it already reaches the feature only through `engine.ts`. Said in
[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) §Consequences too.

**Closed the next day.** [W-32](W-32-spec-package.md) made `@pdfsuite/spec` a package, so
`spec` joined `DISCOVERABLE` and the host now knows both commands by name and neither by
code. The departure lasted one day and cost nothing.

## Blockers

- None. W-29 landed 2026-11-06.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decisions 2–4.

## Hazards

- **W-09 builds the compare command** — as `@pdfsuite/compare`'s command module, not inside the host.
- The spec side waits on W-32; until then `pdfsuite spec` reports "not installed".

## Reference

- [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) · [W-09](W-09-pdfsuite-compare-one-pair.md) · [W-11](W-11-pdfsuite-spec-cli.md)
