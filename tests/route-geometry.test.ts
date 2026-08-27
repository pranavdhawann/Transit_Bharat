import { describe, expect, it, vi } from "vitest";
import { routeLegGeometry, validShapeInput } from "../src/lib/route-geometry";

describe("street-following map geometry", () => {
  it("accepts bounded Delhi legs and rejects out-of-area coordinates", () => {
    expect(validShapeInput({ mode: "WALK", polyline: [[28.53, 77.24], [28.54, 77.25]] })).toBe(true);
    expect(validShapeInput({ mode: "WALK", polyline: [[19, 73], [28.54, 77.25]] })).toBe(false);
  });

  it("converts OSRM GeoJSON into the app's lat-lon shape", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              geometry: {
                type: "LineString",
                coordinates: [
                  [77.24875, 28.53015],
                  [77.2492, 28.5304],
                  [77.2548, 28.5424],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const result = await routeLegGeometry(
      { mode: "WALK", polyline: [[28.53015, 77.24875], [28.5424, 77.2548]] },
      fetcher,
    );
    expect(result.source).toBe("ROUTED");
    expect(result.polyline[1]).toEqual([28.5304, 77.2492]);
  });

  it("keeps the original line when the routing service fails", async () => {
    const original: [number, number][] = [[28.53, 77.24], [28.54, 77.25]];
    const fetcher = vi.fn(async () => new Response("no", { status: 503 })) as unknown as typeof fetch;
    await expect(routeLegGeometry({ mode: "BUS", polyline: original }, fetcher)).resolves.toEqual({
      polyline: original,
      source: "APPROXIMATE",
    });
  });
});
