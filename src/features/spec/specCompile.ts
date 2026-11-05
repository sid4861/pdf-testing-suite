/**
 * Extraction → spec JSON (SR-SPEC-INTAKE decisions 2 and 14).
 *
 * The checker runs spec JSON and nothing else, so this is where a workbook
 * becomes something checkable. Two rules shape it:
 *
 * **Every assertion names its cell.** A finding that cannot be traced back to
 * the row a person wrote is a finding they cannot act on, so `source` is not
 * optional and nothing is asserted without one.
 *
 * **Only what the workbook pins down becomes an assertion.** A row that failed
 * validation, a row marked `Check? = No`, a row the checker has no check for —
 * each ends in coverage with a reason, never as a silent pass. Decision 13's
 * "nothing passes silently" is enforced here rather than hoped for.
 */

import type { Extraction, SpecRow } from './specTemplate';
import type { PdfSpec, SpecElement, SpecPage, SpecUnit, SpecTolerance } from './types';
import { bandOf } from './specValues';

/** Where a value came from, on every assertion (decision 14). */
export interface SourceCell {
  sheet: string;
  cell: string;
}

/** Why a spec row produced no assertion. Coverage is made of these. */
export interface CoverageEntry {
  sheet: string;
  row: number;
  element: string;
  parameter: string;
  status: 'checked' | 'noted' | 'excluded' | 'unreadable';
  reason: string;
}

export interface CompiledSpec {
  spec: PdfSpec;
  coverage: CoverageEntry[];
  /** Assertions built, and spec rows seen — the report's "N of M rows". */
  counts: { checked: number; noted: number; excluded: number; unreadable: number; rows: number };
}

// ── which parameters become which assertion ───────────────────────────

const POSITION = new Set(['top', 'left', 'right', 'bottom', 'baseline']);
const SIZE = new Set(['width', 'height']);

/** The unit a row is written in, as a `SpecUnit`, or null when it takes none. */
function unitOf(row: SpecRow): SpecUnit | null {
  switch (row.unit) {
    case 'in': return 'in';
    case 'mm': return 'mm';
    case 'pt': return 'pt';
    case 'cm':
      // The spec format has no centimetres; the value converts on the way in
      // rather than the format growing a unit only one workbook uses.
      return 'mm';
    default:
      return null;
  }
}

/** A row's number in the spec's units, converted where the row used another. */
function numberIn(row: SpecRow, specUnit: SpecUnit): number | null {
  const p = row.parsed;
  const raw =
    p.kind === 'number' ? p.value
      : p.kind === 'range' ? bandOf(p.low, p.high).value
        : null;
  if (raw == null) return null;

  const toIn: Record<string, number> = { in: 1, mm: 1 / 25.4, cm: 1 / 2.54, pt: 1 / 72 };
  const factor = toIn[row.unit];
  if (factor == null) return null;
  const inches = raw * factor;
  return specUnit === 'in' ? inches : specUnit === 'mm' ? inches * 25.4 : inches * 72;
}

