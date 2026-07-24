// Shared change-derivation logic used by both the Content view and the HTML export,
// so the on-screen highlights and the exported report stay in sync.

import type { PageComparison, PageSummary, TextItem } from '../types/compare';

export type ChangeType = 'removed' | 'added' | 'moved';

export interface Change {
  id: number;
  group: number;      // paired removed+added (an in-place replacement) share a group
  type: ChangeType;
  text: string;
  a: TextItem | null; // box on side A
  b: TextItem | null; // box on side B
  offset?: number;    // for 'moved'
}

export const TYPE_LABEL: Record<ChangeType, string> = {
  removed: 'Removed',
  added: 'Added',
  moved: 'Moved',
};

export const CHANGE_COLOR: Record<ChangeType, string> = {
  removed: '#dc2626', // red
  added: '#059669',   // emerald
  moved: '#7c3aed',   // violet — kept well clear of red so the two never blur together
};

/** Convert a target-box pixel distance to inches. */
export const pxToInch = (px: number, pxPerInch: number) => px / pxPerInch;
/** Format a target-box pixel distance as inches, e.g. `0.26″`. */
export const fmtInch = (px: number, pxPerInch: number) => `${(px / pxPerInch).toFixed(2)}″`;

/** Which side(s) a change is drawn on. */
export function isOnSide(c: Change, side: 'A' | 'B'): boolean {
  return side === 'A'
    ? !!c.a && (c.type === 'removed' || c.type === 'moved')
    : !!c.b && (c.type === 'added' || c.type === 'moved');
}

export function region(box: TextItem, w: number, h: number): string {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const vert = cy < h / 3 ? 'top' : cy < (2 * h) / 3 ? 'middle' : 'bottom';
  const horz = cx < w / 3 ? 'left' : cx < (2 * w) / 3 ? 'center' : 'right';
  return `${vert}-${horz}`;
}

export function buildChanges(pc: PageComparison, movedThresholdIn: number): Change[] {
  const thresholdPx = movedThresholdIn * pc.pxPerInch;
  const raw: Omit<Change, 'id' | 'group'>[] = [];
  for (const it of pc.match.onlyA) raw.push({ type: 'removed', text: it.str, a: it, b: null });
  for (const it of pc.match.onlyB) raw.push({ type: 'added', text: it.str, a: null, b: it });
  for (const p of pc.match.matched) {
    if (p.offset > thresholdPx) {
      raw.push({ type: 'moved', text: p.a.str, a: p.a, b: p.b, offset: p.offset });
    }
  }
  raw.sort((r1, r2) => {
    const b1 = (r1.a ?? r1.b)!;
    const b2 = (r2.a ?? r2.b)!;
    return b1.y - b2.y || b1.x - b2.x;
  });
  const changes: Change[] = raw.map((r, i) => ({ ...r, id: i + 1, group: i + 1 }));

  // Pair each removed run with its nearest added run at the same spot (an in-place
  // replacement) so they share a highlight group — hovering one lights up both.
  const added = changes.filter((c) => c.type === 'added');
  const usedAdded = new Set<number>();
  for (const rem of changes) {
    if (rem.type !== 'removed') continue;
    const a = rem.a!;
    let best: Change | null = null;
    let bestD = Infinity;
    for (const add of added) {
      if (usedAdded.has(add.id)) continue;
      const b = add.b!;
      const d = Math.hypot(b.x + b.w / 2 - (a.x + a.w / 2), b.y + b.h / 2 - (a.y + a.h / 2));
      if (d < bestD) {
        bestD = d;
        best = add;
      }
    }
    if (best && bestD <= Math.max(a.h * 2.2, a.w * 0.9)) {
      usedAdded.add(best.id);
      best.group = rem.group;
    }
  }
  return changes;
}

/** Same "does this page differ?" test, but from a rolled-up PageSummary row. */
export function summaryPageDiffers(p: PageSummary): boolean {
  return (
    p.missing ||
    p.contentMatch < 0.9999 ||
    p.pixelRatio > 0.002 ||
    p.maxOffset > 2
  );
}

