# Colony Life

**Scope:** Player-observable colonist life during Phase 1 (single station, up to 24 colonists)
**Authority:** Vision documents, gameplay documents, ADR-01 through ADR-16 (Accepted)
**Boundary:** This document describes what the player observes. It does not define need degradation rates, social action state machines, or AI algorithms. Those belong to Phase 2 ADR-17 and ADR-18.

---

## What This Document Is

design/colony-life.md describes the texture of daily life in the colony — the rhythms, the deviations, the slow burns, the moments that become stories. It answers the question the player is always implicitly asking: *what is actually happening here?*

It is written from the player's perspective. It describes what the player sees, what the player can infer, what the player can act on, and what the player cannot control. It does not describe how the simulation produces these experiences.

---

## The Ordinary Day

An ordinary day in the colony begins before the player makes a single decision.

The shift transition happens. Colonists whose rest period has ended move toward their work assignments. The station shifts — briefly, almost imperceptibly — from the low movement of rest to the directed movement of productive work. This is the clearest visual signal the game produces: not a status bar, not a notification, but the colony waking up. If the player was watching, they see it. If they were at 4x speed, they feel it as a texture change.

For the next stretch of time, the colony does what it was designed to do. Workers move with purpose toward their modules. The station's systems run — oxygen, power, water cycling through their expected flows, visible as a calm conduit state in the base layer. Some colonists pass each other in corridors and continue walking. Others slow slightly, an interaction flicker, then separate. Nothing has happened yet.

About two-thirds into the work period, the first small deviations appear. A colonist breaks from their path to stop at the food station — not for long, just a brief interruption before returning to work. This is a low-level need being satisfied at the shift's first available moment. It is expected behavior. The player who notices it correctly reads "this colonist was getting hungry but it was not urgent." The colonist returns to work. The deviation passes.

The work period ends. Shift transition: colonists move toward rest areas. Almost everyone transitions smoothly. One colonist stays on task for slightly longer — they were in the middle of something, and the shift boundary was not the right moment to interrupt. They finish, then rest. Another colonist who has been in the same module all shift pauses briefly at the door before leaving, as if reluctant. These are character textures, not signals. The player who notices them is building a model of who these people are.

The rest period: low movement, distributed across the station. Colonists eat, sleep, or move through the free portions of the station. Some drift toward specific areas — not because they were assigned there, but because something about the space or the people in it pulls them. A pair who have been developing positive affinity are visible spending their free period in the same general area, not necessarily interacting but near each other. Another colonist moves specifically away from where someone else is resting. These spatial patterns are the colony's social map expressed in movement.

Then the cycle repeats.

This is an ordinary day. No crisis. No threshold crossed. Just the colony running as designed, with small individual variations that compose into something that looks, collectively, like a community.

---

## The Shift Rhythm as a Player Tool

The shift skeleton is the player's primary reference for "normal." Everything meaningful in the colony reads against it.

When a colonist does something unexpected mid-shift, the player notices because the expected pattern is legible. "That colonist should be working right now, but they are at the food station" is a readable signal only because the player knows what the shift says that colonist should be doing. The shift skeleton creates the baseline against which deviations are readable as information.

The player sets the shift through policy: how long the work period runs, when rest begins, how free time is distributed. The colony's response to those conditions is what generates the observable day. A shift policy that allows inadequate rest time does not announce itself as a mistake — it manifests as a gradual increase in fatigue signals, in small deviations from the shift skeleton that accumulate over days before becoming a crisis.

**What the player reads in the shift rhythm:**

- A colonist on-task during their assigned work period: normal, expected, no signal
- A colonist seeking food during their work period at a low-urgency moment: normal, minor, the system is managing itself
- A colonist leaving their work station at an unexpected time: deviation signal — something exceeded a threshold
- A colonist who does not appear to be resting during their rest period: stress or social signal — free time is not being used to recover
- Shift transitions that happen late or not at all: a colonist is in a safety-critical situation, or the shift policy is producing unintended friction

The shift is not a timer. It is a contract between the player's conditions and the colonist's behavior. Deviations from it are the colony communicating back.

---

## What the Player Reads at a Glance

