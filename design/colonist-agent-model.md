# Colonist Agent Model

**Version:** 0.2.0 (architecture review revisions applied: AQ-1 resolved, deferred questions reclassified)
**Phase:** Phase 2 — Design
**Authority:** ADR-01 through ADR-16 (Accepted); design/colony-life.md; ai-studio/constitution/glossary.md
**Scope:** Conceptual structure of the Colonist — what a colonist is, what it owns, and where its model boundary lies.

**This document does not define:** need formulas, decision algorithms, utility functions, state machines, data structures, classes, or TypeScript.

---

## What a Colonist Is

A colonist is the primary subject of the simulation. Not a resource unit. Not a traffic agent carrying work capacity from module to module. A person — with needs that decay if unmet, relationships that accumulate from interaction, a character that reveals itself under pressure, and a history that shapes how they respond to conditions they have never faced before.

The player does not control colonists. The player creates conditions; colonists respond to those conditions as autonomous agents. What distinguishes a colonist from any other simulation entity is that colonist behavior is generated from internal state, not from external instruction. No clock event tells a colonist to become hungry. No designer authored the moment when two colonists turn hostile. These things happen because the simulation runs and the colonist's internal state evolves.

A colonist is defined by three things: **who they are** (stable identity), **what has accumulated over their time in the colony** (long-term state), and **how they are right now** (short-term state). These three layers interact continuously. Who they are shapes how they respond to conditions. What they have accumulated is the evidence that they are a person with a history. How they are right now is what drives the next decision.

The colonist model is the conceptual container for all three layers. It defines what those layers are and where they live. It does not define how they are computed.

---

## Stable Identity

Stable identity is what a colonist brings to the colony at arrival and retains without change throughout their time there. It does not shift with conditions. It does not accumulate from experience. It is the foundation on which everything else is built.

### Name

A colonist has a name. The name is the player's primary reference for this person in stories, in the inspector, in the decision log, and in the post-mortem. A colonist is never "Engineer #4." They are someone specific. The name is permanent — it does not change.

### Base Traits

A colonist arrives with a fixed set of base traits. Traits are named behavioral tendencies with underlying probability weight modifiers (ADR-10). They shape how a colonist evaluates needs, forms relationships, and responds to conditions. Traits are not behaviors — they are parameters that modify how behavioral systems operate.

Base traits are fixed at arrival. They do not change regardless of what the colonist experiences. What changes is whether the player has observed them, and how strongly they express under current conditions (trait modifiers — see Long-Term State below).

A colonist's base traits are not disclosed to the player at arrival. They reveal themselves through the colonist's behavior under relevant conditions. Each trait has a discovery state: **Unknown**, **Observed**, or **Confirmed**. Unknown means the trait has not yet expressed itself in a way the player could notice. Observed means the player has seen the behavioral expression at least once. Confirmed means the player has seen it enough times to understand the pattern.

Discovery state can only advance — a Confirmed trait cannot regress to Unknown. Once a trait is part of the player's model of this person, it stays there.

### Skill Profile

A colonist has a skill profile that determines which types of work they are qualified to perform. Skill qualification governs maintenance capacity (ADR-09): an unqualified colonist cannot contribute to maintenance of a system type even if they are physically present in the module. Skill is part of the colonist's role and trait expression (ADR-09, ADR-10).

The skill profile is stable in the sense that a colonist does not lose their qualifications over time. However, their capacity to apply those skills is affected by their current state — a highly qualified engineer at critical stress levels, or in a Fractured relationship with their maintenance partner, may perform below their rated capacity regardless of their qualifications. The skill is real. The conditions that suppress it are also real.

**Ownership resolution (architecture review, accepted):**

- The **Colonist owns Skills** — skill is intrinsic, stable identity. It is not granted or removed by any external system.
- **Policies own permissions** — a policy determines whether a colonist is permitted or assigned to apply a skill in a given context (module, role, shift). Permission is a world-state condition, not a change to the colonist's skill.
- **Tasks own requirements** — a task defines what skill it requires. Whether a colonist can perform a task is the intersection of the colonist's intrinsic skill, the active policy permission, and the task's requirement.

