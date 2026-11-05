/**
 * Reading what a Value cell says (SR-SPEC-INTAKE decisions 9 and 12).
 *
 * The line this file holds: **a spelling is not a guess, but an approximation
 * is.** `0,5`, `.5`, `3/8` and `2 1/8` are all the same number written by
 * different people in different places, and reading them costs nothing. `~10`
 * is a different thing entirely — it says the author did not know, and turning
 * it into `10` would invent a precision the spec never had. That one is an
 * error with a way out: state the number and a Tolerance.
 */

/** What a Value cell turned out to hold. */
export type ParsedValue =
  | { kind: 'number'; value: number }
  /** A band: the tolerance is the range itself (decision 9). */
  | { kind: 'range'; low: number; high: number }
  /** Resolvable against something else on the sheet (decision 12). */
  | { kind: 'relative'; phrase: string }
  | { kind: 'text'; value: string }
  | { kind: 'empty' }
  | { kind: 'error'; code: ValueErrorCode; message: string };

export type ValueErrorCode =
  | 'approximate-value'
  | 'number-expected'
  | 'range-reversed';

/** Words that say "about". Any of them in a numeric cell is an error. */
const APPROXIMATE = /(^|\s)(~|about|approx\.?|approximately|circa|ca\.|roughly|around)(\s|$)|~\s*\d/i;

/** The three ways a range is written, with a number on both sides. */
const RANGE = /^\s*(-?[\d.,/\s]+?)\s*(?:–|—|-|\bto\b)\s*(-?[\d.,/\s]+?)\s*$/i;

/**
 * Relative phrases decision 12 resolves. Matched whole, never by substring:
 * "centred in the container" is a phrase, "centre" inside a wording is not.
 */
const RELATIVE =
  /^(centred|centered|full width|full height|same as above|same as page \d+|from (left|right|top|bottom) of container|\d*\.?\d+\s*% of (width|height))$/i;

/**
 * One number, however it was spelled.
 *
 * Handles a comma decimal (`0,5`), a leading dot (`.5`), a plain fraction
 * (`3/8`) and a mixed number (`2 1/8`). Returns null for anything else — this
 * never strips words to find a number inside, because "14 pt" and "~10" are
 * different problems with different messages.
 */
export function parseNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // A mixed number: whole part, then a fraction.
  const mixed = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const frac = Number(mixed[2]) / Number(mixed[3]);
    if (!Number.isFinite(frac)) return null;
    return whole < 0 ? whole - frac : whole + frac;
  }

  const frac = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const n = Number(frac[1]) / Number(frac[2]);
    return Number.isFinite(n) ? n : null;
  }

  // A comma is a decimal separator when it is followed by one or two digits
  // and nothing else; otherwise it groups thousands.
  const normalised = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)
    ? s.replace(/,/g, '')
    : s.replace(/,(\d{1,2})$/, '.$1');

  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalised)) return null;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read a Value cell for a parameter that expects a number.
 *
 * `hasTolerance` is whether the row also states one: a range *is* a tolerance,
 * so having both means the row says two different things about the same
 * measurement and there is no honest way to pick one (decision 9).
 */
export function parseNumericValue(raw: string, hasTolerance: boolean): ParsedValue {
  const s = raw.trim();
  if (!s) return { kind: 'empty' };

  if (APPROXIMATE.test(s)) {
    return {
      kind: 'error',
      code: 'approximate-value',
      message: `“${s}” is approximate. State the number and a Tolerance instead — a check cannot be run on “about”.`,
    };
  }

  const range = s.match(RANGE);
  if (range) {
    const low = parseNumber(range[1]);
    const high = parseNumber(range[2]);
    if (low != null && high != null) {
      if (hasTolerance) {
        return {
          kind: 'error',
          code: 'number-expected',
          message: `This row gives a range (${s}) and a Tolerance. A range is already the tolerance — give one or the other.`,
        };
      }
      if (low > high) {
        return {
          kind: 'error',
          code: 'range-reversed',
          message: `The range “${s}” runs backwards; its first number must be the smaller one.`,
        };
      }
      return { kind: 'range', low, high };
    }
  }

  const n = parseNumber(s);
  if (n != null) return { kind: 'number', value: n };

  if (RELATIVE.test(s)) return { kind: 'relative', phrase: s };

  return {
    kind: 'error',
    code: 'number-expected',
    message: `A number is needed here; the cell reads “${s}”.`,
  };
}

/** A range's midpoint and half-width, which is how a band becomes a tolerance. */
export const bandOf = (low: number, high: number) => ({
  value: (low + high) / 2,
  tolerance: (high - low) / 2,
});

export const isRelative = (raw: string) => RELATIVE.test(raw.trim());
