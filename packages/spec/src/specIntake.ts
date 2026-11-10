/**
 * Spec intake — getting a workbook into the app safely, and saying what was
 * skipped (SR-SPEC-INTAKE decisions 1, 3, 4, 5, 6).
 *
 * The reading itself is `@sheetpane/import`'s `read()`: one reader, in the
 * browser and under Node, giving a plain `Workbook` object. Nothing here walks
 * the zip. What this file adds is the part that belongs to pdfsuite — which
 * files are accepted, what each refusal means to a reviewer, and an honest
 * account of everything in the workbook that was *not* read.
 *
 * Turning that workbook into a spec is `specTemplate.ts`; checking a PDF
 * against the spec is `specCheck.ts`.
 */

import { read, ImportError } from '@sheetpane/import';
import type { ImportedWorkbook, ImportedSheet } from '@sheetpane/import';
import { MAX_UPLOAD_BYTES, MAX_UNZIPPED_BYTES } from '@pdfsuite/core';

// ── what the upload accepts ───────────────────────────────────────────

export type SpecUploadKind = 'xlsx' | 'json';

/**
 * Why a file was refused, and what to tell the person holding it.
 *
 * Every message names the file's own problem and the way out. "Unsupported
 * format" tells a reviewer nothing they can act on; "save it as .xlsx" does.
 */
export class SpecIntakeError extends Error {
  constructor(
    readonly code:
      | 'xls'
      | 'xlsm'
      | 'csv'
      | 'password'
      | 'not-workbook'
      | 'too-large'
      | 'corrupt'
      | 'unsupported',
    message: string,
    /** sheetpane's own code, when the refusal came from the reader. */
    readonly spCode?: string,
  ) {
    super(message);
    this.name = 'SpecIntakeError';
  }
}

const EXT = /\.([a-z0-9]+)$/i;

/**
 * What kind of spec this file is, or why it cannot be one.
 *
 * Decided on the extension, before a byte is read: the three near-misses
 * (`.xls`, `.xlsm`, `.csv`) each get their own message because each has a
 * different way out, and a reviewer who uploaded the wrong one of three
 * lookalike files needs to be told which.
 */
export function uploadKind(name: string): SpecUploadKind {
  const ext = (name.match(EXT)?.[1] ?? '').toLowerCase();
  switch (ext) {
    case 'xlsx':
      return 'xlsx';
    case 'json':
      return 'json';
    case 'xls':
      throw new SpecIntakeError(
        'xls',
        'This is the old .xls format. Open it in Excel and “Save As” .xlsx, then upload it again.',
      );
    case 'xlsm':
      throw new SpecIntakeError(
        'xlsm',
        'This workbook holds macros (.xlsm). Save it as .xlsx — the spec needs no macros — and upload it again.',
      );
    case 'csv':
      throw new SpecIntakeError(
        'csv',
        'A spec is a workbook, not a single sheet: a .csv carries no Pages List, Lists or Settings. Upload the .xlsx.',
      );
    default:
      throw new SpecIntakeError(
        'unsupported',
        `“${name}” is neither a .xlsx workbook nor a .json spec.`,
      );
  }
}

/** sheetpane's typed refusals, in words a reviewer can act on (decision 1). */
function fromImportError(err: ImportError): SpecIntakeError {
  const sp = (err as { spCode?: string }).spCode;
  switch (err.code) {
    case 'password-or-legacy':
      return new SpecIntakeError(
        'password',
        'This workbook is password-protected. Remove the password and re-upload — the file is never sent anywhere, but it cannot be opened while it is encrypted.',
        sp,
      );
    case 'too-large':
      return new SpecIntakeError(
        'too-large',
        `This workbook unpacks to more than the ${Math.round(MAX_UNZIPPED_BYTES / 1024 / 1024)} MB limit. A spec of that size usually means embedded screenshots — those are never read, so deleting them will not lose anything the check uses.`,
        sp,
      );
    case 'corrupt':
      return new SpecIntakeError(
        'corrupt',
        'This file is damaged and cannot be opened. Try re-saving it from Excel.',
        sp,
      );
    case 'not-workbook':
      return new SpecIntakeError(
        'not-workbook',
        'This file is not an Excel workbook, whatever its name says.',
        sp,
      );
    default:
      return new SpecIntakeError('unsupported', err.message, sp);
  }
}

