import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCompareStore } from '../../store/compareStore';
import type { CompareSide, RenderedPageImage } from '@pdfsuite/core';
import {
  buildChanges,
  changeSummary,
  fmtInch,
  isOnSide,
  TYPE_LABEL,
  type Change,
  type ChangeType,
} from '@pdfsuite/compare';
import { ignoredList, ignoredRefsFor, useIgnoreStore } from '../../store/ignoreStore';
import { partitionByRegion, regionOf, regionsFor, useRegionStore } from '../../store/regionStore';
import DataRegionLayer, { DataRegionToolbar } from './DataRegionLayer';
import AnnotationLayer, { AnnotationToolbar } from './AnnotationLayer';
import { flags } from '../../flags';

const TYPE_ORDER: ChangeType[] = ['removed', 'added', 'styled', 'moved'];

const LEGEND_HELP =
  'Removed / added = the words changed. Restyled = same words, different type. Moved = same words and type, shifted.\n\nClick a type to filter it out. Hover a change to link it to the page.';

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

type DrawerTab = 'changes' | 'diff' | 'ignored';

// Fit height for a page in this view. Two pages sit side by side, so this is
// shorter than the single-stage Overlapping view uses.
const MAX_DISPLAY_H = 520;
/** Gap between the two page frames, matching .pages-row in the stylesheet. */
const PAGE_GAP = 16;

// ── Rendered page with change boxes overlaid ──────────────────────────
function PageWithBoxes({
  image,
  side,
  label,
  changes,
  hlGroup,
  setHighlighted,
  currentPage,
  dispW,
  dispH,
}: {
  image: RenderedPageImage | null;
  side: CompareSide;
  label: string;
  changes: Change[];
  hlGroup: number | null;
  setHighlighted: (id: number | null) => void;
  currentPage: number;
  dispW: number;
  dispH: number;
}) {
  const boxes = changes.filter((c) => isOnSide(c, side));

  return (
    <div className="page-frame">
      <div className="plabel">{label}</div>
      {image ? (
        <div className="page-overlay-wrap" style={{ width: dispW, height: dispH }}>
          <img src={image.dataUrl} alt={`Page ${side}`} style={{ width: dispW, height: dispH }} />
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
                <span className="chg-num-badge">{c.label}</span>
              </div>
            );
          })}
          {flags.annotations && <AnnotationLayer page={currentPage} side={side} />}
          {/* Regions describe the template, so both sides show the same ones. */}
          <DataRegionLayer page={currentPage} />
        </div>
      ) : (
        <div className="page-missing" style={{ width: dispW, height: dispH }}>
          No corresponding page on this side.
        </div>
      )}
    </div>
  );
}

