/**
 * Deterministic multimodal router over the curated Delhi pilot network.
 *
 * This is the Tier-1 fallback router described in the implementation guide:
 * real stop coordinates, real corridors, deterministic results - so the
 * recorded demo can never fail. It is designed behind the same adapter
 * interface an OpenTripPlanner integration will use later (see
 * LIMITATIONS.md).
 */
import {
  AUTO_ACCESS_MAX_METERS,
  AUTO_ASSIST_TRIGGER_METERS,
  AUTO_BOARD_MIN,
  AUTO_SPEED_KMH,
  AUTO_SWITCH_METERS,
  AUTO_WALK_THRESHOLD_MIN,
  BUS_BOARD_MIN,
  BUS_DWELL_MIN,
  BUS_FARE_INR,
  BUS_ROUTES,
  CENTRAL_BUS_SPEED_FACTOR,
  CENTRAL_DELHI_LAT,
  CONNECTOR_MAX_METERS,
  DEFAULT_MAX_WALK_METERS,
  INTERCHANGE_WALK_MAX_METERS,
  METRO_LINES,
  METRO_BOARD_MIN,
  TRANSFER_PENALTY_MIN,
  WALK_KMH,
  autoFare,
  metroFare,
} from "@/data/network";
import { haversineMeters } from "./geo";
import type {
  Journey,
  JourneyLabel,
  Leg,
  LatLng,
  Mode,
  StopRef,
} from "./types";

interface Pt extends LatLng {}

interface GraphEdge {
  toId: string;
  mode: Mode;
  routeKey: string | null; // null for walk
  routeNumber?: string;
  routeName?: string;
  routeColor?: string;
  headsign?: string;
  minutes: number;
  km: number;
}

const nodeCoords = new Map<string, StopRef>();
const adj = new Map<string, GraphEdge[]>();

function addNode(stop: StopRef) {
  if (!nodeCoords.has(stop.id)) nodeCoords.set(stop.id, stop);
}

function pushEdge(fromId: string, edge: GraphEdge) {
  let list = adj.get(fromId);
  if (!list) {
    list = [];
    adj.set(fromId, list);
  }
  list.push(edge);
}

let built = false;

function buildGraph(maxWalkMeters: number) {
  // Rebuild when the walk budget changes (less-walking toggle).
  const cacheKey = `walk:${maxWalkMeters}`;
  if (built && (adj as unknown as { __key?: string }).__key === cacheKey) return;
  adj.clear();
  nodeCoords.clear();

  const walkMinutes = (km: number) => (km / WALK_KMH) * 60;

  for (const line of METRO_LINES) {
    for (let i = 0; i < line.stations.length; i++) {
      addNode(line.stations[i]);
      if (i > 0) {
        const a = line.stations[i - 1];
        const b = line.stations[i];
        const km =
          haversineMeters(a, b) / 1000;
        for (const [u, v] of [
          [a, b],
          [b, a],
        ]) {
          pushEdge(u.id, {
            toId: v.id,
            mode: "SUBWAY",
            routeKey: line.id,
            routeNumber: line.shortName,
            routeName: line.name,
            routeColor: line.color,
            headsign: line.stations[line.stations.length - 1].name,
            minutes: (km / line.speedKmh) * 60,
            km,
          });
        }
      }
    }
  }

  for (const route of BUS_ROUTES) {
    for (let i = 0; i < route.stops.length; i++) {
      addNode(route.stops[i]);
      if (i > 0) {
        const a = route.stops[i - 1];
        const b = route.stops[i];
        const km = haversineMeters(a, b) / 1000;
        for (const [u, v] of [
          [a, b],
          [b, a],
        ]) {
          // Central-Delhi traffic slows buses (see network.ts note).
          const midLat = (u.lat + v.lat) / 2;
          const speed =
            midLat > CENTRAL_DELHI_LAT
              ? route.speedKmh * CENTRAL_BUS_SPEED_FACTOR
              : route.speedKmh;
          pushEdge(u.id, {
            toId: v.id,
            mode: "BUS",
            routeKey: route.id,
            routeNumber: route.number,
            routeName: route.name,
            routeColor: route.color,
            headsign: route.stops[route.stops.length - 1].name,
            minutes: (km / speed) * 60,
            km,
          });
        }
      }
    }
  }

  // Walking transfers between nearby stops (incl. metro <-> bus interchanges
  // and same-name metro interchanges, which are ~0 m apart).
  const stops = [...nodeCoords.values()];
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const d = haversineMeters(stops[i], stops[j]);
      if (d > 0 && d <= Math.min(INTERCHANGE_WALK_MAX_METERS, maxWalkMeters)) {
        const km = d / 1000;
        pushEdge(stops[i].id, {
          toId: stops[j].id,
          mode: "WALK",
          routeKey: null,
          minutes: walkMinutes(km),
          km,
        });
        pushEdge(stops[j].id, {
          toId: stops[i].id,
          mode: "WALK",
          routeKey: null,
          minutes: walkMinutes(km),
          km,
        });
      } else if (d === 0) {
        // Same-coordinate interchange (e.g. Yellow/Magenta Hauz Khas):
        // free 2-minute platform transfer.
        pushEdge(stops[i].id, {
          toId: stops[j].id,
          mode: "WALK",
          routeKey: null,
          minutes: TRANSFER_PENALTY_MIN,
          km: 0,
        });
        pushEdge(stops[j].id, {
          toId: stops[i].id,
          mode: "WALK",
          routeKey: null,
          minutes: TRANSFER_PENALTY_MIN,
          km: 0,
        });
      }
    }
  }

  (adj as unknown as { __key?: string }).__key = cacheKey;
  built = true;
}

