/**
 * `@pdfsuite/compare` — one PDF against another.
 *
 * What changed on a page, how two sets of pages line up, and whether any of
 * it is a failure. It depends on `@pdfsuite/core` for reading a document and
 * on nothing else in the suite (SR-NPM-PACKAGES decision 2); **W-27** moves
 * the page loop and the page-changed rule in here so the app and the CLI run
 * one function rather than two that agree today.
 */

export * from './changes';
export * from './pagePairs';

// One page rule and one page loop, called by the app and the CLI alike
// (W-27, SR-LAW-3).
export * from './verdict';
export * from './comparePair';
export * from './result';
export * from './reportHtml';
