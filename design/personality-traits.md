# Personality Traits

**Version:** 0.1.0
**Phase:** Phase 2 — Design
**Authority:** ADR-10 (Trait System Architecture, Accepted) — the governing architecture for this document; ADR-01, ADR-05, ADR-12, ADR-16 (Accepted); design/colonist-agent-model.md v0.2.0 (Approved); design/needs-system.md v0.2.0 (Approved)
**Scope:** Conceptual definition of the Personality Trait system — what traits are, what categories they fall into, how they express to the player, and where the system's boundary lies.

**This document does not define:** the canonical trait list, weight magnitudes, formulas, decision algorithms, data structures, or TypeScript. It operates entirely within ADR-10; nothing here reopens an accepted decision.

---

## Purpose

Traits are the reason two colonists under identical conditions behave differently.

Without traits, the colony is a uniform population responding uniformly to policy — legible, but lifeless. Every colonist would deviate from the same shift at the same need threshold, accumulate stress at the same rate, and drift toward the same social behavior. The player could learn the system once and never need to learn a person.

Traits break that uniformity in a specific, disciplined way. A trait is a long-term identity modifier: a named behavioral tendency, fixed at arrival, that modifies the tendencies, priorities, and probabilities of the systems every colonist shares (ADR-10). Traits do not give a colonist different systems. They give a colonist a different relationship to the same systems — a higher threshold here, a faster drift there, a stronger pull toward one kind of voluntary behavior during free time.

The Trait System exists to do three things:

**1. Make colonists individually learnable.**
The Design Goal is explicit (vision): after an hour of play, the player should describe colonists by personality, not job title. Traits are the mechanism. Because a trait is a *tendency* — a consistent lean in how this person responds to conditions — it produces the repeated, recognizable patterns that let a player form the sentence "Maya is the one who always..."

