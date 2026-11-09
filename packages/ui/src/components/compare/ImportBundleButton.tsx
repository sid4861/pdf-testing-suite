import { useRef, useState } from 'react';

import { useCompareStore } from '../../store/compareStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { loadPdf } from '@pdfsuite/core';

/**
 * Reopens a previously exported ZIP bundle.
 *
 * The two PDFs go back through the normal load path, so the engine re-derives
 * every difference from the same bytes — nothing about the comparison is
 * restored from the archive except the report HTML and the reviewers' comments.
 */
export default function ImportBundleButton() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adoptImported = useCompareStore((s) => s.adoptImported);
  const replaceAnnotations = useAnnotationStore((s) => s.replaceAll);

  const handle = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      // jszip + pdf-lib are ~500KB and only this action needs them.
      const { readZipBundle, ImportError } = await import('../../services/importZip');
      const bundle = await readZipBundle(file);
      if (!bundle.golden || !bundle.candidate) {
        throw new ImportError('This archive needs both PDFs — the golden and the candidate.');
      }

      const asFile = (name: string, bytes: Uint8Array) =>
        new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

      const [docA, docB] = await Promise.all([
        loadPdf(asFile(bundle.golden.name, bundle.golden.bytes)),
        loadPdf(asFile(bundle.candidate.name, bundle.candidate.bytes)),
      ]);

      adoptImported(
        { name: bundle.golden.name, doc: docA, pageCount: docA.numPages },
        { name: bundle.candidate.name, doc: docB, pageCount: docB.numPages },
        bundle.html,
      );
      replaceAnnotations(bundle.annotations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that bundle.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="import-zip">
      <button
        className="btn"
        disabled={busy}
        onClick={() => input.current?.click()}
        title="Reopen a ZIP bundle exported earlier — PDFs, report and comments"
      >
        {busy ? (
          <>
            <span className="spinner" style={{ width: 12, height: 12 }} /> Reading…
          </>
        ) : (
          '⬆ Import ZIP'
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) handle(f);
        }}
      />
      {/* Floated, so a failure message never widens the header. */}
      {error && (
        <div className="import-zip-error" role="alert" onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
