// `pdfsuite spec` — the spec-driven check on the command line (W-11).
//
// The whole command is a thin shell around the spec feature: it resolves two
// files, calls the same functions the Spec tab calls, and writes the same
// three files. Nothing here decides anything about a PDF — that is the point
// of SR-LAW-3, and the reason this file is short.
//
// It lives in `@pdfsuite/spec` and is loaded by the host at run time (W-32,
// W-30, SR-NPM-PACKAGES decision 3), so installing spec is what makes
// `pdfsuite spec` exist. It reaches the feature through the same `engine.ts`
// barrel the Spec tab's own code sits behind.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { EXIT, ToolError, fileFromPath } from '@pdfsuite/core/node';
import { buildManifest, manifestText, resultJsonText } from '@pdfsuite/core';

import {
  runSpec as runSpecCheck,
  validateSpec,
  loadPdf as loadSpecPdf,
  readSpecWorkbook,
  readTemplate,
  compileSpec,
  buildValidationReport,
  coverageLine,
  buildResultJson,
  buildReportHtml,
  looksLegacy,
  writeBlankTemplate,
  annotateWorkbook,
  toValidationResult,
  validationJsonText,
  type PdfSpec,
  type ValidationReport,
  type CompiledSpec,
} from '../engine';

export interface SpecOptions {
  /** Write a blank Template v2 workbook to this path and stop. */
  template?: string;
  /** The workbook or spec JSON. */
  spec: string;
  /** The PDF to check. Absent only with `--validate-only`. */
  pdf?: string;
  out?: string;
  /** `"2:3,4:5"` — spec page : PDF page. */
  pages?: string;
  validateOnly: boolean;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** `"2:3,4:5"` → `{ 2: 3, 4: 5 }`. */
export function parsePageMap(raw: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const part of raw.split(',')) {
    const bit = part.trim();
    if (!bit) continue;
    const m = bit.match(/^(\d+)\s*:\s*(\d+)$/);
    if (!m) {
      throw new ToolError(
        `--pages could not read "${bit}".`,
        'Write it as spec page : PDF page, comma separated — for example --pages "1:2,2:3".',
      );
    }
    out[Number(m[1])] = Number(m[2]);
  }
  if (Object.keys(out).length === 0) {
    throw new ToolError('--pages was given nothing to map.', 'For example --pages "1:2".');
  }
  return out;
}

/** What the spec file turned out to be. */
interface ResolvedSpec {
  spec: PdfSpec | null;
  compiled: CompiledSpec | null;
  validation: ValidationReport | null;
  /** `true` when nothing can be checked against a PDF. */
  blocked: boolean;
  /**
   * The workbook exactly as it was read. Kept because the annotated
   * workbook is *that file* with cells coloured, not a rebuilt one — a
   * rebuild would lose the author's formatting, their notes column and
   * their screenshots, which is most of what makes it theirs.
   */
  bytes?: Uint8Array;
}

/**
 * Read the spec, whichever kind it is, and say what is wrong with it before
 * any PDF is opened (SR-SPEC-INTAKE decision 13).
 */
async function resolveSpec(file: string): Promise<ResolvedSpec> {
  // The kind first, the disk second.
  if (!/\.(xlsx|xlsm|json)$/i.test(file)) {
    throw new ToolError(
      `A spec is .xlsx or .json; ${path.basename(file)} is neither.`,
      'Template v2 workbooks (.xlsx) and the spec JSON this tool writes are both accepted.',
    );
  }
  if (!fs.existsSync(file)) throw new ToolError(`No spec at ${file}.`);

  if (/\.(xlsx|xlsm)$/i.test(file)) {
    const book = await readSpecWorkbook(fileFromPath(file));

    if (looksLegacy(book)) {
      // Decision 8: a legacy workbook yields a draft for a person to confirm,
      // and the draft is made in the app. Nothing is checked from here.
      throw new ToolError(
        'This workbook has no Pages List, so it is the legacy layout.',
        'Open it in the Spec tab, download the draft Template v2 workbook it produces, '
          + 'confirm the highlighted cells in Excel, and pass the confirmed workbook here.',
      );
    }

    const extraction = readTemplate(book);
    const compiled = compileSpec(extraction);
    const validation = buildValidationReport(extraction, compiled);
    return {
      spec: validation.blocking ? null : compiled.spec,
      compiled,
      validation,
      blocked: validation.blocking,
      bytes: book.bytes,
    };
  }

  if (/\.json$/i.test(file)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new ToolError(
        `${path.basename(file)} is not valid JSON: ${(err as Error).message}`,
      );
    }
    try {
      return { spec: validateSpec(parsed), compiled: null, validation: null, blocked: false };
    } catch (err) {
      throw new ToolError(`${path.basename(file)} is not a spec: ${(err as Error).message}`);
    }
  }

  // Unreachable: the extension was checked on the way in.
  throw new ToolError(`${path.basename(file)} could not be read as a spec.`);
}

