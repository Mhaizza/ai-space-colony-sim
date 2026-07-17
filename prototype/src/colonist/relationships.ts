// M10 Relationships — storage core only (ADR-20 D1, D2, D4, D5, D6). Centralized sparse
// pair-record store: one record per materialized colonist pair, never one record per
// colonist-direction (Option A, rejected — see ADR-20 Options Considered). Ownership
// discipline (ADR-20 Required Invariant 1): this module is the sole owner of affinity,
// derived-state rules, atrophy, and pair history. No other module computes or stores this data.
//
// Build step 1: identity, the pair-record type, the absent-pair default, the two reads
// (`perspective`, `pairView`). Build step 2: `applyInteraction`/`applyAtrophy` (D7) — pure,
// atomic, clamped write paths, fact-only consequences. Build step 3: serialization + load
// validation for this slice (D8) — load validates, it never repairs. Snapshot wiring,
// decision/weights, replay, and inspector integration remain later, separately-approved slices
// (ai-studio/meetings/2026-07-12-stage2-relationship-implementation-plan.md).
//
// Read boundary (ADR-20 D2, load-bearing — Consequences): `perspective` is the only read for
// M11/M12/M7/inspector-per-colonist consumers and never exposes the reverse direction.
// `pairView` is restricted to M10's own rules, M12 encounter conjunctions, S3, replay, and
// inspector pair-level output — it is never a decision input.

export type ColonistId = string;

export function assertSafeColonistId(id: ColonistId, field = "colonist id"): void {
  if (id === "prototype" || id in Object.prototype) {
    throw new Error(`${field} "${id}" is unsafe as a relationship-store object key`);
  }
}

/** Canonical pair identity: the ordered tuple [min(idA, idB), max(idA, idB)] (ADR-20 D5). */
export type PairKey = readonly [ColonistId, ColonistId];

/** The seven named relationship states, derived from a continuous affinity score (ADR-12). Never stored — ADR-20 Required Invariant 4. */
export const RELATIONSHIP_STATES = [
  "fractured",
  "hostile",
  "tense",
  "acquainted",
  "neutral",
  "positive",
  "bonded",
] as const;
export type RelationshipState = (typeof RELATIONSHIP_STATES)[number];

/** Derives the named state from a continuous affinity score, per ADR-12's accepted score bands. Pure; never persisted. */
export function deriveRelationshipState(affinity: number): RelationshipState {
  if (affinity >= 75) return "bonded";
  if (affinity >= 40) return "positive";
  if (affinity >= 10) return "neutral";
  if (affinity >= -10) return "acquainted";
  if (affinity >= -40) return "tense";
  if (affinity >= -75) return "hostile";
  return "fractured";
}

/**
 * Returns the canonical pair identity for two colonist ids, using the same ordinal string
 * comparison used elsewhere in this codebase for stable ordering (EQ-2 discipline). Self-pairs
 * are invalid and are rejected here, not silently ignored (ADR-20 D5).
 */
export function canonicalPairId(colonistAId: ColonistId, colonistBId: ColonistId): PairKey {
  assertSafeColonistId(colonistAId, "colonistAId");
  assertSafeColonistId(colonistBId, "colonistBId");
  if (colonistAId === colonistBId) {
    throw new Error("a relationship pair requires two distinct colonist ids; self-pairs are invalid (ADR-20 D5)");
  }
  return colonistAId < colonistBId ? [colonistAId, colonistBId] : [colonistBId, colonistAId];
}

/** The closed ADR-12 affinity change-source table. `extendedAvoidance` is atrophy's own source — never an interaction input (see `InteractionFact`). */
export const RELATIONSHIP_CHANGE_SOURCES = [
  "sharedTaskCompletion",
  "forcedProximityMutualStress",
  "directConflict",
  "mutualSupportCrisis",
  "extendedAvoidance",
  "traitCompatibilityAlignment",
] as const;
export type RelationshipChangeSource = (typeof RELATIONSHIP_CHANGE_SOURCES)[number];

