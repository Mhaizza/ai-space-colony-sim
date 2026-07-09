# Decision Loop

**Version:** 0.1.0
**Phase:** Phase 2 — Design
**Authority:** ADR-01 (governing priority architecture), ADR-02, ADR-05, ADR-07, ADR-08, ADR-09, ADR-10, ADR-11, ADR-12, ADR-14, ADR-15, ADR-16 (Accepted); design/colonist-agent-model.md v0.2.0, design/needs-system.md v0.2.0, design/personality-traits.md v0.1.0, design/goal-system.md v0.1.0, design/memory-system.md v0.2.0 (Approved); ai-studio/meetings/2026-07-09-decision-loop-scope.md (card scope); ai-studio/reviews/2026-07-09-adr-05-behavioral-repertoire-confirmation.md; ai-studio/reviews/2026-07-09-adr-16-visibility-clarification.md
**Scope:** The complete conceptual decision loop of a colonist — how state becomes behavior. Owns task resolution, stress dynamics, and weight composition per the card scope.
**Gates:** ADR-17 gates all numeric content; ADR-18 gates all social action vocabulary. Both gates are honored throughout: this document defines structure, never values, and treats social actions as an abstract class.

**This document does not contain:** implementation, formulas, pseudocode, algorithms, GOAP, behavior trees, state machines, or utility equations. Where the loop is described in stages, the stages are conceptual phases of a decision — not an execution algorithm, and not a prescription for how the engineering specification structures its computation.

**Architectural contradictions found during integration: none.** Every commitment below composes with the accepted ADRs and approved documents without conflict. Two prior tensions (AQ-M1; the stochastic-selection question against Principle 7) were resolved before or within this document through existing architecture — see Decision Log.

---

## 1. Inputs

A colonist decides from exactly two sources, and nothing else.

### 1a. The colonist's own model

Everything the colonist *is*: stable identity (name, base traits, skills), long-term state (memory pool, relationship records, trait modifiers), and short-term state (need levels, stress level, current goal stack) — per the approved Colonist Agent Model. The colonist's own state is directly available to its decision process; it does not arrive through the snapshot.

### 1b. The world state snapshot *(resolves colonist-agent-model.md DQ-2)*

At each decision point, the colonist reads a coherent, fixed snapshot of world state (architecture-philosophy §3). The snapshot contains:

- **Time reference** — elapsed durations relevant to the colonist: time into current shift period, time since last satisfaction of each need's serving conditions (ADR-02's shared reference; never a clock value that triggers anything).
- **The colonist's effective policy** — their shift assignment and the effective policy at their scopes, cascade-resolved (ADR-11): what the colony is currently asking of this person.
- **Relevant module and resource conditions** — the functional state, access, and resource availability of modules relevant to the colonist's candidate goals: where food is, whether the rest area has capacity, whether their assigned workstation's module is functional. Module health states are visible as conditions (a Failing module is a fact about the world); crisis *stage labels* are not in the snapshot — stages are a detection-and-player-signaling layer (ADR-15), and colonists respond to the underlying conditions, not to the label.
- **Survival conditions** — any active station-survival condition affecting the colonist (ADR-01 priority 1 inputs).
- **Nearby colonists: observable states only.** The snapshot includes the locations and Tier 1 behavioral states (ADR-05's seven) of colonists within the colonist's perceptual range. **A colonist knows about other colonists exactly what the player can see at Tier 1** — who is nearby, and what they are observably doing. It never includes another colonist's need levels, stress values, goals, or memories (colonist-agent-model.md: the source of truth for another colonist's internals is never directly accessible).

**Perception is spatially bounded.** A colonist perceives their own module and its immediately connected spaces — not the far side of the station. The exact perceptual bounds are deferred (DQ-D2); the conceptual commitment is that colonist knowledge is local, which is what makes "who witnessed the crisis" a meaningful distinction for memory formation (ADR-16) and keeps colonist behavior spatially honest.

The snapshot is fixed for the duration of one decision (Principle 7; no mid-decision reads, no live cross-agent references).

---

## 2. Decision Stages

The loop is a cycle of conceptual stages. Between decisions, the colonist is *executing*, not deciding — the loop runs at decision points, not continuously.

