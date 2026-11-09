import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type {
  CompareMode,
  CompareSide,
  CompareSummary,
  LayoutViewMode,
  PageComparison,
} from '@pdfsuite/core';
import { comparePage, loadPdf } from '@pdfsuite/core';
import { comparisonChanged } from '@pdfsuite/compare';
import {
  buildCompareResultJson, comparePair, resultJsonText, sequentialPairs,
  type PagePair, type PairResult,
} from '@pdfsuite/compare';
import { buildManifest, manifestText } from '@pdfsuite/core';
import { flags } from '../flags';

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
  // Adopt already-parsed docs for both sides (used by the batch "Open in Compare" drill-in).
  adoptPair: (a: LoadedSide, b: LoadedSide) => void;

  /**
   * The HTML report that came out of an imported bundle. When set, the Report
   * tab shows it verbatim rather than re-rendering — it is the run as it was
   * written. Any recomputation clears it.
   */
  importedReportHtml: string | null;
  adoptImported: (a: LoadedSide, b: LoadedSide, html: string | null) => void;

  // Built-in example
  loadingExample: boolean;
  loadExample: () => Promise<void>;

  /**
   * Which golden page is compared with which tested page, in order. This is the
   * navigation sequence: `currentPage` indexes into it.
   *
   * Defaults to the straight 1:1 list, so nothing changes until a pairing is
   * edited or auto-aligned.
   */
  pairs: PagePair[];
  /** True once someone paired the pages by hand rather than 1:1. */
  pairsEdited: boolean;
  setPairs: (pairs: PagePair[]) => void;
  resetPairs: () => void;

  // Navigation + mode
  currentPage: number;
  mode: CompareMode;
  setCurrentPage: (i: number) => void;
  setMode: (m: CompareMode) => void;
  jumpScanning: boolean;
  jumpToChange: (dir: 1 | -1) => Promise<void>;

  // Layout controls
  viewMode: LayoutViewMode;
  pixelThreshold: number;
  includeAA: boolean;
  offsetThresholdIn: number; // "moved" flag threshold, in inches
  layoutZoom: number; // display zoom multiplier for the Overlapping stage (1 = fit)
  contentZoom: number; // ditto for Side by side; kept apart so each view holds its own
  setViewMode: (v: LayoutViewMode) => void;
  setPixelThreshold: (n: number) => void;
  setIncludeAA: (b: boolean) => void;
  setOffsetThreshold: (n: number) => void;
  setLayoutZoom: (n: number) => void;
  setContentZoom: (n: number) => void;

  // Per-page cache
  pageCache: Record<number, PageComparison>;
  computing: boolean;
  computePage: (i: number) => Promise<void>;

  // Report
  summary: CompareSummary | null;
  computingSummary: boolean;
  summaryProgress: { current: number; total: number } | null;
  computeAll: () => Promise<void>;
  /**
   * The last run, as the shared core returned it. Kept because the three
   * files are built from it — the summary alone cannot say which knobs were
   * used or which page met which.
   */
  lastResult: PairResult | null;
  /** Download `result.json` and `manifest.json`, the files the CLI writes. */
  downloadResultFiles: () => Promise<void>;
}

