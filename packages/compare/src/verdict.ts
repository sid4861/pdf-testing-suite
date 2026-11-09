/**
 * One rule for "did this page change" — SR-COMPARE, W-27 DoD 2.
 *
 * There were two. `summaryPageDiffers` judged the summary and decided the
 * verdict and the report; `pageHasChange` judged the full comparison and
 * decided the page strip and Next change. They used different thresholds for
 * the same question: a run that moved 2.5 px failed the report and was
 * *skipped* by Next change, so the tool told you a page was fine and then
 * failed it. Nobody can act on that.
 *
 * So the rule lives here once, both sides call it, and the evidence each has
 * is adapted to one shape. Where one side knows something the other does not
 * — items present on only one side are visible in the comparison and not in
 * the summary — the rule uses what it is given and says which evidence
 * decided it.
 */

import { PAGE_VERDICT, type PageComparison, type PageSummary } from '@pdfsuite/core';

/** What is known about a page, from whichever side is asking. */
export interface PageEvidence {
  /** The page exists on only one side. */
  missing?: boolean;
  /** 0–1; how much of the text is common to both. */
  contentMatch: number;
  /** 0–1; the share of pixels that differ. */
  pixelRatio: number;
  /** The furthest a matched item moved, in pixels. */
  maxOffsetPx: number;
  /**
   * Items found on one side and not the other. Known from a full comparison,
   * unknown from a summary — `undefined` means "not asked", never "none".
   */
  itemsOnlyOnOneSide?: number;
}

export type VerdictReason =
  | 'missing'
  | 'only-on-one-side'
  | 'moved'
  | 'content'
  | 'pixels';

export interface PageVerdict {
  changed: boolean;
  /** Every reason that fired, in the order a person would check them. */
  reasons: VerdictReason[];
}

/** What each reason means, for a report that has to explain itself. */
export const REASON_LABEL: Record<VerdictReason, string> = {
  missing: 'the page is on only one side',
  'only-on-one-side': 'text is present on one side and not the other',
  moved: 'something moved further than the tolerance',
  content: 'the text differs',
  pixels: 'the pages look different',
};

/**
 * Did this page change?
 *
 * Every threshold comes from SR-CONSTANTS, including the offset — which is
 * the one the two old rules disagreed about. The stricter of the two wins,
 * so no page that used to count as changed stops counting.
 */
export function pageVerdict(e: PageEvidence): PageVerdict {
  const reasons: VerdictReason[] = [];

  if (e.missing) reasons.push('missing');
  if ((e.itemsOnlyOnOneSide ?? 0) > 0) reasons.push('only-on-one-side');
  if (e.maxOffsetPx > PAGE_VERDICT.maxOffsetPx) reasons.push('moved');
  if (e.contentMatch < PAGE_VERDICT.contentMatchFloor) reasons.push('content');
  if (e.pixelRatio > PAGE_VERDICT.pixelRatioFloor) reasons.push('pixels');

  return { changed: reasons.length > 0, reasons };
}

/** A page summary as evidence. It cannot see one-sided items. */
export function evidenceFromSummary(p: PageSummary): PageEvidence {
  return {
    missing: p.missing,
    contentMatch: p.contentMatch,
    pixelRatio: p.pixelRatio,
    maxOffsetPx: p.maxOffset,
  };
}

/** A full comparison as evidence — everything the summary has, and more. */
export function evidenceFromComparison(pc: PageComparison): PageEvidence {
  return {
    missing: !pc.imageA || !pc.imageB,
    contentMatch: pc.contentMatch,
    pixelRatio: pc.pixel?.ratio ?? 0,
    maxOffsetPx: pc.maxOffset,
    itemsOnlyOnOneSide: pc.match.onlyA.length + pc.match.onlyB.length,
  };
}

/** Did this page change, judged from its summary? */
export const summaryChanged = (p: PageSummary): boolean =>
  pageVerdict(evidenceFromSummary(p)).changed;

/** Did this page change, judged from its full comparison? */
export const comparisonChanged = (pc: PageComparison): boolean =>
  pageVerdict(evidenceFromComparison(pc)).changed;