/** One significant interaction, recorded once per accepted change (ADR-20 D6). */
export interface PairHistoryEntry {
  readonly tick: number;
  readonly sequence: number;
  readonly changeSource: RelationshipChangeSource;
  readonly initiatorId: ColonistId | null;
  readonly responderId: ColonistId | null;
  readonly minTowardMaxDelta: number;
  readonly maxTowardMinDelta: number;
  readonly resultingMinTowardMaxAffinity: number;
  readonly resultingMaxTowardMinAffinity: number;
}

/** A materialized pair record — the minimal shape of ADR-20 D6. Named states are derived, never stored here. */
export interface PairRecord {
  readonly pair: PairKey;
  readonly minTowardMaxAffinity: number;
  readonly maxTowardMinAffinity: number;
  readonly history: readonly PairHistoryEntry[];
  readonly lastInteractionTick: number | null;
}

/**
 * The sparse relationship store: a materialized pair record is reachable at
 * `pairs[min]?.[max]`. Two-level plain object keyed on the canonical tuple's own elements — a
 * collision-free encoding by construction, never a delimiter-concatenated key (ADR-20 D5). A
 * plain object (not a Map) so the store round-trips through `JSON.stringify`/deep-clone like
 * every other SimulationState field — this codebase's existing purity/snapshot tests compare
 * state via that idiom.
 */
export interface RelationshipStore {
  readonly pairs: Readonly<Record<ColonistId, Readonly<Record<ColonistId, PairRecord>>>>;
}

/** Creates an empty relationship store — no pairs materialized. */
export function createRelationshipStore(): RelationshipStore {
  return { pairs: {} };
}

/** The deterministic default for an absent pair (ADR-20 D4): zero affinity, Acquainted, no history, no last-interaction tick. */
export const ABSENT_PAIR_PERSPECTIVE: DirectionalPerspective = {
  affinity: 0,
  state: deriveRelationshipState(0),
};

/** One colonist's directional view of a relationship: their affinity toward the other, and its derived state. */
export interface DirectionalPerspective {
  readonly affinity: number;
  readonly state: RelationshipState;
}

/** The full pair, both directions — restricted to system-level consumers (ADR-20 D2). Never a decision input. */
export interface PairView {
  readonly pair: PairKey;
  readonly minTowardMax: DirectionalPerspective;
  readonly maxTowardMin: DirectionalPerspective;
  readonly history: readonly PairHistoryEntry[];
  readonly lastInteractionTick: number | null;
}

/**
 * Owner-direction read (ADR-20 D2): `ownerId`'s affinity toward `otherId` and its derived state.
 * Never exposes the reverse direction. Reading an absent pair is side-effect-free — it returns
 * the D4 default and never materializes a record. This is the only read available to M11
 * decision weighting, M12 destination/refusal weighting, M7 proximity-stress inputs, and the
 * inspector's per-colonist view.
 */
export function perspective(
  store: RelationshipStore,
  ownerId: ColonistId,
  otherId: ColonistId,
): DirectionalPerspective {
  const [min, max] = canonicalPairId(ownerId, otherId);
  const record = store.pairs[min]?.[max];
  if (!record) return ABSENT_PAIR_PERSPECTIVE;
  const affinity = ownerId === min ? record.minTowardMaxAffinity : record.maxTowardMinAffinity;
  return { affinity, state: deriveRelationshipState(affinity) };
}

/**
 * System-level pair read (ADR-20 D2): both directional perspectives at once. Restricted to
 * M10's own rules, M12 encounter-conjunction detection, S3 serialization, replay, and inspector
 * pair-level output — never a decision input. Reading an absent pair is side-effect-free.
 */
export function pairView(store: RelationshipStore, colonistAId: ColonistId, colonistBId: ColonistId): PairView {
  const [min, max] = canonicalPairId(colonistAId, colonistBId);
  const record = store.pairs[min]?.[max];
  if (!record) {
    return {
      pair: [min, max],
      minTowardMax: ABSENT_PAIR_PERSPECTIVE,
      maxTowardMin: ABSENT_PAIR_PERSPECTIVE,
      history: [],
      lastInteractionTick: null,
    };
  }
  return {
    pair: record.pair,
    minTowardMax: { affinity: record.minTowardMaxAffinity, state: deriveRelationshipState(record.minTowardMaxAffinity) },
    maxTowardMin: { affinity: record.maxTowardMinAffinity, state: deriveRelationshipState(record.maxTowardMinAffinity) },
    history: record.history,
    lastInteractionTick: record.lastInteractionTick,
  };
}