// ------------------------------------------------------------- Profiles ---

export type ProfileName = "RECOMMENDED" | "FASTEST" | "CHEAPEST";

interface Profile {
  timeWeight: number;
  transferPenalty: number;
  fareWeight: number;
}

const PROFILES: Record<ProfileName, Profile> = {
  RECOMMENDED: { timeWeight: 1, transferPenalty: 4, fareWeight: 0.05 },
  FASTEST: { timeWeight: 1, transferPenalty: 1, fareWeight: 0 },
  CHEAPEST: { timeWeight: 0.55, transferPenalty: 3, fareWeight: 0.75 },
};

export interface PlanOptions {
  maxWalkMeters?: number;
  departAtMs?: number;
  /** Demo disruption: extra minutes added when boarding this route. */
  delay?: { routeNumber: string; minutes: number } | null;
  bannedRoutes?: string[];
  label?: JourneyLabel;
}

interface RawEdgeUse {
  edge: GraphEdge;
  fromId: string;
  boardPenalty: number;
  transferred: boolean;
  delayedBoard: boolean;
}

interface Label {
  cost: number;
  timeMin: number;
  fareInr: number;
  transfers: number;
  prevKey: string | null;
  edgeUse: RawEdgeUse | null;
}

function stateKey(stopId: string, lastRoute: string | null): string {
  return `${stopId}|${lastRoute ?? "-"}`;
}

function dijkstra(
  startId: string,
  endId: string,
  profile: Profile,
  bannedRoutes: string[],
  delay: { routeNumber: string; minutes: number } | null,
): RawEdgeUse[] | null {
  const best = new Map<string, Label>();
  const queue: { key: string; cost: number }[] = [];
  const startKey = stateKey(startId, null);
  best.set(startKey, {
    cost: 0,
    timeMin: 0,
    fareInr: 0,
    transfers: 0,
    prevKey: null,
    edgeUse: null,
  });
  queue.push({ key: startKey, cost: 0 });

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    const label = best.get(cur.key)!;
    if (cur.cost > label.cost + 1e-9) continue;
    const [curStopId, lastRouteRaw] = cur.key.split("|");
    const lastRoute = lastRouteRaw === "-" ? null : lastRouteRaw;

    if (curStopId === endId) break;

    for (const edge of adj.get(curStopId) ?? []) {
      if (
        edge.routeKey &&
        bannedRoutes.some(
          (r) => r === edge.routeKey || r === edge.routeNumber,
        )
      ) {
        continue;
      }

      let boardPenalty = 0;
      let transferred = false;
      let nextLastRoute = lastRoute;
      if (edge.routeKey) {
        if (edge.routeKey !== lastRoute) {
          boardPenalty +=
            edge.mode === "BUS" ? BUS_BOARD_MIN : METRO_BOARD_MIN;
          if (lastRoute !== null) transferred = true;
        }
        nextLastRoute = edge.routeKey;
      }

      let delayedBoard = false;
      if (
        delay &&
        edge.routeKey &&
        edge.routeNumber === delay.routeNumber &&
        edge.routeKey !== lastRoute
      ) {
        boardPenalty += delay.minutes;
        delayedBoard = true;
      }

      // Search-time fare proxy: exact fares are computed per merged leg later.
      // Bus charges flat per boarding; metro accrues ~₹3/km marginally so the
      // CHEAPEST profile compares continuous chains fairly.
      let fare = 0;
      if (edge.mode === "BUS") {
        if (edge.routeKey !== lastRoute) fare += BUS_FARE_INR;
      } else if (edge.mode === "SUBWAY") {
        fare += edge.km * 3;
      }

      const cost =
        label.cost +
        edge.minutes * profile.timeWeight +
        boardPenalty * profile.timeWeight +
        (transferred ? profile.transferPenalty : 0) +
        fare * profile.fareWeight;

      const nKey = stateKey(edge.toId, nextLastRoute);
      const nLabel: Label = {
        cost,
        timeMin: label.timeMin + edge.minutes + boardPenalty,
        fareInr: label.fareInr + fare,
        transfers: label.transfers + (transferred ? 1 : 0),
        prevKey: cur.key,
        edgeUse: { edge, fromId: curStopId, boardPenalty, transferred, delayedBoard },
      };
      const existing = best.get(nKey);
      if (!existing || cost < existing.cost - 1e-9) {
        best.set(nKey, nLabel);
        queue.push({ key: nKey, cost });
      }
    }
  }

  // Pick best terminal state among those reaching endId.
  let endKey: string | null = null;
  let endCost = Infinity;
  for (const key of best.keys()) {
    if (key.startsWith(`${endId}|`)) {
      const l = best.get(key)!;
      if (l.cost < endCost) {
        endCost = l.cost;
        endKey = key;
      }
    }
  }
  if (!endKey || endCost === Infinity) return null;

  const chain: RawEdgeUse[] = [];
  let k: string | null = endKey;
  while (k) {
    const l = best.get(k);
    if (!l) break;
    if (l.edgeUse) chain.unshift(l.edgeUse);
    k = l.prevKey;
  }
  return chain;
}

