import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type {
  CompareMode,
  CompareSide,
  CompareSummary,
  LayoutViewMode,
  PageComparison,
  PageSummary,
} from '../types/compare';
import { comparePage, loadPdf } from '../services/pdfCompare';
import { pageHasChange } from '../services/changes';

export interface LoadedSide {
  name: string;
  doc: PDFDocumentProxy;
  pageCount: number;
}

const maxPages = (a: LoadedSide | null, b: LoadedSide | null) =>
  Math.max(a?.pageCount ?? 0, b?.pageCount ?? 0);

interface CompareState {
  // Uploaded sides
  sideA: LoadedSide | null;
  sideB: LoadedSide | null;
  loadingA: boolean;
  loadingB: boolean;
  errorA: string | null;
  errorB: string | null;
  loadFile: (side: CompareSide, file: File) => Promise<void>;
  clearSide: (side: CompareSide) => void;

  // Built-in example
  loadingExample: boolean;
  loadExample: () => Promise<void>;

  // Navigation + mode
  currentPage: number;
  mode: CompareMode;
  setCurrentPage: (i: number) => void;
  setMode: (m: CompareMode) => void;
  jumpScanning: boolean;
  jumpToChange: (dir: 1 | -1) => Promise<void>;

  // Layout controls
  viewMode: LayoutViewMode;
  overlayOpacity: number;
  pixelThreshold: number;
  includeAA: boolean;
  offsetThresholdPx: number;
  layoutZoom: number; // display zoom multiplier for the Layout stage (1 = fit)
  setViewMode: (v: LayoutViewMode) => void;
  setOverlayOpacity: (n: number) => void;
  setPixelThreshold: (n: number) => void;
  setIncludeAA: (b: boolean) => void;
  setOffsetThreshold: (n: number) => void;
  setLayoutZoom: (n: number) => void;

  // Per-page cache
  pageCache: Record<number, PageComparison>;
  computing: boolean;
  computePage: (i: number) => Promise<void>;

  // Report
  summary: CompareSummary | null;
  computingSummary: boolean;
  summaryProgress: { current: number; total: number } | null;
  computeAll: () => Promise<void>;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  sideA: null,
  sideB: null,
  loadingA: false,
  loadingB: false,
  errorA: null,
  errorB: null,

  async loadFile(side, file) {
    const loadingKey = side === 'A' ? 'loadingA' : 'loadingB';
    const errorKey = side === 'A' ? 'errorA' : 'errorB';
    const sideKey = side === 'A' ? 'sideA' : 'sideB';

    set({ [loadingKey]: true, [errorKey]: null } as Partial<CompareState>);
    try {
      const doc = await loadPdf(file);
      set({
        [sideKey]: { name: file.name, doc, pageCount: doc.numPages },
        [loadingKey]: false,
        // Cache invalidation on any side change.
        pageCache: {},
        summary: null,
        currentPage: 0,
      } as Partial<CompareState>);
    } catch (err) {
      set({
        [loadingKey]: false,
        [errorKey]: err instanceof Error ? err.message : 'Failed to read PDF',
      } as Partial<CompareState>);
    }
  },

  clearSide(side) {
    const sideKey = side === 'A' ? 'sideA' : 'sideB';
    const errorKey = side === 'A' ? 'errorA' : 'errorB';
    set({
      [sideKey]: null,
      [errorKey]: null,
      pageCache: {},
      summary: null,
      currentPage: 0,
    } as Partial<CompareState>);
  },

