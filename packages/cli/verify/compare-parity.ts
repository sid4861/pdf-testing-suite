import '../src/platform/dom-shim.js';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Imported from the packages by name, the way the Compare tab imports them
// and the way the command module inside `@pdfsuite/compare` does — which is
// the point of this check: two surfaces calling the same functions.
import { fileFromPath, loadPdf, resultJsonText, sha256 } from '../src/platform/engine.js';
import { buildCompareResultJson, comparePair as comparePages } from '@pdfsuite/compare';

/**
 * W-27 DoD 6 — the app's `result.json` and the CLI's are the same document.
 *
 * The CLI is run as a process, and the same pair is put through the builders
 * the way the Compare tab puts it through them. The two files are then
 * compared **byte for byte** apart from three blocks, each excluded for a
 * stated reason: `run` holds the clock (SR-REPORT-JSON decision 3), and
 * `tool` and `env` are *meant* to differ between a browser and a command
 * line — that is what they are for. Everything that says what was found
 * must match exactly.
 *
 * This is the test that would have caught the thing W-27 was filed for: two
 * surfaces answering the same question with two shapes. It cannot be faked by
 * calling one builder twice — one side of the comparison comes off disk,
 * written by the command.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '..');
const dist = path.join(cli, 'dist/index.js');
const work = path.join(cli, '.work/parity');

const checks: [string, boolean][] = [];
const check = (name: string, pass: boolean, detail = '') => {
  checks.push([name, pass]);
  console.log('  ' + (pass ? 'OK  ' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};

/** Everything but the three blocks that are allowed to differ. */
const withoutRun = (json: Record<string, unknown>) =>
  JSON.stringify({ ...json, run: null, tool: null, env: null }, null, 2);

async function main() {
  console.log('\n  one pair, both ways\n');

  const golden = path.join(cli, 'fixtures/golden/invoice-original.pdf');
  const candidate = path.join(work, 'candidate.pdf');

  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  // The same bytes on both sides: this test is about the *document* the two
  // surfaces write, not about what they found.
  fs.copyFileSync(golden, candidate);

  // ── the CLI, as a process ──
  const run = spawnSync(process.execPath, [
    dist, 'compare', golden, candidate, '--out', path.join(work, 'out'),
  ], { encoding: 'utf8', cwd: cli });

  const fromCli = path.join(work, 'out/result.json');
  check('the command writes result.json', fs.existsSync(fromCli),
    `exit ${run.status}`);
  check('and manifest.json beside it', fs.existsSync(path.join(work, 'out/manifest.json')));
  check('and report.html, the third file', fs.existsSync(path.join(work, 'out/report.html')));
  if (!fs.existsSync(fromCli)) {
    console.error(run.stdout, run.stderr);
    process.exit(1);
  }

  // ── the app's path: the same builders, called the way the store calls them ──
  const docA = await loadPdf(fileFromPath(golden));
  const docB = await loadPdf(fileFromPath(candidate));
  const result = await comparePages(docA, docB, { keepComparisons: true });
  const goldenBytes = fs.readFileSync(golden);
  const candidateBytes = fs.readFileSync(candidate);
  const appSide = await buildCompareResultJson(result, {
    golden: {
      name: path.basename(golden), bytes: goldenBytes.byteLength,
      sha256: (await sha256(goldenBytes)) ?? null,
    },
    candidate: {
      name: path.basename(candidate), bytes: candidateBytes.byteLength,
      sha256: (await sha256(candidateBytes)) ?? null,
    },
  });

  const cliJson = JSON.parse(fs.readFileSync(fromCli, 'utf8')) as Record<string, unknown>;
  const appJson = JSON.parse(resultJsonText(appSide)) as Record<string, unknown>;

  console.log('');
  check('both say which schema and kind they are',
    cliJson.schema === appJson.schema && cliJson.kind === appJson.kind,
    `${String(cliJson.schema)} · ${String(cliJson.kind)}`);

  const a = withoutRun(appJson);
  const b = withoutRun(cliJson);
  if (a !== b) {
    const x = a.split('\n');
    const y = b.split('\n');
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if (x[i] !== y[i]) {
        console.log(`      line ${i + 1}: app ${JSON.stringify(x[i] ?? null)}`);
        console.log(`               cli ${JSON.stringify(y[i] ?? null)}`);
        break;
      }
    }
  }
  check('the two documents are identical outside `run`', a === b,
    a === b ? `${a.split('\n').length} lines` : 'see the first difference above');

  check('and the findings hash agrees',
    cliJson.findingsSha256 === appJson.findingsSha256,
    String(appJson.findingsSha256).slice(0, 12));

  // The clock is the one thing that may differ, and it must be there.
  const cliRun = cliJson.run as { started: string };
  check('each names when it ran', typeof cliRun.started === 'string' && cliRun.started.length > 10,
    cliRun.started);
  check('and where it ran, which is not the same question',
    (cliJson.env as Record<string, string>).runtime === 'node');

  console.log('');
  const ok = checks.filter(([, p]) => p).length;
  console.log('  ' + ok + '/' + checks.length + ' checks passed');
  if (ok !== checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
