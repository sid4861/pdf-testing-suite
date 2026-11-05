import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSpec, loadPdf, type PdfSpec } from '../../src/features/spec/engine';

/**
 * W-04 — SR-SPEC-CHECK decisions 4, 5, 6, 10 and 11.
 *
 * Each case is run against the fixture's real PDF, so a pass here means the
 * checker behaved on a document rather than on a mock.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../work/samples/excel-spec-template-v2');

const f = (p: string): File => {
  const b = fs.readFileSync(p);
  return {
    name: path.basename(p),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File;
};

/** The sidebar heading, in whichever unit the caller wants to state it in. */
function sidebarSpec(units: 'in' | 'mm', tolerance?: { position: number }): PdfSpec {
  const k = units === 'in' ? 1 : 25.4;
  return {
    title: 'units', units,
    pageSize: { width: 11 * k, height: 8.5 * k },
    pages: [{ page: 2, elements: [
      { id: 'fleet', label: 'Sidebar title', type: 'text',
        top: 0.75 * k, left: 0.4 * k, text: 'Fleet', match: 'exact',
        ...(tolerance ? { tolerance: { position: tolerance.position * k } } : {}) },
    ] }],
  };
}

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean) => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name);
};

async function main() {
  const pdf = await loadPdf(f(path.join(fixture, 'report.pdf')));

  // ── decision 11 · a tolerance resolves in the right unit ───────────
  //
  // The SR-CONSTANTS default is 0.06 **inches**. Stating the same page in
  // millimetres must not shrink it to 0.06 mm.
  const inches = (await runSpec(pdf, sidebarSpec('in'))).pages[0];
  const mm = (await runSpec(pdf, sidebarSpec('mm'))).pages[0];
  const elIn = inches.elements.find((e) => e.id === 'fleet')!;
  const elMm = mm.elements.find((e) => e.id === 'fleet')!;
  console.log('\n  decision 11 — tolerances in the row\'s unit');
  check('the same page passes stated in inches', elIn.status === 'pass');
  check('and stated in millimetres', elMm.status === 'pass');

  // A tolerance the row states IS in the row's unit: 0.001 of an inch is tight
  // enough to be meaningful, and the same number in mm is tighter still.
  const tight = (await runSpec(pdf, sidebarSpec('in', { position: 0.0001 }))).pages[0];
  check(
    'a tolerance the row states is honoured',
    tight.elements.find((e) => e.id === 'fleet')!.checks.some((c) => c.name === 'Left' || c.name === 'Top'),
  );

  // ── decision 4 · the page size is checked ──────────────────────────
  console.log('\n  decision 4 — page size');
  const sized = (await runSpec(pdf, sidebarSpec('in'))).pages[0];
  const size = sized.pageSize;
  check('the page size is reported at all', !!size);
  check('the fixture is 11 x 8.5 and passes', size?.status === 'pass');

  const wrong: PdfSpec = { ...sidebarSpec('in'), pageSize: { width: 8.5, height: 11 } };
  const wrongPage = (await runSpec(pdf, wrong)).pages[0];
  const wrongSize = wrongPage.pageSize;
  check('a different size is a warning, not a failure', wrongSize?.status === 'warning');
  check('and the warning does not count as a failed check', wrongPage.failCount === 0);
  check('it is counted as a warning', wrongPage.warnCount === 1);

  const pinned: PdfSpec = { ...wrong, pageSizePinned: true };
  const pinnedSize = (await runSpec(pdf, pinned)).pages[0].pageSize;
  check('a pinned size that differs is an error', pinnedSize?.status === 'fail');

  // ── decisions 5 and 10 · the spelling both sides are compared in ───
  //
  // The fixture's page 3 footnote reads "...booked one-hour window." A spec
  // written with a curly apostrophe, an en dash or a soft hyphen is the same
  // sentence and must match.
  console.log('\n  decisions 5 and 10 — normalisation');
  const wording = (variant: string): PdfSpec => ({
    title: 'wording', units: 'in', pageSize: { width: 11, height: 8.5 },
    pages: [{ page: 3, elements: [
      { id: 'footnote', label: 'Footnote', type: 'text', top: 7.1, left: 0.75, text: variant },
    ] }],
  });
  const plain = (await runSpec(pdf, wording('booked one-hour window'))).pages[0].elements.find((e) => e.id === 'footnote')!;
  check('the footnote is found as written', plain.status !== 'not-found');

  const enDash = (await runSpec(pdf, wording('booked one–hour window'))).pages[0].elements.find((e) => e.id === 'footnote')!;
  check('an en dash matches a hyphen', enDash.status !== 'not-found');

  const softHyphen = (await runSpec(pdf, wording('booked one-hour win­dow'))).pages[0].elements.find((e) => e.id === 'footnote')!;
  check('a soft hyphen is ignored', softHyphen.status !== 'not-found');

  const nbsp = (await runSpec(pdf, wording('booked one-hour window'))).pages[0].elements.find((e) => e.id === 'footnote')!;
  check('a non-breaking space matches a space', nbsp.status !== 'not-found');

  const nonsense = (await runSpec(pdf, wording('booked two-hour window'))).pages[0].elements.find((e) => e.id === 'footnote')!;
  check('a genuinely different word still fails', nonsense.status === 'not-found');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
