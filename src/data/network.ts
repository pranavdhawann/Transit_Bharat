/**
 * Delhi pilot network - derived from REAL agency data.
 *
 * Metro lines and bus corridors are generated from the official
 * Delhi Open Transit Data GTFS snapshots by `scripts/ingest-gtfs.mjs`
 * (see DATA_SOURCES.md for provenance). The curated arrays at the bottom are
 * a fallback used only if the generated files are missing or malformed.
 *
 * All vehicle movement simulated on top of this network is synthetic (DEMO).
 */
import metroLinesJson from "./generated/metro-lines.json";
import busCorridorsJson from "./generated/bus-corridors.json";

export interface NetworkStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface MetroLine {
  id: string;
  name: string;
  shortName: string;
  color: string;
  speedKmh: number; // effective incl. dwell
  stations: NetworkStop[]; // ordered along the line
}

export interface BusRoute {
  id: string;
  number: string;
  name: string;
  color: string;
  speedKmh: number; // effective incl. traffic + dwell
  cycleMinutes: number; // full out-and-back round trip for simulation
  vehicles: number;
  stops: NetworkStop[]; // ordered along the route
}

export const WALK_KMH = 4.8;
export const BUS_BOARD_MIN = 2.5; // average wait to board a bus
export const METRO_BOARD_MIN = 3.5; // security + platform wait
export const TRANSFER_PENALTY_MIN = 2;
/** Average time a bus loses at an intermediate stop. */
export const BUS_DWELL_MIN = 0.6;
/**
 * Central Delhi (roughly south of the Ring North / Connaught Place grid)
 * traffic penalty applied to bus segment speeds — buses crawl there at rush
 * hour while the metro is unaffected. Disclosed in LIMITATIONS.md.
 */
export const CENTRAL_DELHI_LAT = 28.6;
export const CENTRAL_BUS_SPEED_FACTOR = 0.8;

// ------------------------------------------------------------- Loading ----

function isStopArray(v: unknown): v is NetworkStop[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (s) =>
        typeof (s as NetworkStop).id === "string" &&
        typeof (s as NetworkStop).name === "string" &&
        typeof (s as NetworkStop).lat === "number",
    )
  );
}

const BUS_PALETTE = ["#2563eb", "#0d9488", "#b45309", "#7c3aed", "#be185d"];

function loadMetroLines(): MetroLine[] {
  if (!Array.isArray(metroLinesJson) || metroLinesJson.length === 0) {
    return CURATED_METRO_LINES;
  }
  const lines: MetroLine[] = [];
  for (const raw of metroLinesJson as unknown as Array<Record<string, unknown>>) {
    if (!isStopArray(raw.stations)) continue;
    const name = typeof raw.name === "string" ? raw.name : "Line";
    lines.push({
      id: typeof raw.id === "string" ? raw.id : name.toLowerCase().replace(/\s+/g, "-"),
      name,
      shortName: name.replace(/\s*Line.*$/u, "").trim() || name,
      color: typeof raw.color === "string" ? raw.color : "#607d8b",
      speedKmh: typeof raw.speedKmh === "number" ? raw.speedKmh : 33,
      stations: raw.stations,
    });
  }
  return lines.length ? lines : CURATED_METRO_LINES;
}

function loadBusRoutes(): BusRoute[] {
  if (!Array.isArray(busCorridorsJson) || busCorridorsJson.length === 0) {
    return CURATED_BUS_ROUTES;
  }
  const routes: BusRoute[] = [];
  let i = 0;
  for (const raw of busCorridorsJson as unknown as Array<Record<string, unknown>>) {
    if (!isStopArray(raw.stops)) continue;
    const number = typeof raw.number === "string" ? raw.number : String(i + 1);
    routes.push({
      id: typeof raw.id === "string" ? raw.id : `bus:${number}`,
      number,
      name: typeof raw.name === "string" ? raw.name : `Corridor ${number}`,
      color: BUS_PALETTE[i % BUS_PALETTE.length],
      speedKmh: typeof raw.speedKmh === "number" ? raw.speedKmh : 16,
      cycleMinutes:
        typeof raw.cycleMinutes === "number" ? raw.cycleMinutes : 60,
      vehicles: typeof raw.vehicles === "number" ? raw.vehicles : 4,
      stops: raw.stops,
    });
    i++;
  }
  return routes.length ? routes : CURATED_BUS_ROUTES;
}

// ------------------------------------------- Real-data network (primary) ---

export const METRO_LINES: MetroLine[] = loadMetroLines();
export const BUS_ROUTES: BusRoute[] = loadBusRoutes();

/** The corridor used by the scripted demo disruption. */
export const PRIMARY_BUS_NUMBER = BUS_ROUTES[0]?.number ?? "620";

// ------------------------------------------------------------ Landmarks ---

export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lon: number;
  aliases?: string[];
}

