/**
 * `@pdfsuite/core/node` — the few things a command-line surface needs that a
 * browser one does not: the exit codes, the error a top level knows how to
 * print, and a `File` made from a path.
 *
 * It is a **subpath** and not part of the main barrel because that barrel is
 * imported by the React app through Vite, and `node:fs` is not something a
 * browser bundle should have to tree-shake its way out of.
 *
 * Why these live in `core` rather than in `@pdfsuite/cli`, which is where
 * they started: **W-30** has the host load a command module out of a package
 * it has never seen. Two bundles are involved — the host's and the command
 * package's — so a class exported by the host and `instanceof`-checked there
 * would be two different classes the moment the command package carries its
 * own copy. Both bundles depend on `core`, and the host recognises a tool
 * error by the brand below rather than by class identity, so the error
 * survives the crossing. See `isToolError`.
 */

import fs from 'node:fs';
import path from 'node:path';

// Exit codes are the CLI's primary contract with CI.
//
// Separating COMPARISON_FAILED from TOOL_ERROR is what lets a pipeline
// distinguish "the PDFs regressed" (investigate the documents) from "the job
// is broken" (investigate the pipeline). Collapsing them into a single
// non-zero code is a decision people regret the first time a build goes red
// for the wrong reason.
export const EXIT = {
  OK: 0,
  COMPARISON_FAILED: 1,
  TOOL_ERROR: 2,
} as const;

/** The brand the host looks for. A string, so a stale copy still matches. */
export const TOOL_ERROR_BRAND = 'pdfsuite.ToolError/1';

/** A tool-level failure: bad args, unreachable API, unreadable file, nothing to compare. */
export class ToolError extends Error {
  readonly hint?: string;
  /** Recognised across bundles — see the note at the top of this file. */
  readonly brand = TOOL_ERROR_BRAND;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'ToolError';
    this.hint = hint;
  }
}

/**
 * Is this the error a top level should print plainly, rather than as a crash?
 *
 * Structural on purpose. `err instanceof ToolError` is true only for the copy
 * of the class in the same bundle, and a command module loaded at run time is
 * a different bundle by definition.
 */
export function isToolError(err: unknown): err is { message: string; hint?: string } {
  return (
    typeof err === 'object'
    && err !== null
    && (err as { brand?: unknown }).brand === TOOL_ERROR_BRAND
  );
}

/**
 * The engine takes a browser `File`. Node has no equivalent that pdf.js
 * accepts, but the engine only ever calls `.arrayBuffer()` and reads `.name`,
 * so a structural stand-in is enough.
 */
export function fileFromPath(filePath: string): File {
  const buf = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  } as unknown as File;
}
