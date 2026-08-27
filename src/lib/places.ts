import {
  BUS_ROUTES,
  LANDMARKS,
  METRO_LINES,
  allStops,
} from "@/data/network";
import { haversineMeters } from "./geo";
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

/**
 * Every query token must appear in the haystack (name + aliases). Lets
 * "du north" find Delhi University North Campus and "nehru place market"
 * find the tech market, which single-substring matching cannot do.
 * Returns 0 (no match) or a 0..1 quality score.
 */
function tokenScore(haystack: string, tokens: string[]): number {
  const words = haystack.split(" ").filter(Boolean);
  let total = 0;
  for (const t of tokens) {
    let best = 0;
    for (const w of words) {
      if (w === t) best = Math.max(best, 3);
      else if (w.startsWith(t)) best = Math.max(best, 2);
      else if (w.includes(t)) best = Math.max(best, 1);
    }
    if (best === 0) return 0;
    total += best;
  }
  return total / (tokens.length * 3);
}

export function searchPlaces(query: string, limit = 8): PlaceResult[] {
  index ??= buildIndex();
  const q = norm(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ").filter(Boolean);

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
    if (score === 0 && tokens.length > 1) {
      const hay = [nameN, ...rec.aliases.map(norm)].join(" ");
      const ts = tokenScore(hay, tokens);
      if (ts > 0) score = 40 + Math.round(ts * 25);
    }
    return { rec, score };
  });

  const ranked = scored
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        // A landmark we added on top of a real station is the weaker entry:
        // the station carries its line name, which is what a rider needs.
        rank(a.rec.type) - rank(b.rec.type) ||
        a.rec.sortKey.length - b.rec.sortKey.length ||
        a.rec.sortKey.localeCompare(b.rec.sortKey),
    );

  // Collapse the same place appearing as both a landmark and a station.
  const kept: typeof ranked = [];
  for (const s of ranked) {
    const dup = kept.some(
      (k) =>
        norm(k.rec.name) === norm(s.rec.name) &&
        haversineMeters(k.rec, s.rec) < 800,
    );
    if (!dup) kept.push(s);
    if (kept.length >= limit) break;
  }

  return kept.map(({ rec }) => {
    const { aliases: _a, sortKey: _k, ...rest } = rec;
    return rest;
  });
}

/** Station beats landmark beats bus stop when scores tie. */
function rank(type: PlaceResult["type"]): number {
  return type === "station" ? 0 : type === "landmark" ? 1 : 2;
}

/**
 * Landmarks offered the moment a location field is focused, before the rider
 * has typed anything. Ordered by how likely they are to be a real trip end in
 * the pilot area, not alphabetically. Ids are resolved through the index at
 * call time so a rename in network.ts drops the suggestion rather than
 * producing a broken option.
 */
const POPULAR_PLACE_IDS = [
  "lm:connaught-place",
  "lm:new-delhi-railway",
  "lm:chandni-chowk",
  "lm:kashmere-gate-isbt",
  "lm:india-gate",
  "lm:aiims-hospital",
  "lm:saket-citywalk",
  "lm:nehru-place-market",
];

/** Suggestions for an empty location field. */
export function suggestedPlaces(limit = 6): PlaceResult[] {
  index ??= buildIndex();
  const out: PlaceResult[] = [];
  for (const id of POPULAR_PLACE_IDS) {
    if (out.length >= limit) break;
    const place = getPlace(id);
    if (place) out.push(place);
  }
  return out;
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
