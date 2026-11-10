---
type: Handoff
name: W-52
description: "Siddharth, 2026-11-09: every @pdfsuite package publishes built JavaScript with .d.ts, so a consumer can run tsc — today they publish TypeScript source and a consumer's compiler reports our errors in their project."
item: W-52
filed: 2026-11-09
filed_by: Siddharth
updated: 2026-11-09
updated_by: Siddharth
ball: agent
---

# W-52 — the packages publish JavaScript, not TypeScript

## At a glance

| | |
|---|---|
| **What** | Each `@pdfsuite` package emits `dist/*.js` + `dist/*.d.ts` and points `exports` there; the workspace keeps compiling from source through the `development` condition |
| **Why** | A consumer running `tsc` type-checks *our* source with *their* settings and gets eleven errors that are ours. A library nobody can type-check against is not publishable |
| **Done when** | A created app runs `tsc --noEmit && vite build` clean against the packed tarballs, and `npm run build` in that app has `tsc` back in front of it |
| **Status** | 🟢 **6 of 6 DoD done 2026-11-09** |
| **Waits on** | nothing |
| **Who** | `agent` · Opus |
| **Record** | SR-NPM-PACKAGES |

```mermaid
flowchart LR
  S1["1 · emit"] --> S2["2 · exports"] --> S3["3 · workspace"] --> S4["4 · the app's build"] --> S5["5 · install test"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 emit --> 2 exports --> 3 workspace --> 4 the app's build --> 5 install test --> 6 record
```

</details>

**Siddharth, 2026-11-09:** *"B-022"* — the ruling to promote the backlog row and build it.

**Model:** Opus: a packaging change across seven packages, where the failure mode is
invisible from inside the workspace.

## What is actually wrong — measured 2026-11-09 (W-31)

`scripts/check-create.sh` creates an app from the packed tarballs. It could not run
`tsc`:

```
node_modules/@pdfsuite/core/src/pdfCompare.ts(6,23): error TS2307: Cannot find module
  'pdfjs-dist/build/pdf.worker.min.mjs?url'
node_modules/@pdfsuite/core/src/pdfCompare.ts(7,24): error TS7016: Could not find a
  declaration file for module 'pixelmatch'
node_modules/@pdfsuite/core/src/pdfCompare.ts(10,39): error TS7016: … 'diff'
node_modules/@pdfsuite/core/src/pdfCompare.ts(383,39): error TS7006: Parameter 'part'
  implicitly has an 'any' type
node_modules/@pdfsuite/spec/src/specStore.ts(387,32): error TS2339: Property 'env' does
  not exist on type 'ImportMeta'
node_modules/@pdfsuite/ui/src/store/*.ts: the same, three times
```

Every one of them is ours, reported inside their project, and none of them is a mistake
they can fix. The created app's `build` is `vite build` alone as a result (W-31), which
works and is the wrong place to leave it.

**Why it is invisible here:** in the workspace every package is a symlink and the app's
own tsconfig supplies the `?url` shim and the `@types`. Only an install from a tarball
shows it, which is why it took until W-31 to find.

## How it can be built

- **Emit with `tsc`**, not esbuild: declarations are the point, and `tsc` is the only
  thing that writes them. The `?url` and `.css` imports pass through to the consumer's
  bundler, which is where they are resolvable.
- **`exports` gains a `development` condition** pointing at `src`, so this workspace and
  the CLI's esbuild keep reading source — `npm run dev` and HMR do not change. A
  consumer has no such condition and gets `types` + `default`, which are `dist`.
  (`publishConfig` was tried first and rejected: **`npm pack` does not apply it** to
  `main`/`exports`, so what is tested and what is published would differ.)
- **`styles.css` is copied into `dist`** for `ui`, and `spec.css` for `spec`; the barrels
  import them by a path that is the same in both trees.
- **The app's build runs the packages' build first**, so a production `vite build`
  resolves `default`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · emit | `core`, `compare`, `spec`, `ui`, `cli`, `create`, `agents` each emit `dist/*.js` + `dist/*.d.ts`; CSS copied; `prepack` builds | ✅ |
