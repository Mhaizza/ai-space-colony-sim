// M8 — Trait System. Owns trait definitions (the behavioral contract per
// trait) and per-colonist trait state. Serves trait weight contributions to
// M11 and rate/threshold modifiers to M6/M7, bounded per ADR-17 D7.
//
// The trait list below is provisional and non-canonical (DQ-T1 is prototype
// scope) — one illustrative trait per category, sufficient to exercise all
// four category surfaces per engineering-specification.md §10's Stage 1
// "must include" list. [engineering-specification.md §2 M8; personality-traits.md]

import { WEIGHT_CALIBRATION } from "./calibration.js";
import { neutralNeedModifiers, type NeedTraitModifiers } from "./needs.js";
import { neutralStressModifiers, type StressTraitModifiers } from "./stress.js";
import type { ColonistState, GoalSource, NeedKind, TraitCategory, TraitInstance } from "./types.js";

export interface TraitDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: TraitCategory;
  readonly needModifiers?: NeedTraitModifiers;
  readonly stressModifiers?: Partial<StressTraitModifiers>;
  /** Weight tilt applied when a candidate's goal source matches — bounded, never veto. [ADR-17 D7] */
  readonly goalSourceTilt?: Partial<Record<GoalSource, number>>;
}

/** Provisional Stage 1 trait set: one per category (DQ-T1 deferred to prototype). */
export const TRAIT_DEFINITIONS: Readonly<Record<string, TraitDefinition>> = {
  driven: {
    id: "driven",
    name: "Driven",
    category: "work-disposition",
    needModifiers: {
      decayRateMultiplier: {},
      // Tolerates needs longer before an override reads as necessary — thresholds shift down (more tolerant), never removed.
      thresholdShift: { hunger: { critical: -5 }, rest: { critical: -5 } },
    },
    goalSourceTilt: { "shift-assignment": 0.3, voluntary: 0.1 },
  },
  resilient: {
    id: "resilient",
    name: "Resilient",
    category: "stress-response",
    stressModifiers: { accumulationMultiplier: 0.6, dissipationMultiplier: 1.2 },
  },
  social: {
    id: "social",
    name: "Social",
    category: "social-disposition",
    needModifiers: {
      decayRateMultiplier: { social: 1.4 },
      thresholdShift: {},
    },
    goalSourceTilt: { voluntary: 0.25 },
  },
  wary: {
    id: "wary",
    name: "Wary",
    category: "need-disposition",
    needModifiers: {
      decayRateMultiplier: { safety: 1.3 },
      thresholdShift: { safety: { low: 10 } }, // registers deprivation earlier
    },
  },
};

export function assignTrait(colonist: ColonistState, traitId: string): void {
  const def = TRAIT_DEFINITIONS[traitId];
  if (!def) throw new Error(`Unknown trait: ${traitId}`);
  if (colonist.traits.some((t) => t.traitId === traitId)) return;
  const instance: TraitInstance = { traitId, category: def.category, discovery: "unknown" };
  colonist.traits.push(instance);
}

function mergeNeedModifiers(a: NeedTraitModifiers, b: NeedTraitModifiers): NeedTraitModifiers {
  const decayRateMultiplier = { ...a.decayRateMultiplier };
  for (const [k, v] of Object.entries(b.decayRateMultiplier) as [NeedKind, number][]) {
    decayRateMultiplier[k] = (decayRateMultiplier[k] ?? 1) * v;
  }
  const thresholdShift = { ...a.thresholdShift };
  for (const [k, v] of Object.entries(b.thresholdShift) as [NeedKind, { low?: number; critical?: number }][]) {
    const existing = thresholdShift[k] ?? {};
    thresholdShift[k] = {
      low: (existing.low ?? 0) + (v.low ?? 0),
      critical: (existing.critical ?? 0) + (v.critical ?? 0),
    };
  }
  return { decayRateMultiplier, thresholdShift };
}

/** Aggregates all of a colonist's trait need-modifier contributions. Bounded, never structural (D7). */
export function aggregateNeedModifiers(colonist: ColonistState): NeedTraitModifiers {
  let mods = neutralNeedModifiers();
  for (const instance of colonist.traits) {
    const def = TRAIT_DEFINITIONS[instance.traitId];
    if (def?.needModifiers) mods = mergeNeedModifiers(mods, def.needModifiers);
  }
  return mods;
}

export function aggregateStressModifiers(colonist: ColonistState): StressTraitModifiers {
  const mods = neutralStressModifiers();
  for (const instance of colonist.traits) {
    const def = TRAIT_DEFINITIONS[instance.traitId];
    if (!def?.stressModifiers) continue;
    if (def.stressModifiers.accumulationMultiplier !== undefined) {
      mods.accumulationMultiplier *= def.stressModifiers.accumulationMultiplier;
    }
    if (def.stressModifiers.dissipationMultiplier !== undefined) {
      mods.dissipationMultiplier *= def.stressModifiers.dissipationMultiplier;
    }
  }
  return mods;
}

/**
 * Sum of trait tilts toward a goal source, bounded to
 * [-maxFamilyContributionFraction, +maxFamilyContributionFraction] of base —
 * bound, never veto. [decision-loop.md §6 constraint 2]
 */
export function traitWeightTilt(colonist: ColonistState, source: GoalSource): number {
  let total = 0;
  for (const instance of colonist.traits) {
    const def = TRAIT_DEFINITIONS[instance.traitId];
    total += def?.goalSourceTilt?.[source] ?? 0;
  }
  const bound = WEIGHT_CALIBRATION.maxFamilyContributionFraction;
  return Math.max(-bound, Math.min(bound, total));
}