The colony communicates primarily through behavior and visual state. The player does not need to open an inspector to understand that something is wrong. By the time something is wrong enough to be crisis-level, it has been visible in ambient signals for some time.

### Seven Behavioral States (Tier 1 — always visible)

Every colonist at any moment displays one of seven readable states. These are distinguishable at overview zoom:

| State | What the player sees | What it means |
|---|---|---|
| **Working** | Directed movement, task-focused posture, colonist is where their shift says they should be | Normal — colonist is executing their assignment |
| **Resting** | Low movement, settled posture in a rest area | Normal — colonist is in rest period |
| **Eating** | At a food station, brief stationary pause | Normal — a need is being satisfied during an appropriate moment |
| **Socializing** | Slow or stationary near another colonist, both facing each other | Colonist is in free time with social contact — positive or neutral depending on context |
| **Stressed** | Erratic or slowed movement, avoidance of direct paths, posture signals tension | Stress threshold elevated — this colonist is accumulating pressure |
| **Blocked** | Motionless but not in rest or eating state, not on task | The colonist cannot do what they are trying to do — pathfinding failure, resource unavailable, or access blocked |
| **In Conflict** | Two colonists in proximity, neither moving toward a task, facing each other with tension posture | Active interpersonal friction — this pair is at a state where proximity generates friction |

At 24 colonists, these states compose into a readable picture of colony health. A station where most colonists are in Working or Resting states, with a few in Eating or Socializing during appropriate periods, is a healthy colony. A station where several colonists are simultaneously Stressed, a pair are In Conflict, and a Blocked colonist has been standing in the same corridor for two in-game hours is not.

**Critical state exception:** A colonist at a critical need threshold or in a Fractured relationship state carries a small always-visible icon overlay, even at overview zoom without hovering. This is the only ambient icon. It communicates: this requires attention now.

### The Environment Layer (always visible)

The station's modules communicate their health state through their appearance:

| Module State | What the player sees | What it means |
|---|---|---|
| **Nominal** | Clean, normal appearance | All systems within spec; preventive maintenance adequate |
| **Stressed** | Subtle surface wear, slight color shift | Preventive maintenance is falling behind — not yet dangerous, but trending |
| **Warning** | Visible flickering, warning-tint coloration | System health is at a critical threshold; this module needs attention |
| **Critical** | Pronounced distress signals, alarm-level visual change | Active failure state; a system is failing now |
| **Failing** | Active failure visuals, full-system distress | This system has failed; cascade risk if not addressed |

The player does not need to toggle an overlay to read Nominal, Stressed, or Warning. These states are visible on the module surfaces at all times. Overlays provide precise diagnostic data (flow rates, capacity utilization); the base layer provides actionable signal.

Resource conduits — the pipes, power lines, and flow infrastructure — show a simplified three-state signal in the base layer: **Active flow**, **Reduced flow**, **No flow**. If power is getting to the habitation module, the player can see it without opening the power overlay. If it is not, they can also see it.

### The Stable Signal

When the colony is genuinely stable — all colonists in expected behavioral states, all module systems at Nominal, no critical-state overrides active — the station communicates this as a positive visual identity. The stable state is not the absence of warning signals. It has its own character: a particular quality of movement, a particular visual tone in the module surfaces, a quiet in the conduit layer.

The player learns to recognize this state. When it is present, they know that observation is sufficient and that no decision is required right now. When it begins to erode — when the first colonist shifts to Stressed, when the first module begins to show Stressed surface wear — the player recognizes the change because they know what stable looked like.

---

## What Disrupts the Ordinary

Disruptions are not failures. They are the colony communicating that conditions have changed. Most disruptions are small. Some compound. Some become crises. The player's job is to read them early enough that the compounding doesn't happen without their knowledge.

### Need Overrides

The first kind of disruption is a colonist behaving inconsistently with their shift assignment because a need has become too pressing to defer. This is visible at Tier 1 as a colonist who is in an unexpected location during a work period — not the Stressed or In Conflict state, just a colonist who is somewhere they shouldn't be according to the shift.

