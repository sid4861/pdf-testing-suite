import '../src/platform/dom-shim.js';
import {
  writeBlankTemplate, readSpecWorkbook, readTemplate, compileSpec, buildValidationReport,
} from '@pdfsuite/spec/engine';

/**
 * W-02 DoD 3's last clause — the blank Template v2 workbook.
 *
 * The claim is narrow and worth holding: the thing people start a spec from
 * must read, on the first try, through the same reader that will judge their
 * finished workbook. A starter that reports errors teaches people that errors
 * are normal.
 *
 * And it must assert nothing. Its example rows are a shape to copy, marked
 * `Check? = Note`, so a template that is uploaded before anyone has edited it
 * cannot quietly test somebody else's placeholder values.
 */

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

const asFile = (name: string, bytes: Uint8Array): File => ({
  name, size: bytes.byteLength,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
} as unknown as File);

async function main() {
  console.log('\n  the blank Template v2 workbook\n');

  const bytes = await writeBlankTemplate();
  check('it is written', bytes.byteLength > 0, `${Math.round(bytes.byteLength / 1024)} KB`);

  const book = await readSpecWorkbook(asFile('Template v2 — blank.xlsx', bytes));
  check('and the reader accepts it as a workbook', book.workbook.source === 'xlsx',
    book.workbook.sheets.map((s) => s.name).join(', '));
  check('with the three sheets a v2 workbook needs, and one page sheet',
    ['Pages List', 'Settings', 'Lists'].every((n) => book.workbook.sheets.some((s) => s.name === n))
      && book.workbook.sheets.length === 4);

  const extraction = readTemplate(book);
  const compiled = compileSpec(extraction);
  const report = buildValidationReport(extraction, compiled);

  for (const n of [...report.errors, ...report.warnings]) {
    console.log(`      ${n.severity}: ${n.sheet ?? 'the file'}!${n.cell ?? ''} ${n.message}`);
  }
  check('it reads with no error at all', report.errors.length === 0,
    `${report.errors.length} errors`);
  check('and nothing blocks a run', report.blocking === false);

  // The one warning is the thing the author has to supply, which is the point
  // of a starter: it says what to fill in rather than failing.
  check('its only warning is the identifying text left for the author',
    report.warnings.length === 1 && /identifying text/.test(report.warnings[0].message),
    report.warnings[0]?.message);

  check('the Pages List names a page, and the sheet for it exists',
    extraction.pages.length === 1
      && book.workbook.sheets.some((s) => s.name === extraction.pages[0].tab),
    `${extraction.pages[0]?.tab} → ${extraction.pages[0]?.name}`);

  check('the Lists sheet carries the vocabulary the reader checks against',
    extraction.vocabulary.parameters.size > 15 && extraction.vocabulary.units.length > 3,
    `${extraction.vocabulary.parameters.size} parameters · ${extraction.vocabulary.units.join(' ')}`);

  console.log('');
  check('it asserts nothing until someone edits it',
    compiled.spec.pages.every((p) => p.elements.length === 0) && compiled.counts.checked === 0,
    `${compiled.counts.checked} checked · ${compiled.counts.noted} noted`);
  check('and its example rows are there to copy, not to run',
    compiled.counts.noted === extraction.rows.length && extraction.rows.length > 0,
    `${extraction.rows.length} example rows, all Check? = Note`);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
