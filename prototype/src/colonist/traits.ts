// M8 Trait System — ADR-10; personality-traits.md; ADR-17 D7 (the two surfaces a trait may
// touch: need decay/threshold modifiers, and decision weight tilts). Pure throughout.
//
// STAGE 1 PROVISIONAL TRAITS — NON-CANONICAL. One trait per personality-traits.md category
// (Work Disposition: driven; Stress Response: resilient; Social Disposition: gregarious; Need
// Disposition: wary), per the linked #103 acceptance criterion, exercising both approved
// modifier surfaces end-to-end; none of this is a design commitment. The canonical trait list
// (DQ-T1) remains deferred to prototype content work per the AI Behavior Specification's
// resolved documentation ambiguity — this module hosts trait definitions, it does not define
// the canon.
//
// "resilient" has no direct stress-rate surface to touch — ADR-17 D7 sanctions exactly two
// trait surfaces (need rate/threshold, decision weight), and stress.ts (M7) computes its
// accumulation/dissipation rates from need state and execution status alone, with no trait
// input of its own. Adding a third surface would be an architecture change (coding-standards.md
// requires an ADR before that, not a trait definition). "resilient" instead shifts Safety's low
// threshold — since stress.ts's psychNeedDeprivation source already reads isLow(traits) (fixed
// alongside this trait, see the trait-consistency fix), a colonist who registers deprivation
// later genuinely accumulates less of that stress source, through the sanctioned surface.
//
// Bound discipline (ADR-17 D7; decision-loop §6 constraint 2 — bound-never-veto): every
// modifier this module produces is clamped before use. A trait can tilt a rate or a weight;
// it can never zero one out, never invert an ordering, and never reach priority tier 1
// (ADR-01's survival tier is trait-immune by construction — personality-traits B6 — enforced
// here as an unconditional guard, not as a property of what "driven" happens to define).
//
// This module never selects behavior. Every export returns a number or a list of numbers
// (contributions); nothing here returns a goal, a task, or an action.

import type { GoalSource, NeedId } from "../config/constants.js";
import { TRAIT_TUNING, WEIGHT_TUNING } from "../config/tuning.js";

/** Stage 1's provisional, non-canonical trait set — one per category (see module doc). */
export type TraitId = "driven" | "resilient" | "gregarious" | "wary";

/** The four categories ADR-10/personality-traits define — the category test is the architecture guard. */
export type TraitCategory = "workDisposition" | "stressResponse" | "socialDisposition" | "needDisposition";

interface NeedRateModifier {
  readonly decayMultiplier: number;
  readonly lowThresholdShift: number;
}

interface TraitDefinition {
  readonly id: TraitId;
  readonly category: TraitCategory;
  readonly needModifiers: Readonly<Partial<Record<NeedId, NeedRateModifier>>>;
  readonly weightTilts: Readonly<Partial<Record<GoalSource, number>>>;
}

const TRAITS: Readonly<Record<TraitId, TraitDefinition>> = {
  driven: {
    id: "driven",
    category: "workDisposition",
    needModifiers: {
      rest: {
        decayMultiplier: TRAIT_TUNING.drivenRestDecayMultiplier,
        lowThresholdShift: TRAIT_TUNING.drivenRestLowThresholdShift,
      },
    },
    weightTilts: {
      shiftAssignment: TRAIT_TUNING.drivenAssignmentTilt,
      voluntary: TRAIT_TUNING.drivenVoluntaryTilt,
    },
  },
  resilient: {
    id: "resilient",
    category: "stressResponse",
    needModifiers: {
      safety: {
        decayMultiplier: 1, // neutral — see module doc: no direct stress-rate surface is sanctioned
        lowThresholdShift: TRAIT_TUNING.resilientSafetyLowThresholdShift,
      },
    },
    weightTilts: {},
  },
  gregarious: {
    id: "gregarious",
    category: "socialDisposition",
    needModifiers: {
      social: {
        decayMultiplier: TRAIT_TUNING.gregariousSocialDecayMultiplier,
        lowThresholdShift: 0,
      },
    },
    weightTilts: {
      voluntary: TRAIT_TUNING.gregariousVoluntaryTilt,
    },
  },
  wary: {
    id: "wary",
    category: "needDisposition",
    needModifiers: {
      safety: {
        decayMultiplier: TRAIT_TUNING.warySafetyDecayMultiplier,
        lowThresholdShift: TRAIT_TUNING.warySafetyLowThresholdShift,
      },
    },
    weightTilts: {},
  },
};

