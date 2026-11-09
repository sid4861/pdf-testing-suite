/**
 * The draft Template v2 workbook a legacy upload produces —
 * SR-SPEC-INTAKE decision 8.
 *
 * This is the output of reading a legacy sheet: not a spec, a workbook. Every
 * cell this reader inferred is filled amber and every cell it could not read
 * is filled red, with a legend on the first sheet, so the person confirming it
 * sees exactly which of the figures are theirs and which are the machine's.
 * They fix it in Excel and upload the result, which is checked like any other
 * v2 workbook.
 *
 * It is written here rather than with a library because the project already
 * writes `.xlsx` this way for its fixtures, the format needed is small, and
 * ExcelJS and SheetJS both lost on their own merits (SR-SPEC-INTAKE
 * §Alternatives). The parts are the minimum Excel will open: content types,
 * two relationship files, a workbook, a style table, shared strings and the
 * sheets.
 */

import JSZip from 'jszip';

import type { DraftRow, LegacyDraft, Origin } from './specLegacy';

/** The 13 columns of a Template v2 page sheet, in order. */
const HEAD = [
  'Element', 'Part', 'Group', 'Parameter', 'Value', 'Unit', 'From',
  'Check?', 'Tolerance', 'Exact text', 'Pattern', 'Notes', 'Description',
];

type Cell = string | number | null;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colLetter = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s;
  return s;
};

class Strings {
  list: string[] = [];
  private idx = new Map<string, number>();
  id(s: string): number {
    let i = this.idx.get(s);
    if (i === undefined) {
      i = this.list.length;
      this.list.push(s);
      this.idx.set(s, i);
    }
    return i;
  }
}

interface SheetSpec {
  name: string;
  cols: number[];
  rows: Cell[][];
  /** The style index for a cell, which is how the highlights are carried. */
  styles?: (r: number, c: number) => number | undefined;
}

/**
 * Style 1 head · 2 wrapped · 3 amber (inferred) · 4 red (unreadable) · 5 note.
 */
