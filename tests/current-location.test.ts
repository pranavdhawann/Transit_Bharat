import { describe, expect, it } from "vitest";
import {
  CURRENT_LOCATION_STORAGE_KEY,
  currentLocationPlace,
  journeyEndpointFor,
  loadCurrentLocation,
  saveCurrentLocation,
} from "../src/lib/current-location";

function memoryStorage() {
  let value: string | null = null;
  return {
    getItem(key: string) {
      return key === CURRENT_LOCATION_STORAGE_KEY ? value : null;
    },
    setItem(key: string, next: string) {
      if (key === CURRENT_LOCATION_STORAGE_KEY) value = next;
    },
  };
}

describe("current-location handoff", () => {
  it("keeps exact coordinates in session storage and out of the route id", () => {
    const storage = memoryStorage();
    const place = currentLocationPlace({
      latitude: 28.558,
      longitude: 77.1765,
      accuracy: 17.6,
    });

    expect(place).toMatchObject({
      id: "current-location",
      name: "Current location",
      type: "current",
      lat: 28.558,
      lon: 77.1765,
      detail: "Device location · accurate to about 18 m",
    });
    expect(saveCurrentLocation(place, storage)).toBe(true);
    expect(loadCurrentLocation(storage)).toEqual(place);
    expect(journeyEndpointFor(place.id, storage)).toEqual({
      location: { name: "Current location", lat: 28.558, lon: 77.1765 },
    });
  });

  it("rejects corrupted or out-of-range stored coordinates", () => {
    const storage = memoryStorage();
    storage.setItem(
      CURRENT_LOCATION_STORAGE_KEY,
      JSON.stringify({
        id: "current-location",
        name: "Current location",
        type: "current",
        lat: 128.558,
        lon: 77.1765,
      }),
    );

    expect(loadCurrentLocation(storage)).toBeNull();
    expect(journeyEndpointFor("current-location", storage)).toBeNull();
    expect(journeyEndpointFor("lm:connaught-place", storage)).toEqual({
      id: "lm:connaught-place",
    });
  });
});
