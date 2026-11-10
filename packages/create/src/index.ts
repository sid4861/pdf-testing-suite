/**
 * `@pdfsuite/create` — `npm create @pdfsuite`.
 *
 * Two modes, decided from what is on disk and never from a flag (see
 * `detect.ts`): a new application, or pdfsuite added to one somebody already
 * has. Both write a **thin shell** over `@pdfsuite/ui` and nothing else,
 * because a screen written here could never be delivered to them later by
 * `npm update` — which is L4 decision 5 and the reason this package exists.
 *
 * The rule that shapes add mode: **no existing file is changed**, with one
 * stated exception. `package.json` gains `@pdfsuite/*` dependency entries,
 * because there is no other way to install a dependency; every other key in
 * it, and every other file in the project, is byte-identical afterwards.
 * `plan()` below returns what *would* be written, and the smoke test hashes
 * the tree before and after to prove it.
 *
 * Zero dependencies: `node:fs`, `node:path`, `node:crypto`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { CreateError, detect, type PackageJson, type Target } from './detect';
import {
  addModeFiles, newAppFiles, pdfsuiteDeps, routerLine,
  type PlannedFile, type TemplateOptions,
} from './templates';
import { buildInstalledManifest, writeInstalledManifest, type InstalledManifest } from './manifest';

export { CreateError, detect, type Mode, type Target } from './detect';
export {
  INSTALLED_PATH, MANIFEST_SCHEMA, readInstalledManifest, sha256,
  type InstalledFile, type InstalledManifest,
} from './manifest';
export { pdfsuiteDeps, routerLine, type PlannedFile } from './templates';
export {
  sync, type SyncOptions, type SyncReport, type SyncedFile, type FileOutcome,
} from './sync';

/** The version every `@pdfsuite/*` dependency is pinned to. */
export const PDFSUITE_VERSION = '2.0.0';

export interface CreateOptions {
  /** Where to write. Defaults to the working directory. */
  dir?: string;
  /** Pin `@pdfsuite/*` to this version instead of the built-in one. */
  version?: string;
  /** Leave the Spec tab out — it needs `@pdfsuite/spec`. */
  withSpec?: boolean;
  /**
   * Write the agent files. **Accepted and not yet acted on:** `@pdfsuite/agents`
   * is a shell until **W-10**, which owns what an agent file for Claude, Kiro,
   * Codex and Copilot actually contains and writes `pdfsuite agents init`.
   * Inventing four files here would be guessing at content another item is
   * about to specify, and they would then have to be un-written from every
   * app created in between. The flag is parsed now so the default does not
   * change when W-10 lands.
   */
  agents?: boolean;
  /** Describe the work and write nothing. */
  dryRun?: boolean;
}

export interface CreatePlan {
  target: Target;
  files: PlannedFile[];
  /** The `@pdfsuite/*` entries that will be added to `package.json`. */
  dependencies: Record<string, string>;
  /** Add mode only: the import line the person adds to their own router. */
  routerLine?: string;
}

export interface CreateResult extends CreatePlan {
  /** Every path written, relative to the target, including the manifest. */
  written: string[];
  manifest: InstalledManifest;
  /** What to tell the person to do next. */
  nextSteps: string[];
}

/**
 * What would be written, without writing it.
 *
 * Separated from `create` so the decision and the side effect can be looked
 * at apart: the smoke test asserts on a plan, and `--dry-run` prints one.
 */
export function plan(options: CreateOptions = {}): CreatePlan {
  const target = detect(options.dir ?? process.cwd());
  const o: TemplateOptions = {
    name: target.name,
    version: options.version ?? PDFSUITE_VERSION,
    withSpec: options.withSpec !== false,
  };

  if (target.mode === 'new') {
    return { target, files: newAppFiles(o), dependencies: pdfsuiteDeps(o) };
  }

  const srcDir = target.srcDir ?? 'src';
  return {
    target,
    files: addModeFiles(srcDir),
    dependencies: pdfsuiteDeps(o),
    routerLine: routerLine(),
  };
}

/**
 * A file this command wrote before and would overwrite now.
 *
 * Refused rather than overwritten: re-running `create` over an app somebody
 * has been editing is how you lose their config. `--sync` (W-34) is the
 * command that knows how to do this safely, because it has the hashes.
 */
