// `pdfsuite compare <golden.pdf> <candidate.pdf> --out <dir>` — W-09.
//
// It lives in `@pdfsuite/compare` and is loaded by the host at run time
// (W-30, SR-NPM-PACKAGES decision 3), so installing compare is what makes
// `pdfsuite compare` exist — the host knows nothing about it until then.
//
// One pair per command, three files out, and the exit code is that pair's
// verdict. Arpit chose this shape over a folder-and-manifest run because a
// command that does one thing composes: a loop in a Makefile, a matrix in
// CI, a single pair re-run by hand after a fix. `--each` (DoD 5) is the one
// loop anybody should need, and it is in the tool rather than in everyone's
// shell script.
//
// Nothing here decides anything about a PDF. The pages are compared by
// `comparePair` and the files are written by the shared builders — the same
// functions the Compare tab calls (SR-LAW-3), so a report mailed from a
// laptop and one produced by CI are the same document.

import fs from 'node:fs';
import path from 'node:path';

import { EXIT, ToolError, fileFromPath } from '@pdfsuite/core/node';
import { buildManifest, loadPdf, manifestText, resultJsonText, sha256 } from '@pdfsuite/core';

import { comparePair as comparePages } from '../comparePair';
import { buildCompareResultJson } from '../result';
import { buildCompareReportHtml } from '../reportHtml';
import type { PagePair } from '../pagePairs';

export interface ComparePairOptions {
  golden: string;
  candidate: string;
  out?: string;
  /** `"1:1,2:-,3:2"` — golden page : candidate page. */
  pages?: string;
  pixelThreshold: number;
  includeAA: boolean;
}

/**
 * `"1:1,2:-,3:2"` → the pairing.
 *
 * `-` on either side means "this page has no partner", which is a thing the
 * person knows and the tool cannot guess: a page added to the candidate and
 * a page dropped from the golden look identical to a page that moved.
 * Anything not mentioned is not inferred — the list is the pairing.
 */
export function parsePagePairs(raw: string): PagePair[] {
  const pairs: PagePair[] = [];
  for (const part of raw.split(',')) {
    const bit = part.trim();
    if (!bit) continue;
    const m = bit.match(/^(\d+|-)\s*:\s*(\d+|-)$/);
    if (!m) {
      throw new ToolError(
        `--pages could not read "${bit}".`,
        'Write it as golden page : candidate page, comma separated — for example '
          + '--pages "1:1,2:-,3:2", where "-" means that page has no partner.',
      );
    }
    if (m[1] === '-' && m[2] === '-') {
      throw new ToolError(`--pages has "${bit}", which pairs nothing with nothing.`);
    }
    pairs.push({
      // The spelling is 1-based for a person; the engine counts from 0.
      a: m[1] === '-' ? null : Number(m[1]) - 1,
      b: m[2] === '-' ? null : Number(m[2]) - 1,
      // A person wrote this pairing down, so there is no guess to score.
      score: null,
    });
  }
  if (pairs.length === 0) throw new ToolError('--pages was given nothing to map.');
  return pairs;
}

/** A PDF this command will read, or a usage error that says why not. */
function readablePdf(file: string, which: string): Buffer {
  if (!fs.existsSync(file)) throw new ToolError(`No ${which} PDF at ${file}.`);
  if (fs.statSync(file).isDirectory()) {
    throw new ToolError(
      `${file} is a folder, and this command takes one pair of files.`,
      'Use --each <golden-dir> <candidate-dir> to compare every pair in two folders.',
    );
  }
  if (!/\.pdf$/i.test(file)) throw new ToolError(`${path.basename(file)} is not a .pdf.`);
  return fs.readFileSync(file);
}

/**
 * Compare one pair and write the three files.
 *
 * Returned, not written, by `--each`: the loop needs the result to total up,
 * and writing is the same either way.
 */
export async function compareOnePair(
  opts: ComparePairOptions,
  outDir: string,
  started: Date,
): Promise<{ verdict: 'PASS' | 'FAIL'; pagesChanged: number; pages: number }> {
  const goldenBytes = readablePdf(opts.golden, 'golden');
  const candidateBytes = readablePdf(opts.candidate, 'candidate');

  const [docA, docB] = await Promise.all([
    loadPdf(fileFromPath(opts.golden)),
    loadPdf(fileFromPath(opts.candidate)),
  ]);

  const run = await comparePages(docA, docB, {
    pixelThreshold: opts.pixelThreshold,
    includeAA: opts.includeAA,
    keepComparisons: true,
    ...(opts.pages ? { pages: parsePagePairs(opts.pages) } : {}),
  });

  const result = await buildCompareResultJson(run, {
    startedAt: started.toISOString(),
    durationMs: Date.now() - started.getTime(),
    arguments: process.argv.slice(2),
    tool: { cli: 'pdfsuite' },
    golden: {
      name: path.basename(opts.golden),
      bytes: goldenBytes.byteLength,
      sha256: (await sha256(goldenBytes)) ?? null,
    },
    candidate: {
      name: path.basename(opts.candidate),
      bytes: candidateBytes.byteLength,
      sha256: (await sha256(candidateBytes)) ?? null,
    },
  });

  // Images for the pages that changed, embedded (SR-REPORT-HTML decision 6).
  const images: Record<number, { golden?: string; candidate?: string; diff?: string }> = {};
  for (const page of run.pages) {
    if (!page.verdict.changed || !page.comparison) continue;
    const pc = page.comparison;
    images[page.pageIndex + 1] = {
      ...(pc.imageA?.dataUrl ? { golden: pc.imageA.dataUrl } : {}),
      ...(pc.imageB?.dataUrl ? { candidate: pc.imageB.dataUrl } : {}),
      ...(pc.pixel?.diffDataUrl ? { diff: pc.pixel.diffDataUrl } : {}),
    };
  }

  const json = resultJsonText(result);
  const html = buildCompareReportHtml(result, { images });
  // Written last, over the final bytes of the other two (SR-MANIFEST 2).
  const manifest = await buildManifest([
    ...result.inputs.map((i) => ({
      name: i.name, role: 'input' as const, bytes: i.bytes ?? 0, sha256: i.sha256,
    })),
    { name: 'result.json', role: 'output' as const, data: json },
    { name: 'report.html', role: 'output' as const, data: html },
  ]);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'result.json'), json);
  fs.writeFileSync(path.join(outDir, 'report.html'), html);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), manifestText(manifest));

  return {
    verdict: result.summary.verdict,
    pagesChanged: result.summary.pagesChanged,
    pages: result.summary.pages,
  };
}

export async function runComparePair(opts: ComparePairOptions): Promise<number> {
  if (!opts.out) {
    throw new ToolError('No --out directory.', 'The three files are written there.');
  }
  const started = new Date();
  const outcome = await compareOnePair(opts, opts.out, started);

  console.log('');
  console.log(`  ${outcome.verdict}  ${outcome.pagesChanged} of ${outcome.pages} page`
    + `${outcome.pages === 1 ? '' : 's'} changed`);
  console.log(`  Written to ${opts.out}: result.json · report.html · manifest.json`);

  // The verdict in the file is the exit code's only source (SR-REPORT-JSON 7).
  return outcome.verdict === 'PASS' ? EXIT.OK : EXIT.COMPARISON_FAILED;
}
