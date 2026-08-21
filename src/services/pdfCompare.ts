// Framework-agnostic PDF comparison engine.
// Uses the DOM only for <canvas> operations. No React, no store access.

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import pixelmatch from 'pixelmatch';
import { diffWords } from 'diff';

import type {
  TextItem,
  TextStyle,
  StyleDiff,
  DiffSegment,
  MatchedPair,
  ItemMatch,
  PixelDiffResult,
  RenderedPageImage,
  PageComparison,
} from '../types/compare';

// Assign the worker once, globally.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// ── Rendering tunables ────────────────────────────────────────────────
const BASE_SCALE = 2;        // ~144 DPI: 1pt = 2px
const MAX_PAGE_WIDTH = 1600; // cap on target-box width in px

export interface ComparePageOpts {
  pixelThreshold?: number;
  includeAA?: boolean;
}

// ── 5.1 loadPdf ───────────────────────────────────────────────────────
export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const buffer = await file.arrayBuffer();
  // Copy — getDocument transfers/detaches the original buffer.
  const data = new Uint8Array(buffer.slice(0));
  const task = pdfjsLib.getDocument({ data });
  return task.promise;
}

interface RenderResult {
  image: RenderedPageImage;
  items: TextItem[];
}

// ── 5.2 renderAndExtract ──────────────────────────────────────────────
async function renderAndExtract(
  page: PDFPageProxy,
  targetW: number,
  targetH: number,
): Promise<RenderResult> {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(targetW / vp1.width, targetH / vp1.height);
  const viewport = page.getViewport({ scale });

  const fittedW = Math.round(viewport.width);
  const fittedH = Math.round(viewport.height);

  // Render onto a temporary canvas sized to the fitted dimensions.
  const tmp = document.createElement('canvas');
  tmp.width = fittedW;
  tmp.height = fittedH;
  const tctx = tmp.getContext('2d')!;
  await page.render({ canvasContext: tctx, viewport }).promise;

  // Composite centered (letterboxed) into the target box.
  const offsetX = Math.round((targetW - fittedW) / 2);
  const offsetY = Math.round((targetH - fittedH) / 2);

  const target = document.createElement('canvas');
  target.width = targetW;
  target.height = targetH;
  const ctx = target.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(tmp, offsetX, offsetY);

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const dataUrl = target.toDataURL('image/png');

  const letterboxed = Math.abs(vp1.width / vp1.height - targetW / targetH) > 0.01;

  const items = await extractItems(page, viewport, scale, offsetX, offsetY);

  return {
    image: { dataUrl, imageData, width: targetW, height: targetH, letterboxed },
    items,
  };
}

// ── font resolution ───────────────────────────────────────────────────
// PDFs frequently subset fonts and prefix the name with a six-letter tag
// ("ABCDEF+Helvetica-Bold"). The tag is per-file and meaningless for comparison,
// so it is stripped before two sides are compared.
const stripSubsetTag = (name: string) => name.replace(/^[A-Z]{6}\+/, '');

/**
 * Resolve a run's typography.
 *
 * `page.commonObjs` only holds the font once the page has been rendered — which
 * is why renderAndExtract renders first and extracts second. If a font is still
 * unresolved the run simply carries no style, and restyle detection skips it
 * rather than reporting a false difference.
 */
function resolveStyle(
  page: PDFPageProxy,
  fontName: string | undefined,
  sizePx: number,
): TextStyle | undefined {
  if (!fontName) return undefined;
  try {
    const font = (page.commonObjs as unknown as { get(name: string): unknown }).get(fontName) as
      | { name?: string; fallbackName?: string; bold?: boolean; italic?: boolean; black?: boolean }
      | undefined;
    if (!font) return undefined;

    const raw = font.name ?? font.fallbackName ?? fontName;
    const name = stripSubsetTag(raw);
    // Some producers encode weight/slant only in the name, so fall back to it
    // when the parsed flags are absent.
    const bold = font.bold === true || font.black === true || /bold|black|heavy/i.test(name);
    const italic = font.italic === true || /italic|oblique/i.test(name);

    return { font: name, size: sizePx, bold, italic };
  } catch {
    return undefined; // not resolved yet — treat as unknown, never as a difference
  }
}

// ── 5.3 extractItems ──────────────────────────────────────────────────
async function extractItems(
  page: PDFPageProxy,
  viewport: pdfjsLib.PageViewport,
  scale: number,
  offsetX: number,
  offsetY: number,
): Promise<TextItem[]> {
  const content = await page.getTextContent();
  const items: TextItem[] = [];

  for (const raw of content.items) {
    const item = raw as { str?: string; width?: number; transform?: number[]; fontName?: string };
    if (typeof item.str !== 'string') continue; // skip marked-content markers
    if (!item.str.trim()) continue;              // skip whitespace-only runs

    const m = pdfjsLib.Util.transform(viewport.transform, item.transform!);
    const fontHeight = Math.hypot(m[2], m[3]);
    const x = m[4] + offsetX;
    const y = m[5] - fontHeight + offsetY; // m[5] is baseline; subtract height for top edge
    const w = (item.width ?? 0) * scale;
    const h = fontHeight;

    items.push({ str: item.str, x, y, w, h, style: resolveStyle(page, item.fontName, fontHeight) });
  }

  return items;
}

