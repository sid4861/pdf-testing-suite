// Spike gate for plan.md R1–R3: prove the React app's engine runs unmodified under Node.
// Compares the two bundled sample invoices and prints real metrics. Throwaway once the
// commands exist, but kept as the smoke test referenced in the plan.

import '../src/platform/dom-shim.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPdf, comparePage } from '../../src/services/pdfCompare';
import { buildChanges, heatmapBoxes } from '../../src/services/changes';
import { reportPageDetail, REPORT_CSS } from '../../src/services/exportReport';

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = path.resolve(here, '../../public/samples');

/** The engine takes a browser File; Node has no File constructor pre-20.  */
function fileFrom(p: string): File {
  const buf = fs.readFileSync(p);
  return {
    name: path.basename(p),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
}

async function main() {
  console.log('R2 · loading pdfs via pdfjs legacy build…');
  const a = await loadPdf(fileFrom(path.join(samples, 'invoice-original.pdf')));
  const b = await loadPdf(fileFrom(path.join(samples, 'invoice-recreated.pdf')));
  console.log(`   ok — A: ${a.numPages} pages, B: ${b.numPages} pages`);

  const pageCount = Math.max(a.numPages, b.numPages);
  console.log(`\nR1/R3 · comparing ${pageCount} pages (render + pixel diff)…`);

  const pageCache: Record<number, Awaited<ReturnType<typeof comparePage>>> = {};
  const pages = [];

  for (let i = 0; i < pageCount; i++) {
    const pc = await comparePage(a, b, i, { pixelThreshold: 0.1, includeAA: false });
    const changes = buildChanges(pc, 0.03);
    const heat = heatmapBoxes(changes);
    pageCache[i] = pc;
    pages.push({
      pageIndex: i,
      contentMatch: pc.contentMatch,
      pixelRatio: pc.pixel?.ratio ?? 0,
      maxOffset: pc.maxOffset,
      pxPerInch: pc.pxPerInch,
      missing: !pc.imageA || !pc.imageB,
    });

    console.log(
      `   page ${i + 1}: content ${(pc.contentMatch * 100).toFixed(1)}% · ` +
        `pixels ${((pc.pixel?.ratio ?? 0) * 100).toFixed(2)}% · ` +
        `maxShift ${(pc.maxOffset / pc.pxPerInch).toFixed(3)}" · ` +
        `changes ${changes.length} (layout ${heat.filter((h) => h.type === 'layout').length}, ` +
        `text ${heat.filter((h) => h.type === 'text').length})`,
    );
  }

  console.log('\nR3 · building visual HTML (Image + canvas downscale path)…');
  const summary = { pages, pageCountA: a.numPages, pageCountB: b.numPages };
  const detail = await reportPageDetail(summary, pageCache, {
    contentPct: 99,
    pixelPct: 2,
    offsetIn: 0.03,
  });

  const outDir = path.join(here, '../.work');
  fs.mkdirSync(outDir, { recursive: true });
  const html = `<!doctype html><meta charset="utf-8"><title>spike</title><style>${REPORT_CSS}</style>${detail}`;
  const outFile = path.join(outDir, 'spike-report.html');
  fs.writeFileSync(outFile, html);

  const imgCount = (detail.match(/<img /g) ?? []).length;
  console.log(`   ok — ${(html.length / 1024 / 1024).toFixed(2)} MB, ${imgCount} embedded images`);
  console.log(`   wrote ${outFile}`);

  if (imgCount === 0) throw new Error('no images embedded — shrinkDataUrl/Image shim failed');
  console.log('\n✓ SPIKE PASSED — engine runs unmodified under Node.');
}

main().catch((err) => {
  console.error('\n✗ SPIKE FAILED\n', err);
  process.exit(1);
});
