// M11 Decision System — weight composition. decision-loop §6: base + four modifier families
// (traits, relationships, memory, stress), composed within one tier, always decomposable.
// Pure throughout. Every family's contribution is computed independently as a bounded
// multiplier and multiplied together at the end — order-independent by construction (the
// result does not depend on which order the multiplications are written in), and each
// family's bound is enforced before it ever reaches the product, which is what makes
// bound-never-veto structural rather than a rule this module must remember to apply.

import type { GoalSource, PriorityTier } from "../config/constants.js";
import { WEIGHT_TUNING } from "../config/tuning.js";
import {
  applyWeightTiltContributions,
  clamp,
  weightTiltContributions,
  type TraitId,
  type WeightTiltContribution,
} from "../colonist/traits.js";
import { influence, type MemoryPool } from "../colonist/memory.js";
import { exceedsTaskAcceptanceThreshold, isStressedState, type StressState } from "../colonist/stress.js";
import { createRelationshipStore, perspective, type ColonistId, type RelationshipStore } from "../colonist/relationships.js";
import type { GoalCandidate } from "./goals.js";

const FAMILY_TILT_FLOOR = WEIGHT_TUNING.familyTiltFloor;
const FAMILY_TILT_CAP = WEIGHT_TUNING.familyTiltCap;

// --- Memory family (decision-loop §8): read-only. Never forms, mutates, fades, or evicts. ---

/** One matching memory's contribution — its raw influence at the query tick, named by id. */
export interface MemoryContribution {
  readonly memoryId: number;
  readonly influence: number;
}

/**
 * Matches Deprivation memories whose need matches the candidate's related need (decision-loop
 * §8's resource/need-kind match dimension). Stage 1 has no Relational or Crisis memories to
 * match against (M10/crisis system don't exist), so this is the full match set today; the
 * function signature does not change when those types gain formation triggers later.
 * Read-only: calls memory.ts's pure `influence` query only — never a formation function.
 */
export function memoryContributions(
  memory: MemoryPool,
  candidate: GoalCandidate,
  currentTick: number,
): readonly MemoryContribution[] {
  if (candidate.relatedNeed === undefined) return [];
  return memory
    .filter((entry) => entry.type === "deprivation" && entry.context.needId === candidate.relatedNeed)
    .map((entry) => ({ memoryId: entry.id, influence: influence(entry, currentTick) }));
}

/** Applies memory contributions as a bounded tilt: 1 + (summed influence × scale), clamped. */
export function applyMemoryContributions(base: number, contributions: readonly MemoryContribution[]): number {
  const totalInfluence = contributions.reduce((sum, c) => sum + c.influence, 0);
  const multiplier = clamp(1 + totalInfluence * WEIGHT_TUNING.memoryWeightTiltScale, FAMILY_TILT_FLOOR, FAMILY_TILT_CAP);
  return base * multiplier;
}

// --- Stress family (decision-loop §7): relief-serving candidates rise, demanding ones suppress. ---

export type StressChannel = "reliefBoost" | "demandSuppress";

/** One stress channel's clamped tilt contribution. */
export interface StressWeightContribution {
  readonly channel: StressChannel;
  readonly tilt: number;
}

const RELIEF_SERVING_SOURCES: readonly GoalSource[] = ["lowNeed", "voluntary"];
const DEMANDING_SOURCES: readonly GoalSource[] = ["shiftAssignment"];

/**
 * Stage 1 provisional interpretation: "relief-serving" = candidates from sources that satisfy
 * needs or free-time recovery (lowNeed, voluntary); "demanding" = the shift-assignment source.
 * Critical-need and survival candidates are unaffected — they are already at maximum urgency
 * (criticalNeed) or trait/stress-immune by architecture (survivalCondition, never composed at all).
 */
export function stressWeightContributions(stress: StressState, candidate: GoalCandidate): readonly StressWeightContribution[] {
  const contributions: StressWeightContribution[] = [];
  if (RELIEF_SERVING_SOURCES.includes(candidate.source) && isStressedState(stress)) {
    contributions.push({ channel: "reliefBoost", tilt: clamp(WEIGHT_TUNING.stressReliefBoostTilt, FAMILY_TILT_FLOOR, FAMILY_TILT_CAP) });
  }
  if (DEMANDING_SOURCES.includes(candidate.source) && exceedsTaskAcceptanceThreshold(stress)) {
    contributions.push({ channel: "demandSuppress", tilt: clamp(WEIGHT_TUNING.stressDemandSuppressTilt, FAMILY_TILT_FLOOR, FAMILY_TILT_CAP) });
  }
  return contributions;
}

