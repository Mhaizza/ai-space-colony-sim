// M10 Relationships tests. Build step 1: identity ordering, collision-safety, self-pair
// rejection, both directional reads, absent-pair side-effect-freedom, owner-direction /
// reverse-perspective-leakage boundary. Build step 2: applyInteraction/applyAtrophy — exact
// return shape, atomicity, clamping, history bound/eviction, atrophy eligibility, complete
// history-entry fields. Build step 3: serialization + load validation (ADR-20 D8) — the eight
// required rejections, round-trip fidelity/ordering, and malformed load leaving input untouched.

import { describe, expect, it } from "vitest";
import {
  ABSENT_PAIR_PERSPECTIVE,
  applyAtrophy,
  applyInteraction,
  canonicalPairId,
  createRelationshipStore,
  deriveRelationshipState,
  deserializeRelationshipStore,
  pairView,
  perspective,
  serializeRelationshipStore,
  type InteractionFact,
  type PairRecord,
  type RelationshipStore,
} from "./relationships.js";

function storeWith(minId: string, maxId: string, record: PairRecord): RelationshipStore {
  return { pairs: { [minId]: { [maxId]: record } } };
}

describe("canonical pair identity (ADR-20 D5)", () => {
  it("orders the tuple by ordinal string comparison, independent of argument order", () => {
    expect(canonicalPairId("alice", "bob")).toEqual(["alice", "bob"]);
    expect(canonicalPairId("bob", "alice")).toEqual(["alice", "bob"]);
  });

  it("rejects self-pairs rather than silently accepting them", () => {
    expect(() => canonicalPairId("alice", "alice")).toThrow(/self-pair/i);
  });

  it("rejects property-key ids that would corrupt the plain-object store", () => {
    expect(() => canonicalPairId("__proto__", "alice")).toThrow(/unsafe/i);
    expect(() => canonicalPairId("alice", "constructor")).toThrow(/unsafe/i);
    expect(() => canonicalPairId("alice", "toString")).toThrow(/unsafe/i);
  });

  it("is collision-safe: nested-object storage never confuses ids that would collide under a delimiter-joined key", () => {
    const recordAlicePair: PairRecord = {
      pair: ["alice", "bob:carol"],
      minTowardMaxAffinity: 12,
      maxTowardMinAffinity: -5,
      history: [],
      lastInteractionTick: 10,
    };
    const recordOtherPair: PairRecord = {
      pair: ["alice:bob", "carol"],
      minTowardMaxAffinity: 88,
      maxTowardMinAffinity: 60,
      history: [],
      lastInteractionTick: 20,
    };
    const store: RelationshipStore = {
      pairs: {
        alice: { "bob:carol": recordAlicePair },
        "alice:bob": { carol: recordOtherPair },
      },
    };

    expect(pairView(store, "alice", "bob:carol").minTowardMax.affinity).toBe(12);
    expect(pairView(store, "alice:bob", "carol").minTowardMax.affinity).toBe(88);
  });
});

describe("deriveRelationshipState (ADR-12 score bands)", () => {
  it("derives the seven named states from their accepted boundaries", () => {
    expect(deriveRelationshipState(100)).toBe("bonded");
    expect(deriveRelationshipState(75)).toBe("bonded");
    expect(deriveRelationshipState(74)).toBe("positive");
    expect(deriveRelationshipState(40)).toBe("positive");
    expect(deriveRelationshipState(39)).toBe("neutral");
    expect(deriveRelationshipState(10)).toBe("neutral");
    expect(deriveRelationshipState(9)).toBe("acquainted");
    expect(deriveRelationshipState(0)).toBe("acquainted");
    expect(deriveRelationshipState(-10)).toBe("acquainted");
    expect(deriveRelationshipState(-11)).toBe("tense");
    expect(deriveRelationshipState(-40)).toBe("tense");
    expect(deriveRelationshipState(-41)).toBe("hostile");
    expect(deriveRelationshipState(-75)).toBe("hostile");
    expect(deriveRelationshipState(-76)).toBe("fractured");
    expect(deriveRelationshipState(-100)).toBe("fractured");
  });
});

