import { describe, expect, it } from "vitest";
import { substantiveReason } from "../lib/reasons";

describe("substantiveReason", () => {
  it("drops chip-only reasons", () => {
    for (const r of ["I pictured the motion", "I used a formula I read the graph", "Because ", "It seemed obvious.", "", "ok"]) {
      expect(substantiveReason(r)).toBe("");
    }
  });

  it("keeps reasons that state an idea, in any language", () => {
    for (const r of [
      "it stops at the top so acceleration is zero",
      "Because heavier things fall faster",
      "I used the formula v = u + at",
      "పైన ఆగుతుంది కాబట్టి త్వరణం సున్నా",
      "upar rukti hai to acceleration zero",
    ]) {
      expect(substantiveReason(r).length > 0).toBe(true);
    }
  });
});
