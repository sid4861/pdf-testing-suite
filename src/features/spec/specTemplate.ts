/**
 * Reading a Template v2 workbook (SR-SPEC-INTAKE decisions 7 and 7a).
 *
 * The workbook is the truth, so the one rule under everything here is: **read
 * what the sheet states, never what it implies.** A blank cell is blank, not
 * "the same as the row above"; a unit is the Unit cell, not the parameter's
 * usual unit; a merge is the range the file declares, not a run of blanks that
 * looks like one. Everything that cannot be read becomes a validation line with
 * its cell, never a guessed assertion — a spec that quietly invents a number is
 * worse than one that refuses to.
 *
 * This produces the **extraction**: every row of the workbook, parsed and
 * judged. Turning it into the spec JSON the checker runs is the next step.
 */

import type { ImportedSheet } from '@sheetpane/import';
import { cellRef, colName, type IntakeNote, type SpecWorkbook } from './specIntake';
import { parseNumericValue, type ParsedValue } from './specValues';

// ── the shapes ────────────────────────────────────────────────────────

/** What a parameter is and what it may carry, from the Lists sheet. */
export interface ParameterRule {
  name: string;
  kind: string;
  unitsAllowed: string[];
  unitRequired: boolean;
  numberRequired: boolean;
  fromRequired: boolean;
}

export interface Vocabulary {
  groups: string[];
  units: string[];
  parameters: Map<string, ParameterRule>;
  froms: string[];
  checks: string[];
  cases: string[];
  fonts: string[];
  /** Named colour → hex, lower-cased name. */
  colours: Map<string, string>;
}

export interface Settings {
  templateVersion: string | null;
  positionTolerance: number | null;
  sizeTolerance: number | null;
  fontSizeTolerance: number | null;
  spacingTolerance: number | null;
  colourThreshold: number | null;
  pageWidth: number | null;
  pageHeight: number | null;
  pageUnit: string | null;
  pixelsPerInch: number | null;
}

export interface PageListEntry {
  sheet: string;
  row: number;
  tab: string;
  name: string;
  type: 'Required' | 'Optional' | 'Conditional' | string;
  orientation: string;
  variantGroup: string;
  repeats: string;
  identifyingText: string;
  comments: string;
}

/** One parameter row of a page sheet, as written. */
export interface SpecRow {
  sheet: string;
  /** 1-based, as Excel shows it — the row's identity (decision 7). */
  row: number;
  element: string;
  part: string;
  group: string;
  parameter: string;
  value: string;
  unit: string;
  from: string;
  check: string;
  tolerance: string;
  exactText: string;
  pattern: string;
  notes: string;
  /** What the Value cell holds, once read (decision 9). */
  parsed: ParsedValue;
  /** Struck through in Excel: kept, listed, and not checked (decision 11). */
  struck: boolean;
  /** False when the row failed validation and yields no assertion. */
  usable: boolean;
}

export interface Extraction {
  workbook: string;
  sha256: string | null;
  vocabulary: Vocabulary;
  settings: Settings;
  pages: PageListEntry[];
  rows: SpecRow[];
  notes: IntakeNote[];
}

// ── small helpers ─────────────────────────────────────────────────────

const at = (sheet: ImportedSheet, row: number, col: number) =>
  (sheet.text?.[row]?.[col] ?? '').trim();

const blankRow = (sheet: ImportedSheet, row: number) =>
  (sheet.text?.[row] ?? []).every((c) => !c || !c.trim());