// ── what was not read ─────────────────────────────────────────────────

/**
 * Every kind of refusal the reader can raise — a **closed** list
 * (SR-SPEC-INTAKE decision 13, W-48 DoD 1).
 *
 * Closed on purpose. A code is what anything other than a human reads: the
 * oracle test, the Validation sheet in the annotated workbook, and any rule
 * somebody later writes over a batch of workbooks. Messages get reworded;
 * codes do not, and adding one is a deliberate act rather than a typo in a
 * string.
 */
export const INTAKE_CODES = [
  // decision 7a — a unit is its own cell, from a closed list, never inferred
  'unit-missing',
  'unit-in-value',
  'unit-unknown',
  'unit-disallowed',
  'px-without-density',
  // the value itself
  'number-expected',
  'approximate-value',
  'range-reversed',
  'range-and-tolerance',
  // the row's other cells
  'from-missing',
  'parameter-unknown',
  'colour-name-mismatch',
  'check-unknown',
  'label-blank-outside-merge',
  // the file and its sheets
  'settings-unreadable',
  'pages-list-unreadable',
  'sheet-missing',
  'template-version-unknown',
] as const;

export type IntakeCode = (typeof INTAKE_CODES)[number];

export interface IntakeNote {
  severity: 'error' | 'warning' | 'info';
  /**
   * Which kind of refusal this is. Absent only on a note that is not one of
   * the closed kinds — an `info` line about something skipped, say.
   */
  code?: IntakeCode;
  /** The sheet this is about, when it is about one. */
  sheet?: string;
  /** The cell or range, when it is about one. */
  cell?: string;
  message: string;
}

export interface SpecWorkbook {
  name: string;
  /** The SHA-256 of the bytes read, for the report's record of the pair tested. */
  sha256: string | null;
  workbook: ImportedWorkbook;
  /** Sheets that will be parsed: visible ones, in workbook order. */
  sheets: ImportedSheet[];
  /** Everything skipped or worth saying, each with its sheet and cell. */
  notes: IntakeNote[];
  /**
   * The file as uploaded.
   *
   * Kept because the annotated workbook (decision 14) is *this* file with red
   * cells added — a rebuilt one would lose the author's formatting, their
   * notes column and their screenshots, which is most of what makes it theirs.
   */
  bytes: Uint8Array;
}

