/**
 * `report.html` for a compare — SR-REPORT-HTML.
 *
 * It reads **only `result.json`** (decision 1). That is the constraint that
 * makes the file trustworthy: everything in the page is in the result, so a
 * reader who has the JSON and a reader who has the HTML are looking at the
 * same run, and the page cannot quietly know something the machine-readable
 * answer does not.
 *
 * Self-contained (2) — page images arrive as data URIs and nothing is
 * fetched. No script (3): expanding is `<details>`, so it works with
 * JavaScript off and inside a sandboxed iframe. Every inserted value escaped
 * (4) — file names and PDF text are somebody else's input. Deterministic (5).
 * Images for failing pages only (6). Semantic tables, alt text, and the
 * colours named in words as well as shown (7).
 */

import type { CompareResultJson, ResultComparePage } from './result';

/**
 * Escape for HTML text and attributes.
 *
 * Everything here comes from a document somebody else made: a file name, a
 * run of text lifted out of a PDF. One unescaped `<` turns a report into a
 * page that renders their markup.
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Page images, by page number as the result counts them. */
export interface ReportImages {
  [page: number]: { golden?: string; candidate?: string; diff?: string };
}

export interface CompareReportOptions {
  images?: ReportImages;
  /** Include images for every page, not only the ones that changed. */
  allImages?: boolean;
}

const STYLE = `
  :root { color-scheme: light; }
  body { font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
         color: #1e293b; background: #fff; margin: 0; padding: 32px 16px; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 26px 0 6px; }
  .sub { color: #64748b; font-size: 12.5px; margin: 0 0 20px; }
  .verdict { display: inline-block; font-weight: 700; font-size: 12px; letter-spacing: .04em;
             border-radius: 999px; padding: 3px 12px; }
  .verdict.pass { color: #059669; background: #ecfdf5; }
  .verdict.fail { color: #dc2626; background: #fef2f2; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0 18px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.changed td { background: #fef2f2; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: #64748b; }
  .tag { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 1px 8px; margin-right: 4px; }
  .tag.removed { color: #dc2626; background: #fef2f2; }
  .tag.added { color: #059669; background: #ecfdf5; }
  .tag.moved { color: #d97706; background: #fffbeb; }
  .tag.styled { color: #7c3aed; background: #f5f3ff; }
  details { margin: 4px 0 16px; }
  summary { cursor: pointer; font-weight: 600; font-size: 13px; }
  .pages { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0; }
  figure { margin: 0; max-width: 340px; }
  figcaption { font-size: 11px; color: #64748b; margin-top: 2px; }
  img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; }
  @media print { body { padding: 0; } details { display: block; } }
`;

function changeRows(page: ResultComparePage): string {
  if (page.changes.length === 0) return '';
  const rows = page.changes.map((c) => `<tr>
<td><span class="tag ${esc(c.type)}">${esc(c.type)}</span></td>
<td>${esc(c.text)}</td>
<td class="mono">${c.golden ? c.golden.join(', ') : '—'}</td>
<td class="mono">${c.candidate ? c.candidate.join(', ') : '—'}</td>
<td class="num">${c.movedIn == null ? '' : `${c.movedIn}″`}</td></tr>`).join('');

  return `<table>
<caption class="sub" style="text-align:left;margin:0 0 4px">${page.changes.length} change${page.changes.length === 1 ? '' : 's'} — boxes in inches from the page's top-left</caption>
<thead><tr><th>What</th><th>Text</th><th>Golden</th><th>Candidate</th><th>Moved</th></tr></thead>
<tbody>${rows}</tbody></table>`;
}

function pageSection(page: ResultComparePage, options: CompareReportOptions): string {
  const changed = page.verdict === 'changed';
  const images = (options.allImages || changed) ? options.images?.[page.page] : undefined;

  const figure = (src: string | undefined, label: string) =>
    src ? `<figure><img src="${esc(src)}" alt="Page ${page.page}, ${esc(label)}"><figcaption>${esc(label)}</figcaption></figure>` : '';

  const pics = images
    ? `<div class="pages">${figure(images.golden, 'golden')}${figure(images.candidate, 'candidate')}${figure(images.diff, 'pixel difference')}</div>`
    : '';

  const where = page.golden == null
    ? 'candidate only'
    : page.candidate == null
      ? 'golden only'
      : `golden ${page.golden} · candidate ${page.candidate}`;

  return `<h2>Page ${page.page}
 <span class="verdict ${changed ? 'fail' : 'pass'}">${changed ? 'changed' : 'same'}</span>
 <span class="sub" style="font-weight:400">${esc(where)}</span></h2>
${page.why.length ? `<p class="sub">${esc(page.why.join(' · '))}</p>` : ''}
${page.error ? `<p class="sub">This page could not be compared: ${esc(page.error)}</p>` : ''}
${pics}
${page.changes.length
    ? `<details${changed ? ' open' : ''}><summary>${page.changes.length} change${page.changes.length === 1 ? '' : 's'}</summary>${changeRows(page)}</details>`
    : ''}`;
}

export function buildCompareReportHtml(
  result: CompareResultJson,
  options: CompareReportOptions = {},
): string {
  const pass = result.summary.verdict === 'PASS';

  const inputs = result.inputs.map((i) =>
    `<tr><td>${esc(i.name)}</td><td class="mono">${esc(i.sha256 ?? 'not hashed')}</td>
<td class="num">${i.bytes == null ? '' : i.bytes}</td></tr>`).join('');

  const overview = result.pages.map((p) => `<tr class="${p.verdict === 'changed' ? 'changed' : ''}">
<td class="num">${p.page}</td>
<td>${p.verdict === 'changed' ? 'changed' : 'same'}</td>
<td>${esc(p.why.join(' · '))}</td>
<td class="num">${(p.metrics.contentMatch * 100).toFixed(2)}%</td>
<td class="num">${(p.metrics.pixelRatio * 100).toFixed(2)}%</td>
<td class="num">${p.metrics.maxOffsetIn}″</td>
<td class="num">${p.changes.length}</td></tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Compare — ${esc(result.inputs[0]?.name ?? 'result')}</title>
<style>${STYLE}</style></head>
<body><main>
<h1>Compare <span class="verdict ${pass ? 'pass' : 'fail'}">${esc(result.summary.verdict)}</span></h1>
<p class="sub">${result.summary.pagesChanged} of ${result.summary.pages} page${result.summary.pages === 1 ? '' : 's'} changed
 · run ${esc(result.run.started)}${result.findingsSha256 ? ` · findings <span class="mono">${esc(result.findingsSha256.slice(0, 12))}…</span>` : ''}
<br>A page is marked changed if it differs at all — there are no tolerances.</p>

<h2>The pair tested</h2>
<table><thead><tr><th>File</th><th>SHA-256</th><th>Bytes</th></tr></thead><tbody>${inputs}</tbody></table>

<h2>Every page</h2>
<table><thead><tr><th>Page</th><th>Verdict</th><th>Why</th><th>Text in common</th><th>Pixels differing</th><th>Furthest move</th><th>Changes</th></tr></thead>
<tbody>${overview}</tbody></table>

${result.pages.filter((p) => p.verdict === 'changed' || options.allImages).map((p) => pageSection(p, options)).join('\n')}
</main></body></html>`;
}
