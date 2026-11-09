// Framework-agnostic PDF comparison engine.
// Uses the DOM only for <canvas> operations. No React, no store access.

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import pixelmatch from 'pixelmatch';
// Both live in one file for the whole project — SR-CONSTANTS.
import { BASE_SCALE, MAX_PAGE_WIDTH } from './constants';
import { diffWords, diffArrays } from 'diff';

import type {
  TextItem,
  TextStyle,
  StyleDiff,
  DiffSegment,
  MatchedPair,
  ItemMatch,
  RestyledSpan,
  PixelDiffResult,
  RenderedPageImage,
  PageComparison,
} from './types';

// Assign the worker once, globally.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// ── Rendering tunables ────────────────────────────────────────────────

export interface ComparePageOpts {
  pixelThreshold?: number;
  includeAA?: boolean;
  /**
   * The page to read from the document under test, 0-based, when it is not the
   * same number as the golden page.
   *
   * Page 5 against page 5 is only right while both documents hold the same pages
   * in the same order; one inserted page makes every later comparison
   * meaningless. Passing the two numbers separately is what lets a caller say
   * which pages actually correspond. Defaults to `pageIndex`, which is the
   * straight page-by-page behaviour.
   *
   * `null` means the golden page has no counterpart at all.
   */
  pageIndexB?: number | null;
  /** As `pageIndexB`, for a tested page with no golden page to compare against. */
  pageIndexA?: number | null;
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
  images: TextItem[];
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
  const images = await extractImages(page, vp1, scale, offsetX, offsetY);

  return {
    image: { dataUrl, imageData, width: targetW, height: targetH, letterboxed },
    items,
    images,
  };
}

/**
 * Image placements on the page, in the same pixel space as the text runs.
 *
 * Images are absent from the text layer, so they have to come off the operator
 * list: walk it tracking the transform matrix, and every paint op gives the unit
 * square its placed rectangle. Without this a logo that moves is invisible to
 * the comparison — the pixel diff sees it, but nothing names it.
 */
async function extractImages(
  page: PDFPageProxy,
  vp1: pdfjsLib.PageViewport,
  scale: number,
  offsetX: number,
  offsetY: number,
): Promise<TextItem[]> {
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS as unknown as Record<string, number>;
  const paintOps = new Set(
    [
      'paintImageXObject',
      'paintImageXObjectRepeat',
      'paintJpegXObject',
      'paintImageMaskXObject',
      'paintInlineImageXObject',
    ]
      .map((k) => OPS[k])
      .filter((v) => v != null),
  );

  const out: TextItem[] = [];
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === OPS.save) {
      stack.push(ctm.slice());
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      ctm = pdfjsLib.Util.transform(ctm, opList.argsArray[i] as number[]);
    } else if (paintOps.has(fn)) {
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) =>
        pdfjsLib.Util.applyTransform(p, ctm),
      );
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const w = (maxX - minX) * scale;
      const h = (maxY - minY) * scale;
      // Ignore hairline artefacts: rules and separators are often drawn as
      // 1pt-tall images and would swamp the list.
      if (w < 4 || h < 4) continue;

      out.push({
        str: 'Image',
        kind: 'image',
        x: minX * scale + offsetX,
        // PDF user space is bottom-up; the app's boxes are top-down.
        y: (vp1.height - maxY) * scale + offsetY,
        w,
        h,
      });
    }
  }

  return out;
}

/**
 * Pair images between the two sides.
 *
 * They carry no text, so identity comes from shape and proximity: the closest
 * unclaimed image of a similar size wins. Anything left over on one side only
 * is a genuine addition or removal.
 */
