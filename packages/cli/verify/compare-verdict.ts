import { PAGE_VERDICT } from '@pdfsuite/core';
import type { PageComparison, PageSummary } from '@pdfsuite/core';
import {
  pageVerdict, summaryChanged, comparisonChanged,
  evidenceFromSummary, evidenceFromComparison, REASON_LABEL,
} from '@pdfsuite/compare';

/**
 * W-27 DoD 2 — one rule for "did this page change".
 *
 * The band this test exists for: a page whose furthest moved item sits
 * between the verdict's 2 px and the strip's old 0.02 in (≈ 2.9 px at 144
 * dpi). The report failed such a page and Next change skipped it, so the
 * tool contradicted itself about the same page. Both sides now answer from
 * `pageVerdict`, and the test holds that band to one answer.
 */

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

/** A page summary that passes, so each test changes one thing. */
const clean = (over: Partial<PageSummary> = {}): PageSummary => ({
  pageIndex: 0,
  contentMatch: 1,
  pixelRatio: 0,
  maxOffset: 0,
  pxPerInch: 144,
  missing: false,
  ...over,
});

/** A comparison that passes, with only the fields the rule reads. */
const comparison = (over: Partial<PageComparison> = {}): PageComparison => ({
  pageIndex: 0,
  imageA: {} as PageComparison['imageA'],
  imageB: {} as PageComparison['imageB'],
  textA: '', textB: '', diff: [], contentMatch: 1,
  match: { matched: [], onlyA: [], onlyB: [] } as unknown as PageComparison['match'],
  maxOffset: 0,
  pxPerInch: 144,
  pixel: null,
  notes: [],
  ...over,
});

function main() {
  console.log('\n  a page that did not change\n');

  check('a clean summary passes', summaryChanged(clean()) === false);
  check('a clean comparison passes', comparisonChanged(comparison()) === false);
  check('and the verdict gives no reason', pageVerdict(evidenceFromSummary(clean())).reasons.length === 0);

  console.log('\n  the band the two old rules disagreed about\n');

  // 2 px is the verdict's limit; the strip used 0.02 in ≈ 2.9 px at 144 dpi.
  const inBand = 2.5;
  check('2.5 px is past the limit', inBand > PAGE_VERDICT.maxOffsetPx,
    `limit ${PAGE_VERDICT.maxOffsetPx} px`);
  check('and it was under the strip’s old one', inBand < 0.02 * 144,
    `the old strip threshold was ${0.02 * 144} px`);

  const bandSummary = summaryChanged(clean({ maxOffset: inBand }));
  const bandComparison = comparisonChanged(comparison({ maxOffset: inBand }));
  check('both sides now call it changed', bandSummary === true && bandComparison === true,
    `summary ${bandSummary}, comparison ${bandComparison}`);
  check('which is the point: they agree',
    bandSummary === bandComparison);
  check('and the reason given is the movement',
    pageVerdict(evidenceFromSummary(clean({ maxOffset: inBand }))).reasons.join() === 'moved');

  check('exactly at the limit is not yet changed',
    summaryChanged(clean({ maxOffset: PAGE_VERDICT.maxOffsetPx })) === false,
    `${PAGE_VERDICT.maxOffsetPx} px`);

  console.log('\n  every reason, one at a time\n');

  check('a missing page', pageVerdict({ missing: true, contentMatch: 1, pixelRatio: 0, maxOffsetPx: 0 }).reasons.join() === 'missing');
  check('text on one side only',
    pageVerdict({ contentMatch: 1, pixelRatio: 0, maxOffsetPx: 0, itemsOnlyOnOneSide: 1 }).reasons.join() === 'only-on-one-side');
  check('the text differs',
    summaryChanged(clean({ contentMatch: PAGE_VERDICT.contentMatchFloor - 0.0001 })) === true);
  check('the pages look different',
    summaryChanged(clean({ pixelRatio: PAGE_VERDICT.pixelRatioFloor + 0.0001 })) === true);
  check('every reason has words for a report',
    Object.keys(REASON_LABEL).length === 5 && Object.values(REASON_LABEL).every((v) => v.length > 10));

  console.log('\n  what each side can see\n');

  // The summary cannot see one-sided items; saying "none" would be a claim it
  // is not entitled to make, and would quietly weaken the rule.
  check('a summary does not claim to know about one-sided items',
    evidenceFromSummary(clean()).itemsOnlyOnOneSide === undefined);
  check('a comparison does', evidenceFromComparison(comparison()).itemsOnlyOnOneSide === 0);

  const several = pageVerdict({ missing: false, contentMatch: 0.5, pixelRatio: 0.5, maxOffsetPx: 99 });
  check('several reasons are all reported', several.reasons.length === 3,
    several.reasons.join(', '));

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main();
