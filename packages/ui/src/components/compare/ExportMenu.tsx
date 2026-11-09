import { useEffect, useRef, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import { exportCsv, exportHtmlReport, exportJson } from '../../services/exportReport';
import { exportMarkdownReport } from '../../services/exportMarkdown';
import { useAnnotationStore } from '../../store/annotationStore';
import { ignoredList, useIgnoreStore } from '../../store/ignoreStore';
import { useRegionStore } from '../../store/regionStore';
import { flags } from '../../flags';

// Lives in the app header, so it is on screen in every compare mode — including
// Content and Layout, where there is no report table to hang it off. It stays
// mounted with nothing to export and simply disables itself, which keeps the
// header from reflowing the moment a comparison finishes.
export default function ExportMenu() {
  const summary = useCompareStore((s) => s.summary);
  const pageCache = useCompareStore((s) => s.pageCache);
  const sideA = useCompareStore((s) => s.sideA);
  const sideB = useCompareStore((s) => s.sideB);
  const annotations = useAnnotationStore((s) => s.annotations);
  const ignoredMap = useIgnoreStore((s) => s.ignored);
  const ignored = ignoredList(ignoredMap);
  const regions = useRegionStore((s) => s.regions);
  const downloadResultFiles = useCompareStore((s) => s.downloadResultFiles);

  const [menuOpen, setMenuOpen] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [zipStep, setZipStep] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // A summary can be dropped while the menu is open (loading a new file clears
  // it); close rather than leave a dropdown whose actions would throw.
  useEffect(() => {
    if (!summary) setMenuOpen(false);
  }, [summary]);

  const disabled = !summary || exportingHtml || zipStep !== null;

  const meta = {
    nameA: sideA?.name ?? 'Golden PDF',
    nameB: sideB?.name ?? 'PDF to test',
    pageCountA: sideA?.pageCount ?? 0,
    pageCountB: sideB?.pageCount ?? 0,
    generatedAt: new Date().toISOString(),
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className="btn"
        disabled={disabled}
        onClick={() => setMenuOpen((o) => !o)}
        title={summary ? 'Export results' : 'Compare all pages first — there is nothing to export yet'}
      >
        {exportingHtml || zipStep ? (
          <>
            <span className="spinner" style={{ width: 12, height: 12 }} /> {zipStep ?? 'Building…'}
          </>
        ) : (
          '⬇ Export ▾'
        )}
      </button>

      {menuOpen && summary && (
        <div className="export-dropdown">
          <button
            onClick={async () => {
              setMenuOpen(false);
              setExportingHtml(true);
              try {
                await exportHtmlReport(summary, meta, pageCache, ignored, regions);
              } finally {
                setExportingHtml(false);
              }
            }}
          >
            HTML report
            <small>Printable, with diff images · Save as PDF</small>
          </button>
          {flags.exportMarkdown && (
            <button
              onClick={() => {
                exportMarkdownReport(summary, meta, pageCache, ignored);
                setMenuOpen(false);
              }}
            >
              Markdown fix-list
              <small>What to change in the template · for an AI agent</small>
            </button>
          )}
          <button
            onClick={() => {
              void downloadResultFiles();
              setMenuOpen(false);
            }}
          >
            result.json + manifest.json
            <small>The files `pdfsuite compare` writes, from the same builder</small>
          </button>
          {flags.exportJsonCsv && (
            <>
              <button
                onClick={() => {
                  exportJson(summary, meta);
                  setMenuOpen(false);
                }}
              >
                JSON data (old shape)
                <small>Kept until pipelines move to result.json</small>
              </button>
              <button
                onClick={() => {
                  exportCsv(summary);
                  setMenuOpen(false);
                }}
              >
                CSV spreadsheet
                <small>Per-page metrics table</small>
              </button>
            </>
          )}
          {flags.exportZip && (
            <button
              onClick={async () => {
                setMenuOpen(false);
                setZipStep('Bundling…');
                try {
                  // Lazy: jszip + pdf-lib are ~500KB and only this one
                  // action needs them, so they stay out of the main bundle.
                  const { exportZipBundle } = await import('../../services/exportZip');
                  await exportZipBundle(
                    {
                      summary,
                      meta,
                      pageCache,
                      annotations,
                      ignored,
                      regions,
                      docA: sideA?.doc ?? null,
                      docB: sideB?.doc ?? null,
                    },
                    (step, done, total) => setZipStep(`${step} ${done}/${total}…`),
                  );
                } finally {
                  setZipStep(null);
                }
              }}
            >
              ZIP bundle
              <small>
                Every report + annotated PDFs
                {annotations.length > 0 ? ` · ${annotations.length} comment${annotations.length === 1 ? '' : 's'}` : ''}
              </small>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
