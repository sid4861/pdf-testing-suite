import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

import {
  INTAKE_CODES, annotateWorkbook, buildValidationReport, compileSpec, readSpecWorkbook,
  readTemplate, toValidationResult, validationJsonText, VALIDATION_SCHEMA,
} from '@pdfsuite/spec/engine';

/**
 * W-48 DoD 6 — the workbook with ten planted errors yields **exactly** the
 * ten lines `expected-validation.json` names, each with its code.
 *
 * This is the oracle, not a smoke test. The file was written before the
 * reader was, from SR-SPEC-INTAKE's decisions, and it fixes three things a
 * passing run would otherwise leave free: *which* cell each refusal lands
 * on, *which* code it carries, and that there are **no others**. The last
 * is the one that matters — a reader that refuses a row nobody meant it to
 * is worse than one that misses a row, because it blocks work that was
 * fine.
 *
 * The clean workbook is the other half: zero errors, zero warnings. A
 * validator that is strict and also wrong is just an obstacle.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = path.resolve(here, '../../../work/samples/excel-spec-template-v2');

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};
const section = (t: string) => console.log(`\n  ${t}\n`);

const file = (name: string): File => {
  const bytes = fs.readFileSync(path.join(fx, name));
  return {
    name, size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
};

interface Expected {
  schema: string;
  workbook: string;
  errors: { sheet: string; row: number; cell: string; code: string; severity: string }[];
  cleanWorkbook: { file: string; errors: number; warnings: number };
}

async function validate(name: string) {
  const wb = await readSpecWorkbook(file(name));
  const ex = readTemplate(wb);
  return toValidationResult(buildValidationReport(ex, compileSpec(ex)));
}

async function main() {
  console.log('\n  the validation oracle (W-48)');

  const expected = JSON.parse(
    fs.readFileSync(path.join(fx, 'expected-validation.json'), 'utf8'),
  ) as Expected;

  // ── the codes are a closed list, and the oracle only names codes in it ──
  section('the closed list');

  const known = new Set<string>(INTAKE_CODES);
  const strange = expected.errors.map((e) => e.code).filter((c) => !known.has(c));
  check('every code the oracle names is in the closed list', strange.length === 0,
    strange.length ? strange.join(', ') : `${INTAKE_CODES.length} codes`);

  // ── the workbook with ten planted errors ────────────────────────────
  section(`${expected.workbook} — ${expected.errors.length} planted errors`);

  const result = await validate(expected.workbook);
  const errors = result.lines.filter((l) => l.severity === 'error');

  check('the result says which workbook it is about', result.workbook.name === expected.workbook,
    result.workbook.name);
  check('and names its template version', result.workbook.templateVersion != null,
    String(result.workbook.templateVersion));
  check('and carries its hash', typeof result.workbook.sha256 === 'string',
    String(result.workbook.sha256).slice(0, 12));

  check(`exactly ${expected.errors.length} errors, no more`,
    errors.length === expected.errors.length, `${errors.length} found`);

  // Each expected line, by its cell — the identity a person uses.
  const found = new Map(errors.map((l) => [`${l.sheet}!${l.cell}`, l]));
  for (const want of expected.errors) {
    const at = `${want.sheet}!${want.cell}`;
    const got = found.get(at);
    check(`${at} is refused`, got != null);
    if (!got) continue;
    check(`  and its code is ${want.code}`, got.code === want.code,
      got.code === want.code ? '' : `got ${got.code ?? 'none'}`);
    check(`  and it names row ${want.row}`, got.row === want.row,
      got.row === want.row ? '' : `got row ${got.row}`);
  }

  // Nothing the oracle did not ask for.
  const unexpected = errors.filter((l) => !expected.errors
    .some((w) => w.sheet === l.sheet && w.cell === l.cell));
  check('and nothing else is refused', unexpected.length === 0,
    unexpected.map((l) => `${l.sheet}!${l.cell} ${l.code ?? ''}`).join(', '));

  // Every error carries a code: a refusal nothing can recognise is a string.
  const codeless = errors.filter((l) => !l.code);
  check('every error carries a code', codeless.length === 0,
    codeless.map((l) => `${l.sheet}!${l.cell}`).join(', '));

  // ── a refused row yields no assertion ───────────────────────────────
  section('a refused row is removed from the check');

  const assertionCells = new Set(result.assertions.map((a) => `${a.sheet}!${a.cell}`));
  const stillAsserted = expected.errors.filter((w) => assertionCells.has(`${w.sheet}!${w.cell}`));
  check('no refused row became an assertion', stillAsserted.length === 0,
    stillAsserted.map((w) => `${w.sheet}!${w.cell}`).join(', '));
  check('and the ones that were accepted are in plain words',
    result.assertions.length > 0 && result.assertions.every((a) => a.sentence.length > 0),
    `${result.assertions.length} assertions · e.g. "${result.assertions[0]?.sentence}"`);

  // ── the clean workbook ──────────────────────────────────────────────
  section(`${expected.cleanWorkbook.file} — nothing to refuse`);

  const clean = await validate(expected.cleanWorkbook.file);
  check('no errors', clean.totals.errors === expected.cleanWorkbook.errors,
    `${clean.totals.errors}`);
  check('no warnings', clean.totals.warnings === expected.cleanWorkbook.warnings,
    `${clean.totals.warnings}`);
  check('and it is not blocked', clean.blocking === false);
  check('every accepted row is explained', clean.assertions.length > 0,
    `${clean.assertions.length} assertions`);

  // ── the file the CLI writes ─────────────────────────────────────────
  section('validation.json');

  const text = validationJsonText(result);
  const parsed = JSON.parse(text) as { schema: string; lines: unknown[] };
  check('says which schema it is', parsed.schema === VALIDATION_SCHEMA, parsed.schema);
  check('and carries every line', Array.isArray(parsed.lines)
    && parsed.lines.length === result.lines.length, `${result.lines.length} lines`);
  check('and ends with a newline', text.endsWith('\n'));
  check('and is byte-stable: two builds of the same workbook agree',
    validationJsonText(await validate(expected.workbook)) === text);

  // ── the annotated workbook ───────────────────────────────
  //
  // It is *the uploaded file* with cells coloured, not a rebuilt one. A
  // rebuild would lose the author's formatting, their notes column and
  // their screenshots — most of what makes the workbook theirs — so the
  // check that matters is how much of the original zip comes through
  // untouched.
  section('the annotated workbook');

  const originalBytes = fs.readFileSync(path.join(fx, expected.workbook));
  const wb2 = await readSpecWorkbook(file(expected.workbook));
  const ex2 = readTemplate(wb2);
  const report2 = buildValidationReport(ex2, compileSpec(ex2));
  const annotated = await annotateWorkbook(wb2.bytes, report2);

  check('it produces a workbook', annotated.byteLength > 0,
    `${annotated.byteLength} bytes from ${originalBytes.byteLength}`);

  const before = await JSZip.loadAsync(originalBytes);
  const after = await JSZip.loadAsync(annotated);
  const beforeNames = Object.keys(before.files).filter((n) => !before.files[n].dir).sort();
  const afterNames = Object.keys(after.files).filter((n) => !after.files[n].dir).sort();

  check('every part of the original is still there',
    beforeNames.every((n) => afterNames.includes(n)),
    `${beforeNames.length} → ${afterNames.length} parts`);

  const added = afterNames.filter((n) => !beforeNames.includes(n));
  check('and what it added is sheet XML, nothing else',
    added.every((n) => n.startsWith('xl/worksheets/')), added.join(', ') || 'nothing');

  // Which parts changed, by content. The fewer the better, and each one
  // should be explainable in a sentence.
  const changed: string[] = [];
  for (const name of beforeNames) {
    const a = await before.files[name].async('uint8array');
    const b = await after.files[name].async('uint8array');
    if (a.length !== b.length || !a.every((v, i) => v === b[i])) changed.push(name);
  }
  // Every part it rewrites must be explainable in a sentence. The four
  // plumbing parts carry the new sheet and the red fill; the rest must be
  // worksheet XML, and exactly as many worksheets as have an error on
  // them — a sheet with nothing wrong on it has no reason to change.
  const plumbing = ['[Content_Types].xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml'];
  check('the parts it rewrote are the four it must, plus worksheets',
    changed.every((n) => plumbing.includes(n) || /^xl\/worksheets\/sheet\d+\.xml$/.test(n)),
    changed.filter((n) => !plumbing.includes(n) && !/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).join(', ')
      || `${changed.length} parts`);
  const sheetsWithErrors = new Set(expected.errors.map((e) => e.sheet));
  check('and it touched only the sheets that have an error on them',
    changed.filter((n) => n.startsWith('xl/worksheets/')).length === sheetsWithErrors.size,
    `${changed.filter((n) => n.startsWith('xl/worksheets/')).length} worksheets rewritten, `
      + `${sheetsWithErrors.size} sheets carry errors`);
  check('and the author\'s own data parts are byte-identical',
    !changed.some((n) => n.startsWith('xl/media/') || n === 'docProps/core.xml'),
    changed.filter((n) => n.startsWith('xl/media/')).join(', ') || 'media untouched');

  const sheetNames = await after.files['xl/workbook.xml'].async('string');
  check('a Validation sheet was added', /Validation/i.test(sheetNames));

  // It must still read as a workbook — and as the *same* workbook.
  const reread = await readSpecWorkbook({
    name: 'annotated.xlsx', size: annotated.byteLength,
    arrayBuffer: async () => annotated.buffer.slice(
      annotated.byteOffset, annotated.byteOffset + annotated.byteLength),
  } as unknown as File);
  check('and the annotated file still reads', reread.sheets.length > 0,
    `${reread.sheets.length} sheets`);
  const rr = toValidationResult(buildValidationReport(readTemplate(reread), compileSpec(readTemplate(reread))));
  check('with the same ten errors — annotating changed no value',
    rr.lines.filter((l) => l.severity === 'error').length === expected.errors.length,
    `${rr.lines.filter((l) => l.severity === 'error').length}`);

  // ── the CLI writes the same two files ──────────────────────
  section('pdfsuite spec --validate-only --out');

  const dist = path.resolve(here, '../dist/index.js');
  const out = path.resolve(here, '../.work/oracle-validate');
  fs.rmSync(out, { recursive: true, force: true });

  const run = (name: string, dir: string) => spawnSync(process.execPath, [
    dist, 'spec', path.join(fx, name), '--validate-only', '--out', dir,
  ], { encoding: 'utf8' });

  const bad = run(expected.workbook, path.join(out, 'bad'));
  check('a workbook with errors exits 2', bad.status === 2, `exit ${bad.status}`);
  check('and writes validation.json', fs.existsSync(path.join(out, 'bad/validation.json')));
  check('and the annotated workbook beside it',
    fs.existsSync(path.join(out, 'bad/report-spec-with-errors.annotated.xlsx')));
  check('and prints the counts line',
    /\d+ errors? · \d+ warnings? · \d+ notes? —/.test(bad.stdout),
    bad.stdout.split('\n').find((l) => l.includes('will be checked'))?.trim());

  const cliResult = JSON.parse(
    fs.readFileSync(path.join(out, 'bad/validation.json'), 'utf8'),
  ) as { lines: { cell: string; code?: string }[] };
  check('the CLI\'s lines are the engine\'s lines — one function, two surfaces (L3)',
    JSON.stringify(cliResult.lines) === JSON.stringify(JSON.parse(validationJsonText(result)).lines),
    `${cliResult.lines.length} lines`);

  const good = run(expected.cleanWorkbook.file, path.join(out, 'good'));
  check('a clean workbook exits 0', good.status === 0, `exit ${good.status}`);
  check('and still writes its report — a clean run is worth keeping',
    fs.existsSync(path.join(out, 'good/validation.json')));

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log(`  ${ok}/${checks.length} checks passed`);
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