**2. Make the same conditions produce different stories.**
The player sets one policy; twenty-four people respond to it twenty-four ways. The demanding work stance that a Driven colonist thrives under is the same stance that grinds down their Volatile module-mate. Traits are what turn policy decisions into social consequences — the intersection where the resource layer stops being solvable (ADR-09's solvability constraint depends on this).

**3. Reward observation with discovery.**
Traits are not disclosed at arrival (ADR-10). They reveal themselves through behavior under relevant conditions. The player who watches learns who their people are before the crisis; the player who does not, learns during it. Trait discovery is the observation loop's long-term payoff — the reason watching the colony keeps yielding new information for hours.

---

## Design Principles

**P1 — Traits are parameters, not behaviors.**
A trait never causes a specific action. It modifies the weights of the systems that produce actions (ADR-10; colonist-agent-model.md Boundary 4). "Resilient" is not a behavior — it is slower stress accumulation, which under pressure *produces* the observable behavior of the colonist who stays steady while others fray. The moment a trait is implemented as "if trait X, do action Y," it has become a script, and scripts are precisely what this system forbids (constitution Principle 2, anti-pattern; Principle 4).

**P2 — Traits never override the priority resolution order.**
Traits operate inside ADR-01's five-level priority structure, modifying thresholds and probabilities within it — never breaking it. A Driven colonist at critical rest need rests; the trait does not override the critical threshold (ADR-01 collision rule, verbatim). Traits make the resolution order produce individual outcomes; they do not produce exceptions to it. Station survival (priority 1) is trait-immune entirely: no trait modifies any behavior under a survival override.

**P3 — Every trait must be observable in ambient behavior.**
ADR-10's required expression rule, restated as a design commitment: every trait has at least one behavioral expression visible at Tier 1 (ADR-05) — behavior distinguishable from baseline without hover or inspection, expressed through the existing seven-state repertoire and its movement/posture textures. A trait that manifests only as a hidden simulation modifier is not a valid trait. This is the same discipline the Needs System applies to Purpose: no hidden scores without visible consequences.

**P4 — Base traits are fixed; expression is not.**
Who a colonist is does not change. How strongly that identity expresses under current conditions does. Base traits are stable identity, fixed at arrival, never modified (colonist-agent-model.md). Sustained conditions produce reversible trait modifiers — a "Worn Down" overlay that suppresses Driven's work-override tendency (ADR-10). The distinction is load-bearing for the player's model of a person: a suppressed trait is the colony acting on the colonist; it is not the colonist becoming someone else.

**P5 — Traits are discovered, never announced.**
Trait discovery state advances Unknown → Observed → Confirmed through player observation of the relevant behavioral expression (ADR-10; colonist-agent-model.md). Until observed, the inspector shows "Unknown." No mechanic discloses a trait the player has not seen expressed. Discovery only advances — a known trait stays known.

**P6 — Trait names are values-neutral.**
Trait names must not imply a correct or superior personality — the same naming discipline ADR-04 applies to policy stances. "Driven" is not better than "Steady"; "Solitary" is not a defect relative to "Social." Every trait must be an advantage under some colony conditions and a liability under others. A trait that is strictly good or strictly bad is a stat bonus wearing a name, and it flattens the personality space into an optimization problem.

**P7 — The trait vocabulary is small.**
Phase 1's tuning target stands: no more than ~10 distinct traits across the colony, 2–4 per colonist (ADR-10). A small vocabulary is what makes traits learnable — the player can hold ten tendencies in their head and recognize their expressions on sight. Categories (below) exist partly to enforce spread: a bounded list must still cover the distinct domains of colonist behavior.

---

## Trait Categories

Traits are organized by the primary behavioral domain they modify. Four categories cover the domains established by the accepted architecture. Every trait has one primary category; a trait may have secondary influence in another domain, but its defining expression — the one the player discovers it by — belongs to its primary category.

The named traits below are **illustrative, not canonical**. ADR-10 records the exact trait list as technical debt to be resolved before trait expressions are animated (freeze report §3.4). This document defines the category structure that the canonical list must fill; it does not commit the list itself (DQ-T1).

### Category 1 — Work Disposition

How a colonist relates to their work: the thresholds at which needs interrupt it, the persistence applied to blocked tasks, the tendency to extend or abandon effort at shift boundaries.

*Illustrative traits:* **Driven** (elevated tendency to continue working past low-need signals and shift boundaries; suppressible by the "Worn Down" modifier per ADR-10's own example), **Meticulous** (higher work quality tendency, slower task completion, elevated stress from interruption and from others' visible errors).

*What this category touches:* need-override thresholds within ADR-01 tiers 2 and 4; voluntary work-adjacent behavior during free time; the engagement textures the Needs System assigns to Purpose expression.

### Category 2 — Stress Response

How pressure accumulates in and dissipates from this colonist: the rates the Needs System's stress path runs at for this person, and the behavioral texture of being under load.

*Illustrative traits:* **Resilient** (slower stress accumulation — the glossary's own example; visibly calmer than peers during colony-wide stressed periods, which is exactly the trait-expression moment colony-life.md describes), **Volatile** (faster stress accumulation, earlier entry into the Stressed behavioral state, faster recovery once sources resolve — volatility is not fragility).

*What this category touches:* stress accumulation and dissipation rates; the threshold at which the Stressed state (ADR-05) becomes visible; stress contribution to relationship friction under forced proximity (ADR-12's trait-modulated negative drift).

### Category 3 — Social Disposition

How a colonist relates to other people: the weight of the Social need, the tendency to initiate or accept contact, the rates at which affinity drifts from interaction (ADR-12).

*Illustrative traits:* **Social** (higher weight on the Social need — the glossary's example; elevated initiation tendency during free time; faster positive affinity drift), **Solitary** (lower Social need weight; free time spent alone is satisfaction, not deprivation — for this colonist, the "consistently alone" signal the Needs System flags as isolation is baseline, which is precisely what makes trait discovery matter for reading it correctly).

*What this category touches:* Social need decay weight (needs-system.md P5); interaction initiation probabilities (vocabulary deferred to ADR-18); affinity drift rates and trait-compatibility modulation (ADR-12).

### Category 4 — Need Disposition

How a colonist's non-social needs decay and register: individual variation in the rates and thresholds of the Needs System's taxonomy — the body-and-mind baseline this person runs on.

*Illustrative traits:* **Restless** (faster Rest decay under idleness, slower under engaging work — rest is recovered by engagement as much as by sleep), **Wary** (Safety need decays faster after crisis exposure and recovers more slowly; elevated weight on environment-state inputs to Safety).

*What this category touches:* per-need decay rates and threshold positions (structure per needs-system.md; values per ADR-17); the inputs each need registers most strongly (e.g., Wary amplifying the crisis-exposure input to Safety).

### Category discipline

The four categories map onto the accepted architecture's modifier surfaces: ADR-01's thresholds (Work), the stress path (Stress Response), ADR-12's drift rates and the Social need (Social), and ADR-17's future rate parameters (Need). A proposed trait that fits none of these categories is modifying something the architecture does not expose as a modifier surface — which means it is either invalid or it is quietly proposing new architecture, and must be stopped and raised as such.

---

## Observable Player Effects

### The discovery arc

Traits reach the player through a three-stage arc that spans hours of play:

**Stage 1 — Pattern.** The player notices a recurring texture: this colonist always initiates contact first; that one works slightly past every shift boundary; another stays oddly steady when the module around them is fraying. At this stage the inspector still shows "Unknown" — the pattern lives only in the player's attention.

**Stage 2 — Expression.** The trait produces behavior under conditions that make it undeniable — the trait expression event (ADR-08 counts a first-time expression as a story event). The colony-wide stressed period where one colonist is visibly calmer; the refused assignment that reveals who this person will not work beside. The inspector advances to Observed. The player's guess gets a name.

**Stage 3 — Confirmation.** Repeated expression under varied conditions confirms the pattern. The trait is Confirmed; the player now *plans around it* — assigning the Resilient colonist to the high-pressure module, keeping the Volatile one off the double shift. This is the arc's payoff: discovery converts observation into policy capability.

### Where traits are visible

| Channel | What the player sees |
|---|---|
| **Tier 1 ambient (ADR-05)** | Every trait's required expression: distinguishable behavior within the seven-state repertoire — who enters Stressed first and who last, who is Socializing every free period and who never, whose Working state runs past the boundary |
| **Tier 3 inspector** | The trait list with discovery states (Unknown / Observed / Confirmed); active trait modifiers as visually distinct sub-entries under their base trait (colonist-agent-model.md Risk 3 carries the distinct-display requirement) |
| **Decision log (ADR-14)** | Trait expression events logged with the trait named as the weighting mechanism — never as a black-box cause. Per colonist-agent-model.md Boundary 4: the explanation traces to the weighted values (stress, priority, relationship); the trait is *how* they were weighted |
| **Relationship texture (ADR-12)** | Trait compatibility modulating affinity drift — the pair whose friction keeps outpacing their circumstances, the pair who bond faster than proximity alone explains |

### What trait modifiers look like

A trait modifier is the visible mark the colony leaves on a person. The player who has Confirmed a colonist's Driven trait and then watches its expression fade — the shift-boundary overruns stopping, the free-time gravitation toward the workspace going quiet — is reading a "Worn Down" modifier before ever opening the inspector. The inspector confirms: the base trait, and under it, the modifier and the sustained condition that produced it. Because modifiers are reversible (ADR-10), this is also a player lever expressed entirely through conditions: change what is wearing them down, and — slowly, visibly — the person comes back.

---

## System Boundaries

**B1 — This document does not define the canonical trait list.**
The exact traits, their names, and their per-trait expression sets are recorded technical debt (freeze report §3.4) owned by the Phase 2 AI behavior specification and validated in prototype. The categories and illustrative examples here are the frame, not the list (DQ-T1).

**B2 — This document does not define weight magnitudes.**
How much a trait shifts a threshold or a rate is a tuning decision belonging to ADR-17 (need-related magnitudes) and the AI behavior specification (decision-weight magnitudes). This document commits directions of influence only.

**B3 — Traits do not extend the observable vocabulary.**
Trait expressions live inside ADR-05's seven states and their movement/posture textures. No trait introduces a new ambient state. If the canonical trait list cannot express a proposed trait within the existing repertoire, that is an ADR-05 revisit trigger — not a license to extend it from here.

**B4 — Traits do not define social actions.**
Social Disposition traits modify the weights on interaction tendencies; the interactions themselves — their vocabulary, initiation conditions, proximity rules — are ADR-18 scope. This document must not be read as smuggling an action list through trait descriptions.

**B5 — Trait compatibility is a modifier on ADR-12, not a separate system.**
ADR-12 already owns trait-compatibility modulation of affinity drift. This document adds no compatibility matrix, no pairing rules, no formula. Which trait pairs are compatible and how strongly is deferred (DQ-T3).

**B6 — Traits are trait-immune at priority 1.**
Under a station survival override (ADR-01), all colonists behave; no trait modifies compliance, speed, or willingness. The survival tier is the one place the population is uniform by design.

**B7 — Modifier accumulation conditions are not defined here.**
Which sustained conditions produce which modifiers, over what durations, with what reversal dynamics — deferred to the AI behavior specification with ADR-16's memory architecture as the required substrate (ADR-10 names memory of sustained conditions as the mechanism).

---

## Deferred Questions

**DQ-T1 — The canonical trait list** *(deferred to: Phase 2 AI behavior specification; validated in prototype)*
The ~10 named traits, their per-trait expression sets (2–4 each per ADR-10), and their category assignments. The list must satisfy: every category populated; every trait values-neutral (P6); every trait Tier-1 expressible (P3); the full set distinct enough that 24 colonists with 2–4 traits each read as individuals.

**DQ-T2 — Trait assignment at arrival** *(deferred to: ADR-19, Colonist Arrival System)*
How a colonist's 2–4 base traits are selected at arrival: random draw under a seeded PRNG (Principle 7), constrained distribution to guarantee colony-level trait spread, or partially player-influenced through arrival choices. This shapes early-game discovery pacing and belongs to the arrival system's design.

**DQ-T3 — The trait compatibility model** *(deferred to: Phase 2 AI behavior specification, within ADR-12's architecture)*
Which trait pairings accelerate positive or negative affinity drift, and whether compatibility is pairwise-defined or derived from category relationships. ADR-12 establishes that the modulation exists; the model behind it is unresolved.

**DQ-T4 — Modifier taxonomy and accumulation conditions** *(deferred to: Phase 2 AI behavior specification)*
The set of trait modifiers (of which "Worn Down" is ADR-10's single example), the sustained conditions that produce each, duration requirements, and reversal dynamics. Requires ADR-16 memory integration and the decision-loop context to specify correctly.

**DQ-T5 — Player-facing trait vocabulary** *(deferred to: UI design; parallel to needs-system.md DQ-N5)*
Whether the inspector displays the design-level trait names directly or a player-facing variant, and how the Unknown / Observed / Confirmed states are visually communicated. The design-level names are the working vocabulary until then.

**DQ-T6 — Trait interaction within a colonist** *(deferred to: Phase 2 AI behavior specification)*
A colonist holds 2–4 traits; some combinations pull in opposite directions (Driven + Volatile: works past boundaries, frays fast). Whether co-held traits simply sum their weight modifications or require an interaction rule is a decision-architecture question. The design-level constraint from here: whatever the resolution, the combined behavior must remain traceable in the decision log — a colonist whose traits conflict should read as a person under tension, not as noise.

---

## Risks

**Risk 1: Trait expressions calibrated too subtle or too dramatic**
ADR-10's own primary risk, inherited in full: too subtle and traits feel absent (the discovery arc never starts); too dramatic and colonists feel scripted (the expression reads as a performed event, not a tendency). The calibration band is narrow and only the prototype can find it.
*Severity: High. Mitigation: ADR-10's revisit trigger stands — if players cannot identify traits through observation after an hour, or read expressions as random, the expression designs are recalibrated. The illustrative expressions in this document are candidates for exactly that testing.*

**Risk 2: The trait list drifts toward optimization labels**
Under tuning pressure, values-neutral traits erode: if Resilient is strictly better than Volatile in every colony configuration, players will roster-optimize and traits collapse into stats (P6 failure). Volatility's faster recovery, Solitary's immunity to isolation stress — the compensating edge of every trait must be real in play, not just named in design.
*Severity: Medium-High. Mitigation: DQ-T1 acceptance criterion — for each canonical trait, name the colony conditions under which it outperforms its counterpart. A trait with no such conditions is redesigned or cut.*

**Risk 3: Solitary colonists break the isolation signal**
The Needs System reads "consistently alone in free time" as the early isolation signal (colony-life.md OQ-6). A Solitary trait makes that same observable healthy baseline for some colonists — which is good design (discovery has diagnostic value) but risks teaching players to dismiss the isolation signal generally once they meet one Solitary colonist.
*Severity: Medium. Mitigation: the distinction must be inspectable — a Solitary colonist alone shows a satisfied Social need; an isolated non-Solitary colonist alone shows a decaying one. The Tier 2 hover summary carries this difference; the discovery state makes it legible.*

**Risk 4: Trait modifiers read as base-trait changes**
If the visible fading of a trait's expression is not clearly attributable to a reversible modifier, players will conclude the colonist's personality changed — breaking P4's promise and the player's trust in their own accumulated knowledge of a person.
*Severity: Medium. Mitigation: carried from colonist-agent-model.md Risk 3 — the inspector must render base trait and modifier as visually distinct layers, and the decision log should attribute affected decisions to the modifier, not the trait.*

**Risk 5: Category structure treated as implementation architecture**
The four categories are a design-organization frame. If implementation builds four separate trait subsystems around them, it violates Systems Over Scripts — there is one trait system; categories describe what a trait primarily modifies, not how it is built.
*Severity: Low. Mitigation: B-series boundaries state this; the engineering specification inherits P1 (one system, parameterized) as a structural constraint.*

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Four trait categories keyed to the architecture's modifier surfaces (Work / Stress Response / Social / Need Disposition) | Categories must map to surfaces the accepted ADRs actually expose as modifiable (ADR-01 thresholds, stress path, ADR-12 drift, ADR-17 rates); a trait outside all categories is unmodellable without new architecture — the category test doubles as an architecture guard | Categories by personality theory (e.g., five-factor model: descriptively rich but unmapped to simulation surfaces — traits would need translation anyway); no categories, flat list (no coverage discipline; a canonical list could cluster in one domain and leave colonists uniform elsewhere) |
| Named traits are illustrative; canonical list deferred (DQ-T1) | The freeze report records the exact trait list as technical debt owned downstream; committing a list here would resolve prototype-dependent decisions in a conceptual document | Committing the canonical ~10 here (pre-empts prototype validation and the AI behavior specification's expression design); no examples at all (categories without instances are untestable as a frame) |
| Every trait must be an advantage under some conditions and a liability under others (P6 as a hard criterion) | Values-neutral naming without mechanical backing is cosmetic; the criterion is what actually prevents trait-roster optimization and keeps personality a texture rather than a stat | Explicitly graded trait quality (rarity tiers, "positive/negative" traits — imports the optimization frame this game rejects) |
| Traits declared trait-immune at ADR-01 priority 1 (B6) | ADR-01's collision rule already subordinates traits to higher tiers; stating survival-tier immunity explicitly closes the one reading where a trait could produce a colonist who responds "in character" to depressurization — a scripted-feeling death | Trait-modulated survival response (produces trait-blamed deaths that read as authored; violates the uniform-override commitment of ADR-01) |
| Trait interaction within a colonist deferred with a traceability constraint attached (DQ-T6) | The resolution mechanism is decision-architecture scope, but leaving it wholly unconstrained risks an implementation where conflicting traits produce untraceable behavior — the constraint travels with the question | Resolving the interaction rule here (requires the decision-loop context this document must not contain); deferring with no constraint (Principle 6 exposure) |

---

## Kanban Update

**Card:** [Phase 2] Design Personality Traits
**Status:** Review — Human Approval Required (Tier 3 design document)

**Completed:**
- ✅ design/personality-traits.md — conceptual Personality Trait system within approved scope

**This document does not:**
- Define the canonical trait list or per-trait expression sets (Phase 2 AI behavior specification / prototype)
- Define weight magnitudes or formulas (ADR-17 / AI behavior specification)
- Define social action vocabulary (ADR-18 scope)
- Extend the ADR-05 behavioral repertoire
- Introduce data structures, classes, or TypeScript

**Design commitments made:**
- Four-category structure keyed to the architecture's modifier surfaces: Work Disposition, Stress Response, Social Disposition, Need Disposition
- Category test as architecture guard: a trait fitting no category is proposing new architecture and must be raised, not built
- P6 hardened: every trait must be an advantage under some colony conditions and a liability under others
- Traits trait-immune at ADR-01 priority 1 (station survival)

**Deferred questions raised:**
- DQ-T1: Canonical trait list → Phase 2 AI behavior specification / prototype
- DQ-T2: Trait assignment at arrival → ADR-19
- DQ-T3: Trait compatibility model → AI behavior specification (within ADR-12)
- DQ-T4: Modifier taxonomy and accumulation conditions → AI behavior specification
- DQ-T5: Player-facing trait vocabulary → UI design
- DQ-T6: Within-colonist trait interaction → AI behavior specification (traceability constraint attached)

**This document unblocks:**
- Phase 2 AI behavior specification's trait expression design (category frame and acceptance criteria defined)
- ADR-19 — Colonist Arrival System (trait assignment question formally handed off as DQ-T2)
- Inspector UI trait-display design (pending DQ-T5)

**Follow-up tasks:** None beyond the deferred questions above.
