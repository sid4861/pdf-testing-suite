/**
 * `.pdfsuite/installed.json` — what this command wrote, and what it looked
 * like when it wrote it.
 *
 * SR-NPM-PACKAGES decision 8. This file is the whole basis of a safe
 * upgrade: **W-34**'s `--sync` replaces a file only while its hash still
 * matches the record, writes `<file>.pdfsuite-new` beside one that has been
 * edited, and leaves a file the consumer deleted deleted. Without the
 * hashes, sync would have exactly two options — overwrite everything, or
 * nothing — and L4 decision 5 forbids the first.
 *
 * It is written last, over the final bytes of everything else, for the same
 * reason the run manifest is (SR-MANIFEST decision 2): a hash taken before
 * the file was finished is a hash of something that never existed.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const INSTALLED_PATH = '.pdfsuite/installed.json';
export const MANIFEST_SCHEMA = 'pdfsuite.installed/1';

export interface InstalledFile {
  /** Relative to the app's root, with forward slashes on every platform. */
  path: string;
  sha256: string;
  bytes: number;
}

export interface InstalledManifest {
  schema: string;
  /** The `@pdfsuite/*` version this app was written by. */
  version: string;
  mode: 'new' | 'add';
  /** When it was written. The only clock in the file. */
  created: string;
  files: InstalledFile[];
}

export const sha256 = (data: string | Uint8Array) =>
  createHash('sha256').update(data).digest('hex');

/**
 * Line endings normalised to `\n` before hashing.
 *
 * Without this, `git config core.autocrlf true` on Windows — or an editor
 * with its own opinion — rewrites every line ending, every recorded hash
 * stops matching, and `--sync` concludes the consumer has edited all seven
 * files. It would then deliver nothing and leave a `.pdfsuite-new` beside
 * each one: an upgrade that does the opposite of upgrading.
 *
 * Safe because **everything `create` writes is text**. If it ever writes a
 * binary file, that file must be hashed raw and this is the line to change.
 */
export const contentHash = (data: string | Uint8Array) =>
  sha256(Buffer.from(data).toString('utf8').replace(/\r\n/g, '\n'));

/**
 * Record the files, hashed **off disk** rather than from the strings that
 * were about to be written — and hashed by *content*, not by bytes.
 *
 * Off disk, because anything between the string and the file (a
 * `writeFileSync` that did not do what was expected) would leave sync
 * comparing against a file that never existed. By content, because a
 * line-ending conversion is the one difference that is guaranteed to happen
 * and guaranteed not to mean anything — see `contentHash`.
 */
export function buildInstalledManifest(
  dir: string,
  written: string[],
  version: string,
  mode: 'new' | 'add',
): InstalledManifest {
  const files: InstalledFile[] = written
    .map((rel) => rel.split(path.sep).join('/'))
    .sort()
    .map((rel) => {
      const bytes = fs.readFileSync(path.join(dir, rel));
      return { path: rel, sha256: contentHash(bytes), bytes: bytes.byteLength };
    });

  return {
    schema: MANIFEST_SCHEMA,
    version,
    mode,
    created: new Date().toISOString(),
    files,
  };
}

export function writeInstalledManifest(dir: string, manifest: InstalledManifest): void {
  const out = path.join(dir, INSTALLED_PATH);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
}

export function readInstalledManifest(dir: string): InstalledManifest | null {
  const at = path.join(dir, INSTALLED_PATH);
  if (!fs.existsSync(at)) return null;
  return JSON.parse(fs.readFileSync(at, 'utf8')) as InstalledManifest;
}
