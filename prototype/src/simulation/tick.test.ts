// Tick assembly tests — end-to-end tick, replay determinism, interruption/resume with
// preserved progress, completion, re-decision triggers, fixed-step enforcement, stable
// replay logs, purity.

// @ts-expect-error — no @types/node in this zero-runtime-dependency prototype (Stage 1 plan);
// Node/Vitest resolve this builtin at runtime regardless of the missing type declarations.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, createClock } from "../core/clock.js";
import { createPrng } from "../core/prng.js";
import { deserialize, serialize } from "../core/serialization.js";
import { createDefaultPolicy } from "../world/policy.js";
import { createWorld, setModuleFunctional } from "../world/world.js";
import { createColonist, withCurrentGoal, withNeeds, withSuspendedGoal } from "../colonist/colonist.js";
import { createNeeds } from "../colonist/needs.js";
import { createFreshMemoryBaselines, tick, validateSimulationState, type SimulationState } from "./tick.js";
import { run } from "./run.js";
import { verifyReplay } from "../replay/replay.js";
import { commitGoal, suspendGoal } from "../decision/goals.js";
import { beginExecution, interruptExecution } from "../task/execution.js";
import { taskDefinition } from "../task/tasks.js";
import { createDecisionLog, createEventLog } from "../records/logs.js";
import { applyInteraction, createRelationshipStore, perspective } from "../colonist/relationships.js";

const policy = createDefaultPolicy();

function stateAtTickOfDay(
  tickOfDay: number,
  needsOverride: Partial<Record<string, { level: number; ticksBelowLow: number }>> = {},
  seed = 1,
): SimulationState {
  const colonist = withNeeds(createColonist("c1", "Maya"), { ...createNeeds(), ...needsOverride } as ReturnType<typeof createNeeds>);
  return {
    clock: advance(createClock(), tickOfDay),
    world: createWorld(),
    policy,
    colonist,
    execution: null,
    suspendedExecution: null,
    prng: createPrng(seed),
    ...createFreshMemoryBaselines(),
    hasBootstrapped: false, // a freshly-built colonist with no goal/execution — genuinely never decided
    eventLog: createEventLog(),
    decisionLog: createDecisionLog(),
    relationships: createRelationshipStore(),
    roster: [],
  };
}

const zeke = { id: "zeke", name: "Zeke", skills: [], baseTraits: [] } as const;

function socialExecutionState(taskId: "conversation" | "sharedDowntime", relatedColonistId: string | null = "zeke"): SimulationState {
  const freeStart = policy.workTicks + policy.restTicks;
  const base = stateAtTickOfDay(
    freeStart,
    {
      social: { level: 0.45, ticksBelowLow: 0 },
      purpose: { level: 0.5, ticksBelowLow: 0 },
    },
    11,
  );
  const goal = commitGoal(
    {
      source: "voluntary",
      tier: 5,
      key: relatedColonistId === null ? "voluntary:solo" : `voluntary:social:${relatedColonistId}`,
      baseUrgency: 0.2,
      relatedColonistId: relatedColonistId ?? undefined,
    },
    "test social motivation",
    base.clock.tick,
  );
  return {
    ...base,
    colonist: withCurrentGoal(base.colonist, goal),
    execution: beginExecution(taskDefinition(taskId), goal, base.clock.tick),
    hasBootstrapped: true,
    roster: [zeke],
  };
}

describe("fixed-step enforcement (review fix 2)", () => {
  it("rejects a delta larger than BASE_TICKS_PER_STEP", () => {
    const state = stateAtTickOfDay(0);
    expect(() => tick(state, 2)).toThrow();
  });

  it("rejects a delta smaller than BASE_TICKS_PER_STEP (0)", () => {
    const state = stateAtTickOfDay(0);
    expect(() => tick(state, 0)).toThrow();
  });

  it("accepts exactly BASE_TICKS_PER_STEP", () => {
    const state = stateAtTickOfDay(0);
    expect(() => tick(state, 1)).not.toThrow();
  });
});

describe("full end-to-end tick", () => {
  it("bootstraps: adopts a goal, resolves a task, begins execution in a single tick", () => {
    const state = stateAtTickOfDay(0); // work period start, all needs satisfied
    const result = tick(state, 1);
    expect(result.events.some((e) => e.kind === "bootstrap")).toBe(true);
    expect(result.events.some((e) => e.kind === "decision")).toBe(true);
    expect(result.events.some((e) => e.kind === "taskResolution")).toBe(true);
    expect(result.events.some((e) => e.kind === "executionBegun")).toBe(true);
    expect(result.state.colonist.currentGoal).not.toBeNull();
    expect(result.state.execution).not.toBeNull();
    expect(result.state.execution!.status).toBe("inProgress");
  });

  it("during work with all needs satisfied, adopts the shift-assignment goal", () => {
    const result = tick(stateAtTickOfDay(0), 1);
    expect(result.state.colonist.currentGoal?.source).toBe("shiftAssignment");
    expect(result.state.execution?.taskId).toBe("workAtWorkstation");
  });

  it("advances the clock by exactly BASE_TICKS_PER_STEP per call", () => {
    const state = stateAtTickOfDay(0);
    const result = tick(state, 1);
    expect(result.state.clock.tick).toBe(state.clock.tick + 1);
  });

  it("advancing multiple ticks via run() reaches the expected clock value", () => {
    const initial = stateAtTickOfDay(0);
    const result = run(initial, 5);
    expect(result.finalState.clock.tick).toBe(5);
  });
});

