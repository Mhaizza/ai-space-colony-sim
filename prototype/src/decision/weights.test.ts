// M11 weight composition tests — bounded, decomposable, order-independent, bound-never-veto,
// per-family contribution coverage (traits, memory, stress, empty relationships).

import { describe, expect, it } from "vitest";
import { WEIGHT_TUNING } from "../config/tuning.js";
import { createStress, type StressState } from "../colonist/stress.js";
import { considerDeprivationFormation, createMemoryPool, type MemoryPool } from "../colonist/memory.js";
import type { GoalCandidate } from "./goals.js";
import {
  applyMemoryContributions,
  applyRelationshipContributions,
  applyStressWeightContributions,
  composeWeight,
  memoryContributions,
  relationshipContributions,
  stressWeightContributions,
} from "./weights.js";

const lowNeedHunger: GoalCandidate = { source: "lowNeed", tier: 4, key: "lowNeed:hunger", baseUrgency: 0.4, relatedNeed: "hunger" };
const criticalHunger: GoalCandidate = { source: "criticalNeed", tier: 2, key: "criticalNeed:hunger", baseUrgency: 0.9, relatedNeed: "hunger" };
const shiftAssignment: GoalCandidate = { source: "shiftAssignment", tier: 3, key: "shiftAssignment:work", baseUrgency: WEIGHT_TUNING.assignmentBaseWeight };
const voluntary: GoalCandidate = { source: "voluntary", tier: 5, key: "voluntary:idle", baseUrgency: WEIGHT_TUNING.voluntaryBaseWeight };

const noStress = createStress();
const highStress: StressState = { level: 0.9 };
const emptyMemory: MemoryPool = createMemoryPool();

describe("relationships family — always empty at Stage 1", () => {
  it("relationshipContributions is always an empty list", () => {
    expect(relationshipContributions()).toEqual([]);
  });

  it("applying it leaves the base weight exactly unchanged", () => {
    expect(applyRelationshipContributions(0.5)).toBe(0.5);
    expect(applyRelationshipContributions(1)).toBe(1);
  });

  it("composeWeight's relationships factor is always exactly 1", () => {
    const w = composeWeight(lowNeedHunger, [], emptyMemory, noStress, 0);
    expect(w.relationships).toBe(1);
  });
});

describe("trait family contribution", () => {
  it("a held trait produces a nontrivial tilt on a source it modifies", () => {
    const withDriven = composeWeight(shiftAssignment, ["driven"], emptyMemory, noStress, 0);
    const without = composeWeight(shiftAssignment, [], emptyMemory, noStress, 0);
    expect(withDriven.traits).not.toBe(without.traits);
    expect(withDriven.traitContributions.length).toBeGreaterThan(0);
  });

  it("no held traits leaves the traits factor at exactly 1", () => {
    const w = composeWeight(lowNeedHunger, [], emptyMemory, noStress, 0);
    expect(w.traits).toBe(1);
    expect(w.traitContributions).toEqual([]);
  });
});

describe("memory family contribution — read-only", () => {
  it("a matching Deprivation memory produces a nonzero contribution", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    const contributions = memoryContributions(memory, lowNeedHunger, 10);
    expect(contributions).toHaveLength(1);
    expect(contributions[0]!.influence).toBeGreaterThan(0);
  });

  it("a non-matching memory (different need) produces no contribution", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "rest", 1, 0);
    expect(memoryContributions(memory, lowNeedHunger, 10)).toEqual([]);
  });

  it("a candidate with no relatedNeed (e.g. shiftAssignment) never matches any memory", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    expect(memoryContributions(memory, shiftAssignment, 10)).toEqual([]);
  });

  it("matching memory raises the composed weight relative to no memory", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    const withMemory = composeWeight(lowNeedHunger, [], memory, noStress, 1);
    const withoutMemory = composeWeight(lowNeedHunger, [], emptyMemory, noStress, 1);
    expect(withMemory.memory).toBeGreaterThan(withoutMemory.memory);
  });

  it("memory functions here never form, mutate, fade, or evict — only memory.ts's read-only influence() is called", () => {
    // Structural check: memoryContributions/applyMemoryContributions accept a MemoryPool and
    // return numbers; neither imports or calls considerDeprivationFormation/considerConditionFormation.
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    const snapshot = JSON.parse(JSON.stringify(memory));
    memoryContributions(memory, lowNeedHunger, 500);
    expect(memory).toEqual(snapshot); // untouched by a decision-side read
  });
});

describe("stress family contribution", () => {
  it("relief-serving candidates (lowNeed, voluntary) get boosted once Stressed", () => {
    const contributions = stressWeightContributions(highStress, lowNeedHunger);
    expect(contributions.some((c) => c.channel === "reliefBoost")).toBe(true);
  });

  it("demanding candidates (shiftAssignment) get suppressed once past the acceptance threshold", () => {
    const contributions = stressWeightContributions(highStress, shiftAssignment);
    expect(contributions.some((c) => c.channel === "demandSuppress")).toBe(true);
  });

  it("no contribution below the relevant thresholds", () => {
    expect(stressWeightContributions(noStress, lowNeedHunger)).toEqual([]);
    expect(stressWeightContributions(noStress, shiftAssignment)).toEqual([]);
  });

  it("criticalNeed candidates are unaffected by stress tilting (already maximal urgency)", () => {
    expect(stressWeightContributions(highStress, criticalHunger)).toEqual([]);
  });
});

