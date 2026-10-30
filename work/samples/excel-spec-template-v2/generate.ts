// Template v2 spec workbook — the fictional Fleet Operations Review, every unit explicit.
//
// Builds, deterministically and from one data definition:
//   report-spec.xlsx               the clean Template v2 workbook (SR-SPEC-INTAKE decision 7, 7a)
//   report-spec-with-errors.xlsx   the same workbook with ten planted intake errors
//   expected-validation.json       what the validator must say about those ten cells
//
// Zero dependencies beyond jszip (already a product dependency). No Python
// (SR-STACK-TYPESCRIPT). Fixed timestamps, so a rebuild gives the same bytes.
//
//   node --experimental-strip-types work/samples/excel-spec-template-v2/generate.ts
//
// Element, Part and Group are merged-and-centred over the rows they label — a merge is a
// declared range in the file, read as such, never a guess. A row is identified by its sheet and
// row number; there is no ID column.
//
// The workbook carries its own guard rails: Lists-sheet dropdowns on Group, Parameter,
// Unit, From, Check? and Exact text, and conditional formatting that turns a cell red
// when the Unit is missing, disallowed or `px` without a declared density, when a
// numeric Value holds text, when a Parameter is not on the list, or when a position has
// no From. Excel shows the error before the upload does.
import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ───────────────────────────── the vocabulary (Lists sheet) ─────────────────────────────

type Kind = 'length' | 'points' | 'count' | 'lengths' | 'text' | 'yesno' | 'colour' | 'font' | 'list';

interface ParamDef { name: string; group: string; kind: Kind; units: string; unitRequired: boolean; number: boolean; fromRequired: boolean; }

const LENGTH_UNITS = 'in mm cm pt px %';
const P = (name: string, group: string, kind: Kind, units = '', fromRequired = false): ParamDef => ({
  name, group, kind, units,
  unitRequired: kind === 'length' || kind === 'points' || kind === 'count' || kind === 'lengths',
  number: kind === 'length' || kind === 'points' || kind === 'count',
  fromRequired,
});

const PARAMS: ParamDef[] = [
  P('Top', 'Position', 'length', LENGTH_UNITS, true),
  P('Left', 'Position', 'length', LENGTH_UNITS, true),
  P('Right', 'Position', 'length', LENGTH_UNITS, true),
  P('Bottom', 'Position', 'length', LENGTH_UNITS, true),
  P('Baseline', 'Position', 'length', LENGTH_UNITS, true),
  P('Wrap at', 'Position', 'length', LENGTH_UNITS, true),
  P('Width', 'Size', 'length', LENGTH_UNITS),
  P('Height', 'Size', 'length', LENGTH_UNITS),
  P('Row height', 'Size', 'length', LENGTH_UNITS),
  P('Weight', 'Size', 'points', 'pt'),
  P('Wording', 'Text', 'text'),
  P('Alternative wording', 'Text', 'text'),
  P('Line break after', 'Text', 'text'),
  P('Italic words', 'Text', 'text'),
  P('Case', 'Text', 'list'),
  P('Font', 'Font', 'font'),
  P('Font size', 'Font', 'points', 'pt'),
  P('Line spacing', 'Font', 'points', 'pt'),
  P('Bold', 'Font', 'yesno'),
  P('Italic', 'Font', 'yesno'),
  P('Underline', 'Font', 'yesno'),
  P('Colour', 'Colour', 'colour'),
  P('Fill', 'Colour', 'colour'),
  P('File name', 'Image', 'text'),
  P('Columns', 'Table', 'count', 'count'),
  P('Rows', 'Table', 'count', 'count'),
  P('Column headers', 'Table', 'text'),
  P('Column widths', 'Table', 'lengths', LENGTH_UNITS),
  P('Column alignment', 'Table', 'list'),
  P('Chart type', 'Graph', 'text'),
  P('Title', 'Graph', 'text'),
  P('Categories', 'Graph', 'text'),
  P('Series 1', 'Graph', 'text'),
  P('Series 2', 'Graph', 'text'),
  P('Y axis', 'Graph', 'text'),
  P('Gridlines', 'Graph', 'text'),
  P('Legend', 'Graph', 'text'),
  P('Data label', 'Graph', 'text'),
  P('Data', 'Data', 'text'),
  P('Note', 'Note', 'text'),
];
const GROUPS = ['Position', 'Size', 'Image', 'Text', 'Font', 'Colour', 'Table', 'Graph', 'Data', 'Note'];
for (const p of PARAMS) if (!GROUPS.includes(p.group)) throw new Error(`group not in GROUPS: ${p.group}`);
const UNITS = ['in', 'mm', 'cm', 'pt', 'px', '%', 'count'];
const FROM = ['top of page', 'left of page', 'right of page', 'bottom of page', 'top of container', 'left of container', 'right of container', 'bottom of container'];
const CHECK = ['Yes', 'Note', 'No'];
const YESNO = ['Yes', 'No'];
const CASES = ['Title', 'Sentence', 'Upper', 'Lower'];
const FONTS = ['Helvetica', 'Times', 'Courier'];
const COLOURS: [string, string][] = [
  ['Kestrel Navy', '#0B3C5D'], ['Cloud Grey', '#EEF1F4'], ['Slate', '#52514E'], ['Ink', '#111111'],
  ['White', '#FFFFFF'], ['Route Blue', '#2A78D6'], ['Signal Orange', '#EB6834'], ['Grid Grey', '#E5E7EB'],
];