A colonist who has not rested adequately for several consecutive shifts eventually finds that their body does not cooperate with the schedule. The player sees this as a work-period deviation: the colonist moves toward a rest area during a time when they should be working. The player who has been watching knows why — the shift policy has not provided adequate rest, and the colonist has crossed a critical threshold. The player who has not been watching learns about it in the inspector, which will show the history.

A more urgent version: a colonist at a critical need threshold overrides their shift immediately, without waiting for an appropriate moment. The movement is faster and more direct. It reads differently from the low-level version — there is urgency in the behavior, not just inconvenience. The always-visible critical icon is active.

These deviations are readable as a signal about the shift policy and the needs it is or is not meeting. A player whose colonists frequently deviate from their shift assignments has a shift policy that does not fit the colony's actual needs. A player who never sees any deviation may be underworking the colony, or may have calibrated exceptionally well.

### Relationship Signals

The second kind of disruption is behavioral change in pairs of colonists who have developed a notable relationship state.

**Tense and Hostile pairs** become visible before the player reads the relationship inspector. A pair who share a module begin to avoid direct interaction — they work, but there are small avoidance movements, a reluctance to occupy the same close space. Task efficiency in shared modules declines slightly, not dramatically, but enough to notice in a player who is paying attention. The module that is producing slightly less than it should may be the first signal that two people working there are in friction.

At Hostile, the avoidance becomes pronounced. The two colonists show clear behavioral preference to not be in the same space. If their shift assignments require them to share a module, the friction becomes active — the In Conflict state may appear during the shared work period.

**Bonded pairs** disrupt the ordinary in a positive direction. Two colonists who have reached a Bonded relationship state show proximity preference that exceeds what their shift assignment requires. During free time, they are near each other. During shared work periods, there is a quality of coordination in their movement that distinguishes them from two colonists who happen to be working in the same module. If one of them is in difficulty — if a critical need override fires, or if stress is elevated — the other may adjust their behavior toward covering or support. The player sees this as a behavioral deviation with a different quality: not dysfunction, but relationship.

**New arrivals** produce a specific kind of social disruption. A colonist who joins an established social group encounters people who already have histories with each other. The newcomer's integration pattern is readable over several days: who do they gravitate toward, who do they avoid, which existing relationships does their presence affect? A new colonist who happens to have a personality that creates friction with an already-Hostile pair has arrived at a bad time. A new colonist who naturally gravitates toward an isolated colonist may produce the colony's most unexpected Bonded pair.

### Trait Expressions

The third kind of disruption is individual — a colonist doing something unexpected for their specific character.

Colonist traits are not disclosed at arrival. They reveal themselves through observation. The player who watches their colonists closely over the first several in-game days begins to notice patterns: a colonist who always initiates social contact first, a colonist who works slightly past the end of their shift without being asked, a colonist who responds to stress by moving toward a specific type of space.

A trait expression is the moment a pattern becomes undeniable. The player has been watching a colonist who seems to recover from stress faster than others — and during a colony-wide stressed period, that colonist is visibly calmer than their peers. That is a trait becoming legible. Or a colonist the player has been watching for signs of social preference finally, under a specific set of conditions, does something that makes the preference explicit — covers for a colleague at personal cost, or refuses a task assignment that the player gave them because of who else is assigned to it.

Trait expressions are disruptions only in the sense that they surprise the player. A colonist who has not yet expressed a trait is a legible but unspecified person. A colonist who has expressed several traits is someone the player has an opinion about.

### Maintenance Decline

The fourth kind of disruption is environmental — a module whose health state is drifting from Nominal toward Stressed, and from Stressed toward Warning.

This disruption is the slowest and the most predictable. The player who is allocating adequate qualified colonist time to preventive maintenance sees their modules remain Nominal. The player whose maintenance allocation is insufficient begins to see Stressed surface wear accumulate. This is not urgent — it is a signal that the trend is going the wrong direction. The player has time to address the policy before Warning.

The disruption becomes significant when a colonist who would normally perform preventive maintenance is unavailable — not because the policy is wrong, but because the maintenance-qualified colonist has a need override, or is in a Hostile relationship with their assigned co-worker, or is in the Stressed behavioral state and producing below their normal capacity. The resource layer and the people layer intersect here. An engineer who is a qualified maintenance worker in a Hostile relationship with the other maintenance-qualified colonist in their module is a person-layer problem expressing as a maintenance-layer risk.

