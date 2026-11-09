import { useEffect, useRef, useState } from 'react';
import { useBothLoaded, useCompareStore, useTotalPages } from './store/compareStore';
import type { CompareMode } from '@pdfsuite/core';
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
import { configureFlags, flags, type FeatureFlags } from './flags';
// Each screen imports its own package and nothing else of another package
// than its public exports (SR-NPM-PACKAGES decision 6).
import { SpecExportMenu, SpecTestView } from '@pdfsuite/spec';
import MeasureView from './components/measure/MeasureView';
import BatchView from './components/batch/BatchView';

import { AUTO_SCAN_MAX_PAGES } from '@pdfsuite/core';

export type Workspace = 'compare' | 'spec' | 'measure' | 'batch';

/**
 * What a host may change without editing a component.
 *
 * Deliberately small, and deliberately all optional: an app that renders
 * `<PdfSuiteApp />` with nothing gets the whole suite with every feature on,
 * which is what somebody installing it expects. Everything here is
 * presentation or availability — nothing in this object can change a
 * comparison's result, because that would be a decision living in the UI
 * package (L3, L4 decision 3).
 */
export interface PdfSuiteConfig {
  /**
   * Which tabs exist, in this order. Omitted means all of them, subject to
   * the flags. A tab named here whose package is not installed is still
   * dropped — naming it cannot conjure the code.
   */
  tabs?: Workspace[];
  /** Which tab opens first. Defaults to the first one shown. */
  initialTab?: Workspace;
  /** Feature flags; anything not named keeps its default, which is on. */
  flags?: Partial<FeatureFlags>;
}

// Tab order and labels in one place: the header renders straight from this.
const ALL_TABS: [Workspace, string][] = [
  ['batch', 'Batch compare'],
  ['compare', 'Compare'],
  ['spec', 'Spec driven comparison'],
  ['measure', 'Inspect'],
];

/**
 * The tabs to show, per render — not per module.
 *
 * It used to be a module constant, which read `flags.batchCompare` while this
 * file was being evaluated. A host configures the flags when the component
 * mounts, which is later, so the constant would have been computed from the
 * defaults every time (W-33).
 */
function workspaceTabs(config: PdfSuiteConfig): [Workspace, string][] {
  const wanted = config.tabs;
  return ALL_TABS.filter(([id]) => {
    if (wanted && !wanted.includes(id)) return false;
    if (id === 'batch' && !flags.batchCompare) return false;
    return true;
  }).sort((a, b) => (wanted ? wanted.indexOf(a[0]) - wanted.indexOf(b[0]) : 0));
}

const MODE_TABS: [CompareMode, string, string][] = [
  ['content', '📝', 'Side by side'],
  ['layout', '📐', 'Overlapping'],
  ['report', '📊', 'View report'],
];

export default function PdfSuiteApp({ config = {} }: { config?: PdfSuiteConfig } = {}) {
  // Before anything else renders: children read `flags` during their own
  // render, which React runs after this one.
  const configured = useRef(false);
  if (!configured.current) {
    configureFlags(config.flags);
    configured.current = true;
  }

  const tabs = workspaceTabs(config);
  const [workspace, setWorkspace] = useState<Workspace>(
    () => config.initialTab ?? tabs[0]?.[0] ?? 'compare',
  );
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

  // The compare store picked its initial view mode when its module was
  // evaluated, before the host had configured anything. If side-by-side is
  // off, move it now — `setViewMode` refuses the other direction, so this
  // cannot fight the user (W-33).
  const setViewMode = useCompareStore((s) => s.setViewMode);
  useEffect(() => {
    if (!flags.layoutSideBySide && useCompareStore.getState().viewMode === 'side-by-side') {
      setViewMode('diff');
    }
  }, [setViewMode]);

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
          {tabs.map(([id, label]) => (
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
