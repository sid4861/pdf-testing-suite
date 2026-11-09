/**
 * Which golden page is being compared with which page under test.
 *
 * Comparing page 5 with page 5 is only right while both documents hold the same
 * pages in the same order. Insert a page into one, or drop a page from the
 * other, and every page after it is compared with something it has nothing to do
 * with — a report full of total rewrites that are really just an offset.
 *
 * So the unit of comparison is a *pair*, not a page number. A pair may be
 * one-sided: a golden page with nothing to compare against is missing from the
 * document under test, and a tested page with no golden page was added.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface PagePair {
  /** 0-based page in the golden PDF, or null when the page was added. */
  a: number | null;
  /** 0-based page in the PDF under test, or null when the page is missing. */
  b: number | null;
  /**
   * How confident the automatic alignment was, 0–1, or null when a person
   * decided. Shown in the UI so a weak guess can be checked rather than
   * trusted.
   */
  score: number | null;
}

/**
 * Whether there is enough text to align on at all.
 *
 * A scanned PDF has no text layer, so every page looks identical to every other
 * and the aligner would return a confident-looking 1:1 that is really just the
 * absence of evidence. Callers check this to say so instead.
 */
export function alignable(words: string[][]): boolean {
  const withText = words.filter((w) => w.length >= 5).length;
  return withText >= Math.max(1, Math.ceil(words.length * 0.5));
}

/** The straight 1:1 pairing — what comparing page-by-page has always meant. */
export function sequentialPairs(countA: number, countB: number): PagePair[] {
  const out: PagePair[] = [];
  for (let i = 0; i < Math.max(countA, countB); i++) {
    out.push({
      a: i < countA ? i : null,
      b: i < countB ? i : null,
      score: null,
    });
  }
  return out;
}

export const isSequential = (pairs: PagePair[]): boolean =>
  pairs.every((p, i) => (p.a ?? i) === i && (p.b ?? i) === i);

/** How many pages each side contributes, and how many are one-sided. */
export function pairStats(pairs: PagePair[]) {
  let matched = 0;
  let missing = 0; // in the golden PDF, absent from the test
  let added = 0; // in the test, absent from the golden
  for (const p of pairs) {
    if (p.a != null && p.b != null) matched++;
    else if (p.a != null) missing++;
    else added++;
  }
  return { matched, missing, added };
}

// ── automatic alignment — not currently wired to any UI ──────
//
// Pairing is done by hand: the editor asks which page goes with which and
// infers nothing, because a suggestion that is subtly wrong is worse than no
// suggestion in a tool whose job is to be believed.
//
// What follows aligns the two documents by page content and is kept because it
// works and is tested — it would be the body of a "suggest a pairing" action if
// one is ever wanted. Nothing imports it, so it is tree-shaken out of the build.

// ── page text, for aligning on ────────────────────────────────────────

/**
 * The words on each page, lower-cased, for similarity only.
 *
 * `getTextContent` without rendering: reading every page of a long document
 * this way takes a moment, where rendering them would take a minute.
 */
export async function pageWords(
  doc: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
): Promise<string[][]> {
  const out: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .toLowerCase();
    out.push(text.split(/[^a-z0-9$%.,/-]+/).filter((w) => w.length > 1));
    page.cleanup();
    onProgress?.(i, doc.numPages);
  }
  return out;
}

/**
 * How alike two pages are, 0–1, by shared vocabulary.
 *
 * Counted with multiplicity — a page where "total" appears nine times is not the
 * same as one where it appears once — and divided by the larger page, so a short
 * page is not declared a match for a long one just because it is a subset.
 */
export function similarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);

  let shared = 0;
  for (const w of b) {
    const n = counts.get(w);
    if (n) {
      shared++;
      counts.set(w, n - 1);
    }
  }
  return shared / Math.max(a.length, b.length);
}

/**
 * Pair the pages up by content, keeping both documents in their own order.
 *
 * A global alignment (Needleman–Wunsch) rather than greedy nearest-match: pages
 * cannot be reordered, so the question is where to insert the gaps, and that is
 * only answerable by looking at the whole document at once. Greedy matching gets
 * it wrong exactly where it matters — two similar pages next to an inserted one.
 *
 * `minSim` is the bar a pairing has to clear. A pairing is worth
 * `similarity - minSim` and a gap costs nothing, so two pages are paired only
 * when they are at least that alike — a dropped page and an inserted one are
 * reported as one-sided rather than paired with each other for lack of anything
 * better, which is what a gap *cost* would have done.
 */
