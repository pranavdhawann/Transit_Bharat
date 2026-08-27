import { NextResponse } from "next/server";
import { getPlace, searchPlaces, suggestedPlaces } from "@/lib/places";

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
  return NextResponse.json({ results: searchPlaces(q), kind: "results" });
}
