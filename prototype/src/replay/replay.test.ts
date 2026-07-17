// Build Step 10 — replay harness tests: identical replay, payload/missing/extra divergence
// detection, deterministic first-divergence reporting, diverging-seed behavior.

import { describe, expect, it } from "vitest";
import { createInitialState, run } from "../simulation/run.js";
import type { SimulationState } from "../simulation/tick.js";
import type { EventRecord } from "../records/logs.js";
import { deserialize, serialize } from "../core/serialization.js";
import { applyInteraction, createRelationshipStore, type RelationshipStore } from "../colonist/relationships.js";
import { compareTraces, verifyReplay } from "./replay.js";

/** A non-empty relationship store — for tests proving the relationship slice is actually covered, not just trivially empty on both sides. */
function sampleRelationshipStore(): RelationshipStore {
  return applyInteraction(createRelationshipStore(), {
    colonistAId: "c1",
    colonistBId: "zeke",
    tick: 0,
    changeSource: "sharedTaskCompletion",
    initiatorId: "c1",
    responderId: "zeke",
    aTowardBDelta: 12,
    bTowardADelta: 8,
  }).store;
}

function completedRun(seed: number, ticks: number): { initial: SimulationState; final: SimulationState } {
  const initial = createInitialState(seed, "c1", "Maya", ["engineering"]);
  return { initial, final: run(initial, ticks).finalState };
}

describe("identical replay", () => {
  it("replaying from the same initial state matches the retained records completely", () => {
    const { initial, final } = completedRun(1, 300);
    const result = verifyReplay(initial, final);
    expect(result).toEqual({
      kind: "match",
      eventRecordsCompared: final.eventLog.length,
      decisionRecordsCompared: final.decisionLog.length,
    });
  });

  it("same seed + same state reproduce identical results across repeated verifications (determinism)", () => {
    const { initial, final } = completedRun(9, 200);
    expect(verifyReplay(initial, final)).toEqual(verifyReplay(initial, final));
  });

  it("replaying from a mid-run state (whose logs already carry prior records) also matches", () => {
    const initial = createInitialState(4, "c1", "Maya");
    const midpoint = run(initial, 100).finalState;
    const final = run(midpoint, 100).finalState;
    expect(verifyReplay(midpoint, final).kind).toBe("match");
  });

  it("rejects an expected state whose clock precedes the initial state's", () => {
    const { initial, final } = completedRun(1, 100);
    expect(() => verifyReplay(final, initial)).toThrow();
  });
});

