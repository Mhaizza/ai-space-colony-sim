// Headless run harness — sets up a Stage 1 single-colonist simulation and advances it in
// fixed steps via tick.ts. No save/load, no relationships, no social actions, no UI, no
// rendering, no networking (Build Step 8 scope).
//
// Fixed-step rule (review fix 2, 2026-07-10): tick() only accepts BASE_TICKS_PER_STEP, so
// run() is the only place a larger timeline advances — by calling tick() once per step, never
// by passing a larger delta. This guarantees every fixed simulation step is evaluated and no
// intermediate need-threshold crossing or shift boundary can be skipped by a coarse caller.

import { createClock } from "../core/clock.js";
import { createPrng } from "../core/prng.js";
import { BASE_TICKS_PER_STEP } from "../config/constants.js";
import { createColonist, type ColonistIdentity } from "../colonist/colonist.js";
import type { TraitId } from "../colonist/traits.js";
import { createRelationshipStore } from "../colonist/relationships.js";
import { createDefaultPolicy } from "../world/policy.js";
import { createWorld } from "../world/world.js";
import { createDecisionLog, createEventLog } from "../records/logs.js";
import { createFreshMemoryBaselines, tick, type SimulationState, type TickEvent } from "./tick.js";

/**
 * Creates a fresh Stage 1 simulation: default station, default policy, one simulated colonist,
 * seeded PRNG, plus an optional identity-only roster (Stage 2 Slice 2) of other colonists a
 * relationship pair may reference. Roster entries are never simulated (no needs/stress/memory/
 * decision loop) — the empty default preserves every pre-Slice-2 run's exact behavior.
 */
export function createInitialState(
  seed: number,
  colonistId: string,
  colonistName: string,
  skills: readonly string[] = [],
  baseTraits: readonly TraitId[] = [],
  roster: readonly ColonistIdentity[] = [],
): SimulationState {
  return {
    clock: createClock(),
    world: createWorld(),
    policy: createDefaultPolicy(),
    colonist: createColonist(colonistId, colonistName, skills, baseTraits),
    execution: null,
    suspendedExecution: null,
    prng: createPrng(seed),
    ...createFreshMemoryBaselines(),
    hasBootstrapped: false,
    eventLog: createEventLog(),
    decisionLog: createDecisionLog(),
    relationships: createRelationshipStore(),
    roster,
  };
}

/** The full result of a headless run: final state plus the concatenated event trace across every tick. */
export interface RunResult {
  readonly finalState: SimulationState;
  readonly events: readonly TickEvent[];
}

/**
 * Advances `initial` by `totalTicks` in-game ticks, calling tick() exactly once per
 * BASE_TICKS_PER_STEP — never with a larger delta, so every fixed step (and everything it
 * might trigger) is evaluated. Pure with respect to `initial` — never mutates it.
 */
export function run(initial: SimulationState, totalTicks: number): RunResult {
  if (!Number.isInteger(totalTicks) || totalTicks < 0) {
    throw new Error(`totalTicks must be a non-negative integer, got ${totalTicks}`);
  }
  if (totalTicks % BASE_TICKS_PER_STEP !== 0) {
    throw new Error(`totalTicks must be a whole multiple of BASE_TICKS_PER_STEP (${BASE_TICKS_PER_STEP}), got ${totalTicks}`);
  }

  let state = initial;
  const events: TickEvent[] = [];
  const steps = totalTicks / BASE_TICKS_PER_STEP;
  for (let i = 0; i < steps; i++) {
    const result = tick(state, BASE_TICKS_PER_STEP);
    state = result.state;
    events.push(...result.events);
  }
  return { finalState: state, events };
}
