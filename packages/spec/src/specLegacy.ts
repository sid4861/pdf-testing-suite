/**
 * The legacy nested layout — SR-SPEC-INTAKE decision 8.
 *
 * Specs were written by people long before Template v2: one sheet per page,
 * labels merged down the left, and the value written as a sentence —
 * "5.75 inches from top of page". That is readable, and it is *not* checkable,
 * because every reading of it is an inference and an inference that is wrong
 * produces a confident finding about a document that is fine.
 *
 * So this reader deliberately stops short. It produces a **draft Template v2
 * workbook** in which every cell it inferred is marked and every cell it could
 * not read is marked red, for a person to confirm in Excel and upload. It
 * writes no assertion, ever: `readLegacy` returns rows, not a spec, and there
 * is no path from here to `compileSpec`.
 *
 * Arpit, 2026-10-18: no guesswork reaches a result.
 */

import type { ImportedSheet } from '@sheetpane/import';

import { cellRef, type IntakeNote, type SpecWorkbook } from './specIntake';

/** Where a draft cell's content came from, which is what gets highlighted. */
export type Origin = 'read' | 'inferred' | 'unreadable';

export interface DraftCell {
  value: string;
  origin: Origin;
}

/** One row of the draft v2 workbook, and the legacy cell it came from. */
export interface DraftRow {
  /** The legacy sheet, and the row in it — so a person can go and look. */
  sheet: string;
  sourceRow: number;
  element: DraftCell;
  part: DraftCell;
  group: DraftCell;
  parameter: DraftCell;
  value: DraftCell;
  unit: DraftCell;
  from: DraftCell;
  notes: string;
}

export interface LegacyDraft {
  workbook: string;
  /** One per sheet read, in workbook order — the draft's Pages List. */
  pages: { tab: string; name: string }[];
  rows: DraftRow[];
  notes: IntakeNote[];
}

const read = (value: string): DraftCell => ({ value, origin: 'read' });
const inferred = (value: string): DraftCell => ({ value, origin: 'inferred' });
const unreadable = (value: string): DraftCell => ({ value, origin: 'unreadable' });

// ── the built-in vocabulary ───────────────────────────────────────────

/**
 * What people call each parameter, and what Template v2 calls it.
 *
 * A legacy sheet has no Lists sheet to check against, so the vocabulary is
 * here. It is deliberately small: a label that is not in it becomes a red cell
 * rather than a guess, which is the whole point of decision 8.
 */
const PARAMETER: Record<string, string> = {
  top: 'Top', 'top position': 'Top', 'from top': 'Top', y: 'Top',
  left: 'Left', 'left position': 'Left', 'from left': 'Left', x: 'Left',
  right: 'Right', bottom: 'Bottom', baseline: 'Baseline',
  width: 'Width', w: 'Width', height: 'Height', h: 'Height',
  'font size': 'Font size', size: 'Font size', 'text size': 'Font size', 'point size': 'Font size',
  font: 'Font', typeface: 'Font', 'font family': 'Font', family: 'Font',
  bold: 'Bold', italic: 'Italic', underline: 'Underline',
  colour: 'Colour', color: 'Colour', 'text colour': 'Colour', 'text color': 'Colour',
  fill: 'Fill', 'background colour': 'Fill', 'background color': 'Fill',
  wording: 'Wording', text: 'Wording', copy: 'Wording', label: 'Wording', caption: 'Wording',
  'line spacing': 'Line spacing', leading: 'Line spacing', 'line height': 'Line spacing',
  rows: 'Rows', 'row count': 'Rows', columns: 'Columns', 'column count': 'Columns',
  'file name': 'File name', file: 'File name', image: 'File name',
  alignment: 'Alignment', align: 'Alignment', case: 'Case',
  pattern: 'Pattern', note: 'Note', notes: 'Note',
};

/** The group a parameter belongs to, as the v2 template writes it. */
const GROUP: Record<string, string> = {
  Top: 'Position', Left: 'Position', Right: 'Position', Bottom: 'Position', Baseline: 'Position',
  Width: 'Size', Height: 'Size',
  'File name': 'Image',
  Wording: 'Text', Alignment: 'Text', Case: 'Text', 'Line spacing': 'Text', Pattern: 'Text',
  'Font size': 'Font', Font: 'Font', Bold: 'Font', Italic: 'Font', Underline: 'Font',
  Colour: 'Colour', Fill: 'Colour',
  Rows: 'Table', Columns: 'Table',
  Note: 'Note',
};