/** Shared bound helper — reused by weights.ts rather than duplicated (coding-standards). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Reuses the decision loop's own family-tilt bound (decision-loop §6 constraint 2) rather
// than defining a separate trait-only bound — traits are one of the four modifier families,
// not a system with its own composition rules.
const WEIGHT_TILT_FLOOR = WEIGHT_TUNING.familyTiltFloor;
const WEIGHT_TILT_CAP = WEIGHT_TUNING.familyTiltCap;

// --- Surface 1: need rate / threshold modifiers (ADR-17 D7) ---

/** One trait's clamped contribution to a need's decay rate. */
export interface NeedRateContribution {
  readonly traitId: TraitId;
  readonly decayMultiplier: number;
}

/** Every held trait's decay-rate contribution to `needId`, each already bounded. Decomposable by design. */
export function needRateContributions(traits: readonly TraitId[], needId: NeedId): readonly NeedRateContribution[] {
  const contributions: NeedRateContribution[] = [];
  for (const traitId of traits) {
    const modifier = TRAITS[traitId].needModifiers[needId];
    if (modifier === undefined) continue;
    contributions.push({
      traitId,
      decayMultiplier: clamp(modifier.decayMultiplier, TRAIT_TUNING.needRateModifierFloor, TRAIT_TUNING.needRateModifierCeiling),
    });
  }
  return contributions;
}

/** Applies decay-rate contributions to a base rate. Bounded: never zeroes the rate (floor > 0 — ADR-17 D7). */
export function applyNeedRateContributions(baseDecayPerTick: number, contributions: readonly NeedRateContribution[]): number {
  const multiplier = contributions.reduce((product, c) => product * c.decayMultiplier, 1);
  const clampedMultiplier = clamp(multiplier, TRAIT_TUNING.needRateModifierFloor, TRAIT_TUNING.needRateModifierCeiling);
  return baseDecayPerTick * clampedMultiplier;
}

/** One trait's clamped contribution to a need's low threshold. */
export interface NeedThresholdContribution {
  readonly traitId: TraitId;
  readonly lowThresholdShift: number;
}

/** Every held trait's threshold-shift contribution to `needId`, each already bounded. */
export function needThresholdContributions(traits: readonly TraitId[], needId: NeedId): readonly NeedThresholdContribution[] {
  const contributions: NeedThresholdContribution[] = [];
  for (const traitId of traits) {
    const modifier = TRAITS[traitId].needModifiers[needId];
    if (modifier === undefined) continue;
    contributions.push({
      traitId,
      lowThresholdShift: clamp(modifier.lowThresholdShift, -TRAIT_TUNING.thresholdShiftBound, TRAIT_TUNING.thresholdShiftBound),
    });
  }
  return contributions;
}

/** Applies threshold-shift contributions to a base low threshold. Bounded: total shift never exceeds thresholdShiftBound. */
export function applyNeedThresholdContributions(baseLowThreshold: number, contributions: readonly NeedThresholdContribution[]): number {
  const totalShift = contributions.reduce((sum, c) => sum + c.lowThresholdShift, 0);
  const clampedShift = clamp(totalShift, -TRAIT_TUNING.thresholdShiftBound, TRAIT_TUNING.thresholdShiftBound);
  return baseLowThreshold + clampedShift;
}

// --- Surface 2: decision weight tilts (decision-loop §6) ---

/** One trait's clamped tilt on candidates from a given goal source. */
export interface WeightTiltContribution {
  readonly traitId: TraitId;
  readonly tilt: number;
}

/**
 * Every held trait's weight-tilt contribution for `source`, each already bounded to
 * [familyTiltFloor, familyTiltCap] (decision-loop §6 constraint 2: bound-never-veto).
 *
 * Tier 1 (survivalCondition) is trait-immune by an UNCONDITIONAL guard: this function
 * returns no contributions for it regardless of what any trait definition contains — the
 * immunity is a property of this function, not of "driven" happening not to define one
 * (ADR-01; personality-traits B6; locked #25's tier-boundary respect).
 */
export function weightTiltContributions(traits: readonly TraitId[], source: GoalSource): readonly WeightTiltContribution[] {
  if (source === "survivalCondition") return [];
  const contributions: WeightTiltContribution[] = [];
  for (const traitId of traits) {
    const tilt = TRAITS[traitId].weightTilts[source];
    if (tilt === undefined) continue;
    contributions.push({ traitId, tilt: clamp(tilt, WEIGHT_TILT_FLOOR, WEIGHT_TILT_CAP) });
  }
  return contributions;
}

/** Applies weight-tilt contributions to a base weight. Bounded: result never crosses the tilt floor/cap. */
export function applyWeightTiltContributions(baseWeight: number, contributions: readonly WeightTiltContribution[]): number {
  const multiplier = contributions.reduce((product, c) => product * c.tilt, 1);
  const clampedMultiplier = clamp(multiplier, WEIGHT_TILT_FLOOR, WEIGHT_TILT_CAP);
  return baseWeight * clampedMultiplier;
}

/** The category of a known trait — for the architecture-guard test (any trait must have one of the four categories). */
export function categoryOf(traitId: TraitId): TraitCategory {
  return TRAITS[traitId].category;
}
