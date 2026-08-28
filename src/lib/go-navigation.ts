import { pointAlongFraction } from "./geo";
import type { LatLng, Leg } from "./types";

export interface SimulationAnchor {
  wall: number;
  sim: number;
}

export function simulationTime(
  anchor: SimulationAnchor,
  wallNow: number,
  speed: number,
): number {
  return anchor.sim + Math.max(0, wallNow - anchor.wall) * speed;
}

/** Preserve simulated time when the rider changes playback speed. */
export function reanchorAtSpeedChange(
  anchor: SimulationAnchor,
  wallNow: number,
  oldSpeed: number,
): SimulationAnchor {
  return { wall: wallNow, sim: simulationTime(anchor, wallNow, oldSpeed) };
}

function smoothstep(value: number): number {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
}

/**
 * Give demo movement a physical rhythm: ease into/out of walking, and pause
 * briefly at each transit stop before accelerating into the next hop.
 */
export function realisticLegProgress(leg: Leg, rawProgress: number): number {
  const raw = Math.min(1, Math.max(0, rawProgress));
  if (raw === 1) return 1;
  if (leg.mode === "WALK" || leg.mode === "AUTO") return smoothstep(raw);

  const hops = Math.max(1, leg.intermediateStops.length + 1);
  const scaled = raw * hops;
  const hop = Math.min(hops - 1, Math.floor(scaled));
  const withinHop = scaled - hop;
  const dwellShare = 0.08;
  const moving = Math.max(0, (withinHop - dwellShare) / (1 - dwellShare));
  return (hop + smoothstep(moving)) / hops;
}

export function positionAlongLeg(
  leg: Leg,
  simNow: number,
  start: number,
  rideStart: number,
  end: number,
): LatLng {
  const movementStart = leg.mode === "WALK" ? start : rideStart;
  const denominator = Math.max(1, end - movementStart);
  const rawFraction = Math.min(
    1,
    Math.max(0, (simNow - movementStart) / denominator),
  );
  const fraction = realisticLegProgress(leg, rawFraction);
  const point = pointAlongFraction(leg.polyline, fraction);
  return { lat: point.lat, lon: point.lon };
}
