import { describe, expect, it } from "vitest";
import { heuristic } from "../src/lib/ai";

describe("heuristic trip parser (AI fallback)", () => {
  it("extracts origin, destination, deadline and walking preference", () => {
    const p = heuristic(
      "Need to reach Nehru Place from Munirka before 10 am, cannot walk much",
    );
    expect(p.destinationText).toBe("nehru place");
    expect(p.originText).toBe("munirka");
    expect(p.arriveByTime).toBe("10:00");
    expect(p.walkingPreference).toBe("LOW");
  });

  it("handles the 'from X to Y' ordering", () => {
    const p = heuristic("from hauz khas to connaught place");
    expect(p.originText).toBe("hauz khas");
    expect(p.destinationText).toBe("connaught place");
    expect(p.arriveByTime).toBeNull();
  });

  it("parses pm deadlines", () => {
    const p = heuristic("reach cp by 3:30 pm from munirka");
    expect(p.arriveByTime).toBe("15:30");
    expect(p.originText).toBe("munirka");
  });
});
