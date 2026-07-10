// M11 Decision System — priority filtering, weighted seeded-stochastic selection, commitment.
// decision-loop §2 (Filter/Select/Commit stages), §3 (priority filtering), §4 (selection).
// Pure throughout; the only impurity-adjacent thing here is PRNG *state threading*, which is
// itself pure (S1's next() returns a new state, never mutates).
//
// This module is meant to be invoked only at re-decision trigger points (the closed six-
// trigger list, decision-loop §2) — nothing in this file drives ticking or decides when to
// re-decide. That gating is tick.ts's responsibility (a later build step); decideNext is a
// pure "decide once, given state" function, and calling it repeatedly with unchanged inputs
// yields the unchanged result (tested below), which is what "not per-tick" means at this layer.

import type { PriorityTier } from "../config/constants.js";
import { PRIORITY_TIERS } from "../config/constants.js";
import type { PrngState } from "../core/prng.js";
import { next } from "../core/prng.js";
import type { ColonistState } from "../colonist/colonist.js";
import type { WorldSnapshot } from "../world/snapshot.js";
import { commitGoal, generateCandidates, type Goal, type GoalCandidate } from "./goals.js";
import { composeWeight, type ComposedWeight } from "./weights.js";

/** One attributed PRNG draw: what it was for, its value, and the state transition it caused. */
export interface AttributedDraw {
  readonly purpose: string;
  readonly value: number;
  readonly stateBefore: PrngState;
  readonly stateAfter: PrngState;
}

/**
 * The result of one decision pass. `blocked` means no tier had any candidate at all — the
 * Stage 1 analogue of decision-loop §3's "no tier has an actionable candidate" case (full
 * Blocked-state ambient signaling belongs to a later build step; this is the decision-layer
 * fact it would be built from).
 */
export type DecisionOutcome =
  | {
      readonly kind: "commit";
      readonly goal: Goal;
      readonly winningTier: PriorityTier;
      readonly composedWeights: readonly ComposedWeight[];
      readonly draws: readonly AttributedDraw[];
      readonly prngState: PrngState;
    }
  | {
      readonly kind: "blocked";
      readonly draws: readonly [];
      readonly prngState: PrngState;
    };

/** Deterministic, stable ordering by candidate key — the fixed tie-break/iteration order (EQ-2). */
function stableOrder(candidates: readonly GoalCandidate[]): readonly GoalCandidate[] {
  return [...candidates].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * The highest tier with at least one candidate, and its candidates in stable order. Tiers are
 * tried highest-first (PRIORITY_TIERS is [1..5] ascending, which is highest-priority-first per
 * ADR-01); an empty tier falls through to the next one — this loop IS the documented fall-through.
 * Never returns candidates from more than one tier: no candidate crosses a tier boundary.
 */
function filterToWinningTier(
  candidates: readonly GoalCandidate[],
): { readonly tier: PriorityTier; readonly candidates: readonly GoalCandidate[] } | null {
  for (const tier of PRIORITY_TIERS) {
    const inTier = candidates.filter((c) => c.tier === tier);
    if (inTier.length > 0) {
      return { tier, candidates: stableOrder(inTier) };
    }
  }
  return null;
}

function describeMotivation(candidate: GoalCandidate, weight: ComposedWeight, tier: PriorityTier): string {
  return (
    `${candidate.source} adopted (tier ${tier}): base ${weight.base.toFixed(4)}, ` +
    `traits x${weight.traits.toFixed(4)}, memory x${weight.memory.toFixed(4)}, ` +
    `stress x${weight.stress.toFixed(4)}, relationships x${weight.relationships.toFixed(4)} ` +
    `→ composed ${weight.composed.toFixed(4)}`
  );
}

interface WeightedSelection {
  readonly winnerIndex: number;
  readonly draws: readonly AttributedDraw[];
  readonly prngState: PrngState;
}

/**
 * Weighted seeded-stochastic selection among candidates already composed (decision-loop §4).
 * A single candidate needs no draw at all — trivial selection consumes no randomness, per
 * decision-loop §4's own observation that single-candidate tiers are trivial. With two or
 * more candidates, exactly one PRNG draw selects among them proportional to composed weight.
 */
function selectWeighted(
  candidates: readonly GoalCandidate[],
  weights: readonly ComposedWeight[],
  prng: PrngState,
  purpose: string,
): WeightedSelection {
  if (candidates.length === 1) {
    return { winnerIndex: 0, draws: [], prngState: prng };
  }

  const totalWeight = weights.reduce((sum, w) => sum + w.composed, 0);
  const draw = next(prng);
  const threshold = draw.value * totalWeight;

  let cumulative = 0;
  let winnerIndex = candidates.length - 1; // deterministic fallback: last in stable order
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]!.composed;
    if (threshold < cumulative) {
      winnerIndex = i;
      break;
    }
  }

  const attributedDraw: AttributedDraw = {
    purpose,
    value: draw.value,
    stateBefore: prng,
    stateAfter: draw.state,
  };
  return { winnerIndex, draws: [attributedDraw], prngState: draw.state };
}

/**
 * The core decision, given an already-generated candidate list — factored out from
 * decideNext so tests can exercise priority filtering, weight composition, and selection
 * (including the tier-1 immune path) with hand-built candidates, independent of whether
 * Stage 1's generators can currently produce every tier.
 */
export function decideFromCandidates(
  candidates: readonly GoalCandidate[],
  colonist: ColonistState,
  prng: PrngState,
  currentTick: number,
): DecisionOutcome {
  const filtered = filterToWinningTier(candidates);
  if (filtered === null) {
    return { kind: "blocked", draws: [], prngState: prng };
  }

  // Tier 1: adopted unconditionally, no weighing of any kind (ADR-01; personality-traits B6;
  // locked #25). composeWeight is never called here — immunity is structural, not a value choice.
  if (filtered.tier === 1) {
    const winner = filtered.candidates[0]!; // stable order resolves any simultaneous tier-1 candidates
    const motivation = `${winner.source} adopted unconditionally — station survival (tier 1, no weighing of any kind)`;
    return {
      kind: "commit",
      goal: commitGoal(winner, motivation, currentTick),
      winningTier: 1,
      composedWeights: [],
      draws: [],
      prngState: prng,
    };
  }

  const composedWeights = filtered.candidates.map((c) =>
    composeWeight(c, colonist.identity.baseTraits, colonist.memory, colonist.stress, currentTick),
  );

  const { winnerIndex, draws, prngState } = selectWeighted(
    filtered.candidates,
    composedWeights,
    prng,
    `candidateSelection:tier${filtered.tier}`,
  );

  const winner = filtered.candidates[winnerIndex]!;
  const winnerWeight = composedWeights[winnerIndex]!;
  const motivation = describeMotivation(winner, winnerWeight, filtered.tier);

  return {
    kind: "commit",
    goal: commitGoal(winner, motivation, currentTick),
    winningTier: filtered.tier,
    composedWeights,
    draws,
    prngState,
  };
}

/** The real entry point: generates candidates from the world snapshot and colonist needs, then decides. */
export function decideNext(
  colonist: ColonistState,
  snapshot: WorldSnapshot,
  prng: PrngState,
  currentTick: number,
): DecisionOutcome {
  return decideFromCandidates(generateCandidates(snapshot, colonist.needs), colonist, prng, currentTick);
}
