import { useEffect, useMemo, useRef, useState } from 'react';
import { useBatchStore } from '../../store/batchStore';
import { flags } from '../../flags';
import {
  exportBatchCsv,
  exportBatchHtml,
  exportBatchJson,
  exportBatchMarkdown,
  type BatchPairExport,
} from '../../services/batchExport';

// Header-mounted twin of the compare workspace's ExportMenu: always on screen
// while the batch workspace is active, disabled until at least one pair has run.
export default function BatchExportMenu() {
  const filesA = useBatchStore((s) => s.filesA);
  const filesB = useBatchStore((s) => s.filesB);
  const pairs = useBatchStore((s) => s.pairs);
  const results = useBatchStore((s) => s.results);

  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const exportPairs: BatchPairExport[] = useMemo(() => {
    const byId = (side: 'A' | 'B', id: string | null) =>
      id ? (side === 'A' ? filesA : filesB).find((f) => f.id === id) ?? null : null;
    let idx = 0;
    const out: BatchPairExport[] = [];
    for (const p of pairs) {
      const r = results[p.id];
      if (!p.aId || !p.bId || !r) continue;
      idx++;
      out.push({
        index: idx,
        aName: byId('A', p.aId)?.name ?? 'Golden PDF',
        bName: byId('B', p.bId)?.name ?? 'PDF tested',
        summary: r.summary,
        pageCache: r.pageCache,
      });
    }
    return out;
  }, [pairs, results, filesA, filesB]);

  // "Clear all" can empty the results while the menu is open.
  useEffect(() => {
    if (exportPairs.length === 0) setMenuOpen(false);
  }, [exportPairs.length]);

  const nothingToExport = exportPairs.length === 0;

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className="btn"
        disabled={nothingToExport || !!exporting}
        onClick={() => setMenuOpen((o) => !o)}
        title={nothingToExport ? 'Run a comparison first — there is nothing to export yet' : 'Export results'}
      >
        {exporting ? (
          <>
            <span className="spinner" style={{ width: 12, height: 12 }} />
            {exporting === 'html' && exportProgress
              ? `Building ${exportProgress.done}/${exportProgress.total}…`
              : 'Exporting…'}
          </>
        ) : (
          '⬇ Export ▾'
        )}
      </button>

      {menuOpen && !nothingToExport && !exporting && (
        <div className="export-dropdown">
          <button
            onClick={async () => {
              setMenuOpen(false);
              setExporting('html');
              setExportProgress({ done: 0, total: exportPairs.length });
              try {
                await exportBatchHtml(exportPairs, (done: number, total: number) =>
                  setExportProgress({ done, total }),
                );
              } finally {
                setExporting(null);
                setExportProgress(null);
              }
            }}
          >
            HTML report
            <small>Overview + every pair's annotated pages</small>
          </button>
          {flags.exportMarkdown && (
            <button
              onClick={() => {
                exportBatchMarkdown(exportPairs);
                setMenuOpen(false);
              }}
            >
              Markdown fix-list
              <small>What to change in the templates · for an AI agent</small>
            </button>
          )}
          {flags.exportJsonCsv && (
            <>
              <button
                onClick={() => {
                  exportBatchJson(exportPairs);
                  setMenuOpen(false);
                }}
              >
                JSON
                <small>All pairs &amp; pages, machine-readable</small>
              </button>
              <button
                onClick={() => {
                  exportBatchCsv(exportPairs);
                  setMenuOpen(false);
                }}
              >
                CSV
                <small>One row per pair × page</small>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