```
Perceive → Generate → Filter → Select → Resolve → Commit → Execute
   ↑                                                          │
   └────────────── re-decision trigger ←──────────────────────┘
```

- **Perceive** — the snapshot is taken and fixed.
- **Generate** — candidate goals arise from the five closed sources (goal-system.md): survival conditions, critical need thresholds, shift assignment, low need thresholds, trait-weighted voluntary possibilities.
- **Filter** — ADR-01's priority order eliminates all candidates below the highest tier with actionable members (§3).
- **Select** — one candidate is adopted from the winning tier by weighted selection (§4, §6).
- **Resolve** — the adopted goal finds a concrete task (§5).
- **Commit** — the goal enters the stack as active; its motivation is recorded (goal-system.md: committed at adoption); if significant, the decision is logged (ADR-14).
- **Execute** — the colonist performs the task's actions; the observable behavioral state follows.

**Re-decision is condition-triggered, never clock-triggered** (ADR-02). The loop re-enters only when one of these occurs:

1. Task or goal completion
2. A higher-priority condition appears (interruption — the active goal suspends, goal-system.md lifecycle)
3. Blockage — the current task's preconditions fail
4. A need threshold crossing (low or critical) that generates a new candidate
5. A shift boundary condition (duration elapsed AND not in a safety-critical task — ADR-02)
6. Resolution of the condition that caused a suspension (re-decision with the suspended goal as default candidate)

Between triggers, the colonist continues their current task. This **commitment stickiness** is deliberate: it is the structural answer to goal-system.md Risk 3 (oscillation). A colonist does not re-litigate their commitment every tick; they re-decide when something *happens*.

---

## 3. Priority Filtering

Inherited from ADR-01, applied verbatim, adding only the fall-through rule the goal system deferred (DQ-G4, first half):

