---
type: Handoff
name: W-31
description: "Arpit, 2026-10-18: @pdfsuite/create — `npm create @pdfsuite` creates a new app or adds pdfsuite to an existing one, as a thin shell over @pdfsuite/ui, with core, compare, spec and agents installed."
item: W-31
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-31 — `npm create @pdfsuite`: a new app, or pdfsuite added to an existing one

## At a glance

| | |
|---|---|
| **What** | `@pdfsuite/create` writes a thin shell over `@pdfsuite/ui` — into a new directory, or as `src/pdfsuite/` in an existing React app — installs core, compare, spec, ui and agents, and records every file in `.pdfsuite/installed.json` |
| **Why** | Arpit: pdfsuite is everything — run create on a new or existing app and get the UI and the CLI (L4) |
| **Done when** | A new app builds and runs all four tabs; an existing Vite + React app gains `src/pdfsuite/` with no existing file changed; `npx pdfsuite compare` works in both |
| **Status** | 🟡 waiting · 0 of 7 DoD done |
| **Waits on** | W-33 |
| **Who** | `agent` · Opus |
| **Record** | SR-NPM-PACKAGES |

```mermaid
flowchart LR
  S1["1 · initializer"] --> S2["2 · new app"] --> S3["3 · existing app"] --> S4["4 · manifest"] --> S5["5 · agents"] --> S6["6 · smoke test"] --> S7["7 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 initializer --> 2 new app --> 3 existing app --> 4 manifest --> 5 agents --> 6 smoke test --> 7 record
```

</details>

**Arpit, 2026-10-18:** *"I'm going to run npm create pdf suite my app. So it could be an
existing app, it could be a new app … Then there is going to be a UI that is going to get
created for spec, compare, and bulk compare, and inspect, like a React application."*

**Model:** Opus: two install modes into code it does not own, and nothing may be broken.

## How it can be built — research, 2026-10-18

- **npm's mapping:** `npm create @pdfsuite` runs `@pdfsuite/create` (npm docs).
- **Mode by target:** an empty or new directory → a full Vite + React app; a directory with a
  `package.json` that has React → add mode; anything else → refuse with the reason.
- **Thin shell:** `main.tsx` mounting `<PdfSuiteApp/>`, a config file (base path, enabled
  tabs, theme), and nothing more — screens come from `@pdfsuite/ui` (W-33).
- **Add mode never edits existing files:** it writes `src/pdfsuite/` and adds `@pdfsuite/*`
  dependencies, then prints the one line to add to the app's router.
- **Manifest:** `.pdfsuite/installed.json` — pdfsuite version, and each written file with its
  SHA-256; W-34's sync reads it.
- **Zero new dependencies:** `node:fs`, `node:crypto`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · initializer | `packages/create` with a bin; detects new vs existing; refuses an unsupported target with the reason | ⏳ |
| 2 · new app | a Vite + React app: the shell, `@pdfsuite/ui`, `compare`, `spec`, `core`, `agents` at one exact version | ⏳ |
| 3 · existing app | `src/pdfsuite/` and the dependencies added; no existing file changed (checked by hash before and after); the router line printed | ⏳ |
| 4 · manifest | `.pdfsuite/installed.json` with version and per-file SHA-256 | ⏳ |
| 5 · agents | agent files for all four tools unless `--no-agents` | ⏳ |
| 6 · smoke test | from packed tarballs: a new app and a sample existing app each install, build, show four tabs, and run `npx pdfsuite compare` on a fixture | ⏳ |
| 7 · record | SR-NPM-PACKAGES decision 7 marked built; a README section | ⏳ |

## Blockers

- 🟡 **Waiting on W-33** — the shell mounts `@pdfsuite/ui`.
- The Spec tab needs `@pdfsuite/spec` (W-32); until then the app ships three tabs and says so.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decisions 7 and 8 (the manifest).

## Hazards

- **Never edit a consumer file** in add mode — a wrong edit to someone else's app is worse than a printed line.
- **Presentation only** in the shell (L3, L4 decision 3).

## Reference

- [npm docs — `npm init`](https://docs.npmjs.com/cli/v10/commands/npm-init) · [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) · [SR-LAW-4](../../records/0006_LAW-4-how-packages-work.md) · [W-33](W-33-ui-package.md) · [W-34](W-34-create-sync.md)
