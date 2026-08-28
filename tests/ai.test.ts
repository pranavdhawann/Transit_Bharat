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

  it("parses a natural Hindi journey", () => {
    const p = heuristic("मुझे मुनीरका से कनॉट प्लेस जाना है");
    expect(p.originText).toBe("मुनीरका");
    expect(p.destinationText).toBe("कनॉट प्लेस");
  });

  it("parses a Hinglish journey and mobility need", () => {
    const p = heuristic(
      "mujhe munirka se connaught place jana hai, seedhi use nahi kar sakta",
    );
    expect(p.originText).toBe("munirka");
    expect(p.destinationText).toBe("connaught place");
    expect(p.walkingPreference).toBe("LOW");
    expect(p.accessibilityNeed).toBe("STEP_FREE");
  });

  it.each([
    ["I'm in a wheelchair", "WHEELCHAIR"],
    ["I need accessible stations", "STEP_FREE"],
    ["I have difficulty walking", "LIMITED_MOBILITY"],
    ["travelling with an elderly person", "SENIOR"],
    ["I have a stroller", "WITH_CHILD"],
    ["travelling with heavy luggage", "HEAVY_LUGGAGE"],
    ["I am pregnant", "PREGNANT"],
    ["I am disabled", "LIMITED_MOBILITY"],
    ["divyang passenger", "LIMITED_MOBILITY"],
  ])("recognises accessibility phrase: %s", (text, expected) => {
    const p = heuristic(text);
    expect(p.accessibilityNeed).toBe(expected);
    expect(p.walkingPreference).toBe("LOW");
  });

  it("keeps a Divyang descriptor out of the origin place", () => {
    const p = heuristic("divyang passenger ko Munirka se CP jana hai");
    expect(p.originText).toBe("munirka");
    expect(p.destinationText).toBe("cp");
    expect(p.accessibilityNeed).toBe("LIMITED_MOBILITY");
  });
});
