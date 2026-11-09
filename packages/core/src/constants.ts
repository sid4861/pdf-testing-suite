/**
 * Every default and hard limit the tool tunes by, in one place.
 *
 * Zero dependencies on purpose: the app imports it, and so does the CLI through
 * its engine seam, so anything imported here would be dragged into a Node
 * bundle as well. Plain values only.
 *
 * Any new tunable anywhere in the project is added here rather than written as
 * a literal beside the code that reads it — the same idea used to have three
 * different values in three files.
 *
 * Spec: [SR-CONSTANTS](../../records/0103_CONSTANTS.md) decisions 1, 2, 4, 5.
 *
 * ## What is NOT here yet
 *
 * `DEFAULT_TOL`, `DEFAULT_ANCHOR_WITHIN` and a third copy of `BASE_SCALE` still
 * live in `src/features/spec/specCheck.ts`. That folder is sealed — it is
 * developed on another machine and this repository holds a stale mirror of it
 * (`src/features/spec/README.md`), and the boundary check forbids it importing
 * from `src/services/`. The tolerances below are therefore declared here, as the
 * record requires, but the spec checker does not read them yet. W-32's ruling
 * decides how that is resolved.
 */

// ── rendering ─────────────────────────────────────────────────────────

/** Render scale for comparison: ~144 DPI, so 1pt = 2px. */
export const BASE_SCALE = 2;

/** Cap on the target box's width in pixels, whatever the page size. */
export const MAX_PAGE_WIDTH = 1600;

// ── what counts as a difference ───────────────────────────────────────

/**
 * The page verdict, shared by the app and the CLI.
 *
 * Not tolerances to tune: a page fails if it differs at all. These are the
 * floors below which a measurement is noise from rendering rather than a change
 * in the document.
 */
export const PAGE_VERDICT = {
  /** Text identical below this ratio means wording changed. */
  contentMatchFloor: 0.9999,
  /** Pixel differences above this share are a real visual change. */
  pixelRatioFloor: 0.002,
  /** Text shifted further than this, in pixels, has moved. */
  maxOffsetPx: 2,
} as const;

/**
 * When a matched text run is called "moved", in inches.
 *
 * Deliberately *not* the same as `PAGE_VERDICT.maxOffsetPx`, which is the page
 * verdict. This one decides whether a change is labelled a move in the change
 * list and the report. W-27 unifies the two into `pageVerdict`; until then they
 * sit side by side so the difference is visible rather than buried.
 */
export const MOVED_OFFSET_IN = 0.02;

// ── spec tolerances ───────────────────────────────────────────────────

/**
 * How far an element may sit from where the spec puts it before it fails.
 *
 * Declared here per SR-CONSTANTS decision 2. See the note at the top of this
 * file: the spec checker is sealed and still carries its own copy.
 */
export const SPEC_TOLERANCE = {
  /** Top and left, in spec units (inches by default). */
  position: 0.06,
  /** Width and height, in spec units. */
  size: 0.06,
  /** Between consecutive baselines, in spec units. */
  spacing: 0.03,
  /** In points, not spec units — type size is always points. */
  fontSize: 2,
} as const;

/** Colour difference that counts as recoloured, as CIEDE2000 ΔE. */
export const COLOUR_DELTA_E = 2.0;

/** How far from its anchor text an element may be found, in spec units. */
export const ANCHOR_WITHIN = 2;

// ── hard limits ───────────────────────────────────────────────────────

/** Largest upload accepted, in bytes. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Largest total size after unzipping a bundle, in bytes. */
export const MAX_UNZIPPED_BYTES = 500 * 1024 * 1024;

/** How deep a relative reference may chain before it is refused. */
export const MAX_RELATIVE_DEPTH = 8;

/**
 * Scan every page on load up to this many, so the summary and the changed-pages
 * strip have data without an explicit click.
 */
export const AUTO_SCAN_MAX_PAGES = 60;
