# Design

**Owner:** Creative Director + Game Systems Designer
**Scope:** Project-wide — all game design artifacts live here, independent of any AI tooling.

Game design documents, system specifications, UI/UX notes, and balance parameters. This directory translates the creative brief in `game/` into concrete, implementable specifications.

## Subdirectories

```
design/
  systems/    — per-simulation-system specs (oxygen, power, stress, relationships, …)
  ui/         — HUD layout, menu flows, and player-feedback design
  balance/    — tuning targets, economy constraints, difficulty curves
  narrative/  — crisis scripts, event templates, colonist dialogue guidelines
```

## Document Lifecycle

1. Draft a spec in `systems/<system-name>.md` using the template in `ai-studio/templates/design-spec.md`.
2. Send for review via `ai-studio/workflows/review-workflow.md`.
3. Link the spec to its GitHub Issue.
4. Mark the spec `Status: Implemented` once the system ships; do not delete it.

## Rules

- No implementation code. Specs describe *what* and *why*, not *how*.
- Every spec must have a linked GitHub Issue before implementation begins.
- When implementation diverges from the spec, update the spec and note the delta — specs must stay accurate.
