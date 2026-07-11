// S1 Seeded PRNG Service — the only chance source in the simulation.
// Engineering spec §2 S1, §8: save-seeded, serializable, draw-attributable (EQ-3: single
// stream with a draw counter). Pure: every draw returns a new state; nothing mutates.
// Mulberry32 core — integer ops only (Math.imul, >>>), so sequences are identical across
// platforms and JS engines, which the replay guarantee depends on.

/** Serializable PRNG state: `a` is the mulberry32 state word, `draws` counts draws for attribution. */
export interface PrngState {
  readonly a: number;
  readonly draws: number;
}

/** Result of one draw: a float in [0, 1) and the successor state. */
export interface PrngDraw {
  readonly value: number;
  readonly state: PrngState;
}

/**
 * Creates a PRNG state from a save seed (any finite number; coerced to uint32).
 * Rejects non-finite seeds (Copilot-confirmed defect): `NaN`/`Infinity` previously aliased
 * silently to state zero through `>>> 0` (ToUint32 maps every non-finite value to 0), so an
 * invalid seed produced the exact same, indistinguishable deterministic stream as seed 0 — a
 * repair, not a rejection, of a genuinely invalid precondition this function's own doc already
 * documents as one it holds.
 */
export function createPrng(seed: number): PrngState {
  if (!Number.isFinite(seed)) {
    throw new Error(`createPrng seed must be a finite number, got ${seed}`);
  }
  return { a: seed >>> 0, draws: 0 };
}

/** Draws one float in [0, 1). Pure — same state always yields the same value and successor. */
export function next(state: PrngState): PrngDraw {
  const a = (state.a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
  const value = ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  return { value, state: { a, draws: state.draws + 1 } };
}

/** Serializes PRNG state for the save set (spec §7: PRNG state is mandatory save content). */
export function serializePrng(state: PrngState): string {
  return JSON.stringify(state);
}

/**
 * Restores PRNG state from a save. Throws on malformed input rather than guessing.
 * Copilot-confirmed defect: this previously accepted any `a`/`draws` typed as `number` and
 * silently NORMALIZED them — a fractional or out-of-uint32-range `a` was coerced through
 * `>>> 0` into a different value than the one saved, and a negative or fractional `draws`
 * passed straight through — repairing malformed input instead of rejecting it, which could
 * make a loaded run silently continue from a different stream than the serialized data
 * represents. Both fields are now required to already be exactly what a real PrngState holds:
 * `a` a valid uint32 integer, `draws` a non-negative integer.
 */
export function deserializePrng(json: string): PrngState {
  const raw: unknown = JSON.parse(json);
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid PRNG state");
  }
  const { a, draws } = raw as { a?: unknown; draws?: unknown };
  if (typeof a !== "number" || !Number.isInteger(a) || a < 0 || a > 0xffffffff) {
    throw new Error(`Invalid PRNG state: "a" must be a uint32 integer, got ${String(a)}`);
  }
  if (typeof draws !== "number" || !Number.isInteger(draws) || draws < 0) {
    throw new Error(`Invalid PRNG state: "draws" must be a non-negative integer, got ${String(draws)}`);
  }
  return { a, draws };
}
