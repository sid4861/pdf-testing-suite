import { useEffect, useRef, useState } from 'react';
import { useSpecStore } from './specStore';
import type { Box, ElementResult, SpecPageResult } from './types';

/** What each verdict is called on screen. Never fold one into another: an
 *  unverifiable element is not a failure of the document. */
const STATUS_LABEL: Record<ElementResult['status'], string> = {
  pass: 'PASS',
  fail: 'FAIL',
  'not-found': 'NOT FOUND',
  warning: 'WARNING',
  unverifiable: 'UNVERIFIABLE',
};

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
  const pdfPageCount = useSpecStore((s) => s.pdfPageCount);
  const mode = useSpecStore((s) => s.mode);
  const targetPdfPage = useSpecStore((s) => s.targetPdfPage);
  const targetSpecPage = useSpecStore((s) => s.targetSpecPage);
  const setMode = useSpecStore((s) => s.setMode);
  const setTargetPdfPage = useSpecStore((s) => s.setTargetPdfPage);
  const setTargetSpecPage = useSpecStore((s) => s.setTargetSpecPage);
  const workbook = useSpecStore((s) => s.workbook);
  const loadingWorkbook = useSpecStore((s) => s.loadingWorkbook);
  const activeSheet = useSpecStore((s) => s.activeSheet);
  const sheetNotes = useSpecStore((s) => s.sheetNotes);
  const sheetStats = useSpecStore((s) => s.sheetStats);
  const selectSheet = useSpecStore((s) => s.selectSheet);

  const [hovered, setHovered] = useState<string | null>(null);

  // Auto-run when both a PDF and a spec are loaded.
  useEffect(() => {
    if (pdfDoc && spec && !report && !running) run();
  }, [pdfDoc, spec, report, running, run]);

  const page = report?.pages[currentPage];
  const verdictPass = report ? report.totalFail === 0 : false;

  return (
    <>
      <div className="subtoolbar spec-toolbar">
        {pdfDoc && spec && (
          <div className="upload-row" style={{ maxWidth: 560 }}>
            <SpecUpload kind="pdf" label="PDF to test" hint="Drop the generated PDF" accept=".pdf,application/pdf"
            name={pdfName} loading={loadingPdf} error={errorPdf} onFile={loadPdfFile} onClear={clearPdf} />
          <SpecUpload kind="spec" label="Spec workbook" hint="Drop an .xlsx, .csv or .json" accept=".xlsx,.xlsm,.csv,.json,application/json,text/csv"
            name={specName} loading={loadingWorkbook} error={errorSpec} onFile={loadSpecFile} onClear={clearSpec} />
          </div>
        )}
        <div className="spacer" />
        {running && <span className="summary-chip scanning"><span className="spinner" style={{ width: 12, height: 12 }} /> Checking {progress ? `${progress.current}/${progress.total}` : '…'}</span>}
        {report && (
          <span className={`summary-chip ${verdictPass ? 'pass' : 'warn'}`}>
            {verdictPass ? '✓' : '✗'} {report.passElements}/{report.elementCount} elements pass
          </span>
        )}
      </div>

      {/* A workbook pairs a sheet with a page: the choice on each side is a
          list, so the mapping is read left to right and nothing is implied by a
          number typed into a box. */}
      {pdfDoc && workbook && (
        <div className="sp-pair">
          <div className="card sp-pane">
            <div className="sp-pane-head">
              <span className="sp-cap">Spec sheet</span>
              <span className="sp-sub" title={workbook.name}>{workbook.name}</span>
            </div>
            <div className="sp-list" role="radiogroup" aria-label="Sheet to compare">
              {workbook.sheets.map((sh) => (
                <button
                  key={sh.name}
                  role="radio"
                  aria-checked={sh.name === activeSheet}
                  className={`sp-row ${sh.name === activeSheet ? 'on' : ''}`}
                  onClick={() => selectSheet(sh.name)}
                >
                  <span className="sp-dot" />
                  <span className="sp-name" title={sh.name}>{sh.name}</span>
                  <span className="sp-meta">
                    {sh.rows.length} row{sh.rows.length === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="sp-arrow" aria-hidden="true">→</div>

          <div className="card sp-pane">
            <div className="sp-pane-head">
              <span className="sp-cap">PDF page</span>
              <span className="sp-sub" title={pdfName ?? ''}>{pdfName}</span>
            </div>
            <div className="sp-list" role="radiogroup" aria-label="PDF page to check">
              {Array.from({ length: pdfPageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={n === targetPdfPage}
                  className={`sp-row ${n === targetPdfPage ? 'on' : ''}`}
                  onClick={() => setTargetPdfPage(n)}
                  disabled={!activeSheet}
                >
                  <span className="sp-dot" />
                  <span className="sp-name">Page {n}</span>
                  {report && report.pages[0]?.page === n && (
                    <span className={`sp-meta ${report.totalFail === 0 ? 'ok' : 'no'}`}>
                      {report.totalFail === 0 ? 'all pass' : `${report.totalFail} failed`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* What the sheet gave up on. Shown rather than buried: a converted sheet
          is a first pass over a human document, and a silent gap reads as a
          clean bill of health. */}
      {workbook && activeSheet && sheetStats && (
        <div className="sp-conv">
          <div className="sp-conv-head">
            <b>{activeSheet}</b>
            <span className="chip added">{sheetStats.converted} checkable</span>
            {sheetStats.skipped > 0 && (
              <span className="chip removed">{sheetStats.skipped} skipped</span>
            )}
            <span className="spacer" />
            <span className="sp-sub">
              {spec?.units === 'in' ? 'inches' : spec?.units === 'mm' ? 'millimetres' : 'points'}
              {spec?.pageSize ? ` · page ${spec.pageSize.width} × ${spec.pageSize.height}` : ''}
            </span>
          </div>
          {sheetNotes.length > 0 && (
            <ul className="sp-notes">
              {sheetNotes.map((n, i) => (
                <li key={i} className={n.severity}>
                  <span className="sp-note-where">{n.where}</span> {n.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pdfDoc && spec && !workbook && (
        <div className="spec-target">
          <div className="tabs" role="group" aria-label="What to check">
            <button
              className={`tab ${mode === 'all' ? 'active' : ''}`}
              onClick={() => setMode('all')}
              title="Check every page the spec declares, at the page number it declares"
            >
              All pages
            </button>
            <button
              className={`tab ${mode === 'single' ? 'active' : ''}`}
              onClick={() => setMode('single')}
              title="Check one spec page against one page of this PDF"
            >
              One page
            </button>
          </div>

          {mode === 'all' ? (
            <span className="target-hint">
              Checking {spec.pages.length} spec page{spec.pages.length === 1 ? '' : 's'} at the
              page number{spec.pages.length === 1 ? '' : 's'} the spec declares
              {' '}({spec.pages.map((p) => p.page).join(', ')}).
            </span>
          ) : (
            <>
              <div className="target-pick">
                <span className="target-label">PDF page</span>
                <div className="zoom-group">
                  <button
                    className="zoombtn"
                    onClick={() => setTargetPdfPage(targetPdfPage - 1)}
                    disabled={targetPdfPage <= 1}
                    aria-label="Previous PDF page"
                  >−</button>
                  <input
                    className="target-num"
                    type="number"
                    min={1}
                    max={pdfPageCount}
                    value={targetPdfPage}
                    onChange={(e) => setTargetPdfPage(Number(e.target.value))}
                    aria-label="PDF page to check"
                  />
                  <button
                    className="zoombtn"
                    onClick={() => setTargetPdfPage(targetPdfPage + 1)}
                    disabled={targetPdfPage >= pdfPageCount}
                    aria-label="Next PDF page"
                  >+</button>
                </div>
                <span className="target-of">of {pdfPageCount}</span>
              </div>

              {spec.pages.length > 1 && (
                <div className="target-pick">
                  <span className="target-label">against spec page</span>
                  <select
                    className="target-select"
                    value={targetSpecPage}
                    onChange={(e) => setTargetSpecPage(Number(e.target.value))}
                    aria-label="Spec page to check against"
                  >
                    {spec.pages.map((p, i) => (
                      <option key={i} value={i + 1}>
                        #{i + 1} — declares page {p.page} · {p.elements.length} element
                        {p.elements.length === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <span className="target-map">
                spec page {spec.pages[targetSpecPage - 1]?.page ?? '?'} → PDF page {targetPdfPage}
              </span>
            </>
          )}
        </div>
      )}

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
        {!pdfDoc || (!spec && !workbook) ? (
          <div className="empty-state">
            <div className="icon">📄🆚🧾</div>
            <h2>Test a new page against a spec</h2>
            <p>
              When there's no reference PDF — only a design spec — upload the <strong>generated PDF</strong> and the
              <strong> spec workbook</strong> that describes the expected content and layout (static text, images,
              tables, paragraph spacing) with positions in inches. Pick a sheet and the PDF page it describes, and
              the checker verifies one against the other.
            </p>

            <div className="upload-row stacked">
              <SpecUpload kind="pdf" label="PDF to test" hint="Drop the generated PDF" accept=".pdf,application/pdf"
            name={pdfName} loading={loadingPdf} error={errorPdf} onFile={loadPdfFile} onClear={clearPdf} />
          <SpecUpload kind="spec" label="Spec workbook" hint="Drop an .xlsx, .csv or .json" accept=".xlsx,.xlsm,.csv,.json,application/json,text/csv"
            name={specName} loading={loadingWorkbook} error={errorSpec} onFile={loadSpecFile} onClear={clearSpec} />
            </div>

            <p className="empty-aside">
              <button className="btn quiet" onClick={loadExample} disabled={loadingExample}>
                {loadingExample ? (<><span className="spinner" /> Loading…</>) : 'or load an example spec + PDF'}
              </button>
            </p>
          </div>
        ) : workbook && !activeSheet ? (
          <div className="empty-state sp-compact">
            <div className="icon">▤</div>
            <h2>Pick a sheet to check</h2>
            <p>
              {workbook.sheets.length} sheet{workbook.sheets.length === 1 ? '' : 's'} in{' '}
              <strong>{workbook.name}</strong>. Choose one on the left and the PDF page it describes on
              the right — the check runs as soon as both are set.
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
                <b>PDF page {page.page}</b>
                {page.specPage !== page.page && (
                  <span className="remap-note" title="This spec page was pointed at a different PDF page">
                    spec page {page.specPage} → PDF page {page.page}
                  </span>
                )}
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
                      {STATUS_LABEL[e.status]}
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
