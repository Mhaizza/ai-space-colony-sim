# ADR-17 — Need System Architecture

**Status:** Accepted (architecture review 2026-07-09 — approved with three clarifying revisions applied: amplifier scope, Purpose independence from colony success, taxonomy closure)
**Date:** 2026-07-09
**Phase:** Phase 3 — first artifact (parallel with ADR-18, per Phase 2 freeze entry condition 1)
**Governed by:** design/phase-2-architecture-freeze.md v1.0.0 (locked decisions 6–10 bind this ADR); design/needs-system.md v0.2.0; design/decision-loop.md v0.1.0; design/colonist-agent-model.md v0.2.0; ADR-01, ADR-02, ADR-05, ADR-10, ADR-16 (Accepted)
**This ADR does not contain:** numeric values, decay formulas, threshold values, weight magnitudes, implementation types, data structures, UI design, or social action vocabulary (ADR-18 owns the last). It decides the architecture within which those are later set.

---

## Context

Phase 2 froze the conceptual Need System: five needs in two categories, two escalation paths, clock-driven decay, trait-modified rates, condition-based satisfaction, and a hard observability requirement on every need. The freeze deliberately deferred every architectural question beneath that structure to this ADR: the canonical taxonomy's formal commitment, the state model of a need, the threshold architecture, the escalation formalization, how need pressure enters the decision loop, which cross-need interactions are modeled (DQ-N2), the input sets for Purpose (DQ-N3) and Safety (DQ-N4), the trait and memory modification surfaces, and the boundary between what this ADR decides and what engineering/prototype must discover.

The Decision Loop (frozen) already names every hook this ADR must fill: need urgency is the *base* of candidate weight composition (§6), need thresholds are two of the five goal sources, satisfaction points define need-goal completion (§10), and stress dynamics consume "sustained unmet psychological needs" as their first source (§7). This ADR decides the architecture behind those hooks. It does not set their values — values are the prototype's to calibrate within the structures decided here, and locked decision #30 gates the AI behavior specification on this ADR's acceptance.

