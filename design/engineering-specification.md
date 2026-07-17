# Engineering Specification — Colonist AI Simulation

**Version:** 0.3.0 (reconciled 2026-07-17 against ADR-20 and the merged Stage 2 implementation through PR #118; no architecture contradiction found, no new ADR required)
**Phase:** Phase 3 — Engineering Specification
**Status:** Approved (engineering review 2026-07-10), reconciled 2026-07-17 to match accepted ADR-20 and the current Stage 2 implementation boundary
**Authority (treated as authoritative):** design/ai-behavior-specification.md v0.2.0 (Approved — the behavioral contract this document decomposes); design/phase-2-architecture-freeze.md v1.0.0; ADR-17, ADR-18 (Accepted); ADR-01–ADR-16 (Accepted); design/decision-loop.md v0.1.0 and the frozen Phase 2 set (colonist-agent-model v0.2.0, needs-system v0.2.0, personality-traits v0.1.0, goal-system v0.1.0, memory-system v0.2.0); ai-studio/constitution/architecture-philosophy.md
**Scope:** The module decomposition, ownership map, interface contracts, ordering and event discipline, persistence boundaries, determinism requirements, debug surfaces, and prototype scope that make the approved behavioral architecture buildable.
**This document is NOT implementation:** no code, no TypeScript, no pseudocode, no formulas, no data-structure definitions, no file layouts. Modules are named responsibilities with contracts; how each is realized is implementation work under these constraints.

**Traceability rule:** every module and contract traces to its authorizing source in brackets.

**Contradiction report:** none found. The full decomposition below was re-checked on 2026-07-17 against the freeze's 30 locked decisions, ADR-17, ADR-18, ADR-20, and the behavior specification's twelve invariants; no architecture contradiction appeared. ADR-20 resolved AQ-2 in favor of centralized per-pair M10 storage with directional perspectives, and the current implementation matches that decision. The remaining gap is implementation scope, not architecture: the prototype still runs one fully simulated colonist plus an identity-only roster, so explicit social offer/response handling and an autonomous three-colonist runtime remain future work under the existing architecture.

---

## 1. System Modules

Twelve simulation modules plus three cross-cutting services. The decomposition follows the frozen ownership splits [colonist-agent-model: colonist / world / systems; locked #1–2] and the modular-systems constraint [architecture-philosophy]:

| # | Module | Kind | Authorizing sources |
|---|---|---|---|
| M1 | **Simulation Clock** | World service | ADR-02, ADR-06 |
| M2 | **World State** (modules, resources, conduits, survival conditions) | World | ADR-09, ADR-13, ADR-01 P1 |
| M3 | **Policy System** (scopes, cascade, pending changes) | World | ADR-04, ADR-11, ADR-07 |
| M4 | **Snapshot Service** (perception) | Boundary | decision-loop §1b; locked #4, #21, #22 |
| M5 | **Colonist State** (identity, long-term, short-term state container) | Colonist | colonist-agent-model; locked #1 |
| M6 | **Need System** | Colonist-attached | ADR-17 (all decisions) |
| M7 | **Stress System** | Colonist-attached | decision-loop §7; locked #27 |
| M8 | **Trait System** (definitions, modifiers, discovery) | Colonist-attached | ADR-10; personality-traits |
| M9 | **Memory System** (pool, formation, influence, eviction) | Colonist-attached | ADR-16; memory-system; locked #18–20 |
| M10 | **Relationship System** | Colonist-adjacent (centralized per-pair storage with directional perspectives) | ADR-12; ADR-20 |
| M11 | **Decision System** (goal generation, filter, weights, selection, commitment, task resolution) | Colonist-attached | decision-loop §2–§6, §10; goal-system; behavior-spec §3.6–3.11 |
| M12 | **Task & Execution System** (task classes, availability, execution into ambient states; social offer/encounter protocol) | World + colonist boundary | decision-loop §5; ADR-18; ADR-05 |
| S1 | **Seeded PRNG Service** | Cross-cutting | Principle 7; locked #24 |
| S2 | **Event & Record Service** (event log, decision log, story events, crisis detection) | Cross-cutting | ADR-14, ADR-08, ADR-15 |
| S3 | **Serialization Service** (save/load) | Cross-cutting | architecture-philosophy; behavior-spec §6 |

The player-facing presentation layer (rendering, inspector UI, overlays, hover) is deliberately **not** a module of this specification — simulation/UI separation is a frozen structural constraint [architecture-philosophy]; the simulation exposes read interfaces (§4, §9) and the UI is a separate specification's concern (§11 Non-goals).

## 2. Module Responsibilities

**M1 Simulation Clock** — Advances continuous in-game time; scales all rates uniformly under speed control (Pause/1x/2x/4x); enforces the Stage-3+ speed cap automatically [ADR-06]. Provides elapsed-duration references to all consumers. **Never fires an event, triggers a decision, or schedules behavior** — it is a reference, not a scheduler [ADR-02; locked #23].

**M2 World State** — Owns module health states and their five-state visual classification inputs [ADR-13], resource stocks and flows, conduit states, maintenance capacity accounting (preventive/reactive, skill-qualified) [ADR-09], and active station-survival conditions [ADR-01 P1]. Evolves strictly by clock-rated processes and colonist task outcomes. Owns *conditions*; crisis *stage labels* belong to S2's detection layer, never to M2's facts [ADR-15; locked #22].

**M3 Policy System** — Owns all policy state at four scopes; resolves the effective policy per colonist via the cascade (module > role for parameters; shift as temporal modifier) [ADR-11]; holds pending policy changes and applies them at shift-boundary conditions [ADR-07 Cat 2]; exposes permissions — the policy side of the eligibility intersection [locked #2, #26].

**M4 Snapshot Service** — Builds the fixed, per-decision world snapshot for one colonist: time references, effective policy (from M3), relevant module/resource conditions and survival conditions (from M2), and nearby colonists' locations plus Tier-1 behavioral states only (from M12's observable-state registry) [decision-loop §1b]. Enforces the perception contract structurally: spatial bounding, no colonist internals, no crisis-stage labels — **M4 is the only read path from world to colonist decision**, so the perception invariants are enforced at one choke point instead of by every consumer [locked #4, #21, #22; behavior-spec §3.2].

**M5 Colonist State** — The container per colonist: stable identity (name, base traits, skills — immutable after arrival), long-term state (memory pool handle, relationship records handle, active trait modifiers), short-term state (five need levels, stress level, current behavioral state, goal stack with recorded motivations) [colonist-agent-model; locked #1]. M5 owns the *data residence and invariants* (what may change, when); the attached systems M6–M11 own the *rules* that change it. No system outside the colonist's own decision path writes M5's short-term state, and no other colonist ever reads it [locked #21; behavior-spec §3.3].

**M6 Need System** — Applies monotone clock-rated decay per need at trait-modified rates; evaluates thresholds (low ×5, critical ×2 — biological only), the satisfaction-point hysteresis band, and condition-gated restoration against each need's closed input set; computes per-need monotone urgency with the Rest amplifier applied to existing urgency only [ADR-17 D2–D6, D9]. Emits threshold-crossing signals as re-decision triggers [locked #23 trigger 4].

**M7 Stress System** — Accumulates from the six sources, dissipates through the four reliefs, scaled by Stress Response traits; maintains per-source attribution for every movement (the traceability requirement is a data obligation, not a UI one) [decision-loop §7; locked #27]; evaluates the behavioral threshold (Stressed state), task-acceptance suppression inputs, and capacity suppression [ADR-09]; feeds the memory-significance criterion [ADR-16].

**M8 Trait System** — Owns trait *definitions* (the behavioral contract per trait: category, modifier surfaces, expressions) and per-colonist trait state: base traits, active reversible modifiers, discovery states (Unknown/Observed/Confirmed) [ADR-10]. Serves trait weight contributions to M11 and rate/threshold modifiers to M6/M7, bounded per ADR-17 D7. The canonical trait list is content this module hosts, not defines (DQ-T1 → prototype) [behavior-spec §11].

**M9 Memory System** — One bounded pool per colonist; involuntary formation on ADR-16's significance criteria with impact fixed at formation; influence weight as recency × impact (referenced, not redefined); eviction by lowest influence; the four-type classification of influence surfaces [ADR-16; locked #18–19]. Serves match-and-tilt queries to M11 (person / resource-kind / situation-kind) [decision-loop §8] and the crisis-memory input to M6's Safety conditions [ADR-17 D8–D9]. Maintains **no write path to or from the event log** [locked #5].

**M10 Relationship System** — Owns affinity scores, named-state derivation, bounded significant-interaction history, and the change-source table [ADR-12]; applies ADR-18's action consequences through that table only [ADR-18 D6]; serves relationship weight contributions and destination-context weights to M11/M12, and proximity stress inputs to M7. ADR-20 resolves storage to **one centralized sparse record per materialized colonist pair, with two explicit directional perspectives inside that record**. Colonist-facing reads stay directional (`perspective`); system-level pair reads stay restricted to M10 rules, encounter checks, serialization, replay, and inspection [ADR-20 D1-D8].

**M11 Decision System** — Runs the decision at each triggered decision point: candidate generation from the five closed sources; ADR-01 priority filtering with actionability, fall-through, and Blocked-state entry; weight composition (base + four families under the five constraints, with retained per-family contributions); seeded-stochastic selection with deterministic tie-break; goal commitment with motivation recording; goal-stack management (suspend/re-decide, blocked persistence, stale-queue abandonment); task resolution via eligibility ∩ availability with weighted task choice [decision-loop §2–§6, §10; goal-system; locked #15–17, #23–26; behavior-spec §3.6–3.11].

**M12 Task & Execution System** — Owns the task-class registry (five classes; social class = ADR-18's six actions) [locked #26; ADR-18 D1], task availability facts (from M2), task requirements (the task side of the eligibility intersection [locked #2]), and execution: driving the committed task as one of the seven ambient states with textures [ADR-05; locked #29], publishing each colonist's **observable-state registry entry** (the Tier-1 facts M4 and the UI both read — one source for both, keeping agent and player knowledge symmetric by construction [locked #21]), running the social offer/response protocol and encounter conjunctions [ADR-18 D4–D5], detecting completion per goal category and mid-execution failure [decision-loop §10; behavior-spec §3.13].

**S1 Seeded PRNG Service** — The only chance source in the simulation. Owns the save-seeded state, its serialization, and the draw discipline (§8). Consumers: M11 selection, M12 encounter triggering, and any future sanctioned stochastic point — each draw attributable [Principle 7; locked #24; behavior-spec §6].

**S2 Event & Record Service** — Owns the permanent world event log [ADR-14]; the decision log (significant decisions with decomposed causes, materiality-filtered memory attribution) [ADR-14; locked #28]; story-event detection (threshold crossings per ADR-08's four criteria, accumulation floor per cluster) [ADR-08]; crisis detection and stage labeling as a *player-signaling* layer reading M2's conditions — stages are outputs of S2, inputs to the UI and ADR-06's speed cap, and **never inputs to M4 snapshots** [ADR-15; locked #22].

**S3 Serialization Service** — Saves and restores the complete behavioral state (§7) such that the replay guarantee holds [behavior-spec §6].

## 3. Data Ownership

One owner per datum; everything else reads through interfaces (§4). This table is the enforcement form of the frozen ownership splits [colonist-agent-model; locked #1–2, #5]:

| Datum | Owner | Notable non-owners |
|---|---|---|
| In-game time, speed state | M1 | Nothing else holds time |
| Module health, resources, conduits, survival conditions | M2 | S2 labels stages; M2 never stores labels |
| Policies at all scopes; pending changes; permissions | M3 | M11 reads effective policy via M4 only |
| Snapshot contents (transient, per decision) | M4 | Discarded after the decision; never persisted state |
| Colonist identity, skills | M5 (immutable) | Policy owns permissions, tasks own requirements — never skills [locked #2] |
| Need levels, thresholds-as-configured, urgency | M5 holds levels; M6 owns the rules | No direct level writes from anywhere [ADR-17 D2] |
| Stress level + per-source attribution | M5 holds; M7 owns rules | |
| Trait definitions | M8 | |
| Per-colonist traits, modifiers, discovery states | M5 holds; M8 owns rules | Discovery-state location beyond single-profile play: agent-model DQ-4, engineering-deferred |
| Memory pool entries, influence weights | M5 holds; M9 owns rules | Event log never feeds or reads the pool [locked #5] |
| Affinity scores, relationship states, interaction history | **M10** | Stored once per materialized pair; colonist-facing reads remain owner-direction only [ADR-20] |
| Goal stack, recorded motivations | M5 holds; M11 owns rules | |
| Task classes, requirements, availability | M12 | |
| Observable behavioral state (Tier-1 facts) | M12's registry | The single source for both M4 and UI [locked #21] |
| Event log (permanent) | S2 | World-owned, unbounded retention [ADR-14; locked #5] |
| Decision log + retained weight decompositions | S2 | Retention scope: engineering-deferred (§13) |
| PRNG state | S1 | No module draws outside S1 |

## 4. Interfaces Between Modules

Contracts, not signatures. Each is named, directional, and constraint-bearing:

1. **Time reference** (M1 → all): elapsed durations on request; no callbacks, no scheduled notifications [ADR-02].
2. **Perception** (M2, M3, M12-registry → M4 → M11): M4 assembles the snapshot; M11 receives it fixed for the decision's duration. Constraint: this is the *only* world-to-decision read path; M11 never reads M2/M3/M12 directly [locked #4; behavior-spec §3.2].
3. **Own-model access** (M5 ↔ M6–M11): the colonist's attached systems read/write their owned slices of M5 under M5's invariants. Constraint: no cross-colonist access, ever [locked #21].
4. **Urgency feed** (M6 → M11): per-need urgency (amplifier applied) and threshold-crossing trigger signals. Constraint: urgency only — M11 never reads raw levels for weighting [ADR-17 D5: "nothing else about the need enters the composition"].
5. **Stress feed** (M7 → M11, M12): current stress against trait-set thresholds (weight family input, acceptance suppression, capacity suppression), always with source attribution available [locked #27].
6. **Trait contribution** (M8 → M11; M8 → M6/M7): weight tilts keyed on candidate class/context; bounded rate/threshold modifiers. Constraint: bound-never-veto; category-preserving (no psychological critical threshold) [locked #25; ADR-17 D7].
7. **Memory match** (M9 → M11; M9 → M6-Safety): match-and-tilt by person/resource-kind/situation-kind proportional to influence weight; active crisis-memory input for Safety. Constraint: memory never adds or vetoes candidates; never touches rates/thresholds [decision-loop §8; ADR-17 D8].
8. **Relationship context** (M10 → M11, M12, M7): candidate weights (tier 5 social gravity), destination-context task weights, refusal weights, proximity stress inputs — all within ADR-12's influence zones [decision-loop §9]. Constraint: decision-time consumers read owner-direction perspectives only; pair-level reads remain outside ordinary decision weighting except where ADR-20 explicitly allows them.
9. **Eligibility intersection** (M5-skills × M3-permissions × M12-requirements → M11): three independently-owned inputs; no party writes another's side [locked #2, #26].
10. **Commitment** (M11 → M12): adopted goal + resolved task; M12 executes. **Decision record** (M11 → S2): significant decisions with full decomposition [ADR-14].
11. **Execution outcomes** (M12 → M2 world effects; → M6 satisfaction-condition facts; → M7 stress events; → M9 formation-significance events; → M10 affinity events; → S2 event log): consequences fan out to owners; each owner applies its own rules. Constraint: outcomes are facts; no outcome bypasses an owner's rules to write state directly.
12. **Re-decision triggers** (M6, M12, M2-via-conditions → M11): the closed six-trigger list plus ADR-18's offer scoping; trigger delivery is the only way M11 re-enters [locked #23].
13. **Social protocol** (M12 initiator-side ↔ M12 responder-side, consulting responder's M11-weighting): offers as interruption-class events to interruptible colonists only; responses as the responder's own weighted decision; encounter conjunction checks with S1 draws [ADR-18 D4–D5].
14. **Read-only inspection** (all modules → S2/UI/debug): every module exposes its player-surface reads (per behavior-spec §10) and its debug reads (§9) without state effects.

## 5. Update Order

The simulation advances in a **fixed, documented, deterministic order** — required by Principle 7 (order-independence or order-fixed [locked #25] generalizes to the whole tick). The normative sequence of *phases* per simulation step:

1. **Time advance** (M1) — the step's elapsed in-game duration, speed-scaled.
2. **World evolution** (M2) — clock-rated processes: maintenance drift, resource flows, condition changes.
3. **Colonist continuous state** (M6, M7 per colonist; M10 for materialized eligible pairs) — need decay, stress accumulation/dissipation, trait-modifier condition accounting (M8/M9 condition memories), and deterministic relationship atrophy under ADR-20's pair-order rules.
4. **Condition & trigger detection** (M6, M2, M12, S2) — threshold crossings, blockage, completions, shift-boundary conditions, encounter conjunctions, story/crisis detection.
5. **Decisions** (M4 + M11, only for colonists with fired triggers) — snapshot, decide, commit. Colonists without triggers are skipped entirely [locked #23: between triggers, execution continues unconditionally].
6. **Execution & consequences** (M12, then fan-out per interface 11) — actions advance; outcomes apply through their owners.
7. **Records** (S2) — logs written; story events emitted; stage labels re-evaluated.

Constraints on the order, binding whatever the realization:
- **Within-phase colonist iteration is in a fixed, stable order** (the deterministic ordering criterion, DQ-D3's sibling — content free, stability mandatory) [behavior-spec §6].
- **Decisions read only snapshots built in phase 5 of the same step** — a colonist deciding never sees another colonist's same-step decision except through its already-executed observable consequences in a later step [locked #4: no live cross-agent references].
- **The phase structure is normative in effect, not in mechanism**: engineering may batch, parallelize, or reorder computation freely provided observable behavior is identical to this sequence (the fixed-snapshot and determinism contracts make this checkable) [decision-loop B3; architecture-philosophy].

## 6. Event Flow

All events are condition-triggered [ADR-02; locked #23]. The flow discipline:

- **World conditions** (module failure, resource exhaustion, survival conditions) arise in M2 → reach colonists only via M4 snapshots at their own decision points, or by matching a re-decision trigger (blockage, higher-priority condition) → reach the *player* via ADR-13's visual states and S2's crisis staging. The same fact, three sanctioned paths, no others.
- **Colonist threshold events** (need crossings, stress behavioral threshold) arise in M6/M7 → trigger that colonist's re-decision (trigger 4) and/or ambient state change → may become story events if they meet ADR-08's criteria (S2 detects; nothing "fires" a story) [ADR-08].
- **Social events**: offers flow initiator-M12 → responder (interruptible only) → responder's weighted answer; encounters conjoin in phase 4 with an S1 draw; consequences fan out through interface 11 [ADR-18].
- **Policy changes** enter M3 as pending → apply at each affected colonist's shift-boundary condition → colonists respond at their own decision points [ADR-07 Cat 2]. Infrastructure changes (Cat 3) apply to M2 immediately and propagate as world conditions [ADR-07].
- **Crisis stages** are S2 *outputs* computed from M2 conditions — they flow to the UI and to ADR-06's speed constraint, and **never** into M4 [locked #22; ADR-15].
- **No event bus semantics may introduce hidden coupling**: an event's consumers are the owners named in §4's contracts; a module reacting to an event it has no contract for is out of specification [architecture-philosophy: no hidden coupling].

## 7. Save/Load Boundaries

**Everything behavioral serializes; a load is a perfect resume** [behavior-spec §6; architecture-philosophy]. The save set, by owner:

- M1: clock value, speed state, active speed constraint.
- M2: all module health, resources, conduit states, active conditions, maintenance accounting.
- M3: all policies at all scopes, pending changes with their application conditions.
- M5 (per colonist): identity and skills; need levels; stress level **with per-source attribution**; behavioral state; goal stack **with recorded motivations and suspension states**; active trait modifiers and discovery states; memory pool **with per-entry impact and formation data sufficient to recompute influence weights**.
- M10: all affinity scores, states, bounded histories, and pair-level interaction recency (ADR-20's centralized per-pair store).
- S1: **complete PRNG state** — mandatory; a save that cannot reproduce the next draw breaks replay [Principle 7].
- S2: full event log; decision log with retained decompositions (scope per §13); story-accumulation and crisis-detection state.

**Not saved:** snapshots (transient by definition [§3]); anything derivable deterministically from the save set (engineering may cache; caches are not state); UI state (out of scope).

**Boundary rules:** saving is side-effect-free and possible at any phase boundary of §5; loading reconstructs to identical subsequent behavior (the replay guarantee is the acceptance test of the save format); no versioned migration may alter behavioral state semantics silently — a migration that changes behavior is a design change, not a data change.

## 8. Determinism Requirements

The behavior spec's replay contract [behavior-spec §6], stated as engineering obligations:

1. **State + seed → identical behavior, indefinitely.** The acceptance test: two runs from the same save produce identical event logs and decision logs, bit-identical at the behavioral level.
2. **Single chance authority:** all randomness draws through S1's save-seeded PRNG. Draw *discipline* is binding: the sequence of draws must be a pure function of simulation state — no draw may depend on frame rate, wall clock, camera, UI interaction, thread timing, or iteration over unordered collections. (Stream structure — one stream vs. per-colonist streams — is an engineering choice, §13; whichever is chosen must be documented and stable.)
3. **Fixed iteration orders everywhere behavior is touched:** colonist processing order, candidate enumeration order, trigger processing order, tie-breaks (DQ-D3) — all stable and serialization-independent.
4. **Order-independent or order-fixed composition** [locked #25 constraint 4], extended to all phase-4/6 fan-outs: where application order could matter, it is fixed and documented.
5. **Chance-free need and stress dynamics** [ADR-17 D2]: pure state evolution only.
6. **No hidden inputs:** decisions read M4 snapshots and own-model state, nothing else [locked #4, #21]. Any new input path is an architecture change.
7. **Speed-scaling invariance:** behavior at 2x/4x must be the same simulation faster — speed scales rates uniformly [ADR-02, ADR-06] and must not alter decision outcomes relative to 1x for the same in-game timeline (step-size effects on behavior are defects).
8. **Replay divergence is a highest-class defect** — it retroactively falsifies explanation surfaces [behavior-spec §6; Principle 6].

## 9. Debug / Inspection Interfaces

Per the behavior spec's three-audience contract [behavior-spec §10], the simulation exposes three read families:

- **Ambient/hover reads** (→ UI): the observable-state registry (M12), module visual states (M2/ADR-13), hover summaries (categorical needs, social state, task, stress indicator) [ADR-05]. No numbers where the design says categories.
- **Inspector reads** (→ UI Tier 3): need levels with history; stress with source breakdown; relationships with states and history; goal + tier + motivation; discovered traits with modifiers; decision detail with decomposed cause families; material memories, named; decision and event logs [ADR-05; ADR-14; locked #20, #25, #27–28].
- **Debug reads** (→ development tooling only): full truth — all levels and attributions, the complete memory pool with influence weights, full weight compositions per candidate (not just the winner), snapshot dumps, PRNG state and draw traces, trigger histories, and a **replay harness** (run a save twice, diff behavioral output — the standing determinism test). Binding constraints carried from the behavior spec: debug surfaces never ship in the player build's UI, and all debug interfaces are **read-only toward behavior** — a state-mutating debug tool is a command channel [behavior-spec §10; locked #3's spirit].

Engineering obligation underneath all three: **retention.** Decomposability at explanation surfaces requires the contributions to exist when asked [locked #25; decision-loop Risk 2]. Minimum binding retention: full decomposition for every logged (significant) decision; whether more is retained is the deferred retention-scope question (§13).

## 10. Prototype Scope

The prototype is the calibration instrument for every value this document and its sources deferred. Scope, derived from the freeze's validation targets [freeze §8] and the accumulated deferred-question ledger:

**Scale progression (engineering review 2026-07-10):** **24 colonists is the validation target, not the required first prototype size.** The prototype grows through a staged progression, each stage a working end-to-end loop:

| Stage | Scale | What it is for |
|---|---|---|
| 1 | **1 colonist** | The smallest meaningful end-to-end loop — the first implementation slice: clock → world → needs/stress → triggers → snapshot → decision → task → execution → consequences → logs, for one colonist. Proves the pipeline, the determinism obligations (§8), and the replay harness (EQ-8) before anything scales |
| 2 | **3 colonists** | First social surface: pairwise relationships, Tier-1 mutual perception, the first Relational memories, and companionship execution consequences. The current implementation has reached this stage only partially: one colonist is fully simulated, while other colonists are still identity-only roster entries rather than independent runtimes |
| 3 | **8 colonists** | First colony texture: shift baseline readable against deviations, story-event accumulation per cluster [ADR-08], multi-pair social dynamics, early calibration passes on the value queue |
| 4 | **24 colonists** | The validation target: every first-order target below must be validated at this scale and no smaller |

Calibration recommendations from stages 1–3 are provisional; only stage 4 answers count against the deferred-question ledger, because the two scale-dependent assumptions (ambient legibility, pair-count efficiency) can invalidate earlier tunings [ADR-05; ADR-12; freeze §7].

**Current Stage 2 runtime boundary (reconciled 2026-07-17):** the shipped prototype simulates exactly **one full ColonistState** (`clock → world → needs/stress → triggers → snapshot → decision → execution → consequences → logs`) plus an **identity-only roster** of other colonists used for relationship storage, snapshot visibility, inspector output, and companionship-target weighting. Relationships, relational memory formation, companionship effects, and the Shared Meal overlay are real. Explicit ADR-18 offer/response handling and independent needs/stress/memory/goal/execution state for roster members are **not** implemented yet.

**Autonomous three-colonist runtime impact (identified by Issue #99, no new ADR required):** reaching the full Stage-2 three-colonist target requires broadening the singular `colonist` / `execution` / baseline slots into a stable, canonically ordered collection of per-colonist state, then running phases 3, 5, and 6 across that collection without changing §5's seven-phase semantics. This is an implementation expansion under the accepted architecture, not a module-boundary or authority change: M4 remains the only world-to-decision read path, M10 remains the sole relationship owner, M12 remains the task/execution owner, and same-tick decisions still must not observe each other through live state.

**Must include (first-order validation targets, all validated at stage 4):**
- The full decision pipeline (M4–M12) with all five needs, stress, traits (a provisional non-canonical trait set sufficient to exercise all four categories — DQ-T1 authoring happens here), memory, relationships, and the six social actions — because the calibration questions are interdependent [freeze §7: calibration interdependence] and cannot be answered on a partial pipeline.
- **24 colonists** at the final stage — the ambient-legibility budget and ADR-12's 276-pair efficiency assumption are only testable at scale [ADR-05; ADR-12; freeze §7].
- Time-scale validation against the ~20-minute-day hypothesis [ADR-06 — "the highest-priority prototype validation question"].
- Weight-spread calibration (near-deterministic-when-dominant; close calls rare and meaningful) [decision-loop Risk 1].
- Memory calibration (pool size, decay, impact — DQ-M1) and drift legibility (DQ-M4).
- The Purpose gate evaluation (DQ-17.7): Tier-1 readability and traceable causes, with the pre-authorized cut on failure [ADR-17 D1].
- The full ADR-17/18 value queue: DQ-17.1–17.5, DQ-18.1–18.4, 18.7; plus DQ-D2, D5–D8.
- Calibration targets as binding: critical overrides exceptional; conflict as punctuation; story frequency within ADR-08's band; baseline learnable in the first hour [ADR-01; needs-system Risk 3; ADR-08].

**Prototype-appropriate simplifications (sanctioned):** placeholder art sufficient to distinguish the seven states and their load-bearing textures at overview zoom (the legibility test needs distinguishability, not final art); a minimal but real inspector (need history, stress sources, decision decomposition — the explanation surfaces are themselves under test [needs-system Risk 1]); a reduced concrete task list per class (classes complete, members minimal — DQ-D4).

**Explicitly not prototype scope:** final UI design; final trait canon (the prototype *produces* the DQ-T1 recommendation, it does not ship a canon); ADR-19 arrival system (colonists may be seeded directly, with trait assignment via S1 respecting Principle 7); save-format stability guarantees (replay determinism yes, format permanence no).

## 11. Non-Goals

This specification does not cover, and its approval authorizes no work on:
- **UI/presentation design** — inspector layout, hover design, overlays, the stable-colony signal, player-facing vocabularies (DQ-N5, DQ-T5) [freeze §6 → UI design].
- **Content authoring** — canonical traits (DQ-T1), concrete task lists (DQ-D4), station layouts, scenario design.
- **ADR-19** (colonist arrival) — candidate ADR, not begun.
- **Autonomous multi-colonist runtime beyond the current primary-colonist + identity-only roster boundary** — independent needs/stress/memory/goal/execution simulation for additional colonists remains future implementation work.
- **Post-Phase-1-scope features** — larger colonies, multiple stations, colonist death/injury systems (health is not a need and not yet a system [needs-system]), modding, multiplayer, difficulty modes.
- **Performance targets beyond determinism** — frame budgets and platform matters are implementation planning, constrained here only by "no behavioral effect."

## 12. Risks

Remaining engineering-facing risks only (behavioral risks stand in behavior-spec §12; architecture risks in freeze §7):

- **The choke-point modules become bottlenecks.** M4 (every decision) and S1 (every draw) are single points of correctness *by design* — the same centralization that enforces invariants concentrates performance and bug risk. *Mitigation: both have tiny, stable contracts; the replay harness catches correctness regressions; performance work may restructure internals freely under §5's behavior-identical rule.*
- **Retention cost vs. decomposability** (carried from decision-loop Risk 2, now concrete): retaining full compositions for logged decisions at 24 colonists × re-decision frequency is the named trade. *Mitigation: the minimum binding scope is defined (§9); anything beyond it is optional.*
- **Autonomous-runtime migration can accidentally introduce same-tick order bias.** Expanding from one simulated colonist to three independent simulated colonists is now an implementation problem, not an architecture question; the risk is silently letting a later colonist in phase 5 or 6 observe an earlier colonist's same-step decision or consequences through live state. *Mitigation: keep §5's seven-phase semantics binding, build snapshots before each colonist's decision from approved phase inputs only, and preserve fixed within-phase colonist ordering plus replay verification.*
- **The tick realization drifts from the phase semantics.** Batching/parallelization is sanctioned, but each optimization is a chance to violate fixed-snapshot or ordering guarantees subtly. *Mitigation: the replay harness as a standing CI-class test; §8's obligations are testable, and must be tested continuously, not at milestones.*
- **Prototype scope creep toward product.** A full-pipeline, 24-colonist prototype with a real inspector will look like a game; pressure to polish rather than answer the calibration queue will follow. *Mitigation: §10's must-include list is the exit criterion — the prototype is done when the deferred-question ledger has recommendations, not when it is fun.*

## 13. Deferred Engineering Questions

| # | Question | Blocking? |
|---|---|---|
| EQ-1 | Autonomous three-colonist runtime migration: stable per-colonist state containers, within-phase iteration order, and consequence-commit discipline under §5's unchanged seven-phase semantics | Before the Stage 2 completion slice that promotes roster colonists into independent simulated agents |
| EQ-2 | Deterministic ordering criteria: tie-breaks (DQ-D3) and colonist/trigger iteration orders | Before first decision-pipeline implementation |
| EQ-3 | PRNG stream structure (single vs. per-colonist streams) and draw-attribution scheme | Before first stochastic code; must be documented and stable |
| EQ-4 | Decomposition retention scope beyond the binding minimum (logged decisions) | Optimization-stage decision |
| EQ-5 | Tick realization: step sizing, batching, parallelization under §5's behavior-identical rule | Implementation planning |
| EQ-6 | Save format design and migration policy (behavior-preserving constraint binding) | Before first persistence code |
| EQ-7 | Trait discovery state location (agent-model DQ-4) | Irrelevant until multi-playthrough player state exists |
| EQ-8 | Replay harness design (the standing determinism test) and debug tooling surface | With first pipeline code — not after |
| EQ-9 | Snapshot assembly cost strategy (relevance filtering: "modules relevant to candidate goals" [decision-loop §1b]) | Implementation planning |
| EQ-10 | Observable-state registry update semantics (when a state change becomes visible to same-step perceivers) under §5's ordering | Before M12 implementation |

All *value* questions (rates, thresholds, magnitudes, bounds) remain with the prototype per ADR-17/18 and the freeze — none are engineering questions and none are repeated here.

## 14. Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Twelve modules + three services, cut along the frozen ownership splits | Every module boundary already exists in the approved architecture (colonist/world/systems, the attached-system pattern, the cross-cutting records); inventing different seams would be redesign | Fewer, larger modules (ownership table becomes ambiguous; AQ-2's blast radius grows); per-need/per-trait micro-modules (Systems Over Scripts violated at the module level — one system, many needs [needs-system P1]) |
| M4 Snapshot Service as the single world→decision read path | The perception invariants (fixity, Tier-1-only, no stage labels, spatial bounds) are enforceable at one choke point instead of trusted to every consumer — the cheapest structural enforcement of locked #4/#21/#22 | Each system reading world state directly under convention (invariants by discipline rather than by structure — the hidden-coupling failure architecture-philosophy forbids) |
| M12 publishes one observable-state registry read by both M4 and the UI | "A colonist knows what the player can see" [locked #21] becomes true by construction when both read the same source | Separate agent-visible and player-visible state (symmetry by ongoing synchronization — drift guaranteed) |
| Fixed seven-phase update order, normative in effect not mechanism | Determinism requires *an* order; freezing effect-order while freeing mechanism preserves decision-loop B3 (stages are not an algorithm) and leaves optimization room | Prescribed execution algorithm (violates B3); no normative order (replay guarantee unachievable) |
| ADR-20 resolves M10 to centralized per-pair storage with directional reads | One authority and one atomic update boundary preserve directional behavior without duplicating pair facts; owner-direction reads keep the conceptual model intact at decision boundaries | Colonist-owned duplicate records (split authority, duplicated history, higher pair-count cost); hybrid split ownership (synchronization complexity without a new capability) |
| Binding minimum retention: full decomposition for logged decisions | Locked #25's decomposability is unverifiable with less; the decision-loop already named this exact trade and this document fixes its floor | No floor (decomposability erodes under optimization pressure — decision-loop Risk 2); full retention mandate (a cost decision this document has no basis to force) |
| Full-pipeline prototype, validated at 24 colonists | The freeze's calibration-interdependence risk means partial-pipeline answers are false answers; legibility and pair-count assumptions only test at scale | Staged *partial-pipeline* prototypes (each answers its questions against a fake surrounding system, then re-answers later); validating below 24 (invalidates the two scale-dependent validation targets) |
| *(Review revision)* Staged scale progression 1 → 3 → 8 → 24; 24 is the validation target, not the first prototype size; the first slice is the smallest meaningful end-to-end loop | Engineering review 2026-07-10. Full pipeline ≠ full scale: the pipeline is end-to-end from stage 1 (one colonist proves the loop, determinism, and the replay harness cheaply); scale grows only after the loop works. Stages 1–3 tune provisionally; only stage-4 answers count against the ledger, preserving the scale-dependent validation commitment | Building at 24 first (debugging the pipeline and the scale simultaneously — maximum-cost first slice); treating stage 1–3 calibrations as final (the scale-dependent assumptions could invalidate them) |
| Replay harness specified as a standing test, not a milestone check | Determinism erodes by increments (EQ-5's optimizations); only continuous verification catches the increment that breaks it | Milestone-gate replay testing (finds the violation after its cause is buried) |

## 15. Kanban Update

**Card:** [Phase 3] Engineering Specification
**Status:** Approved — engineering review 2026-07-10 approved with one clarification; reconciled 2026-07-17 against ADR-20 and the merged Stage 2 implementation boundary — v0.3.0

**Completed:**
- ✅ design/engineering-specification.md — module decomposition (12 modules + 3 services, each traced to its authorizing sources); responsibilities; single-owner data ownership table; 14 directional interface contracts with binding constraints; fixed seven-phase update order (normative in effect, free in mechanism); condition-triggered event flow discipline; complete save/load boundary with replay-guarantee acceptance test; 8 determinism obligations; three-audience inspection interfaces with binding retention floor; prototype scope (full pipeline, 24 colonists, the complete calibration queue, exit criterion defined); non-goals; engineering risks; 10 deferred engineering questions (EQ-1–EQ-10)

**Contradiction report:** None found — re-checked on 2026-07-17 against the freeze's 30 locked decisions, ADR-17, ADR-18, ADR-20, and the approved AI Behavior Specification. No new ADR is required: ADR-20 resolved AQ-2, and the remaining gap is implementation scope (explicit offer/response protocol and autonomous multi-colonist runtime), not architecture contradiction.

**Constraints honored:** No implementation, code, TypeScript, pseudocode, formulas, or data-structure definitions. Architecture unchanged; no ADR reopened; no files created beyond this document. Every module traces to accepted design/ADR sources (traceability bracketing throughout).

**Review clarification applied (engineering review 2026-07-10 — Prototype Scope only; no architecture, module boundary, or update-order change):**
- §10: 24 colonists clarified as the validation target, not the required first prototype size; staged progression defined — 1 colonist (smallest meaningful end-to-end loop, the first implementation slice) → 3 (first social surface) → 8 (first colony texture) → 24 (validation); stage 1–3 calibrations provisional, only stage-4 answers count against the deferred-question ledger

**Architecture reconciliation applied (2026-07-17 — Issue #99; no architecture, module boundary, or update-order change):**
- Replaced all stale AQ-2-open / M10-blocked references with ADR-20's accepted centralized per-pair storage model
- Recorded the actual Stage 2 runtime boundary now present in code: one fully simulated colonist plus an identity-only roster, with real relationship storage, relational memory formation, companionship consequences, and Shared Meal overlay
- Identified the autonomous three-colonist runtime as an implementation expansion under the existing seven-phase architecture, not a new ADR trigger

**This document unblocks (upon approval):**
- Implementation planning (module boundaries, interface contracts, and ordering discipline fixed; first slice defined — the stage-1 single-colonist loop)
- Relationship-follow-on slices on top of ADR-20's accepted M10 storage model
- Prototype planning against §10's scope and exit criterion
- Replay harness and debug tooling design (EQ-8, specified as first-wave work)

**Follow-up tasks:**
- Implement the explicit ADR-18 offer/response protocol before promoting roster colonists into independent simulated agents
- EQ-1/EQ-2/EQ-3/EQ-6/EQ-8 before their respective implementation waves
- ADR-19 — Colonist Arrival System (candidate; prototype seeds colonists directly until then)

**Not committed** per instruction.
