import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("voice input race guards", () => {
  it("releases a late microphone grant after the component unmounts", () => {
    const source = readFileSync("src/components/VoiceTripButton.tsx", "utf8");
    expect(source).toContain("if (!mountedRef.current) {");
    expect(source).toContain("stream.getTracks().forEach((track) => track.stop())");
  });

  it("does not apply a transcript after a newer manual parse", () => {
    const source = readFileSync("src/app/page.tsx", "utf8");
    expect(source).toContain("voiceStartRef.current?.parseSeq !== parseSeqRef.current");
  });

  it("blocks duplicate Ctrl+Enter parsing without disabling Stop", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    const button = readFileSync("src/components/VoiceTripButton.tsx", "utf8");
    expect(home).toContain("if (nlBusy) return;");
    expect(button).toContain("disabled={busy || (disabled && !recording)}");
  });

  it("preserves a manually selected access profile for place-only text", () => {
    const source = readFileSync("src/app/page.tsx", "utf8");
    expect(source).not.toMatch(
      /setLessWalking\(constraints\.lessWalking\);\s*setMaxTransfers\(constraints\.maxTransfers\);\s*setAccessibilityNeed\(prefs\.accessibilityNeed\);/,
    );
    expect(source).toContain("if (prefs.accessibilityNeed) {");
  });
});
