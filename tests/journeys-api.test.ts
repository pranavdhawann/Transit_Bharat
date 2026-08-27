import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/journeys/route";

describe("journey API coordinate endpoints", () => {
  it("plans from the rider's current coordinates to an indexed place", async () => {
    const request = new Request("http://localhost/api/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromLocation: {
          name: "Current location",
          lat: 28.558,
          lon: 77.1765,
        },
        toId: "lm:connaught-place",
      }),
    });

    const response = await POST(request);
    const data = (await response.json()) as {
      journeys?: Array<{
        legs: Array<{ from: { name: string } }>;
        query?: {
          fromLocation?: { name: string; lat: number; lon: number };
        };
      }>;
    };

    expect(response.status).toBe(200);
    expect(data.journeys?.length).toBeGreaterThan(0);
    expect(data.journeys?.[0]?.legs[0]?.from.name).toBe("Current location");
    expect(data.journeys?.[0]?.query?.fromLocation).toEqual({
      name: "Current location",
      lat: 28.558,
      lon: 77.1765,
    });
  });

  it("rejects malformed coordinates instead of passing them to the router", async () => {
    const request = new Request("http://localhost/api/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromLocation: {
          name: "Current location",
          lat: 128.558,
          lon: 77.1765,
        },
        toId: "lm:connaught-place",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("does not trust a caller-supplied current-location label", async () => {
    const request = new Request("http://localhost/api/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromLocation: {
          name: '<img src=x onerror="alert(1)">',
          lat: 28.558,
          lon: 77.1765,
        },
        toId: "lm:connaught-place",
      }),
    });

    const response = await POST(request);
    const data = (await response.json()) as {
      journeys: Array<{ legs: Array<{ from: { name: string } }> }>;
    };

    expect(response.status).toBe(200);
    expect(data.journeys[0]?.legs[0]?.from.name).toBe("Current location");
  });
});
