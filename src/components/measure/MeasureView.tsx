import { useEffect, useRef, useState } from 'react';
import { useMeasureStore } from '../../store/measureStore';
import type { ElementsPage, PageElement } from '../../services/pdfElements';

const inches = (pt: number) => (pt / 72).toFixed(2);

// Smallest element whose box contains the point (so a text run wins over a big image).
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
        style={{ minWidth: 260, cursor: pdfName ? 'default' : 'pointer' }}
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

  // Render current page's elements when it changes.
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

  const onMove = (e: React.MouseEvent) => {
    if (!page) return;
    const p = toPoint(e);
    if (!p) return;
    setHovered(elementAt(page.elements, p.px, p.py));
  };
  const onClick = () => setSelected(hovered);

  return (
    <>
      <div className="subtoolbar spec-toolbar">
        <PdfSlot />
        {pdfDoc && pageCount > 1 && (
          <div className="pagenav" style={{ marginLeft: 8 }}>
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
            <div className="icon">📐📄</div>
            <h2>Measure elements on a PDF</h2>
            <p>
              Load a PDF, then <strong>hover</strong> over any text or image to highlight it and
              <strong> click</strong> to measure its distance from the top and left of the page — shown with
              guide lines, in inches.
            </p>
            <p style={{ marginTop: 20 }}>
              <button className="btn primary" onClick={loadExample} disabled={loadingExample}>
                {loadingExample ? (<><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} /> Loading…</>) : 'Load example PDF'}
              </button>
            </p>
          </div>
        ) : computingPage && !page ? (
          <div className="loading-center"><span className="spinner" /> Rendering page…</div>
        ) : page ? (
          <div className="measure-grid">
            <div className="measure-stage">
              <div
                className="measure-wrap"
                ref={wrapRef}
                onMouseMove={onMove}
                onMouseLeave={() => setHovered(null)}
                onClick={onClick}
              >
                <img src={page.dataUrl} alt={`Page ${currentPage + 1}`} draggable={false} />

                {/* hover highlight */}
                {hovered && (!selected || hovered.id !== selected.id) && (
                  <div className="mel hover" style={pctBox(hovered, page)}>
                    <span className="mel-tag">{hovered.kind === 'image' ? '🖼 Image' : hovered.label}</span>
                  </div>
                )}

                {/* selection + guide lines */}
                {selected && (
                  <>
                    {/* horizontal guide: left edge → element, at the element's top */}
                    <div className="guide h" style={{ left: 0, top: `${(selected.top / page.heightPt) * 100}%`, width: `${(selected.left / page.widthPt) * 100}%` }} />
                    {/* vertical guide: top edge → element, at the element's left */}
                    <div className="guide v" style={{ left: `${(selected.left / page.widthPt) * 100}%`, top: 0, height: `${(selected.top / page.heightPt) * 100}%` }} />
                    {/* distance labels */}
                    <div className="guide-label" style={{ left: `${(selected.left / 2 / page.widthPt) * 100}%`, top: `${(selected.top / page.heightPt) * 100}%`, transform: 'translate(-50%, -140%)' }}>
                      ← {inches(selected.left)}″
                    </div>
                    <div className="guide-label" style={{ left: `${(selected.left / page.widthPt) * 100}%`, top: `${(selected.top / 2 / page.heightPt) * 100}%`, transform: 'translate(-115%, -50%)' }}>
                      ↑ {inches(selected.top)}″
                    </div>
                    {/* corner dot + element box */}
                    <div className="guide-dot" style={{ left: `${(selected.left / page.widthPt) * 100}%`, top: `${(selected.top / page.heightPt) * 100}%` }} />
                    <div className="mel selected" style={pctBox(selected, page)} />
                  </>
                )}
              </div>
            </div>

            {/* readout panel */}
            <div className="measure-panel card section-pad">
              {selected ? (
                <>
                  <div className="mp-head">
                    <span className="mp-ic">{selected.kind === 'image' ? '🖼' : '📝'}</span>
                    <div className="mp-title" title={selected.label}>{selected.kind === 'image' ? 'Image' : selected.label}</div>
                  </div>
                  <table className="mp-table">
                    <tbody>
                      <tr><td>From left</td><td>{inches(selected.left)}″</td></tr>
                      <tr><td>From top</td><td>{inches(selected.top)}″</td></tr>
                      <tr className="sep"><td>Width</td><td>{inches(selected.width)}″</td></tr>
                      <tr><td>Height</td><td>{inches(selected.height)}″</td></tr>
                      <tr className="sep"><td>From right</td><td>{inches(page.widthPt - (selected.left + selected.width))}″</td></tr>
                      <tr><td>From bottom</td><td>{inches(page.heightPt - (selected.top + selected.height))}″</td></tr>
                    </tbody>
                  </table>
                  <p className="mp-note">Distances are from the page edges to the element's top-left corner. Page is {inches(page.widthPt)}″ × {inches(page.heightPt)}″.</p>
                </>
              ) : (
                <div className="mp-empty">
                  <b>Hover</b> an element to highlight it, then <b>click</b> to measure its position from the top-left, in inches.
                  {hovered && (
                    <div className="mp-hoverhint">Selecting: <span>{hovered.kind === 'image' ? 'Image' : hovered.label}</span></div>
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
