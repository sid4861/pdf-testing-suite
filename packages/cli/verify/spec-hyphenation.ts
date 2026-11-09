import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { runSpec, loadPdf } from '@pdfsuite/spec/engine';
import type { PdfSpec } from '@pdfsuite/spec/engine';

/**
 * SR-SPEC-CHECK decision 5's last clause — line-end hyphenation rejoined.
 *
 * A word broken across a line end is a fact about the layout, not about the
 * document's words: a spec that says "roadworks" must find "road-" / "works".
 * The opposite case matters as much — "North-" / "South" is a real hyphen
 * between two words and must stay broken, or the checker would start finding
 * words nobody wrote.
 */

installPdfLogFilter(false);

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

const PT = 72;

const file = (name: string, bytes: Uint8Array): File => ({
  name, size: bytes.byteLength,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
} as unknown as File);

/** Two lines, one word broken across them, and one genuine hyphen. */
async function page(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([4 * PT, 4 * PT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const draw = (text: string, topIn: number) =>
    p.drawText(text, { x: PT, y: (4 - topIn) * PT, size: 12, font });

  draw('road-', 1);
  draw('works', 1.25);
  draw('North-', 2);
  draw('South', 2.25);
  return doc.save();
}

async function main() {
  console.log('\n  a word broken across a line end\n');

  const pdf = await loadPdf(file('hyphen.pdf', await page()));

  const spec = (text: string): PdfSpec => ({
    units: 'in',
    tolerance: { position: 0.1 },
    pages: [{
      page: 1,
      elements: [{ type: 'text', id: 'w', label: text, text, top: 0.85, left: 1 }],
    }],
  });

  const joined = await runSpec(pdf, spec('roadworks'));
  check('“road-” and “works” are found as “roadworks”',
    joined.pages[0].elements[0].status === 'pass',
    joined.pages[0].elements[0].status);

  const asWritten = await runSpec(pdf, spec('road-'));
  check('and the line as written is still found',
    asWritten.pages[0].elements[0].status === 'pass',
    asWritten.pages[0].elements[0].status);

  console.log('\n  a genuine hyphen between two words\n');

  const real = await runSpec(pdf, {
    units: 'in',
    tolerance: { position: 0.1 },
    pages: [{
      page: 1,
      elements: [{ type: 'text', id: 'n', label: 'NorthSouth', text: 'NorthSouth', top: 1.85, left: 1 }],
    }],
  });
  check('“North-” and “South” do not become “NorthSouth”',
    real.pages[0].elements[0].status === 'not-found',
    real.pages[0].elements[0].status);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
