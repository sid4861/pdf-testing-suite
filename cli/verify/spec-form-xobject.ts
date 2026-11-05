import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import { PDFDocument, rgb } from 'pdf-lib';
import { runSpec, loadPdf } from '../../src/features/spec/engine';
import type { PdfSpec } from '../../src/features/spec/engine';

/**
 * SR-SPEC-CHECK decision 9 — an image inside a **Form XObject**.
 *
 * pdf.js inlines a form's operations into the page's operator list, bracketed
 * by `paintFormXObjectBegin(matrix, bbox)`. Everything inside is positioned
 * through that matrix, so a walker that ignores it measures the image at the
 * page's origin instead of the form's — the picture is reported somewhere it
 * is not, confidently.
 *
 * There is no committed fixture for this, and inventing one by hand would be
 * guessing at what a real file contains, so the document is built here:
 * `embedPage` is exactly how a form XObject comes to exist.
 */

installPdfLogFilter(false);

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

const PT = 72;

/** A 2×1 in red rectangle drawn 1 in from the left, 1 in from the top. */
async function innerPage(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([4 * PT, 4 * PT]);
  // pdf-lib's origin is the bottom-left: 1 in from the top of a 4 in page is
  // y = 4 − 1 − 1 (the rectangle's own height).
  page.drawRectangle({
    x: 1 * PT, y: (4 - 1 - 1) * PT, width: 2 * PT, height: 1 * PT, color: rgb(0.8, 0.1, 0.1),
  });
  return doc;
}

const file = (name: string, bytes: Uint8Array): File => ({
  name, size: bytes.byteLength,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
} as unknown as File);

/**
 * A PDF assembled by hand, so the form can carry a `/Matrix`.
 *
 * `pdf-lib` always writes an identity matrix, which is the one case where
 * ignoring the matrix and applying it give the same answer — so a test built
 * on it cannot tell the two apart. This one offsets by (10, 5) inside the
 * form, on top of the (20, 30) the page places the form at.
 */
const NEWLINE = '\n';

function handBuilt(): Uint8Array {
  const form = 'q 50 0 0 25 0 0 cm /Im1 Do Q';
  const content = 'q 1 0 0 1 20 30 cm /Fm1 Do Q';
  const jpeg = JPEG_1x1.toString('binary');

  const stream = (dict: string, data: string) =>
    [dict, 'stream', data, 'endstream'].join(NEWLINE);

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]'
      + ' /Resources << /XObject << /Fm1 5 0 R >> >> /Contents 4 0 R >>',
    stream(`<< /Length ${content.length} >>`, content),
    // The form's own matrix: ten points right and five up, inside a form the
    // page has already placed at (20, 30).
    stream(
      '<< /Type /XObject /Subtype /Form /BBox [0 0 100 100] /Matrix [1 0 0 1 10 5]'
        + ` /Resources << /XObject << /Im1 6 0 R >> >> /Length ${form.length} >>`,
      form,
    ),
    stream(
      '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB'
        + ` /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
      jpeg,
    ),
  ];

  let pdf = '%PDF-1.7' + NEWLINE;
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj` + NEWLINE + obj + NEWLINE + 'endobj' + NEWLINE;
  });

  const xref = pdf.length;
  pdf += 'xref' + NEWLINE + `0 ${objects.length + 1}` + NEWLINE + '0000000000 65535 f ' + NEWLINE;
  for (const at of offsets) pdf += `${String(at).padStart(10, '0')} 00000 n ` + NEWLINE;
  pdf += 'trailer' + NEWLINE + `<< /Size ${objects.length + 1} /Root 1 0 R >>` + NEWLINE
    + 'startxref' + NEWLINE + String(xref) + NEWLINE + '%%EOF' + NEWLINE;

  // One byte per character: the stream data is already binary-as-latin-1.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

async function main() {
  console.log('\n  an image inside a form XObject (pdf-lib, identity matrix)\n');

  // The inner page becomes a form XObject in the outer one, drawn at an
  // offset. A real image inside it makes the image operator the thing being
  // measured rather than a vector rectangle.
  const inner = await innerPage();
  const png = await inner.embedPng(PNG_1x1);
  inner.getPage(0).drawImage(png, { x: 1 * PT, y: (4 - 1 - 1) * PT, width: 2 * PT, height: 1 * PT });

  const outer = await PDFDocument.create();
  const sheet = outer.addPage([8.5 * PT, 11 * PT]);
  // Embedded from saved bytes rather than from the live document: pdf.js
  // refuses the XObject pdf-lib builds from an unsaved page ("XObject should
  // be a stream"), and a test that works around a reader bug proves nothing.
  const [embedded] = await outer.embedPdf(await inner.save());
  // Placed 2 in from the left and 3 in from the top of the outer page.
  sheet.drawPage(embedded, { x: 2 * PT, y: (11 - 3 - 4) * PT, width: 4 * PT, height: 4 * PT });

  // Inside the form, the image sits 1 in right and 1 in down from the form's
  // own corner; the form sits 2 in right and 3 in down from the page's. So
  // the image is at 3 in, 4 in on the page.
  const spec: PdfSpec = {
    title: 'form xobject',
    units: 'in',
    tolerance: { position: 0.02, size: 0.02 },
    pages: [{
      page: 1,
      elements: [{
        type: 'image', id: 'logo', label: 'Logo in a form',
        left: 3, top: 4, width: 2, height: 1,
      }],
    }],
  };

  const report = await runSpec(await loadPdf(file('form.pdf', await outer.save())), spec);
  const el = report.pages[0].elements[0];
  for (const c of el.checks) {
    console.log(`      ${c.name}: expected ${c.expected}, actual ${c.actual}${c.pass ? '' : '  ← FAIL'}`);
  }

  check('the image is found', el.status !== 'not-found');
  check('and measured through the placement transform',
    el.status === 'pass',
    el.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.expected} vs ${c.actual}`).join('; ') || 'every check passes');

  console.log('\n  a form with its own /Matrix\n');

  // Page 200×200 pt. The form is placed at (20, 30) and carries
  // /Matrix [1 0 0 1 10 5]; the image fills 50×25 at the form's origin.
  // So the image is at x = 30, y = 35 from the bottom — top-left (30, 140)
  // in points, which is 0.4167 in from the left and 1.9444 in from the top.
  const matrixSpec: PdfSpec = {
    title: 'form matrix',
    units: 'pt',
    tolerance: { position: 1, size: 1 },
    pages: [{
      page: 1,
      elements: [{
        type: 'image', id: 'im', label: 'Image in a form with a matrix',
        left: 30, top: 140, width: 50, height: 25,
      }],
    }],
  };

  const m = await runSpec(await loadPdf(file('matrix.pdf', handBuilt())), matrixSpec);
  const me = m.pages[0].elements[0];
  for (const c of me.checks) {
    console.log(`      ${c.name}: expected ${c.expected}, actual ${c.actual}${c.pass ? '' : '  ← FAIL'}`);
  }
  check('the image inside it is found', me.status !== 'not-found');
  check('and the form’s own matrix is applied',
    me.status === 'pass',
    me.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.expected} vs ${c.actual}`).join('; ')
      || 'left 30pt, top 140pt — ten and five points from where it would be without it');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

/** A 1×1 JPEG — `/DCTDecode`, which a hand-written PDF can carry as is. */
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

/** A 1×1 opaque PNG, so the file carries a real image operator. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