// ------------------------------------------------------- Itinerary build --

function refOf(id: string): StopRef {
  const s = nodeCoords.get(id);
  if (!s) throw new Error(`Unknown stop ${id}`);
  return s;
}

interface RawItinerary {
  chain: RawEdgeUse[];
  timeMin: number;
  fareInr: number;
  transfers: number;
}

function summarize(chain: RawEdgeUse[]): Omit<RawItinerary, "chain"> {
  let timeMin = 0;
  let fareInr = 0;
  const seenRoutes: string[] = [];
  let lastBoardedRoute: string | null = null;
  let subwayChainKm = 0;
  const flushSubway = () => {
    if (subwayChainKm > 0) {
      fareInr += metroFare(subwayChainKm);
      subwayChainKm = 0;
    }
  };
  for (const u of chain) {
    timeMin += u.edge.minutes + u.boardPenalty;
    if (u.edge.mode === "BUS") {
      flushSubway();
      if (u.edge.routeKey !== lastBoardedRoute) fareInr += BUS_FARE_INR;
    } else if (u.edge.mode === "SUBWAY") {
      subwayChainKm += u.edge.km;
    } else if (u.edge.km * 1000 > 50) {
      flushSubway();
    }
    if (u.edge.routeKey) lastBoardedRoute = u.edge.routeKey;
    if (u.edge.routeKey && !seenRoutes.includes(u.edge.routeKey)) {
      seenRoutes.push(u.edge.routeKey);
    }
  }
  flushSubway();
  return {
    timeMin,
    fareInr,
    transfers: Math.max(0, seenRoutes.length - 1),
  };
}

function signature(chain: RawEdgeUse[]): string {
  return chain
    .filter((u) => u.edge.routeKey)
    .map((u) => `${u.edge.mode}:${u.edge.routeKey}`)
    .join(">");
}

