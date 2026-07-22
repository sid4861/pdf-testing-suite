import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { ElementsPage } from '../services/pdfElements';
import { loadPdf, renderElements } from '../services/pdfElements';

interface MeasureState {
  pdfDoc: PDFDocumentProxy | null;
  pdfName: string | null;
  pageCount: number;
  loadingPdf: boolean;
  errorPdf: string | null;

  currentPage: number; // 0-based
  pageCache: Record<number, ElementsPage>;
  computingPage: boolean;

  loadingExample: boolean;

  loadPdfFile: (file: File) => Promise<void>;
  clearPdf: () => void;
  setPage: (i: number) => void;
  ensurePage: (i: number) => Promise<void>;
  loadExample: () => Promise<void>;
}

export const useMeasureStore = create<MeasureState>((set, get) => ({
  pdfDoc: null,
  pdfName: null,
  pageCount: 0,
  loadingPdf: false,
  errorPdf: null,

  currentPage: 0,
  pageCache: {},
  computingPage: false,

  loadingExample: false,

  async loadPdfFile(file) {
    set({ loadingPdf: true, errorPdf: null });
    try {
      const doc = await loadPdf(file);
      set({
        pdfDoc: doc,
        pdfName: file.name,
        pageCount: doc.numPages,
        loadingPdf: false,
        pageCache: {},
        currentPage: 0,
      });
    } catch (err) {
      set({ loadingPdf: false, errorPdf: err instanceof Error ? err.message : 'Failed to read PDF' });
    }
  },

  clearPdf() {
    set({ pdfDoc: null, pdfName: null, pageCount: 0, errorPdf: null, pageCache: {}, currentPage: 0 });
  },

  setPage(i) {
    const total = get().pageCount;
    set({ currentPage: Math.max(0, Math.min(i, Math.max(0, total - 1))) });
  },

  async ensurePage(i) {
    const { pdfDoc, pageCache, computingPage } = get();
    // Guard against concurrent renders of the same page (e.g. React StrictMode
    // double-invoking the effect) — pdf.js can deadlock on overlapping work.
    if (!pdfDoc || pageCache[i] || computingPage) return;
    set({ computingPage: true });
    try {
      const page = await renderElements(pdfDoc, i);
      set((s) => ({ pageCache: { ...s.pageCache, [i]: page } }));
    } finally {
      set({ computingPage: false });
    }
  },

  async loadExample() {
    set({ loadingExample: true });
    try {
      const base = import.meta.env.BASE_URL;
      const res = await fetch(`${base}samples/spec-sample.pdf`);
      if (!res.ok) throw new Error('Could not fetch the sample PDF.');
      const blob = await res.blob();
      await get().loadPdfFile(new File([blob], 'spec-sample.pdf', { type: 'application/pdf' }));
    } catch (err) {
      set({ errorPdf: err instanceof Error ? err.message : 'Failed to load example' });
    } finally {
      set({ loadingExample: false });
    }
  },
}));
