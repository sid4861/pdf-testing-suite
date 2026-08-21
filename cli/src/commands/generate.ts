// `pdfsuite generate` — call the render API once per payload, save the returned PDFs.
//
// Tuned for a SLOW render API (20–40s per document is typical). That changes several
// things relative to a fast-API design:
//
//   * The timeout must sit well above the worst observed response time. A timeout that
//     fires on a healthy-but-slow response is far more damaging than waiting.
//   * Timeouts are NOT retried by default. If a request exceeded a generous timeout, the
//     retry almost always exceeds it too — turning one slow document into three, and
//     tripling the wall clock for nothing.
//   * A heartbeat is mandatory. With 40s calls a run can be silent for minutes, and CI
//     runners routinely kill jobs that produce no output ("no activity for N minutes").
//     The heartbeat is what keeps the job alive and legible.

import fs from 'node:fs';
import path from 'node:path';

import { EXIT, ToolError } from '../core/exit.js';
import type { ResponseMode } from '../core/config.js';
import { sha256, writeManifest, type Manifest, type ManifestEntry } from '../core/manifest.js';

export interface GenerateOptions {
  payloads: string;
  out: string;
  api: string;
  method: string;
  responseMode: ResponseMode;
  concurrency: number;
  timeout: number;
  retries: number;
  retryOnTimeout: boolean;
  retryBackoff: number;
  heartbeat: number;
  responsePath: string;
  header: string[];
  skipExisting: boolean;
  failFast: boolean;
}

type FailureKind = 'timeout' | 'network' | 'http-5xx' | 'http-4xx' | 'bad-response';

/** Walk a dot-path (`data.document.content`) into a parsed JSON response. */
function dig(obj: unknown, dotPath: string): unknown {
  return dotPath
    .split('.')
    .reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), obj);
}

function parseHeaders(raw: string[]): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const h of raw) {
    const i = h.indexOf(':');
    if (i < 0) throw new ToolError(`Malformed --header "${h}"`, 'Expected "Name: value".');
    headers[h.slice(0, i).trim()] = h.slice(i + 1).trim();
  }
  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function humanMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 90) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

/**
 * Retry only what a retry can plausibly fix.
 *
 * 5xx and network faults are transient. A 4xx is a bad request — resending the identical
 * body fails identically. A timeout against an already-generous limit means the server is
 * genuinely too slow, so retrying mostly burns budget; opt in with --retry-on-timeout.
 */
function isRetryable(kind: FailureKind, opts: GenerateOptions): boolean {
  if (kind === 'timeout') return opts.retryOnTimeout;
  return kind === 'network' || kind === 'http-5xx';
}

// Query-string credentials would otherwise be echoed into the run log — and CI logs are
// frequently archived and widely readable. Header values are never printed at all.
const SECRET_PARAMS = /^(token|key|api[-_]?key|access[-_]?token|password|secret|sig|signature|auth)$/i;

export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const name of [...url.searchParams.keys()]) {
      if (SECRET_PARAMS.test(name)) url.searchParams.set(name, '***');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const PDF_MAGIC = '%PDF-';

/**
 * Pull the PDF out of a successful response according to the configured mode.
 * Returns a Buffer on success, or an explanatory string on failure.
 *
 * The magic-number check matters: a misconfigured endpoint frequently returns 200 with an
 * HTML error page or a JSON envelope, and writing that to a .pdf turns a clear
 * configuration problem into a confusing "corrupt PDF" failure two commands later.
 */
async function extractPdf(res: Response, opts: GenerateOptions): Promise<Buffer | string> {
  let pdf: Buffer;

  switch (opts.responseMode) {
    case 'binary': {
      pdf = Buffer.from(await res.arrayBuffer());
      break;
    }

    case 'base64': {
      const text = (await res.text()).trim();
      if (!text) return 'Response body is empty';
      pdf = Buffer.from(text, 'base64');
      break;
    }

    case 'json':
    default: {
      const raw = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        const looksBinary = raw.startsWith(PDF_MAGIC);
        return (
          `Response is not JSON${looksBinary ? ' — it looks like a raw PDF; set api.responseMode to "binary"' : ''}` +
          `${looksBinary ? '' : `: ${raw.slice(0, 120)}`}`
        );
      }
      const value = dig(body, opts.responsePath);
      if (typeof value !== 'string' || !value) {
        const keys = body && typeof body === 'object' ? Object.keys(body).join(', ') : '(not an object)';
        return `Response has no string at "${opts.responsePath}". Keys: ${keys || '(none)'}`;
      }
      pdf = Buffer.from(value, 'base64');
      break;
    }
  }

  if (pdf.subarray(0, 5).toString('latin1') !== PDF_MAGIC) {
    const preview = pdf.subarray(0, 60).toString('utf8').replace(/\s+/g, ' ');
    return (
      `Decoded response is not a PDF (no ${PDF_MAGIC} header, ${pdf.length} bytes)` +
      `${pdf.length ? ` — starts with: ${preview}` : ''}`
    );
  }
  return pdf;
}

