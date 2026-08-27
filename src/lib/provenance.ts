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

export type ProvenanceForm = "filled" | "outline" | "hollow" | "hatched";

export interface ProvenanceMeta {
  label: string;
  hint: string;
  /** Non-colour distinguisher. Spec section 3.2 — a hard accessibility requirement. */
  form: ProvenanceForm;
  className: string;
  dotClassName: string;
}

export const PROVENANCE_META: Record<Provenance, ProvenanceMeta> = {
  LIVE: {
    label: "LIVE",
    hint: "Fresh realtime vehicle data",
    form: "filled",
    className: "border-live bg-live text-paper",
    dotClassName: "rounded-full bg-paper bt-animate animate-pulse",
  },
  SCHEDULED: {
    label: "SCHEDULED",
    hint: "Timetable only - no live vehicle data available",
    form: "outline",
    className: "border-ink-2 text-ink-2",
    dotClassName: "rounded-full border border-ink-2 bg-transparent",
  },
  STALE: {
    label: "STALE",
    hint: "Last live update is too old to trust fully",
    form: "hollow",
    className: "border-stale text-stale",
    dotClassName: "rounded-full border-[3px] border-stale bg-transparent",
  },
  DEMO: {
    label: "DEMO",
    hint: "Synthetic hackathon data - not real vehicle positions",
    form: "hatched",
    className: "border-ink-2 text-ink-2 hatch",
    dotClassName: "rounded-[2px] border border-ink-2 bg-transparent",
  },
};