describe("perspective — owner-direction read (ADR-20 D2)", () => {
  const record: PairRecord = {
    pair: ["alice", "bob"],
    minTowardMaxAffinity: 30,
    maxTowardMinAffinity: -20,
    history: [],
    lastInteractionTick: 100,
  };
  const store = storeWith("alice", "bob", record);

  it("returns each owner's own direction, and the two directions are independent", () => {
    expect(perspective(store, "alice", "bob")).toEqual({ affinity: 30, state: "neutral" });
    expect(perspective(store, "bob", "alice")).toEqual({ affinity: -20, state: "tense" });
  });

  it("never exposes the reverse perspective regardless of argument order", () => {
    const aliceView = perspective(store, "alice", "bob");
    const bobView = perspective(store, "bob", "alice");
    expect(aliceView.affinity).not.toBe(bobView.affinity);
    expect(aliceView).not.toEqual(bobView);
    // Asking for alice's view must never yield bob's stored affinity, and vice versa.
    expect(aliceView.affinity).toBe(record.minTowardMaxAffinity);
    expect(bobView.affinity).toBe(record.maxTowardMinAffinity);
  });

  it("rejects a self-pair perspective request", () => {
    expect(() => perspective(store, "alice", "alice")).toThrow(/self-pair/i);
  });
});

describe("pairView — system-level read, both directions (ADR-20 D2)", () => {
  it("returns both directional perspectives for a materialized pair", () => {
    const record: PairRecord = {
      pair: ["alice", "bob"],
      minTowardMaxAffinity: 30,
      maxTowardMinAffinity: -20,
      history: [],
      lastInteractionTick: 100,
    };
    const store = storeWith("alice", "bob", record);

    expect(pairView(store, "alice", "bob")).toEqual({
      pair: ["alice", "bob"],
      minTowardMax: { affinity: 30, state: "neutral" },
      maxTowardMin: { affinity: -20, state: "tense" },
      history: [],
      lastInteractionTick: 100,
    });
  });

  it("is order-independent: querying (bob, alice) returns the same canonical pair", () => {
    const record: PairRecord = {
      pair: ["alice", "bob"],
      minTowardMaxAffinity: 5,
      maxTowardMinAffinity: 5,
      history: [],
      lastInteractionTick: null,
    };
    const store = storeWith("alice", "bob", record);
    expect(pairView(store, "bob", "alice")).toEqual(pairView(store, "alice", "bob"));
  });
});

describe("absent pair — deterministic default, side-effect-free (ADR-20 D4)", () => {
  it("perspective on an absent pair returns the D4 default", () => {
    const store = createRelationshipStore();
    expect(perspective(store, "alice", "bob")).toEqual(ABSENT_PAIR_PERSPECTIVE);
    expect(perspective(store, "alice", "bob")).toEqual({ affinity: 0, state: "acquainted" });
  });

  it("pairView on an absent pair returns both directions at the D4 default, empty history, no last-interaction tick", () => {
    const store = createRelationshipStore();
    expect(pairView(store, "alice", "bob")).toEqual({
      pair: ["alice", "bob"],
      minTowardMax: ABSENT_PAIR_PERSPECTIVE,
      maxTowardMin: ABSENT_PAIR_PERSPECTIVE,
      history: [],
      lastInteractionTick: null,
    });
  });

  it("reading an absent pair never materializes a record — the store is unchanged", () => {
    const store = createRelationshipStore();
    perspective(store, "alice", "bob");
    pairView(store, "alice", "bob");
    perspective(store, "bob", "alice");

    expect(Object.keys(store.pairs)).toHaveLength(0);
    expect(createRelationshipStore()).toEqual({ pairs: {} });
  });
});

