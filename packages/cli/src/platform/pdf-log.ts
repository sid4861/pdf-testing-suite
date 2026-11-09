// pdf.js routes its warnings through console.log with a "Warning: " prefix. On PDFs with
// embedded fonts it cannot fully resolve, that is hundreds of lines of
// `getPathGenerator - ignoring character` noise per document — which buries real output
// and bloats CI logs. Rendering is unaffected (verified in the spike: metrics match the
// browser exactly), so these are suppressed unless --verbose is passed.

const PDFJS_NOISE =
  /^Warning: (getPathGenerator|Cannot polyfill|Cannot access the `require`|UnknownErrorException: Ensure that the `standardFontDataUrl`)/;

let installed = false;

export function installPdfLogFilter(verbose: boolean): void {
  if (installed || verbose) return;
  installed = true;

  const original = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && PDFJS_NOISE.test(args[0])) return;
    original(...args);
  };
}
