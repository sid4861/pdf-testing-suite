import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { fileFromPath, loadPdf, resultJsonText, sha256 } from '../src/platform/engine.js';
import { buildInspectResultJson, inspectCore, inspectPage } from '@pdfsuite/core';
import { renderElements } from '@pdfsuite/core';

import { FORM_IMAGE_EXPECTED, formXObjectFile } from './fixtures-form-xobject.js';

/**
 * W-28 DoD 5 — the Inspect tab's numbers and `pdfsuite inspect`'s are the
 * same numbers.
 *
 * The CLI is run as a **process**, and the same page is measured the way the
 * tab measures it: `renderElements` into `inspectPage`, which is literally
 * the pair of calls `MeasureView.tsx` makes. The two documents are then
 * compared byte for byte apart from `run`, `tool` and `env` — the clock, and
 * the two fields that exist *because* a browser and a command line differ.
 *
 * Why this test is worth its runtime: before W-28 the measurement half lived
 * in JSX, so there was nothing for the CLI to call and nothing to compare.
 * The failure it guards against is not a crash, it is two plausible answers
 * to "how far is this from the left edge" — the kind of divergence nobody
 * notices until two people disagree in a meeting.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '..');
const dist = path.join(cli, 'dist/index.js');
const work = path.join(cli, '.work/inspect-parity');

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

/** Everything but the three blocks that are allowed to differ. */
const withoutRun = (json: Record<string, unknown>) =>
  JSON.stringify({ ...json, run: null, tool: null, env: null }, null, 2);

