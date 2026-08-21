// Export utilities for comparison results.
// Produces JSON, CSV, and a standalone printable HTML report (print → Save as PDF).
// The per-page renderers are exported so the batch report can reuse them.

import type { CompareSummary, PageComparison, PageSummary, RenderedPageImage } from '../types/compare';
import { buildChanges, diffHotspots, isOnSide, region, TYPE_LABEL, CHANGE_COLOR, type Change } from './changes';

export interface ExportThresholds {
  contentPct: number; // e.g. 99   → content match must be ≥ 99%
  pixelPct: number;   // e.g. 2    → pixels different must be ≤ 2%
  offsetIn: number;   // e.g. 0.03 → max offset must be ≤ 0.03 inches
}

export interface ExportMeta {
  nameA: string;
  nameB: string;
  pageCountA: number;
  pageCountB: number;
  generatedAt: string; // ISO string
}

export const pct = (n: number) => (n * 100).toFixed(1) + '%';
export const inchStr = (px: number, pxPerInch: number) => (px / pxPerInch).toFixed(2) + '″';

export function judgePage(p: PageSummary, t: ExportThresholds): boolean {
  if (p.missing) return false;
  return (
    p.contentMatch * 100 >= t.contentPct &&
    p.pixelRatio * 100 <= t.pixelPct &&
    p.maxOffset / p.pxPerInch <= t.offsetIn
  );
}

