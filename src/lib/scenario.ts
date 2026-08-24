/**
 * Deterministic demo-disruption scenario state machine.
 *
 * NORMAL -> (trigger) -> DELAYED -> (recompute journeys) -> ALTERNATIVE
 *
 * State is held in-memory on globalThis so it survives Next.js HMR in dev.
 * It resets on server restart/redeploy - acceptable for the hackathon demo
 * and documented in LIMITATIONS.md.
 */
import { PRIMARY_BUS_NUMBER } from "@/data/network";
import type { ScenarioState } from "./types";

const g = globalThis as unknown as { __tbScenario?: ScenarioState };

function store(): ScenarioState {
  g.__tbScenario ??= {
    active: false,
    triggeredAt: null,
    routeNumber: null,
    delayMinutes: 0,
  };
  return g.__tbScenario;
}

/** Scenario auto-expires after 30 minutes so demos can't get stuck. */
const EXPIRE_MS = 30 * 60_000;

export function getScenario(): ScenarioState {
  const s = store();
  if (
    s.active &&
    s.triggeredAt !== null &&
    Date.now() - s.triggeredAt > EXPIRE_MS
  ) {
    resetDisruption();
  }
  return { ...store() };
}

export function triggerDisruption(
  routeNumber = PRIMARY_BUS_NUMBER,
  delayMinutes = 11,
): ScenarioState {
  const s = store();
  s.active = true;
  s.triggeredAt = Date.now();
  s.routeNumber = routeNumber;
  s.delayMinutes = delayMinutes;
  return { ...s };
}

export function resetDisruption(): ScenarioState {
  const s = store();
  s.active = false;
  s.triggeredAt = null;
  s.routeNumber = null;
  s.delayMinutes = 0;
  return { ...s };
}
