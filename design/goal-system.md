# Goal System

**Version:** 0.1.0
**Phase:** Phase 2 — Design
**Authority:** ADR-01 (Colonist Daily Rhythm — the governing priority architecture), ADR-02, ADR-05, ADR-07, ADR-08, ADR-10, ADR-12, ADR-14, ADR-16 (Accepted); design/colonist-agent-model.md v0.2.0, design/needs-system.md v0.2.0, design/personality-traits.md (Approved); ai-studio/constitution/glossary.md
**Scope:** Conceptual definition of the Goal System — what a goal is, how it differs from its neighbors, its lifecycle, its sources, its categories, and its priority structure.

**This document does not define:** decision algorithms, utility scoring, GOAP, behavior trees, state machines, formulas, data structures, or TypeScript. The lifecycle below is a conceptual description of the phases a goal passes through — it is not a state machine specification, and the engineering representation of these phases is out of scope.

**Deferred questions resolved here:** colonist-agent-model.md DQ-1 (goal lifecycle — resolved conceptually; stack depth remains deferred) and DQ-3 (motivation — resolved: committed at adoption). Both were explicitly deferred to this document; see Design Decisions in the Decision Log.

---

## What a Goal Is

A goal is a colonist's commitment.

Needs generate pressure. Conditions create possibilities. Traits lean the colonist one way or another. But none of those is the colonist *deciding anything*. The goal is where decision enters the model: a specific, completable objective that the colonist has adopted and is now organizing their behavior around (glossary). "Eat," "complete the assigned maintenance pass on the water reclaimer," "spend free time near Sasha" — each is specific enough to pursue, bounded enough to complete, and owned by the colonist who adopted it.

A goal carries four things, all established by the accepted architecture:

- **A priority** — its tier in ADR-01's five-level resolution order. Priority is what determines whether this goal drives behavior now or waits.
- **Preconditions** — the world conditions that must hold for the goal to be pursuable (glossary). A goal whose preconditions fail is blocked, and blocked is observable (ADR-05).
- **Completion criteria** — the condition under which the goal is done and leaves the colonist's consideration (glossary).
- **A motivation** — *why* this colonist adopted this goal: the trait weights and need states that produced the commitment (glossary). The motivation is recorded at the moment of adoption and travels with the goal (see Lifecycle). It is what the decision log (ADR-14) shows the player when they ask "why did they do that?"

A goal is not visible in the world. What the player sees is its consequences: the colonist's movement, their current task, their behavioral state, and — on inspection — the goal itself, named in the inspector with its motivation attached.

---

## Goals, Needs, Tasks, and Actions

Four concepts sit in a chain, and the boundaries between them are where most conceptual errors in agent design happen. Each answers a different question.

| Concept | Question it answers | Owner | Example |
|---|---|---|---|
| **Need** | Why is there pressure? | Needs System | Rest is low and decaying |
| **Goal** | What has the colonist committed to? | Goal System (this document) | Get rest before next shift |
| **Task** | How and where, concretely? | Task structure (glossary; execution is Decision Loop scope) | SleepInBunk — bunk 4, habitation module |
| **Action** | What is the colonist observably doing this moment? | Execution layer (implementation scope) | Walking the corridor toward habitation; the Resting posture |

**A need is not a goal.** A need is a level that decays — it has no object, no completion, no commitment. Hunger does not "want food"; hunger is pressure. The goal is the colonist's response to that pressure, and it exists only once adopted. Many need states never become goals at all: a need above its low threshold generates no urgency and no goal (ADR-01).

**A goal is not a task.** The goal is the objective; the task is a concrete, located unit of work that serves it (glossary: tasks have duration, resource cost, skill requirements, and are tied to a module). One goal may be served by different tasks depending on world conditions — "eat" may resolve to a task at either of two food stations — and a task can fail (module offline, station occupied) while the goal persists and seeks another route. Collapsing goal into task is what makes agents brittle: an agent whose objective *is* the task has no way to respond intelligently when the task becomes impossible.

**A task is not an action.** The task is the unit of work; actions are its moment-to-moment execution — the walking, the postures, the animation-level activity the player actually watches. Actions are where the seven behavioral states (ADR-05) live. This document establishes the distinction and goes no further: the action layer belongs to execution design and implementation.

