import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * W-09 — `pdfsuite compare`, one pair per command.
 *
 * The built binary is run as a process, because what is being tested is the
 * *command*: its arguments, the three files it writes, and its exit code.
 * A test that imported the functions would pass even if the command never
 * wired them up.
 *
 * The orphan cases are the ones worth the trouble. A hand-written loop over
 * two folders compares what it can and reports success; `--each` has to fail
 * when a document stopped being produced, and say which.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '..');
const dist = path.join(cli, 'dist/index.js');
const work = path.join(cli, '.work/compare-cli');
const samples = path.resolve(cli, '../../public/samples');

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

interface Run { code: number; out: string }
const pdfsuite = (...args: string[]): Run => {
  const r = spawnSync(process.execPath, [dist, 'compare', ...args], { encoding: 'utf8', cwd: cli });
  return { code: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') };
};

const golden = path.join(samples, 'invoice-original.pdf');
const changed = path.join(samples, 'invoice-recreated.pdf');

function main() {
  if (!fs.existsSync(dist)) {
    const b = spawnSync('node', ['build.mjs'], { cwd: cli, encoding: 'utf8' });
    if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
  }
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  console.log('\n  one pair\n');

  const same = path.join(work, 'same');
  fs.mkdirSync(same, { recursive: true });
  const identical = path.join(work, 'identical.pdf');
  fs.copyFileSync(golden, identical);

  const pass = pdfsuite(golden, identical, '--out', same);
  check('a pair with no differences exits 0', pass.code === 0 && /PASS/.test(pass.out), `exit ${pass.code}`);
  check('and writes exactly the three files',
    fs.readdirSync(same).sort().join(', ') === 'manifest.json, report.html, result.json',
    fs.readdirSync(same).sort().join(', '));

  const fail = pdfsuite(golden, changed, '--out', path.join(work, 'diff'));
  check('a pair that differs exits 1', fail.code === 1 && /FAIL/.test(fail.out), `exit ${fail.code}`);

  const result = JSON.parse(fs.readFileSync(path.join(work, 'diff/result.json'), 'utf8')) as {
    kind: string; summary: { verdict: string; exitCode: number; pages: number; pagesChanged: number };
    policy: Record<string, unknown>;
    pages: { page: number; why: string[]; changes: unknown[] }[];
  };
  check('its result.json is the shared schema and kind', result.kind === 'compare');
  check('the exit code is the one in the file',
    result.summary.exitCode === fail.code, `${result.summary.exitCode} === ${fail.code}`);
  check('every knob that moves the verdict is recorded',
    result.policy.pixelThreshold === 0.1 && result.policy.includeAA === false
      && result.policy.movedThresholdIn === 0.02,
    JSON.stringify(result.policy));
  check('each changed page says why, in words',
    result.pages.filter((p) => p.why.length > 0).length === result.summary.pagesChanged,
    result.pages.find((p) => p.why.length)?.why.join(' · '));

  const html = fs.readFileSync(path.join(work, 'diff/report.html'), 'utf8');
  check('report.html is self-contained and script-free',
    !/<script/i.test(html) && !/ on[a-z]+=/i.test(html) && !/https?:\/\//i.test(html));
  check('with the changed pages imaged', /data:image/.test(html),
    `${Math.round(html.length / 1024)} KB`);

  console.log('\n  --pages\n');

  const mapped = pdfsuite(golden, identical, '--out', path.join(work, 'mapped'), '--pages', '1:2,2:1');
  check('a pairing the person wrote is used', mapped.code === 1,
    `exit ${mapped.code} — the wrong pages do not match`);
  const mappedResult = JSON.parse(fs.readFileSync(path.join(work, 'mapped/result.json'), 'utf8')) as {
    pages: { page: number; golden: number | null; candidate: number | null }[];
  };
  check('and it is recorded as given, 1-based',
    mappedResult.pages[0].golden === 1 && mappedResult.pages[0].candidate === 2,
    `golden ${mappedResult.pages[0].golden} : candidate ${mappedResult.pages[0].candidate}`);

  const orphanPage = pdfsuite(golden, identical, '--out', path.join(work, 'drop'), '--pages', '1:1,2:-');
  check('"2:-" says that golden page has no partner', orphanPage.code === 1, `exit ${orphanPage.code}`);
  check('a malformed --pages is a usage error, not a crash',
    pdfsuite(golden, identical, '--out', path.join(work, 'x'), '--pages', 'nonsense').code === 2);

  console.log('\n  --each\n');

  const g = path.join(work, 'each/g');
  const c = path.join(work, 'each/c');
  fs.mkdirSync(g, { recursive: true });
  fs.mkdirSync(c, { recursive: true });
  fs.copyFileSync(golden, path.join(g, 'both.pdf'));
  fs.copyFileSync(golden, path.join(c, 'both.pdf'));

  const clean = pdfsuite('--each', g, c, '--out', path.join(work, 'each/out1'));
  check('two matching folders pass', clean.code === 0, `exit ${clean.code}`);
  check('one folder of three files per pair',
    fs.readdirSync(path.join(work, 'each/out1/both')).sort().join(', ')
      === 'manifest.json, report.html, result.json');
  check('and a summary across them',
    fs.existsSync(path.join(work, 'each/out1/result.json')));

  // The case a hand-written loop gets wrong.
  fs.copyFileSync(golden, path.join(g, 'vanished.pdf'));
  fs.copyFileSync(golden, path.join(c, 'appeared.pdf'));
  const orphans = pdfsuite('--each', g, c, '--out', path.join(work, 'each/out2'));
  check('a file that stopped being produced fails the run',
    orphans.code === 1 && /MISSING\s+vanished\.pdf/.test(orphans.out), `exit ${orphans.code}`);
  check('and so does one that appeared from nowhere',
    /NEW\s+appeared\.pdf/.test(orphans.out));

  const summary = JSON.parse(fs.readFileSync(path.join(work, 'each/out2/result.json'), 'utf8')) as {
    kind: string; summary: { verdict: string; missing: number; new: number };
    orphans: { path: string; side: string }[];
  };
  check('the summary names both orphans and which side',
    summary.kind === 'compare-many' && summary.orphans.length === 2
      && summary.orphans.some((o) => o.side === 'golden') && summary.orphans.some((o) => o.side === 'candidate'),
    JSON.stringify(summary.orphans));

  console.log('\n  usage\n');

  check('a folder where a file belongs says to use --each',
    /--each/.test(pdfsuite(g, c, '--out', path.join(work, 'y')).out));
  check('no --out is a usage error', pdfsuite(golden, identical).code === 2);
  check('one argument is a usage error', pdfsuite(golden).code === 2);
  check('--pages with --each is refused',
    /--each runs many/.test(pdfsuite('--each', g, c, '--out', path.join(work, 'z'), '--pages', '1:1').out));

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main();
