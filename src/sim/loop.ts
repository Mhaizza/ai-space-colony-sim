// The Stage 1 simulation session: wires M1-M9, M11, M12, S1, S2 together
// through the fixed, documented, deterministic seven-phase update order.
// [engineering-specification.md §5]

import { advanceClock, createClock, type Clock } from "./clock.js";
import { activeGoal, createColonist } from "./colonist.js";
import { createEventRecord, logDecision, logEvent, type EventRecord } from "../services/events.js";
import { createPrng, type PrngState } from "../services/prng.js";
import { crossedShiftBoundary, createStage1Policy } from "./policy.js";
import { buildSnapshot, type ObservableRegistry } from "./snapshot.js";
import { decide } from "./decision.js";
import { aggregateNeedModifiers, aggregateStressModifiers, assignTrait } from "./traits.js";
import { tickNeeds } from "./needs.js";
import { tickStress } from "./stress.js";
import {
  detectCompletion,
  detectFailure,
  satisfyingConditionsFor,
  startTask,
  stopTask,
  stressInputsFor,
  updateObservableState,
} from "./task.js";
import { createStage1World, type WorldState } from "./world.js";
import type {
  ColonistState,
  GoalStackEntry,
  ObservableState,
  Policy,
  ResolvedTask,
  SimDuration,
  SimTime,
} from "./types.js";

export interface SimSession {
  readonly clock: Clock;
  readonly world: WorldState;
  readonly policy: Policy;
  readonly colonist: ColonistState;
  readonly prng: PrngState;
  readonly events: EventRecord;
  /** The observable-state registry (M12's responsibility; held here as the Stage-1 single-colonist instance). */
  readonly registry: Map<string, ObservableState>;
  currentTask: ResolvedTask | undefined;
}

export function createStage1Session(seed: number, traitIds: readonly string[] = []): SimSession {
  const world = createStage1World();
  const policy = createStage1Policy("workstation-1");
  const colonist = createColonist({ id: "colonist-1", name: "Ada", skills: ["engineering"] }, 0);
  for (const traitId of traitIds) assignTrait(colonist, traitId);

  const registry = new Map<string, ObservableState>([[colonist.identity.id, colonist.observableState]]);
  return {
    clock: createClock(0),
    world,
    policy,
    colonist,
    prng: createPrng(seed),
    events: createEventRecord(),
    registry,
    currentTask: undefined,
  };
}

/**
 * Advances the session by one step. Implements the normative phase order:
 * 1. Time advance, 2. World evolution, 3. Colonist continuous state,
 * 4. Condition & trigger detection, 5. Decisions, 6. Execution &
 * consequences, 7. Records. [engineering-specification.md §5]
 */
export function step(session: SimSession, stepSeconds: SimDuration): void {
  // --- Phase 1: Time advance (M1) ---
  const prevTime = session.clock.time;
  const dt = advanceClock(session.clock, stepSeconds);
  if (dt <= 0) return; // paused
  const now: SimTime = session.clock.time;

  // --- Phase 2: World evolution (M2) ---
  // Stage 1 has no autonomous clock-rated world processes (no maintenance
  // drift modeled yet) — module health and survival conditions change only
  // via explicit test/scenario calls. Documented no-op, not an omission.

  // --- Phase 3: Colonist continuous state (M6, M7) ---
  const needMods = aggregateNeedModifiers(session.colonist);
  const stressMods = aggregateStressModifiers(session.colonist);
  const satisfying = satisfyingConditionsFor(session.currentTask);
  const stressInputs = stressInputsFor(session.currentTask, session.colonist);
  const crossings = tickNeeds(session.colonist, dt, satisfying, needMods);
  tickStress(session.colonist, dt, stressInputs, stressMods);

  // --- Phase 4: Condition & trigger detection ---
  // Trigger 4 is a crossing that *generates* a new candidate — that is the
  // entering direction only. The exiting direction removes a candidate; it
  // does not itself warrant re-litigating a commitment (goal completion,
  // trigger 1, is detected separately below via each need's own satisfaction
  // point). Treating "exited critical" as a trigger caused an oscillation
  // where a colonist would abandon eating the instant hunger ticked one
  // point above the critical line, long before reaching satisfaction —
  // exactly decision-loop.md Risk 3's failure mode. [decision-loop.md §2]
  let triggered = crossings.some((c) => c.direction === "entered");
  if (crossedShiftBoundary(prevTime, now)) triggered = true;

  const goalBefore: GoalStackEntry | undefined = activeGoal(session.colonist);
  const snapshotForDetection = buildSnapshot(session.world, session.policy, session.colonist.identity.id, now, registryView(session));

  // Trigger 2 — interruption: a higher-priority condition appears. Stage 1's
  // one instance is a survival condition activating while the active goal
  // isn't already the (unconditional) tier-1 response.
  if (session.world.survivalConditions.size > 0 && goalBefore?.tier !== 1) {
    triggered = true;
  }

  if (goalBefore) {
    if (detectCompletion(goalBefore, session.colonist, snapshotForDetection, session.world.survivalConditions)) {
      goalBefore.status = "queued"; // completed goals leave the active slot; pruned on next commit
      logEvent(session.events, {
        time: now,
        kind: "goal-completed",
        description: `${goalBefore.source} (${goalBefore.taskId ?? "?"}) completed`,
      });
      triggered = true;
    } else if (session.currentTask && detectFailure(session.currentTask, snapshotForDetection)) {
      goalBefore.status = "blocked";
      logEvent(session.events, {
        time: now,
        kind: "task-failed",
        description: `${session.currentTask.taskId} failed — module unavailable`,
      });
      triggered = true;
    }
  } else {
    triggered = true; // bootstrap: no active goal yet
  }

  // --- Phase 5: Decisions (M4 + M11), only when triggered ---
  if (triggered) {
    const snapshot = buildSnapshot(session.world, session.policy, session.colonist.identity.id, now, registryView(session));
    const outcome = decide(session.colonist, snapshot, needMods, session.prng, now);

    if (outcome && outcome.task.taskId !== session.currentTask?.taskId) {
      stopTask(session.world, session.currentTask);
      startTask(session.world, outcome.task);
      session.currentTask = outcome.task;

      logDecision(session.events, {
        time: now,
        colonistId: session.colonist.identity.id,
        source: outcome.candidate.source,
        tier: outcome.candidate.tier,
        motivation: outcome.motivation,
        taskId: outcome.task.taskId,
        decomposition: outcome.decomposition,
        materialMemoryIds: outcome.materialMemoryIds,
        stochastic: outcome.stochastic,
      });
    } else if (!outcome) {
      stopTask(session.world, session.currentTask);
      session.currentTask = undefined;
    }
  }

  // --- Phase 6: Execution & consequences (M12) ---
  updateObservableState(session.colonist, session.currentTask);
  session.registry.set(session.colonist.identity.id, session.colonist.observableState);

  // --- Phase 7: Records (S2) ---
  for (const crossing of crossings) {
    logEvent(session.events, {
      time: now,
      kind: "need-threshold-crossing",
      description: `${crossing.need} ${crossing.kind} threshold ${crossing.direction}`,
    });
  }
}

function registryView(session: SimSession): ObservableRegistry {
  return session.registry;
}

export function runFor(session: SimSession, totalSeconds: SimDuration, stepSeconds: SimDuration): void {
  let remaining = totalSeconds;
  while (remaining > 0) {
    const thisStep = Math.min(stepSeconds, remaining);
    step(session, thisStep);
    remaining -= thisStep;
  }
}