/** A hoverable diff region: a removed/added run paired with its in-place replacement. */
export interface DiffHotspot {
  box: TextItem;         // the region to hover
  before: string | null; // text in A (removed / replaced-from)
  after: string | null;  // text in B (added / replaced-to)
}

/**
 * Pair removed and added runs into before/after hotspots, matching the interactive
 * pixel-diff tooltip: a removed run is paired with its nearest added counterpart when
 * they sit at roughly the same spot (an in-place text replacement).
 */
export function diffHotspots(onlyA: TextItem[], onlyB: TextItem[]): DiffHotspot[] {
  const usedB = new Set<number>();
  const spots: DiffHotspot[] = [];
  for (const a of onlyA) {
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < onlyB.length; i++) {
      if (usedB.has(i)) continue;
      const b = onlyB[i];
      const d = Math.hypot(b.x + b.w / 2 - (a.x + a.w / 2), b.y + b.h / 2 - (a.y + a.h / 2));
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestD <= Math.max(a.h * 2.2, a.w * 0.9)) {
      usedB.add(bestIdx);
      spots.push({ box: a, before: a.str, after: onlyB[bestIdx].str });
    } else {
      spots.push({ box: a, before: a.str, after: null });
    }
  }
  for (let i = 0; i < onlyB.length; i++) {
    if (!usedB.has(i)) spots.push({ box: onlyB[i], before: null, after: onlyB[i].str });
  }
  return spots;
}

/** Which of the two heatmap buckets a change belongs to. */
export type HeatBucket = 'layout' | 'text';

export const HEAT_COLOR: Record<HeatBucket, string> = {
  layout: '#7c3aed', // violet — matches the 'moved' color used in the Content tab
  text: '#d97706',   // amber — content added/removed, distinct from the base pixelmatch red
};

export const HEAT_LABEL: Record<HeatBucket, string> = {
  layout: 'Layout shift',
  text: 'Text change',
};

/** A heatmap region: one per change group, bucketed and boxed as a single union rect. */
export interface HeatBox {
  id: number;
  type: HeatBucket;
  box: TextItem; // union of every box in the group, in target-box pixel space
}

function unionBox(items: TextItem[]): TextItem {
  const x = Math.min(...items.map((i) => i.x));
  const y = Math.min(...items.map((i) => i.y));
  const right = Math.max(...items.map((i) => i.x + i.w));
  const bottom = Math.max(...items.map((i) => i.y + i.h));
  return { str: '', x, y, w: right - x, h: bottom - y };
}

/**
 * Collapse the 3 content-tab change types into 2 heatmap buckets — 'moved' becomes
 * a 'layout' region, 'removed'/'added' (including paired in-place replacements,
 * already grouped by buildChanges) become one 'text' region — so the pixel-diff
 * heatmap can be tinted by cause rather than one flat color.
 */
export function heatmapBoxes(changes: Change[]): HeatBox[] {
  const groups = new Map<number, { type: HeatBucket; items: TextItem[] }>();
  for (const c of changes) {
    const bucket: HeatBucket = c.type === 'moved' ? 'layout' : 'text';
    const g = groups.get(c.group) ?? { type: bucket, items: [] };
    if (c.a) g.items.push(c.a);
    if (c.b) g.items.push(c.b);
    groups.set(c.group, g);
  }
  return [...groups.entries()].map(([id, g]) => ({ id, type: g.type, box: unionBox(g.items) }));
}

/** True when a page has any notable content/layout/visual change (used by jump-to-change). */
export function pageHasChange(pc: PageComparison, movedThresholdIn: number): boolean {
  if (!pc.imageA || !pc.imageB) return true; // page exists on only one side
  if (pc.match.onlyA.length > 0 || pc.match.onlyB.length > 0) return true;
  if (pc.match.matched.some((m) => m.offset > movedThresholdIn * pc.pxPerInch)) return true;
  if (pc.contentMatch < 0.9999) return true;
  // Pixel-only changes (e.g. recoloured header, moved rule, chart graphics) have no
  // text delta — catch them via the pixel diff so purely-visual pages aren't skipped.
  if (pc.pixel && pc.pixel.ratio > 0.002) return true;
  return false;
}
