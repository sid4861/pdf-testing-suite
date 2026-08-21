// Markdown remediation report — written to be READ BY A MODEL, not a person.
//
// The other exports answer "did it pass?". This one answers "what do I change in
// the template to make it pass?", and is structured so an LLM can apply the fixes
// to an AEM Forms XDP (XFA XML) template without further interpretation:
//
//   * Side A is the REFERENCE (what the document should look like); side B is the
//     CANDIDATE the template currently produces. Every fix therefore moves B
//     toward A, and is phrased as an imperative on the template.
//   * Positions and deltas are in INCHES, which is what XDP's x/y/w/h attributes
//     accept, so a value here can be used directly.
//   * Deltas are given as the correction to apply, not just the observed drift —
//     a model should never have to work out the sign.
//   * Every finding has a stable ID so a follow-up run can be diffed against this
//     one, and so a model can report which findings it addressed.

import type { CompareSummary, PageComparison } from '../types/compare';
import { buildChanges, type Change } from './changes';
import { download, judgePage, stamp, type ExportMeta, type ExportThresholds } from './exportReport';

/** Severity drives the order a model should work through the findings. */
type Severity = 'critical' | 'high' | 'medium' | 'low';

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface Finding {
  id: string;
  page: number;
  severity: Severity;
  kind: 'missing-page' | 'text' | 'style' | 'layout';
  title: string;
  expected: string | null;
  actual: string | null;
  /** Position of the element on the reference page, in inches. */
  atX: number | null;
  atY: number | null;
  detail: string[];
  fix: string[];
}

const inches = (px: number, ppi: number) => px / ppi;
const inStr = (v: number) => `${v.toFixed(3)}in`;

