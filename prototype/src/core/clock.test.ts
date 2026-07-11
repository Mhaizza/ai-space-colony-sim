// M1 Clock fixed-step and serialization tests (validation plan: foundations step).

import { describe, expect, it } from "vitest";
import {
  advance,
  createClock,
  dayOf,
  deserializeClock,
  elapsedSince,
  serializeClock,
  tickOfDay,
  ticksForStep,
} from "./clock.js";
import { BASE_TICKS_PER_STEP, TICKS_PER_DAY } from "../config/constants.js";

describe("clock fixed-step behavior (M1; determinism §8.3)", () => {
  it("starts at tick 0, Day 1", () => {
    const c = createClock();
    expect(c.tick).toBe(0);
    expect(dayOf(c)).toBe(1);
    expect(tickOfDay(c)).toBe(0);
  });

  it("advances by whole ticks only", () => {
    const c = advance(createClock(), 5);
    expect(c.tick).toBe(5);
    expect(() => advance(c, 1.5)).toThrow();
    expect(() => advance(c, -1)).toThrow();
  });

  it("is pure: advancing does not mutate the input state", () => {
    const c = createClock();
    advance(c, 10);
    expect(c.tick).toBe(0);
  });

  it("computes day and tick-of-day across day boundaries", () => {
    const c = advance(createClock(), TICKS_PER_DAY * 2 + 3);
    expect(dayOf(c)).toBe(3);
    expect(tickOfDay(c)).toBe(3);
  });

  it("measures elapsed durations (ADR-02: durations, never clock-value triggers)", () => {
    const c = advance(createClock(), 100);
    expect(elapsedSince(c, 40)).toBe(60);
  });
});

describe("speed scaling (ADR-06; speed invariance is structural)", () => {
  it("pause advances zero ticks", () => {
    expect(ticksForStep(0)).toBe(0);
  });

  it("speed multiplies ticks per step uniformly", () => {
    expect(ticksForStep(1)).toBe(BASE_TICKS_PER_STEP);
    expect(ticksForStep(2)).toBe(BASE_TICKS_PER_STEP * 2);
    expect(ticksForStep(4)).toBe(BASE_TICKS_PER_STEP * 4);
  });

  it("reaches the same in-game timeline regardless of speed (fewer steps, same ticks)", () => {
    let at1x = createClock();
    for (let i = 0; i < 8; i++) at1x = advance(at1x, ticksForStep(1));
    let at4x = createClock();
    for (let i = 0; i < 2; i++) at4x = advance(at4x, ticksForStep(4));
    expect(at4x.tick).toBe(at1x.tick);
  });
});

describe("clock serialization round-trip (spec §7)", () => {
  it("round-trips exactly", () => {
    const c = advance(createClock(), 987654);
    expect(deserializeClock(serializeClock(c))).toEqual(c);
  });

  it("rejects malformed saves", () => {
    expect(() => deserializeClock("{}")).toThrow();
    expect(() => deserializeClock('{"tick": 1.5}')).toThrow();
    expect(() => deserializeClock("null")).toThrow();
  });

  it("REGRESSION (Copilot-confirmed): rejects a negative tick — simulation time starts at zero and never goes below it", () => {
    expect(() => deserializeClock('{"tick": -1}')).toThrow();
    expect(() => deserializeClock('{"tick": -500}')).toThrow();
    expect(deserializeClock('{"tick": 0}')).toEqual({ tick: 0 }); // the boundary itself stays valid
  });
});