function matchImages(a: TextItem[], b: TextItem[]) {
  const matched: MatchedPair[] = [];
  const usedB = new Set<number>();

  for (const ia of a) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < b.length; j++) {
      if (usedB.has(j)) continue;
      const ib = b[j];
      // Same picture, moved: the drawn size should be close.
      const sizeOff =
        Math.abs(ib.w - ia.w) / Math.max(ia.w, 1) + Math.abs(ib.h - ia.h) / Math.max(ia.h, 1);
      if (sizeOff > 0.25) continue;
      const d = Math.hypot(
        ib.x + ib.w / 2 - (ia.x + ia.w / 2),
        ib.y + ib.h / 2 - (ia.y + ia.h / 2),
      );
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best === -1) continue;
    usedB.add(best);
    const ib = b[best];
    const dx = ib.x - ia.x;
    const dy = ib.y - ia.y;
    matched.push({
      str: 'Image',
      a: ia,
      b: ib,
      dx,
      dy,
      dw: ib.w - ia.w,
      dh: ib.h - ia.h,
      offset: Math.hypot(dx, dy),
    });
  }

  const claimedA = new Set(matched.map((m) => m.a));
  return {
    matched,
    onlyA: a.filter((x) => !claimedA.has(x)),
    onlyB: b.filter((_, j) => !usedB.has(j)),
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
// Matching is deliberately case-insensitive so that a capitalisation change
// pairs the two runs instead of looking like a deletion plus an insertion. The
// difference is not discarded, though — see `caseDiff` below.
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
/** Same collapsing, but case preserved — used to detect capitalisation edits. */
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

export function matchItems(
  itemsA: TextItem[],
  itemsB: TextItem[],
  opts: { compareSizes?: boolean; imagesA?: TextItem[]; imagesB?: TextItem[] } = {},
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
      // These two only matched because matching folds case. If the raw text
      // differs, the capitalisation changed — a content edit, not a restyle.
      caseDiff: collapse(a.str) !== collapse(best.item.str) || undefined,
    });
  }

  const onlyB: TextItem[] = [];
  for (const list of buckets.values()) {
    for (const c of list) {
      if (!c.used && normalize(c.item.str)) onlyB.push(c.item);
    }
  }

  // Recover spans that only LOOK like content changes because the two sides were
  // split into runs differently (see reconcileSegmentation).
  const reconciled = reconcileSegmentation(onlyA, onlyB, opts.compareSizes ?? true);
  return {
    matched,
    onlyA: reconciled.onlyA,
    onlyB: reconciled.onlyB,
    restyled: reconciled.restyled,
    images: matchImages(opts.imagesA ?? [], opts.imagesB ?? []),
  };
}

// ── word-level reconciliation ─────────────────────────────────────────
//
// Two problems are solved together here, because they are the same problem.
//
// 1. pdf.js begins a new text run wherever the font changes, so restyling one
//    word re-segments the whole line. Comparing runs by string equality then
//    matches nothing, and an UNCHANGED sentence looks like a deletion plus
//    several insertions.
//
// 2. Even when text genuinely changed, reporting the whole line as replaced is
//    far coarser than the change actually was. `contentMatch` is already scored
//    with a word-level diff, so a line-level change list disagrees with the very
//    metric printed beside it.
//
// The leftover runs are therefore re-cut into WORDS and diffed word by word.
// Words present on both sides yield a restyle span only if their typography
// differs; differing words yield precise removed/added spans.
//
// Lines are split into CELLS at horizontal gaps first. A "line" here is a
// y-band, so a table row is one line — without that split, two independent cell
// edits merge into a single nonsensical span.

interface Word {
  text: string;   // as rendered
  norm: string;   // lowercased, for comparison
  box: TextItem;  // exact when the run holds one word, interpolated otherwise
  item: TextItem; // the run it came from, for typography
}

/** Group items into visual lines by vertical proximity. */
function toLines(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    const ref = last?.[0];
    if (ref && Math.abs(item.y - ref.y) <= Math.max(2, ref.h * 0.6)) last.push(item);
    else lines.push([item]);
  }
  return lines;
}

/**
 * Split a line at horizontal gaps wide enough to be column separators.
 *
 * Inter-word spacing runs about 0.25–0.3× the font size; a table column gap is
 * a whole em or more. Splitting at 0.8× keeps words together and cells apart.
 */
function splitCells(line: TextItem[]): TextItem[][] {
  const sorted = [...line].sort((a, b) => a.x - b.x);
  const cells: TextItem[][] = [];
  let current: TextItem[] = [];
  for (const item of sorted) {
    const prev = current[current.length - 1];
    if (prev) {
      const gap = item.x - (prev.x + prev.w);
      if (gap > Math.max(prev.h, item.h) * 0.8) {
        cells.push(current);
        current = [];
      }
    }
    current.push(item);
  }
  if (current.length) cells.push(current);
  return cells;
}

/**
 * Cut a cell into words, each carrying a box.
 *
 * A run holding a single word gets that run's exact box. Inside a multi-word run
 * the box is interpolated by character count — approximate for proportional
 * fonts, but the error stays bounded within the run, which is good enough to
 * highlight and far better than attributing the whole run to one word.
 */
function cellWords(cell: TextItem[]): Word[] {
  const words: Word[] = [];
  for (const item of [...cell].sort((a, b) => a.x - b.x)) {
    const parts = item.str.split(/(\s+)/);
    const total = item.str.length || 1;
    let charAt = 0;
    for (const part of parts) {
      if (part && !/^\s+$/.test(part)) {
        const box: TextItem =
          parts.length === 1
            ? item
            : {
                str: part,
                x: item.x + (item.w * charAt) / total,
                y: item.y,
                w: (item.w * part.length) / total,
                h: item.h,
                style: item.style,
              };
        words.push({ text: part, norm: part.toLowerCase(), box, item });
      }
      charAt += part.length;
    }
  }
  return words;
}

