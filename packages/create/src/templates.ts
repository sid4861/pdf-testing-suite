/**
 * Every file `create` writes, as a string.
 *
 * Kept as data rather than copied from a `template/` folder on disk for one
 * reason: **the shell is the thing being kept thin**, and a folder of
 * template files is a folder somebody will quietly add a component to. A
 * reviewer can read this file top to bottom and see the entire app a user
 * gets — twelve files, none of which contains a screen.
 *
 * What goes in a created app, and nothing else:
 *
 *   * an entry point that mounts `<PdfSuiteApp/>`;
 *   * one config file, which is the only file anybody is expected to edit;
 *   * the build's own paperwork — `index.html`, Vite, TypeScript, gitignore.
 *
 * Screens come from `@pdfsuite/ui` (L4 decision 5), so an upgrade delivers
 * them. A screen written here could never be delivered by `npm update`,
 * which is the whole reason this package exists.
 */

/**
 * The package a created app mounts its screens from.
 *
 * A constant, not four string literals, for two reasons: the name appears in
 * generated source *and* in a dependency list, and `check-packages.sh`'s
 * rule 3 cannot otherwise tell a template's text from an import this package
 * makes and has not declared.
 */
const UI = '@pdfsuite/ui';

export interface TemplateOptions {
  /** The app's name, used in `package.json` and the page title. */
  name: string;
  /** The one version every `@pdfsuite/*` dependency is pinned to. */
  version: string;
  /** Is `@pdfsuite/spec` being installed? Without it there is no Spec tab. */
  withSpec: boolean;
}

/** One file to write: its path relative to the target, and its contents. */
export interface PlannedFile {
  path: string;
  contents: string;
}

const CONFIG_TS = `/**
 * pdfsuite's configuration for this app. **This is the file to edit.**
 *
 * Everything here is optional: delete the lot and you get every tab with
 * every feature on. Nothing in it can change what a comparison *finds* —
 * that lives in @pdfsuite/core, @pdfsuite/compare and @pdfsuite/spec, so the
 * app and the command line can never disagree about a document.
 *
 * \`npm create @pdfsuite@latest -- --sync\` replaces a file pdfsuite wrote
 * only while it is still exactly as pdfsuite wrote it. **Edit this file and
 * an upgrade will never overwrite it** — it writes pdfsuite.config.ts.pdfsuite-new
 * beside it instead, and tells you.
 */

import type { PdfSuiteConfig } from '${UI}';

export const config: PdfSuiteConfig = {
  // Which tabs to show, in this order. Omit the line for all of them.
  // tabs: ['compare', 'spec', 'measure'],

  // Which tab opens first. Defaults to the first one shown.
  // initialTab: 'compare',

  // Feature flags. Anything not named here keeps its default, which is on.
  // flags: { exportZip: false },
};

export default config;
`;

const MAIN_TSX = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PdfSuiteApp } from '${UI}';

import { config } from './pdfsuite.config';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PdfSuiteApp config={config} />
  </StrictMode>,
);
`;

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built app can be served from any sub-path.
  base: './',
});
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"]
}
`;

const GITIGNORE = `node_modules
dist
*.local
.DS_Store
`;

const indexHtml = (name: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

/**
 * The `@pdfsuite/*` dependencies, every one pinned to the same exact version.
 *
 * Exact, not a range: the suite is published as one version (SR-NPM-PACKAGES
 * decision 1), and a range lets `npm install` assemble a set that was never
 * released together. `@pdfsuite/cli` arrives through `compare`, which depends
 * on it, and brings the `pdfsuite` command with it.
 */
export function pdfsuiteDeps(o: TemplateOptions): Record<string, string> {
  const deps: Record<string, string> = {
    '@pdfsuite/compare': o.version,
    '@pdfsuite/core': o.version,
    [UI]: o.version,
  };
  if (o.withSpec) deps['@pdfsuite/spec'] = o.version;
  return deps;
}

/** A whole new application. */
export function newAppFiles(o: TemplateOptions): PlannedFile[] {
  const pkg = {
    name: o.name,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      // `tsc` first, then the bundle. It was `vite build` alone for one day
      // (W-31): the packages published TypeScript source, so a consumer's
      // compiler checked *our* code with *their* settings and reported our
      // problems in their project. **W-52** made every package publish
      // JavaScript with `.d.ts`, so this works again — and
      // `scripts/check-create.sh` runs it against the packed tarballs,
      // which is the only place the difference shows.
      build: 'tsc --noEmit && vite build',
      preview: 'vite preview',
    },
    dependencies: {
      ...pdfsuiteDeps(o),
      react: '^18.3.1',
      'react-dom': '^18.3.1',
    },
    devDependencies: {
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      '@vitejs/plugin-react': '^4.3.4',
      typescript: '^5.6.3',
      vite: '^5.4.11',
    },
  };

  return [
    { path: 'package.json', contents: JSON.stringify(pkg, null, 2) + '\n' },
    { path: 'index.html', contents: indexHtml(o.name) },
    { path: 'vite.config.ts', contents: VITE_CONFIG },
    { path: 'tsconfig.json', contents: TSCONFIG },
    { path: '.gitignore', contents: GITIGNORE },
    { path: 'src/main.tsx', contents: MAIN_TSX },
    { path: 'src/pdfsuite.config.ts', contents: CONFIG_TS },
  ];
}

/**
 * pdfsuite added to an app somebody already has.
 *
 * One folder, and not one line of theirs. The page is a component they mount
 * wherever they like; the command tells them the one line to add, because a
 * wrong edit to somebody else's router is worse than a line they have to
 * paste (SR-NPM-PACKAGES decision 7).
 */
export function addModeFiles(srcDir: string): PlannedFile[] {
  const page = `/**
 * pdfsuite, as a page in this application.
 *
 * Mount it wherever you like — a route, a tab, a modal. Everything it shows
 * comes from @pdfsuite/ui, so \`npm update\` delivers new screens.
 *
 * Edit pdfsuite.config.ts beside this file, not this file: an upgrade
 * replaces this one while it is untouched, and leaves your config alone.
 */

import { PdfSuiteApp } from '${UI}';

import { config } from './pdfsuite.config';

export default function PdfSuitePage() {
  return <PdfSuiteApp config={config} />;
}
`;

  const prefix = srcDir === '.' ? 'pdfsuite' : `${srcDir}/pdfsuite`;
  return [
    { path: `${prefix}/PdfSuitePage.tsx`, contents: page },
    { path: `${prefix}/pdfsuite.config.ts`, contents: CONFIG_TS },
  ];
}

/**
 * The one line the person adds themselves, printed rather than written.
 *
 * Relative to a file *inside* their source directory, because that is where
 * a router lives. Printing it relative to the project root would be a line
 * that does not resolve from the only file anybody would paste it into.
 */
export function routerLine(): string {
  return "import PdfSuitePage from './pdfsuite/PdfSuitePage';";
}
