// The one place that knows how to bundle pdf.js for Node.
//
// It used to live in `packages/cli/build.mjs`, which was fine while the CLI
// was the only bundle. **W-30** adds a second one: `@pdfsuite/compare` builds
// its command module to `dist/cli.js` so the host can load it at run time
// from an installed package. Two copies of the knowledge below would be two
// copies of a lesson that cost a green suite once already (see
// `work/LESSONS.md`), so it is shared instead.
//
// Two fixes live here rather than in the app, so the React app stays untouched:
//
//   1. `?url` imports — the app does
//      `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`.
//      That suffix is a Vite build-time transform; Node cannot resolve it. The
//      plugin below turns it into a module that resolves the file NEXT TO THE
//      BUNDLE at runtime. It used to bake in an absolute path, which works in a
//      checkout and breaks the moment the package is installed anywhere else —
//      so the worker is copied into the output directory and found through
//      `import.meta.url`.
//
//   2. pdfjs-dist build selection — the default browser build assumes DOM at
//      import time. Alias it to the legacy build, which runs under Node.

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const nodeModules = path.join(repoRoot, 'node_modules');

const pdfjsLegacy = path.join(nodeModules, 'pdfjs-dist/legacy/build/pdf.mjs');
const pdfjsLegacyWorker = path.join(nodeModules, 'pdfjs-dist/legacy/build/pdf.worker.mjs');

/** The worker's name beside the bundle. Referenced by the plugin below. */
const WORKER_BASENAME = 'pdf.worker.mjs';

for (const [label, p] of [
  ['pdfjs legacy build', pdfjsLegacy],
  ['pdfjs legacy worker', pdfjsLegacyWorker],
]) {
  if (!fs.existsSync(p)) throw new Error(`Missing ${label}: ${p}`);
}

/** Resolve `…?url` imports to a module exporting the absolute file path. */
const urlSuffixPlugin = {
  name: 'url-suffix',
  setup(build) {
    build.onResolve({ filter: /\?url$/ }, (args) => ({
      path: args.path.slice(0, -'?url'.length),
      namespace: 'url-suffix',
      pluginData: { resolveDir: args.resolveDir },
    }));

    build.onLoad({ filter: /.*/, namespace: 'url-suffix' }, (args) => {
      // The app asks for the minified browser worker; under Node we hand back the
      // legacy worker instead, copied next to the bundle. pdf.js import()s this
      // value, and Node's ESM loader rejects bare Windows paths ("protocol 'c:'"),
      // so it has to be a URL — built at runtime, not at build time.
      if (args.path.includes('pdf.worker')) {
        return {
          contents:
            "export default new URL('./" +
            WORKER_BASENAME +
            "', import.meta.url).href;\n",
          loader: 'js',
        };
      }
      const href = pathToFileURL(path.resolve(nodeModules, args.path)).href;
      return { contents: `export default ${JSON.stringify(href)};`, loader: 'js' };
    });
  },
};

/** Point bare `pdfjs-dist` imports at the Node-safe legacy build. */
const pdfjsLegacyPlugin = {
  name: 'pdfjs-legacy',
  setup(build) {
    build.onResolve({ filter: /^pdfjs-dist$/ }, () => ({ path: pdfjsLegacy }));
  },
};

/**
 * Bundle one entry for Node.
 *
 * @param {object} o
 * @param {string} o.entry    absolute path to the entry module
 * @param {string} o.outfile  absolute path to write
 * @param {string[]} [o.external] extra specifiers to leave alone
 * @param {boolean} [o.banner] add the `require` shim (the CLI needs it; a
 *                             command module bundled on its own does not care)
 */
export async function bundle({ entry, outfile, external = [], banner = true }) {
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: true,
    // Resolve the workspace packages to their source (W-52). Without it
    // esbuild takes `dist`, so the `?url` plugin and the pdfjs-legacy alias
    // below never see the imports they exist for — and a stale `dist` ends
    // up inside the published binary.
    conditions: ['development'],
    // Native module — must stay external, cannot be bundled.
    external: ['@napi-rs/canvas', 'express', ...external],
    plugins: [urlSuffixPlugin, pdfjsLegacyPlugin],
    ...(banner
      ? {
        banner: {
          // esbuild's ESM output loses require(); some deps still reach for it.
          js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
        },
      }
      : {}),
    logLevel: 'info',
  });

  // The worker has to sit beside whatever was just built — dist/ for the
  // published bundle, .work/ for a verify script — because that is where the
  // generated module above looks for it.
  const outDir = path.dirname(outfile);
  fs.copyFileSync(pdfjsLegacyWorker, path.join(outDir, WORKER_BASENAME));
  console.log(`  copied ${WORKER_BASENAME} → ${path.relative(repoRoot, outDir)}/`);
}

/** `--name value` out of argv, with a fallback. */
export function flag(name, fallback) {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
