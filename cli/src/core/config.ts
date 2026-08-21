// pdfsuite.config.json — connection settings that belong in version control rather than
// in a Jenkins job's command line.
//
// The split is deliberate:
//   config file  →  HOW to reach the API (url, headers, timeouts, retries) — stable,
//                   reviewed, changes rarely
//   CLI flags    →  WHAT to process this run (payload dir, out dir, report dir) — varies
//                   per invocation
//
// Secrets never go in the file. String values support ${ENV_VAR} expansion, so the
// committed config can reference a token that only exists in the CI environment.

import fs from 'node:fs';
import path from 'node:path';

import { ToolError } from './exit.js';

export const CONFIG_FILENAME = 'pdfsuite.config.json';

/**
 * How the render API expects to be called and what it sends back.
 *
 * `auth` is a convenience over `headers`/`query` — anything it produces could be written
 * by hand, but `basic` in particular requires base64-encoding credentials, which is
 * exactly the kind of thing that ends up wrong in a committed file.
 */
export type AuthConfig =
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'header'; name: string; value: string }
  | { type: 'query'; name: string; value: string };

/**
 * How the PDF arrives in the response.
 *   json    — JSON body, base64 string at `responsePath` (default)
 *   binary  — the body IS the PDF (Content-Type: application/pdf)
 *   base64  — the whole body is a bare base64 string, no JSON wrapper
 */
export type ResponseMode = 'json' | 'binary' | 'base64';

export interface ApiConfig {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  /** Appended to the URL's query string — for APIs that key off a query param. */
  query?: Record<string, string>;
  auth?: AuthConfig;
  responseMode?: ResponseMode;
  responsePath?: string;
  timeout?: number;
  retries?: number;
  retryOnTimeout?: boolean;
  retryBackoff?: number;
  concurrency?: number;
  heartbeat?: number;
}

/**
 * Optional default paths. Flags still override, and paths that vary per run are better
 * passed as flags — but a fixed output directory is reasonable to pin here.
 */
export interface PathsConfig {
  payloads?: string;
  out?: string;
  reference?: string;
  candidate?: string;
  pairs?: string;
  report?: string;
}

export interface CompareConfig {
  format?: string;
  pixelThreshold?: number;
  includeAA?: boolean;
  failOn?: 'any' | 'none';
}

export interface PdfSuiteConfig {
  api?: ApiConfig;
  compare?: CompareConfig;
  paths?: PathsConfig;
}

export interface LoadedConfig {
  config: PdfSuiteConfig;
  /** Absolute path the config came from, or null when running on defaults. */
  source: string | null;
}

/**
 * Expand ${VAR} against the environment.
 *
 * A missing variable is a hard error rather than an empty string: silently sending
 * `Authorization: Bearer ` (or the literal `${TOKEN}`) produces a 401 from the API and a
 * confusing hunt, far from the actual cause.
 */
function expandEnv(value: string, where: string): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    const found = process.env[name];
    if (found === undefined) {
      throw new ToolError(
        `${where} references \${${name}}, which is not set in the environment.`,
        `Export ${name} before running, or replace the reference with a literal value.`,
      );
    }
    return found;
  });
}

/**
 * Recursively expand ${ENV_VAR} in every string in the config.
 *
 * `$`-prefixed keys ($schema, $comment) are metadata, not settings — they are left alone
 * so documentation is free to mention ${ENV_VAR} literally without the loader trying to
 * resolve it.
 */
function expandDeep(node: unknown, where: string): unknown {
  if (typeof node === 'string') return expandEnv(node, where);
  if (Array.isArray(node)) return node.map((v, i) => expandDeep(v, `${where}[${i}]`));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = k.startsWith('$') ? v : expandDeep(v, `${where}.${k}`);
    }
    return out;
  }
  return node;
}

/**
 * Walk up from `startDir` looking for the config file, the way git and eslint do — so the
 * command works from anywhere inside the project, not just its root.
 */
export function discoverConfig(startDir = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // hit the filesystem root
    dir = parent;
  }
}

// `$`-prefixed keys are metadata ($schema, $comment, and any $comment_* the author adds),
// consistent with how expandDeep treats them. Everything else must be a real setting.
const KNOWN_KEYS: Record<string, Set<string>> = {
  '': new Set(['api', 'compare', 'paths']),
  api: new Set([
    'url', 'method', 'headers', 'query', 'auth',
    'responseMode', 'responsePath',
    'timeout', 'retries', 'retryOnTimeout', 'retryBackoff',
    'concurrency', 'heartbeat',
  ]),
  compare: new Set(['format', 'pixelThreshold', 'includeAA', 'failOn']),
  paths: new Set(['payloads', 'out', 'reference', 'candidate', 'pairs', 'report']),
};

/**
 * Reject unknown keys at every level, not just the top.
 *
 * A typo like `api.timout` is otherwise completely silent — the setting is ignored, the
 * built-in default applies, and the run misbehaves in a way that points nowhere near the
 * config file.
 */
function validateKeys(node: unknown, section: string, file: string): void {
  const known = KNOWN_KEYS[section];
  if (!known || !node || typeof node !== 'object' || Array.isArray(node)) return;

  const unknown = Object.keys(node as Record<string, unknown>).filter(
    (k) => !k.startsWith('$') && !known.has(k),
  );
  if (unknown.length) {
    const where = section ? `"${section}"` : 'top level';
    throw new ToolError(
      `Unknown key(s) at ${where} in ${file}: ${unknown.join(', ')}`,
      `Supported there: ${[...known].join(', ')}.`,
    );
  }

  for (const child of ['api', 'compare', 'paths']) {
    if (section === '' && child in (node as Record<string, unknown>)) {
      validateKeys((node as Record<string, unknown>)[child], child, file);
    }
  }
}