function unionOf(boxes: TextItem[], text: string): TextItem {
  const x = Math.min(...boxes.map((i) => i.x));
  const y = Math.min(...boxes.map((i) => i.y));
  const right = Math.max(...boxes.map((i) => i.x + i.w));
  const bottom = Math.max(...boxes.map((i) => i.y + i.h));
  return { str: text, x, y, w: right - x, h: bottom - y, style: boxes[0]?.style };
}

const joinWords = (ws: Word[]) => ws.map((w) => w.text).join(' ');

/** How alike two cells are, 0..1, by shared words. Decides whether to pair. */
function similarity(a: Word[], b: Word[]): number {
  if (!a.length || !b.length) return 0;
  const pool = new Map<string, number>();
  for (const w of b) pool.set(w.norm, (pool.get(w.norm) ?? 0) + 1);
  let shared = 0;
  for (const w of a) {
    const n = pool.get(w.norm) ?? 0;
    if (n > 0) {
      shared++;
      pool.set(w.norm, n - 1);
    }
  }
  return shared / Math.max(a.length, b.length);
}

/**
 * Reclassify leftover runs by diffing them word by word.
 *
 * Returns the restyle spans recovered, plus the runs that remain genuine content
 * changes — now cut down to the words that actually differ.
 */
function reconcileSegmentation(
  onlyA: TextItem[],
  onlyB: TextItem[],
  compareSizes: boolean,
): { restyled: RestyledSpan[]; onlyA: TextItem[]; onlyB: TextItem[] } {
  const cellsA = toLines(onlyA).flatMap(splitCells).map(cellWords).filter((c) => c.length);
  const cellsB = toLines(onlyB).flatMap(splitCells).map(cellWords).filter((c) => c.length);

  const restyled: RestyledSpan[] = [];
  const contentA: TextItem[] = [];
  const contentB: TextItem[] = [];
  const usedB = new Set<number>();

  // Pairing must be confident. Cells sharing too little are two different pieces
  // of content, and diffing them would invent word-level noise instead of
  // reporting an honest whole-cell replacement.
  const MIN_SIMILARITY = 0.34;

  for (const a of cellsA) {
    let bestIdx = -1;
    let bestScore = 0;
    let bestDist = Infinity;
    for (let i = 0; i < cellsB.length; i++) {
      if (usedB.has(i)) continue;
      const score = similarity(a, cellsB[i]);
      if (score < MIN_SIMILARITY) continue;
      const dist =
        Math.abs(cellsB[i][0].box.y - a[0].box.y) + Math.abs(cellsB[i][0].box.x - a[0].box.x);
      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        bestScore = score;
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) {
      contentA.push(unionOf(a.map((w) => w.box), joinWords(a)));
      continue;
    }

    usedB.add(bestIdx);
    const b = cellsB[bestIdx];

    // diffArrays emits multiple spans natively, which a head/tail trim cannot:
    // two separate edits on one line stay two findings.
    const parts = diffArrays(
      a.map((w) => w.norm),
      b.map((w) => w.norm),
    );

    let ai = 0;
    let bi = 0;
    let pendingRemoved: Word[] | null = null;

    const flushPending = () => {
      if (!pendingRemoved) return;
      contentA.push(unionOf(pendingRemoved.map((w) => w.box), joinWords(pendingRemoved)));
      pendingRemoved = null;
    };

    for (const part of parts) {
      const count = part.count ?? part.value.length;

      if (part.removed) {
        flushPending();
        pendingRemoved = a.slice(ai, ai + count);
        ai += count;
        continue;
      }

      if (part.added) {
        const addedWords = b.slice(bi, bi + count);
        contentB.push(unionOf(addedWords.map((w) => w.box), joinWords(addedWords)));
        // A removed span immediately followed by an added one is a replacement;
        // both are emitted so the grouping step can pair them.
        flushPending();
        bi += count;
        continue;
      }

      flushPending();

      // Unchanged words: the only thing that can differ is typography.
      let spanStart = -1;
      let spanDiff: StyleDiff | null = null;
      const flushStyle = (endExclusive: number) => {
        if (spanStart < 0 || !spanDiff) return;
        const wordsA = a.slice(ai + spanStart, ai + endExclusive);
        const wordsB = b.slice(bi + spanStart, bi + endExclusive);
        const text = joinWords(wordsA);
        restyled.push({
          text,
          a: unionOf(wordsA.map((w) => w.box), text),
          b: unionOf(wordsB.map((w) => w.box), text),
          styleDiff: spanDiff,
        });
        spanStart = -1;
        spanDiff = null;
      };

      for (let k = 0; k < count; k++) {
        const diff = diffStyle(a[ai + k]?.item.style, b[bi + k]?.item.style, compareSizes);
        if (diff) {
          if (spanStart < 0) {
            spanStart = k;
            spanDiff = diff;
          } else if (diff.summary !== spanDiff?.summary) {
            flushStyle(k);
            spanStart = k;
            spanDiff = diff;
          }
        } else {
          flushStyle(k);
        }
      }
      flushStyle(count);

      ai += count;
      bi += count;
    }
    flushPending();
  }

  // Any B cell never paired is wholly new content.
  cellsB.forEach((b, i) => {
    if (!usedB.has(i)) contentB.push(unionOf(b.map((w) => w.box), joinWords(b)));
  });

  return { restyled, onlyA: contentA, onlyB: contentB };
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
  // The two sides may be different page numbers, and either may be absent.
  const idxA = opts.pageIndexA === undefined ? pageIndex : opts.pageIndexA;
  const idxB = opts.pageIndexB === undefined ? pageIndex : opts.pageIndexB;
  const hasA = !!pdfA && idxA != null && idxA >= 0 && idxA < pdfA.numPages;
  const hasB = !!pdfB && idxB != null && idxB >= 0 && idxB < pdfB.numPages;

  const notes: string[] = [];

  // The golden page defines the target box; fall back to the tested page if it is missing.
  let box: { w: number; h: number; scale: number };
  if (hasA) {
    const pageA = await pdfA!.getPage(idxA! + 1);
    box = targetBox(pageA);
  } else if (hasB) {
    const pageB = await pdfB!.getPage(idxB! + 1);
    box = targetBox(pageB);
  } else {
    box = { w: 800, h: 1000, scale: BASE_SCALE };
  }
  const pxPerInch = box.scale * 72;

  let imageA: RenderedPageImage | null = null;
  let imageB: RenderedPageImage | null = null;
  let itemsA: TextItem[] = [];
  let itemsB: TextItem[] = [];
  let imagesA: TextItem[] = [];
  let imagesB: TextItem[] = [];

  if (hasA) {
    const pageA = await pdfA!.getPage(idxA! + 1);
    const r = await renderAndExtract(pageA, box.w, box.h);
    imageA = r.image;
    itemsA = r.items;
    imagesA = r.images;
    if (itemsA.length === 0) notes.push('No selectable text layer in the golden PDF (scanned image?).');
  } else {
    notes.push('This page exists only in the PDF under test.');
  }

  if (hasB) {
    const pageB = await pdfB!.getPage(idxB! + 1);
    const r = await renderAndExtract(pageB, box.w, box.h);
    imageB = r.image;
    itemsB = r.items;
    imagesB = r.images;
    if (itemsB.length === 0) notes.push('No selectable text layer in the PDF under test (scanned image?).');
    if (r.image.letterboxed) {
      notes.push('The tested page has a different size/aspect ratio and was scaled to fit the golden page.');
    }
  } else {
    notes.push('This page exists only in the golden PDF.');
  }

  const textA = reconstructReadingText(itemsA);
  const textB = reconstructReadingText(itemsB);
  const diff = diffText(textA, textB);
  const contentMatch = contentMatchRatio(diff);

  // A letterboxed B was uniformly rescaled to fit A's box, so glyph sizes on this
  // page are not comparable between the two sides.
  const rescaled = imageB?.letterboxed === true;
  const match = matchItems(itemsA, itemsB, {
    compareSizes: !rescaled,
    imagesA,
    imagesB,
  });
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

/**
 * A small page image, for picking pages out of a list.
 *
 * Separate from `renderAndExtract` on purpose: that one renders at comparison
 * scale onto a letterboxed target box and pulls the text layer with it, which is
 * far too much work to do for a thumbnail strip. JPEG rather than PNG — a
 * hundred page thumbnails as PNG data URLs is tens of megabytes of strings.
 */
export async function renderThumb(
  doc: PDFDocumentProxy,
  pageIndex: number,
  width: number,
): Promise<string> {
  const page = await doc.getPage(pageIndex + 1);
  try {
    const vp1 = page.getViewport({ scale: 1 });
    // Twice the display width, so it stays sharp on a high-density screen.
    const viewport = page.getViewport({ scale: (width * 2) / vp1.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    page.cleanup();
  }
}
