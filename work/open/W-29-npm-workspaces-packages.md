---
type: Handoff
name: W-29
description: "Arpit, 2026-10-18: restructure the repository into npm workspaces — packages/core, compare, cli, agents, create — and make each tab import its own package."
item: W-29
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-29 — npm workspaces: the packages, and each tab on its own package

## At a glance

| | |
|---|---|
| **What** | Create `packages/core`, `packages/compare`, `packages/cli`, `packages/agents`, `packages/ui`, `packages/create` as npm workspaces; move today's engine into core and compare unchanged; the app imports `@pdfsuite/core` and `@pdfsuite/compare` by name |
| **Why** | SR-NPM-PACKAGES: seven packages, one version, and the Compare tab on the compare package (L3, L4) |
| **Done when** | The app and the CLI build from the workspace packages; the Compare and Bulk tabs import `@pdfsuite/compare`, Inspect imports `@pdfsuite/core`; every verify run gives today's numbers |
| **Status** | 🟢 ready · 0 of 6 DoD done |
| **Waits on** | nothing |
| **Who** | `agent` · Opus |
| **Record** | SR-NPM-PACKAGES |

```mermaid
flowchart LR
  S1["1 · workspaces"] --> S2["2 · core"] --> S3["3 · compare"] --> S4["4 · cli · agents · ui · create shells"] --> S5["5 · app imports"] --> S6["6 · check · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 workspaces --> 2 core --> 3 compare --> 4 cli/agents/ui/create shells --> 5 app imports --> 6 check + record
```

</details>

**Arpit, 2026-10-18:** *"The compare tab and spec tab should use compare package and spec
package respectively. Create an SR document and work items for whatever is pending or needs
to be built."*

**Model:** Opus: a repository-wide move that must change no number.

## How it can be built

- **Root `package.json`** gains `"workspaces": ["packages/*"]`; npm links the packages — no new tool.
- **core:** `pdfCompare.ts`'s loader and extraction, `pdfElements.ts`, the report builders, the schemas.
- **compare:** `comparePage`, `changes.ts`, pairing, the verdict — the code W-27 then unifies.
- **cli:** today's `cli/` moves to `packages/cli`; **agents**, **ui** and **create** start as empty, named shells (W-10, W-33, W-31 fill them).
- **spec is not moved:** it stays in `src/features/spec/` until W-32's ruling.
- **Exact versions:** every `@pdfsuite` dependency and `pdfjs-dist` pinned exactly.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · workspaces | root `workspaces`; `npm ls --workspaces` shows the SR-NPM-PACKAGES graph | ⏳ |
| 2 · core | `packages/core` with the loader, extraction, builders, schemas; one public `index.ts` | ⏳ |
| 3 · compare | `packages/compare` with the compare engine; depends on core only (cli added by W-30) | ⏳ |
| 4 · shells | `packages/cli` (today's `cli/`), `packages/agents`, `packages/ui`, `packages/create`; one version across all | ⏳ |
| 5 · app imports | Compare and Bulk import `@pdfsuite/compare`, Inspect imports `@pdfsuite/core`; no import reaches another package's `src/` | ⏳ |
| 6 · check · record | app build, CLI build and every `cli/verify` run unchanged; a check fails on cross-package internal imports; SR-NPM-PACKAGES, SR-CONSTANTS's `owns:` path and the register's ownership rows updated; `scripts/check-boundary.sh` and `update-from-zip.sh` follow the new paths; `docs/ARCHITECTURE.md` redrawn | ⏳ |

## Blockers

None. **W-27 waits on this** — the compare core is built inside `packages/compare`.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decisions 1, 2, 5, 7, 8; the register's
Ownership table (new paths).

## Hazards

- **The sealed boundary:** `scripts/update-from-zip.sh` and `scripts/check-boundary.sh` assume
  today's paths — update both, and tell the spec machine its refresh changes.
- **No number may move** — this is a move, not a change.
- **W-05 first, or carried:** W-05 creates `src/services/specConstants.ts`; after this move it lives in `packages/core` and SR-CONSTANTS's `owns:` path follows (DoD 6).
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too.

## Reference

- [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) · [SR-LAW-3](../../records/0005_LAW-3-one-function-ui-and-cli.md)
- `package.json` · `cli/package.json` · `cli/build.mjs` · `vite.config.ts`
