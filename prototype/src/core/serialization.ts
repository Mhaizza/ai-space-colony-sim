// Core Serialization — engineering spec §7/§8: a versioned save format for the complete Stage 1
// SimulationState. Pure functions only: `serialize`/`deserialize` are string<->object transforms
// with no file-system I/O — reading/writing the string is the caller's job. No migration
// framework beyond outright version rejection: an unsupported `version` throws immediately,
// it is never guessed at or repaired.
//
// Malformed input is always rejected, never silently repaired (locked discipline carried from
// every other module's deserialize function, e.g. clock.ts/prng.ts). This module reuses those
// modules' own deserializers for the fields they own (clock, PRNG) rather than re-validating
// their shape here, and reuses world/policy's own invariant checks (validatePolicy) the same
// way. Once the full state is reassembled, it is handed to tick.ts's validateSimulationState —
// the one place the suspended-pair cross-field invariant is defined — rather than re-deriving
// that check here (no duplicated logic).

import { GOAL_SOURCES, MODULE_IDS, NEEDS, PRIORITY_TIERS, TASK_CLASSES, type ModuleId, type NeedId, type PriorityTier } from "../config/constants.js";
import { deserializeClock } from "./clock.js";
import { deserializePrng } from "./prng.js";
import { validatePolicy, type ShiftPeriod, type ShiftPolicy } from "../world/policy.js";
import type { ModuleState, WorldState } from "../world/world.js";
import type { ColonistIdentity, ColonistState } from "../colonist/colonist.js";
import type { NeedsState, NeedTrack } from "../colonist/needs.js";
import type { MemoryEntry, MemoryPool } from "../colonist/memory.js";
import type { StressState } from "../colonist/stress.js";
import type { TraitId } from "../colonist/traits.js";
import type { WeightTiltContribution } from "../colonist/traits.js";
import type { Goal, GoalStatus } from "../decision/goals.js";
import { type AttributedDraw, type DecisionOutcome } from "../decision/decide.js";
import type { ComposedWeight, MemoryContribution, StressChannel, StressWeightContribution } from "../decision/weights.js";
import type { Execution, ExecutionStatus } from "../task/execution.js";
import type { TaskDefinition, TaskId, TaskResolution } from "../task/tasks.js";
import type { DecisionLog, DecisionRecord, EventLog, EventRecord } from "../records/logs.js";
import { validateSimulationState, type SimulationState, type TickEvent } from "../simulation/tick.js";

/** The current save format version — bump on any incompatible SimulationState shape change. */
export const SAVE_FORMAT_VERSION = 1;

const GOAL_STATUSES: readonly GoalStatus[] = ["active", "suspended", "blocked", "completed", "abandoned"];
const EXECUTION_STATUSES: readonly ExecutionStatus[] = ["inProgress", "interrupted", "completed", "aborted"];
// Closed sets not exported as arrays by their owning modules (only as TS union types) — mirrored
// here for structural validation only. Owning module remains tasks.ts/policy.ts/traits.ts/
// weights.ts; this list must track their type definitions but decides nothing behaviorally.
const TASK_IDS: readonly TaskId[] = ["workAtWorkstation", "eatAtFoodStation", "restAtBunk", "idlePresence"];
const SHIFT_PERIODS: readonly ShiftPeriod[] = ["work", "rest", "free"];
const TRAIT_IDS: readonly TraitId[] = ["driven"];
const STRESS_CHANNELS: readonly StressChannel[] = ["reliefBoost", "demandSuppress"];
const MEMORY_FORMED_TYPES = ["deprivation", "condition"] as const;

function fail(reason: string): never {
  throw new Error(`Invalid save data: ${reason}`);
}

function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`"${field}" must be an object`);
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(`"${field}" must be an array`);
  return value;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string") fail(`"${field}" must be a string`);
  return value;
}

function expectNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`"${field}" must be a finite number`);
  return value;
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(`"${field}" must be a boolean`);
  return value;
}

function expectOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const s = expectString(value, field);
  if (!(allowed as readonly string[]).includes(s)) fail(`"${field}" has unrecognized value "${s}"`);
  return s as T;
}