/** Hand a file to the browser. The CLI writes the same string to disk. */
function save(name: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      const loaded = { name: file.name, doc, pageCount: doc.numPages };
      const other = side === 'A' ? get().sideB : get().sideA;
      set({
        [sideKey]: loaded,
        [loadingKey]: false,
        // Cache invalidation on any side change. The pairing goes back to 1:1 —
        // the old one named page numbers in a document that is no longer here.
        pairs: sequentialPairs(
          side === 'A' ? loaded.pageCount : other?.pageCount ?? 0,
          side === 'B' ? loaded.pageCount : other?.pageCount ?? 0,
        ),
        pairsEdited: false,
        pageCache: {},
        summary: null,
        currentPage: 0,
        importedReportHtml: null,
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
      pairs: [],
      pairsEdited: false,
      pageCache: {},
      summary: null,
      currentPage: 0,
      importedReportHtml: null,
    } as Partial<CompareState>);
  },

  adoptPair(a, b) {
    set({
      sideA: a,
      sideB: b,
      errorA: null,
      errorB: null,
      pairs: sequentialPairs(a.pageCount, b.pageCount),
      pairsEdited: false,
      pageCache: {},
      summary: null,
      currentPage: 0,
      mode: 'content',
      importedReportHtml: null,
    });
  },

  importedReportHtml: null,
  adoptImported(a, b, html) {
    set({
      sideA: a,
      sideB: b,
      errorA: null,
      errorB: null,
      pairs: sequentialPairs(a.pageCount, b.pageCount),
      pairsEdited: false,
      pageCache: {},
      summary: null,
      currentPage: 0,
      mode: 'content',
      importedReportHtml: html,
    });
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

  pairs: [],
  pairsEdited: false,

  setPairs(pairs) {
    set({
      pairs,
      pairsEdited: true,
      pageCache: {},
      summary: null,
      currentPage: Math.min(get().currentPage, Math.max(0, pairs.length - 1)),
      importedReportHtml: null,
    });
  },

  resetPairs() {
    const { sideA, sideB } = get();
    set({
      pairs: sequentialPairs(sideA?.pageCount ?? 0, sideB?.pageCount ?? 0),
      pairsEdited: false,
      pageCache: {},
      summary: null,
      currentPage: 0,
      importedReportHtml: null,
    });
  },

  currentPage: 0,
  mode: 'content',
  setCurrentPage(i) {
    const total = get().pairs.length || maxPages(get().sideA, get().sideB);
    const clamped = Math.max(0, Math.min(i, Math.max(0, total - 1)));
    set({ currentPage: clamped });
  },
  setMode(m) {
    set({ mode: m });
  },

  jumpScanning: false,
  async jumpToChange(dir) {
    const { sideA, sideB, pixelThreshold, includeAA } = get();
    const total = get().pairs.length || maxPages(sideA, sideB);
    if (total <= 1) return;

    set({ jumpScanning: true });
    try {
      let i = get().currentPage;
      for (let step = 0; step < total; step++) {
        i += dir;
        if (i < 0 || i >= total) break; // stop at the ends (no wrap-around)

        let pc = get().pageCache[i];
        if (!pc) {
          const pair = get().pairs[i];
          pc = await comparePage(sideA?.doc ?? null, sideB?.doc ?? null, i, {
            pixelThreshold,
            includeAA,
            pageIndexA: pair?.a ?? i,
            pageIndexB: pair?.b ?? i,
          });
          set((s) => ({ pageCache: { ...s.pageCache, [i]: pc! } }));
        }
        if (comparisonChanged(pc)) {
          set({ currentPage: i });
          return;
        }
      }
    } finally {
      set({ jumpScanning: false });
    }
  },

  // Without the side-by-side view there is only one Layout view to open on.
  // This is read when the module is evaluated, which is before a host has
  // configured anything — `<PdfSuiteApp>` corrects it at mount (W-33).
  viewMode: flags.layoutSideBySide ? 'side-by-side' : 'diff',
  pixelThreshold: 0.1,
  includeAA: false,
  offsetThresholdIn: 0.02,
  layoutZoom: 1,
  contentZoom: 1,
  setViewMode(v) {
    if (v === 'side-by-side' && !flags.layoutSideBySide) return;
    set({ viewMode: v });
  },
  setPixelThreshold(n) {
    set({ pixelThreshold: n, pageCache: {}, summary: null });
  },
  setIncludeAA(b) {
    set({ includeAA: b, pageCache: {}, summary: null });
  },
  setOffsetThreshold(n) {
    set({ offsetThresholdIn: n });
  },
  setLayoutZoom(n) {
    set({ layoutZoom: Math.max(0.25, Math.min(6, n)) });
  },
  setContentZoom(n) {
    set({ contentZoom: Math.max(0.25, Math.min(6, n)) });
  },

  pageCache: {},
  computing: false,
  async computePage(i) {
    const { pageCache, sideA, sideB, pixelThreshold, includeAA } = get();
    if (pageCache[i]) return;
    if (!sideA || !sideB) return;

    const pair = get().pairs[i];
    set({ computing: true });
    try {
      const result = await comparePage(sideA.doc, sideB.doc, i, {
        pixelThreshold,
        includeAA,
        pageIndexA: pair?.a ?? i,
        pageIndexB: pair?.b ?? i,
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

    const pairs = get().pairs.length
      ? get().pairs
      : sequentialPairs(sideA?.pageCount ?? 0, sideB?.pageCount ?? 0);
    set({ computingSummary: true, summaryProgress: { current: 0, total: pairs.length } });

    // The one loop (W-27). Pages this tab has already compared are handed
    // back to it rather than compared twice.
    const result = await comparePair(sideA?.doc ?? null, sideB?.doc ?? null, {
      pages: pairs,
      pixelThreshold,
      includeAA,
      keepComparisons: true,
      reuse: get().pageCache,
      onProgress: (current, total) => set({ summaryProgress: { current, total } }),
    });

    const pageCache: Record<number, PageComparison> = { ...get().pageCache };
    for (const page of result.pages) {
      if (page.comparison) pageCache[page.pageIndex] = page.comparison;
    }

    set({
      pageCache,
      summary: result.summary,
      lastResult: result,
      computingSummary: false,
      summaryProgress: null,
    });
  },

  lastResult: null,

  async downloadResultFiles() {
    const { lastResult, sideA, sideB } = get();
    if (!lastResult) return;

    const result = await buildCompareResultJson(lastResult, {
      ...(sideA ? { golden: { name: sideA.name, bytes: null, sha256: null } } : {}),
      ...(sideB ? { candidate: { name: sideB.name, bytes: null, sha256: null } } : {}),
      arguments: ['Compare tab'],
    });
    const json = resultJsonText(result);

    // Written last, over the final bytes of the other file (SR-MANIFEST
    // decision 2). The app writes two of the three; the HTML report is still
    // the tab's own until W-27 DoD 4 finishes it.
    const manifest = await buildManifest([
      ...result.inputs.map((i) => ({
        name: i.name, role: 'input' as const, bytes: i.bytes ?? 0, sha256: i.sha256,
      })),
      { name: 'result.json', role: 'output' as const, data: json },
    ]);

    save('result.json', json, 'application/json');
    save('manifest.json', manifestText(manifest), 'application/json');
  },
}));

// ── Selector helpers ──────────────────────────────────────────────────
export const useBothLoaded = () =>
  useCompareStore((s) => !!s.sideA && !!s.sideB);
export const useTotalPages = () =>
  useCompareStore((s) => s.pairs.length || maxPages(s.sideA, s.sideB));
