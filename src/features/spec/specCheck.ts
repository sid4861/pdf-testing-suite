// Spec-driven validation engine: checks a PDF against a JSON spec.
// All geometry is normalised to POINTS (1/72 inch), top-left origin, so it
// lines up with the spec (converted from its declared units).

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { loadPdf } from './pdfjs';
import type {
  Box,
  CheckResult,
  ElementResult,
  ImageSpec,
  ParagraphSpec,
  PdfSpec,
  SpecAnchor,
  SpecCoverage,
  SpecElementBase,
  SpecElement,
  SpecPage,
  SpecPageResult,
  SpecReport,
  SpecTolerance,
  TestedPair,
  SpecUnit,
  TableSpec,
  TextSpec,
} from './types';
import { ANCHOR_WITHIN, BASE_SCALE, COLOUR_DELTA_E, SPEC_TOLERANCE } from '../../services/specConstants';
import { compareFont, parseFontName } from './specFonts';
import { cmykToRgb, compareColour, grayToRgb, toHex, type Rgb } from './specColour';
import { bindPages, hasPagesList } from './specPages';

export { loadPdf };

// Every tunable in the project lives in one file — SR-CONSTANTS.
const DEFAULT_TOL: Required<SpecTolerance> = {
  position: SPEC_TOLERANCE.position, // spec units
  size: SPEC_TOLERANCE.size,
  spacing: SPEC_TOLERANCE.spacing,
  fontSize: SPEC_TOLERANCE.fontSize, // points
};

/** Points in one inch — the unit SR-CONSTANTS's defaults are stated in. */
const INCH_PT = 72;

function unitToPt(unit: SpecUnit): number {
  if (unit === 'pt') return 1;
  if (unit === 'mm') return 72 / 25.4;
  return 72; // inches
}

/**
 * Ligatures, as PDF text layers emit them (SR-SPEC-CHECK decision 5).
 *
 * A workbook says "efficiency"; the PDF's text layer may carry "e\uFB03ciency"
 * as a single glyph. Comparing the two without expanding is a false failure
 * about a character nobody typed.
 */
const LIGATURES: [RegExp, string][] = [
  [/\uFB00/g, 'ff'], [/\uFB01/g, 'fi'], [/\uFB02/g, 'fl'],
  [/\uFB03/g, 'ffi'], [/\uFB04/g, 'ffl'], [/\uFB05/g, 'st'], [/\uFB06/g, 'st'],
  [/\u0152/g, 'OE'], [/\u0153/g, 'oe'], [/\u00C6/g, 'AE'], [/\u00E6/g, 'ae'],
];

/**
 * The spelling both sides are compared in (decisions 5 and 10).
 *
 * Everything here is a difference in how a character was *encoded*, never in
 * what was written: a soft hyphen is an invisible break opportunity, a curly
 * quote is the same quote, an en dash between words is the same dash. Comparing
 * these literally produces failures a reader cannot act on, because the two
 * strings look identical on screen.
 *
 * What is deliberately **not** normalised: ®, ™ and superscripts, which decision 10
 * says are always compared exactly, and letter case, which callers fold
 * separately so a case check can still see it.
 */
export function canonical(s: string): string {
  let out = s.normalize('NFC');
  for (const [re, to] of LIGATURES) out = out.replace(re, to);
  return out
    .replace(/\u00AD/g, '')                 // soft hyphen: a break, not a character
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2007\u202F\u2009\u200A]/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalize = (s: string) => canonical(s).toLowerCase();

/**
 * Rejoin a word split across a line end (decision 5).
 *
 * Only when the next line starts lower-case: "road\nworks" was one word, while
 * "North-\nSouth" is a genuine hyphen between two capitalised words and stays.
 */
