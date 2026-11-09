/**
 * Feature flags — **configuration**, not a build-time edit.
 *
 * They used to be read here from `virtual:feature-flags`, a module
 * `vite.config.ts` synthesises from `flag.env` at the repository root. That
 * worked while the screens *were* the app. In a package it cannot: a team
 * installing `@pdfsuite/ui` has no such plugin, and a package that needs one
 * is a package that does not install.
 *
 * So **W-33** turns the question round. The package owns the flag list and
 * the defaults; the host hands in whatever it wants changed, through
 * `<PdfSuiteApp config={{ flags }} />`. This repository's shell keeps
 * `flag.env` by reading the virtual module itself and parsing it with
 * `parseFlagEnv` below — the file still works exactly as it did, but it is
 * now *this app's* configuration rather than the library's.
 *
 * Why `flags` is still a module object rather than a prop threaded through
 * every component: six modules read it, two of them while the module is
 * evaluating, and threading a context through all of them is a refactor with
 * no behaviour to show for it. `configureFlags` is called once, at the top of
 * `<PdfSuiteApp>`'s render, before any child renders. The *contract* is the
 * prop; this is how it is applied.
 */

export interface FeatureFlags {
  /** Click a page in Content / Layout side-by-side to pin a comment. */
  annotations: boolean;
  /** "ZIP bundle" entry in the Export menu: every report plus annotated PDFs. */
  exportZip: boolean;
  /** The "Batch compare" workspace tab. */
  batchCompare: boolean;
  /** The in-page side-by-side view inside Overlapping. Off means it opens on Diff. */
  layoutSideBySide: boolean;
  /** "JSON data" and "CSV spreadsheet" entries in every Export menu. */
  exportJsonCsv: boolean;
  /** "Markdown fix-list": the Export entry and the report viewer tab. */
  exportMarkdown: boolean;
}

/**
 * Defaults are all ON: a missing or misspelled key should not quietly remove
 * a feature. Switching something off is a thing somebody has to say.
 */
export const DEFAULT_FLAGS: FeatureFlags = {
  annotations: true,
  exportZip: true,
  batchCompare: true,
  layoutSideBySide: true,
  exportJsonCsv: true,
  exportMarkdown: true,
};

/** The `flag.env` key each flag is spelled with, for a host that uses one. */
export const FLAG_ENV_KEYS: Record<keyof FeatureFlags, string> = {
  annotations: 'FEATURE_ANNOTATIONS',
  exportZip: 'FEATURE_EXPORT_ZIP',
  batchCompare: 'FEATURE_BATCH_COMPARE',
  layoutSideBySide: 'FEATURE_LAYOUT_SIDE_BY_SIDE',
  exportJsonCsv: 'FEATURE_EXPORT_JSON_CSV',
  exportMarkdown: 'FEATURE_EXPORT_MARKDOWN',
};

const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled']);
const FALSY = new Set(['false', '0', 'off', 'no', 'disabled']);

/**
 * `{ FEATURE_EXPORT_ZIP: "off" }` → `{ exportZip: false }`.
 *
 * Exported so a host that keeps its flags in an env file does not have to
 * reimplement the spelling, and gets the same treatment of a typo: an
 * unrecognised value is a mistake, not an intent to disable, so it warns and
 * keeps the default rather than quietly dropping a feature.
 */
export function parseFlagEnv(raw: Record<string, string | undefined>): Partial<FeatureFlags> {
  const out: Partial<FeatureFlags> = {};
  for (const key of Object.keys(FLAG_ENV_KEYS) as (keyof FeatureFlags)[]) {
    const value = raw[FLAG_ENV_KEYS[key]];
    if (value == null || value === '') continue;
    const v = value.trim().toLowerCase();
    if (TRUTHY.has(v)) out[key] = true;
    else if (FALSY.has(v)) out[key] = false;
    else {
      console.warn(
        `[flags] ${FLAG_ENV_KEYS[key]}="${value}" is not a boolean; `
        + `using default ${DEFAULT_FLAGS[key]}`,
      );
    }
  }
  return out;
}

/**
 * The flags in force. Read it; do not hold a copy across a configure.
 *
 * Mutated in place by `configureFlags` so that a module which read it at
 * import time is not left holding a stale object.
 */
export const flags: FeatureFlags = { ...DEFAULT_FLAGS };

/** Apply a host's configuration. Anything not named keeps its default. */
export function configureFlags(partial?: Partial<FeatureFlags>): void {
  Object.assign(flags, DEFAULT_FLAGS, partial ?? {});
}
