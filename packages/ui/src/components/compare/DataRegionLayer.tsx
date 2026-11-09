import { useState } from 'react';
import { regionsFor, useRegionStore } from '../../store/regionStore';

interface Drag {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const rectOf = (d: Drag) => ({
  x: Math.min(d.x0, d.x1),
  y: Math.min(d.y0, d.y1),
  w: Math.abs(d.x1 - d.x0),
  h: Math.abs(d.y1 - d.y0),
});

/**
 * Draw-and-label overlay for ignored regions on a page.
 *
 * The UI calls these *ignored regions*, the same word used for a single
 * accepted difference: one area whose changes are expected, decided once.
 *
 * Like the annotation layer it is pointer-transparent until armed, so hovering a
 * change box underneath keeps working. Both pages show the same regions — a
 * region describes the template, not one side of the comparison.
 */
export default function DataRegionLayer({ page }: { page: number }) {
  const regions = useRegionStore((s) => s.regions);
  const drawing = useRegionStore((s) => s.drawing);
  const add = useRegionStore((s) => s.add);
  const remove = useRegionStore((s) => s.remove);

  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [label, setLabel] = useState('');

  const here = regionsFor(regions, page);

  const at = (e: React.MouseEvent, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  /** Mouse-up and leaving the page both end a drag the same way. */
  const finish = () => {
    if (!drag) return;
    const r = rectOf(drag);
    setDrag(null);
    // A click rather than a drag — nothing to declare.
    if (r.w < 0.02 || r.h < 0.01) return;
    setLabel('');
    setPending(r);
  };

  return (
    <div
      className={`region-layer ${drawing ? 'drawing' : ''} ${pending ? 'naming' : ''}`}
      onMouseDown={(e) => {
        if (!drawing || pending) return;
        const p = at(e, e.currentTarget);
        setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }}
      onMouseMove={(e) => {
        if (!drag) return;
        const p = at(e, e.currentTarget);
        setDrag({ ...drag, x1: p.x, y1: p.y });
      }}
      onMouseUp={finish}
      onMouseLeave={finish}
    >
      {here.map((r) => (
        <div
          key={r.id}
          className="region-box"
          style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
        >
          <span className="region-tag">
            {r.label}
            <button
              className="region-del"
              title="Stop ignoring this region"
              onClick={(e) => {
                e.stopPropagation();
                remove(r.id);
              }}
            >
              ✕
            </button>
          </span>
        </div>
      ))}

      {drag && (
        <div
          className="region-box ghost"
          style={(() => {
            const r = rectOf(drag);
            return { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` };
          })()}
        />
      )}

      {pending && (
        <div
          className="region-box pending"
          style={{
            left: `${pending.x * 100}%`,
            top: `${pending.y * 100}%`,
            width: `${pending.w * 100}%`,
            height: `${pending.h * 100}%`,
          }}
        >
          <div className="region-name" onMouseDown={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={label}
              placeholder="Name this area — e.g. holdings table"
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setPending(null);
                if (e.key === 'Enter') {
                  add(page, pending, label);
                  setPending(null);
                }
              }}
            />
            <button className="btn sm" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              className="btn sm primary"
              onClick={() => {
                add(page, pending, label);
                setPending(null);
              }}
            >
              Ignore region
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Toolbar control: arm drawing, and report what is declared on this page. */
export function DataRegionToolbar({ page, inDataCount }: { page: number; inDataCount: number }) {
  const regions = useRegionStore((s) => s.regions);
  const drawing = useRegionStore((s) => s.drawing);
  const setDrawing = useRegionStore((s) => s.setDrawing);

  const here = regionsFor(regions, page).length;

  return (
    <div className="region-toolbar">
      <button
        className={`btn sm region-arm ${drawing ? 'on' : ''}`}
        onClick={() => setDrawing(!drawing)}
        aria-pressed={drawing}
        title={
          drawing
            ? 'Drag a rectangle over the area whose changes are expected (Esc to cancel)'
            : 'Ignore every change inside an area — a data table, for instance — in one decision'
        }
      >
        ▦ {drawing ? 'Drag over the area…' : 'Ignore a region'}
      </button>
      {here > 0 && (
        <span
          className="region-count"
          title={`${inDataCount} difference${inDataCount === 1 ? '' : 's'} ignored by ${here} region${here === 1 ? '' : 's'} on this page`}
        >
          {here} ignored region{here === 1 ? '' : 's'}
          {inDataCount > 0 ? ` · ${inDataCount} change${inDataCount === 1 ? '' : 's'}` : ''}
        </span>
      )}
    </div>
  );
}