describe("divergence detection", () => {
  it("a changed event payload is detected at its exact index with its record kind", () => {
    const { initial, final } = completedRun(1, 300);
    const idx = final.eventLog.findIndex((r) => r.event.kind === "executionProgressed");
    expect(idx).toBeGreaterThanOrEqual(0);
    const record = final.eventLog[idx]!;
    const tamperedEvent = { ...record.event, elapsedTicks: 9999 } as EventRecord["event"];
    const tamperedLog = final.eventLog.map((r, i) => (i === idx ? { ...r, event: tamperedEvent } : r));

    const result = compareTraces(tamperedLog, final.decisionLog, final.eventLog, final.decisionLog);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("event");
      expect(result.index).toBe(idx);
      expect(result.recordKind).toBe("executionProgressed");
      expect(result.expected).toEqual({ ...record, event: tamperedEvent });
      expect(result.actual).toEqual(record);
    }
  });

  it("a changed decision payload is detected in the decision log when the event log still matches", () => {
    const { final } = completedRun(1, 300);
    expect(final.decisionLog.length).toBeGreaterThan(0);
    const record = final.decisionLog[0]!;
    const tampered = final.decisionLog.map((r, i) =>
      i === 0 ? { ...r, outcome: { ...r.outcome, prngState: { a: r.outcome.prngState.a + 1, draws: r.outcome.prngState.draws } } } : r,
    );

    const result = compareTraces(final.eventLog, tampered, final.eventLog, final.decisionLog);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("decision");
      expect(result.index).toBe(0);
      expect(result.recordKind).toBe("decision");
      expect(result.expected).toEqual(tampered[0]);
      expect(result.actual).toEqual(record);
    }
  });

  it("a missing record (retained log has one the replay never reproduces) is detected with actual=null", () => {
    const { final } = completedRun(1, 300);
    const fabricated = { seq: final.eventLog.length, tick: final.clock.tick, event: { kind: "bootstrap" } } as const;
    const withExtra = [...final.eventLog, fabricated];

    const result = compareTraces(withExtra, final.decisionLog, final.eventLog, final.decisionLog);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("event");
      expect(result.index).toBe(final.eventLog.length);
      expect(result.expected).toEqual(fabricated);
      expect(result.actual).toBeNull();
    }
  });

  it("an extra record (replay produces one the retained log lacks) is detected with expected=null", () => {
    const { final } = completedRun(1, 300);
    const truncated = final.eventLog.slice(0, -1);

    const result = compareTraces(truncated, final.decisionLog, final.eventLog, final.decisionLog);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("event");
      expect(result.index).toBe(truncated.length);
      expect(result.expected).toBeNull();
      expect(result.actual).toEqual(final.eventLog[final.eventLog.length - 1]);
    }
  });

  it("the FIRST divergence is reported, deterministically, when multiple exist", () => {
    const { final } = completedRun(1, 300);
    const indices = final.eventLog
      .map((r, i) => (r.event.kind === "executionProgressed" ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, 2);
    expect(indices).toHaveLength(2);
    const tampered = final.eventLog.map((r, i) =>
      indices.includes(i) ? { ...r, event: { ...r.event, elapsedTicks: 9999 } as EventRecord["event"] } : r,
    );

    const first = compareTraces(tampered, final.decisionLog, final.eventLog, final.decisionLog);
    const second = compareTraces(tampered, final.decisionLog, final.eventLog, final.decisionLog);
    expect(first.kind).toBe("divergence");
    if (first.kind === "divergence") {
      expect(first.index).toBe(indices[0]); // the earlier of the two corruptions, never the later
    }
    expect(second).toEqual(first); // repeated comparison reports the identical divergence
  });
});

