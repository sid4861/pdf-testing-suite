// Minimal browser-globals shim so the React app's comparison engine can run unmodified
// under Node. Import this module FIRST — before anything that pulls in ../src/services/*.
//
// The app's engine touches exactly three browser APIs:
//   document.createElement('canvas')  — pdfCompare.renderAndExtract / pixelDiff, and pdf.js
//   ImageData                         — pixel diff buffers
//   new Image()                       — exportReport.shrinkDataUrl
//
// Everything else in the engine is pure. Nothing DOM ships at runtime beyond this file.

import {
  createCanvas,
  ImageData as NapiImageData,
  loadImage,
  DOMMatrix as NapiDOMMatrix,
  DOMPoint as NapiDOMPoint,
  DOMRect as NapiDOMRect,
  Path2D as NapiPath2D,
} from '@napi-rs/canvas';

import { createRequire } from 'node:module';

// Deliberately untyped: we are substituting Node implementations for DOM globals. They
// are structurally compatible where the engine actually touches them (proven by
// spike/run-engine.ts), but not nominally identical to the DOM lib's types — so assigning
// through the real global types would be a wall of false errors.
const g = globalThis as unknown as Record<string, unknown>;

/**
 * `@napi-rs/canvas`'s Image takes a Buffer, but the engine assigns a base64 data URL and
 * waits on `onload`. This bridges the two: decode the data URL, decode the image, then
 * fire the callback asynchronously (matching browser ordering — handlers are always
 * attached after `src` is set).
 */
class ShimImage {
  onload: (() => void) | null = null;
  onerror: ((err?: unknown) => void) | null = null;
  width = 0;
  height = 0;
  /** The decoded napi image, used by ctx.drawImage. */
  _native: Awaited<ReturnType<typeof loadImage>> | null = null;

  set src(value: string) {
    void this._load(value);
  }

  private async _load(value: string) {
    try {
      const comma = value.indexOf(',');
      const payload =
        value.startsWith('data:') && comma >= 0
          ? Buffer.from(value.slice(comma + 1), 'base64')
          : Buffer.from(value);
      const img = await loadImage(payload);
      this._native = img;
      this.width = img.width;
      this.height = img.height;
      this.onload?.();
    } catch (err) {
      this.onerror?.(err);
    }
  }
}

let installed = false;

/** Install the browser globals the engine expects. Safe to call more than once. */
export function installDomShim(): void {
  if (installed) return;
  installed = true;

  if (!g.document) {
    g.document = {
      createElement(tag: string) {
        if (tag === 'canvas') return createCanvas(1, 1);
        throw new Error(
          `[dom-shim] document.createElement('${tag}') is not supported under Node. ` +
            `Only 'canvas' is shimmed — the CLI writes reports with fs and never calls download().`,
        );
      },
    };
  }

  if (!g.ImageData) g.ImageData = NapiImageData;
  if (!g.Image) g.Image = ShimImage;

  // pdf.js probes for these at import time and warns "rendering may be broken" when it
  // cannot polyfill them. napi-rs ships real implementations.
  if (!g.DOMMatrix) g.DOMMatrix = NapiDOMMatrix;
  if (!g.DOMPoint) g.DOMPoint = NapiDOMPoint;
  if (!g.DOMRect) g.DOMRect = NapiDOMRect;
  if (!g.Path2D) g.Path2D = NapiPath2D;

  // pdf.js's legacy build reaches for process.getBuiltinModule (Node 20.16+) to get at
  // require(). Node 20.12 predates it; provide it so pdf.js takes its normal path.
  const proc = process as unknown as Record<string, unknown>;
  if (typeof proc.getBuiltinModule !== 'function') {
    proc.getBuiltinModule = (id: string) => createRequire(import.meta.url)(id);
  }
}

installDomShim();

/**
 * Unwrap a ShimImage for ctx.drawImage. napi's drawImage needs its own Image instance,
 * not our wrapper — patched on the 2D context prototype below.
 */
const proto = Object.getPrototypeOf(createCanvas(1, 1).getContext('2d'));
const originalDrawImage = proto.drawImage;
proto.drawImage = function patchedDrawImage(this: unknown, image: unknown, ...rest: unknown[]) {
  const unwrapped = image instanceof ShimImage ? image._native : image;
  return originalDrawImage.call(this, unwrapped, ...rest);
};
