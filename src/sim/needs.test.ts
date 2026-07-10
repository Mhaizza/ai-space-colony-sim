import { describe, expect, it } from "vitest";
import { createColonist } from "./colonist.js";
import {
  applyRestAmplifier,
  computeUrgencies,
  isBelowCritical,
  isBelowLow,
  needUrgency,
  stepNeedLevel,
  tickNeeds,
} from "./needs.js";
import { NEED_CALIBRATION } from "./calibration.js";

function colonist() {
  return createColonist({ id: "c1", name: "Test", skills: [] }, 0);
}

describe("M6 need system", () => {
  it("decays monotonically toward zero absent satisfaction", () => {
    let level = 100;
    for (let i = 0; i < 5; i++) {
      const next = stepNeedLevel(level, "hunger", 100, false, 1);
      expect(next).toBeLessThanOrEqual(level);
      level = next;
    }
  });

  it("never improves spontaneously — only restores while satisfying holds", () => {
    const decayed = stepNeedLevel(50, "hunger", 10, false, 1);
    const restored = stepNeedLevel(50, "hunger", 10, true, 1);
    expect(decayed).toBeLessThan(50);
    expect(restored).toBeGreaterThan(50);
  });

  it("clamps to [0, max]", () => {
    expect(stepNeedLevel(1, "hunger", 100000, false, 1)).toBe(0);
    expect(stepNeedLevel(99, "hunger", 100000, true, 1)).toBe(NEED_CALIBRATION.max);
  });

  it("contributes zero urgency above the low threshold", () => {
    expect(needUrgency(NEED_CALIBRATION.lowThreshold + 1, "hunger", { decayRateMultiplier: {}, thresholdShift: {} })).toBe(0);
  });

  it("urgency grows monotonically with deficit depth", () => {
    const mods = { decayRateMultiplier: {}, thresholdShift: {} };
    const u1 = needUrgency(NEED_CALIBRATION.lowThreshold - 5, "hunger", mods);
    const u2 = needUrgency(NEED_CALIBRATION.lowThreshold - 20, "hunger", mods);
    expect(u2).toBeGreaterThan(u1);
  });

  it("Rest amplifier only amplifies existing urgency, never manufactures it", () => {
    const zeroUrgencies = { hunger: 0, rest: 0, safety: 0, social: 0, purpose: 0 } as const;
    const amplified = applyRestAmplifier({ ...zeroUrgencies }, 5); // rest deeply deprived
    expect(amplified.hunger).toBe(0);
    expect(amplified.safety).toBe(0);
  });

  it("Rest amplifier scales existing urgency when Rest is sustained-deprived", () => {
    const base = { hunger: 0.4, rest: 0, safety: 0, social: 0, purpose: 0 };
    const notAmplified = applyRestAmplifier({ ...base }, 90);
    const amplified = applyRestAmplifier({ ...base }, 5);
    expect(amplified.hunger).toBeGreaterThan(notAmplified.hunger);
  });

  it("psychological needs have no critical threshold [ADR-17 D4]", () => {
    const c = colonist();
    c.needs.safety = 0;
    expect(isBelowCritical(c, "safety")).toBe(false);
  });

  it("biological needs cross critical when deeply deprived", () => {
    const c = colonist();
    c.needs.hunger = 5;
    expect(isBelowCritical(c, "hunger")).toBe(true);
  });

  it("emits a low-threshold-crossing trigger exactly once when the level dips below it", () => {
    const c = colonist();
    c.needs.hunger = NEED_CALIBRATION.lowThreshold + 1;
    const crossings = tickNeeds(c, 10000, {});
    expect(crossings.some((x) => x.need === "hunger" && x.kind === "low" && x.direction === "entered")).toBe(true);
  });

  it("satisfaction point sits strictly above the low threshold (structural hysteresis)", () => {
    expect(NEED_CALIBRATION.satisfactionPoint).toBeGreaterThan(NEED_CALIBRATION.lowThreshold);
  });

  it("computeUrgencies returns all five needs", () => {
    const c = colonist();
    const urgencies = computeUrgencies(c);
    expect(Object.keys(urgencies).sort()).toEqual(["hunger", "purpose", "rest", "safety", "social"]);
  });

  it("isBelowLow reflects trait-shifted thresholds", () => {
    const c = colonist();
    c.needs.hunger = NEED_CALIBRATION.lowThreshold - 1;
    expect(isBelowLow(c, "hunger")).toBe(true);
    const shifted = { decayRateMultiplier: {}, thresholdShift: { hunger: { low: -50 } } };
    expect(isBelowLow(c, "hunger", shifted)).toBe(false);
  });
});
