// Run harness tests — initial state setup, stepped advancement, fixed-step enforcement,
// validation, purity.

import { describe, expect, it } from "vitest";
import { NEEDS } from "../config/constants.js";
import { setModuleFunctional } from "../world/world.js";
import { createInitialState, run } from "./run.js";

describe("createInitialState", () => {
  it("creates a fresh Stage 1 simulation with a satisfied colonist and no execution", () => {
    const state = createInitialState(42, "c1", "Maya", ["engineering"], ["driven"]);
    expect(state.clock.tick).toBe(0);
    expect(state.execution).toBeNull();
    expect(state.suspendedExecution).toBeNull();
    expect(state.colonist.currentGoal).toBeNull();
    expect(state.colonist.suspendedGoal).toBeNull();
    expect(state.colonist.identity.skills).toEqual(["engineering"]);
    expect(state.colonist.identity.baseTraits).toEqual(["driven"]);
    for (const id of NEEDS) {
      expect(state.colonist.needs[id].level).toBe(1);
    }
  });

  it("different seeds produce different PRNG states", () => {
    const a = createInitialState(1, "c1", "Maya");
    const b = createInitialState(2, "c1", "Maya");
    expect(a.prng).not.toEqual(b.prng);
  });

  it("defaults to an empty roster (Stage 2 Slice 2) — unchanged Stage 1 behavior", () => {
    const state = createInitialState(1, "c1", "Maya");
    expect(state.roster).toEqual([]);
  });

  it("accepts an optional roster of other colonists", () => {
    const roster = [{ id: "zeke", name: "Zeke", skills: [], baseTraits: [] as const }];
    const state = createInitialState(1, "c1", "Maya", [], [], roster);
    expect(state.roster).toEqual(roster);
  });

  it("rejects roster ids that would make the initial state invalid", () => {
    expect(() => createInitialState(1, "c1", "Maya", [], [], [{ id: "c1", name: "Clone", skills: [], baseTraits: [] }])).toThrow(
      /duplicates the primary/i,
    );
    expect(() =>
      createInitialState(1, "c1", "Maya", [], [], [{ id: "__proto__", name: "Prototype", skills: [], baseTraits: [] }]),
    ).toThrow(/unsafe/i);
  });
});

describe("run — advances by calling tick() once per BASE_TICKS_PER_STEP (review fix 2)", () => {
  it("advances the clock by exactly totalTicks", () => {
    const initial = createInitialState(1, "c1", "Maya");
    const result = run(initial, 500);
    expect(result.finalState.clock.tick).toBe(500);
  });

  it("produces one tick's worth of events per step — the event trace grows with totalTicks", () => {
    const shortRun = run(createInitialState(1, "c1", "Maya"), 5);
    const longerRun = run(createInitialState(1, "c1", "Maya"), 50);
    // A longer run observes at least as much (bootstrap + ongoing progress events accumulate).
    expect(longerRun.events.length).toBeGreaterThanOrEqual(shortRun.events.length);
  });

  it("produces a non-empty event trace over a real run", () => {
    const initial = createInitialState(1, "c1", "Maya");
    const result = run(initial, 50);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.some((e) => e.kind === "bootstrap")).toBe(true);
  });

  it("rejects invalid totalTicks", () => {
    const initial = createInitialState(1, "c1", "Maya");
    expect(() => run(initial, -1)).toThrow();
    expect(() => run(initial, 1.5)).toThrow();
  });

  it("zero totalTicks returns the initial state unchanged with no events", () => {
    const initial = createInitialState(1, "c1", "Maya");
    const result = run(initial, 0);
    expect(result.finalState).toEqual(initial);
    expect(result.events).toEqual([]);
  });

  it("no longer accepts a stepTicks override — run() always steps by BASE_TICKS_PER_STEP internally", () => {
    // Type-level guarantee: run()'s signature is (initial, totalTicks) only. This test
    // documents the removal; a caller that used to pass a third argument now gets a
    // TypeScript error at the call site, not a silently-ignored parameter.
    const initial = createInitialState(1, "c1", "Maya");
    const result = run(initial, 10);
    expect(result.finalState.clock.tick).toBe(10);
  });
});

describe("determinism", () => {
  it("identical seed and tick count reproduce an identical run", () => {
    const a = run(createInitialState(123, "c1", "Maya"), 300);
    const b = run(createInitialState(123, "c1", "Maya"), 300);
    expect(a).toEqual(b);
  });
});

describe("M9 memory formation actually wired into the tick pipeline", () => {
  it("forms a Deprivation memory once hunger sustains a significant drop below its high-water mark", () => {
    const initial = createInitialState(1, "c1", "Maya");
    // Food station broken: hunger decays past its satisfaction point and keeps falling, with
    // no restoration to reset the deprivation baseline — a real run's version of "sustained
    // deprivation" (see memory.ts's significance threshold).
    const broken = { ...initial, world: setModuleFunctional(initial.world, "foodStation", false) };
    const result = run(broken, 1000);
    expect(result.events.some((e) => e.kind === "memoryFormed" && e.memoryType === "deprivation")).toBe(true);
    expect(
      result.finalState.colonist.memory.some((m) => m.type === "deprivation" && m.context.needId === "hunger"),
    ).toBe(true);
  });
});

describe("purity", () => {
  it("does not mutate the initial state passed in", () => {
    const initial = createInitialState(1, "c1", "Maya");
    const snapshot = JSON.parse(JSON.stringify(initial));
    run(initial, 100);
    expect(initial).toEqual(snapshot);
  });
});
