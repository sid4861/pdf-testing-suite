import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, runSpec, loadPdf,
  bindPages, hasPagesList, normalizePageText,
} from '@pdfsuite/spec/engine';
import type { SpecPage } from '@pdfsuite/spec/engine';

/**
 * W-04 DoD 2 — the Pages List decides which page is which
 * (SR-SPEC-CHECK decisions 1–3).
 *
 * Every rule here is a statement about which text appeared where, so most of
 * it is tested over page text alone: a synthetic document is the only way to
 * have a page be absent, repeated or out of order on demand. The fixture then
 * proves the real path still binds a real PDF.
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

/** A Pages List page, with only what the binder reads. */
const page = (
  n: number, name: string, kind: SpecPage['kind'], identifyingText: string,
  extra: Partial<SpecPage> = {},
): SpecPage => ({ page: n, elements: [], name, kind, identifyingText, ...extra });

const COVER = page(1, 'Cover', 'required', 'Fleet Operations Review');
const HIGHLIGHTS = page(2, 'Fleet highlights', 'required', 'Fleet Highlights');
const DELIVERY = page(3, 'Delivery performance', 'optional', 'Delivery Performance');
const FUEL = page(4, 'Fuel efficiency', 'conditional', 'Fuel Efficiency Trend');

const errors = (fs_: { severity: string }[]) => fs_.filter((x) => x.severity === 'error');
const warnings = (fs_: { severity: string }[]) => fs_.filter((x) => x.severity === 'warning');
const notes = (fs_: { severity: string }[]) => fs_.filter((x) => x.severity === 'note');

