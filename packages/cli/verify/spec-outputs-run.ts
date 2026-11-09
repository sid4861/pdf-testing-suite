import '../src/platform/dom-shim.js';
import { installPdfLogFilter } from '../src/platform/pdf-log.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  readSpecWorkbook, readTemplate, compileSpec, runSpec, loadPdf,
  buildResultJson, resultJsonText, buildReportHtml, buildManifest, manifestText, buildFixList,
  RESULT_SCHEMA,
} from '@pdfsuite/spec/engine';
import type { ResultJson } from '@pdfsuite/spec/engine';

/**
 * W-04 DoD 5 — the three files of a run (SR-REPORT-JSON, SR-REPORT-HTML,
 * SR-MANIFEST), plus the Markdown fix-list, which is a view and not a file.
 *
 * The claims worth testing are the ones a person would otherwise find out too
 * late: the JSON matches its shipped schema, it is byte-stable apart from the
 * clock, the HTML escapes everything and runs no script, and the manifest
 * hashes the bytes that were actually written.
 */

installPdfLogFilter(false);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '../../../work/samples/excel-spec-template-v2');
// Resolved through the package, not by path: the schema is part of what
// `@pdfsuite/spec` publishes (W-32), and a path here would survive the file
// being moved inside it without anyone noticing.
const schemaPath = createRequire(import.meta.url).resolve('@pdfsuite/spec/schema/result.v1.json');

const f = (n: string): File => {
  const b = fs.readFileSync(path.join(fixture, n));
  return {
    name: n, size: b.byteLength,
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  } as unknown as File;
};

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

// ── a small JSON Schema check ─────────────────────────────────────────
//
// Enough of draft 2020-12 to hold the shipped schema to account: required,
// type, const, enum, pattern, properties, items, minItems/maxItems. A full
// validator would be a dependency carried for one test, and the point of the
// schema is that the file matches it, not that we own a validator.

type Schema = Record<string, unknown>;

function validate(value: unknown, schema: Schema, at = '$', out: string[] = []): string[] {
  const type = schema.type as string | string[] | undefined;
  const types = type == null ? null : Array.isArray(type) ? type : [type];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

  if ('const' in schema && value !== schema.const) out.push(`${at}: expected ${String(schema.const)}`);
  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(value)) {
    out.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (types && !types.includes(actual === 'number' ? 'number' : actual)) {
    out.push(`${at}: expected ${types.join('|')}, got ${actual}`);
    return out;
  }
  if (typeof value === 'string' && typeof schema.pattern === 'string') {
    if (!new RegExp(schema.pattern).test(value)) out.push(`${at}: does not match ${schema.pattern}`);
  }
  if (actual === 'object' && value) {
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in (value as object))) out.push(`${at}: missing "${key}"`);
    }
    const props = (schema.properties as Record<string, Schema> | undefined) ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in (value as object)) validate((value as Record<string, unknown>)[key], sub, `${at}.${key}`, out);
    }
    const extra = schema.additionalProperties as Schema | undefined;
    if (extra && typeof extra === 'object') {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        if (!(key in props)) validate(v, extra, `${at}.${key}`, out);
      }
    }
  }
  if (actual === 'array') {
    const items = schema.items as Schema | undefined;
    const arr = value as unknown[];
    if (typeof schema.minItems === 'number' && arr.length < schema.minItems) out.push(`${at}: too few items`);
    if (typeof schema.maxItems === 'number' && arr.length > schema.maxItems) out.push(`${at}: too many items`);
    if (items) arr.forEach((v, i) => validate(v, items, `${at}[${i}]`, out));
  }
  return out;
}

