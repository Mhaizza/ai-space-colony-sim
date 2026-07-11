// M6 Need System — ADR-17 (all decisions). The only module permitted to produce a new
// need level: every level change in the simulation must go through decayNeeds or
// restoreNeed. Pure throughout — callers hold state; nothing here mutates.

import { BIOLOGICAL_NEEDS, NEEDS, type NeedId } from "../config/constants.js";
import {
  NEED_TUNING,
  REST_AMPLIFIER_MAX_MULTIPLIER,
  REST_AMPLIFIER_SUSTAIN_TICKS,
  URGENCY_GROWTH_EXPONENT,
} from "../config/tuning.js";
import {
  applyNeedRateContributions,
  applyNeedThresholdContributions,
  needRateContributions,
  needThresholdContributions,
  type TraitId,
} from "./traits.js";

/**
 * Per-need tracked state. `level` is the single scalar need level, 0 (fully deprived) to
 * 1 (fully satisfied) — ADR-17 D2: single-valued, bounded, continuous.
 * `ticksBelowLow` is consecutive ticks spent under the low threshold, reset on satisfaction;
 * it is what "sustained" deprivation means for the Rest amplifier (ADR-17 D6) and is tracked
 * per need uniformly (P1 — one system, many needs) even though only Rest's counter is consumed
 * by the amplifier today.
 */
export interface NeedTrack {
  readonly level: number;
  readonly ticksBelowLow: number;
}

/** Need state for all five canonical needs (ADR-17 D1 — closed taxonomy). */
export type NeedsState = Readonly<Record<NeedId, NeedTrack>>;

const isBiological = (id: NeedId): boolean => (BIOLOGICAL_NEEDS as readonly NeedId[]).includes(id);

/** Creates need state for a newly arrived colonist: every need starts fully satisfied. */
export function createNeeds(): NeedsState {
  const state = {} as Record<NeedId, NeedTrack>;
  for (const id of NEEDS) {
    state[id] = { level: 1, ticksBelowLow: 0 };
  }
  return state;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Low threshold shifted by every held trait's threshold-modifier contribution (ADR-17 D7, surface 1). */
function effectiveLowThreshold(id: NeedId, traits: readonly TraitId[]): number {
  return applyNeedThresholdContributions(NEED_TUNING[id].lowThreshold, needThresholdContributions(traits, id));
}

function retrack(id: NeedId, level: number, ticksBelowLow: number, deltaTicks: number, traits: readonly TraitId[]): NeedTrack {
  const low = effectiveLowThreshold(id, traits);
  return { level, ticksBelowLow: level < low ? ticksBelowLow + deltaTicks : 0 };
}

/**
 * Applies clock-rated decay to every need (ADR-17 D2: monotone — deficit direction only;
 * D5: decay drives the deficit that generates urgency). Pure; `ticks` must be a non-negative
 * integer count of elapsed in-game ticks. `traits` (ADR-17 D7, surface 1) shift the decay rate
 * and low threshold per held trait; omitted traits behave exactly as an untraited colonist.
 */
export function decayNeeds(state: NeedsState, ticks: number, traits: readonly TraitId[] = []): NeedsState {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error(`decayNeeds ticks must be a non-negative integer, got ${ticks}`);
  }
  const next = {} as Record<NeedId, NeedTrack>;
  for (const id of NEEDS) {
    const track = state[id];
    const decayPerTick = applyNeedRateContributions(NEED_TUNING[id].decayPerTick, needRateContributions(traits, id));
    const level = clamp01(track.level - decayPerTick * ticks);
    next[id] = retrack(id, level, track.ticksBelowLow, ticks, traits);
  }
  return next;
}

/**
 * Restores one need while its satisfaction conditions hold (ADR-17 D2: condition-gated
 * restoration — the caller, not this function, is responsible for verifying conditions hold;
 * this function only applies the rate). No other function in this module raises a level.
 */
export function restoreNeed(state: NeedsState, id: NeedId, ticks: number, traits: readonly TraitId[] = []): NeedsState {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error(`restoreNeed ticks must be a non-negative integer, got ${ticks}`);
  }
  return restoreNeedByAmount(state, id, NEED_TUNING[id].restorePerTick * ticks, traits);
}

