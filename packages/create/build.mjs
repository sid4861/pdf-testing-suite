// `@pdfsuite/create` → dist/index.js.
//
// The bin is JavaScript and loads the decisions from `dist/`, because a
// published package cannot ask Node to read TypeScript. Nothing here touches
// pdf.js, so this is plain esbuild rather than the shared bundler: `create`
// has **no dependencies at all** (node:fs, node:path, node:crypto), which is
// the property worth keeping — it runs before anything is installed.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(here, 'src/index.ts')],
  outfile: path.join(here, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
});
