/**
 * `report.html` for an inspect — SR-REPORT-HTML.
 *
 * It reads **only `result.json`** (decision 1), plus the page images the
 * caller passes in — which are the one thing the result deliberately does
 * not carry, because base64 pages make a result nobody can diff. So the
 * images are handed in beside it, and every *number* on the page comes from
 * the result and nowhere else.
 *
 * Self-contained (2), no script (3) — the per-page element lists are
 * `<details>`, so the file works with JavaScript off. Every inserted value
 * escaped (4): an element's label is text lifted out of somebody's PDF.
 * Deterministic (5). Semantic tables with a caption each (7).
 *
 * One departure from the compare report, stated because SR-REPORT-HTML
 * decision 6 says images are for *failing* pages: an inspect has no failing
 * pages, so the image is shown for every page that was asked for. The
 * decision's purpose — do not embed megabytes nobody needed — is served by
 * the command only inspecting the pages it was given.
 */

import type { InspectResultJson, ResultInspectPage } from './inspectResult';
import type { InspectedElement } from '../inspect';

/**
 * Escape for HTML text and attributes.
 *
 * Element labels are runs of text out of a document somebody else made. One
 * unescaped `<` turns a report into a page that renders their markup.
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Page images, by page number as the result counts them (1-based). */
export interface InspectReportImages {
  [page: number]: string;
}

export interface InspectReportOptions {
  images?: InspectReportImages;
  /**
   * Cap the rows listed per page. A dense page can hold two thousand text
   * runs, and a table that long is not read — it is scrolled past. The
   * result.json has all of them; the page says how many it left out.
   */
  maxRowsPerPage?: number;
}

const DEFAULT_MAX_ROWS = 300;

const STYLE = `
  :root { color-scheme: light; }
  body { font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
         color: #1e293b; background: #fff; margin: 0; padding: 32px 16px; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 26px 0 6px; }
  .sub { color: #64748b; font-size: 12.5px; margin: 0 0 20px; }
  .pill { display: inline-block; font-weight: 700; font-size: 12px; letter-spacing: .04em;
          border-radius: 999px; padding: 3px 12px; color: #0369a1; background: #f0f9ff; }
  .pill.warn { color: #d97706; background: #fffbeb; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0 18px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: #64748b; }
  .tag { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 1px 8px; }
  .tag.text { color: #0369a1; background: #f0f9ff; }
  .tag.image { color: #7c3aed; background: #f5f3ff; }
  .unsaid { color: #94a3b8; font-style: italic; }
  .label { max-width: 320px; overflow-wrap: anywhere; }
  details { margin: 4px 0 16px; }
  summary { cursor: pointer; font-weight: 600; font-size: 13px; }
  figure { margin: 8px 0; max-width: 420px; }
  figcaption { font-size: 11px; color: #64748b; margin-top: 2px; }
  img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; }
  @media print { body { padding: 0; } details { display: block; } }
`;

/** `undeclared` and `null` are the core saying nobody stated it. */
const said = (v: string | null | undefined, undeclaredAs = 'not stated') =>
  v == null || v === 'undeclared'
    ? `<span class="unsaid">${esc(undeclaredAs)}</span>`
    : esc(v);

function elementRow(el: InspectedElement): string {
  const b = el.box;
  const font = el.font
    ? `${said(el.font.name)} · ${el.font.sizePt} pt · ${said(el.font.weight)}${
      el.font.style === 'italic' ? ' · italic' : ''}`
    : '<span class="unsaid">—</span>';
  const line = el.lineHeight
    ? `${el.lineHeight.pt} pt · ${el.lineHeight.ratio.toFixed(2)}×`
    : el.kind === 'text'
      ? '<span class="unsaid">single line</span>'
      : '';

  return `<tr>
<td><span class="tag ${esc(el.kind)}">${esc(el.kind)}</span></td>
<td class="label">${esc(el.label)}</td>
<td class="num">${b.fromLeftIn}</td>
<td class="num">${b.fromTopIn}</td>
<td class="num">${b.widthIn}</td>
<td class="num">${b.heightIn}</td>
<td class="num">${b.fromRightIn}</td>
<td class="num">${b.fromBottomIn}</td>
<td>${font}</td>
<td>${line}</td></tr>`;
}

