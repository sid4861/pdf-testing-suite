// Where a command comes from.
//
// `pdfsuite` is a host (SR-NPM-PACKAGES decision 3). It owns the binary, the
// config file and the exit codes; the work is in command packages it loads by
// name at run time. That shape is Arpit's: *"If compare is being installed,
// then compare internally should install CLI as well so that everything is
// available through CLI."* — installing `@pdfsuite/compare` is what makes
// `pdfsuite compare` exist, and nothing has to be re-published to add a
// command.
//
// The two things this file has to get right:
//
//   1. **Where to look.** A project install puts the package in the
//      project's `node_modules`, and the host may be anywhere — linked into
//      `.bin`, or installed globally. So resolution is tried from the working
//      directory first and from the host's own location second. Either one
//      finding it is enough.
//
//   2. **What to say when it is not there.** "unknown command" is the wrong
//      answer: the command is known, the package is missing. The message is
//      the `npm i` to run, and the exit code is 2 — a tool error, not a
//      comparison failure, so CI can tell the difference.

import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ToolError } from './exit.js';
import { HOST_VERSION, type CommandModule } from '../host.js';

/** The commands that live in their own package. */
export const DISCOVERABLE: Record<string, { pkg: string; what: string }> = {
  compare: {
    pkg: '@pdfsuite/compare',
    what: 'compare a PDF against its golden',
  },
  spec: {
    pkg: '@pdfsuite/spec',
    what: 'check a PDF against the spec workbook that describes it',
  },
};

/** A place to resolve from, and how to describe it if nothing is found. */
function searchPaths(): string[] {
  return [
    // The project being worked in — `npm i @pdfsuite/compare` lands here.
    path.join(process.cwd(), 'noop.js'),
    // The host itself — covers `npm i -g` of both packages.
    import.meta.url,
  ];
}

/**
 * Load a command package's command module, or say why not.
 *
 * `null` means the package is not installed, which is a thing the caller
 * decides what to do about: a run of that command fails, while `--help`
 * merely lists it as available-if-installed.
 */
export async function loadCommand(name: string): Promise<CommandModule | null> {
  const entry = DISCOVERABLE[name];
  if (!entry) return null;
  const specifier = `${entry.pkg}/cli`;

  let resolved: string | undefined;
  for (const from of searchPaths()) {
    try {
      resolved = createRequire(from).resolve(specifier);
      break;
    } catch {
      // Not here. Try the next place; the caller reports if none had it.
    }
  }
  if (!resolved) return null;

  // Node's ESM loader rejects a bare Windows path ("protocol 'c:'").
  const mod = (await import(pathToFileURL(resolved).href)) as {
    command?: CommandModule;
    default?: CommandModule;
  };
  const command = mod.command ?? mod.default;
  if (!command || typeof command.register !== 'function') {
    throw new ToolError(
      `${entry.pkg} is installed but does not export a command module.`,
      `Expected ${specifier} to export \`command\`. Reinstall it: npm i ${entry.pkg}@${HOST_VERSION}`,
    );
  }

  // DoD 4: one version across the suite (decision 1), checked where a
  // mismatch actually happens — an install, not a build. Both numbers are
  // printed because neither on its own tells you which to change.
  if (command.version !== HOST_VERSION) {
    throw new ToolError(
      `${entry.pkg} is ${command.version} and pdfsuite is ${HOST_VERSION}.`,
      `The suite is published as one version. Run: npm i ${entry.pkg}@${HOST_VERSION}`
        + ` — or npm i -g @pdfsuite/cli@${command.version} to move the host instead.`,
    );
  }
  if (command.name !== name) {
    throw new ToolError(
      `${entry.pkg} provides the "${command.name}" command, not "${name}".`,
    );
  }
  return command;
}

/** The error a missing command package gets. It is the install line. */
export function notInstalled(name: string): ToolError {
  const entry = DISCOVERABLE[name];
  return new ToolError(
    `\`pdfsuite ${name}\` needs ${entry.pkg}, which is not installed.`,
    `Run: npm i ${entry.pkg}@${HOST_VERSION}`
      + `  (or npm i -g ${entry.pkg}@${HOST_VERSION} for a global install)`,
  );
}
