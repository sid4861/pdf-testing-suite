import { useRef, useState } from 'react';
import type { CompareSide } from '../../types/compare';
import { useCompareStore } from '../../store/compareStore';

interface Props {
  side: CompareSide;
  label: string;
  hint: string;
}

export default function PdfUploadSlot({ side, label, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const loaded = useCompareStore((s) => (side === 'A' ? s.sideA : s.sideB));
  const loading = useCompareStore((s) => (side === 'A' ? s.loadingA : s.loadingB));
  const error = useCompareStore((s) => (side === 'A' ? s.errorA : s.errorB));
  const loadFile = useCompareStore((s) => s.loadFile);
  const clearSide = useCompareStore((s) => s.clearSide);

  const cls = side === 'A' ? 'a' : 'b';

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) loadFile(side, file);
  };

  return (
    <div>
      <div
        className={`slot ${cls} ${loaded ? 'loaded' : ''} ${dragging ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (!loaded && !loading) inputRef.current?.click();
        }}
        style={{ cursor: loaded ? 'default' : 'pointer' }}
      >
        <div className="side-tag">{side}</div>

        {loading ? (
          <div className="slot-main" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner" /> <span className="slot-hint">Reading PDF…</span>
          </div>
        ) : loaded ? (
          <>
            <div className="slot-main">
              <div className="slot-label">{label}</div>
              <div className="filename" title={loaded.name}>{loaded.name}</div>
            </div>
            <span className="pagecount">{loaded.pageCount}p</span>
            <button
              className="clear-btn"
              title="Remove"
              onClick={(e) => {
                e.stopPropagation();
                clearSide(side);
              }}
            >
              ×
            </button>
          </>
        ) : (
          <div className="slot-main">
            <div className="slot-label">{label}</div>
            <div className="slot-hint">
              {hint} · <span className="browse">browse</span>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <div className="slot-error">⚠ {error}</div>}
    </div>
  );
}
