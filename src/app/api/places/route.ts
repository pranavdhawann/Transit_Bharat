import { NextResponse } from "next/server";
import { getPlace, searchPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Exact lookup (used by demo-journey chips).
  const id = searchParams.get("id");
  if (id) {
    return NextResponse.json({ place: getPlace(id) });
  }

  const q = searchParams.get("q") ?? "";
  return NextResponse.json({ results: searchPlaces(q) });
}