/** A range states its own tolerance; `bandOf` turns it into one. */
function toleranceFrom(row: SpecRow, specUnit: SpecUnit): number | null {
  if (row.parsed.kind === 'range') {
    const half = bandOf(row.parsed.low, row.parsed.high).tolerance;
    const toIn: Record<string, number> = { in: 1, mm: 1 / 25.4, cm: 1 / 2.54, pt: 1 / 72 };
    const f = toIn[row.unit];
    if (f == null) return null;
    const inches = half * f;
    return specUnit === 'in' ? inches : specUnit === 'mm' ? inches * 25.4 : inches * 72;
  }
  if (row.tolerance) {
    const n = Number(row.tolerance);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── one element, gathered from its rows ───────────────────────────────

interface Draft {
  key: string;
  element: string;
  part: string;
  sheet: string;
  /** The row each parameter came from, so every value keeps its cell. */
  rows: Map<string, SpecRow>;
}

const keyOf = (r: SpecRow) => `${r.sheet}|${r.element}|${r.part}`;

/**
 * Build the elements for one page sheet.
 *
 * Rows are grouped by Element and Part, because that is what the workbook
 * means by one thing on the page: a *Part* of an element has its own position
 * and its own wording, so "Title block / Container" and "Title block /
 * Reporting period" are two boxes, not one with two tops.
 */
function draftsFor(rows: SpecRow[]): Draft[] {
  const byKey = new Map<string, Draft>();
  for (const r of rows) {
    const key = keyOf(r);
    let d = byKey.get(key);
    if (!d) {
      d = { key, element: r.element, part: r.part, sheet: r.sheet, rows: new Map() };
      byKey.set(key, d);
    }
    // One parameter, one value: a second is a defect the validator already
    // reported, so the first is kept rather than silently overwritten.
    const p = r.parameter.toLowerCase();
    if (!d.rows.has(p)) d.rows.set(p, r);
  }
  return [...byKey.values()];
}

/** An id a person can recognise in a report, unique within the spec. */
function idFor(d: Draft, taken: Set<string>): string {
  const base = [d.element, d.part]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'element';
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

// ── the compiler ──────────────────────────────────────────────────────

/**
 * Compile an extraction into the spec the checker runs.
 *
 * `units` is the spec's own unit, chosen from what the workbook used most, so
 * the numbers in the JSON read like the numbers in the sheet.
 */
export function compileSpec(ex: Extraction): CompiledSpec {
  const coverage: CoverageEntry[] = [];
  const taken = new Set<string>();

  // The unit the workbook mostly speaks, so the JSON is recognisable beside it.
  const tally = new Map<string, number>();
  for (const r of ex.rows) if (r.unit) tally.set(r.unit, (tally.get(r.unit) ?? 0) + 1);
  const common = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const units: SpecUnit = common === 'mm' || common === 'cm' ? 'mm' : common === 'pt' ? 'pt' : 'in';

  const note = (row: SpecRow, status: CoverageEntry['status'], reason: string) =>
    coverage.push({
      sheet: row.sheet, row: row.row, element: row.element,
      parameter: row.parameter, status, reason,
    });

  const pages: SpecPage[] = [];

  for (const page of ex.pages) {
    const rows = ex.rows.filter((r) => r.sheet === page.tab);
    if (rows.length === 0) continue;

    const elements: SpecElement[] = [];

    for (const d of draftsFor(rows)) {
      const get = (p: string) => d.rows.get(p);
      const top = get('top');
      const left = get('left');

      // Decision 13 — an element with no position cannot be found, so it is
      // excluded and said so, never asserted at a guessed coordinate.
      if (!top || !left) {
        for (const r of d.rows.values()) {
          note(r, 'excluded', 'the element states no Top and Left, so it cannot be located on the page');
        }
        continue;
      }
      if (!top.usable || !left.usable) {
        for (const r of d.rows.values()) note(r, 'unreadable', 'its position could not be read');
        continue;
      }

      const topN = numberIn(top, units);
      const leftN = numberIn(left, units);
      if (topN == null || leftN == null) {
        for (const r of d.rows.values()) note(r, 'unreadable', 'its position could not be converted');
        continue;
      }

      const source: Record<string, SourceCell> = {};
      const mark = (name: string, r: SpecRow | undefined, col: string) => {
        if (r) source[name] = { sheet: r.sheet, cell: `${col}${r.row}` };
      };
      mark('top', top, 'E');
      mark('left', left, 'E');

      const tolerance: SpecTolerance = {};
      const posTol = toleranceFrom(top, units) ?? toleranceFrom(left, units);
      if (posTol != null) tolerance.position = posTol;

      // An image is a placed picture, which the workbook says by naming a file
      // or by putting the row in the Image group. Width and height alone
      // describe any box — a filled container, a drawn chart — and compiling
      // those as images sends the checker hunting for a picture that was never
      // there.
      const imageFile = get('file name');
      const isImage = !!imageFile || [...d.rows.values()].some((r) => r.group === 'Image');
      const isGraph = [...d.rows.values()].some((r) => r.group === 'Graph');

      const width = get('width');
      const height = get('height');
      const wording = get('wording') ?? get('text');
      const fontSize = get('font size');
      const spacing = get('line spacing');
      const rowsCount = get('rows');
      const columns = get('columns');
      const label = [d.element, d.part].filter(Boolean).join(' · ');
      const id = idFor(d, taken);

      const widthN = width && width.usable ? numberIn(width, units) : null;
      const heightN = height && height.usable ? numberIn(height, units) : null;
      const sizeTol = width ? toleranceFrom(width, units) : null;
      if (sizeTol != null) tolerance.size = sizeTol;

      const base = {
        id, label, top: topN, left: leftN,
        ...(Object.keys(tolerance).length ? { tolerance } : {}),
      };

      let built: SpecElement | null = null;

      if (rowsCount || columns) {
        // A table: it needs a width to be found at all.
        if (widthN == null) {
          for (const r of d.rows.values()) note(r, 'excluded', 'a table needs a Width to be found');
          continue;
        }
        const rowsN = rowsCount?.parsed.kind === 'number' ? rowsCount.parsed.value : undefined;
        const colsN = columns?.parsed.kind === 'number' ? columns.parsed.value : undefined;
        built = {
          ...base, type: 'table', width: widthN,
          ...(rowsN != null ? { rows: rowsN } : {}),
          ...(colsN != null ? { columns: colsN } : {}),
        };
        mark('width', width, 'E');
        if (rowsCount) mark('rows', rowsCount, 'E');
        if (columns) mark('columns', columns, 'E');
      } else if (spacing && wording) {
        const spacingN = numberIn(spacing, units);
        const full = assertableText(wording, get('line break after')?.value);
        const text = full ? leadingSnippet(full) : null;
        if (spacingN == null || !text) {
          for (const r of d.rows.values()) note(r, 'noted', 'a paragraph needs both wording and a line spacing');
          continue;
        }
        built = { ...base, type: 'paragraph', text, lineSpacing: spacingN };
        mark('text', wording, 'E');
        mark('lineSpacing', spacing, 'E');
      } else if (wording) {
        const text = assertableText(wording, get('line break after')?.value);
        if (!text) {
          // `<<dynamic>>` with a Pattern is a real row with nothing fixed to
          // match — it belongs in coverage, not in the check (decision 13).
          const why = wording.pattern
            ? `wording is <<dynamic>> with the pattern “${wording.pattern}”, which the checker does not match yet`
            : 'wording holds no fixed text to look for';
          for (const r of d.rows.values()) note(r, 'noted', why);
          continue;
        }
        const fs = fontSize && fontSize.parsed.kind === 'number' ? fontSize.parsed.value : undefined;
        built = {
          ...base, type: 'text', text,
          ...(wording.exactText.toLowerCase() === 'yes' ? { match: 'exact' as const } : {}),
          ...(fs != null ? { fontSize: fs } : {}),
        };
        mark('text', wording, 'E');
        if (fontSize) mark('fontSize', fontSize, 'E');
      } else if (isImage && widthN != null && heightN != null) {
        built = { ...base, type: 'image', width: widthN, height: heightN };
        mark('width', width, 'E');
        mark('height', height, 'E');
      } else if (isGraph) {
        for (const r of d.rows.values()) {
          note(r, 'noted', 'a graph drawn as vectors — its position and size are stated, but there is no check for a chart yet');
        }
        continue;
      } else if (widthN != null && heightN != null) {
        for (const r of d.rows.values()) {
          note(r, 'noted', 'a drawn box with no text or image — nothing to look for on the page yet');
        }
        continue;
      }

      if (!built) {
        for (const r of d.rows.values()) {
          note(r, 'noted', 'nothing in this element is checkable yet — no wording, size or table shape');
        }
        continue;
      }

      (built as SpecElement & { source?: Record<string, SourceCell> }).source = source;
      elements.push(built);

      // Everything that did become part of this element is checked; everything
      // else on it is accounted for by name.
      const used = new Set(Object.keys(source).map((k) => k.toLowerCase()));
      for (const [param, r] of d.rows) {
        if (!r.usable) {
          note(r, 'unreadable', 'the row failed validation');
        } else if (used.has(param) || used.has(param.replace(/\s+/g, ''))) {
          note(r, 'checked', 'asserted');
        } else if (r.check.toLowerCase() === 'no') {
          note(r, 'excluded', 'Check? is No');
        } else if (r.check.toLowerCase() === 'note') {
          note(r, 'noted', 'Check? is Note');
        } else {
          note(r, 'noted', `“${r.parameter}” has no check in the engine yet`);
        }
      }
    }

    pages.push({ page: Number(page.tab) || pages.length + 1, elements });
  }

  const spec: PdfSpec = {
    title: ex.workbook,
    units,
    ...(ex.settings.pageWidth != null && ex.settings.pageHeight != null
      ? { pageSize: { width: convertPage(ex.settings.pageWidth, ex.settings.pageUnit, units),
                      height: convertPage(ex.settings.pageHeight, ex.settings.pageUnit, units) } }
      : {}),
    ...(specTolerance(ex, units) ? { tolerance: specTolerance(ex, units)! } : {}),
    pages,
  };

  // The pair this spec came from, so a report can name it (decision 14).
  (spec as PdfSpec & { source?: unknown }).source = {
    workbook: ex.workbook,
    sha256: ex.sha256,
    templateVersion: ex.settings.templateVersion,
  };

  const counts = {
    checked: coverage.filter((c) => c.status === 'checked').length,
    noted: coverage.filter((c) => c.status === 'noted').length,
    excluded: coverage.filter((c) => c.status === 'excluded').length,
    unreadable: coverage.filter((c) => c.status === 'unreadable').length,
    rows: ex.rows.length,
  };

  return { spec, coverage, counts };
}

/**
 * The part of a wording cell that can be looked for; `<<dynamic>>` has none.
 *
 * `breakAfter` is the workbook's own *Line break after* row: the wording is laid
 * out as separate lines, so the text to look for is the first of them. Asserting
 * the joined string would match nothing on the page (decision 10).
 */
function assertableText(row: SpecRow, breakAfter?: string): string | null {
  const raw = row.value.trim();
  if (!raw) return null;
  let text = raw.replace(/<<[^>]*>>/g, ' ').replace(/\s+/g, ' ').trim();

  if (breakAfter) {
    const at = text.toLowerCase().indexOf(breakAfter.trim().toLowerCase());
    if (at >= 0) text = text.slice(0, at + breakAfter.trim().length).trim();
  }

  return text.length >= 3 && /[a-z0-9]/i.test(text) ? text : null;
}

/**
 * The opening words of a paragraph, which is what locates it.
 *
 * A paragraph's wording is the whole paragraph; on the page it is wrapped
 * across lines no cell can predict, so no single line ever contains it.
 * `ParagraphSpec.text` is the *starting snippet* for exactly this reason.
 */
function leadingSnippet(text: string, words = 7): string {
  return text.split(/\s+/).slice(0, words).join(' ');
}

function convertPage(n: number, from: string | null, to: SpecUnit): number {
  const toIn: Record<string, number> = { in: 1, mm: 1 / 25.4, cm: 1 / 2.54, pt: 1 / 72 };
  const inches = n * (toIn[from ?? 'in'] ?? 1);
  return to === 'in' ? inches : to === 'mm' ? inches * 25.4 : inches * 72;
}

/** The workbook's own tolerances, in the spec's unit. */
function specTolerance(ex: Extraction, units: SpecUnit): SpecTolerance | null {
  const s = ex.settings;
  const conv = (n: number | null) =>
    n == null ? undefined : convertPage(n, s.pageUnit ?? 'in', units);
  const out: SpecTolerance = {};
  if (conv(s.positionTolerance) != null) out.position = conv(s.positionTolerance);
  if (conv(s.sizeTolerance) != null) out.size = conv(s.sizeTolerance);
  if (conv(s.spacingTolerance) != null) out.spacing = conv(s.spacingTolerance);
  if (s.fontSizeTolerance != null) out.fontSize = s.fontSizeTolerance; // always points
  return Object.keys(out).length ? out : null;
}
