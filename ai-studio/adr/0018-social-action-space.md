# ADR-18 — Social Action Space

**Status:** Accepted (architecture review 2026-07-09 — approved with three clarifying revisions applied: Assist voluntariness, Confrontation repair path, Shared Meal need scope)
**Date:** 2026-07-09
**Phase:** Phase 3 — first artifact (parallel with ADR-17, per Phase 2 freeze entry condition 1; ADR-17 Accepted 2026-07-09)
**Governed by:** design/phase-2-architecture-freeze.md v1.0.0 (locked decisions 15, 21, 24–27, 29 bind this ADR); ADR-01, ADR-05, ADR-08, ADR-10, ADR-12, ADR-14, ADR-16 (Accepted); ADR-17 (Accepted); design/needs-system.md v0.2.0; design/decision-loop.md v0.1.0; design/personality-traits.md v0.1.0; design/memory-system.md v0.2.0; design/colonist-agent-model.md v0.2.0
**This ADR does not contain:** implementation, algorithms, formulas, numeric values, durations, proximity ranges, animation design, or UI. It decides the conceptual social action architecture — the vocabulary and rules within which those are later set.

---

## Context

Three Phase 2 documents held the same line: no document other than ADR-18 defines social actions (needs-system B3, personality-traits B4, goal-system B5). The frozen architecture therefore contains a deliberately empty slot with fully specified edges:

- The Decision Loop's five task classes include a **social class frozen empty** ("abstract class only — no vocabulary exists yet"), and its tier-5 voluntary candidates await a social vocabulary.
- The Social need exists, escalates through stress when unmet, and is "satisfied through interaction" — but what *counts* as a crediting interaction was deferred (DQ-N6, carried by ADR-17 as DQ-17.6).
- ADR-12 defines relationship states, affinity change sources, and behavioral influence zones — but the interactions that *produce* those affinity events were never enumerated.
- ADR-16 forms Relational memories from interactions; ADR-08 counts unexpected social actions among story events; ADR-17 routed the eating-together interaction here.

