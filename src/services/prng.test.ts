import { describe, expect, it } from "vitest";
import { createPrng, drawUniform, weightedPick } from "./prng.js";

describe("prng", () => {
  it("produces identical sequences from identical seeds (Principle 7)", () => {
    const a = createPrng(42);
    const b = createPrng(42);
    const seqA = Array.from({ length: 5 }, (_, i) => drawUniform(a, `draw-${i}`).value);
    const seqB = Array.from({ length: 5 }, (_, i) => drawUniform(b, `draw-${i}`).value);
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const prng = createPrng(1);
    for (let i = 0; i < 100; i++) {
      const { value } = drawUniform(prng, "range-check");
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("diverges with different seeds", () => {
    const a = createPrng(1);
    const b = createPrng(2);
    expect(drawUniform(a, "x").value).not.toBe(drawUniform(b, "x").value);
  });

  it("weightedPick favors higher-weight candidates over many draws", () => {
    const prng = createPrng(7);
    const counts = { heavy: 0, light: 0 };
    for (let i = 0; i < 1000; i++) {
      const pick = weightedPick(
        prng,
        ["heavy", "light"] as const,
        (c) => (c === "heavy" ? 9 : 1),
        "test-pick",
      );
      counts[pick]++;
    }
    expect(counts.heavy).toBeGreaterThan(counts.light * 3);
  });

  it("each draw is attributed with a purpose and an increasing index", () => {
    const prng = createPrng(3);
    const d1 = drawUniform(prng, "need-selection");
    const d2 = drawUniform(prng, "task-selection");
    expect(d1.purpose).toBe("need-selection");
    expect(d2.purpose).toBe("task-selection");
    expect(d2.index).toBe(d1.index + 1);
  });
});
