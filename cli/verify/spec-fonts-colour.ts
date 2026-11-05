import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, runSpec, loadPdf,
  parseFontName, compareFont, parseHex, toHex, deltaE2000,
} from '../../src/features/spec/engine';

/**
 * W-04 DoD 3 — fonts (SR-SPEC-CHECK decision 7) and colour (decision 8).
 *
 * The pure parts are checked directly; the reading is checked against the
 * fixture, because the only thing that proves a colour was read correctly is
 * that the *correct* PDF agrees with its own spec.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../work/samples/excel-spec-template-v2');
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
  console.log('\n  decision 7 — font names\n');

  // The three spellings the record names must all be one font.
  const spellings = ['Roboto-Light', 'Roboto Light', 'RobotoLight'].map(parseFontName);
  check('the three spellings give one family',
    new Set(spellings.map((s) => s.family)).size === 1, spellings[0].family);
  check('and all read as weight 300', spellings.every((s) => s.weight === 300));

  check('a subset prefix is stripped', parseFontName('BCDEEE+Roboto-Bold').family === 'roboto');
  check('weight words map to numbers',
    parseFontName('Inter Semibold').weight === 600 && parseFontName('Inter Black').weight === 900);
  check('italic is read from the name', parseFontName('Georgia-Italic').italic === true);
  check('a bare family is Regular',
    compareFont('Helvetica', 'Helvetica').verdict === 'match');

  check('a wrong family fails',
    compareFont('Helvetica', 'Times-Roman').verdict === 'wrong-family');
  check('a wrong slant fails',
    compareFont('Helvetica', 'Helvetica-Oblique').verdict === 'wrong-style');
  check('a neighbouring weight is near, not wrong',
    compareFont('Inter Regular', 'Inter Medium').verdict === 'near-weight');
  check('two steps of weight is wrong',
    compareFont('Inter Regular', 'Inter Bold').verdict === 'wrong-weight');
  check('an explicit Bold row beats the family string',
    compareFont('Helvetica', 'Helvetica-Bold', { bold: true }).verdict === 'match');

  console.log('\n  decision 8 — colour by ΔE\n');

  check('hex parses, long and short', toHex(parseHex('#0B3C5D')!) === '#0B3C5D' && toHex(parseHex('#abc')!) === '#AABBCC');
  check('a colour equals itself', deltaE2000(parseHex('#0B3C5D')!, parseHex('#0B3C5D')!) === 0);

  // One digit apart is invisible; the record's threshold is 2.0.
  const hair = deltaE2000(parseHex('#0B3C5D')!, parseHex('#0B3C5E')!);
  check('one digit apart is below the threshold', hair < 2, `ΔE ${hair.toFixed(2)}`);

  // The fixture's own planted colour deviation: Cloud Grey vs the wrong grey.
  const planted = deltaE2000(parseHex('#EEF1F4')!, parseHex('#E4E9F2')!);
  check('the fixture’s planted colour change is above it', planted > 2, `ΔE ${planted.toFixed(2)}`);

  // CIEDE2000 must beat plain RGB distance where it matters: two colours the
  // same RGB distance apart are not equally visible.
  const blues = deltaE2000({ r: 0, g: 0, b: 180 }, { r: 0, g: 0, b: 200 });
  const greys = deltaE2000({ r: 180, g: 180, b: 180 }, { r: 200, g: 200, b: 200 });
  check('it is perceptual, not arithmetic', Math.abs(blues - greys) > 0.5,
    `same RGB gap: blues ΔE ${blues.toFixed(2)}, greys ΔE ${greys.toFixed(2)}`);

  console.log('\n  read from the fixture\n');

  const { spec } = compileSpec(readTemplate(await readSpecWorkbook(f('report-spec.xlsx'))));
  const elements = spec.pages.flatMap((p) => p.elements) as { font?: string; colour?: string }[];
  const withFont = elements.filter((e) => e.font).length;
  const withColour = elements.filter((e) => e.colour).length;
  check('font assertions were compiled', withFont > 0, `${withFont} elements`);
  check('colour assertions were compiled', withColour > 0, `${withColour} elements`);

  const good = await runSpec(await loadPdf(f('report.pdf')), spec);
  const failing = good.pages.flatMap((p) =>
    p.elements.filter((e) => e.status === 'fail' || e.status === 'not-found'),
  );
  for (const e of failing) {
    console.log('      ' + e.label + ' — ' +
      e.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.expected} vs ${c.actual}`).join('; '));
  }
  check('the matching PDF still reports no failure', failing.length === 0,
    'fonts and colours did not introduce a false failure');

  // The real proof that the reading is right: every font and colour check on
  // the correct document passes, rather than coming back unknown.
  const all = good.pages.flatMap((p) => p.elements).flatMap((e) => e.checks);
  const fontChecks = all.filter((c) => c.name === 'Font');
  const colourChecks = all.filter((c) => c.name === 'Colour');
  check('every font was read and matched', fontChecks.length > 0 && fontChecks.every((c) => c.pass),
    `${fontChecks.filter((c) => c.pass).length}/${fontChecks.length}`);
  check('every colour was read and matched', colourChecks.length > 0 && colourChecks.every((c) => c.pass),
    `${colourChecks.filter((c) => c.pass).length}/${colourChecks.length}`);
  check('a colour check reports the actual value beside the expected',
    colourChecks.every((c) => /^#[0-9A-F]{6}$/.test(String(c.actual))),
    colourChecks[0] ? `e.g. expected ${colourChecks[0].expected}, actual ${colourChecks[0].actual}` : '');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
