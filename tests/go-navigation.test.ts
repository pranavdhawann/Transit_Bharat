import { describe, expect, it } from "vitest";
import { reanchorAtSpeedChange, simulationTime } from "../src/lib/go-navigation";

describe("GO simulation clock", () => {
  it("does not jump backward when playback speed changes", () => {
    const anchor = { wall: 1_000, sim: 10_000 };
    const next = reanchorAtSpeedChange(anchor, 2_000, 30);
    expect(next).toEqual({ wall: 2_000, sim: 40_000 });
    expect(simulationTime(next, 3_000, 1)).toBe(41_000);
  });
});
