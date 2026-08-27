import type { CSSProperties } from "react";
import { fmtClockIST, fmtDurationMinutes, fmtWalk } from "@/lib/format";
import { darkFor, resolveOnBase } from "@/lib/route-palette";
import { THEMES } from "@/lib/tokens";
import type { Journey } from "@/lib/types";
import ModeIcon, { modeLabel } from "./ModeIcon";
import ProvenanceBadge from "./ProvenanceBadge";

/** Per-bullet/spine custom properties consumed by the `.timeline-bullet` /
 * `.timeline-spine` rules in globals.css. */
type ThemedStyle = CSSProperties & Record<string, string>;

/**
 * Vertical journey timeline. Deliberately fully understandable without the
 * map: a rider should follow the journey even if tiles fail to load.
 *
 * Theme note: leg.routeColor only ever carries the LIGHT base of a route (see
 * RouteBar.tsx for the full rationale). Dark mode swaps the ground to
 * #10151A, under which several route colours fall below 3:1, so the bullet
 * fill, bullet text and connector spine are each handed BOTH the light and
 * dark resolution as CSS custom properties and the cascade — not this
 * component — picks the one that matches the active theme.
 */
export default function JourneyTimeline({ journey }: { journey: Journey }) {
  return (
    <ol className="relative space-y-4 pl-1">
      {journey.legs.map((leg, i) => {
        const isTransit = leg.mode !== "WALK";
        // Unknown/missing route colour falls back to the ink-3 token rather
        // than a hand-typed hex, so it can never drift from tokens.ts.
        const lightBase = isTransit ? (leg.routeColor ?? THEMES.light.ink3) : null;
        const darkBase = isTransit
          ? leg.routeColor
            ? darkFor(leg.routeColor)
            : THEMES.dark.ink3
          : null;

        // Walk bullets are hollow (see the box-shadow ring below), so their
        // fill stays transparent in both themes and their icon uses the
        // fixed ink-2 token rather than a route colour.
        const bulletStyle: ThemedStyle = isTransit
          ? {
              "--tl-bullet-bg": lightBase as string,
              "--tl-bullet-bg-dark": darkBase as string,
              "--tl-bullet-fg": resolveOnBase(lightBase as string, "light"),
              "--tl-bullet-fg-dark": resolveOnBase(darkBase as string, "dark"),
            }
          : {
              "--tl-bullet-bg": "transparent",
              "--tl-bullet-bg-dark": "transparent",
              "--tl-bullet-fg": "var(--bt-ink-2)",
              "--tl-bullet-fg-dark": "var(--bt-ink-2)",
            };

        const spineStyle: ThemedStyle | undefined = isTransit
          ? {
              "--tl-spine": lightBase as string,
              "--tl-spine-dark": darkBase as string,
            }
          : undefined;

        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span
                className="timeline-bullet flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  ...bulletStyle,
                  boxShadow: isTransit
                    ? undefined
                    : "inset 0 0 0 2px var(--bt-ink-3)",
                }}
              >
                <ModeIcon mode={leg.mode} size={16} />
              </span>
              {i < journey.legs.length - 1 && (
                <span
                  aria-hidden
                  className={`w-[3px] flex-1 ${isTransit ? "timeline-spine" : ""}`}
                  style={isTransit ? spineStyle : { backgroundColor: "var(--bt-ink-3)" }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">
                  {isTransit ? (
                    <>
                      {modeLabel(leg.mode)}{" "}
                      {(leg.routeNumber || leg.routeName) && (
                        <span style={{ color: leg.routeColor ?? THEMES.light.ink3 }}>
                          {[leg.routeNumber, leg.routeName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Walk {fmtWalk(leg.walkingMeters ?? 0)} to{" "}
                      <span className="font-medium">{leg.to.name}</span>
                    </>
                  )}
                </span>
                {isTransit && (
                  <ProvenanceBadge provenance={leg.provenance} />
                )}
                {typeof leg.delayMinutes === "number" && (
                  <span className="type-micro border border-stale text-stale px-2 py-0.5">
                    +{leg.delayMinutes} min delay
                  </span>
                )}
              </div>

              {leg.mode === "AUTO" ? (
                <div className="mt-0.5 space-y-0.5 text-sm text-ink-2">
                  <p>
                    Hail an auto near{" "}
                    <span className="font-medium">{leg.from.name}</span> ·{" "}
                    {fmtClockIST(leg.departAt)}
                  </p>
                  <p>
                    Get off at{" "}
                    <span className="font-medium">{leg.to.name}</span> ·{" "}
                    {fmtClockIST(leg.arriveAt)}
                  </p>
                  <p className="text-xs text-ink-3">
                    Metered fare · estimate ·{" "}
                    {fmtDurationMinutes(leg.durationMinutes)} ride
                  </p>
                </div>
              ) : isTransit ? (
                <div className="mt-0.5 space-y-0.5 text-sm text-ink-2">
                  <p>
                    Board at{" "}
                    <span className="font-medium">{leg.from.name}</span> ·{" "}
                    {fmtClockIST(leg.departAt)}
                  </p>
                  <p>
                    Get off at{" "}
                    <span className="font-medium">{leg.to.name}</span> ·{" "}
                    {fmtClockIST(leg.arriveAt)}
                  </p>
                  <p className="text-xs text-ink-3">
                    {leg.intermediateStops.length} stop
                    {leg.intermediateStops.length === 1 ? "" : "s"} in between
                    {leg.headsign ? ` · toward ${leg.headsign}` : ""} ·{" "}
                    {fmtDurationMinutes(leg.durationMinutes)} ride
                  </p>
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-ink-2">
                  {fmtClockIST(leg.departAt)} – {fmtClockIST(leg.arriveAt)} ·{" "}
                  about {Math.max(1, Math.round(leg.durationMinutes))} min
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
