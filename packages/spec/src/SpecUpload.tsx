import { useRef, useState } from 'react';

/**
 * One drop target in the Specification tab's header.
 *
 * It lived inside `SpecTestView` until the header bar was split out of it
 * (2026-11-18). Two files import it now, so it needs a file; nothing about
 * what it does has changed.
 */
export default function SpecUpload({
  kind,
  label,
  hint,
  accept,
  name,
  loading,
  error,
  onFile,
  onClear,
}: {
  kind: 'pdf' | 'spec';
  label: string;
  hint: string;
  accept: string;
  name: string | null;
  loading?: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <div
        className={`slot ${kind === 'pdf' ? 'a' : 'b'} ${name ? 'loaded' : ''} ${drag ? 'drag' : ''}`}
        onClick={() => !name && !loading && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
        style={{ cursor: name ? 'default' : 'pointer' }}
      >
        <div className="side-tag">{kind === 'pdf' ? '⇩' : '{ }'}</div>
        {loading ? (
          <div className="slot-main" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="spinner" /> <span className="slot-hint">Reading…</span>
          </div>
        ) : name ? (
          <>
            <div className="slot-main">
              <div className="slot-label">{label}</div>
              <div className="filename" title={name}>{name}</div>
            </div>
            <button className="clear-btn" onClick={(e) => { e.stopPropagation(); onClear(); }}>×</button>
          </>
        ) : (
          <div className="slot-main">
            <div className="slot-label">{label}</div>
            <div className="slot-hint">{hint} · <span className="browse">browse</span></div>
          </div>
        )}
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      {error && <div className="slot-error">⚠ {error}</div>}
    </div>
  );
}
