import { useRef, useState } from 'react';
import type { TextItem } from '../../types/compare';
import type { Change } from '../../services/changes';

interface Props {
  naturalWidth: number;
  pxPerInch: number;
  // When provided (pixel-diff view), hovering a changed region shows the
  // before/after text at that spot.
  onlyA?: TextItem[];
  onlyB?: TextItem[];
  // 'moved' changes (layout shifts) — hovering shows before/after position in inches
  // instead of text.
  moved?: Change[];
  // 'styled' changes — same words, different type. Hovering shows what changed.
  styled?: Change[];
}

interface Pt {
  x: number;
  y: number;
}

interface Tip {
  x: number; // css, relative to overlay
  y: number;
  kind: 'text' | 'layout' | 'style';
  before: string | null;
  after: string | null;
  // layout-only, in inches:
  leftA?: number;
  leftB?: number;
  topA?: number;
  topB?: number;
  offsetIn?: number;
  // style-only:
  styleSummary?: string;
  sample?: string;
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

// Bounding rect covering both the before (a) and after (b) position of a moved run.
function movedUnion(a: TextItem, b: TextItem): TextItem {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { str: '', x, y, w: right - x, h: bottom - y };
}

// The moved change whose before/after footprint contains the point (nearest centre wins).
function movedAt(items: Change[], nx: number, ny: number): Change | null {
  let best: Change | null = null;
  let bestD = Infinity;
  const pad = 2;
  for (const c of items) {
    const u = movedUnion(c.a!, c.b!);
    if (nx >= u.x - pad && nx <= u.x + u.w + pad && ny >= u.y - pad && ny <= u.y + u.h + pad) {
      const cx = u.x + u.w / 2;
      const cy = u.y + u.h / 2;
      const d = (nx - cx) ** 2 + (ny - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
  }
  return best;
}

export default function MeasureOverlay({ naturalWidth, pxPerInch, onlyA, onlyB, moved, styled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<Pt | null>(null);
  const [end, setEnd] = useState<Pt | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);

  const hasText = !!(onlyA?.length || onlyB?.length);
  const hasMoved = !!moved?.length;
  const hasStyled = !!styled?.length;

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
    if (!hasText && !hasMoved && !hasStyled) return;
    const s = scale();
    const nx = css.x * s;
    const ny = css.y * s;

    // Restyles are checked first: they explain a shift, so reporting the shift
    // instead would bury the actual cause.
    if (hasStyled) {
      const st = movedAt(styled!, nx, ny);
      if (st) {
        setTip({
          x: css.x,
          y: css.y,
          kind: 'style',
          before: null,
          after: null,
          styleSummary: st.style?.summary ?? 'type changed',
          sample: st.text,
        });
        return;
      }
    }

    if (hasMoved) {
      const m = movedAt(moved!, nx, ny);
      if (m) {
        setTip({
          x: css.x,
          y: css.y,
          kind: 'layout',
          before: null,
          after: null,
          leftA: m.a!.x / pxPerInch,
          leftB: m.b!.x / pxPerInch,
          topA: m.a!.y / pxPerInch,
          topB: m.b!.y / pxPerInch,
          offsetIn: (m.offset ?? 0) / pxPerInch,
        });
        return;
      }
    }

    if (!hasText) {
      setTip(null);
      return;
    }
    let before = itemAt(onlyA ?? [], nx, ny);
    let after = itemAt(onlyB ?? [], nx, ny);
    // Pair a lone removed/added run with its in-place replacement.
    if (before && !after) after = counterpart(onlyB ?? [], before);
    if (after && !before) before = counterpart(onlyA ?? [], after);
    if (before || after) {
      setTip({ x: css.x, y: css.y, kind: 'text', before: before?.str ?? null, after: after?.str ?? null });
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
      {/* before/after tooltip (pixel-diff hover) — text content or, for a layout shift, position in inches */}
      {tip && !dragging && (
        <div
          className={`diff-tip ${tip.kind === 'layout' || tip.kind === 'style' ? 'stacked' : ''}`}
          // Anchored to whichever side has room. Clamping `left` near the right
          // edge would squeeze the tooltip into a sliver and wrap every line.
          style={
            tip.x > (ref.current?.clientWidth ?? 0) / 2
              ? { right: Math.max(8, (ref.current?.clientWidth ?? 0) - tip.x + 12), top: tip.y + 14 }
              : { left: tip.x + 12, top: tip.y + 14 }
          }
        >
          {tip.kind === 'style' ? (
            <>
              <span className="tt-lbl st">font / style</span>
              {tip.sample && <span className="tt-sample">{tip.sample}</span>}
              <span className="tt-row">{tip.styleSummary}</span>
            </>
          ) : tip.kind === 'layout' ? (
            <>
              <span className="tt-lbl mv">layout shift</span>
              <span className="tt-row">left {tip.leftA!.toFixed(2)}″ → {tip.leftB!.toFixed(2)}″</span>
              <span className="tt-row">top {tip.topA!.toFixed(2)}″ → {tip.topB!.toFixed(2)}″</span>
              <span className="tt-row">moved {tip.offsetIn!.toFixed(2)}″ total</span>
            </>
          ) : tip.before && tip.after ? (
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
            {(ndist / pxPerInch).toFixed(2)}″ · {(Math.abs(ndx) / pxPerInch).toFixed(2)}″ {ndx >= 0 ? 'right' : 'left'} · {(Math.abs(ndy) / pxPerInch).toFixed(2)}″ {ndy >= 0 ? 'down' : 'up'}
          </div>
        </>
      )}
    </div>
  );
}