// --- Write paths (ADR-20 D7) — build step 2. Only M10 writes relationship state; both
// operations are pure and atomic over a single pair record, and neither draws from S1's PRNG
// (chance stays owned by S1/M12, upstream of the interaction fact this module receives). ---

// ponytail: calibration magnitudes below are provisional Stage 2 values kept local to this
// module rather than config/tuning.ts and config/constants.ts, to hold this build step's file
// footprint to colonist/relationships.ts only. Fold into the config split (constants.ts for the
// ADR-12 range, tuning.ts for the rest) once a later slice touches those files anyway.

/** Affinity score range every direction is clamped within (ADR-12: continuous score, −100 to +100). */
const AFFINITY_SCORE_MIN = -100;
const AFFINITY_SCORE_MAX = 100;

/** provisional — Stage 2 relationship calibration. */
const RELATIONSHIP_TUNING = {
  /** provisional — minimum absolute delta in either direction for an interaction to enter bounded history (ADR-12 "significant interaction"). */
  significantChangeThreshold: 5,
  /** provisional — bounded history capacity per pair record (ADR-20 D6/Required Invariant 5). */
  historyBound: 12,
  /** provisional — extended-avoidance atrophy magnitude applied per elapsed tick, each direction (ADR-12: "Extended avoidance... Negative drift... Low"). */
  atrophyPerTick: 0.02,
} as const;

function clampAffinity(value: number): number {
  return Math.min(AFFINITY_SCORE_MAX, Math.max(AFFINITY_SCORE_MIN, value));
}

/** Deterministic next sequence number within one pair's history — assigned in append order, mirroring memory.ts's `nextId`. */
function nextSequence(history: readonly PairHistoryEntry[]): number {
  return history.reduce((max, e) => Math.max(max, e.sequence), -1) + 1;
}

/** Bounded, deterministic FIFO eviction: keeps the most recently appended `historyBound` entries. */
function boundHistory(history: readonly PairHistoryEntry[]): readonly PairHistoryEntry[] {
  if (history.length <= RELATIONSHIP_TUNING.historyBound) return history;
  return history.slice(history.length - RELATIONSHIP_TUNING.historyBound);
}

/**
 * Returns a store with exactly one pair record replaced. Never mutates `store` or any object it
 * holds — new outer and inner objects are allocated so every prior store reference (and every
 * other pair's inner object) stays exactly as it was (atomicity).
 */
function withPairRecord(store: RelationshipStore, min: ColonistId, max: ColonistId, record: PairRecord): RelationshipStore {
  return {
    pairs: {
      ...store.pairs,
      [min]: { ...store.pairs[min], [max]: record },
    },
  };
}

/** An accepted interaction between two colonists, already resolved to a change source and directional deltas — M10 applies it, it does not compute it (magnitude/change-source tables are calibration, not this build step). */
export interface InteractionFact {
  readonly colonistAId: ColonistId;
  readonly colonistBId: ColonistId;
  readonly tick: number;
  /** `extendedAvoidance` is atrophy's own source and is excluded here at the type level. */
  readonly changeSource: Exclude<RelationshipChangeSource, "extendedAvoidance">;
  readonly initiatorId: ColonistId | null;
  readonly responderId: ColonistId | null;
  readonly aTowardBDelta: number;
  readonly bTowardADelta: number;
}

/** A relationship-store write's fact-only output. Receivers (S2, M9, named-state-transition reporting) apply their own rules — this module records what happened, not what it means (ADR-20 D7; Interfaces table). */
export type RelationshipConsequence =
  | ({ readonly kind: "interaction" } & Omit<PairHistoryEntry, "sequence"> & { readonly pair: PairKey; readonly enteredHistory: boolean })
  | {
      readonly kind: "atrophy";
      readonly pair: PairKey;
      readonly minTowardMaxDelta: number;
      readonly maxTowardMinDelta: number;
      readonly resultingMinTowardMaxAffinity: number;
      readonly resultingMaxTowardMinAffinity: number;
    };

export interface RelationshipWriteResult {
  readonly store: RelationshipStore;
  readonly consequences: readonly RelationshipConsequence[];
}