- Candidates are grouped by tier (survival / critical need / assignment / deferred need / voluntary — goal-system.md's closed source-to-tier mapping).
- **The highest tier containing at least one actionable candidate wins.** All lower tiers are eliminated from this decision. No weight, trait, relationship, or memory ever lifts a candidate across a tier boundary (weight composition operates within tiers only — card scope constraint).
- **Actionable** means: at least one eligible, available task exists that serves the candidate (§5). A candidate with no executable task is *blocked*, not eliminated — it persists in the stack.
- **Fall-through:** if every candidate in the highest tier is blocked, selection falls to the next tier down with an actionable candidate. The blocked higher-priority goals remain in the stack, re-checked at every re-decision. If *no* tier has an actionable candidate, the colonist enters the Blocked behavioral state (ADR-05) — motionless, not resting, not on task — which is exactly the signal the player needs: this person has things to do and the world will not let them do any of it.

Tier 1 is special-cased by accepted architecture: survival candidates are adopted unconditionally, trait-immune, with no weighing of any kind (ADR-01; personality-traits.md B6).

---

## 4. Goal Selection *(resolves goal-system.md DQ-G1)*

Within the winning tier, when more than one candidate is actionable, selection is **weighted and seeded-stochastic**:

- Every candidate carries a composed weight (§6) — its urgency and appeal to *this* colonist, now.
- Selection samples among the candidates in proportion to their weights, using the save-seeded PRNG (Principle 7: the seed is save-state; identical state and seed reproduce the identical choice).
- When one candidate's weight dominates, the selection is effectively deterministic; when candidates are close, the colonist may go either way — which is not noise, it is *a person for whom it genuinely was a close call*.

**Why stochastic rather than highest-weight-wins:** ADR-10 defines traits as "probability weight modifiers," and ADR-01 tier 5 speaks of "the probability of voluntary behavioral choices." The accepted architecture's own language is probabilistic; a strict argmax would flatten probability weights into thresholds and make every colonist with the same state perfectly predictable — trait tendencies would become trait rules, which is the scripted behavior this project forbids. Determinism is preserved where it matters (Principle 7: reproducibility from state + seed), not where it would kill character (predictability of persons).

**One mechanism, all tiers** (Systems Over Scripts): tiers 2–5 all use the same weighted selection. In practice tier 2 and tier 3 usually contain a single candidate and selection is trivial; when two critical needs compete, their relative urgency dominates the weights and the outcome is near-certain. No tier gets a bespoke selection rule.

**Explainability of the stochastic step:** the explanation shows the weights and their composition — the true answer to "why did they do that" is "because, given who they are and what they carried, this is what they leaned toward, and this time they went with it." The inspector shows the leaning (the weights, decomposed); the log records the outcome. What is never shown is a fake determinism the simulation does not have.

**Ties and ordering** are broken deterministically by a fixed, stable ordering criterion — its definition is engineering scope (DQ-D3), its determinism is not negotiable.

---

## 5. Task Resolution *(resolves goal-system.md DQ-G3; owns the conceptual task vocabulary per card scope)*

An adopted goal must become a located, concrete task (glossary: duration, resource cost, skill requirements, tied to a module).

### The conceptual task classes

Tasks fall into five conceptual classes. This is a *class* vocabulary — the concrete task list within each class is engineering-and-content scope (DQ-D4):

| Class | Serves | Examples (illustrative) | Gate |
|---|---|---|---|
| **Assignment tasks** | Assignment goals (tier 3) | Work a station, perform a preventive maintenance pass (ADR-09 Tier 1) | — |
| **Satisfaction tasks** | Need goals (tiers 2, 4) | Eat at a food station, sleep in a bunk | Parameters ADR-17 |
| **Response tasks** | Survival goals (tier 1) and reactive maintenance (ADR-09 Tier 2) | Evacuate, emergency repair | — |
| **Social tasks** | Voluntary social goals (tier 5) | *(abstract class only — no vocabulary exists yet)* | **Entirely ADR-18** |
| **Transit and idle** | All goals (as connective tissue) | Move to a location; wait; unstructured free-time presence | — |

### Eligibility and availability

A task is **eligible** for a colonist when three independently-owned conditions intersect — the accepted AQ-1 resolution, now operational:

```
eligible = colonist's Skill ∩ policy Permission ∩ task Requirement
```

The colonist owns the skill; the policy system owns whether they are permitted/assigned to apply it here and now; the task owns what it demands. No system writes to another's side of the intersection.

A task is **available** when the world cooperates: the module is functional, the resource is present, capacity is not exhausted, the location is reachable. Availability is read from the snapshot.

### Selecting among tasks

When multiple eligible, available tasks serve one goal, the choice uses the same weighted selection as goal selection (§4) — one mechanism — with weights shaped by: proximity (nearer weighs more), condition quality (a Nominal module over a Warning one), and the relationship context of the destination (a satisfaction task in a module currently occupied by a Fractured-state colonist carries the avoidance weight ADR-12 defines; the food station near a Bonded colleague carries proximity preference). This is how "two colonists avoid each other" emerges from task resolution without any avoidance script.

### Task failure

A task that fails mid-execution (module goes down, resource runs out) triggers re-decision. The goal persists (blocked ≠ abandoned — goal-system.md); resolution seeks an alternative task; if none exists, the goal is blocked and fall-through applies (§3). Retry pacing is deferred (DQ-D5).

---

## 6. Weight Composition *(owns the full composition question per card scope; subsumes personality-traits.md DQ-T6)*

Every candidate's weight is composed from one base and four modifier families. This section defines the composition's *structure and constraints* — every magnitude is ADR-17/prototype scope.

### The base: current state

A candidate's base weight comes from the urgency of its source in the colonist's *current* state: how far a need is past its threshold, the presence of an active assignment, the openness of a free period. Current state is the primary input — the approved documents are unanimous that traits, relationships, and memory *influence* and never *drive* (needs-system P2, personality-traits P1, memory-system B2), and the composition preserves that hierarchy structurally: modifiers tilt the base; they do not replace it.

### The four modifier families

| Family | What it contributes | Keyed on |
|---|---|---|
| **Traits** (with active trait modifiers applied) | Stable tendencies: this colonist's standing lean toward or away from candidate kinds | The candidate's class and context (personality-traits.md's four category surfaces) |
| **Relationships** | Contextual social gravity: toward Bonded, away from Hostile/Fractured, within ADR-12's defined influence zones | The specific colonists involved in or near the candidate |
| **Memory** | The past's live influence: active memories whose context matches the candidate | Person, situation-kind, or resource-kind match (§8) |
| **Stress** | Load-dependent modulation: elevated stress raises the weight of relief-serving candidates and suppresses acceptance of demanding ones (§7) | The colonist's current stress level against their trait-set thresholds |

### Composition constraints (the design commitments)

1. **Within-tier only.** Composition never moves a candidate across an ADR-01 tier. The filter runs first; composition operates on survivors.
2. **Modifiers bound, never veto.** No single modifier — and no family — can zero a candidate's weight or guarantee its selection. A Fractured relationship makes refusal *likely*, not certain (ADR-12: "refusal probability increase"); a Driven trait makes overwork *tendential*, not scripted. Hard vetoes and guarantees are how weight modifiers degenerate into scripts.
3. **Decomposable, always.** The composed weight must be reportable as its contributions — base, traits, relationships, memory, stress — each family's contribution separately identifiable for the explanation surfaces (§11). This is the DQ-T6 traceability constraint, governing the whole composition per the card scope. A composition that produces a number nobody can decompose is disqualified regardless of its simulation quality.
4. **Order-independent (or order-fixed).** The result must not vary with the order modifiers are applied; if the engineering realization is order-sensitive, the order is fixed and documented. (Principle 7.)
5. **Trait conflicts compose as opposing tilts.** A colonist holding traits that pull opposite ways (Driven + Volatile) contributes both tilts; neither wins by rule. The composed behavior — working past the boundary *and* fraying fast — is a person under tension, readable as such in the decomposed explanation (resolves DQ-T6 conceptually: co-held traits sum as independent contributions; no meta-rule arbitrates between them).

---

## 7. Stress Interaction *(owns stress dynamics per card scope)*

Stress is the colonist's load — an emergent condition, not a need (needs-system P7), with no satisfaction action and no direct player lever.

**Accumulation — the sources (all traceable):**
- Sustained unmet psychological needs (the escalation path — needs-system.md)
- Sustained biological strain (chronic low Rest/Hunger short of critical)
- Hostile/Fractured proximity exposure (shared modules with negative-state relationships — ADR-12's "increased stress in shared spaces")
- Crisis exposure (being present where conditions are failing; witnessing colonists in distress)
- Overwork (work periods sustained beyond rest adequacy)
- Memory amplification (a remembered overload matching current workload conditions raises accumulation — ADR-16's own example)

**Dissipation — the reliefs:**
- Adequate rest (the primary recovery channel)
- Satisfied needs across the board
- Positive social proximity (Bonded colonists reduce each other's stress in shared modules — ADR-12)
- Sustained stable conditions (time under a Nominal, unthreatening environment)

**Trait modulation:** Stress Response traits (personality-traits.md Category 2) scale both accumulation and dissipation rates — Resilient accumulates slower; Volatile accumulates faster and recovers faster. Rates are ADR-17/prototype scope.

**How stress feeds back into decisions (the loop's load-bearing feedback):**
- **As a weight family (§6):** elevated stress raises relief-serving candidates' weights and suppresses the acceptance weight of demanding candidates. The constitution's own inspector example is this mechanism: *"Maya refused the oxygen repair task because her stress level exceeded her task-acceptance threshold and her current goal priority is Rest."* The threshold is trait-set; the refusal is a weight outcome, not a rule.
- **As a visibility threshold:** stress past the behavioral threshold puts the colonist in the Stressed state (ADR-05) — the internal load becomes ambient signal.
- **As capacity suppression:** high stress reduces effective task performance — the qualified engineer at 94% stress does not deliver rated maintenance capacity (ADR-09's solvability constraint depends on exactly this).
- **As memory input:** stress changes are a memory-formation significance criterion (ADR-16), so today's load becomes tomorrow's influence.

**Traceability requirement (hard):** every stress movement must be decomposable into its sources in the inspector — "stress rising: inadequate rest (3 shifts), shared module with Hostile colleague." A stress level that moves for unshowable reasons violates Principle 6 and the needs-system Risk 1 mitigation carried into this card's scope.

---

## 8. Memory Influence *(resolves memory-system.md DQ-M2 conceptually; carries DQ-M3)*

**What memory keys on** *(DQ-M2, conceptual resolution)*: a memory's influence activates when the current decision context *matches* the memory's content. Three match dimensions, one per relevant memory type:

- **Person-match** — the remembered colonist is involved in or near the candidate (Relational memories → affinity-adjacent weights)
- **Resource/need-kind match** — the candidate concerns the remembered scarcity's domain (Deprivation memories → security-leaning weights)
- **Situation-kind match** — current conditions resemble the remembered event's conditions: workload pattern, crisis character, environment state (Crisis and Condition memories → stress accumulation, Safety inputs, trait-modifier expression)

Whether *place* is an independent match dimension (the module where it happened, as such) is deferred (DQ-D6) — it may fall out of situation-matching or matter in its own right; the prototype will show which.

**How memory contributes:** as one weight family among four (§6), always proportional to the memory's current influence weight (ADR-16's recency × impact — referenced, not redefined). A fresh crisis leans hard; the same crisis at forty days leans gently. Memory never adds candidates and never vetoes them — it tilts what is already on the table.

**Materiality for explanation** *(DQ-M3, conceptual definition; operationalization deferred)*: a memory is **material** to a decision when it was *counterfactually relevant* — without its contribution, a different candidate could plausibly have won. Material memories appear in the decision's explanation surfaces, named ("carries the Day 12 overload"); immaterial ones do not, keeping ambient invisibility intact from the explanation side too (per the ADR-16 clarification record). Where the operational line sits is prototype calibration (DQ-D7), constrained both ways: no memory-shaped decision unexplained, no explanation dragging the whole pool.

---

## 9. Relationship Influence

Relationships enter the loop at four defined points — all inside ADR-12's accepted influence zones, none new:

1. **Candidate weighting (tier 5):** social gravity shapes voluntary candidates — proximity-seeking toward Bonded and Positive, avoidance of Hostile and Fractured. Who a colonist drifts toward in free time *is* this weight family at work.
2. **Task resolution (all tiers):** the relationship context of a task's destination modifies task weights (§5) — the same goal satisfied at a different station because of who is standing near the first one. Shared-task assignments with Fractured-state colleagues carry elevated refusal weight (ADR-12).
3. **Stress dynamics:** negative-state proximity accumulates stress; Bonded proximity dissipates it (§7).
4. **Covering behavior:** a Bonded colonist's difficulty (visible at Tier 1 — the snapshot shows observable states) raises the weight of support-shaped voluntary candidates (ADR-12: "increased probability of cover behavior"). The colonist who takes on a struggling friend's slack is tier-5 weighting, not altruism scripting.

Relationships never override the tier filter (a Fractured relationship does not excuse a critical need or a survival response), and relationship *changes* are outputs of the loop, not inputs to it within a single decision: interactions produced by today's behavior move affinity scores, which shape tomorrow's weights (ADR-12's sources; ADR-16's relational memories). The loop reads relationships as they are and leaves changing them to its consequences.

---

## 10. Output

One pass of the loop produces exactly three things:

1. **A commitment** — the adopted goal (with recorded motivation) and its resolved task, in the goal stack. The stack holds the active goal, any suspended goals awaiting re-decision, and queued adopted goals; stale queued goals whose motivation no longer holds are abandoned at re-decision (conceptual resolution of DQ-G2's structure; the depth bound is prototype scope, DQ-D8).
2. **Behavior** — the task's execution as observable action: one of the seven ambient states (per the 2026-07-09 ADR-05 confirmation, a fixed vocabulary), with the movement and posture textures that carry trait, stress, and Purpose legibility.
3. **A record, when significant** — a decision-log entry (ADR-14's significance criteria) carrying the committed motivation and the decomposed causes. Routine on-schedule behavior is not logged (ADR-14's exclusions stand).

**Completion criteria per goal category** *(resolves goal-system.md DQ-G5 conceptually)*: survival goals complete when the condition resolves; need goals when the need is restored past its satisfaction point (value ADR-17); assignment goals at the shift boundary condition (ADR-02); voluntary goals are opportunity-bounded — they end when the free period does, when the opportunity passes, or at any re-decision where their motivation has faded. No goal completes on a clock value.

---

## 11. Inspector Visibility

The loop is built to be opened. Its explanation surfaces, per accepted architecture plus the ADR-16 clarification:

- **Current commitment (inspector, Tier 3):** the active goal, its tier, its recorded motivation ("adopted because...") — displayed beside the always-live current state so history-plus-present reads as intended (goal-system.md Risk 2's framing requirement).
- **Decomposed causes (inspector decision detail):** the winning candidate's weight contributions by family — base urgency, traits (named as the weighting mechanism, never the cause — colonist-agent-model Boundary 4), relationships (the specific states involved), stress (with its source breakdown, §7), and memory *when material* (named event, §8).
- **The decision log (ADR-14):** significant decisions with the Why line spanning all five cause families — needs, stress, relationship states, active traits, and memory under the materiality condition (per the clarification record).
- **What is never shown:** the memory pool as a browsable list, other colonists' internals, any weight *number* the player is meant to optimize. The explanation vocabulary is causes and leanings, not arithmetic — legibility without spreadsheet play.

The loop's structural guarantee to these surfaces is constraint §6.3: decomposability is a design requirement of the composition itself, not a UI afterthought.

---

## 12. Boundaries

**B1 — No numbers.** Every rate, threshold, magnitude, bound, and calibration in this document is deferred to ADR-17 and the prototype. The gates hold.
**B2 — Social tasks are an abstract class.** Nothing here defines a social action, initiation condition, or proximity rule; the class exists so the loop's structure is complete, and ADR-18 fills it (needs-system B3, personality-traits B4, goal-system B5 — the same line, held again).
**B3 — Stages are not an algorithm.** The seven stages describe what a decision *is*; the engineering specification owns how computation is structured, ordered, and optimized — under the constraints (fixed snapshot, determinism, decomposability), not under the stage diagram.
**B4 — No new lists.** The five goal sources, four trait categories, four memory types, five task classes, and seven behavioral states are closed. This document consumed the first four and created the fifth (task classes) as its one vocabulary contribution, per its scope; extending any of them is an architecture decision.
**B5 — AQ-2 remains open.** Relationship record ownership (colonist-owned vs. centralized) is untouched here — the loop reads relationship state through the colonist's own model, per the conceptual commitment, and the storage question gates implementation only.
**B6 — No player channel.** Nothing in the loop accepts a player input. The player reaches the loop only through what the world offers it: policy (source 3), conditions (sources 1, 2, 4), and the station itself (task availability). Pillar 2, structurally enforced.
**B7 — No reopened ADRs.** Cross-tier weighing (ADR-01), clock triggers (ADR-02), an eighth state (ADR-05), emergency commands (ADR-07) — all checked against, none touched.

---

## 13. Risks

**Risk 1: Stochastic selection reads as randomness, not character**
The seeded-stochastic choice (§4) is the loop's boldest commitment. If weight spreads are poorly calibrated — too flat — colonists genuinely dither, and ADR-10's revisit trigger ("behavior the player reads as random rather than as character") fires against this document's mechanism, not just trait expression.
*Severity: High. Mitigation: the near-deterministic-when-dominant property is the design intent — close calls should be rare and meaningful, not constant. Weight-spread calibration is a first-order prototype target; the fallback position (argmax with stochastic tie-bands) is a bounded revision to §4, not an architecture change.*

**Risk 2: Decomposability is expensive and gets dropped under pressure**
Constraint §6.3 obligates the composition to be explainable at every significant decision. Implementation pressure (performance at 24 colonists × re-decision frequency) will push toward composing weights without retaining contributions.
*Severity: High. Mitigation: decomposability is a structural constraint inherited by the engineering specification, not an optimization casualty — the same enforcement posture as the memory/event-log separation. Retention can be limited to *logged* decisions if full retention is costly; that trade is engineering's, the obligation is not.*

**Risk 3: Re-decision trigger set is wrong in one of two directions**
Too few triggers and colonists ignore meaningful change (stale commitments, the goldfish's opposite); too many and commitment stickiness dissolves and oscillation returns (goal-system Risk 3).
*Severity: Medium. Mitigation: the six-trigger list (§2) is condition-typed, not rate-typed — tuning happens in threshold values (ADR-17) rather than by adding/removing trigger kinds. Prototype watch item.*

**Risk 4: The five-family explanation overwhelms the surfaces it serves**
Base + four families + stress sources + material memories is a lot of true information per decision. The explanation could be complete and unreadable — failing Principle 6's *legible* clause while satisfying its *true* clause.
*Severity: Medium. Mitigation: §11's vocabulary commitment (causes and leanings, not arithmetic) and ADR-14's natural-language templates are the instruments; the integration review's explanation-surface-load risk (Risk 5 there) already assigns the UI design this weight consciously.*

**Risk 5: Local perception produces globally stupid colonists**
Spatially bounded knowledge (§1b) means a colonist may pursue a task toward a module they cannot know has failed, or fail to react to a distant crisis the player watches in full.
*Severity: Low-Medium — and partly intended: spatial honesty is a feature (the colonist walking into bad news is legible, human, and story-productive). The genuinely unwanted cases (colonists ignoring colony-wide survival conditions) are covered by tier 1's world-level signaling, which is not perception-bounded. Perceptual bounds calibration is DQ-D2.*

**Risk 6: Weight composition becomes the de facto ADR-17**
This document holds the numbers gate, but the composition structure exerts gravity: downstream work may treat §6's families and constraints as license to start setting magnitudes in non-ADR documents.
*Severity: Low. Mitigation: B1 and the card's exit criteria; ADR-17 is the only place numbers may land, and the freeze report's ordering (ADR-17/18 before the AI behavior specification) is restated here as binding.*

---

## 14. Deferred Questions

**DQ-D1 — All magnitudes** *(→ ADR-17 and prototype)*: every weight scale, stress rate, threshold value, satisfaction point, and calibration named structurally in this document.
**DQ-D2 — Perceptual bounds** *(→ prototype, with engineering input)*: the exact spatial definition of "nearby" — module + adjacency is the conceptual commitment; the operational boundary is not.
**DQ-D3 — Deterministic tie-break ordering** *(→ engineering specification)*: the fixed, stable ordering criterion for exact-tie candidates. Its content is free; its determinism is not.
**DQ-D4 — Concrete task lists per class** *(→ engineering/content design, per class gates)*: the five classes are closed; their members are content. Social-class members are wholly ADR-18.
**DQ-D5 — Retry pacing under blockage** *(→ prototype)*: how persistently a blocked goal re-checks, and the Blocked state's onset timing.
**DQ-D6 — Place as a memory match dimension** *(→ prototype; pairs with memory-system DQ-M2's residue)*: whether location matters independently of situation-kind.
**DQ-D7 — Materiality operationalization** *(→ prototype; carries memory-system DQ-M3)*: where the counterfactual-relevance line sits in practice.
**DQ-D8 — Goal stack depth bound** *(→ prototype; closes goal-system DQ-G2's remainder)*: the stack's structure is resolved (§10); its size is a number, and numbers are gated.

**Resolved by this document** (for the record): colonist-agent-model DQ-2 (snapshot content, §1b) · goal-system DQ-G1 (§4), DQ-G3 (§5), DQ-G4 (§2–§3, §5), DQ-G5 (§10), DQ-G2's structure (§10) · personality-traits DQ-T6 (§6.5) · memory-system DQ-M2 (§8), DQ-M3's conceptual definition (§8) · stress dynamics and weight composition ownership (§7, §6, per card scope).

---

## 15. Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Within-tier selection is weighted, seeded-stochastic (one mechanism, tiers 2–5) | ADR-10's "probability weight modifiers" and ADR-01's tier-5 "probability" language are the accepted architecture's own vocabulary; argmax would collapse tendencies into rules and make identical states perfectly predictable — scripted character by arithmetic. Principle 7 is satisfied by the save-seeded PRNG (its own canonical mechanism), not by eliminating chance | Strict argmax (traits become thresholds; colonists become deterministic automata); per-tier bespoke selection rules (violates Systems Over Scripts); unseeded randomness (violates Principle 7 outright) |
| Colonists perceive other colonists at Tier 1 only — "a colonist knows what the player can see" | Preserves the no-internal-access boundary (colonist-agent-model), keeps agent knowledge and player knowledge symmetric (legibility: the player can always reconstruct what a colonist could know), and makes witnessing spatially meaningful for memory formation | Full mutual state access (hidden coupling; ordering dependencies; breaks architecture-philosophy §3); no social perception at all (covering behavior and conflict response become impossible without scripts) |
| Crisis stage labels excluded from the snapshot; colonists respond to conditions | ADR-15's stages are a detection and player-signaling layer; a colonist reacting to "Stage 3" rather than to the failing oxygen system would be reading the UI — the exact inversion of Simulation First | Stage labels as colonist inputs (colonists respond to an abstraction built for the player; violates Principle 1's spirit and reintroduces clock-trigger-like indirection) |
| Re-decision is condition-triggered from a closed six-trigger list; commitment persists between triggers | ADR-02's condition-triggered architecture applied to cognition; stickiness is the structural anti-oscillation answer (goal-system Risk 3); a closed trigger list keeps re-decision auditable | Continuous per-tick re-decision (oscillation; performance; commitments become meaningless); clock-scheduled re-decision (violates ADR-02) |
| Modifiers bound, never veto (composition constraint 2) | A modifier that can zero or guarantee an outcome is a script with extra steps; ADR-12's own language is probabilistic ("refusal probability increase"); bounded influence keeps every behavior traceable to a weighing rather than a rule | Hard vetoes (Fractured = automatic refusal — scripted); guarantee thresholds (weight past X = certain — argmax smuggled back in) |
| Trait conflicts compose as independent opposing tilts; no arbitration meta-rule (resolves DQ-T6) | A person under tension is the truthful output of conflicting tendencies; an arbitration rule would decide *for* the colonist which trait "really" governs — flattening exactly the characters worth watching. Decomposability makes the tension legible | Dominance ordering between traits (arbitrary; unexplainable); trait-pair special cases (scripts; combinatorial content burden) |
| Five conceptual task classes; the loop's one vocabulary contribution | Task resolution cannot be designed against an undefined vocabulary; classes (not lists) keep the contribution structural and gate-respecting — the social class is deliberately empty pending ADR-18 | No task vocabulary (goal→task resolution would be defined against nothing); a concrete task list (content decisions in a conceptual document; ADR-18 pre-emption) |
| Materiality = counterfactual relevance (conceptual definition) | Defines the explanation threshold without a number: a memory that could have changed the outcome is part of the true answer; one that couldn't is pool-noise. Operational line is prototype scope | Fixed contribution-percentage threshold (a number, gated); "always show top-N memories" (shows immaterial memories; makes the pool a de facto UI list against the ADR-16 clarification) |

---

## 16. Kanban Update

**Card:** [Phase 2] Design Decision Loop
**Status:** Review — Human Approval Required (Tier 3 design document; capstone of the Phase 2 conceptual set)

**Completed:**
- ✅ design/decision-loop.md — complete conceptual decision loop within the card scope (ai-studio/meetings/2026-07-09-decision-loop-scope.md); all three assigned ownerships delivered (task resolution §5, stress dynamics §7, weight composition §6); both gates (ADR-17 numeric, ADR-18 social) held throughout

**Work queue disposition (from card scope):**
- Snapshot content (DQ-2) — resolved §1b
- Within-tier selection (DQ-G1) — resolved §4
- Task resolution + vocabulary (DQ-G3, Fix 4) — resolved §5
- Interruption/blockage/re-decision (DQ-G4) — resolved §2, §3, §5
- Stack structure (DQ-G2) — structure resolved §10; depth bound deferred DQ-D8
- Completion criteria (DQ-G5) — resolved §10
- Memory content granularity (DQ-M2) — resolved §8
- Materiality threshold (DQ-M3) — conceptually defined §8; operationalization deferred DQ-D7
- Stress dynamics (Fix 5) — resolved §7
- Weight composition incl. DQ-T6 (Fix 6) — resolved §6

**Architectural contradictions found:** None. The stochastic-selection question was resolved within accepted architecture (seeded PRNG per Principle 7's own mechanism); no ADR was contradicted or reopened.

**Deferred questions raised:** DQ-D1 through DQ-D8 (all gated to ADR-17, ADR-18, prototype, or engineering — none block human review of this document)

**This document unblocks (upon approval):**
- ADR-17 — Need System Architecture (every numeric hook is now named and located)
- ADR-18 — Social Action Space (the social task class and tier-5 structure await its vocabulary)
- The Phase 2 AI behavior specification (gated on ADR-17 + ADR-18 acceptance, per the freeze report ordering restated in the card scope)
- Engineering specification of the loop (under the structural constraints: fixed snapshot, seeded determinism, decomposability, bounded modifiers)

**Follow-up tasks:**
- Resolve AQ-2 (relationship record ownership) before relationship implementation — unchanged, not touched by this document

**Not committed** per instruction.
