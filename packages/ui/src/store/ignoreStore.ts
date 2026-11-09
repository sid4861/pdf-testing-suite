import { create } from 'zustand';
import { changeRef } from '@pdfsuite/compare';

/**
 * A difference a reviewer has marked as expected.
 *
 * Addressed by `changeRef(page, key)` rather than by the change's id, because
 * ids are assigned per comparison run. The signature survives a re-run, so a
 * decision made once stays made.
 */
export interface IgnoredChange {
  /** `changeRef(page, key)` — the map key as well. */
  ref: string;
  page: number;
  key: string;
  /** The number the difference carried when it was ignored. Display only. */
  label: number;
  /** One line describing what was ignored, kept so the list reads without the PDF. */
  summary: string;
  /** Why it is expected. Optional — a reviewer may just know. */
  reason: string;
  ignoredAt: string;
}

interface IgnoreState {
  ignored: Record<string, IgnoredChange>;
  ignore: (entry: Omit<IgnoredChange, 'ref' | 'ignoredAt'>) => void;
  restore: (ref: string) => void;
  setReason: (ref: string, reason: string) => void;
  clearAll: () => void;
  /** Adopt a set read back from an imported bundle. */
  replaceAll: (entries: IgnoredChange[]) => void;
}

export const useIgnoreStore = create<IgnoreState>((set, get) => ({
  ignored: {},

  ignore(entry) {
    const ref = changeRef(entry.page, entry.key);
    set({
      ignored: {
        ...get().ignored,
        [ref]: { ...entry, ref, ignoredAt: new Date().toISOString() },
      },
    });
  },

  restore(ref) {
    const next = { ...get().ignored };
    delete next[ref];
    set({ ignored: next });
  },

  setReason(ref, reason) {
    const cur = get().ignored[ref];
    if (!cur) return;
    set({ ignored: { ...get().ignored, [ref]: { ...cur, reason } } });
  },

  clearAll() {
    set({ ignored: {} });
  },

  replaceAll(entries) {
    const map: Record<string, IgnoredChange> = {};
    for (const e of entries) map[e.ref] = e;
    set({ ignored: map });
  },
}));

/** The ignored set as a plain list, in the order it will read best: by page. */
export function ignoredList(ignored: Record<string, IgnoredChange>): IgnoredChange[] {
  return Object.values(ignored).sort((a, b) => a.page - b.page || a.label - b.label);
}

/** Refs ignored on one page, for filtering a page's changes. */
export function ignoredRefsFor(ignored: Record<string, IgnoredChange>, page: number): Set<string> {
  const out = new Set<string>();
  for (const e of Object.values(ignored)) if (e.page === page) out.add(e.key);
  return out;
}
