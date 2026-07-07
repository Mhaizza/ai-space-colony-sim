# Principles

These are the design and engineering laws of this project. When a decision conflicts with a principle, the principle wins. To change a principle, open an ADR.

---

## 1. Simulation First

**Meaning:** The simulation runs without a UI. Every game state is computable without rendering anything.

**Why it exists:** UI frameworks change. Render targets change. The simulation must outlive every technology decision made around it. It also makes the sim testable in isolation.

**Examples:**
- A colonist's needs update on every tick whether or not the player is watching that colonist.
- A resource shortage causes downstream effects even during fast-forward.
- All simulation logic can be exercised in a headless test environment.

**Anti-patterns:**
- A system that reads from DOM state to determine colonist behavior.
- A mechanic that only triggers when the player has a UI panel open.
- Simulation functions that import rendering libraries.

---

## 2. AI First

**Meaning:** Colonists are autonomous agents. Every behavior is a product of the agent's internal state, not a scripted sequence triggered by the player or the game designer.

**Why it exists:** The player fantasy depends on colonists feeling alive. Scripted behavior is always finite and always eventually exposed as hollow. Agent-driven behavior scales with emergent complexity.

**Examples:**
- A colonist decides to eat because their hunger need is above threshold, weighted by their current goal priority — not because a scheduled event fires.
- Two colonists form a rivalry because their interactions over time produced negative relationship scores, not because a designer authored a "rivalry event."

**Anti-patterns:**
- Hardcoded behavior sequences ("at day 10, the engineer gets angry").
- Player actions that directly set colonist mood values.
- Events that fire on a fixed timer regardless of agent state.

---

## 3. Emergent Gameplay

**Meaning:** Interesting situations arise from the interaction of simple systems, not from authored content.

**Why it exists:** Authored content has a ceiling — players find the edges and the illusion breaks. Emergent systems have no ceiling because the interactions were never fully anticipated.

**Examples:**
- An oxygen shortage causes stress; stress causes poor work performance; poor work performance causes a second oxygen shortage. The crisis spirals without a designer scripting a spiral.
- Two colonists with incompatible traits naturally avoid each other, creating informal social zones in the station.

**Anti-patterns:**
- Adding a scripted "oxygen crisis event" instead of modeling oxygen depletion as a continuous system.
- Writing narrative text for specific colonist pairings instead of deriving relationship states from interaction history.
- Designing around what the player "should" experience rather than what the systems produce.

---

## 4. Systems Over Scripts

**Meaning:** Prefer a general system that handles many cases over a specific script that handles one case.

**Why it exists:** Scripts are content. Systems are engines. Content scales linearly; engines scale combinatorially. A new trait or module added to the system generates new behaviors automatically. A new script generates exactly one behavior.

**Examples:**
- A general `Need` system handles hunger, sleep, social contact, and safety the same way — instead of separate hunger logic, sleep logic, and social logic.
- A `Relationship` system derived from interaction history covers friendship, rivalry, and mentorship without scripting each bond type.

**Anti-patterns:**
- A `handleOxygenCrisis()` function that is called only when oxygen drops below 20%.
- Separate code paths for "normal behavior" and "crisis behavior" when crisis is just a region of normal state space.
- A trait that is implemented as a series of if-statements rather than modifying system parameters.

---

## 5. Every Action Has Consequences

**Meaning:** No action in the simulation is neutral. Every decision by an agent or the player propagates effects through connected systems.

**Why it exists:** Consequence is what makes the player feel that the simulation is real. A colony sim where you can place modules without affecting power draw, or assign work without affecting morale, is not a simulation — it's a menu.

**Examples:**
- Assigning a colonist to a double shift lowers rest, which lowers work quality, which increases resource consumption.
- Building a new module without planning the power draw triggers a cascade through every power-dependent system.
- A colonist witnessing a colleague's death increases their stress and may change their long-term personality.

**Anti-patterns:**
- Systems that are isolated from each other with no shared state.
- A "safe" action that can always be undone without cost.
- Player decisions that affect only one variable in one system.

---

## 6. Explainable AI Decisions

**Meaning:** Every agent decision must be inspectable. The player must be able to ask "why did this colonist do that?" and receive a true, legible answer.

**Why it exists:** Emergent behavior without explainability feels like chaos, not depth. Explainability is what separates a living simulation from a black box. It also makes debugging possible.

**Examples:**
- The agent inspector shows: "Maya refused the oxygen repair task because her stress level exceeded her task-acceptance threshold (78/100) and her current goal priority is Rest."
- A colonist's daily log shows every need value, every decision made, and the weights that drove each decision.

**Anti-patterns:**
- Neural network or opaque ML models for colonist decision-making (at least at this stage).
- Decision logic that cannot be serialized or logged.
- Behavior that emerges from floating-point accumulation errors that are invisible to the player.

---

## 7. Deterministic Simulation Where Possible

**Meaning:** Given the same starting state and the same inputs, the simulation produces the same outputs.

**Why it exists:** Determinism enables reliable save/load, reproducible bug reports, replay systems, and testable logic. Non-determinism should be an explicit, controlled choice — never an accident.

**Examples:**
- Random events use a seeded PRNG whose seed is stored in the save file.
- Simulation ticks process agents in a consistent order.
- Two clients loading the same save file produce the same simulation state on the next tick.

**Anti-patterns:**
- Using `Math.random()` directly in simulation logic without a seeded wrapper.
- Processing order that depends on object insertion order in a `Map` or `Set` without explicit sorting.
- Floating-point operations that produce different results across platforms (minimize platform-dependent paths).
