import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec,
  buildValidationReport, coverageLine,
} from '@pdfsuite/spec/engine';

/**
 * W-02 DoD 6 — the validation report (SR-SPEC-INTAKE decisions 13 and 14).
 *
 * Two claims are worth testing and one is not. Worth testing: the three
 * severities separate as decision 13 says, and every line of the report names
 * the cell a person would go and edit. Not worth testing: how it looks.
 *
 * The assertions-in-words are checked against the *clean* fixture, because
 * their only purpose is to be read back against the workbook — a sentence
 * nobody can trace to a cell is worse than no sentence.
 */

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

async function reportFor(name: string) {
  const ex = readTemplate(await readSpecWorkbook(f(name)));
  return buildValidationReport(ex, compileSpec(ex));
}

async function main() {
  console.log('\n  the clean workbook\n');
  const clean = await reportFor('report-spec.xlsx');

  console.log('      ' + coverageLine(clean.counts) + '  ' + JSON.stringify(clean.counts));
  console.log('      errors ' + clean.errors.length + ' · warnings ' + clean.warnings.length +
    ' · info ' + clean.info.length + ' · assertions ' + clean.assertions.length);

  check('it reads with no error', clean.errors.length === 0);
  check('so nothing blocks the run', clean.blocking === false);
  check('the coverage line counts every row', /of \d+ rows checked$/.test(coverageLine(clean.counts)),
    coverageLine(clean.counts));
  check('it names the workbook and its SHA-256',
    clean.workbook === 'report-spec.xlsx' && !!clean.sha256);
  check('and the template version it was read as', clean.templateVersion === '2');

  console.log('\n  decision 14 — the assertions in words\n');
  for (const a of clean.assertions.slice(0, 6)) {
    console.log('      ' + (a.sheet ?? '?') + '!' + (a.cell ?? '?') +
      '  p' + a.page + '  ' + a.element + ': ' + a.sentence);
  }

  check('every assertion is said in words', clean.assertions.length > 0,
    `${clean.assertions.length} lines`);
  check('and every line names its own cell',
    clean.assertions.every((a) => !!a.sheet && !!a.cell),
    `${clean.assertions.filter((a) => a.cell).length}/${clean.assertions.length}`);
  check('a position reads as the record writes it',
    clean.assertions.some((a) => /top edge [\d.]+ in from the top of the page, ± [\d.]+ in/.test(a.sentence)),
    clean.assertions.find((a) => a.sentence.startsWith('top edge'))?.sentence ?? '');
  check('wording is quoted, not paraphrased',
    clean.assertions.some((a) => /^(contains|reads exactly) "/.test(a.sentence)));
  check('a font assertion says the family',
    clean.assertions.some((a) => /^set in \D/.test(a.sentence)),
    clean.assertions.find((a) => /^set in \D/.test(a.sentence))?.sentence ?? '');
  check('a colour assertion says the hex',
    clean.assertions.some((a) => /^painted #[0-9A-F]{6}$/.test(a.sentence)),
    clean.assertions.find((a) => a.sentence.startsWith('painted'))?.sentence ?? '');
  check('a size assertion says both sides',
    clean.assertions.some((a) => / wide and .* high/.test(a.sentence)),
    clean.assertions.find((a) => / wide and /.test(a.sentence))?.sentence ?? '');

  console.log('\n  the workbook with planted errors\n');
  const bad = await reportFor('report-spec-with-errors.xlsx');
  console.log('      ' + coverageLine(bad.counts) + '  ' + JSON.stringify(bad.counts));
  for (const e of bad.errors) {
    console.log('      ERROR ' + (e.sheet ?? 'the file') + '!' + (e.cell ?? '-') + '  ' + e.message);
  }

  const expected = JSON.parse(
    fs.readFileSync(path.join(fixture, 'expected-validation.json'), 'utf8'),
  ) as { errors: { sheet: string; cell: string }[] };

  check('it reports an error for every planted one',
    bad.errors.length === expected.errors.length,
    `${bad.errors.length} reported, ${expected.errors.length} planted`);
  check('every error names a sheet and a cell',
    bad.errors.every((e) => !!e.sheet && !!e.cell),
    `${bad.errors.filter((e) => e.sheet && e.cell).length}/${bad.errors.length}`);

  // Decision 13 draws the line at what the error is about: an element-level
  // error removes that element, it does not stop the run.
  check('element-level errors do not stop the run', bad.blocking === false);
  check('and the rest of the workbook still compiles', bad.counts.checked > 0,
    `${coverageLine(bad.counts)}`);
  check('a refused row yields no assertion',
    bad.assertions.length < clean.assertions.length,
    `${bad.assertions.length} vs the clean workbook’s ${clean.assertions.length}`);

  console.log('\n  severities separate\n');
  const all = [...bad.errors, ...bad.warnings, ...bad.info];
  check('no note is filed under two severities',
    new Set(all.map((n) => `${n.severity}|${n.sheet}|${n.cell}|${n.message}`)).size === all.length);
  check('warnings are reported, not folded into errors',
    bad.warnings.every((n) => n.severity === 'warning'));

  // Decision 13's third severity goes to coverage rather than to the note
  // list, so that is where it is checked: a row with no check yet must still
  // say which row it was and why, or coverage is just a number.
  const rest = bad.coverage.filter((c) => c.status !== 'checked');
  check('every unchecked row says which row and why',
    rest.length > 0 && rest.every((c) => !!c.sheet && c.row > 0 && !!c.reason),
    `${rest.length} rows`);
  check('coverage accounts for every spec row',
    bad.coverage.length === bad.counts.rows,
    `${bad.coverage.length} of ${bad.counts.rows}`);
  console.log('      e.g. ' + rest[0].sheet + '!' + rest[0].row + '  ' +
    rest[0].parameter + ' — ' + rest[0].reason);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
