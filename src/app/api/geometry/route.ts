import { NextResponse } from "next/server";
import { routeLegsGeometry, validShapeInput } from "@/lib/route-geometry";
import type { ShapeInput } from "@/lib/route-geometry";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { legs?: unknown } = {};
  try {
    body = (await request.json()) as { legs?: unknown };
  } catch {
    // handled by validation below
  }

  if (
    !Array.isArray(body.legs) ||
    body.legs.length === 0 ||
    body.legs.length > 12 ||
    !body.legs.every(validShapeInput)
  ) {
    return NextResponse.json(
      { error: "INVALID_GEOMETRY", message: "Invalid Delhi route geometry." },
      { status: 400 },
    );
  }

  const shapes = await routeLegsGeometry(body.legs as ShapeInput[]);
  return NextResponse.json(
    { shapes },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