function expectPriorityTier(value: unknown, field: string): PriorityTier {
  const n = expectNumber(value, field);
  if (!(PRIORITY_TIERS as readonly number[]).includes(n)) fail(`"${field}" has unrecognized value ${n}`);
  return n as PriorityTier;
}

function expectInteger(value: unknown, field: string): number {
  const n = expectNumber(value, field);
  if (!Number.isInteger(n)) fail(`"${field}" must be an integer`);
  return n;
}

function expectNonNegativeInteger(value: unknown, field: string): number {
  const n = expectInteger(value, field);
  if (n < 0) fail(`"${field}" must be non-negative`);
  return n;
}

// --- World ---

function readWorld(raw: unknown): WorldState {
  const o = expectObject(raw, "world");
  const modulesRaw = expectObject(o.modules, "world.modules");
  const modules = {} as Record<ModuleId, ModuleState>;
  for (const id of MODULE_IDS) {
    const m = expectObject(modulesRaw[id], `world.modules.${id}`);
    modules[id] = { id, functional: expectBoolean(m.functional, `world.modules.${id}.functional`) };
  }
  return { modules, foodStock: expectNumber(o.foodStock, "world.foodStock") };
}

// --- Policy ---

function readPolicy(raw: unknown): ShiftPolicy {
  const o = expectObject(raw, "policy");
  const policy: ShiftPolicy = {
    workTicks: expectNumber(o.workTicks, "policy.workTicks"),
    restTicks: expectNumber(o.restTicks, "policy.restTicks"),
    freeTicks: expectNumber(o.freeTicks, "policy.freeTicks"),
  };
  validatePolicy(policy); // reuses policy.ts's own invariant check rather than re-deriving it
  return policy;
}

// --- Colonist ---

function readNeeds(raw: unknown): NeedsState {
  const o = expectObject(raw, "colonist.needs");
  const needs = {} as Record<NeedId, NeedTrack>;
  for (const id of NEEDS) {
    const t = expectObject(o[id], `colonist.needs.${id}`);
    needs[id] = {
      level: expectNumber(t.level, `colonist.needs.${id}.level`),
      ticksBelowLow: expectNumber(t.ticksBelowLow, `colonist.needs.${id}.ticksBelowLow`),
    };
  }
  return needs;
}

function readMemory(raw: unknown): MemoryPool {
  return expectArray(raw, "colonist.memory").map((entryRaw, i): MemoryEntry => {
    const o = expectObject(entryRaw, `colonist.memory[${i}]`);
    const type = expectOneOf(o.type, ["deprivation", "condition"] as const, `colonist.memory[${i}].type`);
    const context = expectObject(o.context, `colonist.memory[${i}].context`);
    const base = {
      id: expectNumber(o.id, `colonist.memory[${i}].id`),
      formedAtTick: expectNumber(o.formedAtTick, `colonist.memory[${i}].formedAtTick`),
      impact: expectNumber(o.impact, `colonist.memory[${i}].impact`),
    };
    if (type === "deprivation") {
      return { ...base, type, context: { needId: expectOneOf(context.needId, NEEDS, `colonist.memory[${i}].context.needId`) } };
    }
    return { ...base, type, context: { direction: expectOneOf(context.direction, ["rising", "falling"] as const, `colonist.memory[${i}].context.direction`) } };
  });
}

function readStress(raw: unknown): StressState {
  const o = expectObject(raw, "colonist.stress");
  return { level: expectNumber(o.level, "colonist.stress.level") };
}

function readGoal(raw: unknown, field: string): Goal {
  const o = expectObject(raw, field);
  const source = expectOneOf(o.source, GOAL_SOURCES, `${field}.source`);
  return {
    source,
    tier: expectPriorityTier(o.tier, `${field}.tier`),
    key: expectString(o.key, `${field}.key`),
    relatedNeed: o.relatedNeed === undefined ? undefined : expectOneOf(o.relatedNeed, NEEDS, `${field}.relatedNeed`),
    status: expectOneOf(o.status, GOAL_STATUSES, `${field}.status`),
    motivation: expectString(o.motivation, `${field}.motivation`),
    adoptedAtTick: expectNonNegativeInteger(o.adoptedAtTick, `${field}.adoptedAtTick`),
  };
}