This resolves what was previously an open architectural question. Skill is fully colonist-owned; the policy system never modifies it — it modifies only what the colonist is permitted to do with it.

---

## Long-Term State

Long-term state is what accumulates over a colonist's time in the colony. It changes more slowly than short-term state, but it always changes. It is the mechanism by which colonists develop a history — by which the colony's past becomes present in the behavior of the people who lived it.

### Episodic Memory

A colonist maintains a bounded episodic memory pool (ADR-16). The pool holds a limited number of significant events — events that caused a measurable change in the colonist's affinity with another colonist, their stress level, their need state, or their behavioral output. Each event in the pool carries an influence weight derived from recency and impact. High-impact events decay more slowly and survive eviction rounds that eliminate low-weight events. A colonist can retain a formative event from months ago while forgetting routine events from yesterday.

Memory is an input to behavioral probability weights. It adjusts how the colonist evaluates conditions — a colonist who remembers resource deprivation has a slightly elevated preference for resource security; a colonist who remembers a shared crisis has elevated affinity drift toward those who were there with them. Memory influences decisions; it does not drive them. Current state is always the primary input.

Memory is not the player-accessible event log (ADR-14). The event log is a world-level record maintained for the player's benefit. Memory is an internal system maintained for the colonist's behavioral continuity. A colonist may have moved on from an event — their memory of it may have decayed to near-zero influence — while the event log still contains a permanent record of what happened. These are separate systems. Conflating them is a design error.

### Relationship Records

A colonist maintains relationship records for every other colonist they have had significant interaction with. Each record contains a continuous affinity score (−100 to +100) and the derived relationship state (one of seven named states per ADR-12). Each record also contains a bounded history of the significant interaction events that moved the affinity score.

Relationships are long-term state because affinity scores drift gradually from ongoing interaction and are not reset between shifts. A Bonded relationship carries across days. A Fractured one carries too. The relationship a colonist has with a colleague is part of who they have become in this colony — it cannot be read off of their arrival manifest.

Relationships modify probability weights on behavioral tendencies (ADR-12). A Bonded colonist shows proximity preference and stress reduction in shared modules. A Fractured colonist shows avoidance and increased refusal probability for shared-task assignments. These effects are weight modifications — they do not override shift assignment or the priority resolution order.

> **Architectural Question AQ-2** — Whether relationship records are owned by each individual colonist (each colonist holds their own directional perspective on every other colonist) or by a centralized relationship system (one bidirectional record per pair, shared) must be resolved before implementation. The glossary describes relationships as "directional" (how colonist A regards B), which implies individual ownership. ADR-12 describes "bidirectional records per pair," which is compatible but implies different storage. This document treats relationship records as colonist-owned, consistent with the glossary framing. Implementation may choose centralized storage for efficiency — but the conceptual model presented here is individual ownership.

### Trait Modifiers

Sustained conditions produce reversible overlays on base trait expression called trait modifiers (ADR-10). A colonist who has been chronically overworked may accumulate a "Worn Down" modifier that suppresses the Driven trait's work-override tendency. Unlike base traits, modifiers can change. If the conditions that produced a modifier resolve, the modifier fades.

Trait modifiers are long-term state because they accumulate over in-game days, not ticks. They represent the colonist responding to their sustained experience in a way that is visible to the player — a colonist who is less driven than they used to be is communicating that something has changed. Trait modifiers are visible in the inspector as sub-entries under the relevant base trait, distinguished visually from the base trait itself.

### Trait Discovery State

As the player observes a colonist's behavior over time, trait discovery state advances from Unknown through Observed to Confirmed. Discovery state is long-term because it only changes when observation occurs and because it cannot regress.

Trait discovery state is the player's accumulated knowledge of this colonist. It is stored as part of the colonist model because it is colonist-specific, persists across the playthrough, and must be available at any point the player opens the inspector for this colonist.

---

## Short-Term State