// ───────────────────────────── the page rows ─────────────────────────────

type Cell = string | number | null;
// ID · Element · Part · Group · Parameter · Value · Unit · From · Check? · Tolerance · Exact text · Pattern · Notes · Description
const HEAD = ['Element', 'Part', 'Group', 'Parameter', 'Value', 'Unit', 'From', 'Check?', 'Tolerance', 'Exact text', 'Pattern', 'Notes', 'Description'];

interface Row { element: string; part: string; param: string; value: Cell; unit?: string; from?: string; check?: string; tol?: number | null; exact?: string; pattern?: string; notes?: string; }

const groupOf = (param: string) => {
  const d = PARAMS.find((p) => p.name === param);
  if (!d) throw new Error(`unknown parameter in the data definition: ${param}`);
  return d.group;
};

// helpers that read like the spec
const r = (element: string, part: string, param: string, value: Cell, o: Partial<Row> = {}): Row => ({ element, part, param, value, check: 'Yes', ...o });
const pos = (element: string, part: string, param: string, v: number, from: string) => r(element, part, param, v, { unit: 'in', from });
const size = (element: string, part: string, param: string, v: number) => r(element, part, param, v, { unit: 'in' });
const pt = (element: string, part: string, param: string, v: number) => r(element, part, param, v, { unit: 'pt' });
const txt = (element: string, part: string, param: string, v: string, o: Partial<Row> = {}) => r(element, part, param, v, { exact: 'Yes', ...o });
const note = (element: string, part: string, param: string, v: string, o: Partial<Row> = {}) => r(element, part, param, v, { check: 'Note', ...o });
const colour = (element: string, part: string, param: 'Colour' | 'Fill', hex: string) =>
  r(element, part, param, hex, { notes: COLOURS.find(([, h]) => h === hex)?.[0] });
const text = (element: string, part: string, s: { top: number; left: number; wrap?: number; wording: string; font: string; size: number; colour: string; bold: string; italic: string; underline?: string; kase: string; spacing?: number; exact?: boolean; pattern?: string; notes?: string; italicWords?: string }): Row[] => {
  const rows: Row[] = [pos(element, part, 'Top', s.top, 'top of page'), pos(element, part, 'Left', s.left, 'left of page')];
  if (s.wrap !== undefined) rows.push(pos(element, part, 'Wrap at', s.wrap, 'left of page'));
  rows.push(s.pattern
    ? note(element, part, 'Wording', '<<dynamic>>', { pattern: s.pattern, notes: s.notes, exact: 'No' })
    : txt(element, part, 'Wording', s.wording, { exact: s.exact === false ? 'No' : 'Yes', notes: s.notes }));
  rows.push(r(element, part, 'Font', s.font), pt(element, part, 'Font size', s.size), colour(element, part, 'Colour', s.colour));
  if (s.spacing !== undefined) rows.push(pt(element, part, 'Line spacing', s.spacing));
  rows.push(r(element, part, 'Bold', s.bold));
  rows.push(s.italicWords ? r(element, part, 'Italic words', s.italicWords, { notes: 'Only these words italic; the rest upright' }) : r(element, part, 'Italic', s.italic));
  if (s.underline) rows.push(r(element, part, 'Underline', s.underline));
  rows.push(r(element, part, 'Case', s.kase));
  return rows;
};
const image = (element: string, part: string, file: string, top: number, left: number, h: number, w: number): Row[] => [
  txt(element, part, 'File name', file), size(element, part, 'Height', h), size(element, part, 'Width', w),
  pos(element, part, 'Top', top, 'top of page'), pos(element, part, 'Left', left, 'left of page'),
];
const table = (element: string, s: { top: number; left: number; width: number; rowH: number; cols: number; headers: string; widths: string; align: string; rows: number; font: string; headSize: number; bodySize: number; lastRowBold?: boolean }): Row[] => [
  pos(element, '', 'Top', s.top, 'top of page'), pos(element, '', 'Left', s.left, 'left of page'),
  size(element, '', 'Width', s.width), size(element, '', 'Row height', s.rowH),
  r(element, '', 'Columns', s.cols, { unit: 'count' }), txt(element, '', 'Column headers', s.headers),
  r(element, '', 'Column widths', s.widths, { unit: 'in', notes: 'one width per column, left to right' }),
  r(element, '', 'Column alignment', s.align),
  r(element, '', 'Rows', s.rows, { unit: 'count', notes: 'including the header row' }),
  r(element, 'Header row', 'Font', s.font), pt(element, 'Header row', 'Font size', s.headSize), r(element, 'Header row', 'Bold', 'Yes'),
  colour(element, 'Header row', 'Colour', '#FFFFFF'), colour(element, 'Header row', 'Fill', '#0B3C5D'),
  r(element, 'Body rows', 'Font', s.font), pt(element, 'Body rows', 'Font size', s.bodySize),
  ...(s.lastRowBold ? [r(element, 'Last row', 'Bold', 'Yes')] : []),
  note(element, '', 'Data', '<<dynamic>>', { notes: 'values from the reporting system for the period' }),
];
const footer = (n: number): Row[] => [
  pos('Footer', 'Page number', 'Baseline', 0.4, 'bottom of page'),
  pos('Footer', 'Page number', 'Right', 0.5, 'right of page'),
  txt('Footer', 'Page number', 'Wording', `Page ${n} of 4`),
  r('Footer', 'Page number', 'Font', 'Helvetica'), pt('Footer', 'Page number', 'Font size', 8), colour('Footer', 'Page number', 'Colour', '#52514E'),
  r('Footer', 'Page number', 'Bold', 'No'), r('Footer', 'Page number', 'Italic', 'No'), r('Footer', 'Page number', 'Underline', 'No'), r('Footer', 'Page number', 'Case', 'Sentence'),
];

