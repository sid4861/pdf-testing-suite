// ZIP bundle export: the HTML report plus the annotated PDFs, in one file.
//
// The annotated PDFs are the *original* documents with comment pins stamped on,
// not screenshots — pdf.js hands back the bytes it parsed, pdf-lib writes on top
// of them. Each pin is drawn visibly AND added as a real PDF text annotation, so
// the comments show up in Acrobat's review panel rather than only as ink.

import JSZip from 'jszip';
import { PDFDocument, PDFName, PDFString, type PDFPage } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { CompareSummary, CompareSide, PageComparison } from '@pdfsuite/core';
import {
  buildHtmlReport,
  download,
  stamp,
  type ExportMeta,
} from './exportReport';
import { bySidePage, type Annotation, type NumberedAnnotation } from '../store/annotationStore';
import type { IgnoredChange } from '../store/ignoreStore';
import type { DataRegion } from '../store/regionStore';

export interface ZipSource {
  summary: CompareSummary;
  meta: ExportMeta;
  pageCache: Record<number, PageComparison>;
  annotations: Annotation[];
  /** Differences a reviewer marked expected; recorded in the archived report. */
  ignored?: IgnoredChange[];
  /** Areas ignored wholesale; named in the archived report with their counts. */
  regions?: DataRegion[];
  /** Live pdf.js documents, used to recover the original bytes. */
  docA: PDFDocumentProxy | null;
  docB: PDFDocumentProxy | null;
}

export type ZipProgress = (step: string, done: number, total: number) => void;

/** Half-size of the annotation's clickable square, in PDF points. */
const PIN_R = 9;

/** Filesystem-safe version of a PDF filename, without its extension. */
function safeStem(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'document';
}

/**
 * Attaches one comment as a real PDF /Text annotation.
 *
 * Nothing is drawn into the page's content stream. That is deliberate: the page
 * content stays byte-for-byte what the template produced, so re-importing the
 * bundle reproduces the original comparison instead of diffing our own ink. PDF
 * readers render /Text annotations themselves and list them in a review panel.
 *
 * Annotation coordinates are stored as a fraction of the rendered page with the
 * origin top-left; PDF user space has its origin bottom-left, hence the flip.
 */
function addComment(pdfDoc: PDFDocument, page: PDFPage, a: NumberedAnnotation) {
  const { width, height } = page.getSize();
  const cx = a.x * width;
  const cy = height - a.y * height;

  const annot = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Name: 'Comment',
    Rect: [cx - PIN_R, cy - PIN_R, cx + PIN_R, cy + PIN_R],
    Contents: PDFString.of(a.text || '(no text)'),
    T: PDFString.of(a.author || 'Reviewer'),
    Subj: PDFString.of(`Comment ${a.number}`),
    C: [1, 0.25, 0.25],
    F: 4, // print
  });
  const ref = pdfDoc.context.register(annot);
  const existing = page.node.lookup(PDFName.of('Annots'));
  if (existing && 'push' in existing) (existing as { push: (r: unknown) => void }).push(ref);
  else page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));
}

/** Original bytes + stamped comments for one side. Null when that side has no doc. */
async function annotatePdf(
  doc: PDFDocumentProxy | null,
  annotations: Annotation[],
  side: CompareSide,
): Promise<Uint8Array | null> {
  if (!doc) return null;
  const byPage = bySidePage(annotations, side);
  const bytes = await doc.getData();

  // ignoreEncryption: reading already succeeded in pdf.js, so refusing here
  // would only lose the reviewer their comments.
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (const [pageIndex, list] of byPage) {
    const page = pages[pageIndex];
    if (!page) continue; // comment on a page this side does not have
    for (const a of list) addComment(pdfDoc, page, a);
  }

  return pdfDoc.save();
}

export async function exportZipBundle(src: ZipSource, onProgress?: ZipProgress) {
  const { summary, meta, pageCache, annotations, ignored = [], regions = [] } = src;
  const zip = new JSZip();
  const reports = zip.folder('reports')!;
  const pdfs = zip.folder('annotated-pdfs')!;

  const steps = 3;
  let done = 0;
  const tick = (step: string) => onProgress?.(step, ++done, steps);

  onProgress?.('Building HTML report', 0, steps);
  reports.file(
    'comparison-report.html',
    await buildHtmlReport(summary, meta, pageCache, ignored, regions),
  );
  tick('HTML report');

  const goldenStem = safeStem(meta.nameA);
  const testStem = safeStem(meta.nameB);

  const a = await annotatePdf(src.docA, annotations, 'A');
  if (a) pdfs.file(`golden__${goldenStem}.pdf`, a);
  tick('Annotated golden PDF');

  const b = await annotatePdf(src.docB, annotations, 'B');
  if (b) pdfs.file(`candidate__${testStem}.pdf`, b);
  tick('Annotated PDF under test');

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  download(`pdf-comparison-bundle-${stamp()}.zip`, blob, 'application/zip');
}