Short-term state is what changes tick to tick, moment to moment, shift to shift. It is the live expression of the colonist's current condition — what is happening to them right now and what they are doing about it.

### Need Levels

A colonist has a set of needs. Each need has a current level — a quantified measure of how well that dimension of their wellbeing is being met. Needs decay over time at rates the simulation clock drives (ADR-02) and that base traits modify (ADR-10). When a need drops below a defined threshold, urgency builds. At the low threshold, the colonist seeks satisfaction at the next available opportunity without disrupting their shift. At the critical threshold, the colonist overrides their shift assignment immediately (ADR-01 priority 2).

The canonical set of needs — their names, count, degradation rates, threshold values, and satisfaction mechanics — is not defined here. That belongs to ADR-17. This document establishes that need levels are colonist-owned short-term state: they exist, they decay, they generate urgency, and they are the primary driver of the colonist's behavioral priority resolution.

### Stress Level

A colonist has a current stress level. Stress is not a single need — it is an emergent condition that accumulates from the combination of unmet needs, hostile relationships, sustained overwork, crisis exposure, and conditions the colonist finds aversive given their traits. Stress accumulates and dissipates at rates that base traits modify.

Stress drives the Stressed behavioral state (ADR-05). When stress crosses a behavioral threshold, the colonist's movement and posture communicate it at Tier 1 — before the player has hovered or inspected. Stress is the mechanism by which internal pressure becomes observable at a glance.

### Current Behavioral State

At every moment, a colonist is in one of the seven behavioral states defined in ADR-05: Working, Resting, Eating, Socializing, Stressed, Blocked, or In Conflict. This is the colonist's observable output — the signal the player reads at overview zoom without any interaction.

The behavioral state is determined by the colonist's current condition and what they are actively doing. It can change within a shift when conditions change. A colonist who was Working enters Stressed when stress crosses the behavioral threshold. A colonist who was Socializing enters In Conflict when a nearby colonist is at a Fractured relationship state and proximity triggers friction.

### Current Goal and Task

A colonist pursues a current goal — a specific, completable objective generated from their needs, motivations, and the world state snapshot they received (glossary). The goal has a priority determined by the five-level priority resolution order (ADR-01). Within a priority level, how a colonist selects among available goals is a question for the Phase 2 AI behavior specification.

The colonist also has a current task — the discrete action they are executing to make progress toward the goal. Tasks are tied to specific locations or modules. Tasks have duration, resource cost, and skill requirements (glossary). A colonist can have at most one current task at a time.

Goal and task are short-term state — they change as conditions change and as goals are completed, blocked, or overridden by higher-priority conditions.

### Active Trait Modifiers (Current Expression)

Trait modifiers accumulate in long-term state, but their current expression level is short-term: the modifiers apply now, at this magnitude, based on current conditions. If the conditions that produced a modifier resolve, the modifier's suppressive effect fades — which is a short-term change to how the long-term modifier expresses.

The distinction matters: the accumulated history of sustained overwork is long-term state; the current magnitude of the "Worn Down" modifier that history produced is short-term state.

---

## What Belongs to the Colonist

The colonist model owns the following:

**Stable identity**
- Name
- Base traits (with discovery state per trait: Unknown / Observed / Confirmed)
- Skill profile

**Long-term state**
- Episodic memory pool (bounded, decay-weighted)
- Relationship records (affinity scores, derived states, interaction history — per colonist, directional; see AQ-2)
- Trait modifiers (the accumulated history of sustained conditions)

**Short-term state**
- Need levels (current level per need)
- Stress level (current stress accumulation)
- Current behavioral state (one of seven per ADR-05)
- Current goal and task
- Active expression of trait modifiers at current magnitude

**Derived**
- Motivations — derived from the colonist's own trait weights and current need states (glossary). The colonist evaluates its own motivations; they are not assigned from outside.
- Goal stack — the ordered set of current and queued objectives the colonist is managing. The structure of the goal stack (depth, lifecycle rules, how conflicts are resolved between queued goals) is not defined here; it is defined in the Phase 2 AI behavior specification.

