import type { Provenance } from "./types";

/**
 * Trust/provenance engine.
 *
 * Every realtime-looking datum gets exactly one state:
 * - DEMO      synthetic data used by this hackathon prototype
 * - SCHEDULED schedule only; no live vehicle information exists
 * - LIVE      fresh realtime update within the freshness window
 * - STALE     last realtime update is older than the freshness window
 *
 * In this prototype all vehicle data is synthetic, so it is always DEMO.
 * The engine is written as real code because it is the core product
 * decision and will drive real feeds in later phases.
 */
export const FRESH_LIMIT_SECONDS = 90;
export const STALE_LIMIT_SECONDS = 240;

export function provenance(
  sourceType: "synthetic" | "realtime" | "static",
  updatedAtMs: number | null,
  nowMs: number,
): Provenance {
  if (sourceType === "synthetic") return "DEMO";
  if (!updatedAtMs) return "SCHEDULED";
  const ageSec = (nowMs - updatedAtMs) / 1000;
  if (ageSec <= FRESH_LIMIT_SECONDS) return "LIVE";
  if (ageSec <= STALE_LIMIT_SECONDS) return "STALE";
  return "STALE";
}

export interface ProvenanceMeta {
  label: string;
  hint: string;
  className: string;
  dotClassName: string;
}

export const PROVENANCE_META: Record<Provenance, ProvenanceMeta> = {
  LIVE: {
    label: "LIVE",
    hint: "Fresh realtime vehicle data",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClassName: "bg-emerald-500",
  },
  SCHEDULED: {
    label: "SCHEDULED",
    hint: "Timetable only - no live vehicle data available",
    className: "bg-amber-50 text-amber-800 border-amber-200",
    dotClassName: "bg-amber-500",
  },
  STALE: {
    label: "STALE",
    hint: "Last live update is too old to trust fully",
    className: "bg-orange-50 text-orange-800 border-orange-200",
    dotClassName: "bg-orange-500",
  },
  DEMO: {
    label: "DEMO",
    hint: "Synthetic hackathon data - not real vehicle positions",
    className: "bg-violet-50 text-violet-800 border-violet-200",
    dotClassName: "bg-violet-500",
  },
};
