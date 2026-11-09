// The single seam between the CLI and the React app.
//
// Everything the CLI needs from the app's comparison engine is re-exported here, and the
// DOM shim is installed by the import above before any of it loads. Keeping this the only
// module that reaches into ../../src means the coupling is one file wide — if the app ever
// moves a service, exactly one import list changes.
//
// The app is never modified. This imports it as-is.

import './dom-shim.js';

export { loadPdf, comparePage } from '@pdfsuite/core';

// Inspect: the measurement and its two documents (W-28). The `inspect`
// command is a built-in of this host, so unlike compare and spec it reaches
// core through this seam like any other host code.
export { inspectCore, inspectPage } from '@pdfsuite/core';
export { buildInspectResultJson, buildInspectReportHtml } from '@pdfsuite/core';
export type {
  InspectedPage, InspectedElement, InspectResultJson, InspectReportImages,
} from '@pdfsuite/core';

// Serialising a result, hashing a file and listing a run's files are core's,
// not a compare or a spec concern — one spelling for both kinds.
export { resultJsonText, buildManifest, manifestText, sha256 } from '@pdfsuite/core';

export {
  BASE_SCALE,
  MAX_PAGE_WIDTH,
  PAGE_VERDICT,
  MOVED_OFFSET_IN,
  AUTO_SCAN_MAX_PAGES,
} from '@pdfsuite/core';

// Nothing from `@pdfsuite/compare` is re-exported here any more. The host
// does not depend on compare (W-30, SR-NPM-PACKAGES decision 3): the compare
// command is loaded out of that package at run time, and the verify suites
// that exercise the builders import them from the package by name, as any
// consumer would.

export type {
  CompareSummary,
  PageComparison,
  PageSummary,
} from '@pdfsuite/core';

// `fileFromPath` moved into `@pdfsuite/core/node` with **W-30**, so the host
// and a command module loaded from an installed package share one copy.
export { fileFromPath } from '@pdfsuite/core/node';

// Nothing from `@pdfsuite/spec` is re-exported here either. The `spec`
// command moved into that package with **W-32**, so the host no longer names
// the feature at all — `scripts/check-packages.sh` rule 6 holds that line.
// What is left above is what the verify suites need from `core` with the DOM
// shim already installed, which is the only reason this file still exists.