function readNullableGoal(raw: unknown, field: string): Goal | null {
  return raw === null ? null : readGoal(raw, field);
}

function readIdentity(raw: unknown): ColonistIdentity {
  const o = expectObject(raw, "colonist.identity");
  const skills = expectArray(o.skills, "colonist.identity.skills").map((s, i) => expectString(s, `colonist.identity.skills[${i}]`));
  const baseTraits = expectArray(o.baseTraits, "colonist.identity.baseTraits").map(
    (t, i) => expectString(t, `colonist.identity.baseTraits[${i}]`) as TraitId,
  );
  return {
    id: expectString(o.id, "colonist.identity.id"),
    name: expectString(o.name, "colonist.identity.name"),
    skills,
    baseTraits,
  };
}

function readColonist(raw: unknown): ColonistState {
  const o = expectObject(raw, "colonist");
  return {
    identity: readIdentity(o.identity),
    needs: readNeeds(o.needs),
    memory: readMemory(o.memory),
    stress: readStress(o.stress),
    currentGoal: readNullableGoal(o.currentGoal, "colonist.currentGoal"),
    suspendedGoal: readNullableGoal(o.suspendedGoal, "colonist.suspendedGoal"),
  };
}

// --- Execution ---

function readExecution(raw: unknown, field: string): Execution {
  const o = expectObject(raw, field);
  return {
    taskId: expectOneOf(o.taskId, TASK_IDS, `${field}.taskId`),
    goalKey: expectString(o.goalKey, `${field}.goalKey`),
    status: expectOneOf(o.status, EXECUTION_STATUSES, `${field}.status`),
    startedAtTick: expectNonNegativeInteger(o.startedAtTick, `${field}.startedAtTick`),
    elapsedTicks: expectNonNegativeInteger(o.elapsedTicks, `${field}.elapsedTicks`),
  };
}

function readNullableExecution(raw: unknown, field: string): Execution | null {
  return raw === null ? null : readExecution(raw, field);
}

// --- Deprivation baselines / stress baseline ---

function readDeprivationBaselines(raw: unknown): Readonly<Record<NeedId, number>> {
  const o = expectObject(raw, "deprivationBaselines");
  const result = {} as Record<NeedId, number>;
  for (const id of NEEDS) {
    result[id] = expectNumber(o[id], `deprivationBaselines.${id}`);
  }
  return result;
}

// --- Task resolution (nested inside a "taskResolution" TickEvent) ---

function readTaskDefinition(raw: unknown, field: string): TaskDefinition {
  const o = expectObject(raw, field);
  const moduleId = o.moduleId === null ? null : expectOneOf(o.moduleId, MODULE_IDS, `${field}.moduleId`);
  return {
    id: expectOneOf(o.id, TASK_IDS, `${field}.id`),
    taskClass: expectOneOf(o.taskClass, TASK_CLASSES, `${field}.taskClass`),
    moduleId,
    requiredSkill: o.requiredSkill === undefined ? undefined : expectString(o.requiredSkill, `${field}.requiredSkill`),
  };
}

function readTaskResolution(raw: unknown, field: string): TaskResolution {
  const o = expectObject(raw, field);
  const kind = expectOneOf(o.kind, ["executable", "blocked"] as const, `${field}.kind`);
  if (kind === "executable") {
    return { kind: "executable", task: readTaskDefinition(o.task, `${field}.task`), goal: readGoal(o.goal, `${field}.goal`) };
  }
  return {
    kind: "blocked",
    goal: readGoal(o.goal, `${field}.goal`),
    reasons: expectArray(o.reasons, `${field}.reasons`).map((r, i) => expectString(r, `${field}.reasons[${i}]`)),
  };
}

// --- Decision decomposition (nested inside a "decision" TickEvent) — structure only; this
// never recomputes a decision or re-derives which candidate should have won, it only checks
// that the retained decomposition/attribution has the shape decide.ts/weights.ts define. ---