describe("applyInteraction — write path (ADR-20 D7)", () => {
  const baseFact: InteractionFact = {
    colonistAId: "alice",
    colonistBId: "bob",
    tick: 100,
    changeSource: "sharedTaskCompletion",
    initiatorId: "alice",
    responderId: "bob",
    aTowardBDelta: 10,
    bTowardADelta: 6,
  };

  it("returns the exact { store, consequences } shape", () => {
    const result = applyInteraction(createRelationshipStore(), baseFact);
    expect(Object.keys(result).sort()).toEqual(["consequences", "store"]);
    expect(result.store.pairs).not.toBeInstanceOf(Map); // plain object — round-trips like every other SimulationState field
    expect(result.consequences).toHaveLength(1);
    expect(result.consequences[0]!.kind).toBe("interaction");
  });

  it("is atomic and pure: the input store is unchanged, and unrelated pairs are untouched by reference", () => {
    const untouchedRecord: PairRecord = {
      pair: ["carol", "dave"],
      minTowardMaxAffinity: 1,
      maxTowardMinAffinity: 1,
      history: [],
      lastInteractionTick: 5,
    };
    const before: RelationshipStore = {
      pairs: { carol: { dave: untouchedRecord } },
    };
    const beforeInnerObject = before.pairs["carol"]!;

    const result = applyInteraction(before, baseFact);

    // Original store argument is untouched.
    expect(Object.keys(before.pairs)).toEqual(["carol"]);
    expect(before.pairs["alice"]).toBeUndefined();
    // The unrelated pair's own inner object is the exact same reference — not touched, not rebuilt.
    expect(result.store.pairs["carol"]).toBe(beforeInnerObject);
    expect(result.store.pairs["carol"]!["dave"]).toBe(untouchedRecord);
    // The new pair is present in the returned store only.
    expect(result.store.pairs["alice"]?.["bob"]).toBeDefined();
  });

  it("clamps resulting affinity to ADR-12's [-100, 100] range in each direction independently", () => {
    const store = createRelationshipStore();
    const first = applyInteraction(store, { ...baseFact, aTowardBDelta: 500, bTowardADelta: -500 });
    expect(first.consequences[0]).toMatchObject({
      resultingMinTowardMaxAffinity: 100,
      resultingMaxTowardMinAffinity: -100,
    });
    // Pushing further in the same direction cannot exceed the bound.
    const second = applyInteraction(first.store, { ...baseFact, aTowardBDelta: 500, bTowardADelta: -500 });
    expect(second.consequences[0]).toMatchObject({
      resultingMinTowardMaxAffinity: 100,
      resultingMaxTowardMinAffinity: -100,
    });
  });

  it("materializes the pair and updates lastInteractionTick even for a zero-delta routine interaction", () => {
    const zeroFact: InteractionFact = { ...baseFact, aTowardBDelta: 0, bTowardADelta: 0, tick: 42 };
    const result = applyInteraction(createRelationshipStore(), zeroFact);
    const record = result.store.pairs["alice"]!["bob"]!;
    expect(record.lastInteractionTick).toBe(42);
    expect(record.history).toEqual([]); // not significant enough to enter history
    expect(result.consequences[0]).toMatchObject({ enteredHistory: false });
  });

  it("bounds history to the configured capacity with deterministic FIFO eviction", () => {
    let store = createRelationshipStore();
    const interactionCount = 20; // exceeds the historyBound
    for (let i = 0; i < interactionCount; i++) {
      const result = applyInteraction(store, { ...baseFact, tick: i, aTowardBDelta: 20, bTowardADelta: 0 });
      store = result.store;
    }
    const record = store.pairs["alice"]!["bob"]!;
    expect(record.history.length).toBeLessThan(interactionCount);
    expect(record.history.length).toBeGreaterThan(0);
    // FIFO: the earliest surviving entry is not from tick 0 — the oldest were evicted.
    expect(record.history[0]!.tick).toBeGreaterThan(0);
    // The most recent interaction is always retained.
    expect(record.history[record.history.length - 1]!.tick).toBe(interactionCount - 1);
    // Sequence numbers remain strictly increasing even across eviction.
    for (let i = 1; i < record.history.length; i++) {
      expect(record.history[i]!.sequence).toBeGreaterThan(record.history[i - 1]!.sequence);
    }
  });

  it("records a complete history entry: tick, sequence, change source, initiator/responder, deltas in both directions, resulting affinities in both directions", () => {
    const result = applyInteraction(createRelationshipStore(), baseFact);
    const record = result.store.pairs["alice"]!["bob"]!;
    expect(record.history).toHaveLength(1);
    expect(record.history[0]).toEqual({
      tick: 100,
      sequence: 0,
      changeSource: "sharedTaskCompletion",
      initiatorId: "alice",
      responderId: "bob",
      minTowardMaxDelta: 10,
      maxTowardMinDelta: 6,
      resultingMinTowardMaxAffinity: 10,
      resultingMaxTowardMinAffinity: 6,
    });
  });

  it("maps directional deltas onto canonical min/max correctly regardless of argument order", () => {
    // "alice" < "bob", so alice is min. Calling with A=bob, B=alice must still land bob's
    // delta on maxTowardMin and alice's on minTowardMax.
    const fact: InteractionFact = {
      colonistAId: "bob",
      colonistBId: "alice",
      tick: 1,
      changeSource: "sharedTaskCompletion",
      initiatorId: "bob",
      responderId: "alice",
      aTowardBDelta: 7, // bob toward alice => maxTowardMin (bob is max)
      bTowardADelta: 12, // alice toward bob => minTowardMax (alice is min)
    };
    const result = applyInteraction(createRelationshipStore(), fact);
    const record = result.store.pairs["alice"]!["bob"]!;
    expect(record.minTowardMaxAffinity).toBe(12);
    expect(record.maxTowardMinAffinity).toBe(7);
  });
});