/** Fenced inline code that survives backticks in the source text. */
function code(text: string): string {
  if (!text) return '`(empty)`';
  const longest = (text.match(/`+/g) ?? []).reduce((m, r) => Math.max(m, r.length), 0);
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** Collapse newlines/tabs so a run always renders on one line. */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

function buildFindings(
  summary: CompareSummary,
  pageCache: Record<number, PageComparison>,
  thresholds: ExportThresholds,
): Finding[] {
  const findings: Finding[] = [];

  for (const page of summary.pages) {
    const pageNo = page.pageIndex + 1;
    const pc = pageCache[page.pageIndex];

    if (page.missing || !pc) {
      findings.push({
        id: `P${pageNo}-MISSING`,
        page: pageNo,
        severity: 'critical',
        kind: 'missing-page',
        title: `Page ${pageNo} exists on only one side`,
        expected: pc?.imageA ? 'page present' : 'page absent',
        actual: pc?.imageB ? 'page present' : 'page absent',
        atX: null,
        atY: null,
        detail: [
          pc?.imageA && !pc?.imageB
            ? 'The reference has this page but the generated document does not.'
            : 'The generated document has a page the reference does not.',
        ],
        fix: [
          pc?.imageA && !pc?.imageB
            ? 'Add the missing page to the template: check the `<pageSet>` for a missing `<pageArea>`, and any `<subform>` whose `occur` or `breakBefore`/`breakAfter` suppresses it. A `relevant` or `presence="hidden"` binding can also drop a whole page.'
            : 'Remove or suppress the extra page: look for a `<subform>` that overflows onto a new `<pageArea>`, or an `occur max` that allows more instances than intended.',
        ],
      });
      continue;
    }

    const ppi = pc.pxPerInch;
    const changes = buildChanges(pc, thresholds.offsetIn);
    const counters = { text: 0, style: 0, layout: 0 };
    const movedOnPage: Change[] = [];

    // Paired removed+added share a group id — report the replacement once rather
    // than as an unrelated deletion and insertion.
    const byGroup = new Map<number, Change[]>();
    for (const c of changes) {
      const list = byGroup.get(c.group) ?? [];
      list.push(c);
      byGroup.set(c.group, list);
    }

    for (const group of byGroup.values()) {
      const removed = group.find((c) => c.type === 'removed');
      const added = group.find((c) => c.type === 'added');
      const styled = group.find((c) => c.type === 'styled');
      const moved = group.find((c) => c.type === 'moved');

      if (removed || added) {
        counters.text += 1;
        const box = (removed?.a ?? added?.b)!;
        const expected = removed ? oneLine(removed.text) : null;
        const actual = added ? oneLine(added.text) : null;

        const title = removed && added
          ? 'Static text differs'
          : removed
            ? 'Text missing from the generated document'
            : 'Unexpected text in the generated document';

        const fix: string[] = [];
        if (removed && added) {
          fix.push(
            `Locate the element whose value is ${code(actual!)} and change it to ${code(expected!)}.`,
            'If the text is static, it is the `<text>` node under `<draw><value>` (or `<field><caption><value>`). If it is bound to data, the wording difference is in the data source or in a `<setProperty>`/script that assigns it, not in the layout.',
          );
        } else if (removed) {
          fix.push(
            `Add ${code(expected!)} back to the template at this position.`,
            'If the element exists but did not render, check `presence` (should be `visible`, not `hidden`/`inactive`) and any `relevant` expression on it or its parent `<subform>`.',
          );
        } else {
          fix.push(
            `Remove ${code(actual!)} from the template, or suppress it with \`presence="hidden"\`.`,
            'If it is generated by a repeating `<subform>`, check the `occur` bounds and the bound data.',
          );
        }

        findings.push({
          id: `P${pageNo}-TEXT-${String(counters.text).padStart(2, '0')}`,
          page: pageNo,
          severity: 'high',
          kind: 'text',
          title,
          expected,
          actual,
          atX: inches(box.x, ppi),
          atY: inches(box.y, ppi),
          detail: [],
          fix,
        });
        continue; // a text edit supersedes any style/position noise in the same group
      }

      if (styled && styled.style && styled.a && styled.b) {
        counters.style += 1;
        const d = styled.style;
        const a = styled.a.style;
        const b = styled.b.style;

        const detail: string[] = [];
        const fix: string[] = [];

        if (d.font && a && b) {
          detail.push(`Typeface: \`${a.font}\` (reference) vs \`${b.font}\` (generated)`);
          fix.push(`Set \`<font typeface="${a.font}"/>\` on this element.`);
        }
        if (d.size && a && b) {
          const aPt = (a.size / ppi) * 72;
          const bPt = (b.size / ppi) * 72;
          detail.push(`Size: ${aPt.toFixed(1)}pt (reference) vs ${bPt.toFixed(1)}pt (generated)`);
          fix.push(`Set \`<font size="${aPt.toFixed(1)}pt"/>\` on this element.`);
        }
        if (d.bold && a) {
          detail.push(`Weight: ${a.bold ? 'bold' : 'normal'} (reference) vs ${a.bold ? 'normal' : 'bold'} (generated)`);
          fix.push(`Set \`<font weight="${a.bold ? 'bold' : 'normal'}"/>\` on this element.`);
        }
        if (d.italic && a) {
          detail.push(`Posture: ${a.italic ? 'italic' : 'normal'} (reference) vs ${a.italic ? 'normal' : 'italic'} (generated)`);
          fix.push(`Set \`<font posture="${a.italic ? 'italic' : 'normal'}"/>\` on this element.`);
        }
        fix.push(
          'The `<font>` element sits inside the `<draw>`/`<field>` its text belongs to. If many elements changed together, the cause is more likely a shared `<proto>` template or the form-level default font than each element individually.',
        );

        findings.push({
          id: `P${pageNo}-STYLE-${String(counters.style).padStart(2, '0')}`,
          page: pageNo,
          severity: 'medium',
          kind: 'style',
          title: 'Font or text style differs',
          expected: oneLine(styled.text),
          actual: oneLine(styled.text),
          atX: inches(styled.a.x, ppi),
          atY: inches(styled.a.y, ppi),
          detail,
          fix,
        });
        continue;
      }

      if (moved && moved.a && moved.b) {
        // Collected and grouped after the loop — see below.
        movedOnPage.push(moved);
      }
    }

    // Cascading shifts share one cause. When a row is deleted or a block resized,
    // every element below it moves by the SAME amount — reporting those
    // individually buries one real fix under dozens of identical ones, which is
    // exactly the wrong thing to hand an agent. Group by the shared delta.
    const byDelta = new Map<string, Change[]>();
    for (const m of movedOnPage) {
      const dx = inches(m.b!.x - m.a!.x, ppi);
      const dy = inches(m.b!.y - m.a!.y, ppi);
      // 0.01in buckets — finer than any real layout intent, coarser than
      // rendering noise.
      const key = `${dx.toFixed(2)}|${dy.toFixed(2)}`;
      byDelta.set(key, [...(byDelta.get(key) ?? []), m]);
    }

    const deltaGroups = [...byDelta.values()].sort((a, b) => b.length - a.length);
    for (const group of deltaGroups) {
      counters.layout += 1;
      const first = group[0];
      const dxIn = inches(first.b!.x - first.a!.x, ppi);
      const dyIn = inches(first.b!.y - first.a!.y, ppi);
      const shared = group.length > 1;

      const corrections: string[] = [];
      if (Math.abs(dxIn) >= 0.005) {
        corrections.push(`${dxIn > 0 ? 'decrease' : 'increase'} \`x\` by ${inStr(Math.abs(dxIn))}`);
      }
      if (Math.abs(dyIn) >= 0.005) {
        corrections.push(`${dyIn > 0 ? 'decrease' : 'increase'} \`y\` by ${inStr(Math.abs(dyIn))}`);
      }

      const detail: string[] = [
        `Drift: ${inStr(Math.abs(dxIn))} ${dxIn > 0 ? 'right' : 'left'}, ${inStr(Math.abs(dyIn))} ${dyIn > 0 ? 'down' : 'up'}`,
      ];
      if (shared) {
        detail.push(
          `**${group.length} elements moved by this same amount**, so they almost certainly share one cause rather than needing ${group.length} separate edits.`,
        );
        detail.push('Affected text (first 8):');
        for (const m of group.slice(0, 8)) {
          detail.push(`  - ${code(oneLine(m.text))} at x ${inStr(inches(m.a!.x, ppi))}, y ${inStr(inches(m.a!.y, ppi))}`);
        }
        if (group.length > 8) detail.push(`  - …and ${group.length - 8} more`);
      } else {
        detail.push(`Text: ${code(oneLine(first.text))}`);
      }

      const fix: string[] = [];
      if (!corrections.length) {
        fix.push('Position differs by less than 0.005in — no change needed.');
      } else if (shared) {
        fix.push(
          `Find the single upstream cause and ${corrections.join(' and ')} for the block as a whole.`,
          Math.abs(dyIn) > Math.abs(dxIn)
            ? 'A uniform **vertical** shift of a contiguous block usually means content above it changed height: a row added or removed from a repeating `<subform>`, a changed `occur` count, a `<para spaceAbove>/<spaceBelow>` edit, or a text block that now wraps onto a different number of lines.'
            : 'A uniform **horizontal** shift usually means a container moved or resized: check the parent `<subform>`\'s `x`/`w`, its `<margin leftInset>`, or a column width in the enclosing table.',
          'Fixing the container is correct; nudging each of these elements individually is not, and will break the next time the data changes.',
        );
      } else {
        fix.push(`On the element containing this text, ${corrections.join(' and ')}.`);
        fix.push(
          'In a flowed `<subform layout="tb">` the element has no explicit `x`/`y`: the offset comes from a preceding sibling\'s height, `<margin>`, or `<para spaceAbove>/<spaceBelow>`. Adjust those rather than adding absolute coordinates.',
        );
      }

      findings.push({
        id: `P${pageNo}-LAYOUT-${String(counters.layout).padStart(2, '0')}`,
        page: pageNo,
        severity: shared ? 'medium' : 'low',
        kind: 'layout',
        title: shared
          ? `${group.length} elements shifted together by the same amount`
          : 'Element position differs',
        expected: `x ${inStr(inches(first.a!.x, ppi))}, y ${inStr(inches(first.a!.y, ppi))}`,
        actual: `x ${inStr(inches(first.b!.x, ppi))}, y ${inStr(inches(first.b!.y, ppi))}`,
        atX: inches(first.a!.x, ppi),
        atY: inches(first.a!.y, ppi),
        detail,
        fix,
      });
    }
  }

  findings.sort(
    (a, b) => a.page - b.page || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id),
  );
  return findings;
}

