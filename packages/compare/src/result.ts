/**
 * `result.json` for a compare — SR-REPORT-JSON, `kind: "compare"`.
 *
 * W-27 DoD 4. The app wrote one JSON shape, the CLI wrote another, and a
 * pipeline that read both had to know which tool had produced the file in
 * front of it. There is one shape now, built here, and the app downloads it
 * while the CLI writes it to disk — the only difference between the two
 * surfaces is where the string goes.
 *
 * Byte-stable outside `run` (decision 3): fixed key order, inches to four
 * decimals, ratios to six, pages in document order. Two runs over the same
 * two files produce the same bytes apart from the clock, which is what makes
 * "did anything change since last week" answerable by `diff`.
 */

import {
  buildEnvelope, resultJsonText, roundInches, roundRatio, sha256,
  type ResultEnvelope, type ResultInput, type RunMeta,
} from '@pdfsuite/core';

import { buildChanges, type Change } from './changes';
import { REASON_LABEL, type VerdictReason } from './verdict';
import type { PairResult } from './comparePair';

export interface ResultChange {
  type: Change['type'];
  page: number;
  /** What changed, as the page reads it. */
  text: string;
  /**
   * Where it is on each side: left, top, width, height in inches from that
   * page's top-left. A removed run has no candidate box and an added one no
   * golden box, which is how a reader tells them apart.
   */
  golden: number[] | null;
  candidate: number[] | null;
  /** How far it moved, in inches, for a `moved` change. */
  movedIn?: number;
}

export interface ResultComparePage {
  /** Position in the run, 1-based, as a person counts pages. */
  page: number;
  /** The pages this compared, 1-based, or null where one side had none. */
  golden: number | null;
  candidate: number | null;
  verdict: 'same' | 'changed';
  reasons: VerdictReason[];
  /** Why, in words, for a reader rather than a parser. */
  why: string[];
  metrics: {
    contentMatch: number;
    pixelRatio: number;
    maxOffsetIn: number;
  };
  changes: ResultChange[];
  error?: string;
}

export interface CompareResultJson extends ResultEnvelope {
  kind: 'compare';
  summary: {
    verdict: 'PASS' | 'FAIL';
    exitCode: number;
    pages: number;
    pagesChanged: number;
  };
  pages: ResultComparePage[];
  findingsSha256: string | null;
}

export interface CompareResultMeta extends RunMeta {
  /** The two files, named and hashed by whoever opened them. */
  golden?: ResultInput;
  candidate?: ResultInput;
  /**
   * How far something may move before it is listed as a change, in inches.
   * It does not decide the verdict — `pageVerdict` does — but it decides
   * what the list says, so the file records it.
   */
  movedThresholdIn?: number;
}

const MOVED_DEFAULT_IN = 0.02;

/**
 * One run as one JSON document.
 *
 * `findingsSha256` hashes the body alone, so two runs can be compared at a
 * glance without the clock in `run` making every run look different.
 */
export async function buildCompareResultJson(
  result: PairResult,
  meta: CompareResultMeta = {},
): Promise<CompareResultJson> {
  const movedThresholdIn = meta.movedThresholdIn ?? MOVED_DEFAULT_IN;

  const inputs: ResultInput[] = [];
  if (meta.golden) inputs.push(meta.golden);
  if (meta.candidate) inputs.push(meta.candidate);

  const pages: ResultComparePage[] = result.pages.map((p) => {
    const pc = p.comparison;
    const pxPerInch = p.summary.pxPerInch || 144;
    const asBox = (item: Change['a']) =>
      item
        ? [
          roundInches(item.x / pxPerInch),
          roundInches(item.y / pxPerInch),
          roundInches(item.w / pxPerInch),
          roundInches(item.h / pxPerInch),
        ]
        : null;

    const changes: ResultChange[] = pc
      ? buildChanges(pc, movedThresholdIn).map((c) => ({
        type: c.type,
        page: p.pageIndex + 1,
        text: c.text,
        golden: asBox(c.a),
        candidate: asBox(c.b),
        ...(c.offset != null ? { movedIn: roundInches(c.offset / pxPerInch) } : {}),
      }))
      : [];

    return {
      page: p.pageIndex + 1,
      golden: p.pair.a == null ? null : p.pair.a + 1,
      candidate: p.pair.b == null ? null : p.pair.b + 1,
      verdict: p.verdict.changed ? 'changed' : 'same',
      reasons: p.verdict.reasons,
      why: p.verdict.reasons.map((r) => REASON_LABEL[r]),
      metrics: {
        contentMatch: roundRatio(p.summary.contentMatch),
        pixelRatio: roundRatio(p.summary.pixelRatio),
        maxOffsetIn: roundInches(p.summary.maxOffset / pxPerInch),
      },
      changes,
      ...(p.error ? { error: p.error } : {}),
    };
  });

  const body = { pages, summary: { pagesChanged: result.changedPages } };
  const hash = await sha256(new TextEncoder().encode(JSON.stringify(body))).catch(() => undefined);

  return {
    ...buildEnvelope(
      'compare',
      {
        ruleId: 'compare.v1',
        // Every knob that moves a verdict, recorded — a result nobody can
        // reproduce is not evidence (SR-REPORT-JSON decision 3).
        pixelThreshold: result.options.pixelThreshold,
        includeAA: result.options.includeAA,
        movedThresholdIn,
      },
      inputs,
      meta,
    ),
    kind: 'compare',
    summary: {
      // The verdict here is the exit code's only source (decision 7).
      verdict: result.verdict,
      exitCode: result.verdict === 'PASS' ? 0 : 1,
      pages: result.pages.length,
      pagesChanged: result.changedPages,
    },
    pages,
    findingsSha256: hash ?? null,
  };
}

export { resultJsonText };
