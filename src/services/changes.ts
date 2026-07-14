// Shared change-derivation logic used by both the Content view and the HTML export,
// so the on-screen highlights and the exported report stay in sync.

import type { PageComparison, PageSummary, TextItem } from '../types/compare';

export type ChangeType = 'removed' | 'added' | 'moved';

export interface Change {
  id: number;
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

export function buildChanges(pc: PageComparison, movedThreshold: number): Change[] {
  const raw: Omit<Change, 'id'>[] = [];
  for (const it of pc.match.onlyA) raw.push({ type: 'removed', text: it.str, a: it, b: null });
  for (const it of pc.match.onlyB) raw.push({ type: 'added', text: it.str, a: null, b: it });
  for (const p of pc.match.matched) {
    if (p.offset > movedThreshold) {
      raw.push({ type: 'moved', text: p.a.str, a: p.a, b: p.b, offset: p.offset });
    }
  }
  raw.sort((r1, r2) => {
    const b1 = (r1.a ?? r1.b)!;
    const b2 = (r2.a ?? r2.b)!;
    return b1.y - b2.y || b1.x - b2.x;
  });
  return raw.map((r, i) => ({ ...r, id: i + 1 }));
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

/** True when a page has any notable content/layout/visual change (used by jump-to-change). */
export function pageHasChange(pc: PageComparison, movedThreshold: number): boolean {
  if (!pc.imageA || !pc.imageB) return true; // page exists on only one side
  if (pc.match.onlyA.length > 0 || pc.match.onlyB.length > 0) return true;
  if (pc.match.matched.some((m) => m.offset > movedThreshold)) return true;
  if (pc.contentMatch < 0.9999) return true;
  // Pixel-only changes (e.g. recoloured header, moved rule, chart graphics) have no
  // text delta — catch them via the pixel diff so purely-visual pages aren't skipped.
  if (pc.pixel && pc.pixel.ratio > 0.002) return true;
  return false;
}
