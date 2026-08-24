import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function bearingDeg(from: LatLng, to: LatLng): number {
  const toRad = Math.PI / 180;
  const y = Math.sin((to.lon - from.lon) * toRad) * Math.cos(to.lat * toRad);
  const x =
    Math.cos(from.lat * toRad) * Math.sin(to.lat * toRad) -
    Math.sin(from.lat * toRad) *
      Math.cos(to.lat * toRad) *
      Math.cos((to.lon - from.lon) * toRad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export type Polyline = [number, number][]; // [lat, lon]

/** Cumulative distance in meters at each vertex. */
export function cumulativeMeters(poly: Polyline): number[] {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(
      cum[i - 1] +
        haversineMeters(
          { lat: poly[i - 1][0], lon: poly[i - 1][1] },
          { lat: poly[i][0], lon: poly[i][1] },
        ),
    );
  }
  return cum;
}

export function totalMeters(poly: Polyline): number {
  const cum = cumulativeMeters(poly);
  return cum[cum.length - 1] ?? 0;
}

/**
 * Interpolate a position along a polyline.
 * fraction is clamped to [0, 1].
 */
export function pointAlongFraction(
  poly: Polyline,
  fraction: number,
): { lat: number; lon: number; bearing: number } {
  const cum = cumulativeMeters(poly);
  const total = cum[cum.length - 1];
  const f = Math.min(1, Math.max(0, fraction));
  const target = total * f;
  for (let i = 1; i < poly.length; i++) {
    if (cum[i] >= target || i === poly.length - 1) {
      const segLen = cum[i] - cum[i - 1];
      const t = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen;
      return {
        lat: poly[i - 1][0] + t * (poly[i][0] - poly[i - 1][0]),
        lon: poly[i - 1][1] + t * (poly[i][1] - poly[i - 1][1]),
        bearing: bearingDeg(
          { lat: poly[i - 1][0], lon: poly[i - 1][1] },
          { lat: poly[i][0], lon: poly[i][1] },
        ),
      };
    }
  }
  return { lat: poly[0][0], lon: poly[0][1], bearing: 0 };
}
