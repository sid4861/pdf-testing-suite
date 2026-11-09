/**
 * `npm create @pdfsuite@latest -- --sync` — upgrade an app without
 * overwriting what a team changed.
 *
 * This is the executable form of [L4](../../../records/0006_LAW-4-how-packages-work.md)
 * decision 5, and it is the whole reason `create` records a hash for every
 * file it writes. Without that record an upgrade has exactly two options,
 * overwrite everything or nothing, and the first is the one L4 forbids.
 *
 * **Four rules, one per state a file can be in**, and the third is the one
 * that matters:
 *
 * | on disk | what happens |
 * |---|---|
 * | missing from the record | **added** — new in this version |
 * | hash matches the record | **replaced** — nobody touched it |
 * | hash differs | **kept**, and the new version written beside it as `.pdfsuite-new` |
 * | deleted by the consumer | **stays deleted** — `--restore` brings it back |
 *
 * A file is "touched" by *content*, with line endings normalised, because a
 * `core.autocrlf` checkout is not an edit (see `contentHash`).
 *
 * `package.json` is handled separately and narrowly: every `@pdfsuite/*`
 * entry goes to one exact version and **nothing else in the file changes**
 * (SR-NPM-PACKAGES decision 8). It is not in the record and never will be —
 * sync must not treat a consumer's own manifest as a file it may replace.
 */

import fs from 'node:fs';
import path from 'node:path';

import { CreateError, type PackageJson } from './detect';
import {
  contentHash, readInstalledManifest, writeInstalledManifest,
  MANIFEST_SCHEMA, type InstalledFile,
} from './manifest';
import { addModeFiles, newAppFiles, pdfsuiteDeps, type PlannedFile } from './templates';

/** What happened to one file. */
export type FileOutcome = 'added' | 'replaced' | 'kept' | 'unchanged' | 'stays-deleted';

export interface SyncedFile {
  path: string;
  outcome: FileOutcome;
  /** For `kept`: where the new version was written. */
  sideBySide?: string;
}

export interface SyncReport {
  dir: string;
  /** The version recorded by the last create or sync. */
  from: string;
  /** The version being synced to. */
  to: string;
  files: SyncedFile[];
  /** `@pdfsuite/*` entries whose version changed. */
  dependencies: { name: string; from: string | undefined; to: string }[];
  /** True when nothing on disk would change. */
  upToDate: boolean;
}

export interface SyncOptions {
  dir?: string;
  version?: string;
  /** Report only; write nothing. `--check` sets this. */
  check?: boolean;
  /** Bring back a file the consumer deleted. */
  restore?: boolean;
}

/** Everything a fresh `create` of this version would write, for this mode. */
function currentFiles(manifest: { mode: 'new' | 'add' }, name: string, version: string, dir: string): PlannedFile[] {
  const o = { name, version, withSpec: true };
  if (manifest.mode === 'new') return newAppFiles(o);
  const srcDir = fs.existsSync(path.join(dir, 'src')) ? 'src' : '.';
  return addModeFiles(srcDir);
}

/**
 * Set every `@pdfsuite/*` dependency to one exact version.
 *
 * Re-serialised from the parsed object, so the file's own indentation and
 * trailing newline are measured and restored — the diff has to be the lines
 * that changed and nothing else, or nobody will read it.
 */
