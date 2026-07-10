// Build Step 9 — core/serialization.ts tests: complete-state round-trip, deterministic replay
// continuation after save/load (including mid-execution and suspended-pair scenarios), version
// rejection, malformed-input rejection, purity.
//
// Step 9 review pass — deep TickEvent/DecisionOutcome payload validation, log seq/tick
// invariants: these tests deliberately corrupt a *valid* saved object's nested payload (not
// just top-level fields), reusing a real run's output so the fixtures reflect actual shapes.

import { describe, expect, it } from "vitest";
import { createInitialState, run } from "../simulation/run.js";
import { tick, type SimulationState } from "../simulation/tick.js";
import { BASE_TICKS_PER_STEP } from "../config/constants.js";
import { setModuleFunctional } from "../world/world.js";
import { suspendGoal, type Goal } from "../decision/goals.js";
import type { Execution } from "../task/execution.js";
import { deserialize, SAVE_FORMAT_VERSION, serialize } from "./serialization.js";

/**
 * A real, valid saved object (parsed) — a run long enough to guarantee at least one decision
 * AND at least one needThresholdCrossing (hunger crosses its low threshold ~tick 545 at its
 * decayPerTick, uninterrupted — see config/tuning.ts).
 */
function validSaved(): any {
  const state = run(createInitialState(1, "c1", "Maya", ["engineering"], ["driven"]), 700).finalState;
  expect(state.decisionLog.length).toBeGreaterThan(0); // sanity: fixture actually has a decision to corrupt
  return JSON.parse(serialize(state));
}

describe("complete state round-trip", () => {
  it("deserialize(serialize(state)) reproduces the state exactly", () => {
    const state = run(createInitialState(1, "c1", "Maya", ["engineering"], ["driven"]), 200).finalState;
    const roundTripped = deserialize(serialize(state));
    expect(roundTripped).toEqual(state);
  });

  it("round-trips an untouched initial state (empty logs, no execution)", () => {
    const state = createInitialState(7, "c1", "Maya");
    expect(deserialize(serialize(state))).toEqual(state);
  });
});

describe("deterministic replay after save/load", () => {
  it("save mid-execution and continue identically to an uninterrupted run", () => {
    const initial = createInitialState(42, "c1", "Maya", ["engineering"]);
    const midpoint = run(initial, 100).finalState;
    expect(midpoint.execution).not.toBeNull(); // sanity: something is actually in progress by tick 100

    const reloaded = deserialize(serialize(midpoint));
    const continuedFromReload = run(reloaded, 100);
    const continuedLive = run(midpoint, 100);

    expect(continuedFromReload.finalState).toEqual(continuedLive.finalState);
    expect(continuedFromReload.events).toEqual(continuedLive.events);
  });

  it("PRNG sequence continues identically after load", () => {
    const midpoint = run(createInitialState(9, "c1", "Maya"), 60).finalState;
    const reloaded = deserialize(serialize(midpoint));
    expect(reloaded.prng).toEqual(midpoint.prng);

    const afterReload = tick(reloaded, BASE_TICKS_PER_STEP);
    const afterLive = tick(midpoint, BASE_TICKS_PER_STEP);
    expect(afterReload.state.prng).toEqual(afterLive.state.prng);
  });

  it("save with suspended goal/execution and continue identically", () => {
    const base = createInitialState(5, "c1", "Maya");
    const suspendedGoal: Goal = suspendGoal({
      source: "shiftAssignment",
      tier: 3,
      key: "shiftAssignment:work",
      status: "active",
      motivation: "test fixture",
      adoptedAtTick: 0,
    });
    const suspendedExecution: Execution = {
      taskId: "workAtWorkstation",
      goalKey: "shiftAssignment:work",
      status: "interrupted",
      startedAtTick: 0,
      elapsedTicks: 5,
    };
    const withSuspension: SimulationState = {
      ...base,
      colonist: { ...base.colonist, suspendedGoal },
      suspendedExecution,
    };

    const reloaded = deserialize(serialize(withSuspension));
    expect(reloaded).toEqual(withSuspension);

    const continuedFromReload = run(reloaded, 10);
    const continuedLive = run(withSuspension, 10);
    expect(continuedFromReload.finalState).toEqual(continuedLive.finalState);
    expect(continuedFromReload.events).toEqual(continuedLive.events);
  });

  it("records remain append-only after load — the reloaded log has exactly the saved entries, and appending continues from there", () => {
    const midpoint = run(createInitialState(3, "c1", "Maya"), 30).finalState;
    const reloaded = deserialize(serialize(midpoint));
    expect(reloaded.eventLog).toEqual(midpoint.eventLog);
    expect(reloaded.decisionLog).toEqual(midpoint.decisionLog);

    const next = tick(reloaded, BASE_TICKS_PER_STEP);
    expect(next.state.eventLog.length).toBeGreaterThan(reloaded.eventLog.length);
    expect(next.state.eventLog.slice(0, reloaded.eventLog.length)).toEqual(reloaded.eventLog);
  });
});