export const LANDMARKS: Landmark[] = [
  {
    id: "lm:connaught-place",
    name: "Connaught Place",
    lat: 28.6315,
    lon: 77.2167,
    aliases: ["CP", "कनॉट प्लेस", "Rajiv Chowk", "Regal"],
  },
  {
    id: "lm:india-gate",
    name: "India Gate",
    lat: 28.6129,
    lon: 77.2295,
    aliases: ["इंडिया गेट"],
  },
  {
    id: "lm:red-fort",
    name: "Red Fort",
    lat: 28.6562,
    lon: 77.241,
    aliases: ["Lal Qila", "लाल किला"],
  },
  {
    id: "lm:jama-masjid",
    name: "Jama Masjid",
    lat: 28.6507,
    lon: 77.2334,
    aliases: ["जामा मस्जिद"],
  },
  {
    id: "lm:new-delhi-railway",
    name: "New Delhi Railway Station",
    lat: 28.6425,
    lon: 77.2199,
    aliases: ["NDLS", "नई दिल्ली रेलवे स्टेशन"],
  },
  {
    id: "lm:aiims-hospital",
    name: "AIIMS Hospital",
    lat: 28.5672,
    lon: 77.21,
    aliases: ["एम्स", "All India Institute of Medical Sciences"],
  },
  {
    id: "lm:iit-delhi",
    name: "IIT Delhi Main Gate",
    lat: 28.547,
    lon: 77.17,
    aliases: ["IIT", "आईआईटी दिल्ली"],
  },
  {
    id: "lm:munirka-market",
    name: "Munirka",
    lat: 28.558,
    lon: 77.1765,
    aliases: ["Munirka Village", "मुनिरका"],
  },
  {
    id: "lm:nehru-place-market",
    name: "Nehru Place Tech Market",
    lat: 28.5495,
    lon: 77.251,
    aliases: ["नेहरू प्लेस"],
  },
  {
    id: "lm:kashmere-gate-isbt",
    name: "Kashmere Gate ISBT",
    lat: 28.6672,
    lon: 77.2282,
    aliases: ["ISBT", "कश्मीरी गेट"],
  },
  {
    id: "lm:lotus-temple",
    name: "Lotus Temple",
    lat: 28.5535,
    lon: 77.2588,
    aliases: ["Bahai Temple", "बहाई मंदिर"],
  },
  {
    id: "lm:hauz-khas-village",
    name: "Hauz Khas Village",
    lat: 28.5535,
    lon: 77.1947,
    aliases: ["HKV", "हौज़ ख़ास"],
  },
];

// ------------------------------------------------------------- Helpers ----

/** Fare slabs (indicative Delhi metro-style), returns INR estimate. */
export function metroFare(km: number): number {
  if (km <= 2) return 10;
  if (km <= 5) return 20;
  if (km <= 12) return 30;
  if (km <= 21) return 40;
  if (km <= 32) return 50;
  return 60;
}

/** Flat indicative bus fare estimate. */
export const BUS_FARE_INR = 20;

export const DEFAULT_MAX_WALK_METERS = 1500;
export const LESS_WALK_MAX_METERS = 800;
/** Max meters between two stops to treat as an in-person walking transfer. */
export const INTERCHANGE_WALK_MAX_METERS = 700;
/** Max meters from an arbitrary origin/destination point to the network. */
export const CONNECTOR_MAX_METERS = 1800;

export function allStops(): NetworkStop[] {
  const seen = new Map<string, NetworkStop>();
  for (const line of METRO_LINES) for (const s of line.stations) seen.set(s.id, s);
  for (const route of BUS_ROUTES) for (const s of route.stops) seen.set(s.id, s);
  return [...seen.values()];
}

// ------------------------------------------------- Curated fallback data --

const CURATED_METRO_LINES: MetroLine[] = [
  {
    id: "metro:yellow",
    name: "Yellow Line",
    shortName: "Yellow",
    color: "#c9a800",
    speedKmh: 33,
    stations: [
      { id: "m:y:hauz-khas", name: "Hauz Khas", lat: 28.5434, lon: 77.2068 },
      { id: "m:y:green-park", name: "Green Park", lat: 28.558, lon: 77.2067 },
      { id: "m:y:aiims", name: "AIIMS", lat: 28.5687, lon: 77.2076 },
      { id: "m:y:central-secretariat", name: "Central Secretariat", lat: 28.6148, lon: 77.2115 },
      { id: "m:y:rajiv-chowk", name: "Rajiv Chowk", lat: 28.6328, lon: 77.2197 },
      { id: "m:y:kashmere-gate", name: "Kashmere Gate", lat: 28.667, lon: 77.2282 },
    ],
  },
  {
    id: "metro:magenta",
    name: "Magenta Line",
    shortName: "Magenta",
    color: "#c2187e",
    speedKmh: 34,
    stations: [
      { id: "m:g:hauz-khas", name: "Hauz Khas", lat: 28.5434, lon: 77.2068 },
      { id: "m:g:nehru-place", name: "Nehru Place", lat: 28.5505, lon: 77.267 },
    ],
  },
];

const CURATED_BUS_ROUTES: BusRoute[] = [
  {
    id: "bus:620",
    number: "620",
    name: "Munirka - Connaught Place",
    color: "#2563eb",
    speedKmh: 16,
    cycleMinutes: 74,
    vehicles: 4,
    stops: [
      { id: "b:munirka", name: "Munirka", lat: 28.5578, lon: 77.1875 },
      { id: "b:hauz-khas", name: "Hauz Khas", lat: 28.545, lon: 77.203 },
      { id: "b:aiims", name: "AIIMS", lat: 28.5685, lon: 77.209 },
      { id: "b:connaught-place", name: "Regal (Connaught Place)", lat: 28.6315, lon: 77.2167 },
    ],
  },
];
