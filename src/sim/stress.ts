// M7 — Stress System. Accumulates from six sources, dissipates through four
// reliefs, scaled by Stress Response traits. Maintains per-source attribution
// for every movement — a data obligation, not a UI one.
// [engineering-specification.md §2 M7; decision-loop.md §7; locked #27]

import { STRESS_CALIBRATION } from "./calibration.js";
import type { ColonistState, SimDuration, StressRelief, StressSource } from "./types.js";

/** Which sources/reliefs are active this step, supplied by the orchestrator from world/need/social state. */
export interface StressInputs {
  sources: Partial<Record<StressSource, boolean>>;
  reliefs: Partial<Record<StressRelief, boolean>>;
}

export function noStressInputs(): StressInputs {
  return { sources: {}, reliefs: {} };
}

/** Bounded Stress Response trait surface. Neutral (1x) by default. */
export interface StressTraitModifiers {
  accumulationMultiplier: number;
  dissipationMultiplier: number;
}

export function neutralStressModifiers(): StressTraitModifiers {
  return { accumulationMultiplier: 1, dissipationMultiplier: 1 };
}

/**
 * Impure orchestrator: advances stress by `dt`, in place. Every movement is
 * attributed by source/relief for the inspector (traceability requirement).
 * [decision-loop.md §7]
 */
export function tickStress(
  colonist: ColonistState,
  dt: SimDuration,
  inputs: StressInputs,
  mods: StressTraitModifiers = neutralStressModifiers(),
): void {
  const attribution: ColonistState["stress"]["attribution"] = {};
  let delta = 0;

  for (const [source, active] of Object.entries(inputs.sources) as [StressSource, boolean][]) {
    if (!active) continue;
    const contribution = STRESS_CALIBRATION.accumulationPerSecond[source] * dt * mods.accumulationMultiplier;
    attribution[source] = contribution;
    delta += contribution;
  }

  for (const [relief, active] of Object.entries(inputs.reliefs) as [StressRelief, boolean][]) {
    if (!active) continue;
    const contribution = STRESS_CALIBRATION.dissipationPerSecond[relief] * dt * mods.dissipationMultiplier;
    attribution[relief] = -contribution;
    delta -= contribution;
  }

  colonist.stress.level = clamp(colonist.stress.level + delta, 0, STRESS_CALIBRATION.max);
  colonist.stress.attribution = attribution;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Stress past the behavioral threshold reads as the Stressed ambient state. [ADR-05] */
export function isStressedState(colonist: ColonistState): boolean {
  return colonist.stress.level >= STRESS_CALIBRATION.behavioralThreshold;
}

/** Weight-family input: elevated stress suppresses acceptance of demanding candidates. Bound, never a veto. [decision-loop.md §7] */
export function acceptanceSuppression(colonist: ColonistState): number {
  const { level } = colonist.stress;
  const { acceptanceSuppressionThreshold, max } = STRESS_CALIBRATION;
  if (level < acceptanceSuppressionThreshold) return 0;
  return (level - acceptanceSuppressionThreshold) / (max - acceptanceSuppressionThreshold);
}

/** Capacity suppression: high stress reduces effective task performance. [ADR-09 solvability] */
export function capacitySuppression(colonist: ColonistState): number {
  return acceptanceSuppression(colonist) * 0.5;
}