The colonist does not reach into the world to query values at decision time. It consumes a world state snapshot (architecture philosophy §3). Everything the colonist needs to make a decision is either in its own model or in the snapshot it received at the start of the tick.

---

## What Belongs to the World

The following are not colonist-owned. The colonist reads them from the world state snapshot at decision time. It does not maintain them.

**Shift assignment**
The colonist's work period, rest period, and free period are determined by policy (ADR-01, ADR-04, ADR-11). The shift belongs to the policy system and is communicated to the colonist as part of world state. When a colonist deviates from their shift, they are overriding a world-assigned parameter — not changing something they own.

**Module state and resource availability**
Whether a module is functional, what resources are available, whether a workstation is occupied — these are world state. The colonist reads them from the snapshot to determine whether their current task is executable. A Blocked behavioral state (ADR-05) signals that the world conditions necessary for the colonist's task are not met.

**The simulation clock**
The clock (ADR-02) is world-owned. Need degradation happens at rates relative to the clock. The colonist does not track its own time.

**The colony timeline and event log**
The event log (ADR-14) is a player-access mechanism. When a colonist's decision is significant enough to record, the world observes the decision and writes to the log. The colonist does not write its own log entry. The colonist's memory (ADR-16) and the world's event log are produced by the same events, but they are separate records with different retention models and different purposes.

**Crisis stage**
Crisis stage (ADR-15) is a colony-level condition tracked per system. The colonist does not own it. Station survival priority (ADR-01 priority 1) fires when the world communicates a survival-critical condition; the colonist responds to the world state that encodes that condition.

**Other colonists' internal state**
A colonist does not hold live references to another colonist's need levels, stress level, or goals. It reads the world state snapshot, which may include the observable behavioral states of nearby colonists (Tier 1 states from ADR-05), but the source of truth for another colonist's internal model is that colonist's own model — accessed only through the snapshot, never directly.

---

## What Belongs to Future Systems

The following are out of scope for this model and must not be assumed or decided here.

**Need taxonomy and formulas (ADR-17)**
The names of the needs, how many there are, how they decay, what satisfies them, at what rate, and what thresholds define "low" vs. "critical" — all of this belongs to ADR-17. This document establishes that need levels exist, that they are colonist-owned short-term state, and that they drive urgency. It does not specify what those needs are.

**Social action vocabulary (ADR-18)**
What social actions a colonist can take, when they initiate them, what proximity is required, whether they are autonomous or condition-triggered, and how they satisfy the social need — all of this belongs to ADR-18. This document establishes that colonists have relationships that are influenced by interaction. It does not define what those interactions are or name them.

**Decision algorithm**
How the colonist selects between available goals, how it scores tasks within a priority level, how trait weights and memory weights and relationship modifiers combine into a selection — this belongs to the Phase 2 AI behavior specification. This document defines what the algorithm has to work with, not how the algorithm operates.

**Goal stack structure**
The depth of the goal stack, the rules for adding and abandoning goals, how blocked goals are handled — these are implementation decisions that require the decision algorithm context to make correctly. They are not resolved here.

**World state snapshot content**
What exactly the snapshot contains — which colonist states are visible, what resource information is included, how nearby vs. distant modules are represented — is not defined here. It is one of the most important deferred questions in the Phase 2 design (see DQ-2, owned by the Decision Loop design).

**Data structures, classes, and implementation**
Type definitions, memory layouts, serialization formats — these belong to the engineering specification. This document defines the conceptual model. The engineering specification translates it into implementation.

**Colonist arrival system (ADR-19)**
How colonists arrive, who controls the timing, what their initial state is, what their first world state snapshot contains — this belongs to ADR-19. This document defines what a colonist is once they exist.

---

## Boundaries of the Model

These are explicit constraints on what the colonist model does and does not do. They are not implementation guidelines — they are design commitments that must be enforced at every layer.

**1. A colonist does not receive direct instructions — ever.**
The player cannot tell a specific colonist to do a specific thing. No mechanism exists for this. Not during crises. Not as an emergency option. Not at any cost. This is not a limitation — it is the design (Pillar 2, Conditions Not Commands). Every colonist behavior is generated from the colonist's internal state in response to world conditions. The colonist's autonomy is non-negotiable.

