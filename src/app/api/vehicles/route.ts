import { NextResponse } from "next/server";
import { simulateVehicles } from "@/lib/vehicles";
import { getScenario } from "@/lib/scenario";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routeParam = searchParams.get("route");
  const routeNumbers = routeParam
    ? routeParam.split(",").map((r) => r.trim()).filter(Boolean)
    : undefined;

  const scenario = getScenario();
  const delay =
    scenario.active && scenario.routeNumber
      ? { routeNumber: scenario.routeNumber, minutes: scenario.delayMinutes }
      : null;

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
