/**
 * Comparing a font name in a spec with a font name in a PDF
 * (SR-SPEC-CHECK decision 7).
 *
 * The same typeface is written a dozen ways. A PDF carries `BCDEEE+Roboto-Light`
 * because the subset prefix is random per file; a workbook says "Roboto Light"
 * because that is what the font menu shows. Neither is wrong, and a checker that
 * reports them as different has found nothing except its own literal-mindedness.
 *
 * So the family and the style are separated and normalised, and only then
 * compared. What is *not* normalised away: a genuinely different family, and a
 * genuinely different style. Those are the findings this exists to surface.
 */

/** Weight words as numbers, so "Semibold" and 600 are the same answer. */
const WEIGHTS: [RegExp, number][] = [
  [/\b(thin|hairline)\b/i, 100],
  [/\b(extra ?light|ultra ?light)\b/i, 200],
  [/\blight\b/i, 300],
  [/\b(regular|normal|book|roman)\b/i, 400],
  [/\bmedium\b/i, 500],
  [/\b(semi ?bold|demi ?bold)\b/i, 600],
  [/\bbold\b/i, 700],
  [/\b(extra ?bold|ultra ?bold)\b/i, 800],
  [/\b(black|heavy)\b/i, 900],
];

/** Style words, stripped from the family before it is compared. */
const STYLE_WORDS =
  /\b(thin|hairline|extralight|ultralight|extra|ultra|light|regular|normal|book|roman|medium|semibold|demibold|semi|demi|bold|black|heavy|italic|oblique|condensed|narrow|wide|expanded|mt|ms|ps)\b/gi;

export interface FontName {
  /** The family alone, lower-cased and stripped of punctuation: `roboto`. */
  family: string;
  /** 100–900, or null when the name says nothing about weight. */
  weight: number | null;
  italic: boolean;
  /** The name as it was given, for reporting. */
  raw: string;
}

/**
 * Pull a font name apart.
 *
 * `BCDEEE+Roboto-Light` → family `roboto`, weight 300. The subset prefix is
 * exactly six capitals and a `+`, which is what the PDF specification says, so
 * stripping it is reading the format rather than guessing.
 */
export function parseFontName(raw: string): FontName {
  const noSubset = raw.replace(/^[A-Z]{6}\+/, '');

  // Split the camel/hyphen/underscore runs into words so "RobotoLight",
  // "Roboto-Light" and "Roboto Light" all become the same two words.
  const spaced = noSubset
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let weight: number | null = null;
  for (const [re, n] of WEIGHTS) {
    if (re.test(spaced)) {
      weight = n;
      break;
    }
  }

  const italic = /\b(italic|oblique)\b/i.test(spaced);

  const family = spaced
    .replace(STYLE_WORDS, ' ')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();

  return { family, weight, italic, raw };
}

/** Two families match when their normalised forms are identical. */
export const sameFamily = (a: FontName, b: FontName) =>
  a.family.length > 0 && a.family === b.family;

/**
 * How far apart two weights are, in steps of 100.
 *
 * Decision 7 makes a *neighbouring* weight a warning rather than a failure:
 * Regular against Medium is usually a substituted font or a rounding in the
 * writer, not a template that is wrong. Two steps or more is a different
 * typeface weight and fails.
 */
export function weightDistance(a: FontName, b: FontName): number | null {
  // An unstated weight is Regular — that is what a bare family name means.
  const wa = a.weight ?? 400;
  const wb = b.weight ?? 400;
  return Math.abs(wa - wb) / 100;
}

export type FontVerdict = 'match' | 'near-weight' | 'wrong-weight' | 'wrong-style' | 'wrong-family';

/**
 * Compare the font a spec asks for with the font the PDF used.
 *
 * `wanted` is what the workbook wrote, which may be only a family ("Helvetica")
 * with the weight and slant stated in their own rows. `bold` and `italic` carry
 * those rows when they exist.
 */
export function compareFont(
  wantedRaw: string,
  actualRaw: string,
  opts: { bold?: boolean; italic?: boolean } = {},
): { verdict: FontVerdict; wanted: FontName; actual: FontName; steps: number | null } {
  const wanted = parseFontName(wantedRaw);
  const actual = parseFontName(actualRaw);

  // An explicit Bold / Italic row beats whatever the family string implied.
  if (opts.bold !== undefined) wanted.weight = opts.bold ? 700 : (wanted.weight ?? 400);
  if (opts.italic !== undefined) wanted.italic = opts.italic;

  const steps = weightDistance(wanted, actual);

  if (!sameFamily(wanted, actual)) {
    return { verdict: 'wrong-family', wanted, actual, steps };
  }
  if (wanted.italic !== actual.italic) {
    return { verdict: 'wrong-style', wanted, actual, steps };
  }
  if (steps === 0) return { verdict: 'match', wanted, actual, steps };
  if (steps === 1) return { verdict: 'near-weight', wanted, actual, steps };
  return { verdict: 'wrong-weight', wanted, actual, steps };
}

/** How a font reads in a report: `Helvetica Bold` rather than `Helvetica-Bold`. */
export function describeFont(f: FontName): string {
  const weight = f.weight == null || f.weight === 400 ? '' : ` ${f.weight}`;
  const slant = f.italic ? ' italic' : '';
  return `${f.raw.replace(/^[A-Z]{6}\+/, '')}${weight || slant ? ' —' : ''}${weight}${slant}`;
}
