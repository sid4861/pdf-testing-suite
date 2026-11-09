/**
 * The spec-driven comparison feature — its entire public surface.
 *
 * The app imports from `src/features/spec` and nothing else inside this folder.
 * Two exported components and this file's stylesheet import are the whole
 * contract, which is what lets the folder be replaced wholesale from a zip
 * without touching the rest of the app. See `README.md`.
 */

import './spec.css';

export { default as SpecTestView } from './SpecTestView';
export { default as SpecExportMenu } from './SpecExportMenu';
