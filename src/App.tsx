import { useEffect, useState } from 'react';
import { useBothLoaded, useCompareStore, useTotalPages } from './store/compareStore';
import type { CompareMode } from './types/compare';
import PdfUploadSlot from './components/compare/PdfUploadSlot';
import PageNavigator from './components/compare/PageNavigator';
import PageStrip from './components/compare/PageStrip';
import SummaryChip from './components/compare/SummaryChip';
import ContentCompareView from './components/compare/ContentCompareView';
import LayoutCompareView from './components/compare/LayoutCompareView';
import CompareReport from './components/compare/CompareReport';
import ExportMenu from './components/compare/ExportMenu';
import ImportBundleButton from './components/compare/ImportBundleButton';
import BatchExportMenu from './components/batch/BatchExportMenu';
import { flags } from './flags';
// The spec-driven feature is self-contained and worked on separately; this
// barrel is the only thing the app may import from it. See
// src/features/spec/README.md.
import { SpecExportMenu, SpecTestView } from './features/spec';
import MeasureView from './components/measure/MeasureView';
import BatchView from './components/batch/BatchView';

type Workspace = 'compare' | 'spec' | 'measure' | 'batch';

import { AUTO_SCAN_MAX_PAGES } from './services/specConstants';

// Tab order and labels in one place: the header renders straight from this.
const WORKSPACE_TABS: [Workspace, string][] = [
  ['batch', 'Batch compare'],
  ['compare', 'Compare'],
  ['spec', 'Spec driven comparison'],
  ['measure', 'Inspect'],
].filter(([id]) => id !== 'batch' || flags.batchCompare) as [Workspace, string][];

const MODE_TABS: [CompareMode, string, string][] = [
  ['content', '📝', 'Side by side'],
  ['layout', '📐', 'Overlapping'],
  ['report', '📊', 'View report'],
];

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>('compare');
  const bothLoaded = useBothLoaded();
  const mode = useCompareStore((s) => s.mode);
  const setMode = useCompareStore((s) => s.setMode);
  const currentPage = useCompareStore((s) => s.currentPage);
  const pixelThreshold = useCompareStore((s) => s.pixelThreshold);
  const includeAA = useCompareStore((s) => s.includeAA);
  const computePage = useCompareStore((s) => s.computePage);
  const loadExample = useCompareStore((s) => s.loadExample);
  const loadingExample = useCompareStore((s) => s.loadingExample);
  const computeAll = useCompareStore((s) => s.computeAll);
  const summary = useCompareStore((s) => s.summary);
  const computingSummary = useCompareStore((s) => s.computingSummary);
  const totalPages = useTotalPages();

  // Auto-compute the visible page (no-op if already cached).
  useEffect(() => {
    if (bothLoaded && mode !== 'report') {
      computePage(currentPage);
    }
  }, [bothLoaded, mode, currentPage, pixelThreshold, includeAA, computePage]);

  // Background full scan so the chip + strip know which pages differ.
  useEffect(() => {
    if (
      bothLoaded &&
      !summary &&
      !computingSummary &&
      totalPages > 0 &&
      totalPages <= AUTO_SCAN_MAX_PAGES
    ) {
      computeAll();
    }
  }, [bothLoaded, summary, computingSummary, totalPages, computeAll]);

  // The active workspace, with a disabled one folded back to Compare. Guarding
  // here rather than at each use means a flag flip cannot strand the app on a
  // tab that no longer exists.
  const ws: Workspace = workspace === 'batch' && !flags.batchCompare ? 'compare' : workspace;

  return (
    <div className="app">
      <header className="app-header">
        <div className="workspace-tabs">
          {WORKSPACE_TABS.map(([id, label]) => (
            <button
              key={id}
              className={`ws-tab ${ws === id ? 'active' : ''}`}
              onClick={() => setWorkspace(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {ws === 'compare' && bothLoaded && (
          <div className="upload-row">
            <PdfUploadSlot side="A" label="Golden PDF" hint="Drop the golden PDF" />
            <PdfUploadSlot side="B" label="PDF to test" hint="Drop the PDF to test" />
          </div>
        )}
        {/* Every workspace that produces results exports from the same corner.
            Inspect has nothing to export, so it gets no button at all. */}
        {ws !== 'measure' && (
          <div className="header-right">
            {ws === 'compare' && <ImportBundleButton />}
            {ws === 'compare' ? (
              <ExportMenu />
            ) : ws === 'batch' ? (
              <BatchExportMenu />
            ) : (
              <SpecExportMenu />
            )}
          </div>
        )}
      </header>

      {ws === 'spec' ? (
        <SpecTestView />
      ) : ws === 'measure' ? (
        <MeasureView />
      ) : ws === 'batch' ? (
        <BatchView onOpenCompare={() => setWorkspace('compare')} />
      ) : (
        <>
          {bothLoaded && (
            <>
              <div className="subtoolbar">
                <div className="tabs">
                  {MODE_TABS.map(([m, icon, label]) => (
                    <button
                      key={m}
                      className={`tab ${mode === m ? 'active' : ''}`}
                      onClick={() => setMode(m)}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  ))}
                </div>
                <SummaryChip />
                <div className="spacer" />
                {mode !== 'report' && <PageNavigator />}
              </div>
              {mode !== 'report' && <PageStrip />}
            </>
          )}

          <main className="app-body">
            {!bothLoaded ? (
              <div className="empty-state">
                <div className="icon">📄🆚📄</div>
                <h2>Compare two PDFs</h2>
                <p>
                  Drop the <strong>golden PDF</strong> and the <strong>PDF to test</strong> below.
                  The suite checks text content, pixel-level layout, and exact text-position
                  offsets — then lets you export a pass/fail report.
                </p>

                <div className="upload-row stacked">
                  <PdfUploadSlot side="A" label="Golden PDF" hint="Drop the golden PDF" />
                  <PdfUploadSlot side="B" label="PDF to test" hint="Drop the PDF to test" />
                </div>

                <p className="empty-aside">
                  <button className="btn quiet" onClick={loadExample} disabled={loadingExample}>
                    {loadingExample ? (
                      <>
                        <span className="spinner" /> Loading…
                      </>
                    ) : (
                      'or load example PDFs'
                    )}
                  </button>
                </p>
              </div>
            ) : mode === 'content' ? (
              <ContentCompareView />
            ) : mode === 'layout' ? (
              <LayoutCompareView />
            ) : (
              <CompareReport />
            )}
          </main>
        </>
      )}
    </div>
  );
}