describe("applyAtrophy — write path (ADR-20 D7, D4)", () => {
  it("no-ops on an absent/unmaterialized store: unchanged store, no consequences", () => {
    const store = createRelationshipStore();
    const result = applyAtrophy(store, 100);
    expect(result.store).toEqual(store);
    expect(result.consequences).toEqual([]);
  });

  it("applies only to a materialized pair with a recorded lastInteractionTick; a pair without one is skipped", () => {
    const neverInteracted: PairRecord = {
      pair: ["carol", "dave"],
      minTowardMaxAffinity: 50,
      maxTowardMinAffinity: 50,
      history: [],
      lastInteractionTick: null, // materialized (e.g. a future background source) but never interacted
    };
    const interacted: PairRecord = {
      pair: ["alice", "bob"],
      minTowardMaxAffinity: 50,
      maxTowardMinAffinity: -50,
      history: [],
      lastInteractionTick: 10,
    };
    const store: RelationshipStore = {
      pairs: {
        alice: { bob: interacted },
        carol: { dave: neverInteracted },
      },
    };

    const result = applyAtrophy(store, 50);

    expect(result.consequences).toHaveLength(1);
    expect(result.consequences[0]).toMatchObject({ kind: "atrophy", pair: ["alice", "bob"] });
    // The never-interacted pair is untouched — same object reference, not just equal value.
    expect(result.store.pairs["carol"]!["dave"]).toBe(neverInteracted);
  });

  it("moves affinity negatively in both directions, clamped, and is pure/atomic per pair record", () => {
    const record: PairRecord = {
      pair: ["alice", "bob"],
      minTowardMaxAffinity: 10,
      maxTowardMinAffinity: -99,
      history: [],
      lastInteractionTick: 0,
    };
    const store: RelationshipStore = { pairs: { alice: { bob: record } } };

    const result = applyAtrophy(store, 1000); // large elapsed duration to force both directions to move/clamp

    const updated = result.store.pairs["alice"]!["bob"]!;
    expect(updated.minTowardMaxAffinity).toBeLessThan(record.minTowardMaxAffinity);
    expect(updated.maxTowardMinAffinity).toBe(-100); // clamped
    // Original store and record are untouched (purity).
    expect(store.pairs["alice"]!["bob"]).toBe(record);
    expect(record.minTowardMaxAffinity).toBe(10);
  });

  it("no-ops when elapsedDuration is not positive", () => {
    const record: PairRecord = {
      pair: ["alice", "bob"],
      minTowardMaxAffinity: 10,
      maxTowardMinAffinity: 10,
      history: [],
      lastInteractionTick: 0,
    };
    const store: RelationshipStore = { pairs: { alice: { bob: record } } };
    const result = applyAtrophy(store, 0);
    expect(result.store).toBe(store);
    expect(result.consequences).toEqual([]);
  });

  it("REGRESSION (Stage 2 Slice 6b): excludes MULTIPLE simultaneously-active pairs, not just one", () => {
    // Promoting every colonist to full simulation means more than one pair can be mid-interaction
    // in the same tick — excludedPairs generalizes from a single PairKey to a set for exactly
    // this reason (tick.ts's own companionship-credit path already applies that pair's delta
    // directly; atrophy must not ALSO apply to it the same tick).
    const record = (pair: readonly [string, string]): PairRecord => ({
      pair,
      minTowardMaxAffinity: 10,
      maxTowardMinAffinity: 10,
      history: [],
      lastInteractionTick: 0,
    });
    const store: RelationshipStore = {
      pairs: {
        alice: { bob: record(["alice", "bob"]), carol: record(["alice", "carol"]) },
        dave: { erin: record(["dave", "erin"]) },
      },
    };

    const result = applyAtrophy(store, 100, [
      ["alice", "bob"],
      ["dave", "erin"],
    ]);

    // Both excluded pairs are untouched by reference; the third (not excluded) pair moved.
    expect(result.store.pairs["alice"]!["bob"]).toBe(store.pairs["alice"]!["bob"]);
    expect(result.store.pairs["dave"]!["erin"]).toBe(store.pairs["dave"]!["erin"]);
    expect(result.consequences).toHaveLength(1);
    expect(result.consequences[0]).toMatchObject({ kind: "atrophy", pair: ["alice", "carol"] });
    expect(result.store.pairs["alice"]!["carol"]!.minTowardMaxAffinity).toBeLessThan(10);
  });

  it("an empty exclusion array behaves exactly like no exclusion at all", () => {
    const record: PairRecord = {
      pair: ["alice", "bob"],
      minTowardMaxAffinity: 10,
      maxTowardMinAffinity: 10,
      history: [],
      lastInteractionTick: 0,
    };
    const store: RelationshipStore = { pairs: { alice: { bob: record } } };
    const withEmpty = applyAtrophy(store, 50, []);
    const withUndefined = applyAtrophy(store, 50, undefined);
    expect(withEmpty.store).toEqual(withUndefined.store);
    expect(withEmpty.consequences).toEqual(withUndefined.consequences);
  });
});