// ── style comparison ──────────────────────────────────────────────────
// Rendered sizes carry sub-pixel noise from scaling, so only a visible
// difference counts — below this it is the same size, not a restyle.
const SIZE_TOLERANCE_PX = 0.75;

/**
 * Compare two runs' typography. Returns null when they are effectively identical.
 *
 * `compareSizes` is false when B was letterboxed to fit A's box: every glyph on
 * that page is uniformly rescaled, so sizes are not comparable and treating them
 * as restyles would flag the whole page. Font, weight and slant stay meaningful.
 */
export function diffStyle(
  a: TextStyle | undefined,
  b: TextStyle | undefined,
  compareSizes = true,
): StyleDiff | null {
  // Unknown typography on either side is not evidence of a change.
  if (!a || !b) return null;

  const font = a.font !== b.font;
  const size = compareSizes && Math.abs(a.size - b.size) > SIZE_TOLERANCE_PX;
  const bold = a.bold !== b.bold;
  const italic = a.italic !== b.italic;
  if (!font && !size && !bold && !italic) return null;

  const parts: string[] = [];
  if (font) parts.push(`${a.font} → ${b.font}`);
  if (size) parts.push(`${a.size.toFixed(1)}px → ${b.size.toFixed(1)}px`);
  if (bold) parts.push(b.bold ? 'bold added' : 'bold removed');
  if (italic) parts.push(b.italic ? 'italic added' : 'italic removed');

  return { font, size, bold, italic, summary: parts.join(' · ') };
}

// ── 5.4 reconstructReadingText ────────────────────────────────────────
export function reconstructReadingText(items: TextItem[]): string {
  if (items.length === 0) return '';

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const heights = [...items.map((i) => i.h)].sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 0;
  const lineTol = Math.max(4, medianH * 0.6);

  const lines: TextItem[][] = [];
  let current: TextItem[] = [];
  let lineY = sorted[0].y;

  for (const item of sorted) {
    if (current.length === 0 || Math.abs(item.y - lineY) <= lineTol) {
      current.push(item);
      // Track the running top of the line.
      lineY = current.reduce((s, i) => s + i.y, 0) / current.length;
    } else {
      lines.push(current);
      current = [item];
      lineY = item.y;
    }
  }
  if (current.length) lines.push(current);

  return lines
    .map((line) =>
      [...line]
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' '),
    )
    .join('\n')
    .replace(/ {2,}/g, ' ');
}

// ── 5.5 diffText ──────────────────────────────────────────────────────
export function diffText(textA: string, textB: string): DiffSegment[] {
  return diffWords(textA, textB).map((part) => ({
    value: part.value,
    added: part.added,
    removed: part.removed,
  }));
}

// ── 5.6 contentMatchRatio ─────────────────────────────────────────────
export function contentMatchRatio(diff: DiffSegment[]): number {
  let same = 0;
  let total = 0;
  for (const seg of diff) {
    total += seg.value.length;
    if (!seg.added && !seg.removed) same += seg.value.length;
  }
  return total === 0 ? 1 : same / total;
}

// ── 5.7 pixelDiff ─────────────────────────────────────────────────────
export function pixelDiff(
  a: ImageData,
  b: ImageData,
  opts: { threshold?: number; includeAA?: boolean } = {},
): PixelDiffResult {
  const { threshold = 0.1, includeAA = false } = opts;
  const { width, height } = a;

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;
  const ctx = diffCanvas.getContext('2d')!;
  const diffImage = ctx.createImageData(width, height);

  const changed = pixelmatch(a.data, b.data, diffImage.data, width, height, {
    threshold,
    includeAA,
    alpha: 0.4,
  });

  ctx.putImageData(diffImage, 0, 0);
  const total = width * height;

  return {
    diffDataUrl: diffCanvas.toDataURL('image/png'),
    changed,
    total,
    ratio: total === 0 ? 0 : changed / total,
  };
}

