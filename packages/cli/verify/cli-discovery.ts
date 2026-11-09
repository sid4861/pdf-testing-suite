// W-30 DoD 2 and 4 — the host loads a command out of an installed package,
// and says something useful when it cannot.
//
// This is the part of W-30 that cannot be checked by reading the code,
// because the whole point is what happens across an *install*: the host
// resolves `@pdfsuite/compare/cli` from the project being worked in, falls
// back to its own location, and treats a version that is not its own as a
// tool error rather than running it.
//
// So each check builds a real project directory with a real (if tiny)
// `@pdfsuite/compare` in its `node_modules`, runs the **built binary** as a
// process from inside it, and reads the exit code and the message. A stub
// command module is enough: nothing here is about comparing PDFs, it is about
// whether the host finds the module, trusts it, and fails honestly.
//
// The one case that needs more than a stub is "not installed at all". The
// host also looks beside itself, and beside itself *in this checkout* is a
// workspace that has compare — so that case copies the binary to a temporary
// directory outside the repository, with only the native canvas module
// linked in beside it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');
const repoRoot = path.resolve(cliRoot, '../..');
const BIN = path.join(cliRoot, 'dist/index.js');
const HOST_VERSION = '2.0.0';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  OK    ${label}${detail ? `  — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? `  — ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log('');
  console.log(`  ${title}`);
  console.log('');
}

