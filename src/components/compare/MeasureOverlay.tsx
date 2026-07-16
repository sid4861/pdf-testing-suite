import { useRef, useState } from 'react';
import type { TextItem } from '../../types/compare';

interface Props {
  naturalWidth: number;
  // When provided (pixel-diff view), hovering a changed region shows the
  // before/after text at that spot.
  onlyA?: TextItem[];
  onlyB?: TextItem[];
}

interface Pt {
  x: number;
  y: number;
}

interface Tip {
  x: number; // css, relative to overlay
  y: number;
  before: string | null;
  after: string | null;
}

// Item whose box contains the point (nearest to its centre wins).
function itemAt(items: TextItem[], nx: number, ny: number): TextItem | null {
  let best: TextItem | null = null;
  let bestD = Infinity;
  const pad = 2;
  for (const it of items) {
    if (nx >= it.x - pad && nx <= it.x + it.w + pad && ny >= it.y - pad && ny <= it.y + it.h + pad) {
      const cx = it.x + it.w / 2;
      const cy = it.y + it.h / 2;
      const d = (nx - cx) ** 2 + (ny - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
  }
  return best;
}

// Nearest counterpart to a found item, if close enough to be its replacement.
function counterpart(items: TextItem[], ref: TextItem): TextItem | null {
  const cx = ref.x + ref.w / 2;
  const cy = ref.y + ref.h / 2;
  let best: TextItem | null = null;
  let bestD = Infinity;
  for (const it of items) {
    const d = Math.hypot(it.x + it.w / 2 - cx, it.y + it.h / 2 - cy);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  // Only pair when on roughly the same line and near the same spot.
  if (best && bestD <= Math.max(ref.h * 2.2, ref.w * 0.9)) return best;
  return null;
}

export default function MeasureOverlay({ naturalWidth, onlyA, onlyB }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<Pt | null>(null);
  const [end, setEnd] = useState<Pt | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);

  const hasText = !!(onlyA?.length || onlyB?.length);

  const toCss = (e: React.PointerEvent): Pt => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // CSS px → natural px scaling factor.
  const scale = () => {
    const el = ref.current;
    if (!el || el.clientWidth === 0) return 1;
    return naturalWidth / el.clientWidth;
  };

  const updateTip = (css: Pt) => {
    if (!hasText) return;
    const s = scale();
    const nx = css.x * s;
    const ny = css.y * s;
    let before = itemAt(onlyA ?? [], nx, ny);
    let after = itemAt(onlyB ?? [], nx, ny);
    // Pair a lone removed/added run with its in-place replacement.
    if (before && !after) after = counterpart(onlyB ?? [], before);
    if (after && !before) before = counterpart(onlyA ?? [], after);
    if (before || after) {
      setTip({ x: css.x, y: css.y, before: before?.str ?? null, after: after?.str ?? null });
    } else {
      setTip(null);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toCss(e);
    setStart(p);
    setEnd(p);
    setDragging(true);
    setTip(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const css = toCss(e);
    if (dragging) {
      setEnd(css);
    } else {
      updateTip(css);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    setDragging(false);
    if (start && end) {
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      if (dist < 3) {
        setStart(null);
        setEnd(null);
      }
    }
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onLeave = () => setTip(null);

  const s = scale();
  const hasLine = start && end;
  const midX = hasLine ? (start!.x + end!.x) / 2 : 0;
  const midY = hasLine ? (start!.y + end!.y) / 2 : 0;
  const ndx = hasLine ? Math.round((end!.x - start!.x) * s) : 0;
  const ndy = hasLine ? Math.round((end!.y - start!.y) * s) : 0;
  const ndist = hasLine ? Math.round(Math.hypot(end!.x - start!.x, end!.y - start!.y) * s) : 0;

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', inset: 0, cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onLeave}
    >
      {/* before/after text tooltip (pixel-diff hover) */}
      {tip && !dragging && (
        <div
          className="diff-tip"
          style={{ left: Math.min(tip.x + 12, (ref.current?.clientWidth ?? 0) - 8), top: tip.y + 14 }}
        >
          {tip.before && tip.after ? (
            <>
              <span className="tt-lbl">was</span>
              <span className="tt-before">{tip.before}</span>
              <span className="tt-arrow">→</span>
              <span className="tt-after">{tip.after}</span>
            </>
          ) : tip.before ? (
            <>
              <span className="tt-lbl rm">removed</span>
              <span className="tt-before">{tip.before}</span>
            </>
          ) : (
            <>
              <span className="tt-lbl ad">added</span>
              <span className="tt-after">{tip.after}</span>
            </>
          )}
        </div>
      )}

      {hasLine && (
        <>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <line
              x1={start!.x}
              y1={start!.y}
              x2={end!.x}
              y2={end!.y}
              stroke="#dc2626"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <circle cx={start!.x} cy={start!.y} r={3} fill="#dc2626" />
            <circle cx={end!.x} cy={end!.y} r={3} fill="#dc2626" />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: midX + 8,
              top: midY - 10,
              background: '#dc2626',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 5,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {ndist}px · {Math.abs(ndx)}px {ndx >= 0 ? 'right' : 'left'} · {Math.abs(ndy)}px {ndy >= 0 ? 'down' : 'up'}
          </div>
        </>
      )}
    </div>
  );
}
