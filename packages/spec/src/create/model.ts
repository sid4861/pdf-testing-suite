/**
 * The mockup — what the **Create spec** canvas holds (W-54).
 *
 * This is the source of truth (Siddharth, 2026-11-18). The workbook is
 * derived from it every time, never the other way round: a workbook does
 * not carry stacking, the image bytes, or anything else the canvas knows
 * and the spec deliberately does not, so it cannot be read back.
 *
 * **Everything geometric is in inches and every font size is in points**
 * (the same ruling). There is no pixel anywhere in this file, which is
 * what makes `px-without-density` impossible by construction rather than
 * by validation: the canvas scales inches to screen for drawing only, and
 * that scale never reaches the model.
 *
 * Numbers are stored as the person set them and rounded only on the way
 * into the workbook, so dragging something twice does not accumulate
 * rounding drift in the saved file.
 */

/** A rectangle on the page, in inches from the page's top-left. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ElementKind = 'box' | 'text' | 'image' | 'table';

interface Common {
  id: string;
  /**
   * The `Element` column: the thing on the page, e.g. `Title block`.
   * Two canvas elements sharing a name become one Element in the workbook,
   * told apart by `part` — which is how a sidebar and the heading on it
   * end up grouped (Siddharth's example).
   */
  element: string;
  /** The `Part` column; blank is allowed and common. */
  part: string;
  rect: Rect;
  /** Stacking. **Canvas only** — it never reaches the workbook (W-54). */
  z: number;
}

/** A container: a sidebar, a title block, a coloured panel. */
export interface BoxElement extends Common {
  kind: 'box';
  /** `#RRGGBB`, or none. Recorded as `Colour · Fill`, **not checked**. */
  fill?: string;
}

export interface TextElement extends Common {
  kind: 'text';
  text: string;
  font: string;
  /** Points. */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** `#RRGGBB`. */
  colour: string;
  /** `Title` · `Sentence` · `Upper` · `Lower`, or none. */
  textCase?: string;
  /** `Exact text` — compare the wording character for character. */
  exactText: boolean;
  /**
   * This text is how the page is found in the PDF. Exactly one text
   * element per page should carry it; it becomes the page's
   * `Identifying text`, and without one the page can only be matched by
   * its number, which goes wrong the moment a page is added or dropped.
   */
  identifier?: boolean;
}

export interface ImageElement extends Common {
  kind: 'image';
  fileName: string;
  /** For drawing only. Never written to the workbook. */
  dataUrl?: string;
}

export interface TableElement extends Common {
  kind: 'table';
  columns: number;
  rows: number;
  /** Inches. */
  headerHeight: number;
  /** Inches. */
  rowHeight: number;
  /** Inches, one per column; its length is the truth about `columns`. */
  columnWidths: number[];
  /** Optional, comma-joined into `Column headers`. */
  headers?: string[];
}

export type MockupElement = BoxElement | TextElement | ImageElement | TableElement;

export interface MockupPage {
  /** The name of this page's own sheet in the workbook. */
  tab: string;
  name: string;
  type: 'Required' | 'Optional' | 'Conditional';
  orientation: 'Landscape' | 'Portrait';
  /** `#RRGGBB`, or none. */
  background?: string;
  elements: MockupElement[];
}

/** The tolerances that land in `Settings`; inches, except font size in pt. */
export interface Tolerances {
  position: number;
  size: number;
  fontSize: number;
  lineSpacing: number;
}

/**
 * The whole mockup. Saved as `<name>.pdfsuite-spec.json` beside the
 * workbook, which is the only way a person gets their canvas back.
 */
export interface SpecDoc {
  version: 1;
  name: string;
  /** Inches. */
  page: { width: number; height: number };
  tolerances: Tolerances;
  /**
   * The vocabulary the canvas offers. The pickers show **only** these, so
   * a colour cannot be chosen that the workbook's `Lists` does not
   * declare — which is what stops `colour-name-mismatch` happening at all.
   */
  fonts: string[];
  palette: { name: string; hex: string }[];
  pages: MockupPage[];
}

export const DEFAULT_FONTS = ['Helvetica', 'Times', 'Courier'];

export const DEFAULT_PALETTE = [
  { name: 'Ink', hex: '#111111' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Slate', hex: '#52514E' },
  { name: 'Grid Grey', hex: '#E5E7EB' },
];

export const DEFAULT_TOLERANCES: Tolerances = {
  position: 0.06,
  size: 0.06,
  fontSize: 2,
  lineSpacing: 0.03,
};

/** US Letter landscape, which is what the sample report is. */
export function emptyDoc(name = 'New spec'): SpecDoc {
  return {
    version: 1,
    name,
    page: { width: 11, height: 8.5 },
    tolerances: { ...DEFAULT_TOLERANCES },
    fonts: [...DEFAULT_FONTS],
    palette: DEFAULT_PALETTE.map((p) => ({ ...p })),
    pages: [{ tab: '1', name: 'Page 1', type: 'Required', orientation: 'Landscape', elements: [] }],
  };
}

/** The next free id, which only has to be unique within the document. */
export function newId(doc: SpecDoc): string {
  const used = new Set(doc.pages.flatMap((p) => p.elements.map((e) => e.id)));
  for (let i = 1; ; i += 1) if (!used.has(`e${i}`)) return `e${i}`;
}

/** One element's defaults, so a new one is never half-filled. */
export function newElement(kind: ElementKind, id: string, at: Rect, doc: SpecDoc): MockupElement {
  const base = { id, element: '', part: '', rect: at, z: 0 };
  if (kind === 'text') {
    return {
      ...base, kind, text: 'Text', font: doc.fonts[0] ?? 'Helvetica', fontSize: 12,
      bold: false, italic: false, underline: false,
      colour: doc.palette[0]?.hex ?? '#111111', exactText: true,
    };
  }
  if (kind === 'image') return { ...base, kind, fileName: '' };
  if (kind === 'table') {
    return {
      ...base, kind, columns: 3, rows: 5, headerHeight: 0.3, rowHeight: 0.25,
      columnWidths: [at.w / 3, at.w / 3, at.w / 3],
    };
  }
  return { ...base, kind: 'box' };
}
