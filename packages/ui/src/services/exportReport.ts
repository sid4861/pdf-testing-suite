// Export utilities for comparison results.
// Produces JSON, CSV, and a standalone printable HTML report (print → Save as PDF).
// The per-page renderers are exported so the batch report can reuse them.

import type { CompareSummary, PageComparison, PageSummary, RenderedPageImage } from '@pdfsuite/core';
import { buildChanges, changeRef, diffHotspots, isOnSide, region, summaryChanged, TYPE_LABEL, CHANGE_COLOR, type Change } from '@pdfsuite/compare';
import type { IgnoredChange } from '../store/ignoreStore';
import { partitionByRegion, regionsFor, type DataRegion } from '../store/regionStore';

export interface ExportMeta {
  nameA: string;
  nameB: string;
  pageCountA: number;
  pageCountB: number;
  generatedAt: string; // ISO string
}

/** What counts as "moved" in a report, in inches. Fixed, not user-tunable. */
import { MOVED_OFFSET_IN } from '@pdfsuite/core';
// Re-exported because exportMarkdown.ts and the CLI import it from here.
export { MOVED_OFFSET_IN };

export const pct = (n: number) => (n * 100).toFixed(1) + '%';
export const inchStr = (px: number, pxPerInch: number) => (px / pxPerInch).toFixed(2) + '″';

/**
 * A page passes when it does not differ. There are no tunable thresholds: the
 * question a report answers is "did anything change?", and a knob that lets a
 * real change be declared acceptable only hides it.
 */
