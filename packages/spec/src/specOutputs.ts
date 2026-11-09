/**
 * The four downloadable outputs — SR-SPEC-INTAKE decision 14.
 *
 * - **the validation report** — what was refused, what was accepted with less
 *   confidence, and every accepted row's assertion in plain words, each line
 *   naming its cell. HTML, so it prints and can be sent to someone who has no
 *   copy of the app.
 * - **the annotated workbook** — *the uploaded file*, with every error cell
 *   filled red and a `Validation` sheet listing them. Not a rebuilt workbook:
 *   rebuilding would throw away the author's formatting, their Notes column
 *   and their screenshots, which is most of what makes it theirs.
 * - **the extraction JSON** — every row the reader saw, with its status.
 * - **the spec JSON** — the assertions only, which can be uploaded again.
 */

import JSZip from 'jszip';

import type { Extraction } from './specTemplate';
import type { CompiledSpec } from './specCompile';
import type { ValidationReport } from './specValidate';
import { coverageLine } from './specValidate';
import type { IntakeNote } from './specIntake';
import type { PdfSpec } from './types';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const where = (n: { sheet?: string; cell?: string }) =>
  n.sheet ? n.sheet + (n.cell ? `!${n.cell}` : '') : 'the file';

/** `report-spec.xlsx` → `report-spec`. */
const stem = (name: string) => name.replace(/\.(xlsx|xlsm|json)$/i, '');

// ── 1 · the validation report ─────────────────────────────────────────

function noteSection(title: string, klass: string, notes: IntakeNote[]): string {
  if (notes.length === 0) return '';
  return `<h2 class="${klass}">${esc(title)} <span class="n">${notes.length}</span></h2>
<table><tbody>${notes.map((n) => `<tr><td class="cell">${esc(where(n))}</td><td>${esc(n.message)}</td></tr>`).join('')}</tbody></table>`;
}