/** A number as written, or null. Accepts a comma decimal; refuses prose. */
function asNumber(raw: string): number | null {
  const s = raw.trim().replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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
 * The value of a merged cell, for every cell the merge covers.
 *
 * This is the difference between reading and guessing. Excel stores a merged
 * label once, at the range's top-left, and leaves the rest blank; the file also
 * states the range. Taking the value from the declared range is reading it.
 * Copying the last non-blank value downwards would produce the same answer here
 * and a wrong one the moment a label is genuinely missing — which is a mistake
 * worth catching, not papering over.
 */
function mergeLookup(sheet: ImportedSheet): Map<string, string> {
  const out = new Map<string, string>();
  const merges = (sheet as unknown as { merges?: string[] }).merges ?? [];
  for (const ref of merges) {
    const r = parseRange(ref);
    if (!r) continue;
    const value = at(sheet, r.r1, r.c1);
    for (let row = r.r1; row <= r.r2; row++) {
      for (let col = r.c1; col <= r.c2; col++) out.set(`${row}:${col}`, value);
    }
  }
  return out;
}

// ── the Lists sheet ───────────────────────────────────────────────────

/**
 * Whether a cell is struck through, from the style tables.
 *
 * `styleIndex` gives the cell's `cellXfs` entry, which names a font; the font
 * carries `strike`. Reading it is the only way to see an editing mark — the
 * cell's text is unchanged, which is exactly why people use it.
 */
function isStruck(
  sheet: ImportedSheet,
  styles: { cellXfs?: { fontId?: number }[]; fonts?: { strike?: boolean }[] },
  row: number,
  col: number,
): boolean {
  const xf = sheet.styleIndex?.[cellRef(row, col)];
  if (xf == null) return false;
  const fontId = styles.cellXfs?.[xf]?.fontId;
  if (fontId == null) return false;
  return styles.fonts?.[fontId]?.strike === true;
}

/** Read one column downwards until it runs out. */
function column(sheet: ImportedSheet, col: number, from = 1): string[] {
  const out: string[] = [];
  for (let r = from; r < sheet.text.length; r++) {
    const v = at(sheet, r, col);
    if (v) out.push(v);
  }
  return out;
}

const yes = (s: string) => /^y(es)?$/i.test(s.trim());

/**
 * The Lists sheet: the label vocabulary the whole workbook is checked against.
 *
 * Seven short tables side by side, each read down its own column. A parameter
 * that is not here is an error on the row that used it (decision 7) — the sheet
 * is the closed list, not a suggestion.
 */
export function readLists(sheet: ImportedSheet): Vocabulary {
  const header = (sheet.text?.[0] ?? []).map((h) => h.trim().toLowerCase());
  const find = (name: string) => header.indexOf(name);

  const cGroup = find('group');
  const cUnit = find('unit');
  const cParam = find('parameter');
  const cFrom = find('from');
  const cCheck = find('check?');
  const cCase = find('case');
  const cFont = find('font');
  const cColour = find('colour name');
  const cHex = find('hex');

  const parameters = new Map<string, ParameterRule>();
  if (cParam >= 0) {
    for (let r = 1; r < sheet.text.length; r++) {
      const name = at(sheet, r, cParam);
      if (!name) continue;
      parameters.set(name.toLowerCase(), {
        name,
        kind: at(sheet, r, cParam + 1),
        unitsAllowed: at(sheet, r, cParam + 2).split(/\s+/).filter(Boolean),
        unitRequired: yes(at(sheet, r, cParam + 3)),
        numberRequired: yes(at(sheet, r, cParam + 4)),
        fromRequired: yes(at(sheet, r, cParam + 5)),
      });
    }
  }

  const colours = new Map<string, string>();
  if (cColour >= 0 && cHex >= 0) {
    for (let r = 1; r < sheet.text.length; r++) {
      const name = at(sheet, r, cColour);
      const hex = at(sheet, r, cHex);
      if (name && hex) colours.set(name.toLowerCase(), hex.toUpperCase());
    }
  }

  return {
    groups: cGroup >= 0 ? column(sheet, cGroup) : [],
    units: cUnit >= 0 ? column(sheet, cUnit) : [],
    parameters,
    froms: cFrom >= 0 ? column(sheet, cFrom) : [],
    checks: cCheck >= 0 ? column(sheet, cCheck) : [],
    cases: cCase >= 0 ? column(sheet, cCase) : [],
    fonts: cFont >= 0 ? column(sheet, cFont) : [],
    colours,
  };
}

// ── the Settings sheet ────────────────────────────────────────────────

/**
 * Settings: this workbook's own tolerances and page size.
 *
 * Read by the name in the Setting column, not by row position, so inserting a
 * row cannot silently shift every value by one.
 */
export function readSettings(sheet: ImportedSheet): { settings: Settings; notes: IntakeNote[] } {
  const notes: IntakeNote[] = [];
  const byName = new Map<string, { value: string; unit: string; row: number }>();
  for (let r = 1; r < sheet.text.length; r++) {
    const name = at(sheet, r, 0).toLowerCase();
    if (name) byName.set(name, { value: at(sheet, r, 1), unit: at(sheet, r, 2), row: r });
  }

  const num = (name: string): number | null => {
    const e = byName.get(name);
    if (!e || !e.value) return null;
    const n = asNumber(e.value);
    if (n == null) {
      notes.push({
        severity: 'error',
        sheet: sheet.name,
        cell: cellRef(e.row, 1),
        message: `“${name}” must be a number; it reads “${e.value}”.`,
      });
    }
    return n;
  };

  const settings: Settings = {
    templateVersion: byName.get('template version')?.value || null,
    positionTolerance: num('position tolerance'),
    sizeTolerance: num('size tolerance'),
    fontSizeTolerance: num('font size tolerance'),
    spacingTolerance: num('line spacing tolerance'),
    colourThreshold: num('colour threshold'),
    pageWidth: num('page width'),
    pageHeight: num('page height'),
    pageUnit: byName.get('page width')?.unit || null,
    pixelsPerInch: num('pixels per inch'),
  };

  if (settings.templateVersion && settings.templateVersion !== '2') {
    notes.push({
      severity: 'warning',
      sheet: sheet.name,
      cell: cellRef(byName.get('template version')!.row, 1),
      message: `This workbook says it is template version ${settings.templateVersion}; this reader is written for version 2.`,
    });
  }

  return { settings, notes };
}

// ── the Pages List sheet ──────────────────────────────────────────────

const PAGE_TYPES = ['Required', 'Optional', 'Conditional'];

/**
 * The Pages List: one row per PDF page, in the order they are expected.
 *
 * Stops at the first blank row — what follows is the sheet's own prose notes to
 * whoever is filling it in, not pages.
 */
export function readPagesList(sheet: ImportedSheet): { pages: PageListEntry[]; notes: IntakeNote[] } {
  const notes: IntakeNote[] = [];
  const pages: PageListEntry[] = [];

  for (let r = 1; r < sheet.text.length; r++) {
    if (blankRow(sheet, r)) break;
    const tab = at(sheet, r, 0);
    const name = at(sheet, r, 1);
    if (!tab && !name) break;

    const type = at(sheet, r, 2);
    if (type && !PAGE_TYPES.includes(type)) {
      notes.push({
        severity: 'error',
        sheet: sheet.name,
        cell: cellRef(r, 2),
        message: `Page type must be one of ${PAGE_TYPES.join(', ')}; it reads “${type}”.`,
      });
    }
    if (!at(sheet, r, 6)) {
      notes.push({
        severity: 'warning',
        sheet: sheet.name,
        cell: cellRef(r, 6),
        message: `Page “${name || tab}” has no identifying text, so it can only be found by its position.`,
      });
    }

    pages.push({
      sheet: sheet.name, row: r + 1,
      tab, name, type, orientation: at(sheet, r, 3),
      variantGroup: at(sheet, r, 4), repeats: at(sheet, r, 5),
      identifyingText: at(sheet, r, 6), comments: at(sheet, r, 7),
    });
  }

  return { pages, notes };
}

// ── a page sheet ──────────────────────────────────────────────────────

const COL = {
  element: 0, part: 1, group: 2, parameter: 3, value: 4, unit: 5,
  from: 6, check: 7, tolerance: 8, exactText: 9, pattern: 10, notes: 11,
} as const;

/** A unit written where a number belongs: "28 pt", "5.75 in". */
const UNIT_IN_VALUE = /^-?\d*\.?\d+\s*(in|mm|cm|pt|px|%|inch(es)?|point(s)?)\b/i;

/**
 * One page sheet, row by row (decisions 7 and 7a).
 *
 * Every rule here refuses rather than guesses, because the alternative is a
 * spec that asserts something nobody wrote. A row that breaks one is kept in
 * the extraction and marked unusable, so it shows in coverage instead of
 * vanishing.
 */
export function readPageSheet(
  sheet: ImportedSheet,
  vocab: Vocabulary,
  settings: Settings,
  styles: { cellXfs?: { fontId?: number }[]; fonts?: { strike?: boolean }[] } = {},
): { rows: SpecRow[]; notes: IntakeNote[] } {
  const notes: IntakeNote[] = [];
  const rows: SpecRow[] = [];
  const merged = mergeLookup(sheet);

  // Merges belong to the three label columns only (decision 7).
  for (const ref of (sheet as unknown as { merges?: string[] }).merges ?? []) {
    const r = parseRange(ref);
    if (r && r.c2 > COL.group) {
      notes.push({
        severity: 'error', sheet: sheet.name, cell: ref,
        message: `A merge may cover Element, Part or Group only; this one reaches ${colName(r.c2)}.`,
      });
    }
  }

  const label = (r: number, col: number): string => at(sheet, r, col) || merged.get(`${r}:${col}`) || '';

  for (let r = 1; r < sheet.text.length; r++) {
    if (blankRow(sheet, r)) continue;

    const parameter = at(sheet, r, COL.parameter);
    if (!parameter) continue; // a spacer or a note row, not a parameter

    const row: SpecRow = {
      sheet: sheet.name, row: r + 1,
      element: label(r, COL.element),
      part: label(r, COL.part),
      group: label(r, COL.group),
      parameter,
      value: at(sheet, r, COL.value),
      unit: at(sheet, r, COL.unit),
      from: at(sheet, r, COL.from),
      check: at(sheet, r, COL.check),
      tolerance: at(sheet, r, COL.tolerance),
      exactText: at(sheet, r, COL.exactText),
      pattern: at(sheet, r, COL.pattern),
      notes: at(sheet, r, COL.notes),
      parsed: { kind: 'empty' },
      struck: isStruck(sheet, styles, r, COL.parameter) || isStruck(sheet, styles, r, COL.value),
      usable: true,
    };

    // Decision 11 — a struck row is history the author kept on purpose. It is
    // listed so the reader can see it was meant to be dropped, and no check is
    // built from it.
    if (row.struck) {
      notes.push({
        severity: 'info', sheet: sheet.name, cell: cellRef(r, COL.parameter),
        message: `“${parameter}” is struck through, so it was not checked.`,
      });
      row.usable = false;
      rows.push(row);
      continue;
    }

    const bad = (col: number, message: string) => {
      notes.push({ severity: 'error', sheet: sheet.name, cell: cellRef(r, col), message });
      row.usable = false;
    };

    // A label that is neither written nor covered by a merge is missing. The
    // reader never fills it in from the row above (decision 7).
    if (!row.element) bad(COL.element, 'Element is blank and not covered by a merge.');
    if (!row.group) bad(COL.group, 'Group is blank and not covered by a merge.');

    const rule = vocab.parameters.get(parameter.toLowerCase());
    if (!rule) {
      bad(COL.parameter, `“${parameter}” is not on the Lists sheet, so there is no rule for what it may hold.`);
      rows.push(row);
      continue;
    }

    // ── decision 7a · units are explicit, closed and checked ─────────
    if (UNIT_IN_VALUE.test(row.value)) {
      bad(COL.value, `The unit belongs in the Unit cell: Value reads “${row.value}”.`);
    }
    if (rule.unitRequired && !row.unit) {
      bad(COL.unit, `“${rule.name}” needs a unit; the Unit cell is blank. There is no default.`);
    }
    if (row.unit && rule.unitsAllowed.length && !rule.unitsAllowed.includes(row.unit)) {
      bad(COL.unit, `“${rule.name}” cannot be given in ${row.unit}; allowed: ${rule.unitsAllowed.join(', ')}.`);
    }
    if (row.unit === 'px' && settings.pixelsPerInch == null) {
      bad(COL.unit, 'px needs “Pixels per inch” on the Settings sheet, which is blank.');
    }
    // One cause, one message: a unit written into Value also makes it
    // "not a number", and reporting both would have the reviewer fix one
    // defect twice.
    const unitInValue = UNIT_IN_VALUE.test(row.value);
    if (rule.numberRequired && row.value && !unitInValue) {
      row.parsed = parseNumericValue(row.value, !!row.tolerance);
      if (row.parsed.kind === 'error') bad(COL.value, row.parsed.message);
    } else if (row.value) {
      row.parsed = { kind: 'text', value: row.value };
    }
    if (rule.fromRequired && !row.from) {
      bad(COL.from, `“${rule.name}” is measured from an edge; the From cell is blank. There is no default.`);
    }

    // A named colour has one hex, and the Lists sheet is where it is stated.
    // The name in Notes is what makes this checkable: without it the hex would
    // be whatever was typed.
    if (rule.kind === 'colour' && row.notes) {
      const known = vocab.colours.get(row.notes.trim().toLowerCase());
      if (known && row.value && known.toUpperCase() !== row.value.trim().toUpperCase()) {
        bad(COL.value, `${row.notes.trim()} is ${known} on the Lists sheet, not ${row.value.trim()}.`);
      }
    }
    if (row.check && vocab.checks.length && !vocab.checks.includes(row.check)) {
      bad(COL.check, `Check? must be one of ${vocab.checks.join(', ')}; it reads “${row.check}”.`);
    }

    rows.push(row);
  }

  return { rows, notes };
}

// ── the whole workbook ────────────────────────────────────────────────

const RESERVED = new Set(['pages list', 'settings', 'lists']);

/**
 * Read a Template v2 workbook into its extraction.
 *
 * Every sheet named in the Pages List is read as a page sheet; a sheet that is
 * neither reserved nor listed is reported rather than read, because a page
 * nobody declared is as likely to be a leftover as a page.
 */
export function readTemplate(book: SpecWorkbook): Extraction {
  const notes: IntakeNote[] = [...book.notes];
  const sheet = (name: string) =>
    book.sheets.find((s) => s.name.trim().toLowerCase() === name);

  const listsSheet = sheet('lists');
  const settingsSheet = sheet('settings');
  const pagesSheet = sheet('pages list');

  for (const [name, found] of [['Lists', listsSheet], ['Settings', settingsSheet], ['Pages List', pagesSheet]] as const) {
    if (!found) {
      notes.push({
        severity: 'error',
        message: `This workbook has no “${name}” sheet, so it is not a Template v2 spec.`,
      });
    }
  }

  const vocabulary: Vocabulary = listsSheet
    ? readLists(listsSheet)
    : { groups: [], units: [], parameters: new Map(), froms: [], checks: [], cases: [], fonts: [], colours: new Map() };

  const settingsRead = settingsSheet
    ? readSettings(settingsSheet)
    : { settings: {
        templateVersion: null, positionTolerance: null, sizeTolerance: null,
        fontSizeTolerance: null, spacingTolerance: null, colourThreshold: null,
        pageWidth: null, pageHeight: null, pageUnit: null, pixelsPerInch: null,
      } as Settings, notes: [] };
  notes.push(...settingsRead.notes);

  const pagesRead = pagesSheet ? readPagesList(pagesSheet) : { pages: [], notes: [] };
  notes.push(...pagesRead.notes);

  const rows: SpecRow[] = [];
  const listed = new Set(pagesRead.pages.map((p) => p.tab.trim().toLowerCase()));

  for (const s of book.sheets) {
    const key = s.name.trim().toLowerCase();
    if (RESERVED.has(key)) continue;
    if (!listed.has(key)) {
      notes.push({
        severity: 'warning', sheet: s.name,
        message: 'This sheet is not in the Pages List, so it was not read as a page.',
      });
      continue;
    }
    const out = readPageSheet(s, vocabulary, settingsRead.settings, book.workbook.styles);
    rows.push(...out.rows);
    notes.push(...out.notes);
  }

  for (const p of pagesRead.pages) {
    if (!book.sheets.some((s) => s.name.trim().toLowerCase() === p.tab.trim().toLowerCase())) {
      notes.push({
        severity: p.type === 'Required' ? 'error' : 'warning',
        sheet: p.sheet, cell: `A${p.row}`,
        message: `The Pages List names tab “${p.tab}”, which this workbook has no sheet for.`,
      });
    }
  }

  return {
    workbook: book.name,
    sha256: book.sha256,
    vocabulary,
    settings: settingsRead.settings,
    pages: pagesRead.pages,
    rows,
    notes,
  };
}