| 2 · exports | `exports` has `types` → `.d.ts`, `development` → `src`, `default` → `dist`; `files` ships both | ✅ |
| 3 · workspace | `npm run dev`, `npm run build` and the CLI's esbuild still read source — the `development` condition in each tsconfig and in `scripts/bundle.mjs` | ✅ |
| 4 · the app's build | `create`'s template puts `tsc --noEmit &&` back in front of `vite build`, and the comment explaining its absence goes | ✅ |
| 5 · install test | `check-create.sh` runs `tsc --noEmit` in the created app and it passes; the tarballs carry `.d.ts` | ✅ |
| 6 · record | SR-NPM-PACKAGES says what each package publishes; B-022 closed in the backlog with its resolution | ✅ |

## What landed — 2026-11-09

- **`packages/tsconfig.emit.json`**, extended by a `tsconfig.build.json` in each of the
  seven. `tsc` emits, not esbuild: declarations are the point, and `tsc` is the only
  thing that writes them.
- **`exports` carries three conditions, in this order:** `development` → `src`,
  `types` → `dist/*.d.ts`, `default` → `dist/*.js`. Order is load-bearing — conditions
  match on the first key the resolver knows, so `types` first would hand this workspace
  the built declarations and let a stale `dist` become everyone's types. Proved by
  deleting `packages/core/dist` and type-checking the whole repository clean.
- **The workspace is unchanged.** `customConditions: ["development"]` in every tsconfig
  that compiles across packages, and `conditions: ['development']` in
  `scripts/bundle.mjs` so the CLI's esbuild still bundles source — without it the `?url`
  plugin and the pdfjs-legacy alias never see the imports they exist for.
- **`?url` and `.css` pass through untouched**: they are the consumer's bundler's to
  resolve. `ui` and `spec` copy their stylesheets into `dist`, because the emitted
  barrel still says `import './styles.css'`.
- **Three entries stay esbuild bundles** — `cli`'s binary and `compare`/`spec`'s command
  modules, all of which Node loads directly — so those packages emit declarations only.
- **The root build makes the packages first**, so a production `vite build` resolves
  `default` and our own build exercises what a consumer gets.

### What it bought, measured

`scripts/check-create.sh` is **76 checks** now. In the created app, from packed
tarballs: `tsc --noEmit` is **clean**, with **no error reported inside a `@pdfsuite`
package**, and `npm run build` is `tsc --noEmit && vite build` again. Before this there
were eleven errors, all ours, in somebody else's project. The tarballs are checked for
`dist/index.d.ts`, `dist/index.js`, `ui`'s stylesheet and `cli`'s `host.d.ts`.

### Two things ruled out on the way

- **`publishConfig`** was the first idea — keep `exports` on source and let npm rewrite
  it at publish. **`npm pack` does not apply it** (verified: the packed `package.json`
  kept `./src/index.ts`), so what is tested and what is published would differ. That is
  worse than the problem.
- **Node-loadable output.** The emitted JavaScript uses extensionless relative imports,
  so the four library packages are **bundler-targeted**. Every entry Node loads directly
  is a bundle, so no consumer we have is affected; making the rest Node-loadable means
  putting `.js` on every relative import in the source, which is a larger change than
  this item and nobody is waiting for it. Said in the record rather than left to be
  discovered.

## Blockers

- None.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) — decisions 1 and 2 gain what a
package *publishes*; the Consequences bullet about B-022 is replaced by what was done.

## Hazards

- **The workspace will not notice a mistake here.** Every check that matters is in
  `scripts/check-create.sh`, which installs from tarballs. A green `npm run build` at the
  root proves nothing about this item.
- **Two resolutions of the same package** — source in the workspace, `dist` for a
  consumer — is the hazard the `development` condition buys with. If `dist` is stale the
  app still builds here and ships wrong, so `prepack` must build and the install test
  must be the gate.
- **`pdfjs-dist` must stay pinned exactly** (`check-packages.sh` rule 5): emitting
  declarations does not change that, and a consumer resolving a second pdf.js is the
  defect that cost a green suite once already.

## Reference

- [`scripts/check-create.sh`](../../scripts/check-create.sh) — where the failure is
  measurable · [W-31](W-31-create-pdfsuite-app.md) · [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md)
