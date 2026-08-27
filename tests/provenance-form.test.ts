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

  it("remains tellable apart in greyscale, after every colour utility is stripped", () => {
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
