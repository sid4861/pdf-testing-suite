// Export helpers for spec-check results: JSON and a printable HTML report.

import type { Box, ElementResult, SpecReport } from '../types/spec';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
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

export function exportSpecJson(report: SpecReport) {
  const payload = {
    title: report.title,
    units: report.units,
    verdict: report.totalFail === 0 ? 'PASS' : 'FAIL',
    summary: {
      elements: report.elementCount,
      elementsPassing: report.passElements,
      checksPassed: report.totalPass,
      checksFailed: report.totalFail,
    },
    pages: report.pages.map((p) => ({
      page: p.page,
      elements: p.elements.map((e) => ({
        id: e.id,
        type: e.type,
        label: e.label,
        status: e.status,
        checks: e.checks,
      })),
    })),
  };
  download(`spec-check-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function boxStyle(box: Box, w: number, h: number, color: string, dashed: boolean): string {
  return `left:${(box.left / w) * 100}%;top:${(box.top / h) * 100}%;width:${(box.width / w) * 100}%;height:${(box.height / h) * 100}%;border:1.5px ${dashed ? 'dashed' : 'solid'} ${color};`;
}

function elementRows(el: ElementResult): string {
  const badge = el.status === 'pass' ? '<span class="b pass">PASS</span>' : el.status === 'fail' ? '<span class="b fail">FAIL</span>' : '<span class="b na">NOT FOUND</span>';
  const checks = el.checks
    .map(
      (c) =>
        `<tr class="${c.pass ? 'ok' : 'no'}"><td></td><td>${esc(c.name)}</td><td>${esc(c.expected)}</td><td>${esc(c.actual)}</td><td>${c.delta ? esc(c.delta) : ''}</td><td>${c.pass ? '✓' : '✗'}</td></tr>`,
    )
    .join('');
  return `<tr class="el ${el.status}"><td><b>${esc(el.label)}</b><br><small>${esc(el.type)} · ${esc(el.detail)}</small></td><td colspan="4"></td><td>${badge}</td></tr>${checks}`;
}

export function exportSpecHtml(report: SpecReport) {
  const pass = report.totalFail === 0;
  const pagesHtml = report.pages
    .map((p) => {
      const overlays = p.dataUrl
        ? p.elements
            .map((e) => {
              const parts: string[] = [];
              if (e.expectedBox) parts.push(`<div class="ov" style="${boxStyle(e.expectedBox, p.pageWidthPt, p.pageHeightPt, '#6366f1', true)}"></div>`);
              if (e.actualBox) parts.push(`<div class="ov" style="${boxStyle(e.actualBox, p.pageWidthPt, p.pageHeightPt, e.status === 'pass' ? '#15803d' : '#dc2626', false)}"></div>`);
              return parts.join('');
            })
            .join('')
        : '';
      const img = p.dataUrl ? `<div class="pgwrap"><img src="${p.dataUrl}" />${overlays}</div>` : '<p class="muted">Page not present in the PDF.</p>';
      return `<section class="page">
        <h2>Page ${p.page} <small>${p.failCount === 0 ? '✓ all checks pass' : `${p.failCount} check(s) failed`}</small></h2>
        <div class="cols">
          ${img}
          <table class="res">
            <thead><tr><th>Element</th><th>Check</th><th>Expected</th><th>Actual</th><th>Δ</th><th></th></tr></thead>
            <tbody>${p.elements.map(elementRows).join('')}</tbody>
          </table>
        </div>
      </section>`;
    })
    .join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>Spec Check Report — ${esc(report.title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;margin:0;padding:40px;background:#fff}
  h1{font-size:24px;margin:0 0 4px}
  .verdict{display:inline-block;padding:8px 20px;border-radius:999px;font-weight:700;margin:12px 0 24px}
  .verdict.pass{background:#dcfce7;color:#166534}.verdict.fail{background:#fee2e2;color:#991b1b}
  .meta{color:#64748b;font-size:14px;margin-bottom:24px}
  .page{margin-bottom:40px;page-break-inside:avoid}
  h2{font-size:19px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
  h2 small{font-weight:400;color:#64748b;font-size:13px}
  .cols{display:grid;grid-template-columns:minmax(220px,320px) 1fr;gap:24px;align-items:start}
  .pgwrap{position:relative;display:inline-block;line-height:0;border:1px solid #e2e8f0}
  .pgwrap img{max-width:100%;width:100%}
  .ov{position:absolute;box-sizing:border-box;border-radius:2px}
  table.res{width:100%;border-collapse:collapse;font-size:12.5px}
  table.res th,table.res td{border-bottom:1px solid #eef2f6;padding:4px 8px;text-align:left}
  table.res th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8}
  tr.el td{border-top:1px solid #e2e8f0;padding-top:8px}
  tr.el small{color:#94a3b8}
  tr.no td{color:#b91c1c}
  .b{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
  .b.pass{background:#dcfce7;color:#166534}.b.fail{background:#fee2e2;color:#991b1b}.b.na{background:#fef3c7;color:#92400e}
  .muted{color:#94a3b8}
  .legend{font-size:12px;color:#64748b;margin-bottom:20px}
  .legend i{display:inline-block;width:14px;height:0;border-top:2px solid;vertical-align:middle;margin-right:4px}
  @media print{body{padding:0}}
</style></head><body>
  <h1>Spec Check Report</h1>
  <div class="meta">${esc(report.title)} · units: ${report.units}</div>
  <div class="verdict ${pass ? 'pass' : 'fail'}">${pass ? '✓ PASS' : '✗ FAIL'} — ${report.passElements}/${report.elementCount} elements, ${report.totalFail} failed checks</div>
  <div class="legend"><i style="border-color:#6366f1;border-top-style:dashed"></i> expected &nbsp;&nbsp; <i style="border-color:#15803d"></i> actual (pass) &nbsp;&nbsp; <i style="border-color:#dc2626"></i> actual (fail)</div>
  ${pagesHtml}
  <footer style="margin-top:32px;color:#94a3b8;font-size:12px">Generated by PDF Compare · Test new pages · ${new Date().toLocaleString()}</footer>
</body></html>`;

  download(`spec-check-report-${stamp()}.html`, html, 'text/html');
}