const page1: Row[] = [
  ...image('Cover artwork', 'Cover image', 'cover-artwork.png', 0, 0, 4.25, 11),
  pos('Title block', 'Container', 'Top', 4.75, 'top of page'), pos('Title block', 'Container', 'Left', 0.75, 'left of page'),
  size('Title block', 'Container', 'Height', 2.25), size('Title block', 'Container', 'Width', 9.5), colour('Title block', 'Container', 'Fill', '#EEF1F4'),
  ...image('Title block', 'Company logo', 'company-logo.png', 5, 1, 0.5, 1.75),
  ...text('Title block', 'Report title', { top: 5.75, left: 1, wording: 'Fleet Operations Review', font: 'Helvetica', size: 28, colour: '#0B3C5D', bold: 'Yes', italic: 'No', underline: 'No', kase: 'Title' }),
  txt('Title block', 'Report title', 'Alternative wording', 'Depot Operations Review', { notes: 'when the report covers one depot only' }),
  ...text('Title block', 'Reporting period', { top: 6.35, left: 1, wording: '', pattern: 'Quarter {n} {yyyy}', notes: 'sample value: Quarter 3 2026', font: 'Helvetica', size: 14, colour: '#52514E', bold: 'No', italic: 'No', italicWords: 'Quarter', underline: 'No', kase: 'Title' }),
  ...text('Title block', 'Prepared for', { top: 6.65, left: 1, wording: '', pattern: 'Prepared for: {customer}', notes: 'sample value: Prepared for: Bluefin Grocers', font: 'Helvetica', size: 11, colour: '#52514E', bold: 'No', italic: 'No', underline: 'No', kase: 'Sentence' }),
  ...text('Footer', 'Disclaimer', { top: 7.85, left: 0.75, wrap: 10.25, wording: 'For internal planning use. Figures are unaudited and may be restated in a later report.', font: 'Times', size: 8, colour: '#52514E', spacing: 10, bold: 'No', italic: 'No', kase: 'Sentence' }),
];