function readAttributedDraw(raw: unknown, field: string): AttributedDraw {
  const o = expectObject(raw, field);
  const value = expectNumber(o.value, `${field}.value`);
  if (value < 0 || value >= 1) fail(`"${field}.value" must be in [0, 1) — the PRNG draw contract (S1)`);
  return {
    purpose: expectString(o.purpose, `${field}.purpose`),
    value,
    stateBefore: deserializePrng(JSON.stringify(o.stateBefore)), // reuses prng.ts's own validation
    stateAfter: deserializePrng(JSON.stringify(o.stateAfter)),
  };
}

function readComposedWeight(raw: unknown, field: string): ComposedWeight {
  const o = expectObject(raw, field);
  const traitContributions: WeightTiltContribution[] = expectArray(o.traitContributions, `${field}.traitContributions`).map((c, i) => {
    const co = expectObject(c, `${field}.traitContributions[${i}]`);
    return {
      traitId: expectOneOf(co.traitId, TRAIT_IDS, `${field}.traitContributions[${i}].traitId`),
      tilt: expectNumber(co.tilt, `${field}.traitContributions[${i}].tilt`),
    };
  });
  const memoryContributions: MemoryContribution[] = expectArray(o.memoryContributions, `${field}.memoryContributions`).map((c, i) => {
    const co = expectObject(c, `${field}.memoryContributions[${i}]`);
    return {
      memoryId: expectNonNegativeInteger(co.memoryId, `${field}.memoryContributions[${i}].memoryId`),
      influence: expectNumber(co.influence, `${field}.memoryContributions[${i}].influence`),
    };
  });
  const stressContributions: StressWeightContribution[] = expectArray(o.stressContributions, `${field}.stressContributions`).map((c, i) => {
    const co = expectObject(c, `${field}.stressContributions[${i}]`);
    return {
      channel: expectOneOf(co.channel, STRESS_CHANNELS, `${field}.stressContributions[${i}].channel`),
      tilt: expectNumber(co.tilt, `${field}.stressContributions[${i}].tilt`),
    };
  });
  return {
    key: expectString(o.key, `${field}.key`),
    source: expectOneOf(o.source, GOAL_SOURCES, `${field}.source`),
    tier: expectPriorityTier(o.tier, `${field}.tier`),
    base: expectNumber(o.base, `${field}.base`),
    traits: expectNumber(o.traits, `${field}.traits`),
    memory: expectNumber(o.memory, `${field}.memory`),
    stress: expectNumber(o.stress, `${field}.stress`),
    relationships: expectNumber(o.relationships, `${field}.relationships`),
    composed: expectNumber(o.composed, `${field}.composed`),
    traitContributions,
    memoryContributions,
    stressContributions,
  };
}

function readDecisionOutcome(raw: unknown, field: string): DecisionOutcome {
  const o = expectObject(raw, field);
  const kind = expectOneOf(o.kind, ["commit", "blocked"] as const, `${field}.kind`);
  const draws = expectArray(o.draws, `${field}.draws`).map((d, i) => readAttributedDraw(d, `${field}.draws[${i}]`));
  const prngState = deserializePrng(JSON.stringify(o.prngState));

  if (kind === "blocked") {
    if (draws.length !== 0) fail(`"${field}.draws" must be empty for a blocked outcome`);
    return { kind: "blocked", draws: [], prngState };
  }

  return {
    kind: "commit",
    goal: readGoal(o.goal, `${field}.goal`),
    winningTier: expectPriorityTier(o.winningTier, `${field}.winningTier`),
    composedWeights: expectArray(o.composedWeights, `${field}.composedWeights`).map((w, i) =>
      readComposedWeight(w, `${field}.composedWeights[${i}]`),
    ),
    draws,
    prngState,
  };
}

// --- TickEvent — one structural validator per closed union variant (tick.ts owns the union
// itself; this only checks that a saved event has the shape its own `kind` promises). ---