/**
 * Applies one accepted interaction (ADR-20 D7). Always materializes/updates the pair record and
 * updates `lastInteractionTick` — including a zero-delta routine interaction (architecture
 * review's required clarification). Adds a bounded history entry only when the change meets
 * ADR-12's significance threshold in either direction. Pure, atomic over the one pair record,
 * clamped to ADR-12's range, no PRNG. Always emits exactly one fact-only consequence.
 */
export function applyInteraction(store: RelationshipStore, fact: InteractionFact): RelationshipWriteResult {
  const [min, max] = canonicalPairId(fact.colonistAId, fact.colonistBId);
  const minTowardMaxDelta = fact.colonistAId === min ? fact.aTowardBDelta : fact.bTowardADelta;
  const maxTowardMinDelta = fact.colonistAId === min ? fact.bTowardADelta : fact.aTowardBDelta;

  const existing = store.pairs[min]?.[max];
  const resultingMinTowardMaxAffinity = clampAffinity((existing?.minTowardMaxAffinity ?? 0) + minTowardMaxDelta);
  const resultingMaxTowardMinAffinity = clampAffinity((existing?.maxTowardMinAffinity ?? 0) + maxTowardMinDelta);

  const enteredHistory =
    Math.abs(minTowardMaxDelta) >= RELATIONSHIP_TUNING.significantChangeThreshold ||
    Math.abs(maxTowardMinDelta) >= RELATIONSHIP_TUNING.significantChangeThreshold;

  const priorHistory = existing?.history ?? [];
  const history = enteredHistory
    ? boundHistory([
        ...priorHistory,
        {
          tick: fact.tick,
          sequence: nextSequence(priorHistory),
          changeSource: fact.changeSource,
          initiatorId: fact.initiatorId,
          responderId: fact.responderId,
          minTowardMaxDelta,
          maxTowardMinDelta,
          resultingMinTowardMaxAffinity,
          resultingMaxTowardMinAffinity,
        },
      ])
    : priorHistory;

  const record: PairRecord = {
    pair: [min, max],
    minTowardMaxAffinity: resultingMinTowardMaxAffinity,
    maxTowardMinAffinity: resultingMaxTowardMinAffinity,
    history,
    lastInteractionTick: fact.tick,
  };

  const consequence: RelationshipConsequence = {
    kind: "interaction",
    pair: [min, max],
    tick: fact.tick,
    changeSource: fact.changeSource,
    initiatorId: fact.initiatorId,
    responderId: fact.responderId,
    minTowardMaxDelta,
    maxTowardMinDelta,
    resultingMinTowardMaxAffinity,
    resultingMaxTowardMinAffinity,
    enteredHistory,
  };

  return { store: withPairRecord(store, min, max, record), consequences: [consequence] };
}

/**
 * Applies extended-avoidance atrophy (ADR-20 D7, D4) to every materialized, eligible pair, in
 * canonical pair order (Update-Order Integration, Phase 3). A pair is eligible only if it has a
 * recorded `lastInteractionTick` — an absent pair, or one somehow materialized without a prior
 * interaction, is left untouched: colonists who have never interacted do not become hostile
 * merely because time passed (D4). No-ops (unchanged store, no consequences) when the store has
 * no eligible pairs or `elapsedDuration` is not positive. Pure, atomic per pair record, clamped,
 * no PRNG.
 *
 * `excludedPairs` — Stage 2 Slice 6b: generalized from a single pair to a set (still optional,
 * still defaults to none excluded) because promoting every colonist to full simulation means
 * more than one pair can be simultaneously mid-interaction in the same tick (tick.ts's own
 * companionship-credit path already applies that pair's delta directly; atrophy must not
 * ALSO apply to it the same tick). This is the same exclusion concept ADR-20 already
 * anticipated at multi-colonist scale ("Sparse storage remains cheap at 3, 8, and 24
 * colonists") — no storage shape, ownership, or invariant changes.
 */
