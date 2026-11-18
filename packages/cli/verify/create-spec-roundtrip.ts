import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';

import {
  buildValidationReport, compileSpec, readSpecWorkbook, readTemplate, toValidationResult,
} from '@pdfsuite/spec/engine';
import {
  emptyDoc, newElement, toWorkbook, type SpecDoc, type MockupElement,
} from '@pdfsuite/spec/engine';

/**
 * W-54 DoD 3 — a page drawn on the canvas produces a workbook the reader
 * accepts with **zero errors**.
 *
 * This is the whole measure of the Create spec tab. A canvas that draws
 * beautifully and emits a workbook with ten refused rows has done nothing
 * for anybody: the person would have been better off in Excel, where at
 * least the errors are theirs.
 *
 * It is a round trip, not a snapshot: the document goes through the real
 * writer and back through the real reader — `readSpecWorkbook`,
 * `readTemplate`, `compileSpec`, `buildValidationReport` — the same four
 * the app and the CLI use. Nothing here reimplements the format.
 */

installPdfLogFilter(false);

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};
const section = (t: string) => console.log(`\n  ${t}\n`);

/** A mockup with one of everything, laid out like a real cover page. */
function drawnPage(): SpecDoc {
  const doc = emptyDoc('Drawn cover');
  const page = doc.pages[0];
  const add = (
    kind: Parameters<typeof newElement>[0],
    rect: { x: number; y: number; w: number; h: number },
    patch: Partial<MockupElement>,
  ) => {
    const el = newElement(kind, `e${page.elements.length + 1}`, rect, doc);
    Object.assign(el, patch);
    page.elements.push(el);
  };

  // A sidebar with a background image, a heading on it, a table and a
  // caption — Siddharth's own example, plus the two element kinds it
  // leaves out.
  add('box', { x: 0, y: 0, w: 3, h: 8.5 }, { element: 'Sidebar', part: 'Panel', fill: '#E5E7EB', z: 0 });
  add('image', { x: 0, y: 0, w: 3, h: 2.4 }, {
    element: 'Sidebar', part: 'Backdrop', fileName: 'sidebar.png', z: 1,
  });
  add('text', { x: 0.4, y: 0.75, w: 2.2, h: 0.5 }, {
    element: 'Sidebar', part: 'Heading', text: 'Fleet Operations Review',
    font: 'Helvetica', fontSize: 28, bold: true, colour: '#111111',
    textCase: 'Title', exactText: true, identifier: true, z: 2,
  });
  add('table', { x: 3.5, y: 1.2, w: 7, h: 3 }, {
    element: 'Highlights table', part: '', columns: 3, rows: 6,
    headerHeight: 0.3, rowHeight: 0.25, columnWidths: [3, 2, 2],
    headers: ['Month', 'Deliveries', 'On time'], z: 3,
  });
  add('text', { x: 3.5, y: 4.4, w: 7, h: 0.3 }, {
    element: 'Highlights table', part: 'Caption', text: 'Figures to the quarter end',
    font: 'Times', fontSize: 10, italic: true, colour: '#52514E', exactText: false, z: 4,
  });
  return doc;
}

/** The written workbook, read back exactly as an upload would be. */
async function validate(bytes: Uint8Array, name: string) {
  const file = {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
  const wb = await readSpecWorkbook(file);
  const extraction = readTemplate(wb);
  const compiled = compileSpec(extraction);
  return {
    wb,
    result: toValidationResult(buildValidationReport(extraction, compiled)),
  };
}

async function main() {
  console.log('\n  the canvas writes a workbook the reader accepts (W-54)');

  const doc = drawnPage();
  const bytes = await toWorkbook(doc);
  const { wb, result } = await validate(bytes, 'drawn.xlsx');

  // ── the headline ────────────────────────────────────────────────────
  section('zero errors, or the feature has no point');

  const errors = result.lines.filter((l) => l.severity === 'error');
  check('the workbook the canvas wrote has NO errors', errors.length === 0,
    errors.map((l) => `${l.sheet}!${l.cell} ${l.code ?? ''}`).join(', ') || 'none');
  check('and it is not blocked', result.blocking === false);
  check('and it reads as Template v2', String(result.workbook.templateVersion) === '2',
    String(result.workbook.templateVersion));

  // ── the rules the canvas is supposed to make unreachable ────────────
  section('the rules a canvas cannot break');

  const codes = new Set(result.lines.map((l) => l.code));
  for (const code of ['unit-missing', 'unit-in-value', 'px-without-density',
    'number-expected', 'approximate-value', 'from-missing', 'parameter-unknown',
    'label-blank-outside-merge'] as const) {
    check(`no ${code}`, !codes.has(code));
  }

  // ── it says something ───────────────────────────────────────────────
  section('and it is a spec, not an empty file');

  check('every drawn element produced checks', result.assertions.length > 0,
    `${result.assertions.length} assertions`);
  check('each one reads as a sentence',
    result.assertions.every((a) => a.sentence.length > 0),
    `e.g. "${result.assertions[0]?.sentence}"`);

  const sheets = wb.sheets.map((s) => s.name);
  check('the fixed three sheets are there, then one per page',
    sheets[0] === 'Pages List' && sheets[1] === 'Settings' && sheets[2] === 'Lists'
      && sheets[3] === doc.pages[0].tab,
    sheets.join(' · '));

  // ── the two rulings that are easy to regress ────────────────────────
  section('the rulings');

  const text = JSON.stringify(result);
  check('no row is in px — the canvas is inches and points (Siddharth, 2026-11-18)',
    !/"unit":"px"/.test(text) && !codes.has('px-without-density'));

  const notes = result.lines.filter((l) => l.severity !== 'error');
  check('image content and fills are recorded, not claimed as checked',
    result.assertions.every((a) => !/File name|Fill/.test(a.sentence)),
    `${notes.length} non-error lines`);

  // Stacking is canvas-only (W-54): nothing about z-order may reach the
  // workbook, or the sheet starts carrying a fact the checker ignores.
  check('stacking stayed on the canvas', !/\bz\b|z-order|stacking/i.test(text));

  // ── the identifier ──────────────────────────────────────────────────
  section('the page can be found in a PDF');

  const pagesList = wb.sheets.find((s) => s.name === 'Pages List');
  const flat = JSON.stringify(pagesList?.cells ?? pagesList ?? {});
  check('the marked text became the page\'s Identifying text',
    flat.includes('Fleet Operations Review'),
    'without it a page can only be matched by its number');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log(`  ${ok}/${checks.length} checks passed`);
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
