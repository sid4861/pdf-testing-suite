/**
 * The workbook's own cells, marked — W-46 DoD 2.
 *
 * Arpit asked for this rather than a list: *after upload, not a list of what
 * is wrong — a view that looks and feels like the sheet, with wrong and
 * right highlighted*. Everything needed for that already exists on both
 * sides. The spec feature has carried `Sheet!A1` on every finding since
 * W-02 (SR-SPEC-INTAKE decision 13) and on every check since W-04
 * (SR-SPEC-CHECK decision 12); sheetpane takes a flat list of errors, each
 * naming a sheet and an A1 range. This file is the join, and nothing else:
 * **no judgment is made here**. A mark's severity is the one the spec
 * engine already decided, and a mark with no cell to land on is dropped
 * rather than guessed at.
 *
 * **Two layers, not one list.** sheetpane's review layers (`setErrors(list,
 * { layer })`) keep two sets in one pane, each replaced whole without
 * touching the other — so a validation run and a PDF check sit side by side
 * and the panel grows the *Validation · PDF check* switch W-46 DoD 4 asks
 * for. Re-running the check replaces `pdf` and leaves `validation` alone,
 * which is what a person re-running a check expects.
 *
 * **Passes are marks too.** `severity: 'pass'` and `'skipped'` are
 * sheetpane's way of saying "checked, fine" and "not checked, here is why",
 * and they are quiet by default — the sheet shows nothing until the panel's
 * *On sheet* switch is on. That matters: a spec run produces hundreds of
 * passes, and a sheet with a tick in every cell says less than a sheet with
 * three red ones.
 */

import type { IntakeNote } from './specIntake';
import type { ValidationReport } from './specValidate';
import type { Box, ElementResult, SpecReport } from './types';

/**
 * sheetpane's error record, as much of it as this file sets.
 *
 * Declared structurally rather than imported from `@sheetpane/grid`: that
 * package is a browser bundle with custom elements, and this module is
 * called from Node by the tests. The shape is `SheetpaneError` v1 and the
 * fields below are checked against it by `spec-sheet-marks.ts`.
 */
export interface SheetMark {
  v: 1;
  id: string;
  /** `""` for a mark about the whole workbook. */
  sheet: string;
  /** A1 cell or range; `""` for a mark about a whole sheet. */
  range: string;
  /** An id from the host's error-type catalogue. */
  type: string;
  severity: 'error' | 'warning' | 'note' | 'pass' | 'skipped';
  /** What the document has. The *uploaded* text, never an edit. */
  found: string;
  expected: string;
  message: string;
  cellChanged: false;
  status: 'open';
  matchesExpected: false;
  author: string;
  createdAt: string;
  /** Which review layer this belongs to. */
  layer: 'validation' | 'pdf';
  /** Host data — what the PDF side needs to point back at the page. */
  meta?: { page: number; box: Box | null; elementId: string };
}

/** The two layers, and what the panel's switch calls them. */
export const LAYERS = { validation: 'Validation', pdf: 'PDF check' } as const;

/**
 * `"1!E15"` → `{ sheet: '1', range: 'E15' }`.
 *
 * A sheet name may itself contain `!` only when quoted, which is why the
 * split is on the **last** separator. A reference with no sheet is about the
 * workbook, not about the first sheet — guessing a sheet here would put a
 * mark on a cell nobody wrote about.
 */
export function splitRef(ref: string | undefined): { sheet: string; range: string } | null {
  if (!ref) return null;
  const at = ref.lastIndexOf('!');
  if (at < 0) return null;
  const sheet = ref.slice(0, at).replace(/^'|'$/g, '');
  const range = ref.slice(at + 1);
  if (!sheet || !/^[A-Z]+\d+(:[A-Z]+\d+)?$/i.test(range)) return null;
  return { sheet, range };
}

/** `"F15"` or `"A14:J14"` — a cell reference with no sheet on it. */
const isA1 = (s: string | undefined): s is string =>
  typeof s === 'string' && /^[A-Z]+\d+(:[A-Z]+\d+)?$/i.test(s);

