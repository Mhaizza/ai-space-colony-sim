// Build Step 9 — records/logs.ts tests: append-only event/decision logs, retained decomposition
// and PRNG draw attribution, deterministic trace reconstruction, purity.

import { describe, expect, it } from "vitest";
import type { AttributedDraw, DecisionOutcome } from "../decision/decide.js";
import type { ComposedWeight } from "../decision/weights.js";
import type { Goal } from "../decision/goals.js";
import type { TickEvent } from "../simulation/tick.js";
import {
  appendDecision,
  appendDecisionsFromEvents,
  appendEvent,
  appendEvents,
  createDecisionLog,
  createEventLog,
  reconstructTrace,
} from "./logs.js";

const draw: AttributedDraw = {
  purpose: "candidateSelection:tier4",
  value: 0.42,
  stateBefore: { a: 1, draws: 0 },
  stateAfter: { a: 2, draws: 1 },
};

const composed: ComposedWeight = {
  key: "lowNeed:hunger",
  source: "lowNeed",
  tier: 4,
  base: 1.5,
  traits: 1.1,
  memory: 1.2,
  stress: 1,
  relationships: 1,
  composed: 1.98,
  traitContributions: [{ traitId: "driven", tilt: 1.1 }],
  memoryContributions: [{ memoryId: 0, influence: 0.3 }],
  stressContributions: [],
};

const goal: Goal = {
  source: "lowNeed",
  tier: 4,
  key: "lowNeed:hunger",
  relatedNeed: "hunger",
  status: "active",
  motivation: "test fixture",
  adoptedAtTick: 10,
};

const commitOutcome: DecisionOutcome = {
  kind: "commit",
  goal,
  winningTier: 4,
  composedWeights: [composed],
  draws: [draw],
  prngState: { a: 2, draws: 1 },
};

const bootstrapEvent: TickEvent = { kind: "bootstrap" };
const decisionEvent: TickEvent = { kind: "decision", outcome: commitOutcome };

describe("event log", () => {
  it("starts empty", () => {
    expect(createEventLog()).toEqual([]);
  });

  it("appending preserves prior records and adds the new one with an incrementing seq", () => {
    let log = createEventLog();
    log = appendEvent(log, 1, bootstrapEvent);
    log = appendEvent(log, 2, decisionEvent);
    expect(log).toEqual([
      { seq: 0, tick: 1, event: bootstrapEvent },
      { seq: 1, tick: 2, event: decisionEvent },
    ]);
  });

  it("appendEvents appends every event in order under the same tick", () => {
    const log = appendEvents(createEventLog(), 5, [bootstrapEvent, decisionEvent]);
    expect(log.map((r) => r.seq)).toEqual([0, 1]);
    expect(log.every((r) => r.tick === 5)).toBe(true);
  });

  it("does not mutate the input log (purity/immutability)", () => {
    const log = createEventLog();
    const appended = appendEvent(log, 1, bootstrapEvent);
    expect(log).toEqual([]);
    expect(appended).not.toBe(log);
    expect(Object.isFrozen(appended)).toBe(false); // readonly by type, not runtime-frozen — still never mutated by this module
  });
});

describe("decision log — distinct from the event log", () => {
  it("starts empty", () => {
    expect(createDecisionLog()).toEqual([]);
  });

  it("appending preserves prior records", () => {
    let log = createDecisionLog();
    log = appendDecision(log, 3, commitOutcome);
    const before = log;
    log = appendDecision(log, 4, commitOutcome);
    expect(log[0]).toEqual(before[0]);
    expect(log.length).toBe(2);
  });

  it("retains the full ComposedWeight decomposition, unmodified", () => {
    const log = appendDecision(createDecisionLog(), 1, commitOutcome);
    expect(log[0]!.outcome.kind).toBe("commit");
    if (log[0]!.outcome.kind === "commit") {
      expect(log[0]!.outcome.composedWeights).toEqual([composed]);
      expect(log[0]!.outcome.composedWeights[0]!.traitContributions).toEqual(composed.traitContributions);
    }
  });

  it("retains PRNG draw attribution", () => {
    const log = appendDecision(createDecisionLog(), 1, commitOutcome);
    expect(log[0]!.outcome.draws).toEqual([draw]);
  });

  it("appendDecisionsFromEvents extracts only 'decision' events, leaving the event log's own record kind untouched", () => {
    const log = appendDecisionsFromEvents(createDecisionLog(), 7, [bootstrapEvent, decisionEvent]);
    expect(log).toHaveLength(1);
    expect(log[0]!.outcome).toEqual(commitOutcome);
  });

  it("is a no-op when no decision event is present", () => {
    const log = appendDecisionsFromEvents(createDecisionLog(), 7, [bootstrapEvent]);
    expect(log).toEqual([]);
  });
});

describe("event and decision records remain distinct", () => {
  it("a tick with a decision produces one event-log entry and one decision-log entry, independently retrievable", () => {
    const eventLog = appendEvents(createEventLog(), 9, [bootstrapEvent, decisionEvent]);
    const decisionLog = appendDecisionsFromEvents(createDecisionLog(), 9, [bootstrapEvent, decisionEvent]);
    expect(eventLog).toHaveLength(2);
    expect(decisionLog).toHaveLength(1);
  });
});

describe("reconstructTrace — deterministic record ordering", () => {
  it("orders entries by tick, then by each log's own append order", () => {
    const eventLog = appendEvents(createEventLog(), 1, [bootstrapEvent]);
    const decisionLog = appendDecisionsFromEvents(createDecisionLog(), 2, [decisionEvent]);
    const trace = reconstructTrace(eventLog, decisionLog);
    expect(trace.map((e) => e.tick)).toEqual([1, 2]);
    expect(trace[0]!.kind).toBe("event");
    expect(trace[1]!.kind).toBe("decision");
  });

  it("is pure and deterministic — identical logs reconstruct identically every call", () => {
    const eventLog = appendEvents(createEventLog(), 1, [bootstrapEvent, decisionEvent]);
    const decisionLog = appendDecisionsFromEvents(createDecisionLog(), 1, [decisionEvent]);
    expect(reconstructTrace(eventLog, decisionLog)).toEqual(reconstructTrace(eventLog, decisionLog));
  });

  it("empty logs reconstruct to an empty trace", () => {
    expect(reconstructTrace(createEventLog(), createDecisionLog())).toEqual([]);
  });
});