describe("companionship execution effects (Stage 2 Slice 3 Build Step 3)", () => {
  it("conversation restores Social need while executing", () => {
    const initial = socialExecutionState("conversation");
    const final = run(initial, 20).finalState;

    expect(final.colonist.needs.social.level).toBeGreaterThan(initial.colonist.needs.social.level);
  });

  it("conversation materializes the relationship pair and applies a positive directional delta", () => {
    const final = run(socialExecutionState("conversation"), 20).finalState;

    expect(perspective(final.relationships, "c1", "zeke").affinity).toBeGreaterThan(0);
    expect(perspective(final.relationships, "zeke", "c1").affinity).toBeGreaterThan(0);
  });

  it("sharedDowntime applies positive relationship drift no stronger than conversation", () => {
    const conversation = run(socialExecutionState("conversation"), 20).finalState;
    const sharedDowntime = run(socialExecutionState("sharedDowntime"), 20).finalState;

    const conversationAffinity = perspective(conversation.relationships, "c1", "zeke").affinity;
    const sharedDowntimeAffinity = perspective(sharedDowntime.relationships, "c1", "zeke").affinity;
    expect(sharedDowntimeAffinity).toBeGreaterThan(0);
    expect(sharedDowntimeAffinity).toBeLessThanOrEqual(conversationAffinity);
  });

  it("social actions do not credit Purpose", () => {
    const initial = socialExecutionState("conversation");
    const final = run(initial, 20).finalState;

    expect(final.colonist.needs.purpose.level).toBeLessThanOrEqual(initial.colonist.needs.purpose.level);
  });

  it("social execution remains replay-deterministic", () => {
    const initial = socialExecutionState("conversation");
    const final = run(initial, 50).finalState;

    expect(verifyReplay(initial, final).kind).toBe("match");
  });

  it("save/load round-trip preserves companionship needs, relationships, and records", () => {
    const final = run(socialExecutionState("conversation"), 50).finalState;
    const reloaded = deserialize(serialize(final));

    expect(reloaded.colonist.needs.social).toEqual(final.colonist.needs.social);
    expect(reloaded.relationships).toEqual(final.relationships);
    expect(reloaded.eventLog).toEqual(final.eventLog);
    expect(reloaded.decisionLog).toEqual(final.decisionLog);
  });

  it("a companionship task without relatedColonistId fails safely with no social consequence", () => {
    const initial = socialExecutionState("conversation", null);
    const final = run(initial, 20).finalState;

    expect(final.relationships).toEqual(createRelationshipStore());
    expect(final.colonist.needs.social.level).toBeLessThan(initial.colonist.needs.social.level);
  });
});

describe("goal completion", () => {
  it("a satisfaction task completes when its need reaches the satisfaction point, then a fresh decision follows in the same tick", () => {
    // Rest period, rest need low but not critical — the only actionable candidate.
    const restStart = policy.workTicks;
    let state = stateAtTickOfDay(restStart, { rest: { level: 0.3, ticksBelowLow: 500 } });

    let sawCompletion = false;
    for (let i = 0; i < 300 && !sawCompletion; i++) {
      const result = tick(state, 1);
      state = result.state;
      if (result.events.some((e) => e.kind === "completion" && e.taskId === "restAtBunk")) {
        sawCompletion = true;
        expect(result.events.some((e) => e.kind === "decision")).toBe(true);
      }
    }
    expect(sawCompletion).toBe(true);
  });
});

