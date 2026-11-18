/**
 * The mockup, as a Template v2 workbook (W-54).
 *
 * The measure of this file is not that it writes a spreadsheet but that
 * `buildValidationReport` accepts what it writes with **zero errors**. The
 * canvas can only reach the reader through here, so every rule the reader
 * has is a rule this file must already satisfy:
 *
 * - a number in `Value`, its unit in `Unit`, never together;
 * - a unit on every numeric parameter, and only units the parameter takes;
 * - `From` on every edge distance;
 * - a `Parameter` that `Lists` declares;
 * - labels **merged**, not blank, and not repeated.
 *
 * Most of those are impossible to break from here, which is the point of
 * authoring on a canvas: a dragged rectangle has an exact position in a
 * known unit, so there is no sentence to misread.
 *
 * **What is recorded but not checked** is marked `Check? = Note` rather
 * than `Yes`: image content and container fills have no checker yet
 * (W-04 DoD 3), and a row that says `Yes` when nothing will look at it is
 * a quiet lie to whoever reads the report.
 */

import {
  writeWorkbook, listsSheet, STYLE, type SheetSpec, type Cell,
} from '../specDraft';
import type {
  SpecDoc, MockupElement, MockupPage, TableElement, TextElement,
} from './model';

/** Inches, to the hundredth. Enough for 0.06in tolerances, and stable. */
const inches = (n: number): number => Math.round(n * 100) / 100;

/** Points, whole. Nobody specifies 11.7pt, and the tolerance is 2pt. */
const points = (n: number): number => Math.round(n);

const HEAD = [
  'Element', 'Part', 'Group', 'Parameter', 'Value', 'Unit', 'From', 'Check?',
  'Tolerance', 'Exact text', 'Pattern', 'Notes', 'Description',
];

const COLS = [18, 18, 12, 16, 22, 8, 18, 8, 10, 10, 14, 30, 20];

/** One page-sheet row, before it knows which spreadsheet row it is. */
interface Row {
  element: string;
  part: string;
  group: string;
  parameter: string;
  value: Cell;
  unit: string;
  from: string;
  check: 'Yes' | 'Note' | 'No';
  exactText?: string;
  notes?: string;
}

const row = (
  e: MockupElement, group: string, parameter: string, value: Cell,
  extra: Partial<Row> = {},
): Row => ({
  element: e.element || 'Unnamed', part: e.part, group, parameter,
  value, unit: '', from: '', check: 'Yes', ...extra,
});

/** `A2:A9`, or nothing when the run is one row long. */
function mergeRange(col: string, first: number, last: number): string | null {
  return last > first ? `${col}${first}:${col}${last}` : null;
}

/**
 * The rows one element contributes.
 *
 * Position is always from the page, because that is what the canvas
 * knows: an element's rectangle is in page inches. Nesting on the canvas
 * is visual (W-54 — stacking stays on the canvas), so claiming `top of
 * container` here would be asserting a relationship nobody stated.
 */
