#!/usr/bin/env node
// `npm create @pdfsuite [dir]` — npm maps that to this package's bin.
//
// Thin on purpose: argument parsing and printing live here, every decision
// lives in `src/`, so the decisions can be tested without a process.

import path from 'node:path';
import process from 'node:process';

import { create, sync, CreateError, PDFSUITE_VERSION } from '../dist/index.js';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const positional = argv.filter((a) => !a.startsWith('-'));

if (has('--help') || has('-h')) {
  console.log(`
  npm create @pdfsuite [directory]

  In an empty directory   a whole app: the screens, and the pdfsuite command.
  In a React app          src/pdfsuite/ and the dependencies. Nothing of yours
                          is edited except package.json's dependency list.

  --no-spec        leave out @pdfsuite/spec, and with it the Spec tab
  --no-agents      do not write the agent files (none are written yet — see below)
  --dry-run        say what would be written, write nothing
  --version <v>    pin @pdfsuite/* to this version (default ${PDFSUITE_VERSION})

  Upgrading an app this wrote before:

  --sync           bump every @pdfsuite/* to one version, replace the files
                   you have not touched, and write <file>.pdfsuite-new beside
                   the ones you have. Your edits are never overwritten.
  --check          with --sync: write nothing, exit 1 if the app is behind.
  --restore        with --sync: also bring back files you deleted.
`);
  process.exit(0);
}

const versionAt = argv.indexOf('--version');
const version = versionAt >= 0 ? { version: argv[versionAt + 1] } : {};

const LABEL = {
  added: 'added    ',
  replaced: 'replaced ',
  unchanged: 'unchanged',
  kept: 'kept     ',
  'stays-deleted': 'deleted  ',
};

if (has('--sync')) {
  try {
    const r = sync({ dir: path.resolve(positional[0] ?? '.'), check: has('--check'),
      restore: has('--restore'), ...version });

    console.log('');
    console.log(has('--check')
      ? `  pdfsuite — checking ${r.dir}`
      : `  pdfsuite ${r.from} → ${r.to} in ${r.dir}`);
    console.log('');

    for (const f of r.files) {
      // An unchanged file is the common case and saying so for every one of
      // them buries the two lines that matter.
      if (f.outcome === 'unchanged') continue;
      console.log(`  ${LABEL[f.outcome]}  ${f.path}`);
      if (f.sideBySide) console.log(`              → your version kept; ours is ${f.sideBySide}`);
    }
    for (const d of r.dependencies) {
      console.log(`  dependency  ${d.name}  ${d.from ?? '(new)'} → ${d.to}`);
    }

    console.log('');
    if (r.upToDate) {
      console.log('  Already up to date.');
    } else if (has('--check')) {
      console.log('  This app is behind. Run the same command without --check to upgrade.');
    } else {
      const kept = r.files.filter((f) => f.outcome === 'kept');
      if (kept.length) {
        console.log(`  ${kept.length} file${kept.length === 1 ? '' : 's'} you had edited `
          + `${kept.length === 1 ? 'was' : 'were'} left alone. The new version of each is `
          + 'beside it as .pdfsuite-new.');
      }
      const gone = r.files.filter((f) => f.outcome === 'stays-deleted');
      if (gone.length) {
        console.log(`  ${gone.length} file${gone.length === 1 ? '' : 's'} you had deleted stayed `
          + 'deleted. Pass --restore to bring them back.');
      }
      console.log('  Then: npm install');
    }
    console.log('');

    // The only non-zero exit that is not an error: --check is for CI.
    if (has('--check') && !r.upToDate) process.exit(1);
    process.exit(0);
  } catch (err) {
    if (err instanceof CreateError || err?.name === 'CreateError') {
      console.error(`\nError: ${err.message}`);
      if (err.hint) console.error(`  ${err.hint}`);
      process.exit(2);
    }
    console.error('\nUnexpected error:', err);
    process.exit(2);
  }
}

try {
  const result = create({
    dir: path.resolve(positional[0] ?? '.'),
    withSpec: !has('--no-spec'),
    agents: !has('--no-agents'),
    dryRun: has('--dry-run'),
    ...version,
  });

  const { target } = result;
  const verb = has('--dry-run') ? 'would write' : 'wrote';
  console.log('');
  console.log(target.mode === 'new'
    ? `  pdfsuite — a new app in ${target.dir}`
    : `  pdfsuite — added to ${target.name}`);
  console.log('');
  for (const file of result.files) console.log(`  ${verb}  ${file.path}`);
  if (!has('--dry-run')) console.log(`  ${verb}  .pdfsuite/installed.json`);
  console.log('');
  for (const line of result.nextSteps) console.log(line ? `  ${line}` : '');
  console.log('');
} catch (err) {
  if (err instanceof CreateError || err?.name === 'CreateError') {
    console.error(`\nError: ${err.message}`);
    if (err.hint) console.error(`  ${err.hint}`);
    process.exit(2);
  }
  console.error('\nUnexpected error:', err);
  process.exit(2);
}
