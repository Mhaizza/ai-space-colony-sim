// M6 — Need System. Monotone clock-rated decay; condition-gated restoration;
// threshold evaluation with hysteresis; monotone urgency with the Rest
// amplifier. Emits threshold-crossing signals as re-decision triggers.
// [engineering-specification.md §2 M6; ADR-17 D2-D6, D9]

import { NEED_CALIBRATION } from "./calibration.js";
import { NEED_CATEGORY, NEED_KINDS } from "./types.js";
import type { ColonistState, NeedKind, SimDuration } from "./types.js";

/** Bounded, non-veto trait surface onto need dynamics. [ADR-17 D7] Neutral by default. */
export interface NeedTraitModifiers {
  decayRateMultiplier: Partial<Record<NeedKind, number>>;
  thresholdShift: Partial<Record<NeedKind, { low?: number; critical?: number }>>;
}

export function neutralNeedModifiers(): NeedTraitModifiers {
  return { decayRateMultiplier: {}, thresholdShift: {} };
}

function effectiveLowThreshold(need: NeedKind, mods: NeedTraitModifiers): number {
  return NEED_CALIBRATION.lowThreshold + (mods.thresholdShift[need]?.low ?? 0);
}

function effectiveCriticalThreshold(need: NeedKind, mods: NeedTraitModifiers): number {
  return NEED_CALIBRATION.criticalThreshold + (mods.thresholdShift[need]?.critical ?? 0);
}

/**
 * Pure: one need's next level after `dt` seconds. Monotone decay absent
 * satisfaction; condition-gated restoration only while `satisfying` holds.
 * Never both in the same step — restoration or decay, never blended.
 * [ADR-17 D2]
 */
export function stepNeedLevel(
  level: number,
  need: NeedKind,
  dt: SimDuration,
  satisfying: boolean,
  decayRateMultiplier: number,
): number {
  const { max, baseDecayPerSecond, restorePerSecond } = NEED_CALIBRATION;
  if (satisfying) {
    return Math.min(max, level + restorePerSecond[need] * dt);
  }
  return Math.max(0, level - baseDecayPerSecond[need] * decayRateMultiplier * dt);
}

/**
 * Pure: monotone urgency from threshold depth. Zero on the satisfied side of
 * the low threshold; grows monotonically past it. [ADR-17 D5]
 */
export function needUrgency(
  level: number,
  need: NeedKind,
  mods: NeedTraitModifiers,
): number {
  const low = effectiveLowThreshold(need, mods);
  if (level >= low) return 0;
  return (low - level) / low; // normalized deficit depth, in (0, 1]
}

/**
 * Pure: applies the Rest amplifier to an urgency map. Amplifies existing
 * urgency only — never manufactures urgency for a satisfied need.
 * [ADR-17 D6 — review-clarified amplifier scope]
 */
export function applyRestAmplifier(
  urgencies: Record<NeedKind, number>,
  restLevel: number,
): Record<NeedKind, number> {
  const { activationThreshold, multiplier } = NEED_CALIBRATION.restAmplifier;
  if (restLevel >= activationThreshold) return urgencies;
  const out = { ...urgencies };
  for (const need of NEED_KINDS) {
    if (need === "rest") continue;
    if (out[need] > 0) out[need] *= multiplier;
  }
  return out;
}

export type ThresholdCrossing = { need: NeedKind; kind: "low" | "critical"; direction: "entered" | "exited" };

/**
 * Impure orchestrator: advances all five needs by `dt`, in place on the
 * colonist. `satisfyingConditions` reflects M4-supplied facts (module
 * access, resource presence) for whichever need the colonist is currently
 * actively satisfying — Stage 1 has at most one active satisfaction task.
 * Returns threshold crossings detected this step (re-decision trigger 4).
 */
export function tickNeeds(
  colonist: ColonistState,
  dt: SimDuration,
  satisfyingConditions: Partial<Record<NeedKind, boolean>>,
  mods: NeedTraitModifiers = neutralNeedModifiers(),
): ThresholdCrossing[] {
  const crossings: ThresholdCrossing[] = [];
  for (const need of NEED_KINDS) {
    const before = colonist.needs[need];
    const decayMultiplier = mods.decayRateMultiplier[need] ?? 1;
    const after = stepNeedLevel(before, need, dt, satisfyingConditions[need] === true, decayMultiplier);
    colonist.needs[need] = after;

    const low = effectiveLowThreshold(need, mods);
    if (before >= low && after < low) crossings.push({ need, kind: "low", direction: "entered" });
    if (before < low && after >= NEED_CALIBRATION.satisfactionPoint) {
      crossings.push({ need, kind: "low", direction: "exited" });
    }

    if (NEED_CATEGORY[need] === "biological") {
      const crit = effectiveCriticalThreshold(need, mods);
      if (before >= crit && after < crit) crossings.push({ need, kind: "critical", direction: "entered" });
      if (before < crit && after >= crit) crossings.push({ need, kind: "critical", direction: "exited" });
    }
  }
  return crossings;
}

/** Per-need urgency for all five needs, Rest-amplified. The decision loop's base weight. [decision-loop.md §6] */
export function computeUrgencies(
  colonist: ColonistState,
  mods: NeedTraitModifiers = neutralNeedModifiers(),
): Record<NeedKind, number> {
  const raw = Object.fromEntries(
    NEED_KINDS.map((need) => [need, needUrgency(colonist.needs[need], need, mods)]),
  ) as Record<NeedKind, number>;
  return applyRestAmplifier(raw, colonist.needs.rest);
}

export function isBelowLow(colonist: ColonistState, need: NeedKind, mods: NeedTraitModifiers = neutralNeedModifiers()): boolean {
  return colonist.needs[need] < effectiveLowThreshold(need, mods);
}

export function isBelowCritical(colonist: ColonistState, need: NeedKind, mods: NeedTraitModifiers = neutralNeedModifiers()): boolean {
  return NEED_CATEGORY[need] === "biological" && colonist.needs[need] < effectiveCriticalThreshold(need, mods);
}
