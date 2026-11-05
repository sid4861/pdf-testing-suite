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
  SpecReport,
  SpecTolerance,
  SpecUnit,
  TableSpec,
  TextSpec,
} from './types';
import { ANCHOR_WITHIN, BASE_SCALE, SPEC_TOLERANCE } from '../../services/specConstants';

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
function canonical(s: string): string {
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
}

async function extractItems(page: PDFPageProxy): Promise<{ items: PointItem[]; widthPt: number; heightPt: number }> {
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: PointItem[] = [];
  for (const raw of content.items) {
    const it = raw as { str?: string; width?: number; transform?: number[] };
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    const m = pdfjsLib.Util.transform(vp.transform, it.transform!);
    const fontHeight = Math.hypot(m[2], m[3]);
    items.push({
      str: it.str,
      left: m[4],
      top: m[5] - fontHeight,
      width: (it.width ?? 0),
      height: fontHeight,
      baseline: m[5],
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
    else if (imgOps.has(fn)) {
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

// ── per-element checks ────────────────────────────────────────────────
function checkText(
  el: TextSpec, spec: PdfSpec, lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const expLeft = el.left * u2p;
  const expTop = el.top * u2p;
  const posTol = tolPt(el, spec, 'position', u2p);
  const want = normalize(el.text);
  const mode = el.match ?? 'contains';

  let candidates = lines.filter((l) => (mode === 'exact' ? l.norm === want : l.norm.includes(want)));
  const base: ElementResult = {
    id: el.id, type: 'text', label: el.label ?? el.text, status: 'not-found',
    detail: `“${el.text}”`, checks: [], expectedBox: { left: expLeft, top: expTop, width: 6, height: el.fontSize ?? 12 }, actualBox: null,
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
    : candidates.reduce((b, l) => (Math.abs(l.top - expTop) < Math.abs(b.top - expTop) ? l : b));
  checks.push({ name: 'Present', expected: 'found', actual: 'found', pass: true });
  checks.push(posCheck('Left', line.left, expLeft, posTol, fmt));
  checks.push(posCheck('Top', line.top, expTop, posTol, fmt));
  if (el.fontSize != null) {
    const d = line.fontHeight - el.fontSize;
    checks.push({
      name: 'Font size', expected: fmtPtSize(el.fontSize), actual: fmtPtSize(line.fontHeight),
      delta: `${d >= 0 ? '+' : ''}${d.toFixed(1)}pt`, pass: Math.abs(d) <= tol(el, spec, 'fontSize'),
    });
  }
  return {
    ...base,
    status: checks.every((c) => c.pass) ? 'pass' : 'fail',
    checks,
    actualBox: { left: line.left, top: line.top, width: line.right - line.left, height: line.bottom - line.top },
  };
}

function checkImage(
  el: ImageSpec, spec: PdfSpec, images: Box[], lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const exp: Box = { left: el.left * u2p, top: el.top * u2p, width: el.width * u2p, height: el.height * u2p };
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

  const img = el.anchor
    ? pool[0]
    : pool.reduce((b, im) => {
        const d = Math.hypot(im.left - exp.left, im.top - exp.top);
        const bd = Math.hypot(b.left - exp.left, b.top - exp.top);
        return d < bd ? im : b;
      });
  checks.push({ name: 'Present', expected: 'found', actual: 'found', pass: true });
  checks.push(posCheck('Left', img.left, exp.left, posTol, fmt));
  checks.push(posCheck('Top', img.top, exp.top, posTol, fmt));
  checks.push(posCheck('Width', img.width, exp.width, sizeTol, fmt));
  checks.push(posCheck('Height', img.height, exp.height, sizeTol, fmt));
  return {
    ...base, status: checks.every((c) => c.pass) ? 'pass' : 'fail', checks, actualBox: img,
  };
}

function checkTable(
  el: TableSpec, spec: PdfSpec, lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const expLeft = el.left * u2p;
  const expTop = el.top * u2p;
  const expWidth = el.width * u2p;
  const posTol = tolPt(el, spec, 'position', u2p);
  const sizeTol = tolPt(el, spec, 'size', u2p);
  const exp: Box = { left: expLeft, top: expTop, width: expWidth, height: 0 };
  const base: ElementResult = {
    id: el.id, type: 'table', label: el.label ?? el.id, status: 'not-found',
    detail: `table ${el.width} wide`, checks: [], expectedBox: exp, actualBox: null,
  };

  // Table rows = multi-column lines within the horizontal span. Without an anchor
  // the first row must start near expTop; with one, it must start below the label.
  const spanTol = posTol * 3;
  const anchorChecks: CheckResult[] = [];
  let startTop = expTop;
  let startTol = spanTol * 2;

  if (el.anchor) {
    const region = anchorRegion(el.anchor, lines, u2p);
    if (!region) return anchorMissing(base, el.anchor);
    anchorChecks.push({ name: 'Anchor', expected: `“${el.anchor.text}”`, actual: 'found', pass: true });
    // Anchor the table to the label's edge rather than to a coordinate, so
    // content growing above it does not orphan the table.
    startTop = (el.anchor.position ?? 'below') === 'above' ? region.line.top : region.line.bottom;
    startTol = (el.anchor.within ?? DEFAULT_ANCHOR_WITHIN) * u2p;
  }

  const inSpan = rowsWithin(lines, expLeft, expLeft + expWidth, spanTol)
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
  checks.push(posCheck('Left', left, expLeft, posTol, fmt));
  checks.push(posCheck('Top', top, expTop, posTol, fmt));
  checks.push(posCheck('Width', actual.width, expWidth, sizeTol, fmt));
  if (el.rows != null) checks.push({ name: 'Rows', expected: `${el.rows}`, actual: `${rows.length}`, pass: rows.length === el.rows });
  if (el.columns != null) checks.push({ name: 'Columns', expected: `${el.columns}`, actual: `${cols}`, pass: cols === el.columns });
  return { ...base, status: checks.every((c) => c.pass) ? 'pass' : 'fail', checks, actualBox: actual };
}

function checkParagraph(
  el: ParagraphSpec, spec: PdfSpec, lines: Line[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const expLeft = el.left * u2p;
  const expTop = el.top * u2p;
  const expSpacing = el.lineSpacing * u2p;
  const posTol = tolPt(el, spec, 'position', u2p);
  const spacingTol = tolPt(el, spec, 'spacing', u2p);
  const want = normalize(el.text);
  const base: ElementResult = {
    id: el.id, type: 'paragraph', label: el.label ?? el.id, status: 'not-found',
    detail: `“${el.text}…”`, checks: [], expectedBox: { left: expLeft, top: expTop, width: 120, height: expSpacing }, actualBox: null,
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
  checks.push(posCheck('Left', start.left, expLeft, posTol, fmt));
  checks.push(posCheck('Top', start.top, expTop, posTol, fmt));
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

  for (let idx = 0; idx < selected.length; idx++) {
    const sp = selected[idx];
    // An override only applies when a single page was selected; otherwise every
    // page would be checked against the same one.
    const pdfPage =
      opts.specPageIndex != null && opts.pdfPageOverride != null ? opts.pdfPageOverride : sp.page;
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
        results.push(r);
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
    const failCount = decided.reduce((s, r) => s + r.checks.filter((c) => !c.pass).length, 0);
      + (pageSize && pageSize.status === 'fail' ? 1 : 0);
    const warnCount = results.filter((r) => r.status === 'warning').length +
      (pageSize && pageSize.status === 'warning' ? 1 : 0);
    const unverifiableCount = results.filter((r) => r.status === 'unverifiable').length;
    totalPass += passCount;
    totalFail += failCount;
    elementCount += results.length;
    passElements += results.filter((r) => r.status === 'pass').length;

    pages.push({ page: pdfPage, specPage: sp.page, pageWidthPt: widthPt, pageHeightPt: heightPt, dataUrl, elements: results, pageSize, passCount, failCount, warnCount, unverifiableCount });
    onProgress?.(idx + 1, spec.pages.length);
  }

  return {
    title: spec.title ?? 'Spec check',
    units: unit,
    pages,
    totalPass,
    totalFail,
    elementCount,
    passElements,
  };
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
