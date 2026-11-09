/**
 * `inspectCore` — where is this element on the page, and what is it?
 *
 * SR-INSPECT decision 1: extraction and measurement live here, and the tab
 * keeps only hit-testing and drawing. Before **W-28** the measurement half
 * lived inside `MeasureView.tsx`: the line-height rule, the distances to the
 * four edges and the leading ratio were computed in JSX, which meant the CLI
 * could not answer "where is X on page 3" without reimplementing them — and
 * two implementations of a measurement are two answers (L3).
 *
 * Two things this file is careful about.
 *
 * **Units.** Decision 3: inches for positions and distances, points for font
 * sizes, and the conversion happens *once*, here. `renderElements` returns
 * points because that is what pdf.js gives; everything that leaves this
 * module is already in the unit it will be read in, so no caller has to know
 * the factor. Values are rounded the way `result.json` rounds them, so the
 * tab and a report agree to the digit.
 *
 * **Unknown is said.** Decision 4: a font with no resolvable name is `null`
 * with a stated reason, not a guess; a weight nobody declared is
 * `"undeclared"`, not "Regular"; a page with no text layer says so. The one
 * thing worth less than a missing measurement is a made-up one.
 */

import { roundInches } from './report/envelope';
import { renderElements, type ElementsPage, type PageElement } from './pdfElements';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const PT_PER_IN = 72;

/** Where an element sits, in inches, from each edge of the page. */
export interface ElementBox {
  /** Distance from the page's left edge to the element's left edge. */
  fromLeftIn: number;
  /** Distance from the page's top edge to the element's top edge. */
  fromTopIn: number;
  widthIn: number;
  heightIn: number;
  /** Page edge to the element's *right* edge — the mirror of fromLeftIn. */
  fromRightIn: number;
  /** Page edge to the element's *bottom* edge. */
  fromBottomIn: number;
}

/**
 * What the document says about an element's type.
 *
 * Every field can be "not stated", and says so rather than defaulting:
 * `name: null` with `nameReason` is a font pdf.js could not resolve, and
 * `weight: 'undeclared'` is a font whose name carries no weight word. A
 * reader can tell "the PDF says Regular" from "nobody said", which is the
 * distinction decision 4 exists for.
 */
export interface ElementFont {
  /** The resolved font name, or null when the PDF does not yield one. */
  name: string | null;
  /** Why there is no name. Present only when `name` is null. */
  nameReason?: 'not-embedded-or-unresolvable';
  /** Font size in POINTS (decision 3 keeps sizes in points). */
  sizePt: number;
  /** From the font name: a weight word, or that there was none. */
  weight: 'bold' | 'regular' | 'undeclared';
  style: 'italic' | 'normal' | 'undeclared';
}

/**
 * Baseline-to-baseline distance to the nearest line in the same block.
 *
 * `null` when the element is the only line in its column, which is a fact
 * about the document and not a failure to measure — hence `reason`.
 */
export interface ElementLineHeight {
  pt: number;
  /** Line height ÷ font size. 1.2× is typical body text. */
  ratio: number;
  /** The element the distance was measured to. */
  neighbourId: string;
}

export interface InspectedElement {
  id: string;
  kind: 'text' | 'image';
  /** The run's text, or `Image`. */
  label: string;
  box: ElementBox;
  /** Text only. */
  font?: ElementFont;
  /** Text only; null when there is no neighbouring line. */
  lineHeight?: ElementLineHeight | null;
}

export interface InspectedPage {
  /** 0-based, as every page index in this codebase is. */
  pageIndex: number;
  widthIn: number;
  heightIn: number;
  /**
   * False when the page yielded no text runs at all — a scan, or text drawn
   * as outlines. Said rather than implied by an empty list, because "no text
   * on this page" and "this page's text cannot be read" are different
   * answers (SR-PDF-SUPPORT).
   */
  hasTextLayer: boolean;
  elements: InspectedElement[];
  /** The page image, when the caller asked for one. */
  imageDataUrl?: string;
}

/**
 * The nearest text line above or below `sel` that shares a column with it.
 *
 * Moved here from `MeasureView.tsx` unchanged, including the two judgments
 * in it, which are the reason it is a function and not an expression:
 *
 *   * **the same column** — two runs count as neighbours only if their
 *     horizontal spans overlap, so a figure caption does not set the line
 *     height of the body text beside it;
 *   * **not the same line** — a gap under 40% of the font size is treated as
 *     the *same* line (two runs of one sentence, a superscript), not as
 *     leading of nearly zero.
 */
