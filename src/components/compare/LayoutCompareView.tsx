import { useRef, useState } from 'react';
import type { LayoutViewMode, MatchedPair, RenderedPageImage, TextItem } from '../../types/compare';
import { useCompareStore } from '../../store/compareStore';
import { fmtInch } from '../../services/changes';
import MeasureOverlay from './MeasureOverlay';

const MAX_DISPLAY_H = 460;

function pixelClass(ratio: number): string {
  if (ratio < 0.005) return 'good';
  if (ratio < 0.05) return 'warn';
  return 'bad';
}

// Friendly, direction-worded shift labels (B relative to A), in inches.
function hShift(dx: number, ppi: number): string {
  if (Math.abs(dx / ppi) < 0.005) return 'aligned';
  return `${fmtInch(Math.abs(dx), ppi)} ${dx > 0 ? 'right' : 'left'}`;
}
function vShift(dy: number, ppi: number): string {
  if (Math.abs(dy / ppi) < 0.005) return 'aligned';
  return `${fmtInch(Math.abs(dy), ppi)} ${dy > 0 ? 'down' : 'up'}`;
}

const viewLabels: [LayoutViewMode, string][] = [
  ['side-by-side', 'Side by side'],
  ['diff', 'Pixel diff'],
];

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

export default function LayoutCompareView() {
  const currentPage = useCompareStore((s) => s.currentPage);
  const pc = useCompareStore((s) => s.pageCache[s.currentPage]);
  const computing = useCompareStore((s) => s.computing);

  const viewMode = useCompareStore((s) => s.viewMode);
  const pixelThreshold = useCompareStore((s) => s.pixelThreshold);
  const includeAA = useCompareStore((s) => s.includeAA);
  const offsetThresholdIn = useCompareStore((s) => s.offsetThresholdIn);
  const layoutZoom = useCompareStore((s) => s.layoutZoom);

  const setViewMode = useCompareStore((s) => s.setViewMode);
  const setPixelThreshold = useCompareStore((s) => s.setPixelThreshold);
  const setIncludeAA = useCompareStore((s) => s.setIncludeAA);
  const setOffsetThreshold = useCompareStore((s) => s.setOffsetThreshold);
  const setLayoutZoom = useCompareStore((s) => s.setLayoutZoom);

  // Hovered run — links the geometry table and the page image both ways.
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const rowsRef = useRef<(HTMLTableRowElement | null)[]>([]);

  const hoverFromImage = (i: number | null) => {
    setHoveredIdx(i);
    if (i != null) rowsRef.current[i]?.scrollIntoView({ block: 'nearest' });
  };

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
        <div className="tabs">
          {viewLabels.map(([v, label]) => (
            <button
              key={v}
              className={`tab ${viewMode === v ? 'active' : ''}`}
              onClick={() => setViewMode(v)}
            >
              {label}
            </button>
          ))}
        </div>

        {viewMode === 'diff' && (
          <>
            <div className="range-control">
              <span>Sensitivity</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={pixelThreshold}
                onChange={(e) => setPixelThreshold(Number(e.target.value))}
              />
              <span>{pixelThreshold.toFixed(2)}</span>
            </div>
            <label className="range-control" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeAA}
                onChange={(e) => setIncludeAA(e.target.checked)}
              />
              Flag anti-aliasing
            </label>
            <span className="diff-hint">Hover a change for before → after</span>
          </>
        )}

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

      {/* Image stage */}
      <div className="stage">
        <div className="stage-content">
          {viewMode === 'side-by-side' && (
            <div className="stage-sbs">
              {pc.imageA ? (
                <div className="lay-img-wrap" style={{ width: dispW, height: dispH }}>
                  <img src={pc.imageA.dataUrl} alt="A" style={{ width: dispW, height: dispH }} />
                  <RunHotspots runs={matched} side="A" image={pc.imageA} onHover={hoverFromImage} />
                  <RunHighlight box={hovered?.a} image={pc.imageA} />
                </div>
              ) : (
                <div className="page-missing" style={{ width: dispW, height: dispH }}>
                  No page {currentPage + 1}
                </div>
              )}
              {pc.imageB ? (
                <div className="lay-img-wrap" style={{ width: dispW, height: dispH }}>
                  <img src={pc.imageB.dataUrl} alt="B" style={{ width: dispW, height: dispH }} />
                  <RunHotspots runs={matched} side="B" image={pc.imageB} onHover={hoverFromImage} />
                  <RunHighlight box={hovered?.b} image={pc.imageB} />
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
                <RunHighlight box={hovered?.b ?? hovered?.a} image={refImg!} />
                <MeasureOverlay naturalWidth={refImg!.width} pxPerInch={pc.pxPerInch} onlyA={pc.match.onlyA} onlyB={pc.match.onlyB} />
              </div>
            ) : (
              <div className="stage-notice">
                Pixel diff unavailable — one side is missing this page or the page sizes differ.
              </div>
            ))}
        </div>
      </div>

      {/* Geometry table */}
      <div className="geo-panel">
        <div className="geo-head">
          <span title="How far each shared text run sits in B compared to where it was in A.">
            Text position shifts · {pc.match.matched.length} runs matched · largest shift{' '}
            {fmtInch(pc.maxOffset, pc.pxPerInch)}
          </span>
          <span className="spacer" />
          <label>
            Flag shifts &gt;{' '}
            <input
              type="number"
              min={0}
              step={0.01}
              value={offsetThresholdIn}
              onChange={(e) => setOffsetThreshold(Number(e.target.value))}
            />{' '}
            in
          </label>
        </div>
        <div className="geo-scroll">
          {matched.length === 0 ? (
            <div className="stage-notice">
              No matching text runs to measure (no text layer, or no shared text).
            </div>
          ) : (
            <table className="geo">
              <thead>
                <tr>
                  <th>Text</th>
                  <th>Horizontal</th>
                  <th>Vertical</th>
                  <th style={{ textAlign: 'right' }}>Total shift</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((p, i) => (
                  <tr
                    key={i}
                    ref={(el) => (rowsRef.current[i] = el)}
                    className={`${p.offset > offsetThresholdIn * pc.pxPerInch ? 'flagged' : ''} ${hoveredIdx === i ? 'hl' : ''}`}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.str}
                    </td>
                    <td className={Math.abs(p.dx / pc.pxPerInch) < 0.005 ? 'aligned-cell' : ''}>{hShift(p.dx, pc.pxPerInch)}</td>
                    <td className={Math.abs(p.dy / pc.pxPerInch) < 0.005 ? 'aligned-cell' : ''}>{vShift(p.dy, pc.pxPerInch)}</td>
                    <td className="num off">{fmtInch(p.offset, pc.pxPerInch)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
