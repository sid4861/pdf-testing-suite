// Types for spec-driven page validation ("Test new pages").
// A spec describes what a page *should* contain — static text, images, tables,
// paragraphs — with positions/sizes in physical units (default inches).

export type SpecUnit = 'in' | 'pt' | 'mm';

export interface SpecTolerance {
  position?: number; // spec units (e.g. inches) for top/left
  size?: number;     // spec units for width/height
  spacing?: number;  // spec units for line spacing
  fontSize?: number; // points
}

/**
 * Locate an element relative to a nearby text label instead of by absolute
 * position.
 *
 * Images and tables carry no text of their own, so without an anchor they can
 * only be found by proximity to the declared top/left — which silently latches
 * onto a neighbour when the layout reflows. An anchor ties the element to
 * something the page actually says, so the check survives content above it
 * growing or shrinking.
 */
export interface SpecAnchor {
  /** Text to find on the page. Matched case-insensitively. */
  text: string;
  /** How `text` is matched. Default 'contains'. */
  match?: 'exact' | 'contains';
  /** Where the element sits relative to the anchor text. Default 'below'. */
  position?: 'above' | 'below' | 'left' | 'right';
  /**
   * How far from the anchor to search, in spec units. Elements beyond this are
   * ignored. Default 2 (inches).
   */
  within?: number;
  /**
   * When the anchor text appears more than once, which occurrence to use
   * (1-based, in reading order). Default 1.
   */
  occurrence?: number;
}

interface SpecElementBase {
  id: string;
  label?: string;
  top: number;  // spec units from the top of the page
  left: number; // spec units from the left of the page
  tolerance?: SpecTolerance;
  /**
   * Optional. When present, the element is located relative to this text rather
   * than by nearest-to-top/left. `top`/`left` are still checked and reported.
   */
  anchor?: SpecAnchor;
}

export interface TextSpec extends SpecElementBase {
  type: 'text';
  text: string;
  match?: 'exact' | 'contains'; // default 'contains'
  fontSize?: number;            // points, optional
}

export interface ImageSpec extends SpecElementBase {
  type: 'image';
  width: number;
  height: number;
}

export interface TableSpec extends SpecElementBase {
  type: 'table';
  width: number;
  rows?: number;
  columns?: number;
}

export interface ParagraphSpec extends SpecElementBase {
  type: 'paragraph';
  text: string;        // starting snippet used to locate the paragraph
  lineSpacing: number; // spec units between consecutive baselines
  match?: 'exact' | 'contains';
}

export type SpecElement = TextSpec | ImageSpec | TableSpec | ParagraphSpec;

export interface SpecPage {
  page: number; // 1-based
  elements: SpecElement[];
}

export interface PdfSpec {
  title?: string;
  units?: SpecUnit;
  pageSize?: { width: number; height: number };
  tolerance?: SpecTolerance;
  pages: SpecPage[];
}

// ── Results ───────────────────────────────────────────────────────────
export interface CheckResult {
  name: string;     // e.g. "Left position"
  expected: string; // formatted
  actual: string;
  delta?: string;
  pass: boolean;
}

export interface Box {
  left: number;   // points, top-left origin
  top: number;
  width: number;
  height: number;
}

export interface ElementResult {
  id: string;
  type: SpecElement['type'];
  label: string;
  status: 'pass' | 'fail' | 'not-found';
  detail: string;      // one-line summary (e.g. the expected text)
  checks: CheckResult[];
  expectedBox: Box | null;
  actualBox: Box | null;
}

export interface SpecPageResult {
  page: number;         // 1-based
  pageWidthPt: number;
  pageHeightPt: number;
  dataUrl: string | null;
  elements: ElementResult[];
  passCount: number;
  failCount: number;
}

export interface SpecReport {
  title: string;
  units: SpecUnit;
  pages: SpecPageResult[];
  totalPass: number;
  totalFail: number;
  elementCount: number;
  passElements: number;
}
