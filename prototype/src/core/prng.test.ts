// S1 PRNG determinism and serialization tests (validation plan: foundations step).

import { describe, expect, it } from "vitest";
import { createPrng, deserializePrng, next, serializePrng, type PrngState } from "./prng.js";

function drawSequence(state: PrngState, count: number): number[] {
  const values: number[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const d = next(s);
    values.push(d.value);
    s = d.state;
  }
  return values;
}

describe("prng determinism (spec §8.1–8.2)", () => {
  it("same seed produces the identical sequence", () => {
    expect(drawSequence(createPrng(12345), 100)).toEqual(drawSequence(createPrng(12345), 100));
  });

  it("different seeds produce different sequences", () => {
    expect(drawSequence(createPrng(1), 20)).not.toEqual(drawSequence(createPrng(2), 20));
  });

  it("is pure: drawing from the same state twice yields the same result", () => {
    const s = createPrng(777);
    const a = next(s);
    const b = next(s);
    expect(a.value).toBe(b.value);
    expect(a.state).toEqual(b.state);
  });

  it("all values are in [0, 1)", () => {
    for (const v of drawSequence(createPrng(999), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("counts draws for attribution (EQ-3)", () => {
    let s = createPrng(5);
    expect(s.draws).toBe(0);
    s = next(next(next(s).state).state).state;
    expect(s.draws).toBe(3);
  });

  it("coerces seeds to uint32 deterministically", () => {
    expect(drawSequence(createPrng(-1), 5)).toEqual(drawSequence(createPrng(0xffffffff), 5));
  });
});

describe("prng serialization round-trip (spec §7: PRNG state is mandatory save content)", () => {
  it("round-trips mid-sequence and continues identically", () => {
    let s = createPrng(2026);
    for (let i = 0; i < 57; i++) s = next(s).state;
    const restored = deserializePrng(serializePrng(s));
    expect(restored).toEqual(s);
    expect(drawSequence(restored, 50)).toEqual(drawSequence(s, 50));
  });

  it("rejects malformed saves instead of guessing", () => {
    expect(() => deserializePrng("{}")).toThrow();
    expect(() => deserializePrng('{"a": "x", "draws": 0}')).toThrow();
    expect(() => deserializePrng("null")).toThrow();
  });
});