/** Unit words as people write them, and the v2 unit. */
const UNIT: [RegExp, string][] = [
  [/^(in|ins|inch|inches|")$/i, 'in'],
  [/^(mm|millimetre|millimetres|millimeter|millimeters)$/i, 'mm'],
  [/^(cm|centimetre|centimetres|centimeter|centimeters)$/i, 'cm'],
  [/^(pt|pts|point|points)$/i, 'pt'],
  [/^(px|pixel|pixels)$/i, 'px'],
  [/^%$/, '%'],
];

const EDGES = [
  'top of page', 'left of page', 'right of page', 'bottom of page',
  'top of container', 'left of container', 'right of container', 'bottom of container',
];

// ── prose ─────────────────────────────────────────────────────────────

export interface Prose {
  value: DraftCell;
  unit: DraftCell;
  from: DraftCell;
}

/**
 * One legacy value cell, pulled apart into Value, Unit and From.
 *
 * Everything this finds is `inferred`, including the number: the sentence said
 * "5.75 inches from top of page" and the three v2 cells are this reader's
 * reading of it, not the author's writing of it. Only a cell copied across
 * unchanged is `read`.
 */
export function parseProse(raw: string): Prose {
  const s = raw.trim();
  if (!s) return { value: read(''), unit: read(''), from: read('') };

  // A measurement: a number, optionally a unit, optionally an edge.
  const m = s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*([A-Za-z%"]*)\b/);
  if (m) {
    const n = m[1].replace(',', '.');
    const word = m[2] ?? '';
    const unitHit = UNIT.find(([re]) => re.test(word));
    const edge = EDGES.find((e) => s.toLowerCase().includes(e))
      // "from the top" with no noun is still an edge of the page: say so, and
      // let the person confirm it, which is what the highlight is for.
      ?? (/\bfrom (the )?top\b/i.test(s) ? 'top of page'
        : /\bfrom (the )?left\b/i.test(s) ? 'left of page'
          : /\bfrom (the )?right\b/i.test(s) ? 'right of page'
            : /\bfrom (the )?bottom\b/i.test(s) ? 'bottom of page' : null);

    return {
      value: inferred(n),
      // A number with no unit word anywhere is the one thing never guessed:
      // decision 7a has no default unit, and inventing one here would put a
      // confident wrong figure in front of the person confirming the draft.
      unit: unitHit ? inferred(unitHit[1]) : unreadable(''),
      from: edge ? inferred(edge) : read(''),
    };
  }

  // A colour, which people write as a hex or a name.
  if (/^#?[0-9a-f]{6}$/i.test(s)) {
    return { value: inferred(s.startsWith('#') ? s.toUpperCase() : '#' + s.toUpperCase()), unit: read(''), from: read('') };
  }

  // Anything else is prose, and prose is the value: wording, a font name, Yes.
  return { value: read(s), unit: read(''), from: read('') };
}

// ── the sheet ─────────────────────────────────────────────────────────

const at = (sheet: ImportedSheet, row: number, col: number) =>
  (sheet.text?.[row]?.[col] ?? '').trim();

/** The columns a legacy sheet is read from, found by their headings. */
interface Columns {
  header: number;
  element: number;
  part: number;
  parameter: number;
  value: number;
  notes: number;
}

const HEADING: Record<keyof Omit<Columns, 'header'>, RegExp> = {
  element: /^(element|section|area|block|item)$/i,
  part: /^(part|sub.?element|component|detail)$/i,
  parameter: /^(parameter|property|attribute|field|spec|specification)$/i,
  value: /^(value|setting|requirement|description|details?)$/i,
  notes: /^(notes?|comments?|remarks?)$/i,
};

/**
 * Which column is which, read from a heading row.
 *
 * Nothing is positional. A sheet whose columns cannot be named is refused with
 * that said, rather than read from column A on the assumption that it is the
 * element — the assumption is right often enough to be dangerous.
 */
function findColumns(sheet: ImportedSheet): Columns | null {
  const limit = Math.min(sheet.text?.length ?? 0, 12);
  for (let r = 0; r < limit; r++) {
    const cells = sheet.text?.[r] ?? [];
    const find = (re: RegExp) => cells.findIndex((c) => re.test((c ?? '').trim()));
    const parameter = find(HEADING.parameter);
    const value = find(HEADING.value);
    if (parameter < 0 || value < 0) continue;
    return {
      header: r,
      element: find(HEADING.element),
      part: find(HEADING.part),
      parameter,
      value,
      notes: find(HEADING.notes),
    };
  }
  return null;
}

/** `"A2:A6"` → the rectangle it covers. */
function parseRange(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = (s: string) => {
    let n = 0;
    for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  return { c1: col(m[1]), r1: Number(m[2]) - 1, c2: col(m[3]), r2: Number(m[4]) - 1 };
}

/**
 * The label covering each cell, from the declared merge ranges.
 *
 * Decision 8 calls this forward-filling, and it is — but from the file's own
 * ranges, not by copying the last non-blank value downwards. A merge states
 * which rows a label covers; guessing would also cover the rows where a label
 * is genuinely missing.
 */
function mergeLookup(sheet: ImportedSheet): Map<string, string> {
  const out = new Map<string, string>();
  for (const ref of (sheet as unknown as { merges?: string[] }).merges ?? []) {
    const r = parseRange(ref);
    if (!r) continue;
    const value = at(sheet, r.r1, r.c1);
    for (let row = r.r1; row <= r.r2; row++) {
      for (let col = r.c1; col <= r.c2; col++) out.set(`${row}:${col}`, value);
    }
  }
  return out;
}

/** Whether a workbook is the legacy layout: v2 is known by its Pages List. */
export function looksLegacy(book: SpecWorkbook): boolean {
  return !book.workbook.sheets.some((s) => s.name.trim().toLowerCase() === 'pages list');
}

/**
 * A legacy workbook, read as far as it honestly can be.
 *
 * The result is a draft: rows with every cell marked read, inferred or
 * unreadable. It is never compiled.
 */
export function readLegacy(book: SpecWorkbook): LegacyDraft {
  const notes: IntakeNote[] = [...book.notes];
  const rows: DraftRow[] = [];
  const pages: { tab: string; name: string }[] = [];

  for (const sheet of book.sheets) {
    const cols = findColumns(sheet);
    if (!cols) {
      notes.push({
        severity: 'error', sheet: sheet.name,
        message: 'No heading row names a Parameter and a Value column, so there is no way ' +
          'to tell which column holds what. Add a heading row and upload it again.',
      });
      continue;
    }

    pages.push({ tab: sheet.name, name: sheet.name });
    const merged = mergeLookup(sheet);
    const label = (r: number, c: number) => (c < 0 ? '' : merged.get(`${r}:${c}`) ?? at(sheet, r, c));

    for (let r = cols.header + 1; r < (sheet.text?.length ?? 0); r++) {
      const rawParam = at(sheet, r, cols.parameter);
      const rawValue = at(sheet, r, cols.value);
      if (!rawParam && !rawValue) continue;

      const canonical = PARAMETER[rawParam.toLowerCase().replace(/[:\s]+$/, '')];
      const parameter = canonical
        ? (canonical === rawParam ? read(rawParam) : inferred(canonical))
        : unreadable(rawParam);
      if (!canonical) {
        notes.push({
          severity: 'warning', sheet: sheet.name, cell: cellRef(r, cols.parameter),
          message: `“${rawParam}” is not a parameter this reader knows, so the draft leaves ` +
            'it red for you to name.',
        });
      }

      const prose = parseProse(rawValue);
      if (prose.unit.origin === 'unreadable' && canonical && /^(Top|Left|Right|Bottom|Width|Height|Font size|Line spacing)$/.test(canonical)) {
        notes.push({
          severity: 'warning', sheet: sheet.name, cell: cellRef(r, cols.value),
          message: `“${rawValue}” gives no unit. There is no default — say in, mm, cm, pt, px ` +
            'or % in the draft before uploading it.',
        });
      }

      const element = label(r, cols.element);
      const group = canonical ? GROUP[canonical] : undefined;

      rows.push({
        sheet: sheet.name,
        sourceRow: r + 1,
        element: element ? read(element) : unreadable(''),
        part: read(label(r, cols.part)),
        group: group ? inferred(group) : unreadable(''),
        parameter,
        value: prose.value,
        unit: prose.unit,
        from: prose.from,
        notes: cols.notes >= 0 ? at(sheet, r, cols.notes) : '',
      });
    }
  }

  if (rows.length > 0) {
    notes.push({
      severity: 'info',
      message: `${rows.length} rows were read as a draft. Nothing here is checked against a ` +
        'PDF: confirm the highlighted cells in Excel and upload the confirmed workbook ' +
        '(SR-SPEC-INTAKE decision 8).',
    });
  }

  return { workbook: book.name, pages, rows, notes };
}

/** How many cells a person has to confirm, for the banner above the draft. */
export function draftCounts(draft: LegacyDraft): { inferred: number; unreadable: number; rows: number } {
  let inf = 0;
  let bad = 0;
  for (const row of draft.rows) {
    for (const cell of [row.element, row.part, row.group, row.parameter, row.value, row.unit, row.from]) {
      if (cell.origin === 'inferred') inf++;
      if (cell.origin === 'unreadable') bad++;
    }
  }
  return { inferred: inf, unreadable: bad, rows: draft.rows.length };
}