The chain runs in one direction: needs (and other sources) give rise to goals; goals resolve to tasks; tasks are executed as actions. The player reads it in reverse: they see actions, infer the task, and — through the inspector and decision log — can always recover the goal and the motivation behind it (Principle 6).

---

## The Lifecycle of a Goal

A goal passes through a small set of conceptual phases. This is a description of what happens to a commitment over its life, not a state machine specification.

**1. Candidate.**
Conditions produce candidate goals continuously: a need crosses its low threshold, a shift period begins, free time opens and a trait-weighted voluntary possibility presents itself. A candidate is not yet a commitment — it is an option the colonist's decision process will consider. Most candidates at any moment are not adopted. How the decision process selects among candidates is Decision Loop scope (DQ-G1).

**2. Adopted.**
The colonist commits. Two things happen at adoption, and both are design commitments of this document:

- **The motivation is recorded.** The need states, trait weights, and relationship influences that produced this adoption are captured at this moment and travel with the goal. This resolves colonist-agent-model.md DQ-3 in favor of *committed motivation*: the colonist does not continuously re-derive why they are doing what they are doing. The recorded motivation is what the decision log shows (ADR-14 logs "cause state at decision time" — adoption is that time), and it is what keeps the explanation true even when the colonist's needs have shifted mid-pursuit. Re-derivation happens only at re-decision points (interruption, blockage, completion) — not continuously.
- **The goal enters the colonist's goal stack** — the ordered set of adopted goals the colonist is managing (colonist-agent-model.md). The highest-priority actionable goal drives behavior (glossary); others wait.

**3. Active.**
The goal is driving behavior: it has resolved to a current task, and the colonist is executing. An active goal is visible in the inspector as the current goal, and its consequences are visible in the world as the colonist's behavioral state.

**4. Interrupted.**
A higher-priority condition overrides (ADR-01: the resolution order wins unconditionally). The active goal is *suspended, not destroyed*. When the interruption resolves, the colonist re-decides: the suspended goal is the default candidate for resumption, but re-decision may abandon it if conditions have changed — the shift may have ended, the need may have been satisfied along the way, the task's window may have closed. This suspend-then-re-decide model is chosen over both alternatives (hard resumption, which produces robotic returns to stale objectives; and discard-and-regenerate, which loses the commitment and makes colonists read as goldfish). ADR-02's shift-boundary behavior already embodies the pattern: the colonist mid-repair at shift end completes the repair first — the interruption negotiates with the commitment rather than deleting it.

**5. Blocked.**
The goal's preconditions fail or its task cannot be executed — resource unavailable, path unavailable, module offline. Blockage is not abandonment: the goal persists while the colonist (per Decision Loop rules, DQ-G4) retries, waits, or seeks an alternative task serving the same goal. Sustained blockage is player-visible as the Blocked behavioral state (ADR-05) — motionless, not resting, not on task — one of the seven ambient signals, and one of the most actionable: a Blocked colonist is always evidence of a world condition the player can inspect.

**6. Completed or Abandoned.**
Completion: the criteria are met; the goal leaves the stack. Abandonment: the goal's motivation no longer holds (the need was satisfied otherwise, the shift ended, the social opportunity passed) or re-decision after interruption or sustained blockage discards it. Both exits are legitimate. Abandonments that are *significant* — a colonist giving up on an assigned-work goal, a refusal — are exactly the decision-log events ADR-14 requires and the story events ADR-08 counts ("a decision-log entry inconsistent with the colonist's current assignment").

**What is not defined here:** the depth of the goal stack, queue limits, retry counts, suspension durations, and every rule governing *how* re-decision selects. Those are Decision Loop scope (DQ-G2, DQ-G4). The lifecycle phases are the conceptual commitment; their governing logic is not.

---

## Sources of Goals

Where do candidate goals come from? Conceptually, from five sources — and they map directly onto ADR-01's five priority tiers, which is not a coincidence: the priority order *is* an ordering of goal sources.

**1. Station survival conditions** *(→ ADR-01 priority 1)*
The world state signals a survival-critical condition — depressurization, oxygen failure. This source produces immediate, universal, trait-immune goals for every affected colonist (personality-traits.md B6). The colonist does not weigh these candidates; the priority order adopts them unconditionally.