describe("goal interruption and resume — preserved execution progress (review fix 1)", () => {
  function runUntilInterrupted(): { state: SimulationState; interruptedAtElapsedTicks: number; originalVoluntary: NonNullable<SimulationState["colonist"]["currentGoal"]> } {
    const freeStart = policy.workTicks + policy.restTicks;
    let state = stateAtTickOfDay(freeStart, { hunger: { level: 0.402, ticksBelowLow: 0 } });

    let result = tick(state, 1); // bootstrap: voluntary
    state = result.state;
    const originalVoluntary = state.colonist.currentGoal!;

    let interruptedAtElapsedTicks = -1;
    for (let i = 0; i < 50 && interruptedAtElapsedTicks < 0; i++) {
      result = tick(state, 1);
      state = result.state;
      if (result.events.some((e) => e.kind === "higherPriorityCondition")) {
        interruptedAtElapsedTicks = state.suspendedExecution!.elapsedTicks;
      }
    }
    return { state, interruptedAtElapsedTicks, originalVoluntary };
  }

  it("a higher-tier need crossing low interrupts a running voluntary goal, retaining goal AND execution as a pair", () => {
    const { state, originalVoluntary } = runUntilInterrupted();
    expect(state.colonist.suspendedGoal).not.toBeNull();
    expect(state.colonist.suspendedGoal!.key).toBe(originalVoluntary.key);
    expect(state.colonist.suspendedGoal!.status).toBe("suspended");
    expect(state.colonist.suspendedGoal!.motivation).toBe(originalVoluntary.motivation);
    expect(state.colonist.suspendedGoal!.adoptedAtTick).toBe(originalVoluntary.adoptedAtTick);
    expect(state.suspendedExecution).not.toBeNull();
    expect(state.suspendedExecution!.taskId).toBe("idlePresence");
    expect(state.suspendedExecution!.goalKey).toBe(originalVoluntary.key);
    expect(state.suspendedExecution!.status).toBe("interrupted");
    expect(state.colonist.currentGoal?.source).toBe("lowNeed");
    expect(state.colonist.currentGoal?.relatedNeed).toBe("hunger");
  });

  it("interrupted execution's elapsedTicks is nonzero and frozen while suspended", () => {
    const { state, interruptedAtElapsedTicks } = runUntilInterrupted();
    expect(interruptedAtElapsedTicks).toBeGreaterThan(0);
    expect(state.suspendedExecution!.elapsedTicks).toBe(interruptedAtElapsedTicks);
  });

  it("resuming preserves elapsedTicks exactly — the task never restarts from zero", () => {
    let { state, interruptedAtElapsedTicks, originalVoluntary } = runUntilInterrupted();

    let resumed = false;
    for (let i = 0; i < 400 && !resumed; i++) {
      const result = tick(state, 1);
      state = result.state;
      const resumeEvent = result.events.find((e) => e.kind === "executionResumed");
      if (resumeEvent && resumeEvent.kind === "executionResumed") {
        resumed = true;
        // The resumed execution's elapsedTicks is EXACTLY what it was at interruption —
        // nothing progressed while suspended, and it is not reset to 0.
        expect(resumeEvent.elapsedTicks).toBe(interruptedAtElapsedTicks);
        expect(resumeEvent.taskId).toBe("idlePresence");
        expect(state.execution!.elapsedTicks).toBe(interruptedAtElapsedTicks);
        expect(state.execution!.status).toBe("inProgress");
        // Goal identity fully preserved.
        expect(state.colonist.currentGoal?.key).toBe(originalVoluntary.key);
        expect(state.colonist.currentGoal?.motivation).toBe(originalVoluntary.motivation);
        expect(state.colonist.currentGoal?.adoptedAtTick).toBe(originalVoluntary.adoptedAtTick);
        expect(state.colonist.suspendedGoal).toBeNull();
        expect(state.suspendedExecution).toBeNull();
      }
    }
    expect(resumed).toBe(true);
  });

  it("an unavailable task at resume time reports blockage explicitly instead of silently restarting", () => {
    // Hand-construct the "about to resume" precondition directly — a hunger goal and its
    // eatAtFoodStation execution already suspended, mid-progress — rather than growing it
    // organically (idlePresence, Stage 1's only easily-interrupting scenario, has no module
    // requirement and can never itself become unavailable, so it cannot exercise this guard
    // through a purely organic run). This exercises resumeSuspended's blockage branch through
    // the public tick() API using the same hand-built-state technique Build Step 6 used to
    // reach the otherwise-unreachable tier-1 path.
    const restPeriodTick = policy.workTicks;

    // Build the pair the same way real orchestration would: adopt, begin, progress, then
    // interrupt/suspend — not fabricated in an order the real code path could never produce.
    const activeGoal = commitGoal(
      { source: "lowNeed", tier: 4, key: "lowNeed:hunger", baseUrgency: 0.4, relatedNeed: "hunger" },
      "original motivation",
      0,
    );
    const begun = beginExecution(taskDefinition("eatAtFoodStation"), activeGoal, 0);
    const progressed = { ...begun, elapsedTicks: 30 }; // nonzero, so a silent restart would be detectable
    const suspendedExecution = interruptExecution(progressed);
    const suspendedGoal = suspendGoal(activeGoal);

    const colonist = withSuspendedGoal(createColonist("c1", "Maya"), suspendedGoal); // all needs satisfied by default — nothing else competes
    const brokenWorld = setModuleFunctional(createWorld(), "foodStation", false);

    const state: SimulationState = {
      clock: advance(createClock(), restPeriodTick),
      world: brokenWorld,
      policy,
      colonist,
      execution: null,
      suspendedExecution,
      prng: createPrng(1),
      ...createFreshMemoryBaselines(),
      hasBootstrapped: true, // hand-built mid-run precondition — already has an active/suspended goal
      eventLog: createEventLog(),
      decisionLog: createDecisionLog(),
      relationships: createRelationshipStore(),
      roster: [],
    };

    const result = tick(state, 1);
    expect(result.events.some((e) => e.kind === "suspensionResolved")).toBe(true);
    expect(result.events.some((e) => e.kind === "blockage")).toBe(true);
    expect(result.events.some((e) => e.kind === "executionAborted")).toBe(true);
    expect(result.events.some((e) => e.kind === "executionResumed")).toBe(false); // never silently resumed
    expect(result.events.some((e) => e.kind === "executionBegun")).toBe(false); // never silently restarted fresh either
    expect(result.state.colonist.currentGoal?.status).toBe("blocked");
    expect(result.state.execution).toBeNull();
    expect(result.state.suspendedExecution).toBeNull();
  });
});

describe("suspension overflow — Goal and Execution handled consistently", () => {
  it("a second interruption while one is already suspended abandons the old goal AND aborts its execution, with one explanatory event", () => {
    // Hand-constructed precondition (same technique as the blockage-at-resume test above,
    // and Build Step 6's tier-1 tests): growing this organically is unreliable, because any
    // second need that spends time in the same low-not-critical tier band as the first
    // active goal competes with it via ordinary weighted selection rather than cleanly
    // outranking it — that is a separate, pre-existing property of same-tier candidates,
    // not something this fix touches, and not worth fighting to route around in a fixture.
    //
    // Precondition: voluntary (tier 5) already suspended with a mid-progress execution;
    // hunger (tier 4) active with its own mid-progress execution; rest is ALREADY critical
    // (tier 2) from the start of this tick, so the unconditional interruption check fires
    // immediately against the still-occupied suspended slot.
    const voluntaryGoal = suspendGoal(commitGoal({ source: "voluntary", tier: 5, key: "voluntary:idle", baseUrgency: 0.2 }, "m", 0));
    const voluntaryExecution = interruptExecution(
      { ...beginExecution(taskDefinition("idlePresence"), { ...voluntaryGoal, status: "active" }, 0), elapsedTicks: 12 },
    );

    const hungerGoal = commitGoal(
      { source: "lowNeed", tier: 4, key: "lowNeed:hunger", baseUrgency: 0.4, relatedNeed: "hunger" },
      "hunger motivation",
      5,
    );
    const hungerExecution = { ...beginExecution(taskDefinition("eatAtFoodStation"), hungerGoal, 5), elapsedTicks: 7 };

    let colonist = withCurrentGoal(withSuspendedGoal(createColonist("c1", "Maya"), voluntaryGoal), hungerGoal);
    colonist = withNeeds(colonist, {
      ...createNeeds(),
      // Hunger must be below its satisfaction point — otherwise eatAtFoodStation reads as
      // already complete (hunger defaults to fully satisfied) and the goal completes before
      // the interruption check ever runs, since completion changes its status away from
      // "active" first. Not low/critical, just unsatisfied, so it doesn't itself generate a
      // competing candidate.
      hunger: { level: 0.5, ticksBelowLow: 0 },
      rest: { level: 0.05, ticksBelowLow: 500 }, // already critical
    });

    const state: SimulationState = {
      clock: advance(createClock(), policy.workTicks + policy.restTicks),
      world: createWorld(),
      policy,
      colonist,
      execution: hungerExecution,
      suspendedExecution: voluntaryExecution,
      prng: createPrng(1),
      ...createFreshMemoryBaselines(),
      hasBootstrapped: true, // hand-built mid-run precondition — already has an active/suspended goal
      eventLog: createEventLog(),
      decisionLog: createDecisionLog(),
      relationships: createRelationshipStore(),
      roster: [],
    };

    const result = tick(state, 1);

    expect(result.events.some((e) => e.kind === "higherPriorityCondition")).toBe(true);
    const overflow = result.events.find((e) => e.kind === "suspensionOverflow");
    expect(overflow).toBeDefined();
    if (overflow && overflow.kind === "suspensionOverflow") {
      expect(overflow.abandonedGoalKey).toBe("voluntary:idle");
      expect(overflow.abandonedExecutionTaskId).toBe("idlePresence");
    }

    // The new suspended slot now holds the hunger goal (the one that was overflowed OUT of
    // being active, not abandoned — it is properly suspended, not discarded).
    expect(result.state.colonist.suspendedGoal?.key).toBe("lowNeed:hunger");
    expect(result.state.colonist.suspendedGoal?.status).toBe("suspended");
    expect(result.state.suspendedExecution?.taskId).toBe("eatAtFoodStation");
    // 7 (hand-set) + 1 (this tick's own progress phase, which runs before the interruption is
    // detected — execution always advances first) = 8. Preserved thereafter, not reset to 0.
    expect(result.state.suspendedExecution?.elapsedTicks).toBe(8);
    expect(result.state.suspendedExecution?.status).toBe("interrupted");

    // The current goal is now the critical rest goal.
    expect(result.state.colonist.currentGoal?.relatedNeed).toBe("rest");
    expect(result.state.colonist.currentGoal?.source).toBe("criticalNeed");
  });
});