  loadingExample: false,
  async loadExample() {
    set({ loadingExample: true });
    try {
      const base = import.meta.env.BASE_URL;
      const files: [CompareSide, string][] = [
        ['A', `${base}samples/invoice-original.pdf`],
        ['B', `${base}samples/invoice-recreated.pdf`],
      ];
      for (const [side, url] of files) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not fetch ${url}`);
        const blob = await res.blob();
        const name = url.split('/').pop() || 'sample.pdf';
        await get().loadFile(side, new File([blob], name, { type: 'application/pdf' }));
      }
    } catch (err) {
      set({
        errorA: err instanceof Error ? err.message : 'Failed to load example',
      });
    } finally {
      set({ loadingExample: false });
    }
  },

  currentPage: 0,
  mode: 'content',
  setCurrentPage(i) {
    const total = maxPages(get().sideA, get().sideB);
    const clamped = Math.max(0, Math.min(i, Math.max(0, total - 1)));
    set({ currentPage: clamped });
  },
  setMode(m) {
    set({ mode: m });
  },

  jumpScanning: false,
  async jumpToChange(dir) {
    const { sideA, sideB, pixelThreshold, includeAA, offsetThresholdPx } = get();
    const total = maxPages(sideA, sideB);
    if (total <= 1) return;

    set({ jumpScanning: true });
    try {
      let i = get().currentPage;
      for (let step = 0; step < total; step++) {
        i += dir;
        if (i < 0 || i >= total) break; // stop at the ends (no wrap-around)

        let pc = get().pageCache[i];
        if (!pc) {
          pc = await comparePage(sideA?.doc ?? null, sideB?.doc ?? null, i, {
            pixelThreshold,
            includeAA,
          });
          set((s) => ({ pageCache: { ...s.pageCache, [i]: pc! } }));
        }
        if (pageHasChange(pc, offsetThresholdPx)) {
          set({ currentPage: i });
          return;
        }
      }
    } finally {
      set({ jumpScanning: false });
    }
  },

  viewMode: 'side-by-side',
  overlayOpacity: 0.5,
  pixelThreshold: 0.1,
  includeAA: false,
  offsetThresholdPx: 2,
  layoutZoom: 1,
  setViewMode(v) {
    set({ viewMode: v });
  },
  setOverlayOpacity(n) {
    set({ overlayOpacity: n });
  },
  setPixelThreshold(n) {
    set({ pixelThreshold: n, pageCache: {}, summary: null });
  },
  setIncludeAA(b) {
    set({ includeAA: b, pageCache: {}, summary: null });
  },
  setOffsetThreshold(n) {
    set({ offsetThresholdPx: n });
  },
  setLayoutZoom(n) {
    set({ layoutZoom: Math.max(0.25, Math.min(6, n)) });
  },

  pageCache: {},
  computing: false,
  async computePage(i) {
    const { pageCache, sideA, sideB, pixelThreshold, includeAA } = get();
    if (pageCache[i]) return;
    if (!sideA || !sideB) return;

    set({ computing: true });
    try {
      const result = await comparePage(sideA.doc, sideB.doc, i, {
        pixelThreshold,
        includeAA,
      });
      set((s) => ({ pageCache: { ...s.pageCache, [i]: result } }));
    } finally {
      set({ computing: false });
    }
  },

  summary: null,
  computingSummary: false,
  summaryProgress: null,
  async computeAll() {
    const { sideA, sideB, pixelThreshold, includeAA } = get();
    if (!sideA && !sideB) return;

    const total = maxPages(sideA, sideB);
    set({ computingSummary: true, summaryProgress: { current: 0, total } });

    const pages: PageSummary[] = [];
    const newCache: Record<number, PageComparison> = { ...get().pageCache };

    for (let i = 0; i < total; i++) {
      try {
        let pc = newCache[i];
        if (!pc) {
          pc = await comparePage(sideA?.doc ?? null, sideB?.doc ?? null, i, {
            pixelThreshold,
            includeAA,
          });
          newCache[i] = pc;
        }
        const missing = !pc.imageA || !pc.imageB;
        pages.push({
          pageIndex: i,
          contentMatch: pc.contentMatch,
          pixelRatio: pc.pixel?.ratio ?? 0,
          maxOffset: pc.maxOffset,
          missing,
        });
      } catch {
        pages.push({
          pageIndex: i,
          contentMatch: 0,
          pixelRatio: 0,
          maxOffset: 0,
          missing: true,
        });
      }
      set({ summaryProgress: { current: i + 1, total } });
    }

    set({
      pageCache: newCache,
      summary: {
        pages,
        pageCountA: sideA?.pageCount ?? 0,
        pageCountB: sideB?.pageCount ?? 0,
      },
      computingSummary: false,
      summaryProgress: null,
    });
  },
}));

// ── Selector helpers ──────────────────────────────────────────────────
export const useBothLoaded = () =>
  useCompareStore((s) => !!s.sideA && !!s.sideB);
export const useTotalPages = () =>
  useCompareStore((s) => maxPages(s.sideA, s.sideB));
