// Shared change-derivation logic used by both the Side by side view and the HTML export,
// so the on-screen highlights and the exported report stay in sync.

import type { PageComparison, StyleDiff, TextItem } from '@pdfsuite/core';

// Three kinds of difference, deliberately kept apart:
//
//   removed / added  the words themselves changed   -> CONTENT
//   styled           same words, different type     -> STYLE
//   moved            same words, same type, shifted -> LAYOUT
//
// PRECEDENCE, when one run qualifies for more than one:
//
//   content > style > layout
//
// Rationale: the higher category explains the lower one. Editing a word changes
// its width, which shifts everything after it; restyling a word does the same.
// Reporting the consequence instead of the cause sends a reader to the wrong
// place, and reporting both double-counts one change. So a run whose text
// changed is CONTENT even if it also moved and was also restyled.
//
// Consequence worth understanding: a change and the elements it *pushed* are
// different elements, so a single edit legitimately yields one content change
// plus several layout changes. Likewise a line whose wording changed AND whose
// font changed yields both a content change (the edited word) and a style
// change (the untouched words around it) — again, different elements. What must
// never happen is one element appearing in two categories.
//
// Granularity is WORD level, not line level: only the words that actually
// differ are reported, and a line carrying two separate edits produces two
// findings rather than one merged span. Lines are split at column gaps first,
// so a table row's cells stay independent.
//
// These rules are pinned by cli/verify/classification.ts — 24 purpose-built PDF
// pairs covering each category alone, every pairwise combination, cascades,
// duplicate text, and capitalisation. Run `npm run verify` in cli/ after
// touching this file.
export type ChangeType = 'removed' | 'added' | 'moved' | 'styled';

export interface Change {
  id: number;         // unique per change; the React key and the pairing handle
  group: number;      // paired removed+added (an in-place replacement) share a group
  /**
   * The number shown to the reader. Both halves of a paired replacement carry
   * the same one, so the old value and the new value are marked "2" and "2" on
   * their respective pages rather than "2" and "3".
   */
  label: number;
  /**
   * A signature for the difference this change belongs to, derived from what
   * changed rather than from its position in the list.
   *
   * `id`, `group` and `label` are all indices assigned per run, so they cannot
   * carry a decision across a recompute. This can: both halves of a pair share
   * it, and it survives re-running the comparison, which is what lets a
   * reviewer mark a difference as expected and have it stay marked.
   */
  key: string;
  type: ChangeType;
  text: string;
  a: TextItem | null; // box on side A
  b: TextItem | null; // box on side B
  offset?: number;    // for 'moved'
  style?: StyleDiff;  // for 'styled'
}

export const TYPE_LABEL: Record<ChangeType, string> = {
  removed: 'Removed',
  added: 'Added',
  moved: 'Moved',
  styled: 'Restyled',
};

export const CHANGE_COLOR: Record<ChangeType, string> = {
  removed: '#dc2626', // red
  added: '#059669',   // emerald
  moved: '#7c3aed',   // violet — kept well clear of red so the two never blur together
  styled: '#0891b2',  // cyan — reads as neither "gone" nor "new", which is the point
};

/** Convert a target-box pixel distance to inches. */
export const pxToInch = (px: number, pxPerInch: number) => px / pxPerInch;
/** Format a target-box pixel distance as inches, e.g. `0.26″`. */
export const fmtInch = (px: number, pxPerInch: number) => `${(px / pxPerInch).toFixed(2)}″`;

