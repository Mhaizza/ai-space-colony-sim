// M11 selection tests — strict priority filtering, fall-through, tier-1 immunity, seeded
// determinism, PRNG attribution, fixed motivation, no per-tick re-decision, purity.

import { describe, expect, it } from "vitest";
import { createPrng, next } from "../core/prng.js";
import { createColonist } from "../colonist/colonist.js";
import { withStress } from "../colonist/colonist.js";
import type { GoalCandidate } from "./goals.js";
import { decideFromCandidates } from "./decide.js";

const survival: GoalCandidate = { source: "survivalCondition", tier: 1, key: "survivalCondition:z", baseUrgency: 999 };
const survival2: GoalCandidate = { source: "survivalCondition", tier: 1, key: "survivalCondition:a", baseUrgency: 1 };
const critical: GoalCandidate = { source: "criticalNeed", tier: 2, key: "criticalNeed:hunger", baseUrgency: 0.9, relatedNeed: "hunger" };
const assignment: GoalCandidate = { source: "shiftAssignment", tier: 3, key: "shiftAssignment:work", baseUrgency: 0.5 };
const lowA: GoalCandidate = { source: "lowNeed", tier: 4, key: "lowNeed:hunger", baseUrgency: 0.3, relatedNeed: "hunger" };
const lowB: GoalCandidate = { source: "lowNeed", tier: 4, key: "lowNeed:rest", baseUrgency: 0.3, relatedNeed: "rest" };
const voluntary: GoalCandidate = { source: "voluntary", tier: 5, key: "voluntary:idle", baseUrgency: 0.2 };

const colonist = createColonist("c1", "Maya", [], ["driven"]);
const seed = createPrng(42);

describe("strict priority filtering", () => {
  it("the highest tier with any candidate wins, regardless of lower-tier weights", () => {
    const outcome = decideFromCandidates([survival, critical, assignment, lowA, voluntary], colonist, seed, 0);
    expect(outcome.kind).toBe("commit");
    if (outcome.kind === "commit") expect(outcome.winningTier).toBe(1);
  });

  it("no candidate from a losing tier ever appears in composedWeights", () => {
    const outcome = decideFromCandidates([critical, assignment, lowA], colonist, seed, 0);
    if (outcome.kind === "commit") {
      expect(outcome.winningTier).toBe(2);
      expect(outcome.composedWeights.every((w) => w.tier === 2)).toBe(true);
    }
  });
});

describe("actionable fall-through (documented)", () => {
  it("falls through an empty tier to the next non-empty one", () => {
    const outcome = decideFromCandidates([assignment, lowA], colonist, seed, 0); // no tier 1 or 2
    expect(outcome.kind).toBe("commit");
    if (outcome.kind === "commit") expect(outcome.winningTier).toBe(3);
  });

  it("falls through multiple empty tiers", () => {
    const outcome = decideFromCandidates([voluntary], colonist, seed, 0); // only tier 5 present
    if (outcome.kind === "commit") expect(outcome.winningTier).toBe(5);
  });

  it("returns 'blocked' when no candidate exists at any tier", () => {
    const outcome = decideFromCandidates([], colonist, seed, 0);
    expect(outcome.kind).toBe("blocked");
  });
});

describe("no cross-tier modifier movement", () => {
  it("a low-tier candidate can never win over a higher tier no matter how large its weight is", () => {
    const hugeLowTier: GoalCandidate = { ...lowA, baseUrgency: 100000 };
    const outcome = decideFromCandidates([critical, hugeLowTier], colonist, seed, 0);
    if (outcome.kind === "commit") expect(outcome.winningTier).toBe(2);
  });
});

describe("tier-1 modifier immunity — trait/memory/stress immune, no weighing of any kind", () => {
  it("does not call weight composition for tier 1 — composedWeights is empty", () => {
    const outcome = decideFromCandidates([survival], colonist, seed, 0);
    expect(outcome.kind).toBe("commit");
    if (outcome.kind === "commit") expect(outcome.composedWeights).toEqual([]);
  });

  it("selection among multiple simultaneous tier-1 candidates is by stable order, not weight, trait, or stress", () => {
    const stressedColonist = withStress(colonist, { level: 0.95 });
    const outcomeCalm = decideFromCandidates([survival, survival2], colonist, seed, 0);
    const outcomeStressed = decideFromCandidates([survival, survival2], stressedColonist, seed, 0);
    // survival2's key ("survivalCondition:a") sorts before survival's ("survivalCondition:z")
    expect(outcomeCalm.kind).toBe("commit");
    expect(outcomeStressed.kind).toBe("commit");
    if (outcomeCalm.kind === "commit" && outcomeStressed.kind === "commit") {
      expect(outcomeCalm.goal.key).toBe("survivalCondition:a");
      expect(outcomeStressed.goal.key).toBe("survivalCondition:a"); // unaffected by stress
    }
  });

  it("consumes no PRNG draw for tier 1", () => {
    const outcome = decideFromCandidates([survival, survival2], colonist, seed, 0);
    if (outcome.kind === "commit") {
      expect(outcome.draws).toEqual([]);
      expect(outcome.prngState).toEqual(seed);
    }
  });
});