/** Column letters for a 0-based index: 0 → A, 26 → AA. */
export function colName(i: number): string {
  let n = i + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export const cellRef = (row: number, col: number) => `${colName(col)}${row + 1}`;

/** Rows hidden by a filter rather than by hand, as far as the file can say. */
function filteredRows(sheet: ImportedSheet): number[] {
  if (!sheet.autoFilter) return [];
  const m = sheet.autoFilter.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
  if (!m) return [];
  const from = Number(m[1]) - 1;
  const to = Number(m[2]) - 1;
  return sheet.hiddenRows.filter((r) => r >= from && r <= to);
}

/**
 * Account for everything the parser will not see (decisions 5 and 6).
 *
 * "Only what is visible is read" is a rule that can quietly lose a page, so
 * every hidden thing is listed rather than merely skipped. A reviewer who hid a
 * row last month and forgot has to be able to see that here.
 */
function visibilityNotes(wb: ImportedWorkbook): IntakeNote[] {
  const notes: IntakeNote[] = [];

  for (const sheet of wb.sheets) {
    if (sheet.state !== 'visible') {
      notes.push({
        severity: 'warning',
        sheet: sheet.name,
        message:
          sheet.state === 'veryHidden'
            ? 'Sheet is very hidden (it cannot be unhidden from Excel’s menu) and was not read.'
            : 'Sheet is hidden and was not read. If it is named in the Pages List, that page is uncovered.',
      });
      continue;
    }

    const filtered = filteredRows(sheet);
    const byHand = sheet.hiddenRows.filter((r) => !filtered.includes(r));
    if (byHand.length) {
      notes.push({
        severity: 'warning',
        sheet: sheet.name,
        cell: byHand.map((r) => r + 1).join(', '),
        message: `${byHand.length} hidden row${byHand.length === 1 ? '' : 's'} were not read.`,
      });
    }
    if (filtered.length) {
      notes.push({
        severity: 'warning',
        sheet: sheet.name,
        cell: filtered.map((r) => r + 1).join(', '),
        message: `${filtered.length} row${filtered.length === 1 ? '' : 's'} hidden by a filter were not read. Clear the filter to include them.`,
      });
    }
    if (sheet.hiddenCols.length) {
      notes.push({
        severity: 'warning',
        sheet: sheet.name,
        cell: sheet.hiddenCols.map(colName).join(', '),
        message: `${sheet.hiddenCols.length} hidden column${sheet.hiddenCols.length === 1 ? '' : 's'} were not read.`,
      });
    }

    // Decision 5 — a value cell holds a literal. A saved result is used, and
    // said so; without one there is nothing to use.
    for (const [ref, formula] of Object.entries(sheet.formulas)) {
      const hasValue = (sheet.text?.[rowOf(ref)]?.[colOf(ref)] ?? '') !== '';
      notes.push({
        severity: 'warning',
        sheet: sheet.name,
        cell: ref,
        message: hasValue
          ? `Holds a formula (=${formula}); its saved result was used. Replace the formula with its value.`
          : `Holds a formula (=${formula}) with no saved result, so this cell has no value.`,
      });
    }
  }

  return notes;
}

const rowOf = (ref: string) => Number(ref.replace(/^[A-Z]+/, '')) - 1;
const colOf = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// ── the one way in ────────────────────────────────────────────────────

/**
 * Read an uploaded `.xlsx` into a workbook, or refuse it with a reason.
 *
 * The raw size is checked **before** unzipping and the unzipped total is capped
 * by the reader (decision 4), so neither a huge upload nor a zip bomb is ever
 * expanded in memory first.
 */
export async function readSpecWorkbook(file: File): Promise<SpecWorkbook> {
  const kind = uploadKind(file.name);
  if (kind !== 'xlsx') {
    throw new SpecIntakeError('unsupported', 'This is a JSON spec; read it as JSON, not as a workbook.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new SpecIntakeError(
      'too-large',
      `This file is ${Math.round(file.size / 1024 / 1024)} MB, past the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit. Embedded screenshots are the usual cause and are never read.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let wb: ImportedWorkbook;
  try {
    wb = await read(file, { maxTotalSize: MAX_UNZIPPED_BYTES });
  } catch (err) {
    if (err instanceof ImportError) throw fromImportError(err);
    throw new SpecIntakeError(
      'corrupt',
      `This workbook could not be read: ${(err as Error).message}`,
    );
  }

  // `read()` accepts CSV as well, and decides partly on the bytes: a file named
  // .xlsx whose contents are not a zip comes back as a one-sheet CSV rather than
  // a refusal. A spec is a workbook — Pages List, Lists, Settings — so silently
  // accepting one sheet of parsed text would hand back a nonsense spec.
  if (wb.source !== 'xlsx') {
    throw new SpecIntakeError(
      'not-workbook',
      'This file is named .xlsx but is not an Excel workbook — its contents read as plain text.',
    );
  }

  const notes = visibilityNotes(wb);
  if (!wb.sha256) {
    notes.push({
      severity: 'info',
      message:
        'This browser did not provide the hash of the file, so the report cannot record which workbook it checked.',
    });
  }

  return {
    name: file.name,
    sha256: wb.sha256 ?? null,
    bytes,
    workbook: wb,
    sheets: wb.sheets.filter((s) => s.state === 'visible'),
    notes,
  };
}
