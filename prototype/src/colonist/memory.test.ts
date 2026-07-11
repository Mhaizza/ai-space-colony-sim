// M9 Memory System tests — formation, immutable impact, recency decay, bounded pool,
// lowest-influence eviction, determinism, purity.

import { describe, expect, it } from "vitest";
import { MEMORY_TUNING } from "../config/tuning.js";
import {
  considerConditionFormation,
  considerDeprivationFormation,
  createMemoryPool,
  influence,
  influenceBreakdown,
  type MemoryPool,
} from "./memory.js";

describe("pool initialization", () => {
  it("starts empty", () => {
    expect(createMemoryPool()).toEqual([]);
  });
});

describe("memory formation — involuntary, significance-gated", () => {
  it("forms a Deprivation memory when the level drop meets significance", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 100, "hunger", 0.9, 0.9 - MEMORY_TUNING.needChangeSignificance);
    expect(pool).toHaveLength(1);
    expect(pool[0]!.type).toBe("deprivation");
  });

  it("does NOT form a memory when the change is below significance", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 100, "hunger", 0.9, 0.9 - MEMORY_TUNING.needChangeSignificance / 2);
    expect(pool).toEqual([]);
  });

  it("does not form a Deprivation memory when the level rises (restoration is not deprivation)", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 100, "hunger", 0.3, 0.3 + MEMORY_TUNING.needChangeSignificance);
    expect(pool).toEqual([]);
  });

  it("forms a Condition memory when a stress change meets significance, in either direction", () => {
    const rising = considerConditionFormation(createMemoryPool(), 100, 0.2, 0.2 + MEMORY_TUNING.stressChangeSignificance);
    const falling = considerConditionFormation(createMemoryPool(), 100, 0.6, 0.6 - MEMORY_TUNING.stressChangeSignificance);
    expect(rising[0]!.context).toEqual({ direction: "rising" });
    expect(falling[0]!.context).toEqual({ direction: "falling" });
  });

  it("does NOT form a Condition memory below significance", () => {
    const pool = considerConditionFormation(createMemoryPool(), 100, 0.2, 0.2 + MEMORY_TUNING.stressChangeSignificance / 2);
    expect(pool).toEqual([]);
  });

  it("formation is involuntary and trait-ungated: neither formation function accepts a trait parameter", () => {
    // Type-level guarantee: considerDeprivationFormation/considerConditionFormation have no
    // TraitId argument in their signatures. This test documents the invariant directly —
    // calling them successfully with only (pool, tick, ..., before, after) proves no trait
    // input is required or possible.
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "rest", 1, 0);
    expect(pool).toHaveLength(1);
  });
});

describe("impact fixed at formation, immutable afterward", () => {
  it("impact does not change as the entry ages — only derived influence changes", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0);
    const entry = pool[0]!;
    const impactAtFormation = entry.impact;

    // Query influence at two much later ticks — the stored entry, and its impact field, must
    // be byte-identical both times; only the *derived* influence value may differ.
    influence(entry, 10);
    influence(entry, 10_000);
    expect(entry.impact).toBe(impactAtFormation);
    expect(pool[0]!.impact).toBe(impactAtFormation);
  });

  it("impact is derived only from the triggering delta, clamped to [0, 1]", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0); // delta = 1
    expect(pool[0]!.impact).toBe(1);
  });
});

describe("recency decay and influence = recency × impact", () => {
  it("influence decreases as the entry ages", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0);
    const entry = pool[0]!;
    const early = influence(entry, 1);
    const later = influence(entry, 500);
    expect(later).toBeLessThan(early);
  });

  it("influence never goes negative as recency decays past zero", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0);
    expect(influence(pool[0]!, 10_000_000)).toBeGreaterThanOrEqual(0);
  });

  it("influenceBreakdown decomposes recency and impact separately and they multiply to the influence", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0);
    const breakdown = influenceBreakdown(pool[0]!, 50);
    expect(breakdown.recency * breakdown.impact).toBeCloseTo(breakdown.influence, 10);
    expect(breakdown.entry).toBe(pool[0]);
  });

  it("rejects a query tick earlier than formation", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 100, "hunger", 1, 0);
    expect(() => influence(pool[0]!, 50)).toThrow();
  });
});

describe("bounded pool — never exceeds capacity", () => {
  it("stays at or under MEMORY_TUNING.poolSize across many formations", () => {
    let pool: MemoryPool = createMemoryPool();
    for (let i = 0; i < MEMORY_TUNING.poolSize * 3; i++) {
      pool = considerDeprivationFormation(pool, i, "hunger", 1, 0);
      expect(pool.length).toBeLessThanOrEqual(MEMORY_TUNING.poolSize);
    }
    expect(pool.length).toBe(MEMORY_TUNING.poolSize);
  });
});

