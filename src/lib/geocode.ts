import type { PlaceResult } from "./types";
import { DELHI_BOUNDS } from "./service-area";

const DEFAULT_GEOCODER_URL = "https://photon.komoot.io/api/";
const USER_AGENT =
  "BharaTransit/0.1 (https://github.com/pranavdhawann/Transit_Bharat)";

interface PhotonFeature {
  geometry?: { type?: string; coordinates?: unknown[] };
  properties?: Record<string, unknown>;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

const memoryCache = new Map<string, { expires: number; places: PlaceResult[] }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

/**
 * Search user-entered Delhi addresses through a swappable Photon-compatible
 * endpoint. Failure is deliberately soft: the local stop index remains usable.
 */
export async function searchGeocodedPlaces(
  query: string,
  limit = 6,
  fetcher: typeof fetch = fetch,
): Promise<PlaceResult[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 3) return [];

  const key = `${q.toLocaleLowerCase("en-IN")}:${limit}`;
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.places;

  const base = process.env.GEOCODER_BASE_URL ?? DEFAULT_GEOCODER_URL;
  const url = new URL(base);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(Math.min(10, Math.max(1, limit))));
  url.searchParams.set("lang", /[\u0900-\u097f]/u.test(q) ? "hi" : "en");
  url.searchParams.set("lat", "28.6139");
  url.searchParams.set("lon", "77.2090");
  url.searchParams.set(
    "bbox",
    [
      DELHI_BOUNDS.minLon,
      DELHI_BOUNDS.minLat,
      DELHI_BOUNDS.maxLon,
      DELHI_BOUNDS.maxLat,
    ].join(","),
  );

  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
      signal: AbortSignal.timeout(3_000),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as PhotonResponse;
    const places = parsePhotonResults(data, limit);
    memoryCache.set(key, { expires: Date.now() + CACHE_MS, places });
    return places;
  } catch {
    return [];
  }
}

export function parsePhotonResults(
  data: PhotonResponse,
  limit = 6,
): PlaceResult[] {
  const out: PlaceResult[] = [];
  const seen = new Set<string>();

  for (const feature of data.features ?? []) {
    const coordinates = feature.geometry?.coordinates;
    const p = feature.properties ?? {};
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const lon = coordinates[0];
    const lat = coordinates[1];
    const name = cleanText(p.name);
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < DELHI_BOUNDS.minLat ||
      lat > DELHI_BOUNDS.maxLat ||
      lon < DELHI_BOUNDS.minLon ||
      lon > DELHI_BOUNDS.maxLon ||
      !isDelhiFeature(p) ||
      !name
    ) {
      continue;
    }

    const detailParts = [
      cleanText(p.street),
      cleanText(p.district),
      cleanText(p.city),
    ].filter((part, index, all) => part && all.indexOf(part) === index);
    const osmType = cleanText(p.osm_type) || "place";
    const osmId =
      typeof p.osm_id === "number" || typeof p.osm_id === "string"
        ? String(p.osm_id)
        : `${lat.toFixed(6)},${lon.toFixed(6)}`;
    const id = `geo:${osmType}:${osmId}`;
    const duplicateKey = `${name.toLocaleLowerCase("en-IN")}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    out.push({
      id,
      name,
      type: "address",
      lat,
      lon,
      detail: detailParts.join(" · ") || "Delhi address · OpenStreetMap",
    });
    if (out.length >= limit) break;
  }
  return out;
}

function isDelhiFeature(properties: Record<string, unknown>): boolean {
  const administrativeText = [
    properties.city,
    properties.district,
    properties.county,
    properties.state,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("en-IN");
  return administrativeText.includes("delhi") || properties.state === "DL";
}

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
    : "";
}
