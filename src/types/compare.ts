// All shared interfaces for the PDF comparison engine, store, and UI.
// These types never touch React.

/** Typography of a text run, used to detect restyling when the words are unchanged. */
export interface TextStyle {
  font: string;   // BaseFont name with any subset prefix stripped, e.g. "Helvetica-Bold"
  size: number;   // font size in target-box px (comparable between the two sides)
  bold: boolean;
  italic: boolean;
}

/** A single extracted text run with its bounding box in target-box pixel space. */
export interface TextItem {
  str: string; // text content of the run (never empty)
  x: number;   // left edge in px, top-left origin
  y: number;   // top edge in px, top-left origin (NOT baseline)
  w: number;   // width in px
  h: number;   // height in px (~font size at render scale)
  style?: TextStyle; // absent when the font could not be resolved
}

/** One chunk from a word-level text diff. */
export interface DiffSegment {
  value: string;
  added?: boolean;   // only in B (insertion)
  removed?: boolean; // only in A (deletion)
}

/** A text run found on both pages, with its position delta (B relative to A). */
export interface MatchedPair {
  str: string;
  a: TextItem;
  b: TextItem;
  dx: number;     // b.x - a.x
  dy: number;     // b.y - a.y
  dw: number;     // b.w - a.w
  dh: number;     // b.h - a.h
  offset: number; // √(dx² + dy²)
  /** Set when the words are identical but the typography differs. */
  styleDiff?: StyleDiff;
}

/** What changed about a run's typography. Only populated when something did. */
export interface StyleDiff {
  font: boolean;
  size: boolean;
  bold: boolean;
  italic: boolean;
  /** Human-readable one-liner, e.g. "Helvetica -> Helvetica-Bold - bold added". */
  summary: string;
}

/** Full result of matching two pages' text items. */
export interface ItemMatch {
  matched: MatchedPair[];
  onlyA: TextItem[];
  onlyB: TextItem[];
}

/** Output of a pixelmatch comparison. */
export interface PixelDiffResult {
  diffDataUrl: string;
  changed: number;
  total: number;
  ratio: number;
}

/** A page rendered to a canvas. */
export interface RenderedPageImage {
  dataUrl: string;
  imageData?: ImageData; // raw RGBA — only needed during pixel diff; released afterwards to save memory
  width: number;
  height: number;
  letterboxed: boolean;
}

/** The complete cached comparison result for one page. */
export interface PageComparison {
  pageIndex: number;

  imageA: RenderedPageImage | null;
  imageB: RenderedPageImage | null;

  textA: string;
  textB: string;
  diff: DiffSegment[];
  contentMatch: number; // 0–1

  match: ItemMatch;
  maxOffset: number;    // px (target-box space)
  pxPerInch: number;    // px per inch for this page's target box (for inch display)

  pixel: PixelDiffResult | null;

  notes: string[];
}

export interface PageSummary {
  pageIndex: number;
  contentMatch: number; // 0–1
  pixelRatio: number;   // 0–1
  maxOffset: number;    // px
  pxPerInch: number;    // px per inch for this page
  missing: boolean;
}

export interface CompareSummary {
  pages: PageSummary[];
  pageCountA: number;
  pageCountB: number;
}

export type CompareSide = 'A' | 'B';
export type CompareMode = 'content' | 'layout' | 'report';
export type LayoutViewMode = 'side-by-side' | 'diff';