describe("serialization + load validation (ADR-20 D8)", () => {
  const KNOWN_IDS = new Set(["alice", "bob", "carol"]);
  const CLOCK_TICK = 100;

  /** Two materialized pairs (bob-carol created first, then alice-bob) — one with 2 history entries, one with 1. */
  function sampleStore(): RelationshipStore {
    let store = createRelationshipStore();
    store = applyInteraction(store, {
      colonistAId: "bob",
      colonistBId: "carol",
      tick: 10,
      changeSource: "sharedTaskCompletion",
      initiatorId: "bob",
      responderId: "carol",
      aTowardBDelta: 8,
      bTowardADelta: 8,
    }).store;
    store = applyInteraction(store, {
      colonistAId: "alice",
      colonistBId: "bob",
      tick: 20,
      changeSource: "directConflict",
      initiatorId: "alice",
      responderId: "bob",
      aTowardBDelta: -15,
      bTowardADelta: -9,
    }).store;
    store = applyInteraction(store, {
      colonistAId: "alice",
      colonistBId: "bob",
      tick: 30,
      changeSource: "mutualSupportCrisis",
      initiatorId: null,
      responderId: null,
      aTowardBDelta: 6,
      bTowardADelta: 6,
    }).store;
    return store;
  }

  function validRecords(): any[] {
    return serializeRelationshipStore(sampleStore()) as any[];
  }

  describe("round-trip", () => {
    it("preserves both directions and history bit-identically", () => {
      const store = sampleStore();
      const restored = deserializeRelationshipStore(serializeRelationshipStore(store), KNOWN_IDS, CLOCK_TICK);
      expect(restored).toEqual(store);
    });

    it("serializes in canonical [min, max] lexicographic order regardless of materialization order", () => {
      // bob-carol was materialized before alice-bob, but serialization must still sort by pair.
      const serialized = serializeRelationshipStore(sampleStore()) as any[];
      expect(serialized.map((r) => r.pair)).toEqual([
        ["alice", "bob"],
        ["bob", "carol"],
      ]);
    });

    it("is stable under a second round-trip (deserialize -> serialize reproduces the same serialized form)", () => {
      const once = serializeRelationshipStore(sampleStore());
      const restored = deserializeRelationshipStore(once, KNOWN_IDS, CLOCK_TICK);
      const twice = serializeRelationshipStore(restored);
      expect(twice).toEqual(once);
    });
  });

  describe("malformed load does not mutate input and does not repair", () => {
    it("throws on a malformed record and leaves the raw input completely untouched", () => {
      const malformed = validRecords();
      malformed[0].minTowardMaxAffinity = 99999; // out of range
      const beforeCall = JSON.parse(JSON.stringify(malformed));

      expect(() => deserializeRelationshipStore(malformed, KNOWN_IDS, CLOCK_TICK)).toThrow();
      expect(malformed).toEqual(beforeCall); // no repair, no mutation of the rejected input
    });
  });

  describe("the eight required D8 rejections", () => {
    it("1. duplicate or non-canonical pair identities", () => {
      const duplicated = [...validRecords(), validRecords()[0]];
      expect(() => deserializeRelationshipStore(duplicated, KNOWN_IDS, CLOCK_TICK)).toThrow(/duplicate/i);

      const nonCanonical = validRecords();
      nonCanonical[0].pair = [nonCanonical[0].pair[1], nonCanonical[0].pair[0]]; // reversed order
      expect(() => deserializeRelationshipStore(nonCanonical, KNOWN_IDS, CLOCK_TICK)).toThrow(/canonical/i);
    });

    it("2. self-pairs or unknown colonist ids", () => {
      const selfPair = validRecords();
      selfPair[0].pair = ["alice", "alice"];
      expect(() => deserializeRelationshipStore(selfPair, KNOWN_IDS, CLOCK_TICK)).toThrow(/self-pair/i);

      const unknownId = validRecords();
      unknownId[0].pair = ["alice", "zeke"];
      expect(() => deserializeRelationshipStore(unknownId, KNOWN_IDS, CLOCK_TICK)).toThrow(/unknown colonist id/i);

      const unsafeId = validRecords();
      unsafeId[0].pair = ["__proto__", "alice"];
      expect(() => deserializeRelationshipStore(unsafeId, new Set([...KNOWN_IDS, "__proto__"]), CLOCK_TICK)).toThrow(/unsafe/i);

      const inheritedObjectKey = validRecords();
      inheritedObjectKey[0].pair = ["alice", "toString"];
      expect(() => deserializeRelationshipStore(inheritedObjectKey, new Set([...KNOWN_IDS, "toString"]), CLOCK_TICK)).toThrow(
        /unsafe/i,
      );
    });

    it("3. missing directional affinity values", () => {
      const missing = validRecords();
      delete missing[0].maxTowardMinAffinity;
      expect(() => deserializeRelationshipStore(missing, KNOWN_IDS, CLOCK_TICK)).toThrow();
    });

    it("4. non-finite or out-of-range affinity", () => {
      const nonFinite = validRecords();
      nonFinite[0].minTowardMaxAffinity = Number.POSITIVE_INFINITY;
      expect(() => deserializeRelationshipStore(nonFinite, KNOWN_IDS, CLOCK_TICK)).toThrow();

      const outOfRange = validRecords();
      outOfRange[0].minTowardMaxAffinity = 101;
      expect(() => deserializeRelationshipStore(outOfRange, KNOWN_IDS, CLOCK_TICK)).toThrow(/range/i);
    });

    it("5. stored named states", () => {
      const withNamedState = validRecords();
      withNamedState[0].minTowardMaxState = "bonded"; // named/derived state has no allowed field to live under
      expect(() => deserializeRelationshipStore(withNamedState, KNOWN_IDS, CLOCK_TICK)).toThrow(/unrecognized field/i);
    });

    it("6. history entries for another pair", () => {
      const wrongPairHistory = validRecords();
      wrongPairHistory[0].history[0].pair = ["bob", "carol"]; // belongs to the OTHER record
      expect(() => deserializeRelationshipStore(wrongPairHistory, KNOWN_IDS, CLOCK_TICK)).toThrow(/different pair/i);

      const unknownInitiator = validRecords();
      unknownInitiator[0].history[0].initiatorId = "ghost";
      expect(() => deserializeRelationshipStore(unknownInitiator, KNOWN_IDS, CLOCK_TICK)).toThrow(/unknown colonist id/i);

      const knownButWrongPairInitiator = validRecords();
      knownButWrongPairInitiator[0].history[0].initiatorId = "carol";
      expect(() => deserializeRelationshipStore(knownButWrongPairInitiator, KNOWN_IDS, CLOCK_TICK)).toThrow(/not a participant/i);
    });

    it("7. history out of deterministic order, over its bound, or postdating the loaded clock", () => {
      const outOfOrder = validRecords();
      // Two entries exist on the alice/bob record (ticks 20 then 30) — reverse them.
      outOfOrder[0].history = [...outOfOrder[0].history].reverse();
      expect(() => deserializeRelationshipStore(outOfOrder, KNOWN_IDS, CLOCK_TICK)).toThrow(/deterministic order/i);

      const overBound = validRecords();
      const [templateEntry] = overBound[0].history;
      overBound[0].history = Array.from({ length: 13 }, (_, i) => ({
        ...templateEntry,
        tick: i,
        sequence: i,
      }));
      overBound[0].lastInteractionTick = 12;
      expect(() => deserializeRelationshipStore(overBound, KNOWN_IDS, CLOCK_TICK)).toThrow(/exceeds its configured bound/i);

      const postdating = validRecords();
      expect(() => deserializeRelationshipStore(postdating, KNOWN_IDS, 5 /* before the fixture's ticks */)).toThrow(
        /postdates the loaded clock/i,
      );
    });

    it("8. invalid or non-monotone lastInteractionTick", () => {
      const negative = validRecords();
      negative[0].lastInteractionTick = -1;
      expect(() => deserializeRelationshipStore(negative, KNOWN_IDS, CLOCK_TICK)).toThrow();

      const nonMonotone = validRecords();
      nonMonotone[0].lastInteractionTick = 0; // precedes its own most recent history entry (tick 30)
      expect(() => deserializeRelationshipStore(nonMonotone, KNOWN_IDS, CLOCK_TICK)).toThrow(/non-monotone/i);
    });
  });
});