async function main() {
  console.log('\n  one page, both ways\n');

  const file = path.join(cli, 'fixtures/golden/invoice-original.pdf');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  // ── the CLI, as a process ──
  const run = spawnSync(process.execPath, [
    dist, 'inspect', file, '--page', '1', '--out', path.join(work, 'out'),
  ], { encoding: 'utf8', cwd: cli });

  const fromCli = path.join(work, 'out/result.json');
  check('the command writes result.json', fs.existsSync(fromCli), `exit ${run.status}`);
  check('and manifest.json beside it', fs.existsSync(path.join(work, 'out/manifest.json')));
  check('and report.html, the third file', fs.existsSync(path.join(work, 'out/report.html')));
  if (!fs.existsSync(fromCli)) {
    console.error(run.stdout, run.stderr);
    process.exit(1);
  }

  // ── the tab's path: renderElements → inspectPage, as MeasureView does ──
  const pdf = await loadPdf(fileFromPath(file));
  const page = await renderElements(pdf, 0);
  const measured = inspectPage(page, 0);
  const bytes = fs.readFileSync(file);
  const appSide = await buildInspectResultJson([measured], {
    file: {
      name: path.basename(file),
      bytes: bytes.byteLength,
      sha256: (await sha256(bytes)) ?? null,
    },
    pagesRequested: [1],
  });

  const cliJson = JSON.parse(fs.readFileSync(fromCli, 'utf8')) as Record<string, unknown>;
  const appJson = JSON.parse(resultJsonText(appSide)) as Record<string, unknown>;

  console.log('');
  check('both say which schema and kind they are',
    cliJson.schema === appJson.schema && cliJson.kind === appJson.kind,
    `${String(cliJson.schema)} · ${String(cliJson.kind)}`);

  const a = withoutRun(appJson);
  const b = withoutRun(cliJson);
  if (a !== b) {
    const x = a.split('\n');
    const y = b.split('\n');
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if (x[i] !== y[i]) {
        console.log(`      line ${i + 1}: tab ${JSON.stringify(x[i] ?? null)}`);
        console.log(`               cli ${JSON.stringify(y[i] ?? null)}`);
        break;
      }
    }
  }
  check('the two documents are identical outside `run`', a === b,
    a === b ? `${a.split('\n').length} lines` : 'see the first difference above');

  check('and the findings hash agrees',
    cliJson.findingsSha256 === appJson.findingsSha256,
    String(appJson.findingsSha256).slice(0, 12));

  // ── the units the record fixes, read back off the file ──
  console.log('\n  what the file says about its own numbers\n');

  const policy = cliJson.policy as { units?: Record<string, string>; origin?: string };
  check('it records that positions are inches and sizes points',
    policy.units?.positions === 'inches' && policy.units?.fontSizes === 'points',
    `${policy.units?.positions} · ${policy.units?.fontSizes}`);
  check('and which corner the distances run from', policy.origin === 'page top-left',
    String(policy.origin));

  const pages = cliJson.pages as {
    page: number; widthIn: number; heightIn: number; hasTextLayer: boolean;
    elements: {
      id: string; kind: string; label: string;
      box: Record<string, number>;
      font?: { name: string | null; sizePt: number; weight: string; style: string };
      lineHeight?: { pt: number; ratio: number; neighbourId: string } | null;
    }[];
  }[];
  check('one page was asked for and one reported', pages.length === 1, `page ${pages[0]?.page}`);

  const first = pages[0];
  check('the page size is US Letter, to the hundredth',
    Math.abs(first.widthIn - 8.5) < 0.01 && Math.abs(first.heightIn - 11) < 0.01,
    `${first.widthIn}″ × ${first.heightIn}″`);
  check('the page has a text layer, and says so', first.hasTextLayer === true);

  // ── the four distances must agree with the page, not just with each other ──
  const el = first.elements.find((e) => e.label === 'INVOICE');
  check('the heading was found', el != null, el?.label);
  if (el) {
    const b = el.box;
    const widthSum = b.fromLeftIn + b.widthIn + b.fromRightIn;
    const heightSum = b.fromTopIn + b.heightIn + b.fromBottomIn;
    // This is the arithmetic a reader will do on the page, and the one a
    // mirrored-axis bug breaks: left + width + right must be the page.
    check('left + width + right is the page width',
      Math.abs(widthSum - first.widthIn) < 0.01, `${widthSum.toFixed(4)}″`);
    check('top + height + bottom is the page height',
      Math.abs(heightSum - first.heightIn) < 0.01, `${heightSum.toFixed(4)}″`);
    check('the font is named, with its size in points',
      el.font?.name === 'Helvetica-Bold' && el.font.sizePt > 20,
      `${el.font?.name} ${el.font?.sizePt} pt`);
    check('and its weight is read off that name, not assumed',
      el.font?.weight === 'bold', String(el.font?.weight));
    check('line height points at the element it measured to',
      el.lineHeight != null
        && first.elements.some((o) => o.id === el.lineHeight!.neighbourId),
      el.lineHeight ? `${el.lineHeight.pt} pt → ${el.lineHeight.neighbourId}` : 'none');
  }

  // ── two runs of the same file produce the same bytes ──
  const again = spawnSync(process.execPath, [
    dist, 'inspect', file, '--page', '1', '--out', path.join(work, 'out2'),
  ], { encoding: 'utf8', cwd: cli });
  const second = JSON.parse(
    fs.readFileSync(path.join(work, 'out2/result.json'), 'utf8'),
  ) as Record<string, unknown>;
  check('a second run writes the same document', withoutRun(second) === b,
    `exit ${again.status}`);

  // ── every page, and the image cap ──
  console.log('\n  the whole document\n');

  const all = spawnSync(process.execPath, [
    dist, 'inspect', file, '--out', path.join(work, 'all'), '--no-images',
  ], { encoding: 'utf8', cwd: cli });
  const allJson = JSON.parse(
    fs.readFileSync(path.join(work, 'all/result.json'), 'utf8'),
  ) as { summary: { pages: number; elements: number }; pages: unknown[] };
  check('no --page inspects every page', allJson.summary.pages === pdf.numPages,
    `${allJson.summary.pages} pages`);
  check('and finds more elements than one page did',
    allJson.summary.elements > first.elements.length,
    `${allJson.summary.elements} vs ${first.elements.length}`);

  const html = fs.readFileSync(path.join(work, 'all/report.html'), 'utf8');
  check('--no-images leaves the page images out', !html.includes('data:image'),
    `${Math.round(html.length / 1024)} KB`);
  check('and the report still lists every page',
    pdf.numPages > 1 ? html.includes('Page 2') : true);
  // The result never carries images, whatever the report does — a result.json
  // with base64 pages in it is a file nobody can diff.
  const withImages = JSON.parse(
    fs.readFileSync(fromCli, 'utf8'),
  ) as { pages: Record<string, unknown>[] };
  check('result.json never carries an image, even when the report does',
    !('imageDataUrl' in withImages.pages[0]) && !fs.readFileSync(fromCli, 'utf8').includes('data:image'));

  // ── an image inside a Form XObject ──
  //
  // `pdfElements.ts` tracked `transform` ops but not a form's own `/Matrix`,
  // which pdf.js delivers as an argument to `paintFormXObjectBegin`. Every
  // image inside a form was therefore measured at the wrong place — the same
  // defect found twice in the spec walkers (W-04). This is the third copy,
  // and the only way to tell the fix from the bug is a form whose matrix is
  // not the identity.
  console.log('\n  an image inside a form XObject\n');

  const formDoc = await loadPdf(formXObjectFile());
  const formPage = await renderElements(formDoc, 0);
  const formMeasured = inspectPage(formPage, 0);
  const img = formMeasured.elements.find((e) => e.kind === 'image');

  const E = FORM_IMAGE_EXPECTED;
  const inches = (pt: number) => pt / 72;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

  check('the image inside the form was found', img != null,
    `${formMeasured.elements.length} element(s)`);
  if (img) {
    check('its left edge is the form matrix applied, not ignored',
      near(img.box.fromLeftIn, inches(E.leftPt)),
      `${img.box.fromLeftIn}″ — expected ${inches(E.leftPt).toFixed(4)}″, `
        + `${inches(E.ifMatrixIgnored.leftPt).toFixed(4)}″ if ignored`);
    check('and its top edge likewise',
      near(img.box.fromTopIn, inches(E.topPt)),
      `${img.box.fromTopIn}″ — expected ${inches(E.topPt).toFixed(4)}″, `
        + `${inches(E.ifMatrixIgnored.topPt).toFixed(4)}″ if ignored`);
    check('its size comes through the matrix unchanged',
      near(img.box.widthIn, inches(E.widthPt)) && near(img.box.heightIn, inches(E.heightPt)),
      `${img.box.widthIn}″ × ${img.box.heightIn}″`);
    check('an image reports no font and no line height',
      img.font === undefined && img.lineHeight === undefined);
  }
  check('a page of only an image says it has no text layer',
    formMeasured.hasTextLayer === false);

  // ── usage errors ──
  console.log('\n  usage\n');

  const noOut = spawnSync(process.execPath, [dist, 'inspect', file], { encoding: 'utf8', cwd: cli });
  check('no --out is a tool error', noOut.status === 2, `exit ${noOut.status}`);

  const noFile = spawnSync(process.execPath, [
    dist, 'inspect', '--out', path.join(work, 'x'),
  ], { encoding: 'utf8', cwd: cli });
  check('no file is a tool error', noFile.status === 2, `exit ${noFile.status}`);

  const notPdf = spawnSync(process.execPath, [
    dist, 'inspect', path.join(cli, 'package.json'), '--out', path.join(work, 'x'),
  ], { encoding: 'utf8', cwd: cli });
  check('a file that is not a .pdf is refused by name', notPdf.status === 2,
    `exit ${notPdf.status}`);

  const pastEnd = spawnSync(process.execPath, [
    dist, 'inspect', file, '--page', '999', '--out', path.join(work, 'x'),
  ], { encoding: 'utf8', cwd: cli });
  check('a page past the end says how many there are',
    pastEnd.status === 2 && /has \d+ pages?/.test(pastEnd.stdout + pastEnd.stderr),
    (pastEnd.stdout + pastEnd.stderr).split('\n').find((l) => l.startsWith('Error:'))?.trim());

  const zero = spawnSync(process.execPath, [
    dist, 'inspect', file, '--page', '0', '--out', path.join(work, 'x'),
  ], { encoding: 'utf8', cwd: cli });
  check('page 0 is refused — pages count from 1', zero.status === 2, `exit ${zero.status}`);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