---

## How Stories Form

Stories do not begin as stories. They begin as small movements in the simulation that the player may or may not notice.

An affinity score drifts. A stress level accumulates. A trait is expressed under a new set of conditions. None of these are story events on their own. They are the slow accumulation of simulated experience.

The story event is the threshold crossing — the moment when the affinity between two colonists reaches a state transition, when stress accumulation produces a behavioral change that reads differently from anything the player has seen from this colonist before, when a trait expression under crisis conditions reveals something about a person that the player has been trying to understand.

The player who has been watching knows the threshold crossing as a *finally* moment — finally Ren and Sasha have moved from Tense to Hostile, the player saw it building for three days. The player who has not been watching experiences it as a *sudden* moment — suddenly two of their best maintenance workers are refusing to share a module.

The distinction between the sudden and the finally is the game's core teaching. The simulation was always visible. The signals were always there. The player who pays attention gets the *finally*. The player who does not gets the *suddenly*, and the post-mortem.

### Story Shapes That Emerge

These are not scripted story types. They are the shapes that regularly emerge from the combination of the simulation systems, described so the player knows what they might be watching for.

**The Slow Fracture:** Two colonists who work closely together accumulate negative affinity — not from any single dramatic event, but from sustained friction. Incompatible traits. Too much forced proximity during stressful periods. Small avoidances that compound. The player can see this building if they check the relationship inspector, or infer it from the behavioral signals — the In Conflict state appearing more frequently, the avoidance pattern in shared spaces. The story ends either with the player separating them through policy, or with the relationship reaching Fractured and becoming a structural problem.

**The Crisis Bond:** Two colonists who were Neutral or Acquainted before a major crisis come through it with significantly elevated affinity. Crisis participation generates high-impact memories in both of them — the shared experience of danger and mutual support is more relationship-forming than months of ordinary proximity. The player may not have been tracking this pair before the crisis. After it, they are a pair.

**The Expert Under Pressure:** A highly skilled colonist — the player's best engineer, their most capable life-support technician — is also the most stressed, in the most difficulty socially, or in a Fractured relationship with the person they would need to work alongside during the crisis that is now unfolding. The skill is real. The incapacity is real. The player must decide whether to try to work with what they have or to accept that this crisis will be worse than it needed to be because the person most equipped to handle it is not in a position to.

**The New Blood:** A colonist arrives after the colony has been through several crises and has a developed social structure. This colonist is a stranger to everyone. They encounter informal hierarchies — colonists whose behavior during crises has given them elevated standing in the eyes of others, pairs who are Bonded and self-contained, colonists who are isolated or marginalized. The newcomer's path through this existing structure is the story. The player can influence it through assignment policy, but they cannot write it.

**The Quiet Calcification:** No single dramatic event. No crisis. Just the accumulated pattern of the player's decisions slowly shaping the colony's character. A policy that was set in week one is still running in week eight, and the colony has formed around it — the social structures, the informal hierarchies, the behavioral tendencies of long-term colonists. The player looks at the colony they have built and realizes it has become something specific. Not what they designed, exactly. What happened.

---

## The Healthy Colony

A healthy colony has a particular quality that is recognizable before the player can articulate what they are seeing.

Movement is purposeful. Colonists during their work periods are going somewhere or doing something. Colonists during rest periods are actually resting — the rest areas have occupants, and those occupants are still. The free periods show variation: some colonists socialize, some explore, some seem to prefer being alone. The variation is character, not dysfunction.

The modules are Nominal. The resource conduits show Active flow. There are no always-visible critical icons on any colonist. The stable signal is present.

The relationships visible in the inspector are mostly Neutral and Acquainted — the default states for colonists who have not yet developed significant history together. A few pairs have moved to Positive, perhaps one pair toward Bonded. There are no Hostile or Fractured entries in the log.

The player running at 4x speed during a healthy period is not missing critical signals. There are no critical signals to miss. The colony is running as designed, and the player's job is to watch and wait.

**What health is not:**

