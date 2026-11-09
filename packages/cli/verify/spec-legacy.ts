import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import {
  readSpecWorkbook, readTemplate, compileSpec,
  looksLegacy, readLegacy, parseProse, draftCounts, writeDraftWorkbook, draftFileName,
} from '@pdfsuite/spec/engine';

/**
 * W-02 DoD 4 — the legacy nested layout (SR-SPEC-INTAKE decision 8).
 *
 * No legacy workbook is committed (Arpit, 2026-10-18), so the legacy sheet is
 * built here from the v2 fixture's own rows: the same facts, written the old
 * way — labels merged down the left, the position as a sentence. That is also
 * the honest test, because it means the expected reading is known exactly.
 *
 * The claim being tested is a negative one, and it is the whole decision: a
 * legacy workbook produces a **draft for a person to confirm** and **no
 * assertion**, by any route.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../../work/samples/excel-spec-template-v2');

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

const asFile = (name: string, bytes: Uint8Array): File => ({
  name, size: bytes.byteLength,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
} as unknown as File);

const fromDisk = (n: string): File => asFile(n, fs.readFileSync(path.join(fixture, n)));

// ── a minimal legacy workbook, written here ───────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colLetter = (i: number) => String.fromCharCode(65 + i);

interface LegacySheet { name: string; rows: string[][]; merges: string[] }

async function legacyWorkbook(sheets: LegacySheet[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const add = (p: string, c: string) => zip.file(p, c, { createFolders: false });

  const xml = (sh: LegacySheet) => {
    const rows = sh.rows.map((row, ri) => {
      const cs = row
        .map((v, ci) => (v === '' ? '' : `<c r="${colLetter(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`))
        .join('');
      return cs ? `<row r="${ri + 1}">${cs}</row>` : '';
    }).join('');
    const merges = sh.merges.length
      ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData>${merges}</worksheet>`;
  };

  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sh, i) => `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`);
  sheets.forEach((sh, i) => add(`xl/worksheets/sheet${i + 1}.xml`, xml(sh)));

  return zip.generateAsync({ type: 'uint8array' });
}

/** The v2 fixture's first page, written the legacy way. */
async function legacyFromV2(): Promise<{ bytes: Uint8Array; expectedRows: number }> {
  const ex = readTemplate(await readSpecWorkbook(fromDisk('report-spec.xlsx')));
  const page1 = ex.rows.filter((r) => r.sheet === '1');

  const rows: string[][] = [['Element', 'Part', 'Parameter', 'Value', 'Notes']];
  const merges: string[] = [];
  let runStart = 1;
  let runLabel = '';

  for (const r of page1) {
    // The legacy way of writing it: the unit and the edge inside the sentence.
    const prose = r.value && r.unit && r.from
      ? `${r.value} ${r.unit === 'in' ? 'inches' : r.unit} from ${r.from}`
      : r.value && r.unit
        ? `${r.value} ${r.unit === 'in' ? 'inches' : r.unit}`
        : r.value;

    if (r.element !== runLabel) {
      if (runLabel && rows.length - 1 > runStart) merges.push(`A${runStart + 1}:A${rows.length}`);
      runStart = rows.length;
      runLabel = r.element;
      rows.push([r.element, r.part, r.parameter, prose, r.notes]);
    } else {
      // Blank, as Excel leaves every cell of a merge but its top-left.
      rows.push(['', r.part, r.parameter, prose, r.notes]);
    }
  }
  if (runLabel && rows.length - 1 > runStart) merges.push(`A${runStart + 1}:A${rows.length}`);

  return {
    bytes: await legacyWorkbook([{ name: 'Page 1 — Cover', rows, merges }]),
    expectedRows: page1.length,
  };
}

