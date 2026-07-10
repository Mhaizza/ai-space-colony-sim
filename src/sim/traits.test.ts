import { describe, expect, it } from "vitest";
import { createColonist } from "./colonist.js";
import { aggregateNeedModifiers, aggregateStressModifiers, assignTrait, traitWeightTilt, TRAIT_DEFINITIONS } from "./traits.js";
import { WEIGHT_CALIBRATION } from "./calibration.js";

function colonist() {
  return createColonist({ id: "c1", name: "Test", skills: [] }, 0);
}

describe("M8 trait system", () => {
  it("covers all four trait categories with the provisional set", () => {
    const categories = new Set(Object.values(TRAIT_DEFINITIONS).map((t) => t.category));
    expect(categories).toEqual(new Set(["work-disposition", "stress-response", "social-disposition", "need-disposition"]));
  });

  it("assigns a trait as Unknown discovery state — undiscovered traits still show in state", () => {
    const c = colonist();
    assignTrait(c, "driven");
    expect(c.traits).toHaveLength(1);
    expect(c.traits[0]!.discovery).toBe("unknown");
  });

  it("assigning the same trait twice is idempotent", () => {
    const c = colonist();
    assignTrait(c, "driven");
    assignTrait(c, "driven");
    expect(c.traits).toHaveLength(1);
  });

  it("Resilient scales stress accumulation down and dissipation up", () => {
    const c = colonist();
    assignTrait(c, "resilient");
    const mods = aggregateStressModifiers(c);
    expect(mods.accumulationMultiplier).toBeLessThan(1);
    expect(mods.dissipationMultiplier).toBeGreaterThan(1);
  });

  it("Wary raises Safety need decay rate and lowers its low threshold sensitivity", () => {
    const c = colonist();
    assignTrait(c, "wary");
    const mods = aggregateNeedModifiers(c);
    expect(mods.decayRateMultiplier.safety).toBeGreaterThan(1);
    expect(mods.thresholdShift.safety?.low).toBeGreaterThan(0);
  });

  it("trait weight tilt is bounded — never large enough to veto or guarantee a candidate", () => {
    const c = colonist();
    assignTrait(c, "driven");
    assignTrait(c, "social");
    const tilt = traitWeightTilt(c, "voluntary");
    expect(Math.abs(tilt)).toBeLessThanOrEqual(WEIGHT_CALIBRATION.maxFamilyContributionFraction);
  });

  it("traits with no tilt for a source contribute zero", () => {
    const c = colonist();
    assignTrait(c, "resilient"); // stress-only trait
    expect(traitWeightTilt(c, "voluntary")).toBe(0);
  });
});