describe("unsupported version rejection", () => {
  it("rejects a version other than the current SAVE_FORMAT_VERSION", () => {
    const state = createInitialState(1, "c1", "Maya");
    const saved = JSON.parse(serialize(state)) as Record<string, unknown>;
    saved.version = SAVE_FORMAT_VERSION + 1;
    expect(() => deserialize(JSON.stringify(saved))).toThrow(/Unsupported save format version/);
  });

  it("rejects a missing version field", () => {
    const state = createInitialState(1, "c1", "Maya");
    const saved = JSON.parse(serialize(state)) as Record<string, unknown>;
    delete saved.version;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });
});

describe("malformed-state rejection", () => {
  it("rejects invalid JSON outright", () => {
    expect(() => deserialize("{not valid json")).toThrow();
  });

  it("rejects a non-object top level", () => {
    expect(() => deserialize("42")).toThrow();
  });

  it("rejects a missing required field", () => {
    const state = createInitialState(1, "c1", "Maya");
    const saved = JSON.parse(serialize(state)) as Record<string, unknown>;
    delete saved.colonist;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a wrong-typed field rather than coercing it", () => {
    const state = createInitialState(1, "c1", "Maya");
    const saved = JSON.parse(serialize(state)) as Record<string, unknown>;
    saved.stressBaseline = "not a number";
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a malformed suspended-pair invariant (suspendedExecution without a suspendedGoal), never silently repairing it", () => {
    const state = createInitialState(1, "c1", "Maya");
    const saved = JSON.parse(serialize(state)) as { execution: unknown; suspendedExecution: unknown; colonist: { suspendedGoal: unknown } };
    saved.suspendedExecution = {
      taskId: "workAtWorkstation",
      goalKey: "shiftAssignment:work",
      status: "interrupted",
      startedAtTick: 0,
      elapsedTicks: 1,
    };
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects an unrecognized enum value instead of guessing", () => {
    const state = createInitialState(1, "c1", "Maya");
    const saved = JSON.parse(serialize(state)) as { world: { modules: Record<string, { functional: boolean }> } };
    (saved.world.modules as unknown as Record<string, unknown>).foodStation = { id: "foodStation", functional: "yes" };
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });
});

describe("deep TickEvent payload validation", () => {
  it("rejects an unknown TickEvent kind", () => {
    const saved = validSaved();
    saved.eventLog[0].event.kind = "somethingThatDoesNotExist";
    expect(() => deserialize(JSON.stringify(saved))).toThrow(/unrecognized value/);
  });

  it("rejects a known TickEvent kind with a missing required field", () => {
    const saved = validSaved();
    const idx = saved.eventLog.findIndex((r: any) => r.event.kind === "executionBegun");
    expect(idx).toBeGreaterThanOrEqual(0); // sanity: fixture actually reaches executionBegun
    delete saved.eventLog[idx].event.taskId;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a needThresholdCrossing with an out-of-set severity", () => {
    const saved = validSaved();
    const idx = saved.eventLog.findIndex((r: any) => r.event.kind === "needThresholdCrossing");
    expect(idx).toBeGreaterThanOrEqual(0);
    saved.eventLog[idx].event.severity = "extreme";
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a negative elapsedTicks on executionProgressed", () => {
    const saved = validSaved();
    const idx = saved.eventLog.findIndex((r: any) => r.event.kind === "executionProgressed");
    expect(idx).toBeGreaterThanOrEqual(0);
    saved.eventLog[idx].event.elapsedTicks = -1;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a non-integer elapsedTicks on executionProgressed", () => {
    const saved = validSaved();
    const idx = saved.eventLog.findIndex((r: any) => r.event.kind === "executionProgressed");
    expect(idx).toBeGreaterThanOrEqual(0);
    saved.eventLog[idx].event.elapsedTicks = 1.5;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });
});

