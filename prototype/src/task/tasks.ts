// M12 Task & Execution System — task vocabulary and goal→task resolution. decision-loop §5
// (task classes, eligibility = skill ∩ permission ∩ requirement, availability from the
// snapshot); DQ-D4's Stage 1 portion (concrete task content within the five closed classes).
// Pure throughout. Reads world information only through WorldSnapshot — never live World —
// matching the perception discipline carried from decision-loop §1b / Build Step 6.
//
// "Task resolution owns executability": this module decides executable vs. blocked. It never
// decides *which goal* to pursue (decide.ts's job) and never executes anything (execution.ts's
// job) — resolveTask consumes an already-committed Goal and reports what task-layer facts say
// about it.

import type { GoalSource, ModuleId, NeedId, TaskClass } from "../config/constants.js";
import { blockGoal, type Goal } from "../decision/goals.js";
import { isPermitted } from "../world/policy.js";
import type { WorldSnapshot } from "../world/snapshot.js";

/** Stage 1's concrete task vocabulary — content within the five closed task classes (DQ-D4). */
export type TaskId = "workAtWorkstation" | "eatAtFoodStation" | "restAtBunk" | "idlePresence";

/** One task's definition: its class, the module it runs in (if any), and what it requires. */
export interface TaskDefinition {
  readonly id: TaskId;
  readonly taskClass: TaskClass;
  readonly moduleId: ModuleId | null;
  /** The task's side of the eligibility intersection (locked #2). Undefined = no skill required. */
  readonly requiredSkill?: string;
}

const TASKS: Readonly<Record<TaskId, TaskDefinition>> = {
  workAtWorkstation: { id: "workAtWorkstation", taskClass: "assignment", moduleId: "workstation" },
  eatAtFoodStation: { id: "eatAtFoodStation", taskClass: "satisfaction", moduleId: "foodStation" },
  restAtBunk: { id: "restAtBunk", taskClass: "satisfaction", moduleId: "restBunk" },
  idlePresence: { id: "idlePresence", taskClass: "transitIdle", moduleId: null },
};

/** Looks up a task's definition by id. */
export function taskDefinition(id: TaskId): TaskDefinition {
  return TASKS[id];
}

/**
 * The candidate task ids that could serve a goal, by source (and, for need-driven sources,
 * by which need). Closed and structural for Stage 1: Safety, Social, and Purpose have no
 * serving task here — Safety and Purpose are satisfied by conditions, not an action (ADR-17
 * D9); Social's action vocabulary is entirely ADR-18, not built yet. A lowNeed goal for any
 * of those three correctly finds no task and resolves to blocked — this is the architecturally
 * expected "Social is unsatisfiable at 1 colonist" shape, not a gap to paper over.
 */
function candidateTaskIdsFor(source: GoalSource, relatedNeed: NeedId | undefined): readonly TaskId[] {
  switch (source) {
    case "shiftAssignment":
      return ["workAtWorkstation"];
    case "voluntary":
      return ["idlePresence"];
    case "criticalNeed":
    case "lowNeed":
      if (relatedNeed === "hunger") return ["eatAtFoodStation"];
      if (relatedNeed === "rest") return ["restAtBunk"];
      return [];
    case "survivalCondition":
      // Response-class tasks are undefined in Stage 1 (no survival conditions exist to
      // respond to yet — mirrors goals.ts's generateSurvivalCandidates staying empty).
      return [];
    default:
      return [];
  }
}

