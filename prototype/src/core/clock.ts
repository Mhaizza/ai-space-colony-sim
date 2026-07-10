// M1 Simulation Clock — in-game time reference. Engineering spec §2 M1.
// Fixed-step: time is an integer tick count (no float accumulation — determinism §8.3).
// The clock is a reference, never a scheduler: it fires nothing, triggers nothing (ADR-02).
// Speed control scales ticks-per-step uniformly (ADR-06); behavior depends only on in-game
// ticks, which is what makes speed invariance (validation check 3) structural.

import { BASE_TICKS_PER_STEP, TICKS_PER_DAY, type SpeedLevel } from "../config/constants.js";

/** Serializable clock state: total elapsed in-game ticks since simulation start. */
export interface ClockState {
  readonly tick: number;
}

/** Creates a clock at simulation start (tick 0). */
export function createClock(): ClockState {
  return { tick: 0 };
}

/** Advances the clock by a whole number of in-game ticks. Pure. Rejects non-integer/negative deltas. */
export function advance(state: ClockState, deltaTicks: number): ClockState {
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error(`Clock delta must be a non-negative integer, got ${deltaTicks}`);
  }
  return { tick: state.tick + deltaTicks };
}

/** In-game ticks one real step advances at the given speed (0 when paused). */
export function ticksForStep(speed: SpeedLevel): number {
  return BASE_TICKS_PER_STEP * speed;
}

/** Day counter, 1-based (Day 1, Day 2, ... — ADR-02 player-facing anchoring). */
export function dayOf(state: ClockState): number {
  return Math.floor(state.tick / TICKS_PER_DAY) + 1;
}

/** Tick position within the current day, in [0, TICKS_PER_DAY). */
export function tickOfDay(state: ClockState): number {
  return state.tick % TICKS_PER_DAY;
}

/** Elapsed ticks since an earlier reference tick — the duration form all consumers use (ADR-02). */
export function elapsedSince(state: ClockState, sinceTick: number): number {
  return state.tick - sinceTick;
}

/** Serializes clock state for the save set (spec §7). */
export function serializeClock(state: ClockState): string {
  return JSON.stringify(state);
}

/** Restores clock state from a save. Throws on malformed input. */
export function deserializeClock(json: string): ClockState {
  const raw: unknown = JSON.parse(json);
  if (typeof raw !== "object" || raw === null || !Number.isInteger((raw as { tick?: unknown }).tick)) {
    throw new Error("Invalid clock state");
  }
  return { tick: (raw as { tick: number }).tick };
}
