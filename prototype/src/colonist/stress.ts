// M7 Stress System — decision-loop §7 (stress ownership per the card scope inherited by the
// engineering specification). Emergent, not a need (needs-system P7): no satisfaction action,
// accumulates from sources, dissipates through reliefs, always source-attributed. Pure.
//
// Stage 1 sources/reliefs are exactly the ones computable from local colonist inputs (needs
// only — no world, policy, or execution module exists yet):
//   sources: sustained unmet psychological needs; sustained biological strain (any need below
//     its low threshold, including critical — priority override and stress accumulation are
//     separate concerns, per architecture review correction 2026-07-10)
//   reliefs: rest adequacy; needs satisfied across the board
// Overwork (needs an "is working" signal from M12) and stable-conditions relief (needs M2
// world state) are decision-loop §7 sources/reliefs this module does NOT yet compute — there
// is no local input to compute them from. They join when their owning modules exist; this is
// a scope boundary, not an omission to silently paper over.

import { PSYCHOLOGICAL_NEEDS, type NeedId } from "../config/constants.js";
import { STRESS_TUNING } from "../config/tuning.js";
import { isBiological, isLow, isSatisfied, type NeedsState } from "./needs.js";

/** Stress sources and reliefs realized at this build step — a subset of decision-loop §7's full list. */
export type StressChannelId = "psychNeedDeprivation" | "biologicalStrain" | "restAdequacy" | "needsSatisfied";

/** Stress level only — 0 (none) to 1 (maximal). Attribution is returned per call, not stored (S2 owns retention). */
export interface StressState {
  readonly level: number;
}

/** One channel's contribution to a single evaluateStress call: positive = accumulation, negative = dissipation. */
export interface StressContribution {
  readonly id: StressChannelId;
  readonly rawDelta: number;
}

/** Result of one stress evaluation: the new state and the full per-channel decomposition (traceability requirement). */
export interface StressUpdateResult {
  readonly state: StressState;
  readonly contributions: readonly StressContribution[];
}

/** Creates stress state for a newly arrived colonist: unstressed. */
export function createStress(): StressState {
  return { level: 0 };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function countLowPsychological(needs: NeedsState): number {
  // Prototype Stage 1 provisional aggregation strategy: scaling linearly with the count of
  // low psychological needs is one way to represent "sustained unmet psychological needs"
  // (decision-loop §7) as a single source, not an architectural commitment to linear scaling.
  // Any aggregation that keeps the source traceable and additive is equally valid; this one
  // is the simplest that could be built first and is free to change without an ADR.
  let count = 0;
  for (const id of PSYCHOLOGICAL_NEEDS) {
    if (isLow(id, needs[id].level)) count++;
  }
  return count;
}

function countBiologicalStrain(needs: NeedsState): number {
  // "Strain" per decision-loop §7: any biological need below its low threshold contributes —
  // low and critical are NOT mutually exclusive stress inputs. Priority override (ADR-01
  // tier 2 — the colonist abandons their post) and stress accumulation (this module) are
  // separate concerns operating on the same underlying deficit; crossing into critical must
  // not make the stress contribution disappear. Whether critical contributes more than low
  // is intentionally not decided here — both are counted identically at the same per-tick
  // rate (STRESS_TUNING.bioStrainPerTick), which is itself provisional and free to diverge by
  // severity later without changing this module's structure.
  let count = 0;
  for (const id of Object.keys(needs) as NeedId[]) {
    if (isBiological(id) && isLow(id, needs[id].level)) count++;
  }
  return count;
}

/**
 * Evaluates stress for one tick span from need state alone. Pure: same inputs, same result.
 * `ticks` must be a non-negative integer count of elapsed in-game ticks.
 * Every channel is always represented in `contributions`, zero-valued when inactive, so a
 * caller can show "no rest relief this tick" as explicitly as "rest relief: -0.0008" —
 * decomposability is a property of the return shape, not something callers must reconstruct.
 */
export function evaluateStress(state: StressState, needs: NeedsState, ticks: number): StressUpdateResult {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error(`evaluateStress ticks must be a non-negative integer, got ${ticks}`);
  }

  const psychLowCount = countLowPsychological(needs);
  const bioStrainCount = countBiologicalStrain(needs);
  const restAdequate = isSatisfied("rest", needs.rest.level);
  const allSatisfied = (Object.keys(needs) as NeedId[]).every((id) => isSatisfied(id, needs[id].level));

  const contributions: StressContribution[] = [
    { id: "psychNeedDeprivation", rawDelta: STRESS_TUNING.psychNeedPerTick * ticks * psychLowCount },
    { id: "biologicalStrain", rawDelta: STRESS_TUNING.bioStrainPerTick * ticks * bioStrainCount },
    { id: "restAdequacy", rawDelta: restAdequate ? -STRESS_TUNING.restReliefPerTick * ticks : 0 },
    { id: "needsSatisfied", rawDelta: allSatisfied ? -STRESS_TUNING.satisfiedReliefPerTick * ticks : 0 },
  ];

  const totalDelta = contributions.reduce((sum, c) => sum + c.rawDelta, 0);
  const level = clamp01(state.level + totalDelta);

  return { state: { level }, contributions };
}

/** True when stress has crossed the Stressed ambient-state behavioral threshold (ADR-05). */
export function isStressedState(state: StressState): boolean {
  return state.level >= STRESS_TUNING.stressedStateThreshold;
}

/** True when stress is high enough to suppress acceptance of demanding candidates (decision-loop §7). */
export function exceedsTaskAcceptanceThreshold(state: StressState): boolean {
  return state.level >= STRESS_TUNING.taskAcceptanceThreshold;
}
