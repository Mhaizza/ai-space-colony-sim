# Architecture Decision Set
## AI Space Colony Simulator — Phase 1 Core Simulation

**Version:** 0.3.0 (post-architecture-freeze corrections)
**Status:** Accepted (freeze applied 2026-07-09; see design/architecture-freeze-report.md)

This document is the authoritative record of architectural decisions for Phase 1 simulation systems. Every system design and gameplay document must be consistent with these decisions. Contradictions with this document require a new ADR, not a silent override.

---

## Status Index

| ADR | Title | Status | Blocking |
|---|---|---|---|
| ADR-01 | Colonist Daily Rhythm | **Accepted** | — |
| ADR-02 | Daily Cycle Structure | **Accepted** | — |
| ADR-03 | Observation → Decision Transition | **Accepted** | — |
| ADR-04 | Policy System Shape | **Accepted** *(unblocked by ADR-11)* | — |
| ADR-05 | Colonist State Visibility | **Accepted** | — |
| ADR-06 | Time Scale | **Accepted** | — |
| ADR-07 | Immediate vs. Delayed Decisions | **Accepted** | — |
| ADR-08 | Emergent Story Frequency | **Accepted** | — |
| ADR-09 | Maintenance Model | **Accepted** | — |
| ADR-10 | Trait System Architecture | **Accepted** | — |
| ADR-11 | Policy Scope Architecture | **Accepted** | — |
| ADR-12 | Relationship System Architecture | **Accepted** | — |
| ADR-13 | Environment Visibility Architecture | **Accepted** | — |
| ADR-14 | Story Access Architecture | **Accepted** | — |
| ADR-15 | Crisis Detection and Escalation | **Accepted** | — |
| ADR-16 | Colonist Memory Architecture | **Accepted** | — |

---

## Dependency Graph

*Corrected in v0.3.0: 6 circular dependencies removed. See design/architecture-freeze-report.md Part 2 for full correction log.*

```
Level 0 — Foundation (no blocking dependencies)
  ADR-02  Daily Cycle Structure
  ADR-10  Trait System Architecture
  ADR-11  Policy Scope Architecture

Level 1 — First-order dependents
  ADR-01  Colonist Daily Rhythm       [ADR-02, ADR-10, ADR-11]
  ADR-04  Policy System Shape         [ADR-11]
  ADR-05  Colonist State Visibility   [ADR-10]
  ADR-12  Relationship System         [ADR-10]
  ADR-16  Colonist Memory             [no blocking deps]

Level 2 — Second-order dependents
  ADR-03  Observation→Decision        [ADR-05, ADR-11]
  ADR-07  Immediate vs. Delayed       [ADR-02, ADR-04]

Level 3 — Third-order dependents
  ADR-09  Maintenance Model           [ADR-04, ADR-07, ADR-10]

Level 4 — Fourth-order dependents
  ADR-15  Crisis Detection            [ADR-05, ADR-09]

Level 5 — Fifth-order dependents
  ADR-08  Emergent Story Frequency    [ADR-12, ADR-15, ADR-16]
  ADR-13  Environment Visibility      [ADR-05, ADR-09, ADR-15]

Level 6 — Sixth-order dependents
  ADR-06  Time Scale                  [ADR-02, ADR-15]
  ADR-14  Story Access Architecture   [ADR-08, ADR-12, ADR-15, ADR-16]
```

## Critical Path

The minimum chain required to write design/colony-life.md (currently blocked — ADR-17 and ADR-18 missing):

```
Level 0 (parallel): ADR-02 · ADR-10 · ADR-11
Level 1 (parallel): ADR-01 · ADR-04 · ADR-05 · ADR-12 · ADR-16
Level 2 (parallel): ADR-03 · ADR-07
Level 3:            ADR-09
Level 4:            ADR-15
Level 5 (parallel): ADR-08 · ADR-13
Level 6 (parallel): ADR-06 · ADR-14
```

All 16 ADRs now Accepted. Simulation prototyping may begin. design/colony-life.md requires ADR-17 and ADR-18 first.

---

## ADR-10 — Trait System Architecture

**Status:** Accepted

### Context

Multiple ADRs reference colonist traits as the mechanism of individual behavioral character. ADR-01 requires traits to influence deviation from shift policy. ADR-05 requires traits to map to observable behaviors. ADR-12 requires traits to influence interaction tendencies. The design establishes that traits are discovered through observation, not assigned by the player.

No prior ADR defined what a trait is structurally. Without this definition, colonist individuality has no architecture.

### Decision

**Named behavioral tendencies with underlying probability weight modifiers and required observable expressions.**

A trait is:
- A named label (player-legible; displayed in inspector after discovery)
- An underlying set of probability weight modifiers on specific behavioral decisions
- A set of 2–4 defined behavioral expressions: specific context-action pairs where the trait produces behavior distinguishable from the baseline

**Discovery mechanism:**
Traits are not disclosed to the player at colonist arrival. A trait becomes visible in the inspector only after the player has observed the relevant behavioral expression at least once. Until observed, the trait category shows as "Unknown." This means a new colonist's traits are unknown until their behavior reveals them under relevant conditions.

**Required observable expression rule:**
Every trait must have at least one behavioral expression visible in the Tier 1 ambient state (ADR-05 — behavior without hover or inspection). A trait that manifests only as a hidden simulation modifier is not a valid trait; it is an invisible parameter that the player cannot discover and cannot reason about. All traits must be observable through the scan loop.

