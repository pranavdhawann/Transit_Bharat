import { describe, expect, it } from "vitest";
import { routeBarSegments } from "@/lib/routebar";
import type { Leg } from "@/lib/types";

function leg(mode: Leg["mode"], durationMinutes: number, extra: Partial<Leg> = {}): Leg {
  return {
    mode,
    from: { id: "a", name: "A", lat: 0, lon: 0 },
    to: { id: "b", name: "B", lat: 0, lon: 0 },
    intermediateStops: [],
    departAt: new Date(0).toISOString(),
    arriveAt: new Date(0).toISOString(),
    durationMinutes,
    polyline: [],
    provenance: "DEMO",
    ...extra,
  };
}

describe("routeBarSegments", () => {
  it("returns one segment per leg", () => {
    const segments = routeBarSegments([leg("WALK", 5), leg("BUS", 20)]);
    expect(segments).toHaveLength(2);
  });

  it("sizes segments in proportion to duration", () => {
    const segments = routeBarSegments([leg("WALK", 10), leg("BUS", 30)]);
    expect(segments[0].percent).toBeCloseTo(25, 5);
    expect(segments[1].percent).toBeCloseTo(75, 5);
  });

  it("always totals 100 percent", () => {
    const segments = routeBarSegments([leg("WALK", 3), leg("BUS", 7), leg("SUBWAY", 11)]);
    const total = segments.reduce((a, s) => a + s.percent, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("marks walk legs as walk and gives them no colour", () => {
    const [segment] = routeBarSegments([leg("WALK", 5)]);
    expect(segment.kind).toBe("walk");
    expect(segment.color).toBeNull();
  });

  it("carries the leg route colour through for transit legs", () => {
    const [segment] = routeBarSegments([
      leg("SUBWAY", 20, { routeColor: "#0B57A4", routeNumber: "YEL" }),
    ]);
    expect(segment.kind).toBe("transit");
    expect(segment.color).toBe("#0B57A4");
  });

  it("omits the label on segments too narrow to hold one", () => {
    const [narrow, wide] = routeBarSegments([
      leg("BUS", 1, { routeNumber: "764" }),
      leg("SUBWAY", 99, { routeNumber: "YEL" }),
    ]);
    expect(narrow.label).toBeNull();
    expect(wide.label).toBe("YEL");
  });

  it("survives an empty journey without dividing by zero", () => {
    expect(routeBarSegments([])).toEqual([]);
  });

  it("survives zero-duration legs without producing NaN", () => {
    const segments = routeBarSegments([leg("WALK", 0), leg("BUS", 0)]);
    for (const s of segments) expect(Number.isFinite(s.percent)).toBe(true);
  });
});
