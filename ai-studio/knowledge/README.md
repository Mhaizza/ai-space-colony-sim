# Knowledge

**Owner:** Technical Director + all roles (append access)
**Scope:** AI Studio internal — reusable reference knowledge that AI agents load as context.

Distilled, stable facts about the project: domain knowledge, gotchas, verified decisions, and reference tables. Unlike `memory/` (which is session-scoped and append-only), `knowledge/` contains living documents that are actively maintained and refined.

## Subdirectories

```
knowledge/
  domain/      — simulation domain facts (physics approximations, life-support math, etc.)
  patterns/    — recurring code and design patterns used in this codebase
  constraints/ — known hard limits (performance budgets, platform targets, scope boundaries)
```

## File Naming

Use plain descriptive names: `oxygen-simulation-model.md`, `ecs-entity-patterns.md`.

## Rules

- Every entry must be **verified** before it is committed. Mark unverified claims with `⚠ unverified`.
- Knowledge files are living documents — update them when facts change.
- Do not duplicate what is already in `constitution/` or `adr/`. Link instead.
- No session-specific notes (those go in `memory/`). Knowledge must be durable across sessions.
