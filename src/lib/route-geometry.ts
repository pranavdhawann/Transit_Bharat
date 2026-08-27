import { totalMeters, type Polyline } from "./geo";
import type { Leg, Mode } from "./types";

const USER_AGENT =
  "BharaTransit/0.1 (https://github.com/pranavdhawann/Transit_Bharat)";
const DEFAULT_FOOT_ROUTER = "https://routing.openstreetmap.de/routed-foot";
const DEFAULT_CAR_ROUTER = "https://routing.openstreetmap.de/routed-car";

const DELHI_GUARD = { minLat: 28.2, maxLat: 29.15, minLon: 76.7, maxLon: 77.7 };
const memoryCache = new Map<string, RoutedShape>();

export interface ShapeInput {
  mode: Mode;
  polyline: Polyline;
}

export interface RoutedShape {
  polyline: Polyline;
  source: "ROUTED" | "NETWORK" | "APPROXIMATE";
}

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    geometry?: { type?: string; coordinates?: unknown[] };
  }>;
}

export function validShapeInput(value: unknown): value is ShapeInput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (!(["WALK", "AUTO", "BUS", "SUBWAY"] as unknown[]).includes(candidate.mode)) {
    return false;
  }
  if (!Array.isArray(candidate.polyline) || candidate.polyline.length < 2 || candidate.polyline.length > 40) {
    return false;
  }
  return candidate.polyline.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      validDelhiCoordinate(point[0], point[1]),
  );
}

/**
 * Follow mapped streets for walking, auto and bus legs. Metro geometry keeps
 * its ordered station chain because a road router would be less truthful.
 */
export async function routeLegGeometry(
  input: ShapeInput,
  fetcher: typeof fetch = fetch,
): Promise<RoutedShape> {
  if (input.mode === "SUBWAY") {
    return { polyline: input.polyline, source: "NETWORK" };
  }
  if (!validShapeInput(input) || totalMeters(input.polyline) < 5) {
    return { polyline: input.polyline, source: "APPROXIMATE" };
  }

  const points = samplePoints(input.polyline, 24);
  const key = `${input.mode}:${points.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(";")}`;
  const cached = memoryCache.get(key);
  if (cached) return cached;

  const base =
    input.mode === "WALK"
      ? (process.env.ROUTING_FOOT_URL ?? DEFAULT_FOOT_ROUTER)
      : (process.env.ROUTING_CAR_URL ?? DEFAULT_CAR_ROUTER);
  const coordinates = points.map(([lat, lon]) => `${lon},${lat}`).join(";");
  const url = new URL(`${base.replace(/\/$/, "")}/route/v1/driving/${coordinates}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(3_500),
      next: { revalidate: 604_800 },
    });
    if (!response.ok) throw new Error("router unavailable");
    const data = (await response.json()) as OsrmResponse;
    const raw = data.routes?.[0]?.geometry?.coordinates;
    const routed = parseCoordinates(raw);
    if (data.code !== "Ok" || routed.length < 2 || !plausibleRoute(input.polyline, routed)) {
      throw new Error("invalid route geometry");
    }
    const result: RoutedShape = { polyline: routed, source: "ROUTED" };
    memoryCache.set(key, result);
    return result;
  } catch {
    return { polyline: input.polyline, source: "APPROXIMATE" };
  }
}

export async function routeLegsGeometry(
  legs: Pick<Leg, "mode" | "polyline">[],
  fetcher: typeof fetch = fetch,
): Promise<RoutedShape[]> {
  const out: RoutedShape[] = new Array(legs.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, legs.length) }, async () => {
    while (cursor < legs.length) {
      const index = cursor++;
      out[index] = await routeLegGeometry(legs[index], fetcher);
    }
  });
  await Promise.all(workers);
  return out;
}

function parseCoordinates(value: unknown): Polyline {
  if (!Array.isArray(value)) return [];
  const out: Polyline = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) return [];
    const lon = point[0];
    const lat = point[1];
    if (!validDelhiCoordinate(lat, lon)) return [];
    out.push([lat, lon]);
  }
  return out;
}

function validDelhiCoordinate(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lon === "number" &&
    Number.isFinite(lon) &&
    lat >= DELHI_GUARD.minLat &&
    lat <= DELHI_GUARD.maxLat &&
    lon >= DELHI_GUARD.minLon &&
    lon <= DELHI_GUARD.maxLon
  );
}

function plausibleRoute(original: Polyline, routed: Polyline): boolean {
  const originalMeters = totalMeters(original);
  const routedMeters = totalMeters(routed);
  return routedMeters <= Math.max(2_000, originalMeters * 4.5);
}

function samplePoints(polyline: Polyline, maxPoints: number): Polyline {
  if (polyline.length <= maxPoints) return polyline;
  const sampled: Polyline = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(polyline[Math.round((i * (polyline.length - 1)) / (maxPoints - 1))]);
  }
  return sampled;
}
