/**
 * The Markdown fix-list for whoever maintains the template.
 *
 * SR-SPEC-CHECK decision 15 is explicit that this is **a UI-only view of
 * `result.json`** (SR-SURFACE-PARITY), not a fourth output file: the CLI does
 * not write it, and nothing is derived from it. It exists because a person
 * fixing a template wants one ordered list of what to change, with the cell to
 * change it in — not a report to read.
 *
 * It therefore reads `result.json` and nothing else, like the HTML report.
 */

import type { ResultJson } from './specResult';

/** Markdown escaping, limited to what breaks a table cell or a list line. */
const esc = (s: string) => s.replace(/([|\\`*_[\]])/g, '\\$1').replace(/\n+/g, ' ');

export function buildFixList(result: ResultJson): string {
  const lines: string[] = [];
  const name = result.inputs[0]?.name ?? 'the workbook';

  lines.push(`# What to fix — ${name}`);
  lines.push('');
  lines.push(`${result.summary.verdict === 'PASS' ? '**Everything passed.**' : `**${result.summary.checksFailed} check${result.summary.checksFailed === 1 ? '' : 's'} failed.**`} ` +
    `${result.summary.elementsPassing} of ${result.summary.elements} elements pass.` +
    (result.coverage ? ` ${result.coverage.checked} of ${result.coverage.rows} workbook rows became a check.` : ''));
  lines.push('');

  const errors = result.pageFindings.filter((f) => f.severity === 'error');
  const warnings = result.pageFindings.filter((f) => f.severity !== 'error');
  if (errors.length) {
    lines.push('## Pages');
    lines.push('');
    for (const f of errors) lines.push(`- **${esc(f.message)}**`);
    lines.push('');
  }

  let any = false;
  for (const page of result.pages) {
    const bad = page.elements.filter((e) => e.checks.some((c) => !c.pass));
    if (bad.length === 0) continue;
    any = true;
    lines.push(`## ${page.name ? `${esc(page.name)} — ` : ''}PDF page ${page.page}`);
    lines.push('');
    for (const el of bad) {
      lines.push(`### ${esc(el.label)}`);
      lines.push('');
      lines.push('| Check | Expected | Actual | Cell |');
      lines.push('|---|---|---|---|');
      for (const c of el.checks.filter((x) => !x.pass)) {
        lines.push(`| ${esc(c.name)} | ${esc(c.expected)} | ${esc(c.actual)} | ${esc(c.cell ?? '—')} |`);
      }
      lines.push('');
    }
  }

  if (!any && errors.length === 0) {
    lines.push('Nothing to fix.');
    lines.push('');
  }

  // Said last, and separately: these are not defects, and a fix-list that
  // mixes them with defects teaches people to skim it.
  const qualified = result.pages.flatMap((p) => p.elements)
    .flatMap((e) => e.checks.filter((c) => c.pass && c.note).map((c) => ({ label: e.label, c })));
  if (warnings.length || qualified.length) {
    lines.push('## Worth a look, not failures');
    lines.push('');
    for (const f of warnings) lines.push(`- ${esc(f.message)}`);
    for (const q of qualified) {
      lines.push(`- ${esc(q.label)} — ${esc(q.c.note!)}${q.c.cell ? ` (${esc(q.c.cell)})` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
