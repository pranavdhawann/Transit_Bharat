import { describe, expect, it } from "vitest";
import {
  explainDisruption,
  factsFrom,
  numbersAreGrounded,
  templateNote,
  type DisruptionFacts,
} from "../src/lib/explain";
import { constraintsFor, heuristic } from "../src/lib/ai";
import { getPlace } from "../src/lib/places";
import { planJourneys } from "../src/lib/graph";

const DEPART = Date.UTC(2026, 7, 26, 4, 0);

const FACTS: DisruptionFacts = {
  routeNumber: "620U",
  delayMinutes: 11,
  minutesSaved: 18,
  fareDeltaInr: 30,
  alternativeVia: "Metro Magenta then Yellow via Hauz Khas",
  alternativeMode: "METRO",
  alternativeInterchange: "Hauz Khas",
  alternativeDurationMinutes: 39,
};

describe("disruption explanation", () => {
  it("derives its facts from the router, not from prose", () => {
    const f = getPlace("lm:munirka-market")!;
    const t = getPlace("lm:connaught-place")!;
    const journeys = planJourneys({
      origin: { name: f.name, lat: f.lat, lon: f.lon },
      destination: { name: t.name, lat: t.lat, lon: t.lon },
      departAtMs: DEPART,
      delay: { routeNumber: "620U", minutes: 11 },
    });
    const disrupted = journeys.find((j) => j.disrupted)!;
    const alternative = journeys.find((j) => !j.disrupted)!;
    expect(disrupted).toBeTruthy();
    expect(alternative).toBeTruthy();

    const facts = factsFrom(disrupted, alternative, "620U", 11);
    expect(facts.delayMinutes).toBe(11);
    expect(facts.minutesSaved).toBe(
      Math.max(
        0,
        Math.round(disrupted.durationMinutes - alternative.durationMinutes),
      ),
    );
    expect(facts.fareDeltaInr).toBe(alternative.fareInr - disrupted.fareInr);
    expect(facts.minutesSaved).toBeGreaterThanOrEqual(0);
  });

  it("writes correct bilingual template copy", () => {
    const note = templateNote(FACTS);
    expect(note.en).toContain("620U");
    expect(note.en).toContain("11");
    expect(note.en).toContain("18");
    expect(note.hi).toContain("620U");
    expect(note.hi).toMatch(/[ऀ-ॿ]/); // actually Devanagari
    expect(note.hi).toContain("मेट्रो");
    // Regression: the Hindi sentence used to splice in the English "via"
    // phrase verbatim, so it read as Devanagari wrapped around English.
    expect(note.hi).not.toContain("Metro");
    expect(note.hi).not.toContain("then");
    expect(note.hi).not.toContain("via");
  });

  it("accepts wording that only uses the numbers we supplied", () => {
    const good =
      "Bus 620U is running about 11 minutes late, so the metro gets you there 18 minutes sooner.";
    expect(numbersAreGrounded(good, FACTS)).toBe(true);
  });

  it("rejects wording containing an invented number", () => {
    // 47 was never given to the model. This is the hallucination guard: a made
    // up departure time is a rider missing their last bus.
    const bad =
      "Bus 620U is 11 minutes late; the next metro leaves in 47 minutes.";
    expect(numbersAreGrounded(bad, FACTS)).toBe(false);
  });

  it("does not trip over digits inside the route number itself", () => {
    expect(numbersAreGrounded("Bus 620U is 11 minutes late.", FACTS)).toBe(true);
  });

  it("falls back to the template with a stated reason when no key is set", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const note = await explainDisruption(FACTS);
      expect(note.source).toBe("template");
      expect(note.fallbackReason).toBe("no_api_key");
      expect(note.en).toBe(templateNote(FACTS).en);
      expect(note.hi).toBe(templateNote(FACTS).hi);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });
});

describe("accessibility constraints", () => {
  it("turns a stated wheelchair need into real routing constraints", () => {
    const prefs = heuristic("wheelchair user going to connaught place from saket");
    expect(prefs.accessibilityNeed).toBe("WHEELCHAIR");
    const c = constraintsFor(prefs);
    expect(c.lessWalking).toBe(true);
    expect(c.maxTransfers).toBe(1);
  });

  it("recognises luggage, small children and senior travellers", () => {
    expect(heuristic("carrying heavy bags to CP").accessibilityNeed).toBe(
      "HEAVY_LUGGAGE",
    );
    expect(heuristic("travelling with a toddler to CP").accessibilityNeed).toBe(
      "WITH_CHILD",
    );
    expect(heuristic("with my elderly mother to CP").accessibilityNeed).toBe(
      "SENIOR",
    );
  });

  it("reads a direct-only request as zero interchanges", () => {
    expect(heuristic("direct bus from munirka to cp").maxTransfers).toBe(0);
    expect(constraintsFor(heuristic("direct bus from munirka to cp")).maxTransfers).toBe(0);
  });

  it("keeps the stricter of a stated cap and an implied one", () => {
    const prefs = heuristic("direct bus to cp with a wheelchair");
    expect(constraintsFor(prefs).maxTransfers).toBe(0);
  });

  it("adds no constraints when the rider states none", () => {
    const c = constraintsFor(heuristic("munirka to connaught place"));
    expect(c.lessWalking).toBe(false);
    expect(c.maxTransfers).toBeNull();
  });

  it("honours the transfer cap in the planner", () => {
    const f = getPlace("lm:munirka-market")!;
    const t = getPlace("lm:connaught-place")!;
    const base = {
      origin: { name: f.name, lat: f.lat, lon: f.lon },
      destination: { name: t.name, lat: t.lat, lon: t.lon },
      departAtMs: DEPART,
    };
    const capped = planJourneys({ ...base, maxTransfers: 0 });
    expect(capped.length).toBeGreaterThan(0);
    for (const j of capped) expect(j.transfers).toBe(0);
  });

  it("never returns nothing just because a preference cannot be met", () => {
    const f = getPlace("lm:munirka-market")!;
    const t = getPlace("lm:connaught-place")!;
    // Impossible-to-satisfy cap is expressed as a preference, not a filter.
    const journeys = planJourneys({
      origin: { name: f.name, lat: f.lat, lon: f.lon },
      destination: { name: t.name, lat: t.lat, lon: t.lon },
      departAtMs: DEPART,
      maxTransfers: -1,
    });
    expect(journeys.length).toBeGreaterThan(0);
  });
});