describe("re-decision triggers", () => {
  it("needThresholdCrossing fires exactly when a need crosses its low threshold, not before or after", () => {
    // decayPerTick 0.0011: 0.4008 -> 0.3997 after one tick — clearly crosses 0.4, with margin
    // away from the exact boundary so float rounding can't make the test ambiguous.
    const state = stateAtTickOfDay(0, { hunger: { level: 0.4008, ticksBelowLow: 0 } });
    const result = tick(state, 1);
    expect(result.events.some((e) => e.kind === "needThresholdCrossing" && e.needId === "hunger" && e.severity === "low")).toBe(true);
  });

  it("shiftBoundary fires when the period changes across the tick", () => {
    const state = stateAtTickOfDay(policy.workTicks - 1); // one tick before rest begins
    const result = tick(state, 1);
    expect(result.events.some((e) => e.kind === "shiftBoundary" && e.from === "work" && e.to === "rest")).toBe(true);
  });

  it("does not fire shiftBoundary mid-period", () => {
    const state = stateAtTickOfDay(10);
    const result = tick(state, 1);
    expect(result.events.some((e) => e.kind === "shiftBoundary")).toBe(false);
  });

  it("blockage fires when the running task's module becomes unavailable mid-execution", () => {
    let state = stateAtTickOfDay(policy.workTicks, { hunger: { level: 0.3, ticksBelowLow: 500 } }); // rest period, hunger low
    let result = tick(state, 1); // adopts+begins eatAtFoodStation
    state = result.state;
    expect(state.execution?.taskId).toBe("eatAtFoodStation");

    const brokenWorld = setModuleFunctional(state.world, "foodStation", false);
    state = { ...state, world: brokenWorld };
    result = tick(state, 1);
    expect(result.events.some((e) => e.kind === "blockage")).toBe(true);
    expect(result.events.some((e) => e.kind === "executionAborted")).toBe(true);
    expect(result.state.colonist.currentGoal?.status).toBe("blocked");
  });

  it("re-decision does not happen every tick when nothing changed (no trigger fires while progressing)", () => {
    const state = stateAtTickOfDay(0); // work period, all needs satisfied
    const first = tick(state, 1); // bootstrap tick — a decision happens here
    const second = tick(first.state, 1); // nothing should have changed
    expect(second.events.some((e) => e.kind === "decision")).toBe(false);
    expect(second.events.some((e) => e.kind === "bootstrap")).toBe(false);
  });

  it("no intermediate trigger is skipped across a multi-tick run() advance (review fix 2)", () => {
    // Two independent triggers land at different points within a short window: hunger
    // crosses low around tick 3-4, and — separately — verify each of the 4 ticks was
    // individually evaluated by checking the event trace contains a needThresholdCrossing
    // AND the clock progressed through every intermediate tick value (no jump).
    const initial = stateAtTickOfDay(0, { hunger: { level: 0.4029, ticksBelowLow: 0 } }); // crosses ~tick 3
    const result = run(initial, 4);
    const crossingEvents = result.events.filter((e) => e.kind === "needThresholdCrossing");
    expect(crossingEvents.length).toBeGreaterThan(0);
    expect(result.finalState.clock.tick).toBe(4);
  });

  it("run() detects a shift boundary and a need crossing within the same short advance, neither skipped", () => {
    // Position the clock one tick before the work→rest boundary, with hunger set to cross
    // low exactly two ticks later — both must appear in a 4-tick run().
    const start = policy.workTicks - 1;
    const initial = stateAtTickOfDay(start, { hunger: { level: 0.4019, ticksBelowLow: 0 } });
    const result = run(initial, 4);
    expect(result.events.some((e) => e.kind === "shiftBoundary")).toBe(true);
    expect(result.events.some((e) => e.kind === "needThresholdCrossing")).toBe(true);
  });

  it("suspensionResolved resumes the suspended goal once nothing outranks it, preserving its identity", () => {
    const freeStart = policy.workTicks + policy.restTicks;
    let state = stateAtTickOfDay(freeStart, { hunger: { level: 0.402, ticksBelowLow: 0 } });
    let result = tick(state, 1); // bootstrap: voluntary
    state = result.state;
    const originalVoluntary = state.colonist.currentGoal!;

    let interrupted = false;
    for (let i = 0; i < 50 && !interrupted; i++) {
      result = tick(state, 1);
      state = result.state;
      interrupted = result.events.some((e) => e.kind === "higherPriorityCondition");
    }
    expect(interrupted).toBe(true);

    let resumed = false;
    for (let i = 0; i < 400 && !resumed; i++) {
      result = tick(state, 1);
      state = result.state;
      if (result.events.some((e) => e.kind === "suspensionResolved")) {
        resumed = true;
        expect(state.colonist.suspendedGoal).toBeNull();
        expect(state.suspendedExecution).toBeNull();
        expect(state.colonist.currentGoal?.key).toBe(originalVoluntary.key);
        expect(state.colonist.currentGoal?.motivation).toBe(originalVoluntary.motivation);
        expect(state.colonist.currentGoal?.adoptedAtTick).toBe(originalVoluntary.adoptedAtTick);
      }
    }
    expect(resumed).toBe(true);
  });
});