/** Which side(s) a change is drawn on. */
export function isOnSide(c: Change, side: 'A' | 'B'): boolean {
  const bothSides = c.type === 'moved' || c.type === 'styled';
  return side === 'A'
    ? !!c.a && (c.type === 'removed' || bothSides)
    : !!c.b && (c.type === 'added' || bothSides);
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
  const raw: Omit<Change, 'id' | 'group' | 'label' | 'key'>[] = [];
  for (const it of pc.match.onlyA) raw.push({ type: 'removed', text: it.str, a: it, b: null });
  for (const it of pc.match.onlyB) raw.push({ type: 'added', text: it.str, a: null, b: it });
  // Same words, different type, recovered from differing run segmentation.
  for (const r of pc.match.restyled) {
    raw.push({ type: 'styled', text: r.text, a: r.a, b: r.b, offset: 0, style: r.styleDiff });
  }
  for (const p of pc.match.matched) {
    // Content outranks everything: a capitalisation edit is a text change, even
    // though the matcher paired these two runs by folding case.
    if (p.caseDiff) {
      raw.push({ type: 'removed', text: p.a.str, a: p.a, b: null });
      raw.push({ type: 'added', text: p.b.str, a: null, b: p.b });
      continue;
    }
    // Typography wins over position: a run that was restyled is reported as a
    // style change even if it also shifted, because the restyle is the cause and
    // the shift is usually its consequence.
    if (p.styleDiff) {
      raw.push({ type: 'styled', text: p.a.str, a: p.a, b: p.b, offset: p.offset, style: p.styleDiff });
    } else if (p.offset > thresholdPx) {
      raw.push({ type: 'moved', text: p.a.str, a: p.a, b: p.b, offset: p.offset });
    }
  }
  // Images travel the same path as text from here on, so a logo that moved gets
  // the same box, number and list entry a moved sentence does.
  const img = pc.match.images;
  if (img) {
    for (const it of img.onlyA) raw.push({ type: 'removed', text: 'Image', a: it, b: null });
    for (const it of img.onlyB) raw.push({ type: 'added', text: 'Image', a: null, b: it });
    for (const p of img.matched) {
      if (p.offset > thresholdPx) {
        raw.push({ type: 'moved', text: 'Image', a: p.a, b: p.b, offset: p.offset });
      }
    }
  }

  raw.sort((r1, r2) => {
    const b1 = (r1.a ?? r1.b)!;
    const b2 = (r2.a ?? r2.b)!;
    return b1.y - b2.y || b1.x - b2.x;
  });
  const changes: Change[] = raw.map((r, i) => ({ ...r, id: i + 1, group: i + 1, label: i + 1, key: '' }));

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

  // Number the groups, not the individual changes. `changes` is already in
  // reading order, so the first half of a replacement claims the number and its
  // partner inherits it.
  const labelOfGroup = new Map<number, number>();
  for (const c of changes) {
    let n = labelOfGroup.get(c.group);
    if (n == null) {
      n = labelOfGroup.size + 1;
      labelOfGroup.set(c.group, n);
    }
    c.label = n;
  }

  // Signature per group: what changed, plus a coarse vertical band to separate
  // two identical edits on the same page. Rounded so a sub-pixel difference in
  // rendering does not invalidate a reviewer's decision.
  const membersOf = new Map<number, Change[]>();
  for (const c of changes) {
    const list = membersOf.get(c.group) ?? [];
    list.push(c);
    membersOf.set(c.group, list);
  }
  for (const members of membersOf.values()) {
    const sig = members
      .map((m) => `${m.type}:${m.text.replace(/\s+/g, ' ').trim().toLowerCase()}`)
      .sort()
      .join('|');
    const box = (members[0].a ?? members[0].b)!;
    const key = `${sig}@${Math.round(box.y / 8)}`;
    for (const m of members) m.key = key;
  }

  return changes;
}

/** How an ignored difference is addressed: stable across recomputes. */
export function changeRef(page: number, key: string): string {
  return `${page}::${key}`;
}

/** A one-line description of a difference, for the ignore list and the report. */
export function changeSummary(members: Change[]): string {
  const part = (c: Change) => `${TYPE_LABEL[c.type]} "${c.text}"`;
  const removed = members.find((m) => m.type === 'removed');
  const added = members.find((m) => m.type === 'added');
  if (removed && added) return `${part(removed)} → ${part(added)}`;
  return members.map(part).join(' · ');
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

/** Which heatmap bucket a change belongs to. */
export type HeatBucket = 'layout' | 'text' | 'style';

export const HEAT_COLOR: Record<HeatBucket, string> = {
  layout: '#7c3aed', // violet — matches the 'moved' color used in Side by side
  text: '#d97706',   // amber — content added/removed, distinct from the base pixelmatch red
  style: '#0891b2',  // cyan — same words, different type
};

export const HEAT_LABEL: Record<HeatBucket, string> = {
  layout: 'Layout shift',
  text: 'Text change',
  style: 'Font / style change',
};

export const HEAT_HINT: Record<HeatBucket, string> = {
  layout: 'same words and type, moved',
  text: 'the words themselves changed',
  style: 'same words, different font, size, weight or slant',
};

const BUCKET_OF: Record<ChangeType, HeatBucket> = {
  removed: 'text',
  added: 'text',
  styled: 'style',
  moved: 'layout',
};

// When one region carries more than one kind of change, report the most
// meaningful cause: an edit explains a shift, a restyle explains a shift, but
// never the other way round.
const BUCKET_PRIORITY: Record<HeatBucket, number> = { text: 3, style: 2, layout: 1 };

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
 * Collapse change types into heatmap buckets so the pixel-diff heatmap is tinted
 * by cause rather than one flat colour:
 *
 *   removed / added -> text    the words changed
 *   styled          -> style   same words, different type
 *   moved           -> layout  same words and type, just moved
 *
 * Paired in-place replacements are already one group, so an edit renders as a
 * single region rather than a red box next to a green one.
 */
export function heatmapBoxes(changes: Change[]): HeatBox[] {
  const groups = new Map<number, { type: HeatBucket; items: TextItem[] }>();

  for (const c of changes) {
    const bucket = BUCKET_OF[c.type];
    const existing = groups.get(c.group);
    const g = existing ?? { type: bucket, items: [] };
    // Highest-priority cause wins for the group as a whole.
    if (existing && BUCKET_PRIORITY[bucket] > BUCKET_PRIORITY[existing.type]) {
      g.type = bucket;
    }
    if (c.a) g.items.push(c.a);
    if (c.b) g.items.push(c.b);
    groups.set(c.group, g);
  }

  return [...groups.entries()].map(([id, g]) => ({ id, type: g.type, box: unionBox(g.items) }));
}