describe("boundedness — every family clamped to [familyTiltFloor, familyTiltCap]", () => {
  it("trait multiplier stays within bounds", () => {
    const w = composeWeight(shiftAssignment, ["driven"], emptyMemory, noStress, 0);
    expect(w.traits).toBeGreaterThanOrEqual(WEIGHT_TUNING.familyTiltFloor);
    expect(w.traits).toBeLessThanOrEqual(WEIGHT_TUNING.familyTiltCap);
  });

  it("memory multiplier stays within bounds even with many matching memories", () => {
    let memory: MemoryPool = emptyMemory;
    for (let i = 0; i < 5; i++) {
      memory = considerDeprivationFormation(memory, i, "hunger" as const, 1, 0);
    }
    const applied = applyMemoryContributions(1, memoryContributions(memory, lowNeedHunger, 5));
    expect(applied).toBeGreaterThanOrEqual(WEIGHT_TUNING.familyTiltFloor);
    expect(applied).toBeLessThanOrEqual(WEIGHT_TUNING.familyTiltCap);
  });

  it("stress multiplier stays within bounds", () => {
    const applied = applyStressWeightContributions(1, stressWeightContributions(highStress, lowNeedHunger));
    expect(applied).toBeGreaterThanOrEqual(WEIGHT_TUNING.familyTiltFloor);
    expect(applied).toBeLessThanOrEqual(WEIGHT_TUNING.familyTiltCap);
  });
});

describe("bound-never-veto", () => {
  it("no combination of modifiers can reduce an actionable candidate's composed weight to zero", () => {
    let memory: MemoryPool = emptyMemory;
    for (let i = 0; i < 10; i++) {
      memory = considerDeprivationFormation(memory, i, "hunger", 1, 0);
    }
    const w = composeWeight(lowNeedHunger, ["driven"], memory, highStress, 10);
    expect(w.composed).toBeGreaterThan(0);
  });

  it("no combination of modifiers can force a composed weight to guarantee selection (finite, bounded, not infinite)", () => {
    let memory: MemoryPool = emptyMemory;
    for (let i = 0; i < 10; i++) {
      memory = considerDeprivationFormation(memory, i, "hunger", 1, 0);
    }
    const w = composeWeight(lowNeedHunger, ["driven"], memory, highStress, 10);
    const maxPossible = lowNeedHunger.baseUrgency * WEIGHT_TUNING.baseScale * WEIGHT_TUNING.familyTiltCap ** 4;
    expect(w.composed).toBeLessThanOrEqual(maxPossible + 1e-9);
  });
});

describe("exact decomposition and reconstruction", () => {
  it("composed equals the exact product of the five named factors", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    const w = composeWeight(lowNeedHunger, ["driven"], memory, highStress, 5);
    const reconstructed = w.base * w.traits * w.memory * w.stress * w.relationships;
    expect(w.composed).toBeCloseTo(reconstructed, 10);
  });

  it("every family's contribution list is independently retrievable and attributable", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    const w = composeWeight(lowNeedHunger, ["driven"], memory, highStress, 5);
    expect(w.traitContributions.every((c) => c.traitId === "driven")).toBe(true);
    expect(w.memoryContributions.every((c) => typeof c.memoryId === "number")).toBe(true);
    expect(w.stressContributions.every((c) => typeof c.channel === "string")).toBe(true);
  });
});

describe("order-independent composition", () => {
  it("multiplying the five factors in any order yields the same result", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    const w = composeWeight(lowNeedHunger, ["driven"], memory, highStress, 5);
    const factors = [w.base, w.traits, w.memory, w.stress, w.relationships];
    const forward = factors.reduce((p, f) => p * f, 1);
    const reversed = [...factors].reverse().reduce((p, f) => p * f, 1);
    const shuffled = [factors[2]!, factors[0]!, factors[4]!, factors[1]!, factors[3]!].reduce((p, f) => p * f, 1);
    expect(forward).toBeCloseTo(w.composed, 10);
    expect(reversed).toBeCloseTo(w.composed, 10);
    expect(shuffled).toBeCloseTo(w.composed, 10);
  });
});

describe("no cross-tier modifier movement", () => {
  it("composeWeight never changes a candidate's tier", () => {
    const w4 = composeWeight(lowNeedHunger, ["driven"], emptyMemory, highStress, 0);
    const w2 = composeWeight(criticalHunger, ["driven"], emptyMemory, highStress, 0);
    expect(w4.tier).toBe(4);
    expect(w2.tier).toBe(2);
  });
});

describe("purity and determinism", () => {
  it("identical inputs produce identical composed weights", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    expect(composeWeight(lowNeedHunger, ["driven"], memory, highStress, 5)).toEqual(
      composeWeight(lowNeedHunger, ["driven"], memory, highStress, 5),
    );
  });

  it("does not mutate its inputs", () => {
    const memory = considerDeprivationFormation(emptyMemory, 0, "hunger", 1, 0);
    const memorySnapshot = JSON.parse(JSON.stringify(memory));
    const stressSnapshot = { ...highStress };
    composeWeight(lowNeedHunger, ["driven"], memory, highStress, 5);
    expect(memory).toEqual(memorySnapshot);
    expect(highStress).toEqual(stressSnapshot);
  });
});
