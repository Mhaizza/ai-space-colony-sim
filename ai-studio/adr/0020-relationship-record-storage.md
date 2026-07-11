# ADR-20 - Relationship Record Storage

**Status:** Accepted (architecture review 2026-07-12)
**Date:** 2026-07-12
**Phase:** Phase 3 - Stage 2 architecture gate
**Deciders:** Project owner, Technical Architect
**Tracks:** GitHub issue #109
**Governed by:** ADR-12, ADR-18, `design/phase-2-architecture-freeze.md`, `design/colonist-agent-model.md`, `design/decision-loop.md`, `design/ai-behavior-specification.md`, `design/engineering-specification.md`

---

## Context

Stage 2 expands the deterministic prototype from one colonist to three and activates the first social surface: pairwise relationships, offers and responses, Tier-1 mutual perception, and Relational memories.

The approved architecture leaves one blocking question open:

> AQ-2: Are directional relationship records stored on each colonist, or does M10 own one centralized record per colonist pair?

The conceptual model is directional: how Alice regards Bob may differ from how Bob regards Alice. ADR-12, however, describes a bidirectional record per pair and uses singular affinity-score wording. The storage decision must preserve directional behavior without duplicating pair facts or allowing another module to own relationship rules.

The decision must also preserve:

- M10 as the sole owner of affinity rules, named-state derivation, atrophy, and bounded relationship history.
- M5/ColonistState as the owner of colonist identity and personal state, without duplicating M10 data.
- M9 as the owner of each colonist's Relational memories.
- Tier-1-only cross-colonist perception.
- Fixed snapshots, deterministic iteration, save/load, and replay.
- Sparse low-cost handling through 3, 8, and 24 colonists.

## Decision

### D1 - M10 owns one centralized record per materialized colonist pair

M10 stores a sparse collection of pair records. A pair record is the storage and atomic-update unit. ColonistState stores no affinity, relationship state, or pair history.

Each pair record contains two directional perspectives:

- first colonist toward second colonist
- second colonist toward first colonist

This resolves AQ-2 in favor of centralized per-pair storage while preserving the frozen conceptual model of colonist-owned perspective at the read boundary.

The phrase "a continuous underlying affinity score" in ADR-12 is clarified as **one continuous affinity score per direction inside one bidirectional pair record**. ADR-20 changes only the storage interpretation needed to resolve AQ-2. ADR-12's ranges, derived states, change-source table, influence zones, and history semantics remain governing.

### D2 - Directional perspectives are the access unit

Colonist-facing consumers read only an owner's direction:

```text
perspective(store, ownerId, otherId) -> DirectionalPerspective
```

The result contains the owner's affinity toward the other colonist and the named state derived from that score. It never exposes the reverse direction.

M11, M12 destination/refusal weighting, and M7 proximity-stress inputs use this directional read. They do not read pair storage directly.

A system-level pair read is allowed only for M10 rules, M12 encounter conjunctions, serialization, replay, and read-only inspection:

```text
pairView(store, colonistAId, colonistBId) -> PairView
```

`pairView` is not a decision input. A regression test must pin that boundary.

### D3 - Candidate generation starts from the snapshot, never the sparse relationship store

Social candidate generation enumerates `nearbyColonists` from the deciding colonist's fixed WorldSnapshot. For each observable candidate, M11 asks M10 for `perspective(ownerId, otherId)`.

The relationship store is not the source of possible partners. Therefore, a colonist who has never interacted with the owner remains visible and can become a valid social candidate.

No `perspectivesOf(owner)` enumeration is required for Stage 2. Inspector lists likewise enumerate the known colony roster and call `perspective` so absent sparse records are represented correctly.

### D4 - Absent pairs have a deterministic default and remain unmaterialized

An absent pair record means:

```text
affinity in each direction = 0
derived state in each direction = Acquainted
interaction history = empty
last interaction tick = absent
```

This follows ADR-12's accepted score bands: zero is Acquainted.

Reading an absent pair is side-effect-free and does not create a record. A pair is materialized when an accepted interaction occurs, when an accepted M10 background source produces a non-zero consequence, or when a significant interaction must be retained. This preserves ADR-12's requirement to track recently interacting pairs even when a routine interaction produces no affinity delta.

Extended-avoidance atrophy applies only to a materialized pair that has a prior interaction tick. Colonists who have never interacted do not become hostile merely because time passed.

### D5 - Canonical pair identity is collision-safe and order-independent

The canonical pair identity is the ordered two-element tuple:

```text
[min(colonistAId, colonistBId), max(colonistAId, colonistBId)]
```

Ordering uses the same documented ordinal string comparison everywhere. Self-pairs are invalid.