function rowsFor(e: MockupElement): Row[] {
  const out: Row[] = [];
  const pos = (p: string, v: number, from: string) =>
    out.push(row(e, 'Position', p, inches(v), { unit: 'in', from }));
  const size = (p: string, v: number) =>
    out.push(row(e, 'Size', p, inches(v), { unit: 'in' }));

  pos('Top', e.rect.y, 'top of page');
  pos('Left', e.rect.x, 'left of page');

  if (e.kind === 'text') {
    const t: TextElement = e;
    size('Width', e.rect.w);
    out.push(row(e, 'Text', 'Wording', t.text, { exactText: t.exactText ? 'Yes' : 'No' }));
    if (t.textCase) out.push(row(e, 'Text', 'Case', t.textCase));
    out.push(row(e, 'Font', 'Font', t.font));
    out.push(row(e, 'Font', 'Font size', points(t.fontSize), { unit: 'pt' }));
    out.push(row(e, 'Font', 'Bold', t.bold ? 'Yes' : 'No'));
    out.push(row(e, 'Font', 'Italic', t.italic ? 'Yes' : 'No'));
    if (t.underline) out.push(row(e, 'Font', 'Underline', 'Yes'));
    out.push(row(e, 'Colour', 'Colour', t.colour.toUpperCase()));
    return out;
  }

  size('Width', e.rect.w);
  size('Height', e.rect.h);

  if (e.kind === 'image') {
    out.push(row(e, 'Image', 'File name', e.fileName, {
      check: 'Note',
      notes: 'Recorded, not checked: image content is not compared.',
    }));
    return out;
  }

  if (e.kind === 'table') {
    const t: TableElement = e;
    out.push(row(e, 'Table', 'Columns', t.columns, { unit: 'count' }));
    out.push(row(e, 'Table', 'Rows', t.rows, { unit: 'count' }));
    out.push(row(e, 'Table', 'Row height', inches(t.rowHeight), { unit: 'in' }));
    out.push(row(e, 'Table', 'Column widths',
      t.columnWidths.map((w) => inches(w)).join(', '), { unit: 'in' }));
    if (t.headers?.length) {
      out.push(row(e, 'Table', 'Column headers', t.headers.join(', ')));
    }
    return out;
  }

  // box
  if (e.fill) {
    out.push(row(e, 'Colour', 'Fill', e.fill.toUpperCase(), {
      check: 'Note',
      notes: 'Recorded, not checked: container fills have no checker yet.',
    }));
  }
  return out;
}

/** One page sheet, with its label columns merged over the runs they cover. */
function pageSheet(page: MockupPage): SheetSpec {
  // Draw order is the canvas's; the sheet reads top-down the way the page
  // does, which is how a person checks one against the other.
  const elements = [...page.elements].sort((a, b) =>
    a.rect.y - b.rect.y || a.rect.x - b.rect.x);

  const rows: Row[] = elements.flatMap(rowsFor);
  const body: Cell[][] = rows.map((r) => [
    r.element, r.part, r.group, r.parameter, r.value, r.unit, r.from, r.check,
    '', r.exactText ?? '', '', r.notes ?? '', '',
  ]);

  // Merge each run of equal labels. Element and Part are what a person
  // reads down the left; Group is merged too, because a block of four
  // Position rows is one idea, not four.
  const merges: string[] = [];
  const runs = (col: number, letter: string, within?: number) => {
    let start = 0;
    for (let i = 1; i <= rows.length; i += 1) {
      const same = i < rows.length
        && String(body[i][col] ?? '') === String(body[start][col] ?? '')
        && (within === undefined || String(body[i][within] ?? '') === String(body[start][within] ?? ''));
      if (!same) {
        if (String(body[start][col] ?? '') !== '') {
          const m = mergeRange(letter, start + 2, i + 1); // +2: 1-based, after the header
          if (m) merges.push(m);
        }
        start = i;
      }
    }
  };
  runs(0, 'A');          // Element
  runs(1, 'B', 0);       // Part, within its Element
  runs(2, 'C', 1);       // Group, within its Part

  // A merged label is written once, at the range's top-left, and the rest
  // left blank — which is exactly what the reader expects to resolve
  // through the merge.
  const blanked = body.map((r, i) => {
    const out = [...r];
    for (const [col, letter] of [[0, 'A'], [1, 'B'], [2, 'C']] as const) {
      const inMerge = merges.some((m) => {
        const [a, b] = m.split(':');
        return a[0] === letter && Number(a.slice(1)) < i + 2 && Number(b.slice(1)) >= i + 2;
      });
      if (inMerge) out[col] = '';
    }
    return out;
  });

  return {
    name: page.tab,
    cols: COLS,
    rows: [HEAD, ...blanked],
    merges,
    styles: (r) => (r === 0 ? STYLE.head : undefined),
  };
}

function pagesListSheet(doc: SpecDoc): SheetSpec {
  const rows: Cell[][] = [
    ['Tab', 'Page name', 'Page type', 'Orientation', 'Variant group', 'Repeats',
      'Identifying text', 'Comments'],
    ...doc.pages.map((p) => [
      p.tab, p.name, p.type, p.orientation, '', p.type === 'Required' ? '1' : '0–1',
      identifierOf(p), '',
    ] as Cell[]),
  ];
  return {
    name: 'Pages List',
    cols: [10, 28, 14, 14, 14, 10, 32, 36],
    rows,
    styles: (r) => (r === 0 ? STYLE.head : undefined),
  };
}

