# Architecture Freeze Report — Phase 1

**Version:** 1.1.0
**Date:** 2026-07-09 (revised: Phase 2 deferral accepted)
**Scope:** ADR-01 through ADR-16 (design/architecture-decision-set.md v0.3.0)
**Purpose:** Final review before writing design/colony-life.md

---

## Part 1 — ADR Index

| # | Title | Status | Depends On | Blocks | Priority | Phase |
|---|---|---|---|---|---|---|
| ADR-01 | Colonist Daily Rhythm | **Accepted** | ADR-02, ADR-10, ADR-11 | ADR-03, ADR-08, ADR-09 | Critical | 1 |
| ADR-02 | Daily Cycle Structure | **Accepted** | — | ADR-01, ADR-06, ADR-07 | Critical | 1 |
| ADR-03 | Observation → Decision Transition | **Accepted** | ADR-05, ADR-11 | ADR-05 (UI constraint) | High | 1 |
| ADR-04 | Policy System Shape | **Accepted** *(unblocked)* | ADR-11 | ADR-01, ADR-07, ADR-09 | Critical | 1 |
| ADR-05 | Colonist State Visibility | **Accepted** | ADR-10 | ADR-03, ADR-13, ADR-15 | Critical | 1 |
| ADR-06 | Time Scale | **Accepted** | ADR-02, ADR-15 | — | High | 1 |
| ADR-07 | Immediate vs. Delayed Decisions | **Accepted** | ADR-02, ADR-04 | ADR-09, ADR-11 | Critical | 1 |
| ADR-08 | Emergent Story Frequency | **Accepted** | ADR-12, ADR-15, ADR-16 | ADR-14 | High | 1 |
| ADR-09 | Maintenance Model | **Accepted** | ADR-04, ADR-07, ADR-10 | ADR-13, ADR-15 | Critical | 1 |
| ADR-10 | Trait System Architecture | **Accepted** | — | ADR-01, ADR-05, ADR-09, ADR-12 | Critical | 1 |
| ADR-11 | Policy Scope Architecture | **Accepted** | — | ADR-01, ADR-03, ADR-04, ADR-07 | Critical | 1 |
| ADR-12 | Relationship System Architecture | **Accepted** | ADR-10 | ADR-08, ADR-14 | High | 1 |
| ADR-13 | Environment Visibility Architecture | **Accepted** | ADR-05, ADR-09, ADR-15 | — | High | 1 |
| ADR-14 | Story Access Architecture | **Accepted** | ADR-08, ADR-12, ADR-15, ADR-16 | — | High | 1 |
| ADR-15 | Crisis Detection and Escalation | **Accepted** | ADR-05, ADR-09 | ADR-06, ADR-08, ADR-13, ADR-14 | Critical | 1 |
| ADR-16 | Colonist Memory Architecture | **Accepted** | — | ADR-08, ADR-14 | High | 1 |

**Summaries:**