**2. A colonist reads world state through a snapshot.**
At decision time, the colonist has a coherent view of world state that does not change during its decision process (architecture philosophy §3). It does not query the world or other agents in real time. This is what preserves decision reproducibility (Principle 7) and prevents hidden coupling between agents. The snapshot is fixed at the start of each tick; the colonist reasons from that fixed view.

**3. A colonist's memory is not the event log.**
Colonist memory (ADR-16) and the player-accessible event log (ADR-14) are produced by the same events but serve different purposes with different retention models. Memory influences behavior and decays. The event log records history and is permanent for significant events. Conflating their storage or their retention logic is a design error that breaks both systems.

**4. Traits are parameters, not behaviors.**
A trait does not cause a specific behavior. A trait modifies the weights of the systems that produce behavior. The distinction matters for explainability (Principle 6): when the inspector shows why Maya refused the emergency repair task, the explanation must trace to her stress level, her goal priority, her relationship with the assigned co-worker — not to a trait name as a black-box cause. Traits are the mechanism by which those values were weighted; they are not the explanation by themselves.

**5. The colonist model does not define the colonist's observable output vocabulary.**
The seven behavioral states (Working, Resting, Eating, Socializing, Stressed, Blocked, In Conflict) are defined in ADR-05. The colonist model defines the internal state that drives those outputs. It does not extend, modify, or re-define the output vocabulary. Changes to the seven-state repertoire require a revisit of ADR-05, not a change to this document.

**6. The colonist model does not define what needs are.**
Need levels are colonist-owned short-term state. What those needs are named, how many there are, and how they work is ADR-17 scope. This model is compatible with any need taxonomy that ADR-17 produces, because it does not assume any specific set of needs.

---

## Design Decisions

**Decision 1: Stable identity is separated from dynamic state**

The model divides a colonist into stable identity, long-term state, and short-term state. This is not a data structure decision — it is a conceptual commitment to treating these layers as having different invariants.

Stable identity cannot be modified by conditions. Base traits fixed at arrival are not the same kind of thing as accumulated relationship history or current need levels. Mixing them into a single undifferentiated entity makes it impossible to reason about which attributes are permanent and which are responsive to the simulation.

The separation also clarifies what "character" means: a colonist's character is expressed through their stable identity and long-term state together, under the pressure of short-term conditions. The player who says "that's just like Ren" has built a model of Ren's stable identity. The player who says "Ren is not doing well" is reading Ren's short-term state.

**Decision 2: Long-term state is distinguished from short-term state**

Memory and relationships are not short-term. They accumulate over in-game days and are the primary mechanism by which colonists develop a history. Treating them as short-term state — something that could reset between sessions or between shifts — would break the cultural emergence mechanism (ADR-16) and the story-generating accumulation model (ADR-08).

The distinction also clarifies the player's observation challenge: short-term state is what the player reads at a glance. Long-term state is what the player understands after watching over time. The game's teaching arc moves the player from reading short-term signals to understanding the long-term patterns that produced them.

**Decision 3: Trait discovery state is colonist-owned**

Trait discovery state (Unknown / Observed / Confirmed) tracks the player's knowledge of this colonist's traits. It is placed in the colonist model rather than in a separate player-knowledge store.

The reason: trait discovery state is colonist-specific, persists with the colonist, and must be available every time the player views this colonist's inspector. Indexing it anywhere other than the colonist would require a colonist reference anyway. For a single-playthrough model, colonist ownership is the simpler and more coherent location.

This decision is flagged as potentially worth revisiting if the game ever introduces multi-playthrough persistent player knowledge (see DQ-4).

**Decision 4: Relationship records are described as colonist-owned; implementation ownership is an open architectural question**

The glossary defines relationships as "directional" — how colonist A regards colonist B. The colonist model follows this framing: each colonist owns their perspective on every relationship. This is consistent with the autonomy model; a colonist's regard for a colleague is part of their internal state.