/**
 * The text a page is found by.
 *
 * Whoever drew the page marks one text element as the identifier. With
 * none marked the cell is left **blank** rather than filled with the
 * first text on the page: a guess here binds the whole page to the wrong
 * PDF page, and the reader will say the cell is empty, which is true and
 * fixable.
 */
function identifierOf(page: MockupPage): string {
  const marked = page.elements.find(
    (e): e is TextElement => e.kind === 'text' && e.identifier === true,
  );
  return marked ? marked.text : '';
}

function settingsSheet(doc: SpecDoc): SheetSpec {
  return {
    name: 'Settings',
    cols: [26, 14, 10, 54],
    rows: [
      ['Setting', 'Value', 'Unit', 'Note'],
      ['Template version', 2, '', 'Written by the Create spec canvas.'],
      ['Position tolerance', doc.tolerances.position, 'in', 'Used where a row leaves Tolerance blank.'],
      ['Size tolerance', doc.tolerances.size, 'in', ''],
      ['Font size tolerance', doc.tolerances.fontSize, 'pt', ''],
      ['Line spacing tolerance', doc.tolerances.lineSpacing, 'in', ''],
      ['Colour threshold', '', 'ΔE', 'Blank = the tool default.'],
      ['Page width', inches(doc.page.width), 'in', ''],
      ['Page height', inches(doc.page.height), 'in', ''],
      // Left blank on purpose. The canvas is in inches and never emits a
      // px row, so a density here would be a number nothing reads.
      ['Pixels per inch', '', 'px/in', 'Not used: this spec is written in inches.'],
    ],
    styles: (r) => (r === 0 ? STYLE.head : undefined),
  };
}

/**
 * `Lists`, with the canvas's own vocabulary in it.
 *
 * The parameter catalogue is the shared one, so the canvas cannot invent a
 * parameter the reader does not know. The fonts and the palette are the
 * document's, because the pickers offer only these — which is what makes
 * `colour-name-mismatch` unreachable from the canvas.
 */
function listsWithVocabulary(doc: SpecDoc): SheetSpec {
  const base = listsSheet();
  const rows = base.rows.map((r) => [...r]);
  const head = rows[0].map((c) => String(c ?? ''));
  const fontCol = head.indexOf('Font');
  const nameCol = head.indexOf('Colour name');
  const hexCol = head.indexOf('Hex');

  const needed = Math.max(doc.fonts.length, doc.palette.length) + 1;
  while (rows.length < needed) rows.push(rows[0].map(() => ''));

  for (let i = 0; i < Math.max(doc.fonts.length, doc.palette.length); i += 1) {
    const r = rows[i + 1];
    if (fontCol >= 0) r[fontCol] = doc.fonts[i] ?? '';
    if (nameCol >= 0) r[nameCol] = doc.palette[i]?.name ?? '';
    if (hexCol >= 0) r[hexCol] = doc.palette[i]?.hex.toUpperCase() ?? '';
  }
  return { ...base, rows };
}

/** The mockup as a workbook, ready to validate, download or check. */
export function toSheets(doc: SpecDoc): SheetSpec[] {
  return [
    pagesListSheet(doc),
    settingsSheet(doc),
    listsWithVocabulary(doc),
    ...doc.pages.map(pageSheet),
  ];
}

export function toWorkbook(doc: SpecDoc): Promise<Uint8Array> {
  return writeWorkbook(toSheets(doc));
}

/** `New spec` → `New spec.xlsx`. */
export function workbookFileName(doc: SpecDoc): string {
  return `${doc.name || 'spec'}.xlsx`;
}

/** The mockup itself, which is the only thing that reopens in the canvas. */
export function mockupFileName(doc: SpecDoc): string {
  return `${doc.name || 'spec'}.pdfsuite-spec.json`;
}

export function mockupJson(doc: SpecDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
