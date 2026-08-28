import { describe, expect, it } from "vitest";
import {
  delayFrom,
  parseScenario,
  resetDisruption,
  resolveScenario,
  triggerDisruption,
} from "../src/lib/scenario";
import { PRIMARY_BUS_NUMBER } from "../src/data/network";
import { getPlace } from "../src/lib/places";
import { planJourneys } from "../src/lib/graph";

const DEPART = Date.UTC(2026, 7, 26, 4, 0);

function planWith(delay: { routeNumber: string; minutes: number } | null) {
  const f = getPlace("lm:munirka-market")!;
  const t = getPlace("lm:connaught-place")!;
  return planJourneys({
    origin: { name: f.name, lat: f.lat, lon: f.lon },
    destination: { name: t.name, lat: t.lat, lon: t.lon },
    departAtMs: DEPART,
    delay,
  });
}

describe("scenario state is instance-independent", () => {
  it("honours a client-supplied scenario when server memory is empty", () => {
    // This is the serverless case: the instance that handled the trigger is
    // not the instance handling this request, so it remembers nothing.
    resetDisruption();
    const fromClient = {
      active: true,
      triggeredAt: Date.now(),
      routeNumber: PRIMARY_BUS_NUMBER,
      delayMinutes: 11,
    };
    const resolved = resolveScenario(fromClient);
    expect(resolved.active).toBe(true);
    expect(resolved.routeNumber).toBe(PRIMARY_BUS_NUMBER);

    const delayed = planWith(delayFrom(resolved));
    const normal = planWith(null);
    expect(delayed.some((j) => j.disrupted)).toBe(true);
    expect(normal.some((j) => j.disrupted)).toBe(false);
  });

  it("falls back to server memory when the client sends nothing", () => {
    resetDisruption();
    triggerDisruption(PRIMARY_BUS_NUMBER, 11);
    expect(resolveScenario(undefined).active).toBe(true);
    resetDisruption();
    expect(resolveScenario(undefined).active).toBe(false);
  });

  it("rejects malformed or hostile client input", () => {
    for (const bad of [
      null,
      undefined,
      "delayed",
      42,
      {},
      { active: true, routeNumber: "", delayMinutes: 11 },
      { active: true, routeNumber: "620U", delayMinutes: 0 },
      { active: true, routeNumber: "620U", delayMinutes: Number.NaN },
    ]) {
      expect(parseScenario(bad), JSON.stringify(bad) ?? "undefined").toBeNull();
    }
  });

  it("honours an explicit inactive state instead of leaking server state", () => {
    triggerDisruption(PRIMARY_BUS_NUMBER, 11);
    const resolved = resolveScenario({
      active: false,
      routeNumber: "620U",
      delayMinutes: 11,
    });
    expect(resolved.active).toBe(false);
    resetDisruption();
  });

  it("rejects timestamps suspiciously far in the future", () => {
    expect(
      parseScenario({
        active: true,
        routeNumber: "620U",
        delayMinutes: 11,
        triggeredAt: Date.now() + 61_000,
      }),
    ).toBeNull();
  });

  it("clamps an absurd delay rather than trusting it", () => {
    const parsed = parseScenario({
      active: true,
      routeNumber: "620U",
      delayMinutes: 99999,
      triggeredAt: Date.now(),
    });
    expect(parsed?.delayMinutes).toBe(60);
  });

  it("truncates an over-long route number", () => {
    const parsed = parseScenario({
      active: true,
      routeNumber: "X".repeat(500),
      delayMinutes: 5,
      triggeredAt: Date.now(),
    });
    expect(parsed?.routeNumber?.length).toBeLessThanOrEqual(12);
  });

  it("ignores an expired scenario so a stale tab cannot re-delay the demo", () => {
    const parsed = parseScenario({
      active: true,
      routeNumber: "620U",
      delayMinutes: 11,
      triggeredAt: Date.now() - 31 * 60_000,
    });
    expect(parsed).toBeNull();
  });
});
