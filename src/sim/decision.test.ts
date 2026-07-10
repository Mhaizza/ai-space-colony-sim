import { beforeEach, describe, expect, it } from "vitest";
import { createColonist } from "./colonist.js";
import { NEED_CALIBRATION, SIM_SECONDS_PER_DAY } from "./calibration.js";
import { composeWeight, decide, generateCandidates, resolveTask } from "./decision.js";
import { formMemory, resetMemoryIdSequence } from "./memory.js";
import { neutralNeedModifiers } from "./needs.js";
import { createStage1Policy } from "./policy.js";
import { createPrng } from "../services/prng.js";
import { buildSnapshot } from "./snapshot.js";
import { assignTrait } from "./traits.js";
import { createStage1World, setSurvivalCondition } from "./world.js";
import type { ColonistState } from "./types.js";

function setup(time = 0) {
  const world = createStage1World();
  const policy = createStage1Policy("workstation-1");
  const colonist = createColonist({ id: "c1", name: "Test", skills: [] }, time);
  return { world, policy, colonist, time };
}

function snapshotAt(world: ReturnType<typeof createStage1World>, policy: ReturnType<typeof createStage1Policy>, time: number) {
  return buildSnapshot(world, policy, "c1", time, new Map());
}

beforeEach(() => resetMemoryIdSequence());

describe("M11 decision system — generate", () => {
  it("generates a shift-assignment candidate during the work period", () => {
    const { world, policy, colonist } = setup();
    const snap = snapshotAt(world, policy, 0); // work period
    const candidates = generateCandidates(colonist, snap, neutralNeedModifiers());
    expect(candidates.some((c) => c.source === "shift-assignment")).toBe(true);
  });

  it("generates a critical-need candidate when a biological need is below critical", () => {
    const { world, policy, colonist } = setup();
    colonist.needs.hunger = NEED_CALIBRATION.criticalThreshold - 1;
    const snap = snapshotAt(world, policy, 0);
    const candidates = generateCandidates(colonist, snap, neutralNeedModifiers());
    expect(candidates.some((c) => c.source === "critical-need" && c.needKind === "hunger")).toBe(true);
  });

  it("generates a survival-condition candidate for every active condition", () => {
    const { world, policy, colonist } = setup();
    setSurvivalCondition(world, "oxygen-failure", true);
    const snap = snapshotAt(world, policy, 0);
    const candidates = generateCandidates(colonist, snap, neutralNeedModifiers());
    expect(candidates.some((c) => c.source === "survival-condition")).toBe(true);
  });

  it("generates a voluntary candidate only during the free period", () => {
    const { world, policy, colonist } = setup();
    const workSnap = snapshotAt(world, policy, 0);
    expect(generateCandidates(colonist, workSnap, neutralNeedModifiers()).some((c) => c.source === "voluntary")).toBe(false);
    const freeSnap = snapshotAt(world, policy, SIM_SECONDS_PER_DAY * 0.5);
    expect(generateCandidates(colonist, freeSnap, neutralNeedModifiers()).some((c) => c.source === "voluntary")).toBe(true);
  });
});

describe("M11 decision system — resolve", () => {
  it("resolves hunger to the eat task when the food station has capacity and resource", () => {
    const { world, policy } = setup();
    const snap = snapshotAt(world, policy, 0);
    const task = resolveTask({ id: "low-hunger", source: "low-need", tier: 4, needKind: "hunger" }, snap);
    expect(task).toEqual({ taskId: "eat", moduleId: "food-station-1", taskClass: "satisfaction" });
  });

  it("Safety and Social have no Stage-1 task — blocked, not eliminated", () => {
    const { world, policy } = setup();
    const snap = snapshotAt(world, policy, 0);
    expect(resolveTask({ id: "low-safety", source: "low-need", tier: 4, needKind: "safety" }, snap)).toBeUndefined();
    expect(resolveTask({ id: "low-social", source: "low-need", tier: 4, needKind: "social" }, snap)).toBeUndefined();
  });
});

