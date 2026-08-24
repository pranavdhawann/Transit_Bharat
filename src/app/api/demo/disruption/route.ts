import { NextResponse } from "next/server";
import {
  getScenario,
  resetDisruption,
  triggerDisruption,
} from "@/lib/scenario";

export const dynamic = "force-dynamic";

/**
 * Demo-only disruption control.
 * POST { action: "trigger" | "reset", routeNumber?, delayMinutes? }
 * Deterministic so the recorded demo cannot fail.
 */
export async function POST(request: Request) {
  let body: {
    action?: string;
    routeNumber?: string;
    delayMinutes?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.action === "reset") {
    return NextResponse.json({ scenario: resetDisruption() });
  }

  // Default (and only supported demo event): trigger the scripted delay on
  // the primary corridor.
  return NextResponse.json({
    scenario: triggerDisruption(
      body.routeNumber,
      typeof body.delayMinutes === "number"
        ? Math.min(60, Math.max(1, Math.round(body.delayMinutes)))
        : 11,
    ),
  });
}

export async function GET() {
  return NextResponse.json({ scenario: getScenario() });
}