- **ADR-01** — Three-tier colonist daily rhythm (shift skeleton / need threshold overrides / trait-influenced tendencies) with explicit 5-level priority resolution. Gives the observation loop a learnable baseline against which deviations are readable as signals.
- **ADR-02** — Continuous simulation clock as shared time reference; all events are condition-triggered, not clock-triggered. Shift transitions fire when duration has elapsed AND the colonist is not in a safety-critical task.
- **ADR-03** — All decision interfaces always accessible; no UI mode locks. A first-class "colony stable" visual state (not "absence of warnings") communicates when observation is sufficient.
- **ADR-04** — Two-tier policy: colony-level named stances set defaults; scope-specific overrides use direct parameter controls. Stances are values-neutral named positions, not optimization presets.
- **ADR-05** — Three-tier colonist visibility: ambient 7-state behavioral repertoire (Tier 1) / hover icons (Tier 2) / inspector (Tier 3). Two visual modes (overview / focus) for 24-colonist scaling. Crisis fast-access panel at Stage 2+.
- **ADR-06** — Speed control: Pause / 1x / 2x / 4x. Hard constraint at Stage 3+: maximum 1x, not player-adjustable, lifts automatically when all systems return to Stage 2 or below.
- **ADR-07** — Three delay categories: structural (construction time), policy (next shift boundary, cancellable), infrastructure routing (immediate). No emergency colonist command category — violates Pillar 2.
- **ADR-08** — Story events fire when simulation state crosses relationship/stress/trait thresholds — not on random rolls. Minimum frequency floor (one story event per colonist cluster per in-game day) using accelerated accumulation.
- **ADR-09** — Two-tier maintenance: preventive (continuous capacity consumption, policy-allocated) and reactive (triggered at Warning threshold, competes with shift assignments). Both skill-qualified; unqualified colonists do not count as maintenance capacity.
- **ADR-10** — Named behavioral tendencies with underlying probability weight modifiers. Traits not disclosed at arrival; revealed through observation. Base traits fixed; modifier accumulation from sustained conditions is reversible. Max ~10 traits in Phase 1.
- **ADR-11** — Four policy scopes: Colony / Module / Role / Shift. Cascade conflict resolution: Colony sets defaults; Module wins over Colony; Role wins over Colony; Module+Role conflict → Module wins; Shift modifies temporal activation only.
- **ADR-12** — Continuous affinity score (−100 to +100) producing 7 discrete named relationship states. Behavioral influence on probability weights, not shift override. 276 pairs at 24 colonists handled efficiently via near-zero-cost tracking for Neutral/Acquainted pairs.
- **ADR-13** — Three-layer environment visibility: 5-state base health (always visible) / module inspection (click) / system overlays (player-toggled, max 1 active). Base conduit state (active/reduced/no flow) without overlay.
- **ADR-14** — Three-tier story access: colonist decision log (natural language templates) / relationship history per pair / colony timeline (permanent, filterable). Distinct from colonist memory (ADR-16) — one is behavioral influence, the other is player access.
- **ADR-15** — Five-stage crisis escalation: Stage 0 Nominal → Stage 1 Stressed → Stage 2 Warning → Stage 3 Crisis (speed capped 1x) → Stage 4 Cascade. Per-system tracking; colony overall = maximum across all systems.
- **ADR-16** — Bounded episodic memory pool (50–100 events, hypothesis). Retention by `influence_weight = recency_weight × impact_weight`. Eviction removes lowest-weight item, not oldest — formative events persist; routine events fade.

---

## Part 2 — Corrected Architecture Dependency Graph

### Corrections Applied

Six circular dependencies were found in architecture-decision-set.md v0.2.0. All corrected below:

| Circular Dep | Root Cause | Correction |
|---|---|---|
| ADR-12 ↔ ADR-16 | ADR-16 listed ADR-12 as blocking dep | Remove ADR-12 from ADR-16's deps. ADR-16 defines memory architecture independently; relationship events are examples, not blockers. |
| ADR-08 ↔ ADR-14 | ADR-08 listed ADR-14 as blocking dep | Remove ADR-14 from ADR-08's deps. ADR-08 generates events; ADR-14 logs them. ADR-14 depends on ADR-08, not vice versa. |
| ADR-05 ↔ ADR-13 | ADR-05 listed ADR-13 as blocking dep; ADR-13 listed ADR-05 as blocking dep | Remove ADR-13 from ADR-05's deps. This is a co-design constraint (compatible visuals), not a blocking relationship. ADR-13 depends on ADR-05 (environment visibility must work in the same view colonist visibility defines). |
| ADR-05 ↔ ADR-15 | ADR-05 listed ADR-15 as blocking dep | Remove ADR-15 from ADR-05's deps. The crisis panel concept does not require Stage 2 thresholds to be defined first; the panel design is independent. ADR-15 depends on ADR-05 (crisis panel activates at Stage 2). |
| ADR-06 ↔ ADR-15 | ADR-15 listed ADR-06 as blocking dep | Remove ADR-06 from ADR-15's deps. Crisis stages can be defined without first defining the time scale feature. ADR-06 depends on ADR-15 (speed constraint activates at Stage 3+). |
| ADR-13 ↔ ADR-15 | ADR-15 listed ADR-13 as blocking dep | Remove ADR-13 from ADR-15's deps. ADR-15 defines stages; ADR-13 maps stages to visual representations. ADR-13 depends on ADR-15. |

One additional document error corrected:

| Document Error | Correction |
|---|---|
| ADR-02 listed ADR-01 and ADR-06 as dependencies | ADR-02 (clock structure) does not depend on ADR-01 (rhythm) or ADR-06 (speed). Both of those ADRs depend on ADR-02. The listed deps are "consumed by" relationships, not blocking ones. ADR-02 is Level 0. |
| ADR-11 listed ADR-04 as dependency | ADR-04 depends on ADR-11, not vice versa. The note "(this ADR must be accepted first)" in ADR-11 was a forward reference explaining why ADR-04 is blocked — not a statement that ADR-11 needs ADR-04. ADR-11 is Level 0. |

### Corrected Dependency Levels (Implementation Order)

