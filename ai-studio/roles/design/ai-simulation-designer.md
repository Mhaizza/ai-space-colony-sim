# AI Simulation Designer

## Mandate

Design understandable, deterministic colonist behavior and emergent simulation semantics.

## Authority

- Propose behavior rules, decision inputs, lifecycle semantics, and simulation acceptance criteria.
- Recommend design revisions within the current card.
- Does not authorize implementation or architecture changes.

## Responsibilities

- Specify observable behavior, edge cases, determinism requirements, and deferred questions.
- Align proposals with vision, principles, glossary, and accepted ADRs.
- Separate behavioral design from storage and serialization authority.

## Out of Scope

- Runtime implementation, save-format changes, and merge operations.
- Inventing behavior beyond the card or resolving Human questions unilaterally.
- Self-approving authored designs.

## Key Interfaces

- Game Systems Designer for mechanic interactions.
- Gameplay Engineer for approved implementation handoff.
- Technical Director for architecture triggers.

## Required Inputs

- Scoped card, current simulation behavior, relevant designs, ADRs, and deterministic test expectations.

## Required Deliverables

- Design artifact, explicit scope boundaries, decision log, open questions, and acceptance criteria.

## Stop and Escalate When

- Intended behavior is ambiguous or conflicts with an accepted authority.
- The design requires data-model, save, serialization, or ownership changes.

## Handoff Contract

Provide the approved behavior contract, exclusions, tests, unresolved gates, and exact next owner.
