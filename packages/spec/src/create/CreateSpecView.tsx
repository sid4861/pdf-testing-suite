import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCreateStore } from './createStore';
import type { MockupElement, Rect, TableElement, TextElement } from './model';
import SheetView from '../SheetView';

/**
 * **Create spec** — draw the page, and the workbook is written underneath
 * (W-54).
 *
 * The canvas is in **inches**, always, at the page size from the mockup.
 * Screen pixels exist only in `scale`, which is applied on the way out to
 * CSS and divided back out on the way in from the mouse. No pixel ever
 * reaches the model, which is why `px-without-density` cannot happen here:
 * the format's hardest rule is satisfied by the unit the canvas thinks in,
 * not by a check.
 */

/** Pixels per inch **on screen only**. Never written anywhere. */
const SCREEN = 96;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Snap to a sixteenth of an inch while dragging; hold Alt for free. */
const snap = (n: number, free: boolean) => (free ? round2(n) : Math.round(n * 16) / 16);

/** `col0`, `col1` … drag the edge between columns *n* and *n+1*. */
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | `col${number}`;

function Field({
  label, value, onChange, step = 0.05, suffix,
}: {
  label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string;
}) {
  return (
    <label className="cs-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix && <i>{suffix}</i>}
    </label>
  );
}