**Trait evolution:**
- Initial traits are fixed at colonist arrival and do not change
- Sustained conditions produce trait *modifiers*: a long-running state that adjusts how strongly a trait expresses (e.g., chronic overwork adds a "Worn Down" modifier that suppresses the Driven trait's work-override tendency)
- Trait modifiers are reversible if conditions change; base traits are not
- Trait modifiers are visible in the inspector as sub-entries under the base trait

**Phase 1 scope:**
The number of distinct traits in Phase 1 must be limited to maintain learnability. Starting constraint: no more than 10 distinct traits across all Phase 1 colonists, with 2–4 assigned per colonist. This is a tuning target, not a hard architectural limit.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Modifier values only | Traits as numeric bonuses (stress_resistance: +20) | Not player-legible; cannot be discovered through observation |
| Named presets, no mechanics | Trait as flavor text | Cosmetic only; no simulation influence |
| Pure probability weights | No named category, only weights | Player cannot learn or predict behavioral patterns |

### Consequences

- Character design must support behavioral expression of all traits through animation states
- The "trait revealed through observation" mechanic makes early game a discovery process — the player doesn't know who their colonists are until the colony puts pressure on them
- Trait modifier accumulation creates long-term character evolution that is player-observable and traceable
- The colonist inspector must communicate trait discovery state (Unknown / Observed / Confirmed)

### Risks

- If trait expressions are too subtle, players miss them and traits feel absent
- If trait expressions are too dramatic, colonists feel scripted rather than emergent
- Phase 1 trait count must be low enough that all expressions are learnable, high enough that colonists feel distinct

### Dependencies

- ADR-05 (Colonist State Visibility — trait expressions must appear in Tier 1 ambient behavior)
- ADR-12 (Relationship System — traits influence interaction affinity drift rates)
- ADR-16 (Colonist Memory — sustained conditions that produce trait modifiers require memory of past states)

### Revisit Trigger

If playtest feedback shows players cannot identify colonist traits through observation after an hour of play; if trait expressions produce behavior the player reads as random rather than as character; if 10 traits is too few to produce colonist distinctiveness at 24 colonists.

---

## ADR-11 — Policy Scope Architecture

**Status:** Accepted

### Context

ADR-04 defines the shape of the policy system but was found to assume global (colony-wide) scope for all policies. The design requires the player to differentiate conditions for specific modules, crew roles, and shifts. A colony-level "balanced work culture" that conflicts with a module-level "critical systems priority" requires a conflict resolution mechanism that a single-scope architecture cannot provide. Without defined scope and conflict resolution, the policy system cannot be coherently designed or implemented.

### Decision

**Four explicit policy scopes with cascade-and-override conflict resolution.**

**The four scopes:**

| Scope | Applies To | Purpose |
|---|---|---|
| Colony | All colonists, all modules | Sets general conditions and default parameters |
| Module | Colonists in a specific module | Overrides colony defaults for a physical space |
| Role | Colonists in a specific crew role | Overrides colony defaults for a function or skill type |
| Shift | Colonists in a specific time period | Modifies timing and intensity of other scope policies |

**Conflict resolution — cascade model:**

Colony scope sets the default for every policy parameter. More specific scopes override the colony default for their domain.

- Module override wins over colony default for colonists in that module
- Role override wins over colony default for colonists in that role regardless of module
- Module + Role conflict: module scope takes precedence (location is the more specific qualifier in most gameplay situations)
- Shift scope does not override parameter values; it modifies their temporal activation (e.g., "during night shift, reduce work intensity target by 20%")

Any policy interface shows the effective policy at the current scope, including inherited defaults. When a scope setting overrides a colony default, this is visibly marked. The player can always see that an override is active without detailed inspection.

**Phase 1 scope introduction:**

In Phase 1 (24 colonists, single station), the full four-scope architecture is implemented but player-facing exposure is progressive:

- Colony and Module scope: fully exposed from game start
- Role scope: introduced after the player has encountered their first role-based personnel problem (Guided Discovery)
- Shift scope: introduced after the player has set their first multi-shift policy

Architecture must support all four scopes from Phase 1 start. UI complexity is managed by progressive exposure, not by deferring architectural support.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Global scope only | All policies apply to all colonists | Cannot differentiate critical modules; cannot adjust policy for specific roles |
| Fully hierarchical inheritance | Each scope inherits strictly from parent | Complex conflict resolution; hard to explain; surprising edge cases |
| Flat scopes, no cascade | Player sets each scope independently | Redundant input; player must set the same policy at multiple scopes every time |

### Consequences

- Every policy parameter must be defined at which scopes it applies and what the default cascade behavior is
- Some policies are inherently colony-scoped (overall work culture stance); some module-scoped (module maintenance priority); some role-scoped (skill assignment requirements)
- The policy interface must clearly expose scope without overwhelming new players — progressive introduction is required

### Risks

- The cascade model produces surprising behavior when a player doesn't realize an override is active — the visible override indicator is critical
- Four scopes with multiple parameters each creates a combinatorial space that can be overwhelming — phase-appropriate UI introduction is essential

### Dependencies

*None blocking — ADR-11 is a Level 0 foundation. ADR-04 depends on ADR-11, not vice versa. ADR-07's delay model is referenced here as a constraint that the scope architecture must accommodate, but ADR-07 need not be finalized before ADR-11 is accepted.*

### Revisit Trigger

If playtest feedback shows players are confused by scope interactions; if the colony + module two-scope approach is insufficient for meaningful Phase 1 decisions; if module-scope and role-scope conflicts produce behavior the player reads as bugs.

---

## ADR-01 — Colonist Daily Rhythm

**Status:** Accepted

### Context

The game's base 30-second loop depends on colonist behavior being legible. Players read the colony by noticing deviations from expected behavior. Without a defined rhythm, all behavior appears equal and the observation loop collapses into noise. ADR-10 must be accepted before this ADR can be finalized, as traits are a behavioral modifier on the rhythm.

### Decision

**Three-tier rhythm structure with explicit priority resolution order.**

**Tier 1 — Shift skeleton (player-defined via policy):**
The player sets shift parameters through policy (ADR-04, ADR-11). Shift defines the expected daily cycle for each colonist: work period, rest period, and free period. The shift skeleton is the learnable baseline against which deviations are readable as signals.

**Tier 2 — Need threshold overrides:**
Critical biological needs interrupt shift assignment when they cross a defined threshold. Thresholds have two levels:
- Low: colonist continues current task but seeks satisfaction at next available opportunity
- Critical: colonist overrides shift assignment and immediately seeks satisfaction

**Tier 3 — Trait-influenced tendencies:**
Traits (ADR-10) modify the thresholds at which needs override shift, and the probability of voluntary behavioral choices during free periods. Trait tendencies are not overrides — they are weight modifications on decision thresholds.

**Priority resolution order (highest wins):**

1. Station survival: depressurization, oxygen failure (immediate behavioral override, all colonists, no exceptions)
2. Critical biological need (need below critical threshold — overrides shift assignment)
3. Shift assignment (current work/rest/free period per policy)
4. Low-level need satisfaction (below low threshold, not critical — satisfied at shift's next available moment)
5. Trait-influenced voluntary behavior (during free time, or when low-level needs compete with each other)

**Collision handling:**
When two tiers produce conflicting behavioral pulls on the same colonist at the same time, the higher-priority tier wins unconditionally. A colonist with a "Driven" trait who is at critical rest need rests — the trait does not override the critical need threshold.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Need-driven only | No shift structure; colonists act on need priority at all times | No learnable baseline; all behavior looks equal; scan loop collapses |
| Shift-only | Colonists follow shifts; needs do not override | Colonists feel like rule-followers, not people; ignores urgency legibility |
| Trait-driven only | Traits determine all behavior | Unpredictable; policy decisions feel unreliable |

### Consequences

- The shift skeleton gives players a learnable "normal" within the first hour of play
- Need overrides make urgency legible: a colonist leaving their work station during a shift signals that a need has reached critical — the deviation is readable
- Trait tendencies produce individual character visible within the baseline without destroying legibility
- Override frequency must be tuned: if needs frequently override shifts, the shift baseline becomes unlearnable

### Risks

- If trait tendencies are too similar across colonists, individuality is absent; if too extreme, no baseline is learnable
- The priority resolution order must be implemented consistently — any inconsistency produces behavior the player correctly identifies as wrong

### Dependencies

- ADR-10 (Trait System — must be accepted before this ADR is finalized)
- ADR-11 (Policy Scope — shift is a policy object; scope architecture applies)
- ADR-02 (Daily Cycle — rhythm needs a time container and event trigger model)

### Revisit Trigger

If playtest feedback shows players cannot distinguish "normal" from "deviation" in the 30-second scan loop; if trait tendencies produce behavior the player reads as random rather than as character.

---

## ADR-02 — Daily Cycle Structure

**Status:** Accepted

### Context

The simulation runs in in-game time. Player-facing loops are described in real time (30-second scan, 5-minute decision). These two timelines must be connected. The design requires that crises and story events emerge from conditions, not from scripted clock triggers. This imposes a specific constraint: the clock provides a shared time reference, but it does not trigger events.

### Decision

**Continuous clock as shared time reference; all events are condition-triggered, not clock-triggered.**

**The simulation clock:**
- Runs continuously at all times (pause stops it; speed control scales all rates uniformly)
- Is the reference unit for: need degradation rates, shift duration measurement, relationship event timestamping, maintenance cycle rates, ADR-14 event log timestamps
- Does NOT trigger events. No event fires because the clock shows 08:00. Events fire when conditions are met.

**Shift transitions — condition-triggered:**
- A shift boundary is defined by elapsed duration (the shift is X in-game hours long)
- The transition fires when: shift duration has elapsed AND the colonist is not in a safety-critical task (priority 1 in ADR-01)
- A colonist performing an emergency repair at shift boundary completes the repair first, then transitions
- This prevents abrupt behavioral discontinuities and produces more natural-feeling rhythm breaks

**Need degradation:**
- Needs degrade at a defined rate per in-game time unit (set in system design, not defined here)
- Degradation rate is uniform across colonists at baseline; trait modifiers (ADR-10) adjust individual rates

**Player-facing time display:**
- Day counter is visible (Day 1, Day 2, Day 47...)
- Time-of-day is available in the inspector but not prominently displayed in the main view
- The player reads conditions, not a clock. The day counter provides temporal anchoring for stories, not for event anticipation.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Clock-triggered events | Shift starts at 08:00; events fire on clock values | Creates predictable scripted rhythms; player learns clock patterns instead of reading conditions |
| Shift-based cycles (no clock) | No clock; time expressed in shift cycles only | Loses shared time reference; cross-colonist event coordination becomes harder |
| Condition-triggered with no clock reference | Purely condition-driven, no time unit | Need degradation requires a time unit; determinism requires a shared reference |

### Consequences

- Events feel emergent (they fire on conditions) while the simulation remains deterministic (conditions evolve at clock-defined rates)
- The player is not trained to "check at 08:00" — they are trained to observe conditions and notice when they change
- Speed control uniformly scales all rates — at 2x, needs degrade twice as fast, relationships evolve twice as fast, maintenance cycles twice as fast

### Risks

- Condition-triggered transitions are harder to debug than clock-triggered ones — when a shift doesn't fire when expected, the cause requires inspecting the condition state, not just reading the clock
- Near-simultaneous condition triggers for multiple colonists may produce social event clustering that coincidentally feels scripted

### Dependencies

*None — ADR-02 is a Level 0 foundation. ADR-01 and ADR-06 depend on this ADR, not vice versa.*

### Revisit Trigger

If condition-triggered shift transitions produce inconsistent colonist behavior that players read as simulation errors; if the absence of clock-triggered events produces a game that feels directionless during low-event periods.

---

## ADR-03 — Observation → Decision Transition

**Status:** Accepted

### Context

The game's base loop is observation. The player must be able to move from observing to deciding without mode-switching friction. However, always-on access without any "colony is stable" signal risks training players to constantly intervene rather than observe. Both constraints must be met architecturally.

### Decision

**Frictionless always-on transition with an explicit colony stable signal.**

**Architectural commitment — no mode locks:**
All decision interfaces (policy, personnel, construction, inspection) are accessible at all times regardless of game state. The player can open a policy interface while a crisis is active. The player can open an inspector during a stable phase. There are no UI mode locks and no contextual menus that appear only in specific game states. This is a hard architectural constraint on the UI system.

**Colony stable signal:**
A defined ambient signal communicates "the colony is in a stable state; observation is sufficient." This signal is not a notification, message, or UI overlay — it is a visual state of the station itself. When all colonists are in expected behavioral states (no need overrides active, no conflict states), resource flows are within normal ranges, and no maintenance degradation is above the low threshold, the station's ambient visual state communicates stability.

This signal must be explicitly designed as a first-class visual state, not assumed as the absence of warning signals. "No warnings" and "stable" are not the same thing. Stable must have a positive visual identity.

**Over-intervention consequence:**
Policy changes during stable periods have downstream effects: colonists adapting to a new policy take time and produce social friction even when the policy is reasonable. This is a design constraint on the policy system (ADR-04), not an architectural mechanism — but it is stated here so the policy system implements it. The natural cost of unnecessary intervention is the friction it causes.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Dual mode (observe/act) | Explicit mode switch to access decisions | Creates friction; breaks the continuity of reading the colony |
| Signal-gated decisions | Decisions only surfaced on flagged items | Produces notification-response behavior; player reacts to flags instead of reading the colony |
| Pop-up decisions | Auto-surface prompts for specific situations | Trains passive behavior; player stops scanning because "the game will tell me when to act" |

### Consequences

- UI architecture must treat all interfaces as always-accessible — no feature can hide interfaces behind a game state condition
- The colony stable visual state is a first-class art direction and UI design deliverable
- The player's habit of observation must be built through rewarding that behavior, not through restricting access to decision interfaces

### Risks

- Without an explicit colony stable signal, players experience low-level anxiety during quiet periods ("should I be doing something?")
- Always-on access may produce compulsive over-intervention in some players — the downstream friction cost of unnecessary policy changes is the only corrective mechanism

### Dependencies

- ADR-05 (Colonist State Visibility — the ambient stable signal is part of the visibility design)
- ADR-11 (Policy Scope — policy interfaces must be consistently accessible at all scope levels)

### Revisit Trigger

If playtest feedback shows players consistently over-intervene during stable phases and cannot sustain the observation habit; if the stable-state signal is not legible enough to communicate "nothing requires action now."

---

## ADR-04 — Policy System Shape

**Status:** Accepted *(unblocked when ADR-11 accepted in freeze 2026-07-09)*

### Context

Policy is the player's primary action type. The player sets conditions through policy; colonists respond to those conditions. The policy system's shape — what a policy looks like as a player-facing object — determines the quality of the "conditions, not commands" experience. This ADR is blocked on ADR-11 (Policy Scope) because scope is a prerequisite structural decision. The decision below is provisional pending ADR-11 acceptance.

### Decision (provisional)

**Two-tier architecture: Colony-level named stances set defaults; scope-specific overrides use direct parameters.**

**Colony level — named stances:**
The colony-level policy is expressed as named stances along several dimensions (e.g., Work Intensity: Demanding / Balanced / Humane; Resource Conservation: Strict / Moderate / Abundant). Each stance is a meaningful named position that sets a cluster of underlying parameters. Stances are the primary decision surface for players who want to manage at the philosophical level.

Each stance dimension has 3–4 named positions. Stance names are values-neutral — "Demanding" is not implied to be better or worse than "Humane." The downstream consequences of each stance (in terms of colonist behavior) are the player's basis for choosing, not an implied optimization direction.

**Scope-specific overrides — direct parameters:**
At module, role, and shift scope (per ADR-11), the player adjusts policy through direct parameter controls (priority weights and threshold values). No stance layer at sub-colony scope — the player is already in a specific context and the named stance abstraction adds no value.

Scope-specific settings override the colony default for their scope. The player can always see that a scope is operating on an override (ADR-11 visibility requirement).

**Player interaction model:**
- New player path: set colony stances, never touch scope overrides
- Experienced player path: set colony stances as philosophical defaults, adjust specific module/role settings for exceptions
- The two paths must be coherent — a player using only stances and a player using both stances and overrides must both produce reasonable colonies

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Numeric thresholds only | Policy as sliders and numbers | Invites optimization over conditions-thinking; no meaningful high-level choices |
| Priority weights only | Policy as relative priorities | Non-intuitive; hard to predict weight interactions across categories |
| Rule construction | Player writes if-then rules | High cognitive load; approaches programming; violates "conditions not commands" spirit |

### Consequences

- Stance dimensions must have genuinely different downstream social consequences — not just different resource outputs — to be meaningful choices
- Stance names must be chosen carefully to avoid implying correct choices
- The policy interface must clearly show: current colony stance, any scope overrides active, and the effective policy at the current scope

### Risks

- If scope-specific overrides are too powerful, colony-level stances become irrelevant window dressing
- If stances are the only meaningful layer, sub-colony policy differentiation is impossible
- Priority weight interactions between policy categories may produce counterintuitive emergent outcomes that players cannot predict

### Dependencies

- ADR-11 (Policy Scope — BLOCKING — must be accepted first)
- ADR-07 (Immediate vs. Delayed — when do policy changes take effect?)
- ADR-01 (Colonist Rhythm — shift is a policy object; policy shape must accommodate it)

### Revisit Trigger

If playtest feedback shows players ignore stances entirely (stance layer adds no value) or ignore scope overrides entirely (sub-colony differentiation is invisible); if stance naming produces implied-correct-choice bias in player behavior.

---

## ADR-05 — Colonist State Visibility

**Status:** Accepted

### Context

The scan loop requires legible colonist state across the full colony. At 24 colonists, individual behavioral reading must remain viable. ADR-05 (original) did not address the 24-colonist scaling problem or define minimum behavioral requirements. Both are added here.

### Decision

**Three-tier visibility with defined behavioral repertoire, explicit scaling solution, and crisis fast-access mode.**

**Tier 1 — Ambient behavior (always visible, no interaction required):**

Colonists display a minimum behavioral repertoire of seven distinguishable states:

| State | Visual signal | What it communicates |
|---|---|---|
| Working | Directed movement, task-focused posture | Colonist is on-shift, performing assignment |
| Resting | Low movement, reclined or still in rest area | Colonist is in rest period, needs being satisfied |
| Eating | At food station, consumption animation | Colonist is satisfying hunger need |
| Socializing | Idle near another colonist, interaction-facing | Colonist is in free period with relationship activity |
| Stressed | Erratic or slowed movement, avoidance behavior | Colonist stress level is elevated |
| Blocked | Motionless, not in rest area, not on task | Colonist cannot execute current goal (pathfinding failure, resource unavailable) |
| In conflict | Facing another colonist, no task movement | Active interpersonal friction state |

These seven states must be distinguishable at the distance of a colony overview. Any internal state that does not map to a distinct behavior in this repertoire is not an ambient state — it is accessible only through inspection.

Critical-state exception: colonists at a critical need threshold or in a Fractured relationship state (ADR-12) display a small always-visible icon overlay even without hover. This is the exception to the "no icons without hover" rule.

**Tier 2 — Hover state (icons on hover):**
Categorical icons appear on hover: need level summary (critical/low/normal for top needs), social state (in conflict / bonded), current task assignment, stress level indicator. Icons suppress in the base view to avoid noise at 24 colonists.

**Tier 3 — Inspector (click):**
Full colonist state: all need levels with history, full relationship list with states (ADR-12), current goal and priority weights, active trait expressions, decision history log (ADR-14).

**Scaling solution — two visual modes:**

*Overview mode:* Colony-wide view. All colonists visible. Colonist representation is small but the seven behavioral states are readable by posture and movement pattern. The scan loop operates in overview mode.

*Focus mode:* Player zooms into a module cluster. Colonist representation is larger; all behavioral details and hover interactions are fully accessible. The decision loop operates in focus mode.

Transition between modes: frictionless scroll/click-to-zoom. No UI mode switch required.

**Crisis fast-access panel:**
When the colony enters Stage 2 or higher (ADR-15), a summary panel activates. The panel lists all colonists at critical states and all systems at warning/failure state, in a scannable format. The player can inspect any panel item without changing zoom level. The panel is dismissible but auto-activates at Stage 2. It does not replace the main view.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Inspector-only visibility | No ambient state; all info requires click | Scan loop impossible; player cannot read colony at a glance |
| Icon-based ambient | Icons above all colonists at all times | 24-colonist icon field is visual noise; reduces colonists to status lights |
| Need bar ambient | Small need bars displayed per colonist | Undermines people-over-resources at the most visible layer |

### Consequences

- Animation and character design must deliver the seven distinguishable behavioral states
- The behavioral state repertoire may need expansion when colonist AI behaviors are designed — revisit before AI design begins
- Focus mode implies a spatial station layout the player can zoom into — this constrains the visual design of the station

### Risks

- Seven states may prove insufficient as colonist AI behavior grows more complex — revisit before AI behavior system is designed
- At 24 colonists in overview mode, even distinct behavioral states may overlap in dense module areas — requires prototyping validation
- The always-visible critical-state icon (Tier 1 exception) creates notification pressure; too many simultaneous critical icons at once is a UI problem

### Dependencies

- ADR-10 (Trait System — trait expressions must appear as distinguishable Tier 1 states)

*Corrected v0.3.0: ADR-15 and ADR-13 removed. ADR-15 is a circular dep (ADR-15 also depends on ADR-05); the crisis panel concept does not require Stage 2 thresholds to be defined first. ADR-13 is a co-design constraint (visual compatibility), not a blocking dep — ADR-13 depends on ADR-05.*

### Revisit Trigger

If prototype testing at 20+ colonists shows the overview scan is not viable; if playtest feedback shows players default to inspecting every colonist instead of reading ambient behavior; if more than seven base behavioral states are required to represent meaningful AI conditions.

---

## ADR-06 — Time Scale

**Status:** Accepted

### Context

Time scale determines pacing at every level of the game. The "waiting for consequences" loop requires time to pass at a rate that makes waiting meaningful — neither so fast that consequences arrive instantly nor so slow that waiting is frustrating. Speed control is a player-facing feature with significant design implications that must be treated as an architectural decision, not a UI option.

### Decision

**Clock-based day with player speed control, subject to hard crisis constraints.**

**Speed control range:** Pause / 1x / 2x / 4x

**Crisis speed constraint (hard — not player-adjustable):**
- When the colony enters Stage 3 crisis or higher (ADR-15), maximum speed is reduced to 1x
- The player cannot fast-forward through an active Stage 3+ crisis
- The constraint lifts when all systems return to Stage 2 or below
- The constraint activates and deactivates automatically; the player is notified when it engages
- Rationale: "waiting for consequences" is the game's intended third state; fast-forward through consequences allows the player to opt out of the design. Stage 3 crisis is the moment the game most requires sustained attention.

**Design hypothesis for time scale calibration (to be validated in prototype):**

| Hypothesis | Value |
|---|---|
| Real time per in-game day at 1x | ~20 minutes |
| In-game days in a 2-hour session at mixed speed | ~8–14 days |
| Duration of "3 in-game days of accumulated stress" at 1x | ~1 hour real time |

These numbers are starting hypotheses, not commitments. The prototype must validate them against need degradation rates and relationship formation speed. The design constraint (not the specific value) is what is decided here: one in-game day must be long enough that multi-day consequences feel weighty within a real play session.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Unconstrained speed control | Player can always accelerate | Crisis can be fast-forwarded through; "waiting for consequences" becomes optional |
| Variable speed by game phase | Game slows during crisis automatically | Too prescriptive; phase transitions may feel jarring; removes player agency on pacing |
| No speed control | Fixed 1x only | Inflexible; punishes players who want to observe or review during stable phases |

### Consequences

- The Stage 3 speed constraint must be communicated to the player before it first activates — not as a punishment, but as a design intent
- All need degradation rates, relationship formation speeds, and maintenance cycles are expressed as per-in-game-day rates, then scaled by the time ratio
- At 4x speed, a player in a quiet colony covers ~4 real minutes per in-game day; a player in Stage 3 crisis cannot go above 1x

### Risks

- Players accustomed to running at 4x constantly may experience the crisis speed constraint as punitive — framing and first-encounter design are critical
- The 20-minute hypothesis may be significantly wrong; this is the highest-priority prototype validation question in the ADR set

### Dependencies

- ADR-02 (Daily Cycle — clock structure the time scale applies to)
- ADR-15 (Crisis Detection — defines Stage 3+ which triggers the speed constraint)

### Revisit Trigger

If the 20-minute-per-day hypothesis proves incorrect in prototype; if the crisis speed constraint produces frustration feedback rather than engagement; if players discover that running at 4x during Stage 1-2 lets them arrive at Stage 3 without adequate warning.

---

## ADR-07 — Immediate vs. Delayed Decisions

**Status:** Accepted

### Context

The architecture review identified a philosophical conflict: the original ADR-07 included "emergency decisions" — immediate player commands to colonists. This directly violates Pillar 2 (Conditions, Not Commands): "The player must instead create a world where a qualified, unblocked, sufficiently motivated colonist decides to repair the generator." An emergency command to redirect a colonist is precisely what Pillar 2 prohibits. This revision resolves the conflict by removing the emergency command category entirely.

### Decision

**Three delay categories — no emergency colonist command category.**

**Category 1 — Structural decisions (delayed, no override):**
Construction, demolition, module reconfiguration. Takes effect when the work is complete. In-game duration scales with project complexity. The player queues these; the colony executes them according to colonist availability and skill.

**Category 2 — Policy decisions (delayed to next shift boundary):**
Shift rotation changes, rationing level adjustments, priority weight changes, personnel assignments. Takes effect at the next natural shift boundary for the affected colonists. The pending state of a policy change is visible to the player before it takes effect. Pending policy changes are cancellable before taking effect.

**Category 3 — Infrastructure routing decisions (immediate, no colonist command):**
Rerouting power between modules, redirecting resource flow, opening/closing valves, toggling system switches. Takes effect immediately because these are infrastructure state changes — the player is changing the physical condition of the station, not issuing an order to a person.

**Philosophical grounding of Category 3:**
Category 3 is consistent with Pillar 2 because the player is changing the environment, not commanding a person. "Redirect power from Module A to Module B" changes which modules have power. A colonist in a newly depowered module who then moves to a lit area is responding to the environmental condition the player created — the player did not tell them to move. This is the "conditions, not commands" mechanism in its most direct form.

**Eliminated: Emergency command category.**
The original recommendation included an "emergency" decision type that immediately overrode colonist autonomous behavior. This category is removed. There is no mechanism for the player to command a colonist to do a specific thing immediately, regardless of crisis state.

**Crisis consequence of this decision:**
During a crisis, the player's available levers are:
- Category 3: immediately change infrastructure conditions (reroute power, shut down systems, open emergency reserves)
- Category 2: queue policy changes that take effect at the next shift boundary
- Category 1: queue structural changes that take effect when completed (rarely relevant during acute crisis)

A player who prepared well has colonists positioned to respond to the changed conditions autonomously. A player who did not prepare cannot compensate in the moment. This is the intended design: crisis is a consequence of prior conditions. The post-mortem (ADR-14) is the primary feedback mechanism for learning from it.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Emergency commands with social cost (original) | Immediate colonist commands at a cost | Violates Pillar 2; creates dominant strategy bypass of the conditions layer |
| All decisions delayed (no category 3) | Everything delayed, including infrastructure | Makes crisis completely non-interactive; no player agency during acute failure |
| All decisions immediate | No delays on any decisions | Removes the "waiting for consequences" loop; post-mortem loses meaning |

### Consequences

- Players who build well are prepared for crises; players who build poorly learn through post-mortem
- Category 3 infrastructure routing is the player's most immediate crisis lever — its design is load-bearing for crisis gameplay
- The pending-policy-change visual state must be legible: the player must see what is about to change, when, and whether it is still cancellable
- Category 3 must not be designed in ways that effectively function as indirect colonist commands (e.g., using power rerouting specifically to force colonists out of modules)

### Risks

- Players may experience unresolvable crises as unfair rather than instructive — the post-mortem's clarity is the corrective mechanism; it must work well enough to convert "unfair" to "I understand now"
- Category 3 routing decisions may be discovered as indirect colonist manipulation (depowering a module to force someone out of it) — monitor in playtesting

### Dependencies

- ADR-04 (Policy Shape — policy delay model is embedded in the policy architecture)
- ADR-02 (Daily Cycle — "next shift boundary" requires known shift timing)
- ADR-15 (Crisis Detection — informs when Category 3 decisions are most critical)

### Revisit Trigger

If playtesting shows that the absence of emergency commands makes Stage 3 crises feel completely outside player control and produces frustration rather than narrative engagement; if Category 3 routing is discovered to function as an effective indirect command mechanism that undermines Pillar 2.

---

## ADR-08 — Emergent Story Frequency

**Status:** Accepted

### Context

The Dinner Table Test requires stories. Stories require story-generating moments in the simulation. The architecture review identified that this ADR originally conflated two concerns: (1) what generates story conditions in the simulation, and (2) how players access the story. Story access is now ADR-14. This ADR addresses only the simulation side.

### Decision

**Accumulation-triggered story conditions, pressure-modulated rate, with a minimum frequency floor and explicit definition of what constitutes a story event.**

**What counts as a story-generating simulation event:**
A story-generating event is a colonist behavioral decision that crosses at least one of the following:

1. A relationship state threshold (relationship level changes — ADR-12)
2. A stress behavioral threshold (colonist behavioral state changes due to stress — ADR-05)
3. A trait expression under novel conditions (a trait expression the player has not yet seen from this colonist — ADR-10)
4. A decision-log entry inconsistent with the colonist's current assignment (a colonist overriding their shift, refusing a task, or taking an unexpected social action)

Events that do not meet these criteria are simulation events but not story events. They may be logged in the event log (ADR-14) at a lower significance level but do not contribute to story frequency.

**Accumulation model:**
Story events do not fire randomly. They fire when relationship affinity scores or stress levels cross defined thresholds — those thresholds accumulate from continuous simulation state rather than from random rolls. Every interaction between colonists nudges affinity scores; every shift without adequate rest nudges stress levels. The accumulation is always active.

**Pressure modulation:**
The rate at which accumulation occurs scales with colony-wide stress conditions. During high-pressure periods (Stage 2 crisis), accumulation rates increase — story events emerge more frequently. During stable periods, accumulation continues at a lower base rate.

**Minimum frequency floor:**
At least one story-generating event must occur per colonist cluster per in-game day (cluster = colonists who regularly share a module or shift). If natural accumulation does not reach a threshold within this window, background social dynamics (minor preference frictions, low-level affinity drift from proximity) accumulate faster to compensate. The floor prevents the "dead colony" problem during optimization phases.

The floor does not produce scripted events. It produces accelerated accumulation that makes threshold crossing more likely — the event that fires is still determined by colonist state.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Always-on story engine | A notable event every few minutes | Story fatigue; no moment carries weight |
| Scripted events | Authored events at scheduled times | Violates "Every Story Is True" (Pillar 3) |
| Pure pressure-trigger | Stories only during high-pressure periods | Optimization phase is story-dead; contradicts the design goal |

### Consequences

- Story event frequency is a function of colonist simulation behavior quality — if the AI produces behavior that rarely crosses thresholds, story frequency drops below the floor, which then accelerates accumulation in ways that may feel artificial
- The minimum floor constraint requires the simulation to track per-cluster story event frequency — not globally, but per co-located colonist group

### Risks

- The floor mechanism may produce colonist behavior that feels manufactured during stable periods — events that occur only because the floor forced accumulation
- Calibrating accumulation rate and floor value is prototype-critical; they are deeply intertwined

### Dependencies

- ADR-12 (Relationship System — relationship state transitions are primary story event sources)
- ADR-15 (Crisis Detection — crisis stage modulates accumulation rate)
- ADR-16 (Colonist Memory — memory bounds how long accumulation persists between events)

*Corrected v0.3.0: ADR-14 removed. ADR-08 generates events; ADR-14 logs them. ADR-14 depends on ADR-08, not vice versa.*

### Revisit Trigger

If playtest feedback shows story moments feel too frequent (every event seems significant) or too rare (players feel nothing is happening between crises); if the floor mechanism produces behavior that players identify as artificial or scripted.

---

## ADR-09 — Maintenance Model

**Status:** Accepted

### Context

The original ADR-09 collapsed preventive and reactive maintenance into a single model, creating a risk that the resource layer becomes trivially solvable. The architecture review also identified that maintenance capacity is skill-qualified, requiring a dependency on ADR-10 (Trait/Role system). This revision separates the two maintenance types and makes their architectural differences explicit.

### Decision

**Two-tier maintenance model: Preventive (capacity allocation) and Reactive (crisis response), both skill-qualified.**

**Tier 1 — Preventive Maintenance:**

Preventive maintenance is a continuous capacity consumption that keeps systems healthy. It is always running in the background against allocated colonist capacity.

- The player's lever: a policy allocation (Category 2 — ADR-07) defining what proportion of qualified colonist time goes to maintenance for each system type
- When preventive capacity is adequate: system health is maintained at a stable level; no visible degradation
- When preventive capacity is insufficient: system health degrades slowly, visible in ADR-13 Environment Visibility at the Stressed level before reaching Warning
- Preventive maintenance cannot be performed ad-hoc; it is a policy decision with effect at next shift boundary

**Tier 2 — Reactive Maintenance:**

Reactive maintenance is triggered when system health drops to the Warning threshold (ADR-15 Stage 1+). It requires immediate qualified colonist time and competes with normal shift assignments.

- The player's lever: ADR-07 Category 3 (infrastructure routing to isolate or reduce load on the degrading system) and ADR-07 Category 2 (policy re-prioritization to free up qualified colonist time)
- Reactive maintenance competes with normal shift assignments — a colonist pulled to reactive repair is not doing their assigned role during that time
- Reactive maintenance without adequate qualified colonists present = crisis escalation toward Stage 2+

**Skill qualification:**

Maintenance is skill-qualified by system type. A colonist requires the appropriate skill to perform maintenance on a given system (life support, power, structural, etc.). Skill is part of the colonist's role and trait expression (ADR-10).

"Qualified capacity" = qualified colonist count × available time × skill level modifier. Adding unqualified colonists does not increase maintenance capacity. This is the primary mechanism preventing the "add more colonists" universal solution from trivializing the resource layer.

**The solvability constraint:**

Preventive maintenance can be made highly reliable if the player allocates sufficient qualified capacity — this is intentional. The resource layer becomes reliable; the people layer does not. Qualified colonists are also the colonists most subject to stress, social dynamics, and behavioral deviation. A highly qualified engineer who is personally in a Fractured relationship state and at 94% stress may not perform maintenance at their rated capacity regardless of policy assignment. The intersection of the people layer and the resource layer — not the resource layer alone — is what the game cannot be fully solved.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Unified maintenance | Single maintenance model | Resource layer trivially solvable; preventive and reactive have different player levers |
| Player-queued maintenance tasks | Maintenance as a task queue | Becomes chore management; not a conditions problem |
| Background degradation only | Invisible degradation until failure | Violates Legible Complexity; player cannot anticipate or respond |

### Consequences

- The dual model creates a designed tension: adequate preventive maintenance requires policy investment; reactive maintenance competes with crisis response during the worst possible moments
- Reactive maintenance emergencies must have a distinct visual signal from ongoing preventive maintenance status (ADR-13 must support both states)

### Risks

- If reactive maintenance is too easy (any colonist can perform it), the skill qualification constraint is bypassed and the resource layer becomes solvable
- If preventive maintenance is too complex to track, players abandon it and always operate in reactive mode — which may become a viable strategy rather than a risky one

### Dependencies

- ADR-13 (Environment Visibility — maintenance state must have distinct visual signals for preventive-adequate, preventive-insufficient, reactive-active, and failure states)
- ADR-04 (Policy Shape — preventive maintenance allocation is a policy decision)
- ADR-07 (Immediate vs. Delayed — preventive is policy-delayed; reactive uses Category 3 infrastructure routing)
- ADR-10 (Trait System — colonist skill qualification is part of role and trait architecture)

### Revisit Trigger

If the resource layer becomes trivially solvable in playtest (preventive maintenance is too easy to maintain at adequate levels); if reactive maintenance crises never feel urgent because unqualified colonists can cover them.

---

## ADR-12 — Relationship System Architecture

**Status:** Accepted

### Context

Relationships are the primary driver of emergent story (ADR-08), the mechanism of social crisis escalation, and a foundational element of cultural calcification. No prior ADR defined what a relationship is structurally.

### Decision

**Bidirectional relationship records using discrete named states derived from a continuous underlying affinity score, with bounded interaction history and defined behavioral influence zones.**

**Structure — per colonist pair:**
- Underlying: a continuous affinity score (range: −100 to +100)
- Player-facing: discrete named states derived from score ranges

| Score | State | Player visibility |
|---|---|---|
| +75 to +100 | Bonded | Inspector; ambient behavior; hover icon |
| +40 to +74 | Positive | Inspector; occasional ambient social interaction |
| +10 to +39 | Neutral | Inspector; default; not emphasized |
| −10 to +9 | Acquainted | Inspector; default; not emphasized |
| −40 to −11 | Tense | Inspector; hover icon |
| −75 to −41 | Hostile | Inspector; hover icon; ambient avoidance behavior |
| −76 to −100 | Fractured | Inspector; always-visible critical icon; ambient conflict behavior |

Neutral and Acquainted are visually equivalent to the player (both are "no notable relationship signal"). The distinction exists in the simulation but not in the default UI.

**Affinity score change sources:**

| Event | Direction | Magnitude |
|---|---|---|
| Shared task completion | Positive drift | Low |
| Forced proximity during mutual stress | Negative drift | Low-Medium (rate modulated by trait compatibility) |
| Direct conflict event | Negative | High |
| Mutual support during crisis | Positive | High |
| Extended avoidance (no interaction for N days) | Negative | Low (relationship atrophy) |
| Trait compatibility alignment | Positive drift | Very Low (background) |

**Interaction history (bounded):**
Each relationship record stores the last N significant interactions. Significant: any event that moved the affinity score by more than a threshold amount. History is bounded by ADR-16 (Colonist Memory). History is the source material for the tier-2 relationship log in ADR-14 and for the inspector's relationship tab.

**Behavioral influence:**
Relationships modify probability weights on existing colonist behavioral tendencies. They do not override shift assignment but they modify its execution:

| State | Behavioral effect |
|---|---|
| Bonded | Proximity preference; stress reduction in shared module; increased probability of cover behavior (taking on tasks to help a Bonded colonist) |
| Tense/Hostile | Avoidance tendency; reduced task efficiency in shared modules; increased stress in shared spaces |
| Fractured | Strong avoidance; active conflict behavior in proximity; refusal probability increase for shared-task assignments |

**Scale management at 24 colonists:**
At 24 colonists, the total pair count is 276. The simulation handles this efficiently by treating Neutral/Acquainted pairs as near-zero-cost entries — low-activity pairs have no interaction history and minimal computational overhead. The simulation tracks active interaction history only for pairs that have moved outside the Neutral/Acquainted range or that have recently interacted.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Continuous score only | Raw number, no named states | Not player-legible; player cannot understand "71" means "Positive" |
| Discrete states only | No underlying score | State transitions feel abrupt and arbitrary with no visible cause |
| Simple like/dislike binary | Liked/disliked only | Insufficient granularity for story complexity |

### Consequences

- Ambient behavior for Bonded (positive) and Hostile/Fractured (negative) states must be distinguishable in Tier 1 (ADR-05)
- The social graph grows in complexity as colonists accumulate relationships — managing the player's attention on relevant relationships (non-neutral) is a UI design responsibility

### Risks

- The discrete state model produces visible "step" transitions (Positive → Tense) that may feel abrupt if the score crosses a threshold during a moment the player is watching — micro-transitions within a state band must be smooth
- 276 pairs at 24 colonists: the efficiency assumption (most pairs are low-cost) must hold; if most pairs become active simultaneously (mass crisis), the simulation cost may spike

### Dependencies

- ADR-08 (Story Frequency — relationship state transitions are the primary story event)
- ADR-14 (Story Access — significant interaction history must be logged per ADR-14 tier 2)
- ADR-16 (Colonist Memory — bounds interaction history retention)
- ADR-10 (Trait System — trait compatibility influences affinity drift rates)

### Revisit Trigger

If the discrete state model produces relationship transitions that feel stepped and artificial; if 276 pairs proves computationally expensive in prototype; if relationship behavioral influence is too weak to produce observable social dynamics at the colony level.

---

## ADR-13 — Environment Visibility Architecture

**Status:** Accepted

### Context

ADR-05 addresses colonist state visibility. The player also must read the station's physical state: which modules are healthy, what resource flows are active, where systems are degrading. These have different design requirements from colonist visibility — they are mostly spatial and static between events — and must be defined in a separate ADR.

### Decision

**Three-layer environment visibility: base health state (always visible), module inspection (click), and system overlays (player-toggled).**

**Layer 1 — Base environment health state (always visible):**
Module visual appearance changes with health state. The base layer is visible at all times without player interaction.

| Health State | Visual Signal | Trigger |
|---|---|---|
| Nominal | Normal appearance | All maintenance within spec |
| Stressed | Subtle surface wear, color shift | Preventive maintenance insufficient |
| Warning | Distinct flickering, warning tint | System health at warning threshold (ADR-15 Stage 1) |
| Critical | Pronounced distress (alarm indicators, significant visual change) | System health at critical threshold (ADR-15 Stage 2+) |
| Failing | Active failure visuals | System health at failure state (ADR-15 Stage 3+) |

These five states must be distinguishable at the overview zoom level used for the scan loop.

**Layer 2 — Module inspection (click):**
Click any module to open: health percentage, current load vs. capacity, maintenance status (preventive adequate/insufficient), assigned colonist count and qualification status, resource input/output rates. This is the environment equivalent of the colonist inspector.

**Layer 3 — System overlays (player-toggled):**
Individual overlays per major system type: power grid, life support (oxygen/pressure), water, structural integrity. Each overlay shows: flow direction, flow rate, capacity utilization on relevant infrastructure. Overlays are diagnostic tools, not the default view. Maximum one overlay active at a time. Overlays activate and deactivate instantly.

**Resource conduits in base layer:**
Power lines, pipes, and other resource conduits show a simplified flow state in the base layer (no overlay required): Active flow / Reduced flow / No flow. Exact rates require an overlay. The base conduit state gives the player sufficient information for routine monitoring without forcing overlay use.

**Integration with colonist visibility:**
The environment base layer and colonist behavior layer are visible simultaneously at all times. Art direction must prevent visual competition: environment state communicates from module surfaces and infrastructure; colonist state communicates from character movement and posture. These are spatially distinct signals.

The crisis fast-access panel (ADR-05) integrates both: colonist critical states and environment critical states appear in a single summary view. The player does not need to switch between colonist and environment views during a crisis.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Inspector-only environment | All environment info requires module click | Player must seek all environment information; scan loop fails for the environment |
| Always-on detailed overlay | Full resource flow visible at all times | Visual noise makes colonist behavior unreadable in the same view |
| No module health visualization | No visible degradation until failure | Violates Legible Complexity; preventive maintenance has no visible output |

### Consequences

- Art direction must support five module health states that are clearly distinguishable at overview zoom — this is a significant visual design deliverable
- The overlay system introduces an analytical mode; design must ensure overlays are useful for diagnosis but not required for routine management
- The base layer conduit state (active/reduced/no flow) reduces routine overlay use but must be clear enough to convey the key question: "is this resource moving?"

### Risks

- If the five base health states are not sufficiently distinct, players will miss the Stressed → Warning progression — the most important early-warning signal in the system
- If overlays become habitually necessary (the base layer is insufficient for diagnosis), the "analytical tool" intent is undermined and the player is always in overlay mode

### Dependencies

- ADR-09 (Maintenance — defines what system health means and how it degrades)
- ADR-05 (Colonist Visibility — must be visually compatible in the same view)
- ADR-15 (Crisis Detection — environment health states map directly to crisis stage thresholds)

*Note: ADR-05 ↔ ADR-13 co-design constraint is directional: ADR-13 depends on ADR-05 (environment visibility must work within the visual space colonist visibility defines). ADR-05 does not depend on ADR-13.*

### Revisit Trigger

If playtest feedback shows players are using overlays constantly (base layer is insufficient); if the five health state visual language cannot be made distinct at overview zoom.

---

## ADR-14 — Story Access Architecture

**Status:** Accepted

### Context

The Dinner Table Test, Post-Mortem Test, and Pillar 3 (Every Story Is True) all require players to access the story of what happened — not just experience it in the moment. "The decision log will confirm it" is a design promise that requires a first-class event log architecture. ADR-08 generates story conditions; this ADR defines how players access the resulting story.

### Decision

**Three-tier story access: colonist decision log, relationship history, and colony timeline.**

**Tier 1 — Colonist decision log (per colonist):**

Every colonist behavioral decision that produces a significant outcome is logged. Logged events include:

- Need override events (colonist left shift due to critical need)
- Trait expression events (colonist behavior attributed to a specific trait)
- Relationship-influenced decisions (colonist avoided a task because of a Hostile relationship with the assigned collaborator)
- Crisis participation events (colonist contributed to or failed to address a Stage 3+ condition)

Log entry structure:
```
[Day / Time] — [Action taken]
Why: [cause state at decision time — needs, stress, relationship states, active trait]
Outcome: [what resulted]
```

Entries are written in natural language via structured templates with parameter substitution. "Ren refused the emergency repair task." not "TASK_REFUSAL: REPAIR_REACTOR". The simulation state fills the parameters; the template makes it readable.

Log is bounded: last N significant events per colonist, with permanent retention of high-significance events (events that contributed to a crisis, events that changed a relationship state by ≥2 levels, events that activated a new trait expression).

**Tier 2 — Relationship history (per pair):**

Significant interaction events between a colonist pair are logged within the relationship record (ADR-12). Each entry: what happened, affinity score change, resulting state. This is the evidence layer for "why do these two colonists not get along?"

Accessible: Colonist Inspector → Relationships → [select colonist] → History

**Tier 3 — Colony timeline (global):**

A colony-level event stream containing all significant events across all colonists and systems:
- Relationship state transitions (not every affinity drift — only state-level changes)
- Stage 2+ crisis declarations and resolutions (ADR-15)
- Major policy changes and their first visible outcome
- Colonist arrivals and departures

The colony timeline is the primary post-mortem tool: a chronological record of the colony's history that the player can filter and review.

Filter options: by event type, by colonist, by module, by time range.

Retention: the colony timeline is permanent for the duration of a playthrough. It does not decay.

**What is not logged:**
- Routine on-schedule behavior (colonist goes to work on time, eats when hungry, all within normal bounds)
- Need satisfaction within normal ranges
- Resource flows within expected ranges
- Affinity score drift that does not cross a state boundary

**Distinction from colonist memory (ADR-16):**
Colonist memory is a behavioral influence mechanism — it affects what colonists do. The event log is a player access mechanism — it records what happened for human review. A colonist may no longer be behaviorally influenced by an event (memory decayed) while the event remains in the player-accessible log (permanent for high-significance events). These are separate systems with different retention models.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| No event log | Post-mortem is impossible | Pillar 3 and both success tests fail |
| Full simulation trace | Every simulation state change logged | Too voluminous; player cannot find the meaningful events |
| Summary-only log | What happened, not why | Fails the causal legibility requirement of Pillar 4 (Legible Complexity) |

### Consequences

- Natural language templates require a template system with parameter substitution — not AI text generation; structured templates only
- The colony timeline is a permanent record for the duration of a playthrough — multi-hour sessions may accumulate thousands of events; filter design is critical
- Log significance thresholds determine whether the post-mortem is useful — too low: noise; too high: missing causal links

### Risks

- If natural language templates are too generic, all events read identically and the log becomes unreadable
- Significance threshold calibration is prototype-critical — the threshold determines whether the post-mortem shows the player the complete causal chain or shows only the final crisis

### Dependencies

- ADR-08 (Story Frequency — defines what events are story-significant and should be logged)
- ADR-12 (Relationship System — relationship history is tier-2 log)
- ADR-16 (Colonist Memory — distinct from but related to; must not be conflated)
- ADR-15 (Crisis Detection — Stage 2+ events are always logged regardless of other thresholds)

### Revisit Trigger

If post-mortem traces in playtesting are incomplete (significance threshold too high) or unreadable (too much noise); if natural language templates produce descriptions that feel generic or fail to convey causality.

---

## ADR-15 — Crisis Detection and Escalation

**Status:** Accepted

### Context

Crisis is referenced throughout the design as a gameplay phase, a loop element, and the game's primary emotional test. No prior ADR defined what constitutes a crisis, how it escalates, how the player is signaled at each stage, or at what point the speed constraint (ADR-06) activates. Without these definitions, the Crisis phase in gameplay-phases.md cannot be designed.

### Decision

**Four-stage escalation model with defined conditions, distinct player signals, and hard behavior at each stage.**

**Stage 0 — Nominal:**
All systems within expected ranges. No threshold breached. Colony stable signal active (ADR-03). Speed control: unrestricted. Player obligation: observation.

**Stage 1 — Stressed:**
One or more systems approaching a threshold but not yet at risk of failure. Colonist stress levels are elevated but not at behavioral-override level.

*Definition:* Any system health or resource level below a "low" threshold but above "critical"; OR colonist stress levels elevated across ≥30% of the colony.
*Player signal:* Environment base layer shows "Stressed" state for affected systems (ADR-13). No crisis panel. Colony stable signal deactivates.
*Speed control:* Unrestricted.
*Player obligation:* Monitoring attention. No immediate action required.

**Stage 2 — Warning:**
One or more systems at or below a critical threshold, or multiple Stage 1 conditions simultaneously.

*Definition:* Any system health at critical level; OR 3+ systems simultaneously at Stage 1; OR a Stage 1 condition unaddressed for N in-game hours (N to be determined in prototype).
*Player signal:* Crisis fast-access panel activates (ADR-05). Warning indicators on affected elements in the base layer. Colony timeline records entry. Explicit player notification: "Warning — [System] requires attention."
*Speed control:* Maximum 2x.
*Player obligation:* Active attention. Decisions should be queued.

**Stage 3 — Crisis:**
Active failure or imminent cascade.

*Definition:* Any system at failure state; OR Stage 2 condition unaddressed for M in-game hours.
*Player signal:* Full crisis panel. Critical environment state signals (ADR-13). Crisis stage explicitly communicated. Colony timeline records declaration.
*Speed control:* **Maximum 1x. Hard constraint — not player-adjustable.**
*Player obligation:* Active management. All available Category 2 and Category 3 decisions should be in play.

**Stage 4 — Cascade:**
Multiple simultaneous failures. Colony survival is at risk.

*Definition:* 2+ systems simultaneously in Stage 3; OR any life-support system at Stage 3.
*Player signal:* Pronounced colony-wide distress signals. All critical-state indicators active. Crisis panel expanded.
*Speed control:* Maximum 1x (inherited from Stage 3).
*Player obligation:* Triage. Accept that some systems will fail; protect the critical path.

**Per-system tracking:**
Stages 0–4 are tracked per system, not per colony. The colony's overall crisis stage is the maximum across all active systems. This allows partial crisis states (Stage 3 for power, Stage 0 for life support) and prevents a single minor system failure from triggering full colony crisis mode.

**Stage transitions:**
- Escalation: automatic when conditions are met
- De-escalation: automatic when conditions improve (system health returns to Stage 1 or below)
- The colony timeline records both declarations (escalation) and resolutions (de-escalation)
- Post-crisis: affected systems may retain degraded health even after Stage 3 resolves; recovery toward Stage 0 is its own process

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| Binary crisis/not-crisis | Simple but coarse | Player cannot see crisis approaching; goes from stable to critical with no warning |
| Player-declared crisis | Player chooses when they're in crisis | New players may not recognize the signals; inconsistent experience |
| Score-based crisis | Aggregate health score | Loses system-specific legibility; "colony score: 47" has no actionable meaning |

### Consequences

- All four stages require distinct visual treatment in ADR-13 (environment) and ADR-05 (colonist panel)
- The Stage 3 speed constraint activates automatically — must be communicated clearly the first time it fires
- The Stage 1 → 2 progression creates the "watching the crisis approach" experience that is the 30-minute player loop
- The Stage 2 detection timer (N hours) is a tuning parameter that must be set carefully — too short and Stage 3 arrives before the player can act; too long and Stage 2 is harmless

### Risks

- If Stage 1 thresholds are too sensitive, the colony is always in a mild crisis state and the signal loses meaning (the stable signal never appears)
- If Stage 2 → Stage 3 escalation is too fast, the player has no time to respond despite having correct information
- Stage 4 Cascade is the colony failure path — it must feel like the culmination of a traceable chain, not a sudden death. The colony timeline must make Stage 4's cause chain legible in post-mortem.

### Dependencies

- ADR-09 (Maintenance — maintenance failure is a primary crisis source)
- ADR-05 (Colonist State Visibility — crisis panel activates at Stage 2)

*Corrected v0.3.0: ADR-06 removed (circular — ADR-06 depends on ADR-15 for Stage 3 threshold; ADR-15 can define stages without knowing the speed control feature). ADR-13 removed (circular — ADR-13 maps stages to visuals; it depends on ADR-15, not vice versa). ADR-14 removed (circular — ADR-14 depends on ADR-15 for Stage 2+ logging; ADR-15 does not need ADR-14 to define its stages).*

### Revisit Trigger

If playtesting shows Stage 1 is reached constantly (thresholds too sensitive); if Stage 2 → Stage 3 escalation is too fast to respond to; if Stage 4 Cascade feels random rather than traceable.

---

## ADR-16 — Colonist Memory Architecture

**Status:** Accepted

### Context

Colonist memory is defined in the glossary as a first-class concept. Cultural calcification, long-term relationship dynamics, and the mechanism by which early decisions shape colonist behavior over time all depend on colonists retaining some record of past events. Without defined memory architecture, the behavioral continuity that makes the long-term colony loop meaningful cannot be implemented. Memory is distinct from the player-accessible event log (ADR-14) — it is the colonist's internal behavioral influence system, not a player-facing record.

### Decision

**Bounded episodic memory pool with recency weighting and impact-scaled retention.**

**Memory pool structure:**
Each colonist maintains a bounded episodic memory pool. Pool capacity: N significant events (N to be determined in prototype; starting hypothesis: 50–100 events).

A significant event for memory purposes is any event that caused a measurable change in one of:
- Affinity score with any colonist (ADR-12)
- Current stress level
- Colonist's need state (deprivation or satisfaction above a threshold)
- Colonist's behavioral outcome (a decision that overrode the shift schedule)

**Retention and decay model:**

Events in the memory pool have an influence weight:

```
influence_weight = recency_weight × impact_weight
```

- Recency weight: decreases continuously over in-game time from 1.0 at event occurrence toward 0.0
- Impact weight: set at event time based on magnitude of the triggering change (small affinity drift = low impact; crisis participation = high impact)

High-impact events (trauma, bonding moments, crisis participation, significant betrayal) have a lower recency decay rate — they retain influence longer. Low-impact events decay toward zero influence while remaining in the pool.

When the pool is full, the event with the lowest current influence weight is evicted. This means a colonist can retain a distant high-impact event (bonding during a crisis from 40 in-game days ago) while forgetting recent low-impact events (shared a meal yesterday). This produces narrative richness: formative events persist; routine events fade.

**Memory and behavior:**
Memory is an input to behavioral probability weights, not a direct behavior driver:

- A colonist who remembers resource deprivation has a slightly elevated preference for resource security (modifies threshold weights for resource-related decisions)
- A colonist who remembers a positive crisis collaboration has elevated affinity drift rate toward that colonist (modifies ADR-12 affinity score inputs)
- A colonist who remembers being overloaded during a previous crisis has elevated stress accumulation rate when workload conditions repeat

Memory influence is always a weight modifier — it adjusts probabilities, not outcomes. The colonist's current state (needs, shift assignment, relationships) is still the primary behavioral input.

**Memory and cultural emergence:**
Cultural norms are not an explicit system variable. They emerge when multiple colonists in a shared history have similar memory weight patterns. When several colonists share high-impact memories from the same event (they all participated in a crisis, they all experienced the same resource shortage), their behavioral weight modifications align. New colonists arriving into this group encounter a colony that behaves consistently in certain ways — not because culture is a tracked variable, but because the existing colonists' memories converge on similar behavioral tendencies.

**Memory vs. event log (ADR-14):**
These are distinct systems:
- Colonist memory: behavioral influence mechanism; bounded; decays; invisible to the player except through observed colonist behavior
- Event log: player access mechanism; permanent for high-significance events; player-readable through the inspector

A colonist may no longer be behaviorally influenced by an event (memory decayed to near-zero weight) while the event remains in the player-accessible log. The colonist has "moved on"; the historical record has not.

**Phase 1 scope:**
Phase 1 colonist memory focuses on: resource deprivation events, significant relationship events (state transitions — ADR-12), crisis participation. The cultural norm emergence mechanism is architected in Phase 1 but not prominently surfaced to the player until Phase 2. The architecture must support it; the Phase 1 UI does not need to surface it.

### Alternatives Considered

| Option | Summary | Rejected Because |
|---|---|---|
| No colonist memory | Stateless AI; colonists respond to current state only | No accumulation; culture impossible; story weight requires persistent state |
| Unlimited memory | All past events equally retained | Computationally expensive; distant low-impact events accumulate equal influence with recent high-impact events; produces flat behavioral history |
| "Last N events" (recency only, no impact) | Pool retains N most recent events regardless of impact | Formative events are evicted; colonist who experienced a crisis 60 days ago shows no trace of it |

### Consequences

- The pool eviction policy (lowest weight, not oldest) means a colonist who experienced a formative early crisis may still be behaviorally influenced by it 40 in-game days later, while forgetting routine recent events — this produces emergent "personality shaped by history" without requiring an explicit personality evolution system
- Impact scoring at event time requires clear calibration criteria — what makes an event high-impact must be defined consistently

### Risks

- Memory pool size and decay rates are deeply intertwined — calibrating them is prototype-critical
- If impact scoring is too broad (most events are "high impact"), the decay-resistance applies everywhere and memory becomes effectively permanent
- Shared-history cultural emergence (multiple colonists with similar memory patterns) must be robust enough to produce observable behavioral alignment without requiring the player to understand the mechanism

### Dependencies

- ADR-10 (Trait System — trait modifiers produced by sustained conditions require memory of those conditions to be operational)

*Corrected v0.3.0: ADR-12 removed (circular — ADR-12 depends on ADR-16 for interaction history bounds; ADR-16 defines memory architecture independently of the relationship system). ADR-14 removed (informational reference only — "distinct from but related to" is not a blocking dependency).*

### Revisit Trigger

If prototype testing shows colonists "forget" important events too quickly (pool eviction is too aggressive); if shared-memory cultural emergence is not producing observable behavioral alignment in groups of colonists with similar histories.

---

## Decision Log

| Decision | ADR | Rationale | Alternatives Rejected | Revisit Trigger |
|---|---|---|---|---|
| Traits are named tendencies with underlying weights | ADR-10 | Named labels are player-legible; weights are simulation-computable; both are required | Modifier-only (not legible); pure flavor text (not functional) | If players cannot identify traits through observation |
| All traits must have a Tier 1 observable expression | ADR-10 | A trait that can only be seen in the inspector is a hidden parameter, not a trait | Hidden-but-functional traits | If trait count exceeds what Tier 1 can express distinctly |
| Four policy scopes with cascade conflict resolution | ADR-11 | Module-level differentiation is required; without scope the player cannot manage critical vs. general areas distinctly | Global scope only; flat scopes with no cascade | If scope interactions produce behavior players read as bugs |
| Three-tier rhythm: shift / need override / trait tendency | ADR-01 | Provides a learnable baseline (shift) + urgency legibility (need override) + individual character (trait tendency) | Need-only (no baseline); shift-only (no character); trait-only (no predictability) | If players cannot learn the baseline within first hour |
| Events are condition-triggered, not clock-triggered | ADR-02 | Clock-triggered events produce predictable scripted patterns; conditions produce emergent timing | Clock-triggered shift changes | If condition-triggered transitions produce behavior players read as errors |
| No UI mode locks — always-on decision access | ADR-03 | Mode switching creates friction that interrupts the observation-decision flow | Dual observe/act modes; signal-gated decisions | If always-on access produces compulsive over-intervention |
| Colony stable is a positive visual state, not absence of warnings | ADR-03 | "No warnings" and "stable" are distinct experiences; stable must have identity | Treating stable as the default absent state | If stable signal is not legible enough to communicate "nothing needs action" |
| Emergency command category removed | ADR-07 | Emergency commands (immediate colonist commands) violate Pillar 2 (Conditions, Not Commands) | Emergency commands with social cost | If absence of emergency commands makes Stage 3 crises feel outside player control |
| Stage 3+ crisis constrains speed to 1x | ADR-06 | "Waiting for consequences" is the game's intended third state; fast-forward through consequences allows players to opt out of the design | Unconstrained speed control; player-adjustable crisis speed | If players experience the constraint as punitive rather than appropriate |
| Maintenance is preventive + reactive; both skill-qualified | ADR-09 | Collapsing them risks trivially solvable resource layer; distinct levers produce distinct gameplay moments | Unified maintenance model | If reactive maintenance crises never feel urgent due to easy coverage |
| Relationship affinity: continuous score, discrete named states | ADR-12 | Continuous score enables gradual drift; named states are player-legible; both are required | Score-only (not legible); states-only (transitions feel arbitrary) | If state transitions feel stepped and artificial |
| Story events are threshold-crossing behavioral decisions | ADR-08 | Defines story events precisely enough to implement; excludes routine behavior without scripting what's "interesting" | Random event rolls; scripted authored events | If story event frequency is too low or too high in prototype |
| Event log and colonist memory are distinct systems | ADR-14/ADR-16 | Memory influences behavior (simulation); log enables player access (UI). Conflating them produces wrong retention models for both | Unified log-and-memory system | If players cannot distinguish "colonist behavior" from "recorded history" |
| Four crisis stages with per-system tracking | ADR-15 | Per-system staging allows partial crisis states and prevents minor failures from triggering full colony crisis mode | Colony-wide single crisis state; player-declared crisis | If Stage 1 thresholds are too sensitive and stable signal never appears |

---

## Kanban Update

**Card:** [Phase 1] Architecture Decision Review + Revised ADR Set
**Status:** Review — Human Approval Required (Tier 3 document set)

**Decision Log:**

| | |
|---|---|
| **Decision** | Emergency command category removed from ADR-07 |
| **Reason** | Emergency commands (direct immediate colonist commands regardless of crisis) violate Pillar 2 (Conditions, Not Commands). The original recommendation introduced a direct-command mechanic through the justification of crisis necessity. Removing it forces the game to be designed so that crisis is survivable through prior conditions — which is the game's actual design intent. |
| **Alternatives Considered** | Emergency commands with social/morale cost; all decisions delayed with no immediate action available |
| **Rejected Because** | Emergency-with-cost: cost would be tuned to be bearable, making emergency override the dominant strategy. All-delayed: makes Stage 3+ crisis completely non-interactive for the player, which is too harsh a consequence for not understanding the design in the first game. Category 3 (infrastructure routing) provides immediate interaction without commanding colonists. |
| **Future Revisit Trigger** | If playtesting shows Stage 3 crises produce consistent frustration feedback rather than narrative engagement — reconsider a limited emergency-with-severe-cost mechanic, but only as a last resort and with explicit Pillar 2 amendment |

| | |
|---|---|
| **Decision** | ADR-10 and ADR-11 elevated to Critical blocking status |
| **Reason** | ADR-01 (Colonist Rhythm) cannot be finalized without knowing what traits are structurally. ADR-04 (Policy Shape) cannot be finalized without knowing what policy scopes exist. Both are foundational dependencies that were absent in the original ADR set. Proceeding without them would produce downstream designs that contradict each other when the missing systems were eventually defined. |
| **Alternatives Considered** | Proceeding with ADR-01 and ADR-04 while leaving trait and scope as implementation details |
| **Rejected Because** | Trait interaction with rhythm and scope interaction with policy are architectural decisions, not implementation details. Deferring them produces designs that must be revisited when the implementation discovers the dependency — which is more expensive than deciding now. |
| **Future Revisit Trigger** | If ADR-10 and ADR-11 prove simpler than expected to decide — consolidate into their dependent ADRs to reduce document count |

**Files produced:** `design/architecture-decision-set.md`

**Next:** ChatGPT review → Human approval → if approved, unblock ADR-10 and ADR-11 for acceptance → then revise ADR-01 and ADR-04 as Accepted → then remaining ADRs can proceed to Accepted status in dependency order
