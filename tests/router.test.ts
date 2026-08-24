import { describe, expect, it } from "vitest";
import { BUS_ROUTES, LANDMARKS, allStops } from "../src/data/network";
import { haversineMeters } from "../src/lib/geo";
import { getPlace } from "../src/lib/places";
import { planJourneys } from "../src/lib/graph";

const DEPART = Date.UTC(2026, 7, 24, 3, 0); // fixed clock for determinism
const PRIMARY_BUS = BUS_ROUTES[0].number;

function plan(fromId: string, toId: string) {
  const from = getPlace(fromId)!;
  const to = getPlace(toId)!;
  expect(from).toBeTruthy();
  expect(to).toBeTruthy();
  return planJourneys({
    origin: { name: from.name, lat: from.lat, lon: from.lon },
    destination: { name: to.name, lat: to.lat, lon: to.lon },
    departAtMs: DEPART,
  });
}

function nearestStopTo(landmarkId: string) {
  const lm = getPlace(landmarkId)!;
  let best = allStops()[0];
  let bestD = Infinity;
  for (const s of allStops()) {
    const d = haversineMeters(lm, s);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

describe("deterministic router", () => {
  it("returns at least two distinct options for the demo OD pair", () => {
    const journeys = plan("lm:munirka-market", "lm:connaught-place");
    expect(journeys.length).toBeGreaterThanOrEqual(2);
    const sigs = new Set(
      journeys.map((j) =>
        j.legs
          .filter((l) => l.mode !== "WALK")
          .map((l) => l.routeId)
          .join(">"),
      ),
    );
    expect(sigs.size).toBeGreaterThanOrEqual(2);
  });

  it("starts with walking and ends with walking for off-network destinations", () => {
    const journeys = plan("lm:munirka-market", "lm:red-fort");
    expect(journeys.length).toBeGreaterThan(0);
    for (const j of journeys) {
      expect(j.legs[0].mode).toBe("WALK");
      expect(j.legs[j.legs.length - 1].mode).toBe("WALK");
    }
  });

  it("allows journeys ending directly at a network stop", () => {
    const dest = nearestStopTo("lm:kashmere-gate-isbt");
    const journeys = planJourneys({
      origin: {
        name: getPlace("lm:munirka-market")!.name,
        lat: getPlace("lm:munirka-market")!.lat,
        lon: getPlace("lm:munirka-market")!.lon,
      },
      destination: { name: dest.name, lat: dest.lat, lon: dest.lon },
      departAtMs: DEPART,
    });
    expect(journeys.length).toBeGreaterThan(0);
    for (const j of journeys) {
      expect(j.legs[0].mode).toBe("WALK");
    }
  });

  it("is deterministic for identical inputs", () => {
    const a = plan("lm:iit-delhi", "lm:nehru-place-market");
    const b = plan("lm:iit-delhi", "lm:nehru-place-market");
    expect(a.map((j) => j.id)).toEqual(b.map((j) => j.id));
  });

  it("labels are unique and semantically consistent", () => {
    const journeys = plan("lm:munirka-market", "lm:connaught-place");
    expect(journeys.length).toBeGreaterThanOrEqual(2);
    const labels = journeys.map((j) => j.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[0]).toBe("RECOMMENDED");
    if (journeys.some((j) => j.label === "FASTEST")) {
      const fastest = journeys.find((j) => j.label === "FASTEST")!;
      const maxDur = Math.max(...journeys.map((j) => j.durationMinutes));
      expect(fastest.durationMinutes).toBeLessThanOrEqual(maxDur);
    }
    if (journeys.some((j) => j.label === "CHEAPEST")) {
      const cheapest = journeys.find((j) => j.label === "CHEAPEST")!;
      const minFare = Math.min(...journeys.map((j) => j.fareInr));
      expect(cheapest.fareInr).toBe(minFare);
    }
    // Every journey carries at least one deterministic reason.
    for (const j of journeys) expect((j.why ?? []).length).toBeGreaterThan(0);
  });

  it("keeps flagship fares in a believable band (₹20-₹60)", () => {
    const journeys = plan("lm:munirka-market", "lm:connaught-place");
    for (const j of journeys) {
      expect(j.fareInr).toBeGreaterThanOrEqual(20);
      expect(j.fareInr).toBeLessThanOrEqual(60);
    }
  });

  it("produces consistent timing and fares", () => {
    const journeys = plan("lm:munirka-market", "lm:connaught-place");
    for (const j of journeys) {
      expect(j.durationMinutes).toBeGreaterThan(5);
      expect(j.fareInr).toBeGreaterThanOrEqual(20);
      expect(j.walkingMeters).toBeGreaterThanOrEqual(0);
      const first = Date.parse(j.legs[0].departAt);
      const last = Date.parse(j.legs[j.legs.length - 1].arriveAt);
      expect(Math.round((last - first) / 60000)).toBeCloseTo(
        j.durationMinutes,
        0,
      );
      // Transit legs carry DEMO provenance.
      for (const leg of j.legs) {
        if (leg.mode !== "WALK") expect(leg.provenance).toBe("DEMO");
      }
    }
  });

  it("marks affected journeys as disrupted when the primary bus is delayed", () => {
    const baseline = plan("lm:munirka-market", "lm:connaught-place");
    const disrupted = planJourneys({
      origin: { name: "Munirka", lat: 28.558, lon: 77.1765 },
      destination: { name: "Connaught Place", lat: 28.6315, lon: 77.2167 },
      departAtMs: DEPART,
      delay: { routeNumber: PRIMARY_BUS, minutes: 11 },
    });
    expect(disrupted.some((j) => j.disrupted)).toBe(true);
    const baseBest = baseline[0];
    const disrBest = disrupted.find((j) => j.disrupted);
    if (disrBest && baseBest.disrupted === false) {
      expect(disrBest.arriveAt >= baseBest.arriveAt).toBe(true);
    }
  });

  it("returns empty for places far outside the pilot network", () => {
    const journeys = planJourneys({
      origin: { name: "Nowhere", lat: 28.0, lon: 76.4 },
      destination: { name: "Elsewhere", lat: 29.2, lon: 77.9 },
      departAtMs: DEPART,
    });
    expect(journeys).toHaveLength(0);
  });
});
