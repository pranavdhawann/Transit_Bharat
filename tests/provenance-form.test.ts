import { describe, expect, it } from "vitest";
import { PROVENANCE_META } from "@/lib/provenance";
import type { Provenance } from "@/lib/types";

const STATES: Provenance[] = ["LIVE", "SCHEDULED", "STALE", "DEMO"];

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

  it("keeps the four states and their labels intact", () => {
    for (const state of STATES) {
      expect(PROVENANCE_META[state].label).toBe(state);
      expect(PROVENANCE_META[state].hint.length).toBeGreaterThan(0);
    }
  });
});
