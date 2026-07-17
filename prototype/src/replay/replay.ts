// Build Step 10 — Replay harness. Replays a Stage 1 run from an initial state (via run.ts —
// never a private re-implementation of the tick loop) and verifies determinism on TWO surfaces
// (final review fix, 2026-07-11): the retained append-only traces (records/logs.ts, Step 9)
// AND the terminal SimulationState itself — identical traces alone cannot prove replay
// fidelity, because state a tick never logged (a need level, food stock, PRNG word) could
// diverge while the event stream stays identical. Pure throughout: no I/O, no mutation —
// verification returns a value describing either a full match or the FIRST divergence,
// located precisely enough to debug from.
//
// Determinism contract this module verifies, not defines: same seed + same initial state must
// reproduce identical traces and an identical terminal state (tick.ts's single-PRNG-stream /
// no-hidden-state discipline). Different seeds may legitimately diverge wherever a weighted
// choice (or any PRNG-threaded state) exists — a reported divergence is a FINDING about the
// two runs, not an error throw.
//
// First-divergence rule (fixed, so reports are deterministic): the event log is scanned first,
// index ascending; then the decision log; only if both match completely is the terminal state
// compared, field by field in the fixed STATE_FIELDS order with alphabetically-sorted keys
// inside each field. Log length mismatches surface as a divergence at the first index where
// one side has a record and the other does not (expected=null → replay produced an extra
// record; actual=null → the replay never produced a retained record).

import type { DecisionLog, DecisionRecord, EventLog, EventRecord } from "../records/logs.js";
import { run } from "../simulation/run.js";
import type { SimulationState } from "../simulation/tick.js";

export type ReplayLogKind = "event" | "decision" | "state";

/**
 * The first point where the retained run and the replayed run disagree.
 * - log "event"/"decision": `index` and `recordKind` are set; expected/actual are the two
 *   records (null on the side that has no record at that index).
 * - log "state": `path` is set (e.g. "colonist.needs.hunger.level"); expected/actual are the
 *   two values at that path in the terminal states.
 */
export interface ReplayDivergence {
  readonly kind: "divergence";
  readonly log: ReplayLogKind;
  /** First mismatching record index — event/decision divergences only. */
  readonly index?: number;
  /** Dotted field path to the first mismatching terminal-state value — state divergences only. */
  readonly path?: string;
  /** The record's own discriminant (TickEvent kind, or "decision") — event/decision divergences only. */
  readonly recordKind?: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

export interface ReplayMatch {
  readonly kind: "match";
  readonly eventRecordsCompared: number;
  readonly decisionRecordsCompared: number;
}

export type ReplayResult = ReplayMatch | ReplayDivergence;

interface Difference {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function definedKeys(o: Record<string, unknown>): readonly string[] {
  return Object.keys(o).filter((k) => o[k] !== undefined);
}

/**
 * Finds the FIRST structural difference between two JSON-safe values, in a stable order:
 * array indices ascending, object keys alphabetically sorted (properties holding `undefined`
 * treated as absent, matching JSON semantics — a record built live via spread compares equal
 * to its deserialized twin). Returns null when the values are deep-equal.
 */
function firstDifference(expected: unknown, actual: unknown, path: string): Difference | null {
  if (Object.is(expected, actual)) return null;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let i = 0; i < length; i++) {
      if (i >= expected.length || i >= actual.length) {
        return { path: `${path}[${i}]`, expected: expected[i], actual: actual[i] };
      }
      const difference = firstDifference(expected[i], actual[i], `${path}[${i}]`);
      if (difference !== null) return difference;
    }
    return null;
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = [...new Set([...definedKeys(expected), ...definedKeys(actual)])].sort();
    for (const key of keys) {
      const difference = firstDifference(expected[key], actual[key], path === "" ? key : `${path}.${key}`);
      if (difference !== null) return difference;
    }
    return null;
  }
  return { path, expected, actual };
}

function eventRecordKind(expected: EventRecord | null, actual: EventRecord | null): string {
  const record = expected ?? actual;
  return record === null ? "unknown" : record.event.kind;
}

