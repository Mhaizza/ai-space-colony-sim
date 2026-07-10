// M9 — Memory System. One bounded pool per colonist; involuntary formation
// on significance; impact fixed at formation; influence = recency x impact;
// eviction by lowest influence. Serves match-and-tilt queries to M11.
// [engineering-specification.md §2 M9; memory-system.md; ADR-16; locked #18-19]

import { MEMORY_CALIBRATION, WEIGHT_CALIBRATION } from "./calibration.js";
import type { ColonistState, MemoryEntry, MemoryImpact, MemoryType, SimTime } from "./types.js";

let memorySequence = 0;
function nextMemoryId(): string {
  memorySequence += 1;
  return `mem-${memorySequence}`;
}

/** Reset the id sequence — test/replay determinism helper only. */
export function resetMemoryIdSequence(): void {
  memorySequence = 0;
}

export interface MemoryFormationInput {
  readonly type: MemoryType;
  readonly impact: MemoryImpact;
  readonly description: string;
  readonly personId?: string;
  readonly needKind?: MemoryEntry["needKind"];
  readonly situationKind?: string;
}

/** Pure: a memory's current influence weight — recency x impact, referenced not redefined. [ADR-16] */
export function memoryInfluence(entry: MemoryEntry, now: SimTime): number {
  const halfLife = MEMORY_CALIBRATION.recencyHalfLifeSecondsByImpact[entry.impact];
  const age = Math.max(0, now - entry.formedAt);
  return Math.pow(2, -age / halfLife);
}

/**
 * Impure: forms a new memory involuntarily. If the pool is full, evicts the
 * lowest-influence entry (not the oldest) to make room. [ADR-16 eviction rule]
 */
export function formMemory(colonist: ColonistState, input: MemoryFormationInput, now: SimTime): MemoryEntry {
  const entry: MemoryEntry = {
    id: nextMemoryId(),
    type: input.type,
    formedAt: now,
    impact: input.impact,
    description: input.description,
    ...(input.personId !== undefined ? { personId: input.personId } : {}),
    ...(input.needKind !== undefined ? { needKind: input.needKind } : {}),
    ...(input.situationKind !== undefined ? { situationKind: input.situationKind } : {}),
  };

  colonist.memoryPool.push(entry);
  if (colonist.memoryPool.length > MEMORY_CALIBRATION.poolSize) {
    evictLowestInfluence(colonist, now);
  }
  return entry;
}

export function evictLowestInfluence(colonist: ColonistState, now: SimTime): void {
  if (colonist.memoryPool.length === 0) return;
  let lowestIndex = 0;
  let lowestInfluence = Infinity;
  colonist.memoryPool.forEach((entry, i) => {
    const influence = memoryInfluence(entry, now);
    if (influence < lowestInfluence) {
      lowestInfluence = influence;
      lowestIndex = i;
    }
  });
  colonist.memoryPool.splice(lowestIndex, 1);
}

export interface MemoryMatchQuery {
  readonly personId?: string;
  readonly needKind?: MemoryEntry["needKind"];
  readonly situationKind?: string;
}

function matches(entry: MemoryEntry, query: MemoryMatchQuery): boolean {
  if (query.personId !== undefined) return entry.personId === query.personId;
  if (query.needKind !== undefined) return entry.needKind === query.needKind;
  if (query.situationKind !== undefined) return entry.situationKind === query.situationKind;
  return false;
}

/**
 * Pure-ish (reads pool, no mutation): the memory family's weight-tilt
 * contribution — proportional to matching memories' current influence.
 * Memory never adds or vetoes candidates; it tilts what is already on the
 * table. [decision-loop.md §8]
 */
export function memoryWeightTilt(colonist: ColonistState, query: MemoryMatchQuery, now: SimTime): number {
  const matching = colonist.memoryPool.filter((e) => matches(e, query));
  const totalInfluence = matching.reduce((sum, e) => sum + memoryInfluence(e, now), 0);
  const { memoryTiltMagnitude, maxFamilyContributionFraction } = WEIGHT_CALIBRATION;
  return Math.min(maxFamilyContributionFraction, totalInfluence * memoryTiltMagnitude);
}

/**
 * Materiality (DQ-D7): memories whose current influence exceeds the
 * calibration threshold are counterfactually relevant enough to name in the
 * explanation surfaces. [decision-loop.md §8]
 */
export function materialMemories(colonist: ColonistState, query: MemoryMatchQuery, now: SimTime): MemoryEntry[] {
  return colonist.memoryPool
    .filter((e) => matches(e, query))
    .filter((e) => memoryInfluence(e, now) >= MEMORY_CALIBRATION.materialityInfluenceThreshold);
}