/** The validation report, as lines on the console. */
function printValidation(report: ValidationReport): void {
  console.log(`Spec    ${report.workbook}`);
  console.log(`        ${coverageLine(report.counts)}`
    + ` · ${report.counts.excluded} excluded`
    + ` · ${report.counts.noted} noted`
    + ` · ${report.counts.unreadable} unreadable`);

  const say = (label: string, lines: { sheet?: string; cell?: string; message: string }[]) => {
    if (lines.length === 0) return;
    console.log('');
    console.log(`${label} (${lines.length})`);
    for (const l of lines) {
      const where = l.sheet ? `${l.sheet}!${l.cell ?? ''}`.replace(/!$/, '') : 'the file';
      console.log(`  ${where.padEnd(14)} ${l.message}`);
    }
  };
  say('Refused — these rows yield no check', report.errors);
  say('Checked, with lower confidence', report.warnings);
  say('Notes', report.info);
}

export async function runSpecCommand(opts: SpecOptions): Promise<number> {
  // Starting a spec needs no spec, so this is answered before anything is read.
  if (opts.template) {
    fs.mkdirSync(path.dirname(path.resolve(opts.template)), { recursive: true });
    fs.writeFileSync(opts.template, await writeBlankTemplate());
    console.log(`Wrote a blank Template v2 workbook to ${opts.template}.`);
    console.log('Fill in the Pages List, the Settings tolerances and one sheet per page.');
    return EXIT.OK;
  }

  const resolved = await resolveSpec(opts.spec);
  if (resolved.validation) printValidation(resolved.validation);

  if (resolved.blocked) {
    console.log('');
    console.log('Nothing was checked: fix the errors above and run it again.');
    return EXIT.TOOL_ERROR;
  }

  if (opts.validateOnly) {
    const errors = resolved.validation?.errors.length ?? 0;

    // With --out, the report is a pair of files as well as a console read:
    // `validation.json` for anything that has to act on it, and the
    // workbook back with its bad cells red for the person who has to fix
    // them (W-48 DoD 5). Written even when there is nothing wrong — a CI
    // job that keeps the clean report has something to diff next time.
    if (opts.out && resolved.validation) {
      const result = toValidationResult(resolved.validation);
      fs.mkdirSync(opts.out, { recursive: true });
      fs.writeFileSync(path.join(opts.out, 'validation.json'), validationJsonText(result));

      const written = ['validation.json'];
      if (resolved.bytes) {
        const name = `${path.basename(opts.spec).replace(/\.[^.]+$/, '')}.annotated.xlsx`;
        fs.writeFileSync(
          path.join(opts.out, name),
          await annotateWorkbook(resolved.bytes, resolved.validation),
        );
        written.push(name);
      }
      console.log('');
      console.log(`  Written to ${opts.out}: ${written.join(' · ')}`);
    } else if (opts.out) {
      // A spec JSON has no workbook and no cells, so there is nothing to
      // annotate and nothing a validation report would add.
      console.log('');
      console.log('  --out writes nothing for a spec JSON: there is no workbook to annotate.');
    }

    const counts = resolved.validation;
    console.log('');
    if (counts) {
      const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`;
      console.log(`  ${n(counts.errors.length, 'error')} · ${n(counts.warnings.length, 'warning')}`
        + ` · ${n(counts.info.length, 'note')} — ${n(counts.assertions.length, 'row')} will be checked`);
    }
    if (errors > 0) {
      console.log(`${errors} row${errors === 1 ? '' : 's'} will not be checked until `
        + `${errors === 1 ? 'it is' : 'they are'} fixed. No PDF was opened (--validate-only).`);
      return EXIT.TOOL_ERROR;
    }
    console.log(resolved.validation
      ? 'The spec reads. No PDF was opened (--validate-only).'
      : 'The spec JSON is well formed. No PDF was opened (--validate-only).');
    return EXIT.OK;
  }

  if (!opts.pdf) {
    throw new ToolError(
      'No PDF to check.',
      'pdfsuite spec <spec> <file.pdf> --out <dir>, or --validate-only to check the spec alone.',
    );
  }
  if (!fs.existsSync(opts.pdf)) throw new ToolError(`No PDF at ${opts.pdf}.`);
  if (!opts.out) {
    throw new ToolError('No --out directory.', 'The three files are written there.');
  }

  const spec = resolved.spec!;
  const pdfBytes = fs.readFileSync(opts.pdf);
  const started = new Date();

  const report = await runSpecCheck(await loadSpecPdf(fileFromPath(opts.pdf)), spec, {
    ...(resolved.compiled ? { coverage: resolved.compiled.counts } : {}),
    pdfName: path.basename(opts.pdf),
    pdfSha256: sha256(pdfBytes),
    ...(opts.pages ? { pageMap: parsePageMap(opts.pages) } : {}),
    onProgress: (current, total) => {
      if (process.stdout.isTTY) process.stdout.write(`\r  checking page ${current}/${total}`);
    },
  });
  if (process.stdout.isTTY) process.stdout.write('\r'.padEnd(32) + '\r');

  // ── the three files (SR-SPEC-CHECK decision 15) ──
  const result = await buildResultJson(report, {
    startedAt: started.toISOString(),
    durationMs: Date.now() - started.getTime(),
    arguments: process.argv.slice(2),
    tool: { cli: 'pdfsuite', spec: 'in-tree' },
    bytes: { pdf: pdfBytes.byteLength, workbook: fs.statSync(opts.spec).size },
  });

  const images: Record<number, string> = {};
  for (const p of report.pages) if (p.failCount > 0 && p.dataUrl) images[p.page] = p.dataUrl;

  const resultText = resultJsonText(result);
  const html = buildReportHtml(result, { images });
  const manifest = await buildManifest([
    { name: path.basename(opts.spec), role: 'input', bytes: fs.statSync(opts.spec).size,
      sha256: result.inputs.find((i) => i.name === path.basename(opts.spec))?.sha256
        ?? sha256(fs.readFileSync(opts.spec)) },
    { name: path.basename(opts.pdf), role: 'input', bytes: pdfBytes.byteLength, sha256: sha256(pdfBytes) },
    { name: 'result.json', role: 'output', data: resultText },
    { name: 'report.html', role: 'output', data: html },
  ]);

  fs.mkdirSync(opts.out, { recursive: true });
  // The manifest is written last, over the final bytes of the other two
  // (SR-MANIFEST decision 2).
  fs.writeFileSync(path.join(opts.out, 'result.json'), resultText);
  fs.writeFileSync(path.join(opts.out, 'report.html'), html);
  fs.writeFileSync(path.join(opts.out, 'manifest.json'), manifestText(manifest));

  // ── what it found ──
  console.log('');
  for (const f of report.pageFindings) {
    console.log(`  ${f.severity.toUpperCase().padEnd(8)} ${f.message}`);
  }
  for (const page of report.pages) {
    const bad = page.elements.filter((e) => e.status === 'fail' || e.status === 'not-found');
    const head = `${page.name ? `${page.name} — ` : ''}PDF page ${page.page}`;
    console.log(`  ${head}: ${page.passCount} passed · ${page.failCount} failed`
      + (page.unverifiableCount ? ` · ${page.unverifiableCount} unverifiable` : '')
      + (page.warnCount ? ` · ${page.warnCount} warning` : ''));
    for (const el of bad) {
      for (const c of el.checks.filter((x) => !x.pass)) {
        console.log(`      ${el.label} — ${c.name}: expected ${c.expected}, found ${c.actual}`
          + (c.cell ? `  [${c.cell}]` : ''));
      }
    }
  }

  console.log('');
  const refused = resolved.validation?.errors.length ?? 0;
  if (refused > 0) {
    // Decision 13 lets the rest of the page be checked, which means a PASS
    // here can be a PASS over a spec that is missing rows. Saying so beside
    // the verdict is the difference between that and hiding it.
    console.log(`  ${refused} row${refused === 1 ? '' : 's'} of the workbook `
      + `${refused === 1 ? 'was' : 'were'} refused and never checked — see report.html.`);
  }
  console.log(`  ${result.summary.verdict}  ${report.passElements}/${report.elementCount} elements pass`
    + (report.coverage ? ` · ${coverageLine(report.coverage)}` : ''));
  console.log(`  Written to ${opts.out}: result.json · report.html · manifest.json`);

  // Decision 7 of SR-REPORT-JSON: the verdict in `summary` is the exit code's
  // only source, so the file and the pipeline can never disagree.
  return result.summary.exitCode === 0 ? EXIT.OK : EXIT.COMPARISON_FAILED;
}