const page2: Row[] = [
  note('Page', '', 'Note', 'The figures in the highlights table must match the regional table on page 3 and the fuel table on page 4.'),
  pos('Left sidebar', 'Container', 'Top', 0, 'top of page'), pos('Left sidebar', 'Container', 'Left', 0, 'left of page'),
  size('Left sidebar', 'Container', 'Height', 8.5), size('Left sidebar', 'Container', 'Width', 2.75), colour('Left sidebar', 'Container', 'Fill', '#0B3C5D'),
  ...text('Left sidebar', 'Page title', { top: 0.75, left: 0.4, wording: 'Fleet Highlights', font: 'Helvetica', size: 20, colour: '#FFFFFF', spacing: 26, bold: 'Yes', italic: 'No', underline: 'No', kase: 'Title' }),
  txt('Left sidebar', 'Page title', 'Line break after', 'Fleet'),
  ...text('Left sidebar', 'Sidebar note', { top: 7.2, left: 0.4, wrap: 2.45, wording: 'All figures are for the quarter ending 30 September 2026.', font: 'Helvetica', size: 9, colour: '#FFFFFF', spacing: 12, bold: 'No', italic: 'No', kase: 'Sentence' }),
  ...table('Highlights table', { top: 0.75, left: 3.25, width: 7, rowH: 0.35, cols: 4, headers: 'Measure | This quarter | Last quarter | Change', widths: '2.8 | 1.4 | 1.4 | 1.4', align: 'left | right | right | right', rows: 6, font: 'Helvetica', headSize: 11, bodySize: 11 }),
  ...text('Summary', 'Heading', { top: 3.15, left: 3.25, wording: 'Quarter in Brief', font: 'Helvetica', size: 14, colour: '#0B3C5D', bold: 'Yes', italic: 'No', underline: 'No', kase: 'Title' }),
  ...text('Summary', 'Paragraph', { top: 3.5, left: 3.25, wrap: 10.25, wording: 'Deliveries rose for the third quarter in a row while fuel use fell, helped by the two electric vans added at the South depot in August. On-time performance improved in every region except Central, where road works on the ring road added an average of nine minutes to afternoon routes. Next quarter the focus moves to load planning at the East depot.', font: 'Times', size: 11, colour: '#111111', spacing: 15, bold: 'No', italic: 'No', kase: 'Sentence' }),
  ...image('Depot map', 'Image', 'depot-map.png', 5, 3.25, 2.4, 3.4),
  ...text('Depot map', 'Caption', { top: 7.55, left: 3.25, wording: 'Depot coverage, Q3 2026', font: 'Helvetica', size: 9, colour: '#52514E', bold: 'No', italic: 'No', underline: 'No', kase: 'Sentence' }),
  ...footer(2),
];

const page3: Row[] = [
  ...text('Page header', 'Title', { top: 0.6, left: 0.75, wording: 'Delivery Performance by Region', font: 'Helvetica', size: 20, colour: '#0B3C5D', bold: 'Yes', italic: 'No', underline: 'No', kase: 'Title' }),
  pos('Page header', 'Rule', 'Top', 1.1, 'top of page'), pos('Page header', 'Rule', 'Left', 0.75, 'left of page'),
  size('Page header', 'Rule', 'Width', 9.5), pt('Page header', 'Rule', 'Weight', 1), colour('Page header', 'Rule', 'Colour', '#0B3C5D'),
  pos('Deliveries chart', 'Graph', 'Top', 1.4, 'top of page'), pos('Deliveries chart', 'Graph', 'Left', 0.75, 'left of page'),
  size('Deliveries chart', 'Graph', 'Height', 3.6), size('Deliveries chart', 'Graph', 'Width', 5.6),
  note('Deliveries chart', 'Graph', 'Chart type', 'Clustered column, 2 series'),
  txt('Deliveries chart', 'Graph title', 'Title', 'Deliveries by region', { notes: 'drawn as text, top left of the graph area' }),
  r('Deliveries chart', 'Graph title', 'Font', 'Helvetica'), pt('Deliveries chart', 'Graph title', 'Font size', 11), r('Deliveries chart', 'Graph title', 'Bold', 'Yes'),
  note('Deliveries chart', 'Graph', 'Categories', 'North, South, East, West, Central'),
  note('Deliveries chart', 'Graph', 'Series 1', 'This quarter', { notes: 'colour #2A78D6 (Route Blue)' }),
  note('Deliveries chart', 'Graph', 'Series 2', 'Last quarter', { notes: 'colour #EB6834 (Signal Orange)' }),
  note('Deliveries chart', 'Graph', 'Y axis', '0 to 6,000 in steps of 1,000; axis title "Deliveries"'),
  note('Deliveries chart', 'Graph', 'Gridlines', 'Horizontal only', { notes: 'colour #E5E7EB (Grid Grey)' }),
  note('Deliveries chart', 'Graph', 'Legend', 'Below the graph, centred'),
  note('Deliveries chart', 'Graph', 'Data', '<<dynamic>>', { notes: 'deliveries per region for this quarter and the previous quarter' }),
  ...table('Regional table', { top: 1.4, left: 6.75, width: 3.5, rowH: 0.32, cols: 4, headers: 'Region | Deliveries | On-time | Avg delay', widths: '1.05 | 0.85 | 0.75 | 0.85', align: 'left | right | right | right', rows: 7, font: 'Helvetica', headSize: 9.5, bodySize: 9.5, lastRowBold: true }),
  ...text('Commentary', 'Paragraph', { top: 5.45, left: 0.75, wrap: 10.25, wording: 'The East region again completed the most deliveries, and the West region recovered from a slow second quarter. Central is the only region where the on-time rate fell; the delay is concentrated between 2 pm and 5 pm and is expected to ease when the road works finish in November.', font: 'Times', size: 11, colour: '#111111', spacing: 15, bold: 'No', italic: 'No', kase: 'Sentence' }),
  ...text('Commentary', 'Footnote', { top: 7.4, left: 0.75, wording: 'On-time means delivered within the booked one-hour window.', font: 'Helvetica', size: 8, colour: '#52514E', bold: 'No', italic: 'Yes', underline: 'No', kase: 'Sentence' }),
  ...footer(3),
];