describe("replay determinism", () => {
  it("running the same initial state for the same number of ticks twice yields identical final states", () => {
    const initial = stateAtTickOfDay(0, { hunger: { level: 0.42, ticksBelowLow: 0 } }, 99);
    const a = run(initial, 200);
    const b = run(initial, 200);
    expect(a.finalState).toEqual(b.finalState);
  });

  it("different seeds may still converge deterministically per-seed (same seed always reproduces)", () => {
    const initialA = stateAtTickOfDay(0, {}, 5);
    const initialB = stateAtTickOfDay(0, {}, 5);
    expect(run(initialA, 100).finalState).toEqual(run(initialB, 100).finalState);
  });
});

describe("stable replay logs", () => {
  it("the full event trace is identical across two runs of the same initial state", () => {
    const initial = stateAtTickOfDay(0, { hunger: { level: 0.42, ticksBelowLow: 0 } }, 7);
    const a = run(initial, 150);
    const b = run(initial, 150);
    expect(a.events).toEqual(b.events);
  });
});

describe("purity", () => {
  it("tick() does not mutate its input state", () => {
    const state = stateAtTickOfDay(0);
    const snapshot = JSON.parse(JSON.stringify(state));
    tick(state, 1);
    expect(state).toEqual(snapshot);
  });

  it("run() does not mutate its input initial state", () => {
    const initial = stateAtTickOfDay(0);
    const snapshot = JSON.parse(JSON.stringify(initial));
    run(initial, 50);
    expect(initial).toEqual(snapshot);
  });
});

describe("same-tier commitment stickiness (final review fix, 2026-07-10)", () => {
  function stateWithHungerActiveAndSocialApproachingLow(): SimulationState {
    const restStart = policy.workTicks; // no shiftAssignment/voluntary competing during rest
    return stateAtTickOfDay(restStart, {
      hunger: { level: 0.3, ticksBelowLow: 500 }, // low, not critical — sole initial candidate
      social: { level: 0.404, ticksBelowLow: 0 }, // crosses low ~10 ticks later — same tier (4)
    });
  }

  it("a second low need appearing at the same tier does not replace the active Goal", () => {
    let state = stateWithHungerActiveAndSocialApproachingLow();
    let result = tick(state, 1); // bootstrap: hunger goal adopted
    state = result.state;
    const originalGoal = state.colonist.currentGoal!;
    expect(originalGoal.relatedNeed).toBe("hunger");

    let sawSocialCrossing = false;
    for (let i = 0; i < 30 && !sawSocialCrossing; i++) {
      result = tick(state, 1);
      state = result.state;
      if (result.events.some((e) => e.kind === "needThresholdCrossing" && e.needId === "social")) {
        sawSocialCrossing = true;
        // The event is still logged (an honest ambient signal) — but nothing re-decided.
        expect(result.events.some((e) => e.kind === "decision")).toBe(false);
        expect(result.events.some((e) => e.kind === "taskResolution")).toBe(false);
        expect(result.events.some((e) => e.kind === "executionBegun")).toBe(false);
        expect(state.colonist.currentGoal?.key).toBe(originalGoal.key);
        expect(state.colonist.currentGoal?.source).toBe("lowNeed");
        expect(state.colonist.currentGoal?.relatedNeed).toBe("hunger");
      }
    }
    expect(sawSocialCrossing).toBe(true);
  });

  it("no PRNG draw is consumed when a same-tier candidate appears", () => {
    let state = stateWithHungerActiveAndSocialApproachingLow();
    let result = tick(state, 1);
    state = result.state;

    for (let i = 0; i < 30; i++) {
      const prngBefore = state.prng;
      result = tick(state, 1);
      const sawCrossing = result.events.some((e) => e.kind === "needThresholdCrossing" && e.needId === "social");
      state = result.state;
      if (sawCrossing) {
        expect(state.prng).toEqual(prngBefore); // completely untouched — zero draws
        return;
      }
    }
    throw new Error("social never crossed low within the test window");
  });

  it("motivation and adoptedAtTick remain unchanged across a same-tier same-tick trigger", () => {
    let state = stateWithHungerActiveAndSocialApproachingLow();
    let result = tick(state, 1);
    state = result.state;
    const originalMotivation = state.colonist.currentGoal!.motivation;
    const originalAdoptedAtTick = state.colonist.currentGoal!.adoptedAtTick;

    for (let i = 0; i < 30; i++) {
      result = tick(state, 1);
      state = result.state;
      if (result.events.some((e) => e.kind === "needThresholdCrossing" && e.needId === "social")) {
        expect(state.colonist.currentGoal!.motivation).toBe(originalMotivation);
        expect(state.colonist.currentGoal!.adoptedAtTick).toBe(originalAdoptedAtTick);
        return;
      }
    }
    throw new Error("social never crossed low within the test window");
  });

  it("execution progress continues unchanged except for normal per-tick progress", () => {
    let state = stateWithHungerActiveAndSocialApproachingLow();
    let result = tick(state, 1);
    state = result.state;
    const taskId = state.execution!.taskId;

    let sawCrossing = false;
    for (let i = 0; i < 30 && !sawCrossing; i++) {
      const before = state.execution!.elapsedTicks;
      result = tick(state, 1);
      state = result.state;
      expect(state.execution!.taskId).toBe(taskId);
      expect(state.execution!.status).toBe("inProgress");
      // Exactly +1 per tick — no reset, no skip, no jump — even on the tick the same-tier
      // trigger fires.
      expect(state.execution!.elapsedTicks).toBe(before + 1);
      sawCrossing = result.events.some((e) => e.kind === "needThresholdCrossing" && e.needId === "social");
    }
    expect(sawCrossing).toBe(true);
  });

  it("a higher-tier candidate still interrupts correctly (the stickiness gate does not suppress real interruptions)", () => {
    const freeStart = policy.workTicks + policy.restTicks;
    let state = stateAtTickOfDay(freeStart, { hunger: { level: 0.402, ticksBelowLow: 0 } });
    let result = tick(state, 1);
    state = result.state;
    expect(state.colonist.currentGoal?.source).toBe("voluntary");

    let interrupted = false;
    for (let i = 0; i < 50 && !interrupted; i++) {
      result = tick(state, 1);
      state = result.state;
      interrupted = result.events.some((e) => e.kind === "higherPriorityCondition");
    }
    expect(interrupted).toBe(true);
    expect(state.colonist.currentGoal?.source).toBe("lowNeed");
    expect(state.colonist.suspendedGoal?.source).toBe("voluntary");
  });

  it("completion still permits a new selection", () => {
    const restStart = policy.workTicks;
    let state = stateAtTickOfDay(restStart, { rest: { level: 0.3, ticksBelowLow: 500 } });
    let sawCompletionThenDecision = false;
    for (let i = 0; i < 300 && !sawCompletionThenDecision; i++) {
      const result = tick(state, 1);
      state = result.state;
      if (result.events.some((e) => e.kind === "completion")) {
        sawCompletionThenDecision = result.events.some((e) => e.kind === "decision");
      }
    }
    expect(sawCompletionThenDecision).toBe(true);
  });

  it("blockage still permits a new selection", () => {
    let state = stateAtTickOfDay(policy.workTicks, { hunger: { level: 0.3, ticksBelowLow: 500 } });
    let result = tick(state, 1);
    state = result.state;
    const brokenWorld = setModuleFunctional(state.world, "foodStation", false);
    state = { ...state, world: brokenWorld };
    result = tick(state, 1);
    // Blockage moves the goal's status away from "active", so the stickiness gate does not
    // apply and a fresh decision follows in the same tick.
    expect(result.events.some((e) => e.kind === "blockage")).toBe(true);
    expect(result.events.some((e) => e.kind === "decision")).toBe(true);
  });
});

