// M9 Memory System — ADR-16; memory-system.md. One bounded pool, involuntary formation on
// significance, impact fixed at formation, influence = recency × impact, eviction by lowest
// influence. NOT the event log: bounded and formed only on significant outcomes, never every
// event (memory-system B1). Pure throughout.
//
// Stage 1 realized two of the four closed memory types — Deprivation (need-state significance)
// and Condition (stress significance). Stage 2 build step 7 adds the third — Relational,
// triggered by M10's fact-only relationship consequences (ADR-20 D7: applyInteraction/
// applyAtrophy emit consequences; receivers, including this module, apply their own
// significance rules). This module never reads the relationship store or its history directly
// — considerRelationalFormation takes only the already-computed affinity delta and the other
// colonist's id, exactly as considerConditionFormation takes only a before/after stress delta
// rather than reading StressState's internals. Crisis (needs a crisis system) remains
// structurally represented in MemoryType (config/constants.ts) but this module still never
// produces it — there is no local trigger to form it from yet.
//
// Formation is involuntary and trait-ungated (ADR-16; locked #19): note that neither
// formation function below accepts a TraitId parameter — that omission is the enforcement.

import type { MemoryType, NeedId } from "../config/constants.js";
import { MEMORY_TUNING } from "../config/tuning.js";

/** A Deprivation memory's context: which need's significant deprivation formed it. */
export interface DeprivationContext {
  readonly needId: NeedId;
}

/** A Condition memory's context: which direction the significant stress movement went. */
export interface ConditionContext {
  readonly direction: "rising" | "falling";
}

/** A Relational memory's context: who it's about, and which direction the affinity moved. */
export interface RelationalContext {
  readonly otherId: string;
  readonly direction: "positive" | "negative";
}

type MemoryRecord =
  | { readonly type: Extract<MemoryType, "deprivation">; readonly context: DeprivationContext }
  | { readonly type: Extract<MemoryType, "condition">; readonly context: ConditionContext }
  | { readonly type: Extract<MemoryType, "relational">; readonly context: RelationalContext };

/** One memory entry. `impact` is fixed at formation and never changes afterward (ADR-16). */
export type MemoryEntry = MemoryRecord & {
  readonly id: number;
  readonly formedAtTick: number;
  readonly impact: number;
};

/** The bounded pool — never larger than MEMORY_TUNING.poolSize (enforced by every mutator here). */
export type MemoryPool = readonly MemoryEntry[];

