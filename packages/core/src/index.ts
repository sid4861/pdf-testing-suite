/**
 * `@pdfsuite/core` — opening a PDF and reading what is on it.
 *
 * Everything here is about one document: loading it with its fonts and
 * character maps, pulling out text, images and their positions, and the
 * numbers that decide how any of that is judged. Nothing here knows about a
 * second PDF, a spec or a report — those are `@pdfsuite/compare` and
 * `@pdfsuite/spec`, which depend on this and not the other way round
 * (SR-NPM-PACKAGES decision 2).
 *
 * This file is the whole public surface. Anything that reaches past it into
 * `src/` is importing something nobody promised to keep.
 */

export {
  loadPdf,
  comparePage,
  renderThumb,
  pixelDiff,
  matchItems,
  diffStyle,
  diffText,
  contentMatchRatio,
  reconstructReadingText,
  type ComparePageOpts,
} from './pdfCompare';

export { renderElements, type PageElement, type ElementsPage } from './pdfElements';

// Where an element is and what it is — one implementation for the Inspect
// tab and `pdfsuite inspect` (W-28, SR-INSPECT decision 1).
export {
  inspectCore,
  inspectPage,
  adjacentLine,
  type InspectedPage,
  type InspectedElement,
  type ElementBox,
  type ElementFont,
  type ElementLineHeight,
  type InspectOptions,
} from './inspect';

export * from './constants';
export type * from './types';

// ── the three files every run writes (SR-REPORT-JSON, -HTML, SR-MANIFEST) ──
export * from './report/envelope';
export * from './report/manifest';
export { sha256 } from './report/sha256';

// An inspect's two documents (W-28). They live in core and not in a command
// package because `inspect` is a built-in of `@pdfsuite/cli` calling core
// (SR-NPM-PACKAGES decision 3, SR-INSPECT decision 2).
export {
  buildInspectResultJson,
  type InspectResultJson,
  type InspectResultMeta,
  type ResultInspectPage,
} from './report/inspectResult';
export {
  buildInspectReportHtml,
  type InspectReportImages,
  type InspectReportOptions,
} from './report/inspectReportHtml';
