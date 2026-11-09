import { useEffect, useRef, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import { buildHtmlReport, download, stamp, type ExportMeta } from '../../services/exportReport';
import { ignoredList, useIgnoreStore } from '../../store/ignoreStore';
import { useRegionStore } from '../../store/regionStore';

/**
 * The Report tab: the HTML report itself, rendered in place.
 *
 * It lives in a sandboxed iframe rather than being injected into the page — the
 * report ships its own stylesheet with bare-element selectors that would
 * otherwise repaint the whole app.
 */
export default function CompareReport() {
  const summary = useCompareStore((s) => s.summary);
  const computingSummary = useCompareStore((s) => s.computingSummary);
  const progress = useCompareStore((s) => s.summaryProgress);
  const computeAll = useCompareStore((s) => s.computeAll);
  const pageCache = useCompareStore((s) => s.pageCache);
  const sideA = useCompareStore((s) => s.sideA);
  const sideB = useCompareStore((s) => s.sideB);
  const importedHtml = useCompareStore((s) => s.importedReportHtml);
  const ignoredMap = useIgnoreStore((s) => s.ignored);
  const regions = useRegionStore((s) => s.regions);

  const [html, setHtml] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const meta: ExportMeta = {
    nameA: sideA?.name ?? 'Golden PDF',
    nameB: sideB?.name ?? 'PDF to test',
    pageCountA: sideA?.pageCount ?? 0,
    pageCountB: sideB?.pageCount ?? 0,
    generatedAt: new Date().toISOString(),
  };

  // A fresh comparison invalidates the rendered report.
  useEffect(() => {
    setHtml(null);
  }, [summary, pageCache, ignoredMap, regions]);

  // Built once per comparison — it rescales every page image, which is slow
  // enough to be worth not repeating on every render. An imported bundle brings
  // its own report, which is shown as written instead.
  useEffect(() => {
    if (importedHtml || !summary || html !== null) return;
    let cancelled = false;
    setBuilding(true);
    buildHtmlReport(summary, meta, pageCache, ignoredList(ignoredMap), regions)
      .then((out) => {
        if (!cancelled) setHtml(out);
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });
    return () => {
      cancelled = true;
    };
    // meta carries a fresh timestamp each render; the report depends on the
    // comparison, not on when this effect happened to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, pageCache, html, importedHtml, ignoredMap, regions]);

  const printHtml = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  if (computingSummary) {
    return (
      <div className="loading-center">
        <span className="spinner" /> Comparing {progress?.current}/{progress?.total}…
      </div>
    );
  }

  const shown = importedHtml ?? html;

  if (!summary && !importedHtml) {
    return (
      <div className="empty-state">
        <h2>Report</h2>
        <p>Compare every page to produce the report.</p>
        <p style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={computeAll}>
            Compare all pages
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="report-pane card">
      <div className="report-pane-head">
        <strong className="viewer-title">HTML report</strong>
        {importedHtml && <span className="imported-tag">imported</span>}
        <span className="viewer-sub">
          {meta.nameA} vs {meta.nameB}
        </span>
        <div className="spacer" />
        <button className="btn sm" onClick={computeAll} title="Re-compare every page">
          Re-run
        </button>
        <button className="btn sm" onClick={printHtml} disabled={!shown} title="Print, or save as PDF">
          Print
        </button>
        <button
          className="btn sm"
          onClick={() => shown && download(`pdf-comparison-report-${stamp()}.html`, shown, 'text/html')}
          disabled={!shown}
        >
          Download
        </button>
      </div>

      <div className="report-pane-body">
        {building && (
          <div className="loading-center">
            <span className="spinner" /> Building report…
          </div>
        )}
        {!building && shown && (
          <iframe
            ref={frameRef}
            className="viewer-frame"
            title="HTML report"
            srcDoc={shown}
            // No allow-scripts: the report is static, and this keeps text pulled
            // out of the PDFs from ever executing.
            sandbox="allow-same-origin allow-modals allow-popups"
          />
        )}
      </div>
    </div>
  );
}