describe("suspended-pair invariant (review fix 2, 2026-07-10)", () => {
  const voluntaryCandidate = { source: "voluntary" as const, tier: 5 as const, key: "voluntary:idle", baseUrgency: 0.2 };
  const hungerCandidate = {
    source: "lowNeed" as const,
    tier: 4 as const,
    key: "lowNeed:hunger",
    baseUrgency: 0.4,
    relatedNeed: "hunger" as const,
  };

  it("rejects goal present / execution missing", () => {
    const base = stateAtTickOfDay(0);
    const goal = suspendGoal(commitGoal(voluntaryCandidate, "m", 0));
    const state: SimulationState = { ...base, colonist: withSuspendedGoal(base.colonist, goal), suspendedExecution: null };
    expect(() => validateSimulationState(state)).toThrow();
    expect(() => tick(state, 1)).toThrow(); // input boundary rejects it too
  });

  it("rejects execution present / goal missing", () => {
    const base = stateAtTickOfDay(0);
    const exec = interruptExecution(beginExecution(taskDefinition("idlePresence"), commitGoal(voluntaryCandidate, "m", 0), 0));
    const state: SimulationState = { ...base, suspendedExecution: exec }; // colonist.suspendedGoal stays null
    expect(() => validateSimulationState(state)).toThrow();
    expect(() => tick(state, 1)).toThrow();
  });

  it("accepts a valid paired state", () => {
    const base = stateAtTickOfDay(0);
    const goal = suspendGoal(commitGoal(voluntaryCandidate, "m", 0));
    const exec = interruptExecution(beginExecution(taskDefinition("idlePresence"), { ...goal, status: "active" }, 0));
    const state: SimulationState = { ...base, colonist: withSuspendedGoal(base.colonist, goal), suspendedExecution: exec };
    expect(() => validateSimulationState(state)).not.toThrow();
  });

  it("rejects a mismatched pair — execution.goalKey does not name the suspended goal", () => {
    const base = stateAtTickOfDay(0);
    const goal = suspendGoal(commitGoal(voluntaryCandidate, "m", 0));
    const mismatchedExec = interruptExecution(beginExecution(taskDefinition("eatAtFoodStation"), commitGoal(hungerCandidate, "m", 0), 0));
    const state: SimulationState = { ...base, colonist: withSuspendedGoal(base.colonist, goal), suspendedExecution: mismatchedExec };
    expect(() => validateSimulationState(state)).toThrow();
  });

  it("rejects a suspended execution that isn't in 'interrupted' status", () => {
    const base = stateAtTickOfDay(0);
    const goal = suspendGoal(commitGoal(voluntaryCandidate, "m", 0));
    const stillInProgress = beginExecution(taskDefinition("idlePresence"), { ...goal, status: "active" }, 0); // NOT interrupted
    const state: SimulationState = { ...base, colonist: withSuspendedGoal(base.colonist, goal), suspendedExecution: stillInProgress };
    expect(() => validateSimulationState(state)).toThrow();
  });

  it("REGRESSION (Copilot-confirmed) — active-pair invariant: rejects an execution whose goalKey does not match currentGoal.key", () => {
    const base = stateAtTickOfDay(0);
    const goal = commitGoal(voluntaryCandidate, "m", 0);
    const unrelatedExec = beginExecution(taskDefinition("eatAtFoodStation"), commitGoal(hungerCandidate, "m", 0), 0);
    const state: SimulationState = { ...base, colonist: withCurrentGoal(base.colonist, goal), execution: unrelatedExec };
    expect(() => validateSimulationState(state)).toThrow(/goalKey/);
    expect(() => tick(state, 1)).toThrow(); // input boundary rejects it too
  });

  it("REGRESSION (Copilot-confirmed) — active-pair invariant: rejects an execution with no current goal at all", () => {
    const base = stateAtTickOfDay(0);
    const exec = beginExecution(taskDefinition("idlePresence"), commitGoal(voluntaryCandidate, "m", 0), 0);
    const state: SimulationState = { ...base, execution: exec }; // colonist.currentGoal stays null
    expect(() => validateSimulationState(state)).toThrow(/currentGoal is null/);
    expect(() => tick(state, 1)).toThrow();
  });

  it("REGRESSION (Copilot-confirmed) — active-pair invariant: rejects an execution running against a blocked goal", () => {
    const base = stateAtTickOfDay(0);
    const goal = commitGoal(voluntaryCandidate, "m", 0);
    const exec = beginExecution(taskDefinition("idlePresence"), goal, 0);
    const blocked = { ...goal, status: "blocked" as const };
    const state: SimulationState = { ...base, colonist: withCurrentGoal(base.colonist, blocked), execution: exec };
    expect(() => validateSimulationState(state)).toThrow(/only an active goal can be executing/);
  });

  it("REGRESSION (Copilot-confirmed) — active-pair invariant: rejects a non-inProgress execution in the active slot", () => {
    const base = stateAtTickOfDay(0);
    const goal = commitGoal(voluntaryCandidate, "m", 0);
    const interrupted = interruptExecution(beginExecution(taskDefinition("idlePresence"), goal, 0));
    const state: SimulationState = { ...base, colonist: withCurrentGoal(base.colonist, goal), execution: interrupted };
    expect(() => validateSimulationState(state)).toThrow(/inProgress/);
  });

  it("active-pair invariant: accepts a consistent in-progress pair, and every organic run output validates", () => {
    const base = stateAtTickOfDay(0);
    const goal = commitGoal(voluntaryCandidate, "m", 0);
    const exec = beginExecution(taskDefinition("idlePresence"), goal, 0);
    const state: SimulationState = { ...base, colonist: withCurrentGoal(base.colonist, goal), execution: exec };
    expect(() => validateSimulationState(state)).not.toThrow();

    // Organic sanity: a real run's every boundary state already passes through
    // validateSimulationState inside finish(); one long run exercises completion, blockage-free
    // re-decision, and shift boundaries under the tightened invariant.
    const finalState = run(stateAtTickOfDay(0), 600).finalState;
    expect(() => validateSimulationState(finalState)).not.toThrow();
  });

  it("invariant is preserved across suspend, resume, blockage, and overflow — every intermediate tick output validates", () => {
    // Suspend + resume (free-period interruption/resume scenario).
    const freeStart = policy.workTicks + policy.restTicks;
    let state = stateAtTickOfDay(freeStart, { hunger: { level: 0.402, ticksBelowLow: 0 } });
    let result = tick(state, 1);
    state = result.state;
    validateSimulationState(state); // bootstrap output

    for (let i = 0; i < 450; i++) {
      result = tick(state, 1);
      state = result.state;
      validateSimulationState(state); // every tick's output, through interruption and resume
    }
    expect(state.colonist.suspendedGoal).toBeNull(); // resumed by the end of the window
    expect(state.suspendedExecution).toBeNull();

    // Blockage (separate scenario): breaking a module mid-execution must still leave a valid state.
    let blockageState = stateAtTickOfDay(policy.workTicks, { hunger: { level: 0.3, ticksBelowLow: 500 } });
    let blockageResult = tick(blockageState, 1);
    blockageState = blockageResult.state;
    validateSimulationState(blockageState);
    blockageState = { ...blockageState, world: setModuleFunctional(blockageState.world, "foodStation", false) };
    blockageResult = tick(blockageState, 1);
    validateSimulationState(blockageResult.state);

    // Overflow (hand-built precondition, mirroring the suspension-overflow test above).
    const voluntarySuspended = suspendGoal(commitGoal(voluntaryCandidate, "m", 0));
    const voluntaryExec = interruptExecution(
      { ...beginExecution(taskDefinition("idlePresence"), { ...voluntarySuspended, status: "active" }, 0), elapsedTicks: 12 },
    );
    const hungerActive = commitGoal(hungerCandidate, "hunger motivation", 5);
    const hungerExec = { ...beginExecution(taskDefinition("eatAtFoodStation"), hungerActive, 5), elapsedTicks: 7 };
    let overflowColonist = withCurrentGoal(withSuspendedGoal(createColonist("c1", "Maya"), voluntarySuspended), hungerActive);
    overflowColonist = withNeeds(overflowColonist, {
      ...createNeeds(),
      hunger: { level: 0.5, ticksBelowLow: 0 },
      rest: { level: 0.05, ticksBelowLow: 500 },
    });
    const overflowState: SimulationState = {
      clock: advance(createClock(), policy.workTicks + policy.restTicks),
      world: createWorld(),
      policy,
      colonist: overflowColonist,
      execution: hungerExec,
      suspendedExecution: voluntaryExec,
      prng: createPrng(1),
      ...createFreshMemoryBaselines(),
      hasBootstrapped: true, // hand-built mid-run precondition — already has an active/suspended goal
      eventLog: createEventLog(),
      decisionLog: createDecisionLog(),
      relationships: createRelationshipStore(),
      roster: [],
    };
    validateSimulationState(overflowState); // the hand-built precondition is itself valid
    const overflowResult = tick(overflowState, 1);
    validateSimulationState(overflowResult.state); // and so is the state after overflow resolves
  });
});

