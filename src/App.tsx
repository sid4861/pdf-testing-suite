import { useEffect } from 'react';
import { useBothLoaded, useCompareStore } from './store/compareStore';
import type { CompareMode } from './types/compare';
import PdfUploadSlot from './components/compare/PdfUploadSlot';
import PageNavigator from './components/compare/PageNavigator';
import ContentCompareView from './components/compare/ContentCompareView';
import LayoutCompareView from './components/compare/LayoutCompareView';
import CompareReport from './components/compare/CompareReport';

const MODE_TABS: [CompareMode, string, string][] = [
  ['content', '📝', 'Content'],
  ['layout', '📐', 'Layout'],
  ['report', '📊', 'Report'],
];

export default function App() {
  const bothLoaded = useBothLoaded();
  const mode = useCompareStore((s) => s.mode);
  const setMode = useCompareStore((s) => s.setMode);
  const currentPage = useCompareStore((s) => s.currentPage);
  const pixelThreshold = useCompareStore((s) => s.pixelThreshold);
  const includeAA = useCompareStore((s) => s.includeAA);
  const computePage = useCompareStore((s) => s.computePage);
  const loadExample = useCompareStore((s) => s.loadExample);
  const loadingExample = useCompareStore((s) => s.loadingExample);

  // Auto-compute the visible page (no-op if already cached).
  useEffect(() => {
    if (bothLoaded && mode !== 'report') {
      computePage(currentPage);
    }
  }, [bothLoaded, mode, currentPage, pixelThreshold, includeAA, computePage]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          🔍 PDF Compare <span className="badge">QA</span>
        </div>
        <div className="upload-row">
          <PdfUploadSlot side="A" label="Side A · Original" hint="Drop the reference PDF" />
          <PdfUploadSlot side="B" label="Side B · Recreated" hint="Drop the generated PDF" />
        </div>
      </header>

      {bothLoaded && (
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
          <div className="spacer" />
          {mode !== 'report' && <PageNavigator />}
        </div>
      )}

      <main className="app-body">
        {!bothLoaded ? (
          <div className="empty-state">
            <div className="icon">📄🆚📄</div>
            <h2>Compare two PDFs</h2>
            <p>
              Upload an <strong>original</strong> (Side A) and a <strong>recreated</strong> (Side B)
              PDF using the slots above. The suite checks text content, pixel-level layout, and exact
              text-position offsets — then lets you export a pass/fail report.
            </p>
            <p style={{ marginTop: 20 }}>
              <button className="btn primary" onClick={loadExample} disabled={loadingExample}>
                {loadingExample ? (
                  <>
                    <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} />
                    Loading…
                  </>
                ) : (
                  'Load example invoices'
                )}
              </button>
            </p>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>
              (Requires the bundled sample PDFs in <code>public/samples/</code>.)
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
    </div>
  );
}
