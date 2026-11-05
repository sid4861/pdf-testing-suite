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

export interface SpecElementBase {
  id: string;
  label?: string;
  /**
   * Where the element is, in spec units **from the page's top-left**, however
   * the workbook wrote it: a row measured from the bottom or the right is
   * converted by the compiler, which knows the page size, so the checker
   * never has to.
   *
   * At least one of these is present — an element with none cannot be found
   * and is excluded with that said (SR-SPEC-INTAKE decision 13). The ones the
   * workbook did not state are absent, and absent means *not asserted*: an
   * element placed from the bottom-right is not silently also claiming a top.
   */
  top?: number;
  left?: number;
  /** The element's right edge, from the page's left. */
  right?: number;
  /** The element's bottom edge, from the page's top. */
  bottom?: number;
  /** The text baseline, from the page's top. */
  baseline?: number;
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
  /** Family as the workbook writes it, e.g. "Helvetica". */
  font?: string;
  /** From the element's own Bold row; absent when the workbook is silent. */
  bold?: boolean;
  /** From the element's own Italic row. */
  italic?: boolean;
  /** Text colour as a hex string, e.g. "#0B3C5D". */
  colour?: string;
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

/**
 * How many times a page may repeat (SR-SPEC-CHECK decision 3).
 * `max: null` is "no upper limit"; a blank Repeats cell means at least once.
 */
export interface SpecRepeats {
  min: number;
  max: number | null;
}

export interface SpecPage {
  /**
   * 1-based. For a workbook this is the Pages List position, which is where
   * the page is *expected*; the page it is actually found at is in the report.
   */
  page: number;
  elements: SpecElement[];

  // ── from the Pages List (SR-SPEC-CHECK decisions 1–3) ──
  /** The page's name, for the report. */
  name?: string;
  /**
   * `required` — absent is an error. `optional` — absent passes, noted.
   * `conditional` — checked when present, noted when absent, never failed.
   * Absent on a spec JSON with no Pages List, which is then checked by number.
   */
  kind?: 'required' | 'optional' | 'conditional';
  /** Exactly one page of a variant group must match; none or several is an error. */
  variantGroup?: string;
  repeats?: SpecRepeats;
  /** The text that identifies this page in the PDF (decision 2). */
  identifyingText?: string;
}

export interface PdfSpec {
  title?: string;
  units?: SpecUnit;
  pageSize?: { width: number; height: number };
  /**
   * When the workbook pins the page size, a different size is an error rather
   * than a warning (SR-SPEC-CHECK decision 4).
   */
  pageSizePinned?: boolean;
  /**
   * The workbook's own colour threshold as CIEDE2000 ΔE; falls back to
   * SR-CONSTANTS when the Settings sheet leaves it blank.
   */
  colourThreshold?: number;
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
  /**
   * The workbook cell this expectation came from, `Sheet!A1`
   * (SR-SPEC-CHECK decision 12). Absent for a spec JSON, which has no cells,
   * and for a check that is not about one row — `Anchor`, `Readable`.
   */
  cell?: string;
  /**
   * A qualification on a check that passed: it matched, but only after the
   * two sides were normalised (decision 10). A pass with a note is still a
   * pass; it is said out loud because the document and the workbook do not
   * agree character for character.
   */
  note?: string;
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
  /**
   * - `pass` / `fail` — checked, and the answer.
   * - `not-found` — looked for, not there.
   * - `warning` — true but not a failure: a page out of order, a page size
   *   that differs without being pinned.
   * - `unverifiable` — could not be checked at all, e.g. a page with no text
   *   layer. Never a pass (SR-SPEC-CHECK decision 13).
   */
  status: 'pass' | 'fail' | 'not-found' | 'warning' | 'unverifiable';
  detail: string;      // one-line summary (e.g. the expected text)
  checks: CheckResult[];
  expectedBox: Box | null;
  actualBox: Box | null;
}

export interface SpecPageResult {
  /** The PDF page actually checked, 1-based. */
  page: number;
  /** The Pages List name, when the spec came from a workbook. */
  name?: string;
  /**
   * How this PDF page was chosen:
   * - `declared` — the spec's own page number (a spec JSON, or no Pages List);
   * - `identified` — found by its identifying text, where it was expected;
   * - `out-of-order` — found by its text, somewhere else (decision 2);
   * - `repeat` — a further occurrence of a repeating page (decision 3).
   */
  binding?: 'declared' | 'identified' | 'out-of-order' | 'repeat';
  /** Which occurrence of a repeating page this is, 1-based. */
  occurrence?: number;
  /**
   * The page number the spec declared. Differs from `page` when a single spec
   * page was deliberately pointed at a different PDF page — the report shows the
   * mapping so a result can never be misread as coming from somewhere else.
   */
  specPage: number;
  pageWidthPt: number;
  pageHeightPt: number;
  dataUrl: string | null;
  elements: ElementResult[];
  /**
   * The page-size finding, when the workbook states a size. Kept out of
   * `elements` because that list is the spec's own rows, which coverage counts.
   */
  pageSize: ElementResult | null;
  passCount: number;
  /** Failed checks only, from elements that were actually decided. */
  failCount: number;
  /** Elements true but not failing — a page out of order, an unpinned size. */
  warnCount: number;
  /** Elements that could not be checked at all; never passes. */
  unverifiableCount: number;
}

/**
 * Something true about the *document*, not about one element: a page missing,
 * a page out of order, a PDF page nothing in the spec covers.
 *
 * Kept apart from `ElementResult` because these are not spec rows and coverage
 * must not count them — and because a page that is simply absent has no
 * element results to hang a finding on.
 */
export interface PageFinding {
  severity: 'error' | 'warning' | 'note';
  /** The PDF page it is about, when it is about one. */
  pdfPage?: number;
  /** The Pages List position it is about, when it is about one. */
  specPage?: number;
  /** That page's name, as the Pages List writes it. */
  specName?: string;
  message: string;
}

/**
 * Which pair of files this result is about (SR-SPEC-CHECK decision 14).
 *
 * A result that cannot name the workbook and the PDF it came from is not
 * evidence a week later, when both have been edited.
 */
export interface TestedPair {
  workbook?: string;
  workbookSha256?: string | null;
  templateVersion?: string | null;
  pdfName?: string;
  pdfSha256?: string | null;
}

/** How much of the workbook became a check (decision 13). */
export interface SpecCoverage {
  checked: number;
  noted: number;
  excluded: number;
  unreadable: number;
  rows: number;
}

export interface SpecReport {
  title: string;
  units: SpecUnit;
  pages: SpecPageResult[];
  totalPass: number;
  totalFail: number;
  elementCount: number;
  passElements: number;
  /** Page-level findings (SR-SPEC-CHECK decisions 1–3). */
  pageFindings: PageFinding[];
  /**
   * “N of M rows checked” — part of the result, not a separate screen
   * (decision 13). Absent for a spec JSON, which has no workbook rows.
   */
  coverage?: SpecCoverage;
  /** The workbook and PDF this result is about (decision 14). */
  pair?: TestedPair;
}
