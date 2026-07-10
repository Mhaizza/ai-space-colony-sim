// M1 — Simulation Clock. A reference, never a scheduler. [ADR-02, ADR-06]

import type { SimDuration, SimTime } from "./types.js";

export type Speed = "paused" | "1x" | "2x" | "4x";

const SPEED_MULTIPLIER: Readonly<Record<Speed, number>> = {
  paused: 0,
  "1x": 1,
  "2x": 2,
  "4x": 4,
};

export interface Clock {
  time: SimTime;
  speed: Speed;
}

export function createClock(startTime: SimTime = 0): Clock {
  return { time: startTime, speed: "1x" };
}

/**
 * Advances the clock by `stepSeconds` of real-time-equivalent step, scaled by
 * speed. Returns the elapsed in-game duration for this step — the only thing
 * the clock ever produces. It never fires events. [ADR-02]
 */
export function advanceClock(clock: Clock, stepSeconds: SimDuration): SimDuration {
  const elapsed = stepSeconds * SPEED_MULTIPLIER[clock.speed];
  clock.time += elapsed;
  return elapsed;
}

export function setSpeed(clock: Clock, speed: Speed): void {
  clock.speed = speed;
}