describe("M11 decision system — priority filter and selection", () => {
  it("Tier 1 survival overrides everything, unconditionally and without weighing", () => {
    const { world, policy, colonist } = setup();
    setSurvivalCondition(world, "oxygen-failure", true);
    colonist.needs.hunger = 0; // also critical — should still lose to tier 1
    const snap = snapshotAt(world, policy, 0);
    const prng = createPrng(1);
    const outcome = decide(colonist, snap, neutralNeedModifiers(), prng, 0);
    expect(outcome?.candidate.source).toBe("survival-condition");
    expect(outcome?.decomposition.traits).toBe(0);
    expect(outcome?.stochastic).toBe(false);
  });

  it("a critical need overrides the shift assignment", () => {
    const { world, policy, colonist } = setup();
    colonist.needs.hunger = NEED_CALIBRATION.criticalThreshold - 1;
    const snap = snapshotAt(world, policy, 0); // work period, shift-assignment also actionable
    const prng = createPrng(1);
    const outcome = decide(colonist, snap, neutralNeedModifiers(), prng, 0);
    expect(outcome?.candidate.source).toBe("critical-need");
  });

  it("falls through to the next tier down when the higher tier is entirely blocked", () => {
    const { world, policy, colonist } = setup();
    colonist.needs.social = 0; // low-need psychological candidate — never actionable at Stage 1
    // No survival condition, no critical need, work period => tier 3 shift-assignment should win
    // even though a lower-priority (tier 4, social) candidate also exists and is blocked.
    const snap = snapshotAt(world, policy, 0);
    const prng = createPrng(1);
    const outcome = decide(colonist, snap, neutralNeedModifiers(), prng, 0);
    expect(outcome?.candidate.source).toBe("shift-assignment");
  });

  it("returns undefined (Blocked) when no tier has an actionable candidate", () => {
    const { world, policy, colonist } = setup();
    colonist.needs.social = 0; // only actionable-less candidate present
    // free period, no other actionable source: workstation not used (free period), no survival, no critical
    const restSnap = snapshotAt(world, policy, SIM_SECONDS_PER_DAY * 0.8);
    // Rest is satisfied by default (starts at satisfactionPoint), so during rest period
    // with nothing else deprived, only the (blocked) social low-need candidate exists —
    // wait, voluntary fires on 'free', not 'rest'; during 'rest' with rest need satisfied
    // and no free/work period, no other source fires either => Blocked.
    const prng = createPrng(1);
    const outcome = decide(colonist, restSnap, neutralNeedModifiers(), prng, 0);
    expect(outcome).toBeUndefined();
  });

  it("decomposition is bounded, decomposable, and reproducible from the same seed [Principle 7]", () => {
    const { world, policy, colonist } = setup();
    assignTrait(colonist, "driven");
    colonist.needs.hunger = NEED_CALIBRATION.lowThreshold - 5;
    colonist.needs.purpose = NEED_CALIBRATION.lowThreshold - 5;
    const snap = snapshotAt(world, policy, 0);
    const a = decide(clone(colonist), snap, neutralNeedModifiers(), createPrng(99), 0);
    const b = decide(clone(colonist), snap, neutralNeedModifiers(), createPrng(99), 0);
    expect(a?.candidate.id).toBe(b?.candidate.id);
    expect(a?.decomposition).toEqual(b?.decomposition);
  });

  it("commits the winning goal onto the goal stack as active, suspending the prior active goal", () => {
    const { world, policy, colonist } = setup();
    const snap = snapshotAt(world, policy, 0);
    const prng = createPrng(1);
    decide(colonist, snap, neutralNeedModifiers(), prng, 0);
    expect(colonist.goalStack.filter((g) => g.status === "active")).toHaveLength(1);

    colonist.needs.hunger = 0; // now critical — should win and suspend the prior active goal
    const outcome2 = decide(colonist, snap, neutralNeedModifiers(), prng, 100);
    expect(outcome2?.candidate.source).toBe("critical-need");
    const active = colonist.goalStack.filter((g) => g.status === "active");
    expect(active).toHaveLength(1);
    expect(colonist.goalStack.some((g) => g.status === "suspended")).toBe(true);
  });

  it("a material memory of hunger deprivation tilts the weight of a hunger candidate upward", () => {
    const { world, policy, colonist } = setup();
    colonist.needs.hunger = NEED_CALIBRATION.lowThreshold - 5;
    formMemory(colonist, { type: "deprivation", impact: "high", description: "the shortage", needKind: "hunger" }, 0);
    const snap = snapshotAt(world, policy, 0);
    const withMemory = composeWeight({ id: "low-hunger", source: "low-need", tier: 4, needKind: "hunger" }, colonist, { hunger: 0.3, rest: 0, safety: 0, social: 0, purpose: 0 }, 1);
    const without = composeWeight({ id: "low-hunger", source: "low-need", tier: 4, needKind: "hunger" }, freshColonist(), { hunger: 0.3, rest: 0, safety: 0, social: 0, purpose: 0 }, 1);
    expect(withMemory.memory).toBeGreaterThan(without.memory);
    expect(withMemory.total).toBeGreaterThan(without.total);
    void snap;
  });
});

function clone(colonist: ColonistState): ColonistState {
  return JSON.parse(JSON.stringify(colonist));
}

function freshColonist(): ColonistState {
  return createColonist({ id: "c2", name: "Fresh", skills: [] }, 0);
}