export function applyAtrophy(store: RelationshipStore, elapsedDuration: number, excludedPairs?: readonly PairKey[]): RelationshipWriteResult {
  if (elapsedDuration <= 0) return { store, consequences: [] };

  const delta = RELATIONSHIP_TUNING.atrophyPerTick * elapsedDuration;
  const consequences: RelationshipConsequence[] = [];
  let nextStore = store;
  const excludedKeys = new Set((excludedPairs ?? []).map(([min, max]) => `${min}\0${max}`));

  const minIds = Object.keys(store.pairs).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const min of minIds) {
    const maxIds = Object.keys(store.pairs[min]!).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const max of maxIds) {
      if (excludedKeys.has(`${min}\0${max}`)) continue;
      const record = store.pairs[min]![max]!;
      if (record.lastInteractionTick === null) continue; // D4: never-interacted pairs are not eligible

      const resultingMinTowardMaxAffinity = clampAffinity(record.minTowardMaxAffinity - delta);
      const resultingMaxTowardMinAffinity = clampAffinity(record.maxTowardMinAffinity - delta);
      const updated: PairRecord = {
        ...record,
        minTowardMaxAffinity: resultingMinTowardMaxAffinity,
        maxTowardMinAffinity: resultingMaxTowardMinAffinity,
      };
      nextStore = withPairRecord(nextStore, min, max, updated);
      consequences.push({
        kind: "atrophy",
        pair: [min, max],
        minTowardMaxDelta: resultingMinTowardMaxAffinity - record.minTowardMaxAffinity,
        maxTowardMinDelta: resultingMaxTowardMinAffinity - record.maxTowardMinAffinity,
        resultingMinTowardMaxAffinity,
        resultingMaxTowardMinAffinity,
      });
    }
  }

  return { store: nextStore, consequences };
}

// --- Serialization + load validation (ADR-20 D8) — build step 3. M10 owns validation for its
// own slice, mirroring how clock.ts/prng.ts each own their save format; core/serialization.ts
// only calls in. Operates on already-parsed JSON values (nested within the wider SimulationState
// save), not JSON strings. Load validates, it never repairs — every rejection below throws
// rather than sorting, clamping, deduplicating, or filling in a malformed record. ---

function fail(reason: string): never {
  throw new Error(`Invalid relationship store: ${reason}`);
}

function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`"${field}" must be an object`);
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(`"${field}" must be an array`);
  return value;
}

function expectStringId(value: unknown, field: string): ColonistId {
  if (typeof value !== "string") fail(`"${field}" must be a string`);
  try {
    assertSafeColonistId(value, field);
  } catch (error) {
    fail(error instanceof Error ? error.message : `"${field}" is unsafe`);
  }
  return value;
}

function expectFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`"${field}" must be a finite number`);
  return value;
}

/** Finite AND within ADR-12's accepted affinity range — covers both "missing/non-finite" and "out-of-range". */
function expectAffinity(value: unknown, field: string): number {
  const n = expectFiniteNumber(value, field);
  if (n < AFFINITY_SCORE_MIN || n > AFFINITY_SCORE_MAX) {
    fail(`"${field}" (${n}) is out of ADR-12's affinity range [${AFFINITY_SCORE_MIN}, ${AFFINITY_SCORE_MAX}]`);
  }
  return n;
}

function expectNonNegativeInteger(value: unknown, field: string): number {
  const n = expectFiniteNumber(value, field);
  if (!Number.isInteger(n) || n < 0) fail(`"${field}" must be a non-negative integer`);
  return n;
}

function expectChangeSource(value: unknown, field: string): RelationshipChangeSource {
  if (typeof value !== "string" || !(RELATIONSHIP_CHANGE_SOURCES as readonly string[]).includes(value)) {
    fail(`"${field}" has unrecognized value "${String(value)}"`);
  }
  return value as RelationshipChangeSource;
}

function expectNullableId(value: unknown, field: string): ColonistId | null {
  return value === null ? null : expectStringId(value, field);
}

function expectPairKeyTuple(value: unknown, field: string): readonly [ColonistId, ColonistId] {
  const arr = expectArray(value, field);
  if (arr.length !== 2) fail(`"${field}" must have exactly two elements`);
  return [expectStringId(arr[0], `${field}[0]`), expectStringId(arr[1], `${field}[1]`)];
}

