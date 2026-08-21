// The app is built by Vite, which resolves `?url` imports to an asset URL string.
// TypeScript has no knowledge of that transform, so importing the app's pdfCompare.ts
// (which does `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`) fails to
// type-check without this declaration.
//
// At build time the CLI's esbuild `url-suffix` plugin substitutes the Node-safe legacy
// worker path — see cli/build.mjs. The app itself is not modified.

declare module '*?url' {
  const url: string;
  export default url;
}
