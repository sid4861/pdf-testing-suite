// `@pdfsuite/cli` as a library — what a command module may use.
//
// SR-NPM-PACKAGES decision 3: the host owns `pdfsuite` and does **not**
// depend on `compare` or `spec`. It loads their command modules at run time,
// so what it offers them is a contract: the two interfaces below, and the
// handful of values re-exported from `@pdfsuite/core/node`.
//
// A command module should import this file **for its types only**. The
// runtime pieces it needs are either in `core` — which it depends on anyway —
// or handed to it in `HostApi` when it registers. That is deliberate: the
// module is bundled separately from the host, so anything it imports from
// here at run time would be a *second copy*, and a second copy of a class is
// a different class. The re-exports below exist for the host's own modules
// and for a command module compiled into the same bundle; nothing published
// needs them.

export { EXIT, ToolError, isToolError, fileFromPath } from '@pdfsuite/core/node';
export { installPdfLogFilter } from './platform/pdf-log.js';

/** The host's version, for a command module to check itself against. */
export const HOST_VERSION = '2.0.0';

/**
 * What a command module exports.
 *
 * `register` is given commander's `program` and adds its own command to it.
 * The host does not know what arguments a command takes — that is the
 * command's business, and the reason this is a module boundary rather than a
 * table of flags in the host.
 */
export interface CommandModule {
  /** The sub-command this module provides, e.g. `compare`. */
  name: string;
  /** Must equal the host's, or the host refuses to load it. */
  version: string;
  register: (program: CommanderProgram, host: HostApi) => void;
}

/**
 * The slice of commander a command module is handed.
 *
 * Declared here rather than imported from `commander` so that a command
 * package needs neither commander nor a matching version of it: these are the
 * methods the host promises to provide, and they are all a command needs to
 * describe itself. The host casts its real `Command` to this when it hands it
 * over — mirroring commander's own overloads here, so that the cast could be
 * dropped, was tried and makes this file unreadable for no gain.
 */
export interface CommanderProgram {
  command: (name: string) => CommanderCommand;
}

export interface CommanderCommand {
  description: (text: string) => CommanderCommand;
  argument: (name: string, description?: string) => CommanderCommand;
  option: (flags: string, description?: string, ...rest: unknown[]) => CommanderCommand;
  addHelpText: (position: 'before' | 'after' | 'beforeAll' | 'afterAll', text: string) => CommanderCommand;
  action: (fn: (...args: never[]) => unknown) => CommanderCommand;
}

/** What the host hands a command module when it registers. */
export interface HostApi {
  /** Run a command body: sets the exit code and prints a `ToolError` plainly. */
  run: (fn: () => Promise<number> | number) => Promise<never>;
  /** Colour helpers, already honouring `NO_COLOR` and a non-TTY. */
  colour: Record<'b' | 'dim' | 'teal' | 'green' | 'red' | 'yellow', (s: string) => string>;
  /**
   * One section of `pdfsuite.config.json`, as the host found it — the host
   * owns `--config` and `--no-config`, so a command module must not go
   * looking for the file itself or the two would disagree. `source` is the
   * file it came from, or undefined when no config was used.
   */
  config: (section: string) => { values: Record<string, unknown>; source?: string };
}
