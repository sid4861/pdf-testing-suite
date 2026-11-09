/**
 * What is at the target path, and therefore what `create` is allowed to do.
 *
 * The whole risk of this package is in this file. `npm create @pdfsuite .`
 * is run inside somebody's working application, and the difference between
 * "this is an empty folder" and "this is a React app I have been building
 * for two years" is the difference between writing twelve files and
 * destroying an afternoon. So the modes are decided from what is on disk,
 * never from a flag, and anything that is not clearly one of the two is
 * **refused with the reason** rather than guessed at.
 */

import fs from 'node:fs';
import path from 'node:path';

export type Mode = 'new' | 'add';

export interface Target {
  mode: Mode;
  dir: string;
  /** The app's name: the directory's, or the existing `package.json`'s. */
  name: string;
  /** For `add`: the existing manifest, already parsed. */
  pkg?: PackageJson;
  /** For `add`: where the app keeps its source, usually `src`. */
  srcDir?: string;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/** A refusal that names what was found, so the person can act on it. */
export class CreateError extends Error {
  readonly hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'CreateError';
    this.hint = hint;
  }
}

/**
 * Files that do not make a directory "occupied".
 *
 * A folder somebody has just `git init`-ed, or that the OS has dropped a
 * `.DS_Store` into, is still an empty folder as far as a person is
 * concerned. Treating it as occupied would send them to the add path for a
 * directory with no application in it.
 */
const IGNORABLE = new Set([
  '.git', '.gitignore', '.DS_Store', 'Thumbs.db', '.idea', '.vscode', 'LICENSE', 'README.md',
]);

function isEmptyEnough(dir: string): boolean {
  if (!fs.existsSync(dir)) return true;
  return fs.readdirSync(dir).every((entry) => IGNORABLE.has(entry));
}

/** Does this manifest describe a React application? */
export function hasReact(pkg: PackageJson): boolean {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return typeof deps.react === 'string';
}

/**
 * Decide the mode, or refuse.
 *
 * Three outcomes and no fourth:
 *
 *   * nothing there (or only noise) → **new**: write a whole app;
 *   * a `package.json` that depends on React → **add**: write `src/pdfsuite/`
 *     and the dependencies, and touch nothing else;
 *   * anything else → refuse, saying what was found and what would have
 *     been needed. A directory with files but no `package.json` is somebody's
 *     work; a `package.json` without React is a project this cannot mount a
 *     React component into.
 */
export function detect(dir: string): Target {
  const resolved = path.resolve(dir);
  const name = path.basename(resolved) || 'pdfsuite-app';

  if (isEmptyEnough(resolved)) {
    return { mode: 'new', dir: resolved, name };
  }

  const manifestPath = path.join(resolved, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    throw new CreateError(
      `${resolved} is not empty and has no package.json.`,
      'Run this in an empty directory to create an app, or in a React app to add pdfsuite to it.',
    );
  }

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageJson;
  } catch (err) {
    throw new CreateError(
      `${manifestPath} is not valid JSON.`,
      `Fix it first — this command will not rewrite a file it cannot read. (${String(err)})`,
    );
  }

  if (!hasReact(pkg)) {
    throw new CreateError(
      `${pkg.name ?? resolved} does not depend on React.`,
      'pdfsuite’s screens are React components. Add react and react-dom, then run this again '
        + '— or run it in an empty directory to get a whole app.',
    );
  }

  // `src` by convention; anything else is the app's own layout and it says so
  // in its own files, which this command does not read.
  const srcDir = fs.existsSync(path.join(resolved, 'src')) ? 'src' : '.';

  return { mode: 'add', dir: resolved, name: pkg.name ?? name, pkg, srcDir };
}
