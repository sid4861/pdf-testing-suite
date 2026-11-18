/**
 * The uploaded workbook, as a sheet — W-46 DoD 3 and 4.
 *
 * Arpit: *after upload, not a list of what is wrong — a view that looks and
 * feels like the sheet, with wrong and right highlighted*. The list is still
 * there (it reads better for ten refusals in a row); this puts the same
 * findings back where a person will fix them.
 *
 * `@sheetpane/grid` is two custom elements sharing one in-memory workbook
 * through a `pane` id. Nothing is uploaded — the file is read in the tab —
 * which matters here more than usual: **real spec workbooks never leave the
 * spec machine**, and a sheet viewer that posted the file somewhere would
 * break that whatever its licence said.
 *
 * **React 18 sets attributes, not properties**, and knows nothing about
 * custom events. So the file, the marks and the listeners all go through a
 * ref. React 19 would make most of this a prop; the comment stays until the
 * app moves, because the ref dance looks like superstition without it.
 */

/// <reference path="./types/sheetpane-jsx.d.ts" />
//
// The reference is here and not left to a tsconfig `include`: this package is
// compiled by whoever imports it — the app's tsconfig reaches it through the
// import graph — and an ambient .d.ts that nothing imports is a file only
import { useSpecStore } from './specStore';
// *this* package's own tsconfig would ever load. The tags then exist here and
// not in the app, which is a confusing way to find out.

import { useEffect, useRef } from 'react';

// Registers <sheetpane-excel> and <sheetpane-errors>. Side-effect only, and
// only from this file: `engine.ts` is the headless barrel and must stay
// loadable under Node, where a custom element cannot be defined.
import '@sheetpane/grid';

import { LAYERS, type SheetMark } from './sheetMarks';

/** The slice of `<sheetpane-excel>` this file uses. */
interface SheetpaneExcel extends HTMLElement {
  file?: Uint8Array | Blob | ArrayBuffer | File;
  select(sheet: string, ref: string): void;
  setErrors(list: unknown[], options?: { layer?: string }): void;
  highlight(ranges: string | string[], options?: { sheet?: string; tone?: string; label?: string }): void;
  clearHighlight(): void;
}

interface SheetpaneErrors extends HTMLElement {
  setErrors(list: unknown[], options?: { layer?: string }): void;
  layerNames?: Record<string, string>;
}

export interface SheetViewProps {
  /** The workbook exactly as uploaded. */
  bytes: Uint8Array;
  /** Marks for the `validation` layer — W-02's refusals. */
  validation: SheetMark[];
  /** Marks for the `pdf` layer — W-04's checks. Empty before a run. */
  results: SheetMark[];
  /** A cell the host wants selected, `Sheet!A1`. */
  selected?: { sheet: string; range: string } | null;
  /** The person picked a cell. */
  onSelect?: (at: { sheet: string; range: string }) => void;
}

const PANE = 'pdfsuite-spec';

