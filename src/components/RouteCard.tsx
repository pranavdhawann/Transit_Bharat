"use client";

import { fmtDurationMinutes, fmtInr, fmtWalk } from "@/lib/format";
import type { Journey } from "@/lib/types";
import ModeIcon, { modeLabel } from "./ModeIcon";
import ProvenanceBadge from "./ProvenanceBadge";

const LABEL_STYLES: Record<string, string> = {
  RECOMMENDED: "bg-blue-600 text-white",
  FASTEST: "bg-slate-900 text-white",
  CHEAPEST: "bg-emerald-600 text-white",
  ALTERNATIVE: "bg-amber-500 text-white",
};

export default function RouteCard({
  journey,
  selected,
  onSelect,
}: {
  journey: Journey;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const transitLegs = journey.legs.filter((l) => l.mode !== "WALK");
  return (
    <button
      type="button"
      onClick={() => onSelect(journey.id)}
      aria-pressed={selected}
      className={`bt-animate block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        selected
          ? "border-blue-600 ring-2 ring-blue-100"
          : "border-slate-200 hover:border-slate-300 hover:shadow"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
            LABEL_STYLES[journey.label] ?? LABEL_STYLES.ALTERNATIVE
          }`}
        >
          {journey.label}
        </span>
        {journey.disrupted && (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            Delayed +{journey.legs.find((l) => l.delayMinutes)?.delayMinutes} min
          </span>
        )}
        <ProvenanceBadge provenance={journey.provenance} />
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-2xl font-bold tracking-tight">
          {fmtDurationMinutes(journey.durationMinutes)}
        </span>
        <span className="text-lg font-semibold text-slate-700">
          {fmtInr(journey.fareInr)}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {journey.transfers} transfer{journey.transfers === 1 ? "" : "s"} ·{" "}
          {fmtWalk(journey.walkingMeters)} walk
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {journey.legs.map((leg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-slate-300">›</span>}
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                leg.mode === "WALK"
                  ? "bg-slate-100 text-slate-700"
                  : "text-white"
              }`}
              style={
                leg.mode !== "WALK" ? { backgroundColor: leg.routeColor ?? "#2563eb" } : undefined
              }
            >
              <ModeIcon mode={leg.mode} size={13} />
              {leg.mode === "WALK"
                ? `${modeLabel("WALK")} ${Math.max(1, Math.round(leg.durationMinutes))}m`
                : `${leg.routeNumber ?? modeLabel(leg.mode)} · ${Math.round(leg.durationMinutes)}m`}
            </span>
          </span>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {transitLegs.length > 0
          ? transitLegs
              .map(
                (l) =>
                  `${l.mode === "BUS" ? "Bus" : l.mode === "AUTO" ? "Auto" : "Metro"} ${l.from.name} → ${l.to.name}`,
              )
              .join(" · ")
          : "Walking only"}
      </p>
    </button>
  );
}
