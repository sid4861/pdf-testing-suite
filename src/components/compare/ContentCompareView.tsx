import { useMemo, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import type { CompareSide, RenderedPageImage } from '../../types/compare';
import { buildChanges, isOnSide, region, TYPE_LABEL, type Change } from '../../services/changes';

function scoreClass(m: number): string {
  if (m >= 0.999) return 'good';
  if (m >= 0.9) return 'warn';
  return 'bad';
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

// ── Rendered page with change boxes overlaid ──────────────────────────
function PageWithBoxes({
  image,
  side,
  label,
  changes,
  highlighted,
  setHighlighted,
  currentPage,
}: {
  image: RenderedPageImage | null;
  side: CompareSide;
  label: string;
  changes: Change[];
  highlighted: number | null;
  setHighlighted: (id: number | null) => void;
  currentPage: number;
}) {
  const boxes = changes.filter((c) => isOnSide(c, side));

  return (
    <div className="page-frame">
      <div className="plabel">{label}</div>
      {image ? (
        <div className="page-overlay-wrap">
          <img src={image.dataUrl} alt={`Page ${side}`} />
          {boxes.map((c) => {
            const box = (side === 'A' ? c.a : c.b)!;
            return (
              <div
                key={c.id}
                className={`chg-box chg-${c.type} ${highlighted === c.id ? 'hl' : ''}`}
                style={{
                  left: `${(box.x / image.width) * 100}%`,
                  top: `${(box.y / image.height) * 100}%`,
                  width: `${(box.w / image.width) * 100}%`,
                  height: `${(box.h / image.height) * 100}%`,
                }}
                onMouseEnter={() => setHighlighted(c.id)}
                onMouseLeave={() => setHighlighted(null)}
                title={`${TYPE_LABEL[c.type]}: ${c.text}`}
              >
                <span className="chg-num-badge">{c.id}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="page-missing">No page {currentPage + 1} on this side.</div>
      )}
    </div>
  );
}

export default function ContentCompareView() {
  const currentPage = useCompareStore((s) => s.currentPage);
  const pc = useCompareStore((s) => s.pageCache[s.currentPage]);
  const computing = useCompareStore((s) => s.computing);
  const movedThreshold = useCompareStore((s) => s.offsetThresholdPx);

  const [highlighted, setHighlighted] = useState<number | null>(null);

  const changes = useMemo(
    () => (pc ? buildChanges(pc, movedThreshold) : []),
    [pc, movedThreshold],
  );

  // Map normalized change text → change id, so word-diff spans can link to a box.
  const textToChange = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of changes) {
      const key = normalize(c.text);
      if (key && !m.has(key)) m.set(key, c.id);
    }
    return m;
  }, [changes]);

  if (computing && !pc) {
    return (
      <div className="loading-center">
        <span className="spinner" /> Computing page comparison…
      </div>
    );
  }
  if (!pc) return <div className="loading-center">Preparing…</div>;

  const bothEmpty = !pc.textA && !pc.textB;
  const dims = pc.imageA ?? pc.imageB;

  return (
    <div className="stack-col">
      {/* Rendered pages with change highlights */}
      <div className="card section-pad">
        <div className="overlay-legend">
          <span><i className="dot removed" /> Removed (only in A)</span>
          <span><i className="dot added" /> Added (only in B)</span>
          <span><i className="dot moved" /> Moved</span>
          <span className="legend-hint">Hover a highlight or a list row to link them.</span>
        </div>
        <div className="pages-row">
          <PageWithBoxes
            image={pc.imageA}
            side="A"
            label="A · Original"
            changes={changes}
            highlighted={highlighted}
            setHighlighted={setHighlighted}
            currentPage={currentPage}
          />
          <PageWithBoxes
            image={pc.imageB}
            side="B"
            label="B · Recreated"
            changes={changes}
            highlighted={highlighted}
            setHighlighted={setHighlighted}
            currentPage={currentPage}
          />
        </div>
      </div>

      {/* Notes */}
      {pc.notes.length > 0 && (
        <div className="notes-box">
          <strong>Notes</strong>
          <ul>
            {pc.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Content match score */}
      <div className="card section-pad">
        <div className="score-line">
          <span>Content match</span>
          <span className={`score-pct ${scoreClass(pc.contentMatch)}`}>
            {(pc.contentMatch * 100).toFixed(1)}%
          </span>
          {pc.match.onlyA.length > 0 && (
            <span className="chip removed">− {pc.match.onlyA.length} removed</span>
          )}
          {pc.match.onlyB.length > 0 && (
            <span className="chip added">+ {pc.match.onlyB.length} added</span>
          )}
        </div>
      </div>

      {/* Changes on this page — the "where" */}
      <div className="card section-pad">
        <div className="plabel" style={{ marginBottom: 10 }}>
          Changes on this page {changes.length > 0 && `· ${changes.length}`}
        </div>
        {changes.length === 0 ? (
          <div className="chg-empty">✓ No positional text changes detected on page {currentPage + 1}.</div>
        ) : (
          <div className="chg-list">
            {changes.map((c) => {
              const box = (c.a ?? c.b)!;
              return (
                <div
                  key={c.id}
                  className={`chg-item ${highlighted === c.id ? 'hl' : ''}`}
                  onMouseEnter={() => setHighlighted(c.id)}
                  onMouseLeave={() => setHighlighted(null)}
                >
                  <span className={`chg-num chg-${c.type}`}>{c.id}</span>
                  <span className={`chg-chip chg-${c.type}`}>{TYPE_LABEL[c.type]}</span>
                  <span className="chg-text" title={c.text}>{c.text}</span>
                  <span className="chg-pos">
                    {dims ? region(box, dims.width, dims.height) : ''}
                    {c.type === 'moved' && c.offset != null
                      ? ` · moved ${Math.round(c.offset)}px`
                      : ` · ${Math.round(box.x)},${Math.round(box.y)}px`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Word-level diff (linked to boxes where possible) */}
      <div className="card section-pad">
        <div className="plabel" style={{ marginBottom: 8 }}>Word-level diff</div>
        {bothEmpty ? (
          <div className="diff-box">No selectable text on this page to diff.</div>
        ) : (
          <div className="diff-box">
            {pc.diff.map((seg, i) => {
              const kind = seg.added ? 'added' : seg.removed ? 'removed' : '';
              const linkId = kind ? textToChange.get(normalize(seg.value)) : undefined;
              return (
                <span
                  key={i}
                  className={`${kind} ${linkId != null ? 'locatable' : ''} ${
                    linkId != null && highlighted === linkId ? 'hl' : ''
                  }`}
                  onMouseEnter={linkId != null ? () => setHighlighted(linkId) : undefined}
                  onMouseLeave={linkId != null ? () => setHighlighted(null) : undefined}
                  title={linkId != null ? `Change #${linkId} — highlighted on the page above` : undefined}
                >
                  {seg.value}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