The tuple is the authoritative identity in records and serialization. An in-memory index may use a nested map or another collision-free encoding, but a delimiter-concatenated key is not authoritative unless its encoding is proven collision-free.

Serialized pair records are arrays ordered lexicographically by the first tuple element, then the second. History entries are ordered by tick, then by the fixed execution fan-out order, then by their retained sequence number.

### D6 - Pair facts are stored once; directional effects are stored explicitly

A minimal pair record contains:

```text
pair: [firstColonistId, secondColonistId]
firstTowardSecondAffinity: number
secondTowardFirstAffinity: number
history: bounded significant interaction entries
lastInteractionTick: tick | null
```

Named relationship states are derived and are never saved as authority.

Each significant history entry stores one interaction fact once, including:

- tick and deterministic sequence
- accepted ADR-12 change source
- initiator/responder where applicable
- delta applied in each direction
- resulting affinity in each direction

`lastInteractionTick` updates for every accepted interaction, including a routine interaction that does not enter bounded significant history and produces zero affinity delta. Significant-history retention and interaction-recency tracking are separate concerns.

Relational memories are not embedded in this history. M9 independently forms a memory for each participant from M10's emitted consequence facts, consistent with ADR-18.

### D7 - M10 has two write paths

Only M10 writes relationship state:

```text
applyInteraction(store, interactionFact) -> { store, consequences }
applyAtrophy(store, elapsedDuration) -> { store, consequences }
```

Both operations are pure and atomic over a pair record. `applyInteraction` always updates interaction recency, while adding a bounded history entry only when ADR-12's significance rule is met. The operations clamp affinity to ADR-12's accepted range and emit facts for S2 logging, M9 memory formation, and named-state transition reporting. Consumers never write affinity directly.

M10 uses no PRNG. Chance remains owned by S1 and is used by the sanctioned M12 encounter trigger before M10 receives an interaction fact.

### D8 - Save/load validates rather than repairs

Stage 2 adds one top-level M10 relationship-store slice to SimulationState and serialization. The save version is incremented. No migration framework is required during the prototype.

Load rejects:

- duplicate or non-canonical pair identities
- self-pairs or unknown colonist ids
- missing directional values
- non-finite or out-of-range affinity
- stored named states
- history entries for another pair
- history that is out of deterministic order, exceeds its configured bound, or postdates the loaded clock
- invalid or non-monotone last-interaction ticks

Load never silently sorts, clamps, deduplicates, creates missing perspectives, or repairs malformed records.

## Required Invariants

1. M10 is the only owner and writer of affinity, derived-state rules, atrophy, and pair history.
2. Every materialized record has exactly two distinct, canonically ordered participant ids.
3. Every materialized record contains both directional affinity values, each finite and within ADR-12's range.
4. Named states are derived from directional affinity and are not authoritative stored state.
5. Pair history stores each significant interaction once and remains bounded and deterministically ordered.
6. A directional read never exposes the reverse perspective.
7. Decision candidate generation starts from the fixed snapshot's nearby-colonist list, not M10's sparse keys.
8. Reading an absent pair returns the default perspective without materializing state.
9. M9 Relational memories and S2 event records remain separate owners; neither is a second relationship store.
10. Save/load and replay preserve pair ordering, both perspectives, history, and the next observable behavior bit-identically.

## Update-Order Integration

ADR-20 does not change the seven-phase order in `design/engineering-specification.md`.

- Phase 3, continuous colonist state: deterministic M10 atrophy for materialized eligible pairs, in canonical pair order.
- Phase 4, condition and trigger detection: M12 evaluates social encounter conjunctions using observable state plus M10 reads; any chance draw remains in S1.
- Phase 5, decisions: M4 supplies nearby Tier-1 observations; M11 requests only the deciding colonist's directional perspectives.
- Phase 6, execution and consequences: M12 emits interaction facts; M10 applies relationship consequences atomically before emitting downstream facts.
- Phase 7, records: S2 records interaction and relationship-state-transition facts.

Within a phase, colonists and pair records use fixed canonical ordering. A colonist never observes another colonist's same-step decision through a live reference.

## Interfaces and Ownership

| Surface | Owner | Consumers | Rule |
|---|---|---|---|
| Pair store | M10 | M10, S3 | No direct consumer mutation |
| Directional perspective | M10 | M11, M12, M7, inspector | Owner direction only |
| Pair view | M10 | M10, M12 encounter check, S3, inspector | Never a decision input |
| Interaction consequence | M10 | M7, M9, S2 | Fact only; receivers apply owned rules |
| Relational memory | M9 | M9, M11 | Never stored in M10 history |
| Nearby colonist roster | M4 snapshot | M11/M12 | Authoritative candidate-enumeration source |