describe("deep DecisionOutcome payload validation", () => {
  function firstDecisionEvent(saved: any): any {
    const record = saved.eventLog.find((r: any) => r.event.kind === "decision");
    expect(record).toBeDefined();
    return record.event;
  }

  it("rejects a malformed DecisionOutcome kind", () => {
    const saved = validSaved();
    firstDecisionEvent(saved).outcome.kind = "maybe";
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a decision outcome missing a required top-level field (goal)", () => {
    const saved = validSaved();
    const outcome = firstDecisionEvent(saved).outcome;
    expect(outcome.kind).toBe("commit"); // sanity: a "commit" outcome actually carries `goal`
    delete outcome.goal;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a missing weight-decomposition field (traitContributions) on a composed weight", () => {
    const saved = validSaved();
    const outcome = firstDecisionEvent(saved).outcome;
    expect(outcome.composedWeights.length).toBeGreaterThan(0);
    delete outcome.composedWeights[0].traitContributions;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a composed weight with an out-of-set source", () => {
    const saved = validSaved();
    const outcome = firstDecisionEvent(saved).outcome;
    outcome.composedWeights[0].source = "notASource";
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a non-finite numeric field encoded through constructed input (Infinity serializes to null via JSON)", () => {
    const saved = validSaved();
    const outcome = firstDecisionEvent(saved).outcome;
    // JSON has no literal for Infinity/NaN — JSON.stringify silently turns them into `null`.
    // Constructing the object with Infinity and round-tripping through JSON.stringify is the
    // realistic way such a value would ever reach deserialize(); it must still be rejected
    // (as a wrong-typed field), not silently accepted as some default.
    outcome.composedWeights[0].composed = JSON.parse(JSON.stringify(Infinity)); // -> null
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects PRNG draw attribution with a value outside the [0, 1) draw contract", () => {
    const saved = validSaved();
    const outcome = firstDecisionEvent(saved).outcome;
    if (outcome.draws.length === 0) return; // a single-candidate tier draws nothing — nothing to corrupt here
    outcome.draws[0].value = 1.5;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });

  it("rejects a malformed PRNG draw attribution state (reuses prng.ts's own validation)", () => {
    const saved = validSaved();
    const outcome = firstDecisionEvent(saved).outcome;
    if (outcome.draws.length === 0) return;
    delete outcome.draws[0].stateAfter.a;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });
});

describe("log seq/tick invariants", () => {
  it("rejects a duplicate sequence number", () => {
    const saved = validSaved();
    expect(saved.eventLog.length).toBeGreaterThan(1);
    saved.eventLog[1].seq = saved.eventLog[0].seq;
    expect(() => deserialize(JSON.stringify(saved))).toThrow(/seq/);
  });

  it("rejects an out-of-order (non-contiguous) sequence number", () => {
    const saved = validSaved();
    expect(saved.eventLog.length).toBeGreaterThan(2);
    saved.eventLog[2].seq = 99;
    expect(() => deserialize(JSON.stringify(saved))).toThrow(/seq/);
  });

  it("rejects a decreasing tick within a log", () => {
    const saved = validSaved();
    const idx = saved.eventLog.findIndex((r: any, i: number) => i > 0 && r.tick > saved.eventLog[i - 1].tick);
    expect(idx).toBeGreaterThan(0); // sanity: fixture actually advances tick somewhere
    saved.eventLog[idx].tick = saved.eventLog[idx - 1].tick - 1;
    expect(() => deserialize(JSON.stringify(saved))).toThrow(/tick/);
  });

  it("rejects a negative seq", () => {
    const saved = validSaved();
    saved.eventLog[0].seq = -1;
    expect(() => deserialize(JSON.stringify(saved))).toThrow();
  });
});

describe("valid logs still round-trip identically after the hardening pass", () => {
  it("a run containing decisions, executions, and memory formation serializes and deserializes identically", () => {
    const state = run(createInitialState(1, "c1", "Maya", ["engineering"], ["driven"]), 100).finalState;
    expect(state.eventLog.some((r) => r.event.kind === "decision")).toBe(true);
    expect(state.decisionLog.length).toBeGreaterThan(0);
    expect(deserialize(serialize(state))).toEqual(state);
  });

  it("deterministic continuation remains unchanged after the hardening pass", () => {
    const midpoint = run(createInitialState(1, "c1", "Maya", ["engineering"], ["driven"]), 100).finalState;
    const reloaded = deserialize(serialize(midpoint));
    const continuedFromReload = run(reloaded, 50);
    const continuedLive = run(midpoint, 50);
    expect(continuedFromReload.finalState).toEqual(continuedLive.finalState);
    expect(continuedFromReload.events).toEqual(continuedLive.events);
  });
});

describe("purity", () => {
  it("serialize does not mutate the state passed in", () => {
    const state = run(createInitialState(1, "c1", "Maya"), 50).finalState;
    const snapshot = JSON.parse(JSON.stringify(state));
    serialize(state);
    expect(state).toEqual(snapshot);
  });

  it("deserialize is a pure function of its string input — repeated calls yield equal (but distinct) objects", () => {
    const state = createInitialState(1, "c1", "Maya");
    const json = serialize(state);
    const a = deserialize(json);
    const b = deserialize(json);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("using a scenario originating from setModuleFunctional (world mutation helper) still round-trips purely", () => {
    const state = createInitialState(1, "c1", "Maya");
    const broken = { ...state, world: setModuleFunctional(state.world, "foodStation", false) };
    const roundTripped = deserialize(serialize(broken));
    expect(roundTripped).toEqual(broken);
  });
});
