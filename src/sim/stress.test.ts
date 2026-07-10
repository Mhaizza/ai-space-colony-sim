import { describe, expect, it } from "vitest";
import { createColonist } from "./colonist.js";
import {
  acceptanceSuppression,
  isStressedState,
  noStressInputs,
  tickStress,
} from "./stress.js";
import { STRESS_CALIBRATION } from "./calibration.js";

function colonist() {
  return createColonist({ id: "c1", name: "Test", skills: [] }, 0);
}

describe("M7 stress system", () => {
  it("stays at zero with no active sources or reliefs", () => {
    const c = colonist();
    tickStress(c, 100, noStressInputs());
    expect(c.stress.level).toBe(0);
  });

  it("accumulates from an active source", () => {
    const c = colonist();
    tickStress(c, 1000, { sources: { overwork: true }, reliefs: {} });
    expect(c.stress.level).toBeGreaterThan(0);
    expect(c.stress.attribution.overwork).toBeGreaterThan(0);
  });

  it("dissipates from an active relief", () => {
    const c = colonist();
    c.stress.level = 50;
    tickStress(c, 1000, { sources: {}, reliefs: { "adequate-rest": true } });
    expect(c.stress.level).toBeLessThan(50);
    expect(c.stress.attribution["adequate-rest"]).toBeLessThan(0);
  });

  it("every movement is attributed to its source or relief (traceability)", () => {
    const c = colonist();
    tickStress(c, 500, { sources: { overwork: true, "crisis-exposure": true }, reliefs: { "stable-conditions": true } });
    expect(Object.keys(c.stress.attribution).sort()).toEqual(
      ["crisis-exposure", "overwork", "stable-conditions"].sort(),
    );
  });

  it("clamps to [0, max]", () => {
    const c = colonist();
    tickStress(c, 1e9, { sources: { overwork: true }, reliefs: {} });
    expect(c.stress.level).toBeLessThanOrEqual(STRESS_CALIBRATION.max);
    c.stress.level = 5;
    tickStress(c, 1e9, { sources: {}, reliefs: { "adequate-rest": true } });
    expect(c.stress.level).toBeGreaterThanOrEqual(0);
  });

  it("Stress Response trait modifiers scale accumulation and dissipation", () => {
    const resilient = colonist();
    const volatile = colonist();
    tickStress(resilient, 500, { sources: { overwork: true }, reliefs: {} }, { accumulationMultiplier: 0.5, dissipationMultiplier: 1 });
    tickStress(volatile, 500, { sources: { overwork: true }, reliefs: {} }, { accumulationMultiplier: 2, dissipationMultiplier: 1 });
    expect(volatile.stress.level).toBeGreaterThan(resilient.stress.level);
  });

  it("Stressed ambient state activates only past the behavioral threshold", () => {
    const c = colonist();
    c.stress.level = STRESS_CALIBRATION.behavioralThreshold - 1;
    expect(isStressedState(c)).toBe(false);
    c.stress.level = STRESS_CALIBRATION.behavioralThreshold;
    expect(isStressedState(c)).toBe(true);
  });

  it("acceptance suppression is zero below its threshold and bounded above it (never a veto)", () => {
    const c = colonist();
    c.stress.level = 0;
    expect(acceptanceSuppression(c)).toBe(0);
    c.stress.level = STRESS_CALIBRATION.max;
    expect(acceptanceSuppression(c)).toBeLessThanOrEqual(1);
    expect(acceptanceSuppression(c)).toBeGreaterThan(0);
  });
});
