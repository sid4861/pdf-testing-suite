import { create } from 'zustand';
import type { CompareSide } from '@pdfsuite/core';

export interface Annotation {
  id: string;
  /** 0-based page index, shared with the compare store's currentPage. */
  page: number;
  side: CompareSide;
  /** Position as a fraction of the rendered page, so it survives zoom changes. */
  x: number;
  y: number;
  text: string;
  author: string;
  createdAt: string;
}

/** Display number, stable per side+page in creation order. */
export type NumberedAnnotation = Annotation & { number: number };

interface AnnotationState {
  annotations: Annotation[];
  /** Set while the user is placing a pin; the page overlay shows a crosshair. */
  placing: boolean;
  /** Annotation whose editor popover is open (a fresh pin opens its own). */
  editingId: string | null;
  author: string;

  setPlacing: (on: boolean) => void;
  setEditing: (id: string | null) => void;
  setAuthor: (name: string) => void;
  add: (page: number, side: CompareSide, x: number, y: number) => string;
  update: (id: string, text: string) => void;
  remove: (id: string) => void;
  clearPage: (page: number) => void;
  /** Adopt a set read back from an imported bundle, discarding what is held. */
  replaceAll: (annotations: Annotation[]) => void;
  clearAll: () => void;
}

const newId = () => `an_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  annotations: [],
  placing: false,
  editingId: null,
  author: '',

  setPlacing(on) {
    set({ placing: on });
  },
  setEditing(id) {
    set({ editingId: id });
  },
  setAuthor(name) {
    set({ author: name });
  },

  add(page, side, x, y) {
    const id = newId();
    const a: Annotation = {
      id,
      page,
      side,
      x,
      y,
      text: '',
      author: get().author,
      createdAt: new Date().toISOString(),
    };
    // Placing is one-shot: dropping a pin returns the page to normal interaction
    // so a stray second click does not add a pin nobody asked for.
    set({ annotations: [...get().annotations, a], editingId: id, placing: false });
    return id;
  },

  update(id, text) {
    set({ annotations: get().annotations.map((a) => (a.id === id ? { ...a, text } : a)) });
  },

  remove(id) {
    set({
      annotations: get().annotations.filter((a) => a.id !== id),
      editingId: get().editingId === id ? null : get().editingId,
    });
  },

  clearPage(page) {
    set({ annotations: get().annotations.filter((a) => a.page !== page), editingId: null });
  },

  clearAll() {
    set({ annotations: [], editingId: null, placing: false });
  },

  replaceAll(annotations) {
    set({ annotations, editingId: null, placing: false });
  },
}));

/** Annotations for one side of one page, numbered in creation order. */
export function numberedFor(
  annotations: Annotation[],
  page: number,
  side: CompareSide,
): NumberedAnnotation[] {
  return annotations
    .filter((a) => a.page === page && a.side === side)
    .map((a, i) => ({ ...a, number: i + 1 }));
}

/** Every annotation for a side, grouped by page — used by the PDF stamper. */
export function bySidePage(annotations: Annotation[], side: CompareSide) {
  const out = new Map<number, NumberedAnnotation[]>();
  for (const a of annotations) {
    if (a.side !== side) continue;
    const list = out.get(a.page) ?? [];
    list.push({ ...a, number: list.length + 1 });
    out.set(a.page, list);
  }
  return out;
}
