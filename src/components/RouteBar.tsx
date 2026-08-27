"use client";

import type { CSSProperties } from "react";
import { darkFor, needsKeyline, resolveOnBase } from "@/lib/route-palette";
import { routeBarSegments } from "@/lib/routebar";
import { THEMES } from "@/lib/tokens";
import type { Leg } from "@/lib/types";

const INK_KEYLINE = "inset 0 0 0 1px var(--bt-ink)";

/** Per-segment custom properties consumed by the `.route-seg` rule in globals.css. */
type SegStyle = CSSProperties & Record<string, string>;

/**
 * A journey rendered as a miniature line diagram: segment widths are leg
 * durations, fills are the real route colours. The shape of a trip is legible
 * before any text is read.
 *
 * Theme note: leg.routeColor only ever carries the LIGHT base. Dark mode
 * swaps the ground to #10151A, and 7 of 15 route colours fall under 3:1
 * against it — so the light base cannot simply be reused. METRO_BASES and
 * BUS_BASES (Task 4) already define a matching dark base for every route;
 * darkFor() looks it up, and each segment is handed BOTH resolutions as CSS
 * custom properties so the cascade — not this component — picks the one
 * that matches the active theme (see `.route-seg` in globals.css).
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

        // Unknown/missing route colour falls back to the ink-3 token rather
        // than a hand-typed hex, so it can never drift from tokens.ts.
        const lightBase = segment.color ?? THEMES.light.ink3;
        const darkBase = segment.color ? darkFor(segment.color) : THEMES.dark.ink3;

        const style: SegStyle = {
          width: `${segment.percent}%`,
          "--seg-bg": segment.color ?? "var(--bt-ink-3)",
          "--seg-bg-dark": segment.color ? darkBase : "var(--bt-ink-3)",
          "--seg-fg": resolveOnBase(lightBase, "light"),
          "--seg-fg-dark": resolveOnBase(darkBase, "dark"),
          "--seg-keyline": needsKeyline(lightBase, "light") ? INK_KEYLINE : "none",
          "--seg-keyline-dark": needsKeyline(darkBase, "dark") ? INK_KEYLINE : "none",
        };

        return (
          <span
            key={i}
            className="route-seg type-data flex h-full items-center justify-center overflow-hidden border-r border-paper text-[11px]"
            style={style}
          >
            {segment.label}
          </span>
        );
      })}
    </div>
  );
}