ADR-12's "bidirectional records per pair" framing is noted. Implementation may choose centralized storage (one record per pair) for efficiency without conflicting with the conceptual model of colonist-owned perspective. This is identified as AQ-2 rather than decided here.

**Decision 5: What belongs to future systems is explicitly named**

Rather than leaving gaps in the model, this document explicitly identifies what is out of scope and why. The need taxonomy, social action vocabulary, decision algorithm, goal stack structure, and world state snapshot content are all named as belonging to future systems.

This is a protocol commitment: these items must not be decided by implication in other Phase 2 documents before ADR-17 and ADR-18 are written. Naming them explicitly creates a list of decisions that require explicit resolution, not inference.

---

## Risks

**Risk 1: The colonist model will be used to make decisions it explicitly defers**

This document defers several significant questions (need taxonomy, social action vocabulary, decision algorithm). As Phase 2 work proceeds, there will be pressure to resolve these questions implicitly — to assume a need taxonomy when writing AI behavior descriptions, to assume a social action vocabulary when describing relationship mechanics. Each implicit assumption is a shadow decision that will constrain ADR-17 and ADR-18 before they are written.

*Severity: High. Mitigation: Any Phase 2 document that references a need by name or a social action by type is making an assumption that belongs to ADR-17 or ADR-18. Those documents must be written before the phase 2 AI behavior specification proceeds to the detail level where specific needs and actions are required.*

**Risk 2: The memory / event log distinction will erode under implementation pressure**

ADR-16 (colonist memory) and ADR-14 (event log) are distinct systems with different retention models and different purposes. The implementation temptation is to share a storage mechanism, write to both simultaneously, or allow one to serve both purposes. If this happens, memory's decay model is compromised or the event log's permanence is compromised — or both.

*Severity: High. Mitigation: Boundary 3 (memory is not the event log) must be enforced as a structural constraint in the engineering specification, not as a convention. No shared write path between the two systems.*

**Risk 3: Trait modifiers will be conflated with base traits in player-facing UI**

The distinction between base traits (fixed, permanent) and trait modifiers (reversible, condition-produced) is conceptually clear but visually similar. A player who sees "Driven (Worn Down)" in the inspector may not understand that one of these is who this colonist is and the other is what the colony has done to them. If the UI represents both the same way, the player loses the ability to understand whether a behavioral change is permanent character or temporary condition.

*Severity: Medium. Mitigation: The inspector must visually distinguish base trait and active modifier — different display format, not just different label. This is a UI design requirement that must be carried into the Phase 2 UI specification.*

**Risk 4: The world state snapshot content is undefined and assumed**

The colonist reads a world state snapshot at decision time. This document establishes that the snapshot exists and that the colonist uses it. It does not define what the snapshot contains (see DQ-2, deferred to the Decision Loop design). As Phase 2 AI design proceeds, the snapshot contents will be assumed without being decided — creating invisible constraints on what the decision algorithm can know.

*Severity: High. The snapshot content is load-bearing for the AI design. DQ-2 must be resolved in the Decision Loop design before the decision algorithm is specified.*

**Risk 5: The skill / permission / requirement boundary erodes in implementation**

The accepted ownership model (Colonist owns Skills, Policies own permissions, Tasks own requirements) is clean conceptually but has a known failure mode in implementation: a policy that writes to a colonist's skill profile "for convenience," or a task that checks skill directly without checking permission. Either shortcut collapses the three-way boundary and makes it impossible to reason about why a colonist can or cannot perform a task.

*Severity: Medium. Mitigation: The engineering specification must enforce the boundary structurally — the policy system has no write access to the skill profile; task eligibility is always evaluated as the intersection of skill, permission, and requirement.*

---

## Deferred Questions

These questions do not block this document. They belong to later Phase 2 documents, named per question. They are recorded here because this document is where they surface; they must be resolved in their owning documents before Phase 2 implementation proceeds.

**DQ-1 — The Goal Stack's Depth and Lifecycle** *(deferred to: Goal System / Decision Loop design)*

