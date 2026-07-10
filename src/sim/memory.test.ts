import { beforeEach, describe, expect, it } from "vitest";
import { createColonist } from "./colonist.js";
import { MEMORY_CALIBRATION } from "./calibration.js";
import {
  evictLowestInfluence,
  formMemory,
  materialMemories,
  memoryInfluence,
  memoryWeightTilt,
  resetMemoryIdSequence,
} from "./memory.js";

function colonist() {
  return createColonist({ id: "c1", name: "Test", skills: [] }, 0);
}

beforeEach(() => resetMemoryIdSequence());

describe("M9 memory system", () => {
  it("forms a memory with impact fixed at formation", () => {
    const c = colonist();
    const entry = formMemory(c, { type: "deprivation", impact: "high", description: "The Day 12 shortage", needKind: "hunger" }, 100);
    expect(entry.impact).toBe("high");
    expect(entry.formedAt).toBe(100);
    expect(c.memoryPool).toHaveLength(1);
  });

  it("influence decays with age; higher impact decays slower", () => {
    const c = colonist();
    const low = formMemory(c, { type: "deprivation", impact: "low", description: "minor" }, 0);
    const high = formMemory(c, { type: "crisis", impact: "high", description: "major" }, 0);
    const oneDay = MEMORY_CALIBRATION.recencyHalfLifeSecondsByImpact.low;
    expect(memoryInfluence(low, oneDay)).toBeCloseTo(0.5, 5);
    expect(memoryInfluence(high, oneDay)).toBeGreaterThan(memoryInfluence(low, oneDay));
  });

  it("influence approaches zero as a memory fades but never re-improves spontaneously", () => {
    const c = colonist();
    const entry = formMemory(c, { type: "condition", impact: "low", description: "grind" }, 0);
    const early = memoryInfluence(entry, 10);
    const later = memoryInfluence(entry, MEMORY_CALIBRATION.recencyHalfLifeSecondsByImpact.low * 10);
    expect(later).toBeLessThan(early);
  });

  it("evicts the lowest-influence memory, which can be the more recent one (not oldest-first)", () => {
    const c = colonist();
    // Old but high-impact: decays slowly, still strong much later.
    const old = formMemory(c, { type: "crisis", impact: "high", description: "the cascade" }, 0);
    // Formed more recently than `old`, but low-impact: decays fast, weaker sooner.
    const newer = formMemory(c, { type: "deprivation", impact: "low", description: "routine grumble" }, 5000);
    const now = 10000;
    expect(memoryInfluence(old, now)).toBeGreaterThan(memoryInfluence(newer, now));

    evictLowestInfluence(c, now);

    // The naive "evict oldest" policy would have removed `old`; ADR-16's
    // lowest-influence rule removes `newer` instead.
    expect(c.memoryPool.some((m) => m.id === old.id)).toBe(true);
    expect(c.memoryPool.some((m) => m.id === newer.id)).toBe(false);
  });

  it("memory never adds candidates — it only tilts, bounded", () => {
    const c = colonist();
    formMemory(c, { type: "deprivation", impact: "high", description: "shortage", needKind: "hunger" }, 0);
    const tilt = memoryWeightTilt(c, { needKind: "hunger" }, 1);
    expect(tilt).toBeGreaterThan(0);
    const noMatchTilt = memoryWeightTilt(c, { needKind: "rest" }, 1);
    expect(noMatchTilt).toBe(0);
  });

  it("materiality: only memories above the influence threshold are named in explanations", () => {
    const c = colonist();
    formMemory(c, { type: "deprivation", impact: "low", description: "trivial", needKind: "hunger" }, 0);
    const longAfter = MEMORY_CALIBRATION.recencyHalfLifeSecondsByImpact.low * 20;
    expect(materialMemories(c, { needKind: "hunger" }, longAfter)).toHaveLength(0);
    expect(materialMemories(c, { needKind: "hunger" }, 0)).toHaveLength(1);
  });
});
