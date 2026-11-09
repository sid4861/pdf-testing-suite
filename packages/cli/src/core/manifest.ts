// The generation manifest: a record of what `generate` produced and how.
//
// Written alongside the PDFs so a failed CI run can be diagnosed without re-running the
// API — it captures the HTTP status, timing, and the sha256 of both the payload and the
// resulting PDF. The payload hash is the useful one: if it differs between a golden run
// and a candidate run, the *input* changed, so a visual difference is expected rather
// than a regression.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MANIFEST_FILENAME = 'manifest.json';

export interface ManifestEntry {
  payload: string;
  payloadSha256: string;
  pdf: string | null;
  pdfSha256: string | null;
  bytes: number | null;
  httpStatus: number | null;
  durationMs: number;
  attempts: number;
  ok: boolean;
  /** True when --skip-existing reused a file on disk instead of calling the API. Excluded
   *  from timing stats, which would otherwise be dragged toward zero by ~0ms reads. */
  skipped?: boolean;
  error?: string;
}

export interface Manifest {
  generatedAt: string;
  api: string;
  payloadDir: string;
  outDir: string;
  total: number;
  succeeded: number;
  failed: number;
  /** Wall-clock for the whole run, and per-document timing — capacity planning against a
   *  slow API, and evidence when the API gets slower over time. */
  totalDurationMs: number;
  slowestMs: number | null;
  averageMs: number | null;
  entries: ManifestEntry[];
}

export const sha256 = (data: Buffer | string): string =>
  crypto.createHash('sha256').update(data).digest('hex');

export function writeManifest(outDir: string, manifest: Manifest): string {
  const file = path.join(outDir, MANIFEST_FILENAME);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return file;
}

export function readManifest(dir: string): Manifest | null {
  const file = path.join(dir, MANIFEST_FILENAME);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
  } catch {
    return null;
  }
}
