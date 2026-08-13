// Machine-readable outputs: JSON, CSV, and JUnit XML.

import fs from 'node:fs';
import path from 'node:path';

import type { PairResult, RunContext } from './types.js';

// ── JSON ──────────────────────────────────────────────────────────────
export function writeJsonReport(results: PairResult[], ctx: RunContext, outDir: string): string {
  const payload = {
    generatedAt: ctx.generatedAt.toISOString(),
    referenceDir: ctx.referenceDir,
    candidateDir: ctx.candidateDir,
    defaults: ctx.defaults,
    overall: results.every((r) => r.pass) ? 'PASS' : 'FAIL',
    pairCount: results.length,
    passCount: results.filter((r) => r.pass).length,
    pairs: results.map((r) => ({
      id: r.pair.id,
      name: r.pair.name,
      reference: r.pair.referenceRel,
      candidate: r.pair.candidateRel,
      thresholds: r.pair.thresholds,
      skipPages: r.pair.skipPages,
      verdict: r.error ? 'ERROR' : r.pass ? 'PASS' : 'FAIL',
      error: r.error ?? null,
      durationMs: r.durationMs,
      pageCountReference: r.summary.pageCountA,
      pageCountCandidate: r.summary.pageCountB,
      pages: r.pageVerdicts.map((v) => ({
        page: v.page,
        verdict: v.skipped ? 'SKIPPED' : v.missing ? 'MISSING' : v.pass ? 'PASS' : 'FAIL',
        contentMatch: v.contentMatch,
        pixelRatio: v.pixelRatio,
        maxOffsetInches: Number(v.maxOffsetIn.toFixed(3)),
        breaches: v.breaches,
      })),
    })),
  };

  const file = path.join(outDir, 'report.json');
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

// ── CSV ───────────────────────────────────────────────────────────────
const csvEscape = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function writeCsvReport(results: PairResult[], outDir: string): string {
  const header = [
    'PairId', 'PairName', 'Reference', 'Candidate', 'Page',
    'ContentMatch%', 'PixelsDifferent%', 'MaxOffsetInches', 'Verdict', 'Breaches',
  ];
  const rows: string[][] = [];

  for (const r of results) {
    for (const v of r.pageVerdicts) {
      rows.push([
        csvEscape(r.pair.id),
        csvEscape(r.pair.name),
        csvEscape(r.pair.referenceRel),
        csvEscape(r.pair.candidateRel),
        String(v.page),
        (v.contentMatch * 100).toFixed(2),
        (v.pixelRatio * 100).toFixed(2),
        v.maxOffsetIn.toFixed(3),
        v.skipped ? 'SKIPPED' : v.missing ? 'MISSING' : v.pass ? 'PASS' : 'FAIL',
        csvEscape(v.breaches.join('; ')),
      ]);
    }
  }

  const file = path.join(outDir, 'report.csv');
  fs.writeFileSync(file, [header, ...rows].map((r) => r.join(',')).join('\r\n'));
  return file;
}

// ── JUnit XML ─────────────────────────────────────────────────────────
// Jenkins, GitLab and GitHub Actions all render this natively, which buys per-page trend
// history and "what newly broke" without building any of it. One <testsuite> per pair,
// one <testcase> per page. Suite/case names must stay stable across runs — CI keys test
// history off them, so a renamed pair reads as "old test deleted, new test added".
const xmlEscape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function writeJUnitReport(results: PairResult[], ctx: RunContext, outDir: string): string {
  const totalTests = results.reduce((n, r) => n + r.pageVerdicts.length, 0);
  const totalFailures = results.reduce(
    (n, r) => n + r.pageVerdicts.filter((v) => !v.pass && !v.skipped).length,
    0,
  );
  const totalSkipped = results.reduce((n, r) => n + r.pageVerdicts.filter((v) => v.skipped).length, 0);
  const totalErrors = results.filter((r) => r.error).length;
  const totalTime = results.reduce((n, r) => n + r.durationMs, 0) / 1000;

  const suites = results
    .map((r) => {
      const failures = r.pageVerdicts.filter((v) => !v.pass && !v.skipped).length;
      const skipped = r.pageVerdicts.filter((v) => v.skipped).length;

      if (r.error) {
        return `  <testsuite name="${xmlEscape(r.pair.id)}" tests="1" failures="0" errors="1" skipped="0" time="${(r.durationMs / 1000).toFixed(3)}">
    <testcase name="${xmlEscape(r.pair.id)}" classname="pdfsuite.${xmlEscape(r.pair.id)}">
      <error message="${xmlEscape(r.error)}">${xmlEscape(r.error)}</error>
    </testcase>
  </testsuite>`;
      }

      const cases = r.pageVerdicts
        .map((v) => {
          const name = `page-${String(v.page).padStart(3, '0')}`;
          const classname = `pdfsuite.${r.pair.id}`;
          const open = `    <testcase name="${xmlEscape(name)}" classname="${xmlEscape(classname)}"`;

          if (v.skipped) {
            return `${open}>\n      <skipped message="Excluded by skipPages"/>\n    </testcase>`;
          }
          if (v.pass) return `${open}/>`;

          const detail = [
            `Pair:      ${r.pair.name}`,
            `Reference: ${r.pair.referenceRel}`,
            `Candidate: ${r.pair.candidateRel}`,
            `Page:      ${v.page}`,
            '',
            `Content match:    ${(v.contentMatch * 100).toFixed(2)}%  (threshold ≥ ${r.pair.thresholds.contentPct}%)`,
            `Pixels different: ${(v.pixelRatio * 100).toFixed(2)}%  (threshold ≤ ${r.pair.thresholds.pixelPct}%)`,
            `Max offset:       ${v.maxOffsetIn.toFixed(3)}"  (threshold ≤ ${r.pair.thresholds.offsetIn}")`,
            '',
            `Breached: ${v.breaches.join(', ')}`,
          ].join('\n');

          return `${open}>\n      <failure message="${xmlEscape(v.breaches.join(', '))}" type="ThresholdBreach">${xmlEscape(detail)}</failure>\n    </testcase>`;
        })
        .join('\n');

      return `  <testsuite name="${xmlEscape(r.pair.id)}" tests="${r.pageVerdicts.length}" failures="${failures}" errors="0" skipped="${skipped}" time="${(r.durationMs / 1000).toFixed(3)}">
${cases}
  </testsuite>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="pdfsuite" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" skipped="${totalSkipped}" time="${totalTime.toFixed(3)}" timestamp="${ctx.generatedAt.toISOString()}">
${suites}
</testsuites>
`;

  const file = path.join(outDir, 'junit.xml');
  fs.writeFileSync(file, xml);
  return file;
}
