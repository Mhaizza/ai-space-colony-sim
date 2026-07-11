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

import type { GoalSource, PriorityTier } from "../config/constants.js";
import { PRIORITY_TIERS } from "../config/constants.js";
import type { PrngState } from "../core/prng.js";
import { next } from "../core/prng.js";
import type { ColonistState } from "../colonist/colonist.js";
import type { WorldSnapshot } from "../world/snapshot.js";
import { candidateActionability } from "../task/tasks.js";
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
 * A candidate that was examined during tier filtering and found non-actionable: no eligible,
 * available task currently serves it (decision-loop §5 via task/tasks.ts's actionability
 * query). Blocked, not eliminated — decision-loop §3: "A candidate with no executable task is
 * blocked, not eliminated — it persists in the stack." Stage 1's colonist model has no
 * multi-entry goal stack yet (DQ-D8 deferred), so this record is the fallback trace this build
 * step CAN retain: every higher-tier candidate skipped on the way to the tier that actually
 * won, so nothing that outranked the winner is silently dropped from the decision's own record.
 */
export interface BlockedCandidateRecord {
  readonly key: string;
  readonly source: GoalSource;
  readonly tier: PriorityTier;
  readonly reasons: readonly string[];
}

/**
 * The result of one decision pass. `blockedCandidates` is populated on BOTH variants: every
 * candidate from a higher tier than the one that ultimately won (or, for `kind: "blocked"`,
 * every candidate examined at all) that had no actionable task, in the order tiers were tried.
 * `kind: "blocked"` means no tier had even one actionable candidate — decision-loop §3's "no
 * tier has an actionable candidate" case (full Blocked-state ambient signaling is task/
 * execution.ts's concern; this is the decision-layer fact it is built from).
 */
export type DecisionOutcome =
  | {
      readonly kind: "commit";
      readonly goal: Goal;
      readonly winningTier: PriorityTier;
      readonly composedWeights: readonly ComposedWeight[];
      readonly draws: readonly AttributedDraw[];
      readonly prngState: PrngState;
      readonly blockedCandidates: readonly BlockedCandidateRecord[];
    }
  | {
      readonly kind: "blocked";
      readonly draws: readonly [];
      readonly prngState: PrngState;
      readonly blockedCandidates: readonly BlockedCandidateRecord[];
    };