export function loadConfig(explicitPath: string | undefined, useConfig: boolean): LoadedConfig {
  if (!useConfig) return { config: {}, source: null };

  const file = explicitPath ? path.resolve(explicitPath) : discoverConfig();

  if (!file) return { config: {}, source: null };

  // An explicitly named config that does not exist is an error; a missing discovered one
  // just means "no config", which is fine.
  if (!fs.existsSync(file)) {
    throw new ToolError(`Config file not found: ${file}`);
  }

  let parsed: PdfSuiteConfig;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as PdfSuiteConfig;
  } catch (err) {
    throw new ToolError(`Could not parse ${file}: ${(err as Error).message}`);
  }

  validateKeys(parsed, '', path.basename(file));

  const config = expandDeep(parsed, path.basename(file)) as PdfSuiteConfig;
  return { config, source: file };
}

/**
 * Precedence: an explicitly-passed CLI flag always wins; otherwise the config value; then
 * the flag's built-in default.
 *
 * `source` distinguishes "the user typed --timeout 5000" from "commander filled in the
 * default", which is the whole reason a config value can override the latter but not the
 * former.
 */
export function pick<T>(source: string | undefined, cliValue: T, configValue: T | undefined): T {
  if (source && source !== 'default') return cliValue;
  return configValue !== undefined ? configValue : cliValue;
}

/**
 * Turn an `auth` block into the header or query parameter it represents.
 *
 * Kept separate from `headers` so the common cases are declarative and hard to get wrong —
 * `basic` in particular needs base64-encoded credentials, which nobody should be
 * hand-rolling into a committed config file.
 */
export function applyAuth(auth: AuthConfig | undefined): {
  header?: [string, string];
  query?: [string, string];
} {
  if (!auth) return {};

  switch (auth.type) {
    case 'bearer':
      if (!auth.token) throw new ToolError('auth.type "bearer" requires "token".');
      return { header: ['Authorization', `Bearer ${auth.token}`] };

    case 'basic': {
      if (!auth.username || auth.password === undefined) {
        throw new ToolError('auth.type "basic" requires "username" and "password".');
      }
      const encoded = Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64');
      return { header: ['Authorization', `Basic ${encoded}`] };
    }

    case 'header':
      if (!auth.name || !auth.value) {
        throw new ToolError('auth.type "header" requires "name" and "value".');
      }
      return { header: [auth.name, auth.value] };

    case 'query':
      if (!auth.name || !auth.value) {
        throw new ToolError('auth.type "query" requires "name" and "value".');
      }
      return { query: [auth.name, auth.value] };

    default:
      throw new ToolError(
        `Unknown auth.type "${(auth as { type: string }).type}".`,
        'Supported: bearer, basic, header, query.',
      );
  }
}

/**
 * Config headers merged with any -H flags and the auth block.
 * Precedence: CLI -H  >  auth  >  config headers.
 */
export function mergeHeaders(
  configHeaders: Record<string, string> | undefined,
  cliHeaders: string[],
  auth?: AuthConfig,
): string[] {
  const merged = new Map<string, string>();

  for (const [name, value] of Object.entries(configHeaders ?? {})) {
    merged.set(name.toLowerCase(), `${name}: ${value}`);
  }

  const applied = applyAuth(auth);
  if (applied.header) {
    const [name, value] = applied.header;
    merged.set(name.toLowerCase(), `${name}: ${value}`);
  }

  for (const raw of cliHeaders) {
    const i = raw.indexOf(':');
    if (i < 0) throw new ToolError(`Malformed --header "${raw}"`, 'Expected "Name: value".');
    merged.set(raw.slice(0, i).trim().toLowerCase(), raw);
  }

  return [...merged.values()];
}

/**
 * Final request URL: the configured url plus any `query` entries and a query-type auth
 * parameter. Built through URL so existing query strings merge correctly rather than
 * being clobbered by naive string concatenation.
 */
export function buildUrl(
  base: string,
  query: Record<string, string> | undefined,
  auth?: AuthConfig,
): string {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ToolError(
      `Invalid API url: ${base}`,
      'Include the scheme, e.g. https://render.example.com/v1/documents',
    );
  }

  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  const applied = applyAuth(auth);
  if (applied.query) url.searchParams.set(applied.query[0], applied.query[1]);

  return url.toString();
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function normalizeMethod(method: string | undefined): string {
  const m = (method ?? 'POST').toUpperCase();
  if (!HTTP_METHODS.has(m)) {
    throw new ToolError(`Unsupported api.method "${method}".`, `Supported: ${[...HTTP_METHODS].join(', ')}.`);
  }
  return m;
}

const RESPONSE_MODES = new Set<ResponseMode>(['json', 'binary', 'base64']);

export function normalizeResponseMode(mode: string | undefined): ResponseMode {
  const m = (mode ?? 'json') as ResponseMode;
  if (!RESPONSE_MODES.has(m)) {
    throw new ToolError(
      `Unsupported api.responseMode "${mode}".`,
      'Supported: json (base64 at responsePath), binary (body is the PDF), base64 (body is a bare base64 string).',
    );
  }
  return m;
}
