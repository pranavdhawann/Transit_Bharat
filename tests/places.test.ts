import { describe, expect, it } from "vitest";
import { LANDMARKS } from "../src/data/network";
import { haversineMeters } from "../src/lib/geo";
import { allStops } from "../src/data/network";
import { searchPlaces, suggestedPlaces } from "../src/lib/places";
import { planJourneys } from "../src/lib/graph";

const DELHI_BBOX = { minLat: 28.4, maxLat: 28.9, minLon: 76.9, maxLon: 77.55 };
const DEPART = Date.UTC(2026, 7, 26, 4, 0);

function nearestNetworkMeters(p: { lat: number; lon: number }) {
  let best = Infinity;
  for (const s of allStops()) best = Math.min(best, haversineMeters(p, s));
  return best;
}

describe("place index coverage", () => {
  it("keeps every landmark inside the Delhi pilot bounding box", () => {
    for (const lm of LANDMARKS) {
      expect(lm.lat, lm.name).toBeGreaterThanOrEqual(DELHI_BBOX.minLat);
      expect(lm.lat, lm.name).toBeLessThanOrEqual(DELHI_BBOX.maxLat);
      expect(lm.lon, lm.name).toBeGreaterThanOrEqual(DELHI_BBOX.minLon);
      expect(lm.lon, lm.name).toBeLessThanOrEqual(DELHI_BBOX.maxLon);
    }
  });

  it("has unique landmark ids and names", () => {
    expect(new Set(LANDMARKS.map((l) => l.id)).size).toBe(LANDMARKS.length);
    expect(new Set(LANDMARKS.map((l) => l.name)).size).toBe(LANDMARKS.length);
  });

  it("offers enough non-metro landmarks that search is not metro-only", () => {
    // Regression: the index was 242 metro stations against 12 landmarks, so
    // essentially every query resolved to a metro station.
    expect(LANDMARKS.length).toBeGreaterThanOrEqual(60);
  });

  it("keeps the vast majority of landmarks reachable by transit", () => {
    const reachable = LANDMARKS.filter(
      (lm) => nearestNetworkMeters(lm) <= 1500,
    );
    // The rest legitimately fall through to the auto-rickshaw fallback.
    expect(reachable.length / LANDMARKS.length).toBeGreaterThan(0.9);
  });

  it("finds well-known non-metro Delhi places by name", () => {
    for (const q of ["chandni chowk", "khan market", "sarojini", "jamia"]) {
      expect(searchPlaces(q).length, q).toBeGreaterThan(0);
    }
  });

  it("finds the requested society-to-block example by its typed labels", () => {
    expect(searchPlaces("NRI Complex")[0]?.id).toBe("lm:nri-complex-mandakini");
    expect(searchPlaces("C Block Kalkaji")[0]?.id).toBe("lm:c-block-kalkaji");
  });

  it("matches Hindi aliases", () => {
    expect(searchPlaces("चांदनी चौक").length).toBeGreaterThan(0);
    expect(searchPlaces("मुनीरका")[0]?.id).toBe("lm:munirka-market");
  });

  it("returns popular places for an empty query via suggestedPlaces", () => {
    const s = suggestedPlaces();
    expect(s.length).toBeGreaterThan(0);
    expect(searchPlaces("")).toHaveLength(0);
  });

  it("plans a real transit journey between two new landmarks", () => {
    const from = LANDMARKS.find((l) => l.id === "lm:chandni-chowk")!;
    const to = LANDMARKS.find((l) => l.id === "lm:saket-citywalk")!;
    const journeys = planJourneys({
      origin: { name: from.name, lat: from.lat, lon: from.lon },
      destination: { name: to.name, lat: to.lat, lon: to.lon },
      departAtMs: DEPART,
    });
    expect(journeys.length).toBeGreaterThan(0);
    const modes = journeys[0].legs.map((l) => l.mode);
    expect(modes).not.toContain("AUTO");
    expect(modes.some((m) => m === "SUBWAY" || m === "BUS")).toBe(true);
  });
});