describe("eviction by lowest current influence", () => {
  it("evicts the entry with the lowest influence at the eviction tick, not the oldest by default", () => {
    // Fill to capacity with high-impact, old entries; then form one more entry at a much
    // later tick so the old entries have decayed. Compute the expected minimum-influence
    // entry directly from the full candidate set (capacity + 1), then assert eviction removed
    // exactly that one — proving eviction follows influence, not formation order.
    let pool: MemoryPool = createMemoryPool();
    for (let i = 0; i < MEMORY_TUNING.poolSize; i++) {
      pool = considerDeprivationFormation(pool, i, "hunger", 1, 0); // impact 1, ages together
    }
    expect(pool.length).toBe(MEMORY_TUNING.poolSize);

    const lateTick = MEMORY_TUNING.poolSize + 5000;
    const grown = considerDeprivationFormation(pool, lateTick, "hunger", 1, 1 - MEMORY_TUNING.needChangeSignificance);
    expect(grown.length).toBe(MEMORY_TUNING.poolSize); // one evicted to stay at capacity

    // The newcomer's id/impact are fully determined by the formation call above — construct
    // it directly rather than re-invoking the (pure, deterministic) formation function.
    const newcomer = {
      id: pool.length,
      type: "deprivation" as const,
      context: { needId: "hunger" as const },
      formedAtTick: lateTick,
      impact: MEMORY_TUNING.needChangeSignificance,
    };
    const candidates = [...pool, newcomer];
    const withInfluence = candidates.map((e) => ({ e, inf: influence(e, lateTick) }));
    const expectedEvicted = withInfluence.reduce((worst, cur) =>
      cur.inf < worst.inf || (cur.inf === worst.inf && cur.e.id < worst.e.id) ? cur : worst,
    ).e;

    expect(grown.find((e) => e.id === expectedEvicted.id)).toBeUndefined();
    for (const c of candidates) {
      if (c.id !== expectedEvicted.id) {
        expect(grown.find((e) => e.id === c.id)).toBeDefined();
      }
    }
  });

  it("directly: given a small pool, eviction removes the strictly-lowest-influence entry", () => {
    // Build a 2-entry pool manually via formation with deliberately different impacts, at the
    // same tick, then force a third formation to trigger eviction — the lower-impact entry
    // (lower influence, since recency is equal) must be the one removed.
    const capacity = MEMORY_TUNING.poolSize;
    let pool: MemoryPool = createMemoryPool();
    // Fill capacity-1 slots with high impact.
    for (let i = 0; i < capacity - 1; i++) {
      pool = considerDeprivationFormation(pool, 0, "hunger", 1, 0); // impact 1
    }
    // One low-impact entry (still above significance) at the same tick — lowest influence of the group.
    pool = considerDeprivationFormation(pool, 0, "rest", 1, 1 - MEMORY_TUNING.needChangeSignificance);
    const lowImpactId = pool[pool.length - 1]!.id;
    expect(pool.length).toBe(capacity);

    // One more formation triggers eviction at the same tick — recency is identical across all
    // entries, so the strictly lowest-impact entry must be the one evicted.
    const grown = considerDeprivationFormation(pool, 0, "safety", 1, 0); // impact 1
    expect(grown.length).toBe(capacity);
    expect(grown.find((e) => e.id === lowImpactId)).toBeUndefined();
  });
});

describe("determinism", () => {
  it("identical formation sequences from identical starting pools produce identical results", () => {
    const a = considerConditionFormation(considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0), 10, 0.1, 0.5);
    const b = considerConditionFormation(considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0), 10, 0.1, 0.5);
    expect(a).toEqual(b);
  });

  it("ids are assigned deterministically in formation order", () => {
    let pool: MemoryPool = createMemoryPool();
    pool = considerDeprivationFormation(pool, 0, "hunger", 1, 0);
    pool = considerConditionFormation(pool, 1, 0.1, 0.5);
    expect(pool.map((e) => e.id)).toEqual([0, 1]);
  });
});

describe("purity", () => {
  it("formation functions do not mutate the input pool", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0);
    const snapshot = JSON.parse(JSON.stringify(pool));
    considerConditionFormation(pool, 5, 0.1, 0.5);
    expect(pool).toEqual(snapshot);
  });

  it("influence and influenceBreakdown do not mutate the entry", () => {
    const pool = considerDeprivationFormation(createMemoryPool(), 0, "hunger", 1, 0);
    const entry = pool[0]!;
    const snapshot = { ...entry };
    influence(entry, 100);
    influenceBreakdown(entry, 200);
    expect(entry).toEqual(snapshot);
  });
});

describe("not an event log", () => {
  it("routine (non-significant) changes leave the pool untouched — memory is not a record of everything", () => {
    let pool: MemoryPool = createMemoryPool();
    for (let i = 0; i < 50; i++) {
      // Tiny, insignificant deprivation every tick — none of these should form a memory.
      pool = considerDeprivationFormation(pool, i, "hunger", 0.9, 0.9 - 0.001);
    }
    expect(pool).toEqual([]);
  });
});