function readTickEvent(raw: unknown, field: string): TickEvent {
  const o = expectObject(raw, field);
  const kind = expectString(o.kind, `${field}.kind`);
  switch (kind) {
    case "bootstrap":
      return { kind: "bootstrap" };
    case "needThresholdCrossing":
      return {
        kind: "needThresholdCrossing",
        needId: expectOneOf(o.needId, NEEDS, `${field}.needId`),
        severity: expectOneOf(o.severity, ["low", "critical"] as const, `${field}.severity`),
      };
    case "shiftBoundary":
      return {
        kind: "shiftBoundary",
        from: expectOneOf(o.from, SHIFT_PERIODS, `${field}.from`),
        to: expectOneOf(o.to, SHIFT_PERIODS, `${field}.to`),
      };
    case "completion":
      return {
        kind: "completion",
        goalKey: expectString(o.goalKey, `${field}.goalKey`),
        taskId: expectOneOf(o.taskId, TASK_IDS, `${field}.taskId`),
      };
    case "blockage":
      return {
        kind: "blockage",
        goalKey: expectString(o.goalKey, `${field}.goalKey`),
        reasons: expectArray(o.reasons, `${field}.reasons`).map((r, i) => expectString(r, `${field}.reasons[${i}]`)),
      };
    case "higherPriorityCondition":
      return {
        kind: "higherPriorityCondition",
        interruptedGoalKey: expectString(o.interruptedGoalKey, `${field}.interruptedGoalKey`),
        interruptedTier: expectPriorityTier(o.interruptedTier, `${field}.interruptedTier`),
      };
    case "suspensionResolved":
      return { kind: "suspensionResolved", goalKey: expectString(o.goalKey, `${field}.goalKey`) };
    case "suspensionOverflow":
      return {
        kind: "suspensionOverflow",
        abandonedGoalKey: expectString(o.abandonedGoalKey, `${field}.abandonedGoalKey`),
        abandonedExecutionTaskId:
          o.abandonedExecutionTaskId === null ? null : expectOneOf(o.abandonedExecutionTaskId, TASK_IDS, `${field}.abandonedExecutionTaskId`),
      };
    case "executionInterrupted":
      return {
        kind: "executionInterrupted",
        taskId: expectOneOf(o.taskId, TASK_IDS, `${field}.taskId`),
        goalKey: expectString(o.goalKey, `${field}.goalKey`),
      };
    case "executionAborted":
      return {
        kind: "executionAborted",
        taskId: expectOneOf(o.taskId, TASK_IDS, `${field}.taskId`),
        goalKey: expectString(o.goalKey, `${field}.goalKey`),
      };
    case "executionProgressed":
      return {
        kind: "executionProgressed",
        taskId: expectOneOf(o.taskId, TASK_IDS, `${field}.taskId`),
        elapsedTicks: expectNonNegativeInteger(o.elapsedTicks, `${field}.elapsedTicks`),
      };
    case "executionBegun":
      return {
        kind: "executionBegun",
        taskId: expectOneOf(o.taskId, TASK_IDS, `${field}.taskId`),
        goalKey: expectString(o.goalKey, `${field}.goalKey`),
      };
    case "executionResumed":
      return {
        kind: "executionResumed",
        taskId: expectOneOf(o.taskId, TASK_IDS, `${field}.taskId`),
        goalKey: expectString(o.goalKey, `${field}.goalKey`),
        elapsedTicks: expectNonNegativeInteger(o.elapsedTicks, `${field}.elapsedTicks`),
      };
    case "decision":
      return { kind: "decision", outcome: readDecisionOutcome(o.outcome, `${field}.outcome`) };
    case "taskResolution":
      return { kind: "taskResolution", resolution: readTaskResolution(o.resolution, `${field}.resolution`) };
    case "memoryFormed":
      return {
        kind: "memoryFormed",
        memoryType: expectOneOf(o.memoryType, MEMORY_FORMED_TYPES, `${field}.memoryType`),
        needId: o.needId === undefined ? undefined : expectOneOf(o.needId, NEEDS, `${field}.needId`),
      };
    default:
      return fail(`"${field}.kind" has unrecognized value "${kind}"`);
  }
}

