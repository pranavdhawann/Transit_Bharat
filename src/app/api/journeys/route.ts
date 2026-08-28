import { NextResponse } from "next/server";
import { getPlace } from "@/lib/places";
import {
  ACCESSIBLE_MAX_WALK_METERS,
  DEFAULT_MAX_WALK_METERS,
  LESS_WALK_MAX_METERS,
} from "@/data/network";
import { isAccessibilityNeed } from "@/lib/ai";
import { haversineMeters } from "@/lib/geo";
import { planJourneys } from "@/lib/graph";
import { delayFrom, resolveScenario } from "@/lib/scenario";
import { isWithinDelhiServiceArea } from "@/lib/service-area";
import type {
  AccessibilityPlanInfo,
  Journey,
  JourneyLocation,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface JourneysRequest {
  fromId?: string;
  toId?: string;
  fromLocation?: unknown;
  toLocation?: unknown;
  lessWalking?: boolean;
  /** Interchange cap from a stated accessibility constraint. */
  maxTransfers?: number;
  accessibilityNeed?: unknown;
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
  if (!isWithinDelhiServiceArea(from) || !isWithinDelhiServiceArea(to)) {
    return NextResponse.json(
      {
        error: "OUTSIDE_SERVICE_AREA",
        message: "BharaTransit currently plans journeys only within Delhi NCR.",
      },
      { status: 422 },
    );
  }
  if (haversineMeters(from, to) < 25) {
    return NextResponse.json(
      {
        error: "SAME_PLACE",
        message: "Your start and destination are the same place.",
      },
      { status: 400 },
    );
  }

  const scenario = resolveScenario(body.scenario);
  const delay = delayFrom(scenario);
  const accessibilityNeed = isAccessibilityNeed(body.accessibilityNeed)
    ? body.accessibilityNeed
    : null;
  const lessWalking = body.lessWalking === true || accessibilityNeed !== null;
  const maxWalkMeters = accessibilityNeed
    ? ACCESSIBLE_MAX_WALK_METERS
    : lessWalking
      ? LESS_WALK_MAX_METERS
      : DEFAULT_MAX_WALK_METERS;
  const maxTransfers =
    typeof body.maxTransfers === "number" &&
    Number.isFinite(body.maxTransfers) &&
    body.maxTransfers >= 0
      ? Math.min(4, Math.round(body.maxTransfers))
      : undefined;
  const requiresStepFree =
    accessibilityNeed === "WHEELCHAIR" || accessibilityNeed === "STEP_FREE";

  const journeys: Journey[] = planJourneys({
    origin: { name: displayName(from), lat: from.lat, lon: from.lon },
    destination: { name: displayName(to), lat: to.lat, lon: to.lon },
    maxWalkMeters,
    ...(lessWalking ? { maxTotalWalkMeters: maxWalkMeters } : {}),
    allowAutoAssist: !requiresStepFree,
    departAtMs: Date.now(),
    delay,
    ...(maxTransfers !== undefined ? { maxTransfers } : {}),
  }).map((j) => ({
    ...j,
    query: {
      ...(fromLocation ? { fromLocation } : { fromId: fromId! }),
      ...(toLocation ? { toLocation } : { toId: toId! }),
      lessWalking,
      ...(maxTransfers !== undefined ? { maxTransfers } : {}),
      ...(accessibilityNeed ? { accessibilityNeed } : {}),
    },
  }));

  const accessibility: AccessibilityPlanInfo | null = accessibilityNeed
    ? {
        requested: accessibilityNeed,
        applied: [
          `Shorter walking connections (target up to ${maxWalkMeters} m total)`,
          ...(maxTransfers !== undefined
            ? [`Up to ${maxTransfers} change${maxTransfers === 1 ? "" : "s"}`]
            : []),
          ...(requiresStepFree ? ["Ordinary auto-rickshaw fallback disabled"] : []),
        ],
        warnings: [
          ...(maxTransfers !== undefined &&
          journeys.some((journey) => journey.transfers > maxTransfers)
            ? ["No available option met the requested change limit; closest routes are shown."]
            : []),
          ...(lessWalking && journeys.every((journey) => journey.walkingMeters > maxWalkMeters)
            ? ["No available option met the walking target; closest routes are shown."]
            : []),
          ...(requiresStepFree
            ? [
                "Lift, ramp, platform-gap and outage data are not available in this pilot. Step-free access is requested but cannot be verified.",
              ]
            : []),
        ],
      }
    : null;

  return NextResponse.json(
    {
      journeys,
      scenario,
      accessibility,
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
  if (candidate.kind === "place") {
    const name = safePlaceName(candidate.name);
    if (!name) return null;
    return { name, lat, lon, kind: "place" };
  }
  return { name: "Current location", lat, lon };
}

function safePlaceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return name.length > 0 ? name : null;
}

function displayName(p: { name: string; type?: string }): string {
  return p.type === "stop" ? p.name.replace(/^Bus:\s*/, "") : p.name;
}
