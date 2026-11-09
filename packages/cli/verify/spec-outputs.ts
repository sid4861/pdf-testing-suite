import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, buildValidationReport, validateSpec, coverageLine,
  validationReportHtml, extractionJson, specJsonText, annotateWorkbook, outputNames,
} from '@pdfsuite/spec/engine';

/**
 * W-02 DoD 7 — the four downloadable outputs (SR-SPEC-INTAKE decision 14).
 *
 * The one that needs real testing is the annotated workbook, because it is
 * surgery on somebody else's file: the claim is that the ten error cells come
 * back red, a Validation sheet lists them, and **everything else still reads
 * exactly as it did**. A workbook that Excel refuses to open, or that loses a
 * row, would be worse than no annotation at all.
 *
 * The round trip is the other claim worth testing: the spec JSON this writes
 * can be uploaded again.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../../work/samples/excel-spec-template-v2');

const asFile = (name: string, bytes: Uint8Array): File => ({
  name, size: bytes.byteLength,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
} as unknown as File);

const fromDisk = (n: string): File => asFile(n, fs.readFileSync(path.join(fixture, n)));

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

async function readAll(name: string) {
  const book = await readSpecWorkbook(fromDisk(name));
  const ex = readTemplate(book);
  const compiled = compileSpec(ex);
  return { book, ex, compiled, report: buildValidationReport(ex, compiled) };
}

async function main() {
  console.log('\n  the three text outputs\n');

  const clean = await readAll('report-spec.xlsx');

  const html = validationReportHtml(clean.report);
  check('the validation report is a whole HTML document',
    html.startsWith('<!doctype html>') && html.trimEnd().endsWith('</html>'));
  check('it carries the coverage line and the hash',
    html.includes(coverageLine(clean.report.counts)) && html.includes(clean.book.sha256 ?? 'no hash'),
    coverageLine(clean.report.counts));
  check('and every assertion in words, with its cell',
    html.includes('from the top of the page') && html.includes('!E12'));
  // A workbook is a document someone else wrote, and its cells end up in this
  // page. Markup in a cell must arrive as text.
  const hostile = validationReportHtml({
    ...clean.report,
    errors: [{ severity: 'error', sheet: '1', cell: 'E9', message: '<script>alert(1)</script>' }],
  });
  check('markup in a cell arrives as text, not as markup',
    !hostile.includes('<script>alert(1)</script>') && hostile.includes('&lt;script&gt;'));

  const ex = JSON.parse(extractionJson(clean.ex, clean.compiled)) as {
    rows: { sheet: string; row: number; cell: string; status: string; raw: string }[];
  };
  check('the extraction lists every row the reader saw',
    ex.rows.length === clean.ex.rows.length && ex.rows.length === 290,
    `${ex.rows.length} rows`);
  check('each with its cell, its raw text and its status',
    ex.rows.every((r) => /^[A-Z]+\d+$/.test(r.cell) && !!r.sheet && !!r.status),
    `e.g. ${ex.rows[0].sheet}!${ex.rows[0].cell} ${ex.rows[0].status}`);
  check('and the statuses agree with coverage',
    ex.rows.filter((r) => r.status === 'checked').length === clean.compiled.counts.checked,
    `${ex.rows.filter((r) => r.status === 'checked').length} checked`);

  console.log('\n  the spec JSON goes back in\n');

  const text = specJsonText(clean.compiled.spec);
  const reloaded = validateSpec(JSON.parse(text));
  check('the spec JSON we write is a spec JSON we accept',
    reloaded.pages.length === clean.compiled.spec.pages.length,
    `${reloaded.pages.length} pages`);
  check('and it survives the trip whole',
    JSON.stringify(reloaded) === JSON.stringify(clean.compiled.spec),
    'every field, including source and the thresholds');
  check('including each element’s source cell',
    JSON.parse(text).pages[0].elements[0].source?.top?.cell != null,
    JSON.parse(text).pages[0].elements[0].source?.top?.cell);

  console.log('\n  the annotated workbook\n');

  const bad = await readAll('report-spec-with-errors.xlsx');
  const annotated = await annotateWorkbook(bad.book.bytes, bad.report);
  check('it is written', annotated.byteLength > 0,
    `${Math.round(annotated.byteLength / 1024)} KB, from ${Math.round(bad.book.bytes.byteLength / 1024)} KB`);

  // The real test: read it back with the same reader the app uses.
  const reread = await readSpecWorkbook(asFile('annotated.xlsx', annotated));
  check('and it still reads as a workbook',
    reread.workbook.source === 'xlsx',
    reread.workbook.sheets.map((s) => s.name).join(', '));

  const sheet = reread.workbook.sheets.find((s) => s.name === 'Validation');
  check('a Validation sheet was added', !!sheet);
  const listed = sheet ? sheet.text.slice(1).filter((r) => (r[0] ?? '').trim() === 'Error').length : 0;
  check('listing every error', listed === bad.report.errors.length,
    `${listed} of ${bad.report.errors.length}`);

  // Red, on exactly the cells that are wrong — including the empty ones,
  // which is where half the errors are.
  const fills = (reread.workbook.styles?.fills ?? []) as { fgColor?: { rgb?: string } }[];
  const xfs = (reread.workbook.styles?.cellXfs ?? []) as { fillId: number }[];
  const isRed = (ref: string, sheetName: string) => {
    const sh = reread.workbook.sheets.find((s) => s.name === sheetName);
    const xf = sh?.styleIndex?.[ref];
    if (xf == null) return false;
    const fill = fills[xfs[xf]?.fillId];
    return (fill?.fgColor?.rgb ?? '').toUpperCase().endsWith('FFC7CE');
  };

  const marked = bad.report.errors.filter((e) => e.sheet && e.cell && isRed(e.cell, e.sheet));
  for (const e of bad.report.errors) {
    if (!marked.includes(e)) console.log(`      not red: ${e.sheet}!${e.cell}`);
  }
  check('every error cell is filled red', marked.length === bad.report.errors.length,
    `${marked.length} of ${bad.report.errors.length}`);

  const emptyOnes = bad.report.errors.filter((e) => {
    const sh = bad.book.workbook.sheets.find((s) => s.name === e.sheet);
    const m = e.cell?.match(/^([A-Z]+)(\d+)$/);
    if (!sh || !m) return false;
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return !(sh.text?.[Number(m[2]) - 1]?.[c - 1] ?? '').trim();
  });
  check('including the ones that are blank in the file',
    emptyOnes.length > 0 && emptyOnes.every((e) => isRed(e.cell!, e.sheet!)),
    `${emptyOnes.length} blank cells: ${emptyOnes.map((e) => e.sheet + '!' + e.cell).join(', ')}`);

  // Nothing else moved.
  const after = readTemplate(reread);
  check('and the workbook still reads exactly as before',
    after.rows.length === bad.ex.rows.length &&
    JSON.stringify(after.rows.map((r) => [r.sheet, r.row, r.value, r.unit])) ===
      JSON.stringify(bad.ex.rows.map((r) => [r.sheet, r.row, r.value, r.unit])),
    `${after.rows.length} rows, unchanged`);
  check('with the same errors found in it',
    buildValidationReport(after, compileSpec(after)).errors.length === bad.report.errors.length,
    'the annotation changed no verdict');

  console.log('\n  names\n');
  check('each output is named after the workbook',
    outputNames.validation('report-spec.xlsx') === 'report-spec — validation.html' &&
    outputNames.annotated('report-spec.xlsx') === 'report-spec — validation.xlsx' &&
    outputNames.extraction('report-spec.xlsx') === 'report-spec — extraction.json' &&
    outputNames.spec('report-spec.xlsx') === 'report-spec — spec.json',
    outputNames.spec('report-spec.xlsx'));

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