// --- Records (append-only logs). Wrapper invariants (per the append-only contract in
// records/logs.ts: seq assigned by append order starting at 0, tick monotonically
// non-decreasing within one log) are enforced here, alongside full structural validation of
// each record's payload via readTickEvent/readDecisionOutcome above — a corrupted or
// hand-edited payload is rejected exactly like a corrupted top-level field. ---

function readEventLog(raw: unknown): EventLog {
  const entries = expectArray(raw, "eventLog");
  let previousTick = -1;
  return entries.map((entryRaw, i): EventRecord => {
    const field = `eventLog[${i}]`;
    const o = expectObject(entryRaw, field);
    const seq = expectNonNegativeInteger(o.seq, `${field}.seq`);
    if (seq !== i) fail(`"${field}.seq" must be contiguous and start at 0 (expected ${i}, got ${seq})`);
    const tick = expectNonNegativeInteger(o.tick, `${field}.tick`);
    if (tick < previousTick) fail(`"${field}.tick" must not decrease (got ${tick} after ${previousTick})`);
    previousTick = tick;
    return { seq, tick, event: readTickEvent(o.event, `${field}.event`) };
  });
}

function readDecisionLog(raw: unknown): DecisionLog {
  const entries = expectArray(raw, "decisionLog");
  let previousTick = -1;
  return entries.map((entryRaw, i): DecisionRecord => {
    const field = `decisionLog[${i}]`;
    const o = expectObject(entryRaw, field);
    const seq = expectNonNegativeInteger(o.seq, `${field}.seq`);
    if (seq !== i) fail(`"${field}.seq" must be contiguous and start at 0 (expected ${i}, got ${seq})`);
    const tick = expectNonNegativeInteger(o.tick, `${field}.tick`);
    if (tick < previousTick) fail(`"${field}.tick" must not decrease (got ${tick} after ${previousTick})`);
    previousTick = tick;
    return { seq, tick, outcome: readDecisionOutcome(o.outcome, `${field}.outcome`) };
  });
}

// --- Top level ---

/**
 * Serializes the complete Stage 1 SimulationState to a JSON string, under a versioned header.
 * Pure: no file-system I/O — writing the returned string anywhere is the caller's job.
 */
export function serialize(state: SimulationState): string {
  return JSON.stringify({
    version: SAVE_FORMAT_VERSION,
    clock: state.clock,
    world: state.world,
    policy: state.policy,
    colonist: state.colonist,
    execution: state.execution,
    suspendedExecution: state.suspendedExecution,
    prng: state.prng,
    deprivationBaselines: state.deprivationBaselines,
    stressBaseline: state.stressBaseline,
    eventLog: state.eventLog,
    decisionLog: state.decisionLog,
  });
}

/**
 * Restores a SimulationState from a save string. Rejects an unsupported version outright (no
 * migration framework) and rejects any structurally malformed field rather than repairing it.
 * Reuses validateSimulationState (tick.ts) as the final cross-field check — the suspended-pair
 * invariant is defined there, once, and never re-derived here.
 */
export function deserialize(json: string): SimulationState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    fail("not valid JSON");
  }
  const o = expectObject(raw, "<root>");

  const version = expectNumber(o.version, "version");
  if (version !== SAVE_FORMAT_VERSION) {
    throw new Error(`Unsupported save format version: ${version} (expected ${SAVE_FORMAT_VERSION})`);
  }

  const state: SimulationState = {
    clock: deserializeClock(JSON.stringify(o.clock)),
    world: readWorld(o.world),
    policy: readPolicy(o.policy),
    colonist: readColonist(o.colonist),
    execution: readNullableExecution(o.execution, "execution"),
    suspendedExecution: readNullableExecution(o.suspendedExecution, "suspendedExecution"),
    prng: deserializePrng(JSON.stringify(o.prng)),
    deprivationBaselines: readDeprivationBaselines(o.deprivationBaselines),
    stressBaseline: expectNumber(o.stressBaseline, "stressBaseline"),
    eventLog: readEventLog(o.eventLog),
    decisionLog: readDecisionLog(o.decisionLog),
  };

  validateSimulationState(state);
  return state;
}
