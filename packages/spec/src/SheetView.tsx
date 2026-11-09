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
  useEffect(() => {
    const el = excel.current;
    if (!el || !selected || !loaded.current) return;
    el.select(selected.sheet, selected.range);
  }, [selected]);

  return (
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
      <sheetpane-excel
        ref={excel as never}
        pane={PANE}
        mode="view"
        theme="auto"
      />
      <sheetpane-errors
        ref={errors as never}
        pane={PANE}
      />
    </div>
  );
}
