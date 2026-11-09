import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSpec, loadPdf, type PdfSpec } from '@pdfsuite/spec/engine';

/**
 * W-04 DoD 1 — lines are grouped within a column, not across the page.
 *
 * The fixture's matching PDF used to false-fail here. Page 3 puts a graph on the
 * left and a table on the right: the graph's title and its y-axis labels share
 * baselines with the table's rows, 327 and 391 points away, and the checker
 * merged them. The table's left edge was then read from the chart, and its row
 * count from whatever lined up.
 *
 * These specs are the fixture's own values, from `report-spec.xlsx` sheet 3
 * (Regional table) and sheet 2 (Highlights table). The whole-fixture test — every
 * element, from the workbook — is DoD 6 and waits on W-02's spec JSON; this one
 * covers the defect DoD 1 names and needs no converter.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../../work/samples/excel-spec-template-v2');

const f = (p: string): File => {
  const b = fs.readFileSync(p);
  return {
    name: path.basename(p),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File;
};

/** Sheet 3: the regional table, beside the deliveries graph. */
const regionalTable: PdfSpec = {
  title: 'regional table', units: 'in', pageSize: { width: 11, height: 8.5 },
  pages: [{ page: 3, elements: [
    { id: 'regional-table', label: 'Regional table', type: 'table',
      top: 1.4, left: 6.75, width: 3.5, rows: 7, columns: 4 },
  ] }],
};

/** Sheet 3: the graph's title, which must not absorb the table's header row. */
const graphTitle: PdfSpec = {
  title: 'graph title', units: 'in', pageSize: { width: 11, height: 8.5 },
  pages: [{ page: 3, elements: [
    { id: 'graph-title', label: 'Graph title', type: 'text',
      top: 1.4, left: 0.75, text: 'Deliveries by region', match: 'exact' },
  ] }],
};

/** Sheet 2: the 20pt sidebar heading that used to absorb the table line below it. */
const sidebarTitle: PdfSpec = {
  title: 'sidebar title', units: 'in', pageSize: { width: 11, height: 8.5 },
  pages: [{ page: 2, elements: [
    { id: 'fleet', label: 'Sidebar title', type: 'text',
      top: 0.75, left: 0.4, text: 'Fleet', match: 'exact', fontSize: 20 },
  ] }],
};

function show(label: string, el: { status: string; checks: { name: string; expected: string; actual: string; pass: boolean }[] }) {
  console.log('  ' + label);
  console.log('    status: ' + el.status);
  for (const c of el.checks) {
    console.log('      ' + (c.pass ? 'OK  ' : 'FAIL') + '  ' + c.name.padEnd(9) +
      ' expected ' + String(c.expected).padEnd(16) + ' actual ' + c.actual);
  }
}

async function main() {
  const pdf = await loadPdf(f(path.join(fixture, 'report.pdf')));
  console.log('fixture report.pdf — ' + pdf.numPages + ' pages\n');

  const table = (await runSpec(pdf, regionalTable)).pages[0].elements[0];
  const title = (await runSpec(pdf, graphTitle)).pages[0].elements[0];
  const sidebar = (await runSpec(pdf, sidebarTitle)).pages[0].elements[0];

  show('Regional table (page 3, right of the graph)', table);
  console.log('');
  show('Graph title (page 3, left)', title);
  console.log('');
  show('Sidebar title (page 2)', sidebar);
  console.log('');

  const check = (name: string, pass: boolean) => {
    console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name);
    return pass;
  };

  const rowsCheck = table.checks.find((c) => c.name === 'Rows');
  const leftCheck = table.checks.find((c) => c.name === 'Left');
  const colsCheck = table.checks.find((c) => c.name === 'Columns');

  const results = [
    check('the table is found at all', table.status !== 'not-found'),
    check('its 7 rows are counted, not the graph\'s lines', rowsCheck?.pass === true),
    check('its left edge is the table\'s, not the graph\'s', leftCheck?.pass === true),
    check('its 4 columns are counted', colsCheck?.pass === true),
    check('the graph title is its own line', title.status === 'pass'),
    check('the sidebar title is its own line', sidebar.status === 'pass'),
    check('the matching PDF reports no failure here', [table, title, sidebar].every((e) => e.status === 'pass')),
  ];

  const ok = results.filter(Boolean).length;
  console.log('');
  console.log('  ' + ok + '/' + results.length + ' checks passed');
  if (ok !== results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
