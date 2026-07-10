// M12 — Task & Execution System. Owns the task-class registry, drives the
// committed task as an observable ambient state, publishes the
// observable-state registry (the single source M4 and the UI both read),
// and detects completion/failure. [engineering-specification.md §2 M12]
//
// Stage-1 gap, flagged rather than silently papered over: the closed
// seven-state repertoire [ADR-05] has no state for solo unstructured free
// time — Socializing requires a colonist partner that does not exist until
// Stage 2. "resting" is used as the nearest-fit texture; this is a named
// simplification, not a claim that it is correct. Follow-up: revisit once
// Stage 2 introduces a second colonist.

import { NEED_CALIBRATION } from "./calibration.js";
import { consumeResource, enterOccupancy, leaveOccupancy, type WorldState } from "./world.js";
import { isStressedState } from "./stress.js";
import type {
  ColonistState,
  GoalStackEntry,
  NeedKind,
  ObservableState,
  ResolvedTask,
  StressRelief,
  StressSource,
  SurvivalCondition,
  WorldSnapshot,
} from "./types.js";

const TASK_OBSERVABLE_STATE: Readonly<Record<string, ObservableState>> = {
  eat: "eating",
  sleep: "resting",
  work: "working",
  "free-time": "resting", // Stage-1 gap — see module note above.
};

function responseObservableState(): ObservableState {
  // Emergency/response tasks read as directed, task-focused activity.
  return "working";
}

/** Enters the task's module (occupancy) and applies one-time start effects (e.g. consuming a meal's food). */
export function startTask(world: WorldState, task: ResolvedTask): void {
  if (task.moduleId === "station") return; // abstract station-wide response task — no module occupancy
  enterOccupancy(world, task.moduleId);
  if (task.taskId === "eat") consumeResource(world, task.moduleId, 10);
}

export function stopTask(world: WorldState, task: ResolvedTask | undefined): void {
  if (!task || task.moduleId === "station") return;
  leaveOccupancy(world, task.moduleId);
}

/** Which need (if any) this task is actively satisfying — feeds M6's satisfying-condition input. */
export function satisfyingConditionsFor(task: ResolvedTask | undefined): Partial<Record<NeedKind, boolean>> {
  if (!task) return {};
  if (task.taskId === "eat") return { hunger: true };
  if (task.taskId === "sleep") return { rest: true };
  return {};
}

/** Which stress sources/reliefs are active while executing this task. [decision-loop.md §7] */
export function stressInputsFor(
  task: ResolvedTask | undefined,
  colonist: ColonistState,
): { sources: Partial<Record<StressSource, boolean>>; reliefs: Partial<Record<StressRelief, boolean>> } {
  if (!task) return { sources: {}, reliefs: {} };

  const belowLowCount = ([...Object.entries(colonist.needs)] as [NeedKind, number][]).filter(
    ([, level]) => level < NEED_CALIBRATION.lowThreshold,
  ).length;

  switch (task.taskId) {
    case "sleep":
      return { sources: {}, reliefs: { "adequate-rest": true } };
    case "eat":
      return { sources: {}, reliefs: belowLowCount === 0 ? { "satisfied-needs": true } : {} };
    case "work":
      // Overwork exposure: working while already rest-deprived, rather than a
      // separately tracked continuous-work-duration meter (Stage-1 simplification).
      return {
        sources: { overwork: colonist.needs.rest < NEED_CALIBRATION.lowThreshold },
        reliefs: { "stable-conditions": true },
      };
    case "free-time":
      return { sources: {}, reliefs: { "stable-conditions": true, "satisfied-needs": belowLowCount === 0 } };
    default:
      if (task.taskClass === "response") return { sources: { "crisis-exposure": true }, reliefs: {} };
      return { sources: {}, reliefs: {} };
  }
}

/** Updates the colonist's ambient observable state from the active task, with Stress taking visibility priority. [ADR-05] */
export function updateObservableState(colonist: ColonistState, activeTask: ResolvedTask | undefined): void {
  if (isStressedState(colonist)) {
    colonist.observableState = "stressed";
    return;
  }
  if (!activeTask) {
    colonist.observableState = "blocked";
    return;
  }
  colonist.observableState =
    activeTask.taskClass === "response" ? responseObservableState() : (TASK_OBSERVABLE_STATE[activeTask.taskId] ?? "blocked");
}

/**
 * Completion per goal category — never on a clock value. [decision-loop.md §10]
 */
export function detectCompletion(
  goal: GoalStackEntry,
  colonist: ColonistState,
  snapshot: WorldSnapshot,
  activeSurvivalConditions: ReadonlySet<SurvivalCondition>,
): boolean {
  switch (goal.source) {
    case "survival-condition":
      return goal.survivalCondition === undefined || !activeSurvivalConditions.has(goal.survivalCondition);
    case "critical-need":
    case "low-need":
      return goal.needKind !== undefined && colonist.needs[goal.needKind] >= NEED_CALIBRATION.satisfactionPoint;
    case "shift-assignment":
      return snapshot.shiftPeriod !== "work";
    case "voluntary":
      return snapshot.shiftPeriod !== "free";
  }
}

/** Mid-execution failure: the task's module stopped functioning or lost capacity. [decision-loop.md §5 "Task failure"] */
export function detectFailure(task: ResolvedTask, snapshot: WorldSnapshot): boolean {
  if (task.moduleId === "station") return false;
  const module = snapshot.moduleConditions.find((m) => m.id === task.moduleId);
  return module === undefined || !module.functional;
}