function buildLegs(
  chain: RawEdgeUse[],
  origin: Pt & { name: string },
  destination: Pt & { name: string },
  departAtMs: number,
  delay?: { routeNumber: string; minutes: number } | null,
): Leg[] {
  const legs: Leg[] = [];

  // Connector from origin to first network node, if needed.
  const first = chain[0];
  if (
    haversineMeters(origin, refOf(first.fromId)) > 1 ||
    origin.name !== refOf(first.fromId).name
  ) {
    const meters = haversineMeters(origin, refOf(first.fromId));
    if (meters >= 25) {
      legs.push(
        walkLeg(origin, refOf(first.fromId), meters, departAtMs),
      );
    }
  }

  let t = departAtMs + legs.reduce((acc, l) => acc + l.durationMinutes * 60000, 0);

  let i = 0;
  while (i < chain.length) {
    const u = chain[i];
    if (u.edge.mode === "WALK") {
      const pts: StopRef[] = [refOf(u.fromId)];
      let meters = 0;
      let j = i;
      while (j < chain.length && chain[j].edge.mode === "WALK") {
        pts.push(refOf(chain[j].edge.toId));
        meters += chain[j].edge.km * 1000;
        j++;
      }
      const start = pts[0];
      const end = pts[pts.length - 1];
      legs.push(walkLeg(start, end, meters, t));
      t += (meters / 1000 / WALK_KMH) * 60 * 60000;
      i = j;
    } else {
      const routeEdges: RawEdgeUse[] = [];
      let j = i;
      while (
        j < chain.length &&
        chain[j].edge.mode === u.edge.mode &&
        chain[j].edge.routeKey === u.edge.routeKey
      ) {
        routeEdges.push(chain[j]);
        j++;
      }
      const from = refOf(routeEdges[0].fromId);
      const to = refOf(routeEdges[routeEdges.length - 1].edge.toId);
      const intermediate = routeEdges.slice(0, -1).map((r) => refOf(r.edge.toId));
      // Buses dwell at each intermediate stop (~36 s); metro speeds already
      // include dwell.
      const dwellMin =
        u.edge.mode === "BUS" ? intermediate.length * BUS_DWELL_MIN : 0;
      const pureMin =
        routeEdges.reduce((a, r) => a + r.edge.minutes, 0) + dwellMin;
      const waitMin = routeEdges[0].boardPenalty;
      const totalMin = pureMin + waitMin;
      const delayed = routeEdges.some((r) => r.delayedBoard);
      // Exact leg fare: flat per bus boarding; metro slab over the whole
      // continuous chain (interchange walks <50 m don't split the fare chain).
      const legKm = routeEdges.reduce((a, r) => a + r.edge.km, 0);
      const fareInr =
        u.edge.mode === "BUS" ? BUS_FARE_INR : metroFare(legKm);
      const poly: [number, number][] = [
        [from.lat, from.lon],
        ...intermediate.map((s) => [s.lat, s.lon] as [number, number]),
        [to.lat, to.lon],
      ];
      legs.push({
        mode: u.edge.mode,
        routeId: u.edge.routeKey!,
        routeNumber: u.edge.routeNumber,
        routeName: u.edge.routeName,
        routeColor: u.edge.routeColor,
        headsign: u.edge.headsign,
        from,
        to,
        intermediateStops: intermediate,
        departAt: new Date(t).toISOString(),
        arriveAt: new Date(t + totalMin * 60000).toISOString(),
        durationMinutes: totalMin,
        waitMinutes: waitMin,
        fareInr,
        polyline: poly,
        provenance: "DEMO",
        ...(delayed && delay ? { delayMinutes: delay.minutes } : {}),
      });
      t += totalMin * 60000;
      i = j;
    }
  }

  // Connector from last network node to destination.
  const lastLegEnd =
    legs.length > 0 ? legs[legs.length - 1].to : refOf(chain[chain.length - 1].fromId);
  const destMeters = haversineMeters(lastLegEnd, destination);
  if (destMeters >= 25) {
    legs.push(walkLeg(lastLegEnd, { ...destination, id: "dest", name: destination.name }, destMeters, t));
  }

  return legs;
}

function walkLeg(
  from: Pt & { id?: string; name?: string },
  to: Pt & { id?: string; name?: string },
  meters: number,
  startMs: number,
): Leg {
  const minutes = (meters / 1000 / WALK_KMH) * 60;
  return {
    mode: "WALK",
    from: {
      id: from.id ?? "origin",
      name: from.name ?? "Start",
      lat: from.lat,
      lon: from.lon,
    },
    to: {
      id: to.id ?? "destination",
      name: to.name ?? "Destination",
      lat: to.lat,
      lon: to.lon,
    },
    intermediateStops: [],
    departAt: new Date(startMs).toISOString(),
    arriveAt: new Date(startMs + minutes * 60000).toISOString(),
    durationMinutes: minutes,
    walkingMeters: meters,
    polyline: [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ],
    provenance: "SCHEDULED",
  };
}

