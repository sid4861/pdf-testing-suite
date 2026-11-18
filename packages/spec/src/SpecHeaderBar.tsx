import { useSpecStore } from './specStore';
import SpecUpload from './SpecUpload';

/**
 * The Specification tab's controls, in the app header beside Export.
 *
 * Siddharth, 2026-11-18: one row, not two. The Compare tab already puts its
 * upload slots in the header once both PDFs are loaded, so this is the
 * shape the app already had — Specification was the one spending a whole
 * row on what fits beside the tabs.
 *
 * It renders nothing until something is loaded, so the empty state keeps
 * its own large drop targets rather than being driven from a strip at the
 * top of the window.
 */
export default function SpecHeaderBar() {
  const pdfDoc = useSpecStore((s) => s.pdfDoc);
  const pdfName = useSpecStore((s) => s.pdfName);
  const loadingPdf = useSpecStore((s) => s.loadingPdf);
  const errorPdf = useSpecStore((s) => s.errorPdf);
  const loadPdfFile = useSpecStore((s) => s.loadPdfFile);
  const clearPdf = useSpecStore((s) => s.clearPdf);

  const spec = useSpecStore((s) => s.spec);
  const specName = useSpecStore((s) => s.specName);
  const loadSpecFile = useSpecStore((s) => s.loadSpecFile);
  const clearSpec = useSpecStore((s) => s.clearSpec);
  const errorSpec = useSpecStore((s) => s.errorSpec);
  const loadingWorkbook = useSpecStore((s) => s.loadingWorkbook);

  const workbookBytes = useSpecStore((s) => s.workbookBytes);
  const report = useSpecStore((s) => s.report);
  const currentPage = useSpecStore((s) => s.currentPage);
  const setPage = useSpecStore((s) => s.setPage);
  const running = useSpecStore((s) => s.running);
  const progress = useSpecStore((s) => s.progress);
  const view = useSpecStore((s) => s.view);
  const setView = useSpecStore((s) => s.setView);

  if (!pdfDoc && !workbookBytes && !report) return null;

  return (
    <div className="spec-headerbar">
      {pdfDoc && spec && (
        <div className="upload-row" style={{ maxWidth: 560 }}>
          <SpecUpload kind="pdf" label="PDF to test" hint="Drop the generated PDF" accept=".pdf,application/pdf"
          name={pdfName} loading={loadingPdf} error={errorPdf} onFile={loadPdfFile} onClear={clearPdf} />
        <SpecUpload kind="spec" label="Spec workbook" hint="Drop an .xlsx or .json" accept=".xlsx,.xlsm,.json,application/json"
          name={specName} loading={loadingWorkbook} error={errorSpec} onFile={loadSpecFile} onClear={clearSpec} />
        </div>
      )}
      {workbookBytes && (
        <div className="tabs" role="group" aria-label="What to show">
          <button
            className={`tab ${view === 'page' ? 'active' : ''}`}
            onClick={() => setView('page')}
            title="The PDF, with what the spec expected drawn on it"
          >
            Page
          </button>
          <button
            className={`tab ${view === 'workbook' ? 'active' : ''}`}
            onClick={() => setView('workbook')}
            title="The workbook, with every refusal on the cell it came from"
          >
            Workbook
          </button>
        </div>
      )}
      <div className="spacer" />
      {running && <span className="summary-chip scanning"><span className="spinner" style={{ width: 12, height: 12 }} /> Checking {progress ? `${progress.current}/${progress.total}` : '…'}</span>}
      {/* Paging lives here, beside Export, the way Compare's does
          (Siddharth, 2026-11-18). The verdict pill went with it: the
          page's own summary and the strip's colour already say how the
          page did, and a count in the header was a third place to read
          the same thing. */}
      {report && report.pages.length > 1 && view === 'page' && (
        <div className="pagenav">
          <button
            className="navbtn"
            disabled={currentPage <= 0}
            onClick={() => setPage(currentPage - 1)}
            title="Previous page"
          >
            ‹
          </button>
          <span className="label">Page {currentPage + 1} of {report.pages.length}</span>
          <button
            className="navbtn"
            disabled={currentPage >= report.pages.length - 1}
            onClick={() => setPage(currentPage + 1)}
            title="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