function joinHyphenated(a: string, b: string): string {
  if (/[a-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return a + ' ' + b;
}
const median = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0;

// ── text extraction in points (top-left) ──────────────────────────────
interface PointItem {
  str: string;
  left: number;
  top: number;
  width: number;
  height: number; // font height
  baseline: number; // from top
  /** The real font name, subset prefix and all; '' when pdf.js cannot say. */
  font: string;
  /** The fill colour in force when this run was painted; null when unknown. */
  colour: Rgb | null;
}
interface Line {
  items: PointItem[];
  text: string;
  norm: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  baseline: number;
  fontHeight: number;
  count: number;
  /** The font most of this line is set in, for the font check. */
  font: string;
  /** The colour most of this line is painted in, for the colour check. */
  colour: Rgb | null;
}

/** A colour, and the point on the page where it was painted. */
interface PaintedColour {
  x: number;
  y: number;
  colour: Rgb;
}

/**
 * Where each colour was painted, in page coordinates.
 *
 * The colour of a piece of text is not in the text layer — it is whatever fill
 * was in force in the content stream when the run was painted. Matching the two
 * by *order* does not work: pdf.js's text layer splits and merges runs
 * differently from the stream (the fixture's page 2 has 60 text items against
 * 35 paint operations), so counting lines them up wrongly and silently.
 *
 * Position is what both views agree on, so the graphics and text matrices are
 * tracked here and every painted run gets a point. A line then takes the colour
 * painted nearest its own baseline.
 */
async function paintedColours(page: PDFPageProxy, vpTransform: number[]): Promise<PaintedColour[]> {
  const ops = await page.getOperatorList();
  const OPS = pdfjsLib.OPS as unknown as Record<string, number>;
  const out: PaintedColour[] = [];

  let colour: Rgb | null = null;
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  let textMatrix: number[] = [1, 0, 0, 1, 0, 0];
  const stack: { ctm: number[]; colour: Rgb | null }[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown as number[];

    if (fn === OPS.save) {
      stack.push({ ctm: [...ctm], colour });
    } else if (fn === OPS.restore) {
      const prev = stack.pop();
      if (prev) {
        ctm = prev.ctm;
        colour = prev.colour;
      }
    } else if (fn === OPS.paintFormXObjectBegin) {
      // Text inside a form is positioned through the form's matrix too, and a
      // colour matched to the wrong point is a finding about the wrong text.
      stack.push({ ctm: [...ctm], colour });
      ctm = pdfjsLib.Util.transform(ctm, args[0] as unknown as number[]);
    } else if (fn === OPS.paintFormXObjectEnd) {
      const prev = stack.pop();
      if (prev) {
        ctm = prev.ctm;
        colour = prev.colour;
      }
    } else if (fn === OPS.transform) {
      ctm = pdfjsLib.Util.transform(ctm, args as unknown as number[]);
    } else if (fn === OPS.setFillRGBColor) {
      colour = { r: args[0], g: args[1], b: args[2] };
    } else if (fn === OPS.setFillGray) {
      colour = grayToRgb(args[0]);
    } else if (fn === OPS.setFillCMYKColor) {
      colour = cmykToRgb(args[0], args[1], args[2], args[3]);
    } else if (fn === OPS.beginText) {
      textMatrix = [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.setTextMatrix) {
      textMatrix = args as unknown as number[];
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      if (colour) {
        // Text matrix through the CTM through the viewport gives the page point.
        const m = pdfjsLib.Util.transform(
          vpTransform,
          pdfjsLib.Util.transform(ctm, textMatrix),
        );
        out.push({ x: m[4], y: m[5], colour });
      }
    }
  }
  return out;
}

/**
 * The colour painted nearest a point, or null when nothing was painted close
 * enough to be about the same text.
 *
 * `within` is deliberately tight: a colour from the other side of the page is
 * not evidence about this line, and reporting "no colour" is the honest answer
 * where reporting a neighbour's colour would be a finding about the wrong
 * thing.
 */
function colourNear(points: PaintedColour[], x: number, y: number, within = 6): Rgb | null {
  let best: PaintedColour | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best && bestD <= within ? best.colour : null;
}

async function extractItems(page: PDFPageProxy): Promise<{ items: PointItem[]; widthPt: number; heightPt: number }> {
  const vp = page.getViewport({ scale: 1 });

  // The operator list must be walked before `commonObjs` holds the fonts, so
  // this also populates the lookup the font name below depends on.
  const painted = await paintedColours(page, vp.transform as unknown as number[]);
  const content = await page.getTextContent();

  const fontNames = new Map<string, string>();
  const realFont = (key: string | undefined): string => {
    if (!key) return '';
    const hit = fontNames.get(key);
    if (hit !== undefined) return hit;
    let name = '';
    try {
      name = String((page.commonObjs.get(key) as { name?: string } | undefined)?.name ?? '');
    } catch {
      // pdf.js has not resolved this font; the check reports it as unreadable
      // rather than guessing a family from the key.
      name = '';
    }
    fontNames.set(key, name);
    return name;
  };

  const items: PointItem[] = [];
  for (const raw of content.items) {
    const it = raw as { str?: string; width?: number; transform?: number[]; fontName?: string };
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    const m = pdfjsLib.Util.transform(vp.transform, it.transform!);
    const colour = colourNear(painted, m[4], m[5]);
    const fontHeight = Math.hypot(m[2], m[3]);
    items.push({
      str: it.str,
      left: m[4],
      top: m[5] - fontHeight,
      width: (it.width ?? 0),
      height: fontHeight,
      baseline: m[5],
      font: realFont(it.fontName),
      colour,
    });
  }
  return { items, widthPt: vp.width, heightPt: vp.height };
}

/**
 * A gap wider than this much of the text's own height starts a new column.
 *
 * Relative to the type, not to the page: a word space is about a quarter of the
 * font's height, so anything past one whole height is a deliberate separation
 * rather than spacing. Splitting too eagerly is cheap — anything that belongs
 * together is re-joined by `rowsWithin` from the box the spec declares — while
 * splitting too late silently measures the wrong element.
 */
const COLUMN_GAP = 1.2;

/** The value that appears most often, or undefined for an empty list. */
function commonest<T>(xs: T[]): T | undefined {
  if (xs.length === 0) return undefined;
  const tally = new Map<T, number>();
  for (const x of xs) tally.set(x, (tally.get(x) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Build a Line from fragments already known to belong together, left to right. */
function makeLine(items: PointItem[]): Line {
  const ordered = [...items].sort((a, b) => a.left - b.left);
  const text = ordered.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  return {
    items: ordered,
    text,
    norm: normalize(text),
    left: Math.min(...ordered.map((i) => i.left)),
    right: Math.max(...ordered.map((i) => i.left + i.width)),
    top: Math.min(...ordered.map((i) => i.top)),
    bottom: Math.max(...ordered.map((i) => i.top + i.height)),
    baseline: ordered.reduce((sum, i) => sum + i.baseline, 0) / ordered.length,
    fontHeight: median(ordered.map((i) => i.height)),
    count: ordered.length,
    font: commonest(ordered.map((i) => i.font).filter(Boolean)) ?? '',
    colour: ordered.find((i) => i.colour)?.colour ?? null,
  };
}

/**
 * Fragments to lines, **within a column** (SR-SPEC-CHECK decision 5).
 *
 * Grouped on the baseline rather than the top edge, because the top edge of a
 * 20pt title and an 11pt line beside it differ by the type size alone; and with
 * the tolerance taken from the *smaller* of the two, so a large heading cannot
 * swallow a smaller line near it. Each baseline run is then cut wherever the
 * horizontal gap says a new column starts.
 */
function groupLines(items: PointItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.baseline - b.baseline || a.left - b.left);

  // 1 ── same baseline?
  const runs: PointItem[][] = [];
  for (const it of sorted) {
    const run = runs[runs.length - 1];
    if (run) {
      const ref = run[run.length - 1];
      const tol = Math.max(1, Math.min(it.height, ref.height) * 0.4);
      if (Math.abs(it.baseline - ref.baseline) <= tol) {
        run.push(it);
        continue;
      }
    }
    runs.push([it]);
  }

  // 2 ── same column?
  const lines: Line[] = [];
  for (const run of runs) {
    const ordered = [...run].sort((a, b) => a.left - b.left);
    let segment: PointItem[] = [ordered[0]];
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const gap = ordered[i].left - (prev.left + prev.width);
      const limit = Math.max(2, Math.min(ordered[i].height, prev.height) * COLUMN_GAP);
      if (gap > limit) {
        lines.push(makeLine(segment));
        segment = [ordered[i]];
      } else {
        segment.push(ordered[i]);
      }
    }
    lines.push(makeLine(segment));
  }

  return lines.sort((a, b) => a.top - b.top || a.left - b.left);
}

/**
 * The segments inside a declared box, re-joined into one logical row each.
 *
 * This is the other half of column-aware grouping: a table row crosses columns
 * by definition, so it is rebuilt from the box the spec states rather than
 * guessed at from the page. A segment counts as inside when it sits wholly
 * within the span, so a neighbouring column never joins the row.
 */
function rowsWithin(lines: Line[], left: number, right: number, slack: number): Line[] {
  const inside = lines.filter((l) => l.left >= left - slack && l.right <= right + slack);
  const rows: Line[] = [];
  for (const l of inside.sort((a, b) => a.baseline - b.baseline || a.left - b.left)) {
    const last = rows[rows.length - 1];
    const tol = Math.max(1, Math.min(l.fontHeight, last?.fontHeight ?? l.fontHeight) * 0.4);
    if (last && Math.abs(l.baseline - last.baseline) <= tol) {
      rows[rows.length - 1] = makeLine([...last.items, ...l.items]);
    } else {
      rows.push(l);
    }
  }
  return rows;
}

// ── image extraction via operator list (points, top-left) ─────────────
async function extractImages(page: PDFPageProxy, pageHeightPt: number): Promise<Box[]> {
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS as Record<string, number>;
  const imgOps = new Set(
    ['paintImageXObject', 'paintImageXObjectRepeat', 'paintJpegXObject', 'paintImageMaskXObject', 'paintInlineImageXObject']
      .map((k) => OPS[k])
      .filter((v) => v != null),
  );
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const boxes: Box[] = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i] as number[];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = pdfjsLib.Util.transform(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) {
      // The form's own matrix applies to everything inside it, and pdf.js
      // puts those operations straight into this list.
      stack.push(ctm.slice());
      ctm = pdfjsLib.Util.transform(ctm, args[0] as unknown as number[]);
    } else if (fn === OPS.paintFormXObjectEnd) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (imgOps.has(fn)) {
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => pdfjsLib.Util.applyTransform(p, ctm));
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      boxes.push({ left: minX, top: pageHeightPt - maxY, width: maxX - minX, height: maxY - minY });
    }
  }
  return boxes;
}

// ── render for display ────────────────────────────────────────────────
async function renderPage(page: PDFPageProxy): Promise<string> {
  const vp = page.getViewport({ scale: BASE_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas.toDataURL('image/png');
}

// ── formatting helpers ────────────────────────────────────────────────
const makeFmt = (unit: SpecUnit) => {
  const per = unitToPt(unit);
  const sym = unit === 'in' ? '"' : unit;
  return (pt: number) => `${(pt / per).toFixed(2)}${sym}`;
};
const fmtPtSize = (pt: number) => `${Math.round(pt)}pt`;

/**
 * The tolerance for one assertion, **in points** (SR-SPEC-CHECK decision 11).
 *
 * Resolution order is the row, then the workbook's Settings, then SR-CONSTANTS.
 * The first two are written in the row's own unit and convert with it; the
 * fallback is not — SR-CONSTANTS states 0.06 **inches**, a physical distance,
 * so multiplying it by the spec's unit turned it into 0.06 mm on a millimetre
 * workbook, a tolerance seventeen times tighter than the record states.
 *
 * `fontSize` is in points either way and never converts.
 */
function tolPt(
  el: { tolerance?: SpecTolerance },
  spec: PdfSpec,
  key: keyof SpecTolerance,
  u2p: number,
): number {
  const stated = el.tolerance?.[key] ?? spec.tolerance?.[key];
  if (key === 'fontSize') return stated ?? DEFAULT_TOL.fontSize;
  if (stated != null) return stated * u2p;
  return DEFAULT_TOL[key] * INCH_PT; // SR-CONSTANTS is in inches
}

/**
 * The page's own size against the one the workbook states (decision 4).
 *
 * A warning, not a failure: every position on the page is measured from the
 * top-left corner, so a page of the wrong size does not make those measurements
 * wrong — but it does explain a whole page of them being off at once, which is
 * worth saying before the reader works through them one by one. It becomes an
 * error only when the workbook pins the size.
 *
 * `getViewport` has already applied `/Rotate` and the crop box, so this is the
 * page as a reader sees it rather than as it was authored.
 */
function pageSizeResult(
  spec: PdfSpec,
  widthPt: number,
  heightPt: number,
  u2p: number,
  fmt: (n: number) => string,
): ElementResult | null {
  const want = spec.pageSize;
  if (!want) return null;

  const expW = want.width * u2p;
  const expH = want.height * u2p;
  // A tenth of an inch: generous enough for rounding in the writer, tight
  // enough to catch Letter against A4 (which differ by about a quarter inch).
  const slack = 0.1 * INCH_PT;
  const ok = Math.abs(widthPt - expW) <= slack && Math.abs(heightPt - expH) <= slack;
  const pinned = spec.pageSizePinned === true;

  return {
    id: '__page-size',
    type: 'text',
    label: 'Page size',
    status: ok ? 'pass' : pinned ? 'fail' : 'warning',
    detail: `${fmt(expW)} × ${fmt(expH)}`,
    checks: [{
      name: 'Page size',
      expected: `${fmt(expW)} × ${fmt(expH)}`,
      actual: `${fmt(widthPt)} × ${fmt(heightPt)}`,
      pass: ok,
      ...(ok ? {} : { delta: pinned ? 'size is pinned' : 'measurements still read from the top-left corner' }),
    }],
    expectedBox: null,
    actualBox: null,
  };
}

/**
 * A page whose text cannot be read (decision 6).
 *
 * Outlined type, a scan, or labels baked into an image all produce a page with
 * images and no text layer. Every text assertion on it would report "not
 * found", which reads as a defect in the document when it is a limit of the
 * method. Those elements are **unverifiable** instead — never a pass, and never
 * a failure the template developer would chase.
 */
function noTextLayer(items: PointItem[], images: Box[]): boolean {
  return items.length === 0 && images.length > 0;
}

/** Kept for the font-size check, which is already in points. */
function tol(el: { tolerance?: SpecTolerance }, spec: PdfSpec, key: keyof SpecTolerance): number {
  return el.tolerance?.[key] ?? spec.tolerance?.[key] ?? DEFAULT_TOL[key];
}

/**
 * The wording itself, against the line that was found (decision 10).
 *
 * Finding the line is a looser business than judging it: a line is located
 * with everything normalised, because otherwise a non-breaking space in the
 * PDF would report the text as missing, which is a worse answer than a
 * qualified one. What is reported here is stricter.
 *
 * - **Exact text = Yes** is character for character. Anything else fails, and
 *   both strings are shown so the difference can be seen.
 * - Otherwise a plain substring match passes silently, and a match that only
 *   appears after normalising passes **with a note** — the document and the
 *   workbook do not literally agree, and somebody should know which it is.
 *
 * ®, ™ and superscripts pass through `canonical` untouched, so they are
 * compared exactly either way.
 */
function wordingCheck(expected: string, actualLine: string, exact: boolean): CheckResult {
  const show = (t: string) => `“${t.length > 80 ? t.slice(0, 77) + '…' : t}”`;

  if (exact) {
    const same = actualLine.trim() === expected.trim();
    return {
      name: 'Text',
      expected: show(expected),
      actual: same ? show(expected) : show(actualLine),
      pass: same,
      ...(same ? {} : { delta: 'Exact text is Yes, so this is compared character for character' }),
    };
  }

  const literal = actualLine.includes(expected.trim());
  return {
    name: 'Text',
    expected: show(expected),
    actual: literal ? 'found as written' : show(actualLine),
    pass: true,
    ...(literal ? {} : { note: 'matched only after normalising spacing, quotes and dashes' }),
  };
}

/**
 * Name every check with the cell it came from (decision 12).
 *
 * Done once, here, rather than at each of the twenty places a check is
 * pushed: which row produced which check is a single fact about the template,
 * and spreading it would guarantee that a new check quietly arrives with no
 * cell on it.
 */
const CHECK_SOURCE: Record<string, string> = {
  Present: 'text',
  Text: 'text',
  Left: 'left',
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
  Baseline: 'baseline',
  Width: 'width',
  Height: 'height',
  'Font size': 'fontSize',
  Font: 'font',
  Colour: 'colour',
  'Line spacing': 'lineSpacing',
  Rows: 'rows',
  Columns: 'columns',
  Anchor: 'anchor',
};

function withSource(el: SpecElement, result: ElementResult): ElementResult {
  const source = (el as SpecElement & { source?: Record<string, { sheet: string; cell: string }> }).source;
  if (!source) return result;
  for (const check of result.checks) {
    const key = CHECK_SOURCE[check.name];
    // Presence and wording fall back to the element's position cell, so a
    // finding about an element whose wording row is implied still says where
    // in the workbook to look.
    const place = (key ? source[key] : undefined)
      ?? (check.name === 'Present' || check.name === 'Text' ? source.top : undefined);
    if (place) check.cell = `${place.sheet}!${place.cell}`;
  }
  return result;
}

// ── anchors ───────────────────────────────────────────────────────────
/** How far from the anchor text to search, in spec units, when not stated. */
const DEFAULT_ANCHOR_WITHIN = ANCHOR_WITHIN;

/** The line an anchor refers to, or null when its text is not on the page. */
function findAnchorLine(anchor: SpecAnchor, lines: Line[]): Line | null {
  const want = normalize(anchor.text);
  const mode = anchor.match ?? 'contains';
  const hits = lines
    .filter((l) => (mode === 'exact' ? l.norm === want : l.norm.includes(want)))
    .sort((a, b) => a.top - b.top || a.left - b.left); // reading order
  if (hits.length === 0) return null;
  const which = Math.max(1, anchor.occurrence ?? 1);
  return hits[Math.min(which, hits.length) - 1];
}

/**
 * Restrict candidates to the region an anchor points at, and rank them by
 * distance from the anchor rather than from the declared top/left.
 *
 * Returns null when the anchor text is absent — the caller reports that as a
 * distinct failure, which is far more useful than silently falling back to
 * position and matching the wrong element.
 */
function anchorRegion(
  anchor: SpecAnchor,
  lines: Line[],
  u2p: number,
): { line: Line; keep: (b: Box) => boolean; distance: (b: Box) => number } | null {
  const line = findAnchorLine(anchor, lines);
  if (!line) return null;

  const side = anchor.position ?? 'below';
  const reach = (anchor.within ?? DEFAULT_ANCHOR_WITHIN) * u2p;
  // A little slack across the anchor's own axis, so an element that is not
  // perfectly aligned with the label still qualifies.
  const slack = reach;

  const keep = (b: Box): boolean => {
    switch (side) {
      case 'below':
        return b.top >= line.bottom - 2 && b.top <= line.bottom + reach
          && b.left <= line.right + slack && b.left + b.width >= line.left - slack;
      case 'above':
        return b.top + b.height <= line.top + 2 && b.top + b.height >= line.top - reach
          && b.left <= line.right + slack && b.left + b.width >= line.left - slack;
      case 'right':
        return b.left >= line.right - 2 && b.left <= line.right + reach
          && b.top <= line.bottom + slack && b.top + b.height >= line.top - slack;
      case 'left':
        return b.left + b.width <= line.left + 2 && b.left + b.width >= line.left - reach
          && b.top <= line.bottom + slack && b.top + b.height >= line.top - slack;
      default:
        return false;
    }
  };

  const anchorPoint = { x: line.left, y: side === 'above' ? line.top : line.bottom };
  const distance = (b: Box) => Math.hypot(b.left - anchorPoint.x, b.top - anchorPoint.y);

  return { line, keep, distance };
}

const lineBox = (l: Line): Box => ({
  left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top,
});

/** Failure result for an anchor whose text is not on the page. */
function anchorMissing(base: ElementResult, anchor: SpecAnchor): ElementResult {
  return {
    ...base,
    status: 'not-found',
    checks: [{
      name: 'Anchor',
      expected: `text “${anchor.text}” on the page`,
      actual: 'not found',
      pass: false,
    }],
  };
}

function posCheck(name: string, actualPt: number, expectedPt: number, tolPt: number, fmt: (n: number) => string): CheckResult {
  const delta = actualPt - expectedPt;
  return {
    name,
    expected: fmt(expectedPt),
    actual: fmt(actualPt),
    delta: `${delta >= 0 ? '+' : ''}${fmt(delta)}`,
    pass: Math.abs(delta) <= tolPt,
  };
}

/**
 * Where an element says it is, in points, for ranking candidates.
 *
 * An element placed from the bottom-right states no Top, so "nearest the
 * declared top" has to fall back to whichever edge it *did* state — a
 * baseline and a bottom are both a y, and comparing against either beats
 * comparing against zero, which is what `el.top ?? 0` would have done.
 */
function expectedY(el: SpecElementBase, u2p: number): number | null {
  const v = el.top ?? el.baseline ?? el.bottom;
  return v == null ? null : v * u2p;
}

function expectedX(el: SpecElementBase, u2p: number): number | null {
  const v = el.left ?? el.right;
  return v == null ? null : v * u2p;
}

/** The actual edges of a found thing, in points. */
interface Edges {
  left: number;
  top: number;
  right: number;
  bottom: number;
  baseline?: number;
}

/**
 * One check per edge the workbook stated, and none for the edges it did not.
 *
 * Checking an edge nobody wrote down would be inventing an assertion; leaving
 * a stated one unchecked would be losing one. Both have happened in this
 * file's history, which is why the list is built from the spec rather than
 * written out at each call site.
 */
function positionChecks(
  el: SpecElementBase, actual: Edges, u2p: number, posTol: number, fmt: (n: number) => string,
): CheckResult[] {
  const out: CheckResult[] = [];
  const pairs: [string, number | undefined, number | undefined][] = [
    ['Left', el.left, actual.left],
    ['Top', el.top, actual.top],
    ['Right', el.right, actual.right],
    ['Bottom', el.bottom, actual.bottom],
    ['Baseline', el.baseline, actual.baseline],
  ];
  for (const [name, expected, found] of pairs) {
    if (expected == null) continue;
    if (found == null) {
      out.push({
        name, expected: fmt(expected * u2p),
        actual: 'this kind of element has no baseline to measure', pass: false,
      });
      continue;
    }
    out.push(posCheck(name, found, expected * u2p, posTol, fmt));
  }
  return out;
}

/** The edges of a line, for `positionChecks`. */
const lineEdges = (l: Line): Edges => ({
  left: l.left, top: l.top, right: l.right, bottom: l.bottom, baseline: l.baseline,
});

/** The edges of a box, for `positionChecks`. */
const boxEdges = (b: Box): Edges => ({
  left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height,
});

// ── per-element checks ────────────────────────────────────────────────
function checkText(
  el: TextSpec, spec: PdfSpec, lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const expLeft = expectedX(el, u2p);
  const expTop = expectedY(el, u2p);
  const posTol = tolPt(el, spec, 'position', u2p);
  const want = normalize(el.text);
  const mode = el.match ?? 'contains';

  let candidates = lines.filter((l) => (mode === 'exact' ? l.norm === want : l.norm.includes(want)));
  const base: ElementResult = {
    id: el.id, type: 'text', label: el.label ?? el.text, status: 'not-found',
    detail: `“${el.text}”`, checks: [],
    expectedBox: expLeft != null && expTop != null
      ? { left: expLeft, top: expTop, width: 6, height: el.fontSize ?? 12 }
      : null,
    actualBox: null,
  };
  if (candidates.length === 0) {
    base.checks.push({ name: 'Present', expected: 'found', actual: 'not found', pass: false });
    return base;
  }

  const checks: CheckResult[] = [];
  let anchored: ((b: Box) => number) | null = null;

  // With an anchor, "which occurrence" is answered by the label rather than by
  // whichever copy happens to sit nearest the declared top.
  if (el.anchor) {
    const region = anchorRegion(el.anchor, lines, u2p);
    if (!region) return anchorMissing(base, el.anchor);
    checks.push({ name: 'Anchor', expected: `“${el.anchor.text}”`, actual: 'found', pass: true });
    const near = candidates.filter((l) => region.keep(lineBox(l)));
    if (near.length === 0) {
      checks.push({
        name: 'Present',
        expected: `“${el.text}” ${el.anchor.position ?? 'below'} “${el.anchor.text}”`,
        actual: 'not in that region',
        pass: false,
      });
      return { ...base, status: 'fail', checks };
    }
    candidates = near;
    anchored = region.distance;
  }

  const line = anchored
    ? candidates.reduce((b, l) => (anchored!(lineBox(l)) < anchored!(lineBox(b)) ? l : b))
    : expTop != null
      ? candidates.reduce((b, l) => (Math.abs(l.top - expTop) < Math.abs(b.top - expTop) ? l : b))
      : candidates[0];
  let unreadableFont = false;
  let unreadableColour = false;
  checks.push({ name: 'Present', expected: 'found', actual: 'found', pass: true });
  checks.push(wordingCheck(el.text, line.text, mode === 'exact'));
  checks.push(...positionChecks(el, lineEdges(line), u2p, posTol, fmt));
  if (el.fontSize != null) {
    const d = line.fontHeight - el.fontSize;
    checks.push({
      name: 'Font size', expected: fmtPtSize(el.fontSize), actual: fmtPtSize(line.fontHeight),
      delta: `${d >= 0 ? '+' : ''}${d.toFixed(1)}pt`, pass: Math.abs(d) <= tol(el, spec, 'fontSize'),
    });
  }

  // ── decision 7 · the font ──
  //
  // A neighbouring weight is a warning, not a failure: Regular against Medium
  // is usually a substituted font, and calling that a defect in the template
  // teaches people to ignore the report.
  let nearWeight = false;
  if (el.font) {
    if (!line.font) {
      // pdf.js could not resolve the font. That is a limit of the reading, so
      // it is unverifiable rather than a failure (decision 6).
      unreadableFont = true;
      checks.push({
        name: 'Font', expected: el.font,
        actual: 'the PDF does not name the font for this text', pass: false,
      });
    } else {
      const r = compareFont(el.font, line.font, { bold: el.bold, italic: el.italic });
      const actual = parseFontName(line.font).raw.replace(/^[A-Z]{6}\+/, '');
      nearWeight = r.verdict === 'near-weight';
      checks.push({
        name: 'Font',
        expected: el.font + (el.bold ? ' bold' : '') + (el.italic ? ' italic' : ''),
        actual,
        ...(r.verdict === 'near-weight'
          ? { delta: `one weight step apart (${r.wanted.weight ?? 400} vs ${r.actual.weight ?? 400})` }
          : r.verdict === 'wrong-family'
            ? { delta: 'a different typeface' }
            : r.verdict === 'wrong-style'
              ? { delta: 'a different slant' }
              : {}),
        pass: r.verdict === 'match',
      });
    }
  }

  // ── decision 8 · the colour ──
  if (el.colour) {
    if (!line.colour) {
      unreadableColour = true;
      checks.push({
        name: 'Colour', expected: el.colour,
        actual: 'the PDF does not state a fill colour for this text', pass: false,
      });
    } else {
      const threshold = spec.colourThreshold ?? COLOUR_DELTA_E;
      const r = compareColour(el.colour, line.colour, threshold);
      if (!r) {
        checks.push({
          name: 'Colour', expected: el.colour,
          actual: 'the spec\u2019s colour is not a hex value', pass: false,
        });
      } else {
        checks.push({
          name: 'Colour', expected: el.colour.toUpperCase(), actual: r.actualHex,
          delta: `ΔE ${r.deltaE.toFixed(1)} (threshold ${threshold})`,
          pass: r.same,
        });
      }
    }
  }

  const othersPass = checks
    .filter((c) => !((unreadableFont && c.name === 'Font') || (unreadableColour && c.name === 'Colour')))
    .every((c) => c.pass);
  return {
    ...base,
    status: checks.every((c) => c.pass)
      ? 'pass'
      : (unreadableFont || unreadableColour) && othersPass
        ? 'unverifiable'
        : 'fail',
    checks,
    actualBox: { left: line.left, top: line.top, width: line.right - line.left, height: line.bottom - line.top },
  };
}

function checkImage(
  el: ImageSpec, spec: PdfSpec, images: Box[], lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  // An image states a width and a height, so a right or bottom edge pins its
  // left or top just as well: the box is reconstructed from whichever pair
  // the workbook gave.
  const expLeft = el.left != null ? el.left * u2p
    : el.right != null ? el.right * u2p - el.width * u2p : null;
  const expTop = el.top != null ? el.top * u2p
    : el.bottom != null ? el.bottom * u2p - el.height * u2p : null;
  const exp: Box | null = expLeft != null && expTop != null
    ? { left: expLeft, top: expTop, width: el.width * u2p, height: el.height * u2p }
    : null;
  const posTol = tolPt(el, spec, 'position', u2p);
  const sizeTol = tolPt(el, spec, 'size', u2p);
  const base: ElementResult = {
    id: el.id, type: 'image', label: el.label ?? el.id, status: 'not-found',
    detail: `image ${el.width}×${el.height}`, checks: [], expectedBox: exp, actualBox: null,
  };
  if (images.length === 0) {
    base.checks.push({ name: 'Present', expected: 'found', actual: 'no image', pass: false });
    return base;
  }

  const checks: CheckResult[] = [];
  let pool = images;

  // An anchor narrows the search to the region beside a real label, which is the
  // only way to tell two images apart when the layout has moved.
  if (el.anchor) {
    const region = anchorRegion(el.anchor, lines, u2p);
    if (!region) return anchorMissing(base, el.anchor);
    checks.push({
      name: 'Anchor',
      expected: `“${el.anchor.text}”`,
      actual: 'found',
      pass: true,
    });
    const near = images.filter(region.keep);
    if (near.length === 0) {
      checks.push({
        name: 'Present',
        expected: `image ${el.anchor.position ?? 'below'} “${el.anchor.text}”`,
        actual: 'no image in that region',
        pass: false,
      });
      return { ...base, status: 'fail', checks };
    }
    pool = near.sort((a, b) => region.distance(a) - region.distance(b));
  }

  const img = el.anchor || !exp
    ? pool[0]
    : pool.reduce((b, im) => {
        const d = Math.hypot(im.left - exp.left, im.top - exp.top);
        const bd = Math.hypot(b.left - exp.left, b.top - exp.top);
        return d < bd ? im : b;
      });
  checks.push({ name: 'Present', expected: 'found', actual: 'found', pass: true });
  checks.push(...positionChecks(el, boxEdges(img), u2p, posTol, fmt));
  checks.push(posCheck('Width', img.width, el.width * u2p, sizeTol, fmt));
  checks.push(posCheck('Height', img.height, el.height * u2p, sizeTol, fmt));
  return {
    ...base, status: checks.every((c) => c.pass) ? 'pass' : 'fail', checks, actualBox: img,
  };
}

function checkTable(
  el: TableSpec, spec: PdfSpec, lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const expLeft = expectedX(el, u2p);
  const expTop = expectedY(el, u2p);
  const expWidth = el.width * u2p;
  const posTol = tolPt(el, spec, 'position', u2p);
  const sizeTol = tolPt(el, spec, 'size', u2p);
  const base: ElementResult = {
    id: el.id, type: 'table', label: el.label ?? el.id, status: 'not-found',
    detail: `table ${el.width} wide`, checks: [],
    expectedBox: expLeft != null && expTop != null
      ? { left: expLeft, top: expTop, width: expWidth, height: 0 }
      : null,
    actualBox: null,
  };

  // Table rows = multi-column lines within the horizontal span. Without an anchor
  // the first row must start near expTop; with one, it must start below the label.
  const spanTol = posTol * 3;
  const anchorChecks: CheckResult[] = [];
  // With no Top and no anchor there is nothing to start from, so the first
  // multi-column row in the span is the table's first row.
  let startTop = expTop ?? -Infinity;
  let startTol = expTop == null ? Infinity : spanTol * 2;

  if (el.anchor) {
    const region = anchorRegion(el.anchor, lines, u2p);
    if (!region) return anchorMissing(base, el.anchor);
    anchorChecks.push({ name: 'Anchor', expected: `“${el.anchor.text}”`, actual: 'found', pass: true });
    // Anchor the table to the label's edge rather than to a coordinate, so
    // content growing above it does not orphan the table.
    startTop = (el.anchor.position ?? 'below') === 'above' ? region.line.top : region.line.bottom;
    startTol = (el.anchor.within ?? DEFAULT_ANCHOR_WITHIN) * u2p;
  }

  // Without a Left the span is the whole page: the width check still means
  // something, the horizontal filter does not.
  const spanLeft = expLeft ?? -Infinity;
  const spanRight = expLeft != null ? expLeft + expWidth : Infinity;
  const inSpan = rowsWithin(lines, spanLeft, spanRight, spanTol)
    .filter((l) => l.count >= 2 && l.top >= startTop - spanTol)
    .sort((a, b) => a.top - b.top);

  const rows: Line[] = [];
  for (const l of inSpan) {
    if (rows.length === 0) {
      if (Math.abs(l.top - startTop) <= startTol) rows.push(l);
    } else {
      const gap = l.top - rows[rows.length - 1].bottom;
      const rowH = rows[rows.length - 1].bottom - rows[rows.length - 1].top;
      if (gap <= Math.max(rowH * 2, 24)) rows.push(l);
      else break;
    }
  }
  if (rows.length < 2) {
    base.checks.push({ name: 'Present', expected: 'found', actual: 'not found', pass: false });
    return base;
  }
  const left = Math.min(...rows.map((r) => r.left));
  const right = Math.max(...rows.map((r) => r.right));
  const top = Math.min(...rows.map((r) => r.top));
  const bottom = Math.max(...rows.map((r) => r.bottom));
  const actual: Box = { left, top, width: right - left, height: bottom - top };
  const cols = Math.max(...rows.map((r) => r.count));

  const checks: CheckResult[] = [...anchorChecks, { name: 'Present', expected: 'found', actual: `${rows.length} rows`, pass: true }];
  checks.push(...positionChecks(el, boxEdges(actual), u2p, posTol, fmt));
  checks.push(posCheck('Width', actual.width, expWidth, sizeTol, fmt));
  if (el.rows != null) checks.push({ name: 'Rows', expected: `${el.rows}`, actual: `${rows.length}`, pass: rows.length === el.rows });
  if (el.columns != null) checks.push({ name: 'Columns', expected: `${el.columns}`, actual: `${cols}`, pass: cols === el.columns });
  return { ...base, status: checks.every((c) => c.pass) ? 'pass' : 'fail', checks, actualBox: actual };
}

function checkParagraph(
  el: ParagraphSpec, spec: PdfSpec, lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const expLeft = expectedX(el, u2p);
  const expTop = expectedY(el, u2p);
  const expSpacing = el.lineSpacing * u2p;
  const posTol = tolPt(el, spec, 'position', u2p);
  const spacingTol = tolPt(el, spec, 'spacing', u2p);
  const want = normalize(el.text);
  const base: ElementResult = {
    id: el.id, type: 'paragraph', label: el.label ?? el.id, status: 'not-found',
    detail: `“${el.text}…”`, checks: [],
    expectedBox: expLeft != null && expTop != null
      ? { left: expLeft, top: expTop, width: 120, height: expSpacing }
      : null,
    actualBox: null,
  };

  const startIdx = lines.findIndex((l) => l.norm.includes(want));
  if (startIdx < 0) {
    base.checks.push({ name: 'Present', expected: 'found', actual: 'not found', pass: false });
    return base;
  }
  const start = lines[startIdx];
  // Collect following lines aligned to the same left edge (the paragraph body).
  const para: Line[] = [start];
  const byTop = [...lines].sort((a, b) => a.top - b.top);
  const si = byTop.indexOf(start);
  for (let i = si + 1; i < byTop.length; i++) {
    const l = byTop[i];
    if (Math.abs(l.left - start.left) > posTol * 2) break;
    const gap = l.baseline - para[para.length - 1].baseline;
    if (gap <= 0 || gap > expSpacing * 2.2) break;
    para.push(l);
  }

  let unmeasurable = true;
  const checks: CheckResult[] = [{ name: 'Present', expected: 'found', actual: `${para.length} lines`, pass: true }];
  checks.push(...positionChecks(el, lineEdges(start), u2p, posTol, fmt));
  if (para.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < para.length; i++) gaps.push(para[i].baseline - para[i - 1].baseline);
    const measured = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const d = measured - expSpacing;
    checks.push({
      name: 'Line spacing', expected: fmt(expSpacing), actual: fmt(measured),
      delta: `${d >= 0 ? '+' : ''}${fmt(d)}`, pass: Math.abs(d) <= spacingTol,
    });
    unmeasurable = false;
  } else {
    // One line has no gap to measure. The spec may still be right; the page
    // simply does not carry the evidence, so this is unverifiable rather than
    // a defect in the document (SR-SPEC-CHECK decisions 6 and 13).
    checks.push({
      name: 'Line spacing', expected: fmt(expSpacing),
      actual: 'one line only — nothing to measure between', pass: false,
    });
  }
  const bottom = Math.max(...para.map((l) => l.bottom));
  const right = Math.max(...para.map((l) => l.right));
  // Everything else passing, with only the unmeasurable spacing left over, is
  // an element nobody can judge — not one that failed.
  const othersPass = checks.filter((c) => c.name !== 'Line spacing').every((c) => c.pass);
  const status = checks.every((c) => c.pass)
    ? 'pass'
    : unmeasurable && othersPass
      ? 'unverifiable'
      : 'fail';
  return {
    ...base, status, checks,
    actualBox: { left: start.left, top: start.top, width: right - start.left, height: bottom - start.top },
  };
}

// ── orchestrator ──────────────────────────────────────────────────────

export interface RunSpecOptions {
  onProgress?: (current: number, total: number) => void;
  /**
   * How much of the workbook became a check (decision 13). The checker cannot
   * work this out — it sees assertions, not rows — so the caller that
   * compiled the workbook passes it through.
   */
  coverage?: SpecCoverage;
  /** The PDF's own name and hash, for the record of the pair (decision 14). */
  pdfName?: string;
  pdfSha256?: string | null;
  /**
   * Check only one spec page, given as its 1-based position in `spec.pages`.
   * Omit to check every page the spec declares.
   */
  specPageIndex?: number;
  /**
   * Check against this PDF page (1-based) instead of the one the spec names.
   *
   * A spec exported from a single sheet always says `"page": 1`, but the page it
   * describes may sit anywhere in a long document. This lets a page be pointed at
   * its real location without editing the spec — the report records both numbers
   * so the mapping stays visible.
   *
   * Only meaningful together with `specPageIndex`.
   */
  pdfPageOverride?: number;
}

export async function runSpec(
  pdf: PDFDocumentProxy,
  spec: PdfSpec,
  options: RunSpecOptions | ((current: number, total: number) => void) = {},
): Promise<SpecReport> {
  // The third argument used to be a bare progress callback; accept both so
  // existing callers keep working.
  const opts: RunSpecOptions = typeof options === 'function' ? { onProgress: options } : options;
  const onProgress = opts.onProgress;

  // Narrow to a single spec page when asked.
  const selected =
    opts.specPageIndex != null
      ? spec.pages.slice(opts.specPageIndex - 1, opts.specPageIndex)
      : spec.pages;
  const unit: SpecUnit = spec.units ?? 'in';
  const u2p = unitToPt(unit);
  const fmt = makeFmt(unit);

  const pages: SpecReport['pages'] = [];
  let totalPass = 0;
  let totalFail = 0;
  let passElements = 0;
  let elementCount = 0;

  // Which PDF page is which spec page (decisions 1–3). A spec with no Pages
  // List — an uploaded JSON — keeps the old behaviour: its own page numbers.
  // So does a page pointed at a PDF page by hand, which is a deliberate
  // override of the binding, not a question for it.
  const override = opts.specPageIndex != null && opts.pdfPageOverride != null;
  const bound = !override && hasPagesList(selected)
    ? bindPages(await pageTexts(pdf), selected)
    : null;

  const steps: { sp: SpecPage; pdfPage: number | null; binding: SpecPageResult['binding']; occurrence: number }[] =
    bound
      ? bound.bindings.map((b) => ({
        sp: b.specPage,
        pdfPage: b.pdfPage,
        binding: b.how === 'missing' ? undefined : b.how,
        occurrence: b.occurrence,
      }))
      : selected.map((sp) => ({
        sp,
        pdfPage: override ? opts.pdfPageOverride! : sp.page,
        binding: 'declared' as const,
        occurrence: 1,
      }));

  // A page the document does not have is reported once, as a page finding, and
  // not again as every element missing — and an Optional page that is absent is
  // not reported as a failure at all (decision 1).
  const toCheck = steps.filter((st) => st.pdfPage != null);

  for (let idx = 0; idx < toCheck.length; idx++) {
    const { sp, occurrence } = toCheck[idx];
    const pdfPage = toCheck[idx].pdfPage!;
    const results: ElementResult[] = [];
    let pageSize: ElementResult | null = null;
    let dataUrl: string | null = null;
    let widthPt = 0;
    let heightPt = 0;

    if (pdfPage >= 1 && pdfPage <= pdf.numPages) {
      const page = await pdf.getPage(pdfPage);
      const { items, widthPt: wp, heightPt: hp } = await extractItems(page);
      widthPt = wp;
      heightPt = hp;
      const lines = groupLines(items);
      const images = await extractImages(page, hp);
      dataUrl = await renderPage(page);

      pageSize = pageSizeResult(spec, wp, hp, u2p, fmt);

      // Nothing to read from: say so once, rather than reporting every text
      // element on the page as missing.
      const blind = noTextLayer(items, images);

      for (const el of sp.elements) {
        if (blind && el.type !== 'image') {
          results.push({
            id: el.id,
            type: el.type,
            label: el.label ?? el.id,
            status: 'unverifiable',
            detail: 'no text layer on this page',
            checks: [{
              name: 'Readable',
              expected: 'text layer',
              actual: 'none — outlined text, a scan, or labels inside an image',
              pass: false,
            }],
            expectedBox: null,
            actualBox: null,
          });
          continue;
        }
        let r: ElementResult;
        if (el.type === 'text') r = checkText(el, spec, lines, u2p, fmt);
        else if (el.type === 'image') r = checkImage(el, spec, images, lines, u2p, fmt);
        else if (el.type === 'table') r = checkTable(el, spec, lines, u2p, fmt);
        else r = checkParagraph(el, spec, lines, u2p, fmt);
        results.push(withSource(el, r));
      }
    } else {
      for (const el of sp.elements) {
        results.push({
          id: el.id, type: el.type, label: el.label ?? el.id, status: 'not-found',
          detail: `page ${pdfPage} missing in PDF`, checks: [{ name: 'Page', expected: `page ${pdfPage}`, actual: `PDF has ${pdf.numPages} page(s)`, pass: false }],
          expectedBox: null, actualBox: null,
        });
      }
    }

    const decided = results.filter((r) => r.status === 'pass' || r.status === 'fail' || r.status === 'not-found');
    const passCount = decided.reduce((s, r) => s + r.checks.filter((c) => c.pass).length, 0);
    const failCount =
      decided.reduce((s, r) => s + r.checks.filter((c) => !c.pass).length, 0) +
      (pageSize && pageSize.status === 'fail' ? 1 : 0);
    const warnCount = results.filter((r) => r.status === 'warning').length +
      (pageSize && pageSize.status === 'warning' ? 1 : 0);
    const unverifiableCount = results.filter((r) => r.status === 'unverifiable').length;
    totalPass += passCount;
    totalFail += failCount;
    elementCount += results.length;
    passElements += results.filter((r) => r.status === 'pass').length;

    pages.push({
      page: pdfPage, specPage: sp.page,
      ...(sp.name ? { name: sp.name } : {}),
      ...(toCheck[idx].binding ? { binding: toCheck[idx].binding } : {}),
      ...(occurrence > 1 ? { occurrence } : {}),
      pageWidthPt: widthPt, pageHeightPt: heightPt, dataUrl,
      elements: results, pageSize, passCount, failCount, warnCount, unverifiableCount,
    });
    onProgress?.(idx + 1, toCheck.length);
  }

  const pageFindings = bound ? bound.findings : [];

  // The spec carries where it came from; the caller carries the PDF's side.
  const from = (spec as PdfSpec & {
    source?: { workbook?: string; sha256?: string | null; templateVersion?: string | null };
  }).source;
  const pair: TestedPair | undefined =
    from || opts.pdfName
      ? {
        ...(from?.workbook ? { workbook: from.workbook } : {}),
        ...(from?.sha256 !== undefined ? { workbookSha256: from.sha256 } : {}),
        ...(from?.templateVersion !== undefined ? { templateVersion: from.templateVersion } : {}),
        ...(opts.pdfName ? { pdfName: opts.pdfName } : {}),
        ...(opts.pdfSha256 !== undefined ? { pdfSha256: opts.pdfSha256 } : {}),
      }
      : undefined;

  return {
    title: spec.title ?? 'Spec check',
    units: unit,
    pages,
    totalPass,
    // A Required page missing, or a variant group that matched none or several,
    // is a failure of the document even though no element was checked — the
    // verdict and the CLI's exit code have to see it.
    totalFail: totalFail + pageFindings.filter((f) => f.severity === 'error').length,
    elementCount,
    passElements,
    pageFindings,
    ...(opts.coverage ? { coverage: opts.coverage } : {}),
    ...(pair ? { pair } : {}),
  };
}

/**
 * The text of every page, for the binder.
 *
 * `getTextContent` is cheap next to rendering, and the binder needs all the
 * pages before it can place the first one — a page may be out of order, which
 * is only visible from the whole document.
 */
async function pageTexts(pdf: PDFDocumentProxy): Promise<string[]> {
  const out: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    out.push(content.items
      .map((it) => (it as { str?: string }).str ?? '')
      .join(' '));
  }
  return out;
}

// Basic shape validation for a parsed spec object.
export function validateSpec(obj: unknown): PdfSpec {
  if (!obj || typeof obj !== 'object') throw new Error('Spec must be a JSON object.');
  const s = obj as PdfSpec;
  if (!Array.isArray(s.pages) || s.pages.length === 0) throw new Error('Spec must have a non-empty "pages" array.');
  for (const p of s.pages) {
    if (typeof p.page !== 'number') throw new Error('Each spec page needs a numeric "page".');
    if (!Array.isArray(p.elements)) throw new Error(`Page ${p.page} needs an "elements" array.`);
  }
  return s;
}
