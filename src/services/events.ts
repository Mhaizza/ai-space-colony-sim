// S2 — Event & Record Service (Stage 1 scope).
// Owns the permanent world event log and the decision log with decomposed
// causes. Crisis stage detection (ADR-15) and story-event detection (ADR-08)
// are out of Stage-1 scope (single colonist, no multi-condition crises to
// stage) — filed as a follow-up when world conditions become non-trivial.
// [engineering-specification.md §1 S2; ADR-14]

import type { NeedKind, PriorityTier, StressSource } from "../sim/types.js";

export interface EventLogEntry {
  readonly time: number;
  readonly kind: string;
  readonly description: string;
}

/**
 * The decomposed weight contribution of one family for one candidate.
 * Decomposability is a structural requirement, not a UI afterthought.
 * [decision-loop.md §6 constraint 3]
 */
export interface WeightDecomposition {
  readonly base: number;
  readonly traits: number;
  readonly relationships: number;
  readonly memory: number;
  readonly stress: number;
  readonly total: number;
}

export interface DecisionLogEntry {
  readonly time: number;
  readonly colonistId: string;
  readonly source: string;
  readonly tier: PriorityTier;
  readonly motivation: string;
  readonly taskId: string;
  readonly decomposition: WeightDecomposition;
  readonly materialMemoryIds: readonly string[];
  readonly stochastic: boolean;
}

export interface EventRecord {
  readonly events: EventLogEntry[];
  readonly decisions: DecisionLogEntry[];
}

export function createEventRecord(): EventRecord {
  return { events: [], decisions: [] };
}

export function logEvent(record: EventRecord, entry: EventLogEntry): void {
  record.events.push(entry);
}

export function logDecision(record: EventRecord, entry: DecisionLogEntry): void {
  record.decisions.push(entry);
}

/** Helper: a stable, human-readable stress-attribution string for the inspector/log. [decision-loop.md §7 traceability] */
export function describeStressSources(bySource: ReadonlyMap<StressSource, number>): string {
  const parts = [...bySource.entries()]
    .filter(([, v]) => v !== 0)
    .map(([source, v]) => `${source}: ${v > 0 ? "+" : ""}${v.toFixed(2)}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

export function describeNeedUrgency(bySource: ReadonlyMap<NeedKind, number>): string {
  const parts = [...bySource.entries()]
    .filter(([, v]) => v > 0)
    .map(([need, v]) => `${need}=${v.toFixed(2)}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}
