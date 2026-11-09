import { useMemo, useState } from 'react';
import AnnotationLayer, { AnnotationToolbar } from './AnnotationLayer';
import { flags } from '../../flags';
import { ignoredRefsFor, useIgnoreStore } from '../../store/ignoreStore';
import { partitionByRegion, regionsFor, useRegionStore } from '../../store/regionStore';
import type { LayoutViewMode, MatchedPair, RenderedPageImage, TextItem } from '@pdfsuite/core';
import { useCompareStore } from '../../store/compareStore';
import {
  buildChanges,
  heatmapBoxes,
  HEAT_COLOR,
  HEAT_HINT,
  HEAT_LABEL,
  type HeatBox,
  type HeatBucket,
} from '@pdfsuite/compare';
import MeasureOverlay from './MeasureOverlay';

const MAX_DISPLAY_H = 460;

function pixelClass(ratio: number): string {
  if (ratio < 0.005) return 'good';
  if (ratio < 0.05) return 'warn';
  return 'bad';
}

const viewLabels: [LayoutViewMode, string][] = [
  ['side-by-side', 'Side by side'],
  ['diff', 'Pixel diff'],
];

// Side by side is feature-flagged; with it off, Layout has a single view and
// the tab strip has nothing to switch between, so it is not rendered at all.
//
// Computed per render, not once per module: the host configures the flags
// when `<PdfSuiteApp>` mounts, which is after this module is evaluated (W-33).
const views = () => viewLabels.filter(([v]) => v !== 'side-by-side' || flags.layoutSideBySide);

// Display-only box marking the hovered run on a page image.
function RunHighlight({ box, image }: { box: TextItem | undefined; image: RenderedPageImage }) {
  if (!box) return null;
  return (
    <div
      className="run-hl"
      style={{
        left: `${(box.x / image.width) * 100}%`,
        top: `${(box.y / image.height) * 100}%`,
        width: `${(box.w / image.width) * 100}%`,
        height: `${(box.h / image.height) * 100}%`,
      }}
    />
  );
}