function syncDependencies(
  dir: string,
  version: string,
  write: boolean,
): { name: string; from: string | undefined; to: string }[] {
  const at = path.join(dir, 'package.json');
  if (!fs.existsSync(at)) return [];

  const before = fs.readFileSync(at, 'utf8');
  const pkg = JSON.parse(before) as PackageJson;
  const deps = pkg.dependencies ?? {};

  // Every @pdfsuite package the app already has, plus any this version adds.
  const wanted: Record<string, string> = {
    ...Object.fromEntries(
      Object.keys(deps).filter((n) => n.startsWith('@pdfsuite/')).map((n) => [n, version]),
    ),
    ...pdfsuiteDeps({ name: '', version, withSpec: true }),
  };

  const changed = Object.entries(wanted)
    .filter(([name, to]) => deps[name] !== to)
    .map(([name, to]) => ({ name, from: deps[name], to }));

  if (changed.length === 0 || !write) return changed;

  pkg.dependencies = Object.fromEntries(
    Object.entries({ ...deps, ...wanted }).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const indentMatch = before.match(/\n(\s+)"/);
  const indent = indentMatch ? indentMatch[1].length : 2;
  fs.writeFileSync(at, JSON.stringify(pkg, null, indent) + (before.endsWith('\n') ? '\n' : ''));
  return changed;
}

export function sync(options: SyncOptions = {}): SyncReport {
  const dir = path.resolve(options.dir ?? process.cwd());
  const to = options.version ?? '2.0.0';
  const write = options.check !== true;

  const manifest = readInstalledManifest(dir);
  if (!manifest) {
    throw new CreateError(
      `No .pdfsuite/installed.json in ${dir}.`,
      'There is nothing here to upgrade. Run `npm create @pdfsuite .` first — sync only '
        + 'touches files it has a record of writing.',
    );
  }

  const recorded = new Map(manifest.files.map((f) => [f.path, f]));
  const planned = currentFiles(manifest, path.basename(dir), to, dir);
  const files: SyncedFile[] = [];
  /**
   * What pdfsuite intends to be at each path after this run — which is not
   * the same as what is on disk, because the whole point of sync is that it
   * leaves some files alone. Hashing the disk here is what laundered a
   * consumer's edit into the record and let the *next* upgrade overwrite it.
   */
  const nextRecord: InstalledFile[] = [];
  const keep = (rel: string, contents: string) =>
    nextRecord.push({ path: rel, sha256: contentHash(contents), bytes: Buffer.byteLength(contents) });
  const carry = (f: InstalledFile) => nextRecord.push(f);

  for (const file of planned) {
    // Never replaced as a file, in either mode. `create` writes it for a new
    // app, so it *is* in the record — but by the time anybody upgrades it is
    // also where they keep their own dependencies and scripts, and replacing
    // it wholesale would delete those. Only `syncDependencies` touches it,
    // and only its `@pdfsuite/*` entries (SR-NPM-PACKAGES decision 8).
    if (file.path === 'package.json') continue;

    const abs = path.join(dir, file.path);
    const record = recorded.get(file.path);
    const onDisk = fs.existsSync(abs);

    // New in this version: there is no record of it, so nothing can be lost.
    if (!record) {
      files.push({ path: file.path, outcome: 'added' });
      if (write) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, file.contents);
      }
      keep(file.path, file.contents);
      continue;
    }

    // Deleted on purpose. Putting it back would be the same mistake as
    // overwriting an edit: undoing a decision somebody made.
    if (!onDisk) {
      if (options.restore) {
        files.push({ path: file.path, outcome: 'added' });
        if (write) {
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, file.contents);
        }
        keep(file.path, file.contents);
      } else {
        // The entry is carried forward, not dropped. Drop it and the next
        // sync finds no record, calls the file new, and writes it back —
        // so "stays deleted" would last exactly one upgrade.
        files.push({ path: file.path, outcome: 'stays-deleted' });
        carry(record);
      }
      continue;
    }

    const current = contentHash(fs.readFileSync(abs));
    const edited = current !== record.sha256;
    // Did *we* change this file between the recorded version and this one?
    // Compared against the record, not against what is on disk, so a
    // consumer's edit cannot make us look like we have something new.
    const weChanged = contentHash(file.contents) !== record.sha256;

    if (edited) {
      if (!weChanged) {
        // They edited it and we have nothing newer. Their file stands, and
        // writing a `.pdfsuite-new` identical to what we originally wrote
        // would be noise — and would make `--check` fail CI forever on an
        // app that is perfectly up to date.
        files.push({ path: file.path, outcome: 'unchanged' });
        carry(record);
        continue;
      }
      // Edited, and we do have a newer version. It goes beside theirs and is
      // named in the report; their file is not touched. L4's veto condition.
      const beside = `${file.path}.pdfsuite-new`;
      files.push({ path: file.path, outcome: 'kept', sideBySide: beside });
      if (write) fs.writeFileSync(path.join(dir, beside), file.contents);
      // The *offered* version is recorded, not theirs: adopting the
      // `.pdfsuite-new` then makes the file match the record again, and the
      // next upgrade manages it normally. Recording theirs would have told
      // the next sync that we wrote it.
      keep(file.path, file.contents);
      continue;
    }

    // Untouched since we wrote it, so replacing it loses nothing.
    files.push({ path: file.path, outcome: weChanged ? 'replaced' : 'unchanged' });
    if (write && weChanged) fs.writeFileSync(abs, file.contents);
    keep(file.path, file.contents);
  }

  const dependencies = syncDependencies(dir, to, write);

  const changedSomething =
    dependencies.length > 0
    || files.some((f) => f.outcome === 'added' || f.outcome === 'replaced' || f.outcome === 'kept');

  // Rewritten from `nextRecord` — what pdfsuite intends at each path — so
  // the next sync compares against this version and still recognises an
  // edited file as edited and a deleted file as deleted.
  if (write && changedSomething) {
    writeInstalledManifest(dir, {
      schema: MANIFEST_SCHEMA,
      version: to,
      mode: manifest.mode,
      created: new Date().toISOString(),
      files: [...nextRecord].sort((a, b) => (a.path < b.path ? -1 : 1)),
    });
  }

  return { dir, from: manifest.version, to, files, dependencies, upToDate: !changedSomething };
}
