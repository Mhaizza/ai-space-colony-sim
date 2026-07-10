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

/** Creates a PRNG state from a save seed (any finite number; coerced to uint32). */
export function createPrng(seed: number): PrngState {
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

/** Restores PRNG state from a save. Throws on malformed input rather than guessing. */
export function deserializePrng(json: string): PrngState {
  const raw: unknown = JSON.parse(json);
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as { a?: unknown }).a !== "number" ||
    typeof (raw as { draws?: unknown }).draws !== "number"
  ) {
    throw new Error("Invalid PRNG state");
  }
  const { a, draws } = raw as { a: number; draws: number };
  return { a: a >>> 0, draws };
}
