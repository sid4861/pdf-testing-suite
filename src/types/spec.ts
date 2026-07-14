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

interface SpecElementBase {
  id: string;
  label?: string;
  top: number;  // spec units from the top of the page
  left: number; // spec units from the left of the page
  tolerance?: SpecTolerance;
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
