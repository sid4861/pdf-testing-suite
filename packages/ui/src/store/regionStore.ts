import { create } from 'zustand';
import type { Change } from '@pdfsuite/compare';

/**
 * An ignored region: an area whose changes are expected, accepted in one
 * decision rather than one at a time. A holdings table is the case it exists
 * for — two portfolios differ in every cell by design.
 *
 * It is an ignore of an *area* rather than of a difference, which is why it is
 * keyed on position rather than on content, labelled rather than reasoned, and
 * held against the template so it carries to the next candidate.
 *
 * Coordinates are fractions of the page so they survive zoom and re-render.
 */
export interface DataRegion {
  id: string;
  page: number;
  /** Left/top/width/height as fractions of the page, origin top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** What the area is, e.g. "holdings table". Shown in the report. */
  label: string;
  createdAt: string;
}

interface RegionState {
  /** The golden PDF the declarations below belong to. */
  template: string;
  /** Every template's declarations, so switching candidates keeps them. */
  byTemplate: Record<string, DataRegion[]>;
  /** The active template's regions: a mirror of byTemplate[template]. */
  regions: DataRegion[];
  /** Set while the user is dragging a new region out on a page. */
  drawing: boolean;

  useTemplate: (name: string) => void;
  setDrawing: (on: boolean) => void;
  add: (page: number, rect: { x: number; y: number; w: number; h: number }, label: string) => void;
  rename: (id: string, label: string) => void;
  remove: (id: string) => void;
  clearPage: (page: number) => void;
  clearAll: () => void;
  replaceAll: (regions: DataRegion[]) => void;
}

const newId = () => `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const STORE_KEY = 'pdfsuite.dataRegions.v1';

/** Declaring a region is work worth keeping, so the sets outlive the tab. */
function load(): Record<string, DataRegion[]> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const out = raw ? JSON.parse(raw) : null;
    return out && typeof out === 'object' ? out : {};
  } catch {
    return {};
  }
}

function save(byTemplate: Record<string, DataRegion[]>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(byTemplate));
  } catch {
    // A full or blocked store costs persistence, not the feature.
  }
}

export const useRegionStore = create<RegionState>((set, get) => {
  /** Write one template's list through to both mirrors and to storage. */
  const commit = (regions: DataRegion[], extra: Partial<RegionState> = {}) => {
    const { template, byTemplate } = get();
    const next = { ...byTemplate, [template]: regions };
    save(next);
    set({ regions, byTemplate: next, ...extra });
  };

  return {
    template: '',
    byTemplate: load(),
    regions: [],
    drawing: false,

    useTemplate(name) {
      if (get().template === name) return;
      set({ template: name, regions: get().byTemplate[name] ?? [], drawing: false });
    },

    setDrawing(on) {
      set({ drawing: on });
    },

    add(page, rect, label) {
      commit(
        [
          ...get().regions,
          {
            id: newId(),
            page,
            ...rect,
            label: label.trim() || 'Ignored region',
            createdAt: new Date().toISOString(),
          },
        ],
        // One-shot: drawing one region returns the page to normal interaction.
        { drawing: false },
      );
    },

    rename(id, label) {
      commit(get().regions.map((r) => (r.id === id ? { ...r, label } : r)));
    },

    remove(id) {
      commit(get().regions.filter((r) => r.id !== id));
    },

    clearPage(page) {
      commit(get().regions.filter((r) => r.page !== page));
    },

    clearAll() {
      commit([], { drawing: false });
    },

    replaceAll(regions) {
      commit(regions, { drawing: false });
    },
  };
});

export function regionsFor(regions: DataRegion[], page: number): DataRegion[] {
  return regions.filter((r) => r.page === page);
}

/**
 * The region a change falls into, or null.
 *
 * Tested on the box's centre: a table cell that overhangs its region's edge by a
 * pixel is still part of the table, and demanding full containment would leak
 * those back into the report as phantom differences.
 */
export function regionOf(
  c: Change,
  regions: DataRegion[],
  imgW: number,
  imgH: number,
): DataRegion | null {
  if (regions.length === 0 || !imgW || !imgH) return null;
  const box = c.a ?? c.b;
  if (!box) return null;
  const cx = (box.x + box.w / 2) / imgW;
  const cy = (box.y + box.h / 2) / imgH;
  return (
    regions.find((r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) ?? null
  );
}

/** Split a page's changes into those still under test and those a region ignores. */
export function partitionByRegion(
  changes: Change[],
  regions: DataRegion[],
  imgW: number,
  imgH: number,
): { tested: Change[]; inData: Change[]; perRegion: Map<string, number> } {
  const tested: Change[] = [];
  const inData: Change[] = [];
  const perRegion = new Map<string, number>();

  for (const c of changes) {
    const r = regionOf(c, regions, imgW, imgH);
    if (r) {
      inData.push(c);
      perRegion.set(r.id, (perRegion.get(r.id) ?? 0) + 1);
    } else {
      tested.push(c);
    }
  }

  return { tested, inData, perRegion };
}