export function validationReportHtml(report: ValidationReport): string {
  const rest = report.coverage.filter((c) => c.status !== 'checked');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Spec validation — ${esc(report.workbook)}</title>
<style>
  body { font: 14px/1.6 ui-sans-serif, system-ui, sans-serif; color: #1e293b; margin: 32px auto; max-width: 980px; padding: 0 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12.5px; margin: 0 0 24px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; margin: 28px 0 8px; }
  h2.error { color: #dc2626; } h2.warning { color: #d97706; } h2.info { color: #64748b; }
  h2 .n { background: #f1f5f9; border-radius: 999px; padding: 1px 8px; font-size: 11px; margin-left: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  td, th { border-bottom: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; vertical-align: top; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  .cell { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: #64748b; white-space: nowrap; width: 150px; }
  .blocked { background: #fef2f2; border-left: 3px solid #dc2626; padding: 10px 12px; margin: 16px 0; }
  .num { color: #94a3b8; width: 48px; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>Spec validation — ${esc(report.workbook)}</h1>
<p class="sub">${esc(coverageLine(report.counts))} ·
 ${report.counts.excluded} excluded · ${report.counts.noted} noted · ${report.counts.unreadable} unreadable${
  report.templateVersion ? ` · template v${esc(report.templateVersion)}` : ''
}${report.sha256 ? `<br>SHA-256 ${esc(report.sha256)}` : ''}</p>
${report.blocking ? `<p class="blocked"><b>This workbook cannot be checked.</b> ${esc(report.blockedBecause ?? '')}</p>` : ''}
${noteSection('Refused — these rows yield no check', 'error', report.errors)}
${noteSection('Checked, with lower confidence', 'warning', report.warnings)}
${noteSection('Notes', 'info', report.info)}
${rest.length === 0 ? '' : `<h2 class="info">Rows with no check, and why <span class="n">${rest.length}</span></h2>
<table><thead><tr><th>Cell</th><th>Element</th><th>Parameter</th><th>Why</th></tr></thead><tbody>${
  rest.map((c) => `<tr><td class="cell">${esc(c.sheet)}!${c.row}</td><td>${esc(c.element)}</td><td>${esc(c.parameter)}</td><td>${esc(c.reason)}</td></tr>`).join('')
}</tbody></table>`}
${report.assertions.length === 0 ? '' : `<h2>What the checker understood <span class="n">${report.assertions.length}</span></h2>
<table><thead><tr><th>Page</th><th>Element</th><th>Assertion</th><th>Cell</th></tr></thead><tbody>${
  report.assertions.map((a) => `<tr><td class="num">${a.page}</td><td>${esc(a.element)}</td><td>${esc(a.sentence)}</td><td class="cell">${esc(where(a))}</td></tr>`).join('')
}</tbody></table>`}
</body></html>`;
}

// ── 2 · the extraction and 3 · the spec ───────────────────────────────

/**
 * Every row the reader saw (decision 14).
 *
 * The shape is the record's: sheet, cell, raw text, parsed value, status. The
 * status comes from coverage, so a row's line here and its line in the
 * validation report cannot disagree.
 */
export function extractionJson(ex: Extraction, compiled: CompiledSpec): string {
  const status = new Map(compiled.coverage.map((c) => [`${c.sheet}|${c.row}`, c]));

  return JSON.stringify({
    schema: 'pdfsuite.extraction/1',
    workbook: ex.workbook,
    sha256: ex.sha256,
    templateVersion: ex.settings.templateVersion,
    settings: ex.settings,
    pages: ex.pages,
    rows: ex.rows.map((r) => {
      const cov = status.get(`${r.sheet}|${r.row}`);
      return {
        sheet: r.sheet,
        row: r.row,
        // The Value cell: column E is Template v2's, fixed by decision 7.
        cell: `${VALUE_COLUMN}${r.row}`,
        element: r.element,
        part: r.part,
        group: r.group,
        parameter: r.parameter,
        raw: r.value,
        unit: r.unit,
        from: r.from,
        parsed: r.parsed,
        struck: r.struck,
        usable: r.usable,
        status: cov?.status ?? 'excluded',
        reason: cov?.reason ?? 'the row belongs to no page named in the Pages List',
      };
    }),
    notes: ex.notes,
  }, null, 2) + '\n';
}

/** The assertions only — this is the file that can be uploaded again. */
export function specJsonText(spec: PdfSpec): string {
  return JSON.stringify(spec, null, 2) + '\n';
}

// ── 4 · the annotated workbook ────────────────────────────────────────

const RED = 'FFFFC7CE';

/** Template v2's Value column (decision 7); the extraction cites it per row. */
const VALUE_COLUMN = 'E';

/** `"F23"` → `{ col: "F", row: 23 }`, or null. */
function splitRef(ref: string): { col: string; row: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return m ? { col: m[1], row: Number(m[2]) } : null;
}

const colIndex = (s: string) => {
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
};

/**
 * Add a solid red fill to `styles.xml` and return the `cellXfs` index for it.
 *
 * The file's own styles are left alone: a new fill and a new format are
 * appended, so every cell that is not marked keeps exactly the look its author
 * gave it.
 */
function addRedStyle(xml: string): { xml: string; index: number } {
  const fills = xml.match(/<fills count="(\d+)">/);
  const xfs = xml.match(/<cellXfs count="(\d+)">/);
  if (!fills || !xfs) {
    throw new Error('This workbook has no style table to add the red fill to.');
  }

  const fillId = Number(fills[1]);
  const xfIndex = Number(xfs[1]);

  let out = xml.replace(fills[0], `<fills count="${fillId + 1}">`);
  out = out.replace(
    '</fills>',
    `<fill><patternFill patternType="solid"><fgColor rgb="${RED}"/><bgColor indexed="64"/></patternFill></fill></fills>`,
  );
  out = out.replace(xfs[0], `<cellXfs count="${xfIndex + 1}">`);
  out = out.replace(
    '</cellXfs>',
    `<xf numFmtId="0" fontId="0" fillId="${fillId}" borderId="0" xfId="0" applyFill="1"/></cellXfs>`,
  );

  return { xml: out, index: xfIndex };
}

/**
 * Give one cell a style, inserting the cell when the file has none for it.
 *
 * An empty cell usually has no `<c>` element at all, and an empty cell is
 * exactly where half these errors are — a blank Unit, a blank From. Marking
 * only the cells that already exist would leave the ones the person most needs
 * to find unmarked.
 */
function markCell(sheetXml: string, ref: string, styleIndex: number): string {
  const existing = new RegExp(`<c r="${ref}"([^>]*?)(/?)>`);
  const hit = sheetXml.match(existing);
  if (hit) {
    const attrs = hit[1].replace(/\s+s="\d+"/, '');
    return sheetXml.replace(hit[0], `<c r="${ref}"${attrs} s="${styleIndex}"${hit[2]}>`);
  }

  const at = splitRef(ref);
  if (!at) return sheetXml;

  const rowRe = new RegExp(`<row r="${at.row}"([^>]*)>([\\s\\S]*?)</row>`);
  const row = sheetXml.match(rowRe);
  const cell = `<c r="${ref}" s="${styleIndex}"/>`;
  if (!row) {
    // No row element either. Adding one in the right place is more surgery
    // than this is worth: the Validation sheet still lists the cell.
    return sheetXml;
  }

  // Cells go in column order, or Excel calls the file corrupt.
  const cells = [...row[2].matchAll(/<c r="([A-Z]+)(\d+)"/g)];
  const after = cells.filter((c) => colIndex(c[1]) < colIndex(at.col)).pop();
  if (!after) return sheetXml.replace(row[0], `<row r="${at.row}"${row[1]}>${cell}${row[2]}</row>`);

  // Insert after the last cell whose column is to the left of this one.
  const start = row[2].indexOf(after[0]);
  const end = row[2].indexOf('</c>', start);
  const cut = end >= 0 ? end + 4 : row[2].indexOf('>', start) + 1;
  const merged = row[2].slice(0, cut) + cell + row[2].slice(cut);
  return sheetXml.replace(row[0], `<row r="${at.row}"${row[1]}>${merged}</row>`);
}

/** Which part holds which sheet, by name, from the workbook's own rels. */
function sheetParts(workbookXml: string, relsXml: string): Map<string, string> {
  const targets = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    targets.set(m[1], m[2]);
  }
  const out = new Map<string, string>();
  for (const m of workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const target = targets.get(m[2]);
    if (target) out.set(decodeXml(m[1]), 'xl/' + target.replace(/^\/?xl\//, ''));
  }
  return out;
}

const decodeXml = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** The Validation sheet appended to the workbook, as inline strings. */
function validationSheetXml(report: ValidationReport): string {
  const head = ['Severity', 'Sheet', 'Cell', 'What is wrong'];
  const lines = [
    ...report.errors.map((n) => ['Error', n.sheet ?? '', n.cell ?? '', n.message]),
    ...report.warnings.map((n) => ['Warning', n.sheet ?? '', n.cell ?? '', n.message]),
    ...report.info.map((n) => ['Note', n.sheet ?? '', n.cell ?? '', n.message]),
  ];

  const row = (cells: string[], r: number) =>
    `<row r="${r}">${cells.map((v, i) => (v === '' ? '' :
      `<c r="${String.fromCharCode(65 + i)}${r}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`)).join('')}</row>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="11" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="4" width="110" customWidth="1"/></cols><sheetData>${
    [head, ...lines].map((cells, i) => row(cells, i + 1)).join('')
  }</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

/**
 * The uploaded workbook with its error cells filled red and a Validation sheet
 * added. Returns the bytes; the original is not modified.
 */
export async function annotateWorkbook(
  original: Uint8Array,
  report: ValidationReport,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(original);

  const text = async (path: string) => {
    const f = zip.file(path);
    return f ? f.async('string') : null;
  };

  const stylesXml = await text('xl/styles.xml');
  const workbookXml = await text('xl/workbook.xml');
  const relsXml = await text('xl/_rels/workbook.xml.rels');
  const typesXml = await text('[Content_Types].xml');
  if (!stylesXml || !workbookXml || !relsXml || !typesXml) {
    throw new Error('This workbook is missing a part the annotator needs; it cannot be marked up.');
  }

  // 1 · the red format
  const styled = addRedStyle(stylesXml);
  zip.file('xl/styles.xml', styled.xml);

  // 2 · the error cells
  const parts = sheetParts(workbookXml, relsXml);
  const bySheet = new Map<string, string[]>();
  for (const e of report.errors) {
    if (!e.sheet || !e.cell) continue;
    const list = bySheet.get(e.sheet) ?? [];
    list.push(e.cell);
    bySheet.set(e.sheet, list);
  }
  for (const [sheet, cells] of bySheet) {
    const part = parts.get(sheet);
    if (!part) continue;
    let xml = await text(part);
    if (!xml) continue;
    for (const cell of cells) xml = markCell(xml, cell, styled.index);
    zip.file(part, xml);
  }

  // 3 · the Validation sheet, appended last so no existing sheet moves
  const ids = [...workbookXml.matchAll(/<sheet[^>]*sheetId="(\d+)"/g)].map((m) => Number(m[1]));
  const sheetId = Math.max(0, ...ids) + 1;
  const rIds = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const rId = `rId${Math.max(0, ...rIds) + 1}`;
  const partName = `xl/worksheets/sheet${sheetId}-validation.xml`;

  zip.file(partName, validationSheetXml(report));
  zip.file('xl/workbook.xml', workbookXml.replace(
    '</sheets>',
    `<sheet name="Validation" sheetId="${sheetId}" r:id="${rId}"/></sheets>`,
  ));
  zip.file('xl/_rels/workbook.xml.rels', relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${partName.replace('xl/', '')}"/></Relationships>`,
  ));
  zip.file('[Content_Types].xml', typesXml.replace(
    '</Types>',
    `<Override PartName="/${partName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  ));

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * Hand a file to the browser.
 *
 * Here rather than in the store because all four outputs are produced in this
 * file and a download that forgets to revoke its object URL leaks the whole
 * workbook for the life of the tab.
 */
export function saveFile(name: string, data: string | Uint8Array, mime: string): void {
  const blob = new Blob([data as unknown as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const MIME = {
  html: 'text/html',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

// ── names ─────────────────────────────────────────────────────────────

export const outputNames = {
  validation: (workbook: string) => `${stem(workbook)} — validation.html`,
  annotated: (workbook: string) => `${stem(workbook)} — validation.xlsx`,
  extraction: (workbook: string) => `${stem(workbook)} — extraction.json`,
  spec: (workbook: string) => `${stem(workbook)} — spec.json`,
};
