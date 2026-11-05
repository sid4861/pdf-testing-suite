/**
 * Comparing colours the way an eye does (SR-SPEC-CHECK decision 8).
 *
 * `#0B3C5D` against `#0B3C5E` is a different number and the same colour; two
 * blues a reviewer would call obviously different can be closer in RGB than
 * two greys nobody could tell apart. Comparing the digits therefore reports
 * things no one can see and misses things everyone can.
 *
 * CIEDE2000 is the standard answer: a perceptual distance where roughly 1.0 is
 * the smallest difference a person notices. The threshold lives in
 * SR-CONSTANTS, and the **actual** colour is always reported beside the
 * expected one, because a ΔE on its own tells a reviewer nothing they can act
 * on.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#0B3C5D`, `0B3C5D` or `#abc` → RGB 0–255, or null if it is not a colour. */
export function parseHex(raw: string): Rgb | null {
  const s = raw.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(s)) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }
  return null;
}

export const toHex = (c: Rgb) =>
  '#' + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase()).join('');

/** Grayscale, as PDF writes it: one component, 0–1. */
export const grayToRgb = (g: number): Rgb => ({ r: g * 255, g: g * 255, b: g * 255 });

/**
 * CMYK to RGB, the naive conversion.
 *
 * Without the document's ICC profile this is an approximation, and a print
 * workflow's own conversion will differ. That is why decision 8 says to report
 * the actual colour: a reviewer looking at a ΔE of 3 on a CMYK page needs to be
 * able to see the two values and judge whether the profile explains it.
 */
export const cmykToRgb = (c: number, m: number, y: number, k: number): Rgb => ({
  r: 255 * (1 - Math.min(1, c + k)),
  g: 255 * (1 - Math.min(1, m + k)),
  b: 255 * (1 - Math.min(1, y + k)),
});

// ── CIELAB ────────────────────────────────────────────────────────────

/** sRGB → CIELAB, through XYZ with the D65 white point. */
export function rgbToLab({ r, g, b }: Rgb): [number, number, number] {
  const lin = (v: number) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);

  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * CIEDE2000, the full formula.
 *
 * Written out rather than approximated because the whole point of using it is
 * that the cheap approximations (plain Euclidean RGB, or CIE76) are wrong in
 * exactly the region that matters — near-identical colours, where this check
 * spends all its time.
 */
export function deltaE2000(a: Rgb, b: Rgb): number {
  const [L1, a1, b1] = rgbToLab(a);
  const [L2, a2, b2] = rgbToLab(b);

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = C1p === 0 ? 0 : (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = C2p === 0 ? 0 : (deg(Math.atan2(b2, a2p)) + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  return Math.sqrt(
    (dLp / (kL * Sl)) ** 2 +
      (dCp / (kC * Sc)) ** 2 +
      (dHp / (kH * Sh)) ** 2 +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

/** Whether two colours are the same to a reader, and by how much they differ. */
export function compareColour(
  expected: string,
  actual: Rgb,
  threshold: number,
): { same: boolean; deltaE: number; expectedRgb: Rgb; actualHex: string } | null {
  const want = parseHex(expected);
  if (!want) return null;
  const deltaE = deltaE2000(want, actual);
  return {
    same: deltaE <= threshold,
    deltaE,
    expectedRgb: want,
    actualHex: toHex(actual),
  };
}
