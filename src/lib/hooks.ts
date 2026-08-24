"use client";

import { useEffect, useState } from "react";
import type { Vehicle } from "./types";

/** Poll synthetic vehicle positions for the given routes. */
export function useVehicles(
  routeNumbers: string[] | null,
  intervalMs = 4000,
): Vehicle[] {
  const key = routeNumbers ? routeNumbers.slice().sort().join(",") : "";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!key) {
      setVehicles([]);
      return;
    }
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/vehicles?route=${encodeURIComponent(key)}`);
        const data = (await res.json()) as { vehicles?: Vehicle[] };
        if (!cancelled) setVehicles(data.vehicles ?? []);
      } catch {
        // Keep last known positions on transient errors.
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, intervalMs]);

  return vehicles;
}

/** A ticking clock for "updated N seconds ago" labels. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