export default function SheetView({
  bytes, validation, results, selected, onSelect,
}: SheetViewProps) {
  // One switch for both views — see `railOpen` in the store.
  const railOpen = useSpecStore((s) => s.railOpen);
  const setRailOpen = useSpecStore((s) => s.setRailOpen);
  const problemCount = validation.length + results.filter((m) => m.severity !== 'pass').length;

  const excel = useRef<SheetpaneExcel | null>(null);
  const errors = useRef<SheetpaneErrors | null>(null);
  /**
   * Marks are pushed when the file has loaded, not when the props change —
   * a `setErrors` before the sheet has parsed is dropped, and the panel then
   * sits empty with no error anywhere to explain it.
   */
  const loaded = useRef(false);

  // ── the file ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = excel.current;
    if (!el) return;
    loaded.current = false;
    // A copy: the element keeps what it is given, and the store's bytes are
    // also what the annotated-workbook download rebuilds from.
    el.file = bytes.slice();
  }, [bytes]);

  /**
   * What the panel calls each of our types, and what it is allowed to
   * show.
   *
   * Left alone it rendered every row's title as the raw type id —
   * `spec-refused` — which is ours, not sheetpane's, and means nothing to
   * the person reading it. It also showed its *Passed* and *Not checked*
   * counters and its Flag-issue form, neither of which belongs on a screen
   * whose job is "what stops this workbook being checked".
   */
  useEffect(() => {
    const el = errors.current as unknown as
      { errorTypes: unknown; results: string } | null;
    if (!el) return;
    el.errorTypes = [
      { id: 'spec-refused', name: 'Refused — this row yields no check',
        severity: 'error', why: '', expected: '' },
      { id: 'spec-warning', name: 'Checked, with lower confidence',
        severity: 'warning', why: '', expected: '' },
      { id: 'spec-note', name: 'Noted, not checked',
        severity: 'note', why: '', expected: '' },
    ];
    // `off` rather than `summary`: a run produces hundreds of passes, and
    // "82 passed" beside ten refusals buries the ten.
    el.results = 'off';
  }, []);

  // ── the marks, once it has parsed and whenever they change ──────────
  useEffect(() => {
    const el = excel.current;
    if (!el) return;

    const push = () => {
      // Each layer is replaced whole and leaves the other alone, so
      // re-running the check does not clear the validation findings.
      el.setErrors(validation, { layer: 'validation' });
      el.setErrors(results, { layer: 'pdf' });
      if (errors.current) errors.current.layerNames = { ...LAYERS };
    };

    const onLoad = (e: Event) => {
      const detail = (e as CustomEvent<{ status?: string }>).detail;
      if (detail?.status && detail.status !== 'ready') return;
      loaded.current = true;
      push();
    };

    el.addEventListener('sheetpane-load', onLoad);
    if (loaded.current) push();
    return () => el.removeEventListener('sheetpane-load', onLoad);
  }, [validation, results]);

  // ── the person picked a cell ────────────────────────────────────────
  useEffect(() => {
    const el = excel.current;
    if (!el || !onSelect) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ sheet?: string; ref?: string }>).detail;
      if (d?.sheet && d.ref) onSelect({ sheet: d.sheet, range: d.ref });
    };
    el.addEventListener('sheetpane-select', on);
    return () => el.removeEventListener('sheetpane-select', on);
  }, [onSelect]);

  // ── the host asked for a cell ───────────────────────────────────────
  //
  // The request usually arrives *before* the sheet has parsed: clicking a
  // cell in the results switches to this view and mounts this component in
  // the same render, so `loaded` is still false and the select was being
  // dropped on the floor — which left the workbook on its first tab, the
  // Pages List, instead of the page's own sheet. The request is kept and
  // replayed when the file is ready.
  const pending = useRef<{ sheet: string; range: string } | null>(null);
  useEffect(() => {
    const el = excel.current;
    if (!el || !selected) return;
    if (!loaded.current) { pending.current = selected; return; }
    pending.current = null;
    el.select(selected.sheet, selected.range);
  }, [selected]);

  useEffect(() => {
    const el = excel.current;
    if (!el) return;
    const onLoad = (e: Event) => {
      const detail = (e as CustomEvent<{ status?: string }>).detail;
      if (detail?.status && detail.status !== 'ready') return;
      const at = pending.current ?? selected;
      if (!at) return;
      pending.current = null;
      // One frame after the load, so the sheet's own first paint does not
      // land on top of the selection and take the view back to its tab.
      requestAnimationFrame(() => el.select(at.sheet, at.range));
    };
    el.addEventListener('sheetpane-load', onLoad);
    return () => el.removeEventListener('sheetpane-load', onLoad);
  }, [selected]);

  return (
    <div className="sp-sheet-card card">
      {/* The same control the page view has, over the same question: the
          problems panel is a rail that closes, and the sheet takes the
          width it leaves (Siddharth, 2026-11-18). */}
      <div className="layout-controls">
        <span className="legend-hint">The workbook, with every refusal on the cell it came from.</span>
        <div className="spacer" />
        <button
          className={`btn sm view-changes ${railOpen ? 'on' : ''}`}
          onClick={() => setRailOpen(!railOpen)}
          aria-expanded={railOpen}
          title={railOpen ? 'Hide the problems and give the sheet the width'
            : 'Show the problems found in this workbook'}
        >
          <i className="drawer-ico" aria-hidden="true">
            <span />
          </i>
          View problems{problemCount > 0 ? ` · ${problemCount}` : ''}
        </button>
      </div>
    <div className="sp-sheet">
{/* `theme="auto"` follows the page, so the sheet is not a white rectangle
          in a dark app.

          The results level is left at its default, `summary`: a run produces
          hundreds of passes, and a sheet with a tick in every cell says less
          than a sheet with three red ones. The panel's *On sheet* switch is
          how somebody asks for them.

          It is **not** written out as `results="summary"`, which would be
          clearer, because it cannot be: `@types/react` has carried
          `results?: number` on every element since `<output>` had it, so the
          attribute's type collapses to `never` here. Setting it would mean
          going through the ref as a property. */}
      {/* No `className`: React 18 writes it on a custom element as a literal
          `classname=` attribute, which matches no selector. The two are
          styled by tag inside `.sp-sheet`. */}
      {/* `theme="light"`, not `auto`. `auto` follows the OS, and this app
          does not — so on a machine set to dark the sheet rendered dark
          inside a light page. When the app grows a dark mode, this goes
          back to following it. */}
      <sheetpane-excel
        ref={excel as never}
        pane={PANE}
        mode="view"
        theme="light"
      />
      {/* Always mounted, like the page's rail: unmounting it would make
          closing a disappearance rather than a movement. */}
      <div className={`sp-errors-rail ${railOpen ? '' : 'closed'}`} aria-hidden={!railOpen}>
        {/* `readonly` hides the Flag-issue form, Resolve, Accept, Delete,
            Undo and Redo. Nobody authors a finding here: every mark comes
            from the spec engine, and a hand-written one would be a judgment
            this view is not allowed to make (W-46). */}
        <sheetpane-errors
          ref={errors as never}
          pane={PANE}
          readonly
        />
      </div>
    </div>
    </div>
  );
}
