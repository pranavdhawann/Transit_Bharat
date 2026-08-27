import { fmtClockIST, fmtDurationMinutes, fmtWalk } from "@/lib/format";
import type { Journey } from "@/lib/types";
import ModeIcon, { modeLabel } from "./ModeIcon";
import ProvenanceBadge from "./ProvenanceBadge";

/**
 * Vertical journey timeline. Deliberately fully understandable without the
 * map: a rider should follow the journey even if tiles fail to load.
 */
export default function JourneyTimeline({ journey }: { journey: Journey }) {
  return (
    <ol className="relative space-y-4 pl-1">
      {journey.legs.map((leg, i) => {
        const isTransit = leg.mode !== "WALK";
        const accent = isTransit ? (leg.routeColor ?? "#2563eb") : "#64748b";
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: accent }}
              >
                <ModeIcon mode={leg.mode} size={16} />
              </span>
              {i < journey.legs.length - 1 && (
                <span aria-hidden className="w-px flex-1 bg-slate-200" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">
                  {isTransit ? (
                    <>
                      {modeLabel(leg.mode)}{" "}
                      {(leg.routeNumber || leg.routeName) && (
                        <span style={{ color: accent }}>
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
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    +{leg.delayMinutes} min delay
                  </span>
                )}
              </div>

              {leg.mode === "AUTO" ? (
                <div className="mt-0.5 space-y-0.5 text-sm text-slate-600">
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
                  <p className="text-xs text-slate-500">
                    Metered fare · estimate ·{" "}
                    {fmtDurationMinutes(leg.durationMinutes)} ride
                  </p>
                </div>
              ) : isTransit ? (
                <div className="mt-0.5 space-y-0.5 text-sm text-slate-600">
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
                  <p className="text-xs text-slate-500">
                    {leg.intermediateStops.length} stop
                    {leg.intermediateStops.length === 1 ? "" : "s"} in between
                    {leg.headsign ? ` · toward ${leg.headsign}` : ""} ·{" "}
                    {fmtDurationMinutes(leg.durationMinutes)} ride
                  </p>
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-slate-600">
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
