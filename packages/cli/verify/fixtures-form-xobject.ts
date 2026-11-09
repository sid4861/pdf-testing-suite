/**
 * A PDF assembled by hand so its Form XObject carries a real `/Matrix`.
 *
 * Shared by two suites, because the same defect exists in two walkers and
 * both need the same document to prove the fix: `spec-form-xobject.ts` (the
 * spec checker's walker, W-04) and `inspect-parity.ts` (the element reader's,
 * W-28). A second copy of this builder would be a second thing to keep in
 * step with pdf.js.
 *
 * **Why by hand.** `pdf-lib` always writes an identity matrix, and identity
 * is the one case where applying the matrix and ignoring it give the same
 * answer — so a fixture built with it cannot tell a fixed walker from a
 * broken one. That is not a hypothetical: the first version of the W-04 fix
 * passed its test with the fix reverted.
 *
 * The geometry, which the numbers below must agree with:
 *
 *   * the page is 200 × 200 points;
 *   * the page draws the form at `1 0 0 1 20 30 cm` — 20 right, 30 up;
 *   * the form's own `/Matrix [1 0 0 1 10 5]` adds 10 right, 5 up;
 *   * inside it the image is `50 0 0 25 0 0 cm` — 50 wide, 25 tall, at the
 *     form's origin.
 *
 * So the image's lower-left is (30, 35) and its size 50 × 25. In top-left
 * coordinates that is left 30, top 200 − (35 + 25) = 140. A walker that
 * ignores the matrix reports left 20, top 145 — close enough to look right
 * and wrong enough to matter.
 */

const NEWLINE = '\n';

/** A 1×1 JPEG, so the thing being measured is a real image operator. */
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

/** What a walker that applies the form's matrix must report, in POINTS. */
export const FORM_IMAGE_EXPECTED = {
  pageWidthPt: 200,
  pageHeightPt: 200,
  leftPt: 30,
  topPt: 140,
  widthPt: 50,
  heightPt: 25,
  /** What it reports if the matrix is ignored — the bug this fixture catches. */
  ifMatrixIgnored: { leftPt: 20, topPt: 145 },
};

export function formXObjectPdf(): Uint8Array {
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

/** The structural `File` pdf.js accepts, around those bytes. */
export const formXObjectFile = (): File => {
  const bytes = formXObjectPdf();
  return {
    name: 'form-xobject.pdf',
    size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
};