/** Run the built binary and collect what CI would see. */
function run(args: string[], cwd: string, bin = BIN): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [bin, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/**
 * A project with a stand-in `@pdfsuite/compare` installed.
 *
 * `body` is the module's source. It is written as JavaScript because that is
 * what an installed package is: `createRequire` cannot resolve a TypeScript
 * source, which is why the real package builds `dist/cli.js`.
 */
function projectWith(name: string, version: string, body: string, pkg = 'compare'): string {
  const dir = path.join(cliRoot, '.work/discovery', name);
  const pkgDir = path.join(dir, `node_modules/@pdfsuite/${pkg}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({
      name: `@pdfsuite/${pkg}`,
      version,
      type: 'module',
      exports: { './cli': './cli.js' },
    }, null, 2),
  );
  fs.writeFileSync(path.join(pkgDir, 'cli.js'), body);
  return dir;
}

console.log('');
console.log('  pdfsuite — a command comes from its package (W-30, W-32)');

// ── 1. the real thing, in this workspace ─────────────────────────────
section('the installed command');

{
  const help = run(['--help'], cliRoot);
  ok('`compare` is listed when its package is installed', /\n\s+compare \[options\]/.test(help.out),
    'loaded from @pdfsuite/compare/cli');
  ok('and its description is the command\'s, not a placeholder',
    /compare .*Compare one PDF against its golden/.test(help.out));

  // The module is what registers the flags, so finding them proves the host
  // did not fall back to anything of its own.
  const chelp = run(['compare', '--help'], cliRoot);
  ok('the module\'s own flags are registered', /--pages <map>/.test(chelp.out) && /--each/.test(chelp.out));
  ok('and its help text came with it', /A page changes if it differs at all/.test(chelp.out));
}

// ── 1b. and the other one ────────────────────────────────
//
// `spec` was compiled into the host until **W-32** made `@pdfsuite/spec` a
// package. Both commands now arrive the same way, so both are checked the
// same way — otherwise the second one is only *believed* to be discovered.
section('the other installed command');

{
  const help = run(['--help'], cliRoot);
  ok('`spec` is listed when its package is installed', /\n\s+spec \[options\]/.test(help.out),
    'loaded from @pdfsuite/spec/cli');

  const shelp = run(['spec', '--help'], cliRoot);
  ok('the module\'s own flags are registered', /--validate-only/.test(shelp.out)
    && /--template <file>/.test(shelp.out));
  ok('and its help text came with it', /The spec is validated first/.test(shelp.out));
}

{
  const dir = projectWith('spec-mismatch', '1.9.0', `
export const command = {
  name: 'spec',
  version: '1.9.0',
  register(program) { program.command('spec').action(() => {}); },
};
`, 'spec');
  const r = run(['spec', 'a.xlsx', 'b.pdf', '--out', 'out'], dir);
  ok('a mismatched spec package is refused too', r.code === 2, `exit ${r.code}`);
  ok('and the install line names *that* package',
    r.out.includes(`npm i @pdfsuite/spec@${HOST_VERSION}`));
}

// ── 2. a version that is not the host's ──────────────────────────────
section('a version that is not the host\'s (DoD 4)');

{
  const dir = projectWith('mismatch', '1.9.0', `
export const command = {
  name: 'compare',
  version: '1.9.0',
  register(program) { program.command('compare').action(() => {}); },
};
`);
  const r = run(['compare', 'a.pdf', 'b.pdf', '--out', 'out'], dir);
  ok('a mismatched package is refused', r.code === 2, `exit ${r.code}`);
  ok('both versions are printed, because neither alone says which to change',
    r.out.includes('1.9.0') && r.out.includes(HOST_VERSION),
    r.out.split('\n').find((l) => l.startsWith('Error:'))?.trim());
  ok('and the message is the command to run', r.out.includes(`npm i @pdfsuite/compare@${HOST_VERSION}`));
  ok('it did not run the command', !r.out.includes('result.json'));
}

// ── 3. installed, but not a command module ───────────────────────────
section('installed, but not a command module');

{
  const dir = projectWith('empty', HOST_VERSION, 'export const notTheCommand = 1;\n');
  const r = run(['compare', 'a.pdf', 'b.pdf', '--out', 'out'], dir);
  ok('a package that exports nothing usable is a tool error', r.code === 2, `exit ${r.code}`);
  ok('and it says what was expected', r.out.includes('does not export a command module'));
}

{
  const dir = projectWith('wrong-name', HOST_VERSION, `
export const command = { name: 'inspect', version: '${HOST_VERSION}', register() {} };
`);
  const r = run(['compare', 'a.pdf', 'b.pdf', '--out', 'out'], dir);
  ok('a package providing a different command is refused', r.code === 2, `exit ${r.code}`);
  ok('and names both commands', r.out.includes('"inspect"') && r.out.includes('"compare"'));
}

// ── 4. not installed at all ──────────────────────────────────────────
section('not installed at all (DoD 2)');

{
  // Outside the repository, so the host's own fallback finds nothing either.
  const away = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfsuite-discovery-'));
  const hostDir = path.join(away, 'host');
  fs.mkdirSync(path.join(hostDir, 'node_modules'), { recursive: true });
  fs.copyFileSync(BIN, path.join(hostDir, 'index.js'));
  fs.copyFileSync(path.join(cliRoot, 'dist/pdf.worker.mjs'), path.join(hostDir, 'pdf.worker.mjs'));
  // The native canvas module is external to the bundle and is not what this
  // check is about, so it is linked in. A junction, because a plain symlink
  // needs administrator rights on Windows.
  fs.symlinkSync(
    path.join(repoRoot, 'node_modules/@napi-rs'),
    path.join(hostDir, 'node_modules/@napi-rs'),
    'junction',
  );

  const r = run(['compare', 'a.pdf', 'b.pdf', '--out', 'out'], away, path.join(hostDir, 'index.js'));
  ok('a missing package is a tool error, not a crash', r.code === 2, `exit ${r.code}`);
  ok('it does not say "unknown command", because the command is known',
    !/unknown command/i.test(r.out));
  ok('it names the package', r.out.includes('@pdfsuite/compare'));
  ok('and the message is the install line', r.out.includes('npm i @pdfsuite/compare@2.0.0'),
    r.out.split('\n').find((l) => l.trim().startsWith('Run:'))?.trim());

  const help = run(['--help'], away, path.join(hostDir, 'index.js'));
  // Commander wraps a long description, so the listing is read with its
  // whitespace collapsed: where the line breaks is commander's business.
  const flat = help.out.replace(/\s+/g, ' ');
  ok('`--help` still lists them, with what to install',
    flat.includes('compare compare a PDF against its golden')
      && flat.includes('needs @pdfsuite/compare (npm i @pdfsuite/compare)')
      && flat.includes('needs @pdfsuite/spec (npm i @pdfsuite/spec)'));

  // A command the host does own must be unaffected by any of this.
  const rs = run(['spec', 'a.xlsx', 'b.pdf', '--out', 'out'], away, path.join(hostDir, 'index.js'));
  ok('and the same holds for spec', rs.code === 2 && rs.out.includes('npm i @pdfsuite/spec@2.0.0'),
    `exit ${rs.code}`);

  const gen = run(['generate', '--help'], away, path.join(hostDir, 'index.js'));
  ok('a built-in command is unaffected', gen.code === 0 && /--payloads <dir>/.test(gen.out));

  fs.rmSync(away, { recursive: true, force: true });
}

console.log('');
console.log(`  ${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exit(1);
