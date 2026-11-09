// `@pdfsuite/compare/cli` → dist/cli.js.
//
// The host loads this file at run time out of an installed package (W-30,
// SR-NPM-PACKAGES decision 3), so it has to be JavaScript: `createRequire`
// cannot resolve a TypeScript source, and asking a user to install a
// TypeScript loader to run a CLI is not an install step anybody accepts.
//
// It is bundled rather than merely compiled because it is loaded *by* the
// host, not installed as a tree the host understands: everything it needs is
// in the one file, except the native canvas module, which cannot be bundled.
// `@pdfsuite/cli` is imported for types only and leaves no trace here — see
// the note at the top of `src/cli/index.ts`.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { bundle, flag } from '../../scripts/bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

await bundle({
  entry: path.join(here, flag('entry', 'src/cli/index.ts')),
  outfile: path.join(here, flag('out', 'dist/cli.js')),
});
