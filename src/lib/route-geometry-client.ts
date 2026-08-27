import type { Journey } from "./types";
import type { RoutedShape } from "./route-geometry";

/** Ask the server to replace straight road segments with mapped street paths. */
export async function enrichJourneyGeometry(
  journey: Journey,
  signal?: AbortSignal,
): Promise<Journey> {
  if (journey.legs.every((leg) => leg.geometrySource)) return journey;
  const response = await fetch("/api/geometry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      legs: journey.legs.map(({ mode, polyline }) => ({ mode, polyline })),
    }),
    signal,
  });
  if (!response.ok) return journey;
  const data = (await response.json()) as { shapes?: RoutedShape[] };
  if (!data.shapes || data.shapes.length !== journey.legs.length) return journey;
  return {
    ...journey,
    legs: journey.legs.map((leg, index) => ({
      ...leg,
      polyline: data.shapes![index].polyline,
      geometrySource: data.shapes![index].source,
    })),
  };
}
