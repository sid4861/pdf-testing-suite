// esbuild bundle for the host CLI. The pdf.js knowledge is shared with
// `@pdfsuite/compare`'s own bundle and lives in `scripts/bundle.mjs` (W-30).
//
//   node build.mjs                                   → dist/index.js
//   node build.mjs --entry verify/x.ts --out .work/x.js

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { bundle, flag } from '../../scripts/bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

await bundle({
  entry: path.join(here, flag('entry', 'src/index.ts')),
  outfile: path.join(here, flag('out', 'dist/index.js')),
  // The host does not bundle a command package. It resolves
  // `@pdfsuite/<name>/cli` at run time from wherever the user installed it,
  // which is the whole point of decision 3 — so these must not be followed
  // into the bundle even when the workspace has them sitting right there.
  external: ['@pdfsuite/compare/cli', '@pdfsuite/spec/cli'],
});
