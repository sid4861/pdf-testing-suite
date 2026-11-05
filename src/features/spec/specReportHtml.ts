/**
 * `report.html` for a spec run — SR-REPORT-HTML.
 *
 * It reads **only `result.json`** (decision 1), which is why it takes a
 * `ResultJson` and not a `SpecReport`: if the HTML could reach past the result
 * for something, the file and the page could disagree, and then neither is the
 * answer.
 *
 * Self-contained (2), no script (3) — expanding is `<details>`, so it works
 * with JavaScript off and inside a sandboxed iframe — every inserted value
 * escaped (4), deterministic (5), images only for pages that failed (6), and
 * semantic tables with headers and alt text (7).
 */

import type { ResultJson, ResultPage } from './specResult';

/**
 * Escape for HTML text and attributes.
 *
 * Everything here comes from somewhere else: a file name, a cell a person
 * typed, text lifted out of a PDF. One unescaped `<` turns a report into a
 * page that renders someone else's markup.
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const STYLE = `
  :root { color-scheme: light; }
  body { font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
         color: #1e293b; background: #fff; margin: 0; padding: 32px 16px; }
  main { max-width: 1040px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 28px 0 8px; }
  .sub { color: #64748b; font-size: 12.5px; margin: 0 0 20px; }
  .verdict { display: inline-block; font-weight: 700; font-size: 12px; letter-spacing: .04em;
             border-radius: 999px; padding: 3px 12px; }
  .verdict.pass { color: #059669; background: #ecfdf5; }
  .verdict.fail { color: #dc2626; background: #fef2f2; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0 18px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  td.cell, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: #64748b; }
  tr.no td { background: #fef2f2; }
  .note { color: #d97706; font-style: italic; }
  .tag { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 1px 8px; margin-right: 6px; }
  .tag.error { color: #dc2626; background: #fef2f2; }
  .tag.warning { color: #d97706; background: #fffbeb; }
  .tag.note { color: #64748b; background: #f1f5f9; }
  .status { font-size: 10.5px; font-weight: 700; letter-spacing: .03em; }
  .status.pass { color: #059669; } .status.fail, .status.not-found { color: #dc2626; }
  .status.warning { color: #d97706; } .status.unverifiable { color: #64748b; }
  details { margin: 4px 0 14px; }
  summary { cursor: pointer; font-weight: 600; font-size: 13px; }
  img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; }
  ul.findings { list-style: none; padding: 0; margin: 0 0 18px; font-size: 13px; }
  ul.findings li { padding: 3px 0; }
  @media print { body { padding: 0; } details { display: block; } }
`;

export interface ReportHtmlOptions {
  /** Page image data URIs, by PDF page number. */
  images?: Record<number, string>;
  /**
   * Include an image for every page, not only the failing ones. The default
   * follows decision 6 — a clean run's report should not be ten megabytes of
   * pictures of pages that passed.
   */
  allImages?: boolean;
}

function checkRows(page: ResultPage): string {
  return page.elements.map((el) => {
    const rows = el.checks.map((c) => `<tr class="${c.pass ? 'ok' : 'no'}">
<td>${esc(c.name)}</td><td>${esc(c.expected)}</td><td>${esc(c.actual)}</td>
<td>${esc(c.delta ?? '')}${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}</td>
<td class="cell">${esc(c.cell ?? '')}</td>
<td>${c.pass ? '✓' : '✗'}</td></tr>`).join('');

    return `<h3 style="font-size:13.5px;margin:16px 0 2px">${esc(el.label)}
 <span class="status ${esc(el.status)}">${esc(el.status.toUpperCase())}</span></h3>
<table><caption class="sub" style="text-align:left;margin:0 0 4px">${esc(el.detail)}</caption>
<thead><tr><th>Check</th><th>Expected</th><th>Actual</th><th>Delta</th><th>Cell</th><th>Pass</th></tr></thead>
<tbody>${rows}</tbody></table>`;
  }).join('');
}

export function buildReportHtml(result: ResultJson, options: ReportHtmlOptions = {}): string {
  const { summary } = result;
  const pass = summary.verdict === 'PASS';
  const images = options.images ?? {};

  const inputs = result.inputs.map((i) =>
    `<tr><td>${esc(i.name)}</td><td class="cell">${esc(i.sha256 ?? 'not hashed')}</td>
<td>${i.bytes == null ? '' : `${i.bytes} bytes`}</td></tr>`).join('');

  const findings = result.pageFindings.map((f) =>
    `<li><span class="tag ${esc(f.severity)}">${esc(f.severity)}</span>${esc(f.message)}</li>`).join('');

  const pages = result.pages.map((p) => {
    const show = options.allImages || p.failCount > 0;
    const img = show && images[p.page]
      ? `<img src="${esc(images[p.page])}" alt="Page ${p.page}${p.name ? `, ${esc(p.name)}` : ''}, as rendered from the PDF">`
      : '';
    const head = `${p.name ? `${esc(p.name)} — ` : ''}PDF page ${p.page}`;
    return `<h2>${head} <span class="verdict ${p.failCount === 0 ? 'pass' : 'fail'}">${
      p.passCount} passed · ${p.failCount} failed</span></h2>
${img}
<details${p.failCount > 0 ? ' open' : ''}><summary>${p.elements.length} element${p.elements.length === 1 ? '' : 's'}</summary>
${checkRows(p)}</details>`;
  }).join('');

  const coverage = result.coverage
    ? `${result.coverage.checked} of ${result.coverage.rows} rows checked · ${
      result.coverage.excluded} excluded · ${result.coverage.noted} noted · ${
      result.coverage.unreadable} unreadable`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spec check — ${esc(result.inputs[0]?.name ?? 'result')}</title>
<style>${STYLE}</style></head>
<body><main>
<h1>Spec check <span class="verdict ${pass ? 'pass' : 'fail'}">${esc(summary.verdict)}</span></h1>
<p class="sub">${summary.elementsPassing} of ${summary.elements} elements pass · ${
  summary.checksFailed} failed check${summary.checksFailed === 1 ? '' : 's'}${
  coverage ? ` · ${esc(coverage)}` : ''}<br>
Run ${esc(result.run.started)}${result.findingsSha256 ? ` · findings <span class="mono">${esc(result.findingsSha256.slice(0, 12))}…</span>` : ''}</p>

<h2>The pair tested</h2>
<table><thead><tr><th>File</th><th>SHA-256</th><th>Size</th></tr></thead><tbody>${inputs}</tbody></table>

${findings ? `<h2>Pages</h2><ul class="findings">${findings}</ul>` : ''}
${pages}
</main></body></html>`;
}
