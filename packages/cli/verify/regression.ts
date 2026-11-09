import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPdf, comparePage } from '@pdfsuite/core';
import { buildChanges, heatmapBoxes } from '@pdfsuite/compare';

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = path.resolve(here, '../../../public/samples');
const f = (p: string): File => {
  const b = fs.readFileSync(p);
  return {
    name: path.basename(p),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File;
};

// Baseline for the bundled sample corpus.
//
// Pages 1 and 2 dropped one `removed` each when word-level diffing landed, and
// that is the improvement, not a regression:
//   "Globex Industries" -> "Globex Industries Inc" is now `added "Inc"` alone,
//   because nothing was removed. Previously it claimed the whole line was
//   deleted and a new one inserted.
const BASELINE = [
  { page: 1, removed: 2, added: 3, styled: 0, moved: 0, text: 3, style: 0, layout: 0 },
  { page: 2, removed: 8, added: 4, styled: 0, moved: 31, text: 8, style: 0, layout: 31 },
  { page: 3, removed: 0, added: 0, styled: 0, moved: 0, text: 0, style: 0, layout: 0 },
  { page: 4, removed: 0, added: 0, styled: 0, moved: 0, text: 0, style: 0, layout: 0 },
  { page: 5, removed: 2, added: 2, styled: 0, moved: 5, text: 4, style: 0, layout: 5 },
  { page: 6, removed: 10, added: 0, styled: 0, moved: 0, text: 10, style: 0, layout: 0 },
];

installPdfLogFilter(process.argv.includes('--verbose'));

async function main() {
  const a = await loadPdf(f(path.join(samples, 'invoice-original.pdf')));
  const b = await loadPdf(f(path.join(samples, 'invoice-recreated.pdf')));

  console.log('page | removed added styled moved | text style layout | vs baseline');
  let drift = 0;
  for (let i = 0; i < Math.max(a.numPages, b.numPages); i++) {
    const pc = await comparePage(a, b, i, {});
    const ch = buildChanges(pc, 0.03);
    const heat = heatmapBoxes(ch);
    const n = (t: string) => ch.filter((c) => c.type === t).length;
    const h = (t: string) => heat.filter((x) => x.type === t).length;
    const got = {
      page: i + 1,
      removed: n('removed'), added: n('added'), styled: n('styled'), moved: n('moved'),
      text: h('text'), style: h('style'), layout: h('layout'),
    };
    const want = BASELINE[i];
    const same = want && (Object.keys(want) as (keyof typeof want)[]).every((k) => want[k] === got[k]);
    if (!same) drift++;
    console.log(
      '  ' + got.page + '  |    ' + got.removed + '     ' + got.added + '     ' + got.styled +
      '      ' + got.moved + '   |   ' + got.text + '    ' + got.style + '     ' + got.layout +
      '   | ' + (same ? 'unchanged' : 'CHANGED  was ' + JSON.stringify(want)),
    );
  }
  console.log('');
  console.log(drift === 0 ? '  no regression on the sample corpus' : '  ' + drift + ' page(s) differ');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
