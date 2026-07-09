# Memory System

**Version:** 0.2.0 (architecture review clarification applied: AQ-M1 resolved — ambient invisibility with explanation-surface visibility)
**Phase:** Phase 2 — Design
**Authority:** ADR-16 (Colonist Memory Architecture, Accepted) — the governing architecture for this document; ADR-08, ADR-10, ADR-12, ADR-14 (Accepted); design/colonist-agent-model.md v0.2.0, design/needs-system.md v0.2.0, design/personality-traits.md, design/goal-system.md (Approved)
**Scope:** Conceptual definition of the Memory System — what memory is, what kinds exist, the life of a memory, and how memory reaches the player.

**This document does not define:** algorithms, storage, serialization, pool sizes, decay rates, impact calibration values, or code. It operates entirely within ADR-16; nothing here reopens an accepted decision.

---

## What Memory Is

Memory is how a colonist's past stays present in their behavior.

Without memory, a colonist is stateless — they respond to this tick's conditions and nothing else. The crisis they survived last month, the colleague who covered for them, the winter of short rations: gone the moment the conditions passed. A stateless colonist can be read but never *known*, because there is nothing persistent to know. Culture is impossible; every story evaporates as it ends.

With memory, a colonist accumulates. Each significant experience — an event that measurably changed their affinity with someone, their stress, their need state, or their behavior (ADR-16's significance definition) — enters a bounded episodic pool and, from there, quietly tilts how this person responds to everything that comes after. The colonist who lived through deprivation leans toward resource security. The pair who held a module together through a cascade drift toward each other for weeks afterward. The engineer who was overloaded in the last crisis frays faster when the workload pattern repeats.

Three properties define memory, all settled by ADR-16 and inherited here as hard constraints:

**Memory influences; it never drives.** A memory is a weight modifier on the systems that produce behavior — it adjusts probabilities and thresholds, exactly as traits do (personality-traits.md P1). Current state (needs, shift, relationships) remains the primary behavioral input. No memory causes an action; no memory overrides ADR-01's priority order.

**Memory is bounded.** The pool holds a limited number of events. Colonists forget — and *what* they forget is governed by influence, not age: formative events persist while routine ones fade (ADR-16's eviction-by-lowest-weight, not oldest). Forgetting is not a technical compromise; it is what makes the remembered things mean something.

**Memory is not the event log.** The event log (ADR-14) is the world's permanent record, kept for the player. Memory is the colonist's fading, biased, behavioral record, kept for no one — it exists only to shape what this person does next. A colonist can have moved on from an event that the log still holds in full. The colony's history and a colonist's history are different things, and the game is truer for the difference.

---

## Types of Memory

Memory is one system — one pool, one retention model, one influence mechanism (Systems Over Scripts; the same single-system discipline as needs-system.md P1). Types are not separate subsystems: they classify what a memory is *about* and therefore *which weights it tilts*. Four types cover the influence surfaces the accepted architecture exposes.

### Type 1 — Relational Memories

Shared experience with a specific colonist: the mutual support during the crisis, the direct conflict, the covering behavior, the sustained friction of forced proximity. Relational memories carry a *who*.

*What they tilt:* affinity drift rates toward the remembered colonist (ADR-16's example: remembered positive crisis collaboration elevates drift toward that person; ADR-12's affinity sources are the events these memories record). Relational memories are the mechanism behind colony-life.md's Crisis Bond story shape — the pair who were nothing to each other before the cascade and something after it.

### Type 2 — Deprivation Memories

Lived scarcity: the period when food ran short, the stretch of shifts with no adequate rest, the days the water reclaimer limped. Deprivation memories carry a *what was missing*.

*What they tilt:* preference weights toward security in the remembered resource (ADR-16's canonical example — remembered deprivation elevates resource-security weighting in related decisions), and the registration sensitivity of the corresponding need (needs-system.md: the Safety need's crisis-exposure input runs through remembered experience).

### Type 3 — Crisis Memories

Participation in the colony's worst hours: being present, contributing, failing to contribute, witnessing (ADR-16 Phase 1 scope names crisis participation; the constitution's own example — a colonist who witnessed a colleague's death — lives here). Crisis memories carry a *what it cost*.

*What they tilt:* stress accumulation rates when the remembered conditions recur (ADR-16's overload example), Safety need inputs (needs-system.md DQ-N4 names crisis exposure via memory as a candidate input), and — because crisis participation is scored high-impact — they are the pool's most durable residents. The aftermath colony-life.md describes ("long after nominal operation, the colonists who were there still carry the event") is this type doing its work.

### Type 4 — Condition Memories

Not an event but an accumulation: the memory of a *sustained* state — chronic overwork, long-running isolation, months of stability. Condition memories carry a *how long it has been this way*.

*What they tilt:* they are the substrate for trait modifiers (ADR-10 requires memory of sustained conditions for modifier accumulation to be operational — the "Worn Down" overlay exists because the colonist remembers the grind that produced it). Personality-traits.md DQ-T4 defers the modifier taxonomy; this type is the memory-side half of that mechanism.

**The typology is closed the same way the goal-source list is closed** (goal-system.md): a proposed memory that tilts no surface the architecture exposes — affinity drift, need/stress rates and inputs, trait-modifier accumulation, decision weights — is either invalid or is proposing new architecture, and must be raised as such.

---

## Memory Lifecycle

The life of a memory, conceptually. As with the Goal System's lifecycle, this is a description of phases, not a state machine specification.

**1. Formation.**
A significant event occurs — one that measurably moved affinity, stress, a need state, or produced a behavioral override (ADR-16's four significance criteria, inherited verbatim). The event enters the colonist's pool, and its **impact is scored at formation time** based on the magnitude of what it changed: an affinity nudge is low-impact; crisis participation, significant betrayal, a bonding moment are high-impact (ADR-16). Impact is fixed at formation — the colonist does not later re-evaluate how much something mattered. What formation *records* about the event (participants, conditions, the change produced) is deferred (DQ-M2).

Formation is involuntary and universal: colonists do not choose what to remember, and no colonist opts out. Traits do not gate formation — a Resilient colonist accumulates the same crisis memory as a Volatile one; what differs is the stress the crisis produced *before* memory recorded it, and the rates their memories later modify.

**2. Influence.**
While in the pool, a memory exerts weight on the surfaces its type touches. Influence is continuous and proportional to the memory's current weight — the fresh crisis leans hard on today's decisions; the same crisis at forty days leans gently or not at all. Influence is also *silent*: the colonist's behavior shows it, but no moment announces "a memory is acting." The player reads it as drift — the pair growing closer than proximity explains, the colonist hoarding-adjacent caution that outlasts the shortage.

**3. Fading.**
Recency decays continuously; impact slows the decay (high-impact events hold influence longer — ADR-16's retention model, referenced, not redefined). A faded memory still occupies its place in the pool but approaches zero influence: present, inert, forgettable.

**4. Eviction.**
When the pool is full, the lowest-influence memory is evicted — not the oldest (ADR-16). Eviction is permanent and behavioral only: the event vanishes from the colonist, not from the world (the event log retains whatever it retained). The eviction rule is the system's signature: a colonist keeps the distant formative crisis and forgets yesterday's shared meal, which is how "personality shaped by history" emerges without any explicit personality-evolution system.

**5. Convergence** *(collective, emergent — not a phase of a single memory)*.
When several colonists carry high-impact memories of the *same* events — the crisis they were all in, the shortage they all lived — their weight modifications align, and the group behaves consistently in ways no variable tracks (ADR-16's cultural emergence). New arrivals encounter that alignment as "how this colony is." Convergence is architected in Phase 1 and surfaced to the player in Phase 2 (ADR-16 Phase 1 scope); this document adds nothing to its mechanism — only the naming of it as the lifecycle's collective horizon.

---

## Observable Player Effects

Memory reaches the player indirectly in ambient play, and directly only where the player asks for explanation. The split is the AQ-M1 resolution (below), decided by architecture review.

**Behavioral drift is the primary channel.**
ADR-16 commits memory to being "invisible to the player except through observed colonist behavior." The player sees consequences: the post-crisis pair whose closeness has no present-day cause, the colonist whose caution outlives the shortage that taught it, the veteran crew's uniform steadiness that a new arrival visibly lacks. Colony-life.md OQ-5 already asks whether this drift is legible enough to produce the "I wonder why these two are suddenly close" moment without inspector support — that open question stands, unresolved by this document.

**Explanation surfaces name memory when it mattered.**
Per the AQ-M1 resolution (below): where memory materially influenced a significant decision, the explanation surfaces — the inspector's decision detail, the decision log (ADR-14), the post-mortem — include memory as a cause factor alongside needs, stress, relationships, and traits. "Refused the double shift — stress elevated; carries the Day 12 overload" is a complete answer. Where memory did not materially influence the decision, it does not appear: the log is not a memory browser, and routine entries stay as ADR-14 defines them.

**History rhymes, and the player can hear it.**
The colony timeline (ADR-14, permanent) holds the original events; colonist behavior holds their residue. A player tracing today's oddity — why does this engineer always crack first under load? — can find the overload crisis in the timeline, months back, and connect it themselves. Memory makes the connection *true*; the timeline makes it *findable*. This is the Post-Mortem Test operating across a longer arc than any single crisis.

**Trait modifiers are memory made legible.**
The one place memory already has an agreed inspector surface: trait modifiers (visible as sub-entries under base traits, ADR-10) are produced from condition memories. When the player reads "Worn Down" under a colonist's Driven trait, they are reading the inspector-facing summary of a Type 4 memory. Personality-traits.md carries the display requirements.

> **AQ-M1 — Memory visibility in the inspector and decision log** *(RESOLVED — architecture review, accepted)*
>
> The tension between ADR-16's invisibility commitment and Principle 6's complete-explanation requirement is resolved by distinguishing **ambient play** from **explanation surfaces**:
>
> - **Memory remains invisible in normal ambient play.** It is not shown as a normal UI stat — no memory bar, no ambient memory icon, no always-on memory panel. In the moment-to-moment reading of the colony, memory reaches the player only through observed behavior, exactly as ADR-16 commits.
> - **Memory influence must be visible in explanation surfaces** — the inspector, the decision log, the post-mortem. Where the player asks *why*, memory is a possible cause factor and appears in the answer.
> - **Memory appears only when it materially influenced a significant decision.** A memory that was present but did not meaningfully tilt the decision is not listed. Explanation surfaces show causes, not contents: the player sees the memories that acted, never the pool.
> - **This does not turn memory into the event log.** The separation stands untouched: the event log records *what happened* — permanent, complete, world-owned. Memory records *what still influences the colonist* — bounded, fading, colonist-owned. An explanation surface naming a memory is reporting a live influence, not duplicating a historical record; when that memory fades or is evicted, it stops appearing in new explanations while the event log's record of the original event remains.
>
> The resolution satisfies both commitments: ADR-16's invisibility governs ambient play; Principle 6's completeness governs explanation. Decision explanations gain memory as a cause-factor category alongside needs, stress, relationship states, and active traits.

---

## System Boundaries

**B1 — Memory is not the event log.**
The full ADR-14/ADR-16 separation, inherited as a structural constraint: different purposes (behavior vs. player access), different retention (bounded decay vs. permanence for significant events), different owners (colonist vs. world). Carried forward from colonist-agent-model.md Boundary 3 and its Risk 2 — no shared write path, no dual-purpose store.

**B2 — Memory influences weights only.**
No memory causes an action, adopts a goal, or overrides a priority tier. Memory is an input to the weighting that the Decision Loop will define — never a decision-maker (the same discipline as needs-system.md P2 and personality-traits.md P1).

**B3 — This document defines no numbers.**
Pool capacity (ADR-16's 50–100 hypothesis), decay rates, impact calibration thresholds — all prototype-validated parameters under ADR-16's own revisit triggers. Referenced, never set.

**B4 — Formation criteria are ADR-16's, unextended.**
The four significance criteria are inherited verbatim. This document adds no new event class to what colonists remember; the typology classifies what ADR-16 admits, it does not admit more.

**B5 — Convergence is emergent, not a system.**
Cultural alignment arises from overlapping memory patterns; there is no culture variable, no group-memory store, no mechanism to design here. Any future document that proposes tracking culture explicitly is contradicting ADR-16 and must be raised as such.

**B6 — Storage and serialization are out of scope.**
Memory is colonist-owned long-term state and must round-trip through save/load (architecture-philosophy §5); how, is the engineering specification's problem entirely.

---

## Deferred Questions

**DQ-M1 — Pool size, decay rates, and impact calibration** *(deferred to: prototype, under ADR-16's revisit triggers)*
All numeric structure. ADR-16 owns the model and its hypotheses; the prototype validates whether colonists forget too fast, remember too uniformly, or calibrate impact too broadly (ADR-16's named risk: if most events score high-impact, memory becomes effectively permanent).

**DQ-M2 — Memory content granularity** *(deferred to: Decision Loop design / engineering specification)*
What a formed memory records: participants, location, the conditions at the time, the magnitude of change. Content determines what influence can key on (can a memory tilt behavior only toward a *person*, or also toward a *place* or a *kind of situation*?) — a question that cannot be settled before the Decision Loop defines what its weights key on.

**DQ-M3 — Materiality threshold for memory attribution** *(deferred to: Decision Loop design)*
*(Original DQ-M3 — AQ-M1's resolution — was resolved by architecture review; see Observable Player Effects. The number is reassigned to the question the resolution creates.)* AQ-M1 commits explanation surfaces to naming memory "only when it materially influenced a significant decision." What counts as *material* — the threshold below which a memory's contribution is omitted from the explanation — is a Decision Loop question, decided where the decision weights themselves are defined. The design constraint travels with it: the threshold must not be so high that memory-shaped decisions go unexplained (Principle 6) nor so low that every explanation lists the whole active pool (noise, and Risk 2's residual concern).

**DQ-M4 — Behavioral-drift legibility** *(deferred to: prototype; carries colony-life.md OQ-5)*
Whether memory-driven drift is observable enough to produce the "why are these two suddenly close" moment without inspector support. The AQ-M1 resolution provides the explanation-surface backstop for players who inspect, but ambient play carries the drift alone — this question asks whether the drift itself is legible, and only the prototype can answer it.

**DQ-M5 — Condition-memory mechanics for trait modifiers** *(deferred to: Phase 2 AI behavior specification; pairs with personality-traits.md DQ-T4)*
How sustained conditions accumulate into the memory substrate that produces and reverses trait modifiers — durations, what counts as the condition ending, how reversal tracks the memory's fade.

**DQ-M6 — Convergence surfacing in Phase 2** *(deferred to: Phase 2 scope planning, per ADR-16)*
ADR-16 architects cultural emergence in Phase 1 and defers its player-facing surfacing to Phase 2. What "surfacing" means — whether new arrivals' friction against colony norms is signal enough, or something more is shown — is unplanned and belongs to Phase 2 scope work.

---

## Risks

**Risk 1: Memory works and nobody notices**
The system's influence is deliberately quiet — weight tilts under behavior the player attributes to present causes. If drift is too subtle (DQ-M4), memory becomes an expensive invisible parameter: real simulation cost, zero experienced value, and the aftermath-carries-forward promise of colony-life.md silently unkept.
*Severity: Medium (reduced from High by the AQ-M1 resolution) — the mirror of personality-traits.md Risk 1 (too subtle reads as absent). Ambient legibility is still carried by behavior alone, but the explanation surfaces now provide the backstop: a player who wonders can always find the memory named where it acted. Mitigation: prototype evaluation must still include a memory-legibility question alongside the trait-discovery one — the backstop only helps players who inspect.*

**Risk 2: The materiality threshold is miscalibrated**
*(Rewritten after the AQ-M1 resolution — the original risk, unexplainable memory-tilted decisions, is closed: explanation surfaces now include memory as a cause factor.)* The residual risk lives in the threshold DQ-M3 defers: set too high, memory-shaped decisions still read as unexplained and the resolution is hollow; set too low, every explanation drags the colonist's active pool behind it and memory becomes a de facto UI stat through sheer noise — violating the ambient-invisibility half of the resolution from the other side.
*Severity: Medium. Mitigation: the calibration constraint is recorded in DQ-M3 and travels to the Decision Loop design; the acceptance test is Principle 6's own — the answer to "why did they do that" is complete and readable, not exhaustive.*

**Risk 3: Impact scoring flattens memory into recency**
If formation-time impact scoring is too uniform (everything medium), eviction-by-weight degenerates toward eviction-by-age, formative events wash out, and colonists become goldfish with extra steps — ADR-16's alternative-rejected "last N events" model, arrived at accidentally.
*Severity: Medium. Mitigation: ADR-16's named calibration risk, owned by DQ-M1; the acceptance test is narrative — the colonist who was in the Day 12 cascade must still visibly carry it at Day 50.*

**Risk 4: The typology gets implemented as four systems**
Same failure mode as personality-traits.md Risk 5: types are a classification of what one system's entries tilt, not four memory subsystems. Four pools, four decay models, four write paths would multiply tuning surface and violate Systems Over Scripts.
*Severity: Low. Mitigation: stated here and in B-series; the engineering specification inherits one-pool-one-model as a structural constraint.*

**Risk 5: Convergence produces monoculture**
If shared high-impact events align veteran colonists too strongly, the colony converges toward uniform behavior — erasing the individuality that traits and personal memories exist to produce, and making every long-running colony feel the same. The mechanism that creates culture can, overtuned, destroy character.
*Severity: Medium. Mitigation: individuality has independent guarantees — base traits are fixed and trait-immune to convergence, personal (non-shared) memories keep diverging, and impact scoring is individual (the same crisis marks its participants differently through their different stress and roles). Prototype watch item: veteran cohorts should behave *consistently*, not *identically*.*

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Four memory types keyed to the architecture's influence surfaces (Relational / Deprivation / Crisis / Condition) | Same discipline as personality-traits.md categories and goal-system.md sources: types map to surfaces the accepted ADRs expose (ADR-12 drift, need/stress rates, Safety inputs, ADR-10 modifier substrate); the closed typology doubles as an architecture guard | Typing by emotional valence (positive/negative — describes feeling, not influence surface; unmappable to weights); no typology (influence surfaces would be assigned ad hoc per memory, inviting scripted special cases) |
| One pool, one retention model; types are classification only | ADR-16 defines a single episodic pool; Systems Over Scripts forbids parallel subsystems for what one parameterized system covers | Per-type pools with distinct capacities/decay (four tuning surfaces; structural violation of the single-system commitment) |
| Impact fixed at formation; no retrospective re-scoring | ADR-16 sets impact "at event time"; retrospective re-scoring would make memory weight unexplainable (the answer to "why does this matter to them" would change without cause) and non-deterministic in effect | Re-evaluation of impact when related events occur (untraceable weight drift; also quietly a new mechanism ADR-16 does not contain) |
| Formation is involuntary and trait-ungated | Traits modify rates and thresholds (what an event *does* to a colonist before memory records it), not the record itself; gating formation by trait would make traits behaviors (what gets remembered) rather than parameters | Trait-gated formation ("Resilient colonists don't form crisis memories" — a script wearing a trait's name; also breaks convergence, which requires shared events to be shared) |
| AQ-M1 resolved (architecture review, accepted): memory invisible in ambient play; visible as a cause factor in explanation surfaces (inspector, decision log, post-mortem) only when it materially influenced a significant decision | Distinguishing ambient play from explanation surfaces satisfies both accepted commitments — ADR-16's invisibility governs the moment-to-moment reading of the colony; Principle 6's completeness governs the answer to "why." The memory/event-log separation is untouched: the log records what happened; memory records what still influences the colonist; an explanation names a live influence, not a historical record | Strict invisibility everywhere (permanent Principle 6 gaps — memory-tilted decisions unexplainable); memory as a normal UI stat (flattens memory into a meter; violates ADR-16's ambient commitment; invites optimization of a system meant to be lived with) |
| Convergence named as a lifecycle horizon but given no mechanism | ADR-16 is explicit that culture is emergent from memory alignment, not a tracked variable; the design contribution here is the guard (B5), not a design | Designing convergence surfacing now (Phase 2 scope per ADR-16; premature before DQ-M6) |

---

## Kanban Update

**Card:** [Phase 2] Design Memory System
**Status:** Accepted with required clarification applied (architecture review 2026-07-09) — v0.2.0

**Completed:**
- ✅ design/memory-system.md — conceptual Memory System within approved scope
- ✅ Architecture review clarification applied: AQ-M1 resolved — memory invisible in ambient play (no UI stat), visible as a cause factor in explanation surfaces (inspector, decision log, post-mortem) only when it materially influenced a significant decision; memory/event-log separation explicitly untouched. Risks 1–2 updated; DQ-M3 reassigned to the materiality threshold the resolution creates.

**This document does not:**
- Define algorithms, storage, serialization, or code
- Set pool sizes, decay rates, or impact calibration values (ADR-16 hypotheses; prototype-validated)
- Extend ADR-16's significance criteria or add new remembered event classes

**Design commitments made:**
- Four-type typology keyed to influence surfaces: Relational, Deprivation, Crisis, Condition — closed list, doubling as an architecture guard
- One pool, one retention model; types are classification, not subsystems
- Five-phase lifecycle: Formation (impact fixed at formation, involuntary, trait-ungated) → Influence → Fading → Eviction → Convergence (collective, emergent)
- Memory/event-log separation carried as structural boundary (B1)

**Architectural question — resolved:**
- AQ-M1: Resolved by architecture review — ambient invisibility / explanation-surface visibility split; memory is a possible cause factor in decision explanations, appearing only on material influence in significant decisions. Recorded in Observable Player Effects and the Decision Log.

**Deferred questions raised:**
- DQ-M1: Pool size, decay, impact calibration → prototype (ADR-16 revisit triggers)
- DQ-M2: Memory content granularity → Decision Loop design / engineering specification
- DQ-M3: Materiality threshold for memory attribution → Decision Loop design (reassigned after AQ-M1's resolution)
- DQ-M4: Behavioral-drift legibility → prototype (carries colony-life.md OQ-5)
- DQ-M5: Condition-memory mechanics for trait modifiers → AI behavior specification (pairs with personality-traits.md DQ-T4)
- DQ-M6: Convergence surfacing → Phase 2 scope planning

**This document unblocks:**
- Decision Loop design (memory's role as a weight input is bounded and typed; explanation surfaces now include memory as a cause-factor category, with the materiality threshold as DQ-M3)
- Phase 2 AI behavior specification's trait-modifier mechanics (Type 4 substrate defined conceptually; DQ-M5/DQ-T4 paired)
- Inspector / decision-log / post-mortem UI design for memory attribution (the when-and-where is decided; presentation pending)

**Follow-up tasks:** None beyond the deferred questions above.
