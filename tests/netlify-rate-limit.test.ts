import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("voice transcription platform rate limit", () => {
  it("protects the paid endpoint at Netlify's edge", () => {
    const source = readFileSync(
      "netlify/edge-functions/voice-rate-limit.ts",
      "utf8",
    );

    expect(source).toContain('path: "/api/ai/transcribe"');
    expect(source).toContain("windowLimit: 3");
    expect(source).toContain("windowSize: 60");
    expect(source).toContain('aggregateBy: ["ip", "domain"]');
  });
});