describe("relational memory formation via real ticks (Stage 2 build step 8, ADR-20 D7)", () => {
  // atrophyPerTick is 0.02/tick (relationships.ts); relationshipChangeSignificance is 15
  // (config/tuning.ts) — cumulative drift needs ~750 ticks past the first-sighting tick to
  // cross it. Starting affinity of 50 stays well clear of clamping the whole way.
  const SIGNIFICANT_TICKS = 800;
  const NON_SIGNIFICANT_TICKS = 100; // 100 * 0.02 = 2, well below the 15 threshold

  function seededState(): SimulationState {
    const colonist = withNeeds(createColonist("c1", "Maya"), createNeeds());
    const relationships = applyInteraction(createRelationshipStore(), {
      colonistAId: "c1",
      colonistBId: "zeke",
      tick: 0,
      changeSource: "sharedTaskCompletion",
      initiatorId: "c1",
      responderId: "zeke",
      aTowardBDelta: 50,
      bTowardADelta: 50,
    }).store;
    return {
      clock: createClock(),
      world: createWorld(),
      policy,
      colonist,
      execution: null,
      suspendedExecution: null,
      prng: createPrng(1),
      ...createFreshMemoryBaselines(),
      hasBootstrapped: false,
      eventLog: createEventLog(),
      decisionLog: createDecisionLog(),
      relationships,
      roster: [],
    };
  }

  it("a real run path forms a Relational memory once cumulative atrophy drift becomes significant", () => {
    const result = run(seededState(), SIGNIFICANT_TICKS);
    const relational = result.finalState.colonist.memory.filter((e) => e.type === "relational");
    expect(relational.length).toBeGreaterThan(0);
    expect(relational[0]!.context).toEqual({ otherId: "zeke", direction: "negative" });
  });

  it("emits a memoryFormed event with memoryType relational and the correct otherId", () => {
    const result = run(seededState(), SIGNIFICANT_TICKS);
    const formed = result.events.filter((e) => e.kind === "memoryFormed" && e.memoryType === "relational");
    expect(formed.length).toBeGreaterThan(0);
    expect(formed[0]).toMatchObject({ kind: "memoryFormed", memoryType: "relational", otherId: "zeke" });
  });

  it("does NOT form a Relational memory while cumulative drift stays below significance", () => {
    const result = run(seededState(), NON_SIGNIFICANT_TICKS);
    const relational = result.finalState.colonist.memory.filter((e) => e.type === "relational");
    expect(relational).toEqual([]);
    expect(result.events.some((e) => e.kind === "memoryFormed" && e.memoryType === "relational")).toBe(false);
  });

  it("a real single-colonist run with no materialized pairs never forms a Relational memory (unchanged Stage 1 behavior)", () => {
    const colonist = withNeeds(createColonist("c1", "Maya"), createNeeds());
    const bare: SimulationState = {
      clock: createClock(),
      world: createWorld(),
      policy,
      colonist,
      execution: null,
      suspendedExecution: null,
      prng: createPrng(1),
      ...createFreshMemoryBaselines(),
      hasBootstrapped: false,
      eventLog: createEventLog(),
      decisionLog: createDecisionLog(),
      relationships: createRelationshipStore(),
      roster: [],
    };
    const result = run(bare, SIGNIFICANT_TICKS);
    expect(result.finalState.colonist.memory.filter((e) => e.type === "relational")).toEqual([]);
  });

  it("existing Deprivation/Condition memory formation is unaffected by relationship wiring", () => {
    const base = seededState();
    const withHunger: SimulationState = {
      ...base,
      colonist: withNeeds(base.colonist, { ...createNeeds(), hunger: { level: 0.9, ticksBelowLow: 0 } }),
    };
    const result = run(withHunger, SIGNIFICANT_TICKS);
    const deprivation = result.finalState.colonist.memory.filter((e) => e.type === "deprivation");
    expect(deprivation.length).toBeGreaterThan(0); // hunger decay over 800 ticks still forms Deprivation memories as before
  });

  it("never reads RelationshipStore.pairs or PairRecord.history directly — tick.ts only threads applyAtrophy's own consequence fields", () => {
    const source = readFileSync(new URL("./tick.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/relationships\.pairs/);
    expect(source).not.toMatch(/\.history\b/);
  });

  it("purity: run() does not mutate the seeded initial state", () => {
    const state = seededState();
    const snapshot = JSON.parse(JSON.stringify(state));
    run(state, SIGNIFICANT_TICKS);
    expect(state).toEqual(snapshot);
  });
});

describe("multi-colonist roster (Stage 2 Slice 2)", () => {
  const zeke = { id: "zeke", name: "Zeke", skills: [], baseTraits: [] } as const;
  const yara = { id: "yara", name: "Yara", skills: [], baseTraits: [] } as const;

  function stateWithRoster(roster: SimulationState["roster"]): SimulationState {
    return { ...stateAtTickOfDay(0), roster };
  }

  it("a 2-3 colonist roster survives a real tick unchanged — no phase simulates or mutates it", () => {
    const state = stateWithRoster([zeke, yara]);
    const result = tick(state, 1);
    expect(result.state.roster).toEqual([zeke, yara]);
    expect(result.state.roster).toBe(state.roster); // same reference — never even copied
  });

  it("validateSimulationState rejects a roster entry whose id duplicates the primary colonist's own id", () => {
    const selfReference = { id: "c1", name: "Impostor", skills: [], baseTraits: [] } as const;
    const state = stateWithRoster([selfReference]);
    expect(() => validateSimulationState(state)).toThrow(/duplicates the primary colonist/);
    expect(() => tick(state, 1)).toThrow();
  });

  it("validateSimulationState rejects two roster entries sharing the same id", () => {
    const state = stateWithRoster([zeke, { ...yara, id: "zeke" }]);
    expect(() => validateSimulationState(state)).toThrow(/duplicate id/);
    expect(() => tick(state, 1)).toThrow();
  });

  it("accepts a valid multi-colonist roster with no duplicate or self-referencing ids", () => {
    const state = stateWithRoster([zeke, yara]);
    expect(() => validateSimulationState(state)).not.toThrow();
  });

  it("an empty roster (the pre-Slice-2 default) is always valid", () => {
    const state = stateWithRoster([]);
    expect(() => validateSimulationState(state)).not.toThrow();
  });
});
