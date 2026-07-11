// M11 Decision System — candidate generation and goal lifecycle. decision-loop §2 (Generate
// stage), §10 (commitment); goal-system (chain, lifecycle, closed sources); ADR-01 (tiers).
// Pure throughout. Reads world information only through WorldSnapshot (never live World/
// Policy/Clock) and colonist needs only through NeedsState — never memory, traits, or stress,
// which belong to weight composition (weights.ts), not generation.

import {
  BIOLOGICAL_NEEDS,
  GOAL_SOURCE_TIER,
  NEEDS,
  type GoalSource,
  type NeedId,
  type PriorityTier,
} from "../config/constants.js";
import { WEIGHT_TUNING } from "../config/tuning.js";
import { computeUrgencies, isCritical, isLow, type NeedsState } from "../colonist/needs.js";
import type { TraitId } from "../colonist/traits.js";
import type { WorldSnapshot } from "../world/snapshot.js";

// --- Candidates (decision-loop §2 Generate stage) ---

/**
 * A conceptual candidate — pressure plus source, not yet a task (decision-loop §5 resolves
 * candidates to tasks; this module stops before that boundary, per this build step's scope).
 * `relatedNeed` is present only for need-driven sources (criticalNeed, lowNeed); it is what
 * lets weight composition match Deprivation memories to this candidate (decision-loop §8).
 */
export interface GoalCandidate {
  readonly source: GoalSource;
  readonly tier: PriorityTier;
  /** Stable, unique-within-one-decision identifier — the sort key for deterministic ordering. */
  readonly key: string;
  readonly baseUrgency: number;
  readonly relatedNeed?: NeedId;
}

/**
 * Source 1 — station survival (ADR-01 tier 1). Stage 1's WorldSnapshot carries no survival-
 * condition data (no oxygen/pressure modeling exists in the Stage 1 minimal station — engineering
 * spec §10 stage 1 scope) — so this generator always returns no candidates today. It is not an
 * omission: the source is structurally represented (this function exists and is called by
 * generateCandidates, exactly like the other four), and it will produce real candidates the
 * moment M2 gains survival-condition state, with no change to this function's signature or to
 * anything downstream of it.
 */
function generateSurvivalCandidates(_snapshot: WorldSnapshot): readonly GoalCandidate[] {
  return [];
}

/** Source 2 — critical biological need (ADR-01 tier 2). One candidate per need past critical. */
function generateCriticalNeedCandidates(needs: NeedsState): readonly GoalCandidate[] {
  const urgencies = computeUrgencies(needs);
  const candidates: GoalCandidate[] = [];
  for (const id of BIOLOGICAL_NEEDS) {
    if (isCritical(id, needs[id].level)) {
      candidates.push({
        source: "criticalNeed",
        tier: GOAL_SOURCE_TIER.criticalNeed,
        key: `criticalNeed:${id}`,
        baseUrgency: urgencies[id],
        relatedNeed: id,
      });
    }
  }
  return candidates;
}

/**
 * Source 3 — shift assignment (ADR-01 tier 3). One candidate exists exactly when the current
 * shift period is "work" — generation reflects pressure/presence only; whether a concrete task
 * can actually serve it (module functional, resource present) is availability, which
 * decision-loop §5 assigns to task resolution, not to generation. Gating on world module
 * state here would be reaching into task-resolution's job a build step early.
 */
function generateShiftAssignmentCandidates(snapshot: WorldSnapshot): readonly GoalCandidate[] {
  if (snapshot.currentPeriod !== "work") return [];
  return [
    {
      source: "shiftAssignment",
      tier: GOAL_SOURCE_TIER.shiftAssignment,
      key: "shiftAssignment:work",
      baseUrgency: WEIGHT_TUNING.assignmentBaseWeight,
    },
  ];
}

/**
 * Source 4 — deferred (low) need satisfaction (ADR-01 tier 4). One candidate per need that is
 * low but not critical: a need already critical is represented once, at tier 2 (source 2) —
 * generating a redundant tier-4 entry for the same need would double-represent one pressure
 * as two candidates, which the priority filter's tier exclusivity does not expect.
 */
function generateLowNeedCandidates(needs: NeedsState, traits: readonly TraitId[]): readonly GoalCandidate[] {
  const urgencies = computeUrgencies(needs, traits);
  const candidates: GoalCandidate[] = [];
  for (const id of NEEDS) {
    const level = needs[id].level;
    if (isLow(id, level, traits) && !isCritical(id, level)) {
      candidates.push({
        source: "lowNeed",
        tier: GOAL_SOURCE_TIER.lowNeed,
        key: `lowNeed:${id}`,
        baseUrgency: urgencies[id],
        relatedNeed: id,
      });
    }
  }
  return candidates;
}