async function main() {
  console.log('\n  a legacy sheet, built from the v2 data\n');

  const { bytes, expectedRows } = await legacyFromV2();
  // `--write <dir>` drops the two workbooks somewhere, for looking at the
  // tab's legacy path by hand. The test does not depend on it.
  const writeTo = process.argv[process.argv.indexOf('--write') + 1];
  if (process.argv.includes('--write') && writeTo) {
    fs.writeFileSync(path.join(writeTo, 'legacy-spec.xlsx'), bytes);
    console.log('      wrote legacy-spec.xlsx to ' + writeTo);
  }

  const book = await readSpecWorkbook(asFile('legacy-spec.xlsx', bytes));

  check('it is recognised as legacy, not v2', looksLegacy(book) === true);

  // The first claim of decision 8, and the one that matters: nothing on this
  // path reaches a spec. The v2 reader refuses it outright.
  const asV2 = compileSpec(readTemplate(book));
  check('the v2 reader writes no assertion from it',
    asV2.spec.pages.every((p) => p.elements.length === 0),
    `${asV2.spec.pages.reduce((n, p) => n + p.elements.length, 0)} elements`);

  const draft = readLegacy(book);
  const counts = draftCounts(draft);
  console.log(`      ${counts.rows} rows · ${counts.inferred} inferred cells · ${counts.unreadable} red`);

  check('every row of the page was read', draft.rows.length === expectedRows,
    `${draft.rows.length} of ${expectedRows}`);
  check('the merged Element label covers its rows',
    draft.rows.every((r) => !!r.element.value),
    `${draft.rows.filter((r) => r.element.value).length}/${draft.rows.length} have an element`);
  check('and it is read from the merge, not copied down',
    new Set(draft.rows.map((r) => r.element.value)).size > 1,
    [...new Set(draft.rows.map((r) => r.element.value))].slice(0, 3).join(', '));

  console.log('\n  prose, pulled apart\n');

  const a = parseProse('5.75 inches from top of page');
  console.log(`      "5.75 inches from top of page" → ${a.value.value} / ${a.unit.value} / ${a.from.value}`);
  check('a sentence becomes Value, Unit and From',
    a.value.value === '5.75' && a.unit.value === 'in' && a.from.value === 'top of page');
  check('and all of it is marked inferred, including the number',
    a.value.origin === 'inferred' && a.unit.origin === 'inferred' && a.from.origin === 'inferred');

  const b = parseProse('10');
  check('a number with no unit leaves Unit red',
    b.unit.origin === 'unreadable' && b.unit.value === '');
  const plain = parseProse('Fleet Operations Review');
  check('prose that is not a measurement is copied, not guessed at',
    plain.value.origin === 'read' && plain.value.value === 'Fleet Operations Review');

  const colour = parseProse('0B3C5D');
  check('a bare hex becomes a colour', colour.value.value === '#0B3C5D');

  check('something was inferred, or this test is not testing anything',
    counts.inferred > 0, `${counts.inferred} cells`);

  console.log('\n  the draft workbook it produces\n');

  const draftBytes = await writeDraftWorkbook(draft);
  if (process.argv.includes('--write') && writeTo) {
    fs.writeFileSync(path.join(writeTo, draftFileName('legacy-spec.xlsx')), draftBytes);
  }
  check('it is named as a draft', /draft v2\.xlsx$/.test(draftFileName('legacy-spec.xlsx')),
    draftFileName('legacy-spec.xlsx'));

  const reread = await readSpecWorkbook(asFile('draft.xlsx', draftBytes));
  check('the draft reads back, and reads as v2', looksLegacy(reread) === false,
    reread.workbook.sheets.map((s) => s.name).join(', '));

  const back = readTemplate(reread);
  check('with every legacy row carried into it', back.rows.length === draft.rows.length,
    `${back.rows.length} of ${draft.rows.length}`);
  check('and its Pages List names the legacy sheet',
    back.pages.length === 1 && back.pages[0].tab === 'Page 1 — Cover',
    back.pages.map((p) => p.tab).join(', '));

  // The second claim of decision 8: the draft itself asserts nothing. Every
  // row arrives saying Note, so a person must say Yes before anything is
  // checked — the guesswork stops here, at a workbook, not at a result.
  const compiledDraft = compileSpec(back);
  check('the draft itself still produces no assertion',
    compiledDraft.spec.pages.every((p) => p.elements.length === 0) && compiledDraft.counts.checked === 0,
    `${compiledDraft.counts.checked} checked, ${compiledDraft.counts.noted} noted`);

  const values = new Map(draft.rows.map((r) => [`${r.parameter.value}|${r.value.value}`, true]));
  const carried = back.rows.filter((r) => values.has(`${r.parameter}|${r.value}`)).length;
  check('the values a person has to confirm are the ones that were read',
    carried === back.rows.length, `${carried} of ${back.rows.length}`);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