A healthy colony is not silent. There are need satisfactions happening, small social interactions accumulating, trait expressions manifesting in quiet ways. Healthy is not inert — it is stable with texture.

A healthy colony does not mean no colonist is ever Stressed. Stress is a normal response to demanding conditions. A healthy colony is one where stress does not accumulate to the point where behavioral thresholds are being crossed, where the sources of stress are visible and manageable, and where the rest periods are providing adequate recovery.

A healthy colony does not mean all relationships are Positive or Bonded. Neutral is normal. Acquainted is normal. The colony does not need everyone to like each other. It needs the Hostile and Fractured relationships to be rare and managed.

---

## The Colony Under Strain

A strained colony communicates through the same channels as a healthy one. The content changes.

More colonists are in the Stressed behavioral state. Movement in the station has a different quality — more erratic, more avoidance routing, less directed. The Eating state appears at unexpected moments — colonists satisfying needs that a well-calibrated shift would have addressed during the appropriate period. One or more modules has shifted from Nominal to Stressed surface appearance.

At this level, nothing has failed. The colony is managing. But the player who is reading it correctly sees that the trend is going in the wrong direction. The resource allocation that was adequate last week is not adequate this week. The colonists who were getting enough rest are now showing signs that they are not. The pair who were Neutral are now showing avoidance signals that suggest they are moving toward Tense.

This is the period when good decisions are cheapest. A policy adjustment here — more rest time, a shift reassignment, increased preventive maintenance allocation — costs very little because nothing has failed yet. The player who makes these decisions correctly may never see a crisis emerge from this strain. The player who does not address it is not making a mistake they will understand until later.

**The transition from Strained to Warning:**

The moment a module shifts from Stressed to Warning appearance, the crisis panel activates. The player is notified. The colony timeline records an entry. Speed control is capped at 2x.

This is the game's clearest signal: attention is required. The colony was communicating before this point. Now it is communicating with urgency.

---

## When the Colony Breaks

A Stage 3 crisis has a different texture from everything before it.

Speed control caps at 1x. This is not optional. The game is not slowing down — it is holding the player in the moment. A crisis is not something to fast-forward through. It is a situation to inhabit.

The station's critical modules are in pronounced distress. The crisis panel shows every colonist at a critical state and every system at Warning or worse, in a single scannable view. The player can inspect any item in the panel without changing their zoom level. They do not need to hunt for what is wrong. It is being shown to them.

**What the player can do during a crisis:**

Infrastructure routing decisions are immediate. The player can reroute power, redirect resource flow, toggle system switches — these take effect now, not at the next shift boundary. The player is changing the station's physical conditions. Colonists respond to those changed conditions on their own.

Policy decisions are queued for the next shift boundary, still visible as pending and cancellable. The player may make policy decisions during a crisis. They will not take effect instantly.

Construction decisions are queued for when the work is complete. They are rarely the right lever during an acute crisis.

**What the player cannot do during a crisis:**

The player cannot tell a specific colonist to do a specific thing. The player who prepared — who allocated adequate maintenance capacity, who did not let Hostile relationships compound in their engineering team, whose shift policies provided adequate rest — has colonists positioned to respond to the changed conditions on their own. The player who did not prepare has a colony that is doing what the conditions produce.

This is the intended experience. The crisis is a consequence of prior conditions. The player's agency during the crisis was exercised in the days before it.

**The cascade:**

If a Stage 3 crisis is not addressed, or if the conditions that produced it remain unresolved, it may escalate to Stage 4. Multiple systems fail simultaneously. The colony's survival is at risk.

Stage 4 Cascade is not sudden. It is the culmination of a traceable chain: the Stressed module that became Warning because the maintenance allocation was insufficient, the qualified engineer who was not available because of a Hostile relationship that was not addressed, the policy decision that was not made because the player was not watching closely enough when the signal was there.

The colony timeline records this chain. The player who opens the post-mortem after a collapse can read it.

---

## The Aftermath

When a Stage 3 crisis resolves — one way or another — the colony is not the same as before.

