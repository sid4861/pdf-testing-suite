// `pdfsuite inspect <file.pdf> [--page n] --out <dir>` — W-28 DoD 3.
//
// A **built-in** command, unlike `compare` and `spec`: SR-NPM-PACKAGES
// decision 3 puts `inspect` in the host because it needs nothing but
// `@pdfsuite/core`, which the host already depends on. There is no
// `@pdfsuite/inspect` to install and nothing to discover.
//
// Nothing here measures anything. `inspectCore` does, and it is the same
// function the Inspect tab calls (L3, SR-INSPECT decision 1) — this file
// resolves a path, picks pages, and writes the three files.
//
// Arpit's reason for wanting it at all is worth keeping in view: this is the
// command an agent runs to answer *"where is X on page 3"* (W-10). That is
// why the answer is `result.json` and not a pretty table.

import fs from 'node:fs';
import path from 'node:path';

import { EXIT, ToolError } from '../core/exit.js';
import {
  buildInspectReportHtml,
  buildInspectResultJson,
  buildManifest,
  fileFromPath,
  inspectCore,
  loadPdf,
  manifestText,
  resultJsonText,
  sha256,
  type InspectReportImages,
} from '../platform/engine.js';

export interface InspectOptions {
  /** The PDF to read. */
  file: string;
  /** One page, 1-based, as a person counts them. Absent means every page. */
  page?: number;
  out?: string;
  /** Embed each page's image in the report. */
  images: boolean;
  /** True when the person actually typed an image flag. */
  imagesStated: boolean;
}

/**
 * Above this many pages the report drops its images unless asked.
 *
 * A page image is ~300 KB of base64. Twenty is a report that still opens in
 * a mail client; two hundred is a 60 MB file nobody can send, produced by
 * someone who only wanted the numbers. `--images` overrides it either way,
 * and the console says which way it went — a default that silently changes
 * the output without saying so is worse than either choice.
 */
const IMAGE_PAGE_CAP = 20;

/** A PDF this command will read, or a usage error that says why not. */
function readablePdf(file: string): Buffer {
  if (!fs.existsSync(file)) throw new ToolError(`No PDF at ${file}.`);
  if (fs.statSync(file).isDirectory()) {
    throw new ToolError(
      `${file} is a folder, and this command inspects one file.`,
      'Give the path to a .pdf.',
    );
  }
  if (!/\.pdf$/i.test(file)) throw new ToolError(`${path.basename(file)} is not a .pdf.`);
  return fs.readFileSync(file);
}

export async function runInspect(opts: InspectOptions): Promise<number> {
  if (!opts.out) {
    throw new ToolError('No --out directory.', 'The three files are written there.');
  }
  const started = new Date();
  const bytes = readablePdf(opts.file);
  const pdf = await loadPdf(fileFromPath(opts.file));

  // A page number nobody can act on is a usage error, not an empty result:
  // "page 7 of a 4-page document" is a typo, and reporting nothing found
  // would hide it.
  if (opts.page != null) {
    if (!Number.isInteger(opts.page) || opts.page < 1) {
      throw new ToolError(`--page ${opts.page} is not a page number.`, 'Pages count from 1.');
    }
    if (opts.page > pdf.numPages) {
      throw new ToolError(
        `--page ${opts.page} is past the end: the document has ${pdf.numPages} page`
          + `${pdf.numPages === 1 ? '' : 's'}.`,
      );
    }
  }

  const indices = opts.page != null
    ? [opts.page - 1]
    : Array.from({ length: pdf.numPages }, (_, i) => i);

  const withImages = opts.imagesStated
    ? opts.images
    : opts.images && indices.length <= IMAGE_PAGE_CAP;
  if (opts.images && !withImages) {
    console.log(`${indices.length} pages: the report will not embed page images.`);
    console.log(`  Pass --images to embed them anyway, or --page <n> for one page.`);
  }

  const inspected = await inspectCore(pdf, { pages: indices, withImages });

  const result = await buildInspectResultJson(inspected, {
    startedAt: started.toISOString(),
    durationMs: Date.now() - started.getTime(),
    arguments: process.argv.slice(2),
    tool: { cli: 'pdfsuite' },
    file: {
      name: path.basename(opts.file),
      bytes: bytes.byteLength,
      sha256: (await sha256(bytes)) ?? null,
    },
    ...(opts.page != null ? { pagesRequested: [opts.page] } : {}),
  });

  const images: InspectReportImages = {};
  if (withImages) {
    for (const p of inspected) {
      if (p.imageDataUrl) images[p.pageIndex + 1] = p.imageDataUrl;
    }
  }

  const json = resultJsonText(result);
  const html = buildInspectReportHtml(result, { images });
  // Written last, over the final bytes of the other two (SR-MANIFEST 2).
  const manifest = await buildManifest([
    ...result.inputs.map((i) => ({
      name: i.name, role: 'input' as const, bytes: i.bytes ?? 0, sha256: i.sha256,
    })),
    { name: 'result.json', role: 'output' as const, data: json },
    { name: 'report.html', role: 'output' as const, data: html },
  ]);

  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'result.json'), json);
  fs.writeFileSync(path.join(opts.out, 'report.html'), html);
  fs.writeFileSync(path.join(opts.out, 'manifest.json'), manifestText(manifest));

  const s = result.summary;
  console.log('');
  console.log(`  ${s.elements} element${s.elements === 1 ? '' : 's'} on `
    + `${s.pages} page${s.pages === 1 ? '' : 's'}`
    + `  (${s.textElements} text · ${s.imageElements} image${s.imageElements === 1 ? '' : 's'})`);
  if (s.pagesWithoutText.length) {
    console.log(`  No text could be read on page${s.pagesWithoutText.length === 1 ? '' : 's'} `
      + `${s.pagesWithoutText.join(', ')} — a scan, or text drawn as outlines.`);
  }
  console.log(`  Written to ${opts.out}: result.json · report.html · manifest.json`);

  // An inspect has no verdict: it either answered or could not read the file.
  return EXIT.OK;
}
