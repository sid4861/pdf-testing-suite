/**
 * `result.json` for a spec run — SR-REPORT-JSON, schema `pdfsuite.result/1`.
 *
 * The record's first sentence is the design: **result.json is the answer**, and
 * the HTML report, the console line and the exit code are all derived from it.
 * So this file knows about the run and the other two know only about this one.
 *
 * Byte-stable outside the `run` block (decision 3): the keys are written in a
 * fixed order, numbers are rounded — inches to 4 decimals, ratios to 6 — and
 * arrays stay in document order. Two runs over the same two files produce the
 * same bytes apart from `run`, which is the only wall-clock in the file.
 */

import {
  buildEnvelope,
  resultJsonText as envelopeText,
  roundInches,
  sha256,
  RESULT_SCHEMA,
  type ResultInput,
  type RunMeta,
} from '@pdfsuite/core';

import type { CheckResult, ElementResult, SpecReport } from './types';

export { RESULT_SCHEMA };

/** Everything the surface knows and the checker does not. */
export interface ResultMeta extends RunMeta {
  /** Byte counts for the inputs, when the surface has them. */
  bytes?: { workbook?: number; pdf?: number };
}

export type { ResultInput };

export interface ResultCheck {
  name: string;
  expected: string;
  actual: string;
  delta: string | null;
  note: string | null;
  cell: string | null;
  pass: boolean;
}

export interface ResultElement {
  id: string;
  type: string;
  label: string;
  status: string;
  detail: string;
  /** In inches from the page's top-left (decision 4). */
  expectedBox: number[] | null;
  actualBox: number[] | null;
  checks: ResultCheck[];
}

export interface ResultPage {
  page: number;
  name: string | null;
  specPage: number;
  binding: string | null;
  occurrence: number | null;
  widthIn: number;
  heightIn: number;
  passCount: number;
  failCount: number;
  warnCount: number;
  unverifiableCount: number;
  elements: ResultElement[];
}

export interface ResultJson {
  schema: string;
  kind: 'spec';
  tool: Record<string, string>;
  env: Record<string, string>;
  run: { started: string; durationMs: number | null; arguments: string[] };
  policy: Record<string, unknown>;
  inputs: ResultInput[];
  summary: {
    verdict: 'PASS' | 'FAIL';
    exitCode: number;
    pages: number;
    elements: number;
    elementsPassing: number;
    checksPassed: number;
    checksFailed: number;
    pageFindings: { error: number; warning: number; note: number };
  };
  coverage: SpecReport['coverage'] | null;
  pages: ResultPage[];
  pageFindings: { severity: string; pdfPage: number | null; specPage: number | null; message: string }[];
  findingsSha256: string | null;
}

const PT_PER_IN = 72;

/** Points to inches, at the record's 4 decimals. */
const inches = (pt: number) => roundInches(pt / PT_PER_IN);

const box = (b: { left: number; top: number; width: number; height: number } | null) =>
  b ? [inches(b.left), inches(b.top), inches(b.width), inches(b.height)] : null;

const check = (c: CheckResult): ResultCheck => ({
  name: c.name,
  expected: c.expected,
  actual: c.actual,
  delta: c.delta ?? null,
  note: c.note ?? null,
  cell: c.cell ?? null,
  pass: c.pass,
});

const element = (e: ElementResult): ResultElement => ({
  id: e.id,
  type: e.type,
  label: e.label,
  status: e.status,
  detail: e.detail,
  expectedBox: box(e.expectedBox),
  actualBox: box(e.actualBox),
  checks: e.checks.map(check),
});

/**
 * The run as one JSON document.
 *
 * `findingsSha256` hashes the body — pages, findings and coverage — so two
 * runs can be compared at a glance without diffing the whole file, and
 * without the `run` block's clock making every run look different.
 */
export async function buildResultJson(report: SpecReport, meta: ResultMeta = {}): Promise<ResultJson> {
  const pair = report.pair ?? {};

  const inputs: ResultInput[] = [];
  if (pair.workbook) {
    inputs.push({ name: pair.workbook, bytes: meta.bytes?.workbook ?? null, sha256: pair.workbookSha256 ?? null });
  }
  if (pair.pdfName) {
    inputs.push({ name: pair.pdfName, bytes: meta.bytes?.pdf ?? null, sha256: pair.pdfSha256 ?? null });
  }

  const pages: ResultPage[] = report.pages.map((p) => ({
    page: p.page,
    name: p.name ?? null,
    specPage: p.specPage,
    binding: p.binding ?? null,
    occurrence: p.occurrence ?? null,
    widthIn: inches(p.pageWidthPt),
    heightIn: inches(p.pageHeightPt),
    passCount: p.passCount,
    failCount: p.failCount,
    warnCount: p.warnCount,
    unverifiableCount: p.unverifiableCount,
    elements: p.elements.map(element),
  }));

  const findings = report.pageFindings.map((f) => ({
    severity: f.severity,
    pdfPage: f.pdfPage ?? null,
    specPage: f.specPage ?? null,
    message: f.message,
  }));

  const body = { pages, pageFindings: findings, coverage: report.coverage ?? null };
  const hash = await sha256(new TextEncoder().encode(JSON.stringify(body))).catch(() => undefined);

  return {
    ...buildEnvelope(
      'spec',
      { ruleId: 'spec.v1', templateVersion: pair.templateVersion ?? null },
      inputs,
      meta,
    ),
    kind: 'spec',
    summary: {
      // The verdict here is the exit code's only source (decision 7).
      verdict: report.totalFail === 0 ? 'PASS' : 'FAIL',
      exitCode: report.totalFail === 0 ? 0 : 1,
      pages: report.pages.length,
      elements: report.elementCount,
      elementsPassing: report.passElements,
      checksPassed: report.totalPass,
      checksFailed: report.totalFail,
      pageFindings: {
        error: findings.filter((f) => f.severity === 'error').length,
        warning: findings.filter((f) => f.severity === 'warning').length,
        note: findings.filter((f) => f.severity === 'note').length,
      },
    },
    coverage: report.coverage ?? null,
    pages,
    pageFindings: findings,
    findingsSha256: hash ?? null,
  };
}

/** The file's text, with a trailing newline, as it is written to disk. */
export const resultJsonText = (result: ResultJson): string => envelopeText(result);
