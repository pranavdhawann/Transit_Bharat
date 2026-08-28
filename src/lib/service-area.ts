import type { LatLng } from "./types";

/** Broad Delhi/NCR pilot boundary used consistently for search and routing. */
export const DELHI_BOUNDS = {
  minLat: 28.3,
  maxLat: 29.05,
  minLon: 76.8,
  maxLon: 77.6,
} as const;

export function isWithinDelhiServiceArea(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= DELHI_BOUNDS.minLat &&
    point.lat <= DELHI_BOUNDS.maxLat &&
    point.lon >= DELHI_BOUNDS.minLon &&
    point.lon <= DELHI_BOUNDS.maxLon
  );
}