/** Deterministic, stable ordering by candidate key — the fixed tie-break/iteration order (EQ-2). */
function stableOrder(candidates: readonly GoalCandidate[]): readonly GoalCandidate[] {
  return [...candidates].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** One tier's candidates split into what can actually be selected and what was found blocked. */
function partitionByActionability(
  candidatesInTier: readonly GoalCandidate[],
  skills: readonly string[],
  snapshot: WorldSnapshot,
): { readonly actionable: readonly GoalCandidate[]; readonly blocked: readonly BlockedCandidateRecord[] } {
  const actionable: GoalCandidate[] = [];
  const blocked: BlockedCandidateRecord[] = [];
  for (const candidate of candidatesInTier) {
    const result = candidateActionability(candidate.source, candidate.relatedNeed, skills, snapshot);
    if (result.found) {
      actionable.push(candidate);
    } else {
      blocked.push({ key: candidate.key, source: candidate.source, tier: candidate.tier, reasons: result.reasons });
    }
  }
  return { actionable, blocked };
}

interface WinningTier {
  readonly tier: PriorityTier;
  /** Actionable candidates only, stable order — what Select (§4) actually chooses among. */
  readonly candidates: readonly GoalCandidate[];
}

/**
 * The highest tier with at least one ACTIONABLE candidate, and its actionable candidates in
 * stable order — decision-loop §3: "The highest tier containing at least one actionable
 * candidate wins... if every candidate in the highest tier is blocked, selection falls to the
 * next tier down with an actionable candidate." Tiers are tried highest-first (PRIORITY_TIERS
 * is [1..5] ascending, which is highest-priority-first per ADR-01). An empty tier (no
 * candidates at all) and a fully-blocked tier (candidates exist but none actionable) both fall
 * through identically — this loop realizes both cases of the documented fall-through, and
 * every non-actionable candidate encountered along the way is retained in `blockedCandidates`.
 * Never returns candidates from more than one tier: no candidate crosses a tier boundary.
 *
 * Tier 1 is exempt from the actionability query entirely: survival candidates are adopted
 * unconditionally (ADR-01; personality-traits B6) — "unconditionally" extends to actionability,
 * not only to weighing, so tier 1 never calls into task/tasks.ts here.
 */
function filterToWinningTier(
  candidates: readonly GoalCandidate[],
  skills: readonly string[],
  snapshot: WorldSnapshot,
): {
  readonly winner: WinningTier | null;
  readonly blockedCandidates: readonly BlockedCandidateRecord[];
  /**
   * The highest-priority candidate seen overall (first non-empty tier's first candidate in
   * stable order), present whenever `candidates` was non-empty even if `winner` is null. Used
   * only when NO tier has an actionable candidate: decision-loop §3's blocked candidates
   * "persist... not eliminated" — Stage 1's single-goal-slot model realizes that by still
   * adopting this candidate (kind: "commit"), so tasks.ts's resolveTask (the sole caller of
   * blockGoal) discovers and records exactly why, instead of the colonist silently having no
   * goal and no explanation at all.
   */
  readonly fallback: GoalCandidate | null;
} {
  const blockedCandidates: BlockedCandidateRecord[] = [];
  let fallback: GoalCandidate | null = null;

  for (const tier of PRIORITY_TIERS) {
    const inTier = stableOrder(candidates.filter((c) => c.tier === tier));
    if (inTier.length === 0) continue;
    fallback ??= inTier[0]!;

    if (tier === 1) {
      return { winner: { tier, candidates: inTier }, blockedCandidates, fallback };
    }

    const { actionable, blocked } = partitionByActionability(inTier, skills, snapshot);
    if (actionable.length > 0) {
      blockedCandidates.push(...blocked); // this tier's own non-actionable siblings, if any
      return { winner: { tier, candidates: actionable }, blockedCandidates, fallback };
    }
    blockedCandidates.push(...blocked); // the entire tier was blocked — recorded, then fall through
  }

  return { winner: null, blockedCandidates, fallback };
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
  snapshot: WorldSnapshot,
): DecisionOutcome {
  const { winner, blockedCandidates, fallback } = filterToWinningTier(candidates, colonist.identity.skills, snapshot);
  if (winner === null) {
    if (fallback === null) {
      // No candidate existed at any tier — nothing was ever generated to adopt or resolve.
      return { kind: "blocked", draws: [], prngState: prng, blockedCandidates };
    }
    // Something exists, but nothing anywhere is actionable right now. Adopt the highest-
    // priority candidate as active anyway — task/tasks.ts's resolveTask (the sole blockGoal
    // caller) will discover the same non-actionability and transition it to blocked, which is
    // what keeps "only tasks.ts calls blockGoal" true while still giving the colonist a
    // legible, persisted record of what they're trying (and failing) to do.
    const motivation =
      `${fallback.source} adopted (tier ${fallback.tier}) — no task currently serves it; ` +
      `persists, awaiting a condition change`;
    return {
      kind: "commit",
      goal: commitGoal(fallback, motivation, currentTick),
      winningTier: fallback.tier,
      composedWeights: [],
      draws: [],
      prngState: prng,
      blockedCandidates,
    };
  }

  // Tier 1: adopted unconditionally, no weighing of any kind (ADR-01; personality-traits B6;
  // locked #25). composeWeight is never called here — immunity is structural, not a value choice.
  if (winner.tier === 1) {
    const first = winner.candidates[0]!; // stable order resolves any simultaneous tier-1 candidates
    const motivation = `${first.source} adopted unconditionally — station survival (tier 1, no weighing of any kind)`;
    return {
      kind: "commit",
      goal: commitGoal(first, motivation, currentTick),
      winningTier: 1,
      composedWeights: [],
      draws: [],
      prngState: prng,
      blockedCandidates,
    };
  }

  const composedWeights = winner.candidates.map((c) =>
    composeWeight(c, colonist.identity.baseTraits, colonist.memory, colonist.stress, currentTick),
  );

  const { winnerIndex, draws, prngState } = selectWeighted(
    winner.candidates,
    composedWeights,
    prng,
    `candidateSelection:tier${winner.tier}`,
  );

  const chosen = winner.candidates[winnerIndex]!;
  const chosenWeight = composedWeights[winnerIndex]!;
  const motivation = describeMotivation(chosen, chosenWeight, winner.tier);

  return {
    kind: "commit",
    goal: commitGoal(chosen, motivation, currentTick),
    winningTier: winner.tier,
    composedWeights,
    draws,
    prngState,
    blockedCandidates,
  };
}

/** The real entry point: generates candidates from the world snapshot and colonist needs, then decides. */
export function decideNext(
  colonist: ColonistState,
  snapshot: WorldSnapshot,
  prng: PrngState,
  currentTick: number,
): DecisionOutcome {
  const candidates = generateCandidates(snapshot, colonist.needs, colonist.identity.baseTraits);
  return decideFromCandidates(candidates, colonist, prng, currentTick, snapshot);
}
