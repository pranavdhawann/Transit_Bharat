"use client";

import { fmtDurationMinutes, fmtInr, fmtWalk } from "@/lib/format";
import type { Journey } from "@/lib/types";
import RouteBar from "./RouteBar";
import ProvenanceBadge from "./ProvenanceBadge";

const LABEL_STYLES: Record<string, string> = {
  RECOMMENDED: "bg-ink text-paper",
  FASTEST: "border border-ink text-ink",
  CHEAPEST: "border border-ink text-ink",
  ALTERNATIVE: "border border-rule text-ink-3",
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
      className={`bt-animate block w-full border-l-[3px] bg-surface p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
        selected
          ? "border-l-saffron border-y border-r border-y-ink border-r-ink"
          : "border-l-transparent border-y border-r border-rule hover:border-l-ink-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
            LABEL_STYLES[journey.label] ?? LABEL_STYLES.ALTERNATIVE
          }`}
        >
          {journey.label}
        </span>
        {journey.disrupted && (
          <span className="type-micro border border-stale text-stale px-2 py-0.5">
            Delayed +{journey.legs.find((l) => l.delayMinutes)?.delayMinutes} min
          </span>
        )}
        <ProvenanceBadge provenance={journey.provenance} />
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="type-data text-2xl">
          {fmtDurationMinutes(journey.durationMinutes)}
        </span>
        <span className="type-data text-lg">
          {fmtInr(journey.fareInr)}
        </span>
        <span className="type-micro ml-auto text-ink-3">
          {journey.transfers} transfer{journey.transfers === 1 ? "" : "s"} ·{" "}
          {fmtWalk(journey.walkingMeters)} walk
        </span>
      </div>

      <RouteBar legs={journey.legs} className="mt-3" />

      <p className="mt-2 text-xs text-ink-3">
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