**2. Critical need thresholds** *(→ ADR-01 priority 2)*
A biological need crosses critical (needs-system.md: only biological needs can). The goal generated is urgent satisfaction — adopted over any shift assignment, visible as the fast, direct override movement colony-life.md describes, with the critical icon active.

**3. Shift assignment** *(→ ADR-01 priority 3)*
Policy is a goal source. The shift skeleton (ADR-01, via ADR-04/ADR-11) continuously offers the colonist their assigned objective: work this period, rest this period. Assignment goals are the colony's ordinary texture — most adopted goals, most of the time, come from here. This is also the source the player most directly shapes: policy does not command colonists, but it defines what this source offers them (Pillar 2 — the player sets the conditions; adoption is still the colonist's).

**4. Low need thresholds** *(→ ADR-01 priority 4)*
A need crosses low but not critical. The candidate goal is deferred satisfaction — adopted to run at the shift's next available moment, producing the brief mid-shift food-station stop that reads as "the system managing itself."

**5. Trait-weighted voluntary possibilities** *(→ ADR-01 priority 5)*
During free time, or when low-priority candidates compete, the colonist's traits and relationships weight what they voluntarily do: seek company or solitude (Social Disposition traits; ADR-12 proximity preferences), gravitate toward the workspace (Driven's free-time texture), rest more. Memory tilts these weights too (ADR-16: a remembered crisis collaboration elevates drift toward that colonist). This source is where individuality is most visible — and its action vocabulary, for the social portion, remains ADR-18 scope.

No source issues commands. Every source produces *candidates*; adoption is always the colonist's decision process acting on its own state and the world snapshot (colonist-agent-model.md Boundaries 1–2). The player influences sources — policy shapes source 3 directly, station design shapes what sources 2 and 4 can resolve to, conditions shape source 1 — but no player action reaches into the candidate list itself.

---

## Goal Categories

Goals are categorized by their source tier. The category *is* the ADR-01 priority level — this document deliberately introduces no second taxonomy.

| Category | Source | Priority (ADR-01) | Typical duration | Player relationship |
|---|---|---|---|---|
| **Survival goals** | Station survival conditions | 1 — absolute | Until the condition resolves | Player prevents these by maintaining the station; cannot influence them once active |
| **Critical need goals** | Biological need at critical | 2 | Short — until satisfied | Each one is evidence of a condition failure worth tracing |
| **Assignment goals** | Shift policy | 3 | The shift period | The player's primary lever: policy defines what this category asks |
| **Deferred need goals** | Need at low threshold | 4 | Brief — satisfied at next opportunity | Normal texture; frequency is diagnostic of policy fit |
| **Voluntary goals** | Traits, relationships, memory | 5 | Free-time scale | Not a lever at all — this is the category the player watches to learn who people are |

The single-taxonomy decision has a consequence worth stating: there is no "social goal" category, no "maintenance goal" category, no domain-based typing. A maintenance pass is an assignment goal (it came from policy); seeking out a Bonded colleague is a voluntary goal (it came from trait/relationship weights); eating is a critical, deferred, or voluntary goal depending on which threshold produced it. The *same objective can arrive at different priorities from different sources* — eating at critical outranks the shift; eating at low waits for it — and the category records that difference, which is exactly the difference the player needs to read. A domain taxonomy would obscure it.

---

## Goal Priority

Priority is categorical, not computed. A goal's priority is the ADR-01 tier of its source, and the resolution order between tiers is absolute: the highest-priority actionable goal drives behavior, and a higher tier wins over a lower one unconditionally (ADR-01 collision handling, inherited verbatim).

What this document commits to, consistent with ADR-01:

- **Between tiers: no weighing.** No trait, relationship, memory, or accumulation of lower-tier pressure ever lets a tier-5 goal outrank a tier-3 goal. A Driven colonist at critical rest rests. Individuality operates *within* tiers, never across them.
- **Within a tier: weighing, deferred.** When multiple candidates share a tier — two low needs compete, several voluntary possibilities open in the same free period — trait weights, relationship states, and memory influences determine the selection. The mechanism of that selection is the Decision Loop's core question (DQ-G1) and is explicitly not designed here.
- **"Actionable" matters.** The highest-priority goal drives behavior only if pursuable. A blocked higher-priority goal does not paralyze the colonist: behavior falls to the highest actionable goal while the blocked one persists (and shows, per the Blocked state, when nothing actionable remains). The precise fall-through rules are Decision Loop scope (DQ-G4).

