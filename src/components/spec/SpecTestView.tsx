import { useEffect, useRef, useState } from 'react';
import { useSpecStore } from '../../store/specStore';
import type { Box, ElementResult, SpecPageResult } from '../../types/spec';
import { exportSpecHtml, exportSpecJson } from '../../services/specExport';

const TYPE_ICON: Record<ElementResult['type'], string> = {
  text: '📝',
  image: '🖼️',
  table: '▦',
  paragraph: '¶',
};

function pct(v: number, total: number) {
  return `${(v / total) * 100}%`;
}

function OverlayBox({
  box,
  page,
  kind,
  status,
  active,
}: {
  box: Box;
  page: SpecPageResult;
  kind: 'expected' | 'actual';
  status: ElementResult['status'];
  active: boolean;
}) {
  const color = kind === 'expected' ? 'var(--indigo)' : status === 'pass' ? 'var(--emerald)' : 'var(--red)';
  return (
    <div
      className={`spec-ov ${kind} ${active ? 'active' : ''}`}
      style={{
        left: pct(box.left, page.pageWidthPt),
        top: pct(box.top, page.pageHeightPt),
        width: pct(Math.max(box.width, 2), page.pageWidthPt),
        height: pct(Math.max(box.height, 2), page.pageHeightPt),
        borderColor: color,
      }}
    />
  );
}

