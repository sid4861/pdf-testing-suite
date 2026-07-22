// Renders a PDF page and extracts its selectable elements (text runs + images)
// with bounding boxes in POINTS (1/72 inch), top-left origin. Used by the
// Measurements tab. Inches = points / 72.

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { loadPdf } from './pdfCompare'; // reuses worker setup + loader

export { loadPdf };

const BASE_SCALE = 2;

export interface PageElement {
  id: string;
  kind: 'text' | 'image';
  label: string;
  left: number;   // points from left
  top: number;    // points from top
  width: number;  // points
  height: number; // points
}

export interface ElementsPage {
  dataUrl: string;
  widthPt: number;
  heightPt: number;
  elements: PageElement[];
}

export async function renderElements(pdf: PDFDocumentProxy, pageIndex: number): Promise<ElementsPage> {
  const page: PDFPageProxy = await pdf.getPage(pageIndex + 1);
  const vp1 = page.getViewport({ scale: 1 });
  const elements: PageElement[] = [];

  // ── text runs (points, top-left) ──
  const content = await page.getTextContent();
  let ti = 0;
  for (const raw of content.items) {
    const it = raw as { str?: string; width?: number; transform?: number[] };
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    const m = pdfjsLib.Util.transform(vp1.transform, it.transform!);
    const fontHeight = Math.hypot(m[2], m[3]);
    elements.push({
      id: `t${ti++}`,
      kind: 'text',
      label: it.str,
      left: m[4],
      top: m[5] - fontHeight,
      width: it.width ?? 0,
      height: fontHeight,
    });
  }

  // ── images (points, top-left) via operator list ──
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS as Record<string, number>;
  const imgOps = new Set(
    ['paintImageXObject', 'paintImageXObjectRepeat', 'paintJpegXObject', 'paintImageMaskXObject', 'paintInlineImageXObject']
      .map((k) => OPS[k])
      .filter((v) => v != null),
  );
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  let ii = 0;
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i] as number[];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = pdfjsLib.Util.transform(ctm, args);
    else if (imgOps.has(fn)) {
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => pdfjsLib.Util.applyTransform(p, ctm));
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      elements.push({
        id: `i${ii++}`,
        kind: 'image',
        label: 'Image',
        left: minX,
        top: vp1.height - maxY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }
  }

  // ── render for display ──
  const vp = page.getViewport({ scale: BASE_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  return { dataUrl: canvas.toDataURL('image/png'), widthPt: vp1.width, heightPt: vp1.height, elements };
}