If the colony survived, it survived at a cost. Colonists who participated in a crisis carry high-impact memories of it. A colonist who helped contain a life-support failure at personal cost has a different behavioral weight pattern than they had before. A colonist who was in a Fractured relationship with another colonist when they were forced to work together during a crisis may emerge from it with that relationship changed — for better or worse, depending on what happened during those hours.

The crisis participation memories are among the most persistent in the colonist memory system. Long after the colony has returned to nominal operation, the colonists who were there still carry the event. The player who watches carefully may see a pair of colonists who were never particularly close developing a positive behavioral drift — because they were in the same module during the worst of it, and memory is shaping them toward the person who was also there.

Module health after a crisis may be degraded even after the crisis stage has resolved. A system that failed and was reactive-repaired is running, but it is not running at full health. It requires sustained preventive investment to return to Nominal. If that investment is not made, the next maintenance decline starts from an already-compromised baseline.

**The post-mortem:**

After a crisis, the player can access the colony timeline and read the event sequence. Not a summary — the actual sequence of significant events: which systems declined in what order, which colonist behavioral thresholds were crossed and when, which policy decisions were pending when the cascade reached Stage 3.

The Dinner Table Test passes or fails in the post-mortem. A player who can trace the complete chain — "the oxygen system declined because the maintenance engineer was in a Hostile relationship with their partner, because of a friction that started in the second week when they were assigned to the same module during a high-stress period, which I could have addressed but didn't" — has experienced what this game is for.

---

## Decisions the Player Makes in Colony Life

During ordinary colony life, the player's decision cadence is slow by design. Most of the time, the player is watching, not acting.

**When the player acts:**

- They notice a pattern in a colonist's behavior that suggests a shift policy mismatch and adjust the policy
- They observe the beginning of a relationship friction signal between two colonists and consider a personnel reassignment before it compounds
- They see Stressed surface wear on a module and check whether their preventive maintenance allocation is adequate
- They identify a colonist who has been socially isolated for an extended period — no significant relationships, always in the non-social behavioral states during free time — and consider whether a shift reassignment to a different module mix would change their social exposure
- They notice that a colonist who was one of their most reliable is now consistently showing Stressed state and check the inspector to understand why

**When the player consciously does not act:**

- Two colonists in a Tense state are managing without the friction escalating — the player watches but does not intervene
- A new arrival is finding their social footing slowly — the player trusts the process and watches
- A crisis resolved with costs the player did not want to accept, and now the colony is in recovery — the player lets the recovery happen without creating new disruptions

The inaction decision is as real as the action decision. A player who intervenes every time they see a signal creates new disruptions. The art of colony management is knowing which signals to act on and which to observe.

---

## Design Decisions

### Decision 1: Colony Life Is Described at the Observation Layer Only

**Choice made:** All content in this document describes player-observable phenomena. It does not define need taxonomy, social action vocabulary, degradation rates, or behavioral formulas.

**Why:** The freeze report explicitly establishes that design/colony-life.md operates at the gameplay design level. Implementation decisions belong to ADR-17 and ADR-18 (Phase 2). This document describes what the player sees and experiences; it does not specify how the simulation produces those experiences.

**Implication:** Developers writing the AI system must produce the observable behaviors described here. How they produce them is architecturally constrained by the accepted ADRs, not by this document.

### Decision 2: Stories Are Named as Shapes, Not Types

**Choice made:** The story shapes described in this document (The Slow Fracture, The Crisis Bond, etc.) are not designed event types. They are descriptions of the patterns that regularly emerge from the simulation systems as understood from the architecture.

**Why:** Naming them as scripted types would imply authorship. Naming them as observable shapes preserves the "every story is true" principle (Pillar 3) while giving the player vocabulary to understand what they might be watching for.

**Implication:** No story shape in this document should require a special-case trigger or scripted condition in the simulation. If a story shape only occurs through a designed event, it has been authored, not generated.

### Decision 3: The Healthy Colony Is Described Before the Unhealthy Colony

**Choice made:** This document describes what a healthy, stable colony looks and feels like before describing strain and crisis.

**Why:** The player needs a baseline to recognize deviations. The 30-second observation loop (core-loop.md) depends on knowing what normal looks like. The stable signal (ADR-03) is the player's most important reference point, and this document should establish it clearly before introducing the signals that deviate from it.

