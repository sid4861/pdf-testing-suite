import { create } from 'zustand';

import {
  emptyDoc, newElement, newId,
  type ElementKind, type MockupElement, type MockupPage, type Rect, type SpecDoc,
} from './model';
import { mockupFileName, mockupJson, toWorkbook, workbookFileName } from './toWorkbook';
import { saveFile, MIME } from '../specOutputs';

/**
 * The Create spec canvas's state (W-54).
 *
 * **The mockup is the source of truth** (Siddharth, 2026-11-18). The
 * workbook is derived from it — rebuilt after every change rather than
 * kept alongside and patched — so there is no second copy to drift. That
 * costs a rebuild per edit and buys the one property that matters: what
 * the Workbook view shows is always what the canvas says, with no sync to
 * get wrong.
 *
 * For the same reason the Workbook view is **read-only**. Two editable
 * surfaces over one model means whichever is the source silently
 * overwrites the other, and the person loses work they watched themselves
 * do. To hand-edit, download the `.xlsx` and open it in Specification.
 */

interface CreateState {
  doc: SpecDoc;
  pageIndex: number;
  selected: string | null;
  /** `canvas` draws, `workbook` shows what has been written from it. */
  view: 'canvas' | 'workbook';

  /** The derived workbook. Rebuilt on every change to `doc`. */
  workbookBytes: Uint8Array | null;
  building: boolean;
  error: string | null;

  setView: (view: 'canvas' | 'workbook') => void;
  setPage: (i: number) => void;
  select: (id: string | null) => void;

  addElement: (kind: ElementKind, at?: Rect) => void;
  updateElement: (id: string, patch: Partial<MockupElement>) => void;
  moveElement: (id: string, rect: Rect) => void;
  removeElement: (id: string) => void;
  raise: (id: string, by: number) => void;
  sendTo: (id: string, where: 'front' | 'back') => void;

  addPage: () => void;
  removePage: (i: number) => void;
  patchDoc: (patch: Partial<SpecDoc>) => void;
  patchPage: (patch: Partial<MockupPage>) => void;

  /** Undo and redo, and whether either is available. */
  past: SpecDoc[];
  future: SpecDoc[];
  undo: () => void;
  redo: () => void;
  /** A drag is one undo step, not forty. */
  beginGesture: () => void;
  endGesture: () => void;

  duplicate: (id: string) => void;
  nudge: (id: string, dx: number, dy: number) => void;

  loadMockup: (file: File) => Promise<void>;
  downloadWorkbook: () => Promise<void>;
  downloadMockup: () => void;
}

/** The page a change lands on, with the change applied to its elements. */
const withElements = (
  doc: SpecDoc, pageIndex: number, f: (list: MockupElement[]) => MockupElement[],
): SpecDoc => ({
  ...doc,
  pages: doc.pages.map((p, i) => (i === pageIndex ? { ...p, elements: f(p.elements) } : p)),
});

