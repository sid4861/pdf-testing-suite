/**
 * This repository's app — a thin shell over `@pdfsuite/ui`.
 *
 * **W-33** moved every screen into the package, so what is left here is what
 * `npm create @pdfsuite` writes for a new app (W-31) plus this app's own
 * configuration: nothing but an entry point and the flags.
 *
 * That is the point of the exercise. If this file grew a component, the
 * screens in it could never be delivered to a created app by `npm update` —
 * which is L4 decision 5, and the reason `@pdfsuite/ui` exists.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PdfSuiteApp, parseFlagEnv } from '@pdfsuite/ui';

// `flag.env` at the repository root, read by the plugin in vite.config.ts.
// It is **this app's** configuration, not the library's: the package owns the
// flag list and its defaults, and a host hands in what it wants changed.
import rawFlags from 'virtual:feature-flags';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PdfSuiteApp config={{ flags: parseFlagEnv(rawFlags) }} />
  </StrictMode>,
);