const HEADER = `# PDF Template Remediation Report

> Generated by PDF Comparison Suite. This file is written for an automated agent:
> every finding states what the template currently produces, what it should
> produce, and the XDP change that closes the gap.

## How to use this file

1. Work through findings in the order given — they are sorted by page, then by
   severity (critical → high → medium → low).
2. **Side A is the reference**: the document as it should look.
   **Side B is the candidate**: what the current template produces.
   Every fix moves B toward A. Never change the reference.
3. Apply each fix to the **XDP template**, not to the generated PDF.
4. Positions and deltas are in **inches**, matching XDP's \`x\`, \`y\`, \`w\` and \`h\`
   attributes, so values can be used as written. Font sizes are in **points**,
   matching \`<font size>\`.
5. Layout deltas are already expressed as the **correction to apply** ("decrease
   \`y\` by 0.08in"), not as the observed drift. Do not invert the sign.
6. When several findings on a page share the same cause — a whole column shifted,
   or every label changing weight — fix the shared ancestor (\`<subform>\`,
   \`<proto>\`, or the form-level default) rather than each element.
7. Re-run the comparison after editing and diff the new report against this one.
   Finding IDs are stable for unchanged issues.

## What this report cannot tell you

- **Element names.** The comparison sees rendered output, not the template, so it
  reports text and coordinates. Locate the element by its text content or its
  position on the page.
- **Whether text is static or data-bound.** If the wording comes from a data
  source, the fix belongs in the data or the binding, not in \`<draw><value>\`.
- **Purely visual differences with no text**, such as a changed rule colour or a
  background fill. Those raise the pixel-difference percentage but produce no
  finding here; consult the HTML report's heatmap for those.

## XDP attribute reference

| Finding kind | XDP element / attribute |
|---|---|
| Static text | \`<draw><value><text>\` — or \`<field><caption><value><text>\` for labels |
| Typeface | \`<font typeface="…"/>\` |
| Font size | \`<font size="11pt"/>\` |
| Bold | \`<font weight="bold\\|normal"/>\` |
| Italic | \`<font posture="italic\\|normal"/>\` |
| Position (positioned layout) | \`<draw x="1.5in" y="2.25in">\` |
| Position (flowed layout) | preceding sibling height, \`<margin>\`, \`<para spaceAbove/spaceBelow>\` |
| Element hidden | \`presence="visible\\|hidden\\|inactive"\`, \`relevant\` |
| Missing / extra page | \`<pageSet>\`, \`<pageArea>\`, \`<subform occur>\`, \`breakBefore\`/\`breakAfter\` |
`;

