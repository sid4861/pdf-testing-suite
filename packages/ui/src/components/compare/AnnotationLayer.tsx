import { useEffect, useRef } from 'react';
import type { CompareSide } from '@pdfsuite/core';
import { numberedFor, useAnnotationStore } from '../../store/annotationStore';

/**
 * Click-to-comment overlay for a rendered page.
 *
 * Sits above the change boxes and is pointer-transparent unless the user has
 * armed "Add comment", so hovering a change still works normally. Positions are
 * stored as fractions of the page, so pins track the image through zoom changes.
 */
export default function AnnotationLayer({ page, side }: { page: number; side: CompareSide }) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const placing = useAnnotationStore((s) => s.placing);
  const editingId = useAnnotationStore((s) => s.editingId);
  const add = useAnnotationStore((s) => s.add);
  const update = useAnnotationStore((s) => s.update);
  const remove = useAnnotationStore((s) => s.remove);
  const setEditing = useAnnotationStore((s) => s.setEditing);

  const pins = numberedFor(annotations, page, side);

  return (
    <div
      className={`anno-layer ${placing ? 'placing' : ''}`}
      onClick={(e) => {
        if (!placing) return;
        const r = e.currentTarget.getBoundingClientRect();
        add(page, side, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      }}
    >
      {pins.map((a) => (
        <div key={a.id} className="anno-pin-wrap" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}>
          <button
            className={`anno-pin ${editingId === a.id ? 'open' : ''} ${a.text ? '' : 'empty'}`}
            title={a.text || 'Empty comment — click to write it'}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(editingId === a.id ? null : a.id);
            }}
          >
            {a.number}
          </button>

          {editingId === a.id && (
            <Editor
              text={a.text}
              onChange={(t) => update(a.id, t)}
              onDelete={() => remove(a.id)}
              onClose={() => {
                // An untouched pin is a misclick, not a comment.
                if (!a.text.trim()) remove(a.id);
                else setEditing(null);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Editor({
  text,
  onChange,
  onDelete,
  onClose,
}: {
  text: string;
  onChange: (t: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
    };
    // Deferred: the click that opened this popover is still propagating.
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <div className="anno-editor" ref={boxRef} onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        value={text}
        placeholder="What needs fixing here?"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onClose();
        }}
      />
      <div className="anno-editor-foot">
        <button className="btn sm" onClick={onDelete} title="Delete this comment">
          Delete
        </button>
        <span className="spacer" />
        <span className="anno-hint">⌘/Ctrl + ↵</span>
        <button className="btn sm primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

/** Toolbar control that arms click-to-place and reports the running count. */
export function AnnotationToolbar({ page }: { page: number }) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const placing = useAnnotationStore((s) => s.placing);
  const setPlacing = useAnnotationStore((s) => s.setPlacing);
  const clearPage = useAnnotationStore((s) => s.clearPage);

  const onPage = annotations.filter((a) => a.page === page).length;
  const total = annotations.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlacing(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setPlacing]);

  return (
    <div className="anno-toolbar">
      <button
        className={`btn sm anno-arm ${placing ? 'on' : ''}`}
        onClick={() => setPlacing(!placing)}
        aria-pressed={placing}
        title={placing ? 'Click a page to drop the pin (Esc to cancel)' : 'Add a comment to this page'}
      >
        💬 {placing ? 'Click a page…' : 'Add comment'}
      </button>
      {/* Counts only appear once they mean something — "0 total" next to an
          empty page is pure noise. */}
      {onPage > 0 && (
        <>
          <span className="anno-count" title={`${onPage} comment${onPage === 1 ? '' : 's'} on this page`}>
            {onPage}
            {total > onPage ? ` of ${total}` : ''}
          </span>
          <button
            className="btn sm anno-clear"
            onClick={() => clearPage(page)}
            title="Remove every comment on this page"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
