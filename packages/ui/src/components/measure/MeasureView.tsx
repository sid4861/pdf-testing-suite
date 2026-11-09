import { useEffect, useMemo, useRef, useState } from 'react';
import { useMeasureStore } from '../../store/measureStore';
import { inspectPage, type ElementsPage, type InspectedElement, type PageElement } from '@pdfsuite/core';

/**
 * Every number in the panel below comes from `inspectPage` in
 * `@pdfsuite/core` (**W-28**, SR-INSPECT decision 1). It used to be computed
 * here, in JSX, which meant `pdfsuite inspect` could not answer the same
 * question without a second implementation of it — and two implementations
 * of a measurement are two answers (L3).
 *
 * What is still this file's business: hit-testing a click, and turning points
 * into CSS percentages to draw with. Neither is a measurement.
 */

/** Already-rounded inches from the core, shown to two places. */
const inIn = (n: number) => n.toFixed(2);
const fmtPt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

// Smallest element containing the point (a text run wins over a big image).
function elementAt(elements: PageElement[], px: number, py: number): PageElement | null {
  let best: PageElement | null = null;
  let bestArea = Infinity;
  for (const el of elements) {
    if (px >= el.left && px <= el.left + el.width && py >= el.top && py <= el.top + el.height) {
      const area = el.width * el.height;
      if (area < bestArea) {
        bestArea = area;
        best = el;
      }
    }
  }
  return best;
}

/** The core reports three states, not two; so does the panel. */
const WEIGHT = { bold: 'Bold', regular: 'Regular', undeclared: 'not stated' } as const;
const STYLE = { italic: 'Italic', normal: 'Normal', undeclared: 'not stated' } as const;

function pctBox(el: PageElement, page: ElementsPage) {
  return {
    left: `${(el.left / page.widthPt) * 100}%`,
    top: `${(el.top / page.heightPt) * 100}%`,
    width: `${(el.width / page.widthPt) * 100}%`,
    height: `${(el.height / page.heightPt) * 100}%`,
  };
}

// ── upload slot ───────────────────────────────────────────────────────
function PdfSlot() {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const pdfName = useMeasureStore((s) => s.pdfName);
  const loading = useMeasureStore((s) => s.loadingPdf);
  const error = useMeasureStore((s) => s.errorPdf);
  const loadPdfFile = useMeasureStore((s) => s.loadPdfFile);
  const clearPdf = useMeasureStore((s) => s.clearPdf);
  return (
    <div>
      <div
        className={`slot a ${pdfName ? 'loaded' : ''} ${drag ? 'drag' : ''}`}
        style={{ minWidth: 240, cursor: pdfName ? 'default' : 'pointer' }}
        onClick={() => !pdfName && !loading && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) loadPdfFile(e.dataTransfer.files[0]); }}
      >
        <div className="side-tag">📄</div>
        {loading ? (
          <div className="slot-main" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="spinner" /> <span className="slot-hint">Reading…</span>
          </div>
        ) : pdfName ? (
          <>
            <div className="slot-main"><div className="slot-label">PDF</div><div className="filename" title={pdfName}>{pdfName}</div></div>
            <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearPdf(); }}>×</button>
          </>
        ) : (
          <div className="slot-main"><div className="slot-label">PDF to measure</div><div className="slot-hint">Drop a PDF · <span className="browse">browse</span></div></div>
        )}
        <input ref={input} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => e.target.files?.[0] && loadPdfFile(e.target.files[0])} />
      </div>
      {error && <div className="slot-error">⚠ {error}</div>}
    </div>
  );
}

