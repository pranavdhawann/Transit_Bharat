"use client";

import type { ScenarioState } from "./types";

/**
 * Client-side home for the demo scenario.
 *
 * The server cannot hold this: on a serverless host each request may reach a
 * different instance, so a delay flag set by one request is invisible to the
 * next. The browser is the only thing guaranteed to be the same across the
 * whole demo, so it owns the state and echoes it back on every call.
 *
 * sessionStorage (not localStorage) so the scenario dies with the tab and a
 * judge opening a fresh tab always starts from a clean, undelayed network.
 */
const KEY = "bt:scenario";

export function loadScenario(): ScenarioState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScenarioState;
    return parsed && parsed.active === true ? parsed : null;
  } catch {
    return null;
  }
}

export function saveScenario(scenario: ScenarioState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (scenario?.active) {
      window.sessionStorage.setItem(KEY, JSON.stringify(scenario));
    } else {
      window.sessionStorage.removeItem(KEY);
    }
  } catch {
    // Private mode / storage disabled: the demo still works within one page.
  }
}

/** Query string fragment carrying the delay to /api/vehicles. */
export function scenarioQuery(scenario: ScenarioState | null): string {
  if (!scenario?.active || !scenario.routeNumber) return "";
  return `&delayRoute=${encodeURIComponent(scenario.routeNumber)}&delayMinutes=${scenario.delayMinutes}`;
}
