import { describe, expect, it, vi } from "vitest";
import { parsePhotonResults, searchGeocodedPlaces } from "../src/lib/geocode";

const photon = {
  features: [
    {
      geometry: { type: "Point", coordinates: [77.2515, 28.5437] },
      properties: {
        osm_type: "N",
        osm_id: 42,
        name: "B Block Kalkaji",
        street: "Hansraj Sethi Marg",
        district: "South East Delhi",
        city: "Delhi",
      },
    },
    {
      geometry: { type: "Point", coordinates: [73.0168, 19.004] },
      properties: { name: "NRI Complex", city: "Navi Mumbai" },
    },
    {
      geometry: { type: "Point", coordinates: [77.3304, 28.6725] },
      properties: { name: "Alaknanda Apartments", city: "Ghaziabad" },
    },
  ],
};

describe("Delhi geocoder adapter", () => {
  it("maps Photon results and rejects locations outside the Delhi guardrail", () => {
    expect(parsePhotonResults(photon)).toEqual([
      {
        id: "geo:N:42",
        name: "B Block Kalkaji",
        type: "address",
        lat: 28.5437,
        lon: 77.2515,
        detail: "Hansraj Sethi Marg · South East Delhi · Delhi",
      },
    ]);
  });

  it("uses a Delhi-biased, bounded provider request", async () => {
    const fetcher = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) =>
      new Response(JSON.stringify(photon), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const places = await searchGeocodedPlaces(
      "B Block Kalkaji unique",
      6,
      fetcher as unknown as typeof fetch,
    );
    expect(places).toHaveLength(1);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("bbox")).toBe("76.8,28.3,77.6,29.05");
    expect(url.searchParams.get("q")).toBe("B Block Kalkaji unique");
  });
});
