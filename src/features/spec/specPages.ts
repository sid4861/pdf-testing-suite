/**
 * Which PDF page is which spec page — SR-SPEC-CHECK decisions 1–3.
 *
 * Until now a spec page was checked against the PDF page with the same number,
 * which is only right when nothing is ever optional, missing or reordered. The
 * Pages List says more than that: a page is identified by *its own text*, and
 * what to do when it is absent depends on whether it was Required, Optional or
 * Conditional.
 *
 * The binding is done here, over page text alone, so it can be tested without
 * a PDF: every rule in decisions 1–3 is a statement about which text appeared
 * where, and none of them needs a renderer to decide.
 */

import type { PageFinding, SpecPage } from './types';

/** One spec page, and the PDF page (if any) it was matched to. */
export interface PageBinding {
  /** Index into `spec.pages`. */
  index: number;
  specPage: SpecPage;
  /** 1-based PDF page, or null when the page is not in the document. */
  pdfPage: number | null;
  how: 'declared' | 'identified' | 'out-of-order' | 'repeat' | 'missing';
  /** 1-based, for a page that repeats. */
  occurrence: number;
}

export interface BindResult {
  bindings: PageBinding[];
  findings: PageFinding[];
}

/** Comparable text: case, accents of whitespace and punctuation spacing removed. */
export function normalizePageText(s: string): string {
  return s
    .replace(/­/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const says = (pageText: string, identifying: string) =>
  pageText.includes(normalizePageText(identifying));

/** Whether this spec was written from a Pages List at all. */
export function hasPagesList(pages: SpecPage[]): boolean {
  return pages.some((p) => p.kind != null || p.identifyingText != null);
}

/**
 * Bind the spec's pages to the PDF's.
 *
 * `pageTexts[i]` is the text of PDF page i+1, in reading order. The walk is
 * forward: a page is looked for at or after the cursor, because the Pages List
 * states an order and finding page 2 before page 1 is itself a finding.
 */
export function bindPages(pageTexts: string[], pages: SpecPage[]): BindResult {
  const texts = pageTexts.map(normalizePageText);
  const bindings: PageBinding[] = [];
  const findings: PageFinding[] = [];
  const taken = new Set<number>();

  let cursor = 0; // 0-based index of the first PDF page not yet accounted for

  /** The first PDF page at or after `from` whose text says this, else null. */
  const findFrom = (identifying: string, from: number): number | null => {
    for (let i = from; i < texts.length; i++) {
      if (!taken.has(i) && says(texts[i], identifying)) return i;
    }
    return null;
  };
  const findAnywhere = (identifying: string): number | null => {
    for (let i = 0; i < texts.length; i++) {
      if (!taken.has(i) && says(texts[i], identifying)) return i;
    }
    return null;
  };

  const absent = (index: number, page: SpecPage) => {
    bindings.push({ index, specPage: page, pdfPage: null, how: 'missing', occurrence: 1 });
    const name = page.name ?? `page ${page.page}`;
    if (page.kind === 'optional') {
      findings.push({
        severity: 'note', specPage: page.page, specName: page.name,
        message: `${name} is Optional and is not in this PDF.`,
      });
    } else if (page.kind === 'conditional') {
      findings.push({
        severity: 'note', specPage: page.page, specName: page.name,
        message: `${name} is Conditional and is not in this PDF, which is not a failure — ` +
          'it is checked when it appears.',
      });
    } else {
      findings.push({
        severity: 'error', specPage: page.page, specName: page.name,
        message: `${name} is Required and is not in this PDF.`,
      });
    }
  };

  // Variant groups are decided together: the group matches once, or it is an
  // error, so its members cannot be walked one at a time.
  const groups = new Map<string, number[]>();
  pages.forEach((p, i) => {
    if (!p.variantGroup) return;
    const list = groups.get(p.variantGroup) ?? [];
    list.push(i);
    groups.set(p.variantGroup, list);
  });
  const handled = new Set<number>();

  for (let index = 0; index < pages.length; index++) {
    if (handled.has(index)) continue;
    const page = pages[index];

    // ── a variant group (decision 1) ──
    if (page.variantGroup) {
      const members = groups.get(page.variantGroup)!;
      members.forEach((i) => handled.add(i));

      const hits = members
        .map((i) => ({ i, at: pages[i].identifyingText ? findFrom(pages[i].identifyingText!, cursor) : null }))
        .filter((h) => h.at != null) as { i: number; at: number }[];

      if (hits.length === 1) {
        const hit = hits[0];
        taken.add(hit.at);
        cursor = Math.max(cursor, hit.at + 1);
        bindings.push({
          index: hit.i, specPage: pages[hit.i], pdfPage: hit.at + 1,
          how: 'identified', occurrence: 1,
        });
        for (const i of members) {
          if (i !== hit.i) {
            bindings.push({ index: i, specPage: pages[i], pdfPage: null, how: 'missing', occurrence: 1 });
          }
        }
      } else {
        // None or several: decision 1 calls both an error, because the document
        // is then not one of the shapes the spec allows.
        const names = members.map((i) => pages[i].name ?? `page ${pages[i].page}`).join(', ');
        findings.push({
          severity: 'error',
          specPage: page.page,
          message: hits.length === 0
            ? `Variant group “${page.variantGroup}” matched no page: exactly one of ${names} must be in the PDF.`
            : `Variant group “${page.variantGroup}” matched ${hits.length} pages (${hits.map((h) => `page ${h.at + 1}`).join(', ')}): exactly one of ${names} may be in the PDF.`,
        });
        for (const h of hits) {
          taken.add(h.at);
          cursor = Math.max(cursor, h.at + 1);
          bindings.push({
            index: h.i, specPage: pages[h.i], pdfPage: h.at + 1, how: 'identified', occurrence: 1,
          });
        }
        for (const i of members) {
          if (!hits.some((h) => h.i === i)) {
            bindings.push({ index: i, specPage: pages[i], pdfPage: null, how: 'missing', occurrence: 1 });
          }
        }
      }
      continue;
    }

    // ── no identifying text: the declared number is all there is ──
    if (!page.identifyingText) {
      const at = page.page - 1;
      const inRange = at >= 0 && at < texts.length;
      if (inRange) taken.add(at);
      bindings.push({
        index, specPage: page, pdfPage: inRange ? page.page : null,
        how: inRange ? 'declared' : 'missing', occurrence: 1,
      });
      if (!inRange) absentNumbered(findings, page);
      else cursor = Math.max(cursor, at + 1);
      continue;
    }

    // ── identified by its text (decision 2) ──
    let at = findFrom(page.identifyingText, cursor);
    let how: PageBinding['how'] = 'identified';

    if (at == null) {
      const earlier = findAnywhere(page.identifyingText);
      if (earlier != null) {
        // It is in the document, before where the Pages List puts it. Still
        // compared — the content is what matters — and said out loud.
        at = earlier;
        how = 'out-of-order';
        findings.push({
          severity: 'warning', pdfPage: earlier + 1, specPage: page.page, specName: page.name,
          message: `${page.name ?? `Page ${page.page}`} was found at PDF page ${earlier + 1}, ` +
            'not where the Pages List puts it. It is still checked.',
        });
      } else {
        absent(index, page);
        continue;
      }
    }

    taken.add(at);
    cursor = Math.max(cursor, at + 1);
    bindings.push({ index, specPage: page, pdfPage: at + 1, how, occurrence: 1 });

    // ── repeats (decision 3) ──
    const repeats = page.repeats ?? { min: 1, max: 1 };
    let seen = 1;
    for (;;) {
      // Occurrences past the top of the range are still taken, and still
      // checked: they are that page, and reporting them as "a PDF page nobody
      // claimed" would be both a weaker finding and the wrong one. The count
      // is compared with the range afterwards.
      const next = cursor;
      if (next >= texts.length || taken.has(next) || !says(texts[next], page.identifyingText)) break;
      taken.add(next);
      cursor = next + 1;
      seen++;
      bindings.push({ index, specPage: page, pdfPage: next + 1, how: 'repeat', occurrence: seen });
    }

    if (seen < repeats.min || (repeats.max != null && seen > repeats.max)) {
      const want = repeats.max == null
        ? `at least ${repeats.min}`
        : repeats.min === repeats.max ? `${repeats.min}` : `${repeats.min} to ${repeats.max}`;
      findings.push({
        severity: 'error', specPage: page.page, specName: page.name,
        message: `${page.name ?? `Page ${page.page}`} appears ${seen} time${seen === 1 ? '' : 's'}; ` +
          `the Pages List says ${want}.`,
      });
    }
  }

  // ── PDF pages nothing covers (decision 2) ──
  for (let i = 0; i < texts.length; i++) {
    if (taken.has(i)) continue;
    findings.push({
      severity: 'warning', pdfPage: i + 1,
      message: `PDF page ${i + 1} is not in the Pages List, so nothing was checked on it.`,
    });
  }

  bindings.sort((a, b) => (a.pdfPage ?? Infinity) - (b.pdfPage ?? Infinity) || a.index - b.index);
  return { bindings, findings };
}

function absentNumbered(findings: PageFinding[], page: SpecPage) {
  findings.push({
    severity: 'error', specPage: page.page, specName: page.name,
    message: `The spec describes page ${page.page}, which this PDF does not have.`,
  });
}
