import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { CompareSummary, PageComparison, PageSummary } from '../types/compare';
import { comparePage, loadPdf } from '../services/pdfCompare';

let idCounter = 0;
const nid = () => `x${++idCounter}`;

export interface BatchFile {
  id: string;
  name: string;
  doc: PDFDocumentProxy;
  pageCount: number;
}

export interface BatchPair {
  id: string;
  aId: string | null;
  bId: string | null;
}

export interface BatchPairResult {
  summary: CompareSummary;
  pageCache: Record<number, PageComparison>;
}

export interface BatchThresholds {
  contentPct: number;
  pixelPct: number;
  offsetIn: number;
}

interface BatchState {
  filesA: BatchFile[];
  filesB: BatchFile[];
  loadingA: boolean;
  loadingB: boolean;
  error: string | null;

  pairs: BatchPair[];
  results: Record<string, BatchPairResult>;

  pixelThreshold: number;
  includeAA: boolean;
  thresholds: BatchThresholds;

  running: boolean;
  progress: { pairIndex: number; pairTotal: number; page: number; pageTotal: number } | null;

  loadingExample: boolean;

  addFiles: (side: 'A' | 'B', files: File[]) => Promise<void>;
  removeFile: (side: 'A' | 'B', id: string) => void;
  addPair: () => void;
  setPairSide: (pairId: string, side: 'A' | 'B', fileId: string | null) => void;
  removePair: (pairId: string) => void;
  autoPairByOrder: () => void;
  setThreshold: (key: keyof BatchThresholds, value: number) => void;
  run: () => Promise<void>;
  clearAll: () => void;
  loadExample: () => Promise<void>;
}

async function parseFiles(files: File[]): Promise<BatchFile[]> {
  const out: BatchFile[] = [];
  for (const f of files) {
    try {
      const doc = await loadPdf(f);
      out.push({ id: nid(), name: f.name, doc, pageCount: doc.numPages });
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  filesA: [],
  filesB: [],
  loadingA: false,
  loadingB: false,
  error: null,

  pairs: [],
  results: {},

  pixelThreshold: 0.1,
  includeAA: false,
  thresholds: { contentPct: 99, pixelPct: 2, offsetIn: 0.03 },

  running: false,
  progress: null,

  loadingExample: false,

  async addFiles(side, files) {
    const loadingKey = side === 'A' ? 'loadingA' : 'loadingB';
    set({ [loadingKey]: true, error: null } as Partial<BatchState>);
    const parsed = await parseFiles(files);
    set((s) => ({
      [side === 'A' ? 'filesA' : 'filesB']: [...(side === 'A' ? s.filesA : s.filesB), ...parsed],
      [loadingKey]: false,
    }) as Partial<BatchState>);
  },

  removeFile(side, id) {
    set((s) => {
      const key = side === 'A' ? 'filesA' : 'filesB';
      const pairKey = side === 'A' ? 'aId' : 'bId';
      return {
        [key]: (side === 'A' ? s.filesA : s.filesB).filter((f) => f.id !== id),
        // drop the file from any pair referencing it
        pairs: s.pairs.map((p) => (p[pairKey] === id ? { ...p, [pairKey]: null } : p)),
        results: {},
      } as Partial<BatchState>;
    });
  },

  addPair() {
    set((s) => ({ pairs: [...s.pairs, { id: nid(), aId: null, bId: null }] }));
  },

  setPairSide(pairId, side, fileId) {
    set((s) => {
      const results = { ...s.results };
      delete results[pairId]; // its result is now stale
      return {
        pairs: s.pairs.map((p) => (p.id === pairId ? { ...p, [side === 'A' ? 'aId' : 'bId']: fileId } : p)),
        results,
      };
    });
  },

  removePair(pairId) {
    set((s) => {
      const results = { ...s.results };
      delete results[pairId];
      return { pairs: s.pairs.filter((p) => p.id !== pairId), results };
    });
  },

  autoPairByOrder() {
    const { filesA, filesB } = get();
    const n = Math.min(filesA.length, filesB.length);
    const pairs: BatchPair[] = [];
    for (let i = 0; i < n; i++) pairs.push({ id: nid(), aId: filesA[i].id, bId: filesB[i].id });
    set({ pairs, results: {} });
  },

  setThreshold(key, value) {
    set((s) => ({ thresholds: { ...s.thresholds, [key]: value } }));
  },

  async run() {
    const { pairs, filesA, filesB, pixelThreshold, includeAA } = get();
    const valid = pairs.filter((p) => p.aId && p.bId);
    if (valid.length === 0 || get().running) return;

    set({ running: true, results: {} });
    const results: Record<string, BatchPairResult> = {};

    for (let pi = 0; pi < valid.length; pi++) {
      const pair = valid[pi];
      const a = filesA.find((f) => f.id === pair.aId)!;
      const b = filesB.find((f) => f.id === pair.bId)!;
      const total = Math.max(a.pageCount, b.pageCount);
      const pageCache: Record<number, PageComparison> = {};
      const pages: PageSummary[] = [];

      for (let i = 0; i < total; i++) {
        set({ progress: { pairIndex: pi, pairTotal: valid.length, page: i + 1, pageTotal: total } });
        try {
          const pc = await comparePage(a.doc, b.doc, i, { pixelThreshold, includeAA });
          // Release the raw RGBA buffers (only needed for the diff, already computed) so
          // large batches don't hold hundreds of megabytes. The report uses dataURLs.
          if (pc.imageA) pc.imageA.imageData = undefined;
          if (pc.imageB) pc.imageB.imageData = undefined;
          pageCache[i] = pc;
          pages.push({
            pageIndex: i,
            contentMatch: pc.contentMatch,
            pixelRatio: pc.pixel?.ratio ?? 0,
            maxOffset: pc.maxOffset,
            pxPerInch: pc.pxPerInch,
            missing: !pc.imageA || !pc.imageB,
          });
        } catch {
          pages.push({ pageIndex: i, contentMatch: 0, pixelRatio: 0, maxOffset: 0, pxPerInch: 144, missing: true });
        }
      }

      results[pair.id] = {
        summary: { pages, pageCountA: a.pageCount, pageCountB: b.pageCount },
        pageCache,
      };
      // publish incrementally so the overview fills in as it runs
      set({ results: { ...results } });
    }

    set({ running: false, progress: null });
  },

  clearAll() {
    set({ filesA: [], filesB: [], pairs: [], results: {}, error: null, progress: null });
  },

  async loadExample() {
    set({ loadingExample: true, error: null });
    try {
      const base = import.meta.env.BASE_URL;
      const grab = async (path: string, name: string) => {
        const res = await fetch(`${base}${path}`);
        if (!res.ok) throw new Error(`Could not fetch ${path}`);
        return new File([await res.blob()], name, { type: 'application/pdf' });
      };
      const [aInv, aSpec, bInv, bSpec] = await Promise.all([
        grab('samples/invoice-original.pdf', 'invoice-original.pdf'),
        grab('samples/spec-sample.pdf', 'statement.pdf'),
        grab('samples/invoice-recreated.pdf', 'invoice-recreated.pdf'),
        grab('samples/spec-sample.pdf', 'statement-copy.pdf'),
      ]);
      await get().addFiles('A', [aInv, aSpec]);
      await get().addFiles('B', [bInv, bSpec]);
      get().autoPairByOrder();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load example' });
    } finally {
      set({ loadingExample: false });
    }
  },
}));
