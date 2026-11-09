import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCompareStore } from '../../store/compareStore';
import { isSequential, sequentialPairs, type PagePair } from '@pdfsuite/compare';
import { renderThumb } from '@pdfsuite/core';

/**
 * Pairing pages by hand.
 *
 * Comparing page 5 with page 5 is only right while both documents hold the same
 * pages in the same order. Drop a page from one, and every page after it is
 * compared with something it has nothing to do with.
 *
 * The flow is deliberately small: a list of rows, each a golden page against a
 * tested page. Clicking either side opens that PDF and you pick the page you
 * meant. Nothing is inferred, so there is nothing to second-guess.
 */

/**
 * Pages are rendered once at this width and displayed at whatever size is
 * chosen. Re-rendering on every size change would make the control sluggish
 * exactly when someone is using it to find a readable size; scaling a
 * generously-rendered image costs nothing.
 */
const PICKER_RENDER_W = 420;

/** The sizes on offer, in CSS pixels. */
const PICKER_SIZES = [220, 320, 420, 560];
const SIZE_KEY = 'pdfsuite.pickerSize.v1';

function loadSize(): number {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY));
    return PICKER_SIZES.includes(n) ? n : 320;
  } catch {
    return 320;
  }
}

// ── page picker ───────────────────────────────────────────────────────