```
Level 0 — Foundation (no blocking dependencies)
├── ADR-02  Daily Cycle Structure
├── ADR-10  Trait System Architecture
└── ADR-11  Policy Scope Architecture

Level 1 — First-order dependents
├── ADR-01  Colonist Daily Rhythm         [deps: ADR-02, ADR-10, ADR-11]
├── ADR-04  Policy System Shape           [deps: ADR-11]
├── ADR-05  Colonist State Visibility     [deps: ADR-10]
├── ADR-12  Relationship System           [deps: ADR-10]
└── ADR-16  Colonist Memory Architecture  [deps: none blocking]

Level 2 — Second-order dependents
├── ADR-03  Observation→Decision Transition [deps: ADR-05, ADR-11]
└── ADR-07  Immediate vs. Delayed          [deps: ADR-02, ADR-04]

Level 3 — Third-order dependents
└── ADR-09  Maintenance Model             [deps: ADR-04, ADR-07, ADR-10]

Level 4 — Fourth-order dependents
└── ADR-15  Crisis Detection & Escalation [deps: ADR-05, ADR-09]

Level 5 — Fifth-order dependents
├── ADR-08  Emergent Story Frequency      [deps: ADR-12, ADR-15, ADR-16]
└── ADR-13  Environment Visibility        [deps: ADR-05, ADR-09, ADR-15]

Level 6 — Sixth-order dependents
├── ADR-06  Time Scale                    [deps: ADR-02, ADR-15]
└── ADR-14  Story Access Architecture     [deps: ADR-08, ADR-12, ADR-15, ADR-16]
```

### Critical Path

The minimum chain that must be designed before `design/colony-life.md` can begin:

```
ADR-10 (Trait System)
  └─→ ADR-01 (Daily Rhythm)
        └─→ [colonist life document]

ADR-11 (Policy Scope)
  └─→ ADR-04 (Policy Shape)
        └─→ ADR-07 (Immediate vs. Delayed)
              └─→ [player decision vocabulary]

ADR-02 (Daily Cycle)
  └─→ ADR-07 (Immediate vs. Delayed)

ADR-05 (Colonist Visibility)
  └─→ ADR-15 (Crisis Detection)
        └─→ ADR-13 (Environment Visibility)
              └─→ [legible colony state]
```

---

## Part 3 — Architecture Freeze Report

### 3.1 Accepted ADRs

All 16 ADRs are accepted. Summary of what is now architecturally committed:

**Colonist behavior model:** Three-tier rhythm with explicit 5-level priority resolution. Traits modify probability weights; they do not override biological needs or station survival. No direct colonist commands under any circumstances.

**Simulation clock:** Continuous, condition-triggered events only. Clock provides shared time reference; no event fires because of a clock value. Shift transitions are condition-triggered (duration elapsed AND not in safety-critical task).

**Player decision vocabulary:** Three categories (structural / policy / infrastructure routing). Infrastructure routing is the only immediate lever. Policy is delayed to next shift boundary. No emergency command category.

**Policy system:** Named stances at colony scope; direct parameter controls at module/role/shift scope. Four scopes with cascade conflict resolution. Scope overrides visible to player.

**Colonist visibility:** Seven ambient behavioral states readable at overview zoom. Hover icons for categorical state. Inspector for full detail. Two visual modes (overview/focus) for 24-colonist scaling.

**Crisis model:** Five-stage escalation per system. Colony stage = maximum across systems. Stage 3 hard-caps speed at 1x. Speed control: Pause/1x/2x/4x otherwise.

**Relationship system:** Continuous affinity (−100 to +100) producing 7 named states. Behavioral influence through probability weight modification, not shift override. 276 pairs at 24 colonists with efficient near-zero-cost tracking for inactive pairs.

**Story generation and access:** Accumulation-based threshold crossing (not random roll). Minimum frequency floor via accelerated accumulation. Three-tier player access: colonist decision log / relationship history / colony timeline.

**Memory vs. story access distinction confirmed:** Colonist memory is a behavioral influence mechanism with bounded decay. The event log is a permanent player-access record. These are separate systems; conflating them is a design error.

**Maintenance model:** Preventive (policy-allocated capacity) and reactive (crisis-triggered, competes with shift assignments) are architecturally distinct. Both skill-qualified.

### 3.2 Status Changes This Freeze

| ADR | Before | After | Reason |
|---|---|---|---|
| ADR-04 | BLOCKED | Accepted | ADR-11 accepted — policy scope architecture now available |
| All others (ADR-01–ADR-03, ADR-05–ADR-16) | Draft | Accepted | Freeze review confirms no blocking defects |

### 3.3 Remaining Risks

