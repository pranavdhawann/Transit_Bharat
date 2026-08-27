import { describe, expect, it } from "vitest";
import {
  BUS_ROUTES,
  LANDMARKS,
  WALK_KMH,
  allStops,
} from "../src/data/network";
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

  it("is door-to-door for off-network destinations", () => {
    // First/last legs must be access modes, never a transit leg: the rider is
    // never told to start or finish mid-network. Auto counts as access since
    // the first/last-mile assist can replace an over-long walk.
    const ACCESS = ["WALK", "AUTO"];
    const journeys = plan("lm:munirka-market", "lm:red-fort");
    expect(journeys.length).toBeGreaterThan(0);
    for (const j of journeys) {
      expect(ACCESS).toContain(j.legs[0].mode);
      expect(ACCESS).toContain(j.legs[j.legs.length - 1].mode);
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
      expect(["WALK", "AUTO"]).toContain(j.legs[0].mode);
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

  it("falls back to a door-to-door auto for places far outside the pilot network", () => {
    const origin = { name: "Nowhere", lat: 28.0, lon: 76.4 };
    const destination = { name: "Elsewhere", lat: 29.2, lon: 77.9 };
    const journeys = planJourneys({
      origin,
      destination,
      departAtMs: DEPART,
    });
    expect(journeys.length).toBeGreaterThanOrEqual(1);
    const auto = journeys.find((j) =>
      j.legs.some((l) => l.mode === "AUTO"),
    )!;
    expect(auto.label).toBe("RECOMMENDED");
    expect(auto.transfers).toBe(0);
    expect(auto.provenance).toBe("DEMO");
    expect(auto.fareInr).toBeGreaterThan(0);
    expect(auto.why?.length).toBeGreaterThan(0);
    const autoLeg = auto.legs.find((l) => l.mode === "AUTO")!;
    expect(autoLeg.provenance).toBe("DEMO");
    expect(autoLeg.fareInr).toBeGreaterThan(0);
    expect(autoLeg.intermediateStops).toHaveLength(0);
    expect(Date.parse(autoLeg.arriveAt)).toBe(
      Date.parse(autoLeg.departAt) + autoLeg.durationMinutes * 60000,
    );
    const km = haversineMeters(origin, destination) / 1000;
    const directWalkMin = (km / WALK_KMH) * 60;
    expect(directWalkMin).toBeGreaterThan(15);
    expect(auto.durationMinutes).toBeLessThan(directWalkMin);
  });

  it("returns identical JSON for repeated auto-fallback calls", () => {
    const input = {
      origin: { name: "Nowhere", lat: 28.0, lon: 76.4 },
      destination: { name: "Elsewhere", lat: 29.2, lon: 77.9 },
      departAtMs: DEPART,
    };
    expect(planJourneys(input).length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(planJourneys(input))).toBe(
      JSON.stringify(planJourneys(input)),
    );
  });

  it("returns empty when walking stays within the auto threshold", () => {
    // Off-network pair ~900 m apart (>300 m floor, walk well under 15 min).
    const journeys = planJourneys({
      origin: { name: "Far A", lat: 28.3, lon: 77.1 },
      destination: { name: "Far B", lat: 28.306, lon: 77.106 },
      departAtMs: DEPART,
    });
    const meters = haversineMeters(
      { lat: 28.3, lon: 77.1 },
      { lat: 28.306, lon: 77.106 },
    );
    expect(meters).toBeGreaterThan(300);
    expect((meters / 1000 / WALK_KMH) * 60).toBeLessThanOrEqual(15);
    expect(journeys).toHaveLength(0);
  });

  it("reports total walking distance as the sum of its walking legs", () => {
    // Regression: journey.walkingMeters used to be summed from the Dijkstra
    // chain only, which excludes the synthesized access/egress walks, so every
    // journey reported 0 m and every card claimed "Minimal walking".
    const journeys = plan("lm:munirka-market", "lm:connaught-place");
    expect(journeys.length).toBeGreaterThan(0);

    for (const j of journeys) {
      const legSum = j.legs.reduce((a, l) => a + (l.walkingMeters ?? 0), 0);
      expect(j.walkingMeters).toBe(Math.round(legSum));
    }

    // At least one option must involve real walking - both endpoints here are
    // landmarks set back from the network, so a 0 m total means the bug is back.
    expect(Math.max(...journeys.map((j) => j.walkingMeters))).toBeGreaterThan(0);
  });

  it("only claims \"Minimal walking\" when walking is actually short", () => {
    const journeys = plan("lm:munirka-market", "lm:connaught-place");
    const longWalks = journeys.filter((j) => {
      const legSum = j.legs.reduce((a, l) => a + (l.walkingMeters ?? 0), 0);
      return legSum >= 300;
    });
    // The flagship pair must exercise the negative case, or this test proves
    // nothing (it passed vacuously while walkingMeters was hardcoded to 0).
    expect(longWalks.length).toBeGreaterThan(0);
    for (const j of longWalks) {
      expect(j.why ?? []).not.toContain("Minimal walking");
    }
  });

  it("offers an auto first/last mile instead of a long walk to the network", () => {
    // India Gate has no station within the walk radius, so the only options
    // used to be a pure door-to-door auto.
    const journeys = plan("lm:kashmere-gate-isbt", "lm:india-gate");
    const assisted = journeys.find(
      (j) =>
        j.legs.some((l) => l.mode === "AUTO") &&
        j.legs.some((l) => l.mode === "SUBWAY" || l.mode === "BUS"),
    );
    expect(assisted, "expected an auto+transit itinerary").toBeTruthy();
    const pureAuto = journeys.find((j) => j.legs.every((l) => l.mode === "AUTO"));
    expect(pureAuto, "expected the door-to-door auto too").toBeTruthy();
    // The whole point: combining beats paying for the entire ride by auto.
    expect(assisted!.fareInr).toBeLessThan(pureAuto!.fareInr);
    expect(assisted!.why ?? []).toContain("Auto for the first mile, then transit");
  });

  it("leaves short-walk itineraries alone", () => {
    // The flagship pair is well served on foot; no auto should be injected.
    const journeys = plan("lm:munirka-market", "lm:connaught-place");
    for (const j of journeys) {
      expect(j.legs.some((l) => l.mode === "AUTO")).toBe(false);
    }
  });
});