export function download(filename: string, content: string | Blob, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── JSON export ───────────────────────────────────────────────────────
export function exportJson(summary: CompareSummary, meta: ExportMeta, thresholds: ExportThresholds) {
  const pages = summary.pages.map((p) => ({
    page: p.pageIndex + 1,
    contentMatch: p.contentMatch,
    pixelRatio: p.pixelRatio,
    maxOffsetInches: Number((p.maxOffset / p.pxPerInch).toFixed(3)),
    missing: p.missing,
    pass: judgePage(p, thresholds),
  }));

  const payload = {
    meta,
    thresholds,
    overall: pages.every((p) => p.pass) ? 'PASS' : 'FAIL',
    summary: {
      pageCountA: summary.pageCountA,
      pageCountB: summary.pageCountB,
      pagesCompared: summary.pages.length,
      passCount: pages.filter((p) => p.pass).length,
      failCount: pages.filter((p) => !p.pass).length,
    },
    pages,
  };

  download(`pdf-comparison-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

// ── CSV export ────────────────────────────────────────────────────────
export function exportCsv(summary: CompareSummary, thresholds: ExportThresholds) {
  const header = ['Page', 'ContentMatch%', 'PixelsDifferent%', 'MaxOffsetInches', 'Missing', 'Result'];
  const rows = summary.pages.map((p) => [
    p.pageIndex + 1,
    (p.contentMatch * 100).toFixed(2),
    (p.pixelRatio * 100).toFixed(2),
    (p.maxOffset / p.pxPerInch).toFixed(3),
    p.missing ? 'yes' : 'no',
    judgePage(p, thresholds) ? 'PASS' : 'FAIL',
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\r\n');
  download(`pdf-comparison-${stamp()}.csv`, csv, 'text/csv');
}

// ── shared HTML report pieces (reused by the batch report) ────────────

/** Inner CSS for the report (no <style> tags). */
export const REPORT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #fff; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 19px; }
  .sub { color: #64748b; margin: 0 0 24px; font-size: 14px; }
  .verdict { display: inline-block; padding: 8px 20px; border-radius: 999px; font-weight: 700; font-size: 16px; margin-bottom: 24px; }
  .verdict.pass { background: #dcfce7; color: #166534; }
  .verdict.fail { background: #fee2e2; color: #991b1b; }
  .chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; }
  .chip.pass { background: #dcfce7; color: #166534; }
  .chip.fail { background: #fee2e2; color: #991b1b; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px 32px; margin-bottom: 24px; font-size: 14px; }
  .meta-grid span { color: #64748b; }
  .meta-grid b { color: #1e293b; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 32px; font-size: 14px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  td.result { font-weight: 700; }
  tr.pass td.result { color: #166534; }
  tr.fail td.result { color: #991b1b; }
  tr.missing td.result { color: #b45309; }
  a.jump { color: #4f46e5; text-decoration: none; }
  .page-detail { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
  .page-detail h3 { margin: 0 0 8px; }
  .metrics { display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; color: #64748b; margin-bottom: 8px; }
  .notes { margin: 8px 0; padding-left: 18px; color: #b45309; font-size: 13px; }
  .rpanes { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .pane { flex: 1; min-width: 240px; }
  .pane-label { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px; text-align: center; }
  .pane-missing { border: 1px dashed #cbd5e1; border-radius: 4px; padding: 40px 12px; color: #94a3b8; text-align: center; background: #f8fafc; }
  .rwrap { position: relative; display: inline-block; width: 100%; line-height: 0; }
  .rwrap img { max-width: 100%; width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; }
  .rbox { position: absolute; box-sizing: border-box; border: 1.5px solid; border-radius: 2px; }
  .rbadge { position: absolute; top: -8px; left: -8px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 8px; color: #fff; font-size: 9px; font-weight: 700; line-height: 14px; text-align: center; }
  .rchanges { list-style: none; margin: 14px 0 0; padding: 0; }
  .rchanges li { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-top: 1px solid #f1f5f9; font-size: 13px; }
  .rnum { flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px; color: #fff; font-size: 11px; font-weight: 700; display: inline-grid; place-items: center; }
  .rtype { flex-shrink: 0; font-weight: 600; width: 62px; }
  .rtext { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, Menlo, Consolas, monospace; }
  .rpos { flex-shrink: 0; color: #94a3b8; font-variant-numeric: tabular-nums; }
  .rnochange { color: #059669; font-size: 13px; margin: 12px 0 0; }
  .diffpane { margin-top: 16px; }
  .diffpane .pane-label { text-align: left; }
  .dwrap { max-width: 520px; }
  .dspot { position: absolute; box-sizing: border-box; outline: 1.5px solid rgba(15,23,42,.55); border-radius: 2px; }
  /* Wraps rather than truncating: a before -> after label that ends in an ellipsis
     hides the very edit it is reporting. */
  .dtip { position: absolute; z-index: 5; display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 3px 5px;
    line-height: 1.35; background: #0f172a; color: #fff; font-size: 10px; padding: 4px 7px; border-radius: 6px;
    max-width: 320px; white-space: normal; box-shadow: 0 3px 10px rgba(0,0,0,.3); }
  .dtip.below { top: 100%; margin-top: 3px; } .dtip.above { bottom: 100%; margin-bottom: 3px; }
  .dtip:not(.r) { left: 0; } .dtip.r { right: 0; }
  .dtip .tl { font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; }
  .dtip .tl.rm { color: #fca5a5; } .dtip .tl.ad { color: #86efac; }
  .dtip .tb, .dtip .ta { font-family: ui-monospace, Menlo, Consolas, monospace;
    white-space: pre-wrap; overflow-wrap: anywhere; }
  .dtip .tb { color: #fca5a5; text-decoration: line-through; }
  .dtip .ta { color: #86efac; }
  .dtip .tst { color: #67e8f9; }
  .dtip .tar { color: #64748b; }
  .pair-block { border: 1px solid #cbd5e1; border-radius: 12px; padding: 22px; margin-bottom: 26px; }
  .pair-block > h2 { margin: 0 0 4px; }
  footer { margin-top: 32px; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 0; } }
`;

/** The per-page metric rows (<tr>…) for the summary table. */
export function reportPageRows(summary: CompareSummary, thresholds: ExportThresholds): string {
  return summary.pages
    .map((p) => {
      const missing = p.missing;
      const pass = judgePage(p, thresholds);
      return `<tr class="${missing ? 'missing' : pass ? 'pass' : 'fail'}">
        <td>${p.pageIndex + 1}</td>
        <td>${missing ? '—' : pct(p.contentMatch)}</td>
        <td>${missing ? '—' : pct(p.pixelRatio)}</td>
        <td>${missing ? '—' : inchStr(p.maxOffset, p.pxPerInch)}</td>
        <td class="result">${missing ? 'MISSING' : pass ? '✓ PASS' : '✗ FAIL'}</td>
      </tr>`;
    })
    .join('\n');
}

// Downscale + JPEG-recompress an image dataURL so reports stay small even for big
// batches. Positioning of overlays is unaffected (it's percentage-based).
const REPORT_IMG_MAX_W = 720;
const REPORT_IMG_QUALITY = 0.72;
function shrinkDataUrl(dataUrl: string, maxW = REPORT_IMG_MAX_W, quality = REPORT_IMG_QUALITY): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const iw = img.width || maxW;
      const ih = img.height || maxW;
      const scale = Math.min(1, maxW / iw);
      const w = Math.max(1, Math.round(iw * scale));
      const h = Math.max(1, Math.round(ih * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Per-page annotated visual detail (A/B panes, pixel diff, change list). Async: images are shrunk. */
export async function reportPageDetail(
  summary: CompareSummary,
  pageCache: Record<number, PageComparison>,
  thresholds: ExportThresholds,
): Promise<string> {
  const sections: string[] = [];
  for (const p of summary.pages) {
    const pc = pageCache[p.pageIndex];
    if (!pc) continue;
    const changes = buildChanges(pc, thresholds.offsetIn);

    const notes = pc.notes.length
      ? `<ul class="notes">${pc.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
      : '';

    const srcA = pc.imageA ? await shrinkDataUrl(pc.imageA.dataUrl) : null;
    const srcB = pc.imageB ? await shrinkDataUrl(pc.imageB.dataUrl) : null;
    const srcDiff = pc.pixel ? await shrinkDataUrl(pc.pixel.diffDataUrl) : null;

    const pane = (image: RenderedPageImage | null, side: 'A' | 'B', label: string, src: string | null) => {
      if (!image || !src) {
        return `<div class="pane"><div class="pane-label">${label}</div><div class="pane-missing">No page ${p.pageIndex + 1}</div></div>`;
      }
      const boxes = changes
        .filter((c) => isOnSide(c, side))
        .map((c) => {
          const box = (side === 'A' ? c.a : c.b)!;
          return `<div class="rbox" style="left:${(box.x / image.width) * 100}%;top:${(box.y / image.height) * 100}%;width:${(box.w / image.width) * 100}%;height:${(box.h / image.height) * 100}%;border-color:${CHANGE_COLOR[c.type]};background:${CHANGE_COLOR[c.type]}22"><span class="rbadge" style="background:${CHANGE_COLOR[c.type]}">${c.id}</span></div>`;
        })
        .join('');
      return `<div class="pane"><div class="pane-label">${label}</div><div class="rwrap"><img src="${src}" alt="${side}" />${boxes}</div></div>`;
    };

    const diffImg = pc.pixel;
    const diffDims = pc.imageA ?? pc.imageB;
    const diffPane =
      diffImg && diffDims && srcDiff
        ? (() => {
            // Same words, different type — reported alongside the text edits so the
            // exported heatmap distinguishes a restyle from a rewrite.
            const styleSpots = changes
              .filter((c) => c.type === 'styled' && c.style && (c.b ?? c.a))
              .map((c) => {
                const b = (c.b ?? c.a)!;
                const cx = ((b.x + b.w / 2) / diffDims.width) * 100;
                const cy = ((b.y + b.h / 2) / diffDims.height) * 100;
                const anchor = cx > 55 ? ' r' : '';
                const below = cy < 90 ? ' below' : ' above';
                const style = `left:${(b.x / diffDims.width) * 100}%;top:${(b.y / diffDims.height) * 100}%;width:${(b.w / diffDims.width) * 100}%;height:${(b.h / diffDims.height) * 100}%`;
                const tip = `<span class="tl">font / style</span><span class="tst">${escapeHtml(c.style!.summary)}</span>`;
                return `<div class="dspot" style="${style}"><span class="dtip${anchor}${below}">${tip}</span></div>`;
              })
              .join('');

            const spots = diffHotspots(pc.match.onlyA, pc.match.onlyB)
              .filter((s) => s.before && s.after)
              .map((s) => {
                const b = s.box;
                const cx = ((b.x + b.w / 2) / diffDims.width) * 100;
                const cy = ((b.y + b.h / 2) / diffDims.height) * 100;
                const anchor = cx > 55 ? ' r' : '';
                const below = cy < 90 ? ' below' : ' above';
                const style = `left:${(b.x / diffDims.width) * 100}%;top:${(b.y / diffDims.height) * 100}%;width:${(b.w / diffDims.width) * 100}%;height:${(b.h / diffDims.height) * 100}%`;
                const tip = `<span class="tl">was</span><span class="tb">${escapeHtml(s.before!)}</span><span class="tar">→</span><span class="ta">${escapeHtml(s.after!)}</span>`;
                return `<div class="dspot" style="${style}"><span class="dtip${anchor}${below}">${tip}</span></div>`;
              })
              .join('');
            return `<div class="diffpane"><div class="pane-label">Pixel diff · ${pct(diffImg.ratio)} of pixels changed — before → after labels for replaced text, and font/style labels where only the type changed</div><div class="rwrap dwrap"><img src="${srcDiff}" alt="pixel diff" />${spots}${styleSpots}</div></div>`;
          })()
        : '';

    const changeList = changes.length
      ? `<ul class="rchanges">${changes
          .map((c: Change) => {
            const box = (c.a ?? c.b)!;
            const dims = pc.imageA ?? pc.imageB;
            const ii = (px: number) => inchStr(px, pc.pxPerInch);
            const pos =
              c.type === 'styled' && c.style
                ? c.style.summary
                : c.type === 'moved' && c.offset != null
                  ? `moved ${ii(c.offset)}`
                  : `${ii(box.x)}, ${ii(box.y)}`;
            const where = dims ? region(box, dims.width, dims.height) : '';
            return `<li><span class="rnum" style="background:${CHANGE_COLOR[c.type]}">${c.id}</span>
              <span class="rtype" style="color:${CHANGE_COLOR[c.type]}">${TYPE_LABEL[c.type]}</span>
              <span class="rtext">${escapeHtml(c.text)}</span>
              <span class="rpos">${where} · ${pos}</span></li>`;
          })
          .join('')}</ul>`
      : `<p class="rnochange">No positional text changes on this page.</p>`;

    sections.push(`<section class="page-detail">
      <h3>Page ${p.pageIndex + 1}</h3>
      <div class="metrics">
        <span>Content match: <b>${p.missing ? '—' : pct(p.contentMatch)}</b></span>
        <span>Pixels different: <b>${p.missing ? '—' : pct(p.pixelRatio)}</b></span>
        <span>Max shift: <b>${p.missing ? '—' : inchStr(p.maxOffset, p.pxPerInch)}</b></span>
      </div>
      ${notes}
      <div class="rpanes">${pane(pc.imageA, 'A', 'A · Original', srcA)}${pane(pc.imageB, 'B', 'B · Recreated', srcB)}</div>
      ${diffPane}
      ${changeList}
    </section>`);
  }
  return sections.join('\n');
}

// ── single HTML report ────────────────────────────────────────────────
export async function exportHtmlReport(
  summary: CompareSummary,
  meta: ExportMeta,
  thresholds: ExportThresholds,
  pageCache: Record<number, PageComparison>,
) {
  const overall = summary.pages.every((p) => judgePage(p, thresholds));
  const passCount = summary.pages.filter((p) => judgePage(p, thresholds)).length;
  const detail = await reportPageDetail(summary, pageCache, thresholds);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>PDF Comparison Report — ${escapeHtml(meta.nameA)} vs ${escapeHtml(meta.nameB)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
  <h1>PDF Comparison Report</h1>
  <p class="sub">${escapeHtml(meta.nameA)} &nbsp;vs&nbsp; ${escapeHtml(meta.nameB)}</p>
  <div class="verdict ${overall ? 'pass' : 'fail'}">${overall ? '✓ OVERALL PASS' : '✗ OVERALL FAIL'}</div>
  <div class="meta-grid">
    <div><span>Side A (original):</span> <b>${escapeHtml(meta.nameA)}</b> (${meta.pageCountA} pages)</div>
    <div><span>Side B (recreated):</span> <b>${escapeHtml(meta.nameB)}</b> (${meta.pageCountB} pages)</div>
    <div><span>Pages passing:</span> <b>${passCount} / ${summary.pages.length}</b></div>
    <div><span>Generated:</span> <b>${new Date(meta.generatedAt).toLocaleString()}</b></div>
    <div><span>Thresholds:</span> <b>content ≥ ${thresholds.contentPct}% · pixels ≤ ${thresholds.pixelPct}% · offset ≤ ${thresholds.offsetIn}″</b></div>
  </div>
  <table>
    <thead><tr><th>Page</th><th>Content match</th><th>Pixels different</th><th>Max offset</th><th>Result</th></tr></thead>
    <tbody>${reportPageRows(summary, thresholds)}</tbody>
  </table>
  <h2>Per-page detail</h2>
  ${detail}
  <footer>Generated by PDF Comparison Suite · ${new Date(meta.generatedAt).toLocaleString()}</footer>
</body>
</html>`;

  download(`pdf-comparison-report-${stamp()}.html`, html, 'text/html');
}
