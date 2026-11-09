import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The feature's headless barrel — never a file inside the folder.
import {
  readSpecWorkbook,
  uploadKind,
  SpecIntakeError,
} from '@pdfsuite/spec/engine';

/**
 * W-02 DoD 1 and 2 — what the spec upload accepts, and what it says about
 * everything it did not read.
 *
 * Run against the committed fictional fixtures. The reader is
 * `@sheetpane/import`, so this also proves it works under Node, which is what
 * `pdfsuite spec` will need (W-11).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../../work/samples/excel-spec-template-v2');

/** A File-alike, as the browser would hand one over. */
const f = (p: string, name = path.basename(p)): File => {
  const b = fs.readFileSync(p);
  return {
    name,
    size: b.byteLength,
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    slice: () => { throw new Error('not needed'); },
  } as unknown as File;
};

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

/** The message a refusal gives, or null when it was not refused. */
function refusal(fn: () => unknown): { code: string; message: string } | null {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof SpecIntakeError) return { code: e.code, message: e.message };
    throw e;
  }
}

async function main() {
  console.log('\n  DoD 1 — what the upload accepts\n');

  check('.xlsx is accepted', uploadKind('report-spec.xlsx') === 'xlsx');
  check('.json is accepted', uploadKind('spec.json') === 'json');

  // Each near-miss gets its own way out, not one shared "unsupported".
  for (const [name, code] of [['old.xls', 'xls'], ['macros.xlsm', 'xlsm'], ['sheet.csv', 'csv']] as const) {
    const r = refusal(() => uploadKind(name));
    check(`${name} is refused as ${code}`, r?.code === code, r?.message.slice(0, 64));
  }
  const odd = refusal(() => uploadKind('notes.txt'));
  check('an unrelated file is refused', odd?.code === 'unsupported');

  const messages = new Set(
    ['old.xls', 'macros.xlsm', 'sheet.csv'].map((n) => refusal(() => uploadKind(n))!.message),
  );
  check('the three near-misses each say something different', messages.size === 3);

  console.log('\n  DoD 2 — reading the workbook\n');

  const clean = await readSpecWorkbook(f(path.join(fixture, 'report-spec.xlsx')));
  check('the fixture reads', clean.sheets.length > 0, `${clean.sheets.length} visible sheets`);
  check(
    'every Template v2 sheet is there',
    ['Pages List', 'Settings', 'Lists', '1', '2', '3', '4'].every((n) =>
      clean.sheets.some((s) => s.name === n),
    ),
    clean.sheets.map((s) => s.name).join(', '),
  );
  check('the file hash is recorded', !!clean.sha256 && clean.sha256.length === 64, clean.sha256 ?? 'none');

  const errs = clean.notes.filter((n) => n.severity === 'error');
  check('the clean fixture reads with no intake error', errs.length === 0,
    errs.map((n) => n.message).join(' | '));

  // The reader must give back cells, not just a grid of strings.
  const pages = clean.sheets.find((s) => s.name === 'Pages List')!;
  check('cells carry display text', (pages.text?.[0]?.[0] ?? '') !== '', JSON.stringify(pages.text?.[0]?.slice(0, 4)));
  check('merges are declared, not guessed', Array.isArray((pages as { merges?: unknown[] }).merges));

  const sheet1 = clean.sheets.find((s) => s.name === '1')!;
  check('rich-text runs are available', typeof sheet1.runs === 'object');
  check('style indexes are available', typeof sheet1.styleIndex === 'object');

  console.log('\n  DoD 2 — refusals from the reader\n');

  // A .xlsx name over bytes that are not a workbook.
  const notAWorkbook = await (async () => {
    const tmp = path.join(fixture, '..', '__not-a-workbook.xlsx');
    fs.writeFileSync(tmp, 'this is not a zip at all');
    try {
      await readSpecWorkbook(f(tmp));
      return null;
    } catch (e) {
      return e instanceof SpecIntakeError ? e : null;
    } finally {
      fs.unlinkSync(tmp);
    }
  })();
  check('bytes that are not a workbook are refused',
    notAWorkbook != null && ['not-workbook', 'corrupt'].includes(notAWorkbook.code),
    notAWorkbook?.message.slice(0, 60));

  const errorsBook = await readSpecWorkbook(f(path.join(fixture, 'report-spec-with-errors.xlsx')));
  check('the with-errors fixture still reads', errorsBook.sheets.length > 0,
    'intake reads it; the ten planted errors are DoD 6 validation, not intake');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
