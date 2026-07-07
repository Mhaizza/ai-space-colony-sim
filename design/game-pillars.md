# Game Pillars

The six load-bearing ideas of this game. Every design decision should reinforce at least one pillar. A feature that contradicts a pillar without strong justification should not ship.

---

## Pillar 1 — People Over Resources

**Meaning**
Resources are a pressure system. People are the game. Oxygen matters because colonists breathe it. Power matters because colonists need light to work. The resource layer exists to create conditions that force colonists into drama — it is not the drama itself.

**Why It Matters**
Colony sims die when players optimize the life out of them. Once resource flow is solved, there is nothing left. This game never lets resources be fully solved, because people generate new problems faster than infrastructure can contain them. The resource layer is a floor. The people layer is the ceiling — and it has no ceiling.

**Example**
Two colonists are the only qualified engineers on the station. One of them refuses to share a shift with the other after a falling-out. The player must choose: force the shift (damage morale and relationship further), hire a less-qualified third, or split the maintenance schedule across less efficient windows. This is a resource problem, but it is actually a people problem.

**Anti-Pattern**
A "fix morale" button. Any mechanic that lets the player resolve interpersonal problems by spending currency bypasses the drama entirely. People problems must be solved through conditions, policy, and patience — or they must be allowed to worsen.

---

## Pillar 2 — Conditions, Not Commands

**Meaning**
The player's power is environmental. They build rooms, set policies, assign modules, manage resource flow, and respond to crises. They do not give orders to individuals. Colonist behavior is always a response to the world the player has built.

**Why It Matters**
Direct control collapses the distance between player action and outcome. When you can click "repair generator" on a specific colonist, that colonist becomes a tool, not a person. The player must instead create a world where a qualified, unblocked, sufficiently motivated colonist decides to repair the generator. That indirection is where the game lives.

**Example**
The player cannot order Maya to stop working overtime. But they can set a station-wide rest policy, reduce shift length, and make the break room comfortable enough that resting has a higher utility weight than working. Maya may comply. She may not, if her drive trait overrides it. The policy is the action. The result is emergent.

**Anti-Pattern**
Any menu that says "tell [colonist] to do [action]." Individual task assignment is an RTS mechanic. If the player is micromanaging individuals, the AI colonist layer has failed to generate sufficient trust.

---

## Pillar 3 — Every Story Is True

**Meaning**
Every story a player tells about their colony is a faithful account of what actually happened in the simulation. Nothing is an illusion, a procedural flavor text, or a stat abstraction with a narrative mask. If the player says "Ren saved the station," Ren's decision log will confirm it — and will show exactly why Ren made that choice instead of someone else.

**Why It Matters**
Player-generated stories only have meaning if they are real. If the player discovers that "personality" is a display layer over identical underlying logic, the simulation loses all emotional weight. Trust is the substrate of engagement. Every visible colonist behavior must have a traceable cause.

**Example**
A player posts: "My head engineer refused to do the emergency repair and the station nearly collapsed. I was furious. Then I checked the decision log — she had been awake for 28 in-game hours, her stress was at 94%, and her trait meant she locked up under extreme pressure. I can't even be mad. I did that to her."

That story is only possible if the simulation was actually running that logic. The decision log is not post-hoc rationalization — it is the record of computation.

**Anti-Pattern**
Narrative flavor text that is not connected to simulation state. A colonist description that says "she is courageous" when courage has no mechanical meaning. Mood events that fire based on time passed rather than actual colonist state.

---

## Pillar 4 — Legible Complexity

**Meaning**
The simulation is deep. The player can understand it. These are not in conflict. Complexity must be introduced gradually, in layers the player can observe before they must manage. Every system must have visible indicators. Every agent decision must be inspectable.

**Why It Matters**
Opaque complexity produces helplessness, not mastery. If the player cannot tell why something happened, they cannot learn from it. A simulation that the player cannot read is a random number generator with better graphics. Legibility is not a simplification — it is what makes depth enjoyable.

**Example**
A player notices a colonist's productivity dropping. They hover over her. The UI shows: need levels (rest: 23%, hunger: 61%), current stress (74%), active trait modifier (perfectionist: +15% stress from incomplete tasks), and her current goal (sleep, priority 8/10). The player understands immediately what is happening and what levers they have.

**Anti-Pattern**
Hidden simulation variables that affect outcome but are not exposed to the player. "The colonist just started acting weird" with no readable cause. Any emergent behavior that the player correctly identifies as real but cannot verify — this creates paranoia, not engagement.

---

## Pillar 5 — The Colony Has a Culture

**Meaning**
Colonies are not interchangeable. The decisions a player makes in the first hours create norms, power structures, and social patterns that persist and shape every colonist who arrives afterward. A colony where the player prioritized individual welfare develops differently from one that prioritized collective efficiency. The colony is a character.

**Why It Matters**
Replayability comes from culture divergence. If every colony converges to the same optimized state, the game has one playthrough. If early decisions calcify into colony-wide social patterns that cannot be easily reversed, each playthrough produces a genuinely different society — and a genuinely different set of problems.

**Example**
In one playthrough, a player assigned the most capable colonists to the most critical roles early on, creating a visible hierarchy. Two in-game years later, lower-status colonists have organized an informal group that slow-rolls maintenance on elite module sections. The player never scripted this. The resentment accumulated from interaction data.

**Anti-Pattern**
A colony reset. Any mechanic that allows the player to "clear social state" and start fresh without a meaningful cost erases the game's memory. The weight of past decisions is not a punishment — it is the medium the game is painted in.

---

## Pillar 6 — Failure Is Information

**Meaning**
A collapsing colony is a debrief, not a defeat screen. The game presents failure as a legible narrative with a traceable cause chain. The player leaves a failed run knowing specifically what they would do differently — and that knowledge transfers into the next colony.

**Why It Matters**
If failure feels random or unfair, players quit. If failure feels inevitable and instructive, players start again. The difference is legibility. A player who understands why they failed has motivation to improve. A player who does not understand has nothing to work with except frustration.

**Example**
Colony collapse post-mortem screen: a timeline showing the key events — oxygen generator went offline at hour 14, which overloaded the backup, which stressed the engineer responsible, who had a conflict with the shift supervisor and requested reassignment three days earlier (denied), whose replacement had a lower skill level that the player never checked. Five decisions, five missed signals. All visible in retrospect. The player bookmarks it.

**Anti-Pattern**
A single catastrophic event that feels impossible to have predicted or prevented. Instant death mechanics. Any failure state that cannot be attributed to a chain of player decisions and simulation consequences that were, in principle, observable.