function Text({
  label, value, onChange,
}: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <label className="cs-field wide">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Pick({
  label, value, options, onChange, allowEmpty,
}: {
  label: string; value: string; options: string[];
  onChange: (s: string) => void; allowEmpty?: boolean;
}) {
  return (
    <label className="cs-field wide">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Toggle({
  label, value, onChange,
}: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="cs-toggle">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** One element on the canvas, drawn roughly as the PDF would show it. */
/**
 * One element on the canvas, drawn roughly as the PDF would show it, and
 * **edited where it is**.
 *
 * The point of the canvas is a high-fidelity mockup, and a mockup you
 * have to edit through a side panel is a form with a picture next to it.
 * So: a double-click on text edits the text, on an image asks for an
 * image, on a header cell types the header. The panel keeps the things
 * that have no place on the page — units, tolerances, which text
 * identifies the page.
 */
function Drawn({
  el, scale, selected, editing, onPick, onDrag, onEdit, onPatch, onPickImage,
}: {
  el: MockupElement;
  scale: number;
  selected: boolean;
  editing: boolean;
  onPick: () => void;
  onDrag: (handle: Handle, ev: React.PointerEvent) => void;
  onEdit: (on: boolean) => void;
  onPatch: (patch: Partial<MockupElement>) => void;
  onPickImage: () => void;
}) {
  const style: React.CSSProperties = {
    left: el.rect.x * scale,
    top: el.rect.y * scale,
    width: el.rect.w * scale,
    height: el.rect.h * scale,
    zIndex: el.z + 1,
  };

  /**
   * Put the caret in it.
   *
   * `contentEditable` on its own makes a box typable and focuses nothing,
   * so double-clicking appeared to do nothing — the outline came up and
   * the keys went to the page. Focus it and select what is there, so the
   * first keystroke replaces the placeholder the way it does everywhere
   * else.
   */
  const editRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing || el.kind !== 'text') return;
    const node = editRef.current;
    if (!node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing, el.kind]);

  let inner: React.ReactNode = null;
  if (el.kind === 'box') {
    inner = <div className="cs-box" style={{ background: el.fill ?? 'transparent' }} />;
  } else if (el.kind === 'image') {
    // An empty image frame is a button: clicking it asks for a picture,
    // which is the only thing anybody wants to do with an empty frame.
    inner = el.dataUrl
      ? <img src={el.dataUrl} alt={el.fileName} onDoubleClick={onPickImage} />
      : (
        <button type="button" className="cs-placeholder" onClick={onPickImage}>
          🖼️ {el.fileName || 'Add an image…'}
        </button>
      );
  } else if (el.kind === 'text') {
    inner = (
      <div
        ref={editRef}
        className={`cs-text ${editing ? 'editing' : ''}`}
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={(e) => {
          onEdit(false);
          const text = e.currentTarget.textContent ?? '';
          if (text !== el.text) onPatch({ text } as Partial<MockupElement>);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); (e.target as HTMLElement).blur(); }
          // Enter commits; the spec has no multi-line wording.
          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
          e.stopPropagation();
        }}
        style={{
          // Points to screen pixels: 72pt to the inch.
          fontSize: (el.fontSize / 72) * scale,
          fontFamily: el.font,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : 'normal',
          textDecoration: el.underline ? 'underline' : 'none',
          color: el.colour,
        }}
      >
        {el.text}
      </div>
    );
  } else {
    const t = el as TableElement;
    const total = t.columnWidths.reduce((a, b) => a + b, 0) || 1;
    inner = (
      <div className="cs-table">
        <div className="cs-tr head" style={{ height: t.headerHeight * scale }}>
          {t.columnWidths.map((w, i) => (
            <div key={i} className="cs-td" style={{ flex: `0 0 ${(w / total) * 100}%` }}>
              {editing ? (
                <input
                  className="cs-th-input"
                  autoFocus={i === 0}
                  value={t.headers?.[i] ?? ''}
                  placeholder={`Col ${i + 1}`}
                  onFocus={(e) => e.currentTarget.select()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const headers = [...(t.headers ?? [])];
                    while (headers.length < t.columnWidths.length) headers.push('');
                    headers[i] = e.target.value;
                    onPatch({ headers } as Partial<MockupElement>);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') onEdit(false);
                    e.stopPropagation();
                  }}
                />
              ) : (t.headers?.[i] ?? '')}
            </div>
          ))}
        </div>
        {/* Column edges, draggable. The widths are inches and so is the
            drag, which is why the number field and the handle can be the
            same fact set two ways. */}
        {selected && t.columnWidths.slice(0, -1).map((_, i) => {
          const left = t.columnWidths.slice(0, i + 1).reduce((a, b) => a + b, 0);
          return (
            <i
              key={i}
              className="cs-colgrip"
              style={{ left: (left / total) * 100 + '%' }}
              onPointerDown={(e) => { e.stopPropagation(); onDrag(`col${i}` as Handle, e); }}
            />
          );
        })}
        {Array.from({ length: Math.max(0, t.rows - 1) }).map((_, r) => (
          <div key={r} className="cs-tr" style={{ height: t.rowHeight * scale }}>
            {t.columnWidths.map((w, i) => (
              <div key={i} className="cs-td" style={{ flex: `0 0 ${(w / total) * 100}%` }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`cs-el ${el.kind} ${selected ? 'sel' : ''}`}
      style={style}
      onPointerDown={(e) => {
        if (editing) return;   // a drag would steal the caret
        onPick();
        onDrag('move', e);
      }}
      onDoubleClick={(e) => {
        if (el.kind === 'text' || el.kind === 'table') { e.stopPropagation(); onEdit(true); }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${el.element || el.kind}${el.part ? ` · ${el.part}` : ''}`}
    >
      {inner}
      {selected && (['nw', 'ne', 'sw', 'se'] as const).map((h) => (
        <i
          key={h}
          className={`cs-handle ${h}`}
          onPointerDown={(e) => { e.stopPropagation(); onDrag(h, e); }}
        />
      ))}
    </div>
  );
}

export default function CreateSpecView() {
  const doc = useCreateStore((s) => s.doc);
  const pageIndex = useCreateStore((s) => s.pageIndex);
  const selected = useCreateStore((s) => s.selected);
  const view = useCreateStore((s) => s.view);
  const workbookBytes = useCreateStore((s) => s.workbookBytes);
  const building = useCreateStore((s) => s.building);
  const error = useCreateStore((s) => s.error);

  const setPage = useCreateStore((s) => s.setPage);
  const select = useCreateStore((s) => s.select);
  const addElement = useCreateStore((s) => s.addElement);
  const updateElement = useCreateStore((s) => s.updateElement);
  const moveElement = useCreateStore((s) => s.moveElement);
  const removeElement = useCreateStore((s) => s.removeElement);
  const raise = useCreateStore((s) => s.raise);
  const undo = useCreateStore((s) => s.undo);
  const redo = useCreateStore((s) => s.redo);
  const duplicate = useCreateStore((s) => s.duplicate);
  const nudge = useCreateStore((s) => s.nudge);
  const beginGesture = useCreateStore((s) => s.beginGesture);
  const endGesture = useCreateStore((s) => s.endGesture);
  const canUndo = useCreateStore((s) => s.past.length > 0);
  const canRedo = useCreateStore((s) => s.future.length > 0);
  const sendTo = useCreateStore((s) => s.sendTo);
  const addPage = useCreateStore((s) => s.addPage);
  const patchPage = useCreateStore((s) => s.patchPage);
  const loadMockup = useCreateStore((s) => s.loadMockup);

  const page = doc.pages[pageIndex];
  const [scale, setScale] = useState(SCREEN * 0.7);
  /** Which element is being edited in place, if any. */
  const [editing, setEditing] = useState<string | null>(null);
  /** Which image element a file is being chosen for. */
  const forImage = useRef<string | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mockupRef = useRef<HTMLInputElement>(null);

  const el = useMemo(
    () => page?.elements.find((e) => e.id === selected) ?? null,
    [page, selected],
  );

  /**
   * Dragging. The pointer moves in screen pixels; everything stored is
   * inches, so the delta is divided by the scale on the way in. Doing it
   * the other way — keeping pixels and converting on save — is how a
   * canvas ends up with 0.3333333in in its spec.
   */
  const drag = useRef<{
    id: string; handle: Handle; start: Rect; px: number; py: number;
    /** The column widths as they were when the drag began. */
    cols?: number[];
  } | null>(null);

  const onDrag = useCallback((id: string, handle: Handle, ev: React.PointerEvent) => {
    const target = page?.elements.find((e) => e.id === id);
    if (!target) return;
    ev.preventDefault();
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    beginGesture();
    drag.current = {
      id, handle, start: { ...target.rect }, px: ev.clientX, py: ev.clientY,
      cols: target.kind === 'table' ? [...target.columnWidths] : undefined,
    };
  }, [page, beginGesture]);

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (ev.clientX - d.px) / scale;
      const dy = (ev.clientY - d.py) / scale;
      const free = ev.altKey;
      const s = d.start;

      // A column edge moves width between two columns and leaves the
      // table's own rectangle alone — which is what dragging a column
      // means in every spreadsheet anyone has used.
      if (d.handle.startsWith('col')) {
        const i = Number(d.handle.slice(3));
        const el0 = d.cols;
        if (!el0) return;
        const left = Math.max(0.1, round2(el0[i] + dx));
        const right = Math.max(0.1, round2(el0[i] + el0[i + 1] - left));
        const widths = [...el0];
        widths[i] = left;
        widths[i + 1] = right;
        updateElement(d.id, { columnWidths: widths } as never);
        return;
      }

      let r: Rect;
      if (d.handle === 'move') {
        r = { ...s, x: snap(s.x + dx, free), y: snap(s.y + dy, free) };
      } else {
        const east = d.handle.endsWith('e');
        const south = d.handle.startsWith('s');
        const x = east ? s.x : snap(s.x + dx, free);
        const y = south ? s.y : snap(s.y + dy, free);
        const w = east ? snap(s.w + dx, free) : s.w + (s.x - x);
        const h = south ? snap(s.h + dy, free) : s.h + (s.y - y);
        r = { x, y, w: Math.max(0.1, round2(w)), h: Math.max(0.1, round2(h)) };
      }
      moveElement(d.id, r);
    };
    const up = () => {
      if (drag.current) endGesture();
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [scale, moveElement, updateElement, endGesture]);

  /**
   * The keys any canvas is expected to have.
   *
   * Bound to the window rather than to the surface, because an element is
   * a `div` and the thing a person has just clicked may not hold focus.
   * Everything bails out when the focus is in a field — Delete inside a
   * text box deletes a character, not the box.
   */
  useEffect(() => {
    if (view !== 'canvas') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }

      if (e.key === 'Escape') {
        if (editing) setEditing(null); else select(null);
        return;
      }
      if (typing) return;

      if (!selected) {
        // Tab with nothing selected picks the first thing up.
        if (e.key === 'Tab' && page.elements.length) {
          e.preventDefault();
          select([...page.elements].sort((a, b) => b.z - a.z)[0].id);
        }
        return;
      }

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          removeElement(selected);
          break;
        case 'Enter':
        case 'F2': {
          const el0 = page.elements.find((x) => x.id === selected);
          if (el0 && (el0.kind === 'text' || el0.kind === 'table')) {
            e.preventDefault();
            setEditing(selected);
          }
          break;
        }
        case 'Tab': {
          // Cycle through the stack, top first, which is the order the
          // layer list shows.
          e.preventDefault();
          const order = [...page.elements].sort((a, b) => b.z - a.z);
          const i = order.findIndex((x) => x.id === selected);
          const next = order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length];
          select(next.id);
          break;
        }
        case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
          e.preventDefault();
          // A sixteenth of an inch, or a quarter with Shift — the same
          // grid the drag snaps to, so the two agree.
          const step = e.shiftKey ? 0.25 : 1 / 16;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          nudge(selected, dx, dy);
          break;
        }
        default:
          if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(selected); }
          else if (mod && e.key === ']') { e.preventDefault(); raise(selected, 1); }
          else if (mod && e.key === '[') { e.preventDefault(); raise(selected, -1); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, selected, editing, page, select, removeElement, nudge, duplicate, raise, undo, redo]);

  const onImage = async (f: File) => {
    const id = forImage.current ?? el?.id ?? null;
    forImage.current = null;
    const target = page?.elements.find((e) => e.id === id);
    if (!target || target.kind !== 'image') return;
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(f);
    });
    // The bytes are for drawing; only the name reaches the workbook.
    updateElement(target.id, { fileName: f.name, dataUrl });
  };

  if (!page) return <div className="loading-center">Preparing…</div>;

  return (
    <main className="app-body cs-body">
      {/* Each view is whole, as in Specification: the workbook replaces
          the canvas rather than appearing under it. */}
      {view === 'canvas' && (
      <div className="cs-grid">
        {/* ── the page ─────────────────────────────────────────────── */}
        <section className="card cs-stage-card">
          <div className="layout-controls">
            <div className="tabs" role="group" aria-label="Pages">
              {doc.pages.map((p, i) => (
                <button
                  key={p.tab}
                  className={`tab ${i === pageIndex ? 'active' : ''}`}
                  onClick={() => setPage(i)}
                  title={p.name}
                >
                  {p.tab}
                </button>
              ))}
              <button className="tab" onClick={addPage} title="Add a page">+</button>
            </div>
            <div className="spacer" />
            <span className="legend-hint">
              {page.orientation} · {doc.page.width}&times;{doc.page.height} in
            </span>
            {/* Visible, not keyboard-only: a shortcut nobody is told
                about is a feature nobody has. */}
            <div className="zoom-group" title="Undo and redo">
              <button className="zoombtn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</button>
              <button className="zoombtn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷</button>
            </div>
            <div className="zoom-group" title="Zoom the page">
              <button className="zoombtn" onClick={() => setScale((z) => Math.max(24, z / 1.25))}>−</button>
              <span className="zoom-label">{Math.round((scale / SCREEN) * 100)}%</span>
              <button className="zoombtn" onClick={() => setScale((z) => Math.min(300, z * 1.25))}>+</button>
            </div>
          </div>

          <div
            className="stage cs-stage"
            onPointerDown={() => { select(null); setEditing(null); }}
          >
            <div className="stage-content">
              <div
                ref={surface}
                className="cs-page"
                style={{
                  width: doc.page.width * scale,
                  height: doc.page.height * scale,
                  background: page.background ?? '#ffffff',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {[...page.elements].sort((a, b) => a.z - b.z).map((e) => (
                  <Drawn
                    key={e.id}
                    el={e}
                    scale={scale}
                    selected={e.id === selected}
                    editing={editing === e.id}
                    onPick={() => select(e.id)}
                    onDrag={(h, ev) => onDrag(e.id, h, ev)}
                    onEdit={(on) => setEditing(on ? e.id : null)}
                    onPatch={(patch) => updateElement(e.id, patch)}
                    onPickImage={() => { forImage.current = e.id; select(e.id); fileRef.current?.click(); }}
                  />
                ))}
              </div>
            </div>
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImage(f);
              e.target.value = '';   // the same file twice still fires
            }}
          />
        </section>

        {/* ── the panel ────────────────────────────────────────────── */}
        <aside className="cs-panel">
          <div className="card section-pad cs-add">
            <div className="cs-head">Add</div>
            <div className="cs-add-row">
              <button className="btn sm" onClick={() => addElement('box')}>▭ Box</button>
              <button className="btn sm" onClick={() => addElement('text')}>T Text</button>
              <button className="btn sm" onClick={() => addElement('image')}>🖼 Image</button>
              <button className="btn sm" onClick={() => addElement('table')}>▦ Table</button>
            </div>
          </div>

          <div className="card section-pad">
            <div className="cs-head">Page</div>
            <Text label="Name" value={page.name} onChange={(name) => patchPage({ name })} />
            <Pick
              label="Type" value={page.type}
              options={['Required', 'Optional', 'Conditional']}
              onChange={(v) => patchPage({ type: v as typeof page.type })}
            />
            <Pick
              label="Orientation" value={page.orientation}
              options={['Landscape', 'Portrait']}
              onChange={(v) => patchPage({ orientation: v as typeof page.orientation })}
            />
            <Pick
              label="Background" value={page.background ?? ''}
              options={doc.palette.map((p) => p.hex)} allowEmpty
              onChange={(v) => patchPage({ background: v || undefined })}
            />
          </div>

          {/* ── layers ───────────────────────────────────────────── */}
          <div className="card section-pad">
            <div className="cs-head">Layers</div>
            {page.elements.length === 0 && <p className="cs-empty">Nothing on this page yet.</p>}
            <ul className="cs-layers">
              {[...page.elements].sort((a, b) => b.z - a.z).map((e) => (
                <li key={e.id} className={e.id === selected ? 'sel' : ''}>
                  <button className="cs-layer" onClick={() => select(e.id)}>
                    <span className="cs-kind">{{ box: '▭', text: 'T', image: '🖼', table: '▦' }[e.kind]}</span>
                    <span className="cs-name">{e.element || e.kind}{e.part ? ` · ${e.part}` : ''}</span>
                  </button>
                  <button className="cs-z" onClick={() => sendTo(e.id, 'front')} title="Bring to front">⇈</button>
                  <button className="cs-z" onClick={() => raise(e.id, 1)} title="Bring forward">↑</button>
                  <button className="cs-z" onClick={() => raise(e.id, -1)} title="Send backward">↓</button>
                  <button className="cs-z" onClick={() => sendTo(e.id, 'back')} title="Send to back">⇊</button>
                  <button className="cs-z" onClick={() => removeElement(e.id)} title="Delete">×</button>
                </li>
              ))}
            </ul>
            <p className="cs-aside">
              Stacking is for the drawing. It is not written to the workbook — each
              element records its own position and size, whatever is behind it.
            </p>
            <p className="cs-keys">
              <b>Double-click</b> text or a table to type on the page ·
              <b> Delete</b> removes · <b>arrows</b> nudge, with Shift for a quarter inch ·
              <b> Ctrl+D</b> duplicates · <b>Ctrl+[</b> and <b>Ctrl+]</b> restack ·
              <b> Tab</b> cycles · <b>Ctrl+Z</b> undoes
            </p>
          </div>

          {/* ── the selected element ─────────────────────────────── */}
          {el && (
            <div className="card section-pad">
              <div className="cs-head">{el.kind}</div>
              <Text label="Element" value={el.element} onChange={(v) => updateElement(el.id, { element: v })} />
              <Text label="Part" value={el.part} onChange={(v) => updateElement(el.id, { part: v })} />

              <div className="cs-row">
                <Field label="Left" value={el.rect.x} onChange={(x) => moveElement(el.id, { ...el.rect, x })} suffix="in" />
                <Field label="Top" value={el.rect.y} onChange={(y) => moveElement(el.id, { ...el.rect, y })} suffix="in" />
              </div>
              <div className="cs-row">
                <Field label="Width" value={el.rect.w} onChange={(w) => moveElement(el.id, { ...el.rect, w })} suffix="in" />
                <Field label="Height" value={el.rect.h} onChange={(h) => moveElement(el.id, { ...el.rect, h })} suffix="in" />
              </div>

              {el.kind === 'text' && (
                <>
                  <Text label="Text" value={el.text} onChange={(text) => updateElement(el.id, { text })} />
                  <div className="cs-row">
                    <Pick label="Font" value={el.font} options={doc.fonts} onChange={(font) => updateElement(el.id, { font })} />
                    <Field label="Size" value={el.fontSize} step={1} onChange={(fontSize) => updateElement(el.id, { fontSize })} suffix="pt" />
                  </div>
                  <div className="cs-row">
                    <Toggle label="Bold" value={el.bold} onChange={(bold) => updateElement(el.id, { bold })} />
                    <Toggle label="Italic" value={el.italic} onChange={(italic) => updateElement(el.id, { italic })} />
                    <Toggle label="Underline" value={el.underline} onChange={(underline) => updateElement(el.id, { underline })} />
                  </div>
                  <Pick
                    label="Colour" value={el.colour}
                    options={doc.palette.map((p) => p.hex)}
                    onChange={(colour) => updateElement(el.id, { colour })}
                  />
                  <Pick
                    label="Case" value={(el as TextElement).textCase ?? ''}
                    options={['Title', 'Sentence', 'Upper', 'Lower']} allowEmpty
                    onChange={(v) => updateElement(el.id, { textCase: v || undefined })}
                  />
                  <Toggle label="Exact text" value={el.exactText} onChange={(exactText) => updateElement(el.id, { exactText })} />
                  <Toggle
                    label="This text identifies the page"
                    value={el.identifier === true}
                    onChange={(identifier) => updateElement(el.id, { identifier })}
                  />
                  <p className="cs-aside">
                    The page is found in the PDF by its identifying text, not by its
                    number. Mark one text element here.
                  </p>
                </>
              )}

              {el.kind === 'image' && (
                <>
                  <Text label="File name" value={el.fileName} onChange={(fileName) => updateElement(el.id, { fileName })} />
                  <button
                    className="btn sm"
                    onClick={() => { forImage.current = el.id; fileRef.current?.click(); }}
                  >
                    Load an image…
                  </button>
                  <p className="cs-aside">
                    Or click the frame on the page.
                  </p>
                  <p className="cs-aside">
                    <b>Recorded, not checked.</b> The position and size are compared;
                    the picture itself is not.
                  </p>
                </>
              )}

              {el.kind === 'table' && (
                <>
                  <div className="cs-row">
                    <Field
                      label="Columns" value={el.columns} step={1}
                      onChange={(n) => {
                        const columns = Math.max(1, Math.round(n));
                        const each = round2(el.rect.w / columns);
                        updateElement(el.id, {
                          columns,
                          columnWidths: Array.from({ length: columns }, () => each),
                        });
                      }}
                    />
                    <Field label="Rows" value={el.rows} step={1} onChange={(rows) => updateElement(el.id, { rows: Math.max(1, Math.round(rows)) })} />
                  </div>
                  <div className="cs-row">
                    <Field label="Header h." value={el.headerHeight} onChange={(headerHeight) => updateElement(el.id, { headerHeight })} suffix="in" />
                    <Field label="Row h." value={el.rowHeight} onChange={(rowHeight) => updateElement(el.id, { rowHeight })} suffix="in" />
                  </div>
                  <div className="cs-head sub">Column widths (in)</div>
                  {el.columnWidths.map((w, i) => (
                    <Field
                      key={i} label={`Col ${i + 1}`} value={w}
                      onChange={(v) => {
                        const columnWidths = [...el.columnWidths];
                        columnWidths[i] = Math.max(0.1, round2(v));
                        updateElement(el.id, { columnWidths });
                      }}
                      suffix="in"
                    />
                  ))}
                  <Text
                    label="Headers"
                    value={(el.headers ?? []).join(', ')}
                    onChange={(v) => updateElement(el.id, {
                      headers: v.split(',').map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                </>
              )}

              {el.kind === 'box' && (
                <>
                  <Pick
                    label="Fill" value={el.fill ?? ''}
                    options={doc.palette.map((p) => p.hex)} allowEmpty
                    onChange={(v) => updateElement(el.id, { fill: v || undefined })}
                  />
                  <p className="cs-aside">
                    <b>Recorded, not checked.</b> Container fills have no checker yet.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="card section-pad">
            <button className="btn sm" onClick={() => mockupRef.current?.click()}>Open a mockup…</button>
            <input
              ref={mockupRef} type="file" accept=".json,application/json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadMockup(f); }}
            />
            {error && <p className="slot-error">⚠ {error}</p>}
          </div>
        </aside>
      </div>
      )}

      {/* ── what has been written ──────────────────────────────────── */}
      {view === 'workbook' && (
        workbookBytes
          ? (
            <>
              <p className="cs-readonly">
                <b>This workbook is written from the canvas.</b> It is read-only here —
                the drawing is the source of truth. To edit it by hand, download it and
                open it in the <b>Specification</b> tab.
              </p>
              <SheetView bytes={workbookBytes} validation={[]} results={[]} />
            </>
          )
          : <div className="loading-center"><span className="spinner" /> Writing the workbook…</div>
      )}
      {building && view === 'canvas' && <span className="cs-building">writing…</span>}
    </main>
  );
}