These risks are accepted as part of the architecture but must be tracked through prototype:

| Risk | ADR | Severity | Mitigation |
|---|---|---|---|
| 20-min/day time scale hypothesis may be significantly wrong | ADR-06 | High | First prototype validation target; all need degradation rates depend on this |
| 7-state behavioral repertoire may prove insufficient as AI grows | ADR-05 | Medium | Revisit trigger: before AI behavior system design |
| Stage 1 threshold sensitivity: always-stressed colony | ADR-15 | High | Requires tuning; stable signal never appearing is a design failure |
| Need threshold override frequency undermines learnable baseline | ADR-01 | Medium | Requires calibration: overrides must be infrequent enough that normal shift is learnable |
| Minimum story floor mechanism may produce artificial-feeling events | ADR-08 | Medium | Accumulation acceleration is less visible than scripted events; validate in prototype |
| Category 3 routing exploitable as indirect colonist command | ADR-07 | Medium | Monitor in playtest: depowering modules to force colonist movement |
| 276 relationship pairs computationally expensive in mass-crisis | ADR-12 | Low | Efficiency assumption (most pairs are low-cost) holds until prototype falsifies it |
| Discrete relationship state transitions feel stepped | ADR-12 | Low | Micro-transitions within state bands must be smooth; art/animation design requirement |

### 3.4 Technical Debt

These are known simplifications accepted for Phase 1:

| Item | Impact | Pay-down trigger |
|---|---|---|
| ADR-07 Category 3 scope is undefined | Infrastructure routing could expand significantly; current definition is illustrative, not exhaustive | Before colony-life.md is written: enumerate specific Category 3 actions |
| ADR-10: "~10 traits" is a hypothesis, not a commitment | Trait count affects legibility and computational cost | Prototype: establish exact trait list before trait expressions are animated |
| ADR-04 stance dimensions are unnamed | Named stances are required for the policy interface; none are enumerated here | Before policy UI design |
| ADR-08 story floor formula unspecified | "Per cluster per day" requires cluster definition and floor enforcement logic | Before AI behavior design |
| ADR-11 scope cascade: Module+Role conflict → Module wins | This rule produces surprising behavior; "most specific wins" would be Role, not Module | Revisit if playtest shows Role-scope overrides cannot be expressed |

### 3.5 Future ADR Candidates

| Candidate | Status | Phase | Why Needed | Blocks |
|---|---|---|---|---|
| **ADR-17 — Need System Architecture** | **Deferred** | Phase 2 | No ADR defines what needs are structurally: taxonomy, count, degradation model, satisfaction mechanics. Required before Phase 2 AI behavior design — NOT required for Phase 1 gameplay design. colony-life.md may describe needs at the design level; ADR-17 constrains their implementation. | Phase 2 AI design |
| **ADR-18 — Social Action Space** | **Deferred** | Phase 2 | No ADR defines the vocabulary of colonist social interactions: what colonists can do socially, initiation conditions, proximity requirements, autonomous vs. triggered. Required before Phase 2 AI behavior design — NOT required for Phase 1 gameplay design. colony-life.md may describe social behavior at the design level; ADR-18 constrains its implementation. | Phase 2 AI design |
| **ADR-19 — Colonist Arrival System** | Candidate | Phase 2 | OQ-3 from core-loop.md: whether colonist arrival is player-controlled, scheduled, or random. Affects expansion phase pacing and player agency over colony growth. | design/gameplay-phases.md integration |

---

## Part 4 — Decision Log

