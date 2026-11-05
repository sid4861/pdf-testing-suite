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
import type {
  PdfSpec, SpecElement, SpecPage, SpecRepeats, SpecUnit, SpecTolerance,
} from './types';
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

/** The Pages List's Page type, as the spec writes it. */
function kindOf(type: string): SpecPage['kind'] | null {
  switch (type.trim().toLowerCase()) {
    case 'required': return 'required';
    case 'optional': return 'optional';
    case 'conditional': return 'conditional';
    default: return null;
  }
}

/**
 * The Repeats cell as a range.
 *
 * Blank means at least once (SR-SPEC-CHECK decision 3) — not "any number
 * including none", which would make an absent Required page pass. `3+` and
 * `2–` leave the top open; a single number is both ends.
 */
function repeatsOf(raw: string): SpecRepeats {
  const text = raw.trim();
  if (!text) return { min: 1, max: null };

  const range = text.match(/^(\d+)\s*(?:[–—-]|to)\s*(\d*)$/);
  if (range) {
    const min = Number(range[1]);
    return { min, max: range[2] ? Number(range[2]) : null };
  }
  if (/^\d+\s*\+$/.test(text)) return { min: Number(text), max: null };
  if (/^\d+$/.test(text)) return { min: Number(text), max: Number(text) };

  // Unreadable: the safe reading is the default, and the Pages List reader has
  // already said so on that cell.
  return { min: 1, max: null };
}

/** The five position parameters, in the order a reader would look for them. */
const EDGES = ['top', 'left', 'right', 'bottom', 'baseline'] as const;

type Edge = typeof EDGES[number];

/** The page, in spec units, when the workbook states one. */
interface PageSize { width: number; height: number }

/**
 * One position row as a distance from the page's **top-left**.
 *
 * The workbook says which edge it measured from, and a footer measured 0.4 in
 * up from the bottom is a different number on A4 and on Letter — so the
 * conversion happens here, once, where the page size is known, rather than in
 * the checker, which would then need to carry the page around to understand
 * what the spec meant.
 *
 * Null when the row cannot be read, or when it is measured from an edge this
 * workbook gives no page size for: a guess at the page would place every
 * footer wrongly and confidently.
 */
function fromTopLeft(
  row: SpecRow,
  edge: Edge,
  units: SpecUnit,
  page: PageSize | null,
): number | null {
  if (!row.usable) return null;
  const n = numberIn(row, units);
  if (n == null) return null;

  const from = row.from.trim().toLowerCase();
  // A container-relative position needs the container's own box, which is
  // SR-SPEC-INTAKE decision 12 and unbuilt; it is left alone rather than
  // measured from the page by mistake.
  if (from.includes('container')) return null;

  if (from.includes('bottom')) return page ? page.height - n : null;
  if (from.includes('right')) return page ? page.width - n : null;
  // "top of page" and "left of page" are already measured from where the
  // spec measures; so is a blank From on an edge that only goes one way.
  return n;
}

/** Whether the author asked for this row to be checked at all. */
function asserting(row: SpecRow): boolean {
  return !/^(no|note)$/i.test(row.check.trim());
}

/** What coverage should say about a row the author excluded, or null. */
function byCheck(row: SpecRow): [CoverageEntry['status'], string] | null {
  const c = row.check.trim().toLowerCase();
  if (c === 'no') return ['excluded', 'Check? is No'];
  if (c === 'note') return ['noted', 'Check? is Note'];
  return null;
}

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
    return inRowUnit(half, row.unit, specUnit);
  }
  if (row.tolerance) {
    const n = Number(row.tolerance);
    // The Tolerance cell is written in the row's own unit (decision 11), which
    // is rarely the unit the spec compiled to. Taking the number as it stands
    // would widen a 2 mm band to 2 in.
    return Number.isFinite(n) ? inRowUnit(n, row.unit, specUnit) : null;
  }
  return null;
}