const STYLE = { head: 1, wrap: 2, inferred: 3, unreadable: 4, note: 5 } as const;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B3C5D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3C4"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFD5D5"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(sh: SheetSpec, S: Strings): string {
  const rows: string[] = [];
  sh.rows.forEach((row, ri) => {
    const cs: string[] = [];
    row.forEach((v, ci) => {
      if (v === null || v === undefined || v === '') return;
      const ref = `${colLetter(ci)}${ri + 1}`;
      const st = sh.styles?.(ri, ci);
      const sAttr = st ? ` s="${st}"` : '';
      if (typeof v === 'number') cs.push(`<c r="${ref}"${sAttr}><v>${v}</v></c>`);
      else cs.push(`<c r="${ref}" t="s"${sAttr}><v>${S.id(v)}</v></c>`);
    });
    if (cs.length) rows.push(`<row r="${ri + 1}">${cs.join('')}</row>`);
  });
  const cols = sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

const fillFor = (origin: Origin): number | undefined =>
  origin === 'inferred' ? STYLE.inferred : origin === 'unreadable' ? STYLE.unreadable : undefined;

/** One page sheet of the draft, with the highlights that are the point of it. */
function pageSheet(tab: string, rows: DraftRow[]): SheetSpec {
  const body = rows.map((r) => [
    r.element.value, r.part.value, r.group.value, r.parameter.value,
    r.value.value, r.unit.value, r.from.value,
    // Nothing is checked until a person confirms it, so no row arrives saying
    // Yes. "Note" is the honest default: read it, do not assert it.
    'Note', '', '', '', r.notes,
    `from ${r.sheet} row ${r.sourceRow}`,
  ] as Cell[]);

  // The cells a person has to look at, by position in the row above.
  const origins = rows.map((r) => [
    r.element.origin, r.part.origin, r.group.origin, r.parameter.origin,
    r.value.origin, r.unit.origin, r.from.origin,
  ]);

  return {
    name: tab,
    cols: [18, 18, 12, 16, 16, 8, 16, 8, 10, 10, 14, 24, 20],
    rows: [HEAD, ...body],
    styles: (r, c) => {
      if (r === 0) return STYLE.head;
      if (c === 12) return STYLE.note;
      const o = origins[r - 1]?.[c];
      return o ? fillFor(o) : undefined;
    },
  };
}

/** The parameter table the v2 reader checks every row against. */
const PARAMETER_RULES: [string, string, string, string, string, string][] = [
  // name, kind, units allowed, unit required, number required, from required
  ['Top', 'length', 'in mm cm pt px %', 'Yes', 'Yes', 'Yes'],
  ['Left', 'length', 'in mm cm pt px %', 'Yes', 'Yes', 'Yes'],
  ['Right', 'length', 'in mm cm pt px %', 'Yes', 'Yes', 'Yes'],
  ['Bottom', 'length', 'in mm cm pt px %', 'Yes', 'Yes', 'Yes'],
  ['Baseline', 'length', 'in mm cm pt px %', 'Yes', 'Yes', 'Yes'],
  ['Width', 'length', 'in mm cm pt px %', 'Yes', 'Yes', 'No'],
  ['Height', 'length', 'in mm cm pt px %', 'Yes', 'Yes', 'No'],
  ['Font size', 'points', 'pt', 'Yes', 'Yes', 'No'],
  ['Line spacing', 'length', 'in mm cm pt', 'Yes', 'Yes', 'No'],
  ['Font', 'font', '', 'No', 'No', 'No'],
  ['Bold', 'yesno', '', 'No', 'No', 'No'],
  ['Italic', 'yesno', '', 'No', 'No', 'No'],
  ['Underline', 'yesno', '', 'No', 'No', 'No'],
  ['Colour', 'colour', '', 'No', 'No', 'No'],
  ['Fill', 'colour', '', 'No', 'No', 'No'],
  ['Wording', 'text', '', 'No', 'No', 'No'],
  ['Alignment', 'list', '', 'No', 'No', 'No'],
  ['Case', 'list', '', 'No', 'No', 'No'],
  ['Pattern', 'text', '', 'No', 'No', 'No'],
  ['Rows', 'count', 'count', 'No', 'Yes', 'No'],
  ['Columns', 'count', 'count', 'No', 'Yes', 'No'],
  ['File name', 'text', '', 'No', 'No', 'No'],
  ['Note', 'text', '', 'No', 'No', 'No'],
];

function listsSheet(): SheetSpec {
  const head = ['Group', 'Unit', 'From', 'Check?', 'Case', 'Font', 'Colour name', 'Hex',
    'Parameter', 'Kind', 'Units allowed', 'Unit required', 'Number required', 'From required'];
  const groups = ['Position', 'Size', 'Image', 'Text', 'Font', 'Colour', 'Table', 'Graph', 'Data', 'Note'];
  const units = ['in', 'mm', 'cm', 'pt', 'px', '%', 'count'];
  const froms = ['top of page', 'left of page', 'right of page', 'bottom of page',
    'top of container', 'left of container', 'right of container', 'bottom of container'];
  const checks = ['Yes', 'Note', 'No'];
  const cases = ['Title', 'Sentence', 'Upper', 'Lower'];
  const fonts = ['Helvetica', 'Times', 'Courier'];

  const height = Math.max(groups.length, units.length, froms.length, PARAMETER_RULES.length);
  const rows: Cell[][] = [head];
  for (let i = 0; i < height; i++) {
    const p = PARAMETER_RULES[i];
    rows.push([
      groups[i] ?? '', units[i] ?? '', froms[i] ?? '', checks[i] ?? '', cases[i] ?? '',
      fonts[i] ?? '', '', '',
      ...(p ?? ['', '', '', '', '', '']),
    ]);
  }
  return { name: 'Lists', cols: [14, 8, 20, 9, 10, 12, 14, 10, 16, 10, 18, 14, 16, 14], rows,
    styles: (r) => (r === 0 ? STYLE.head : undefined) };
}

function settingsSheet(): SheetSpec {
  return {
    name: 'Settings',
    cols: [26, 14, 10, 52],
    rows: [
      ['Setting', 'Value', 'Unit', 'Notes'],
      ['Template version', '2', '', 'This workbook is a draft produced from a legacy spec.'],
      ['Position tolerance', '', '', 'Fill this in: there is no default.'],
      ['Size tolerance', '', '', 'Fill this in: there is no default.'],
      ['Font size tolerance', '', 'pt', 'Fill this in: there is no default.'],
    ],
    styles: (r) => (r === 0 ? STYLE.head : undefined),
  };
}

function pagesListSheet(draft: LegacyDraft): SheetSpec {
  const rows: Cell[][] = [
    ['Tab', 'Page name', 'Type', 'Orientation', 'Variant group', 'Repeats', 'Identifying text', 'Comments'],
    ...draft.pages.map((p) => [p.tab, p.name, 'Required', '', '', '', '', 'Confirm this page is required.'] as Cell[]),
    [],
    ['This is a DRAFT.', '', '', '', '', '', '', ''],
    ['Amber cells were inferred from the legacy wording; red cells could not be read.', '', '', '', '', '', '', ''],
    ['Nothing here has been checked against a PDF. Confirm the highlighted cells, set', '', '', '', '', '', '', ''],
    ['Check? to Yes on the rows you want checked, then upload this workbook.', '', '', '', '', '', '', ''],
  ];
  return {
    name: 'Pages List',
    cols: [16, 28, 12, 14, 14, 10, 24, 46],
    rows,
    styles: (r, c) => {
      if (r === 0) return STYLE.head;
      if (r > draft.pages.length && c === 0) return STYLE.note;
      return undefined;
    },
  };
}

/**
 * The draft workbook's bytes.
 *
 * Returned as a `Uint8Array` so the same function serves the tab's download
 * and a Node test — the feature is one implementation either side (L3).
 */
export async function writeDraftWorkbook(draft: LegacyDraft): Promise<Uint8Array> {
  const byTab = new Map<string, DraftRow[]>();
  for (const row of draft.rows) {
    const list = byTab.get(row.sheet) ?? [];
    list.push(row);
    byTab.set(row.sheet, list);
  }

  return writeWorkbook([
    pagesListSheet(draft),
    settingsSheet(),
    listsSheet(),
    ...draft.pages.map((p) => pageSheet(p.tab, byTab.get(p.tab) ?? [])),
  ]);
}

/**
 * A blank Template v2 workbook to start a spec from (decision 7).
 *
 * Three sheets filled in — Pages List, Settings and the Lists vocabulary the
 * reader checks every row against — and one empty page sheet with the
 * thirteen column headings. Nobody should have to copy somebody else's
 * workbook and delete their report to get this.
 *
 * It is written by the same function as the legacy draft, from the same sheet
 * builders, so the starter and the draft cannot drift apart.
 */
export async function writeBlankTemplate(): Promise<Uint8Array> {
  const pages: SheetSpec = {
    name: 'Pages List',
    cols: [16, 28, 12, 14, 14, 10, 24, 46],
    rows: [
      ['Tab', 'Page name', 'Type', 'Orientation', 'Variant group', 'Repeats', 'Identifying text', 'Comments'],
      ['1', 'First page', 'Required', 'Portrait', '', '1', '', 'Text that appears on this page and no other.'],
      [],
      ['One row per page of the PDF, in the order they are expected.', '', '', '', '', '', '', ''],
      ['Tab is the name of this page\u2019s own sheet. Type is Required, Optional or Conditional.', '', '', '', '', '', '', ''],
      ['Identifying text is how the page is found in the PDF — without it, the page is', '', '', '', '', '', '', ''],
      ['matched by its number, which goes wrong the moment a page is added or dropped.', '', '', '', '', '', '', ''],
    ],
    styles: (r, c) => (r === 0 ? STYLE.head : r > 2 && c === 0 ? STYLE.note : undefined),
  };

  const blankPage: SheetSpec = {
    name: '1',
    cols: [18, 18, 12, 16, 16, 8, 16, 8, 10, 10, 14, 24, 20],
    rows: [
      HEAD,
      ['Report title', '', 'Position', 'Top', '1', 'in', 'top of page', 'Note', '', '', '', '',
        'An example row. One cell, one fact: the number in Value, the unit in Unit, the edge in From.'],
      ['Report title', '', 'Position', 'Left', '1', 'in', 'left of page', 'Note', '', '', '', '',
        'Replace these with your own, then set Check? to Yes.'],
      ['Report title', '', 'Text', 'Wording', 'Your report title', '', '', 'Note', '', 'Yes', '', '',
        'Exact text = Yes compares it character for character.'],
    ],
    styles: (r, c) => (r === 0 ? STYLE.head : c === 12 ? STYLE.note : undefined),
  };

  return writeWorkbook([pages, settingsSheet(), listsSheet(), blankPage]);
}

/** The `.xlsx` container: the parts Excel needs, and nothing else. */
async function writeWorkbook(sheets: SheetSpec[]): Promise<Uint8Array> {
  const S = new Strings();
  const xmls = sheets.map((sh) => sheetXml(sh, S)); // fills S

  const zip = new JSZip();
  const add = (path: string, content: string) =>
    zip.file(path, content, { compression: 'DEFLATE', createFolders: false });

  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`);

  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);

  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets>${sheets.map((sh, i) => `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);

  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);

  add('xl/styles.xml', STYLES);
  add('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${S.list.length}" uniqueCount="${S.list.length}">${S.list.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);

  xmls.forEach((x, i) => add(`xl/worksheets/sheet${i + 1}.xml`, x));

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** `report-spec.xlsx` → `report-spec — draft v2.xlsx`. */
export function draftFileName(workbook: string): string {
  return workbook.replace(/\.(xlsx|xlsm)$/i, '') + ' — draft v2.xlsx';
}