describe("terminal-state verification (final review fix)", () => {
  it("an identical replay matches both the logs and the terminal state", () => {
    const { initial, final } = completedRun(1, 100);
    expect(verifyReplay(initial, final).kind).toBe("match");
  });

  it("identical logs but a modified final need value fails at its exact state path", () => {
    const { initial, final } = completedRun(1, 100);
    const rt = final.colonists[0]!;
    const tampered: SimulationState = {
      ...final,
      colonists: [{ ...rt, colonist: { ...rt.colonist, needs: { ...rt.colonist.needs, hunger: { ...rt.colonist.needs.hunger, level: 0.12345 } } } }],
    };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toBe("colonists[0].colonist.needs.hunger.level");
      expect(result.expected).toBe(0.12345);
      expect(result.actual).toBe(final.colonists[0]!.colonist.needs.hunger.level);
    }
  });

  it("identical logs but a modified world stock fails at world.foodStock", () => {
    const { initial, final } = completedRun(1, 100);
    const tampered: SimulationState = { ...final, world: { ...final.world, foodStock: final.world.foodStock + 1 } };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toBe("world.foodStock");
    }
  });

  it("identical logs but modified execution progress fails at execution.elapsedTicks", () => {
    const { initial, final } = completedRun(42, 100);
    const rt = final.colonists[0]!;
    expect(rt.execution).not.toBeNull(); // sanity: fixture actually has a terminal execution
    const tampered: SimulationState = {
      ...final,
      colonists: [{ ...rt, execution: { ...rt.execution!, elapsedTicks: rt.execution!.elapsedTicks + 1 } }],
    };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toBe("colonists[0].execution.elapsedTicks");
    }
  });

  it("identical logs but a modified PRNG state fails at prng.a", () => {
    const { initial, final } = completedRun(1, 100);
    const tampered: SimulationState = { ...final, prng: { a: final.prng.a + 1, draws: final.prng.draws } };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toBe("prng.a");
    }
  });

  it("the first state divergence path is deterministic when multiple fields differ", () => {
    const { initial, final } = completedRun(1, 100);
    // world precedes prng in the fixed STATE_FIELDS order — the report must always name world.
    const tampered: SimulationState = {
      ...final,
      world: { ...final.world, foodStock: final.world.foodStock + 1 },
      prng: { a: final.prng.a + 1, draws: final.prng.draws },
    };
    const first = verifyReplay(initial, tampered);
    const second = verifyReplay(initial, tampered);
    expect(first.kind).toBe("divergence");
    if (first.kind === "divergence") {
      expect(first.path).toBe("world.foodStock");
    }
    expect(second).toEqual(first);
  });

  it("save/load continuation verification remains successful under full-state comparison", () => {
    const initial = createInitialState(6, "c1", "Maya", ["engineering"]);
    const midpoint = run(initial, 100).finalState;
    const loaded = deserialize(serialize(midpoint));
    const final = run(loaded, 100).finalState;
    expect(verifyReplay(loaded, final).kind).toBe("match");
    expect(verifyReplay(initial, final).kind).toBe("match");
  });

  it("a relationship store populated identically on both sides still matches (Stage 2 build steps 5, 8)", () => {
    const initial = createInitialState(1, "c1", "Maya", ["engineering"]);
    const withRelationships: SimulationState = { ...initial, relationships: sampleRelationshipStore() };
    const final = run(withRelationships, 100).finalState;
    // Build step 8: tick.ts applies atrophy every tick, so a materialized pair (c1/zeke,
    // interacted at tick 0) actually decays over 100 real ticks — the store is NOT unchanged.
    // What must still hold is determinism: replaying the same run reproduces the exact same
    // decayed terminal state.
    expect(final.relationships).not.toEqual(withRelationships.relationships);
    expect(verifyReplay(withRelationships, final).kind).toBe("match");
  });

  it("replay stays deterministic once cumulative atrophy actually forms a Relational memory (Stage 2 build step 8)", () => {
    const initial = createInitialState(1, "c1", "Maya", ["engineering"]);
    const withRelationships: SimulationState = { ...initial, relationships: sampleRelationshipStore() };
    // 800 ticks is enough for atrophyPerTick (0.02) to cumulatively cross relationshipChangeSignificance (15).
    const final = run(withRelationships, 800).finalState;
    expect(final.colonists[0]!.colonist.memory.some((e) => e.type === "relational")).toBe(true); // sanity: it really formed
    expect(verifyReplay(withRelationships, final).kind).toBe("match");
  });

  it("identical logs but a modified relationship store fails at its exact path (Stage 2 build step 5)", () => {
    const { initial, final } = completedRun(1, 100);
    expect(final.relationships).toEqual(createRelationshipStore()); // sanity: nothing materialized in a real run yet
    const tampered: SimulationState = { ...final, relationships: sampleRelationshipStore() };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toBe("relationships.pairs.c1");
    }
  });

  it("identical logs but a modified relationshipAffinityBaselines fails at its exact path (Stage 2 build step 8)", () => {
    const initial = createInitialState(1, "c1", "Maya", ["engineering"]);
    const withRelationships: SimulationState = { ...initial, relationships: sampleRelationshipStore() };
    const final = run(withRelationships, 800).finalState;
    const rt = final.colonists[0]!;
    const baseline = rt.relationshipAffinityBaselines.zeke;
    expect(baseline).toBeDefined(); // sanity: the partner really was observed
    const tampered: SimulationState = {
      ...final,
      colonists: [{ ...rt, relationshipAffinityBaselines: { ...rt.relationshipAffinityBaselines, zeke: baseline! + 1 } }],
    };
    const result = verifyReplay(withRelationships, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toBe("colonists[0].relationshipAffinityBaselines.zeke");
    }
  });

  it("a multi-entry colonist collection replays deterministically (Stage 2 Slice 6a)", () => {
    const zeke = { id: "zeke", name: "Zeke", skills: [], baseTraits: [] } as const;
    const yara = { id: "yara", name: "Yara", skills: [], baseTraits: [] } as const;
    const initial = createInitialState(1, "c1", "Maya", ["engineering"], [], [zeke, yara]);
    const final = run(initial, 100).finalState;
    expect(final.colonists.map((r) => r.colonist.identity.id)).toEqual(["c1", "yara", "zeke"]);
    expect(verifyReplay(initial, final).kind).toBe("match");
  });

  it("identical logs but a tampered inert collection entry fails at its exact colonists[i] path", () => {
    const zeke = { id: "zeke", name: "Zeke", skills: [], baseTraits: [] } as const;
    const initial = createInitialState(1, "c1", "Maya", ["engineering"], [], [zeke]);
    const final = run(initial, 100).finalState;
    const zekeRt = final.colonists[1]!;
    const tampered: SimulationState = {
      ...final,
      colonists: [final.colonists[0]!, { ...zekeRt, colonist: { ...zekeRt.colonist, identity: { ...zekeRt.colonist.identity, name: "Tampered" } } }],
    };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toBe("colonists[1].colonist.identity.name");
    }
  });
});

