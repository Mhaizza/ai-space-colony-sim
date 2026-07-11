// Build Step 10 — inspector tests: read-only summaries, suspended-pair visibility,
// completed/blocked transition visibility through records, recent-record limits and
// stable ordering, input immutability.

import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY } from "../config/constants.js";
import { createInitialState, run } from "../simulation/run.js";
import type { SimulationState } from "../simulation/tick.js";
import { setModuleFunctional } from "../world/world.js";
import { suspendGoal, type Goal } from "../decision/goals.js";
import type { Execution } from "../task/execution.js";
import { inspect, recentDecisions, recentEvents, summarizeReplay } from "./inspector.js";
import { verifyReplay } from "../replay/replay.js";

describe("active execution summary", () => {
  it("surfaces the running execution, current goal, needs, stress, and PRNG state as direct reads", () => {
    const state = run(createInitialState(42, "c1", "Maya", ["engineering"]), 100).finalState;
    expect(state.execution).not.toBeNull(); // sanity: fixture actually has a running execution

    const summary = inspect(state);
    expect(summary.tick).toBe(100);
    expect(summary.day).toBe(1);
    expect(summary.period).toBe("work");
    expect(summary.colonist).toEqual(state.colonist.identity);
    expect(summary.execution).toEqual(state.execution);
    expect(summary.currentGoal).toEqual(state.colonist.currentGoal);
    expect(summary.stress).toBe(state.colonist.stress.level);
    expect(summary.ambientState).toBe("working"); // fixture is mid-shift, not stressed
    expect(summary.prng).toEqual(state.prng);
    expect(summary.foodStock).toBe(state.world.foodStock);
    for (const row of summary.needs) {
      expect(row.level).toBe(state.colonist.needs[row.id].level);
      expect(row.ticksBelowLow).toBe(state.colonist.needs[row.id].ticksBelowLow);
    }
  });
});

describe("suspended-pair summary", () => {
  it("surfaces the suspended goal and its interrupted execution together", () => {
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
    const state: SimulationState = {
      ...base,
      colonist: { ...base.colonist, suspendedGoal },
      suspendedExecution,
    };

    const summary = inspect(state);
    expect(summary.suspendedGoal).toEqual(suspendedGoal);
    expect(summary.suspendedExecution).toEqual(suspendedExecution);
    expect(summary.suspendedGoal!.status).toBe("suspended");
    expect(summary.suspendedExecution!.status).toBe("interrupted");
  });
});

describe("completed/blocked transition visibility through records", () => {
  it("a full-day run's records show completion transitions", () => {
    const state = run(createInitialState(1, "c1", "Maya", ["engineering"]), TICKS_PER_DAY).finalState;
    const all = recentEvents(state, state.eventLog.length);
    expect(all.some((r) => r.event.kind === "completion")).toBe(true);
  });

  it("a broken-module run's records show the blocked resolution", () => {
    const initial = createInitialState(1, "c1", "Maya");
    const broken = { ...initial, world: setModuleFunctional(initial.world, "foodStation", false) };
    const state = run(broken, 1000).finalState;
    const all = recentEvents(state, state.eventLog.length);
    expect(all.some((r) => r.event.kind === "taskResolution" && r.event.resolution.kind === "blocked")).toBe(true);
  });
});

describe("recent-record limits and stable ordering", () => {
  it("returns exactly the last N records in original append order", () => {
    const state = run(createInitialState(1, "c1", "Maya"), 300).finalState;
    expect(state.eventLog.length).toBeGreaterThan(5);
    expect(recentEvents(state, 5)).toEqual(state.eventLog.slice(-5));
    expect(recentDecisions(state, 2)).toEqual(state.decisionLog.slice(-2));
  });

  it("a limit larger than the log returns the whole log, unchanged", () => {
    const state = run(createInitialState(1, "c1", "Maya"), 100).finalState;
    expect(recentEvents(state, state.eventLog.length + 100)).toEqual(state.eventLog);
  });

  it("a limit of zero returns an empty slice; invalid limits are rejected", () => {
    const state = run(createInitialState(1, "c1", "Maya"), 10).finalState;
    expect(recentEvents(state, 0)).toEqual([]);
    expect(recentDecisions(state, 0)).toEqual([]);
    expect(() => recentEvents(state, -1)).toThrow();
    expect(() => recentEvents(state, 1.5)).toThrow();
    expect(() => inspect(state, -1)).toThrow();
  });

  it("inspect bounds its recent slices by recentLimit", () => {
    const state = run(createInitialState(1, "c1", "Maya"), 300).finalState;
    const summary = inspect(state, 3);
    expect(summary.recentEvents).toEqual(state.eventLog.slice(-3));
    expect(summary.recentDecisions.length).toBeLessThanOrEqual(3);
  });
});

