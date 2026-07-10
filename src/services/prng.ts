// S1 — Seeded PRNG Service. The only chance source in the simulation.
// [engineering-specification.md §1 S1; Principle 7; locked #24]
//
// Engineering decision (EQ-3): single shared stream for Stage 1 (one colonist,
// so per-colonist streams and single-stream are equivalent). Revisit at Stage 2
// when multiple colonists draw in the same step and draw-order attribution matters.

/** Serializable PRNG state — the entire chance state of the simulation. */
export interface PrngState {
  readonly seed: number;
  /** Current generator state (mulberry32). */
  state: number;
  /** Count of draws made — used for attribution/debugging, not for generation. */
  drawCount: number;
}

export function createPrng(seed: number): PrngState {
  return { seed, state: seed >>> 0, drawCount: 0 };
}

/** A single attributable draw: what it was for, and the [0,1) value produced. */
export interface Draw {
  readonly purpose: string;
  readonly index: number;
  readonly value: number;
}

/**
 * Draws the next value in [0, 1) and advances state in place.
 * `purpose` is mandatory — every draw must be attributable [behavior-spec §6].
 */
export function drawUniform(prng: PrngState, purpose: string): Draw {
  // mulberry32 — small, fast, deterministic across platforms.
  prng.state = (prng.state + 0x6d2b79f5) >>> 0;
  let t = prng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  const draw: Draw = { purpose, index: prng.drawCount, value };
  prng.drawCount += 1;
  return draw;
}

/**
 * Weighted-random pick among candidates using one attributed draw.
 * Deterministic tie-break (DQ-D3): candidates with zero total weight, or an
 * empty list, are handled by the caller — this function requires >=1 candidate
 * with positive total weight.
 */
export function weightedPick<T>(
  prng: PrngState,
  candidates: readonly T[],
  weightOf: (item: T) => number,
  purpose: string,
): T {
  if (candidates.length === 0) {
    throw new Error(`weightedPick: no candidates for "${purpose}"`);
  }
  const weights = candidates.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    throw new Error(`weightedPick: non-positive total weight for "${purpose}"`);
  }
  const draw = drawUniform(prng, purpose);
  let cursor = draw.value * total;
  for (let i = 0; i < candidates.length; i++) {
    cursor -= weights[i]!;
    if (cursor <= 0) return candidates[i]!;
  }
  // Floating-point fallback — stable, deterministic: last candidate in the
  // fixed input order (DQ-D3's tie-break: input order is the stable ordering
  // criterion for this draw).
  return candidates[candidates.length - 1]!;
}
