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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const anything = !!report || !!validation;

  useEffect(() => {
    if (!anything) setMenuOpen(false);
  }, [anything]);

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
        disabled={!anything}
        onClick={() => setMenuOpen((o) => !o)}
        title={anything ? 'Export results' : 'Upload a spec workbook first — there is nothing to export yet'}
      >
        ⬇ Export ▾
      </button>
      {menuOpen && anything && (
        <div className="export-dropdown">
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
