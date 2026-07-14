import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { PdfSpec, SpecReport } from '../types/spec';
import { loadPdf, runSpec, validateSpec } from '../services/specCheck';

interface SpecState {
  pdfDoc: PDFDocumentProxy | null;
  pdfName: string | null;
  pdfPageCount: number;
  loadingPdf: boolean;
  errorPdf: string | null;

  spec: PdfSpec | null;
  specName: string | null;
  errorSpec: string | null;

  report: SpecReport | null;
  running: boolean;
  progress: { current: number; total: number } | null;
  currentPage: number; // 0-based index into report.pages / spec.pages

  loadingExample: boolean;

  loadPdfFile: (file: File) => Promise<void>;
  loadSpecFile: (file: File) => Promise<void>;
  loadSpecText: (text: string, name: string) => void;
  clearPdf: () => void;
  clearSpec: () => void;
  run: () => Promise<void>;
  setPage: (i: number) => void;
  loadExample: () => Promise<void>;
}

export const useSpecStore = create<SpecState>((set, get) => ({
  pdfDoc: null,
  pdfName: null,
  pdfPageCount: 0,
  loadingPdf: false,
  errorPdf: null,

  spec: null,
  specName: null,
  errorSpec: null,

  report: null,
  running: false,
  progress: null,
  currentPage: 0,

  loadingExample: false,

  async loadPdfFile(file) {
    set({ loadingPdf: true, errorPdf: null });
    try {
      const doc = await loadPdf(file);
      set({ pdfDoc: doc, pdfName: file.name, pdfPageCount: doc.numPages, loadingPdf: false, report: null, currentPage: 0 });
    } catch (err) {
      set({ loadingPdf: false, errorPdf: err instanceof Error ? err.message : 'Failed to read PDF' });
    }
  },

  async loadSpecFile(file) {
    try {
      const text = await file.text();
      get().loadSpecText(text, file.name);
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Failed to read spec file' });
    }
  },

  loadSpecText(text, name) {
    try {
      const parsed = validateSpec(JSON.parse(text));
      set({ spec: parsed, specName: name, errorSpec: null, report: null, currentPage: 0 });
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Invalid spec JSON' });
    }
  },

  clearPdf() {
    set({ pdfDoc: null, pdfName: null, pdfPageCount: 0, errorPdf: null, report: null, currentPage: 0 });
  },
  clearSpec() {
    set({ spec: null, specName: null, errorSpec: null, report: null, currentPage: 0 });
  },

  async run() {
    const { pdfDoc, spec } = get();
    if (!pdfDoc || !spec || get().running) return;
    set({ running: true, progress: { current: 0, total: spec.pages.length } });
    try {
      const report = await runSpec(pdfDoc, spec, (current, total) => set({ progress: { current, total } }));
      set({ report, running: false, progress: null, currentPage: 0 });
    } catch (err) {
      set({ running: false, progress: null, errorSpec: err instanceof Error ? err.message : 'Check failed' });
    }
  },

  setPage(i) {
    const total = get().report?.pages.length ?? 0;
    set({ currentPage: Math.max(0, Math.min(i, Math.max(0, total - 1))) });
  },

  async loadExample() {
    set({ loadingExample: true });
    try {
      const base = import.meta.env.BASE_URL;
      const [pdfRes, specRes] = await Promise.all([
        fetch(`${base}samples/spec-sample.pdf`),
        fetch(`${base}samples/spec-sample.json`),
      ]);
      if (!pdfRes.ok || !specRes.ok) throw new Error('Could not fetch the bundled spec example.');
      const pdfBlob = await pdfRes.blob();
      const specText = await specRes.text();
      await get().loadPdfFile(new File([pdfBlob], 'spec-sample.pdf', { type: 'application/pdf' }));
      get().loadSpecText(specText, 'spec-sample.json');
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Failed to load example' });
    } finally {
      set({ loadingExample: false });
    }
  },
}));