/**
 * Restores one need by a direct level amount rather than a tick count at the need's own fixed
 * rate — for consequences whose restoration is itself scaled by something else already (e.g.
 * task/execution.ts scaling hunger restoration to the food actually consumed, not the food a
 * full tick span would have consumed). `amount` may be fractional; `restoreNeed` is defined in
 * terms of this function, not the other way around, so both paths retrack identically (ADR-17
 * D7's trait-shifted threshold applies consistently either way).
 */
export function restoreNeedByAmount(state: NeedsState, id: NeedId, amount: number, traits: readonly TraitId[] = []): NeedsState {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`restoreNeedByAmount amount must be a non-negative finite number, got ${amount}`);
  }
  const track = state[id];
  const level = clamp01(track.level + amount);
  return { ...state, [id]: retrack(id, level, track.ticksBelowLow, 0, traits) };
}

/** True when the need is past its low threshold (tier-4 deferred-satisfaction candidate). */
export function isLow(id: NeedId, level: number, traits: readonly TraitId[] = []): boolean {
  return level < effectiveLowThreshold(id, traits);
}

/**
 * True when the need is past its critical threshold. Structurally always false for
 * psychological needs (ADR-17 D3–D4: "there is no value a Safety, Social, or Purpose level
 * can reach that produces a shift override") — enforced here by the null criticalThreshold,
 * not by a category branch, so no caller can accidentally grant one a critical path.
 */
export function isCritical(id: NeedId, level: number): boolean {
  const threshold = NEED_TUNING[id].criticalThreshold;
  return threshold !== null && level < threshold;
}

/**
 * True when the need has been restored past its satisfaction point — the completion
 * criterion for a need-goal (decision-loop §10). The satisfaction point sits strictly above
 * the low threshold (ADR-17 D3: structural hysteresis), so a need can be no-longer-low
 * while still not yet satisfied — this is the hysteresis band, queryable directly.
 */
export function isSatisfied(id: NeedId, level: number): boolean {
  return level >= NEED_TUNING[id].satisfactionPoint;
}

/**
 * Per-need monotone urgency (ADR-17 D5): zero on the satisfied side of the low threshold;
 * past it, grows monotonically with deficit depth. One need's urgency never reads another
 * need's state — computed independently per need, as D5 requires.
 */
export function urgency(id: NeedId, level: number, traits: readonly TraitId[] = []): number {
  const low = effectiveLowThreshold(id, traits);
  if (level >= low) return 0;
  const depth = low - level;
  return depth ** URGENCY_GROWTH_EXPONENT;
}

/** Raw (pre-amplifier) urgency for every need, from levels only. */
export function rawUrgencies(state: NeedsState, traits: readonly TraitId[] = []): Readonly<Record<NeedId, number>> {
  const result = {} as Record<NeedId, number>;
  for (const id of NEEDS) {
    result[id] = urgency(id, state[id].level, traits);
  }
  return result;
}

/**
 * Applies the Rest amplifier (ADR-17 D6, review-clarified): sustained Rest deprivation
 * amplifies the urgency the other four needs *already have* — it can never create urgency
 * for a need on the satisfied side of its low threshold. This holds structurally here: a
 * zero input times any multiplier is zero, so "amplify existing urgency only" is not a rule
 * this function must remember to enforce, it is a property of multiplication.
 * Rest's own urgency is never amplified (the amplifier is radial, not self-referential).
 */
export function amplifyUrgencies(
  state: NeedsState,
  urgencies: Readonly<Record<NeedId, number>>,
): Readonly<Record<NeedId, number>> {
  const engaged = state.rest.ticksBelowLow >= REST_AMPLIFIER_SUSTAIN_TICKS;
  const multiplier = engaged ? REST_AMPLIFIER_MAX_MULTIPLIER : 1;
  const result = {} as Record<NeedId, number>;
  for (const id of NEEDS) {
    result[id] = id === "rest" ? urgencies[id] : urgencies[id] * multiplier;
  }
  return result;
}

/** Full per-need urgency (amplifier applied) — the base weight input to decision-loop §6. */
export function computeUrgencies(state: NeedsState, traits: readonly TraitId[] = []): Readonly<Record<NeedId, number>> {
  return amplifyUrgencies(state, rawUrgencies(state, traits));
}

export { isBiological };