Priority is also the player's interpretive key. Every deviation the player reads is a priority event: the mid-shift food stop is tier 4 briefly outranking nothing (it waited for an available moment); the abandoned post is tier 2 outranking tier 3; the station-wide behavioral snap is tier 1 outranking everything. The player never sees a priority number — they see its consequences, and the consequences are ordered exactly as ADR-01 promises.

---

## Observable Player Effects

**The inspector shows the commitment.**
The colonist inspector (ADR-05 Tier 3) displays the current goal and its priority weights — this is an existing ADR-05 commitment that the Goal System now gives content to: the named goal, its category/tier, and its recorded motivation. "Current goal: rest before next shift — adopted because Rest crossed low during a double shift" is the inspector's answer to *what is this person doing and why*.

**The decision log shows the history.**
Goal adoptions, interruptions, refusals, and abandonments that are significant are logged per ADR-14's structure — [action] / Why: [cause state at decision time] / Outcome. The committed-motivation model is what makes the Why line true: it was captured when the decision happened, not reconstructed afterward.

**Deviations are goal transitions.**
Every readable deviation in colony-life.md is, underneath, a goal event: the override is a tier-2 adoption interrupting a tier-3 goal; the Blocked colonist is a persisting goal with failed preconditions; the colonist working past the boundary is an interruption negotiating with a commitment (ADR-02). The Goal System adds no new signals — it is the model behind the signals the player already reads.

**Refusals and abandonments are story events.**
A colonist abandoning or refusing an assignment goal is ADR-08's fourth story-event type and among the most narratively loaded moments the simulation produces — it is the visible edge of the gap between what the colony asked and what this person, with these needs, traits, and relationships, would do. The Goal System is the layer where that gap becomes an event.

**Voluntary goals are character on display.**
Tier 5 is where the player learns people. Who a colonist chooses to be near, what they gravitate toward when nothing is asked of them, which possibilities they never take — the voluntary category is the trait-discovery arc's raw material (personality-traits.md, discovery Stage 1) and the relationship map's visible surface.

---

## Model Boundaries

**B1 — This document does not define selection.**
How the decision process chooses among candidates within a tier, resolves ties, or evaluates the snapshot is the Decision Loop design's entire subject. No scoring, no ranking mechanism, no selection heuristic is defined or implied here.

**B2 — Lifecycle phases are conceptual, not a state machine.**
The six phases describe what happens to a commitment. They are not states in a formal machine, carry no transition table, and impose no representation on the engineering specification beyond the distinctions themselves (suspended ≠ destroyed; blocked ≠ abandoned).

**B3 — Stack structure is acknowledged, not specified.**
Goal stack depth, queue limits, eviction of stale queued goals — deferred (DQ-G2), carrying forward the unresolved remainder of colonist-agent-model.md DQ-1.

**B4 — Tasks are referenced, not designed.**
The goal→task resolution — which tasks exist, how a goal finds them, how skill requirements and permissions gate them (colonist-agent-model.md AQ-1 resolution: tasks own requirements) — belongs to the Decision Loop and task design (DQ-G3).

**B5 — The social portion of tier 5 remains ADR-18 scope.**
Voluntary social goals exist as a category; their action vocabulary does not exist until ADR-18 writes it. This document adds nothing to it (the same boundary as needs-system.md B3 and personality-traits.md B4).

**B6 — The world snapshot remains undefined.**
Candidate generation and precondition evaluation read the world state snapshot; its content is still the Decision Loop's open question (colonist-agent-model.md DQ-2, unchanged by this document).

**B7 — No goal source commands.**
Every source produces candidates for the colonist's own adoption. Nothing in this document creates a channel by which the player, the policy system, or any world event directly inserts an adopted goal into a colonist — with the sole architectural exception of ADR-01 priority 1, where the resolution order itself adopts survival goals unconditionally, by accepted design.

---

## Deferred Questions

**DQ-G1 — Within-tier selection** *(deferred to: Decision Loop design)*
The mechanism by which one candidate is adopted over another inside a priority tier — how trait weights, relationship states, and memory influences combine into a choice, and whether selection is deterministic or seeded-stochastic (Principle 7 constrains the options; it does not pick one). This is the Decision Loop's central question.

