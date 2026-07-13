import { useRef, useState } from 'react';

interface Props {
  naturalWidth: number;
}

interface Pt {
  x: number;
  y: number;
}

export default function MeasureOverlay({ naturalWidth }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<Pt | null>(null);
  const [end, setEnd] = useState<Pt | null>(null);
  const [dragging, setDragging] = useState(false);

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

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toCss(e);
    setStart(p);
    setEnd(p);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setEnd(toCss(e));
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
    >
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