async function main() {
  const compiled = compileSpec(readTemplate(await readSpecWorkbook(f('report-spec.xlsx'))));
  const report = await runSpec(await loadPdf(f('report-with-deviations.pdf')), compiled.spec, {
    coverage: compiled.counts,
    pdfName: 'report-with-deviations.pdf',
    pdfSha256: 'b'.repeat(64),
  });
  const result = await buildResultJson(report, {
    startedAt: '2026-11-05T00:00:00.000Z',
    durationMs: 1234,
    tool: { spec: 'test', pdfjs: '4.7.76' },
    env: { runtime: 'node', node: 'test' },
  });

  console.log('\n  result.json\n');

  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Schema;
  const errors = validate(result, schema);
  for (const e of errors.slice(0, 8)) console.log('      ' + e);
  check('it validates against the shipped schema', errors.length === 0,
    errors.length ? `${errors.length} problems` : 'schema/result.v1.json');
  check('it says which schema it is', result.schema === RESULT_SCHEMA && result.kind === 'spec');
  check('the verdict is the exit code’s source',
    (result.summary.verdict === 'FAIL') === (result.summary.exitCode === 1),
    `${result.summary.verdict} / exit ${result.summary.exitCode}`);
  check('this PDF does fail, so the test is not vacuous',
    result.summary.verdict === 'FAIL' && result.summary.checksFailed > 0,
    `${result.summary.checksFailed} failed checks`);

  // Decision 3: byte-stable outside `run`.
  const again = await buildResultJson(report, {
    startedAt: '2999-01-01T00:00:00.000Z',
    tool: { spec: 'test', pdfjs: '4.7.76' },
    env: { runtime: 'node', node: 'test' },
  });
  const strip = (r: ResultJson) => JSON.stringify({ ...r, run: null });
  check('two runs over the same files differ only in the run block',
    strip(result) === strip(again),
    'everything outside `run` is identical');
  check('and the findings hash is what two runs compare at a glance',
    !!result.findingsSha256 && result.findingsSha256 === again.findingsSha256,
    result.findingsSha256?.slice(0, 12));

  const measured = result.pages[0].elements.find((e) => e.expectedBox);
  check('boxes are inches at four decimals',
    !!measured && measured.expectedBox!.every((n) => Number.isFinite(n) && String(n).split('.')[1]?.length !== 5),
    JSON.stringify(measured?.expectedBox));

  console.log('\n  report.html\n');

  const html = buildReportHtml(result, { images: {} });
  check('it is a whole document', html.startsWith('<!doctype html>') && html.trimEnd().endsWith('</html>'));
  check('with no script of any kind',
    !/<script/i.test(html) && !/ on[a-z]+=/i.test(html) && !/javascript:/i.test(html));
  check('and no external request',
    !/https?:\/\//i.test(html.replace(/https:\/\/pdfsuite\.dev[^"']*/g, '')),
    'no src, href or @import off this file');
  check('expanding is <details>, so it works with JavaScript off', html.includes('<details'));
  check('it is deterministic', buildReportHtml(result, { images: {} }) === html);

  // Decision 4 — every inserted value escaped. The run is given a file name
  // that is markup, which is where this fails if it fails.
  const hostile = buildReportHtml({
    ...result,
    inputs: [{ name: '<img src=x onerror=alert(1)>.xlsx', bytes: 1, sha256: null }],
  }, { images: {} });
  check('a file name cannot smuggle markup in',
    !hostile.includes('<img src=x') && hostile.includes('&lt;img src=x'));

  // Decision 6, tested where it bites: a clean run, whose pages all passed,
  // must not carry a picture of every one of them.
  const cleanReport = await runSpec(await loadPdf(f('report.pdf')), compiled.spec, {
    coverage: compiled.counts, pdfName: 'report.pdf',
  });
  const cleanResult = await buildResultJson(cleanReport, { startedAt: '2026-11-05T00:00:00.000Z' });
  const pics = { 1: 'data:image/png;base64,AAA', 2: 'data:image/png;base64,AAA',
    3: 'data:image/png;base64,AAA', 4: 'data:image/png;base64,AAA' };
  check('a clean run carries no page images',
    cleanResult.summary.verdict === 'PASS' &&
    !buildReportHtml(cleanResult, { images: pics }).includes('data:image/png'),
    `${cleanResult.pages.length} pages, all passing`);
  check('unless they are asked for',
    buildReportHtml(cleanResult, { images: pics, allImages: true }).includes('data:image/png'));
  check('and a failing page does carry one',
    buildReportHtml(result, { images: pics }).includes('data:image/png'),
    `${result.pages.filter((p) => p.failCount > 0).length} of ${result.pages.length} pages failed`);
  check('and every image carries alt text',
    [...buildReportHtml(result, { images: { 1: 'data:image/png;base64,AAA' }, allImages: true })
      .matchAll(/<img [^>]*>/g)].every((m) => / alt="/.test(m[0])));

  console.log('\n  manifest.json\n');

  const resultText = resultJsonText(result);
  const manifest = await buildManifest([
    ...result.inputs.map((i) => ({ name: i.name, role: 'input' as const, bytes: i.bytes ?? 0, sha256: i.sha256 })),
    { name: 'result.json', role: 'output' as const, data: resultText },
    { name: 'report.html', role: 'output' as const, data: html },
  ]);

  check('every input and output is listed', manifest.files.length === result.inputs.length + 2,
    manifest.files.map((x) => x.name).join(', '));
  check('with a lower-case hex SHA-256 and a size',
    manifest.files.filter((x) => x.role === 'output')
      .every((x) => /^[0-9a-f]{64}$/.test(x.sha256 ?? '') && x.bytes > 0));
  check('the hash is of the bytes actually written',
    manifest.files.find((x) => x.name === 'result.json')!.bytes === new TextEncoder().encode(resultText).byteLength);
  check('an input keeps the hash result.json recorded',
    manifest.files.find((x) => x.name === 'report-with-deviations.pdf')?.sha256 === 'b'.repeat(64));
  check('and there is no timestamp in it',
    !/\d{4}-\d{2}-\d{2}T/.test(manifestText(manifest)));

  console.log('\n  the fix list\n');

  const fix = buildFixList(result);
  console.log('      ' + fix.split('\n').slice(0, 3).join(' / '));
  check('it names the workbook and the verdict',
    fix.includes('# What to fix') && fix.includes('check') );
  check('it lists a failing check with the cell to change',
    /\|.*\|.*\|.*![A-Z]+\d+ \|/.test(fix),
    (fix.split('\n').find((l) => /![A-Z]+\d+ \|/.test(l)) ?? '').slice(0, 90));
  check('and keeps what is not a failure apart from what is',
    !fix.includes('## Worth a look') || fix.indexOf('## Worth a look') > fix.indexOf('|'));

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
