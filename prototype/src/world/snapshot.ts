// M4 Snapshot Service — engineering spec §2 M4; decision-loop §1b. THE ONLY world-to-decision
// read path (locked #4, #21, #22). No decision module may read World, Policy, or Clock
// directly — every decision-relevant fact about the world arrives through a WorldSnapshot
// built here, fixed for the duration of one decision.
//
// Perception invariants enforced by construction, not by convention:
//   - fixed: buildSnapshot returns a plain immutable value; nothing in it can change after
//     the call returns, because World/Policy/Clock updates never mutate in place — they
//     always produce a new state object, so an existing snapshot can never observe a later
//     update (locked #4: "no mid-decision reads, no live cross-agent references").
//   - Tier-1-only, spatially bounded: nearbyColonists carries only observable ambient state,
//     never another colonist's internals (locked #21). At Stage 1 there is exactly one
//     colonist, so the field is always empty — present, not populated, per the Stage 1 scope.
//   - no crisis-stage labels: this module reads M2 conditions only; stage labels are S2's
//     player-signaling output and are never colonist input (locked #22). S2 does not exist
//     yet, so there is nothing to exclude in code — this is a standing constraint on future
//     additions to this file, not a runtime check today.

import type { ClockState } from "../core/clock.js";
import { dayOf, tickOfDay } from "../core/clock.js";
import type { ModuleId } from "../config/constants.js";
import type { ModuleState, WorldState } from "./world.js";
import type { ShiftPeriod, ShiftPolicy } from "./policy.js";
import { periodAt } from "./policy.js";

/**
 * A nearby colonist's Tier-1-observable facts only (ADR-05's seven states) — "a colonist
 * knows what the player can see" (locked #21). No internals (needs, stress, goals, memory)
 * are representable in this type; that is the boundary, not an omission.
 */
export interface ObservableColonist {
  readonly id: string;
  readonly ambientState: string;
}

/** The fixed, per-decision world snapshot (decision-loop §1b). */
export interface WorldSnapshot {
  readonly tick: number;
  readonly day: number;
  readonly tickOfDay: number;
  readonly currentPeriod: ShiftPeriod;
  readonly effectivePolicy: ShiftPolicy;
  readonly modules: Readonly<Record<ModuleId, ModuleState>>;
  readonly foodStock: number;
  readonly nearbyColonists: readonly ObservableColonist[];
}

/**
 * Builds one fixed snapshot from the current world, policy, and clock state. Pure: the
 * result is a new plain object; later updates to world/policy/clock cannot retroactively
 * change it, because those modules never mutate their state in place.
 */
export function buildSnapshot(clock: ClockState, policy: ShiftPolicy, world: WorldState): WorldSnapshot {
  const tod = tickOfDay(clock);
  return {
    tick: clock.tick,
    day: dayOf(clock),
    tickOfDay: tod,
    currentPeriod: periodAt(policy, tod),
    effectivePolicy: policy,
    modules: world.modules,
    foodStock: world.foodStock,
    nearbyColonists: [],
  };
}