const page4: Row[] = [
  note('Page', '', 'Note', 'Show this page only when the period has three or more months of fuel data. When shown, the September value must equal the fuel figure used on page 2.'),
  ...text('Page header', 'Title', { top: 0.6, left: 0.75, wording: 'Fuel Efficiency Trend', font: 'Helvetica', size: 20, colour: '#0B3C5D', bold: 'Yes', italic: 'No', underline: 'No', kase: 'Title' }),
  ...image('Fuel chart', 'Graph (image)', 'fuel-trend-chart.png', 1.3, 0.75, 3.8, 6.2),
  note('Fuel chart', 'Graph (image)', 'Chart type', 'Line with markers, 1 series', { notes: 'the graph is rendered inside the image; its parts are not separately checkable' }),
  note('Fuel chart', 'Graph (image)', 'Title', 'Litres per 100 km, January to September 2026'),
  note('Fuel chart', 'Graph (image)', 'Categories', 'Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep'),
  note('Fuel chart', 'Graph (image)', 'Series 1', 'Litres per 100 km', { notes: 'colour #2A78D6 (Route Blue)' }),
  note('Fuel chart', 'Graph (image)', 'Y axis', '26 to 32 in steps of 1'),
  note('Fuel chart', 'Graph (image)', 'Legend', 'None — one series, named by the title'),
  note('Fuel chart', 'Graph (image)', 'Data label', 'Last point only, one decimal place'),
  ...table('Monthly table', { top: 1.3, left: 7.35, width: 2.9, rowH: 0.3, cols: 2, headers: 'Month | Litres / 100 km', widths: '1.2 | 1.7', align: 'left | right', rows: 10, font: 'Helvetica', headSize: 10, bodySize: 10 }),
  ...text('Commentary', 'Paragraph', { top: 5.5, left: 0.75, wrap: 10.25, wording: 'Fuel use per 100 km fell from 31.4 litres in January to 27.9 litres in September. Most of the improvement came after route re-planning in April and the electric vans in August, which now cover the shortest urban routes.', font: 'Times', size: 11, colour: '#111111', spacing: 15, bold: 'No', italic: 'No', kase: 'Sentence' }),
  ...footer(4),
];

const PAGES: { tab: string; name: string; type: string; repeats: string; identifying: string; comments: string; rows: Row[] }[] = [
  { tab: '1', name: 'Cover', type: 'Required', repeats: '1', identifying: 'Fleet Operations Review', comments: '', rows: page1 },
  { tab: '2', name: 'Fleet highlights', type: 'Required', repeats: '1', identifying: 'Fleet Highlights', comments: '', rows: page2 },
  { tab: '3', name: 'Delivery performance', type: 'Optional', repeats: '0–1', identifying: 'Delivery Performance by Region', comments: 'Optional page', rows: page3 },
  { tab: '4', name: 'Fuel efficiency trend', type: 'Conditional', repeats: '0–1', identifying: 'Fuel Efficiency Trend', comments: 'Shown only when three or more months of fuel data are available', rows: page4 },
];

// Settings — row numbers matter: the conditional-formatting rule for `px` reads B10.
const SETTINGS: [string, Cell, string, string][] = [
  // key · value · unit · note
  ['Template version', 2, '', 'SR-SPEC-INTAKE decision 7'],
  ['Position tolerance', 0.06, 'in', 'blank Tolerance cells use this'],
  ['Size tolerance', 0.06, 'in', ''],
  ['Font size tolerance', 2, 'pt', ''],
  ['Line spacing tolerance', 0.03, 'in', ''],
  ['Colour threshold', null, 'ΔE', 'blank = the tool default (SR-CONSTANTS)'],
  ['Page width', 11, 'in', 'pinned: a PDF page of another size is a finding'],
  ['Page height', 8.5, 'in', ''],
  ['Pixels per inch', null, 'px/in', 'REQUIRED before any row may use px; blank = px is an error'],
];

// ───────────────────────────── planted intake errors ─────────────────────────────

