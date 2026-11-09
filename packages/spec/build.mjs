// `@pdfsuite/spec/cli` → dist/cli.js.
//
// The host loads this file at run time out of an installed package (W-30,
// SR-NPM-PACKAGES decision 3), so it has to be JavaScript: `createRequire`
// cannot resolve a TypeScript source. Same shape as compare's build; the
// pdf.js knowledge is shared in `scripts/bundle.mjs`.
//
// Only the CLI entry is built. `src/index.ts` and `src/engine.ts` ship as
// TypeScript, because what consumes them — the app through Vite, and this
// repository's own verify suites — compiles them anyway.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { bundle, flag } from '../../scripts/bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

await bundle({
  entry: path.join(here, flag('entry', 'src/cli/index.ts')),
  outfile: path.join(here, flag('out', 'dist/cli.js')),
});