/** One eligibility check's outcome, with named reasons for decomposability. */
export interface TaskEligibility {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

/** Eligibility = colonist skill ∩ policy permission ∩ task requirement (locked #2). */
export function checkEligibility(task: TaskDefinition, skills: readonly string[], snapshot: WorldSnapshot): TaskEligibility {
  const reasons: string[] = [];
  if (task.requiredSkill !== undefined && !skills.includes(task.requiredSkill)) {
    reasons.push(`missing required skill: ${task.requiredSkill}`);
  }
  if (!isPermitted(snapshot.effectivePolicy)) {
    reasons.push("not permitted by policy");
  }
  return { eligible: reasons.length === 0, reasons };
}

/** One availability check's outcome, with named reasons for decomposability. */
export interface TaskAvailability {
  readonly available: boolean;
  readonly reasons: readonly string[];
}

/** Availability = the world cooperates: module functional, resource present (decision-loop §5). */
export function checkAvailability(task: TaskDefinition, snapshot: WorldSnapshot): TaskAvailability {
  const reasons: string[] = [];
  if (task.moduleId !== null) {
    const module = snapshot.modules[task.moduleId];
    if (!module.functional) {
      reasons.push(`module ${task.moduleId} not functional`);
    }
  }
  if (task.id === "eatAtFoodStation" && snapshot.foodStock <= 0) {
    reasons.push("no food stock");
  }
  return { available: reasons.length === 0, reasons };
}

/** The outcome of resolving a goal to a task: either an executable task, or a blocked goal. */
export type TaskResolution =
  | { readonly kind: "executable"; readonly task: TaskDefinition; readonly goal: Goal }
  | { readonly kind: "blocked"; readonly goal: Goal; readonly reasons: readonly string[] };

/**
 * Resolves a committed, active goal to a concrete task. Pure; requires `goal.status ===
 * "active"` (resolving a suspended/blocked/completed/abandoned goal is a caller error).
 *
 * "Blocked goals originate from task resolution, not decision generation": this is the ONLY
 * place in the codebase that calls blockGoal — decide.ts never does (Build Step 6's
 * decideFromCandidates always commits goals as "active"; it has no concept of task
 * availability). When no candidate task serves the goal, or every candidate task is
 * ineligible/unavailable, this function — and only this function — transitions the goal to
 * blocked, with the transition's reasons pointing back at exactly which tasks failed and why.
 */
export function resolveTask(goal: Goal, skills: readonly string[], snapshot: WorldSnapshot): TaskResolution {
  if (goal.status !== "active") {
    throw new Error(`resolveTask requires an active goal, got status "${goal.status}"`);
  }

  const candidateIds = [...candidateTaskIdsFor(goal.source, goal.relatedNeed)].sort(); // stable order (EQ-2)
  if (candidateIds.length === 0) {
    return {
      kind: "blocked",
      goal: blockGoal(goal),
      reasons: [
        `no task class serves goal source "${goal.source}"${goal.relatedNeed ? ` for need "${goal.relatedNeed}"` : ""}`,
      ],
    };
  }

  const allReasons: string[] = [];
  for (const id of candidateIds) {
    const task = TASKS[id];
    const eligibility = checkEligibility(task, skills, snapshot);
    const availability = checkAvailability(task, snapshot);
    if (eligibility.eligible && availability.available) {
      return { kind: "executable", task, goal };
    }
    allReasons.push(...eligibility.reasons.map((r) => `${id}: ${r}`), ...availability.reasons.map((r) => `${id}: ${r}`));
  }

  return { kind: "blocked", goal: blockGoal(goal), reasons: allReasons };
}

/**
 * Whether a task's serving goal is complete (decision-loop §10's completion criteria, as far
 * as they are observable without a full tick/shift-boundary system): need goals complete when
 * their related need is restored past its satisfaction point (ADR-17 D3's hysteresis point,
 * queried via needs.ts — not redefined here); shift-assignment and voluntary goals complete at
 * their period's boundary, read from the snapshot (a proxy for ADR-02's shift-boundary
 * condition until tick.ts owns full condition detection).
 */
export function isTaskComplete(
  taskId: TaskId,
  needSatisfied: (needId: NeedId) => boolean,
  snapshot: WorldSnapshot,
): boolean {
  switch (taskId) {
    case "eatAtFoodStation":
      return needSatisfied("hunger");
    case "restAtBunk":
      return needSatisfied("rest");
    case "workAtWorkstation":
      return snapshot.currentPeriod !== "work";
    case "idlePresence":
      return snapshot.currentPeriod !== "free";
  }
}