describe("weight composition within the selected tier only", () => {
  it("composedWeights contains exactly the winning tier's candidates", () => {
    const outcome = decideFromCandidates([lowA, lowB], colonist, seed, 0);
    if (outcome.kind === "commit") {
      expect(outcome.composedWeights).toHaveLength(2);
      expect(outcome.composedWeights.map((w) => w.key).sort()).toEqual(["lowNeed:hunger", "lowNeed:rest"]);
    }
  });
});

describe("selection determinism", () => {
  it("same state + same seed produces an identical selection", () => {
    const a = decideFromCandidates([lowA, lowB], colonist, createPrng(7), 100);
    const b = decideFromCandidates([lowA, lowB], colonist, createPrng(7), 100);
    expect(a).toEqual(b);
  });

  it("different seeds may produce different valid selections", () => {
    const winners = new Set<string>();
    for (let s = 0; s < 25; s++) {
      const outcome = decideFromCandidates([lowA, lowB], colonist, createPrng(s), 0);
      if (outcome.kind === "commit") winners.add(outcome.goal.key);
    }
    expect(winners.size).toBeGreaterThan(1);
  });

  it("a single candidate in the winning tier needs no draw and is always selected", () => {
    const outcome = decideFromCandidates([lowA], colonist, seed, 0);
    if (outcome.kind === "commit") {
      expect(outcome.goal.key).toBe("lowNeed:hunger");
      expect(outcome.draws).toEqual([]);
      expect(outcome.prngState).toEqual(seed);
    }
  });
});

describe("PRNG draw attribution", () => {
  it("records exactly one attributed draw for a multi-candidate tier, with purpose and state transition", () => {
    const outcome = decideFromCandidates([lowA, lowB], colonist, seed, 0);
    if (outcome.kind === "commit") {
      expect(outcome.draws).toHaveLength(1);
      const draw = outcome.draws[0]!;
      expect(draw.purpose).toBe("candidateSelection:tier4");
      expect(draw.stateBefore).toEqual(seed);
      expect(draw.stateAfter).toEqual(next(seed).state);
      expect(outcome.prngState).toEqual(draw.stateAfter);
    }
  });
});

describe("motivation fixed at adoption", () => {
  it("the committed goal's motivation reflects the decision that was made and does not change afterward", () => {
    const outcome = decideFromCandidates([lowA], colonist, seed, 5);
    if (outcome.kind === "commit") {
      expect(outcome.goal.motivation.length).toBeGreaterThan(0);
      expect(outcome.goal.adoptedAtTick).toBe(5);
      const motivationSnapshot = outcome.goal.motivation;
      // Re-running the decision (e.g. a later re-decision) produces a NEW goal object; the
      // original goal reference's motivation is untouched — nothing rewrites it in place.
      decideFromCandidates([lowA], colonist, seed, 999);
      expect(outcome.goal.motivation).toBe(motivationSnapshot);
    }
  });
});

describe("not per-tick — idempotent under repeated invocation with unchanged inputs", () => {
  it("calling decideFromCandidates repeatedly with the same unchanged inputs never drifts", () => {
    const first = decideFromCandidates([lowA, lowB], colonist, seed, 10);
    const second = decideFromCandidates([lowA, lowB], colonist, seed, 10);
    const third = decideFromCandidates([lowA, lowB], colonist, seed, 10);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
  });
});

describe("purity", () => {
  it("does not mutate the input candidate list, colonist, or PRNG state", () => {
    const candidates = [lowA, lowB];
    const candidatesSnapshot = JSON.parse(JSON.stringify(candidates));
    const colonistSnapshot = JSON.parse(JSON.stringify(colonist));
    const seedSnapshot = { ...seed };
    decideFromCandidates(candidates, colonist, seed, 0);
    expect(candidates).toEqual(candidatesSnapshot);
    expect(colonist).toEqual(colonistSnapshot);
    expect(seed).toEqual(seedSnapshot);
  });
});
