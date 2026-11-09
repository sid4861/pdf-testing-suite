import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, runSpec, loadPdf, canonical,
} from '@pdfsuite/spec/engine';

/**
 * W-04 DoD 4 — comparing (SR-SPEC-CHECK decisions 10–14).
 *
 * The four claims: wording is judged more strictly than it is located, a
 * tolerance means what the row's own unit says it means, every finding names
 * its cell, and the result says how much of the workbook it covered and which
 * pair of files it is about.
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

async function main() {
  const compiled = compileSpec(readTemplate(await readSpecWorkbook(f('report-spec.xlsx'))));
  const spec = compiled.spec;
  const report = await runSpec(await loadPdf(f('report.pdf')), spec, {
    coverage: compiled.counts,
    pdfName: 'report.pdf',
    pdfSha256: 'a'.repeat(64),
  });
  const all = report.pages.flatMap((p) => p.elements).flatMap((e) => e.checks);

  console.log('\n  decision 12 — every finding names its cell\n');

  const wantCell = all.filter((c) => !['Anchor', 'Readable'].includes(c.name));
  const withCell = wantCell.filter((c) => !!c.cell);
  for (const c of wantCell.filter((x) => !x.cell).slice(0, 5)) {
    console.log(`      no cell: ${c.name} — ${c.expected}`);
  }
  check('every check carries the cell it came from',
    withCell.length === wantCell.length, `${withCell.length} of ${wantCell.length}`);
  check('and the cell is a real reference',
    withCell.every((c) => /^.+![A-Z]+\d+$/.test(c.cell!)),
    withCell[0]?.cell);

  // A check and the element it belongs to must agree about where they came
  // from, or the cell is decoration.
  const first = report.pages[0].elements[0];
  const el = spec.pages[0].elements[0] as { source?: Record<string, { sheet: string; cell: string }> };
  const top = first.checks.find((c) => c.name === 'Top');
  check('a Top finding points at the Top row',
    !!top?.cell && top.cell === `${el.source!.top.sheet}!${el.source!.top.cell}`,
    top?.cell);

  console.log('\n  decision 10 — wording\n');

  const textChecks = all.filter((c) => c.name === 'Text');
  check('wording is reported as its own check', textChecks.length > 0,
    `${textChecks.length} text checks`);
  check('and on the matching PDF it passes', textChecks.every((c) => c.pass));
  const quiet = textChecks.filter((c) => !c.note);
  check('mostly as written, with no note needed', quiet.length > 0,
    `${quiet.length} of ${textChecks.length} matched literally`);
  for (const c of textChecks.filter((x) => x.note).slice(0, 4)) {
    console.log(`      noted: ${c.expected} — ${c.note}`);
  }

  // ®, ™ and superscripts are "always compared exactly", which means
  // normalisation must never fold them away on either side.
  check('®, ™ and superscripts survive normalisation',
    canonical('Acme® ™ x²') === 'Acme® ™ x²',
    canonical('Acme® ™ x²'));
  check('while quotes, dashes and odd spaces are folded',
    canonical('“a” — b c') === '"a" - b c',
    canonical('“a” — b c'));

  console.log('\n  decision 11 — the tolerance is in the row’s own unit\n');

  // The compiler is what converts, so it is what is tested: a 2 mm Tolerance
  // in a spec that compiled to inches must not become a 2 in band.
  const { compileSpec: compile } = await import('@pdfsuite/spec/engine');
  const ex = readTemplate(await readSpecWorkbook(f('report-spec.xlsx')));
  const mm = {
    ...ex,
    rows: ex.rows.map((r) =>
      r.sheet === '1' && r.parameter === 'Top' && r.row === 2
        ? { ...r, unit: 'mm', tolerance: '2' }
        : r),
  };
  const out = compile(mm);
  const firstEl = out.spec.pages[0].elements[0];
  const band = firstEl.tolerance?.position;
  check('a 2 mm tolerance is not 2 inches',
    band != null && Math.abs(band - 2 / 25.4) < 1e-9,
    `${band?.toFixed(4)} in (2 mm = ${(2 / 25.4).toFixed(4)} in)`);

  console.log('\n  decisions 13 and 14 — coverage, and the pair tested\n');

  check('the result carries coverage',
    report.coverage?.rows === compiled.counts.rows &&
    report.coverage?.checked === compiled.counts.checked,
    `${report.coverage?.checked} of ${report.coverage?.rows} rows checked`);
  check('the result names the workbook and its hash',
    report.pair?.workbook === 'report-spec.xlsx' && /^[0-9a-f]{64}$/.test(report.pair?.workbookSha256 ?? ''),
    report.pair?.workbookSha256?.slice(0, 12));
  check('and its template version', report.pair?.templateVersion === '2');
  check('and the PDF it was run against',
    report.pair?.pdfName === 'report.pdf' && report.pair?.pdfSha256 === 'a'.repeat(64));

  // A spec JSON has no workbook, and must not pretend otherwise.
  const plain = { ...spec, pages: spec.pages.map((p) => ({ page: p.page, elements: p.elements })) };
  delete (plain as { source?: unknown }).source;
  const bare = await runSpec(await loadPdf(f('report.pdf')), plain);
  check('a spec JSON with no workbook claims no coverage and no pair',
    bare.coverage === undefined && bare.pair === undefined);

  check('and the matching PDF still reports no failure', report.totalFail === 0,
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
