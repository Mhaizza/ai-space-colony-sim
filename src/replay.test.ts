// Replay determinism harness (EQ-8) — the standing determinism test.
// State + seed -> identical behavior, indefinitely. Two runs from the same
// initial state and seed must produce identical event and decision logs.
// [engineering-specification.md §8 obligation 1, §9]

import { describe, expect, it } from "vitest";
import { createStage1Session, step } from "./sim/loop.js";
import { setSurvivalCondition } from "./sim/world.js";

function runScenario(seed: number) {
  const session = createStage1Session(seed, ["driven", "wary"]);
  for (let i = 0; i < 500; i++) {
    if (i === 120) setSurvivalCondition(session.world, "oxygen-failure", true);
    if (i === 140) setSurvivalCondition(session.world, "oxygen-failure", false);
    step(session, 15);
  }
  return session;
}

describe("replay determinism (EQ-8)", () => {
  it("produces bit-identical event and decision logs from the same seed", () => {
    const a = runScenario(7);
    const b = runScenario(7);

    expect(a.events.events).toEqual(b.events.events);
    expect(a.events.decisions).toEqual(b.events.decisions);
    expect(a.colonist.needs).toEqual(b.colonist.needs);
    expect(a.colonist.stress).toEqual(b.colonist.stress);
    expect(a.colonist.goalStack).toEqual(b.colonist.goalStack);
    expect(a.prng.state).toBe(b.prng.state);
  });

  it("diverges when the seed differs (sanity check that the test is not vacuous)", () => {
    const a = runScenario(7);
    const c = runScenario(8);
    const same = JSON.stringify(a.events.decisions) === JSON.stringify(c.events.decisions);
    // Not a strict requirement that every seed diverges, but across 500 steps
    // with stochastic tier 4/5 selection, identical decision logs from
    // different seeds would indicate the PRNG isn't actually wired in.
    expect(same).toBe(false);
  });
});