// ── 5.8 matchItems ────────────────────────────────────────────────────
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function matchItems(
  itemsA: TextItem[],
  itemsB: TextItem[],
  opts: { compareSizes?: boolean } = {},
): ItemMatch {
  const matched: MatchedPair[] = [];
  const onlyA: TextItem[] = [];

  const buckets = new Map<string, { item: TextItem; used: boolean }[]>();
  for (const b of itemsB) {
    const key = normalize(b.str);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({ item: b, used: false });
  }

  for (const a of itemsA) {
    const key = normalize(a.str);
    const candidates = key ? buckets.get(key) : undefined;
    const avail = candidates?.filter((c) => !c.used) ?? [];

    if (avail.length === 0) {
      onlyA.push(a);
      continue;
    }

    let best = avail[0];
    let bestDist = Infinity;
    for (const c of avail) {
      const dx = c.item.x - a.x;
      const dy = c.item.y - a.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    best.used = true;

    const dx = best.item.x - a.x;
    const dy = best.item.y - a.y;
    matched.push({
      str: key,
      a,
      b: best.item,
      dx,
      dy,
      dw: best.item.w - a.w,
      dh: best.item.h - a.h,
      offset: Math.hypot(dx, dy),
      // Same words on both sides, so any typography difference is a restyle
      // rather than a content edit.
      styleDiff: diffStyle(a.style, best.item.style, opts.compareSizes ?? true) ?? undefined,
    });
  }

  const onlyB: TextItem[] = [];
  for (const list of buckets.values()) {
    for (const c of list) {
      if (!c.used && normalize(c.item.str)) onlyB.push(c.item);
    }
  }

  return { matched, onlyA, onlyB };
}

// ── target box dimensions ─────────────────────────────────────────────
// `scale` is px-per-point; px-per-inch = scale × 72.
function targetBox(page: PDFPageProxy): { w: number; h: number; scale: number } {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(BASE_SCALE, MAX_PAGE_WIDTH / vp1.width);
  return {
    w: Math.round(vp1.width * scale),
    h: Math.round(vp1.height * scale),
    scale,
  };
}

// ── 5.9 comparePage ───────────────────────────────────────────────────
export async function comparePage(
  pdfA: PDFDocumentProxy | null,
  pdfB: PDFDocumentProxy | null,
  pageIndex: number,
  opts: ComparePageOpts = {},
): Promise<PageComparison> {
  const hasA = !!pdfA && pageIndex < pdfA.numPages;
  const hasB = !!pdfB && pageIndex < pdfB.numPages;

  const notes: string[] = [];

  // Side A defines the target box; fall back to B if A is missing.
  let box: { w: number; h: number; scale: number };
  if (hasA) {
    const pageA = await pdfA!.getPage(pageIndex + 1);
    box = targetBox(pageA);
  } else if (hasB) {
    const pageB = await pdfB!.getPage(pageIndex + 1);
    box = targetBox(pageB);
  } else {
    box = { w: 800, h: 1000, scale: BASE_SCALE };
  }
  const pxPerInch = box.scale * 72;

  let imageA: RenderedPageImage | null = null;
  let imageB: RenderedPageImage | null = null;
  let itemsA: TextItem[] = [];
  let itemsB: TextItem[] = [];

  if (hasA) {
    const pageA = await pdfA!.getPage(pageIndex + 1);
    const r = await renderAndExtract(pageA, box.w, box.h);
    imageA = r.image;
    itemsA = r.items;
    if (itemsA.length === 0) notes.push('No selectable text layer in A (scanned image?).');
  } else {
    notes.push('This page exists only in the recreated PDF (B).');
  }

  if (hasB) {
    const pageB = await pdfB!.getPage(pageIndex + 1);
    const r = await renderAndExtract(pageB, box.w, box.h);
    imageB = r.image;
    itemsB = r.items;
    if (itemsB.length === 0) notes.push('No selectable text layer in B (scanned image?).');
    if (r.image.letterboxed) {
      notes.push('Page B has a different size/aspect ratio and was scaled to fit A.');
    }
  } else {
    notes.push('This page exists only in the original PDF (A).');
  }

  const textA = reconstructReadingText(itemsA);
  const textB = reconstructReadingText(itemsB);
  const diff = diffText(textA, textB);
  const contentMatch = contentMatchRatio(diff);

  // A letterboxed B was uniformly rescaled to fit A's box, so glyph sizes on this
  // page are not comparable between the two sides.
  const rescaled = imageB?.letterboxed === true;
  const match = matchItems(itemsA, itemsB, { compareSizes: !rescaled });
  const maxOffset = match.matched.reduce((m, p) => Math.max(m, p.offset), 0);

  let pixel: PixelDiffResult | null = null;
  if (
    imageA &&
    imageB &&
    imageA.imageData &&
    imageB.imageData &&
    imageA.width === imageB.width &&
    imageA.height === imageB.height
  ) {
    pixel = pixelDiff(imageA.imageData, imageB.imageData, {
      threshold: opts.pixelThreshold,
      includeAA: opts.includeAA,
    });
  }

  return {
    pageIndex,
    imageA,
    imageB,
    textA,
    textB,
    diff,
    contentMatch,
    match,
    maxOffset,
    pxPerInch,
    pixel,
    notes,
  };
}
