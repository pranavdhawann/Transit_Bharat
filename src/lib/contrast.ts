/**
 * WCAG 2.1 contrast arithmetic over 6-digit sRGB hex.
 *
 * Lives in src/lib rather than a test helper because the design tokens and the
 * route palette are both product data, and their contrast guarantees are a
 * product requirement (spec section 9) rather than a test convenience.
 */

function channelToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return (
    0.2126 * channelToLinear((n >> 16) & 0xff) +
    0.7152 * channelToLinear((n >> 8) & 0xff) +
    0.0722 * channelToLinear(n & 0xff)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
