// M-Records — append-only behavior trace. Two closed, distinct record kinds: EventRecord (one
// per TickEvent tick.ts detects/emits) and DecisionRecord (one per "decision" TickEvent,
// carrying the full DecisionOutcome — composed-weight decomposition and PRNG draw attribution
// already retained by decide.ts, never re-derived here). This module owns record SEMANTICS
// (the types, append rules, trace reconstruction); tick.ts only ever calls into it with events
// it has already produced — it never constructs a record itself.
//
// Append-only: every exported function returns a NEW array with the prior entries preserved in
// order plus the new entry appended — no function here removes, reorders, or mutates an entry.
// `seq` is assigned by append order within each log (0, 1, 2, ...), independent of `tick`
// (multiple records can share a tick; `seq` is what makes ordering within a log deterministic
// and reconstructable).

import type { DecisionOutcome } from "../decision/decide.js";
import type { TickEvent } from "../simulation/tick.js";

/** One recorded TickEvent, with the tick it occurred on and its append-order sequence number. */
export interface EventRecord {
  readonly seq: number;
  readonly tick: number;
  readonly event: TickEvent;
}

export type EventLog = readonly EventRecord[];

/** One recorded decision — the full DecisionOutcome (goal, winningTier, composedWeights, draws). */
export interface DecisionRecord {
  readonly seq: number;
  readonly tick: number;
  readonly outcome: DecisionOutcome;
}

export type DecisionLog = readonly DecisionRecord[];

export function createEventLog(): EventLog {
  return [];
}

export function createDecisionLog(): DecisionLog {
  return [];
}

/** Appends one event record. Pure — returns a new log; `log` is untouched. */
export function appendEvent(log: EventLog, tick: number, event: TickEvent): EventLog {
  return [...log, { seq: log.length, tick, event }];
}

/** Appends every event in `events`, in order, as separate records sharing `tick`. */
export function appendEvents(log: EventLog, tick: number, events: readonly TickEvent[]): EventLog {
  let next = log;
  for (const event of events) {
    next = appendEvent(next, tick, event);
  }
  return next;
}

/** Appends one decision record. Pure — returns a new log; `log` is untouched. */
export function appendDecision(log: DecisionLog, tick: number, outcome: DecisionOutcome): DecisionLog {
  return [...log, { seq: log.length, tick, outcome }];
}

/**
 * Extracts and appends decision records from one tick's events — the "decision" kind already
 * carries the full DecisionOutcome (decide.ts), so this only unwraps and appends; it never
 * re-derives or re-composes anything. A no-op when `events` contains no "decision" entry.
 */
export function appendDecisionsFromEvents(log: DecisionLog, tick: number, events: readonly TickEvent[]): DecisionLog {
  let next = log;
  for (const event of events) {
    if (event.kind === "decision") {
      next = appendDecision(next, tick, event.outcome);
    }
  }
  return next;
}

/** One entry in a reconstructed trace — an event or a decision, tagged so callers can discriminate. */
export type TraceEntry =
  | { readonly kind: "event"; readonly tick: number; readonly seq: number; readonly event: TickEvent }
  | { readonly kind: "decision"; readonly tick: number; readonly seq: number; readonly outcome: DecisionOutcome };

/**
 * Reconstructs a single chronological behavior trace from the two logs (support for
 * reconstructing behavior traces from retained records). Ordered by tick, then by each record's
 * own append-order `seq` — deterministic and pure: identical logs always reconstruct identically.
 * Event and decision records remain independently retrievable (eventLog/decisionLog); this is a
 * read-only merge for inspection, not a third log.
 */
export function reconstructTrace(eventLog: EventLog, decisionLog: DecisionLog): readonly TraceEntry[] {
  const entries: TraceEntry[] = [
    ...eventLog.map((r): TraceEntry => ({ kind: "event", tick: r.tick, seq: r.seq, event: r.event })),
    ...decisionLog.map((r): TraceEntry => ({ kind: "decision", tick: r.tick, seq: r.seq, outcome: r.outcome })),
  ];
  return entries.sort((a, b) => a.tick - b.tick || a.seq - b.seq || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
}
