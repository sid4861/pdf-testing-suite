import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPdf, comparePage } from '@pdfsuite/core';
import { buildChanges, heatmapBoxes } from '@pdfsuite/compare';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../.work/cases');
const f = (p: string): File => {
  const b = fs.readFileSync(p);
  return {
    name: path.basename(p),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File;
};

type Bucket = 'text' | 'style' | 'layout';

// What each case SHOULD produce, as a set of buckets. A change belongs in
// exactly one bucket — anything else is an overlap.
const EXPECT: Record<string, Bucket[]> = {
  'identical': [],

  'text-word': ['text'],
  'text-heading': ['text'],
  'text-paragraph-line': ['text'],

  'style-bold-whole': ['style'],
  'style-italic-whole': ['style'],
  'style-family-whole': ['style'],
  'style-size-whole': ['style'],
  'style-heading': ['style'],
  'style-midword': ['style'],

  'move-down': ['layout'],
  'move-right': ['layout'],
  'move-both': ['layout'],

  // Combinations: the more meaningful cause wins, and it must NOT also appear
  // in a second bucket.
  'combo-text+move': ['text'],
  'combo-style+move': ['style'],

  // These two change a word AND restyle the whole line. Word-level diffing
  // reports both, because both are true and they concern DIFFERENT words: the
  // edited word is content, the untouched words around it are restyled. Line
  // -level granularity used to hide the restyle behind the edit.
  'combo-text+style': ['style', 'text'],
  'combo-all-three': ['style', 'text'],

  // Cascades: the edited/restyled element and the elements it pushed are
  // DIFFERENT elements, so two buckets is correct. What must never happen is one
  // element appearing in two buckets — checked separately below.
  'cascade-text': ['text', 'layout'],
  'cascade-style': ['style', 'layout'],

  'dup-one-restyled': ['style'],
  'para-middle-restyled': ['style'],
  'word-deleted-midline': ['text'],

  // A capitalisation change IS a text change a reviewer would want to see.
  'case-changed': ['text'],
  // Only one of two identical lines moved — exactly one layout change, no
  // invented content change from mispairing.
  'dup-one-moved': ['layout'],
};

installPdfLogFilter(process.argv.includes('--verbose'));

async function main() {
  const names = Object.keys(EXPECT);
  let pass = 0;
  const failures: string[] = [];
  const overlaps: string[] = [];

  console.log('case                     expected      actual                    verdict');
  console.log('-'.repeat(88));

  for (const name of names) {
    const a = await loadPdf(f(path.join(dir, name + '-a.pdf')));
    const b = await loadPdf(f(path.join(dir, name + '-b.pdf')));
    const pc = await comparePage(a, b, 0, {});
    const ch = buildChanges(pc, 0.03);
    const heat = heatmapBoxes(ch);

    const got = [...new Set(heat.map((h) => h.type))].sort() as Bucket[];
    const want = [...EXPECT[name]].sort();
    const ok = got.length === want.length && got.every((g, i) => g === want[i]);
    if (ok) pass++;
    else failures.push(name);

    // Overlap check: no single piece of text may be reported under two buckets.
    const bucketsByText = new Map<string, Set<string>>();
    for (const c of ch) {
      const key = c.text.trim();
      if (!key) continue;
      const bucket = c.type === 'moved' ? 'layout' : c.type === 'styled' ? 'style' : 'text';
      if (!bucketsByText.has(key)) bucketsByText.set(key, new Set());
      bucketsByText.get(key)!.add(bucket);
    }
    const overlapped = [...bucketsByText.entries()].filter(([, s]) => s.size > 1);
    if (overlapped.length) {
      overlaps.push(name + ': ' + overlapped.map(([t, s]) => '"' + t.slice(0, 20) + '" in ' + [...s].join('+')).join('; '));
    }

    const detail = ch.length
      ? ch.map((c) => c.type + ':"' + c.text.slice(0, 14) + '"').slice(0, 3).join(' ')
      : '(none)';
    console.log(
      name.padEnd(24) +
        (want.join(',') || '(none)').padEnd(14) +
        (got.join(',') || '(none)').padEnd(12) +
        (ok ? 'OK  ' : 'FAIL') +
        '  ' + detail.slice(0, 40),
    );
  }

  console.log('');
  console.log('  ' + pass + '/' + names.length + ' categorised correctly');
  if (failures.length) console.log('  wrong bucket: ' + failures.join(', '));
  console.log('  ' + (overlaps.length === 0
    ? 'no element appears in two buckets'
    : 'OVERLAP FOUND:'));
  for (const o of overlaps) console.log('    ' + o);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
