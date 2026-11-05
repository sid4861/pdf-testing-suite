import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSpecWorkbook, readTemplate } from '../../src/features/spec/engine';

/**
 * W-02 DoD 3 — Template v2 reads, and the planted errors are found exactly.
 *
 * `expected-validation.json` is the oracle (SR-SPEC-INTAKE decision 16): the
 * clean workbook must produce no error and no warning, and the with-errors
 * workbook must produce its ten errors and nothing else. A parser change that
 * alters either fails here, which is the point — a validator that drifts is
 * worse than none, because people stop reading it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../work/samples/excel-spec-template-v2');

const load = async (name: string) => {
  const b = fs.readFileSync(path.join(fixture, name));
  return readSpecWorkbook({
    name,
    size: b.byteLength,
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File);
};

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

async function main() {
  console.log('\n  the clean workbook\n');

  const clean = readTemplate(await load('report-spec.xlsx'));
  const cleanErrors = clean.notes.filter((n) => n.severity === 'error');
  const cleanWarnings = clean.notes.filter((n) => n.severity === 'warning');

  check('no error', cleanErrors.length === 0, cleanErrors.map((n) => `${n.sheet}!${n.cell} ${n.message}`).join(' | '));
  check('no warning', cleanWarnings.length === 0, cleanWarnings.map((n) => `${n.sheet}!${n.cell}`).join(' '));
  check('the four pages are read', clean.pages.length === 4, clean.pages.map((p) => p.tab).join(', '));
  check('all 290 parameter rows are read', clean.rows.length === 290, `${clean.rows.length} rows`);
  check('every row is usable', clean.rows.every((r) => r.usable));

  // Decision 7 — merged labels are read from the declared range, never
  // forward-filled. Row 3 of sheet 1 has a blank Element covered by A2:A6.
  const row3 = clean.rows.find((r) => r.sheet === '1' && r.row === 3)!;
  check('a merged Element reaches the rows it covers', row3.element === 'Cover artwork', row3.element);
  check('and so does Group', row3.group === 'Position', row3.group);

  console.log('\n  Settings and Lists\n');
  check('the template version is read', clean.settings.templateVersion === '2');
  check('tolerances are read', clean.settings.positionTolerance === 0.06 && clean.settings.fontSizeTolerance === 2);
  check('the page size is read', clean.settings.pageWidth === 11 && clean.settings.pageHeight === 8.5);
  check('Pixels per inch is blank, so px is an error', clean.settings.pixelsPerInch === null);
  check('the parameter vocabulary is read', clean.vocabulary.parameters.size === 40, `${clean.vocabulary.parameters.size} parameters`);
  check('named colours are read', clean.vocabulary.colours.get('cloud grey') === '#EEF1F4');
  check('Check? values are read', clean.vocabulary.checks.join(',') === 'Yes,Note,No');

  console.log('\n  the workbook with ten planted errors\n');

  const dirty = readTemplate(await load('report-spec-with-errors.xlsx'));
  const expected: { sheet: string; cell: string; code: string }[] =
    JSON.parse(fs.readFileSync(path.join(fixture, 'expected-validation.json'), 'utf8')).errors;

  const got = dirty.notes.filter((n) => n.severity === 'error').map((n) => `${n.sheet}!${n.cell}`);
  const want = expected.map((e) => `${e.sheet}!${e.cell}`);
  const missed = want.filter((c) => !got.includes(c));
  const extra = got.filter((c) => !want.includes(c));

  for (const e of expected) {
    const found = got.includes(`${e.sheet}!${e.cell}`);
    check(`${e.code} at ${e.sheet}!${e.cell}`, found);
  }
  check('nothing is reported that the oracle does not list', extra.length === 0, extra.join(' '));
  check('one message per defect, not several', got.length === new Set(got).size,
    got.length === new Set(got).size ? '' : 'a cell is reported twice');
  check('every planted error is found', missed.length === 0, missed.join(' '));

  // A row that failed validation yields no assertion (decision 13).
  const badRows = dirty.rows.filter((r) => !r.usable);
  check('failed rows are kept and marked unusable, not dropped', badRows.length > 0,
    `${badRows.length} rows marked`);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
