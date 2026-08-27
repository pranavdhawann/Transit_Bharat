import type { JourneyLocation, PlaceResult } from "./types";

export const CURRENT_LOCATION_ID = "current-location";
export const CURRENT_LOCATION_STORAGE_KEY = "bt:current-location";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export type JourneyEndpoint =
  | { id: string; location?: never }
  | { id?: never; location: JourneyLocation };

export function currentLocationPlace(coords: {
  latitude: number;
  longitude: number;
  accuracy?: number;
}): PlaceResult {
  const accuracy =
    typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy)
      ? Math.max(0, Math.round(coords.accuracy))
      : null;
  return {
    id: CURRENT_LOCATION_ID,
    name: "Current location",
    type: "current",
    lat: coords.latitude,
    lon: coords.longitude,
    detail:
      accuracy === null
        ? "Device location"
        : `Device location · accurate to about ${accuracy} m`,
  };
}

export function saveCurrentLocation(
  place: PlaceResult,
  storage?: WritableStorage,
): boolean {
  const target = storage ?? browserSessionStorage();
  if (!target || !isCurrentLocation(place)) return false;
  try {
    target.setItem(CURRENT_LOCATION_STORAGE_KEY, JSON.stringify(place));
    return true;
  } catch {
    return false;
  }
}

export function loadCurrentLocation(storage?: ReadableStorage): PlaceResult | null {
  const target = storage ?? browserSessionStorage();
  if (!target) return null;
  try {
    const parsed = JSON.parse(target.getItem(CURRENT_LOCATION_STORAGE_KEY) ?? "null");
    return isCurrentLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function journeyEndpointFor(
  id: string,
  storage?: ReadableStorage,
): JourneyEndpoint | null {
  if (id !== CURRENT_LOCATION_ID) return id ? { id } : null;
  const place = loadCurrentLocation(storage);
  if (!place) return null;
  return {
    location: { name: place.name, lat: place.lat, lon: place.lon },
  };
}

function isCurrentLocation(value: unknown): value is PlaceResult {
  if (!value || typeof value !== "object") return false;
  const place = value as Record<string, unknown>;
  return (
    place.id === CURRENT_LOCATION_ID &&
    place.name === "Current location" &&
    place.type === "current" &&
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    place.lat >= -90 &&
    place.lat <= 90 &&
    typeof place.lon === "number" &&
    Number.isFinite(place.lon) &&
    place.lon >= -180 &&
    place.lon <= 180
  );
}

function browserSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