/** Rejects any field the shape doesn't declare — the concrete mechanism behind "stored named states are invalid" (ADR-20 D8, Required Invariant 4): a derived/named state has no allowed key to live under. */
function expectNoUnknownKeys(o: Record<string, unknown>, allowed: ReadonlySet<string>, field: string): void {
  for (const key of Object.keys(o)) {
    if (!allowed.has(key)) fail(`"${field}" has an unrecognized field "${key}"`);
  }
}

const PAIR_RECORD_KEYS: ReadonlySet<string> = new Set([
  "pair",
  "minTowardMaxAffinity",
  "maxTowardMinAffinity",
  "history",
  "lastInteractionTick",
]);
const HISTORY_ENTRY_KEYS: ReadonlySet<string> = new Set([
  "pair",
  "tick",
  "sequence",
  "changeSource",
  "initiatorId",
  "responderId",
  "minTowardMaxDelta",
  "maxTowardMinDelta",
  "resultingMinTowardMaxAffinity",
  "resultingMaxTowardMinAffinity",
]);

/**
 * Serializes a relationship store's materialized pairs, ordered lexicographically by
 * [min, max] (ADR-20 D5). Each history entry carries its own `pair` for load-time verification
 * that it belongs to its record (D8) — an addition to the saved shape only; the in-memory
 * `PairHistoryEntry` type has no such field, since containment already implies it. Pure.
 */
export function serializeRelationshipStore(store: RelationshipStore): unknown {
  const minIds = Object.keys(store.pairs).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const records: unknown[] = [];
  for (const min of minIds) {
    const maxIds = Object.keys(store.pairs[min]!).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const max of maxIds) {
      const record = store.pairs[min]![max]!;
      records.push({
        pair: record.pair,
        minTowardMaxAffinity: record.minTowardMaxAffinity,
        maxTowardMinAffinity: record.maxTowardMinAffinity,
        lastInteractionTick: record.lastInteractionTick,
        history: record.history.map((entry) => ({ pair: record.pair, ...entry })),
      });
    }
  }
  return records;
}

/**
 * Restores a relationship store from its saved slice (ADR-20 D8). Rejects rather than repairs
 * every one of: duplicate or non-canonical pair identities; self-pairs or unknown colonist ids;
 * missing, non-finite, or out-of-range affinity; stored named states; history entries for
 * another pair; history out of deterministic order, over its configured bound, or postdating
 * the loaded clock; invalid or non-monotone `lastInteractionTick`. `knownColonistIds` and
 * `loadedClockTick` come from the rest of the save the caller (core/serialization.ts) has
 * already parsed and validated — this function never mutates `raw`.
 */
