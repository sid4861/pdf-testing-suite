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

/**
 * The three tabs (W-06, ruled by Siddharth 2026-11-09).
 *
 * `batch` is **not** one of them any more: comparing many pairs is the same
 * question as comparing one, so it is Compare's *Many* scope rather than a
 * separate place to go. The internal id, the store and the view keep the
 * name `batch` — renaming them would churn a dozen files to no one's
 * benefit, and `FEATURE_BATCH_COMPARE` keeps its key so nobody's `flag.env`
 * silently resets.
 */
export type Workspace = 'compare' | 'spec' | 'measure';

/** Compare's two scopes: one pair, or every pair in two folders. */
export type CompareScope = 'one' | 'many';

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
  // Most-used first, and the order a tester reaches for them: a golden PDF
  // exists → Compare; only a spec exists → Specification; dig into one PDF
  // → Inspect.
  ['compare', 'Compare'],
  ['spec', 'Specification'],
  ['measure', 'Inspect'],
];

/** The scope switch's labels. Two plain words that pair; *bulk* is jargon. */
const SCOPES: [CompareScope, string][] = [
  ['one', 'One'],
  ['many', 'Many'],
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
  if (!wanted) return ALL_TABS;
  return ALL_TABS.filter(([id]) => wanted.includes(id))
    .sort((a, b) => wanted.indexOf(a[0]) - wanted.indexOf(b[0]));
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
  const [scope, setScope] = useState<CompareScope>('one');
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

  const ws: Workspace = workspace;
  // *Many* is behind the same flag the Batch tab was. Folded back here rather
  // than at each use, so turning the flag off cannot strand somebody in a
  // scope that no longer exists.
  const sc: CompareScope = scope === 'many' && !flags.batchCompare ? 'one' : scope;
  const comparingMany = ws === 'compare' && sc === 'many';

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
        {ws === 'compare' && sc === 'one' && bothLoaded && (
          <div className="upload-row">
            <PdfUploadSlot side="A" label="Golden PDF" hint="Drop the golden PDF" />
            <PdfUploadSlot side="B" label="PDF to test" hint="Drop the PDF to test" />
          </div>
        )}
        {/* Every workspace that produces results exports from the same corner.
            Inspect has nothing to export, so it gets no button at all. */}
        {ws !== 'measure' && (
          <div className="header-right">
            {ws === 'compare' && sc === 'one' && <ImportBundleButton />}
            {comparingMany ? (
              <BatchExportMenu />
            ) : ws === 'compare' ? (
              <ExportMenu />
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
      ) : (
        <>
          {/* Compare's own sub-header. The scope switch lives here and is
              shown whether or not anything is loaded — it is how somebody
              gets to *Many* in the first place. */}
          {flags.batchCompare && (
            <div className="subtoolbar scope-bar">
              <div className="tabs" role="group" aria-label="How much to compare">
                {SCOPES.map(([id, label]) => (
                  <button
                    key={id}
                    className={`tab ${sc === id ? 'active' : ''}`}
                    onClick={() => setScope(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="scope-hint">
                {sc === 'one'
                  ? 'One golden PDF against one candidate.'
                  : 'Every pair in two folders — open any pair to look at it on its own.'}
              </span>
            </div>
          )}

          {comparingMany ? (
            // "Open" on a pair loads it here and switches to One, so the two
            // scopes read as one thing rather than two tabs.
            <BatchView onOpenCompare={() => setScope('one')} />
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
        </>
      )}
    </div>
  );
}