export function adjacentLine(
  elements: PageElement[],
  sel: PageElement,
): { el: PageElement; lineHeight: number } | null {
  const baselineOf = (el: PageElement) => el.top + el.height;
  const selBase = baselineOf(sel);
  const minGap = Math.max(1, sel.height * 0.4);
  let best: PageElement | null = null;
  let bestGap = Infinity;
  for (const el of elements) {
    if (el.kind !== 'text' || el === sel) continue;
    if (el.left > sel.left + sel.width || el.left + el.width < sel.left) continue;
    const gap = Math.abs(baselineOf(el) - selBase);
    if (gap < minGap) continue;
    if (gap < bestGap) {
      bestGap = gap;
      best = el;
    }
  }
  return best ? { el: best, lineHeight: bestGap } : null;
}

/** A font size, to one decimal place — the readout's own rounding. */
function roundPt(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Measure one extracted page. **Pure** — no pdf.js, no canvas, no clock.
 *
 * Separated from the extraction so that the tab (which already holds an
 * `ElementsPage` for drawing) and the CLI (which has just extracted one) run
 * the identical arithmetic rather than agreeing by inspection.
 */
export function inspectPage(page: ElementsPage, pageIndex: number): InspectedPage {
  const texts = page.elements.filter((el) => el.kind === 'text');

  const elements: InspectedElement[] = page.elements.map((el) => {
    const box: ElementBox = {
      fromLeftIn: roundInches(el.left / PT_PER_IN),
      fromTopIn: roundInches(el.top / PT_PER_IN),
      widthIn: roundInches(el.width / PT_PER_IN),
      heightIn: roundInches(el.height / PT_PER_IN),
      fromRightIn: roundInches((page.widthPt - (el.left + el.width)) / PT_PER_IN),
      fromBottomIn: roundInches((page.heightPt - (el.top + el.height)) / PT_PER_IN),
    };

    if (el.kind === 'image') {
      return { id: el.id, kind: 'image', label: el.label, box };
    }

    // `bold`/`italic` are read off the font *name*, so a font with no name
    // tells us nothing about either — and "regular" would be a guess.
    const named = typeof el.fontLabel === 'string' && el.fontLabel.length > 0;
    const font: ElementFont = {
      name: named ? el.fontLabel! : null,
      ...(named ? {} : { nameReason: 'not-embedded-or-unresolvable' as const }),
      sizePt: roundPt(el.height),
      weight: named ? (el.bold ? 'bold' : 'regular') : 'undeclared',
      style: named ? (el.italic ? 'italic' : 'normal') : 'undeclared',
    };

    const adj = adjacentLine(texts, el);
    return {
      id: el.id,
      kind: 'text',
      label: el.label,
      box,
      font,
      lineHeight: adj
        ? {
          pt: roundPt(adj.lineHeight),
          // Against the font size, because that is what a designer specifies.
          ratio: Math.round((adj.lineHeight / el.height) * 100) / 100,
          neighbourId: adj.el.id,
        }
        : null,
    };
  });

  return {
    pageIndex,
    widthIn: roundInches(page.widthPt / PT_PER_IN),
    heightIn: roundInches(page.heightPt / PT_PER_IN),
    hasTextLayer: texts.length > 0,
    elements,
  };
}

export interface InspectOptions {
  /** 0-based page indices. Omitted means every page. */
  pages?: number[];
  /**
   * Keep each page's rendered image on the result, for a report that shows
   * the page. Off by default: a 20-page document's images are tens of
   * megabytes, and a caller that only wants the numbers should not pay for
   * them.
   */
  withImages?: boolean;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Inspect a document: extract every page's elements and measure them.
 *
 * The one function the Inspect tab and `pdfsuite inspect` both call.
 */
export async function inspectCore(
  pdf: PDFDocumentProxy,
  opts: InspectOptions = {},
): Promise<InspectedPage[]> {
  const indices = opts.pages ?? Array.from({ length: pdf.numPages }, (_, i) => i);
  const out: InspectedPage[] = [];
  for (let n = 0; n < indices.length; n++) {
    const i = indices[n];
    const page = await renderElements(pdf, i);
    const measured = inspectPage(page, i);
    out.push(opts.withImages ? { ...measured, imageDataUrl: page.dataUrl } : measured);
    opts.onProgress?.(n + 1, indices.length);
  }
  return out;
}