/** Scroll the document, click the page. */
function PagePicker({
  doc,
  title,
  side,
  selected,
  onPick,
  onClose,
}: {
  doc: PDFDocumentProxy;
  title: string;
  side: 'gold' | 'test';
  selected: number | null;
  onPick: (page: number | null) => void;
  onClose: () => void;
}) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [size, setSize] = useState(loadSize);
  const live = useRef(true);

  const resize = (dir: 1 | -1) =>
    setSize((prev) => {
      const at = PICKER_SIZES.indexOf(prev);
      const next = PICKER_SIZES[Math.min(PICKER_SIZES.length - 1, Math.max(0, at + dir))];
      try {
        localStorage.setItem(SIZE_KEY, String(next));
      } catch {
        // A blocked store costs the preference, not the feature.
      }
      return next;
    });

  useEffect(() => {
    live.current = true;
    (async () => {
      for (let i = 0; i < doc.numPages; i++) {
        if (!live.current) return;
        const url = await renderThumb(doc, i, PICKER_RENDER_W);
        if (!live.current) return;
        setThumbs((p) => ({ ...p, [i]: url }));
      }
    })();
    return () => {
      live.current = false;
    };
  }, [doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="pk-backdrop" onClick={onClose}>
      <div
        className="pk-dialog"
        role="dialog"
        aria-label={`Choose a page from ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pk-head">
          <span className={`doc-chip ${side}`}>{side === 'gold' ? 'GOLDEN' : 'TO TEST'}</span>
          <span className="pk-name" title={title}>{title}</span>
          <span className="pk-count">{doc.numPages} pages</span>
          <span className="spacer" />
          <div className="zoom-group" title="Page size">
            <button
              className="zoombtn"
              onClick={() => resize(-1)}
              disabled={size === PICKER_SIZES[0]}
              aria-label="Smaller pages"
            >
              −
            </button>
            <span className="zoom-label">{Math.round((size / PICKER_SIZES[1]) * 100)}%</span>
            <button
              className="zoombtn"
              onClick={() => resize(1)}
              disabled={size === PICKER_SIZES[PICKER_SIZES.length - 1]}
              aria-label="Bigger pages"
            >
              +
            </button>
          </div>
          <button className="btn sm" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        <div className="pk-body">
          {Array.from({ length: doc.numPages }, (_, i) => (
            <button
              key={i}
              className={`pk-page ${i === selected ? 'on' : ''}`}
              onClick={() => onPick(i)}
              ref={(el) => {
                // Open on the page already chosen rather than at the top.
                if (el && i === selected) el.scrollIntoView({ block: 'center' });
              }}
            >
              {thumbs[i] ? (
                <img src={thumbs[i]} alt="" style={{ width: size }} />
              ) : (
                <span className="pk-loading" style={{ width: size, height: Math.round(size * 1.294) }} />
              )}
              <span className="pk-num">Page {i + 1}</span>
            </button>
          ))}
        </div>

        <div className="pk-foot">
          <button className="btn sm" onClick={() => onPick(null)}>
            No matching page
          </button>
          <span className="faint">
            This page has no counterpart — it was {side === 'gold' ? 'removed' : 'added'}.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── one side of a row ─────────────────────────────────────────────────

function Cell({
  page,
  doc,
  side,
  onOpen,
}: {
  page: number | null;
  doc: PDFDocumentProxy | null;
  side: 'gold' | 'test';
  onOpen: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setThumb(null);
    if (doc && page != null && page < doc.numPages) {
      renderThumb(doc, page, 64).then((u) => {
        if (live) setThumb(u);
      });
    }
    return () => {
      live = false;
    };
  }, [doc, page]);

  const which = side === 'gold' ? 'golden PDF' : 'PDF to test';
  return (
    <button
      className={`pr-cell ${side} ${page == null ? 'none' : ''}`}
      onClick={onOpen}
      title={page == null ? `Choose a page from the ${which}` : `Page ${page + 1} — click to change`}
    >
      {page == null ? (
        <span className="pr-none">—</span>
      ) : thumb ? (
        <img src={thumb} alt="" />
      ) : (
        <span className="pr-thumbing" />
      )}
      <span className="pr-label">{page == null ? 'no page' : `Page ${page + 1}`}</span>
    </button>
  );
}

// ── the editor ────────────────────────────────────────────────────────

export default function PagePairing({ onClose }: { onClose: () => void }) {
  const sideA = useCompareStore((s) => s.sideA);
  const sideB = useCompareStore((s) => s.sideB);
  const storePairs = useCompareStore((s) => s.pairs);
  const setPairs = useCompareStore((s) => s.setPairs);

  // Edited locally and applied on Done, so a half-finished pairing never
  // triggers a recompute of everything.
  const [draft, setDraft] = useState<PagePair[]>(() =>
    storePairs.length
      ? storePairs
      : sequentialPairs(sideA?.pageCount ?? 0, sideB?.pageCount ?? 0),
  );
  const [picking, setPicking] = useState<{ row: number; side: 'gold' | 'test' } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !picking) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking, onClose]);

  const choose = (row: number, side: 'gold' | 'test', page: number | null) =>
    setDraft((d) =>
      d.map((p, i) =>
        i === row ? { ...p, [side === 'gold' ? 'a' : 'b']: page, score: null } : p,
      ),
    );

  const addRow = () => setDraft((d) => [...d, { a: null, b: null, score: null }]);
  const removeRow = (row: number) => setDraft((d) => d.filter((_, i) => i !== row));

  // A page used twice would be compared twice and reported twice; say so rather
  // than silently producing a confusing report.
  const repeated = (side: 'a' | 'b') => {
    const seen = new Set<number>();
    const twice = new Set<number>();
    for (const p of draft) {
      const v = p[side];
      if (v == null) continue;
      if (seen.has(v)) twice.add(v);
      seen.add(v);
    }
    return twice;
  };
  const dupA = repeated('a');
  const dupB = repeated('b');
  const blanks = draft.filter((p) => p.a == null && p.b == null).length;

  return (
    <div className="pr-backdrop" onClick={onClose}>
      <div
        className="pr-dialog"
        role="dialog"
        aria-label="Pair pages"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pr-head">
          <div>
            <b>Pair pages</b>
            <div className="pr-sub">Click a page to choose which one it is compared with.</div>
          </div>
          <span className="spacer" />
          <button className="btn sm" onClick={onClose} title="Close without applying (Esc)">
            ✕
          </button>
        </div>

        <div className="pr-cols">
          <span />
          <span className="pr-colhead">
            <span className="doc-chip gold">GOLDEN</span>
            <span className="pr-name" title={sideA?.name ?? ''}>{sideA?.name}</span>
          </span>
          <span />
          <span className="pr-colhead">
            <span className="doc-chip test">TO TEST</span>
            <span className="pr-name" title={sideB?.name ?? ''}>{sideB?.name}</span>
          </span>
          <span />
        </div>

        <div className="pr-body">
          {draft.map((p, row) => (
            <div
              key={row}
              className={`pr-row ${p.a == null || p.b == null ? 'onesided' : ''} ${
                (p.a != null && dupA.has(p.a)) || (p.b != null && dupB.has(p.b)) ? 'dupe' : ''
              }`}
            >
              <span className="pr-idx">{row + 1}</span>
              <Cell
                page={p.a}
                doc={sideA?.doc ?? null}
                side="gold"
                onOpen={() => setPicking({ row, side: 'gold' })}
              />
              <span className="pr-vs">↔</span>
              <Cell
                page={p.b}
                doc={sideB?.doc ?? null}
                side="test"
                onOpen={() => setPicking({ row, side: 'test' })}
              />
              <button className="pr-del" onClick={() => removeRow(row)} title="Remove this pair">
                ✕
              </button>
            </div>
          ))}

          <button className="pr-add" onClick={addRow}>
            + Add a pair
          </button>
        </div>

        {(blanks > 0 || dupA.size > 0 || dupB.size > 0) && (
          <div className="pr-warn">
            {(dupA.size > 0 || dupB.size > 0) && (
              <div>⚠ A page appears in more than one pair, so it will be compared twice.</div>
            )}
            {blanks > 0 && (
              <div>
                ⚠ {blanks} row{blanks === 1 ? '' : 's'} with no page on either side — dropped on Done.
              </div>
            )}
          </div>
        )}

        <div className="pr-foot">
          <button
            className="btn sm"
            onClick={() => setDraft(sequentialPairs(sideA?.pageCount ?? 0, sideB?.pageCount ?? 0))}
          >
            Reset to page by page
          </button>
          <span className="spacer" />
          <button className="btn sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn sm primary"
            onClick={() => {
              setPairs(draft.filter((p) => p.a != null || p.b != null));
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>

      {picking && (
        <PagePicker
          doc={(picking.side === 'gold' ? sideA?.doc : sideB?.doc)!}
          title={(picking.side === 'gold' ? sideA?.name : sideB?.name) ?? ''}
          side={picking.side}
          selected={picking.side === 'gold' ? draft[picking.row].a : draft[picking.row].b}
          onPick={(page) => {
            choose(picking.row, picking.side, page);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

/**
 * The toolbar control.
 *
 * What the button says is what it does. Pairing and un-pairing are never the
 * same button, so a click is never ambiguous; adjusting an existing pairing is
 * the chip beside it.
 */
export function PagePairingButton({ onOpen }: { onOpen: () => void }) {
  const pairs = useCompareStore((s) => s.pairs);
  const edited = useCompareStore((s) => s.pairsEdited);
  const resetPairs = useCompareStore((s) => s.resetPairs);
  const countA = useCompareStore((s) => s.sideA?.pageCount ?? 0);
  const countB = useCompareStore((s) => s.sideB?.pageCount ?? 0);

  if (pairs.length <= 1) return null;

  if (!edited || isSequential(pairs)) {
    return (
      <button
        className={`btn sm pr-open ${countA !== countB ? 'warn' : ''}`}
        onClick={onOpen}
        title={
          countA !== countB
            ? `The golden PDF has ${countA} pages and the PDF to test has ${countB}, and they are being compared page by page. If a page was added or removed, every page after it is being compared with the wrong one.`
            : 'Choose which page is compared with which'
        }
      >
        ⇄ Pair pages
      </button>
    );
  }

  return (
    <>
      <button className="btn sm pr-edit" onClick={onOpen} title="Change the pairing">
        ⇄ {pairs.length} pairs
      </button>
      <button
        className="btn sm pr-revert"
        onClick={resetPairs}
        title="Go back to comparing page 1 with page 1, page 2 with page 2, and so on"
      >
        Revert to page by page comparison
      </button>
    </>
  );
}