describe("socialOffers terminal-state verification (Stage 2 Slice 5, ADR-21 D6)", () => {
  it("reports the first socialOffers divergence path when the offer store is tampered", () => {
    const { initial, final } = completedRun(1, 10);
    const tampered: SimulationState = {
      ...final,
      socialOffers: {
        offers: [
          {
            id: 0,
            initiatorId: "c1",
            responderId: "zeke",
            action: "conversation",
            createdAtTick: 1,
            respondableAtTick: 2,
            expiresAtTick: 5,
            status: "pending",
            resolvedAtTick: null,
            reason: null,
          },
        ],
        nextOfferSequence: 1,
      },
    };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("state");
      expect(result.path).toMatch(/^socialOffers\./);
    }
  });

  it("a tampered counter alone is caught", () => {
    const { initial, final } = completedRun(1, 10);
    const tampered: SimulationState = { ...final, socialOffers: { ...final.socialOffers, nextOfferSequence: 99 } };
    const result = verifyReplay(initial, tampered);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.path).toBe("socialOffers.nextOfferSequence");
    }
  });
});

describe("diverging seeds", () => {
  it("replaying retained records against a different seed's initial state diverges — deterministically, not flakily", () => {
    const { final } = completedRun(1, 300);
    const otherSeedInitial = createInitialState(2, "c1", "Maya", ["engineering"]);

    // Divergence is guaranteed here (not merely possible): decision records retain the PRNG
    // state, which differs from the very first draw-free decision on — so this scenario is
    // stable across runs, never dependent on whether a weighted choice happened to land equal.
    const first = verifyReplay(otherSeedInitial, final);
    const second = verifyReplay(otherSeedInitial, final);
    expect(first.kind).toBe("divergence");
    expect(second).toEqual(first);
  });

  it("divergence is a returned finding, never a thrown error", () => {
    const { final } = completedRun(1, 100);
    const otherSeedInitial = createInitialState(3, "c1", "Maya", ["engineering"]);
    expect(() => verifyReplay(otherSeedInitial, final)).not.toThrow();
  });
});

describe("purity", () => {
  it("verifyReplay mutates neither the initial nor the expected state", () => {
    const { initial, final } = completedRun(1, 200);
    const initialSnapshot = JSON.parse(JSON.stringify(initial));
    const finalSnapshot = JSON.parse(JSON.stringify(final));
    verifyReplay(initial, final);
    expect(initial).toEqual(initialSnapshot);
    expect(final).toEqual(finalSnapshot);
  });
});