## Options Considered

### Option A - Colonist-owned directional records

Each colonist stores one record for every colonist they regard.

**Advantages**

- Directly resembles the conceptual phrase "the colonist owns their perspective."
- Simple owner-direction lookup.

**Rejected because**

- A single interaction fact and bounded pair history would be duplicated.
- One event requires coordinated writes to two colonist containers.
- Independent history eviction can make two copies disagree.
- Either-direction encounter checks cross two agents' internal state.
- At 24 colonists it creates 552 directional containers rather than at most 276 pair records.

### Option B - Centralized pair records with two directional perspectives

M10 stores one record per materialized pair and exposes owner-direction reads.

**Advantages**

- One owner and one atomic update boundary.
- One copy of pair facts and history.
- Directional affinity remains explicit.
- Deterministic serialization and either-direction checks are straightforward.
- Matches ADR-12's bidirectional pair framing and its 276-pair scale posture.

**Costs**

- Consumers must use M10 APIs instead of reading ColonistState.
- The directional access boundary requires tests to prevent reverse-perspective leakage.

**Selected.**

### Option C - Hybrid storage

Affinity lives on colonists while pair history or indices live centrally.

**Rejected because**

- It splits one relationship datum family across multiple authorities.
- It adds synchronization and serialization rules without satisfying a requirement that Option B misses.
- It is speculative complexity at Stage 2 scale.

## Consequences

### Positive

- AQ-2 no longer blocks M10 implementation.
- Directional behavior and asymmetric relationships are preserved.
- Pair-level writes, history, save/load, and replay have one authority.
- Sparse storage remains cheap at 3, 8, and 24 colonists.
- Never-interacted colonists remain visible to social candidate generation.

### Negative

- `design/engineering-specification.md` must be updated after acceptance to replace "storage pending AQ-2" and include M10 in phase-3 continuous updates.
- Existing prose that implies physical colonist ownership must be read as conceptual perspective ownership.
- M10 access boundaries become load-bearing and require focused tests.

### Neutral / Deferred

- History capacity and atrophy duration remain prototype tuning values.
- Affinity delta magnitudes remain governed by ADR-12/ADR-18 and prototype calibration.
- Decline-friction directionality remains an ADR-18/prototype decision; the storage shape supports asymmetric results.
- Performance optimization beyond deterministic canonical scans is deferred until measurement shows a need.

## Validation Required Before Stage 2 Implementation

- Unit tests for canonical pair identity, both directional reads, defaults, atomic writes, bounds, atrophy, and history eviction.
- A test proving a never-interacted nearby colonist remains a social candidate.
- A test proving owner-direction reads cannot expose the reverse perspective.
- One load-rejection test per serialization invariant.
- Three-colonist deterministic ordering, save/load continuation, and replay tests.
- An inspector test showing both directional perspectives without storing derived states.

## Action Items

1. Architecture review and accept/revise ADR-20 under issue #109.
2. After acceptance, update references that still mark AQ-2 open.
3. Close #109 with a final Kanban Update.
4. Move #104 from Blocked to planning only after ADR-20 is merged.
5. Create and review the Stage 2 implementation plan before writing relationship code.

## Decision Log

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| Central M10 pair store with two directional affinities | One authority and atomic pair updates without losing asymmetric perspective | Colonist-owned duplicate records; hybrid split ownership |
| Snapshot roster drives candidate enumeration | Sparse storage cannot represent people who have never interacted | Enumerating M10 keys as candidate roster |
| Absent pair is 0 / Acquainted and read-only | Matches ADR-12 ranges and keeps low-activity pairs near-zero-cost | Eagerly materializing every pair |
| Tuple identity is authoritative | Collision-safe and deterministic across serialization | Unspecified delimiter-concatenated keys |
| Named states are derived | Prevents duplicated authority and stale state | Persisting both affinity and state |

## Architecture Review Outcome

**Accepted on 2026-07-12.** Review confirmed:

- ADR-12's singular-score wording is safely clarified as one score per direction inside one bidirectional pair record;
- snapshot-driven candidate enumeration preserves the Tier-1 perception boundary and does not hide absent sparse pairs;
- the absent-pair default, materialization rule, and interaction-recency/atrophy boundary are explicit;
- tuple identity, stable ordering, validation, and serialization satisfy deterministic replay requirements;
- M10 remains the sole relationship authority and no accepted architecture is reopened beyond resolving AQ-2.

The review added one required clarification before acceptance: every accepted interaction updates `lastInteractionTick`, even when it produces zero affinity delta and no significant-history entry.