function findingBlock(f: Finding): string {
  const lines: string[] = [];
  lines.push(`#### ${f.id} — ${f.title}`);
  lines.push('');
  lines.push(`- **Severity**: ${f.severity}`);
  lines.push(`- **Kind**: ${f.kind}`);
  if (f.atX != null && f.atY != null) {
    lines.push(`- **Position on page (reference)**: x ${inStr(f.atX)}, y ${inStr(f.atY)} from the top-left corner`);
  }
  if (f.kind === 'text') {
    lines.push(`- **Expected (reference)**: ${f.expected == null ? '_absent_' : code(f.expected)}`);
    lines.push(`- **Actual (generated)**: ${f.actual == null ? '_absent_' : code(f.actual)}`);
  } else if (f.expected != null && f.actual != null && f.kind !== 'style') {
    lines.push(`- **Expected (reference)**: ${f.expected}`);
    lines.push(`- **Actual (generated)**: ${f.actual}`);
  } else if (f.kind === 'style' && f.expected != null) {
    lines.push(`- **Text**: ${code(f.expected)} _(unchanged — only the styling differs)_`);
  }
  // Detail lines that already carry their own indented bullet are emitted as-is,
  // so nested lists do not end up double-prefixed.
  for (const d of f.detail) lines.push(/^\s+-\s/.test(d) ? d : `- ${d}`);
  lines.push('');
  lines.push('**Fix**');
  lines.push('');
  for (const step of f.fix) lines.push(`- ${step}`);
  lines.push('');
  return lines.join('\n');
}

