# ADR-21 - Social Offer State Storage

**Status:** Proposed (awaiting architecture review)
**Date:** 2026-07-17
**Phase:** Phase 3 - Stage 2 Slice 5 architecture gate
**Deciders:** Project owner, Technical Architect
**Tracks:** GitHub issue #125 (parent #120)
**Governed by:** ADR-18 (Accepted - the offer/response participation architecture this storage serves), ADR-20 (Accepted - the storage/serialization discipline this ADR follows), `design/social-offer-response-protocol.md` v0.2.0 (Human-approved 2026-07-17 - the behavioral design this ADR gives a storage home), `design/engineering-specification.md` v0.3.0, `ai-studio/constitution/architecture-philosophy.md`

**This ADR does not contain:** behavioral rules. Responder eligibility, acceptance weighting, the response delay, and the hold/cancel/expire lifecycle are decided by ADR-18 D5 and the approved design document. This ADR decides only where offer state lives, what shape it has, how it is identified, bounded, serialized, and validated - the Data model / Save format / Serialization trigger surface that `ai-studio/workflows/kanban-update-protocol.md` requires an accepted ADR for.

---

## Context

The Human-approved design for Stage 2 Slice 5 (`design/social-offer-response-protocol.md` v0.2.0) makes Conversation and Shared Downtime explicit offers per ADR-18 D5: created at goal commitment, resolved deterministically no earlier than one tick later, with decline, cancellation, and expiry as first-class outcomes. Issue #120's acceptance criteria require pending and resolved offer state to survive save/load without semantic change and to be compared by replay.

That requires persistent state - a new top-level `SimulationState` slice, a save-version bump, and new load-validation rules. All three are architecture-review triggers (Data model, Save format, Serialization). ChatGPT design review 2026-07-17 correctly rejected the design's first draft for claiming no ADR was needed; this ADR is the required record.

The decision must preserve:

- Determinism obligations (`design/engineering-specification.md` §8): no wall-clock time, no random ids, stable ordering, replay-verifiable state.
- ADR-20's serialization discipline: bounded state, canonical ordering, validate-never-repair loading, save-version increment without a migration framework.
- The Stage 2 runtime boundary (Issue #99, reconciled): one fully simulated colonist plus an identity-only roster.
- M12's ownership of task/execution and the social offer/encounter protocol (engineering spec module table).

## Decision

### D1 - Offers live in one top-level `SimulationState.socialOffers` store owned by M12

```text
SocialOfferStore {
  offers: SocialOffer[]        // append-ordered; bounded per D4
  nextOfferSequence: number    // persisted counter, never derived
}
```

The store is a sibling of `relationships` and `roster` - the same additive top-level-slice pattern ADR-20 D8 established. No existing field is renamed, removed, or reinterpreted. M12 (Task & Execution System) owns the store: offers are created and resolved only in M12's phase slots (design D3), and no other module writes offer state.

An offer is **not** colonist-owned state: it is a fact about two colonists, the same reasoning that put pair records in a central M10 store (ADR-20 D1) rather than on each colonist. It has no home on `ColonistState` (the initiator holds only their ordinary committed goal) and none on a roster entry (identity-only, per Issue #99).

### D2 - One offer record, explicit status machine, all-tick fields stored

```text
SocialOffer {
  id: number                     // D3's persisted sequence
  initiatorId: string
  responderId: string
  action: "conversation" | "sharedDowntime"
  createdAtTick: number
  respondableAtTick: number      // stored at creation; never re-derived from tuning on load
  expiresAtTick: number          // stored at creation; never re-derived from tuning on load
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired"
  resolvedAtTick: number | null  // non-null exactly when status is not "pending"
  reason: string | null          // non-null exactly when status is "declined", "cancelled", or "expired"
}
```

`respondableAtTick` and `expiresAtTick` are **stored**, not derived: deriving them from tuning constants at read time would let a tuning change silently alter the semantics of already-saved pending offers, violating Issue #120's "save/load preserves offer state without semantic change." The tuning constants govern creation only.

The status machine is closed at five states. `"pending"` is the only non-terminal status; every transition out of it is final. Adding a status is a revision of this ADR, not a tuning or implementation choice (the closed-list discipline of ADR-17/ADR-18).

### D3 - Identity is a persisted monotonic counter, never derived, never a UUID

`id` is assigned from `nextOfferSequence` at creation; the counter increments by exactly one per creation and is serialized with the store. It is never recomputed by scanning existing offers: bounded retention (D4) evicts old resolved offers, and a scan-derived maximum would reuse an evicted offer's id. Random UUIDs and wall-clock components are prohibited (engineering spec §8; Issue #120 determinism constraints).

Processing order is ascending `id` wherever multiple offers are touched in one phase - which is append order, so iteration is the stored array in order, with no re-sort. This is the stable explicit processing order Issue #120 requires.

### D4 - Bounded retention: pending offers never evicted, resolved offers FIFO-bounded

Pending offers are never evicted - evicting one would silently destroy an in-flight interaction. Resolved offers (`accepted`/`declined`/`cancelled`/`expired`) beyond a bounded retention window are evicted oldest-first (lowest `id` first), the same deterministic FIFO shape as ADR-20's bounded pair history. The window size is a prototype tuning value; the boundedness itself is architecture (an unbounded log inside `SimulationState` would duplicate S2's event-log role and grow without limit).

Eviction never rolls back `nextOfferSequence` (D3) and never renumbers surviving offers.

The store is not a second event log: S2 remains the record-keeping owner. Resolved offers are retained only as short-horizon queryable state (inspector display, decline-cooldown-class reads the design may add within its own authority); anything needing long-horizon history belongs in S2 records, not here.

### D5 - Serialization: one new slice, save version incremented, validate-never-repair

The save format adds the `socialOffers` slice and increments the save version. No migration framework (ADR-20 D8's prototype posture). Offers serialize in stored (ascending-`id`) order.

Load rejects - never silently repairs, sorts, renumbers, or drops:

- duplicate offer ids;
- any offer id `>= nextOfferSequence` (the counter must exceed every id it has produced);
- `initiatorId` or `responderId` not present among known colonist ids (primary colonist + roster);
- `initiatorId === responderId` (self-offers invalid - same discipline as ADR-20 D5's self-pair rejection);
- an `action` outside the closed two-member union;
- a `status` outside the closed five-member union;
- `status: "pending"` with non-null `resolvedAtTick` or non-null `reason`;
- any terminal status with null `resolvedAtTick`;
- `"declined"`, `"cancelled"`, or `"expired"` with null `reason`;
- `respondableAtTick <= createdAtTick` (the design's structural one-tick response-delay floor);
- `expiresAtTick <= respondableAtTick` (an offer that expires before it is respondable is malformed);
- `resolvedAtTick` earlier than `createdAtTick`, or later than the loaded clock;
- more than one `"pending"` offer sharing the same `responderId` (the design's double-booking guard, checked as a store-level invariant);
- offers out of ascending-`id` order.

### D6 - Replay and inspection surfaces

`socialOffers` joins replay's compared terminal-state fields (`STATE_FIELDS`), diffed generically like `relationships` and `roster` - replay reports the first divergence by dotted path with no offer-specific comparison logic. The inspector exposes the offer list as a detached, JSON-safe copy, per the existing detachment rule (final review fix 2026-07-11): no inspection result may alias simulation state.

## Required Invariants

1. M12 is the only writer of offer state; offers are created and resolved only in the design's Phase 5/Phase 6 slots.
2. Every offer id is unique for the store's lifetime; `nextOfferSequence` strictly exceeds every id ever produced and never decreases.
3. `"pending"` is the only non-terminal status; a terminal offer never changes again.
4. Pending offers are never evicted; resolved-offer eviction is deterministic FIFO by id.
5. Tick fields (`respondableAtTick`, `expiresAtTick`) are fixed at creation; tuning changes never alter a stored offer's semantics.
6. Serialization preserves stored order; load validates every rule in D5 and repairs nothing.
7. Replay compares the full store; a save/load round-trip is semantically identity.
8. The store never becomes a decision input for any colonist other than through the design's own resolution steps - it is not a candidate-generation source (candidates come from the snapshot roster, mirroring ADR-20 D3).

## Options Considered

### Option A - Offer state on the initiator's ColonistState

**Rejected because:** an offer is a two-party fact (ADR-20 D1's reasoning); the responder side has no home on an identity-only roster entry; save/load of a pending offer would be entangled with colonist serialization; and a future slice where roster colonists initiate offers would force a redesign.

### Option B - Top-level bounded store with persisted counter (selected)

One owner (M12), one atomic update surface, additive serialization following ADR-20's accepted pattern, trivially replay-comparable.

### Option C - Transient in-tick offers, never serialized

**Rejected because:** directly contradicts Issue #120's save/load and replay acceptance criteria and the design's one-tick-minimum response delay - a pending offer must survive a save taken between creation and resolution.

### Option D - Offers as S2 event-log entries only

**Rejected because:** S2 is append-only record-keeping, not queryable live state (locked #5's spirit: logs do not feed behavior); resolving an offer would require scanning the log for its latest status - a second source of truth pattern the architecture forbids.

## Consequences

### Positive

- #120 implementation is unblocked on acceptance, with the storage shape settled before code.
- Save/load, replay, and inspection of offers reuse existing generic mechanisms without new comparison logic.
- The shape survives future slices (roster colonists gaining real state, additional Sought actions) without structural change - only the closed unions widen, by ADR revision.

### Negative

- One more save-version bump during the prototype (accepted cost; ADR-20 set the precedent and no migration framework is needed).
- The store-level pending-per-responder invariant adds a load-validation rule with no Stage 2 traffic that can violate it (one initiator) - carried anyway so the invariant is pinned before multi-initiator slices exist.

### Neutral / Deferred

- Retention window size, response-delay magnitude, timeout magnitude, acceptance probabilities: prototype tuning (design DQ-1-DQ-4).
- Whether resolved-offer retention should feed a decline-cooldown rule: design/prototype territory within ADR-18 DQ-18.2, not storage architecture.

## Validation Required Before Implementation

- Unit tests: counter monotonicity across creation and eviction; pending-never-evicted; FIFO eviction determinism; status-machine terminality.
- One load-rejection test per D5 rule.
- Save/load round-trip of a state holding a pending offer mid-delay, resolved offers of every terminal status, and an evicted-history counter (`nextOfferSequence` > every stored id).
- Replay divergence test: two runs differing only in one offer field report that field's dotted path.
- Inspector detachment test: mutating the returned offer list does not affect simulation state.

## Decision Log

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| Top-level M12-owned `socialOffers` store | Two-party fact needs one owner and one atomic surface (ADR-20 D1 reasoning); additive slice follows ADR-20 D8 | Colonist-embedded state; S2-log-as-state; transient unserialized offers |
| Persisted monotonic counter id | Survives bounded eviction without reuse; deterministic; UUID/wall-clock prohibited by engineering spec §8 | Scan-derived max (reuses evicted ids); UUID (non-deterministic); composite string keys (collision- and eviction-fragile) |
| Tick fields stored at creation, never re-derived | Tuning changes must not mutate saved offers' semantics (Issue #120 acceptance criterion) | Deriving from tuning on load (silent semantic drift) |
| Closed five-status machine, pending sole non-terminal | Explicit lifecycle the design's D3/D6 steps map onto one-to-one; closed-list guard per ADR-17/ADR-18 discipline | Open status vocabulary; boolean resolved flag (loses decline/cancel/expire distinction the design and ADR-18 D5 require) |
| Pending never evicted; resolved FIFO-bounded | Eviction must never destroy an in-flight interaction; boundedness keeps the store state, not a log | Unbounded store (duplicates S2's role); evict-anything FIFO (can kill pending offers) |
| Validate-never-repair load with the full D5 rule list | ADR-20 D8's accepted discipline applied to the new slice | Silent sort/clamp/dedup/repair on load |

---

## Kanban Update

**Card:** [Phase 3] ADR-21 - Social Offer State Storage
**Status:** Review - ADR drafted (status Proposed), awaiting architecture review and Human acceptance per issue #125.
**Completed:** Drafted `ai-studio/adr/0021-social-offer-state-storage.md` covering exactly the Data model / Save format / Serialization trigger surface of the approved offer/response design: store ownership and shape (D1-D2), persisted-counter identity and processing order (D3), bounded retention (D4), serialization and the full load-rejection list (D5), replay/inspection surfaces (D6), eight required invariants, four options considered, and pre-implementation validation requirements.
**Changed Files:**
  CREATED  ai-studio/adr/0021-social-offer-state-storage.md
**Validation:** Every decision traced to `design/social-offer-response-protocol.md` v0.2.0, ADR-18, ADR-20, Issue #120's determinism constraints, or `design/engineering-specification.md` §8; checked that no accepted ADR or locked freeze decision is reopened - the ADR fills an empty storage slot in the same relationship to ADR-18 D5 that ADR-20 held to ADR-12.
**Follow-up Tasks:** None. Upon acceptance: unblock #120 implementation per the Human approval condition recorded 2026-07-17.

**Not committed** per instruction - acceptance is the architecture review's decision, not this draft's.
