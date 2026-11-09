import { useEffect, useRef, useState } from 'react';
import { useSpecStore } from './specStore';

// Header-mounted twin of the compare workspace's ExportMenu: always on screen
// while the spec workspace is active, disabled until a spec run has produced a report.
export default function SpecExportMenu() {
  const report = useSpecStore((s) => s.report);
  const validation = useSpecStore((s) => s.validation);
  const compiled = useSpecStore((s) => s.compiled);
  const downloadOutput = useSpecStore((s) => s.downloadOutput);
  const downloadRun = useSpecStore((s) => s.downloadRun);
  const downloadBlankTemplate = useSpecStore((s) => s.downloadBlankTemplate);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // The blank template is always on offer: it is what you start from, so
  // gating it on having already uploaded something is backwards.
  const loaded = !!report || !!validation;



  const take = (which: 'validation' | 'annotated' | 'extraction' | 'spec') => () => {
    void downloadOutput(which);
    setMenuOpen(false);
  };
  const takeRun = (which: 'files' | 'fix-list') => () => {
    void downloadRun(which);
    setMenuOpen(false);
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className="btn"
        onClick={() => setMenuOpen((o) => !o)}
        title={loaded ? 'Export results' : 'Download a blank Template v2 workbook to start from'}
      >
        ⬇ Export ▾
      </button>
      {menuOpen && (
        <div className="export-dropdown">
          {!loaded && (
            <>
              <div className="export-head">Start a spec</div>
              <button onClick={() => { void downloadBlankTemplate(); setMenuOpen(false); }}>
                Blank Template v2 workbook
                <small>Pages List, Settings and the Lists vocabulary, ready to fill in</small>
              </button>
            </>
          )}
          {validation && (
            <>
              <div className="export-head">From the workbook</div>
              <button onClick={take('validation')}>
                Validation report
                <small>What was refused, and every assertion in plain words · HTML</small>
              </button>
              <button onClick={take('annotated')}>
                Annotated workbook
                <small>Your .xlsx with the error cells red and a Validation sheet</small>
              </button>
              <button onClick={take('extraction')}>
                Extraction JSON
                <small>Every row: cell, raw text, parsed value, status</small>
              </button>
              <button onClick={take('spec')} disabled={!compiled}>
                Spec JSON
                <small>The assertions only · upload it again as a spec</small>
              </button>
              {report && <div className="export-head">From the check</div>}
            </>
          )}
          {report && (<>
          <button onClick={takeRun('files')}>
            The three files (.zip)
            <small>result.json · report.html · manifest.json</small>
          </button>
          <button onClick={takeRun('fix-list')}>
            Fix list (Markdown)
            <small>What to change, with the cell to change it in</small>
          </button>
          </>)}
        </div>
      )}
    </div>
  );
}
