import type { JourneyLocation, PlaceResult } from "./types";

export const CURRENT_LOCATION_ID = "current-location";
export const CURRENT_LOCATION_STORAGE_KEY = "bt:current-location";
export const SELECTED_PLACES_STORAGE_KEY = "bt:selected-places";

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
  if (id === CURRENT_LOCATION_ID) {
    const place = loadCurrentLocation(storage);
    if (!place) return null;
    return {
      location: { name: place.name, lat: place.lat, lon: place.lon },
    };
  }
  if (id.startsWith("geo:")) {
    const place = loadSelectedPlace(id, storage);
    if (!place) return null;
    return {
      location: { name: place.name, lat: place.lat, lon: place.lon, kind: "place" },
    };
  }
  return id ? { id } : null;
}

/**
 * Keep coordinates for geocoder choices out of the URL while Plan and GO
 * navigate between pages. Unlike device location, several address choices may
 * coexist (From and To), so they share a small id-keyed session map.
 */
export function saveSelectedPlace(
  place: PlaceResult,
  storage?: ReadableStorage & WritableStorage,
): boolean {
  const target = storage ?? browserSessionStorage();
  if (!target || !isSelectedPlace(place)) return false;
  try {
    const current = readSelectedPlaces(target);
    current[place.id] = place;
    target.setItem(SELECTED_PLACES_STORAGE_KEY, JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

export function loadSelectedPlace(
  id: string,
  storage?: ReadableStorage,
): PlaceResult | null {
  const target = storage ?? browserSessionStorage();
  if (!target || !id.startsWith("geo:")) return null;
  try {
    const place = readSelectedPlaces(target)[id];
    return isSelectedPlace(place) ? place : null;
  } catch {
    return null;
  }
}

function readSelectedPlaces(storage: ReadableStorage): Record<string, PlaceResult> {
  const parsed = JSON.parse(storage.getItem(SELECTED_PLACES_STORAGE_KEY) ?? "{}");
  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, PlaceResult>)
    : {};
}

function isSelectedPlace(value: unknown): value is PlaceResult {
  if (!value || typeof value !== "object") return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === "string" &&
    place.id.startsWith("geo:") &&
    typeof place.name === "string" &&
    place.name.trim().length > 0 &&
    place.name.length <= 160 &&
    place.type === "address" &&
    validCoordinate(place.lat, -90, 90) &&
    validCoordinate(place.lon, -180, 180)
  );
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
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
