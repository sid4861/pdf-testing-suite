// Spec-driven validation engine: checks a PDF against a JSON spec.
// All geometry is normalised to POINTS (1/72 inch), top-left origin, so it
// lines up with the spec (converted from its declared units).

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { loadPdf } from './pdfCompare'; // reuses the worker setup + loader
import type {
  Box,
  CheckResult,
  ElementResult,
  ImageSpec,
  ParagraphSpec,
  PdfSpec,
  SpecReport,
  SpecTolerance,
  SpecUnit,
  TableSpec,
  TextSpec,
} from '../types/spec';

export { loadPdf };

const BASE_SCALE = 2;

const DEFAULT_TOL: Required<SpecTolerance> = {
  position: 0.06, // spec units
  size: 0.06,
  spacing: 0.03,
  fontSize: 2, // points
};

function unitToPt(unit: SpecUnit): number {
  if (unit === 'pt') return 1;
  if (unit === 'mm') return 72 / 25.4;
  return 72; // inches
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
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

function groupLines(items: PointItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    const tol = Math.max(2, it.height * 0.6);
    if (last && Math.abs(it.top - last.top) <= tol) {
      last.items.push(it);
      last.top = Math.min(last.top, it.top);
      last.left = Math.min(last.left, it.left);
      last.right = Math.max(last.right, it.left + it.width);
      last.bottom = Math.max(last.bottom, it.top + it.height);
    } else {
      lines.push({
        items: [it],
        text: '',
        norm: '',
        left: it.left,
        right: it.left + it.width,
        top: it.top,
        bottom: it.top + it.height,
        baseline: it.baseline,
        fontHeight: it.height,
        count: 1,
      });
    }
  }
  for (const l of lines) {
    const ordered = [...l.items].sort((a, b) => a.left - b.left);
    l.text = ordered.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    l.norm = normalize(l.text);
    l.baseline = l.items.reduce((s, i) => s + i.baseline, 0) / l.items.length;
    l.fontHeight = median(l.items.map((i) => i.height));
    l.count = l.items.length;
  }
  return lines;
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

function tol(el: { tolerance?: SpecTolerance }, spec: PdfSpec, key: keyof SpecTolerance): number {
  return el.tolerance?.[key] ?? spec.tolerance?.[key] ?? DEFAULT_TOL[key];
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
  const posTol = tol(el, spec, 'position') * u2p;
  const want = normalize(el.text);
  const mode = el.match ?? 'contains';

  const candidates = lines.filter((l) => (mode === 'exact' ? l.norm === want : l.norm.includes(want)));
  const base: ElementResult = {
    id: el.id, type: 'text', label: el.label ?? el.text, status: 'not-found',
    detail: `“${el.text}”`, checks: [], expectedBox: { left: expLeft, top: expTop, width: 6, height: el.fontSize ?? 12 }, actualBox: null,
  };
  if (candidates.length === 0) {
    base.checks.push({ name: 'Present', expected: 'found', actual: 'not found', pass: false });
    return base;
  }
  const line = candidates.reduce((b, l) => (Math.abs(l.top - expTop) < Math.abs(b.top - expTop) ? l : b));
  const checks: CheckResult[] = [{ name: 'Present', expected: 'found', actual: 'found', pass: true }];
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
  el: ImageSpec, spec: PdfSpec, images: Box[], u2p: number, fmt: (n: number) => string,
): ElementResult {
  const exp: Box = { left: el.left * u2p, top: el.top * u2p, width: el.width * u2p, height: el.height * u2p };
  const posTol = tol(el, spec, 'position') * u2p;
  const sizeTol = tol(el, spec, 'size') * u2p;
  const base: ElementResult = {
    id: el.id, type: 'image', label: el.label ?? el.id, status: 'not-found',
    detail: `image ${el.width}×${el.height}`, checks: [], expectedBox: exp, actualBox: null,
  };
  if (images.length === 0) {
    base.checks.push({ name: 'Present', expected: 'found', actual: 'no image', pass: false });
    return base;
  }
  // nearest image to expected top-left
  const img = images.reduce((b, im) => {
    const d = Math.hypot(im.left - exp.left, im.top - exp.top);
    const bd = Math.hypot(b.left - exp.left, b.top - exp.top);
    return d < bd ? im : b;
  });
  const checks: CheckResult[] = [{ name: 'Present', expected: 'found', actual: 'found', pass: true }];
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
  const posTol = tol(el, spec, 'position') * u2p;
  const sizeTol = tol(el, spec, 'size') * u2p;
  const exp: Box = { left: expLeft, top: expTop, width: expWidth, height: 0 };
  const base: ElementResult = {
    id: el.id, type: 'table', label: el.label ?? el.id, status: 'not-found',
    detail: `table ${el.width} wide`, checks: [], expectedBox: exp, actualBox: null,
  };

  // Table rows = multi-column lines within the horizontal span, starting near expTop.
  const spanTol = posTol * 3;
  const inSpan = lines.filter(
    (l) => l.count >= 2 && l.left >= expLeft - spanTol && l.left <= expLeft + expWidth + spanTol && l.top >= expTop - spanTol,
  ).sort((a, b) => a.top - b.top);

  const rows: Line[] = [];
  for (const l of inSpan) {
    if (rows.length === 0) {
      if (Math.abs(l.top - expTop) <= spanTol * 2) rows.push(l);
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

  const checks: CheckResult[] = [{ name: 'Present', expected: 'found', actual: `${rows.length} rows`, pass: true }];
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
  const posTol = tol(el, spec, 'position') * u2p;
  const spacingTol = tol(el, spec, 'spacing') * u2p;
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
  } else {
    checks.push({ name: 'Line spacing', expected: fmt(expSpacing), actual: 'single line', pass: false });
  }
  const bottom = Math.max(...para.map((l) => l.bottom));
  const right = Math.max(...para.map((l) => l.right));
  return {
    ...base, status: checks.every((c) => c.pass) ? 'pass' : 'fail', checks,
    actualBox: { left: start.left, top: start.top, width: right - start.left, height: bottom - start.top },
  };
}

// ── orchestrator ──────────────────────────────────────────────────────
export async function runSpec(
  pdf: PDFDocumentProxy,
  spec: PdfSpec,
  onProgress?: (current: number, total: number) => void,
): Promise<SpecReport> {
  const unit: SpecUnit = spec.units ?? 'in';
  const u2p = unitToPt(unit);
  const fmt = makeFmt(unit);

  const pages: SpecReport['pages'] = [];
  let totalPass = 0;
  let totalFail = 0;
  let passElements = 0;
  let elementCount = 0;

  for (let idx = 0; idx < spec.pages.length; idx++) {
    const sp = spec.pages[idx];
    const results: ElementResult[] = [];
    let dataUrl: string | null = null;
    let widthPt = 0;
    let heightPt = 0;

    if (sp.page >= 1 && sp.page <= pdf.numPages) {
      const page = await pdf.getPage(sp.page);
      const { items, widthPt: wp, heightPt: hp } = await extractItems(page);
      widthPt = wp;
      heightPt = hp;
      const lines = groupLines(items);
      const images = await extractImages(page, hp);
      dataUrl = await renderPage(page);

      for (const el of sp.elements) {
        let r: ElementResult;
        if (el.type === 'text') r = checkText(el, spec, lines, u2p, fmt);
        else if (el.type === 'image') r = checkImage(el, spec, images, u2p, fmt);
        else if (el.type === 'table') r = checkTable(el, spec, lines, u2p, fmt);
        else r = checkParagraph(el, spec, lines, u2p, fmt);
        results.push(r);
      }
    } else {
      for (const el of sp.elements) {
        results.push({
          id: el.id, type: el.type, label: el.label ?? el.id, status: 'not-found',
          detail: `page ${sp.page} missing in PDF`, checks: [{ name: 'Page', expected: `page ${sp.page}`, actual: 'not in PDF', pass: false }],
          expectedBox: null, actualBox: null,
        });
      }
    }

    const passCount = results.reduce((s, r) => s + r.checks.filter((c) => c.pass).length, 0);
    const failCount = results.reduce((s, r) => s + r.checks.filter((c) => !c.pass).length, 0);
    totalPass += passCount;
    totalFail += failCount;
    elementCount += results.length;
    passElements += results.filter((r) => r.status === 'pass').length;

    pages.push({ page: sp.page, pageWidthPt: widthPt, pageHeightPt: heightPt, dataUrl, elements: results, passCount, failCount });
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
