// M12 Task & Execution System — task lifecycle and its owned consequences. decision-loop §2
// (Execute stage), §10 (behavior as one of the seven ambient states — Stage 1 does not yet
// build the state-mapping/animation layer; this module owns the lifecycle and consequence
// facts that a future ambient-state mapper reads, per engineering spec interface 11: "Execution
// outcomes (M12 → M2 world effects; → M6 satisfaction-condition facts...)".
//
// "Execution owns progress and completion": this module is the only place an Execution's
// status advances. "No world mutation beyond execution consequences": applyProgressConsequences
// is the only function in this module that touches World/NeedsState, and it only ever applies
// the specific, task-defined consequence of that task's own progress (food consumption for
// eating, need restoration for satisfaction tasks) — nothing else. "Memory formation remains
// outside execution": no function here forms, mutates, fades, or evicts a memory; consequence
// application returns updated needs/world only, for a later pipeline stage (not built yet) to
// hand to memory.ts's formation functions.

import { NEED_TUNING, TASK_TUNING } from "../config/tuning.js";
import { restoreNeed, restoreNeedByAmount, type NeedsState } from "../colonist/needs.js";
import { consumeFood, type WorldState } from "../world/world.js";
import type { Goal } from "../decision/goals.js";
import type { TraitId } from "../colonist/traits.js";
import type { TaskDefinition, TaskId } from "./tasks.js";

export type ExecutionStatus = "inProgress" | "interrupted" | "completed" | "aborted";

/** One task's execution state. `elapsedTicks` is preserved across interrupt/resume — resuming never restarts. */
export interface Execution {
  readonly taskId: TaskId;
  readonly goalKey: string;
  readonly status: ExecutionStatus;
  readonly startedAtTick: number;
  readonly elapsedTicks: number;
}

/** Begins executing a resolved, executable task for its serving goal. */
export function beginExecution(task: TaskDefinition, goal: Goal, currentTick: number): Execution {
  return {
    taskId: task.id,
    goalKey: goal.key,
    status: "inProgress",
    startedAtTick: currentTick,
    elapsedTicks: 0,
  };
}

function transition(execution: Execution, to: ExecutionStatus, allowedFrom: readonly ExecutionStatus[]): Execution {
  if (!allowedFrom.includes(execution.status)) {
    throw new Error(`Cannot transition execution from "${execution.status}" to "${to}"`);
  }
  return { ...execution, status: to };
}

/** Advances progress on an in-progress execution. Pure; `deltaTicks` must be a non-negative integer. */
export function progressExecution(execution: Execution, deltaTicks: number): Execution {
  if (execution.status !== "inProgress") {
    throw new Error(`Cannot progress execution in status "${execution.status}"`);
  }
  if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
    throw new Error(`deltaTicks must be a non-negative integer, got ${deltaTicks}`);
  }
  return { ...execution, elapsedTicks: execution.elapsedTicks + deltaTicks };
}

/** InProgress → Completed. */
export function completeExecution(execution: Execution): Execution {
  return transition(execution, "completed", ["inProgress"]);
}

/** InProgress → Interrupted (a higher-priority condition preempted this task — goal-system suspend model). */
export function interruptExecution(execution: Execution): Execution {
  return transition(execution, "interrupted", ["inProgress"]);
}

/** Interrupted → InProgress. `elapsedTicks` is untouched — resuming continues, never restarts. */
export function resumeExecution(execution: Execution): Execution {
  return transition(execution, "inProgress", ["interrupted"]);
}

/** InProgress or Interrupted → Aborted (the task's goal was abandoned, or its task became unavailable mid-run). */
export function abortExecution(execution: Execution): Execution {
  return transition(execution, "aborted", ["inProgress", "interrupted"]);
}

/**
 * The consequence of one span of progress on a task — updated needs and/or world state, or
 * neither. Only satisfaction tasks (eat, rest) produce a consequence in Stage 1; assignment
 * and transitIdle tasks progress without a direct need/world effect (Purpose crediting from
 * completed assignment work is ADR-17 D9 territory not yet wired to any task — see report).
 */
export interface ExecutionConsequences {
  readonly needs?: NeedsState;
  readonly world?: WorldState;
}

/**
 * Applies exactly the consequence `taskId`'s own definition owns for `deltaTicks` of progress.
 * Pure: returns new needs/world state, never mutates inputs. This is the only function in the
 * task/execution layer that writes to NeedsState or WorldState — resolveTask (tasks.ts) only
 * ever reads through WorldSnapshot.
 *
 * `traits` is threaded into every restoration call so ADR-17 D7's trait-shifted threshold
 * applies consistently here too (Copilot-confirmed defect: restoreNeed was previously called
 * with no traits at all, so a "driven" colonist's Rest low-threshold shift was honored by need
 * generation and stress evaluation but silently ignored by consequence application — leaving
 * `ticksBelowLow` retracked against the wrong threshold and the Rest amplifier able to stay
 * engaged past the point the colonist's own trait-shifted threshold says they're no longer low).
 */
export function applyProgressConsequences(
  taskId: TaskId,
  needs: NeedsState,
  world: WorldState,
  deltaTicks: number,
  traits: readonly TraitId[] = [],
): ExecutionConsequences {
  switch (taskId) {
    case "eatAtFoodStation": {
      // Restoration is scaled to the food ACTUALLY consumed, not to the full tick span
      // regardless of stock (Copilot-confirmed defect: previously, once stock ran out mid-span,
      // consumption correctly capped at the remaining stock but restoration still applied the
      // full `deltaTicks` worth — including a full restoration for zero food once stock hit
      // zero). `restorationFraction` is exactly the proportion of a full tick's consumption
      // this span could actually afford.
      const fullConsumption = TASK_TUNING.foodConsumptionPerTick * deltaTicks;
      const consumed = Math.min(world.foodStock, fullConsumption);
      const restorationFraction = fullConsumption > 0 ? consumed / fullConsumption : 0;
      return {
        needs: restoreNeedByAmount(needs, "hunger", NEED_TUNING.hunger.restorePerTick * deltaTicks * restorationFraction, traits),
        world: consumeFood(world, consumed),
      };
    }
    case "restAtBunk":
      return { needs: restoreNeed(needs, "rest", deltaTicks, traits) };
    case "workAtWorkstation":
    case "idlePresence":
      return {};
  }
}
