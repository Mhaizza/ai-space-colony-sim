// M5 Colonist State — the three-layer container (colonist-agent-model; locked #1).
// Stage 1 realizes: stable identity (base traits — the colonist-agent-model places base
// traits in the stable identity layer, fixed at arrival); long-term state (memory pool);
// short-term state (needs, stress, and now the current/suspended goal — the minimal goal
// lifecycle slices decision-loop §10's "stack" requires before task/execution state exists).
// Task and execution state join short-term state in a later build step — adding placeholder
// fields for unbuilt systems now would be scope expansion, not minimalism.
//
// Ownership discipline (locked #2, "no direct writes outside the owning module"): this module
// never computes a need level, evaluates stress, forms a memory, or decides a goal itself.
// withNeeds/withStress/withMemory/withCurrentGoal/withSuspendedGoal only accept state already
// produced by their owning modules — colonist.ts holds state, the owning modules own the
// rules. Base traits have no setter at all: ADR-10 fixes them at arrival, so the only way to
// have them is to pass them to createColonist; nothing in this module ever changes them.

import type { NeedsState } from "./needs.js";
import { createNeeds } from "./needs.js";
import type { MemoryPool } from "./memory.js";
import { createMemoryPool } from "./memory.js";
import type { TraitId } from "./traits.js";
import type { StressState } from "./stress.js";
import { createStress } from "./stress.js";
import type { Goal } from "../decision/goals.js";

/** Stable identity layer: fixed at arrival, does not change (colonist-agent-model). */
export interface ColonistIdentity {
  readonly id: string;
  readonly name: string;
  /** Colonist-owned skills — the colonist's side of the eligibility intersection (locked #2). */
  readonly skills: readonly string[];
  /** Base traits — fixed at arrival (ADR-10); no setter exists anywhere in this module. */
  readonly baseTraits: readonly TraitId[];
}

/**
 * The colonist container: identity (stable), memory (long-term), needs/stress/goal state
 * (short-term). `currentGoal` is the active (or blocked, or completed/abandoned pending
 * clearing) goal; `suspendedGoal` holds at most one interrupted goal awaiting re-decision
 * (goal-system's suspend+re-decide model) — this is the minimal slice of the full goal stack
 * (decision-loop §10) this step needs; queued-goal depth (DQ-D8) remains out of scope.
 */
export interface ColonistState {
  readonly identity: ColonistIdentity;
  readonly needs: NeedsState;
  readonly memory: MemoryPool;
  readonly stress: StressState;
  readonly currentGoal: Goal | null;
  readonly suspendedGoal: Goal | null;
}

/** Creates a colonist at arrival: identity fixed, needs satisfied, memory empty, unstressed, no goal. */
export function createColonist(
  id: string,
  name: string,
  skills: readonly string[] = [],
  baseTraits: readonly TraitId[] = [],
): ColonistState {
  return {
    identity: { id, name, skills: [...skills], baseTraits: [...baseTraits] },
    needs: createNeeds(),
    memory: createMemoryPool(),
    stress: createStress(),
    currentGoal: null,
    suspendedGoal: null,
  };
}

/**
 * Returns a colonist with its needs slice replaced. The only way to change a colonist's
 * needs — and it accepts only a NeedsState already computed by needs.ts, never a level.
 */
export function withNeeds(colonist: ColonistState, needs: NeedsState): ColonistState {
  return { ...colonist, needs };
}

/**
 * Returns a colonist with its memory pool replaced. The only way to change a colonist's
 * memory — and it accepts only a MemoryPool already computed by memory.ts.
 */
export function withMemory(colonist: ColonistState, memory: MemoryPool): ColonistState {
  return { ...colonist, memory };
}

/**
 * Returns a colonist with its stress state replaced. The only way to change a colonist's
 * stress — and it accepts only a StressState already computed by stress.ts.
 */
export function withStress(colonist: ColonistState, stress: StressState): ColonistState {
  return { ...colonist, stress };
}

/**
 * Returns a colonist with its current goal replaced. The only way to change a colonist's
 * current goal — and it accepts only a Goal (or null) already produced by goals.ts/decide.ts.
 */
export function withCurrentGoal(colonist: ColonistState, currentGoal: Goal | null): ColonistState {
  return { ...colonist, currentGoal };
}

/**
 * Returns a colonist with its suspended goal replaced. The only way to change a colonist's
 * suspended goal — and it accepts only a Goal (or null) already produced by goals.ts.
 */
export function withSuspendedGoal(colonist: ColonistState, suspendedGoal: Goal | null): ColonistState {
  return { ...colonist, suspendedGoal };
}
