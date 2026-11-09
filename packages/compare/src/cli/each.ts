// `pdfsuite compare --each <golden-dir> <candidate-dir> --out <dir>` — W-09 DoD 5.
//
// The one loop anybody should need, in the tool rather than in everyone's
// shell script. Arpit ruled bulk into the package for a reason worth keeping
// in view: a hand-written loop pairs files by whatever `ls` returned and has
// no idea what to do about a file that exists on one side only — so it
// silently compares what it can and reports success.
//
// This pairs by relative path, writes one folder of three files per pair,
// and **fails on an orphan**: a golden with no candidate means something
// stopped being produced, which is the regression most worth catching.

import fs from 'node:fs';
import path from 'node:path';

import { EXIT, ToolError } from '@pdfsuite/core/node';

import { compareOnePair, type ComparePairOptions } from './pair';

export interface CompareEachOptions {
  goldenDir: string;
  candidateDir: string;
  out?: string;
  pixelThreshold: number;
  includeAA: boolean;
}

/** Every `.pdf` under a folder, by its path relative to that folder. */
function pdfsUnder(dir: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (at: string) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.pdf$/i.test(entry.name)) {
        // Relative, with forward slashes, so a pairing means the same thing
        // on Windows and in CI.
        found.set(path.relative(dir, full).split(path.sep).join('/'), full);
      }
    }
  };
  walk(dir);
  return found;
}

/** A folder name safe to put a pair's three files in. */
const folderFor = (rel: string) => rel.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-');

export async function runCompareEach(opts: CompareEachOptions): Promise<number> {
  for (const [dir, which] of [[opts.goldenDir, 'golden'], [opts.candidateDir, 'candidate']] as const) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new ToolError(`--each needs two folders; ${which} is ${dir}.`);
    }
  }
  if (!opts.out) throw new ToolError('No --out directory.', 'One sub-folder per pair is written there.');

  const golden = pdfsUnder(opts.goldenDir);
  const candidate = pdfsUnder(opts.candidateDir);

  const paired = [...golden.keys()].filter((rel) => candidate.has(rel)).sort();
  const missing = [...golden.keys()].filter((rel) => !candidate.has(rel)).sort();
  const added = [...candidate.keys()].filter((rel) => !golden.has(rel)).sort();

  if (paired.length === 0 && missing.length === 0 && added.length === 0) {
    throw new ToolError('No PDFs in either folder.');
  }

  console.log(`${paired.length} pair${paired.length === 1 ? '' : 's'}`
    + (missing.length ? ` · ${missing.length} missing` : '')
    + (added.length ? ` · ${added.length} new` : ''));
  console.log('');

  const started = new Date();
  let failed = 0;

  for (let i = 0; i < paired.length; i++) {
    const rel = paired[i];
    const pair: ComparePairOptions = {
      golden: golden.get(rel)!,
      candidate: candidate.get(rel)!,
      pixelThreshold: opts.pixelThreshold,
      includeAA: opts.includeAA,
    };
    const dir = path.join(opts.out, folderFor(rel));
    const outcome = await compareOnePair(pair, dir, new Date());
    if (outcome.verdict === 'FAIL') failed++;
    console.log(`  [${i + 1}/${paired.length}] ${outcome.verdict.padEnd(4)} ${rel}`
      + ` — ${outcome.pagesChanged} of ${outcome.pages} page${outcome.pages === 1 ? '' : 's'} changed`);
  }

  // An orphan is a failure, and it is named: "the run passed except for the
  // document that stopped being generated" is not a pass.
  for (const rel of missing) console.log(`  MISSING   ${rel} — in golden, not in candidate`);
  for (const rel of added) console.log(`  NEW       ${rel} — in candidate, not in golden`);

  // The summary across every pair: `kind: compare-many` (SR-REPORT-JSON).
  const summary = {
    schema: 'pdfsuite.result/1',
    kind: 'compare-many' as const,
    run: {
      started: started.toISOString(),
      durationMs: Date.now() - started.getTime(),
      arguments: process.argv.slice(2),
    },
    summary: {
      verdict: failed === 0 && missing.length === 0 && added.length === 0 ? 'PASS' : 'FAIL',
      exitCode: failed === 0 && missing.length === 0 && added.length === 0 ? 0 : 1,
      pairs: paired.length,
      pairsChanged: failed,
      missing: missing.length,
      new: added.length,
    },
    pairs: paired.map((rel) => ({ id: folderFor(rel), path: rel, folder: folderFor(rel) })),
    orphans: [
      ...missing.map((rel) => ({ path: rel, side: 'golden' as const })),
      ...added.map((rel) => ({ path: rel, side: 'candidate' as const })),
    ],
  };

  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'result.json'), JSON.stringify(summary, null, 2) + '\n');

  console.log('');
  console.log(`  ${summary.summary.verdict}  ${paired.length - failed}/${paired.length} pairs unchanged`
    + (missing.length || added.length ? ` · ${missing.length} missing · ${added.length} new` : ''));
  console.log(`  Written to ${opts.out}: one folder per pair, and result.json across them`);

  return summary.summary.exitCode === 0 ? EXIT.OK : EXIT.COMPARISON_FAILED;
}
