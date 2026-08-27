import { NextResponse } from "next/server";
import { simulateVehicles } from "@/lib/vehicles";
import { delayFrom, resolveScenario } from "@/lib/scenario";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routeParam = searchParams.get("route");
  const routeNumbers = routeParam
    ? routeParam.split(",").map((r) => r.trim()).filter(Boolean)
    : undefined;

  // Same instance-independence as /api/journeys: the client tells us which
  // route is delayed rather than relying on this lambda remembering it.
  const delayRoute = searchParams.get("delayRoute");
  const delayMinutes = Number(searchParams.get("delayMinutes"));
  const scenario = resolveScenario(
    delayRoute
      ? {
          active: true,
          routeNumber: delayRoute,
          delayMinutes,
          triggeredAt: Date.now(),
        }
      : undefined,
  );
  const delay = delayFrom(scenario);

  const vehicles = simulateVehicles({ routeNumbers, nowMs: Date.now(), delay });

  return NextResponse.json(
    {
      vehicles,
      provenance: "DEMO",
      disclosure: "Synthetic vehicle positions - hackathon demo data only.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
