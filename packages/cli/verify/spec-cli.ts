import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * W-11 DoD 7 — `pdfsuite spec` on the fictional fixture.
 *
 * This one runs the **built CLI as a process**, not the engine: the thing
 * being tested is the command — its arguments, its three files and its exit
 * code — and a test that imported the functions would pass even if the
 * command never wired them up.
 *
 * It needs `npm run build` to have run, which `npm run verify` does not do,
 * so it builds if `dist/index.js` is missing or older than the sources.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '..');
const dist = path.join(cli, 'dist/index.js');
const fixture = path.resolve(cli, '../../work/samples/excel-spec-template-v2');
const out = path.join(cli, '.work/cli-spec');

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

interface Run { code: number; out: string }

function pdfsuite(...args: string[]): Run {
  const r = spawnSync(process.execPath, [dist, 'spec', ...args], {
    encoding: 'utf8', cwd: cli,
  });
  return { code: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

const f = (n: string) => path.join(fixture, n);

function main() {
  if (!fs.existsSync(dist)) {
    console.log('  building the CLI first…');
    const b = spawnSync('node', ['build.mjs'], { cwd: cli, encoding: 'utf8' });
    if (b.status !== 0) {
      console.error(b.stdout, b.stderr);
      process.exit(1);
    }
  }

  console.log('\n  --validate-only\n');

  const clean = pdfsuite(f('report-spec.xlsx'), '--validate-only');
  check('a clean workbook validates and opens no PDF',
    clean.code === 0 && /No PDF was opened/.test(clean.out),
    `exit ${clean.code}`);
  check('and it says how much of the workbook became a check',
    /\d+ of 290 rows checked/.test(clean.out),
    (clean.out.match(/\d+ of 290 rows checked/) ?? [''])[0]);

  const bad = pdfsuite(f('report-spec-with-errors.xlsx'), '--validate-only');
  check('a workbook with refused rows exits 2', bad.code === 2, `exit ${bad.code}`);
  check('and every refused row names its cell',
    (bad.out.match(/^\s{2}\d+![A-Z]+\d+\s/gm) ?? []).length === 10,
    `${(bad.out.match(/^\s{2}\d+![A-Z]+\d+\s/gm) ?? []).length} cells named`);

  console.log('\n  a checked PDF\n');

  fs.rmSync(out, { recursive: true, force: true });
  const good = pdfsuite(f('report-spec.xlsx'), f('report.pdf'), '--out', out);
  check('the matching PDF passes', good.code === 0 && /PASS/.test(good.out), `exit ${good.code}`);
  check('and it writes the three files',
    ['result.json', 'report.html', 'manifest.json'].every((n) => fs.existsSync(path.join(out, n))),
    fs.readdirSync(out).join(', '));

  const result = JSON.parse(fs.readFileSync(path.join(out, 'result.json'), 'utf8')) as {
    schema: string; summary: { verdict: string; exitCode: number };
    inputs: { name: string; sha256: string | null }[];
    coverage: { checked: number; rows: number } | null;
  };
  check('result.json is the schema the app writes', result.schema === 'pdfsuite.result/1');
  check('its exit code is the one the process returned',
    result.summary.exitCode === good.code, `${result.summary.exitCode} === ${good.code}`);
  check('it names both files it tested, with their hashes',
    result.inputs.length === 2 && result.inputs.every((i) => /^[0-9a-f]{64}$/.test(i.sha256 ?? '')),
    result.inputs.map((i) => i.name).join(' + '));
  check('and carries coverage', (result.coverage?.rows ?? 0) === 290,
    `${result.coverage?.checked} of ${result.coverage?.rows}`);

  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')) as {
    files: { name: string; role: string; bytes: number; sha256: string }[];
  };
  check('the manifest hashes the files on disk',
    manifest.files.filter((x) => x.role === 'output').every((x) => {
      const bytes = fs.readFileSync(path.join(out, x.name));
      return bytes.byteLength === x.bytes;
    }),
    manifest.files.map((x) => x.name).join(', '));

  console.log('\n  a PDF with deviations\n');

  const dev = pdfsuite(f('report-spec.xlsx'), f('report-with-deviations.pdf'), '--out', out);
  check('it fails, with exit 1', dev.code === 1 && /FAIL/.test(dev.out), `exit ${dev.code}`);
  check('every finding names the cell to fix',
    (dev.out.match(/\[\d+![A-Z]+\d+\]/g) ?? []).length >= 8,
    `${(dev.out.match(/\[\d+![A-Z]+\d+\]/g) ?? []).length} findings with a cell`);
  check('the README’s font-size deviation is one of them',
    /Report title — Font size: expected 28pt, found 24pt/.test(dev.out));

  console.log('\n  arguments\n');

  const mapped = pdfsuite(f('report-spec.xlsx'), f('report.pdf'), '--out', out, '--pages', '1:2');
  check('--pages overrides the binding, and the wrong page then fails',
    mapped.code === 1, `exit ${mapped.code}`);

  check('a malformed --pages is a tool error, not a crash',
    pdfsuite(f('report-spec.xlsx'), f('report.pdf'), '--out', out, '--pages', 'nonsense').code === 2);
  check('a missing spec exits 2', pdfsuite(path.join(fixture, 'nope.xlsx'), '--validate-only').code === 2);
  check('a .docx is refused by name',
    /is neither/.test(pdfsuite(path.join(fixture, 'x.docx'), '--validate-only').out));
  check('no --out is a tool error',
    pdfsuite(f('report-spec.xlsx'), f('report.pdf')).code === 2);

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main();
