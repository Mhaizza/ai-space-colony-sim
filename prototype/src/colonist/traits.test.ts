// M8 Trait System tests — boundedness, decomposability, tier-1 immunity, no behavior selection.

import { describe, expect, it } from "vitest";
import { TRAIT_TUNING, WEIGHT_TUNING } from "../config/tuning.js";
import {
  applyNeedRateContributions,
  applyNeedThresholdContributions,
  applyWeightTiltContributions,
  categoryOf,
  needRateContributions,
  needThresholdContributions,
  weightTiltContributions,
} from "./traits.js";

describe("Stage 1 trait is explicitly non-canonical", () => {
  it("has a category among the four ADR-10 categories", () => {
    expect(["workDisposition", "stressResponse", "socialDisposition", "needDisposition"]).toContain(
      categoryOf("driven"),
    );
  });
});

describe("surface 1 — need rate modifiers: bounded, decomposable", () => {
  it("produces a rate contribution only for the need the trait actually modifies", () => {
    expect(needRateContributions(["driven"], "rest")).toHaveLength(1);
    expect(needRateContributions(["driven"], "hunger")).toHaveLength(0);
  });

  it("a rate contribution is independently attributable to its trait (decomposable)", () => {
    const [contribution] = needRateContributions(["driven"], "rest");
    expect(contribution).toMatchObject({ traitId: "driven" });
    expect(contribution!.decayMultiplier).toBeGreaterThan(0);
  });

  it("the applied rate is bounded within [needRateModifierFloor, needRateModifierCeiling] regardless of base rate", () => {
    const contributions = needRateContributions(["driven"], "rest");
    for (const base of [0.0001, 0.5, 100]) {
      const applied = applyNeedRateContributions(base, contributions);
      const impliedMultiplier = applied / base;
      expect(impliedMultiplier).toBeGreaterThanOrEqual(TRAIT_TUNING.needRateModifierFloor - 1e-9);
      expect(impliedMultiplier).toBeLessThanOrEqual(TRAIT_TUNING.needRateModifierCeiling + 1e-9);
    }
  });

  it("never zeroes a rate — the floor is strictly positive, so applying it can never produce 0 from a nonzero base", () => {
    expect(TRAIT_TUNING.needRateModifierFloor).toBeGreaterThan(0);
    expect(applyNeedRateContributions(0.001, needRateContributions(["driven"], "rest"))).toBeGreaterThan(0);
  });

  it("no held traits leaves the base rate unchanged", () => {
    expect(applyNeedRateContributions(0.5, needRateContributions([], "rest"))).toBe(0.5);
  });
});

describe("surface 1 — need threshold modifiers: bounded, decomposable", () => {
  it("produces a threshold contribution only for the need the trait modifies", () => {
    expect(needThresholdContributions(["driven"], "rest")).toHaveLength(1);
    expect(needThresholdContributions(["driven"], "purpose")).toHaveLength(0);
  });

  it("the applied shift never exceeds thresholdShiftBound in magnitude", () => {
    const contributions = needThresholdContributions(["driven"], "rest");
    for (const base of [0, 0.35, 1]) {
      const applied = applyNeedThresholdContributions(base, contributions);
      expect(Math.abs(applied - base)).toBeLessThanOrEqual(TRAIT_TUNING.thresholdShiftBound + 1e-9);
    }
  });

  it("no held traits leaves the base threshold unchanged", () => {
    expect(applyNeedThresholdContributions(0.4, needThresholdContributions([], "rest"))).toBe(0.4);
  });
});

describe("surface 2 — decision weight tilts: bounded, decomposable, tier-1 immune", () => {
  it("produces a tilt contribution for a source the trait actually tilts", () => {
    expect(weightTiltContributions(["driven"], "shiftAssignment")).toHaveLength(1);
    expect(weightTiltContributions(["driven"], "criticalNeed")).toHaveLength(0);
  });

  it("REGRESSION: tier 1 (survivalCondition) is trait-immune unconditionally — no contributions, no effect", () => {
    const contributions = weightTiltContributions(["driven"], "survivalCondition");
    expect(contributions).toEqual([]);
    expect(applyWeightTiltContributions(1, contributions)).toBe(1);
  });

  it("the applied tilt is bounded within [familyTiltFloor, familyTiltCap]", () => {
    const contributions = weightTiltContributions(["driven"], "shiftAssignment");
    for (const base of [0.01, 1, 50]) {
      const applied = applyWeightTiltContributions(base, contributions);
      const impliedMultiplier = applied / base;
      expect(impliedMultiplier).toBeGreaterThanOrEqual(WEIGHT_TUNING.familyTiltFloor - 1e-9);
      expect(impliedMultiplier).toBeLessThanOrEqual(WEIGHT_TUNING.familyTiltCap + 1e-9);
    }
  });

  it("never zeroes or vetoes a weight — the floor is strictly positive", () => {
    expect(WEIGHT_TUNING.familyTiltFloor).toBeGreaterThan(0);
    expect(applyWeightTiltContributions(0.5, weightTiltContributions(["driven"], "voluntary"))).toBeGreaterThan(0);
  });

  it("no held traits leaves the base weight unchanged", () => {
    expect(applyWeightTiltContributions(1, weightTiltContributions([], "shiftAssignment"))).toBe(1);
  });
});

describe("no direct behavior selection", () => {
  it("every exported function returns a number or a plain list of numeric contributions — never a goal, task, or action", () => {
    const rateContribs = needRateContributions(["driven"], "rest");
    const thresholdContribs = needThresholdContributions(["driven"], "rest");
    const tiltContribs = weightTiltContributions(["driven"], "shiftAssignment");

    expect(typeof applyNeedRateContributions(0.5, rateContribs)).toBe("number");
    expect(typeof applyNeedThresholdContributions(0.4, thresholdContribs)).toBe("number");
    expect(typeof applyWeightTiltContributions(1, tiltContribs)).toBe("number");
    for (const c of [...rateContribs, ...thresholdContribs, ...tiltContribs]) {
      const numericFields = Object.entries(c).filter(([k]) => k !== "traitId");
      expect(numericFields.every(([, v]) => typeof v === "number")).toBe(true);
    }
  });
});

describe("purity and determinism", () => {
  it("identical inputs produce identical results", () => {
    expect(needRateContributions(["driven"], "rest")).toEqual(needRateContributions(["driven"], "rest"));
    expect(weightTiltContributions(["driven"], "voluntary")).toEqual(weightTiltContributions(["driven"], "voluntary"));
  });

  it("does not mutate the input traits array", () => {
    const traits: readonly ("driven")[] = ["driven"];
    const snapshot = [...traits];
    needRateContributions(traits, "rest");
    weightTiltContributions(traits, "shiftAssignment");
    expect(traits).toEqual(snapshot);
  });
});
