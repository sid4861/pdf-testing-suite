/**
 * The validation report — SR-SPEC-INTAKE decisions 13 and 14.
 *
 * Reading a workbook already produces notes carrying their own severity, sheet
 * and cell. This file turns those, the coverage and the compiled spec into the
 * one thing a person reads before any PDF is opened: what was refused, what was
 * accepted with less confidence, and — in plain words — *what the machine
 * understood each accepted row to mean*.
 *
 * That last part is the point. A report that says "row 14 parsed" tells the
 * person nothing they can check. "Report title: top edge 5.75 in from the top
 * of the page, ± 0.06 in" can be read against the workbook and disagreed with,
 * which is the only way a spec gets corrected before it is trusted.
 */

import type { IntakeNote } from './specIntake';
import type { Extraction } from './specTemplate';
import type { CompiledSpec, CoverageEntry, SourceCell } from './specCompile';
import type { PdfSpec, SpecElement, SpecTolerance, SpecUnit } from './types';

/** One assertion, said in words a person can check against the workbook. */
export interface ExplainedAssertion {
  page: number;
  /** The element's label, as the workbook writes it. */
  element: string;
  /** e.g. "top edge 5.75 in from the top of the page, ± 0.06 in" */
  sentence: string;
  sheet?: string;
  cell?: string;
}

export interface ValidationReport {
  workbook: string;
  sha256: string | null;
  templateVersion: string | null;
  errors: IntakeNote[];
  warnings: IntakeNote[];
  info: IntakeNote[];
  /**
   * True when an error is on the file itself or on the Pages List: decision 13
   * stops the run for those, where an error on one element only removes that
   * element.
   */
  blocking: boolean;
  /** Why the run is blocked, in one line, or null. */
  blockedBecause: string | null;
  coverage: CoverageEntry[];
  counts: CompiledSpec['counts'];
  assertions: ExplainedAssertion[];
}

// ── plain words ───────────────────────────────────────────────────────

/** A measurement with its unit, trimmed of trailing zeros. */
function qty(n: number, units: SpecUnit): string {
  const s = n.toFixed(units === 'pt' ? 1 : units === 'mm' ? 1 : 2)
    .replace(/\.?0+$/, '');
  return `${s} ${units}`;
}

const EDGE: Record<string, string> = {
  top: 'top edge',
  left: 'left edge',
  right: 'right edge',
  bottom: 'bottom edge',
  baseline: 'baseline',
};

// Every position in a compiled spec is measured from the top-left, whatever
// edge the workbook wrote it from — so that is what the sentence says.
const WHENCE: Record<string, string> = {
  top: 'the top of the page',
  left: 'the left of the page',
  right: 'the left of the page',
  bottom: 'the top of the page',
  baseline: 'the top of the page',
};

/** "± 0.06 in", or '' when the element takes the spec-wide tolerance. */
function plusMinus(tol: number | undefined, units: SpecUnit): string {
  return tol == null ? '' : `, ± ${qty(tol, units)}`;
}

/**
 * Every assertion on one element, in words, each with the cell it came from.
 *
 * The source map the compiler attaches is keyed by parameter, so a line can
 * name the cell a person would go and edit rather than the element as a whole.
 */
function explainElement(
  el: SpecElement,
  page: number,
  units: SpecUnit,
  wide: SpecTolerance | undefined,
): ExplainedAssertion[] {
  const src = (el as SpecElement & { source?: Record<string, SourceCell> }).source ?? {};
  const label = el.label || el.id;
  const out: ExplainedAssertion[] = [];

  const line = (key: string, sentence: string) => {
    const s = src[key];
    out.push({ page, element: label, sentence, sheet: s?.sheet, cell: s?.cell });
  };

  // The band stated must be the band applied: an element's own Tolerance cell
  // when it has one, otherwise the spec-wide figure from the Settings sheet.
  const band = (k: keyof SpecTolerance) => el.tolerance?.[k] ?? wide?.[k];

  // Position: whichever edges the workbook stated, and only those
  // (decision 13 excludes an element that states none).
  for (const edge of ['top', 'left', 'right', 'bottom', 'baseline'] as const) {
    const at = el[edge];
    if (at == null) continue;
    line(edge, `${EDGE[edge]} ${qty(at, units)} from ${WHENCE[edge]}` +
      plusMinus(band('position'), units));
  }

  if (el.type === 'text' || el.type === 'paragraph') {
    const how = el.match === 'exact' ? 'reads exactly' : 'contains';
    line('text', `${how} ${JSON.stringify(el.text)}`);
  }
  if (el.type === 'text') {
    if (el.fontSize != null) {
      line('fontSize', `set in ${el.fontSize}pt type` +
        plusMinus(band('fontSize'), 'pt'));
    }
    if (el.font) {
      const weight = el.bold ? ' bold' : '';
      const slant = el.italic ? ' italic' : '';
      line('font', `set in ${el.font}${weight}${slant}`);
    }
    if (el.colour) line('colour', `painted ${el.colour.toUpperCase()}`);
  }
  if (el.type === 'paragraph') {
    line('lineSpacing', `its lines ${qty(el.lineSpacing, units)} apart` +
      plusMinus(band('spacing'), units));
  }
  if (el.type === 'image') {
    line('width', `${qty(el.width, units)} wide and ${qty(el.height, units)} high` +
      plusMinus(band('size'), units));
  }
  if (el.type === 'table') {
    line('width', `${qty(el.width, units)} wide` + plusMinus(band('size'), units));
    if (el.rows != null) line('rows', `${el.rows} rows`);
    if (el.columns != null) line('columns', `${el.columns} columns`);
  }
  if (el.anchor) {
    line('anchor', `found below ${JSON.stringify(el.anchor.text)} rather than by position alone`);
  }

  return out;
}

/** Every assertion in a compiled spec, in words (decision 14). */
export function explainSpec(spec: PdfSpec): ExplainedAssertion[] {
  const units = spec.units ?? 'in';
  return spec.pages.flatMap((p) =>
    p.elements.flatMap((el) => explainElement(el, p.page, units, spec.tolerance)));
}

// ── the report ────────────────────────────────────────────────────────

/**
 * Whether an error stops the whole run.
 *
 * Decision 13 draws the line at *what the error is about*: the file or the
 * Pages List cannot be worked around, so the run stops; an error about one
 * element removes that element and the rest of the page is still worth
 * checking. A note with no sheet is about the file.
 */
function isBlocking(n: IntakeNote): boolean {
  return n.severity === 'error' && (!n.sheet || n.sheet === 'Pages List');
}

export function buildValidationReport(ex: Extraction, compiled: CompiledSpec): ValidationReport {
  const notes = ex.notes;
  const blocker = notes.find(isBlocking) ?? null;

  return {
    workbook: ex.workbook,
    sha256: ex.sha256,
    templateVersion: ex.settings.templateVersion,
    errors: notes.filter((n) => n.severity === 'error'),
    warnings: notes.filter((n) => n.severity === 'warning'),
    info: notes.filter((n) => n.severity === 'info'),
    blocking: blocker != null,
    blockedBecause: blocker ? blocker.message : null,
    coverage: compiled.coverage,
    counts: compiled.counts,
    assertions: explainSpec(compiled.spec),
  };
}

/** "248 of 290 rows checked" — the line the tab opens with. */
export function coverageLine(counts: CompiledSpec['counts']): string {
  return `${counts.checked} of ${counts.rows} rows checked`;
}
