import { describe, expect, it } from "vitest";
import {
  realisticLegProgress,
  reanchorAtSpeedChange,
  simulationTime,
} from "../src/lib/go-navigation";
import type { Leg } from "../src/lib/types";

function leg(mode: Leg["mode"], intermediateStops = 0): Leg {
  const stop = (index: number) => ({
    id: `s${index}`,
    name: `Stop ${index}`,
    lat: 28.5 + index * 0.01,
    lon: 77.1,
  });
  return {
    mode,
    from: stop(0),
    to: stop(intermediateStops + 1),
    intermediateStops: Array.from({ length: intermediateStops }, (_, index) =>
      stop(index + 1),
    ),
    departAt: new Date(0).toISOString(),
    arriveAt: new Date(60_000).toISOString(),
    durationMinutes: 1,
    fareInr: 0,
    polyline: [
      [28.5, 77.1],
      [28.6, 77.1],
    ],
    provenance: "DEMO",
  };
}

describe("GO simulation clock", () => {
  it("does not jump backward when playback speed changes", () => {
    const anchor = { wall: 1_000, sim: 10_000 };
    const next = reanchorAtSpeedChange(anchor, 2_000, 30);
    expect(next).toEqual({ wall: 2_000, sim: 40_000 });
    expect(simulationTime(next, 3_000, 1)).toBe(41_000);
  });

  it("eases walking movement instead of moving at mechanical constant speed", () => {
    expect(realisticLegProgress(leg("WALK"), 0.25)).toBeCloseTo(0.15625);
    expect(realisticLegProgress(leg("WALK"), 0.5)).toBe(0.5);
  });

  it("briefly dwells at intermediate transit stops", () => {
    const bus = leg("BUS", 1);
    expect(realisticLegProgress(bus, 0.5)).toBe(0.5);
    expect(realisticLegProgress(bus, 0.52)).toBe(0.5);
    expect(realisticLegProgress(bus, 1)).toBe(1);
  });
});