/** Applies stress contributions multiplicatively, clamped to the family bound. */
export function applyStressWeightContributions(base: number, contributions: readonly StressWeightContribution[]): number {
  const multiplier = contributions.reduce((product, c) => product * c.tilt, 1);
  return base * clamp(multiplier, FAMILY_TILT_FLOOR, FAMILY_TILT_CAP);
}

// --- Relationships family (Stage 2 build step 6): real M10 reads via `perspective` only. ---

/** One related colonist's contribution — the owner's directional affinity toward them (ADR-20 D2). */
export interface RelationshipContribution {
  readonly otherId: ColonistId;
  readonly affinity: number;
}

/**
 * Reads `ownerId`'s perspective toward the candidate's related colonist, when it has one
 * (social voluntary candidates only — decision-loop §8-style matching). Decision weighting is
 * owner-direction-only by construction (ADR-20 D2) — the system-level both-directions read is
 * never called here — and an unmaterialized pair resolves to the D4 default via `perspective`
 * itself, so a never-interacted candidate still composes.
 */
export function relationshipContributions(
  store: RelationshipStore,
  ownerId: ColonistId,
  candidate: GoalCandidate,
): readonly RelationshipContribution[] {
  if (candidate.relatedColonistId === undefined) return [];
  const { affinity } = perspective(store, ownerId, candidate.relatedColonistId);
  return [{ otherId: candidate.relatedColonistId, affinity }];
}

/** Applies relationship contributions as a bounded tilt: 1 + (summed affinity/100 × scale), clamped. */
export function applyRelationshipContributions(base: number, contributions: readonly RelationshipContribution[]): number {
  const totalAffinity = contributions.reduce((sum, c) => sum + c.affinity, 0);
  const multiplier = clamp(
    1 + (totalAffinity / 100) * WEIGHT_TUNING.relationshipWeightTiltScale,
    FAMILY_TILT_FLOOR,
    FAMILY_TILT_CAP,
  );
  return base * multiplier;
}

// --- Composition ---

/**
 * The full decomposed weight for one candidate. `composed` is the exact product of the five
 * named factors — reconstructable directly (base × traits × memory × stress × relationships),
 * never hidden behind an opaque score. Each factor is independently bounded before the
 * product is taken, so the result is order-independent and cannot be zeroed or guaranteed by
 * any single family (bound-never-veto, decision-loop §6 constraint 2).
 */
export interface ComposedWeight {
  readonly key: string;
  readonly source: GoalSource;
  readonly tier: PriorityTier;
  readonly base: number;
  readonly traits: number;
  readonly memory: number;
  readonly stress: number;
  readonly relationships: number;
  readonly composed: number;
  readonly traitContributions: readonly WeightTiltContribution[];
  readonly memoryContributions: readonly MemoryContribution[];
  readonly stressContributions: readonly StressWeightContribution[];
  readonly relationshipContributions: readonly RelationshipContribution[];
}

/**
 * Composes one candidate's weight from base urgency and the four modifier families. Only ever
 * called for candidates in the winning tier at tiers 2–5 — tier 1 is composed-immune by
 * construction: decide.ts never calls this function for a tier-1 candidate (ADR-01; locked #25).
 * `relationships`/`ownerId` default to an empty store/id so every existing caller (real runs
 * with no relationship store yet, and every test predating Stage 2 build step 6) composes
 * exactly as before — a candidate with no `relatedColonistId` never reads the store at all.
 */
export function composeWeight(
  candidate: GoalCandidate,
  traits: readonly TraitId[],
  memory: MemoryPool,
  stress: StressState,
  currentTick: number,
  relationships: RelationshipStore = createRelationshipStore(),
  ownerId: ColonistId = "",
): ComposedWeight {
  const base = candidate.baseUrgency * WEIGHT_TUNING.baseScale;

  const traitContributions = weightTiltContributions(traits, candidate.source);
  const traitsMultiplier = applyWeightTiltContributions(1, traitContributions);

  const memContributions = memoryContributions(memory, candidate, currentTick);
  const memoryMultiplier = applyMemoryContributions(1, memContributions);

  const stressContributions = stressWeightContributions(stress, candidate);
  const stressMultiplier = applyStressWeightContributions(1, stressContributions);

  const relContributions = relationshipContributions(relationships, ownerId, candidate);
  const relationshipsMultiplier = applyRelationshipContributions(1, relContributions);

  const composed = base * traitsMultiplier * memoryMultiplier * stressMultiplier * relationshipsMultiplier;

  return {
    key: candidate.key,
    source: candidate.source,
    tier: candidate.tier,
    base,
    traits: traitsMultiplier,
    memory: memoryMultiplier,
    stress: stressMultiplier,
    relationships: relationshipsMultiplier,
    composed,
    traitContributions,
    memoryContributions: memContributions,
    stressContributions,
    relationshipContributions: relContributions,
  };
}
