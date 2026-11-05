import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, runSpec, loadPdf,
} from '../../src/features/spec/engine';

/**
 * W-02 DoD 5 and 7, end to end: workbook → spec JSON → a PDF checked against it.
 *
 * This is the whole point of the item, so it is tested the whole way rather
 * than in pieces. The two claims the fixture's README makes are the two
 * assertions that matter: its matching PDF reports **no failure**, and its
 * deviations PDF reports the ones it says are detectable.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../work/samples/excel-spec-template-v2');

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

async function main() {
  const ex = readTemplate(await readSpecWorkbook(f('report-spec.xlsx')));
  const { spec, coverage, counts } = compileSpec(ex);

  console.log('\n  the spec JSON\n');

  const elements = spec.pages.reduce((n, p) => n + p.elements.length, 0);
  check('it has pages and elements', spec.pages.length === 4 && elements > 0,
    `${spec.pages.length} pages, ${elements} elements`);

  // Decision 14 — every assertion names the cell it came from.
  const allSourced = spec.pages.every((p) =>
    p.elements.every((e) => {
      const src = (e as { source?: Record<string, unknown> }).source;
      return src && Object.keys(src).length > 0;
    }),
  );
  check('every element names its source cells', allSourced);

  const src = (spec as { source?: { sha256?: string | null; templateVersion?: string | null } }).source;
  check('the workbook SHA-256 is carried', (src?.sha256 ?? '').length === 64);
  check('the template version is carried', src?.templateVersion === '2');
  check('the workbook’s own tolerances are carried', spec.tolerance?.position === 0.06);
  check('the page size is carried', spec.pageSize?.width === 11 && spec.pageSize?.height === 8.5);

  // Decision 13 — nothing passes silently: every row ends somewhere.
  const accounted = counts.checked + counts.noted + counts.excluded + counts.unreadable;
  check('every spec row is accounted for in coverage', accounted === counts.rows,
    `${accounted} of ${counts.rows}`);
  check('coverage names the cell of each row', coverage.every((c) => !!c.sheet && c.row > 0));

  // Decision 9's spellings, on the parser: the clean workbook states no range,
  // so asserting one here would be testing the fixture, not the code.
  const { parseNumber, parseNumericValue } = await import('../../src/features/spec/engine');
  check('a fraction reads as a number', parseNumber('2 1/8') === 2.125);
  check('a comma decimal reads as a number', parseNumber('0,5') === 0.5);
  check('a leading dot reads as a number', parseNumber('.5') === 0.5);
  const band = parseNumericValue('0.5–0.75', false);
  check('a range becomes a band', band.kind === 'range' && band.low === 0.5 && band.high === 0.75);
  check('a range plus a Tolerance is refused', parseNumericValue('0.5–0.75', true).kind === 'error');
  check('an approximate value is refused', parseNumericValue('~10', false).kind === 'error');

  console.log('\n  the matching PDF — the README says no failure\n');

  const good = await runSpec(await loadPdf(f('report.pdf')), spec);
  const failing = good.pages.flatMap((p) =>
    p.elements.filter((e) => e.status === 'fail' || e.status === 'not-found'),
  );
  for (const e of failing) {
    console.log('      ' + e.label + ' — ' +
      e.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.expected} vs ${c.actual}`).join('; '));
  }
  check('no element fails', failing.length === 0, `${failing.length} failing`);
  check('and no check is counted as failed', good.pages.every((p) => p.failCount === 0));

  const unver = good.pages.flatMap((p) => p.elements.filter((e) => e.status === 'unverifiable'));
  check('a single-line paragraph is unverifiable, not failed', unver.length > 0,
    `${unver.length} unverifiable — ${unver.map((e) => e.label).join(', ')}`);

  console.log('\n  the deviations PDF — the README tables what is detectable\n');

  const bad = await runSpec(await loadPdf(f('report-with-deviations.pdf')), spec);
  const found = bad.pages.flatMap((p) =>
    p.elements.filter((e) => e.status === 'fail' || e.status === 'not-found'),
  );
  for (const e of found) {
    console.log('      ' + e.label + ' — ' +
      e.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.expected} vs ${c.actual}`).join('; ').slice(0, 88));
  }

  const hit = (label: RegExp, check0: RegExp) =>
    found.some((e) => label.test(e.label) && e.checks.some((c) => !c.pass && check0.test(c.name)));

  check('1 · report title font size', hit(/Report title/i, /font size/i));
  check('2 · company logo width', hit(/logo/i, /width/i));
  check('5 · highlights table left', hit(/Highlights table/i, /left/i));
  check('6 · summary line spacing', hit(/Summary/i, /line spacing/i));
  check('7 · depot map height', hit(/Depot map/i, /height/i));
  check('9 · regional table rows', hit(/Regional table/i, /rows/i));
  check('10 · footnote wording', found.some((e) => /Footnote/i.test(e.label) && e.status === 'not-found'));
  check('11 · fuel graph top', hit(/Fuel chart/i, /top/i));
  check('the matching PDF and this one do not agree', found.length > failing.length);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