function pageSection(page: ResultInspectPage, options: InspectReportOptions): string {
  const max = options.maxRowsPerPage ?? DEFAULT_MAX_ROWS;
  const shown = page.elements.slice(0, max);
  const hidden = page.elements.length - shown.length;
  const image = options.images?.[page.page];

  return `<h2>Page ${page.page}
 <span class="pill${page.hasTextLayer ? '' : ' warn'}">${page.hasTextLayer
    ? `${page.elements.length} element${page.elements.length === 1 ? '' : 's'}`
    : 'no text layer'}</span>
 <span class="sub" style="font-weight:400">${page.widthIn}″ × ${page.heightIn}″</span></h2>
${page.hasTextLayer ? '' : `<p class="sub">No text was read on this page. It may be a scan, or its text may be drawn as outlines — either way the words are not in the file to be measured.</p>`}
${image ? `<figure><img src="${esc(image)}" alt="Page ${page.page}"><figcaption>Page ${page.page}</figcaption></figure>` : ''}
${page.elements.length
    ? `<details><summary>${page.elements.length} element${page.elements.length === 1 ? '' : 's'}</summary>
<table>
<caption class="sub" style="text-align:left;margin:0 0 4px">Distances in inches from the page's edges to the element's own edges; font sizes in points</caption>
<thead><tr><th>Kind</th><th>Content</th><th>From left</th><th>From top</th><th>Width</th><th>Height</th><th>From right</th><th>From bottom</th><th>Font</th><th>Line height</th></tr></thead>
<tbody>${shown.map(elementRow).join('')}</tbody></table>
${hidden > 0 ? `<p class="sub">${hidden} more element${hidden === 1 ? '' : 's'} on this page are in <code>result.json</code>, which lists every one.</p>` : ''}
</details>`
    : ''}`;
}

export function buildInspectReportHtml(
  result: InspectResultJson,
  options: InspectReportOptions = {},
): string {
  const s = result.summary;

  const inputs = result.inputs.map((i) =>
    `<tr><td>${esc(i.name)}</td><td class="mono">${esc(i.sha256 ?? 'not hashed')}</td>
<td class="num">${i.bytes == null ? '' : i.bytes}</td></tr>`).join('');

  const overview = result.pages.map((p) => `<tr>
<td class="num">${p.page}</td>
<td class="num">${p.widthIn}″ × ${p.heightIn}″</td>
<td class="num">${p.elements.filter((e) => e.kind === 'text').length}</td>
<td class="num">${p.elements.filter((e) => e.kind === 'image').length}</td>
<td>${p.hasTextLayer ? 'yes' : '<span class="unsaid">no text layer</span>'}</td></tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inspect — ${esc(result.inputs[0]?.name ?? 'result')}</title>
<style>${STYLE}</style></head>
<body><main>
<h1>Inspect <span class="pill">${s.elements} element${s.elements === 1 ? '' : 's'}</span></h1>
<p class="sub">${s.pages} page${s.pages === 1 ? '' : 's'} · ${s.textElements} text · ${s.imageElements} image${s.imageElements === 1 ? '' : 's'}
 · run ${esc(result.run.started)}${result.findingsSha256 ? ` · findings <span class="mono">${esc(result.findingsSha256.slice(0, 12))}…</span>` : ''}
<br>Positions are in inches from the page's edges; font sizes in points. Nothing here passes or fails — an inspect answers where things are.</p>

<h2>The file inspected</h2>
<table><thead><tr><th>File</th><th>SHA-256</th><th>Bytes</th></tr></thead><tbody>${inputs}</tbody></table>

<h2>Every page</h2>
<table><thead><tr><th>Page</th><th>Size</th><th>Text runs</th><th>Images</th><th>Text readable</th></tr></thead>
<tbody>${overview}</tbody></table>
${s.pagesWithoutText.length
    ? `<p class="sub">No text could be read on page${s.pagesWithoutText.length === 1 ? '' : 's'} ${s.pagesWithoutText.join(', ')}.</p>`
    : ''}

${result.pages.map((p) => pageSection(p, options)).join('\n')}
</main></body></html>`;
}
