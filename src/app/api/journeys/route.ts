import { NextResponse } from "next/server";
import { getPlace, searchPlaces } from "@/lib/places";
import {
  DEFAULT_MAX_WALK_METERS,
  LESS_WALK_MAX_METERS,
} from "@/data/network";
import { planJourneys } from "@/lib/graph";
import { getScenario } from "@/lib/scenario";
import type { Journey } from "@/lib/types";

export const dynamic = "force-dynamic";

interface JourneysRequest {
  fromId?: string;
  toId?: string;
  lessWalking?: boolean;
}

/**
 * POST /api/journeys
 * Normalized journey planning - the frontend never depends on the router's
 * internal schema (OTP adapter can replace planJourneys later).
 */
export async function POST(request: Request) {
  let body: JourneysRequest;
  try {
    body = (await request.json()) as JourneysRequest;
  } catch {
    body = {};
  }

  const from = resolvePlace(body.fromId);
  const to = resolvePlace(body.toId);
  if (!from || !to) {
    return NextResponse.json(
      { error: "UNKNOWN_PLACE", message: "Search and pick both places first." },
      { status: 400 },
    );
  }

  const scenario = getScenario();
  const delay =
    scenario.active && scenario.routeNumber
      ? { routeNumber: scenario.routeNumber, minutes: scenario.delayMinutes }
      : null;

  const journeys: Journey[] = planJourneys({
    origin: { name: displayName(from), lat: from.lat, lon: from.lon },
    destination: { name: displayName(to), lat: to.lat, lon: to.lon },
    maxWalkMeters: body.lessWalking
      ? LESS_WALK_MAX_METERS
      : DEFAULT_MAX_WALK_METERS,
    departAtMs: Date.now(),
    delay,
  }).map((j) => ({
    ...j,
    query: {
      fromId: body.fromId!,
      toId: body.toId!,
      maxWalkMeters: body.lessWalking
        ? LESS_WALK_MAX_METERS
        : DEFAULT_MAX_WALK_METERS,
    },
  }));

  return NextResponse.json(
    {
      journeys,
      scenario,
      disclosure:
        "Schedule and vehicle data in this prototype are synthetic estimates (DEMO).",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function resolvePlace(id?: string) {
  if (!id) return null;
  const direct = getPlace(id);
  if (direct) return direct;
  const hits = searchPlaces(id, 1);
  return hits[0] ?? null;
}

function displayName(p: { name: string; type: string }): string {
  return p.type === "stop" ? p.name.replace(/^Bus:\s*/, "") : p.name;
}