// ── upload slot ───────────────────────────────────────────────────────
function SpecUpload({
  kind,
  label,
  hint,
  accept,
  name,
  loading,
  error,
  onFile,
  onClear,
}: {
  kind: 'pdf' | 'spec';
  label: string;
  hint: string;
  accept: string;
  name: string | null;
  loading?: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <div
        className={`slot ${kind === 'pdf' ? 'a' : 'b'} ${name ? 'loaded' : ''} ${drag ? 'drag' : ''}`}
        onClick={() => !name && !loading && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
        style={{ cursor: name ? 'default' : 'pointer' }}
      >
        <div className="side-tag">{kind === 'pdf' ? '⇩' : '{ }'}</div>
        {loading ? (
          <div className="slot-main" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="spinner" /> <span className="slot-hint">Reading…</span>
          </div>
        ) : name ? (
          <>
            <div className="slot-main">
              <div className="slot-label">{label}</div>
              <div className="filename" title={name}>{name}</div>
            </div>
            <button className="clear-btn" onClick={(e) => { e.stopPropagation(); onClear(); }}>×</button>
          </>
        ) : (
          <div className="slot-main">
            <div className="slot-label">{label}</div>
            <div className="slot-hint">{hint} · <span className="browse">browse</span></div>
          </div>
        )}
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      {error && <div className="slot-error">⚠ {error}</div>}
    </div>
  );
}

export default function SpecTestView() {
  const pdfName = useSpecStore((s) => s.pdfName);
  const loadingPdf = useSpecStore((s) => s.loadingPdf);
  const errorPdf = useSpecStore((s) => s.errorPdf);
  const specName = useSpecStore((s) => s.specName);
  const errorSpec = useSpecStore((s) => s.errorSpec);
  const report = useSpecStore((s) => s.report);
  const running = useSpecStore((s) => s.running);
  const progress = useSpecStore((s) => s.progress);
  const currentPage = useSpecStore((s) => s.currentPage);
  const loadingExample = useSpecStore((s) => s.loadingExample);

  const loadPdfFile = useSpecStore((s) => s.loadPdfFile);
  const loadSpecFile = useSpecStore((s) => s.loadSpecFile);
  const clearPdf = useSpecStore((s) => s.clearPdf);
  const clearSpec = useSpecStore((s) => s.clearSpec);
  const run = useSpecStore((s) => s.run);
  const setPage = useSpecStore((s) => s.setPage);
  const loadExample = useSpecStore((s) => s.loadExample);
  const pdfDoc = useSpecStore((s) => s.pdfDoc);
  const spec = useSpecStore((s) => s.spec);

  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-run when both a PDF and a spec are loaded.
  useEffect(() => {
    if (pdfDoc && spec && !report && !running) run();
  }, [pdfDoc, spec, report, running, run]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const page = report?.pages[currentPage];
  const verdictPass = report ? report.totalFail === 0 : false;

  return (
    <>
      <div className="subtoolbar spec-toolbar">
        <div className="upload-row" style={{ maxWidth: 560 }}>
          <SpecUpload kind="pdf" label="PDF to test" hint="Drop the generated PDF" accept=".pdf,application/pdf"
            name={pdfName} loading={loadingPdf} error={errorPdf} onFile={loadPdfFile} onClear={clearPdf} />
          <SpecUpload kind="spec" label="JSON spec" hint="Drop the spec file" accept=".json,application/json"
            name={specName} error={errorSpec} onFile={loadSpecFile} onClear={clearSpec} />
        </div>
        <div className="spacer" />
        {running && <span className="summary-chip scanning"><span className="spinner" style={{ width: 12, height: 12 }} /> Checking {progress ? `${progress.current}/${progress.total}` : '…'}</span>}
        {report && (
          <span className={`summary-chip ${verdictPass ? 'pass' : 'warn'}`}>
            {verdictPass ? '✓' : '✗'} {report.passElements}/{report.elementCount} elements pass
          </span>
        )}
        <div className="export-menu" ref={menuRef}>
          <button className="btn" disabled={!report} onClick={() => setMenuOpen((o) => !o)}>⬇ Export ▾</button>
          {menuOpen && report && (
            <div className="export-dropdown">
              <button onClick={() => { exportSpecHtml(report); setMenuOpen(false); }}>HTML report<small>Annotated pages + checks · print to PDF</small></button>
              <button onClick={() => { exportSpecJson(report); setMenuOpen(false); }}>JSON<small>Full results, machine-readable</small></button>
            </div>
          )}
        </div>
      </div>

      {report && report.pages.length > 1 && (
        <div className="pagestrip">
          <span className="cap">Pages</span>
          <div className="dots">
            {report.pages.map((p, i) => (
              <button
                key={i}
                className={`pdot ${p.failCount === 0 ? 'same' : 'diff'} ${i === currentPage ? 'current' : ''}`}
                title={`Page ${p.page} — ${p.failCount === 0 ? 'all pass' : `${p.failCount} failed`}`}
                onClick={() => setPage(i)}
              >
                {p.page}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="app-body">
        {!pdfDoc || !spec ? (
          <div className="empty-state">
            <div className="icon">📄🆚🧾</div>
            <h2>Test a new page against a spec</h2>
            <p>
              When there's no reference PDF — only a design spec — upload the <strong>generated PDF</strong> and a
              <strong> JSON spec</strong> that describes the expected content and layout (static text, images, tables,
              paragraph spacing) with positions in inches. The checker verifies the PDF against it.
            </p>
            <p style={{ marginTop: 20 }}>
              <button className="btn primary" onClick={loadExample} disabled={loadingExample}>
                {loadingExample ? (<><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} /> Loading…</>) : 'Load example spec + PDF'}
              </button>
            </p>
          </div>
        ) : running && !report ? (
          <div className="loading-center"><span className="spinner" /> Checking the PDF against the spec…</div>
        ) : page ? (
          <div className="spec-grid">
            {/* Rendered page with overlays */}
            <div className="card section-pad">
              <div className="overlay-legend">
                <span><i className="dot exp" /> Expected (spec)</span>
                <span><i className="dot act-pass" /> Actual · pass</span>
                <span><i className="dot act-fail" /> Actual · fail</span>
                <span className="legend-hint">Hover a result to locate it on the page.</span>
              </div>
              {page.dataUrl ? (
                <div className="spec-pagewrap">
                  <img src={page.dataUrl} alt={`Page ${page.page}`} />
                  {page.elements.map((e) => (
                    <div key={e.id}>
                      {e.expectedBox && <OverlayBox box={e.expectedBox} page={page} kind="expected" status={e.status} active={hovered === e.id} />}
                      {e.actualBox && <OverlayBox box={e.actualBox} page={page} kind="actual" status={e.status} active={hovered === e.id} />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="page-missing">Page {page.page} is not present in the PDF.</div>
              )}
            </div>

            {/* Results */}
            <div className="spec-results">
              <div className="spec-summary card section-pad">
                <b>Page {page.page}</b>
                <span className={`chip ${page.failCount === 0 ? 'added' : 'removed'}`}>
                  {page.passCount} passed · {page.failCount} failed
                </span>
              </div>
              {page.elements.map((e) => (
                <div
                  key={e.id}
                  className={`spec-el card ${e.status}`}
                  onMouseEnter={() => setHovered(e.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="spec-el-head">
                    <span className="spec-el-ic">{TYPE_ICON[e.type]}</span>
                    <div className="spec-el-title">
                      <b>{e.label}</b>
                      <small>{e.detail}</small>
                    </div>
                    <span className={`spec-badge ${e.status}`}>
                      {e.status === 'pass' ? 'PASS' : e.status === 'fail' ? 'FAIL' : 'NOT FOUND'}
                    </span>
                  </div>
                  <table className="spec-checks">
                    <tbody>
                      {e.checks.map((c, i) => (
                        <tr key={i} className={c.pass ? 'ok' : 'no'}>
                          <td className="cn">{c.name}</td>
                          <td className="ce">{c.expected}</td>
                          <td className="ca">{c.actual}</td>
                          <td className="cd">{c.delta ?? ''}</td>
                          <td className="ck">{c.pass ? '✓' : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="loading-center">Preparing…</div>
        )}
      </main>
    </>
  );
}