export default function MeasureView() {
  const pdfDoc = useMeasureStore((s) => s.pdfDoc);
  const pageCount = useMeasureStore((s) => s.pageCount);
  const currentPage = useMeasureStore((s) => s.currentPage);
  const page = useMeasureStore((s) => s.pageCache[s.currentPage]);
  const computingPage = useMeasureStore((s) => s.computingPage);
  const setPage = useMeasureStore((s) => s.setPage);
  const ensurePage = useMeasureStore((s) => s.ensurePage);
  const loadExample = useMeasureStore((s) => s.loadExample);
  const loadingExample = useMeasureStore((s) => s.loadingExample);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<PageElement | null>(null);
  const [selected, setSelected] = useState<PageElement | null>(null);

  useEffect(() => {
    if (pdfDoc) ensurePage(currentPage);
  }, [pdfDoc, currentPage, ensurePage]);

  // Reset selection when the page changes.
  useEffect(() => {
    setSelected(null);
    setHovered(null);
  }, [currentPage, pdfDoc]);

  const toPoint = (e: React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    if (!page || rect.width === 0) return null;
    return {
      px: ((e.clientX - rect.left) / rect.width) * page.widthPt,
      py: ((e.clientY - rect.top) / rect.height) * page.heightPt,
    };
  };

  const pool = page ? page.elements : [];

  const onMove = (e: React.MouseEvent) => {
    if (!page) return;
    const p = toPoint(e);
    if (!p) return;
    setHovered(elementAt(pool, p.px, p.py));
  };
  const onClick = () => setSelected(hovered);

  // One call per page, cached: the panel then only looks its selection up.
  const measured = useMemo(
    () => (page ? inspectPage(page, currentPage) : null),
    [page, currentPage],
  );
  const byId = useMemo(() => {
    const m = new Map<string, InspectedElement>();
    for (const el of measured?.elements ?? []) m.set(el.id, el);
    return m;
  }, [measured]);

  const isText = selected != null && selected.kind !== 'image';
  const shown = selected ? byId.get(selected.id) ?? null : null;
  // The neighbouring line is drawn dashed, so the drawing code needs the
  // element itself and not just its id.
  const adjEl = shown?.lineHeight
    ? page?.elements.find((el) => el.id === shown.lineHeight!.neighbourId) ?? null
    : null;

  return (
    <>
      <div className="subtoolbar spec-toolbar">
        {pdfDoc && <PdfSlot />}
        {pdfDoc && pageCount > 1 && (
          <div className="pagenav" style={{ marginLeft: 4 }}>
            <button className="navbtn" disabled={currentPage <= 0} onClick={() => setPage(currentPage - 1)}>‹</button>
            <span className="label">Page {currentPage + 1} of {pageCount}</span>
            <button className="navbtn" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>›</button>
          </div>
        )}
        <div className="spacer" />
        {selected && <button className="btn sm" onClick={() => setSelected(null)}>Clear selection</button>}
      </div>

      <main className="app-body">
        {!pdfDoc ? (
          <div className="empty-state">
            <div className="icon">📐🔤</div>
            <h2>Measure elements on a PDF</h2>
            <p>
              Load a PDF, then <strong>hover</strong> any element to highlight it and <strong>click</strong> to
              select it. One click reports its distance from the page edges in inches, and — for text — its
              font, weight and line height.
            </p>
            <div className="upload-row stacked">
              <PdfSlot />
            </div>

            <p className="empty-aside">
              <button className="btn quiet" onClick={loadExample} disabled={loadingExample}>
                {loadingExample ? (<><span className="spinner" /> Loading…</>) : 'or load example PDF'}
              </button>
            </p>
          </div>
        ) : computingPage && !page ? (
          <div className="loading-center"><span className="spinner" /> Rendering page…</div>
        ) : page ? (
          <div className="measure-grid">
            <div className="measure-stage">
              <div className="measure-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHovered(null)} onClick={onClick}>
                <img src={page.dataUrl} alt={`Page ${currentPage + 1}`} draggable={false} />

                {/* hover highlight */}
                {hovered && (!selected || hovered.id !== selected.id) && (
                  <div className="mel hover" style={pctBox(hovered, page)}>
                    <span className="mel-tag">{hovered.kind === 'image' ? '🖼 Image' : hovered.label}</span>
                  </div>
                )}

                {/* Guides, the measured element, and the neighbouring line used
                    for line height — one selection now answers both questions. */}
                {selected && (
                  <>
                    {adjEl && <div className="mel adjacent" style={pctBox(adjEl, page)} />}
                    <div className="guide h" style={{ left: 0, top: `${(selected.top / page.heightPt) * 100}%`, width: `${(selected.left / page.widthPt) * 100}%` }} />
                    <div className="guide v" style={{ left: `${(selected.left / page.widthPt) * 100}%`, top: 0, height: `${(selected.top / page.heightPt) * 100}%` }} />
                    <div className="guide-label" style={{ left: `${(selected.left / 2 / page.widthPt) * 100}%`, top: `${(selected.top / page.heightPt) * 100}%`, transform: 'translate(-50%, -140%)' }}>← {shown ? inIn(shown.box.fromLeftIn) : '—'}″</div>
                    <div className="guide-label" style={{ left: `${(selected.left / page.widthPt) * 100}%`, top: `${(selected.top / 2 / page.heightPt) * 100}%`, transform: 'translate(-115%, -50%)' }}>↑ {shown ? inIn(shown.box.fromTopIn) : '—'}″</div>
                    <div className="guide-dot" style={{ left: `${(selected.left / page.widthPt) * 100}%`, top: `${(selected.top / page.heightPt) * 100}%` }} />
                    <div className="mel selected" style={pctBox(selected, page)} />
                  </>
                )}
              </div>
            </div>

            {/* readout panel */}
            <div className="measure-panel card section-pad">
              {selected && shown && measured ? (
                <>
                  <div className="mp-head">
                    <span className="mp-ic">{selected.kind === 'image' ? '🖼' : '📝'}</span>
                    <div className="mp-title" title={selected.label}>
                      {selected.kind === 'image' ? 'Image' : selected.label}
                    </div>
                  </div>

                  <div className="mp-sub">Position</div>
                  <table className="mp-table"><tbody>
                    <tr><td>From left</td><td>{inIn(shown.box.fromLeftIn)}″</td></tr>
                    <tr><td>From top</td><td>{inIn(shown.box.fromTopIn)}″</td></tr>
                    <tr className="sep"><td>Width</td><td>{inIn(shown.box.widthIn)}″</td></tr>
                    <tr><td>Height</td><td>{inIn(shown.box.heightIn)}″</td></tr>
                    <tr className="sep"><td>From right</td><td>{inIn(shown.box.fromRightIn)}″</td></tr>
                    <tr><td>From bottom</td><td>{inIn(shown.box.fromBottomIn)}″</td></tr>
                  </tbody></table>

                  {isText && shown.font && (
                    <>
                      <div className="mp-sub">Font &amp; paragraph</div>
                      <table className="mp-table"><tbody>
                        {/* `undeclared` is the core saying nobody stated it,
                            which is not the same as Regular (decision 4). */}
                        <tr><td>Font</td><td className="mp-font">{shown.font.name ?? 'not stated'}</td></tr>
                        <tr><td>Font size</td><td>{fmtPt(shown.font.sizePt)} pt</td></tr>
                        <tr><td>Weight</td><td>{WEIGHT[shown.font.weight]}</td></tr>
                        <tr><td>Style</td><td>{STYLE[shown.font.style]}</td></tr>
                        <tr className="sep">
                          <td>Line height</td>
                          <td>{shown.lineHeight ? `${fmtPt(shown.lineHeight.pt)} pt` : 'single line'}</td>
                        </tr>
                        {shown.lineHeight && (
                          <tr><td>Leading ratio</td><td>{shown.lineHeight.ratio.toFixed(2)}×</td></tr>
                        )}
                      </tbody></table>
                    </>
                  )}

                  <p className="mp-note">
                    Distances run from the page edges to the element's top-left corner. Page is{' '}
                    {inIn(measured.widthIn)}″ × {inIn(measured.heightIn)}″.{' '}
                    {isText
                      ? shown.lineHeight
                        ? 'Line height is the baseline-to-baseline distance to the nearest line in this block, shown dashed.'
                        : 'No adjacent line in this block, so line height cannot be measured.'
                      : ''}
                  </p>
                </>
              ) : (
                <div className="mp-empty">
                  <b>Hover</b> an element to highlight it, then <b>click</b> to read its position
                  in inches — and its font and line height when it is text.
                  {hovered && (
                    <div className="mp-hoverhint">
                      Selecting: <span>{hovered.kind === 'image' ? 'Image' : hovered.label}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="loading-center">Preparing…</div>
        )}
      </main>
    </>
  );
}