| Decision | Date | Changed From | Changed To | Reason |
|---|---|---|---|---|
| Emergency command category removed from ADR-07 | Session 2 | Emergency commands (immediate direct colonist commands) as Category 4 | Removed entirely; no emergency command category | Violates Pillar 2 (Conditions, Not Commands); Category 3 infrastructure routing provides immediate crisis interaction without commanding a colonist |
| ADR-10 (Trait System) added as ADR-01 blocker | Session 2 | ADR-01 assumed implicit trait architecture | ADR-10 created as prerequisite, ADR-01 depends on it | Gap analysis identified traits as an undefined blocking dependency for daily rhythm |
| ADR-11 (Policy Scope) added as ADR-04 blocker | Session 2 | ADR-04 assumed single-scope policy | ADR-11 created as prerequisite; four scopes with cascade conflict resolution | Policy shape cannot be finalized without knowing scope architecture |
| Story access separated from story generation | Session 2 | ADR-08 covered both generation and access | ADR-08 = generation only; ADR-14 = access (new) | Architecture review identified conflation as design risk; different retention models, different system roles |
| Colonist memory separated from event log | Session 2 | Undifferentiated | ADR-16 = behavioral influence (bounded, decaying); ADR-14 = player access (permanent for high-significance) | These systems have different retention models and different design goals; conflating them is an implementation error |
| ADR-04 unblocked | This freeze | BLOCKED (ADR-11 not accepted) | Accepted | ADR-11 accepted in this freeze; dependency satisfied |
| 6 circular dependencies corrected | This freeze | Bidirectional dep references in multiple ADRs | Unidirectional: removed 6 reverse references | See Part 2 corrections table |
| ADR-02 level corrected | This freeze | Placed at Level 3 in prior critical path | Level 0 (no blocking deps) | ADR-02 (clock) is consumed by ADR-01 and ADR-06, not the other way |
| ADR-17 and ADR-18 deferred to Phase 2 | v1.1.0 revision | Initially flagged as Phase 1 blockers for colony-life.md | Deferred — Phase 2, not Phase 1 blockers | colony-life.md is a gameplay design document; ADR-17/18 constrain AI implementation, not gameplay design. The design layer and the implementation layer are distinct. |
| Verdict changed: NOT READY → READY | v1.1.0 revision | NOT READY (awaiting ADR-17, ADR-18) | READY | No Phase 1 blockers remain after Phase 2 deferral confirmed |

---

## Part 5 — Kanban Update

**Completed this session:**
- ✅ [Phase 1] Design Core Gameplay Loop (design/core-loop.md, design/player-journey.md, design/gameplay-phases.md)
- ✅ Gap Analysis of existing design documents
- ✅ Architecture Decision Review (ADR-01 through ADR-09)
- ✅ Architecture Review Report (critical review, new ADRs recommended)
- ✅ Revised Architecture Decision Set (ADR-01 through ADR-16, v0.2.0)
- ✅ Architecture Freeze Review (this document)

**Cleared by this freeze:**
- ✅ design/colony-life.md — READY (see verdict below)
- ✅ Circular dependencies corrected in design/architecture-decision-set.md (v0.3.0)

**Deferred to Phase 2 (not blockers for colony-life.md):**
- ⏸ ADR-17 — Need System Architecture (required before Phase 2 AI design)
- ⏸ ADR-18 — Social Action Space Architecture (required before Phase 2 AI design)

**Deferred (post-colony-life.md):**
- ADR-19 — Colonist Arrival System
- ai-studio/templates/adr.md (referenced in workflows; does not exist)
- ai-studio/roles/ files (only README exists)
- ai-studio/checklists/ files (task-start, pre-commit, pre-review, phase-complete)

---

## Verdict

### READY for design/colony-life.md

All 16 Phase 1 ADRs are Accepted. No Phase 1 blockers remain.

**Basis for READY:**

The 16 accepted ADRs provide complete architectural coverage for the Phase 1 gameplay design layer:

- Colonist behavioral model is defined (ADR-01, ADR-02, ADR-10)
- Player decision vocabulary is defined (ADR-07, ADR-04, ADR-11)
- Observation and legibility model is defined (ADR-03, ADR-05, ADR-13)
- Story generation and access are defined (ADR-08, ADR-12, ADR-14, ADR-16)
- Crisis model is defined (ADR-15, ADR-06)
- Maintenance model is defined (ADR-09)

**Scope boundary for colony-life.md:**

design/colony-life.md is a gameplay design document — it describes how colonist life feels and plays, from the player's perspective. It may name and describe needs, social interactions, and daily rhythms at the design level. It must not make implementation decisions about need degradation formulas, social action state machines, or AI behavior algorithms — those belong to ADR-17 and ADR-18, which are deferred to Phase 2.

The boundary is: design/colony-life.md describes *what the player observes and what conditions they set*. It does not describe *how the simulation produces those behaviors*.

**Deferred ADRs do not block colony-life.md:**

ADR-17 (Need System Architecture) and ADR-18 (Social Action Space) are required before Phase 2 AI behavior design. They are not required before Phase 1 gameplay design. The gameplay document describes player experience; the deferred ADRs constrain implementation. These are different layers. colony-life.md may describe that "a colonist who has not eaten recently will seek food and show visible signs of hunger" without defining what the hunger degradation curve looks like. That curve is ADR-17's scope.

**What colony-life.md must not do:**

- Define specific need counts, names, or degradation rates (ADR-17 scope)
- Define the vocabulary of social actions or their initiation logic (ADR-18 scope)
- Make any decision that would require reopening an accepted ADR

**Proceed to design/colony-life.md.**
