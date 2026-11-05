import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, buildValidationReport,
} from '../../src/features/spec/engine';

/**
 * W-02 DoD 8 — the fixtures are an oracle (SR-SPEC-INTAKE decision 16).
 *
 * The other spec tests assert *properties*: that a position parses, that a
 * colour matches. Properties do not catch the change nobody meant to make —
 * a tolerance that quietly widens, a row that stops compiling, a value read
 * one decimal differently. So the whole extraction and the whole compiled
 * spec of the committed workbook are frozen here, byte for byte, and any
 * difference fails with the first few lines that differ.
 *
 * When a change to the parser is *intended*, re-freeze it deliberately:
 *
 *     node .work/spec-oracle.js --update
 *
 * and read the diff in the commit. That is the point — the oracle does not
 * stop the parser changing, it stops it changing unnoticed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../work/samples/excel-spec-template-v2');
const update = process.argv.includes('--update');

const f = (n: string): File => {
  const b = fs.readFileSync(path.join(fixture, n));
  return {
    name: n, size: b.byteLength,
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File;
};

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

/**
 * The SHA-256 is of the file's bytes, which is exactly what must *not* be
 * frozen: it is checked on its own, and leaving it in the oracle would make
 * every unrelated re-save of the workbook look like a parser change.
 */
function stable<T>(value: T): string {
  return JSON.stringify(value, (k, v) => (k === 'sha256' ? '<bytes>' : v), 1) + '\n';
}

/** The first lines that differ, which is all anyone reads. */
function firstDifference(a: string, b: string): string {
  const x = a.split('\n');
  const y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) {
      return `line ${i + 1}: frozen ${JSON.stringify(x[i] ?? null)} · now ${JSON.stringify(y[i] ?? null)}`;
    }
  }
  return 'the files differ only in length';
}

function freeze(name: string, produced: string): boolean {
  const file = path.join(fixture, name);
  if (update || !fs.existsSync(file)) {
    fs.writeFileSync(file, produced);
    console.log('      wrote ' + name + ' (' + produced.split('\n').length + ' lines)');
    return true;
  }
  const frozen = fs.readFileSync(file, 'utf8');
  if (frozen === produced) return true;
  console.log('      ' + firstDifference(frozen, produced));
  console.log('      if this change is intended: node .work/spec-oracle.js --update');
  return false;
}

async function main() {
  console.log('\n  the clean workbook, frozen\n');

  const book = await readSpecWorkbook(f('report-spec.xlsx'));
  const extraction = readTemplate(book);
  const compiled = compileSpec(extraction);

  check('the extraction has not drifted',
    freeze('expected-extraction.json', stable(extraction)),
    `${extraction.rows.length} rows`);
  check('the compiled spec has not drifted',
    freeze('expected-spec.json', stable(compiled.spec)),
    `${compiled.spec.pages.length} pages`);
  check('nor has coverage',
    freeze('expected-coverage.json', stable({ counts: compiled.counts, coverage: compiled.coverage })),
    `${compiled.counts.checked} of ${compiled.counts.rows} checked`);

  // The SHA-256 is held out of the oracle, so it is checked here instead: it
  // is what ties a spec JSON to the workbook it came from (decision 14).
  check('the workbook SHA-256 is read and is of the bytes',
    /^[0-9a-f]{64}$/.test(book.sha256 ?? ''), book.sha256?.slice(0, 16) + '…');

  console.log('\n  the workbook with planted errors\n');

  const badEx = readTemplate(await readSpecWorkbook(f('report-spec-with-errors.xlsx')));
  const badReport = buildValidationReport(badEx, compileSpec(badEx));

  const expected = JSON.parse(
    fs.readFileSync(path.join(fixture, 'expected-validation.json'), 'utf8'),
  ) as { errors: { sheet: string; row: number; cell: string; code: string }[] };

  // Matched by cell, not by wording: the fixture's messages were written
  // before the reader existed and are illustrative. The cell is the claim —
  // one error, on that cell, and no others anywhere.
  const planted = new Set(expected.errors.map((e) => `${e.sheet}!${e.cell}`));
  const reported = new Set(badReport.errors.map((e) => `${e.sheet}!${e.cell}`));
  const missing = [...planted].filter((k) => !reported.has(k));
  const extra = [...reported].filter((k) => !planted.has(k));

  check('every planted error is reported', missing.length === 0,
    missing.length ? missing.join(', ') : `${planted.size} of ${planted.size}`);
  check('and nothing else is', extra.length === 0,
    extra.length ? extra.join(', ') : 'no invented errors');

  // "No assertion for those rows" (DoD 8): a refused row must not reach the
  // spec by another route, which is the failure that would matter.
  const badSpec = compileSpec(badEx).spec;
  const cells = new Set<string>();
  for (const p of badSpec.pages) {
    for (const el of p.elements) {
      const src = (el as { source?: Record<string, { sheet: string; cell: string }> }).source ?? {};
      for (const s of Object.values(src)) cells.add(`${s.sheet}!${s.cell}`);
    }
  }
  const leaked = [...planted].filter((k) => cells.has(k));
  check('and no refused row produced an assertion', leaked.length === 0,
    leaked.length ? leaked.join(', ') : `${cells.size} assertion cells, none of them refused`);

  console.log('\n  decision 8 — the legacy layout\n');

  // DoD 8's last clause — a legacy-layout sheet yields a *draft v2 workbook*
  // and no assertions — is W-02 DoD 4's feature, which is not built. Saying
  // so here is the honest form: a test that passed by not testing it would
  // read as coverage.
  console.log('      not tested: the legacy nested layout is W-02 DoD 4, unbuilt.');
  console.log('      Decision 8 says it must yield a draft v2 workbook and no assertion;');
  console.log('      today nothing reads that layout at all, so there is nothing to freeze.');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
