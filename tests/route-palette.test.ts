import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import {
  BUS_BASES,
  darkFor,
  METRO_BASES,
  needsKeyline,
  resolveOnBase,
} from "@/lib/route-palette";
import {
  CURATED_BUS_ROUTES,
  CURATED_METRO_LINES,
  METRO_LINES,
} from "@/data/network";

const THEME_NAMES = ["light", "dark"] as const;
const BANNED = ["#2563eb", "#0d9488", "#b45309", "#7c3aed", "#be185d"];

describe("route palette", () => {
  it("covers every metro line in the network data", () => {
    for (const line of METRO_LINES) {
      expect(METRO_BASES, `missing palette for ${line.id}`).toHaveProperty(
        line.id,
      );
    }
  });

  it("uses none of the banned framework default hues", () => {
    const all = [
      ...Object.values(METRO_BASES),
      ...BUS_BASES,
    ].flatMap((p) => [p.light.toLowerCase(), p.dark.toLowerCase()]);
    for (const banned of BANNED) expect(all).not.toContain(banned);
  });

  it("keeps the degraded-data fallback routes on palette colours", () => {
    const paletteColors = new Set(
      [...Object.values(METRO_BASES), ...BUS_BASES].flatMap((p) => [
        p.light.toLowerCase(),
        p.dark.toLowerCase(),
      ]),
    );
    for (const line of CURATED_METRO_LINES) {
      expect(
        paletteColors.has(line.color.toLowerCase()),
        `${line.id} fallback colour ${line.color} is not in the palette`,
      ).toBe(true);
    }
    for (const route of CURATED_BUS_ROUTES) {
      expect(
        paletteColors.has(route.color.toLowerCase()),
        `${route.id} fallback colour ${route.color} is not in the palette`,
      ).toBe(true);
    }
  });
  it("darkFor returns the palette's own dark counterpart for every light base, not a passthrough", () => {
    for (const [id, pair] of Object.entries(METRO_BASES)) {
      expect(darkFor(pair.light), `${id} light -> dark`).toBe(pair.dark);
    }
    BUS_BASES.forEach((pair, i) => {
      expect(darkFor(pair.light), `bus:${i + 1} light -> dark`).toBe(pair.dark);
    });
  });

  it("darkFor is case-insensitive on the lookup", () => {
    const [, examplePair] = Object.entries(METRO_BASES)[0];
    expect(darkFor(examplePair.light.toUpperCase())).toBe(examplePair.dark);
  });

  it("darkFor returns the input unchanged for a colour outside the palette", () => {
    expect(darkFor("#606B76")).toBe("#606B76");
    expect(darkFor("#ABCDEF")).toBe("#ABCDEF");
  });
});

describe.each(THEME_NAMES)("route palette in %s theme", (theme) => {
  const bases = [
    ...Object.entries(METRO_BASES).map(([id, p]) => [id, p[theme]] as const),
    ...BUS_BASES.map((p, i) => [`bus:${i + 1}`, p[theme]] as const),
  ];

  it("gives every base a label colour clearing 4.5:1", () => {
    for (const [id, base] of bases) {
      const onBase = resolveOnBase(base, theme);
      expect(contrastRatio(base, onBase), `${id} label`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("needs a keyline for exactly the expected lines", () => {
    const flagged = bases
      .filter(([, base]) => needsKeyline(base, theme))
      .map(([id]) => id)
      .sort();
    const expected = theme === "light" ? ["metro:yellow"] : [];
    expect(flagged).toEqual(expected);
  });
});
