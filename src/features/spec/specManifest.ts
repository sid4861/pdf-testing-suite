/**
 * `manifest.json` — SR-MANIFEST.
 *
 * Every input and output of a run, with its SHA-256 and its size, so the set
 * of files can be checked later without trusting the folder they sit in. It is
 * written **last** (decision 2), after `result.json` and `report.html`, because
 * it hashes their final bytes; it carries **no timestamp** (decision 5), since
 * the clock lives in `result.json`'s `run` block; and it lists names as the
 * person gave them, never this machine's absolute paths (decision 4).
 */

import { sha256 } from '@sheetpane/import';

export const MANIFEST_SCHEMA = 'pdfsuite.manifest/1';

export interface ManifestEntry {
  name: string;
  role: 'input' | 'output';
  bytes: number;
  sha256: string | null;
}

export interface Manifest {
  schema: string;
  files: ManifestEntry[];
}

/** One file of a run, by name and bytes. */
export interface ManifestFile {
  name: string;
  role: 'input' | 'output';
  /** The bytes, or a hash already known (for an input read elsewhere). */
  data?: Uint8Array | string;
  bytes?: number;
  sha256?: string | null;
}

const encode = (data: Uint8Array | string) =>
  typeof data === 'string' ? new TextEncoder().encode(data) : data;

export async function buildManifest(files: ManifestFile[]): Promise<Manifest> {
  const entries: ManifestEntry[] = [];
  for (const f of files) {
    const bytes = f.data ? encode(f.data) : null;
    entries.push({
      name: f.name,
      role: f.role,
      bytes: bytes ? bytes.byteLength : f.bytes ?? 0,
      // A hash the caller already has is kept rather than recomputed: for an
      // input it is the same hash `result.json` records, and the two files
      // disagreeing about one file would be worse than not hashing it twice.
      sha256: f.sha256 !== undefined
        ? f.sha256
        : bytes ? (await sha256(bytes).catch(() => undefined)) ?? null : null,
    });
  }
  return { schema: MANIFEST_SCHEMA, files: entries };
}

export function manifestText(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2) + '\n';
}
