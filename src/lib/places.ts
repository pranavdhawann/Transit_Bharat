import {
  BUS_ROUTES,
  LANDMARKS,
  METRO_LINES,
  allStops,
} from "@/data/network";
import type { PlaceResult } from "./types";

interface PlaceRecord extends PlaceResult {
  aliases: string[];
  sortKey: string;
}

let index: PlaceRecord[] | null = null;

function buildIndex(): PlaceRecord[] {
  const records: PlaceRecord[] = [];

  for (const lm of LANDMARKS) {
    records.push({
      id: lm.id,
      name: lm.name,
      type: "landmark",
      lat: lm.lat,
      lon: lm.lon,
      detail: "Landmark",
      aliases: lm.aliases ?? [],
      sortKey: lm.name.toLowerCase(),
    });
  }
  for (const line of METRO_LINES) {
    for (const s of line.stations) {
      const existing = records.find((r) => r.id === s.id);
      if (existing) continue;
      // Interchange stations appear on multiple lines; keep one entry.
      const dup = records.find(
        (r) => r.type === "station" && r.name === s.name,
      );
      if (dup) continue;
      records.push({
        id: s.id,
        name: s.name,
        type: "station",
        lat: s.lat,
        lon: s.lon,
        detail: `${line.shortName} Line`,
        aliases: [line.shortName + " Line"],
        sortKey: s.name.toLowerCase(),
      });
    }
  }
  for (const route of BUS_ROUTES) {
    for (const s of route.stops) {
      const dup = records.find((r) => r.id === s.id);
      if (dup) continue;
      const routeNums = BUS_ROUTES.filter((r) =>
        r.stops.some((st) => st.id === s.id),
      )
        .map((r) => r.number)
        .join(", ");
      records.push({
        id: s.id,
        name: `Bus: ${s.name}`,
        type: "stop",
        lat: s.lat,
        lon: s.lon,
        detail: `Bus stop · ${routeNums}`,
        aliases: [s.name],
        sortKey: s.name.toLowerCase(),
      });
    }
  }

  return records;
}

export function getPlace(id: string): PlaceResult | null {
  index ??= buildIndex();
  const rec = index.find((r) => r.id === id);
  if (!rec) return null;
  const { aliases: _aliases, sortKey: _sortKey, ...rest } = rec;
  return rest;
}

/** Normalize for fuzzy matching: lowercase, strip non-alphanumeric. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0900-\u097F]+/g, " ")
    .trim();
}

export function searchPlaces(query: string, limit = 8): PlaceResult[] {
  index ??= buildIndex();
  const q = norm(query);
  if (q.length < 2) return [];

  const scored = index.map((rec) => {
    const nameN = norm(rec.name);
    let score = 0;
    if (nameN === q) score = 100;
    else if (nameN.startsWith(q)) score = 90;
    else if (nameN.split(" ").some((w) => w.startsWith(q))) score = 80;
    else if (nameN.includes(q)) score = 60;
    else {
      for (const alias of rec.aliases) {
        const a = norm(alias);
        if (a === q || a.startsWith(q)) {
          score = Math.max(score, 75);
        } else if (a.includes(q)) {
          score = Math.max(score, 55);
        }
      }
    }
    return { rec, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.rec.sortKey.length - b.rec.sortKey.length ||
        a.rec.sortKey.localeCompare(b.rec.sortKey),
    )
    .slice(0, limit)
    .map(({ rec }) => {
      const { aliases: _a, sortKey: _k, ...rest } = rec;
      return rest;
    });
}

/** Popular demo origin/destination pairs shown as chips on the home screen. */
export const SUGGESTED_PAIRS: { fromId: string; toId: string; label: string }[] =
  [
    { fromId: "lm:munirka-market", toId: "lm:connaught-place", label: "Munirka → Connaught Place" },
    { fromId: "lm:kashmere-gate-isbt", toId: "lm:india-gate", label: "Kashmere Gate → India Gate" },
    { fromId: "lm:iit-delhi", toId: "lm:nehru-place-market", label: "IIT Delhi → Nehru Place" },
  ];

// Exposed for tests.
export function indexSize(): number {
  index ??= buildIndex();
  return index.length;
}

export function stopCount(): number {
  return allStops().length;
}