function firstEventDivergence(expected: EventLog, actual: EventLog): ReplayDivergence | null {
  const length = Math.max(expected.length, actual.length);
  for (let i = 0; i < length; i++) {
    const e = expected[i] ?? null;
    const a = actual[i] ?? null;
    if (e !== null && a !== null && firstDifference(e, a, "") === null) continue;
    return { kind: "divergence", log: "event", index: i, recordKind: eventRecordKind(e, a), expected: e, actual: a };
  }
  return null;
}

function firstDecisionDivergence(expected: DecisionLog, actual: DecisionLog): ReplayDivergence | null {
  const length = Math.max(expected.length, actual.length);
  for (let i = 0; i < length; i++) {
    const e = expected[i] ?? null;
    const a = actual[i] ?? null;
    if (e !== null && a !== null && firstDifference(e, a, "") === null) continue;
    return { kind: "divergence", log: "decision", index: i, recordKind: "decision", expected: e, actual: a };
  }
  return null;
}

/**
 * The deterministic terminal-state fields, compared in this fixed order (spec §8's full save
 * set minus the two logs, which are compared record-by-record separately — comparing them
 * again recursively here would double-report every trace divergence). `colonist` covers
 * identity, needs, stress, traits, memory, and both goals via recursion; the executions,
 * PRNG, and memory-formation baselines are their own top-level entries.
 */
const STATE_FIELDS = [
  "clock",
  "world",
  "policy",
  "colonists", // Stage 2 Slice 6a (ADR-22 D5): the per-colonist runtime collection — replaces the seven retired singular entries; diffed generically, divergences path as colonists[i].…
  "activeColonistId", // ponytail: 6a transitional field (review fix, PR #132) — a plain scalar, diffed generically.
  "prng",
  "relationships", // Stage 2 build step 5: M10's pair store — a plain nested object, diffed generically like every other field.
  "socialOffers", // Stage 2 Slice 5 (ADR-21 D6): M12's offer store — diffed generically like every other field.
] as const;

function firstStateDivergence(expected: SimulationState, actual: SimulationState): ReplayDivergence | null {
  for (const field of STATE_FIELDS) {
    const difference = firstDifference(expected[field], actual[field], field);
    if (difference !== null) {
      return { kind: "divergence", log: "state", path: difference.path, expected: difference.expected, actual: difference.actual };
    }
  }
  return null;
}

/**
 * Compares retained (expected) traces against replayed (actual) traces — the TRACE half of
 * replay verification only; verifyReplay adds the terminal-state half on top. Pure and
 * deterministic: identical inputs always yield the identical result, and the first
 * divergence is defined by the fixed scan order in the module doc.
 */
export function compareTraces(
  expectedEvents: EventLog,
  expectedDecisions: DecisionLog,
  actualEvents: EventLog,
  actualDecisions: DecisionLog,
): ReplayResult {
  const eventDivergence = firstEventDivergence(expectedEvents, actualEvents);
  if (eventDivergence !== null) return eventDivergence;
  const decisionDivergence = firstDecisionDivergence(expectedDecisions, actualDecisions);
  if (decisionDivergence !== null) return decisionDivergence;
  return { kind: "match", eventRecordsCompared: expectedEvents.length, decisionRecordsCompared: expectedDecisions.length };
}

/**
 * Replays from `initial` for exactly the tick span that separates it from `expected`, then
 * verifies BOTH surfaces: the replayed traces against `expected`'s retained logs, and the
 * replayed terminal SimulationState against `expected` field by field (STATE_FIELDS order).
 * A match therefore certifies the complete deterministic state, not just the event stream.
 * `initial` may itself be a mid-run state (e.g. a loaded save): its logs already carry the
 * records up to that point, and the replay appends from there — exactly how the original run
 * built them.
 */
export function verifyReplay(initial: SimulationState, expected: SimulationState): ReplayResult {
  const ticks = expected.clock.tick - initial.clock.tick;
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error(
      `verifyReplay requires expected.clock.tick (${expected.clock.tick}) to be at or after initial.clock.tick (${initial.clock.tick})`,
    );
  }
  const replayed = run(initial, ticks).finalState;
  const traceResult = compareTraces(expected.eventLog, expected.decisionLog, replayed.eventLog, replayed.decisionLog);
  if (traceResult.kind === "divergence") return traceResult;
  const stateDivergence = firstStateDivergence(expected, replayed);
  if (stateDivergence !== null) return stateDivergence;
  return traceResult;
}
