// `import.meta.env.BASE_URL` — Vite's, and the one assumption the packages
// still make about the app around them.
//
// Four stores call `loadExample()`, which fetches a sample from `samples/…`
// relative to the app's base URL — so those files must sit in the consumer's
// `public/` folder. That was free while the screens *were* the app (W-32 and
// W-33 moved them into packages); for a consumer it is an undocumented
// requirement, and it is filed as **B-020**.
//
// It lives in `core` because `@pdfsuite/spec` and `@pdfsuite/ui` both need
// it, and a declaration that exists twice is a declaration that will
// disagree with itself.
//
// Declared rather than pulled in with `vite/client`, which would add a
// build-tool dependency to a package that otherwise has none.

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