**DQ-G2 — Goal stack depth and queue management** *(deferred to: Decision Loop design; validated in prototype)*
How many goals a colonist holds, how queued goals age, when stale candidates are evicted. Carries the unresolved remainder of colonist-agent-model.md DQ-1.

**DQ-G3 — Goal→task resolution** *(deferred to: Decision Loop design)*
How an adopted goal finds a concrete task: the availability model (location, occupancy, module state, skill/permission gates per the AQ-1 resolution), and what happens when multiple tasks serve one goal.

**DQ-G4 — Interruption, blockage, and re-decision rules** *(deferred to: Decision Loop design)*
Suspension durations, retry behavior under blockage, the fall-through rules when the highest-priority goal is not actionable, and the conditions distinguishing resumption from abandonment at re-decision. The conceptual commitments (suspend-not-destroy; re-decide-not-hard-resume) constrain these rules; they do not define them.

**DQ-G5 — Completion criteria granularity** *(deferred to: Decision Loop design, with ADR-17 input for need goals)*
What "done" means per goal type: a need goal's completion presumably references satisfaction levels (ADR-17 scope), an assignment goal's references the shift boundary (ADR-02), a voluntary goal's may be open-ended. The per-type criteria structure is deferred with the systems that own each type's parameters.

---

## Risks

**Risk 1: The Goal System becomes the Decision Loop by accretion**
This document holds the line at "candidates, adoption, lifecycle" and defers all selection. The risk is downstream: as the Decision Loop design proceeds, selection logic may migrate backward into goal definitions ("this goal type is always preferred when...") — turning declarative objectives into embedded decision rules and re-conflating the layers this document separates.
*Severity: Medium-High. Mitigation: B1 is the guard. Any goal-type definition in later documents that contains comparative selection language ("preferred over," "chosen when") is Decision Loop content in the wrong layer and should be moved.*

**Risk 2: Committed motivation drifts from current truth**
Motivation is recorded at adoption. A long-running goal's recorded motivation can become stale — the colonist continues a task whose original reason has weakened. The decision log stays *true* (that was the reason at decision time) but the inspector's current-goal display could mislead a player into thinking the stale motivation is the live state.
*Severity: Medium. Mitigation: the inspector distinguishes the goal's recorded motivation ("adopted because...") from the colonist's current need/stress display, which is always live. The two sitting side-by-side is not a bug — a colonist finishing a task whose urgency has passed is legible, human behavior. The UI must frame it as history-plus-present, not as a contradiction.*

**Risk 3: Suspend-and-re-decide produces behavior that reads as indecision**
The interruption model has a failure mode: a colonist repeatedly interrupted and re-deciding may visibly oscillate between objectives — start toward the bunk, divert to the survival muster, return, re-divert — reading as broken pathing rather than sane re-prioritization.
*Severity: Medium. Mitigation: this is a Decision Loop tuning concern (DQ-G4 — re-decision frequency and commitment stickiness), flagged here because the conceptual model creates the exposure. The decision log makes each re-decision individually traceable, which converts "erratic" into "under conflicting pressure" for the player who inspects.*

