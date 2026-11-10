// The stylesheet ships in `dist` as well as `src`.
//
// The emitted `dist/index.js` carries the barrel's `import './<name>.css'`
// verbatim — `tsc` neither resolves nor copies it — so without this a
// consumer's bundler fails on a file that is not there. One copy, named,
// rather than a build tool nobody else in this repository uses.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, 'src');
const dist = path.join(here, 'dist');

fs.mkdirSync(dist, { recursive: true });
let copied = 0;
for (const rel of fs.readdirSync(src)) {
  if (!rel.endsWith('.css')) continue;
  fs.copyFileSync(path.join(src, rel), path.join(dist, rel));
  copied++;
}

// The spec package also publishes its JSON schema by subpath.
const schema = path.join(src, 'schema');
if (fs.existsSync(schema)) {
  fs.mkdirSync(path.join(dist, 'schema'), { recursive: true });
  for (const rel of fs.readdirSync(schema)) {
    fs.copyFileSync(path.join(schema, rel), path.join(dist, 'schema', rel));
    copied++;
  }
}

console.log(`  copied ${copied} asset${copied === 1 ? '' : 's'} → dist/`);
