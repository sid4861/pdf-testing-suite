import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPdf } from '@pdfsuite/core';
// The spec feature's headless barrel — never a file inside the folder.
// See packages/spec/README.md.
import { runSpec, validateSpec } from '@pdfsuite/spec/engine';

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = path.resolve(here, '../../../public/samples');
const f = (p: string): File => {
  const b = fs.readFileSync(p);
  return {
    name: path.basename(p),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File;
};

function row(label: string, r: { pages: { page: number; specPage: number; passCount: number; failCount: number }[] }) {
  const parts = r.pages.map(
    (p) => 'pdf ' + p.page + ' / spec ' + p.specPage + ' → ' + p.passCount + ' pass, ' + p.failCount + ' fail',
  );
  console.log('  ' + label.padEnd(46) + parts.join('   |   '));
}

async function main() {
  const pdf = await loadPdf(f(path.join(samples, 'spec-sample.pdf')));
  const spec = validateSpec(JSON.parse(fs.readFileSync(path.join(samples, 'spec-sample.json'), 'utf8')));
  console.log('PDF has ' + pdf.numPages + ' pages; spec declares ' + spec.pages.length + ' pages\n');

  // 1. default — unchanged behaviour
  const all = await runSpec(pdf, spec);
  row('all pages (default)', all);

  // 2. the old third-argument form must still work
  let progressSeen = 0;
  const legacy = await runSpec(pdf, spec, () => { progressSeen++; });
  row('all pages, legacy callback arg', legacy);
  console.log('  ' + 'progress callback fired'.padEnd(46) + progressSeen + ' time(s)\n');

  // 3. one spec page only, at the page it declares
  const one = await runSpec(pdf, spec, { specPageIndex: 1 });
  row('spec page #1 only, no override', one);

  // 4. THE FEATURE — spec page #1 checked against PDF page 2
  const moved = await runSpec(pdf, spec, { specPageIndex: 1, pdfPageOverride: 2 });
  row('spec page #1 against PDF page 2', moved);

  // 5. out-of-range target
  const beyond = await runSpec(pdf, spec, { specPageIndex: 1, pdfPageOverride: 99 });
  row('spec page #1 against PDF page 99', beyond);

  console.log('');
  const checks: [string, boolean][] = [
    ['default still checks every spec page', all.pages.length === spec.pages.length],
    ['legacy callback form still accepted', legacy.pages.length === all.pages.length && progressSeen > 0],
    ['specPageIndex narrows to one page', one.pages.length === 1],
    ['no override → page equals specPage', one.pages[0].page === one.pages[0].specPage],
    ['override changes the page checked', moved.pages[0].page === 2],
    ['override records the original spec page', moved.pages[0].specPage === 1],
    [
      'override really reads the OTHER page',
      moved.pages[0].failCount !== one.pages[0].failCount ||
        moved.pages[0].passCount !== one.pages[0].passCount,
    ],
    ['out-of-range target fails cleanly', beyond.pages[0].elements.every((e) => e.status === 'not-found')],
  ];

  let ok = 0;
  for (const [label, pass] of checks) {
    console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + label);
    if (pass) ok++;
  }
  console.log('');
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