function refuseIfPresent(dir: string, files: PlannedFile[]): void {
  const existing = files.map((f) => f.path).filter((rel) => fs.existsSync(path.join(dir, rel)));
  if (existing.length === 0) return;
  throw new CreateError(
    `pdfsuite is already here: ${existing.join(', ')}.`,
    'To upgrade, run: npm create @pdfsuite@latest -- --sync  — it replaces what you have '
      + 'not edited and leaves what you have.',
  );
}

/**
 * Add the `@pdfsuite/*` dependencies to an existing `package.json`.
 *
 * Re-serialised from the parsed object, which would normally reformat
 * somebody's file — so the original indentation and trailing newline are
 * measured and restored. A diff that is one line long is a diff somebody
 * will actually read; a whole-file reformat is one they will not.
 */
function addDependencies(dir: string, deps: Record<string, string>): boolean {
  const at = path.join(dir, 'package.json');
  const before = fs.readFileSync(at, 'utf8');
  const pkg = JSON.parse(before) as PackageJson;

  const current = pkg.dependencies ?? {};
  const missing = Object.entries(deps).filter(([name, v]) => current[name] !== v);
  if (missing.length === 0) return false;

  // Sorted, because npm sorts them and an unsorted insert shows up as a
  // reordering the next time anybody runs `npm install`.
  pkg.dependencies = Object.fromEntries(
    Object.entries({ ...current, ...Object.fromEntries(missing) }).sort(([a], [b]) => (a < b ? -1 : 1)),
  );

  const indentMatch = before.match(/\n(\s+)"/);
  const indent = indentMatch ? indentMatch[1].length : 2;
  const text = JSON.stringify(pkg, null, indent) + (before.endsWith('\n') ? '\n' : '');
  fs.writeFileSync(at, text);
  return true;
}

export function create(options: CreateOptions = {}): CreateResult {
  const p = plan(options);
  const { target } = p;
  const version = options.version ?? PDFSUITE_VERSION;

  if (options.dryRun) {
    return {
      ...p,
      written: [],
      manifest: {
        schema: 'pdfsuite.installed/1', version, mode: target.mode,
        created: new Date(0).toISOString(), files: [],
      },
      nextSteps: nextSteps(p),
    };
  }

  refuseIfPresent(target.dir, p.files);

  const written: string[] = [];
  for (const file of p.files) {
    const out = path.join(target.dir, file.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, file.contents);
    written.push(file.path);
  }

  // Add mode installs by editing the one file it is allowed to: the manifest's
  // dependency list, and nothing else in it (SR-NPM-PACKAGES decision 8).
  if (target.mode === 'add' && addDependencies(target.dir, p.dependencies)) {
    // Deliberately **not** recorded in `installed.json`: sync must never
    // treat a consumer's own package.json as a file it may replace.
  }

  const manifest = buildInstalledManifest(target.dir, written, version, target.mode);
  writeInstalledManifest(target.dir, manifest);

  return { ...p, written, manifest, nextSteps: nextSteps(p) };
}

function nextSteps(p: CreatePlan): string[] {
  const steps: string[] = [];
  if (p.target.mode === 'new') {
    steps.push('npm install');
    steps.push('npm run dev');
    steps.push('');
    steps.push('`npx pdfsuite compare a.pdf b.pdf --out reports` works in here too — the '
      + 'command line arrives with @pdfsuite/compare.');
  } else {
    steps.push('npm install');
    steps.push('');
    steps.push('Then mount the page wherever you want it — from a file in your source folder:');
    steps.push(`  ${p.routerLine}`);
    steps.push('  <Route path="/pdfsuite" element={<PdfSuitePage />} />');
    steps.push('');
    steps.push('Nothing else of yours was touched — only package.json’s dependencies.');
  }
  steps.push('');
  steps.push('Edit pdfsuite.config.ts to choose tabs and flags — once you have, an upgrade '
    + 'will never overwrite it.');
  // Said rather than silently skipped: somebody who passed --no-agents and
  // saw nothing happen should know nothing was going to happen either way.
  steps.push('Agent files for Claude, Kiro, Codex and Copilot arrive with '
    + '`pdfsuite agents init` (not built yet).');

  return steps;
}