/** Live view of what is currently in flight, for the heartbeat. */
interface Progress {
  inFlight: Map<string, number>; // stem → start time
  done: number;
  total: number;
  durations: number[];
}

async function renderOne(
  payloadFile: string,
  opts: GenerateOptions,
  headers: Record<string, string>,
  progress: Progress,
): Promise<ManifestEntry> {
  const stem = path.basename(payloadFile, '.json');
  const outFile = path.join(opts.out, `${stem}.pdf`);
  const raw = fs.readFileSync(payloadFile);
  const started = Date.now();

  const base: ManifestEntry = {
    payload: path.basename(payloadFile),
    payloadSha256: sha256(raw),
    pdf: null,
    pdfSha256: null,
    bytes: null,
    httpStatus: null,
    durationMs: 0,
    attempts: 0,
    ok: false,
  };

  const finish = (entry: ManifestEntry): ManifestEntry => {
    progress.inFlight.delete(stem);
    progress.done++;
    // Only real API calls inform the ETA and the timing stats — a skipped file is a
    // sub-millisecond disk read and would drag both toward zero.
    if (entry.ok && !entry.skipped) progress.durations.push(entry.durationMs);
    return entry;
  };

  if (opts.skipExisting && fs.existsSync(outFile)) {
    const existing = fs.readFileSync(outFile);
    console.log(`  ⏭  ${stem} — exists, skipped`);
    return finish({
      ...base,
      pdf: path.basename(outFile),
      pdfSha256: sha256(existing),
      bytes: existing.length,
      durationMs: Date.now() - started,
      ok: true,
      skipped: true,
    });
  }

  // A malformed payload is a tool error, not an API failure — fail it before spending a
  // 40-second round trip discovering the server dislikes it.
  try {
    JSON.parse(raw.toString('utf8'));
  } catch (err) {
    return finish({
      ...base,
      durationMs: Date.now() - started,
      error: `Invalid JSON: ${(err as Error).message}`,
    });
  }

  progress.inFlight.set(stem, started);

  let lastError = '';
  let lastKind: FailureKind = 'network';
  let status: number | null = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
    attempts = attempt;
    const attemptStarted = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout);

    try {
      const res = await fetch(opts.api, {
        method: opts.method,
        headers,
        // GET/DELETE cannot carry a body; such an API is expected to key off the URL.
        body: opts.method === 'GET' || opts.method === 'DELETE' ? undefined : raw,
        signal: controller.signal,
      });
      status = res.status;

      if (!res.ok) {
        lastKind = res.status >= 500 ? 'http-5xx' : 'http-4xx';
        const body = (await res.text()).slice(0, 200);
        lastError = `HTTP ${res.status}: ${body}`;
        // 401/403 almost always means the auth block or a ${ENV_VAR} is wrong, and the
        // generic body rarely says so.
        if (res.status === 401 || res.status === 403) {
          lastError += ' — check api.auth / api.headers and that any ${ENV_VAR} is exported';
        }
      } else {
        const extracted = await extractPdf(res, opts);
        if (typeof extracted === 'string') {
          lastKind = 'bad-response';
          lastError = extracted;
        } else {
          fs.writeFileSync(outFile, extracted);
          const ms = Date.now() - started;
          console.log(
            `  ✓  ${stem} — ${(extracted.length / 1024).toFixed(1)}KB in ${humanMs(ms)}` +
              `${attempt > 1 ? ` (attempt ${attempt})` : ''}`,
          );
          return finish({
            ...base,
            pdf: path.basename(outFile),
            pdfSha256: sha256(extracted),
            bytes: extracted.length,
            httpStatus: status,
            durationMs: ms,
            attempts: attempt,
            ok: true,
          });
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        lastKind = 'timeout';
        lastError = `Timed out after ${humanMs(opts.timeout)}`;
      } else {
        lastKind = 'network';
        const cause = (err as { cause?: { code?: string } }).cause;
        lastError = cause?.code ? `${cause.code} — ${(err as Error).message}` : (err as Error).message;
      }
    } finally {
      clearTimeout(timer);
    }

    const canRetry = attempt <= opts.retries && isRetryable(lastKind, opts);
    if (!canRetry) break;

    // Backoff scales with the API's own latency — a 250ms pause between 40-second calls
    // accomplishes nothing.
    const wait = opts.retryBackoff * 2 ** (attempt - 1);
    console.log(
      `  ↻  ${stem} — ${lastKind} after ${humanMs(Date.now() - attemptStarted)}, ` +
        `retry ${attempt}/${opts.retries} in ${humanMs(wait)}`,
    );
    await sleep(wait);
  }

  const hint =
    lastKind === 'timeout' && !opts.retryOnTimeout
      ? ' (raise --timeout, or --retry-on-timeout to retry)'
      : '';
  console.log(`  ✗  ${stem} — ${lastError}${hint}`);

  return finish({
    ...base,
    httpStatus: status,
    durationMs: Date.now() - started,
    attempts,
    error: lastError,
  });
}