export const MIN_SIM = 0.35;

export function alignPages(
  wordsA: string[][],
  wordsB: string[][],
  minSim = MIN_SIM,
): PagePair[] {
  const n = wordsA.length;
  const m = wordsB.length;
  if (n === 0 || m === 0) return sequentialPairs(n, m);
  if (!alignable(wordsA) || !alignable(wordsB)) return sequentialPairs(n, m);

  // score[i][j] — best total for the first i golden and first j tested pages.
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const sim: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) sim[i][j] = similarity(wordsA[i], wordsB[j]);
  }

  // Skipping a page is free; a pairing earns only what it is worth above the bar.
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      score[i][j] = Math.max(
        score[i - 1][j - 1] + (sim[i - 1][j - 1] - minSim), // pair them
        score[i - 1][j], // golden page missing from the test
        score[i][j - 1], // tested page added
      );
    }
  }

  // Walk back for the pairing itself.
  const pairs: PagePair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (
      i > 0 && j > 0 &&
      score[i][j] === score[i - 1][j - 1] + (sim[i - 1][j - 1] - minSim)
    ) {
      pairs.push({ a: i - 1, b: j - 1, score: sim[i - 1][j - 1] });
      i--;
      j--;
    } else if (i > 0 && score[i][j] === score[i - 1][j]) {
      pairs.push({ a: i - 1, b: null, score: null });
      i--;
    } else {
      pairs.push({ a: null, b: j - 1, score: null });
      j--;
    }
  }

  return pairs.reverse();
}

/** A pair's label, e.g. "G3 → T2", or "G7 → —" for a page with no counterpart. */
export function pairLabel(p: PagePair): string {
  const a = p.a == null ? '—' : `G${p.a + 1}`;
  const b = p.b == null ? '—' : `T${p.b + 1}`;
  return `${a} → ${b}`;
}

/**
 * Pair two pages together, rebuilding the whole list around that decision.
 *
 * Existing pairs are kept as anchors where they still make sense. One that
 * would now cross over the new pair is dropped rather than bent: pages cannot
 * change order within their own document, so if golden 7 is pinned to tested 3,
 * then golden 4 cannot still be pinned to tested 9. Everything between anchors
 * falls back to in-order pairing, which is the only neutral answer.
 */
export function pairTogether(
  pairs: PagePair[],
  countA: number,
  countB: number,
  aPage: number,
  bPage: number,
): PagePair[] {
  // Correcting one pair must not erase what alignment knew about the others, so
  // a pair that survives unchanged keeps its similarity score.
  const known = new Map<string, number | null>();
  for (const p of pairs) {
    if (p.a != null && p.b != null) known.set(`${p.a}:${p.b}`, p.score);
  }
  const scoreOf = (a: number, b: number) => known.get(`${a}:${b}`) ?? null;

  const anchors: [number, number][] = [];
  for (const p of pairs) {
    if (p.a == null || p.b == null) continue;
    if (p.a === aPage || p.b === bPage) continue; // being replaced
    if (p.a < aPage !== p.b < bPage) continue; // would cross over
    anchors.push([p.a, p.b]);
  }
  anchors.push([aPage, bPage]);
  anchors.sort((x, y) => x[0] - y[0]);

  const out: PagePair[] = [];
  let ai = 0;
  let bi = 0;

  /** In-order pairing of the stretch before the next anchor. */
  const fill = (untilA: number, untilB: number) => {
    const gapA = untilA - ai;
    const gapB = untilB - bi;
    for (let k = 0; k < Math.max(gapA, gapB); k++) {
      const a = k < gapA ? ai + k : null;
      const b = k < gapB ? bi + k : null;
      out.push({ a, b, score: a != null && b != null ? scoreOf(a, b) : null });
    }
    ai = untilA;
    bi = untilB;
  };

  for (const [a, b] of anchors) {
    fill(a, b);
    // The pair just made by hand has no score of its own; a kept one keeps its.
    out.push({ a, b, score: a === aPage && b === bPage ? null : scoreOf(a, b) });
    ai = a + 1;
    bi = b + 1;
  }
  fill(countA, countB);

  return out;
}

/** Split a pair, leaving each page on its own side. */
export function unpairAt(pairs: PagePair[], row: number): PagePair[] {
  const p = pairs[row];
  if (!p || p.a == null || p.b == null) return pairs;
  const out = [...pairs];
  out.splice(row, 1, { a: p.a, b: null, score: null }, { a: null, b: p.b, score: null });
  return out;
}
