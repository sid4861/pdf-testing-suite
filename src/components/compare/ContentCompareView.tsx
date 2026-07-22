import { useMemo, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import type { CompareSide, RenderedPageImage } from '../../types/compare';
import { buildChanges, fmtInch, isOnSide, region, TYPE_LABEL, type Change, type ChangeType } from '../../services/changes';

const TYPE_ORDER: ChangeType[] = ['removed', 'added', 'moved'];

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
  hlGroup,
  setHighlighted,
  currentPage,
}: {
  image: RenderedPageImage | null;
  side: CompareSide;
  label: string;
  changes: Change[];
  hlGroup: number | null;
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
                className={`chg-box chg-${c.type} ${c.group === hlGroup ? 'hl' : ''}`}
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
  const movedThreshold = useCompareStore((s) => s.offsetThresholdIn);

  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [enabled, setEnabled] = useState<Record<ChangeType, boolean>>({
    removed: true,
    added: true,
    moved: true,
  });

  const changes = useMemo(
    () => (pc ? buildChanges(pc, movedThreshold) : []),
    [pc, movedThreshold],
  );

  const counts = useMemo(() => {
    const c: Record<ChangeType, number> = { removed: 0, added: 0, moved: 0 };
    for (const ch of changes) c[ch.type]++;
    return c;
  }, [changes]);

  const visible = useMemo(() => changes.filter((c) => enabled[c.type]), [changes, enabled]);

  // The highlight group of the hovered change — paired removed/added share a group,
  // so hovering either half lights up both.
  const groupById = useMemo(() => new Map(changes.map((c) => [c.id, c.group])), [changes]);
  const hlGroup = highlighted != null ? groupById.get(highlighted) ?? null : null;

  // Map normalized change text → change id, so word-diff spans can link to a box.
  const textToChange = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of visible) {
      const key = normalize(c.text);
      if (key && !m.has(key)) m.set(key, c.id);
    }
    return m;
  }, [visible]);

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
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              className={`legend-toggle ${enabled[t] ? 'on' : 'off'}`}
              disabled={counts[t] === 0}
              onClick={() => setEnabled((p) => ({ ...p, [t]: !p[t] }))}
              title={`Show / hide ${TYPE_LABEL[t].toLowerCase()} changes`}
            >
              <i className={`dot ${t}`} /> {TYPE_LABEL[t]} <span className="cnt">{counts[t]}</span>
            </button>
          ))}
          <span className="legend-hint">Click a type to filter · hover to link a change to the page.</span>
        </div>
        <div className="pages-row">
          <PageWithBoxes
            image={pc.imageA}
            side="A"
            label="A · Original"
            changes={visible}
            hlGroup={hlGroup}
            setHighlighted={setHighlighted}
            currentPage={currentPage}
          />
          <PageWithBoxes
            image={pc.imageB}
            side="B"
            label="B · Recreated"
            changes={visible}
            hlGroup={hlGroup}
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
          Changes on this page
          {changes.length > 0 && ` · ${visible.length}${visible.length !== changes.length ? ` of ${changes.length}` : ''}`}
        </div>
        {changes.length === 0 ? (
          <div className="chg-empty">✓ No positional text changes detected on page {currentPage + 1}.</div>
        ) : visible.length === 0 ? (
          <div className="chg-empty muted-empty">All change types are hidden — enable a filter above.</div>
        ) : (
          <div className="chg-list">
            {visible.map((c) => {
              const box = (c.a ?? c.b)!;
              return (
                <div
                  key={c.id}
                  className={`chg-item ${c.group === hlGroup ? 'hl' : ''}`}
                  onMouseEnter={() => setHighlighted(c.id)}
                  onMouseLeave={() => setHighlighted(null)}
                >
                  <span className={`chg-num chg-${c.type}`}>{c.id}</span>
                  <span className={`chg-chip chg-${c.type}`}>{TYPE_LABEL[c.type]}</span>
                  <span className="chg-text" title={c.text}>{c.text}</span>
                  <span className="chg-pos">
                    {dims ? region(box, dims.width, dims.height) : ''}
                    {c.type === 'moved' && c.offset != null
                      ? ` · moved ${fmtInch(c.offset, pc.pxPerInch)}`
                      : ` · ${fmtInch(box.x, pc.pxPerInch)}, ${fmtInch(box.y, pc.pxPerInch)}`}
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
              const linkGroup = linkId != null ? groupById.get(linkId) ?? null : null;
              return (
                <span
                  key={i}
                  className={`${kind} ${linkId != null ? 'locatable' : ''} ${
                    linkGroup != null && linkGroup === hlGroup ? 'hl' : ''
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