export function deserializeRelationshipStore(
  raw: unknown,
  knownColonistIds: ReadonlySet<ColonistId>,
  loadedClockTick: number,
  requiredParticipantId?: ColonistId,
): RelationshipStore {
  const records = expectArray(raw, "relationships");
  const outer: Record<ColonistId, Record<ColonistId, PairRecord>> = {};

  records.forEach((recordRaw, i) => {
    const field = `relationships[${i}]`;
    const o = expectObject(recordRaw, field);
    expectNoUnknownKeys(o, PAIR_RECORD_KEYS, field);

    const [a, b] = expectPairKeyTuple(o.pair, `${field}.pair`);
    if (a === b) fail(`"${field}.pair" is a self-pair ("${a}") — self-pairs are invalid (ADR-20 D5)`);
    if (!(a < b)) fail(`"${field}.pair" is not in canonical [min, max] order (ADR-20 D5)`);
    if (!knownColonistIds.has(a) || !knownColonistIds.has(b)) {
      fail(`"${field}.pair" references an unknown colonist id`);
    }
    if (requiredParticipantId !== undefined && a !== requiredParticipantId && b !== requiredParticipantId) {
      fail(`"${field}.pair" must include the simulated colonist id "${requiredParticipantId}"`);
    }
    if (Object.prototype.hasOwnProperty.call(outer[a] ?? {}, b)) {
      fail(`"${field}.pair" duplicates an already-loaded pair identity`);
    }

    const minTowardMaxAffinity = expectAffinity(o.minTowardMaxAffinity, `${field}.minTowardMaxAffinity`);
    const maxTowardMinAffinity = expectAffinity(o.maxTowardMinAffinity, `${field}.maxTowardMinAffinity`);

    const historyRaw = expectArray(o.history, `${field}.history`);
    if (historyRaw.length > RELATIONSHIP_TUNING.historyBound) {
      fail(`"${field}.history" exceeds its configured bound (${RELATIONSHIP_TUNING.historyBound})`);
    }
    let previousTick = -1;
    let previousSequence = -1;
    const history: PairHistoryEntry[] = historyRaw.map((entryRaw, j) => {
      const entryField = `${field}.history[${j}]`;
      const eo = expectObject(entryRaw, entryField);
      expectNoUnknownKeys(eo, HISTORY_ENTRY_KEYS, entryField);

      const [entryA, entryB] = expectPairKeyTuple(eo.pair, `${entryField}.pair`);
      if (entryA !== a || entryB !== b) {
        fail(`"${entryField}" belongs to a different pair (["${entryA}","${entryB}"]) than its record (["${a}","${b}"])`);
      }

      const tick = expectNonNegativeInteger(eo.tick, `${entryField}.tick`);
      if (tick > loadedClockTick) fail(`"${entryField}.tick" (${tick}) postdates the loaded clock (${loadedClockTick})`);
      const sequence = expectNonNegativeInteger(eo.sequence, `${entryField}.sequence`);
      if (tick < previousTick || (tick === previousTick && sequence <= previousSequence)) {
        fail(`"${entryField}" is out of deterministic order (tick/sequence must strictly increase)`);
      }
      previousTick = tick;
      previousSequence = sequence;

      const initiatorId = expectNullableId(eo.initiatorId, `${entryField}.initiatorId`);
      const responderId = expectNullableId(eo.responderId, `${entryField}.responderId`);
      if (initiatorId !== null && !knownColonistIds.has(initiatorId)) {
        fail(`"${entryField}.initiatorId" references an unknown colonist id`);
      }
      if (initiatorId !== null && initiatorId !== a && initiatorId !== b) {
        fail(`"${entryField}.initiatorId" is not a participant in its relationship pair`);
      }
      if (responderId !== null && !knownColonistIds.has(responderId)) {
        fail(`"${entryField}.responderId" references an unknown colonist id`);
      }
      if (responderId !== null && responderId !== a && responderId !== b) {
        fail(`"${entryField}.responderId" is not a participant in its relationship pair`);
      }

      return {
        tick,
        sequence,
        changeSource: expectChangeSource(eo.changeSource, `${entryField}.changeSource`),
        initiatorId,
        responderId,
        minTowardMaxDelta: expectFiniteNumber(eo.minTowardMaxDelta, `${entryField}.minTowardMaxDelta`),
        maxTowardMinDelta: expectFiniteNumber(eo.maxTowardMinDelta, `${entryField}.maxTowardMinDelta`),
        resultingMinTowardMaxAffinity: expectAffinity(eo.resultingMinTowardMaxAffinity, `${entryField}.resultingMinTowardMaxAffinity`),
        resultingMaxTowardMinAffinity: expectAffinity(eo.resultingMaxTowardMinAffinity, `${entryField}.resultingMaxTowardMinAffinity`),
      };
    });

    const lastInteractionTick =
      o.lastInteractionTick === null ? null : expectNonNegativeInteger(o.lastInteractionTick, `${field}.lastInteractionTick`);
    if (lastInteractionTick !== null && lastInteractionTick > loadedClockTick) {
      fail(`"${field}.lastInteractionTick" (${lastInteractionTick}) postdates the loaded clock (${loadedClockTick})`);
    }
    if (history.length > 0 && lastInteractionTick === null) {
      fail(`"${field}.lastInteractionTick" is invalid: history exists but no last-interaction tick was recorded`);
    }
    if (history.length > 0 && lastInteractionTick! < history[history.length - 1]!.tick) {
      fail(
        `"${field}.lastInteractionTick" (${lastInteractionTick}) is non-monotone — precedes its own most ` +
          `recent history entry (${history[history.length - 1]!.tick})`,
      );
    }

    const record: PairRecord = { pair: [a, b], minTowardMaxAffinity, maxTowardMinAffinity, history, lastInteractionTick };
    if (!Object.prototype.hasOwnProperty.call(outer, a)) outer[a] = {};
    outer[a]![b] = record;
  });

  return { pairs: outer };
}
