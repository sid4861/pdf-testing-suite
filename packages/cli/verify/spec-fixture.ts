import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, runSpec, loadPdf,
} from '@pdfsuite/spec/engine';
import type { SpecReport } from '@pdfsuite/spec/engine';

/**
 * W-04 DoD 6 — the fixture is the checker's acceptance test.
 *
 * `work/samples/excel-spec-template-v2/README.md` tables twelve deviations and
 * says what each must produce. This drives that table: every row it calls a
 * failure must fail on the right check, every row it calls undetectable must
 * be **absent from the findings and present in coverage** — never a pass — and
 * the matching PDF must report nothing at all.
 *
 * A fixture whose README is prose nobody runs is a fixture that drifts from
 * the thing it documents.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../../work/samples/excel-spec-template-v2');
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

/** One row of the README's deviations table. */
interface Expected {
  n: number;
  page: number;
  element: RegExp;
  /** The check that must fail, or null when the element must not be found. */
  check: string | null;
  /** True where the README says "not detectable today". */
  undetectable?: boolean;
  why?: string;
}

const TABLE: Expected[] = [
  { n: 1, page: 1, element: /Report title/i, check: 'Font size' },
  { n: 2, page: 1, element: /Company logo/i, check: 'Width' },
  { n: 3, page: 1, element: /Reporting period/i, check: null, undetectable: true,
    why: 'rich text — per-word styles inside one cell (SR-SPEC-INTAKE decision 10, unbuilt)' },
  { n: 4, page: 1, element: /Title block . Container|Title block container/i, check: null, undetectable: true,
    why: 'a container fill, not text colour — the colour check reads painted text only' },
  { n: 5, page: 2, element: /Highlights table/i, check: 'Left' },
  { n: 6, page: 2, element: /Summary/i, check: 'Line spacing' },
  { n: 7, page: 2, element: /Depot map/i, check: 'Height' },
  { n: 8, page: 3, element: /Deliveries graph|series/i, check: null, undetectable: true,
    why: 'graph series colours — Check? = Note rows, so they sit in coverage' },
  { n: 9, page: 3, element: /Regional table/i, check: 'Rows' },
  { n: 10, page: 3, element: /Footnote/i, check: null },
  { n: 11, page: 4, element: /Fuel (graph|chart)/i, check: 'Top' },
  { n: 12, page: 4, element: /Page number/i, check: null },
];

const elementsOf = (report: SpecReport, page: number) =>
  report.pages.filter((p) => p.page === page).flatMap((p) => p.elements);

async function main() {
  const compiled = compileSpec(readTemplate(await readSpecWorkbook(f('report-spec.xlsx'))));

  console.log('\n  report.pdf — the matching PDF\n');

  const good = await runSpec(await loadPdf(f('report.pdf')), compiled.spec, {
    coverage: compiled.counts, pdfName: 'report.pdf',
  });
  const badElements = good.pages.flatMap((p) =>
    p.elements.filter((e) => e.status === 'fail' || e.status === 'not-found'));
  for (const e of badElements) {
    console.log('      ' + e.label + ' — ' +
      e.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.expected} vs ${c.actual}`).join('; '));
  }
  check('it reports no failure at all', badElements.length === 0 && good.totalFail === 0,
    `${good.passElements}/${good.elementCount} elements pass`);
  check('and no page finding either', good.pageFindings.length === 0);
  check('so the README has no "known false failures" to declare',
    !fs.readFileSync(path.join(fixture, 'README.md'), 'utf8').includes('false failures'));

  console.log('\n  report-with-deviations.pdf — the README’s table\n');

  const bad = await runSpec(await loadPdf(f('report-with-deviations.pdf')), compiled.spec, {
    coverage: compiled.counts, pdfName: 'report-with-deviations.pdf',
  });

  for (const row of TABLE) {
    const els = elementsOf(bad, row.page).filter((e) => row.element.test(e.label));
    const failing = els.filter((e) => e.status === 'fail' || e.status === 'not-found');
    const failed = failing.flatMap((e) => e.checks.filter((c) => !c.pass).map((c) => c.name));

    if (row.undetectable) {
      // The claim is not "nothing happened" but "it was not reported as a
      // pass": an undetectable deviation must be visible as a row with no
      // check, which is what coverage is for.
      check(`${row.n}. ${row.why}`,
        failed.length === 0,
        els.length ? `${els.map((e) => e.label).join(', ')} — not reported as a finding` : 'no element of its own');
      continue;
    }

    if (row.check === null) {
      check(`${row.n}. ${els[0]?.label ?? row.element.source} is not found`,
        failing.some((e) => e.status === 'not-found'),
        failing.map((e) => e.status).join(', ') || 'no failing element');
      continue;
    }

    check(`${row.n}. ${els[0]?.label ?? row.element.source} fails on ${row.check}`,
      failed.includes(row.check),
      failed.length ? `failed: ${failed.join(', ')}` : 'nothing failed');
  }

  console.log('');
  const detectable = TABLE.filter((r) => !r.undetectable).length;
  const found = bad.pages.flatMap((p) => p.elements).filter((e) => e.status === 'fail' || e.status === 'not-found');
  check(`all ${detectable} detectable deviations are reported`,
    checks.slice(-TABLE.length).every(([, p]) => p),
    `${found.length} elements reported as failing`);

  // Nothing beyond the table: an extra failure on this PDF is as much a
  // defect as a missing one, because the fixture says what is wrong with it.
  const tabled = TABLE.map((r) => r.element);
  const extra = found.filter((e) => !tabled.some((re) => re.test(e.label)));
  for (const e of extra) console.log('      extra: ' + e.label + ' — ' + e.status);
  check('and nothing else is', extra.length === 0, `${extra.length} unexpected findings`);

  check('the undetectable three are in coverage, not passing',
    compiled.coverage.filter((c) => c.status === 'noted' || c.status === 'excluded').length > 0 &&
    compiled.counts.checked < compiled.counts.rows,
    `${compiled.counts.checked} of ${compiled.counts.rows} rows checked`);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