export function judgePage(p: PageSummary): boolean {
  return !summaryChanged(p);
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
export function buildJsonReport(
  summary: CompareSummary,
  meta: ExportMeta,
): string {
  // Failures only, matching every other report.
  const pages = failingPages(summary).map((p) => ({
    page: p.pageIndex + 1,
    contentMatch: p.contentMatch,
    pixelRatio: p.pixelRatio,
    maxOffsetInches: Number((p.maxOffset / p.pxPerInch).toFixed(3)),
    missing: p.missing,
    pass: judgePage(p),
  }));

  const payload = {
    meta,
    overall: pages.length === 0 ? 'PASS' : 'FAIL',
    summary: {
      pageCountA: summary.pageCountA,
      pageCountB: summary.pageCountB,
      pagesCompared: summary.pages.length,
      passCount: summary.pages.length - pages.length,
      failCount: pages.length,
    },
    failedPages: pages,
  };

  return JSON.stringify(payload, null, 2);
}

export function exportJson(summary: CompareSummary, meta: ExportMeta) {
  download(`pdf-comparison-${stamp()}.json`, buildJsonReport(summary, meta), 'application/json');
}

// ── CSV export ────────────────────────────────────────────────────────
export function buildCsvReport(summary: CompareSummary): string {
  const header = ['Page', 'ContentMatch%', 'PixelsDifferent%', 'MaxOffsetInches', 'Missing', 'Result'];
  const rows = failingPages(summary).map((p) => [
    p.pageIndex + 1,
    (p.contentMatch * 100).toFixed(2),
    (p.pixelRatio * 100).toFixed(2),
    (p.maxOffset / p.pxPerInch).toFixed(3),
    p.missing ? 'yes' : 'no',
    judgePage(p) ? 'PASS' : 'FAIL',
  ]);
  return [header, ...rows].map((r) => r.join(',')).join('\r\n');
}

export function exportCsv(summary: CompareSummary) {
  download(`pdf-comparison-${stamp()}.csv`, buildCsvReport(summary), 'text/csv');
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
  td.allclear { color: #15803d; font-weight: 600; }
  table.ignored td { vertical-align: top; }
  .noreason { color: #94a3b8; font-style: italic; }
  @media print { body { padding: 0; } }
`;

/**
 * Pages that did not pass — a failing page or one missing from a side.
 *
 * Every report is a list of what needs attention, so pages within tolerance are
 * left out entirely rather than padding the output with rows nobody acts on.
 */
export function failingPages(summary: CompareSummary): PageSummary[] {
  return summary.pages.filter((p) => !judgePage(p));
}

/** The per-page metric rows (<tr>…) for the summary table. Failures only. */
export function reportPageRows(summary: CompareSummary): string {
  const failed = failingPages(summary);
  if (failed.length === 0) {
    return `<tr class="pass"><td colspan="5" class="allclear">No page fell outside tolerance.</td></tr>`;
  }
  return failed
    .map((p) => {
      const missing = p.missing;
      const pass = judgePage(p);
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
  ignored: IgnoredChange[] = [],
  regions: DataRegion[] = [],
): Promise<string> {
  const ignoredKeys = new Set(ignored.map((e) => changeRef(e.page, e.key)));
  const sections: string[] = [];
  for (const p of failingPages(summary)) {
    const pc = pageCache[p.pageIndex];
    if (!pc) continue;
    const ref = pc.imageA ?? pc.imageB ?? null;
    const { tested } = partitionByRegion(
      buildChanges(pc, MOVED_OFFSET_IN),
      regionsFor(regions, p.pageIndex),
      ref?.width ?? 0,
      ref?.height ?? 0,
    );
    const changes = tested.filter((c) => !ignoredKeys.has(changeRef(p.pageIndex, c.key)));

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
          return `<div class="rbox" style="left:${(box.x / image.width) * 100}%;top:${(box.y / image.height) * 100}%;width:${(box.w / image.width) * 100}%;height:${(box.h / image.height) * 100}%;border-color:${CHANGE_COLOR[c.type]};background:${CHANGE_COLOR[c.type]}22"><span class="rbadge" style="background:${CHANGE_COLOR[c.type]}">${c.label}</span></div>`;
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
            return `<li><span class="rnum" style="background:${CHANGE_COLOR[c.type]}">${c.label}</span>
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
      <div class="rpanes">${pane(pc.imageA, 'A', 'Golden PDF', srcA)}${pane(pc.imageB, 'B', 'PDF to test', srcB)}</div>
      ${diffPane}
      ${changeList}
    </section>`);
  }
  return sections.join('\n');
}

// ── single HTML report ────────────────────────────────────────────────
export async function buildHtmlReport(
  summary: CompareSummary,
  meta: ExportMeta,
  pageCache: Record<number, PageComparison>,
  ignored: IgnoredChange[] = [],
  regions: DataRegion[] = [],
): Promise<string> {
  const overall = summary.pages.every((p) => judgePage(p));
  const passCount = summary.pages.filter((p) => judgePage(p)).length;
  const detail = await reportPageDetail(summary, pageCache, ignored, regions);

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
    <div><span>Golden PDF:</span> <b>${escapeHtml(meta.nameA)}</b> (${meta.pageCountA} pages)</div>
    <div><span>PDF to test:</span> <b>${escapeHtml(meta.nameB)}</b> (${meta.pageCountB} pages)</div>
    <div><span>Pages passing:</span> <b>${passCount} / ${summary.pages.length}</b></div>
    <div><span>Generated:</span> <b>${new Date(meta.generatedAt).toLocaleString()}</b></div>
  </div>
  <table>
    <thead><tr><th>Page</th><th>Content match</th><th>Pixels different</th><th>Max offset</th><th>Result</th></tr></thead>
    <tbody>${reportPageRows(summary)}</tbody>
  </table>
  <h2>Per-page detail</h2>
  ${detail}
  ${regionSection(regions, pageCache)}
  ${ignoredSection(ignored)}
  <footer>Generated by PDF Comparison Suite · ${new Date(meta.generatedAt).toLocaleString()}</footer>
</body>
</html>`;

  return html;
}

/**
 * Areas ignored wholesale, and how much each one covered.
 *
 * Stated rather than silently dropped: a reader has to be able to see that a
 * holdings table was accepted as a whole, and how many changes that covered.
 */
function regionSection(
  regions: DataRegion[],
  pageCache: Record<number, PageComparison>,
): string {
  if (regions.length === 0) return '';

  let total = 0;
  const counts = new Map<string, number>();
  for (const [key, pc] of Object.entries(pageCache)) {
    const page = Number(key);
    const here = regionsFor(regions, page);
    if (here.length === 0) continue;
    const ref = pc.imageA ?? pc.imageB ?? null;
    const { inData, perRegion } = partitionByRegion(
      buildChanges(pc, MOVED_OFFSET_IN),
      here,
      ref?.width ?? 0,
      ref?.height ?? 0,
    );
    total += inData.length;
    for (const [id, n] of perRegion) counts.set(id, (counts.get(id) ?? 0) + n);
  }

  const rows = [...regions]
    .sort((a, b) => a.page - b.page || a.y - b.y)
    .map(
      (r) => `<tr>
        <td>${r.page + 1}</td>
        <td>${escapeHtml(r.label)}</td>
        <td>${counts.get(r.id) ?? 0}</td>
      </tr>`,
    )
    .join('\n');

  return `<h2>Ignored regions, excluded from this report</h2>
  <p class="sub">${regions.length} area${regions.length === 1 ? '' : 's'} accepted as a whole, every change inside expected by design and left out of the pages above: ${total} change${total === 1 ? '' : 's'} in total.</p>
  <table class="ignored">
    <thead><tr><th>Page</th><th>Area</th><th>Changes ignored</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * What a reviewer set aside, and why.
 *
 * A difference removed from the comparison still belongs in the report — the
 * value of the decision is that it is recorded, not that it disappears.
 */
function ignoredSection(ignored: IgnoredChange[]): string {
  if (ignored.length === 0) return '';
  const rows = [...ignored]
    .sort((a, b) => a.page - b.page || a.label - b.label)
    .map(
      (e) => `<tr>
        <td>${e.page + 1}</td>
        <td>${escapeHtml(e.summary)}</td>
        <td>${e.reason ? escapeHtml(e.reason) : '<span class="noreason">no reason given</span>'}</td>
      </tr>`,
    )
    .join('\n');
  return `<h2>Ignored differences, excluded from this report</h2>
  <p class="sub">${ignored.length} individual difference${ignored.length === 1 ? '' : 's'} marked as expected by a reviewer and left out of the pages above.</p>
  <table class="ignored">
    <thead><tr><th>Page</th><th>Difference</th><th>Reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export async function exportHtmlReport(
  summary: CompareSummary,
  meta: ExportMeta,
  pageCache: Record<number, PageComparison>,
  ignored: IgnoredChange[] = [],
  regions: DataRegion[] = [],
) {
  const html = await buildHtmlReport(summary, meta, pageCache, ignored, regions);
  download(`pdf-comparison-report-${stamp()}.html`, html, 'text/html');
}
