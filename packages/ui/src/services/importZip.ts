// Reading back a bundle produced by exportZip.
//
// The exported PDFs carry their comments as real /Text annotations and leave the
// page content untouched, so re-importing reproduces the original comparison
// exactly — the engine re-derives every difference from the same bytes it saw
// the first time. The HTML report travels along so the Report tab can show the
// run as it was written, rather than a fresh render.

import JSZip from 'jszip';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFString, PDFHexString, PDFNumber } from 'pdf-lib';

import type { CompareSide } from '@pdfsuite/core';
import type { Annotation } from '../store/annotationStore';

export interface ImportedSide {
  name: string;
  bytes: Uint8Array;
}

export interface ImportedBundle {
  /** The exported HTML report, if the archive still has one. */
  html: string | null;
  golden: ImportedSide | null;
  candidate: ImportedSide | null;
  annotations: Annotation[];
}

export class ImportError extends Error {
  // Named so callers can recognise it without a static import — this module
  // pulls in jszip and pdf-lib, and is loaded on demand.
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** `golden__invoice-original.pdf` → `invoice-original.pdf` */
function displayName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const cut = base.indexOf('__');
  return cut === -1 ? base : base.slice(cut + 2);
}

function textOf(v: unknown): string {
  if (v instanceof PDFString || v instanceof PDFHexString) return v.decodeText();
  return '';
}

let seq = 0;
const nextId = () => `imp_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/**
 * Recovers pinned comments from a PDF's /Text annotations.
 *
 * Positions come back from the annotation rectangle's centre, converted to the
 * fraction-of-page, origin-top-left form the app stores.
 */
async function readAnnotations(bytes: Uint8Array, side: CompareSide): Promise<Annotation[]> {
  const out: Annotation[] = [];
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  doc.getPages().forEach((page, pageIndex) => {
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) return;
    const { width, height } = page.getSize();

    for (let i = 0; i < annots.size(); i++) {
      const dict = annots.lookup(i);
      if (!(dict instanceof PDFDict)) continue;
      if (dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Text')) continue;

      const rect = dict.lookup(PDFName.of('Rect'));
      if (!(rect instanceof PDFArray) || rect.size() < 4) continue;
      const n = (k: number) => {
        const v = rect.lookup(k);
        return v instanceof PDFNumber ? v.asNumber() : 0;
      };
      const cx = (n(0) + n(2)) / 2;
      const cy = (n(1) + n(3)) / 2;

      out.push({
        id: nextId(),
        page: pageIndex,
        side,
        x: width ? cx / width : 0,
        // PDF user space runs bottom-up; the app stores top-down fractions.
        y: height ? 1 - cy / height : 0,
        text: textOf(dict.lookup(PDFName.of('Contents'))),
        author: textOf(dict.lookup(PDFName.of('T'))),
        createdAt: new Date().toISOString(),
      });
    }
  });

  return out;
}

export async function readZipBundle(file: File): Promise<ImportedBundle> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new ImportError('That file is not a readable ZIP archive.');
  }

  const paths: string[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir) paths.push(path);
  });

  const htmlPath = paths.find((p) => /\.html?$/i.test(p));
  const html = htmlPath ? await zip.file(htmlPath)!.async('string') : null;

  const pdfPaths = paths.filter((p) => /\.pdf$/i.test(p));
  if (pdfPaths.length === 0) {
    throw new ImportError('No PDFs in this archive — is it a bundle exported from this app?');
  }

  // Exports name the sides explicitly. Older archives did not, so fall back to
  // write order, which has always been golden first.
  const goldenPath = pdfPaths.find((p) => /(^|\/)golden__/i.test(p)) ?? pdfPaths[0];
  const candidatePath =
    pdfPaths.find((p) => /(^|\/)candidate__/i.test(p)) ?? pdfPaths.find((p) => p !== goldenPath) ?? null;

  const read = async (path: string | null): Promise<ImportedSide | null> => {
    if (!path) return null;
    return { name: displayName(path), bytes: await zip.file(path)!.async('uint8array') };
  };

  const golden = await read(goldenPath);
  const candidate = await read(candidatePath);

  const annotations: Annotation[] = [];
  if (golden) annotations.push(...(await readAnnotations(golden.bytes, 'A')));
  if (candidate) annotations.push(...(await readAnnotations(candidate.bytes, 'B')));

  return { html, golden, candidate, annotations };
}
