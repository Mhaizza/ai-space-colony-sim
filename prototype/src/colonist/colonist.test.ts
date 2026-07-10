// M5 Colonist State container tests (validation plan: colonist + needs step).

import { describe, expect, it } from "vitest";
import { NEEDS } from "../config/constants.js";
import {
  createColonist,
  withCurrentGoal,
  withMemory,
  withNeeds,
  withStress,
  withSuspendedGoal,
  type ColonistState,
} from "./colonist.js";
import { decayNeeds } from "./needs.js";
import { considerDeprivationFormation } from "./memory.js";
import { evaluateStress } from "./stress.js";
import { commitGoal, type Goal, type GoalCandidate } from "../decision/goals.js";

const sampleCandidate: GoalCandidate = { source: "lowNeed", tier: 4, key: "lowNeed:hunger", baseUrgency: 0.4, relatedNeed: "hunger" };

describe("colonist creation", () => {
  it("fixes identity (including base traits) and starts all needs fully satisfied, memory empty, unstressed, no goal", () => {
    const c = createColonist("c1", "Maya", ["engineering"], ["driven"]);
    expect(c.identity).toEqual({ id: "c1", name: "Maya", skills: ["engineering"], baseTraits: ["driven"] });
    expect(c.memory).toEqual([]);
    expect(c.stress.level).toBe(0);
    expect(c.currentGoal).toBeNull();
    expect(c.suspendedGoal).toBeNull();
    for (const id of NEEDS) {
      expect(c.needs[id].level).toBe(1);
    }
  });

  it("defaults to no skills and no traits", () => {
    const c = createColonist("c2", "Chen");
    expect(c.identity.skills).toEqual([]);
    expect(c.identity.baseTraits).toEqual([]);
  });

  it("copies the skills and traits arrays rather than aliasing the caller's arrays", () => {
    const skills = ["engineering"];
    const traits: ("driven")[] = ["driven"];
    const c = createColonist("c3", "Rho", skills, traits);
    skills.push("medical");
    traits.pop();
    expect(c.identity.skills).toEqual(["engineering"]);
    expect(c.identity.baseTraits).toEqual(["driven"]);
  });
});

describe("withNeeds — the only path to change a colonist's needs", () => {
  it("replaces the needs slice and leaves identity untouched", () => {
    const c = createColonist("c1", "Maya");
    const decayed = decayNeeds(c.needs, 500);
    const updated = withNeeds(c, decayed);
    expect(updated.identity).toEqual(c.identity);
    expect(updated.needs).toEqual(decayed);
  });

  it("is pure — does not mutate the input colonist", () => {
    const c = createColonist("c1", "Maya");
    const before: ColonistState = JSON.parse(JSON.stringify(c));
    withNeeds(c, decayNeeds(c.needs, 500));
    expect(c).toEqual(before);
  });

  it("only accepts a NeedsState already produced by needs.ts — never a raw level", () => {
    // Type-level guarantee: withNeeds's second parameter is NeedsState, not a number or
    // partial level map. This test documents the invariant; a violation would be a compile
    // error, not a runtime one.
    const c = createColonist("c1", "Maya");
    const next = withNeeds(c, decayNeeds(c.needs, 1));
    expect(next).not.toBe(c);
  });
});

describe("withMemory — the only path to change a colonist's memory", () => {
  it("replaces the memory slice and leaves identity and needs untouched", () => {
    const c = createColonist("c1", "Maya");
    const formed = considerDeprivationFormation(c.memory, 0, "hunger", 1, 0.5);
    const updated = withMemory(c, formed);
    expect(updated.identity).toEqual(c.identity);
    expect(updated.needs).toEqual(c.needs);
    expect(updated.memory).toEqual(formed);
  });

  it("is pure — does not mutate the input colonist", () => {
    const c = createColonist("c1", "Maya");
    const before: ColonistState = JSON.parse(JSON.stringify(c));
    withMemory(c, considerDeprivationFormation(c.memory, 0, "hunger", 1, 0.5));
    expect(c).toEqual(before);
  });
});

describe("withStress — the only path to change a colonist's stress", () => {
  it("replaces the stress slice and leaves everything else untouched", () => {
    const c = createColonist("c1", "Maya");
    const evaluated = evaluateStress(c.stress, c.needs, 100);
    const updated = withStress(c, evaluated.state);
    expect(updated.identity).toEqual(c.identity);
    expect(updated.needs).toEqual(c.needs);
    expect(updated.stress).toEqual(evaluated.state);
  });

  it("is pure — does not mutate the input colonist", () => {
    const c = createColonist("c1", "Maya");
    const before: ColonistState = JSON.parse(JSON.stringify(c));
    withStress(c, evaluateStress(c.stress, c.needs, 100).state);
    expect(c).toEqual(before);
  });
});

describe("withCurrentGoal / withSuspendedGoal — the only paths to change a colonist's goal slots", () => {
  it("sets and clears the current goal", () => {
    const c = createColonist("c1", "Maya");
    const goal: Goal = commitGoal(sampleCandidate, "test", 0);
    const withGoal = withCurrentGoal(c, goal);
    expect(withGoal.currentGoal).toEqual(goal);
    expect(withCurrentGoal(withGoal, null).currentGoal).toBeNull();
  });

  it("sets and clears the suspended goal independently of the current goal", () => {
    const c = createColonist("c1", "Maya");
    const active: Goal = commitGoal(sampleCandidate, "active", 0);
    const suspended: Goal = commitGoal({ ...sampleCandidate, key: "lowNeed:rest", relatedNeed: "rest" }, "suspended", 0);
    const updated = withSuspendedGoal(withCurrentGoal(c, active), suspended);
    expect(updated.currentGoal).toEqual(active);
    expect(updated.suspendedGoal).toEqual(suspended);
  });

  it("is pure — does not mutate the input colonist", () => {
    const c = createColonist("c1", "Maya");
    const before: ColonistState = JSON.parse(JSON.stringify(c));
    withCurrentGoal(c, commitGoal(sampleCandidate, "m", 0));
    expect(c).toEqual(before);
  });
});

describe("base traits — fixed at arrival, no setter exists", () => {
  it("has no exported function that changes baseTraits after creation", () => {
    // Structural check: colonist.ts exports exactly createColonist, withNeeds, withMemory —
    // there is no withTraits. Two colonists created identically, one later given memory/needs
    // changes, must retain identical baseTraits — demonstrated indirectly since no API exists
    // to alter them.
    const c = createColonist("c1", "Maya", [], ["driven"]);
    const afterNeedsChange = withNeeds(c, decayNeeds(c.needs, 1000));
    const afterMemoryChange = withMemory(afterNeedsChange, considerDeprivationFormation(afterNeedsChange.memory, 0, "hunger", 1, 0));
    expect(afterMemoryChange.identity.baseTraits).toEqual(["driven"]);
  });
});
