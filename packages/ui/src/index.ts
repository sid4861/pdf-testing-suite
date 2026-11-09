/**
 * `@pdfsuite/ui` — the screens, as React components.
 *
 * **W-33** moved them out of this repository's `src/` and into a package, for
 * the reason L4 decision 5 gives: a team who runs `npm create @pdfsuite` and
 * then `npm update` must *receive* new screens. Screens copied into their app
 * at scaffold time could never be synced; screens behind a package name can.
 *
 * What is in here is presentation only. Anything that decides something about
 * a PDF lives in `@pdfsuite/core`, `@pdfsuite/compare` or `@pdfsuite/spec`,
 * and each screen imports its own package and nothing else of another
 * package than its public exports (SR-NPM-PACKAGES decision 6, L3).
 *
 * The stylesheet is imported here, so a consumer who imports the package gets
 * it. Every class it defines is the suite's own; the tokens it reads are
 * declared in it too, so there is nothing a host has to provide.
 */

import './styles.css';

export { default as PdfSuiteApp, type PdfSuiteConfig, type Workspace } from './PdfSuiteApp';

// The four screens, for a host that lays out its own shell rather than
// taking `<PdfSuiteApp/>`'s tab strip.
export { default as CompareView } from './components/compare/ContentCompareView';
export { default as LayoutCompareView } from './components/compare/LayoutCompareView';
export { default as CompareReport } from './components/compare/CompareReport';
export { default as BulkCompareView } from './components/batch/BatchView';
export { default as InspectView } from './components/measure/MeasureView';

// Configuration: the flag list, its defaults, and the `flag.env` spelling for
// a host that keeps its flags in a file (this repository does).
export {
  DEFAULT_FLAGS,
  FLAG_ENV_KEYS,
  configureFlags,
  parseFlagEnv,
  type FeatureFlags,
} from './flags';

// The stores, for a host that wants to drive a screen from outside it.
export { useCompareStore, useBothLoaded, useTotalPages } from './store/compareStore';
export { useMeasureStore } from './store/measureStore';
export { useBatchStore } from './store/batchStore';
