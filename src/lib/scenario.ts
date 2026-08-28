/**
 * Deterministic demo-disruption scenario state machine.
 *
 * NORMAL -> (trigger) -> DELAYED -> (recompute journeys) -> ALTERNATIVE
 *
 * The authoritative copy lives with the CLIENT, which echoes it back on every
 * request. Serverless deployments spread requests across instances, so a
 * server-memory flag set by POST /api/demo/disruption is routinely invisible
 * to the next POST /api/journeys - the demo would appear to do nothing.
 *
 * The in-memory copy on globalThis is kept only as a single-process
 * convenience (local dev, HMR) and as a fallback when a client sends nothing.
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

/** Upper bound on a demo delay, also used to validate client input. */
export const MAX_DELAY_MINUTES = 60;

/**
 * Validate a scenario echoed back by the client. Untrusted input: every field
 * is checked and clamped. Returns null if it is not a usable scenario, so the
 * caller falls back to server state.
 */
export function parseScenario(input: unknown): ScenarioState | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (raw.active === false) {
    return {
      active: false,
      triggeredAt: null,
      routeNumber: null,
      delayMinutes: 0,
    };
  }
  if (raw.active !== true) return null;
  const routeNumber =
    typeof raw.routeNumber === "string" && raw.routeNumber.length > 0
      ? raw.routeNumber.slice(0, 12)
      : null;
  if (!routeNumber) return null;
  // Validate before clamping: clamping first would quietly turn a zero or
  // negative "no delay" payload into a real one-minute disruption.
  if (
    typeof raw.delayMinutes !== "number" ||
    !Number.isFinite(raw.delayMinutes) ||
    raw.delayMinutes < 1
  ) {
    return null;
  }
  const delayMinutes = Math.min(
    MAX_DELAY_MINUTES,
    Math.round(raw.delayMinutes),
  );
  const triggeredAt =
    typeof raw.triggeredAt === "number" && Number.isFinite(raw.triggeredAt)
      ? raw.triggeredAt
      : Date.now();
  const age = Date.now() - triggeredAt;
  if (age > EXPIRE_MS || age < -60_000) return null;
  return { active: true, triggeredAt, routeNumber, delayMinutes };
}

/**
 * The scenario to plan against: what the client sent if it is valid, else
 * whatever this instance happens to remember.
 */
export function resolveScenario(clientState?: unknown): ScenarioState {
  if (clientState === null) {
    return {
      active: false,
      triggeredAt: null,
      routeNumber: null,
      delayMinutes: 0,
    };
  }
  return parseScenario(clientState) ?? getScenario();
}

/** Delay shape the router and vehicle simulator expect, or null. */
export function delayFrom(
  scenario: ScenarioState,
): { routeNumber: string; minutes: number } | null {
  return scenario.active && scenario.routeNumber
    ? { routeNumber: scenario.routeNumber, minutes: scenario.delayMinutes }
    : null;
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
