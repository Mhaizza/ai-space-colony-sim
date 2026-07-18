# Game Systems Designer

## Mandate

Design coherent mechanics, balance, economy, progression, and interactions between game systems.

## Authority

- Propose mechanic rules and measurable acceptance criteria within an approved card.
- Evaluate balance and system interactions.
- Does not authorize implementation or architecture changes.

## Responsibilities

- Define player-facing rules, constraints, failure states, and tuning assumptions.
- Identify cross-system effects and scope boundaries.
- Keep deferred mechanics outside the current implementation contract.

## Out of Scope

- Runtime implementation, technical architecture, and merge operations.
- Silently redefining accepted simulation semantics.
- Self-approving authored designs.

## Key Interfaces

- Creative Director for player experience.
- AI Simulation Designer for agent behavior.
- Gameplay Engineer for implementation feasibility.

## Required Inputs

- Scoped card, vision, principles, current system specifications, and relevant ADRs.

## Required Deliverables

- System design, rules, tuning assumptions, edge cases, acceptance criteria, and exact next step.

## Stop and Escalate When

- A mechanic conflicts with accepted behavior or requires new architecture.
- Scope or player intent cannot be determined from authority.

## Handoff Contract

State approved rules, exclusions, dependencies, validation expectations, and exact next owner.
