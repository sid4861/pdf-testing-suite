import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  allMarks, compileSpec, buildValidationReport, loadPdf, readSpecWorkbook, readTemplate,
  resultMarks, runSpec, splitRef, validationMarks,
  type SheetMark,
} from '@pdfsuite/spec/engine';

/**
 * W-46 DoD 2 — every mark lands on a cell the workbook actually has.
 *
 * The join between the spec engine and sheetpane is one list of `{sheet,
 * range}` pairs, and the failure it invites is silent: a mark whose sheet
 * is misspelled, or whose range was built for a different row, simply does
 * not appear. Nothing throws, the sheet looks clean, and a person concludes
 * their workbook is fine.
 *
 * So this reads the **real fixture** with the same reader the tab uses,
 * builds the marks from the real validation report and the real result, and
 * checks each one against the parsed grid: the sheet exists, and the cell is
 * inside it. It also pins the mapping itself — which severity each finding
 * becomes, and which layer it goes to — because that is what decides whether
 * a refusal shows up red or as a quiet tick.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '../../../work/samples/excel-spec-template-v2');

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};
const section = (t: string) => console.log(`\n  ${t}\n`);

const file = (name: string): File => {
  const bytes = fs.readFileSync(path.join(fixtures, name));
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
};

/** `"E15"` → `{ col: 4, row: 14 }`, 0-based, as the parsed grid is indexed. */
function cellAt(range: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/i.exec(range.split(':')[0]);
  if (!m) throw new Error(`not an A1 reference: ${range}`);
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

async function main() {
  console.log('\n  marks land on cells the workbook has (W-46)');

  // ── the parsed workbook, read exactly as the tab reads it ──────────
  const wb = await readSpecWorkbook(file('report-spec.xlsx'));
  const sheetNames = new Set(wb.sheets.map((s) => s.name));
  const grid = new Map(wb.sheets.map((s) => [s.name, s.text]));

  section('the fixture');
  check('the workbook reads', wb.sheets.length > 0, `${wb.sheets.length} sheets`);
  check('and names them', sheetNames.size === wb.sheets.length,
    [...sheetNames].join(', '));

  /** Does this mark point at a cell the parsed workbook actually has? */
  function lands(m: SheetMark): string | null {
    if (m.sheet === '' && m.range === '') return null;          // about the workbook
    if (!sheetNames.has(m.sheet)) return `no sheet "${m.sheet}"`;
    if (m.range === '') return null;                            // about the sheet
    const rows = grid.get(m.sheet)!;
    const { col, row } = cellAt(m.range);
    if (row >= rows.length) return `${m.sheet}!${m.range}: row past the end (${rows.length} rows)`;
    const widest = rows.reduce((w, r) => Math.max(w, r.length), 0);
    if (col >= widest) return `${m.sheet}!${m.range}: column past the end (${widest} columns)`;
    return null;
  }

  // ── validation marks, from the workbook with ten planted errors ────
  section('validation marks');

  const bad = await readSpecWorkbook(file('report-spec-with-errors.xlsx'));
  const badEx = readTemplate(bad);
  const validation = buildValidationReport(badEx, compileSpec(badEx));
  const vMarks = validationMarks(validation);

  check('every refused row became a mark',
    vMarks.filter((m) => m.severity === 'error').length === validation.errors.length,
    `${validation.errors.length} errors`);
  check('and they are all on the validation layer',
    vMarks.every((m) => m.layer === 'validation'));
  check('and attributed to the workbook, not to a person',
    vMarks.every((m) => m.author === 'workbook'));

  // The errors workbook is a different file, so check its marks against it.
  const badNames = new Set(bad.sheets.map((s) => s.name));
  const badGrid = new Map(bad.sheets.map((s) => [s.name, s.text]));
  const strays = vMarks.filter((m) => {
    if (m.sheet === '') return false;
    if (!badNames.has(m.sheet)) return true;
    if (m.range === '') return false;
    const rows = badGrid.get(m.sheet)!;
    const { col, row } = cellAt(m.range);
    return row >= rows.length || col >= rows.reduce((w, r) => Math.max(w, r.length), 0);
  });
  check('every validation mark lands on a cell the workbook has', strays.length === 0,
    strays.length ? strays.map((m) => `${m.sheet}!${m.range}`).join(', ') : `${vMarks.length} marks`);

  const withCell = vMarks.filter((m) => m.range !== '');
  check('and most of them name a cell, not just a sheet',
    withCell.length >= validation.errors.length,
    `${withCell.length} of ${vMarks.length}`);
  check('an info note is a quiet `note`, not an error',
    vMarks.filter((m) => m.severity === 'note').length === validation.info.length,
    `${validation.info.length} info`);

  // ── result marks, from a real check ────────────────────────────────
  section('result marks');

  const spec = compileSpec(readTemplate(wb));
  const pdf = await loadPdf(file('report.pdf'));
  const report = await runSpec(pdf, spec.spec);
  const rMarks = resultMarks(report);

  check('a check produces marks', rMarks.length > 0, `${rMarks.length} marks`);
  check('all on the pdf layer', rMarks.every((m) => m.layer === 'pdf'));

  const rStrays = rMarks.map(lands).filter(Boolean) as string[];
  check('every result mark lands on a cell the workbook has', rStrays.length === 0,
    rStrays.length ? rStrays.slice(0, 3).join(' · ') : `${rMarks.length} marks`);

  // One mark per check that names a cell — not one per element.
  const cellChecks = report.pages
    .flatMap((p) => p.elements)
    .flatMap((el) => el.checks)
    .filter((c) => c.cell && splitRef(c.cell));
  check('one mark per check that names a cell', rMarks.length === cellChecks.length,
    `${rMarks.length} marks, ${cellChecks.length} checks with cells`);

  check('a passing check is a quiet pass', rMarks.some((m) => m.severity === 'pass'));
  check('and it carries what the PDF measured',
    rMarks.filter((m) => m.severity === 'pass').every((m) => typeof m.found === 'string'));
  check('every mark carries the page and box the sheet needs to point at',
    rMarks.every((m) => m.meta != null && typeof m.meta.page === 'number'),
    `page ${rMarks[0]?.meta?.page}`);

  // ── the deviations PDF: failures must be errors ────────────────────
  section('the same spec against a PDF with planted deviations');

  const bentPdf = await loadPdf(file('report-with-deviations.pdf'));
  const bent = await runSpec(bentPdf, spec.spec);
  const bentMarks = resultMarks(bent);

  const failing = bent.pages.flatMap((p) => p.elements)
    .flatMap((el) => el.checks).filter((c) => c.cell && splitRef(c.cell) && !c.pass);
  check('every failed check is an error mark',
    bentMarks.filter((m) => m.severity === 'error').length === failing.length,
    `${failing.length} failed`);
  check('and the error names its cell and both values',
    bentMarks.filter((m) => m.severity === 'error').every(
      (m) => m.range !== '' && m.expected !== '' && m.found !== ''),
    bentMarks.find((m) => m.severity === 'error')
      ? `${bentMarks.find((m) => m.severity === 'error')!.sheet}!`
        + `${bentMarks.find((m) => m.severity === 'error')!.range}: `
        + `${bentMarks.find((m) => m.severity === 'error')!.expected} vs `
        + `${bentMarks.find((m) => m.severity === 'error')!.found}`
      : '');
  check('an unverifiable element is skipped, never a pass',
    bent.pages.flatMap((p) => p.elements).some((el) => el.status === 'unverifiable')
      ? bentMarks.some((m) => m.severity === 'skipped')
      : true);

  // ── ids and layers together ────────────────────────────────────────
  section('both layers in one pane');

  const both = allMarks(validation, bent);
  check('ids are unique across the two layers',
    new Set(both.map((m) => m.id)).size === both.length, `${both.length} marks`);
  check('and each layer is replaceable on its own',
    new Set(both.map((m) => m.layer)).size === 2);

  // A sheet reference without a sheet name must not be guessed at.
  check('a reference with no sheet is not invented', splitRef('E15') === null);
  check('a quoted sheet name survives', splitRef("'Pages List'!B2")?.sheet === 'Pages List');
  check('a range is kept whole', splitRef('1!A14:J14')?.range === 'A14:J14');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log(`  ${ok}/${checks.length} checks passed`);
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