/** A length written in `rowUnit`, in the spec's unit. Null when no unit. */
function inRowUnit(n: number, rowUnit: string, specUnit: SpecUnit): number | null {
  const toIn: Record<string, number> = { in: 1, mm: 1 / 25.4, cm: 1 / 2.54, pt: 1 / 72 };
  const f = toIn[rowUnit];
  if (f == null) return null;
  const inches = n * f;
  return specUnit === 'in' ? inches : specUnit === 'mm' ? inches * 25.4 : inches * 72;
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

  // The page, in the spec's own unit: what a position measured from the
  // bottom or the right has to be subtracted from.
  const pageSize: PageSize | null =
    ex.settings.pageWidth != null && ex.settings.pageHeight != null
      ? {
        width: convertPage(ex.settings.pageWidth, ex.settings.pageUnit, units),
        height: convertPage(ex.settings.pageHeight, ex.settings.pageUnit, units),
      }
      : null;

  const pages: SpecPage[] = [];

  for (const page of ex.pages) {
    const rows = ex.rows.filter((r) => r.sheet === page.tab);
    if (rows.length === 0) continue;

    const elements: SpecElement[] = [];

    for (const d of draftsFor(rows)) {
      // Check? is the author's own instruction and is read before anything
      // else: a row marked No or Note never becomes an assertion, including
      // the Top and Left the compiler would otherwise consume.
      const get = (p: string) => {
        const r = d.rows.get(p);
        return r && asserting(r) ? r : undefined;
      };
      // Any of the five edges will place an element; the compiler turns each
      // into a distance from the page's top-left, so the checker never has to
      // know which edge the author measured from.
      const placed = EDGES.map((name) => {
        const row = get(name);
        const at = row ? fromTopLeft(row, name, units, pageSize) : null;
        return { name, row, at };
      });
      const stated = placed.filter((e) => e.row);

      // Decision 13 — an element with no position cannot be found, so it is
      // excluded and said so, never asserted at a guessed coordinate.
      if (stated.length === 0) {
        for (const r of d.rows.values()) {
          // A row that says Note is not missing a position; it said not to
          // check it. Reporting the two the same way loses the difference.
          const [status, reason] = byCheck(r)
            ?? ['excluded' as const,
              'the element states no Top, Left, Right, Bottom or Baseline, so it cannot be located on the page'];
          note(r, status, reason);
        }
        continue;
      }
      if (stated.every((e) => e.at == null)) {
        for (const r of d.rows.values()) {
          note(r, 'unreadable', stated.some((e) => e.row && !e.row.usable)
            ? 'its position could not be read'
            : 'its position is measured from an edge this workbook gives no page size for');
        }
        continue;
      }

      const where: Record<string, number> = {};
      for (const e of placed) if (e.at != null) where[e.name] = e.at;
      const topN = where.top ?? null;
      const leftN = where.left ?? null;

      const source: Record<string, SourceCell> = {};
      const mark = (name: string, r: SpecRow | undefined, col: string) => {
        if (r) source[name] = { sheet: r.sheet, cell: `${col}${r.row}` };
      };
      for (const e of placed) if (e.at != null) mark(e.name, e.row, 'E');

      const tolerance: SpecTolerance = {};
      const posTol = stated.map((e) => e.row && toleranceFrom(e.row, units)).find((t) => t != null) ?? null;
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
        id, label,
        ...(topN != null ? { top: topN } : {}),
        ...(leftN != null ? { left: leftN } : {}),
        ...(where.right != null ? { right: where.right } : {}),
        ...(where.bottom != null ? { bottom: where.bottom } : {}),
        ...(where.baseline != null ? { baseline: where.baseline } : {}),
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
        if (rowsN != null) mark('rows', rowsCount, 'E');
        if (colsN != null) mark('columns', columns, 'E');
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
        const fontRow = get('font');
        const boldRow = get('bold');
        const italicRow = get('italic');
        const colourRow = get('colour');
        const yesNo = (r: SpecRow | undefined) =>
          r && /^(yes|no)$/i.test(r.value.trim()) ? /^yes$/i.test(r.value.trim()) : undefined;
        // Only a real hex becomes an assertion: a named colour without its hex
        // is a row the Lists sheet should have resolved, not a guess here.
        const colour = colourRow && /^#?[0-9a-f]{3,6}$/i.test(colourRow.value.trim())
          ? colourRow.value.trim()
          : undefined;

        built = {
          ...base, type: 'text', text,
          ...(wording.exactText.toLowerCase() === 'yes' ? { match: 'exact' as const } : {}),
          ...(fs != null ? { fontSize: fs } : {}),
          ...(fontRow?.value ? { font: fontRow.value } : {}),
          ...(yesNo(boldRow) !== undefined ? { bold: yesNo(boldRow) } : {}),
          ...(yesNo(italicRow) !== undefined ? { italic: yesNo(italicRow) } : {}),
          ...(colour ? { colour } : {}),
        };
        mark('text', wording, 'E');
        if (fs != null) mark('fontSize', fontSize, 'E');
        if (fontRow?.value) mark('font', fontRow, 'E');
        if (yesNo(boldRow) !== undefined) mark('bold', boldRow, 'E');
        if (yesNo(italicRow) !== undefined) mark('italic', italicRow, 'E');
        if (colour) mark('colour', colourRow, 'E');
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
        const said = byCheck(r);
        if (!r.usable) {
          note(r, 'unreadable', 'the row failed validation');
        } else if (said) {
          note(r, said[0], said[1]);
        } else if (used.has(param) || used.has(param.replace(/\s+/g, ''))) {
          note(r, 'checked', 'asserted');
        } else {
          note(r, 'noted', `“${r.parameter}” has no check in the engine yet`);
        }
      }
    }

    pages.push({
      page: Number(page.tab) || pages.length + 1,
      elements,
      ...(page.name ? { name: page.name } : {}),
      ...(kindOf(page.type) ? { kind: kindOf(page.type)! } : {}),
      ...(page.variantGroup ? { variantGroup: page.variantGroup } : {}),
      ...(page.repeats || page.type ? { repeats: repeatsOf(page.repeats) } : {}),
      ...(page.identifyingText ? { identifyingText: page.identifyingText } : {}),
    });
  }

  const spec: PdfSpec = {
    title: ex.workbook,
    units,
    ...(ex.settings.pageWidth != null && ex.settings.pageHeight != null
      ? { pageSize: { width: convertPage(ex.settings.pageWidth, ex.settings.pageUnit, units),
                      height: convertPage(ex.settings.pageHeight, ex.settings.pageUnit, units) } }
      : {}),
    ...(specTolerance(ex, units) ? { tolerance: specTolerance(ex, units)! } : {}),
    ...(ex.settings.colourThreshold != null ? { colourThreshold: ex.settings.colourThreshold } : {}),
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
