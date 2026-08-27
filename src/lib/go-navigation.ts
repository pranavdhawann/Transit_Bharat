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

export function positionAlongLeg(
  leg: Leg,
  simNow: number,
  start: number,
  rideStart: number,
  end: number,
): LatLng {
  const movementStart = leg.mode === "WALK" ? start : rideStart;
  const denominator = Math.max(1, end - movementStart);
  const fraction = Math.min(1, Math.max(0, (simNow - movementStart) / denominator));
  const point = pointAlongFraction(leg.polyline, fraction);
  return { lat: point.lat, lon: point.lon };
}