function toJourney(
  chain: RawEdgeUse[],
  origin: Pt & { name: string },
  destination: Pt & { name: string },
  opts: Required<Pick<PlanOptions, "departAtMs">> & {
    delay?: PlanOptions["delay"];
    label: JourneyLabel;
  },
): Journey | null {
  if (chain.length === 0) return null;
  const legs = buildLegs(chain, origin, destination, opts.departAtMs, opts.delay ?? null);
  if (legs.length === 0) return null;
  const s = summarize(chain);
  const hasTransit = legs.some((l) => l.mode !== "WALK");
  const durationMinutes =
    (new Date(legs[legs.length - 1].arriveAt).getTime() -
      new Date(legs[0].departAt).getTime()) /
    60000;
  const sig = signature(chain);
  const bucket = Math.floor(opts.departAtMs / 60000).toString(36);
  const id = `j${hash(sig)}${bucket}`;
  return {
    id,
    label: opts.label,
    departAt: legs[0].departAt,
    arriveAt: legs[legs.length - 1].arriveAt,
    durationMinutes,
    fareInr: Math.round(legs.reduce((a, l) => a + (l.fareInr ?? 0), 0)),
    // Sum from the built legs, not the graph chain: access/egress walks are
    // synthesized outside the chain, so chain-only totals miss them entirely.
    walkingMeters: Math.round(
      legs.reduce((a, l) => a + (l.walkingMeters ?? 0), 0),
    ),
    transfers: s.transfers,
    legs,
    provenance: hasTransit ? "DEMO" : "SCHEDULED",
    disrupted: legs.some((l) => typeof l.delayMinutes === "number"),
  };
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// ---------------------------------------------------------- Auto fallback --

/** Below this direct distance an auto is never offered (walk instead). */
const AUTO_FALLBACK_MIN_METERS = 300;

interface AutoPlace extends Pt {
  id?: string;
  name?: string;
}

/**
 * Door-to-door auto-rickshaw itinerary for trips the PT network cannot serve
 * when walking would exceed AUTO_WALK_THRESHOLD_MIN. Deliberately outside the
 * graph machinery: no edges, no routeKey, so dedupe/ban logic never sees it.
 */
function buildAutoJourney(
  origin: AutoPlace,
  destination: AutoPlace,
  departAtMs: number,
): Journey {
  const km = haversineMeters(origin, destination) / 1000;
  const directWalkMin = (km / WALK_KMH) * 60;
  const durationMinutes = Math.round(
    AUTO_BOARD_MIN + (km / AUTO_SPEED_KMH) * 60,
  );
  const departAt = new Date(departAtMs).toISOString();
  const arriveAt = new Date(departAtMs + durationMinutes * 60000).toISOString();
  const fareInr = autoFare(km);
  const leg: Leg = {
    mode: "AUTO",
    routeColor: "#d97706",
    from: {
      id: origin.id ?? "origin",
      name: origin.name ?? "Start",
      lat: origin.lat,
      lon: origin.lon,
    },
    to: {
      id: destination.id ?? "destination",
      name: destination.name ?? "Destination",
      lat: destination.lat,
      lon: destination.lon,
    },
    intermediateStops: [],
    departAt,
    arriveAt,
    durationMinutes,
    waitMinutes: AUTO_BOARD_MIN,
    fareInr,
    polyline: [
      [origin.lat, origin.lon],
      [destination.lat, destination.lon],
    ],
    provenance: "DEMO",
  };
  return {
    id: `auto:${leg.from.id}:${leg.to.id}`,
    label: "RECOMMENDED",
    departAt,
    arriveAt,
    durationMinutes,
    fareInr,
    walkingMeters: 0,
    transfers: 0,
    legs: [leg],
    provenance: "DEMO",
    disrupted: false,
    why: [
      "No bus or metro serves this trip directly",
      `Saves about ${Math.round(directWalkMin - durationMinutes)} min vs walking`,
      "Fare is a metered-rate estimate",
    ],
  };
}

/** The single product rule gating the auto option. */
function autoFallback(
  origin: AutoPlace,
  destination: AutoPlace,
  departAtMs: number,
): Journey[] {
  const meters = haversineMeters(origin, destination);
  const directWalkMin = (meters / 1000 / WALK_KMH) * 60;
  if (meters <= AUTO_FALLBACK_MIN_METERS || directWalkMin <= AUTO_WALK_THRESHOLD_MIN) {
    return [];
  }
  return [buildAutoJourney(origin, destination, departAtMs)];
}

// ------------------------------------------- Auto first/last mile assist --

/** Stable identity for dedupe across the normal and wide-radius passes. */
function legSignature(j: Journey): string {
  return j.legs
    .map((l) => `${l.mode}:${l.routeNumber ?? ""}:${l.from.id}>${l.to.id}`)
    .join("|");
}

/**
 * Replace an over-long access or egress walk with an auto ride. The transit in
 * the middle is untouched - this only changes how the rider reaches and leaves
 * the network, which is exactly the gap a metro-only pilot network leaves.
 */
function toAutoAssisted(j: Journey): Journey | null {
  const legs: Leg[] = j.legs.map((l) => ({ ...l }));
  let changed = false;

  const convert = (idx: number) => {
    const l = legs[idx];
    if (!l || l.mode !== "WALK") return;
    const meters = l.walkingMeters ?? 0;
    if (meters <= AUTO_SWITCH_METERS) return;
    const km = meters / 1000;
    const next: Leg = {
      ...l,
      mode: "AUTO",
      routeColor: "#d97706",
      durationMinutes: AUTO_BOARD_MIN + (km / AUTO_SPEED_KMH) * 60,
      waitMinutes: AUTO_BOARD_MIN,
      fareInr: autoFare(km),
      provenance: "DEMO",
    };
    delete next.walkingMeters;
    legs[idx] = next;
    changed = true;
  };

  convert(0);
  if (legs.length > 1) convert(legs.length - 1);
  if (!changed) return null;

  // Every time in this planner is sequential, so re-time from the top.
  const startMs = new Date(j.departAt).getTime();
  let t = startMs;
  for (const l of legs) {
    l.departAt = new Date(t).toISOString();
    t += l.durationMinutes * 60000;
    l.arriveAt = new Date(t).toISOString();
  }

  return {
    ...j,
    id: `${j.id}a`,
    label: "ALTERNATIVE",
    departAt: legs[0].departAt,
    arriveAt: legs[legs.length - 1].arriveAt,
    durationMinutes: (t - startMs) / 60000,
    fareInr: Math.round(legs.reduce((a, l) => a + (l.fareInr ?? 0), 0)),
    walkingMeters: Math.round(
      legs.reduce((a, l) => a + (l.walkingMeters ?? 0), 0),
    ),
    legs,
    provenance: "DEMO",
  };
}

/**
 * What to return when nothing on the network is walkable: an auto to the
 * nearest boardable stop if that beats riding the whole way, plus the
 * door-to-door auto itself.
 */
function autoOnlyOptions(input: PlanInput, departAtMs: number): Journey[] {
  const assisted = autoAssistJourneys(input, []);
  const pure = autoFallback(input.origin, input.destination, departAtMs);
  const all = [...assisted, ...pure];
  if (all.length === 0) return [];

  // Same balanced trade-off the main path uses, so a slightly slower but much
  // cheaper auto+metro option is not buried under a straight auto ride.
  const score = (j: Journey) => j.durationMinutes + j.fareInr * 0.04;
  const ranked = [...all].sort((a, b) => score(a) - score(b));
  const picked = ranked.slice(0, 2).map((j, i) => {
    if (i === 0) return { ...j, label: "RECOMMENDED" as JourneyLabel };
    const label: JourneyLabel =
      j.fareInr < ranked[0].fareInr ? "CHEAPEST" : "ALTERNATIVE";
    return { ...j, label };
  });
  return picked.map((j) => ({ ...j, why: explainJourney(j, picked) }));
}

/** True when an itinerary makes the rider walk further than we want to ask. */
function needsAutoAssist(j: Journey): boolean {
  if (j.walkingMeters > AUTO_ASSIST_TRIGGER_METERS) return true;
  const ends = [j.legs[0], j.legs[j.legs.length - 1]];
  return ends.some(
    (l) =>
      l !== undefined &&
      l.mode === "WALK" &&
      (l.walkingMeters ?? 0) > AUTO_SWITCH_METERS,
  );
}

/**
 * Auto-assisted itineraries: auto for the first/last mile, transit for the
 * long middle. Re-runs the planner with a much wider connector radius so stops
 * an auto can reach - but a rider cannot reasonably walk to - become boardable,
 * then converts those long access walks into auto legs.
 */
function autoAssistJourneys(input: PlanInput, existing: Journey[]): Journey[] {
  if (input.autoAccess) return []; // the wide pass must not recurse
  const wide = planJourneys({
    ...input,
    autoAccess: true,
    maxWalkMeters: AUTO_ACCESS_MAX_METERS,
  });

  const seen = new Set(existing.map(legSignature));
  const out: Journey[] = [];
  for (const j of wide) {
    // Skip the pure door-to-door auto: that is the fallback, not an assist.
    if (j.legs.every((l) => l.mode === "AUTO")) continue;
    const assisted = toAutoAssisted(j);
    if (!assisted) continue;
    const hasTransit = assisted.legs.some(
      (l) => l.mode === "BUS" || l.mode === "SUBWAY",
    );
    const hasAuto = assisted.legs.some((l) => l.mode === "AUTO");
    if (!hasTransit || !hasAuto) continue;
    const sig = legSignature(assisted);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(assisted);
  }
  out.sort((a, b) => a.durationMinutes - b.durationMinutes);
  return out.slice(0, 1);
}

// ------------------------------------------------------------- Public -----

export interface PlanInput {
  /**
   * Internal: widen the connector search so an auto can cover the first/last
   * mile. Set only by the auto-assist pass, which must not recurse.
   */
  autoAccess?: boolean;
  /**
   * Hard cap on interchanges, from a stated rider constraint (a wheelchair
   * user, heavy bags, a small child). Applied only when something actually
   * satisfies it - a preference must never turn a usable answer into none.
   */
  maxTransfers?: number;
  origin: Pt & { name: string };
  destination: Pt & { name: string };
  maxWalkMeters?: number;
  departAtMs?: number;
  delay?: { routeNumber: string; minutes: number } | null;
}

/** Plan up to three distinct itineraries: Recommended / Fastest / Cheapest. */
export function planJourneys(input: PlanInput): Journey[] {
  const maxWalk = input.maxWalkMeters ?? DEFAULT_MAX_WALK_METERS;
  buildGraph(Math.min(maxWalk, INTERCHANGE_WALK_MAX_METERS));
  const departAtMs = input.departAtMs ?? Date.now();
  const delay = input.delay ?? null;

  const connectorCap = input.autoAccess
    ? AUTO_ACCESS_MAX_METERS
    : CONNECTOR_MAX_METERS;
  const startCandidates = connectorsNear(input.origin, maxWalk, connectorCap);
  const endCandidates = connectorsNear(
    input.destination,
    maxWalk,
    connectorCap,
  );
  if (!startCandidates.length || !endCandidates.length) {
    if (input.autoAccess) return [];
    return autoOnlyOptions(input, departAtMs);
  }

  // Virtual super-source / super-sink via multi-start: run Dijkstra from each
  // candidate (graph is tiny) and take the overall best per profile.
  const runProfile = (
    name: ProfileName,
    bannedRoutes: string[],
  ): RawItinerary | null => {
    const profile = PROFILES[name];
    let bestChain: RawEdgeUse[] | null = null;
    let bestCost = Infinity;
    for (const s of startCandidates) {
      for (const e of endCandidates) {
        if (s.id === e.id) continue;
        const chain = dijkstra(s.id, e.id, profile, bannedRoutes, delay);
        if (!chain || !chain.length) continue;
        const c = summarize(chain);
        const cost =
          c.timeMin * profile.timeWeight +
          c.transfers * profile.transferPenalty +
          c.fareInr * profile.fareWeight;
        if (cost < bestCost) {
          bestCost = cost;
          bestChain = chain;
        }
      }
    }
    if (!bestChain) return null;
    return { chain: bestChain, ...summarize(bestChain) };
  };

  // Gather distinct candidates from the three profiles, then iteratively ban
  // routes used by accepted results until we have up to five candidates.
  const candidates: RawItinerary[] = [];
  const seenSigs = new Set<string>();
  const accept = (raw: RawItinerary | null) => {
    if (!raw) return false;
    const sig = signature(raw.chain);
    if (seenSigs.has(sig)) return false;
    seenSigs.add(sig);
    candidates.push(raw);
    return true;
  };

  accept(runProfile("RECOMMENDED", []));
  accept(runProfile("FASTEST", []));
  accept(runProfile("CHEAPEST", []));

  let banPass = 0;
  while (
    candidates.length < 5 &&
    banPass < 4 &&
    candidates[banPass] !== undefined
  ) {
    const source = candidates[banPass];
    const transitRoutes = [
      ...new Set(
        source.chain
          .filter((u) => u.edge.routeKey)
          .map((u) => u.edge.routeKey!),
      ),
    ];
    if (!transitRoutes.length) break;
    const alt = runProfile("RECOMMENDED", transitRoutes);
    accept(alt);
    banPass++;
  }

  if (candidates.length === 0) {
    if (input.autoAccess) return [];
    return autoOnlyOptions(input, departAtMs);
  }

  // Build full journeys once, then label semantically by actual properties.
  const journeys = candidates
    .map(
      (raw) =>
        toJourney(raw.chain, input.origin, input.destination, {
          departAtMs,
          delay,
          label: "ALTERNATIVE",
        })!,
    )
    .filter((j): j is Journey => j !== null);

  const balancedScore = (j: Journey) =>
    j.durationMinutes + j.transfers * 3 + j.fareInr * 0.04;

  // Labels are assigned semantically and never lie about the set:
  // RECOMMENDED = best balanced score; FASTEST/CHEAPEST only when a DIFFERENT
  // journey truly holds that title.
  const byDuration = [...journeys].sort(
    (a, b) => a.durationMinutes - b.durationMinutes,
  );
  const byFare = [...journeys].sort(
    (a, b) => a.fareInr - b.fareInr || a.durationMinutes - b.durationMinutes,
  );

  const labeled: Journey[] = [];
  const used = new Set<string>();

  const recommended = [...journeys].sort(
    (a, b) => balancedScore(a) - balancedScore(b),
  )[0];
  if (recommended) {
    labeled.push({ ...recommended, label: "RECOMMENDED" });
    used.add(recommended.id);
  }

  const fastest = byDuration[0];
  if (fastest && !used.has(fastest.id)) {
    labeled.push({ ...fastest, label: "FASTEST" });
    used.add(fastest.id);
  }

  const cheapest = byFare[0];
  if (cheapest && !used.has(cheapest.id)) {
    labeled.push({ ...cheapest, label: "CHEAPEST" });
    used.add(cheapest.id);
  }

  for (const j of byDuration) {
    if (labeled.length >= 3) break;
    if (!used.has(j.id)) {
      labeled.push({ ...j, label: "ALTERNATIVE" });
      used.add(j.id);
    }
  }

  // If the walk to or from the network is long, offer an auto-assisted variant
  // beside it rather than silently asking the rider for a 20-minute walk.
  const assisted = labeled.some(needsAutoAssist)
    ? autoAssistJourneys(input, labeled)
    : [];
  let finalSet = labeled;
  if (assisted.length) {
    finalSet = [...labeled.slice(0, 2), ...assisted].slice(0, 3);
  }

  // Apply the transfer cap before generating reasons, so comparative claims
  // ("cheapest") stay true within the set the rider is actually shown.
  const capped = applyTransferCap(finalSet, input.maxTransfers);
  return capped.map((j) => ({ ...j, why: explainJourney(j, capped) }));
}

/**
 * Keep only itineraries within the rider's stated interchange limit - unless
 * none qualify, in which case we return everything rather than an empty list
 * and let the caller tell the rider the constraint could not be met.
 */
function applyTransferCap(journeys: Journey[], maxTransfers?: number): Journey[] {
  if (typeof maxTransfers !== "number") return journeys;
  const within = journeys.filter((j) => j.transfers <= maxTransfers);
  return within.length > 0 ? within : journeys;
}

/**
 * Deterministic, honest reasons an option was surfaced — generated AFTER
 * selection so comparative claims ("cheapest") are always true within the
 * returned set.
 */
function explainJourney(j: Journey, all: Journey[]): string[] {
  // The door-to-door auto fallback carries its own, more specific reasons.
  if (j.legs.every((l) => l.mode === "AUTO") && j.why?.length) return j.why;

  const why: string[] = [];
  if (
    j.legs.some((l) => l.mode === "AUTO") &&
    j.legs.some((l) => l.mode === "BUS" || l.mode === "SUBWAY")
  ) {
    why.push("Auto for the first mile, then transit");
  }
  const minFare = Math.min(...all.map((o) => o.fareInr));
  const minDuration = Math.min(...all.map((o) => o.durationMinutes));

  if (j.fareInr === minFare && all.length > 1) why.push("Cheapest option");
  if (j.durationMinutes === minDuration && all.length > 1) {
    why.push("Fastest arrival");
  }
  if (j.transfers === 0) why.push("No transfers — one-seat ride");
  if (j.legs.some((l) => l.mode === "SUBWAY")) {
    why.push("Metro skips road traffic");
  }
  if (j.walkingMeters < 300) why.push("Minimal walking");
  if (j.legs.some((l) => l.mode === "BUS")) {
    why.push("Includes a bus leg with demo vehicle tracking");
  }
  return why.slice(0, 3);
}

/** Network stops reachable on foot from an arbitrary point. */
function connectorsNear(
  p: Pt,
  maxWalkMeters: number,
  hardCapMeters: number = CONNECTOR_MAX_METERS,
): StopRef[] {
  const out: { ref: StopRef; d: number }[] = [];
  for (const s of nodeCoords.values()) {
    const d = haversineMeters(p, s);
    if (d <= Math.min(hardCapMeters, maxWalkMeters)) {
      out.push({ ref: s, d });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, 8).map((o) => o.ref);
}
