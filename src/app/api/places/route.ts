import { NextResponse } from "next/server";
import {
  getPlace,
  hasExactPlaceMatch,
  searchPlaces,
  suggestedPlaces,
} from "@/lib/places";
import { searchGeocodedPlaces } from "@/lib/geocode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Exact lookup (used by demo-journey chips).
  const id = searchParams.get("id");
  if (id) {
    return NextResponse.json({ place: getPlace(id) });
  }

  // An empty query is not an error: it is a freshly focused field, and we
  // answer it with popular places so the rider always has something to pick.
  const q = searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ results: suggestedPlaces(), kind: "suggestions" });
  }
  const local = searchPlaces(q);
  // The curated index wins. External lookup fills the long tail of societies,
  // blocks and street addresses without making common stop searches dependent
  // on a network service.
  const external =
    local.length >= 4 || hasExactPlaceMatch(q)
      ? []
      : await searchGeocodedPlaces(q);
  const seen = new Set(local.map((p) => p.id));
  const results = [...local, ...external.filter((p) => !seen.has(p.id))].slice(0, 8);
  return NextResponse.json({ results, kind: "results" });
}