**Risk 4: Tier-5 voluntary goals starve under pressure**
Voluntary goals only run when nothing above them claims the colonist. A colony under sustained strain may leave tier 5 permanently starved — no free-time behavior, therefore no trait discovery through voluntary texture, no relationship-building proximity, and (per ADR-08's accumulation model) a thinner story layer precisely when the colony is most dramatic.
*Severity: Medium. Mitigation: partially self-correcting by design — starved tier 5 means unmet Social needs, which escalate through stress and become visible as a different signal (needs-system.md). The residual risk is pacing: whether strained colonies still generate enough voluntary texture is a prototype validation target alongside ADR-08's frequency floor.*

**Risk 5: The category table implies more player control than exists**
Labeling assignment goals "the player's primary lever" risks reading as command-by-another-name. The lever is the *offer*, not the adoption: policy defines what tier 3 asks; the colonist's decision process still adopts, defers, or refuses it.
*Severity: Low. Mitigation: B7 and Pillar 2 language throughout; the refusal path (ADR-08 story event) is the standing proof that assignment is not command.*

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Goal categories are ADR-01 priority tiers — no second taxonomy | The priority order is already an ordering of goal sources; a domain taxonomy (social/work/maintenance goals) would run orthogonal to it and obscure the fact the player most needs to read: the same objective at different priorities means different things | Domain-based categories (orthogonal to priority; doubles the vocabulary; hides source); hybrid tier+domain matrix (combinatorial complexity with no reader benefit) |
| Motivation is committed at adoption, re-derived only at re-decision points (resolves colonist-agent-model.md DQ-3) | ADR-14 logs "cause state at decision time" — adoption is that time; committed motivation keeps the log true and the explanation stable. Continuous re-derivation would let the stated reason drift mid-pursuit, making the inspector's "why" unfalsifiable | Continuous derivation (explanation instability; a colonist who "changes their mind about why" without changing behavior is untraceable); motivation as pure display text with no recorded state (fails Principle 6 — the why must be the actual cause, not a caption) |
| Interruption suspends the goal; return is a re-decision with the suspended goal as default candidate (resolves the lifecycle half of colonist-agent-model.md DQ-1) | Preserves commitment (colonists are not goldfish) without hard resumption (colonists are not robots returning to stale objectives); consistent with ADR-02's negotiated shift-boundary behavior | Hard resumption (returns to invalidated objectives; reads as scripted); discard-and-regenerate (loses commitment continuity; adjacent interruptions would visibly reset the colonist's intent) |
| Blocked is distinct from abandoned in the lifecycle | The distinction is player-facing: Blocked is an ADR-05 ambient state pointing at a world condition the player can fix; abandonment is a colonist decision pointing at motivation. Collapsing them would merge an infrastructure signal with a character signal | Blockage as immediate abandonment (destroys the Blocked state's diagnostic value; colonists would silently give up on fixable situations) |
| Priority is categorical (tier of source); no cross-tier weighing exists | ADR-01's collision rule is unconditional and this document inherits it verbatim; admitting any cross-tier weighting would reopen an accepted ADR | Computed global priority scores (cross-tier leakage inevitable; also utility-scoring territory, explicitly out of scope) |
| Goal sources enumerated as exactly five, mapped one-to-one onto ADR-01 tiers | Closes the source list against invention: a proposed goal with no source has no tier, no priority, and no architectural home — the same guard pattern as personality-traits.md's category test | Open-ended source list (invites scripted goal injection — the "at day 10 the engineer gets angry" anti-pattern arriving through the back door) |

---

## Kanban Update

**Card:** [Phase 2] Design Goal System
**Status:** Review — Human Approval Required (Tier 3 design document)

**Completed:**
- ✅ design/goal-system.md — conceptual Goal System within approved scope

**This document does not:**
- Define decision algorithms, utility scoring, GOAP, behavior trees, or state machines
- Define within-tier selection, stack depth, or goal→task resolution (Decision Loop scope)
- Define social action vocabulary (ADR-18 scope)
- Define need-goal completion parameters (ADR-17 scope)
- Introduce data structures, classes, or TypeScript

**Design commitments made:**
- Need → Goal → Task → Action chain with each boundary explicitly defined
- Six-phase conceptual lifecycle: Candidate, Adopted, Active, Interrupted (suspend + re-decide), Blocked (distinct from abandoned), Completed/Abandoned
- Motivation committed at adoption (resolves colonist-agent-model.md DQ-3)
- Lifecycle model resolves the lifecycle half of colonist-agent-model.md DQ-1; stack depth remains deferred (DQ-G2)
- Goal categories = ADR-01 priority tiers; no second taxonomy
- Five goal sources mapped one-to-one onto ADR-01's five tiers; source list closed

**Deferred questions raised:**
- DQ-G1: Within-tier selection → Decision Loop design
- DQ-G2: Stack depth and queue management → Decision Loop design / prototype
- DQ-G3: Goal→task resolution → Decision Loop design
- DQ-G4: Interruption, blockage, and re-decision rules → Decision Loop design
- DQ-G5: Completion criteria granularity → Decision Loop design (ADR-17 input for need goals)

**This document unblocks:**
- Decision Loop design (its input vocabulary — candidates, tiers, lifecycle, re-decision points — is now defined; its open questions are enumerated as DQ-G1–G5 plus colonist-agent-model.md DQ-2)
- Inspector UI current-goal display (goal + tier + recorded motivation structure defined; framing requirement from Risk 2 attached)

**Follow-up tasks:** None beyond the deferred questions above.
