import { describe, expect, it } from "vitest";
import { BUS_ROUTES } from "../src/data/network";
import { pingPongProgress, simulateVehicles } from "../src/lib/vehicles";

const PRIMARY = BUS_ROUTES[0].number;

describe("synthetic vehicle simulator", () => {
  it("covers the full route before reversing direction", () => {
    expect(pingPongProgress(0)).toEqual({ progress: 0, direction: 1 });
    expect(pingPongProgress(0.25)).toEqual({ progress: 0.5, direction: 1 });
    expect(pingPongProgress(0.5)).toEqual({ progress: 1, direction: -1 });
    expect(pingPongProgress(0.75)).toEqual({ progress: 0.5, direction: -1 });
  });

  it("emits DEMO-provenance vehicles with next stops", () => {
    const now = Date.now();
    const vehicles = simulateVehicles({ nowMs: now });
    expect(vehicles.length).toBeGreaterThan(0);
    for (const v of vehicles) {
      expect(v.provenance).toBe("DEMO");
      expect(v.nextStopName.length).toBeGreaterThan(0);
      expect(v.progress).toBeGreaterThanOrEqual(0);
      expect(v.progress).toBeLessThanOrEqual(1);
    }
  });

  it("moves forward through time along its direction", () => {
    const t0 = Date.UTC(2026, 7, 24, 3, 0, 0);
    const before = simulateVehicles({ nowMs: t0, routeNumbers: [PRIMARY] });
    const after = simulateVehicles({ nowMs: t0 + 30_000, routeNumbers: [PRIMARY] });

    const byId = (list: ReturnType<typeof simulateVehicles>, id: string) =>
      list.find((v) => v.id === id)!;
    const a = byId(before, `${PRIMARY}-1`);
    const b = byId(after, `${PRIMARY}-1`);
    expect(a.direction).toBe(b.direction); // same segment within 30 s
    const delta = Math.abs(b.progress - a.progress);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(0.05);
    expect(b.updatedAt >= a.updatedAt).toBe(true);
  });

  it("reflects the scripted delay on the affected route only", () => {
    const now = Date.now();
    const clean = simulateVehicles({ nowMs: now });
    const delayed = simulateVehicles({
      nowMs: now,
      delay: { routeNumber: PRIMARY, minutes: 11 },
    });
    for (const v of delayed.filter((v) => v.routeNumber === PRIMARY)) {
      expect(v.delayMinutes).toBe(11);
    }
    for (const v of delayed.filter((v) => v.routeNumber !== PRIMARY)) {
      expect(v.delayMinutes).toBe(0);
    }
    for (const v of clean) {
      expect(v.delayMinutes).toBe(0);
    }
  });

  it("is deterministic for the same clock", () => {
    const t0 = Date.UTC(2026, 7, 24, 9, 15);
    const a = simulateVehicles({ nowMs: t0 });
    const b = simulateVehicles({ nowMs: t0 });
    expect(a).toEqual(b);
  });
});


