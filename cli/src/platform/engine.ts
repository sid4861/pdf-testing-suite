// The single seam between the CLI and the React app.
//
// Everything the CLI needs from the app's comparison engine is re-exported here, and the
// DOM shim is installed by the import above before any of it loads. Keeping this the only
// module that reaches into ../../src means the coupling is one file wide — if the app ever
// moves a service, exactly one import list changes.
//
// The app is never modified. This imports it as-is.

import './dom-shim.js';

import fs from 'node:fs';
import path from 'node:path';

export { loadPdf, comparePage } from '../../../src/services/pdfCompare';

export {
  buildChanges,
  heatmapBoxes,
  summaryPageDiffers,
  HEAT_COLOR,
  HEAT_LABEL,
  type Change,
  type HeatBox,
} from '../../../src/services/changes';

export {
  REPORT_CSS,
  reportPageRows,
  reportPageDetail,
  judgePage,
  escapeHtml,
  pct,
  inchStr,
  type ExportThresholds,
} from '../../../src/services/exportReport';

export type {
  CompareSummary,
  PageComparison,
  PageSummary,
} from '../../../src/types/compare';

/**
 * The engine's `loadPdf` takes a browser `File`. Node has no equivalent that pdf.js
 * accepts, but the engine only ever calls `.arrayBuffer()` and reads `.name`, so a
 * structural stand-in is enough.
 */
export function fileFromPath(filePath: string): File {
  const buf = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  } as unknown as File;
}