This document establishes that a colonist has a goal stack with a current goal and queued objectives. How many goals can be on the stack at once? When is a goal added, replaced, or abandoned? If a colonist's current task becomes blocked (resource unavailable, path blocked), does the goal persist while the task is retried, or is the goal abandoned and regenerated when conditions permit?

**DQ-2 — The World State Snapshot's Content** *(deferred to: Decision Loop design)*

The colonist reads a world state snapshot at decision time. What does that snapshot contain? Specifically:

- Does it include the observable behavioral states of nearby colonists (ADR-05's seven states)?
- Does it include the colonist's own relationship records — or are those already in the colonist's own model and therefore available without being in the snapshot?
- Does it include module health states? Resource levels in nearby modules? The location of other colonists?
- What determines "nearby" — physical proximity, module assignment, or some other criterion?

The snapshot content determines what a colonist can "know" when making a decision. This is both a design question (what should colonists be aware of?) and an engineering question (what can be efficiently provided per tick). It must be resolved in the Decision Loop design before the decision algorithm is specified.

**DQ-3 — Motivation: Derived at Decision Time or Committed at Goal Formation?** *(deferred to: Goal System / Decision Loop design)*

The glossary defines motivation as "derived from trait weights and current need states." This suggests motivation is computed fresh at each decision point, not stored as persistent state. But if motivation is re-derived every tick, a colonist can change its mind about why it is pursuing a goal while already pursuing it.

The alternative: a colonist commits to a motivation when a goal is adopted and holds that motivation until the goal is completed or abandoned. The committed motivation becomes part of the goal record.

Which model is intended — continuous derivation or committed motivation — affects how the goal stack behaves when conditions change mid-pursuit. It must be resolved in the Goal System / Decision Loop design before the decision algorithm is specified.

**DQ-4 — Trait Discovery State: Colonist-Owned or Player Profile?** *(deferred to: player profile design, if one is ever proposed)*

This document places trait discovery state in the colonist model (Decision 3). An alternative is to store it in a player knowledge profile that spans colonists. For Phase 1 (single playthrough, no persistent player state across runs), the distinction is irrelevant — both locations produce the same behavior. The question becomes relevant if the game ever introduces multi-playthrough persistence or shared player knowledge.

For Phase 1 and Phase 2, colonist ownership is the simpler model. This question does not require resolution before Phase 2 implementation, but it should be noted before any player profile system is designed.

**DQ-5 — The Social Need and ADR-18's Relationship to This Model** *(deferred to: ADR-18)*

The glossary names social contact as a need. A colonist's social need drives social behavior — proximity seeking, interaction initiation, relationship formation. But the vocabulary of social actions (what a colonist does to satisfy the social need) belongs to ADR-18. This creates a gap: this model describes need levels as short-term colonist state without being able to describe what satisfies the social need.

The question is not about need formulas — it is about the model's completeness. The colonist model as described is well-defined for resource-type needs (hunger, rest) where satisfaction is a discrete action (eat, sleep). For the social need, satisfaction is a relationship event — which requires ADR-18's action vocabulary before the satisfaction model can be described even at the conceptual level.

---

## Open Architecture Questions

*AQ-1 (Skill Profile Ownership) was resolved by architecture review: the Colonist owns Skills; Policies own permissions; Tasks own requirements. See Stable Identity → Skill Profile. It is no longer an open question; the number is retired.*

**AQ-2 — Relationship Record Ownership (Architectural Question — unresolved)**

Does each colonist own their relationship records (one directional record per relationship, stored on the colonist), or does a centralized relationship system own all records (one bidirectional record per pair, accessed by both colonists)?

The glossary's "directional" framing supports colonist ownership. ADR-12's "bidirectional records per pair" is ambiguous. Both models produce the same gameplay behavior — the choice is about storage, access patterns, and whether relationship state is consistent between both colonists in a pair.

This is an architecture decision that must be made before the relationship system is implemented.

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Stable identity separated from long-term and short-term state | Different invariants require different conceptual treatment; base traits (permanent) and need levels (transient) must not be conflated | Single undifferentiated state model (obscures what can and cannot change) |
| Long-term state is its own category, not subsumed by short-term | Memory and relationships accumulate over days and are the mechanism of history; treating them as short-term would break cultural emergence (ADR-16) and story accumulation (ADR-08) | Two-layer model: stable + dynamic, with dynamic covering both accumulation and moment-to-moment (loses the meaningful distinction) |
| Trait discovery state is colonist-owned | Discovery is colonist-specific, persists with the colonist, and must be available at every inspector view; indexing it elsewhere requires a colonist reference anyway | Separate player knowledge store (adds indirection with no design benefit in single-playthrough model) |
| Relationship records described as colonist-owned; AQ-2 raised | Consistent with glossary's "directional" framing; flagged as architectural question for implementation to resolve | Centralized relationship store decided here (premature; outside this document's scope and may constrain implementation unnecessarily) |
| AQ-1 resolved: Colonist owns Skills; Policies own permissions; Tasks own requirements | Architecture review resolution (accepted). Three-way ownership keeps skill fully colonist-intrinsic while giving the policy system its lever (permission) and the task system its lever (requirement) | Skill as policy-modifiable attribute (collapses identity into world state); effective-skill overlay computed by policy (obscures why a colonist can or cannot perform a task) |
| Need taxonomy explicitly excluded as future-system scope | ADR-17 scope; naming specific needs here creates implicit decisions that constrain ADR-17 before it is written | Including a provisional need set with a caveat (provisional sets become de facto decisions before the ADR is written) |
| Goal stack acknowledged but not structurally defined | Goal and goal stack are in the glossary; the stack's depth and lifecycle rules belong to the Phase 2 AI behavior specification, not the conceptual model | Defining max stack depth or lifecycle rules here (requires decision algorithm context that does not exist yet) |
| What belongs to future systems is named explicitly | Creates a formal list of deferred decisions that must be explicitly resolved; prevents implicit assumptions in downstream Phase 2 documents | Leaving gaps without naming them (gaps become implicit assumptions) |