function main0() {
  console.log('\n  decision 1 — Required, Optional, Conditional\n');

  const all = bindPages(
    ['Fleet Operations Review 2026', 'Fleet Highlights', 'Delivery Performance by Region', 'Fuel Efficiency Trend'],
    [COVER, HIGHLIGHTS, DELIVERY, FUEL],
  );
  check('a document with every page binds cleanly',
    all.findings.length === 0 && all.bindings.every((b) => b.pdfPage != null),
    all.bindings.map((b) => `${b.specPage.name}→${b.pdfPage}`).join(', '));

  const noOptional = bindPages(
    ['Fleet Operations Review', 'Fleet Highlights', 'Fuel Efficiency Trend'],
    [COVER, HIGHLIGHTS, DELIVERY, FUEL],
  );
  check('an absent Optional page is noted, not failed',
    errors(noOptional.findings).length === 0 &&
    notes(noOptional.findings).some((n) => /Optional/.test((n as { message: string }).message)));
  check('and the pages after it still bind',
    noOptional.bindings.find((b) => b.specPage.name === 'Fuel efficiency')?.pdfPage === 3);

  const noConditional = bindPages(
    ['Fleet Operations Review', 'Fleet Highlights'],
    [COVER, HIGHLIGHTS, FUEL],
  );
  check('an absent Conditional page is never a failure',
    errors(noConditional.findings).length === 0 &&
    notes(noConditional.findings).some((n) => /Conditional/.test((n as { message: string }).message)));

  const noRequired = bindPages(['Fleet Operations Review'], [COVER, HIGHLIGHTS]);
  const required = noRequired.findings.find((x) => x.severity === 'error');
  check('an absent Required page is an error',
    errors(noRequired.findings).length === 1 && /Required/.test(required?.message ?? ''),
    required?.message);

  console.log('\n  decision 1 — variant groups\n');

  const SHORT = page(2, 'Summary (short)', 'required', 'Summary — short form', { variantGroup: 'summary' });
  const LONG = page(3, 'Summary (long)', 'required', 'Summary — long form', { variantGroup: 'summary' });

  const one = bindPages(['Fleet Operations Review', 'Summary — long form'], [COVER, SHORT, LONG]);
  check('exactly one variant is right',
    errors(one.findings).length === 0 &&
    one.bindings.find((b) => b.specPage.name === 'Summary (long)')?.pdfPage === 2);
  check('and the other variant is simply not there',
    one.bindings.find((b) => b.specPage.name === 'Summary (short)')?.pdfPage === null);

  const none = bindPages(['Fleet Operations Review'], [COVER, SHORT, LONG]);
  check('no variant at all is an error', errors(none.findings).length === 1,
    (none.findings.find((x) => x.severity === 'error') as { message: string } | undefined)?.message);

  const both = bindPages(
    ['Fleet Operations Review', 'Summary — short form', 'Summary — long form'],
    [COVER, SHORT, LONG],
  );
  check('two variants is an error too', errors(both.findings).length === 1,
    (both.findings.find((x) => x.severity === 'error') as { message: string } | undefined)?.message);
  check('and both are still checked, so the report says what is on them',
    both.bindings.filter((b) => b.specPage.variantGroup && b.pdfPage != null).length === 2);

  console.log('\n  decision 2 — order, and pages nobody claimed\n');

  const swapped = bindPages(
    ['Fleet Highlights', 'Fleet Operations Review'],
    [COVER, HIGHLIGHTS],
  );
  check('a page out of order is a warning, not a failure',
    errors(swapped.findings).length === 0 && warnings(swapped.findings).length === 1,
    (swapped.findings[0] as { message: string } | undefined)?.message);
  check('and it is still compared, against the page it really is on',
    swapped.bindings.find((b) => b.specPage.name === 'Cover')?.pdfPage === 2 &&
    swapped.bindings.find((b) => b.specPage.name === 'Fleet highlights')?.pdfPage === 1);

  const extra = bindPages(
    ['Fleet Operations Review', 'An appendix nobody listed', 'Fleet Highlights'],
    [COVER, HIGHLIGHTS],
  );
  check('a PDF page the Pages List does not claim is a warning',
    warnings(extra.findings).some((w) => (w as { pdfPage?: number }).pdfPage === 2),
    (extra.findings[0] as { message: string } | undefined)?.message);

  console.log('\n  decision 3 — repeats\n');

  const DETAIL = page(2, 'Vehicle detail', 'required', 'Vehicle Detail', { repeats: { min: 1, max: null } });
  const many = bindPages(
    ['Fleet Operations Review', 'Vehicle Detail 1', 'Vehicle Detail 2', 'Vehicle Detail 3'],
    [COVER, DETAIL],
  );
  check('a repeating page binds every occurrence',
    many.bindings.filter((b) => b.specPage.name === 'Vehicle detail').length === 3 &&
    many.findings.length === 0,
    many.bindings.filter((b) => b.specPage.name === 'Vehicle detail').map((b) => b.pdfPage).join(', '));
  check('each occurrence is numbered',
    many.bindings.filter((b) => b.specPage.name === 'Vehicle detail').map((b) => b.occurrence).join(',') === '1,2,3');

  const capped = page(2, 'Vehicle detail', 'required', 'Vehicle Detail', { repeats: { min: 1, max: 2 } });
  const tooMany = bindPages(
    ['Fleet Operations Review', 'Vehicle Detail 1', 'Vehicle Detail 2', 'Vehicle Detail 3'],
    [COVER, capped],
  );
  check('past the top of the range is an error', errors(tooMany.findings).length === 1,
    (tooMany.findings.find((x) => x.severity === 'error') as { message: string } | undefined)?.message);

  const twice = page(2, 'Vehicle detail', 'required', 'Vehicle Detail', { repeats: { min: 2, max: null } });
  const tooFew = bindPages(['Fleet Operations Review', 'Vehicle Detail 1'], [COVER, twice]);
  check('short of the bottom of it is an error too', errors(tooFew.findings).length === 1,
    (tooFew.findings.find((x) => x.severity === 'error') as { message: string } | undefined)?.message);

  console.log('\n  matching\n');

  check('case and spacing do not matter',
    bindPages(['FLEET   OPERATIONS\nREVIEW'], [COVER]).bindings[0].pdfPage === 1);
  check('nor does a curly apostrophe or an en dash',
    normalizePageText('Don’t — stop') === normalizePageText("Don't - stop"));
  check('a spec with no Pages List is left to its own page numbers',
    hasPagesList([{ page: 1, elements: [] }]) === false &&
    hasPagesList([COVER]) === true);
}

async function main() {
  main0();

  console.log('\n  the fixture, end to end\n');

  const { spec } = compileSpec(readTemplate(await readSpecWorkbook(f('report-spec.xlsx'))));
  check('the compiled spec carries its Pages List',
    hasPagesList(spec.pages) &&
    spec.pages.every((p) => !!p.identifyingText && !!p.kind),
    spec.pages.map((p) => `${p.name}:${p.kind}`).join(', '));
  check('and its Repeats cells read as ranges',
    JSON.stringify(spec.pages.map((p) => p.repeats)) ===
      JSON.stringify([{ min: 1, max: 1 }, { min: 1, max: 1 }, { min: 0, max: 1 }, { min: 0, max: 1 }]),
    JSON.stringify(spec.pages.map((p) => p.repeats)));

  const report = await runSpec(await loadPdf(f('report.pdf')), spec);
  for (const finding of report.pageFindings) {
    console.log(`      ${finding.severity}: ${finding.message}`);
  }
  check('every page of the matching PDF is identified by its own text',
    report.pages.every((p) => p.binding === 'identified'),
    report.pages.map((p) => `${p.name}→${p.page}`).join(', '));
  check('with no page finding at all', report.pageFindings.length === 0);
  check('and it still reports no failure', report.totalFail === 0,
    `${report.passElements}/${report.elementCount} elements pass`);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
