import { describe, expect, it } from "vitest";
import { PROVENANCE_META } from "@/lib/provenance";
import type { Provenance } from "@/lib/types";

const STATES: Provenance[] = ["LIVE", "SCHEDULED", "STALE", "DEMO"];

// Anything that paints ink/paper/surface/rule/saffron/live/stale onto a
// background, text, or border. Stripping these leaves only the non-colour
// form: shape, fill-vs-outline, border weight, texture.
const COLOUR_UTILITY =
  /\b(?:bg|text|border)-(?:ink-2|ink-3|ink|paper|surface|rule|saffron|live|stale)\b/g;

function stripColour(classes: string): string {
  return classes.replace(COLOUR_UTILITY, "").replace(/\s+/g, " ").trim();
}

describe("provenance is distinguishable without colour", () => {
  it("gives every state a form", () => {
    for (const state of STATES) {
      expect(PROVENANCE_META[state].form).toBeDefined();
    }
  });

  it("gives every state a DIFFERENT form", () => {
    const forms = STATES.map((s) => PROVENANCE_META[s].form);
    expect(new Set(forms).size).toBe(STATES.length);
  });

  // The dot is the ONLY glyph that is purely non-colour-bearing in form for
  // every state (SCHEDULED and STALE containers are both plain outlines that
  // differ solely by hue, so a container-inclusive residual is not a valid
  // guard for that pair — see task-5-report.md). So the guard is the dot's
  // own class string, colour-stripped, alone.
  it("keeps every state's DOT tellable apart in greyscale, after colour is stripped", () => {
    const dotResiduals = STATES.map((state) =>
      stripColour(PROVENANCE_META[state].dotClassName),
    );
    expect(new Set(dotResiduals).size).toBe(STATES.length);
  });

  // Secondary check only — NOT the guard above. Included because a wider
  // regression (e.g. two states' full badges becoming pixel-identical) is
  // still worth catching, but this alone cannot prove dot-level distinctness:
  // it happily passes even when two dots collide, as long as something in
  // the surrounding container (e.g. `.hatch`) differs.
  it("also keeps the combined badge classes tellable apart in greyscale (secondary, not the guard)", () => {
    const residuals = STATES.map((state) => {
      const meta = PROVENANCE_META[state];
      return stripColour(`${meta.className} ${meta.dotClassName}`);
    });
    expect(new Set(residuals).size).toBe(STATES.length);
  });

  it("keeps the four states and their labels intact", () => {
    for (const state of STATES) {
      expect(PROVENANCE_META[state].label).toBe(state);
      expect(PROVENANCE_META[state].hint.length).toBeGreaterThan(0);
    }
  });
});