export default function ContentCompareView() {
  const currentPage = useCompareStore((s) => s.currentPage);
  const pc = useCompareStore((s) => s.pageCache[s.currentPage]);
  const computing = useCompareStore((s) => s.computing);
  const movedThreshold = useCompareStore((s) => s.offsetThresholdIn);
  const contentZoom = useCompareStore((s) => s.contentZoom);
  const ignoredMap = useIgnoreStore((s) => s.ignored);
  const regions = useRegionStore((s) => s.regions);
  const pairs = useCompareStore((s) => s.pairs);
  const drawingRegion = useRegionStore((s) => s.drawing);
  const removeRegion = useRegionStore((s) => s.remove);
  const setDrawingRegion = useRegionStore((s) => s.setDrawing);
  const useRegionTemplate = useRegionStore((s) => s.useTemplate);
  const ignoreChange = useIgnoreStore((s) => s.ignore);
  const restoreChange = useIgnoreStore((s) => s.restore);
  const setContentZoom = useCompareStore((s) => s.setContentZoom);

  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stageW, setStageW] = useState(0);
  /** The change whose ⋯ menu is open, which step it is on, and the reason typed so far. */
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [menuStep, setMenuStep] = useState<'menu' | 'reason'>('menu');
  const [reason, setReason] = useState('');
  /** Rows ticked for a group action, by change id. */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchReason, setBatchReason] = useState('');
  /** Last row ticked, so shift-click can take the span up to this one. */
  const [anchor, setAnchor] = useState<number | null>(null);
  /** Ignored regions whose contents are expanded in the Ignored tab. */
  const [openRegions, setOpenRegions] = useState<Set<string>>(new Set());
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('changes');
  const [enabled, setEnabled] = useState<Record<ChangeType, boolean>>({
    removed: true,
    added: true,
    styled: true,
    moved: true,
  });

  const ignoredKeys = useMemo(() => ignoredRefsFor(ignoredMap, currentPage), [ignoredMap, currentPage]);
  const ignoredHere = useMemo(
    () => ignoredList(ignoredMap).filter((e) => e.page === currentPage).length,
    [ignoredMap, currentPage],
  );
  const allIgnored = useMemo(() => ignoredList(ignoredMap), [ignoredMap]);

  // Everything downstream — the page boxes, the counts, the list, the filters —
  // works from the surviving changes, so one filter here removes an ignored
  // difference from the whole view.
  const allChanges = useMemo(
    () => (pc ? buildChanges(pc, movedThreshold) : []),
    [pc, movedThreshold],
  );
  // Two routes to the same verdict, applied in order: a region ignores an area,
  // an ignore accepts one difference. Regions come first — a difference inside
  // one is already decided, so it never reaches the per-difference check.
  const pageRegions = useMemo(() => regionsFor(regions, currentPage), [regions, currentPage]);
  const refImgForRegions = pc?.imageA ?? pc?.imageB ?? null;
  const split = useMemo(
    () =>
      partitionByRegion(
        allChanges,
        pageRegions,
        refImgForRegions?.width ?? 0,
        refImgForRegions?.height ?? 0,
      ),
    [allChanges, pageRegions, refImgForRegions],
  );
  const changes = useMemo(
    () => split.tested.filter((c) => !ignoredKeys.has(c.key)),
    [split, ignoredKeys],
  );

  const counts = useMemo(() => {
    const c: Record<ChangeType, number> = { removed: 0, added: 0, styled: 0, moved: 0 };
    for (const ch of changes) c[ch.type]++;
    return c;
  }, [changes]);

  const visible = useMemo(() => changes.filter((c) => enabled[c.type]), [changes, enabled]);

  // A selection is a set of rows, but a decision is per difference: the two
  // halves of a replacement are one thing, so they tick and ignore together.
  const selectedGroups = useMemo(() => {
    const groups = new Set<number>();
    for (const c of visible) if (selected.has(c.id)) groups.add(c.group);
    return groups;
  }, [visible, selected]);

  const selectIds = (rows: Change[]) => {
    const groups = new Set(rows.map((c) => c.group));
    setSelected(new Set(visible.filter((c) => groups.has(c.group)).map((c) => c.id)));
  };

  /** Tick or untick a row, taking the whole span on shift-click. */
  const toggleRow = (c: Change, on: boolean, span: boolean) => {
    const next = new Set(selected);
    let rows = [c];
    if (span && anchor != null) {
      const from = visible.findIndex((v) => v.id === anchor);
      const to = visible.findIndex((v) => v.id === c.id);
      if (from >= 0 && to >= 0) {
        rows = visible.slice(Math.min(from, to), Math.max(from, to) + 1);
      }
    }
    const groups = new Set(rows.map((r) => r.group));
    for (const v of visible) {
      if (!groups.has(v.group)) continue;
      if (on) next.add(v.id);
      else next.delete(v.id);
    }
    setSelected(next);
    setAnchor(c.id);
  };

  /** One reason, recorded against every selected difference. */
  const ignoreSelected = () => {
    const done = new Set<number>();
    for (const c of visible) {
      if (!selected.has(c.id) || done.has(c.group)) continue;
      done.add(c.group);
      ignoreChange({
        page: currentPage,
        key: c.key,
        label: c.label,
        summary: changeSummary(allChanges.filter((m) => m.group === c.group)),
        reason: batchReason.trim(),
      });
    }
    setSelected(new Set());
    setAnchor(null);
    setBatchOpen(false);
    setBatchReason('');
  };

  // What each region is actually covering, over every page compared so far. A
  // page not yet computed contributes nothing, so a region's list fills in as
  // the user moves through the document rather than claiming a wrong zero.
  const pageCache = useCompareStore((s) => s.pageCache);
  const regionChanges = useMemo(() => {
    const out = new Map<string, Change[]>();
    for (const [key, cached] of Object.entries(pageCache)) {
      const page = Number(key);
      const here = regionsFor(regions, page);
      if (here.length === 0) continue;
      const ref = cached.imageA ?? cached.imageB ?? null;
      for (const c of buildChanges(cached, movedThreshold)) {
        const r = regionOf(c, here, ref?.width ?? 0, ref?.height ?? 0);
        if (!r) continue;
        const list = out.get(r.id);
        if (list) list.push(c);
        else out.set(r.id, [c]);
      }
    }
    return out;
  }, [pageCache, regions, movedThreshold]);

  const regionList = useMemo(
    () => [...regions].sort((a, b) => a.page - b.page || a.y - b.y),
    [regions],
  );

  // The highlight group of the hovered change — paired removed/added share a group,
  // so hovering either half lights up both.
  const groupById = useMemo(() => new Map(changes.map((c) => [c.id, c.group])), [changes]);
  const labelById = useMemo(() => new Map(changes.map((c) => [c.id, c.label])), [changes]);
  const hlGroup = highlighted != null ? groupById.get(highlighted) ?? null : null;

  // Fit has to mean "fits", so it answers to the width actually on offer as
   // well as a height cap — the column narrows when the drawer opens, and laptop
   // viewports vary. Measured on the card rather than the page row, since the
   // row's own width follows the pages and would feed back into itself.
  const roRef = useRef<ResizeObserver | null>(null);
  const measureStage = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    roRef.current = ro;
    setStageW(el.clientWidth);
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  useEffect(() => {
    setSelected(new Set());
    setAnchor(null);
    setBatchOpen(false);
  }, [currentPage, ignoredMap, regions]);

  useEffect(() => {
    setOpenRegions((prev) => {
      const live = new Set(regions.map((r) => r.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [regions]);

  // Regions describe a template, so they follow the golden PDF: compare the same
  // golden against a second candidate and the declarations are already there.
  const goldenName = useCompareStore((s) => s.sideA?.name ?? '');
  useEffect(() => {
    useRegionTemplate(goldenName);
  }, [goldenName, useRegionTemplate]);

  useEffect(() => {
    if (!drawingRegion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawingRegion(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawingRegion, setDrawingRegion]);

  useEffect(() => {
    if (menuFor == null) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.chg-more')) setMenuFor(null);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuFor]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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

  // Each page's own number, which is not the navigation position once a pairing
   // is in force — reading "GOLDEN PDF" over page 7 while the test shows page 5
   // is exactly the confusion the pairing exists to remove.
  const pair = pairs[currentPage];
  const pageTitle = (side: 'A' | 'B') => {
    const base = side === 'A' ? 'Golden PDF' : 'PDF to test';
    const n = side === 'A' ? pair?.a : pair?.b;
    if (!pair || (pair.a === currentPage && pair.b === currentPage)) return base;
    return n == null ? `${base} — no page` : `${base} · page ${n + 1}`;
  };

  const refImg = pc.imageA ?? pc.imageB;
  const widthFit = refImg && stageW ? (stageW - PAGE_GAP) / (refImg.width * 2) : 1;
  const fitScale = refImg ? Math.min(1, MAX_DISPLAY_H / refImg.height, widthFit) : 1;
  const dispScale = fitScale * contentZoom;
  const dispW = refImg ? refImg.width * dispScale : 0;
  const dispH = refImg ? refImg.height * dispScale : 0;
  const zoomPct = Math.round(dispScale * 100);

  const bothEmpty = !pc.textA && !pc.textB;

  return (
    <div className={`stack-col content-view ${drawerOpen ? 'drawer-open' : ''}`}>
      {/* Rendered pages with change highlights */}
      <div className="card section-pad" ref={measureStage}>
        <div className="overlay-legend">
          <div className="legend-chips">
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
            {/* The full explanation is a tooltip rather than a paragraph: it is
                read once, but it was crowding the bar on every page. */}
            <button className="legend-info" title={LEGEND_HELP} aria-label="What the change types mean">
              ?
            </button>
          </div>

          <div className="spacer" />

          {flags.annotations && <AnnotationToolbar page={currentPage} />}

          <DataRegionToolbar page={currentPage} inDataCount={split.inData.length} />

          <div className="zoom-group" title="Zoom the page view">
            <button className="zoombtn" onClick={() => setContentZoom(contentZoom / 1.25)} title="Zoom out">
              −
            </button>
            <span className="zoom-label">{zoomPct}%</span>
            <button className="zoombtn" onClick={() => setContentZoom(contentZoom * 1.25)} title="Zoom in">
              +
            </button>
            <button className="btn sm" onClick={() => setContentZoom(1)} title="Fit to view">
              Fit
            </button>
            {fitScale > 0 && (
              <button className="btn sm" onClick={() => setContentZoom(1 / fitScale)} title="Actual pixel size">
                1:1
              </button>
            )}
          </div>

          <button
            className={`btn sm view-changes ${drawerOpen ? 'on' : ''}`}
            onClick={() => setDrawerOpen((o) => !o)}
            aria-expanded={drawerOpen}
            title="Open the change list and the verbiage differences"
          >
            <i className="drawer-ico" aria-hidden="true">
              <span />
            </i>
            View changes{changes.length > 0 ? ` · ${changes.length}` : ''}
            {ignoredHere > 0 && <span className="ign-badge">{ignoredHere} ignored</span>}
          </button>
        </div>
        <div className="pages-row">
          <PageWithBoxes
            image={pc.imageA}
            side="A"
            label={pageTitle('A')}
            changes={visible}
            hlGroup={hlGroup}
            setHighlighted={setHighlighted}
            currentPage={currentPage}
            dispW={dispW}
            dispH={dispH}
          />
          <PageWithBoxes
            image={pc.imageB}
            side="B"
            label={pageTitle('B')}
            changes={visible}
            hlGroup={hlGroup}
            setHighlighted={setHighlighted}
            currentPage={currentPage}
            dispW={dispW}
            dispH={dispH}
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

      {/* The change list and the word diff are reference material read against
          the pages, not something to scroll past to reach them — so they live in
          a drawer. Deliberately non-modal: hovering an entry highlights its box
          on the pages, which have to stay visible. */}
      {drawerOpen && (
        <aside className="chg-drawer" role="dialog" aria-label="Changes on this page">
          <div className="chg-drawer-head">
            <div className="tabs">
              <button
                className={`tab ${drawerTab === 'changes' ? 'active' : ''}`}
                onClick={() => setDrawerTab('changes')}
              >
                Changes{changes.length > 0 ? ` · ${visible.length}` : ''}
              </button>
              <button
                className={`tab ${drawerTab === 'diff' ? 'active' : ''}`}
                onClick={() => setDrawerTab('diff')}
              >
                Verbiage differences
              </button>
              <button
                className={`tab ${drawerTab === 'ignored' ? 'active' : ''}`}
                onClick={() => setDrawerTab('ignored')}
              >
                Ignored
                {allIgnored.length + regionList.length > 0
                  ? ` · ${allIgnored.length + regionList.length}`
                  : ''}
              </button>
            </div>
            <span className="spacer" />
            <button className="btn sm" onClick={() => setDrawerOpen(false)} title="Close (Esc)">
              ✕
            </button>
          </div>

          <div className="chg-drawer-body">
            {drawerTab === 'changes' ? (
              changes.length === 0 ? (
                <div className="chg-empty">
                  ✓ No positional text changes detected on page {currentPage + 1}.
                </div>
              ) : visible.length === 0 ? (
                <div className="chg-empty muted-empty">
                  All change types are hidden — enable a filter in the toolbar.
                </div>
              ) : (
                <>
                  <div className="bulk-bar">
                    {selectedGroups.size === 0 ? (
                      <>
                        <span className="bulk-lead">Select</span>
                        <button
                          className="btn sm"
                          title="Select every difference listed on this page"
                          onClick={() => selectIds(visible)}
                        >
                          All on page
                        </button>
                        {TYPE_ORDER.filter((t) => enabled[t] && counts[t] > 0).map((t) => (
                          <button
                            key={t}
                            className="btn sm"
                            title={`Select every ${TYPE_LABEL[t].toLowerCase()} difference on this page`}
                            onClick={() => selectIds(visible.filter((c) => c.type === t))}
                          >
                            <i className={`dot ${t}`} /> {TYPE_LABEL[t]}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        <span className="bulk-count">
                          {selectedGroups.size} selected
                        </span>
                        <span className="spacer" />
                        <button
                          className="btn sm"
                          onClick={() => {
                            setSelected(new Set());
                            setAnchor(null);
                            setBatchOpen(false);
                          }}
                        >
                          Clear
                        </button>
                        <button
                          className="btn sm primary"
                          onClick={() => {
                            setBatchReason('');
                            setBatchOpen(true);
                          }}
                        >
                          Ignore selected
                        </button>
                      </>
                    )}
                  </div>

                  {batchOpen && (
                    <div className="bulk-reason">
                      <div className="chg-menu-head">
                        Why are these {selectedGroups.size} expected?
                      </div>
                      <textarea
                        autoFocus
                        value={batchReason}
                        placeholder="Optional — recorded against each of them in the report"
                        onChange={(e) => setBatchReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setBatchOpen(false);
                        }}
                      />
                      <div className="chg-menu-foot">
                        <button className="btn sm" onClick={() => setBatchOpen(false)}>
                          Cancel
                        </button>
                        <span className="spacer" />
                        <button className="btn sm primary" onClick={ignoreSelected}>
                          Ignore {selectedGroups.size}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="chg-list">
                  {visible.map((c) => (
                      <div
                        key={c.id}
                        className={`chg-item ${c.group === hlGroup ? 'hl' : ''} ${
                          selected.has(c.id) ? 'picked' : ''
                        }`}
                        onMouseEnter={() => setHighlighted(c.id)}
                        onMouseLeave={() => setHighlighted(null)}
                      >
                        <input
                          type="checkbox"
                          className="chg-pick"
                          checked={selected.has(c.id)}
                          aria-label={`Select difference ${c.label}`}
                          title="Shift-click to take the span from the last one ticked"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            toggleRow(
                              c,
                              e.target.checked,
                              (e.nativeEvent as MouseEvent).shiftKey,
                            )
                          }
                        />
                        <span className={`chg-num chg-${c.type}`}>{c.label}</span>
                        <span className={`chg-chip chg-${c.type}`}>{TYPE_LABEL[c.type]}</span>
                        <span className="chg-text" title={c.text}>
                          {(c.a ?? c.b)?.kind === 'image' ? <em>🖼 Image</em> : c.text}
                        </span>

                        <span className="chg-more">
                          <button
                            className="chg-more-btn"
                            title="Mark this difference as expected"
                            aria-label="Difference options"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReason('');
                              setMenuStep('menu');
                              setMenuFor(menuFor === c.id ? null : c.id);
                            }}
                          >
                            ⋯
                          </button>

                          {menuFor === c.id && menuStep === 'menu' && (
                            <div className="chg-menu compact" onClick={(e) => e.stopPropagation()}>
                              <button className="chg-menu-item" onClick={() => setMenuStep('reason')}>
                                Ignore this difference
                                <small>Expected — remove it from the comparison</small>
                              </button>
                            </div>
                          )}

                          {menuFor === c.id && menuStep === 'reason' && (
                            <div className="chg-menu" onClick={(e) => e.stopPropagation()}>
                              <div className="chg-menu-head">Why is this expected?</div>
                              <textarea
                                autoFocus
                                value={reason}
                                placeholder="Optional — recorded in the report"
                                onChange={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setMenuFor(null);
                                }}
                              />
                              <div className="chg-menu-foot">
                                <button className="btn sm" onClick={() => setMenuStep('menu')}>
                                  Back
                                </button>
                                <span className="spacer" />
                                <button
                                  className="btn sm primary"
                                  onClick={() => {
                                    const members = allChanges.filter((m) => m.group === c.group);
                                    ignoreChange({
                                      page: currentPage,
                                      key: c.key,
                                      label: c.label,
                                      summary: changeSummary(members),
                                      reason: reason.trim(),
                                    });
                                    setMenuFor(null);
                                    setReason('');
                                  }}
                                >
                                  Ignore
                                </button>
                              </div>
                            </div>
                          )}
                        </span>
                        {/* Only what changed — an added or removed run has no
                            second line, since its coordinates say nothing the
                            highlighted box on the page does not already show. */}
                        {c.type === 'styled' && c.style ? (
                          <span className="chg-pos">{c.style.summary}</span>
                        ) : c.type === 'moved' && c.offset != null ? (
                          <span className="chg-pos">moved {fmtInch(c.offset, pc.pxPerInch)}</span>
                        ) : null}
                      </div>
                  ))}
                  </div>
                </>
              )
            ) : drawerTab === 'ignored' ? (
              allIgnored.length === 0 && regionList.length === 0 ? (
                <div className="chg-empty muted-empty">
                  Nothing ignored. Use the ⋯ menu on a change to mark it as expected,
                  or ▦ Ignore a region to accept a whole area at once.
                </div>
              ) : (
                <div className="ign-list">
                  {regionList.length > 0 && (
                    <>
                      <div className="ign-group">
                        Regions · {regionList.length}
                      </div>
                      {regionList.map((r) => {
                        const inside = regionChanges.get(r.id) ?? [];
                        const open = openRegions.has(r.id);
                        return (
                          <div key={r.id} className="ign-item region">
                            <div className="ign-head">
                              <span className="ign-page">Page {r.page + 1}</span>
                              <span className="ign-kind">▦ Region</span>
                              <span className="spacer" />
                              <button
                                className="btn sm"
                                onClick={() => removeRegion(r.id)}
                                title="Put this area back into the comparison"
                              >
                                Undo
                              </button>
                            </div>
                            <div className="ign-summary">{r.label}</div>

                            {inside.length === 0 ? (
                              <div className="ign-reason">No changes inside this area so far</div>
                            ) : (
                              <button
                                className="ign-expand"
                                aria-expanded={open}
                                onClick={() =>
                                  setOpenRegions((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(r.id)) next.delete(r.id);
                                    else next.add(r.id);
                                    return next;
                                  })
                                }
                              >
                                <span className={`caret ${open ? 'open' : ''}`}>▸</span>
                                {inside.length} change{inside.length === 1 ? '' : 's'} ignored
                                {open ? '' : ' — show'}
                              </button>
                            )}

                            {open && (
                              <div className="ign-sub">
                                {inside.map((c) => (
                                  <div key={c.id} className="ign-sub-item">
                                    <span className={`chg-chip chg-${c.type}`}>
                                      {TYPE_LABEL[c.type]}
                                    </span>
                                    <span className="chg-text" title={c.text}>
                                      {(c.a ?? c.b)?.kind === 'image' ? <em>🖼 Image</em> : c.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {allIgnored.length > 0 && regionList.length > 0 && (
                    <div className="ign-group">Differences · {allIgnored.length}</div>
                  )}
                  {allIgnored.map((e) => (
                    <div key={e.ref} className="ign-item">
                      <div className="ign-head">
                        <span className="ign-page">Page {e.page + 1}</span>
                        <span className="spacer" />
                        <button
                          className="btn sm"
                          onClick={() => restoreChange(e.ref)}
                          title="Put this difference back into the comparison"
                        >
                          Undo
                        </button>
                      </div>
                      <div className="ign-summary">{e.summary}</div>
                      {e.reason ? (
                        <div className="ign-reason">{e.reason}</div>
                      ) : (
                        <div className="ign-reason none">No reason given</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : bothEmpty ? (
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
                      title={linkId != null ? `Change #${labelById.get(linkId) ?? linkId} — highlighted on the page` : undefined}
                    >
                      {seg.value}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
