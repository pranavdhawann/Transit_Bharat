"use client";

import { needsKeyline, resolveOnBase } from "@/lib/route-palette";
import { routeBarSegments } from "@/lib/routebar";
import type { Leg } from "@/lib/types";

/**
 * A journey rendered as a miniature line diagram: segment widths are leg
 * durations, fills are the real route colours. The shape of a trip is legible
 * before any text is read.
 *
 * Theme note: onBase and the keyline are resolved against the LIGHT theme
 * because leg.routeColor carries the light base from the network data. Dark
 * mode swaps the ground, not the route colour, and every light base already
 * clears 4.5:1 for its label (tests/route-palette.test.ts).
 */
export default function RouteBar({
  legs,
  className = "",
}: {
  legs: Leg[];
  className?: string;
}) {
  const segments = routeBarSegments(legs);
  if (segments.length === 0) return null;

  return (
    <div
      className={`flex h-6 w-full overflow-hidden ${className}`}
      role="img"
      aria-label={legs
        .map((l) =>
          l.mode === "WALK"
            ? `walk ${Math.round(l.durationMinutes)} minutes`
            : `${l.routeNumber ?? l.mode} ${Math.round(l.durationMinutes)} minutes`,
        )
        .join(", then ")}
    >
      {segments.map((segment, i) => {
        if (segment.kind === "walk") {
          return (
            <span
              key={i}
              className="hatch h-full border-r border-paper"
              style={{ width: `${segment.percent}%` }}
            />
          );
        }
        const base = segment.color ?? "#606B76";
        return (
          <span
            key={i}
            className="type-data flex h-full items-center justify-center overflow-hidden border-r border-paper text-[11px]"
            style={{
              width: `${segment.percent}%`,
              backgroundColor: base,
              color: resolveOnBase(base, "light"),
              boxShadow: needsKeyline(base, "light")
                ? "inset 0 0 0 1px var(--bt-ink)"
                : undefined,
            }}
          >
            {segment.label}
          </span>
        );
      })}
    </div>
  );
}
