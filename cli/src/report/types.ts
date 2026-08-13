import type { CompareSummary, ExportThresholds, PageComparison } from '../platform/engine.js';
import type { ResolvedPair } from '../core/pairs.js';

/** One completed pair comparison, ready to be written out in any format. */
export interface PairResult {
  pair: ResolvedPair;
  summary: CompareSummary;
  pageCache: Record<number, PageComparison>;
  /** Per-page verdicts, already accounting for skipPages. */
  pageVerdicts: PageVerdict[];
  pass: boolean;
  durationMs: number;
  error?: string;
}

export interface PageVerdict {
  page: number; // 1-based
  pass: boolean;
  skipped: boolean;
  missing: boolean;
  contentMatch: number;
  pixelRatio: number;
  maxOffsetIn: number;
  /** Which thresholds were breached, for the JUnit failure message. */
  breaches: string[];
}

export interface RunContext {
  thresholdsLabel: string;
  defaults: ExportThresholds;
  generatedAt: Date;
  referenceDir: string;
  candidateDir: string;
}
