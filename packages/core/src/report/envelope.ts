/**
 * The part of `result.json` that is the same whatever was run —
 * SR-REPORT-JSON, decision 1: *one builder*.
 *
 * A spec check and a compare answer different questions, but they answer
 * them into the same document: which schema this is, what built it, where it
 * ran, when, under which knobs, over which files, and the verdict the exit
 * code comes from. Only the body differs.
 *
 * Keeping that envelope here is the difference between one format and two
 * that look alike. Two would drift in a month: a field renamed on one side,
 * a timestamp formatted differently on the other, and every tool that reads
 * both would need to know which it was holding.
 */

export const RESULT_SCHEMA = 'pdfsuite.result/1';

/** The kinds of run that write a `result.json` (SR-REPORT-JSON §The shape). */
export type ResultKind = 'compare' | 'compare-many' | 'spec' | 'inspect';

/** One file a run read or wrote, with the hash that identifies it. */
export interface ResultInput {
  name: string;
  bytes: number | null;
  sha256: string | null;
}

/** Everything the surface knows and the engine does not. */
export interface RunMeta {
  /** Package versions: core, compare, spec, cli, pdfjs-dist. */
  tool?: Record<string, string>;
  /** Where it ran. Filled in from the runtime when omitted. */
  env?: Record<string, string>;
  startedAt?: string;
  durationMs?: number;
  /** The command line, or the tab's own account of what it did. */
  arguments?: string[];
}

export interface ResultEnvelope {
  schema: string;
  kind: ResultKind;
  tool: Record<string, string>;
  env: Record<string, string>;
  /** The only wall-clock in the file (decision 3). */
  run: { started: string; durationMs: number | null; arguments: string[] };
  policy: Record<string, unknown>;
  inputs: ResultInput[];
}

/**
 * Where this ran, as far as it can tell.
 *
 * Node and the browser render PDFs through different canvases, which is
 * enough to move a pixel ratio — so a result that does not say where it ran
 * cannot be compared with one from somewhere else.
 */
export function runtimeEnv(): Record<string, string> {
  const node = (globalThis as {
    process?: { versions?: { node?: string }; platform?: string };
  }).process;
  if (node?.versions?.node) {
    return { runtime: 'node', node: node.versions.node, platform: node.platform ?? 'unknown' };
  }
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return { runtime: 'browser', userAgent: nav?.userAgent ?? 'unknown' };
}

export function buildEnvelope(
  kind: ResultKind,
  policy: Record<string, unknown>,
  inputs: ResultInput[],
  meta: RunMeta = {},
): ResultEnvelope {
  return {
    schema: RESULT_SCHEMA,
    kind,
    tool: meta.tool ?? { core: 'in-tree' },
    env: meta.env ?? runtimeEnv(),
    run: {
      started: meta.startedAt ?? new Date().toISOString(),
      durationMs: meta.durationMs ?? null,
      arguments: meta.arguments ?? [],
    },
    policy,
    inputs,
  };
}

/** The file's text, with a trailing newline, as it is written to disk. */
export function resultJsonText(result: unknown): string {
  return JSON.stringify(result, null, 2) + '\n';
}

// ── numbers ───────────────────────────────────────────────────────────

/** Inches at the record's 4 decimals (decision 3). */
export const roundInches = (n: number) => Math.round(n * 1e4) / 1e4;

/** A ratio at the record's 6 decimals (decision 3). */
export const roundRatio = (n: number) => Math.round(n * 1e6) / 1e6;
