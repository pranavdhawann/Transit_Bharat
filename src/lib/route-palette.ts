/**
 * Route colour palette (spec section 3.3).
 *
 * Route colour is the primary structural device in this design, which makes
 * this file load-bearing. It replaces the Material Design hues that shipped in
 * metro-lines.json and the Tailwind defaults that shipped in BUS_PALETTE.
 *
 * onBase is derived, never authored: hand-authoring it produced four wrong
 * pairings during design.
 */
import { contrastRatio } from "./contrast";
import { THEMES } from "./tokens";

export interface ColorPair {
  light: string;
  dark: string;
}

export type Theme = "light" | "dark";

export const METRO_BASES: Record<string, ColorPair> = {
  "metro:red": { light: "#C43129", dark: "#D87772" },
  "metro:yellow": { light: "#E8B300", dark: "#F0CD57" },
  "metro:blue": { light: "#0B57A4", dark: "#5E90C3" },
  "metro:green": { light: "#1B793D", dark: "#69A77F" },
  "metro:violet": { light: "#5B2A86", dark: "#9B7CB5" },
  "metro:pink": { light: "#D65E92", dark: "#D789AB" },
  "metro:magenta": { light: "#A8206B", dark: "#C66C9D" },
  "metro:aqua": { light: "#087483", dark: "#5CA3AD" },
  "metro:orange": { light: "#E06A16", dark: "#E19561" },
  "metro:rapid": { light: "#7F6359", dark: "#AB9891" },
};

/** Lower-chroma than the metro set, so bus reads as a different class. */
export const BUS_BASES: ColorPair[] = [
  { light: "#4A5D73", dark: "#8894A3" },
  { light: "#7A5C3E", dark: "#A79380" },
  { light: "#3E6B5E", dark: "#809D95" },
  { light: "#6E4A63", dark: "#9F8898" },
  { light: "#5C6438", dark: "#93997C" },
];

/** Whichever of ink or paper reads better on this bar. */
export function resolveOnBase(base: string, theme: Theme): string {
  const { ink, paper } = THEMES[theme];
  return contrastRatio(base, ink) >= contrastRatio(base, paper) ? ink : paper;
}

/**
 * A bar must be visible against the ground, which is separate from its label
 * being readable. Below 3:1 it gets an ink keyline rather than being darkened
 * until it clears — darkening yellow to clear 3:1 turns it to mustard and
 * destroys the line identity.
 */
export function needsKeyline(base: string, theme: Theme): boolean {
  return contrastRatio(base, THEMES[theme].paper) < 3;
}
