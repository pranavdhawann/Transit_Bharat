import { describe, expect, it } from "vitest";
import { provenance } from "../src/lib/provenance";

describe("provenance engine", () => {
  it("classifies synthetic sources as DEMO regardless of freshness", () => {
    const now = Date.now();
    expect(provenance("synthetic", now, now)).toBe("DEMO");
    expect(provenance("synthetic", null, now)).toBe("DEMO");
  });

  it("classifies missing realtime updates as SCHEDULED", () => {
    const now = Date.now();
    expect(provenance("realtime", null, now)).toBe("SCHEDULED");
    expect(provenance("static", null, now)).toBe("SCHEDULED");
  });

  it("classifies fresh realtime updates as LIVE", () => {
    const now = Date.now();
    expect(provenance("realtime", now - 10_000, now)).toBe("LIVE");
  });

  it("classifies old realtime updates as STALE", () => {
    const now = Date.now();
    expect(provenance("realtime", now - 300_000, now)).toBe("STALE");
  });
});
