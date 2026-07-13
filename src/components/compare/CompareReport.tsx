import { useEffect, useRef, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import type { PageSummary } from '../../types/compare';
import {
  exportCsv,
  exportHtmlReport,
  exportJson,
  type ExportThresholds,
} from '../../services/exportReport';

export default function CompareReport() {
  const summary = useCompareStore((s) => s.summary);
  const computingSummary = useCompareStore((s) => s.computingSummary);
  const progress = useCompareStore((s) => s.summaryProgress);
  const computeAll = useCompareStore((s) => s.computeAll);
  const setCurrentPage = useCompareStore((s) => s.setCurrentPage);
  const setMode = useCompareStore((s) => s.setMode);
  const pageCache = useCompareStore((s) => s.pageCache);
  const sideA = useCompareStore((s) => s.sideA);
  const sideB = useCompareStore((s) => s.sideB);

  const [contentPct, setContentPct] = useState(99);
  const [pixelPct, setPixelPct] = useState(2);
  const [offsetPx, setOffsetPx] = useState(3);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const thresholds: ExportThresholds = { contentPct, pixelPct, offsetPx };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const judge = (p: PageSummary) =>
    !p.missing &&
    p.contentMatch * 100 >= contentPct &&
    p.pixelRatio * 100 <= pixelPct &&
    p.maxOffset <= offsetPx;

  const overallPass = summary ? summary.pages.every(judge) : false;

  const meta = {
    nameA: sideA?.name ?? 'Side A',
    nameB: sideB?.name ?? 'Side B',
    pageCountA: sideA?.pageCount ?? 0,
    pageCountB: sideB?.pageCount ?? 0,
    generatedAt: new Date().toISOString(),
  };

  const drillTo = (i: number) => {
    setCurrentPage(i);
    setMode('layout');
  };

  return (
    <div className="stack-col">
      {/* Controls */}
      <div className="card section-pad">
        <div className="report-controls">
          <button className="btn primary" onClick={computeAll} disabled={computingSummary}>
            {computingSummary ? (
              <>
                <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} />
                Comparing {progress?.current}/{progress?.total}…
              </>
            ) : summary ? (
              'Re-run all pages'
            ) : (
              'Compare all pages'
            )}
          </button>

          <div className="thresh-group">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>PASS if</span>
            <label className="thresh">
              content ≥
              <input type="number" value={contentPct} onChange={(e) => setContentPct(Number(e.target.value))} />%
            </label>
            <label className="thresh">
              pixels ≤
              <input type="number" value={pixelPct} onChange={(e) => setPixelPct(Number(e.target.value))} />%
            </label>
            <label className="thresh">
              offset ≤
              <input type="number" value={offsetPx} onChange={(e) => setOffsetPx(Number(e.target.value))} />px
            </label>
          </div>

          <div className="spacer" />

          {summary && (
            <span className={`verdict-badge ${overallPass ? 'pass' : 'fail'}`}>
              {overallPass ? '✓ PASS' : '✗ FAIL'}
            </span>
          )}

          {/* Export menu */}
          <div className="export-menu" ref={menuRef}>
            <button
              className="btn"
              disabled={!summary}
              onClick={() => setMenuOpen((o) => !o)}
              title={summary ? 'Export results' : 'Run a comparison first'}
            >
              ⬇ Export ▾
            </button>
            {menuOpen && summary && (
              <div className="export-dropdown">
                <button
                  onClick={() => {
                    exportHtmlReport(summary, meta, thresholds, pageCache);
                    setMenuOpen(false);
                  }}
                >
                  HTML report
                  <small>Printable, with diff images · Save as PDF</small>
                </button>
                <button
                  onClick={() => {
                    exportJson(summary, meta, thresholds);
                    setMenuOpen(false);
                  }}
                >
                  JSON data
                  <small>Full metrics + verdict, machine-readable</small>
                </button>
                <button
                  onClick={() => {
                    exportCsv(summary, thresholds);
                    setMenuOpen(false);
                  }}
                >
                  CSV spreadsheet
                  <small>Per-page metrics table</small>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {!summary ? (
          <div className="stage-notice">Run a full comparison to see the per-page report.</div>
        ) : (
          <table className="report">
            <thead>
              <tr>
                <th>Page</th>
                <th>Content match</th>
                <th>Pixels different</th>
                <th>Max offset</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {summary.pages.map((p) => {
                const pass = judge(p);
                return (
                  <tr key={p.pageIndex} onClick={() => drillTo(p.pageIndex)} title="Open this page in Layout view">
                    <td>{p.pageIndex + 1}</td>
                    <td>{p.missing ? '—' : `${(p.contentMatch * 100).toFixed(1)}%`}</td>
                    <td>{p.missing ? '—' : `${(p.pixelRatio * 100).toFixed(1)}%`}</td>
                    <td>{p.missing ? '—' : `${Math.round(p.maxOffset)}px`}</td>
                    <td className={p.missing ? '' : pass ? 'res-pass' : 'res-fail'}>
                      {p.missing ? <span className="badge-missing">missing</span> : pass ? '✓' : '✗'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