interface Planted { sheet: string; element: string; param: string; patch: Partial<Row> & { paramRename?: string }; code: string; cell: 'Value' | 'Unit' | 'From' | 'Parameter' | 'Tolerance'; message: string; }
const PLANTED: Planted[] = [
  { sheet: '1', element: 'Report title', param: 'Font size', patch: { unit: '' }, code: 'unit-missing', cell: 'Unit', message: 'Font size needs a unit (pt); the Unit cell is blank — nothing is assumed' },
  { sheet: '1', element: 'Reporting period', param: 'Font size', patch: { value: '14 pt' }, code: 'unit-in-value', cell: 'Value', message: 'the Value holds text ("14 pt"); put the number in Value and pt in Unit' },
  { sheet: '1', element: 'Company logo', param: 'Width', patch: { value: 168, unit: 'px' }, code: 'px-without-density', cell: 'Unit', message: 'px used but Settings · Pixels per inch is blank' },
  { sheet: '1', element: 'Container', param: 'Fill', patch: { value: '#E4E9F2', notes: 'Cloud Grey' }, code: 'colour-name-mismatch', cell: 'Value', message: 'Cloud Grey is #EEF1F4 on the Lists sheet, not #E4E9F2' },
  { sheet: '1', element: 'Disclaimer', param: 'Line spacing', patch: { value: '~10' }, code: 'approximate-value', cell: 'Value', message: '"~10" is approximate; state the number and a Tolerance' },
  { sheet: '2', element: 'Image', param: 'Height', patch: { unit: 'inch' }, code: 'unit-unknown', cell: 'Unit', message: '"inch" is not a unit on the Lists sheet (use in)' },
  { sheet: '2', element: 'Highlights table', param: 'Top', patch: { from: '' }, code: 'from-missing', cell: 'From', message: 'a position needs its reference edge (From); blank' },
  { sheet: '3', element: 'Title', param: 'Font size', patch: { paramRename: 'Fnt size' }, code: 'parameter-unknown', cell: 'Parameter', message: '"Fnt size" is not on the Lists sheet — nearest: Font size' },
  { sheet: '3', element: 'Regional table', param: 'Rows', patch: { value: '7 including the header row' }, code: 'number-expected', cell: 'Value', message: 'Rows takes a number; the Value is prose' },
  { sheet: '4', element: 'Paragraph', param: 'Top', patch: { value: '5.4–5.6', tol: 0.1 }, code: 'range-and-tolerance', cell: 'Value', message: 'a range and a Tolerance on the same row — give one or the other' },
];

// ───────────────────────────── xlsx writer (jszip only) ─────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colLetter = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s; return s; };

class Strings { list: string[] = []; idx = new Map<string, number>(); id(s: string) { let i = this.idx.get(s); if (i === undefined) { i = this.list.length; this.list.push(s); this.idx.set(s, i); } return i; } }

interface SheetSpec { name: string; tab?: string; cols: number[]; rows: Cell[][]; merges?: string[]; styles?: (r: number, c: number) => number | undefined; freeze?: boolean; validations?: string; conditional?: string; }

