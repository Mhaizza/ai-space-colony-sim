# Architecture Philosophy

This document captures the *why* behind our structural decisions. It does not prescribe a final architecture — that is the job of ADRs. It defines the constraints any architecture must satisfy.

---

## 1. Simulation Is Separated from UI and Rendering

The simulation layer has no knowledge that a UI exists. It does not import rendering libraries, does not write to DOM, and does not depend on frame timing.

**Why:** Separating these concerns means the simulation can be tested headlessly, run faster than real-time for save generation, and survive complete UI rewrites. It also prevents the most common category of coupling bugs in game development, where a UI interaction silently modifies simulation state through shared mutable references.

**Constraint:** Any architecture we adopt must enforce this boundary structurally (via module separation, not just convention).

---

## 2. Simulation Drives Gameplay

All authoritative game state lives in the simulation. Gameplay consequences flow *from* the simulation *to* the player, never the reverse. The player sends *inputs* to the simulation; the simulation decides what happens.

**Why:** If gameplay could be driven from the UI layer (e.g., directly setting a colonist's mood via a UI action), the simulation would no longer be the source of truth. This creates split-brain state and makes the system impossible to test or replay.

**Constraint:** Player actions must be expressed as commands or inputs that the simulation processes — not as direct mutations of simulation objects.

---

## 3. AI Agents Consume World State

Agents read a snapshot of world state to make decisions. They do not reach directly into other agents or systems to read values at decision time.

**Why:** Direct cross-agent reads create hidden coupling and ordering dependencies. A snapshot-based approach makes agent decisions reproducible (the snapshot is fixed at the start of a tick) and enables future parallelism.

**Constraint:** World state must be readable as a coherent snapshot at any point in a tick. Agents do not hold live references to other agents' internal state.

---

## 4. UI Never Owns Authoritative State

The UI is a view. It may cache values for rendering performance, but it never holds a value that the simulation does not also hold. If the UI and simulation disagree, the simulation is correct.

**Why:** If the UI can own state, it becomes possible for the player to see one thing and the simulation to compute another. This produces bugs that are nearly impossible to reproduce because they depend on render timing.

**Constraint:** UI components subscribe to or poll simulation state. They do not maintain parallel data structures that diverge.

---

## 5. Save/Load Compatibility Is a First-Class Concern

Every simulation object must be serializable. The ability to save and restore complete simulation state is not a feature added at the end — it is a constraint that shapes every data structure decision from the start.

**Why:** Save/load is the player's relationship with their colony over time. Breaking it breaks trust. Retrofitting serializability onto an existing architecture is expensive and error-prone.

**Constraint:** No simulation object may hold unserializable state (live DOM references, closures, class instances that rely on prototype chain for identity). All state must round-trip through a save format without loss.

---

## 6. Modular Systems

Each simulation system is responsible for one domain. Systems communicate through defined interfaces — shared state structures or an event bus — not through direct method calls between system classes.

**Why:** Tight coupling between systems makes it impossible to add, remove, or swap a system without understanding every system it touches. Modular systems can be tested in isolation, disabled for debugging, and extended without cascading changes.

**Constraint:** A system must be addable or removable without modifying the core simulation loop. Systems declare their inputs and outputs; they do not reach into each other's internals.

---

## 7. Testability

Every piece of simulation logic must be testable without spinning up a browser, a renderer, or a full game session. Tests must run fast enough to run on every commit.

**Why:** Untestable simulation logic means bugs are found by playing the game, not by running tests. At the complexity level this simulation will reach, manual testing is insufficient. Determinism (Principle 7) exists in part to make tests reliable.

**Constraint:** Simulation functions must be pure or near-pure — they take state as input and return new state or events as output. Side effects (logging, persistence) are pushed to the edges of the system.
