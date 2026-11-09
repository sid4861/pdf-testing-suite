import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPdf, comparePage } from '@pdfsuite/core';
import { buildChanges } from '@pdfsuite/compare';

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

async function main() {
  const a = await loadPdf(f(path.join(samples, 'invoice-original.pdf')));
  const b = await loadPdf(f(path.join(samples, 'invoice-recreated.pdf')));
  for (const pageNo of [1, 2]) {
    const pc = await comparePage(a, b, pageNo - 1, {});
    const ch = buildChanges(pc, 0.03).filter((c) => c.type === 'removed' || c.type === 'added');
    console.log('');
    console.log('=== page ' + pageNo + ' content changes (' + ch.length + ') ===');
    for (const c of ch) console.log('  ' + c.type.padEnd(8) + ' "' + c.text + '"');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