describe("input immutability", () => {
  it("inspect never mutates the state it reads", () => {
    const state = run(createInitialState(1, "c1", "Maya", ["engineering"]), 200).finalState;
    const snapshot = JSON.parse(JSON.stringify(state));
    inspect(state);
    recentEvents(state, 5);
    recentDecisions(state, 5);
    expect(state).toEqual(snapshot);
  });
});

describe("detached snapshots — mutating a result never aliases back into the state (final review fix)", () => {
  function activeState(): SimulationState {
    const state = run(createInitialState(42, "c1", "Maya", ["engineering"]), 100).finalState;
    expect(state.execution).not.toBeNull();
    expect(state.colonist.currentGoal).not.toBeNull();
    return state;
  }

  it("mutating the returned currentGoal does not alter state.colonist.currentGoal", () => {
    const state = activeState();
    const originalKey = state.colonist.currentGoal!.key;
    const summary = inspect(state);
    (summary.currentGoal as { key: string }).key = "tampered";
    expect(state.colonist.currentGoal!.key).toBe(originalKey);
  });

  it("mutating the returned execution does not alter state.execution", () => {
    const state = activeState();
    const originalElapsed = state.execution!.elapsedTicks;
    const summary = inspect(state);
    (summary.execution as { elapsedTicks: number }).elapsedTicks = 999999;
    expect(state.execution!.elapsedTicks).toBe(originalElapsed);
  });

  it("mutating the returned suspended goal/execution does not alter the state", () => {
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
    const state: SimulationState = { ...base, colonist: { ...base.colonist, suspendedGoal }, suspendedExecution };

    const summary = inspect(state);
    (summary.suspendedGoal as { key: string }).key = "tampered";
    (summary.suspendedExecution as { elapsedTicks: number }).elapsedTicks = 999999;
    expect(state.colonist.suspendedGoal!.key).toBe("shiftAssignment:work");
    expect(state.suspendedExecution!.elapsedTicks).toBe(5);
  });

  it("mutating the returned PRNG summary does not alter state.prng", () => {
    const state = activeState();
    const originalA = state.prng.a;
    const summary = inspect(state);
    (summary.prng as { a: number }).a = 0;
    expect(state.prng.a).toBe(originalA);
  });

  it("mutating returned recent record payloads does not alter the event/decision logs", () => {
    const state = run(createInitialState(1, "c1", "Maya"), 300).finalState;
    expect(state.decisionLog.length).toBeGreaterThan(0);
    const logSnapshot = JSON.parse(JSON.stringify({ events: state.eventLog, decisions: state.decisionLog }));

    const events = recentEvents(state, 5);
    (events[0]!.event as { kind: string }).kind = "tampered";
    const decisions = recentDecisions(state, 1);
    (decisions[0]!.outcome.prngState as { a: number }).a = 0;
    const summary = inspect(state);
    (summary.recentEvents[0]!.event as { kind: string }).kind = "alsoTampered";

    expect(state.eventLog).toEqual(logSnapshot.events);
    expect(state.decisionLog).toEqual(logSnapshot.decisions);
  });

  it("inspect still does not mutate its input during the call, with identity fields detached too", () => {
    const state = activeState();
    const snapshot = JSON.parse(JSON.stringify(state));
    const summary = inspect(state);
    (summary.colonist.skills as string[]).push("tampered");
    expect(state).toEqual(snapshot);
  });
});

describe("replay verification summary", () => {
  it("formats a match result as a one-line summary", () => {
    const initial = createInitialState(1, "c1", "Maya");
    const final = run(initial, 50).finalState;
    const line = summarizeReplay(verifyReplay(initial, final));
    expect(line).toContain("match");
    expect(line).toContain(String(final.eventLog.length));
  });

  it("formats a divergence with its log, index, and record kind", () => {
    const final = run(createInitialState(1, "c1", "Maya"), 300).finalState;
    const otherSeedInitial = createInitialState(2, "c1", "Maya");
    const result = verifyReplay(otherSeedInitial, final);
    expect(result.kind).toBe("divergence");
    const line = summarizeReplay(result);
    expect(line).toContain("divergence");
    if (result.kind === "divergence") {
      expect(line).toContain(result.log);
      expect(line).toContain(String(result.index));
      expect(line).toContain(result.recordKind);
    }
  });
});