// Transparent hover targets over each run (used in side-by-side, where there is no measure overlay).
function RunHotspots({
  runs,
  side,
  image,
  onHover,
}: {
  runs: MatchedPair[];
  side: 'A' | 'B';
  image: RenderedPageImage;
  onHover: (i: number | null) => void;
}) {
  return (
    <>
      {runs.map((p, i) => {
        const t = side === 'A' ? p.a : p.b;
        return (
          <div
            key={i}
            className="run-hotspot"
            title={p.str}
            style={{
              left: `${(t.x / image.width) * 100}%`,
              top: `${(t.y / image.height) * 100}%`,
              width: `${(t.w / image.width) * 100}%`,
              height: `${(t.h / image.height) * 100}%`,
            }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </>
  );
}

// Translucent coloured regions on the pixel-diff heatmap — amber where the words
// changed, cyan where only the type changed, violet where a run merely moved — so
// the cause of a difference is readable at a glance.
function HeatBoxOverlay({ boxes, image }: { boxes: HeatBox[]; image: RenderedPageImage }) {
  return (
    <>
      {boxes.map((b) => (
        <div
          key={b.id}
          className="heat-box"
          style={{
            left: `${(b.box.x / image.width) * 100}%`,
            top: `${(b.box.y / image.height) * 100}%`,
            width: `${(b.box.w / image.width) * 100}%`,
            height: `${(b.box.h / image.height) * 100}%`,
            borderColor: HEAT_COLOR[b.type],
            background: `${HEAT_COLOR[b.type]}26`,
          }}
        />
      ))}
    </>
  );
}

export default function LayoutCompareView() {
  const currentPage = useCompareStore((s) => s.currentPage);
  const pc = useCompareStore((s) => s.pageCache[s.currentPage]);
  const computing = useCompareStore((s) => s.computing);

  const viewMode = useCompareStore((s) => s.viewMode);
  const offsetThresholdIn = useCompareStore((s) => s.offsetThresholdIn);
  const layoutZoom = useCompareStore((s) => s.layoutZoom);

  const setViewMode = useCompareStore((s) => s.setViewMode);
  const setLayoutZoom = useCompareStore((s) => s.setLayoutZoom);

  // Hovered run — links the geometry table and the page image both ways.
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hoverFromImage = (i: number | null) => setHoveredIdx(i);

  // Heatmap classification: edited runs become text regions, restyled runs style
  // regions, and merely-shifted runs layout regions — reused for both the coloured
  // overlay and the hover tooltip.
  // A difference marked expected is gone from here too, so the heat map and the
  // shift measurements agree with what Side by side shows.
  const ignoredMap = useIgnoreStore((s) => s.ignored);
  const ignoredKeys = useMemo(() => ignoredRefsFor(ignoredMap, currentPage), [ignoredMap, currentPage]);
  // Ignored regions drop out here as well, for the same reason: an area whose
  // changes are expected should not light the heat map up.
  const regions = useRegionStore((s) => s.regions);
  const pageRegions = useMemo(() => regionsFor(regions, currentPage), [regions, currentPage]);
  const regionRef = pc?.imageA ?? pc?.imageB ?? null;
  const changes = useMemo(() => {
    if (!pc) return [];
    const all = buildChanges(pc, offsetThresholdIn);
    const { tested } = partitionByRegion(
      all,
      pageRegions,
      regionRef?.width ?? 0,
      regionRef?.height ?? 0,
    );
    return tested.filter((c) => !ignoredKeys.has(c.key));
  }, [pc, offsetThresholdIn, ignoredKeys, pageRegions, regionRef]);
  const heatBoxes = useMemo(() => heatmapBoxes(changes), [changes]);
  const movedChanges = useMemo(() => changes.filter((c) => c.type === 'moved'), [changes]);
  const styledChanges = useMemo(() => changes.filter((c) => c.type === 'styled'), [changes]);
  const heatCounts = useMemo(() => {
    const c: Record<HeatBucket, number> = { layout: 0, text: 0, style: 0 };
    for (const b of heatBoxes) c[b.type]++;
    return c;
  }, [heatBoxes]);

  if (computing && !pc) {
    return (
      <div className="loading-center">
        <span className="spinner" /> Computing layout comparison…
      </div>
    );
  }
  if (!pc) return <div className="loading-center">Preparing…</div>;

  const refImg = pc.imageA ?? pc.imageB;
  const fitScale = refImg ? Math.min(1, MAX_DISPLAY_H / refImg.height) : 1;
  const dispScale = fitScale * layoutZoom;
  const dispW = refImg ? refImg.width * dispScale : 0;
  const dispH = refImg ? refImg.height * dispScale : 0;
  const zoomPct = Math.round(dispScale * 100);

  const matched = [...pc.match.matched].sort((a, b) => b.offset - a.offset).slice(0, 200);
  const hovered = hoveredIdx != null ? matched[hoveredIdx] : undefined;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Controls */}
      <div className="layout-controls">
        {views().length > 1 && (
        <div className="tabs">
          {views().map(([v, label]) => (
            <button
              key={v}
              className={`tab ${viewMode === v ? 'active' : ''}`}
              onClick={() => setViewMode(v)}
            >
              {label}
            </button>
          ))}
        </div>
        )}

        {/* Pixel sensitivity and anti-alias handling are engine settings now, not
            controls: they sit at their defaults in the store. */}
        {viewMode === 'diff' && (
          <span className="diff-hint">Hover a change for before → after</span>
        )}

        {viewMode === 'side-by-side' && flags.annotations && <AnnotationToolbar page={currentPage} />}

        <div className="spacer" />

        {/* Zoom controls */}
        <div className="zoom-group" title="Zoom the page view">
          <button className="zoombtn" onClick={() => setLayoutZoom(layoutZoom / 1.25)} title="Zoom out">
            −
          </button>
          <span className="zoom-label">{zoomPct}%</span>
          <button className="zoombtn" onClick={() => setLayoutZoom(layoutZoom * 1.25)} title="Zoom in">
            +
          </button>
          <button className="btn sm" onClick={() => setLayoutZoom(1)} title="Fit to view">
            Fit
          </button>
          {fitScale > 0 && (
            <button className="btn sm" onClick={() => setLayoutZoom(1 / fitScale)} title="Actual pixel size">
              1:1
            </button>
          )}
        </div>

        {viewMode === 'diff' && pc.pixel && (
          <span className={`pixel-badge ${pixelClass(pc.pixel.ratio)}`}>
            {(pc.pixel.ratio * 100).toFixed(2)}% different
          </span>
        )}
      </div>

      {/* Heatmap legend */}
      {viewMode === 'diff' && pc.pixel && (heatCounts.text > 0 || heatCounts.style > 0 || heatCounts.layout > 0) && (
        <div className="heat-legend">
          {(['text', 'style', 'layout'] as HeatBucket[]).map((bucket) => (
            <span key={bucket} className="heat-item" title={HEAT_HINT[bucket]}>
              <i
                className="heat-dot"
                style={{ borderColor: HEAT_COLOR[bucket], background: `${HEAT_COLOR[bucket]}33` }}
              />
              {HEAT_LABEL[bucket]}
              {heatCounts[bucket] > 0 ? ` · ${heatCounts[bucket]}` : ''}
            </span>
          ))}
          <span className="legend-hint">Hover a region for before → after.</span>
        </div>
      )}

      {/* Image stage */}
      <div className="stage">
        <div className="stage-content">
          {viewMode === 'side-by-side' && (
            <div className="stage-sbs">
              {pc.imageA ? (
                <div className="lay-img-wrap" style={{ width: dispW, height: dispH }}>
                  <img src={pc.imageA.dataUrl} alt="Golden PDF" style={{ width: dispW, height: dispH }} />
                  <RunHotspots runs={matched} side="A" image={pc.imageA} onHover={hoverFromImage} />
                  <RunHighlight box={hovered?.a} image={pc.imageA} />
                  {flags.annotations && <AnnotationLayer page={currentPage} side="A" />}
                </div>
              ) : (
                <div className="page-missing" style={{ width: dispW, height: dispH }}>
                  No page {currentPage + 1}
                </div>
              )}
              {pc.imageB ? (
                <div className="lay-img-wrap" style={{ width: dispW, height: dispH }}>
                  <img src={pc.imageB.dataUrl} alt="PDF to test" style={{ width: dispW, height: dispH }} />
                  <RunHotspots runs={matched} side="B" image={pc.imageB} onHover={hoverFromImage} />
                  <RunHighlight box={hovered?.b} image={pc.imageB} />
                  {flags.annotations && <AnnotationLayer page={currentPage} side="B" />}
                </div>
              ) : (
                <div className="page-missing" style={{ width: dispW, height: dispH }}>
                  No page {currentPage + 1}
                </div>
              )}
            </div>
          )}

          {viewMode === 'diff' &&
            (pc.pixel ? (
              <div className="stack" style={{ width: dispW, height: dispH }}>
                <img className="base" src={pc.pixel.diffDataUrl} alt="diff" style={{ width: dispW, height: dispH }} />
                <HeatBoxOverlay boxes={heatBoxes} image={refImg!} />
                <RunHighlight box={hovered?.b ?? hovered?.a} image={refImg!} />
                <MeasureOverlay
                  naturalWidth={refImg!.width}
                  pxPerInch={pc.pxPerInch}
                  onlyA={pc.match.onlyA}
                  onlyB={pc.match.onlyB}
                  moved={movedChanges}
                  styled={styledChanges}
                />
              </div>
            ) : (
              <div className="stage-notice">
                Pixel diff unavailable — one side is missing this page or the page sizes differ.
              </div>
            ))}
        </div>
      </div>

    </div>
  );
}
