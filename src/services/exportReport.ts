// Export utilities for comparison results.
// Produces JSON, CSV, and a standalone printable HTML report (print → Save as PDF).

import type { CompareSummary, PageComparison, RenderedPageImage } from '../types/compare';
import { buildChanges, isOnSide, region, TYPE_LABEL, CHANGE_COLOR, type Change } from './changes';

export interface ExportThresholds {
  contentPct: number; // e.g. 99  → content match must be ≥ 99%
  pixelPct: number;   // e.g. 2   → pixels different must be ≤ 2%
  offsetPx: number;   // e.g. 3   → max offset must be ≤ 3px
}

export interface ExportMeta {
  nameA: string;
  nameB: string;
  pageCountA: number;
  pageCountB: number;
  generatedAt: string; // ISO string
}

const pct = (n: number) => (n * 100).toFixed(1) + '%';

function judgePage(
  p: { contentMatch: number; pixelRatio: number; maxOffset: number; missing: boolean },
  t: ExportThresholds,
): boolean {
  if (p.missing) return false;
  return (
    p.contentMatch * 100 >= t.contentPct &&
    p.pixelRatio * 100 <= t.pixelPct &&
    p.maxOffset <= t.offsetPx
  );
}

function download(filename: string, content: string | Blob, mime: string) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ── JSON export ───────────────────────────────────────────────────────
export function exportJson(
  summary: CompareSummary,
  meta: ExportMeta,
  thresholds: ExportThresholds,
) {
  const pages = summary.pages.map((p) => ({
    page: p.pageIndex + 1,
    contentMatch: p.contentMatch,
    pixelRatio: p.pixelRatio,
    maxOffsetPx: p.maxOffset,
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

  download(
    `pdf-comparison-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
}

// ── CSV export ────────────────────────────────────────────────────────
export function exportCsv(
  summary: CompareSummary,
  thresholds: ExportThresholds,
) {
  const header = ['Page', 'ContentMatch%', 'PixelsDifferent%', 'MaxOffsetPx', 'Missing', 'Result'];
  const rows = summary.pages.map((p) => [
    p.pageIndex + 1,
    (p.contentMatch * 100).toFixed(2),
    (p.pixelRatio * 100).toFixed(2),
    p.maxOffset.toFixed(0),
    p.missing ? 'yes' : 'no',
    judgePage(p, thresholds) ? 'PASS' : 'FAIL',
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\r\n');
  download(`pdf-comparison-${stamp()}.csv`, csv, 'text/csv');
}

// ── HTML report export (standalone, printable) ────────────────────────
export function exportHtmlReport(
  summary: CompareSummary,
  meta: ExportMeta,
  thresholds: ExportThresholds,
  pageCache: Record<number, PageComparison>,
) {
  const judged = summary.pages.map((p) => ({ p, pass: judgePage(p, thresholds) }));
  const overall = judged.every((j) => j.pass);
  const passCount = judged.filter((j) => j.pass).length;

  const rowsHtml = judged
    .map(({ p, pass }) => {
      const missing = p.missing;
      return `<tr class="${missing ? 'missing' : pass ? 'pass' : 'fail'}">
        <td>${p.pageIndex + 1}</td>
        <td>${missing ? '—' : pct(p.contentMatch)}</td>
        <td>${missing ? '—' : pct(p.pixelRatio)}</td>
        <td>${missing ? '—' : Math.round(p.maxOffset) + 'px'}</td>
        <td class="result">${missing ? 'MISSING' : pass ? '✓ PASS' : '✗ FAIL'}</td>
      </tr>`;
    })
    .join('\n');

  // Per-page visual detail: annotated A/B pages with change highlights + a change list.
  const detailHtml = summary.pages
    .map((p) => {
      const pc = pageCache[p.pageIndex];
      if (!pc) return '';
      const changes = buildChanges(pc, thresholds.offsetPx);

      const notes = pc.notes.length
        ? `<ul class="notes">${pc.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
        : '';

      const pane = (image: RenderedPageImage | null, side: 'A' | 'B', label: string) => {
        if (!image) {
          return `<div class="pane"><div class="pane-label">${label}</div><div class="pane-missing">No page ${p.pageIndex + 1}</div></div>`;
        }
        const boxes = changes
          .filter((c) => isOnSide(c, side))
          .map((c) => {
            const box = (side === 'A' ? c.a : c.b)!;
            return `<div class="rbox" style="left:${(box.x / image.width) * 100}%;top:${(box.y / image.height) * 100}%;width:${(box.w / image.width) * 100}%;height:${(box.h / image.height) * 100}%;border-color:${CHANGE_COLOR[c.type]};background:${CHANGE_COLOR[c.type]}22"><span class="rbadge" style="background:${CHANGE_COLOR[c.type]}">${c.id}</span></div>`;
          })
          .join('');
        return `<div class="pane">
          <div class="pane-label">${label}</div>
          <div class="rwrap"><img src="${image.dataUrl}" alt="${side}" />${boxes}</div>
        </div>`;
      };

      const changeList = changes.length
        ? `<ul class="rchanges">${changes
            .map((c: Change) => {
              const box = (c.a ?? c.b)!;
              const dims = pc.imageA ?? pc.imageB;
              const pos =
                c.type === 'moved' && c.offset != null
                  ? `moved ${Math.round(c.offset)}px`
                  : `${Math.round(box.x)},${Math.round(box.y)}px`;
              const where = dims ? region(box, dims.width, dims.height) : '';
              return `<li><span class="rnum" style="background:${CHANGE_COLOR[c.type]}">${c.id}</span>
                <span class="rtype" style="color:${CHANGE_COLOR[c.type]}">${TYPE_LABEL[c.type]}</span>
                <span class="rtext">${escapeHtml(c.text)}</span>
                <span class="rpos">${where} · ${pos}</span></li>`;
            })
            .join('')}</ul>`
        : `<p class="rnochange">No positional text changes on this page.</p>`;

      return `<section class="page-detail">
        <h3>Page ${p.pageIndex + 1}</h3>
        <div class="metrics">
          <span>Content match: <b>${p.missing ? '—' : pct(p.contentMatch)}</b></span>
          <span>Pixels different: <b>${p.missing ? '—' : pct(p.pixelRatio)}</b></span>
          <span>Max shift: <b>${p.missing ? '—' : Math.round(p.maxOffset) + 'px'}</b></span>
        </div>
        ${notes}
        <div class="rpanes">${pane(pc.imageA, 'A', 'A · Original')}${pane(pc.imageB, 'B', 'B · Recreated')}</div>
        ${changeList}
      </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>PDF Comparison Report — ${escapeHtml(meta.nameA)} vs ${escapeHtml(meta.nameB)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #fff; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { color: #64748b; margin: 0 0 24px; font-size: 14px; }
  .verdict { display: inline-block; padding: 8px 20px; border-radius: 999px; font-weight: 700; font-size: 16px; margin-bottom: 24px; }
  .verdict.pass { background: #dcfce7; color: #166534; }
  .verdict.fail { background: #fee2e2; color: #991b1b; }
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
  footer { margin-top: 32px; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 0; } }
</style>
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
    <div><span>Thresholds:</span> <b>content ≥ ${thresholds.contentPct}% · pixels ≤ ${thresholds.pixelPct}% · offset ≤ ${thresholds.offsetPx}px</b></div>
  </div>
  <table>
    <thead>
      <tr><th>Page</th><th>Content match</th><th>Pixels different</th><th>Max offset</th><th>Result</th></tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <h2>Per-page detail</h2>
  ${detailHtml}
  <footer>Generated by PDF Comparison Suite · ${new Date(meta.generatedAt).toLocaleString()}</footer>
</body>
</html>`;

  download(`pdf-comparison-report-${stamp()}.html`, html, 'text/html');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
