/**
 * The page loop — W-27 DoD 1.
 *
 * It was written three times: once in the Compare tab's store, once in the
 * Bulk tab's, once in the CLI. Three loops over the same pages, with the same
 * two knobs, producing three shapes of the same answer — and each one a place
 * where the app and the command line could quietly stop agreeing. Arpit's
 * question was exactly this: *the functions the CLI uses must be the ones the
 * UI uses.*
 *
 * So the loop lives here, and it is pure: no React, no `fs`, no download, no
 * progress bar. It takes two open documents and gives back one result. What
 * each surface does with that result — draw it, write it, zip it — is the
 * surface's business.
 */

import { comparePage, type CompareSummary, type PageComparison, type PageSummary } from '@pdfsuite/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { sequentialPairs, type PagePair } from './pagePairs';
import { evidenceFromComparison, pageVerdict, type PageVerdict } from './verdict';

/** The two knobs that move a verdict, and the pairing. */
export interface ComparePairOptions {
  /**
   * Which page of A meets which page of B. Defaults to 1:1 for as many pages
   * as the longer document has — the same default the app starts from.
   */
  pages?: PagePair[];
  /** pixelmatch sensitivity, 0–1. */
  pixelThreshold?: number;
  /** Count anti-aliased pixels as differences. */
  includeAA?: boolean;
  /**
   * Keep each page's full comparison in the result. The app needs it to draw
   * the page; a CLI run that only writes a report does not, and a hundred-page
   * pair of rendered images is not free.
   */
  keepComparisons?: boolean;
  /**
   * Pages already compared, by their index in this run. A page found here is
   * used as it is rather than compared again — the Compare tab has usually
   * done a few before you ask for the document, and a resumed run has done
   * more than a few.
   */
  reuse?: Record<number, PageComparison>;
  onProgress?: (current: number, total: number) => void;
}

export interface ComparedPage {
  /** Position in the run, 0-based — the index both surfaces count by. */
  pageIndex: number;
  pair: PagePair;
  summary: PageSummary;
  verdict: PageVerdict;
  /** Present when `keepComparisons` was asked for. */
  comparison?: PageComparison;
  /** Why this page could not be compared at all. */
  error?: string;
}

export interface PairResult {
  pages: ComparedPage[];
  summary: CompareSummary;
  changedPages: number;
  verdict: 'PASS' | 'FAIL';
  /**
   * The knobs this run used. Both of them move the verdict, so a result that
   * does not carry them cannot be reproduced or argued with
   * (SR-REPORT-JSON decision 3's `policy`).
   */
  options: { pixelThreshold: number; includeAA: boolean };
}

const DEFAULT_PIXEL_THRESHOLD = 0.1;

/**
 * Compare one pair of documents, page by page.
 *
 * A page that throws is reported as a page that could not be compared, not
 * as a page that passed: the loop carries on so one broken page does not cost
 * the other ninety-nine, and the result says which it was.
 */
export async function comparePair(
  docA: PDFDocumentProxy | null,
  docB: PDFDocumentProxy | null,
  options: ComparePairOptions = {},
): Promise<PairResult> {
  const pixelThreshold = options.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD;
  const includeAA = options.includeAA ?? false;

  const pairs = options.pages
    ?? sequentialPairs(docA?.numPages ?? 0, docB?.numPages ?? 0);

  const pages: ComparedPage[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    try {
      const comparison = options.reuse?.[i] ?? await comparePage(docA, docB, i, {
        pixelThreshold,
        includeAA,
        // Straight through: `null` is "this page has no partner", which is
        // a fact the caller stated, not a gap to fill in.
        pageIndexA: pair.a,
        pageIndexB: pair.b,
      });
      const summary: PageSummary = {
        pageIndex: i,
        contentMatch: comparison.contentMatch,
        pixelRatio: comparison.pixel?.ratio ?? 0,
        maxOffset: comparison.maxOffset,
        pxPerInch: comparison.pxPerInch,
        missing: !comparison.imageA || !comparison.imageB,
      };
      pages.push({
        pageIndex: i,
        pair,
        summary,
        verdict: pageVerdict(evidenceFromComparison(comparison)),
        ...(options.keepComparisons ? { comparison } : {}),
      });
    } catch (err) {
      // A page that cannot be read is a finding, never a pass.
      pages.push({
        pageIndex: i,
        pair,
        summary: {
          pageIndex: i, contentMatch: 0, pixelRatio: 0, maxOffset: 0,
          pxPerInch: 144, missing: true,
        },
        verdict: { changed: true, reasons: ['missing'] },
        error: err instanceof Error ? err.message : String(err),
      });
    }
    options.onProgress?.(i + 1, pairs.length);
  }

  const changedPages = pages.filter((p) => p.verdict.changed).length;

  return {
    pages,
    summary: {
      pages: pages.map((p) => p.summary),
      pageCountA: docA?.numPages ?? 0,
      pageCountB: docB?.numPages ?? 0,
    },
    changedPages,
    verdict: changedPages === 0 ? 'PASS' : 'FAIL',
    options: { pixelThreshold, includeAA },
  };
}

// ── many pairs ────────────────────────────────────────────────────────

/** One entry of a many-pairs run: an id, and the two documents it names. */
export interface PairEntry {
  id: string;
  docA: PDFDocumentProxy | null;
  docB: PDFDocumentProxy | null;
  /** Per-pair pairing, when this pair needs one of its own. */
  pages?: PagePair[];
}

/** A pair named on one side with no partner on the other. */
export interface Orphan {
  id: string;
  side: 'golden' | 'candidate';
}

export interface ManyResult {
  pairs: { id: string; result: PairResult }[];
  /** Named on one side only — reported, never silently dropped. */
  orphans: Orphan[];
  changedPairs: number;
  verdict: 'PASS' | 'FAIL';
}

/**
 * Compare many pairs with one loop.
 *
 * The Bulk tab and `pdfsuite compare --each` (W-09) both call this, so "what
 * counts as a failing run" is decided once. An orphan is a failure: a golden
 * with no candidate means something stopped being produced, which is the
 * regression most worth catching and the easiest to lose in a summary.
 */
export async function compareMany(
  entries: PairEntry[],
  options: ComparePairOptions & {
    orphans?: Orphan[];
    onPair?: (done: number, total: number, id: string) => void;
  } = {},
): Promise<ManyResult> {
  const pairs: { id: string; result: PairResult }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const result = await comparePair(entry.docA, entry.docB, {
      ...options,
      ...(entry.pages ? { pages: entry.pages } : {}),
    });
    pairs.push({ id: entry.id, result });
    options.onPair?.(i + 1, entries.length, entry.id);
  }

  const orphans = options.orphans ?? [];
  const changedPairs = pairs.filter((p) => p.result.verdict === 'FAIL').length;

  return {
    pairs,
    orphans,
    changedPairs,
    verdict: changedPairs === 0 && orphans.length === 0 ? 'PASS' : 'FAIL',
  };
}