export function buildMarkdownReport(
  summary: CompareSummary,
  meta: ExportMeta,
  thresholds: ExportThresholds,
  pageCache: Record<number, PageComparison>,
): string {
  const findings = buildFindings(summary, pageCache, thresholds);
  const passCount = summary.pages.filter((p) => judgePage(p, thresholds)).length;
  const overall = passCount === summary.pages.length;

  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});

  const out: string[] = [HEADER];

  out.push('## Run metadata');
  out.push('');
  out.push(`- **Reference (side A, expected)**: \`${meta.nameA}\` — ${meta.pageCountA} pages`);
  out.push(`- **Candidate (side B, generated)**: \`${meta.nameB}\` — ${meta.pageCountB} pages`);
  out.push(`- **Generated**: ${new Date(meta.generatedAt).toISOString()}`);
  out.push(`- **Overall**: ${overall ? 'PASS' : 'FAIL'} — ${passCount}/${summary.pages.length} pages within tolerance`);
  out.push(
    `- **Thresholds**: content ≥ ${thresholds.contentPct}%, pixels ≤ ${thresholds.pixelPct}%, offset ≤ ${thresholds.offsetIn}in`,
  );
  out.push(`- **Total findings**: ${findings.length}` +
    (findings.length
      ? ` (${['missing-page', 'text', 'style', 'layout']
          .filter((k) => counts[k])
          .map((k) => `${counts[k]} ${k}`)
          .join(', ')})`
      : ''));
  out.push('');

  if (!findings.length) {
    out.push('## Findings');
    out.push('');
    out.push('No actionable differences were detected. The template needs no changes.');
    out.push('');
    return out.join('\n');
  }

  out.push('## Findings summary');
  out.push('');
  out.push('| ID | Page | Severity | Kind | Summary |');
  out.push('|---|---|---|---|---|');
  for (const f of findings) {
    let summaryCell: string;
    if (f.kind === 'text' && f.expected != null && f.actual != null) {
      summaryCell = `${code(f.expected)} → ${code(f.actual)}`;
    } else if (f.kind === 'text' && f.expected != null) {
      summaryCell = `missing: ${code(f.expected)}`;
    } else if (f.kind === 'text' && f.actual != null) {
      summaryCell = `unexpected: ${code(f.actual)}`;
    } else if (f.kind === 'style') {
      summaryCell = `${code(f.expected ?? '')} — ${f.detail.join('; ')}`;
    } else if (f.kind === 'layout') {
      summaryCell = `${f.title} — ${f.detail[0] ?? ''}`;
    } else {
      summaryCell = f.title;
    }
    out.push(`| ${f.id} | ${f.page} | ${f.severity} | ${f.kind} | ${summaryCell.replace(/\|/g, '\\|')} |`);
  }
  out.push('');

  out.push('## Findings by page');
  out.push('');
  let currentPage = -1;
  for (const f of findings) {
    if (f.page !== currentPage) {
      currentPage = f.page;
      const page = summary.pages.find((p) => p.pageIndex + 1 === currentPage);
      out.push(`### Page ${currentPage}`);
      out.push('');
      if (page && !page.missing) {
        out.push(
          `Content match ${(page.contentMatch * 100).toFixed(1)}% · ` +
            `pixels different ${(page.pixelRatio * 100).toFixed(2)}% · ` +
            `largest shift ${(page.maxOffset / page.pxPerInch).toFixed(3)}in · ` +
            `${judgePage(page, thresholds) ? 'within tolerance' : 'FAILS thresholds'}`,
        );
        out.push('');
      }
    }
    out.push(findingBlock(f));
  }

  out.push('## Completion checklist');
  out.push('');
  out.push('Mark each finding as you address it, and state what you changed:');
  out.push('');
  for (const f of findings) {
    out.push(`- [ ] \`${f.id}\` — ${f.title} (page ${f.page})`);
  }
  out.push('');
  out.push(
    'After applying the fixes, regenerate the PDF from the updated template and re-run the comparison. ' +
      'Any finding that persists means the edit did not take effect — most often because the element is ' +
      'data-bound, inherited from a `<proto>`, or overridden by a script.',
  );
  out.push('');

  return out.join('\n');
}

export function exportMarkdownReport(
  summary: CompareSummary,
  meta: ExportMeta,
  thresholds: ExportThresholds,
  pageCache: Record<number, PageComparison>,
) {
  download(
    `pdf-remediation-${stamp()}.md`,
    buildMarkdownReport(summary, meta, thresholds, pageCache),
    'text/markdown',
  );
}