/** Stable within a run, and never reused: sheetpane keys rows by id. */
function ids(prefix: string) {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(4, '0')}`;
}

const NOW = () => new Date().toISOString();

const SEVERITY_OF_NOTE = {
  error: 'error',
  warning: 'warning',
  info: 'note',
} as const;

/**
 * W-02's validation report → marks on the cells it refused.
 *
 * A note with no cell is still shown — on its sheet when it names one, on
 * the workbook when it does not (sheetpane's `range: ""` and `sheet: ""`).
 * Dropping those would hide exactly the findings that are about the file
 * itself, which decision 13 says stop the run.
 */
export function validationMarks(report: ValidationReport, now = NOW): SheetMark[] {
  const id = ids('VAL');
  const out: SheetMark[] = [];

  const add = (note: IntakeNote, severity: SheetMark['severity']) => {
    // A note keeps the two apart — `{ sheet: '1', cell: 'F15' }` — while a
    // `CheckResult` carries one qualified string. Both shapes are accepted
    // here rather than made uniform somewhere else, because each is right
    // for where it comes from: a note is raised while reading one sheet,
    // and a check is written down long after.
    const qualified = splitRef(note.cell);
    const sheet = qualified?.sheet ?? note.sheet ?? '';
    const range = qualified?.range ?? (isA1(note.cell) ? note.cell! : '');
    out.push({
      v: 1,
      id: id(),
      sheet,
      range,
      type: severity === 'error' ? 'spec-refused' : `spec-${severity}`,
      severity,
      found: '',
      expected: '',
      message: note.message,
      cellChanged: false,
      status: 'open',
      matchesExpected: false,
      // sheetpane's own word for a finding that came from reading the file.
      author: 'workbook',
      createdAt: now(),
      layer: 'validation',
    });
  };

  for (const n of report.errors) add(n, SEVERITY_OF_NOTE.error);
  for (const n of report.warnings) add(n, SEVERITY_OF_NOTE.warning);
  for (const n of report.info) add(n, SEVERITY_OF_NOTE.info);
  return out;
}

/** An element's status decides the severity of a check that has no verdict. */
function severityOfElement(status: ElementResult['status']): SheetMark['severity'] {
  switch (status) {
    case 'pass': return 'pass';
    case 'warning': return 'warning';
    case 'unverifiable': return 'skipped';
    default: return 'error';
  }
}

/**
 * W-04's result → a mark per check, on the cell the expectation came from.
 *
 * Per **check**, not per element: a row in the workbook is one expectation
 * — *Left*, *Font size*, *Colour* — and that row is the cell a person would
 * go and change. An element-level mark would land on whichever of its rows
 * happened to be first.
 *
 * A check with no `cell` is dropped. Those are the ones that are not about a
 * workbook row at all (`Anchor`, `Readable`, and everything from a spec
 * JSON, which has no cells), and a mark has nowhere to go.
 */
export function resultMarks(report: SpecReport, now = NOW): SheetMark[] {
  const id = ids('PDF');
  const out: SheetMark[] = [];

  for (const page of report.pages) {
    for (const el of page.elements) {
      const elementSeverity = severityOfElement(el.status);

      for (const check of el.checks) {
        const ref = splitRef(check.cell);
        if (!ref) continue;

        // A failed check is an error whatever the element's status; a check
        // that passed inherits it, so an `unverifiable` element's checks are
        // `skipped` rather than quietly counted as passes (decision 13).
        const severity: SheetMark['severity'] = check.pass
          ? (elementSeverity === 'error' ? 'pass' : elementSeverity)
          : 'error';

        out.push({
          v: 1,
          id: id(),
          sheet: ref.sheet,
          range: ref.range,
          type: `spec-${check.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          severity,
          found: check.actual,
          expected: check.expected,
          message: [
            `${el.label} — ${check.name}`,
            check.delta ? `off by ${check.delta}` : '',
            check.note ?? '',
          ].filter(Boolean).join(' · '),
          cellChanged: false,
          status: 'open',
          matchesExpected: false,
          author: 'pdfsuite',
          createdAt: now(),
          layer: 'pdf',
          // What the sheet needs to point at the page (DoD 5).
          meta: { page: page.page, box: el.actualBox ?? el.expectedBox, elementId: el.id },
        });
      }
    }
  }

  return out;
}

/** Both layers at once, for a tab that has a validation report and a result. */
export function allMarks(
  validation: ValidationReport | null,
  result: SpecReport | null,
  now = NOW,
): SheetMark[] {
  return [
    ...(validation ? validationMarks(validation, now) : []),
    ...(result ? resultMarks(result, now) : []),
  ];
}