### Decision 4: The Post-Mortem Is Part of Colony Life

**Choice made:** The aftermath and post-mortem sections are included in this document, not separated into a crisis document.

**Why:** The Post-Mortem Test (vision.md) is one of the four success metrics for the game. The experience of understanding what happened is not separate from colony life — it is the culmination of it. Including it here frames crisis and its aftermath as part of the continuous experience of managing a colony, not as a special mode.

---

## Risks

### Risk 1: The Seven Behavioral States Are Insufficient as Colony Scale Grows

**Description:** The seven ambient Tier 1 states (Working, Resting, Eating, Socializing, Stressed, Blocked, In Conflict) were defined for Phase 1 at up to 24 colonists. As AI behavior grows more complex, the simulation may produce behavioral conditions that do not map to any of the seven states. These conditions would be invisible at Tier 1.

**Mitigation:** ADR-05 includes an explicit revisit trigger for this case. The seven states must be revisited before AI behavior design begins (Phase 2). If additional states are required, the art and animation system must support them before implementation.

**Severity:** Medium — the seven states are a design commitment, but the architecture explicitly anticipates expansion.

### Risk 2: Story Shapes Become Player Expectations

**Description:** If players learn to expect the named story shapes (The Slow Fracture, The Crisis Bond, etc.), they may experience the simulation as scripted when these shapes do not emerge on a given playthrough.

**Mitigation:** The story shape names should not appear in in-game text or UI. They are vocabulary for the design team, not player-facing labels. The simulation generates them; the player discovers them. A player who discovers that two colonists slowly fractured has a different experience from a player who was told to watch for The Slow Fracture.

**Severity:** Low — this risk is in how the material is communicated externally, not in the simulation design.

### Risk 3: Inaction Is Undervalued as a Decision Type

**Description:** Players trained by other management games default to constant intervention. If the game does not actively reward observation and patience, players may over-intervene and create disruptions where the colony would have stabilized on its own.

**Mitigation:** ADR-03 notes that policy changes during stable periods produce downstream friction even when the policy is reasonable. This natural cost of unnecessary intervention is the corrective mechanism. However, this correction requires the player to trace the consequence — which requires post-mortem literacy. The first-time player may not connect their intervention with its downstream disruption.

**Severity:** High — this is the central behavior the game needs to teach, and it is the hardest to teach without tutorial prompts.

### Risk 4: The Aftermath Period Has No Clear Player Arc

**Description:** After a crisis resolves, the colony enters a recovery period with no clear endpoint signal. The player may not know whether the colony has fully recovered or whether latent damage from the crisis is still present in colonist memories and module health.

**Mitigation:** The three-tier visibility system (ADR-05 inspector, ADR-14 story access, ADR-13 environment layer) provides the information needed to assess recovery. The player can read module health states returning to Nominal, can check colonist decision logs for post-crisis behavioral stabilization, and can review the colony timeline. The risk is that players who do not use these tools will feel that the aftermath is opaque.

**Severity:** Medium — addressed by the legibility architecture, but requires that the post-mortem and inspection tools are actually learnable.

### Risk 5: Colony Life Feels Richer in Description Than in Experience

**Description:** This document describes a colony that is rich in behavioral signals, emergent social texture, and readable moment-to-moment character. The actual experience depends entirely on the quality of colonist AI and animation — two systems that are Phase 2 implementation deliverables. The gap between what this document describes and what the prototype produces may be significant.

**Mitigation:** The architecture (ADR-05, ADR-10, ADR-12, ADR-08) is designed to produce the observable behaviors described here. However, the richness of the observation layer is an implementation quality question. Early prototypes should be evaluated specifically against: "Is there a moment in the first hour where a player says 'oh, that colonist is doing something interesting'?"

**Severity:** High — the highest risk in this document. The description is aspirational; the implementation is the proof.

---

## Open Questions

**OQ-1 — Need Vocabulary in Player-Facing Text**
This document describes needs at the observable level (a colonist who has not rested enough, a colonist satisfying hunger). The actual names of colonist needs are not defined here (ADR-17, Phase 2). Before the colony-life UI is designed, the player-facing need vocabulary must be established. Question: when the player hovers over a colonist and sees a need-level summary icon (ADR-05 Tier 2), what words do those icons use?