---

## Kanban Update

**Card:** [Phase 2] Design Colonist Agent Model
**Status:** Accepted with minor revisions applied (architecture review 2026-07-09) — v0.2.0

**Completed:**
- ✅ design/colonist-agent-model.md — conceptual structure of the Colonist within approved scope
- ✅ Architecture review revisions applied: AQ-1 resolved (Colonist owns Skills / Policies own permissions / Tasks own requirements); AQ-2 kept open; deferred questions renamed DQ-1 through DQ-5 with owning documents named

**This document does not:**
- Define need taxonomy, names, or formulas (ADR-17 scope)
- Define social action vocabulary (ADR-18 scope)
- Define decision algorithms, utility functions, or state machines
- Define goal stack structure or goal lifecycle rules
- Introduce data structures, classes, or TypeScript

**Open architecture question (requires explicit resolution before Phase 2 implementation):**
- AQ-2: Relationship record ownership — directional/colonist-owned vs. centralized bidirectional per pair

**Deferred questions (owned by later Phase 2 documents):**
- DQ-1: Goal stack depth and lifecycle → Goal System / Decision Loop design
- DQ-2: World state snapshot content → Decision Loop design
- DQ-3: Motivation derivation vs. commitment → Goal System / Decision Loop design
- DQ-4: Trait discovery state location → player profile design (if ever proposed)
- DQ-5: Social need satisfaction model → ADR-18

**This document unblocks:**
- Phase 2 AI behavior specification (once ADR-17, ADR-18, AQ-2, and DQ-2 are resolved)
- Phase 2 relationship system implementation (once AQ-2 is resolved)
- Phase 2 maintenance model implementation (AQ-1 resolved — skill/permission/requirement boundary defined)
- Inspector UI design (once trait discovery state presentation is confirmed with DQ-4 context)

**Does not block:**
- design/station-design.md
- design/crisis-design.md
- design/policy-design.md
- ADR-17 (can proceed without this document)
- ADR-18 (can proceed without this document)
