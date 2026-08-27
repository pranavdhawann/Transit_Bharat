/**
 * Segment maths for the RouteBar (spec section 5.1).
 *
 * Kept as a pure function so the proportions are unit-testable in the node
 * environment; the component is a thin renderer over this.
 */
import type { Leg } from "./types";

/** Below this share of the bar a label cannot be read, so it is dropped. */
const MIN_LABEL_PERCENT = 12;

export interface Segment {
  kind: "transit" | "walk";
  percent: number;
  color: string | null;
  label: string | null;
}

export function routeBarSegments(legs: Leg[]): Segment[] {
  if (legs.length === 0) return [];

  const durations = legs.map((l) => Math.max(0, l.durationMinutes));
  const total = durations.reduce((a, b) => a + b, 0);
  // An all-zero itinerary is degenerate but must not produce NaN widths.
  const shares =
    total > 0
      ? durations.map((d) => (d / total) * 100)
      : durations.map(() => 100 / legs.length);

  return legs.map((leg, i) => {
    const percent = shares[i];
    const isWalk = leg.mode === "WALK";
    const label = leg.routeNumber ?? null;
    return {
      kind: isWalk ? "walk" : "transit",
      percent,
      color: isWalk ? null : (leg.routeColor ?? null),
      label: !isWalk && label && percent >= MIN_LABEL_PERCENT ? label : null,
    };
  });
}