/**
 * Source 5 — trait-weighted voluntary behavior (ADR-01 tier 5). Stage 1's only voluntary
 * candidate is unstructured idle/rest presence during free time — the social task class is
 * empty until ADR-18's vocabulary is wired in (a later stage), so this is the sole tier-5
 * candidate this generator can produce today. Trait weighting itself happens in weight
 * composition (weights.ts), never here — generation names the candidate, not its appeal.
 */
function generateVoluntaryCandidates(snapshot: WorldSnapshot): readonly GoalCandidate[] {
  if (snapshot.currentPeriod !== "free") return [];
  return [
    {
      source: "voluntary",
      tier: GOAL_SOURCE_TIER.voluntary,
      key: "voluntary:idle",
      baseUrgency: WEIGHT_TUNING.voluntaryBaseWeight,
    },
  ];
}

/** Generates every candidate from the five closed sources. Pure; the source vocabulary is closed. */
export function generateCandidates(
  snapshot: WorldSnapshot,
  needs: NeedsState,
  traits: readonly TraitId[] = [],
): readonly GoalCandidate[] {
  return [
    ...generateSurvivalCandidates(snapshot),
    ...generateCriticalNeedCandidates(needs),
    ...generateShiftAssignmentCandidates(snapshot),
    ...generateLowNeedCandidates(needs, traits),
    ...generateVoluntaryCandidates(snapshot),
  ];
}

// --- Goal lifecycle (goal-system; decision-loop §2 Commit stage, §10 Output) ---

export type GoalStatus = "active" | "suspended" | "blocked" | "completed" | "abandoned";

/**
 * A committed goal. `motivation` is recorded once, at adoption, and never recomputed
 * (goal-system DQ-3 resolution: "committed at adoption, re-derived only at re-decision
 * points") — no function in this module ever rewrites an existing Goal's motivation.
 */
export interface Goal {
  readonly source: GoalSource;
  readonly tier: PriorityTier;
  readonly key: string;
  /** Carried from the originating candidate (goals.ts's own field) — lets task resolution
   *  (tasks.ts, Build Step 7) find the need a criticalNeed/lowNeed goal is about without
   *  parsing `key`. Undefined for sources that never carry one (shiftAssignment, voluntary,
   *  survivalCondition). */
  readonly relatedNeed?: NeedId;
  readonly status: GoalStatus;
  readonly motivation: string;
  readonly adoptedAtTick: number;
}

/** Creates a newly committed goal from a candidate. The only place a Goal's motivation is written. */
export function commitGoal(candidate: GoalCandidate, motivation: string, currentTick: number): Goal {
  return {
    source: candidate.source,
    tier: candidate.tier,
    key: candidate.key,
    relatedNeed: candidate.relatedNeed,
    status: "active",
    motivation,
    adoptedAtTick: currentTick,
  };
}

function transition(goal: Goal, to: GoalStatus, allowedFrom: readonly GoalStatus[]): Goal {
  if (!allowedFrom.includes(goal.status)) {
    throw new Error(`Cannot transition goal from "${goal.status}" to "${to}"`);
  }
  return { ...goal, status: to };
}

/** Active → Suspended (interruption; goal-system: suspend, never hard-resume or discard). */
export function suspendGoal(goal: Goal): Goal {
  return transition(goal, "suspended", ["active", "blocked"]);
}

/** Suspended → Active (the suspended goal is the default candidate at re-decision). */
export function resumeGoal(goal: Goal): Goal {
  return transition(goal, "active", ["suspended"]);
}

/** Active → Blocked (an infrastructure signal, distinct from Abandoned — goal-system lifecycle). */
export function blockGoal(goal: Goal): Goal {
  return transition(goal, "blocked", ["active"]);
}

/** Blocked → Active (the blockage resolved). */
export function unblockGoal(goal: Goal): Goal {
  return transition(goal, "active", ["blocked"]);
}

/** Active → Completed. */
export function completeGoal(goal: Goal): Goal {
  return transition(goal, "completed", ["active"]);
}

/**
 * Active, Blocked, or Suspended → Abandoned. Suspended is included for suspension overflow
 * (Build Step 8 review fix 1, 2026-07-10): the single-slot suspended-goal model must be able
 * to explicitly abandon an already-suspended goal when a second interruption needs the slot —
 * without this, overflow could never actually happen, since a goal reaching the suspended
 * slot always arrives via suspendGoal and therefore always has status "suspended".
 */
export function abandonGoal(goal: Goal): Goal {
  return transition(goal, "abandoned", ["active", "blocked", "suspended"]);
}
