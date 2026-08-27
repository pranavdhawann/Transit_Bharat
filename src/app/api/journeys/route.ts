import { NextResponse } from "next/server";
import { getPlace } from "@/lib/places";
import {
  DEFAULT_MAX_WALK_METERS,
  LESS_WALK_MAX_METERS,
} from "@/data/network";
import { planJourneys } from "@/lib/graph";
import { delayFrom, resolveScenario } from "@/lib/scenario";
import type { Journey, JourneyLocation } from "@/lib/types";

export const dynamic = "force-dynamic";

interface JourneysRequest {
  fromId?: string;
  toId?: string;
  fromLocation?: unknown;
  toLocation?: unknown;
  lessWalking?: boolean;
  /** Interchange cap from a stated accessibility constraint. */
  maxTransfers?: number;
  /**
   * Demo scenario echoed back by the client. Serverless instances do not share
   * memory, so this - not server state - is what makes the delay demo reliable
   * in production. Validated and clamped in parseScenario.
   */
  scenario?: unknown;
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

  const fromId = typeof body.fromId === "string" ? body.fromId : undefined;
  const toId = typeof body.toId === "string" ? body.toId : undefined;
  const fromLocation = parseLocation(body.fromLocation);
  const toLocation = parseLocation(body.toLocation);
  const from = fromLocation ?? resolvePlace(fromId);
  const to = toLocation ?? resolvePlace(toId);
  if (!from || !to) {
    return NextResponse.json(
      { error: "UNKNOWN_PLACE", message: "Search and pick both places first." },
      { status: 400 },
    );
  }

  const scenario = resolveScenario(body.scenario);
  const delay = delayFrom(scenario);

  const journeys: Journey[] = planJourneys({
    origin: { name: displayName(from), lat: from.lat, lon: from.lon },
    destination: { name: displayName(to), lat: to.lat, lon: to.lon },
    maxWalkMeters: body.lessWalking
      ? LESS_WALK_MAX_METERS
      : DEFAULT_MAX_WALK_METERS,
    departAtMs: Date.now(),
    delay,
    ...(typeof body.maxTransfers === "number" &&
    Number.isFinite(body.maxTransfers) &&
    body.maxTransfers >= 0
      ? { maxTransfers: Math.min(4, Math.round(body.maxTransfers)) }
      : {}),
  }).map((j) => ({
    ...j,
    query: {
      ...(fromLocation ? { fromLocation } : { fromId: fromId! }),
      ...(toLocation ? { toLocation } : { toId: toId! }),
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
  return getPlace(id.trim());
}

function parseLocation(value: unknown): JourneyLocation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const lat = candidate.lat;
  const lon = candidate.lon;
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    typeof lon !== "number" ||
    !Number.isFinite(lon) ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  return { name: "Current location", lat, lon };
}

function displayName(p: { name: string; type?: string }): string {
  return p.type === "stop" ? p.name.replace(/^Bus:\s*/, "") : p.name;
}