/** Creates an empty memory pool for a newly arrived colonist. */
export function createMemoryPool(): MemoryPool {
  return [];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function nextId(pool: MemoryPool): number {
  return pool.reduce((max, e) => Math.max(max, e.id), -1) + 1;
}

/** recency × impact (ADR-16). Pure; `currentTick` must not precede the entry's formation. */
export function influence(entry: MemoryEntry, currentTick: number): number {
  const age = currentTick - entry.formedAtTick;
  if (age < 0) {
    throw new Error("currentTick must not precede the memory's formation tick");
  }
  const recency = Math.max(0, 1 - MEMORY_TUNING.recencyDecayPerTick * age);
  return recency * entry.impact;
}

/** The decomposed form of `influence` — recency and impact separately named, for explanation surfaces. */
export interface MemoryInfluenceBreakdown {
  readonly entry: MemoryEntry;
  readonly recency: number;
  readonly impact: number;
  readonly influence: number;
}

/** Decomposable influence: recency and impact reported separately, matching decision-loop §8's need. */
export function influenceBreakdown(entry: MemoryEntry, currentTick: number): MemoryInfluenceBreakdown {
  const age = currentTick - entry.formedAtTick;
  if (age < 0) {
    throw new Error("currentTick must not precede the memory's formation tick");
  }
  const recency = Math.max(0, 1 - MEMORY_TUNING.recencyDecayPerTick * age);
  return { entry, recency, impact: entry.impact, influence: recency * entry.impact };
}

/**
 * Evicts the single lowest-influence entry at `currentTick`. Tie-break is deterministic:
 * the lower id (earlier-formed, since ids are assigned in formation order) loses ties —
 * a fixed, stable rule (engineering spec EQ-2's discipline), not an arbitrary one.
 */
function evictLowestInfluence(pool: MemoryPool, currentTick: number): MemoryPool {
  if (pool.length === 0) return pool;
  let worstIndex = 0;
  let worstInfluence = influence(pool[0]!, currentTick);
  for (let i = 1; i < pool.length; i++) {
    const entry = pool[i]!;
    const entryInfluence = influence(entry, currentTick);
    if (entryInfluence < worstInfluence || (entryInfluence === worstInfluence && entry.id < pool[worstIndex]!.id)) {
      worstInfluence = entryInfluence;
      worstIndex = i;
    }
  }
  return [...pool.slice(0, worstIndex), ...pool.slice(worstIndex + 1)];
}

/** Evicts lowest-influence entries until the pool is at or under capacity. Pure. */
function evictToCapacity(pool: MemoryPool, currentTick: number): MemoryPool {
  let result = pool;
  while (result.length > MEMORY_TUNING.poolSize) {
    result = evictLowestInfluence(result, currentTick);
  }
  return result;
}

/**
 * Considers forming a Deprivation memory from a need-level change. Involuntary: forms only
 * when the deprivation (level decrease) meets the significance threshold; returns the pool
 * unchanged otherwise. Impact is fixed at formation from the triggering delta alone.
 */
export function considerDeprivationFormation(
  pool: MemoryPool,
  currentTick: number,
  needId: NeedId,
  levelBefore: number,
  levelAfter: number,
): MemoryPool {
  const deprivationDelta = levelBefore - levelAfter;
  if (deprivationDelta < MEMORY_TUNING.needChangeSignificance) return pool;
  const entry: MemoryEntry = {
    id: nextId(pool),
    type: "deprivation",
    context: { needId },
    formedAtTick: currentTick,
    impact: clamp01(deprivationDelta),
  };
  return evictToCapacity([...pool, entry], currentTick);
}

/**
 * Considers forming a Condition memory from a stress-level change. Involuntary: forms only
 * when the absolute stress movement meets the significance threshold, in either direction.
 */
export function considerConditionFormation(
  pool: MemoryPool,
  currentTick: number,
  stressBefore: number,
  stressAfter: number,
): MemoryPool {
  const delta = stressAfter - stressBefore;
  if (Math.abs(delta) < MEMORY_TUNING.stressChangeSignificance) return pool;
  const entry: MemoryEntry = {
    id: nextId(pool),
    type: "condition",
    context: { direction: delta > 0 ? "rising" : "falling" },
    formedAtTick: currentTick,
    impact: clamp01(Math.abs(delta)),
  };
  return evictToCapacity([...pool, entry], currentTick);
}

/**
 * Considers forming a Relational memory from a relationship consequence's affinity delta
 * (ADR-20 D7: this module is a receiver of M10's fact-only write-path output, never a reader of
 * the relationship store or its history — `affinityDelta` and `otherId` are the only inputs,
 * exactly as `considerConditionFormation` takes only a stress delta). Involuntary: forms only
 * when the absolute affinity movement meets the significance threshold, in either direction.
 * `affinityDelta` is on ADR-12's -100..100 scale; impact is normalized to memory's [0, 1] scale.
 */
export function considerRelationalFormation(
  pool: MemoryPool,
  currentTick: number,
  otherId: string,
  affinityDelta: number,
): MemoryPool {
  if (Math.abs(affinityDelta) < MEMORY_TUNING.relationshipChangeSignificance) return pool;
  const entry: MemoryEntry = {
    id: nextId(pool),
    type: "relational",
    context: { otherId, direction: affinityDelta > 0 ? "positive" : "negative" },
    formedAtTick: currentTick,
    impact: clamp01(Math.abs(affinityDelta) / 100),
  };
  return evictToCapacity([...pool, entry], currentTick);
}
