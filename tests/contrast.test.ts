import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "@/lib/contrast";
import { THEMES } from "@/lib/tokens";

describe("contrast primitives", () => {
  it("computes known luminance endpoints", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("computes the canonical black-on-white ratio", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#C43129", "#F5F3EF")).toBeCloseTo(
      contrastRatio("#F5F3EF", "#C43129"),
      10,
    );
  });

  it("rejects malformed colours", () => {
    expect(() => relativeLuminance("red")).toThrow();
    expect(() => relativeLuminance("#FFF")).toThrow();
  });
});

describe.each(["light", "dark"] as const)("%s theme tokens", (theme) => {
  const t = THEMES[theme];

  it("clears 4.5:1 for text on both grounds", () => {
    for (const ink of [t.ink, t.ink2, t.ink3]) {
      expect(contrastRatio(ink, t.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, t.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("clears 3:1 for the saffron focus ring on both grounds", () => {
    expect(contrastRatio(t.saffron, t.paper)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t.saffron, t.surface)).toBeGreaterThanOrEqual(3);
  });

  it("clears 4.5:1 for provenance signal colours", () => {
    for (const signal of [t.live, t.stale]) {
      expect(contrastRatio(signal, t.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(signal, t.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