export const useCreateStore = create<CreateState>((set, get) => {
  /**
   * Rebuild the workbook from the mockup.
   *
   * Debounced by one frame rather than run per keystroke: typing a title
   * would otherwise re-zip the workbook on every character, and nothing
   * reads it until the person looks at the Workbook view.
   */
  let pending: ReturnType<typeof setTimeout> | null = null;
  const rebuild = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      set({ building: true });
      toWorkbook(get().doc)
        .then((bytes) => set({ workbookBytes: bytes, building: false, error: null }))
        .catch((e) => set({
          building: false,
          error: e instanceof Error ? e.message : 'The workbook could not be written',
        }));
    }, 120);
  };

  /**
   * Apply a change, and remember the one before it.
   *
   * A gesture — a drag, a resize — fires a change per pointer move, and
   * forty undo steps to get back across one drag is not undo. So a
   * gesture takes **one** snapshot at its start and suppresses the rest
   * until it ends.
   */
  let gesture: SpecDoc | null = null;
  const change = (doc: SpecDoc) => {
    const before = get().doc;
    if (gesture) {
      set({ doc });
    } else {
      set({ doc, past: [...get().past.slice(-49), before], future: [] });
    }
    rebuild();
  };

  return {
    doc: emptyDoc(),
    past: [],
    future: [],
    pageIndex: 0,
    selected: null,
    view: 'canvas',
    workbookBytes: null,
    building: false,
    error: null,

    setView(view) {
      set({ view });
      if (view === 'workbook' && !get().workbookBytes) rebuild();
    },
    setPage(i) { set({ pageIndex: i, selected: null }); },
    select(id) { set({ selected: id }); },

    addElement(kind, at) {
      const { doc, pageIndex } = get();
      const page = doc.pages[pageIndex];
      const rect = at ?? {
        x: 1, y: 1,
        w: kind === 'text' ? 3 : 2.5,
        h: kind === 'text' ? 0.4 : 1.5,
      };
      const id = newId(doc);
      const el = newElement(kind, id, rect, doc);
      // New things go on top, which is what "add" means on a canvas.
      el.z = page.elements.length;   // the stack is 0..n-1, so this is the top
      el.element = `${kind[0].toUpperCase()}${kind.slice(1)} ${page.elements.length + 1}`;
      change(withElements(doc, pageIndex, (list) => [...list, el]));
      set({ selected: id });
    },

    updateElement(id, patch) {
      const { doc, pageIndex } = get();
      change(withElements(doc, pageIndex, (list) =>
        list.map((e) => (e.id === id ? { ...e, ...patch } as MockupElement : e))));
    },

    moveElement(id, rect) {
      const { doc, pageIndex } = get();
      change(withElements(doc, pageIndex, (list) =>
        list.map((e) => (e.id === id ? { ...e, rect } : e))));
    },

    removeElement(id) {
      const { doc, pageIndex, selected } = get();
      change(withElements(doc, pageIndex, (list) => list.filter((e) => e.id !== id)));
      if (selected === id) set({ selected: null });
    },

    /**
     * Move one element up or down the stack.
     *
     * A **swap with its neighbour**, not `z += 1`. Incrementing produced
     * ties — two elements with the same `z` — and a tie is decided by DOM
     * order, so "bring forward" appeared to do nothing: the list said the
     * text was above the image and the canvas drew it behind. Swapping
     * keeps `z` a strict order, which is what the word means.
     */
    raise(id, by) {
      const { doc, pageIndex } = get();
      change(withElements(doc, pageIndex, (list) => {
        // Normalise first: anything loaded or built elsewhere may carry
        // ties already, and a swap on a tie is a no-op.
        const order = [...list].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
        const i = order.findIndex((e) => e.id === id);
        const j = i + (by > 0 ? 1 : -1);
        if (i < 0 || j < 0 || j >= order.length) {
          return order.map((e, k) => ({ ...e, z: k }));
        }
        [order[i], order[j]] = [order[j], order[i]];
        return order.map((e, k) => ({ ...e, z: k }));
      }));
    },

    /** Straight to the front or the back, which is what people reach for. */
    sendTo(id, where) {
      const { doc, pageIndex } = get();
      change(withElements(doc, pageIndex, (list) => {
        const order = [...list].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
        const el = order.find((e) => e.id === id);
        if (!el) return list;
        const rest = order.filter((e) => e.id !== id);
        const next = where === 'front' ? [...rest, el] : [el, ...rest];
        return next.map((e, k) => ({ ...e, z: k }));
      }));
    },

    addPage() {
      const { doc } = get();
      const tab = String(doc.pages.length + 1);
      change({
        ...doc,
        pages: [...doc.pages, {
          tab, name: `Page ${tab}`, type: 'Required',
          orientation: doc.pages[0]?.orientation ?? 'Landscape', elements: [],
        }],
      });
      set({ pageIndex: doc.pages.length, selected: null });
    },

    removePage(i) {
      const { doc, pageIndex } = get();
      if (doc.pages.length <= 1) return;
      change({ ...doc, pages: doc.pages.filter((_, k) => k !== i) });
      set({ pageIndex: Math.min(pageIndex, doc.pages.length - 2), selected: null });
    },

    undo() {
      const { past, future, doc } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future].slice(0, 50) });
      rebuild();
    },

    redo() {
      const { past, future, doc } = get();
      const next = future[0];
      if (!next) return;
      set({ doc: next, past: [...past, doc].slice(-50), future: future.slice(1) });
      rebuild();
    },

    beginGesture() {
      if (gesture) return;
      gesture = get().doc;
    },

    endGesture() {
      if (!gesture) return;
      const before = gesture;
      gesture = null;
      // Nothing moved — a click that happened to be a drag of 0px.
      if (before === get().doc) return;
      set({ past: [...get().past.slice(-49), before], future: [] });
    },

    /** A copy, offset a quarter inch so it is visibly a second thing. */
    duplicate(id) {
      const { doc, pageIndex } = get();
      const src = doc.pages[pageIndex]?.elements.find((e) => e.id === id);
      if (!src) return;
      const copy = {
        ...src,
        id: newId(doc),
        rect: { ...src.rect, x: src.rect.x + 0.25, y: src.rect.y + 0.25 },
        z: doc.pages[pageIndex].elements.length,
        element: `${src.element} copy`,
      } as MockupElement;
      change(withElements(doc, pageIndex, (list) => [...list, copy]));
      set({ selected: copy.id });
    },

    nudge(id, dx, dy) {
      const { doc, pageIndex } = get();
      change(withElements(doc, pageIndex, (list) => list.map((e) => (e.id === id
        ? { ...e, rect: {
          ...e.rect,
          x: Math.round((e.rect.x + dx) * 100) / 100,
          y: Math.round((e.rect.y + dy) * 100) / 100,
        } }
        : e))));
    },

    patchDoc(patch) { change({ ...get().doc, ...patch }); },

    patchPage(patch) {
      const { doc, pageIndex } = get();
      change({
        ...doc,
        pages: doc.pages.map((p, i) => (i === pageIndex ? { ...p, ...patch } : p)),
      });
    },

    async loadMockup(file) {
      try {
        const doc = JSON.parse(await file.text()) as SpecDoc;
        if (doc?.version !== 1 || !Array.isArray(doc.pages)) {
          throw new Error('That is not a pdfsuite mockup file.');
        }
        set({ pageIndex: 0, selected: null });
        change(doc);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : 'That file could not be read' });
      }
    },

    async downloadWorkbook() {
      const { doc } = get();
      try {
        saveFile(workbookFileName(doc), await toWorkbook(doc), MIME.xlsx);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : 'The workbook could not be written' });
      }
    },

    downloadMockup() {
      const { doc } = get();
      // The only thing that reopens in the canvas: the workbook carries
      // neither the stacking nor the image bytes, by design.
      saveFile(mockupFileName(doc), mockupJson(doc), MIME.json);
    },
  };
});