The freeze also reserved one live design decision at this ADR: the Purpose cut-option (locked decision #9 — "an unexplainable Purpose does not ship; decision point at ADR-17").

---

## Decision

### D1 — Canonical need taxonomy: the five-need taxonomy is adopted as architecture, as a closed list

Hunger, Rest (biological); Safety, Social, Purpose (psychological) — exactly as frozen (locked decision #6). This ADR promotes the design-level taxonomy to the architectural canon: **the five-need taxonomy is closed.** Adding a need, removing a need, renaming a canonical need, or recategorizing one requires a future ADR revision (a new ADR superseding this one, or a formally reviewed revision of this ADR) — never a design-document change, a tuning action, or an implementation choice. No system, document, or implementation may introduce an implicit sixth need (stress, health, oxygen, comfort, morale, or any other pressure-shaped variable that decays and demands satisfaction) without that ADR. A proposed variable that decays over time and generates behavior-seeking urgency *is* a need proposal, whatever it is named — this test is the architecture guard, in the same pattern as the trait-category and goal-source guards.

**Purpose is retained — conditionally, with the cut executed as a gate, not deferred as a hope.** Purpose enters Phase 3 carrying a binding acceptance criterion: at prototype evaluation, Purpose must demonstrably produce Tier-1-readable behavioral differences (engagement vs. going-through-the-motions textures per needs-system) *and* inspector-traceable causes from the input set in D9. If it fails either, Purpose is cut from the taxonomy by revision of this ADR before the AI behavior specification finalizes — shipping it opaque is not an option (locked decision #9). The other four needs carry no such gate; their observability is structurally simpler and already demonstrated by the frozen ambient mappings.

### D2 — Need state model: one bounded, continuous level per need per colonist

Each need is represented as a **single bounded, continuous level** owned by the colonist as short-term state (colonist-agent-model B6). Architectural properties, all binding:

- **Monotone decay:** absent satisfaction, the level moves in one direction only — toward deprivation — at a rate driven by in-game time (ADR-02). No need level improves spontaneously.
- **Condition-gated restoration:** the level is restored only while the need's satisfaction conditions hold (D9's per-need condition sets). No player action, event, trait, or memory writes a need level directly.
- **Single-valued:** no need has sub-components, multi-axis state, or hidden secondary meters. A need whose model seems to require two numbers is two needs — and the taxonomy is closed (D1).
- **Continuous underneath, categorical to the player:** the simulation holds a continuous level; the player reads discrete categories (critical / low / normal, per ADR-05 Tier 2) plus history at Tier 3. This mirrors ADR-12's accepted score→named-state pattern; the continuous layer exists for simulation smoothness, the categorical layer for legibility, and the mapping between them is exactly the threshold structure in D3.
- **Serializable and seed-independent:** need levels are pure state — save/load reproduces them exactly; nothing stochastic touches a need level (the seeded PRNG lives in goal *selection*, never in need dynamics).

### D3 — Threshold architecture: two thresholds plus a satisfaction point, asymmetric by category

Every need carries ordered reference points on its level, defined per need at baseline and trait-modified per colonist (D7):

- **Low threshold** (all five needs): crossing it generates a deferred-satisfaction goal candidate (ADR-01 tier 4). This is the "seek satisfaction at the next available moment" line.
- **Critical threshold** (biological needs only — Hunger, Rest): crossing it generates an override goal candidate (ADR-01 tier 2). **Psychological needs have no critical threshold.** This is not a tuning choice, it is category architecture (D4): there is no value a Safety, Social, or Purpose level can reach that produces a shift override.
- **Satisfaction point** (all five needs): the level at which a need-goal completes (decision-loop §10). The satisfaction point sits strictly above the low threshold — a structural hysteresis band that prevents satisfy/re-trigger oscillation at the threshold line. A colonist who eats does not stop eating at the exact hunger line that sent them to the food station.

Threshold *positions* and band widths are deferred (DQ-17.1). The ordering — critical below low below satisfaction point, per need — is architecture and is not.

### D4 — Escalation architecture: two closed paths, membership fixed by category

The frozen two-path structure (locked decision #7) is formalized:

- **Biological path:** Hunger and Rest escalate through their own thresholds — low (tier 4) then critical (tier 2). They *additionally* feed stress under sustained (not momentary) deprivation, per decision-loop §7.
- **Psychological path:** Safety, Social, and Purpose escalate **only** through stress accumulation. Their low threshold generates tier-4 candidates like any need; their chronic deprivation is a stress source; nothing else. No mechanism — trait, memory, interaction, crisis, or future system — may grant a psychological need an override channel. A design that needs "loneliness drives them from their post" must route through stress and the Stressed state, where it belongs.

Category membership is fixed with the taxonomy (D1). Moving a need between categories is a new ADR.

### D5 — Pressure architecture: urgency is a monotone function of threshold depth, and it is the base weight

**Pressure** is defined architecturally as deficit past a threshold. Its properties:

- Below the low threshold (satisfied side), a need contributes no urgency and generates no candidates.
- Past a threshold, **urgency grows monotonically with the depth of the deficit** — a need long past its line presses harder than one just across it. The growth's shape and scale are deferred (DQ-17.2); monotonicity is not.
- Urgency is computed per need, independently — needs do not share a pressure pool (cross-need influence exists only as D6 decides).
- **Urgency is the base weight** of the need's goal candidate in the decision loop's weight composition (decision-loop §6: "how far a need is past its threshold" is the base; the four modifier families tilt it). Nothing else about the need enters the composition — the need's identity, category, and history influence decisions only through this base and through the frozen modifier families.

### D6 — Cross-need interaction: one coupling modeled, the rest not (resolves DQ-N2)

Of the frozen candidate interactions (needs-system, Need Interaction section), this ADR models **exactly one** beyond the shared stress path:

- **Modeled — Rest as universal amplifier:** sustained Rest deprivation amplifies the effective urgency of the other four needs. It is the coupling with the strongest grounding and the clearest player story ("everything got worse when they stopped sleeping"), and it is one-directional and radial (Rest → others), so it cannot form a feedback loop. Amplification applies to *urgency* (D5's output), never to the underlying levels — the inspector's need history stays clean, and the amplifier's presence is itself traceable ("urgency elevated: rest-deprived"). **The amplifier may only amplify urgency that already exists.** A need on the satisfied side of its low threshold contributes zero urgency (D5), and the amplifier can never turn that zero into a positive value — Rest deprivation makes existing deficits press harder; it never manufactures a deficit where none exists. A well-fed, exhausted colonist is exhausted, not hungry. Magnitude deferred (DQ-17.3).
- **Not modeled initially — Safety suppression of Social/Purpose satisfaction:** conceptually sound, but it adds a second coupling to tune against the first, and its player story ("they can't enjoy anything because they feel unsafe") is largely delivered anyway through Safety's stress contribution. It remains a named candidate; adopting it later is a revision of this ADR (see Revisit Trigger), not a free tuning action.
- **Routed to ADR-18 — social context modulating biological satisfaction** (eating together): an interaction of satisfaction *opportunity*, owned by the action vocabulary.
- **Preserved as a constraint — Purpose/Social distinctness:** no modeled mechanism may make the well-liked-but-purposeless colonist or the indispensable-but-isolated colonist unrepresentable. This binds D9's input sets: Social inputs never credit Purpose, and Purpose inputs never credit Social.

The frozen disqualifier stands over all of it: any interaction whose effect the inspector cannot show as a legible pattern is disqualified regardless of simulation value (locked decision #10).

### D7 — Trait modification surface: rates and thresholds, bounded, category-preserving

Traits modify needs through exactly two surfaces, both per-colonist and both within ADR-10's weight-modifier architecture:

1. **Decay rates** — a Need Disposition trait scales how fast a specific need decays for this colonist (the frozen example: a Social colonist's Social need decays faster).
2. **Threshold positions** — a trait shifts where low/critical sit for this colonist (ADR-01 tier 3's own language: traits "modify the thresholds at which needs override shift").

Binding constraints, extending the decision loop's composition constraints to need dynamics:

- **Bounded, never structural:** a trait modifier scales rates and shifts thresholds within bounds; it can never zero a decay rate (no trait makes a need not exist), never remove or add a threshold, and never give a psychological need a critical threshold (D4 is trait-immune).
- **Static per colonist, dynamic only via trait modifiers:** base traits fix the colonist's need parameters at arrival; only reversible trait modifiers (ADR-10, "Worn Down") change them afterward — visible in the inspector as sub-entries, per accepted architecture.
- **Traceable:** a colonist whose need behaves differently from the baseline must show why at Tier 3 (the trait, discovered or not — undiscovered traits still show "Unknown" per ADR-10's discovery states; the *deviation* is inspectable even before the *cause* is named).

Modifier magnitudes and per-trait assignments are the canonical trait list's scope (prototype, DQ-T1) — this ADR fixes the surfaces they may touch.

### D8 — Memory modification surface: memory never touches need dynamics; it enters at two frozen points only

Memory does **not** modify need decay rates, thresholds, or levels. A remembered famine does not make a colonist hungrier. Memory's influence on need-adjacent behavior enters at exactly the two points the frozen architecture already provides:

1. **Candidate weighting** — Deprivation memories tilt the weights of need-serving candidates when the resource/need-kind matches (decision-loop §8): the colonist who remembers the shortage *acts sooner and leans harder toward securing* food — their Hunger level and thresholds are untouched; their decisions about hunger are tilted. This is the difference between changing the body and changing the person, and it keeps need history clean in the inspector.
2. **Safety inputs** — Crisis memories are an input to the Safety need's satisfaction conditions (D9): a station is harder to experience as secure while high-influence crisis memories are active. This is the one place memory reaches a need's dynamics, and it does so as a *satisfaction condition input* (what the environment must overcome), not as a decay modifier — and it fades as the memory fades (ADR-16's recency × impact, referenced not redefined).

Any future mechanism wanting memory to change need sensitivity itself (rates/thresholds) is a new architecture decision against this ADR.

### D9 — Per-need satisfaction condition sets (resolves DQ-N3, DQ-N4 at input-set level)

Each need's satisfaction conditions are a **closed input set** decided here; weights within each set are deferred (DQ-17.4). Restoration occurs only while inputs hold (D2).

| Need | Satisfaction condition inputs (closed set) |
|---|---|
| **Hunger** | Access to a functioning food station with available food supply (unchanged from frozen design) |
| **Rest** | Access to a rest area with capacity, during adequate rest time (unchanged from frozen design) |
| **Safety** | Three inputs: (1) sustained health state of the modules the colonist inhabits and works in; (2) absence of active high-influence Crisis memories (the memory channel, D8.2); (3) absence of recently *witnessed* distress — colonists in critical states or survival responses within perceptual range (decision-loop §1b makes witnessing well-defined) |
| **Social** | Opportunity for non-hostile interaction: free time, shared spaces, presence of non-Hostile/non-Fractured colonists. What *counts* as a crediting interaction is ADR-18's (DQ-N6 stands) — this ADR fixes only that the inputs are opportunity-shaped and relationship-gated |
| **Purpose** | Three inputs, chosen explainability-first per the frozen criterion: (1) **skill-matched assignment** — working tasks that use the colonist's skills (skill ∩ requirement overlap, readable from the frozen eligibility model); (2) **task completion** — actually finishing work, not merely being assigned it (a blocked or idle assignment satisfies nothing); (3) **absence of chronic idleness/misassignment** — sustained periods with no eligible work, or work far below skill, erode Purpose. All three are facts the inspector can already show (assignment, skill, completion, idleness are all existing legible state) — which is what makes this input set pass the observability gate on paper; whether it passes in *play* is the D1 gate |

Purpose inputs deliberately exclude: relationships and social standing (D6's distinctness constraint), colony-level outcomes (untraceable to the individual), and any input requiring new state invisible at Tier 3.

**Purpose is independent of overall colony success.** Purpose derives from the colonist's own meaningful contribution, skill alignment, and engagement — never from whether the colony is currently winning or losing. A colonist doing skilled, completed, needed work in a struggling colony has high Purpose; a colonist chronically idle in a thriving colony does not. This is what keeps Purpose a fact about the *person's relationship to their work* rather than a disguised colony-health meter, and it is why colony-level outcomes are excluded from the input set above.

### D10 — What remains deferred (the boundary of this ADR)

Everything numeric and everything calibrational, enumerated as this ADR's deferred questions below. The structures above are the decision; the prototype tunes inside them and may not bend them. Specifically retained as binding calibration *targets* (not values): critical overrides must be exceptional events under a reasonable default policy (needs-system Risk 3), and all rates calibrate against ADR-06's ~20-minute-day hypothesis.

---

## Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Taxonomy open to tuning-time additions | Let prototype add needs (comfort, privacy) freely | Every need multiplies tuning surface, thresholds, trait surfaces, and player tracking load at 24 colonists; an open list invites the implicit-sixth-need drift the guard in D1 exists to catch |
| Cut Purpose now | Drop the riskiest need before prototyping | The D9 input set is legible on paper — the observability failure locked decision #9 fears is an empirical question; cutting pre-emptively discards the taxonomy's deepest story generator without evidence. The gate keeps the cut executable |
| Multi-component need state (e.g., Rest = fatigue + sleep debt) | Richer physiological model | Two numbers per need doubles state, tuning, and explanation load; violates the single-valued clarity the categorical player layer depends on; nothing in the frozen design demands it |
| Critical thresholds for psychological needs at extreme values | "Breakdown" overrides for Social/Safety/Purpose | Reopens locked decision #7; produces the lonely-colonist-abandons-post behavior the frozen design explicitly rejected as implausible; breakdown behavior belongs to stress and story events (ADR-08), where it already lives |
| Model all frozen interaction candidates (full coupling matrix) | Richest simulation | Each coupling tunes against every other and against stress, memory, and trait rates simultaneously (the freeze's named calibration-interdependence risk); starting maximal makes the prototype's first-order questions unanswerable. One radial, loop-free coupling is the largest set with a bounded tuning story |
| Model no interactions beyond the stress path | Simplest possible system | Legitimate per the frozen design, but forfeits the highest-value coupling; Rest-amplification is cheap (one-directional, loop-free, urgency-level) and carries the clearest teaching moment. If even one coupling proves untunable, dropping to zero is a bounded revision |
| Memory modifies need decay rates directly | "Scarred" colonists decay faster | Makes need history untraceable (levels move for reasons the need panel cannot show); duplicates what candidate-weight tilting already delivers behaviorally; violates the clean separation that keeps both the memory system and the need system explainable |
| Pressure as a shared pool (one "distress" scalar fed by all needs) | Simpler decision input | That scalar is stress, which already exists downstream; a second aggregate erases *which* need presses, breaking both the priority filter's need-specific candidates and Principle 6 |

---

## Consequences

- The Need System's engineering specification now has a complete structural contract: five closed needs, one scalar each, three ordered reference points each (two for psychological), monotone decay, condition-gated restoration, one amplifier coupling, two trait surfaces, two memory entry points, closed satisfaction input sets.
- The decision loop's base-weight hook (§6) is now defined: base weight = per-need monotone urgency, Rest-amplified. The AI behavior specification can proceed against it once ADR-18 also lands (locked decision #30).
- The prototype inherits named calibration questions instead of open design questions — every deferred item below is a value or shape inside a fixed structure.
- The Purpose gate creates a scheduled decision point at prototype evaluation with a pre-committed failure action (cut by ADR revision) — no ambiguity about who decides or what failure looks like.
- Threshold hysteresis (satisfaction point above low threshold) becomes a structural requirement on need-goal completion — the engineering spec must implement completion at the satisfaction point, not at the threshold.
- The D1 guard gives reviewers a concrete test for future feature proposals: anything decaying-and-demanding is a need proposal and must come here.

## Risks

- **The single modeled coupling may be the wrong one.** If prototype play shows Safety suppression matters more than Rest amplification, the initial choice cost a tuning cycle. *Mitigation: bounded — both candidates are named, swapping or adding is an explicit ADR revision with the evaluation evidence attached.*
- **Purpose may pass on paper and fail in play** (the gate exists because this is likely enough to plan for). *Mitigation: the gate itself; the cut is pre-authorized and pre-scoped.*
- **Hysteresis bands interact with the oscillation-prevention already in the decision loop** (commitment stickiness). Two anti-oscillation mechanisms may overlap into sluggishness — colonists who satisfy needs too thoroughly before returning to work. *Mitigation: band width is a deferred value (DQ-17.1); the prototype tunes the two mechanisms together; the structural requirement is only that the band exists.*
- **Rest amplification could flood the baseline** if tuned high — every tired colonist deviating everywhere reads as chaos, compounding needs-system Risk 3. *Mitigation: the amplifier applies to urgency, not thresholds — it cannot create critical overrides for psychological needs (D4 holds) and only accelerates, never creates, biological ones; the exceptional-overrides calibration target binds it.*
- **Witnessed-distress as a Safety input adds a perception-coupled channel** that depends on DQ-D2's perceptual bounds landing sensibly. *Mitigation: the input is defined against the frozen Tier-1-only perception model; if perceptual bounds change, this input inherits the change automatically rather than defining its own.*

## Dependencies

- **ADR-01** (thresholds and tier structure — D3/D4/D5 implement its priority architecture)
- **ADR-02** (clock-driven decay — D2)
- **ADR-05** (categorical player-facing reading — D2; observability channels for D1's gate)
- **ADR-10** (trait modifier architecture — D7)
- **ADR-16** (memory influence weights — D8; referenced, not redefined)
- **ADR-18** (Social Action Space — DQ-N6 remains with it; D9's Social row is deliberately incomplete without it; no blocking dependency in either direction, per the freeze's parallel sequencing)
- **design/phase-2-architecture-freeze.md** (locked decisions 6–10, 25, 30 bind this ADR's scope)

## Deferred Questions

| # | Question | Owner |
|---|---|---|
| DQ-17.1 | Threshold positions and hysteresis band widths per need | Prototype (within D3's ordering) |
| DQ-17.2 | Urgency growth shape and scale per need | Prototype (within D5's monotonicity) |
| DQ-17.3 | Rest-amplifier magnitude and the "sustained" qualifier's operational definition | Prototype (within D6's urgency-only constraint) |
| DQ-17.4 | Weights within each D9 satisfaction input set; restoration rates | Prototype |
| DQ-17.5 | Decay rates per need; trait modifier magnitudes and bounds | Prototype + canonical trait list (DQ-T1) |
| DQ-17.6 | What interaction credits the Social need (carries DQ-N6) | **ADR-18** |
| DQ-17.7 | Purpose gate evaluation protocol — how the prototype demonstrates Tier-1 readability | Prototype evaluation design (the criterion is fixed in D1; the test procedure is not) |

## Revisit Trigger

- The Purpose gate fires (D1): Purpose cannot demonstrate Tier-1-readable behavior or traceable causes at prototype evaluation → revise this ADR to cut Purpose.
- Prototype evidence that the interaction set is wrong: Rest amplification proves untunable, or its absence of Safety-suppression produces visible implausibility → revise D6 with evidence attached.
- Critical overrides cannot be made exceptional under any reasonable threshold placement (needs-system Risk 3 materializes structurally, not just numerically) → the two-threshold architecture itself needs review.
- Any proposal for a decaying, satisfaction-demanding variable outside the five needs → new ADR against D1, never a silent addition.
- ADR-18's action vocabulary proves incompatible with D9's opportunity-shaped Social inputs → reconcile by revising whichever ADR the evidence indicts.

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Five-need taxonomy promoted to closed architectural canon with an explicit "decays-and-demands = need proposal" guard | The frozen taxonomy needs an enforcement test, not just a list; the guard pattern is already proven (trait categories, goal sources) | Open list (drift); guard-less list (implicit sixth needs arrive as "systems") |
| Purpose retained behind a binding prototype gate with pre-committed cut action | The freeze reserved the cut decision here; the D9 input set is legible on paper, so cutting without play evidence is premature — but the failure mode is likely enough that the cut must be pre-authorized, not re-debated later | Cut now (discards evidence-gathering); retain unconditionally (locked decision #9 forbids shipping it opaque) |
| One scalar per need; continuous under categorical | Single-valued state keeps decay, thresholds, explanation, and serialization simple; the score→named-state pattern is accepted architecture (ADR-12) | Multi-component needs; purely discrete levels (stepped, arbitrary-feeling transitions) |
| Satisfaction point strictly above low threshold (structural hysteresis) | Completion at the trigger line guarantees satisfy/re-trigger oscillation; the frozen completion criterion ("restored past its satisfaction point") already implies the band — this ADR makes it binding | No hysteresis (oscillation); hysteresis as optional tuning (structure this load-bearing must not be optional) |
| Psychological needs structurally cannot reach critical — no value, trait, or memory grants it | Category architecture, not tuning: the frozen two-path decision must be unbreakable by any modifier, or it will erode through the largest-magnitude trait someone eventually writes | Extreme-value psychological overrides; trait-grantable overrides |
| Exactly one cross-need coupling (Rest amplifier), urgency-level, radial | Largest interaction set with a bounded tuning story and zero feedback-loop risk; urgency-level application keeps need histories clean and the amplifier itself traceable | Full coupling matrix (untunable first prototype); zero couplings (forfeits the clearest teaching interaction); level-level amplification (dirties need history) |
| Trait surface = rates + thresholds only; memory surface = candidate weights + Safety inputs only | Two systems, two narrow doors: every other path from traits/memory to needs is closed, which is what keeps a need's history explainable by exactly three things — time, conditions, and named modifiers | Traits touching satisfaction inputs; memory touching decay rates ("scarred" colonists — untraceable) |
| Purpose inputs = skill-match + completion + non-idleness; relationship and colony-level inputs excluded | All three are already-legible inspector facts (explainability-first, per the frozen criterion); exclusions enforce Purpose/Social distinctness and individual traceability | Social-standing inputs (collapses distinctness); colony-outcome inputs (untraceable to the person) |
| Safety inputs = inhabited-module health + crisis-memory channel + witnessed distress | Matches the frozen candidate set; witnessing is well-defined under Tier-1-only perception; the memory channel gives Safety its designed long-tail ("weeks after the crisis") without touching decay rates | Global station-health input (ignores spatial honesty); no memory channel (Safety loses its defining persistence) |
| *(Review revision)* Amplifier scope clarified: Rest amplification acts only on existing urgency; it can never create urgency for a satisfied need | Architecture review 2026-07-09. Closes an interpretation gap in D6 — without it, an implementation could read "universal amplifier" as licensing manufactured deficits ("exhausted therefore hungry"), which would dirty need traceability | Amplifier as urgency *source* (turns Rest into a hidden feeder of all needs — untraceable) |
| *(Review revision)* Purpose explicitly decoupled from colony success: derived from meaningful contribution, skill alignment, and engagement only | Architecture review 2026-07-09. Makes the existing colony-outcome exclusion an explicit principle — Purpose is the person's relationship to their work, not a disguised colony-health meter; struggling-colony/high-Purpose and thriving-colony/low-Purpose must both be representable | Colony-success input to Purpose (untraceable to the individual; collapses story space) |
| *(Review revision)* Taxonomy guard strengthened: the five-need taxonomy is explicitly closed; adding, removing, or renaming a canonical need requires a future ADR revision | Architecture review 2026-07-09. Names *renaming* alongside adding/removing and states the change vehicle explicitly, so the closure cannot be routed around via design docs, tuning, or implementation | Implicit closure only (leaves renaming and the change process arguable) |

---

## Kanban Update

**Card:** [Phase 3] ADR-17 — Need System Architecture
**Status:** Accepted — architecture review 2026-07-09 approved with three clarifying revisions, all applied

**Completed:**
- ✅ ai-studio/adr/0017-need-system-architecture.md — the ten required decisions (D1–D10): closed canonical taxonomy with architecture guard; single-scalar bounded state model; two-threshold-plus-satisfaction-point architecture with structural hysteresis; formalized two-path escalation (psychological override structurally impossible); monotone-urgency pressure model wired to the decision loop's base weight; goal influence via the frozen five-source structure; stress interaction per frozen §7 with DQ-N2 resolved (one coupling: Rest amplifier); trait surface (rates + thresholds, bounded); memory surface (candidate weights + Safety inputs only); full deferral boundary (DQ-17.1–17.7)

**Resolved from the Phase 2 deferral ledger:**
- DQ-N1 — structure decided; values → DQ-17.1/17.2/17.5 (prototype)
- DQ-N2 — resolved: Rest amplifier modeled; Safety suppression named-but-not-modeled; social-context routed to ADR-18
- DQ-N3 — resolved at input-set level (skill-match, completion, non-idleness); Purpose gate defined
- DQ-N4 — resolved at input-set level (module health, crisis memories, witnessed distress)
- DQ-G5 (need portion) / DQ-D1 (need portion) — structural homes assigned; values deferred to prototype

**Remains open (not this ADR's):**
- DQ-N6 / DQ-17.6 — Social crediting → ADR-18
- DQ-N5 — player-facing vocabulary → UI design

**Review revisions applied (architecture review 2026-07-09 — clarifications only, no architecture changed):**
- D6: Rest amplifier may only amplify existing urgency; it never creates urgency for a need on the satisfied side of its low threshold
- D9: Purpose is independent of overall colony success — derived from meaningful contribution, skill alignment, and engagement, not from winning or losing
- D1: taxonomy closure made explicit — five needs, closed; adding, removing, or renaming a canonical need requires a future ADR revision

**Constraints honored:** No numeric values, no formulas, no implementation types, no UI, no social action vocabulary. No frozen decision reopened; taxonomy unchanged. ADR file placed per ai-studio/adr/README.md convention (`0017-…`). Flag: `ai-studio/templates/adr.md` referenced by the ADR README does not exist — format matched to the accepted ADR set instead.

**This ADR unblocks (upon acceptance):**
- The AI behavior specification (jointly with ADR-18, per locked decision #30)
- Engineering specification of the Need System (complete structural contract)
- Prototype calibration work queue (DQ-17.1–17.5, 17.7)

**Not committed** per instruction.