Every edge is fixed; this ADR fills the slot. Its hard constraints, inherited and non-negotiable: the seven ambient states are the closed output vocabulary (locked decision #29 — social behavior expresses through Socializing, In Conflict, and the textures of the others; no eighth state); colonists perceive each other at Tier 1 only (locked decision #21 — no initiation rule may read another colonist's internals); ADR-12's affinity sources and influence zones are accepted architecture (this ADR maps onto them, adds none); modifiers bound and never veto (locked decision #25); no player channel of any kind; and no social action may be a script — everything here is candidates and weights inside the frozen decision loop.

With ADR-17 accepted, this ADR is the last gate before the AI behavior specification (locked decision #30).

---

## Decision

### D1 — Canonical social action vocabulary: six actions, a closed list

The social action space consists of exactly **six canonical actions**. The list is **closed**: adding, removing, or renaming a canonical action requires a future ADR revision — never a design-document change, a tuning action, or an implementation choice (the same closure discipline as ADR-17's taxonomy guard).

| Action | Mode (D3) | One-line definition | Ambient expression (within the seven states) |
|---|---|---|---|
| **Conversation** | Sought | Deliberate interaction with a chosen colonist during available time | Socializing |
| **Shared Downtime** | Sought | Co-located unstructured free-time presence with preferred company | Socializing (lower-intensity texture) |
| **Shared Meal** | Overlay | Eating in the company of non-hostile colonists — one act touching two needs (routed here by ADR-17 D6) | Eating, with Socializing-adjacent texture |
| **Comfort** | Sought | Attending to a colonist observably in distress (Stressed state visible at Tier 1) | Socializing (directed at the distressed colonist) |
| **Assist** | Sought | **Voluntarily** taking on or sharing a colonist's work — ADR-12's cover behavior, as an action. Assist is a tier-4/5 social choice the initiator did not have to make; normal collaborative work is not Assist (see D3) | Working (alongside or in place of the assisted colonist) |
| **Confrontation** | Encounter only | Open interpersonal friction — ADR-12's direct conflict event, as an interaction | In Conflict |

**What is deliberately not in the vocabulary** (these exist in the architecture already and are not actions):
- **Co-presence drift** — passive affinity movement from shared space and shared task completion (ADR-12's background sources). It happens *during* other behavior; nobody adopts it as a goal.
- **Avoidance** — a task-resolution and candidate weight (decision-loop §5, §9), never an action. A colonist does not adopt "avoid X"; they weigh destinations and candidates away from X.
- **Witnessing** — perception (decision-loop §1b) feeding Safety inputs (ADR-17 D9) and memory formation; not something a colonist does socially.
- **Relationship maintenance as an abstract activity** — relationships change only through the events above and ADR-12's sources; there is no generic "socialize to raise affinity" meta-action.

### D2 — Action categories: three, keyed to the architectural surfaces they touch

The six actions group into three categories, each keyed to the frozen surfaces it operates on — the category test doubles as the architecture guard, in the established pattern (trait categories, goal sources, memory types):

| Category | Actions | Keyed to |
|---|---|---|
| **Companionship** | Conversation, Shared Downtime, Shared Meal | Social need crediting (D7) + ADR-12 positive drift sources |
| **Support** | Comfort, Assist | ADR-12 mutual-support and cover-behavior zones + stress dissipation (D8) |
| **Friction** | Confrontation | ADR-12 direct-conflict source + stress accumulation + story events (ADR-08) |

A proposed social action that fits no category is proposing new architecture (a new relational channel, a new need coupling, or a new stress path) and must be raised as such.

### D3 — Two interaction modes: Sought and Encounter

**Sought interactions** are goal-driven: they enter the decision loop as candidates — tier 4 when generated by the Social need's low threshold, tier 5 as trait/relationship/memory-weighted voluntary candidates — and pass through the frozen filter-select-resolve stages like any goal. Conversation, Shared Downtime, Comfort, and Assist are sought.

**Encounter interactions** are not goals and are never adopted: they arise during execution when their conditions co-occur, in the same architectural family as condition-triggered events (ADR-02). Confrontation is encounter-only: **no colonist ever adopts "confront X" as a goal.** Conflict emerges when a negative-state pair shares space under sufficient combined stress — it is something that *happens between* two people, not something one person schedules. This is the structural guarantee that conflict remains emergent (Systems Over Scripts) and that the goal system never contains an aggression objective.

**Shared Meal is an overlay**: architecturally it is a Hunger-satisfaction task (ADR-17 D9) whose *social crediting* activates when the frozen availability conditions include non-hostile company — an interaction of satisfaction opportunity, exactly as the frozen Need Interaction section described it. The colonist adopts "eat"; the world's social context determines whether the meal also feeds Social. Task-resolution weighting (decision-loop §5 — the food station near a Bonded colleague) is what makes eating together *likely* for those who lean that way; it is never required. **Shared Meal may satisfy Hunger and Social — and never Purpose** (or any other need): the overlay's need scope is closed at those two, per ADR-17 D6's routing and its Purpose-distinctness constraint.

**Assist is voluntary social assistance — normal collaborative work is not automatically a social action.** Colonists assigned to the same task, module, or shift by policy are doing assignment work (tier 3); their collaboration produces relational consequences only through the existing ambient channels (shared task completion drift, co-presence — ADR-12's background sources) and is not an Assist action, generates no social goal, and credits no Social need through D7. Assist exists only as a tier-4/5 *choice*: the initiator was not assigned to this work and elected to take it on or share it because of who is struggling with it. The voluntariness is the social content — help that policy compelled is not help a relationship can read.

### D4 — Initiation conditions: observable state plus own records, nothing else

A sought interaction becomes an actionable candidate only when all of the following hold — and every input is either the initiator's own state or Tier-1 observable (locked decision #21; no rule below reads another colonist's internals):

1. **Opportunity** — the initiator is in a period where the candidate's tier can win the priority filter (free period for tier 5; a Social-need threshold crossing for tier 4). The filter, not this ADR, enforces this: social candidates never outrank assignments or survival (ADR-01 verbatim).
2. **Reachable partner** — a candidate partner is within perceptual range or at a reachable location known from the snapshot.
3. **Observably compatible partner state** — the partner's Tier-1 state does not preclude the action: Conversation and Shared Downtime seek colonists in interruptible states (Socializing, Resting-adjacent free presence, idle); Comfort specifically seeks the Stressed state (it is the one action *targeted by* another's visible distress); Assist seeks a colonist observably Working or Blocked on work the initiator is eligible to share (skill ∩ permission ∩ requirement applies to the assisted task — Assist never bypasses the frozen eligibility model).
4. **Relationship gate** — the initiator's own relationship record permits it: Companionship and Support actions are not initiated toward colonists the initiator holds at Hostile or Fractured. (Toward Tense, initiation is weight-suppressed but possible — reconciliation must remain reachable; a hard gate at Tense would make every negative relationship a terminal state.)
5. **Weighting** — which partner and which action, among eligible candidates, is the frozen weight composition's job: Social Disposition traits, relationship states (social gravity toward Bonded/Positive), matching Relational memories, and stress all tilt the choice (decision-loop §6, §9). This ADR adds no selection rule — the vocabulary plugs into the existing mechanism.

Encounter interactions (Confrontation) have condition-conjunctions instead of initiation: a pair whose relationship is Hostile or Fractured (in either direction), sharing a module, with combined stress past a threshold (value deferred), may trigger a Confrontation event — probabilistically via the seeded PRNG, never deterministically (a modifier that guarantees an outcome is a script; locked decision #25's spirit applies to event triggers too). Fractured pairs trigger at lower thresholds than Hostile ones, consistent with ADR-12's "active conflict behavior in proximity."

### D5 — Participation rules: the partner decides too

No colonist is commanded into an interaction — not by the player (never — B1), and not by another colonist either. Participation architecture:

- **Sought interactions are offers.** The initiator's action creates a condition the partner responds to through their own decision process: an interruption-class re-decision trigger scoped to interruptible states (an offer never interrupts a higher-tier commitment — a Working colonist mid-assignment is not re-decided by a Conversation offer; the offer simply fails as unavailable, and the initiator's task resolution seeks another partner or the goal blocks).
- **Acceptance is weighted, not rule-bound.** The partner's response composes from their own state: relationship toward the initiator, stress level, Social need, Social Disposition traits, matching memories. High stress suppresses acceptance of demanding interactions (decision-loop §7); a Solitary colonist accepts less; a Bonded initiator is accepted more.
- **Decline is a legitimate, observable outcome.** A declined offer ends the attempt — visible at Tier 1 as the brief approach-and-part texture within existing states, and explainable at Tier 3 from the decliner's decomposed weights. Declines are ADR-12 low-magnitude friction at most (within the accepted "forced proximity during mutual stress" family), never a new affinity source; a decline between Bonded colonists under visible stress is life, not betrayal.
- **Participation is symmetric in effect** (D6–D8 apply to both participants), asymmetric in role (initiator/responder), and **pairwise as the architectural unit.** Group socializing is emergent: multiple overlapping pairwise interactions in a shared space, matching ADR-12's pairwise relationship records. No group-level social entity exists in the architecture.
- **Comfort has one asymmetry:** the distressed partner's acceptance gate is widened by their own state (the Stressed state is itself the invitation), but a Comfort offer from a colonist the distressed party holds at Hostile/Fractured is declined by the same weighting as anything else — being comforted by your enemy is not a thing this architecture forces.

### D6 — Relationship effects: mapped onto ADR-12's accepted sources, adding none

Each action's affinity consequence routes through an existing ADR-12 change source — this ADR introduces **no new affinity sources** and no new magnitudes (ADR-12's qualitative Low/Medium/High stand; values remain deferred to prototype):

| Action | ADR-12 source it instantiates | Direction |
|---|---|---|
| Conversation, Shared Downtime, Shared Meal | Background positive drift / shared activity | Positive, low |
| Comfort (accepted) | Mutual support (during crisis: high) | Positive, medium — high when the distress is crisis-linked |
| Assist (accepted) | Shared task completion + cover behavior | Positive, low–medium |
| Confrontation | Direct conflict event | Negative, high |
| Declined offers | Forced-proximity friction family | Negative, low, context-dependent |

**Confrontation can never directly improve a relationship.** Its affinity effect is strictly negative — there is no "clearing the air" bonus, no cathartic reconciliation outcome, no confrontation path to higher affinity. Relationship repair happens only through *later positive social interactions*: Companionship and Support actions (and the ambient positive-drift channels) moving affinity back up over time, through ADR-12's existing sources. A pair that fought and later reconciled did so because one of them offered a conversation, a meal, or help afterward — and the other accepted. The fight is never the repair; what follows it can be.

Trait compatibility continues to modulate drift rates (ADR-12), and extended-avoidance atrophy continues to operate on pairs that never interact — both untouched. Relationship *state changes* produced by these events remain the primary story-event source (ADR-08), also untouched.

### D7 — Need interactions: what credits the Social need (resolves DQ-N6 / DQ-17.6)

- **Participation credits; opportunity alone does not.** The Social need is credited by *participating* in a Companionship or Support action with a non-hostile partner — either role, sought or overlay. Mere co-location, passive proximity, and declined offers credit nothing. (The frozen design language "satisfied by interaction opportunity" is hereby made precise: opportunity is the *availability condition* — what the player's station and policy create; participation is the *satisfaction event* — what the colonist does with it. This keeps the player's lever conditions-shaped and the colonist's satisfaction behavior-shaped.)
- **Crediting quality is relationship-modulated:** interaction with Bonded/Positive partners credits more than with Neutral ones — the same conversation means more from a friend. Magnitudes deferred.
- **Confrontation credits nothing** — hostile contact does not satisfy Social (frozen: "isolation and exclusively hostile contact do not").
- **Shared Meal credits both Hunger and Social — and never Purpose or any other need**, per its overlay definition (D3) — the one sanctioned two-need action, grounded in ADR-17 D6's routing, with its need scope closed at exactly those two.
- **Social actions never credit Purpose** (ADR-17 D6's distinctness constraint, honored from this side: Assist serves the *assisted party's* work and the *initiator's* Social/relationship surfaces — the initiator's Purpose is credited only if the assisted task itself is skill-matched completed work for them, through ADR-17 D9's ordinary inputs, not through a social bonus). Purpose remains work-derived; Social remains contact-derived.
- **Social actions never touch need levels directly** — crediting operates through each need's satisfaction conditions (ADR-17 D2: condition-gated restoration), never as a level write.

### D8 — Stress interactions: routed through the frozen §7 channels, adding none

All stress effects of social actions instantiate the Decision Loop's existing sources and reliefs — no new stress channels:

- **Companionship and Support participation** operate within the "positive social proximity" relief: Bonded/Positive company dissipates stress; an accepted Comfort is that relief in deliberate, directed form (its distinguishing property is being *aimed at* a visibly stressed colonist rather than incidental).
- **Confrontation** is an acute instance of the hostile-proximity accumulation source — a stress spike for both participants, with Stress Response traits (Resilient/Volatile) scaling each side's accumulation per the frozen trait modulation.
- **Stress gates participation both ways:** elevated stress raises the weight of relief-serving social candidates (seeking company under load) while suppressing acceptance of demanding offers (declining company under load) — both are the frozen §6/§7 mechanisms; which wins for a given colonist is their traits' business, not a rule. This tension is deliberately preserved: the stressed colonist who seeks comfort and the stressed colonist who wants to be left alone are both representable, and Social Disposition traits are what distinguish them.
- **The Stressed state's visibility is what makes Comfort possible at all** (D4.3): the perception architecture (Tier-1 only) means a colonist can respond to a colleague's distress exactly when the player can see it too — support behavior stays reconstructible.

### D9 — Memory effects: formed by the frozen ADR-16 criteria, adding none

Social interactions form memories through ADR-16's existing formation rules — this ADR adds no formation criteria, no memory types, and no impact rules:

- An interaction that **measurably changes affinity or stress** meets ADR-16's significance criteria and forms a **Relational memory** for each participant independently (impact fixed at formation, per the frozen model — the same conversation may matter differently to its two participants).
- Routine low-drift companionship mostly does *not* form memories — which is correct: memory is not the event log, and the daily texture of colony life should influence through affinity drift, not through pool entries.
- High-impact formations are the expected ones: Confrontations, Comfort during crisis (mutual support — the most durable positive relational material), a decline at a vulnerable moment.
- Formed Relational memories then influence future social behavior through the frozen person-match channel (decision-loop §8): the remembered supporter is sought, the remembered aggressor avoided — in proportion to fading influence weight, bound-never-veto, as always.

### D10 — Explainability requirements

Binding on every downstream realization of this vocabulary:

1. **Every sought interaction is a logged-capable decision:** when significant per ADR-14's criteria, the adoption carries its decomposed weights (need urgency, traits, relationship state, matching memories, stress) like any goal — "sought out Chen — Social need low, Bonded, remembers the Day 9 repair together" is the target explanation shape.
2. **Every decline is explainable from the decliner's side** at Tier 3: the offer, the response weighting, the outcome. A refusal that cannot be decomposed is disqualified (the same standard as locked decision #25's decomposability).
3. **Every Confrontation is traceable to its conjunction:** the relationship state, the stress levels, the shared space — "In Conflict: Fractured relationship, both past stress threshold, assigned to the same module" is a complete, true answer. No conflict may occur whose conditions the inspector cannot show.
4. **All ambient expression stays within the seven states** (locked decision #29): Socializing and In Conflict carry the primary social signals; Eating and Working carry the overlay/Assist textures. Any social behavior requiring an eighth state reopens ADR-05, not this ADR.
5. **Relationship consequences remain visible through the existing surfaces:** hover icons and inspector per ADR-12/ADR-05; interaction history entries per ADR-12's bounded history feeding ADR-14's tier-2 relationship log. This ADR adds content to those surfaces, never new surfaces.

### Deferred to engineering and prototype (the boundary of this ADR)

All values and calibrations inside the structures above — enumerated as deferred questions below. Binding calibration *targets* carried forward: conflict events must be exceptional punctuation, not daily noise (ADR-08's story-frequency floor and pressure modulation govern their rate-environment); social satisfaction must be achievable under a reasonable default policy without dedicated player micromanagement (the Social need is satisfiable by conditions, per the frozen P6).

---

## Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Larger vocabulary (gift-giving, gossip, rivalry, romance, mentorship...) | Richer social simulation | Each action multiplies initiation rules, weights, animations, memory patterns, and explanation templates; at 24 colonists and seven ambient states, six actions already saturate the legible expression budget. The closed list with an ADR-revision door is the same discipline that held the need taxonomy |
| Confrontation as an adoptable (sought) goal | Colonists can decide to have it out | Puts an aggression objective in the goal system: "goal: confront X" is a script, reads as premeditation, and would need its own motivation vocabulary. Emergent conflict from conditions (relationship × stress × proximity) is truer to Systems Over Scripts and matches ADR-12's proximity-based conflict language |
| Reciprocal scripted responses (offer → mandatory accept/decline animation pair) | Simpler interaction protocol | The partner's response must be their own weighted decision or participation becomes a command channel between colonists — violating the same autonomy the player is denied |
| Social need credited by proximity alone (no participation requirement) | Simpler crediting | Makes the Social need satisfiable by standing near people — the lonely-in-a-crowd colonist becomes unrepresentable, and the need stops generating any behavior beyond pathing into occupied rooms |
| Group interactions as first-class entities | Model gatherings directly | Requires group state with no architectural home (relationships are pairwise per ADR-12; memory is individual per ADR-16); overlapping pairwise interactions produce the same observable gatherings without new state |
| A generic "Socialize" super-action with parameter flavors | One action, many skins | Pushes the real vocabulary down into untyped parameters where the guard cannot see it — the closed list would be closed in name only |
| New affinity sources for social actions | Social-specific relationship mechanics | ADR-12's source table is accepted architecture and already covers every consequence this vocabulary produces; new sources would reopen ADR-12 by the back door |

---

## Consequences

- The social task class (decision-loop §5) is populated: its members are the six canonical actions, gated exactly as the class was frozen to expect.
- Tier-5 voluntary candidates now have their social vocabulary; tier-4 Social-need goals have their satisfaction tasks. The AI behavior specification is unblocked (jointly with ADR-17, per locked decision #30).
- DQ-N6 / DQ-17.6 is resolved: participation in Companionship/Support actions with non-hostile partners credits the Social need; opportunity is the availability condition, not the satisfaction event.
- The offer/response protocol adds one interruption-class nuance to the re-decision architecture: offers are re-decision triggers *only* for colonists in interruptible states — a scoping of trigger 2, not a new trigger kind (the six-trigger list stands).
- Animation/texture design inherits a bounded brief: six actions expressible through four of the seven states plus textures.
- The engineering specification inherits the pairwise-unit commitment: no group-interaction state, groups as overlapping pairs.

## Risks

- **Six actions may be too few for social texture at 24 colonists** — colonies could read as socially repetitive. *Mitigation: variety is carried by pairing, context, relationship state, and outcome — not by verb count; the vocabulary is extensible by ADR revision with prototype evidence.*
- **Offer/decline traffic could thrash re-decisions** in dense free periods (many simultaneous offers). *Mitigation: offers only trigger re-decision in interruptible states, and commitment stickiness already dampens; pacing values are deferred (DQ-18.2) with this failure mode named.*
- **Confrontation's conjunction (relationship × stress × proximity) may fire too rarely to matter or too often to stay signal** — the classic threshold risk. *Mitigation: ADR-08's floor and pressure modulation already govern the story-event rate environment; conflict thresholds tune inside it (DQ-18.3).*
- **Comfort could read as scripted altruism** if its weights are tuned too strong — every Stressed colonist instantly attended. *Mitigation: Comfort is a weighted candidate like any other (traits and relationships gate who comforts whom); bound-never-veto applies; the colonist ignored while distressed is a story the architecture must keep possible.*
- **The Shared Meal overlay creates the first two-need action** — a precedent that could invite overlay proliferation (working-together-credits-Social, resting-together, etc.). *Mitigation: overlays are vocabulary members like any action — the closed list and category guard apply; Shared Meal is in because ADR-17 explicitly routed it here, and nothing else is.*

## Dependencies

- **ADR-01** (tier structure — social candidates live at tiers 4 and 5, never above)
- **ADR-05** (seven states — the closed expression vocabulary; the Stressed state as Comfort's visible trigger)
- **ADR-08** (story events — relationship transitions and unexpected social actions; rate environment for conflict)
- **ADR-12** (relationship architecture — affinity sources, states, influence zones; this ADR instantiates, never extends)
- **ADR-14** (decision log — significance criteria and explanation surfaces for social decisions)
- **ADR-16** (memory — Relational formation criteria and influence weights; referenced, not redefined)
- **ADR-17** (Need System — Social need thresholds and crediting architecture; Shared Meal routing; Purpose distinctness)
- **design/decision-loop.md** (the frozen loop this vocabulary plugs into: candidates, weights, task resolution, re-decision triggers)
- **AQ-2** (relationship record storage — still open; gates relationship *implementation*, not this design; unchanged)

## Deferred Questions

| # | Question | Owner |
|---|---|---|
| DQ-18.1 | All crediting magnitudes, drift values, and relationship-modulated quality scaling | Prototype (within D6/D7 structure) |
| DQ-18.2 | Offer/response pacing: how often sought interactions generate, decline cooldowns, re-offer behavior | Prototype |
| DQ-18.3 | Confrontation conjunction thresholds (stress levels, Hostile vs. Fractured differentials) | Prototype (within ADR-08's rate environment) |
| DQ-18.4 | Interaction durations and their relationship to the ~20-minute-day hypothesis (ADR-06) | Prototype |
| DQ-18.5 | Proximity/perceptual operationalization for initiation and encounters | Engineering (inherits DQ-D2's resolution automatically) |
| DQ-18.6 | Per-action textures within the four expressing states — making six actions distinguishable at focus zoom | Animation/UI design (within locked decision #29) |
| DQ-18.7 | Whether Assist requires the assisted colonist's acceptance or only non-rejection | Prototype (both are within D5's weighting architecture; the difference is feel) |

## Revisit Trigger

- Prototype evidence that six actions produce socially repetitive colonies that pairing/context variety cannot fix → extend the vocabulary by ADR revision.
- Confrontation rates cannot be tuned into the exceptional-punctuation band within ADR-08's environment → revisit D4's conjunction structure.
- The offer/response protocol measurably breaks commitment stickiness (oscillation returns) → revisit D5's trigger scoping.
- Any proposal for a social behavior outside the six actions, a new affinity source, a new stress channel, or a group-level social entity → a new ADR against this one, never a silent addition.
- ADR-05's texture budget proves unable to distinguish the six actions at focus zoom → the conflict is between D1's vocabulary size and locked decision #29; resolve by ADR, cutting vocabulary before adding states.

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Six canonical actions, closed list, ADR-revision door | The smallest vocabulary that covers every frozen edge (Social crediting, cover behavior, mutual support, conflict, the routed meal overlay) while staying inside the seven-state expression budget; closure discipline proven by ADR-17's taxonomy guard | Larger vocabulary (expression and tuning saturation); generic parameterized Socialize (guard-evading) |
| Three categories keyed to architectural surfaces; category test as guard | Established pattern (traits, goal sources, memory types): a category-less proposal is new architecture made visible | Valence-based or content-based categories (describe flavor, not architecture — no guard value) |
| Two modes: Sought (goal-driven) vs. Encounter (condition-triggered); Confrontation is encounter-only | Keeps aggression out of the goal system; conflict emerges from relationship × stress × proximity conditions like every other condition-triggered event; matches ADR-12's proximity-conflict language | Adoptable confrontation goals (scripted premeditation); all-encounter socializing (Social need couldn't generate deliberate satisfaction behavior) |
| Shared Meal as the single sanctioned overlay (two-need action) | ADR-17 D6 explicitly routed it here; satisfaction-opportunity interaction was the frozen framing; one overlay with a closed-list guard prevents proliferation | No overlay (discards the routed decision); open overlay pattern (two-need actions multiply untraceably) |
| Initiation from observable state + initiator's own records only | Locked decision #21 (Tier-1-only perception) applied to social cognition; keeps every initiation reconstructible by the player | Initiation reading partner internals (telepathy; breaks perception symmetry) |
| Offers, not commands: partner responds through own weighted decision; decline is legitimate and observable | The autonomy the player is denied cannot be granted to colonists over each other; decline-ability is what makes acceptance meaningful and Solitary/high-stress colonists representable | Mandatory acceptance (inter-colonist command channel); rule-based accept/decline (scripts where weights belong) |
| Participation credits Social; opportunity alone does not; Confrontation credits nothing | Makes the frozen "interaction opportunity" language precise: opportunity = availability condition (player's lever), participation = satisfaction event (colonist's behavior); preserves lonely-in-a-crowd representability | Proximity crediting (need satisfiable by standing near people); initiation-only crediting (responders would gain nothing — asymmetric and false) |
| All relationship, stress, and memory effects route through existing ADR-12 / decision-loop §7 / ADR-16 channels — zero new sources | The frozen architecture already has every consequence surface this vocabulary needs; new channels would reopen accepted ADRs by the back door | Social-specific affinity/stress/memory mechanics (parallel systems; Systems Over Scripts violation) |
| Pairwise as the architectural unit; groups emerge as overlapping pairs | Matches ADR-12's pairwise records and ADR-16's individual memories; produces observable gatherings without group state | First-class group entities (state with no architectural home) |
| *(Review revision)* Assist clarified as voluntary social assistance — assigned collaborative work is never an Assist action | Architecture review 2026-07-09. Without it, every policy-assigned collaboration would count as social help, flooding Social crediting and relationship gains with compelled behavior — the voluntariness *is* the social content | Assignment work as automatic Assist (compelled help reads as friendship; Social becomes a by-product of scheduling) |
| *(Review revision)* Confrontation's affinity effect is strictly negative; relationship repair only through later positive interactions | Architecture review 2026-07-09. Closes the "cathartic fight" loophole — a confrontation-improves-relationships path would make conflict instrumentally attractive and untrue to ADR-12's source table; repair already has its channels (Companionship, Support, ambient drift) | Clearing-the-air positive outcomes (conflict as a repair tool; reopens ADR-12's sources by the back door) |
| *(Review revision)* Shared Meal's need scope closed at Hunger + Social — never Purpose | Architecture review 2026-07-09. Makes the overlay's bound explicit before implementation: the precedent-setting two-need action must not drift into a three-need one, and Purpose stays work-derived (ADR-17 D9's independence principle) | Open overlay scope (need-crediting drift; Purpose contamination via communal meals) |

---

## Kanban Update

**Card:** [Phase 3] ADR-18 — Social Action Space
**Status:** Accepted — architecture review 2026-07-09 approved with three clarifying revisions, all applied

**Completed:**
- ✅ ai-studio/adr/0018-social-action-space.md — the ten required definitions: closed six-action canonical vocabulary (D1); three categories keyed to architectural surfaces with guard test (D2); Sought/Encounter/Overlay modes (D3); initiation conditions under Tier-1-only perception (D4); offer/response participation rules with legitimate decline (D5); relationship effects mapped onto ADR-12's existing sources, none added (D6); need interactions resolving DQ-N6/DQ-17.6 — participation credits, opportunity avails, Purpose stays distinct (D7); stress interactions routed through frozen §7 channels, none added (D8); memory effects via ADR-16's existing formation criteria, none added (D9); binding explainability requirements (D10)

**Resolved from the Phase 2 / ADR-17 deferral ledger:**
- DQ-N6 / DQ-17.6 — Social need crediting: resolved (D7)
- Agent-model DQ-5 — Social satisfaction model completeness: resolved (D3–D7)
- DQ-D4 (social portion) — social task class members: resolved (D1 — the six actions)
- Tier-5 social candidate vocabulary: resolved (D1/D3)
- ADR-17 D6 routing (social context modulating biological satisfaction): resolved as the Shared Meal overlay (D3)

**Review revisions applied (architecture review 2026-07-09 — clarifications only, no architecture changed, no vocabulary expanded):**
- D1/D3: Assist is voluntary social assistance — normal collaborative work assigned by policy is not automatically a social action and credits nothing through D7
- D6: Confrontation can never directly improve a relationship — repair happens only through later positive social interactions via ADR-12's existing sources
- D3/D7: Shared Meal may satisfy Hunger and Social, never Purpose — the overlay's need scope is closed at those two

**Constraints honored:** No implementation, algorithms, formulas, or UI. Seven ambient states untouched (locked decision #29); Tier-1-only perception honored (locked #21); ADR-12 sources instantiated, not extended; no new needs, stress channels, memory rules, or affinity sources; no player channel; ADR-01 tiers respected (social candidates at tiers 4–5 only). No frozen decision reopened; no previous document redesigned.

**Deferred questions raised:** DQ-18.1–18.7 (prototype, engineering, animation/UI — none block review)

**This ADR unblocks (upon acceptance):**
- The AI behavior specification (locked decision #30's gate fully lifted — ADR-17 Accepted + ADR-18 accepted)
- Engineering specification of social interaction (offer/response protocol, encounter conjunctions, pairwise unit)
- Animation/texture design brief for the six actions (DQ-18.6)

**Follow-up (unchanged, not this ADR's):** Resolve AQ-2 before relationship implementation; ADR-19 (Colonist Arrival System) remains a candidate.

**Not committed** per instruction.
