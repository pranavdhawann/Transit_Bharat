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

  it("keeps a bounded plain-text label for a selected geocoded place", async () => {
    const request = new Request("http://localhost/api/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromLocation: {
          kind: "place",
          name: "NRI Complex <script>alert(1)</script>",
          lat: 28.53015,
          lon: 77.24875,
        },
        toId: "lm:c-block-kalkaji",
      }),
    });
    const response = await POST(request);
    const data = (await response.json()) as {
      journeys: Array<{ legs: Array<{ from: { name: string } }> }>;
    };
    expect(response.status).toBe(200);
    expect(data.journeys[0]?.legs[0]?.from.name).toBe(
      "NRI Complex scriptalert(1)/script",
    );
  });

  it("rejects valid coordinates outside the Delhi NCR pilot area", async () => {
    const response = await POST(
      new Request("http://localhost/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocation: { lat: 19.076, lon: 72.8777 },
          toId: "lm:connaught-place",
        }),
      }),
    );
    const data = (await response.json()) as { error?: string };
    expect(response.status).toBe(422);
    expect(data.error).toBe("OUTSIDE_SERVICE_AREA");
  });

  it("rejects the same start and destination", async () => {
    const response = await POST(
      new Request("http://localhost/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromId: "lm:connaught-place",
          toId: "lm:connaught-place",
        }),
      }),
    );
    const data = (await response.json()) as { error?: string };
    expect(response.status).toBe(400);
    expect(data.error).toBe("SAME_PLACE");
  });

  it("echoes and explains an accessibility-aware plan", async () => {
    const response = await POST(
      new Request("http://localhost/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromId: "lm:munirka-market",
          toId: "lm:connaught-place",
          accessibilityNeed: "WHEELCHAIR",
          maxTransfers: 1,
        }),
      }),
    );
    const data = (await response.json()) as {
      journeys?: Array<{ query?: { accessibilityNeed?: string } }>;
      accessibility?: { requested: string; applied: string[]; warnings: string[] };
    };
    expect(response.status).toBe(200);
    expect(data.journeys?.[0]?.query?.accessibilityNeed).toBe("WHEELCHAIR");
    expect(data.accessibility?.requested).toBe("WHEELCHAIR");
    expect(data.accessibility?.applied).toContain(
      "Ordinary auto-rickshaw fallback disabled",
    );
    expect(data.accessibility?.warnings.join(" ")).toContain(
      "cannot be verified",
    );
  });
});
