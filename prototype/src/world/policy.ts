// M3 Policy System — engineering spec §2 M3. Stage 1: one colony-level shift policy only.
// No scopes, no cascade, no pending changes (ADR-11's four-scope architecture and ADR-07 Cat 2
// pending-change model are explicitly out of scope here — Stage 1 has one colonist, so a
// single colony-scope policy already IS the effective policy; there is nothing to cascade).
// Pure throughout.

import { TICKS_PER_DAY } from "../config/constants.js";
import { SHIFT_TUNING } from "../config/tuning.js";

/** The three shift periods (ADR-01 tier 3's shift skeleton). */
export type ShiftPeriod = "work" | "rest" | "free";

/** One colony-level shift policy: period durations in ticks, summing to one in-game day. */
export interface ShiftPolicy {
  readonly workTicks: number;
  readonly restTicks: number;
  readonly freeTicks: number;
}

/** Creates the default shift policy from tuning. Throws if periods don't cover one full day. */
export function createDefaultPolicy(): ShiftPolicy {
  const policy: ShiftPolicy = {
    workTicks: SHIFT_TUNING.workTicks,
    restTicks: SHIFT_TUNING.restTicks,
    freeTicks: SHIFT_TUNING.freeTicks,
  };
  validatePolicy(policy);
  return policy;
}

/** A policy's periods must be non-negative and sum to exactly one in-game day. */
export function validatePolicy(policy: ShiftPolicy): void {
  const { workTicks, restTicks, freeTicks } = policy;
  if (workTicks < 0 || restTicks < 0 || freeTicks < 0) {
    throw new Error("Shift policy periods must be non-negative");
  }
  const total = workTicks + restTicks + freeTicks;
  if (total !== TICKS_PER_DAY) {
    throw new Error(`Shift policy periods must sum to TICKS_PER_DAY (${TICKS_PER_DAY}), got ${total}`);
  }
}

/**
 * Resolves which shift period a tick-of-day falls into, in fixed order work → rest → free.
 * `tickOfDay` must be in [0, TICKS_PER_DAY).
 */
export function periodAt(policy: ShiftPolicy, tickOfDay: number): ShiftPeriod {
  if (!Number.isInteger(tickOfDay) || tickOfDay < 0 || tickOfDay >= TICKS_PER_DAY) {
    throw new Error(`tickOfDay must be an integer in [0, ${TICKS_PER_DAY}), got ${tickOfDay}`);
  }
  if (tickOfDay < policy.workTicks) return "work";
  if (tickOfDay < policy.workTicks + policy.restTicks) return "rest";
  return "free";
}

/**
 * The policy side of the eligibility intersection (colonist skill ∩ policy permission ∩ task
 * requirement — locked #2). Stage 1 has exactly one scope (colony) and no restrictions
 * defined within it, so permission is trivially granted; this function exists so the
 * intersection is a real three-way check with a real (if currently permissive) middle term,
 * not a two-way check with policy silently assumed. Multi-scope permission logic is ADR-11
 * territory and out of scope here.
 */
export function isPermitted(_policy: ShiftPolicy): boolean {
  return true;
}
