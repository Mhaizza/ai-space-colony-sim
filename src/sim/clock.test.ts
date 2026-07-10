import { describe, expect, it } from "vitest";
import { advanceClock, createClock, setSpeed } from "./clock.js";

describe("clock", () => {
  it("advances by the step size at 1x", () => {
    const clock = createClock();
    const elapsed = advanceClock(clock, 10);
    expect(elapsed).toBe(10);
    expect(clock.time).toBe(10);
  });

  it("scales elapsed time uniformly with speed", () => {
    const clock = createClock();
    setSpeed(clock, "4x");
    const elapsed = advanceClock(clock, 10);
    expect(elapsed).toBe(40);
  });

  it("does not advance while paused", () => {
    const clock = createClock();
    setSpeed(clock, "paused");
    const elapsed = advanceClock(clock, 100);
    expect(elapsed).toBe(0);
    expect(clock.time).toBe(0);
  });
});
