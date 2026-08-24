/**
 * Synthetic realtime vehicle simulator.
 *
 * Generates realistic-looking bus movement along real route corridors
 * WITHOUT pretending to be government realtime data. Every emitted vehicle
 * is provenance DEMO and the UI must always label it as such.
 *
 * Positions are a pure function of server time - deterministic, so repeated
 * judging runs look identical for the same clock.
 */
import { BUS_ROUTES, type BusRoute } from "@/data/network";
import { cumulativeMeters, pointAlongFraction } from "./geo";
import type { Vehicle } from "./types";

interface RouteSim {
  route: BusRoute;
  /** Cumulative meters at each stop vertex. */
  cum: number[];
  totalMeters: number;
}

const sims = new Map<string, RouteSim>();

function simFor(route: BusRoute): RouteSim {
  let sim = sims.get(route.id);
  if (!sim) {
    const poly = route.stops.map((s) => [s.lat, s.lon] as [number, number]);
    const cum = cumulativeMeters(poly);
    sim = { route, cum, totalMeters: cum[cum.length - 1] };
    sims.set(route.id, sim);
  }
  return sim;
}

function stopNameAt(route: BusRoute, metersAlong: number, dir: 1 | -1): string {
  const { cum } = simFor(route);
  if (dir === 1) {
    for (let i = 0; i < cum.length; i++) {
      if (cum[i] > metersAlong) return route.stops[i].name;
    }
    return route.stops[route.stops.length - 1].name;
  }
  // Heading back toward the first terminus.
  for (let i = cum.length - 1; i >= 0; i--) {
    if (cum[i] < metersAlong) return route.stops[i].name;
  }
  return route.stops[0].name;
}

export interface SimulateOptions {
  routeNumbers?: string[];
  nowMs?: number;
  /** Demo delay applied to this route's vehicles. */
  delay?: { routeNumber: string; minutes: number } | null;
}

export function simulateVehicles(opts: SimulateOptions = {}): Vehicle[] {
  const nowMs = opts.nowMs ?? Date.now();
  const out: Vehicle[] = [];

  for (const route of BUS_ROUTES) {
    if (opts.routeNumbers && !opts.routeNumbers.includes(route.number)) continue;
    const sim = simFor(route);
    const cycleMs = route.cycleMinutes * 60_000;
    const delayMin =
      opts.delay && opts.delay.routeNumber === route.number
        ? opts.delay.minutes
        : 0;

    for (let v = 0; v < route.vehicles; v++) {
      // Vehicles evenly spaced through the cycle; delayed ones lag behind.
      const offsetMs =
        (v * cycleMs) / route.vehicles + (delayMin > 0 ? delayMin * 60_000 : 0);
      const phaseRaw = (((nowMs - offsetMs) % cycleMs) + cycleMs) % cycleMs / cycleMs;
      // Ping-pong: forward then backward over the stop polyline.
      let phase = phaseRaw;
      let direction: 1 | -1 = 1;
      if (phase >= 0.5) {
        phase = 1 - phase;
        direction = -1;
      }
      const pos = pointAlongFraction(
        route.stops.map((s) => [s.lat, s.lon] as [number, number]),
        phase,
      );
      const metersAlong = phase * sim.totalMeters;
      const updatedAtMs = Math.floor(nowMs / 5000) * 5000;
      out.push({
        id: `${route.number}-${v + 1}`,
        routeId: route.id,
        routeNumber: route.number,
        headsign:
          direction === 1
            ? route.stops[route.stops.length - 1].name
            : route.stops[0].name,
        lat: pos.lat,
        lon: pos.lon,
        bearing: direction === 1 ? pos.bearing : (pos.bearing + 180) % 360,
        nextStopName: stopNameAt(route, metersAlong, direction),
        progress: phase,
        direction,
        updatedAt: new Date(updatedAtMs).toISOString(),
        ageSeconds: Math.max(0, Math.round((nowMs - updatedAtMs) / 1000)),
        provenance: "DEMO",
        delayMinutes: delayMin,
      });
    }
  }

  return out;
}
