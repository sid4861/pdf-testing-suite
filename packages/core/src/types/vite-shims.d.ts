// The app is built by Vite, which resolves `?url` imports to an asset URL string.
// TypeScript has no knowledge of that transform, so `pdfCompare.ts` — which does
// `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` — does not
// type-check without this declaration.
//
// It lives in `core`, beside the import that needs it, and every package whose
// tsconfig reaches into core adds this one file to its `include`. It used to sit
// in `packages/cli`; the second package to need it (**W-30**) would have made it
// two copies of the same shim, and a declaration that exists twice is a
// declaration that will disagree with itself.
//
// At build time the esbuild `url-suffix` plugin in `scripts/bundle.mjs`
// substitutes the Node-safe legacy worker path. The app itself is not modified.

declare module '*?url' {
  const url: string;
  export default url;
}
