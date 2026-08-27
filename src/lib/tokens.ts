/**
 * Design tokens (spec section 3.1, 3.2).
 *
 * Every value here was computed against the contrast targets in section 9
 * before being written down, and tests/contrast.test.ts re-derives those
 * guarantees on every run. globals.css mirrors this file; the drift guard in
 * tests/design-rules.test.ts keeps the two in step.
 */

export interface ThemeTokens {
  ink: string;
  ink2: string;
  ink3: string;
  paper: string;
  surface: string;
  rule: string;
  tickEmpty: string;
  saffron: string;
  live: string;
  stale: string;
}

export const THEMES: Record<"light" | "dark", ThemeTokens> = {
  light: {
    ink: "#131A22",
    ink2: "#38434F",
    ink3: "#606B76",
    paper: "#F5F3EF",
    surface: "#FFFFFF",
    rule: "#D9D5CC",
    tickEmpty: "#D9D5CC",
    saffron: "#DA601A",
    live: "#0C7946",
    stale: "#975A00",
  },
  dark: {
    ink: "#EDEAE3",
    ink2: "#A8B0B8",
    ink3: "#848E98",
    paper: "#10151A",
    surface: "#182029",
    rule: "#2A343E",
    tickEmpty: "#2A343E",
    saffron: "#FF8A3D",
    live: "#28A96A",
    stale: "#E09A20",
  },
};