**OQ-2 — Social Interaction Vocabulary in Player-Facing Text**
The document describes social interactions as visible behaviors (colonists facing each other, proximity patterns). When the player opens the colonist decision log (ADR-14), and a social event is logged, what language does that entry use? This requires the social action vocabulary (ADR-18, Phase 2) to be defined before the log template system is written.

**OQ-3 — The Stable Signal's Art Direction**
ADR-03 commits to a stable signal that has a positive visual identity, not just the absence of warning signals. This document references it as a design commitment. What does it actually look like? This is an art direction and UI design question that must be answered before the station visuals are implemented.

**OQ-4 — The Aftermath Duration**
This document describes the aftermath period as having no clear endpoint signal, and identifies this as a risk. Should there be a legible signal that communicates "the colony has returned to baseline after the crisis"? If so, what form does it take without violating the anti-notification design of ADR-03?

**OQ-5 — Colonist Memory and Story Continuity**
This document references colonist memory (ADR-16) as the mechanism by which crisis participation shapes future behavior. The player-observable consequence — a pair of colonists showing unexpected positive drift because they shared a crisis — requires that the memory influence is legible without the player needing to understand the memory system. Is the behavioral change after a crisis observable enough to produce the "I wonder why these two are suddenly close" moment, or does it require the player to read the inspector to notice it?

**OQ-6 — The Isolation Problem**
This document mentions colonist isolation as something a player might notice and respond to through shift reassignment. But a colonist who does not develop significant relationships — who drifts through the Acquainted state with most colleagues — may not produce any negative signals in the early game. The isolation problem may only become visible when the colony is under stress and that colonist has no social support structure. Is there a player-observable early signal for colonist isolation, or is it only visible in retrospect?

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Document describes observation layer only; no need counts, names, or degradation rates | Scope boundary from architecture-freeze-report.md v1.1.0; ADR-17 and ADR-18 are Phase 2 | Including specific need taxonomy (would be an unauthorized implementation decision) |
| Story shapes are named as observable patterns, not event types | Pillar 3 (Every Story Is True); authored story types violate the generation principle | Scripted story types with defined triggers |
| Healthy colony described before unhealthy | Legibility requires a known baseline; the stable signal (ADR-03) is the primary player reference | Starting with disruptions (would establish disruption as the default expectation) |
| Post-mortem included in colony life, not separated | Post-mortem Test is one of four success metrics; the aftermath is continuous with colony experience | Separate crisis/post-mortem document |
| Inaction is framed as an equal decision type alongside action | player-fantasy.md: "Inaction decisions" are one of five core decision types | Framing inaction as a fallback or lesser option |
| The seven behavioral states are reproduced as a reference table | Players need this vocabulary to understand what they're reading; reproducing it from ADR-05 makes this document self-contained | Reference-only to ADR-05 (would require cross-document lookup to use this document) |

---

## Kanban Update

**Card:** [Phase 1] Write design/colony-life.md
**Status:** Complete — Human Review Required (Tier 3 document)

**Completed:**
- ✅ design/colony-life.md — written within approved scope boundary

**This document unblocks:**
- ⬜ [Phase 2] ADR-17 — Need System Architecture
- ⬜ [Phase 2] ADR-18 — Social Action Space Architecture
- ⬜ Colony-life UI design (dependent on OQ-1, OQ-2, OQ-3 answers)
- ⬜ Colonist AI behavior specification (Phase 2)
- ⬜ Art direction for behavioral states and module health visuals (OQ-3)

**Remaining Phase 1 design documents (not yet started):**
- design/station-design.md — physical layout, module types, spatial constraints
- design/crisis-design.md — crisis scenarios, post-mortem design, player experience of Stage 3-4
- design/policy-design.md — named stances, player-facing policy vocabulary, scope UI

**Uncommitted working tree:**
- design/core-loop.md
- design/player-journey.md
- design/gameplay-phases.md
- design/architecture-decision-set.md
- design/architecture-freeze-report.md
- design/colony-life.md ← new