function sheetXml(sh: SheetSpec, S: Strings): string {
  const cells: string[] = [];
  sh.rows.forEach((row, ri) => {
    const cs: string[] = [];
    row.forEach((v, ci) => {
      if (v === null || v === undefined || v === '') return;
      const ref = `${colLetter(ci)}${ri + 1}`;
      const st = sh.styles?.(ri, ci); const sAttr = st ? ` s="${st}"` : '';
      if (typeof v === 'number') cs.push(`<c r="${ref}"${sAttr}><v>${v}</v></c>`);
      else cs.push(`<c r="${ref}" t="s"${sAttr}><v>${S.id(v)}</v></c>`);
    });
    if (cs.length) cells.push(`<row r="${ri + 1}">${cs.join('')}</row>`);
  });
  const cols = sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const views = sh.freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const pr = sh.tab ? `<sheetPr><tabColor rgb="${sh.tab}"/></sheetPr>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pr}${views}<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${cells.join('')}</sheetData>${sh.merges?.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}${sh.conditional ?? ''}${sh.validations ?? ''}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B3C5D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="1"><dxf><font><color rgb="FF9C0006"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs>
</styleSheet>`;

const TAB_COLOUR: Record<string, string> = { Required: 'FF2E7D32', Optional: 'FFF9A825', Conditional: 'FF1565C0' };

function orderedRows(p: typeof PAGES[number]): Row[] {
  const ordered: Row[] = [];
  for (let i = 0; i < p.rows.length; ) {
    let j = i;
    while (j < p.rows.length && p.rows[j].element === p.rows[i].element && p.rows[j].part === p.rows[i].part) j++;
    ordered.push(...p.rows.slice(i, j).map((row, k) => ({ row, k })).sort((a, b) => GROUPS.indexOf(groupOf(a.row.param)) - GROUPS.indexOf(groupOf(b.row.param)) || a.k - b.k).map((x) => x.row));
    i = j;
  }
  return ordered;
}

function pageSheet(p: typeof PAGES[number], planted: Planted[]): SheetSpec {
  const rows: Cell[][] = [HEAD];
  // within one Element · Part, order the rows by the Lists sheet's group order, so each merged
  // Group block is one contiguous run (Position · Size · Image · Text · Font · Colour · …)
  orderedRows(p).forEach((row, i) => {
    const e = planted.find((x) => (x.element === row.part || x.element === row.element) && x.param === row.param);
    const m: Row & { paramRename?: string } = e ? { ...row, ...e.patch } : row;
    rows.push([m.element, m.part, groupOf(row.param), m.paramRename ?? m.param, m.value, m.unit ?? '', m.from ?? '', m.check ?? 'Yes', m.tol ?? null, m.exact ?? '', m.pattern ?? '', m.notes ?? '', '']);
  });
  // merge-and-centre the label columns over the rows they label (Element · Part · Group)
  const merges: string[] = [];
  const spans = (col: number, same: (a: Cell[], b: Cell[]) => boolean) => {
    let start = 1; // rows[1] is sheet row 2
    for (let i = 2; i <= rows.length; i++) {
      if (i === rows.length || !same(rows[i], rows[start])) {
        if (i - 1 > start) merges.push(`${colLetter(col)}${start + 1}:${colLetter(col)}${i}`);
        start = i;
      }
    }
  };
  spans(0, (a, b) => a[0] === b[0]);
  spans(1, (a, b) => a[0] === b[0] && a[1] === b[1]);
  spans(2, (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);
  // only the top-left cell of a merge carries the label; the merged-away cells stay empty
  for (const m of merges) {
    const [, c, r1, r2] = /^([A-Z]+)(\d+):[A-Z]+(\d+)$/.exec(m)!;
    const col = c.charCodeAt(0) - 65;
    for (let r = Number(r1) + 1; r <= Number(r2); r++) rows[r - 1][col] = '';
  }
  const last = 400; // room for rows added by hand
  const V = (col: string, f: string) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Not on the list" error="Pick a value from the Lists sheet; the upload rejects anything else." sqref="${col}2:${col}${last}"><formula1>${f}</formula1></dataValidation>`;
  const validations = `<dataValidations count="6">${[
    V('C', `Lists!$A$2:$A$${GROUPS.length + 1}`), V('D', `Lists!$E$2:$E$${PARAMS.length + 1}`), V('F', `Lists!$C$2:$C$${UNITS.length + 1}`),
    V('G', `Lists!$K$2:$K$${FROM.length + 1}`), V('H', '"Yes,Note,No"'), V('J', '"Yes,No"'),
  ].join('')}</dataValidations>`;
  const L = `Lists!$E$2:$J$${PARAMS.length + 1}`; // Parameter · Kind · Units allowed · Unit required · Number? · From required
  const CF = (sqref: string, priority: number, formula: string) => `<conditionalFormatting sqref="${sqref}"><cfRule type="expression" dxfId="0" priority="${priority}"><formula>${esc(formula)}</formula></cfRule></conditionalFormatting>`;
  const conditional = [
    CF(`F2:F${last}`, 1, `AND($D2<>"",$F2="",IFERROR(VLOOKUP($D2,${L},4,FALSE),"")="yes")`),
    CF(`F2:F${last}`, 2, `AND($F2<>"",ISERROR(SEARCH(" "&$F2&" "," "&IFERROR(VLOOKUP($D2,${L},3,FALSE),"")&" ")))`),
    CF(`F2:F${last}`, 3, `AND($F2="px",Settings!$B$10="")`),
    CF(`E2:E${last}`, 4, `AND($E2<>"",ISTEXT($E2),IFERROR(VLOOKUP($D2,${L},5,FALSE),"")="yes")`),
    CF(`D2:D${last}`, 5, `AND($D2<>"",ISNA(MATCH($D2,Lists!$E$2:$E$${PARAMS.length + 1},0)))`),
    CF(`G2:G${last}`, 6, `AND($D2<>"",$G2="",IFERROR(VLOOKUP($D2,${L},6,FALSE),"")="yes")`),
  ].join('');
  return { name: p.tab, tab: TAB_COLOUR[p.type], cols: [18, 16, 10, 18, 44, 7, 16, 8, 10, 10, 26, 36, 30], rows, merges, freeze: true,
    styles: (r, c) => (r === 0 ? 1 : c <= 2 ? 4 : c === 4 || c === 11 ? 2 : undefined), validations, conditional };
}

function listsSheet(): SheetSpec {
  const n = Math.max(GROUPS.length, UNITS.length, PARAMS.length, FROM.length, CHECK.length, CASES.length, FONTS.length, COLOURS.length);
  const rows: Cell[][] = [['Group', '', 'Unit', '', 'Parameter', 'Kind', 'Units allowed', 'Unit required', 'Number?', 'From required', 'From', '', 'Check?', 'Case', 'Font', 'Colour name', 'Hex']];
  for (let i = 0; i < n; i++) {
    const p = PARAMS[i];
    rows.push([GROUPS[i] ?? '', '', UNITS[i] ?? '', '', p?.name ?? '', p?.kind ?? '', p?.units ?? '', p ? (p.unitRequired ? 'yes' : 'no') : '', p ? (p.number ? 'yes' : 'no') : '', p ? (p.fromRequired ? 'yes' : 'no') : '', FROM[i] ?? '', '', CHECK[i] ?? '', CASES[i] ?? '', FONTS[i] ?? '', COLOURS[i]?.[0] ?? '', COLOURS[i]?.[1] ?? '']);
  }
  return { name: 'Lists', cols: [12, 2, 8, 2, 20, 9, 16, 13, 9, 13, 20, 2, 8, 10, 12, 16, 10], rows, freeze: true, styles: (r) => (r === 0 ? 1 : undefined) };
}

function pagesListSheet(): SheetSpec {
  const rows: Cell[][] = [['Tab', 'Page name', 'Page type', 'Orientation', 'Variant group', 'Repeats', 'Identifying text', 'Comments']];
  for (const p of PAGES) rows.push([p.tab, p.name, p.type, 'Landscape', '', p.repeats, p.identifying, p.comments]);
  rows.push([]);
  rows.push(['Fleet Operations Review — Template v2 spec. SAMPLE: every name, number and figure is fictional.']);
  rows.push(['Measurements: a number in Value, its unit in Unit, its reference edge in From. A text\'s Top is the top of its first line; Baseline is the distance from the named edge to the text baseline.']);
  const validations = `<dataValidations count="2"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="C2:C200"><formula1>"Required,Optional,Conditional"</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="D2:D200"><formula1>"Landscape,Portrait"</formula1></dataValidation></dataValidations>`;
  return { name: 'Pages List', cols: [6, 24, 13, 12, 13, 9, 32, 60], rows, freeze: true, styles: (r, c) => (r === 0 ? 1 : c === 7 ? 2 : undefined), validations };
}

function settingsSheet(): SheetSpec {
  const rows: Cell[][] = [['Setting', 'Value', 'Unit', 'Note']];
  for (const [k, v, u, n] of SETTINGS) rows.push([k, v, u, n]);
  return { name: 'Settings', cols: [24, 10, 8, 60], rows, freeze: true, styles: (r, c) => (r === 0 ? 1 : c === 3 ? 2 : undefined) };
}

async function build(planted: Planted[]): Promise<Buffer> {
  const S = new Strings();
  const sheets: SheetSpec[] = [pagesListSheet(), settingsSheet(), listsSheet(), ...PAGES.map((p) => pageSheet(p, planted.filter((e) => e.sheet === p.tab)))];
  const sheetXmls = sheets.map((sh) => sheetXml(sh, S)); // fills S
  const zip = new JSZip();
  const date = new Date('2026-10-18T00:00:00Z');
  // createFolders: false — implicit folder entries would carry the current time and break byte-identity
  const add = (path: string, content: string) => zip.file(path, content, { date, compression: 'DEFLATE', createFolders: false });
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Fleet Operations Review — spec (Template v2, fictional sample)</dc:title><dc:creator>pdfsuite sample generator</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-18T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-18T00:00:00Z</dcterms:modified></cp:coreProperties>`);
  add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>pdfsuite</Application></Properties>`);
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets>${sheets.map((sh, i) => `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  add('xl/styles.xml', STYLES);
  add('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${S.list.length}" uniqueCount="${S.list.length}">${S.list.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);
  sheetXmls.forEach((x, i) => add(`xl/worksheets/sheet${i + 1}.xml`, x));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'UNIX' });
}

// expected-validation.json — the cell each planted error lands in
function expected(): object {
  const colOf: Record<Planted['cell'], string> = { Parameter: 'D', Value: 'E', Unit: 'F', From: 'G', Tolerance: 'I' };
  const errors = PLANTED.map((e) => {
    const p = PAGES.find((pg) => pg.tab === e.sheet)!;
    const i = orderedRows(p).findIndex((row) => (row.part === e.element || row.element === e.element) && row.param === e.param);
    if (i < 0) throw new Error(`planted error names a row that does not exist: ${JSON.stringify(e)}`);
    return { sheet: e.sheet, row: i + 2, cell: `${colOf[e.cell]}${i + 2}`, code: e.code, severity: 'error', message: e.message, assertion: 'none — the row is removed from the check and listed' };
  });
  return { schema: 'pdfsuite.expected-validation/1', workbook: 'report-spec-with-errors.xlsx', rule: 'SR-SPEC-INTAKE decisions 7a, 9, 13', errors, cleanWorkbook: { file: 'report-spec.xlsx', errors: 0, warnings: 0 } };
}

const out = process.argv[2] ?? here;
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report-spec.xlsx'), await build([]));
writeFileSync(join(out, 'report-spec-with-errors.xlsx'), await build(PLANTED));
writeFileSync(join(out, 'expected-validation.json'), JSON.stringify(expected(), null, 2) + '\n');
console.log(`wrote report-spec.xlsx, report-spec-with-errors.xlsx, expected-validation.json → ${out}`);