/** Run tasks with a bounded number in flight. */
async function pool(
  items: string[],
  limit: number,
  worker: (item: string) => Promise<ManifestEntry>,
): Promise<ManifestEntry[]> {
  const results: ManifestEntry[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Periodic "still alive" line. Without this a run against a slow API is silent for
 * minutes at a time, which reads as a hang and trips CI inactivity watchdogs.
 */
function startHeartbeat(progress: Progress, everyMs: number, concurrency: number) {
  if (everyMs <= 0) return () => {};

  const timer = setInterval(() => {
    if (progress.inFlight.size === 0) return;

    const now = Date.now();
    let longestStem = '';
    let longestMs = -1;
    for (const [stem, startedAt] of progress.inFlight) {
      const elapsed = now - startedAt;
      if (elapsed > longestMs) {
        longestMs = elapsed;
        longestStem = stem;
      }
    }

    const parts = [
      `${progress.inFlight.size} in flight`,
      `longest ${longestStem} ${humanMs(longestMs)}`,
      `${progress.done}/${progress.total} done`,
    ];

    // Only project an ETA once there is a real sample to project from.
    if (progress.durations.length > 0) {
      const avg = progress.durations.reduce((a, b) => a + b, 0) / progress.durations.length;
      const remaining = progress.total - progress.done;
      if (remaining > 0) {
        parts.push(`ETA ~${humanMs(Math.ceil(remaining / concurrency) * avg)}`);
      }
    }

    console.log(`  …  ${parts.join(' · ')}`);
  }, everyMs);

  // Never let the heartbeat hold the process open on its own.
  timer.unref?.();
  return () => clearInterval(timer);
}

export async function runGenerate(opts: GenerateOptions): Promise<number> {
  if (!fs.existsSync(opts.payloads)) {
    throw new ToolError(`Payload directory not found: ${opts.payloads}`);
  }

  const payloadFiles = fs
    .readdirSync(opts.payloads)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort()
    .map((f) => path.join(opts.payloads, f));

  if (payloadFiles.length === 0) {
    throw new ToolError(
      `No .json payloads in ${opts.payloads}`,
      'Generating nothing and exiting 0 would let a broken pipeline look healthy.',
    );
  }

  fs.mkdirSync(opts.out, { recursive: true });
  const headers = parseHeaders(opts.header);
  const runStarted = Date.now();

  // Echo the resolved request shape — credentials are never printed, but the header names
  // are, so "did my auth actually get applied?" is answerable from the log alone.
  const headerNames = Object.keys(headers);
  console.log(`Generating ${payloadFiles.length} document(s)`);
  console.log(`  ${opts.method.padEnd(6)}       ${redactUrl(opts.api)}`);
  console.log(`  out          ${path.resolve(opts.out)}`);
  console.log(`  headers      ${headerNames.join(', ')}`);
  console.log(
    `  response     ${opts.responseMode}${opts.responseMode === 'json' ? ` at "${opts.responsePath}"` : ''}`,
  );
  console.log(
    `  concurrency  ${opts.concurrency} · timeout ${humanMs(opts.timeout)} · ` +
      `retries ${opts.retries}${opts.retryOnTimeout ? ' (incl. timeouts)' : ''}`,
  );
  console.log('');

  const progress: Progress = {
    inFlight: new Map(),
    done: 0,
    total: payloadFiles.length,
    durations: [],
  };
  const stopHeartbeat = startHeartbeat(progress, opts.heartbeat, opts.concurrency);

  let entries: ManifestEntry[];
  try {
    if (opts.failFast) {
      entries = [];
      for (const f of payloadFiles) {
        const e = await renderOne(f, opts, headers, progress);
        entries.push(e);
        if (!e.ok) break;
      }
    } else {
      entries = await pool(payloadFiles, opts.concurrency, (f) =>
        renderOne(f, opts, headers, progress),
      );
    }
  } finally {
    stopHeartbeat();
  }

  const succeeded = entries.filter((e) => e.ok).length;
  const skipped = entries.filter((e) => e.skipped).length;
  const failed = entries.length - succeeded;
  const totalMs = Date.now() - runStarted;
  const okDurations = entries.filter((e) => e.ok && !e.skipped).map((e) => e.durationMs);

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    // Redacted — the manifest is an archived CI artifact.
    api: redactUrl(opts.api),
    payloadDir: path.resolve(opts.payloads),
    outDir: path.resolve(opts.out),
    total: payloadFiles.length,
    succeeded,
    failed,
    totalDurationMs: totalMs,
    slowestMs: okDurations.length ? Math.max(...okDurations) : null,
    averageMs: okDurations.length
      ? Math.round(okDurations.reduce((a, b) => a + b, 0) / okDurations.length)
      : null,
    entries,
  };
  const manifestFile = writeManifest(opts.out, manifest);

  console.log('');
  console.log(
    `${succeeded}/${payloadFiles.length} generated in ${humanMs(totalMs)}` +
      `${skipped ? ` (${skipped} reused from disk)` : ''}`,
  );
  if (manifest.averageMs != null) {
    console.log(
      `  ${okDurations.length} API call(s) · average ${humanMs(manifest.averageMs)} · slowest ${humanMs(manifest.slowestMs!)}`,
    );
  }
  console.log(`  manifest: ${manifestFile}`);

  if (failed > 0) {
    console.log('');
    console.log(`${failed} document(s) failed:`);
    for (const e of entries.filter((x) => !x.ok)) {
      console.log(`  ✗ ${path.basename(e.payload, '.json')} — ${e.error}`);
    }
    console.log('');
    console.log('  Re-run with --skip-existing to retry only the failures.');
  }

  // A partial generation must not look successful — the missing PDFs would otherwise
  // surface later as unmatched pairs, far from the actual cause.
  return failed > 0 ? EXIT.TOOL_ERROR : EXIT.OK;
}
