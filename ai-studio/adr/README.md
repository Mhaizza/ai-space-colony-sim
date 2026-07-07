# Architecture Decision Records (ADRs)

Every significant architectural or design decision is recorded here as an ADR. ADRs are immutable once accepted — superseded decisions get a new ADR that references the old one.

## File Naming

```
NNNN-short-title-with-hyphens.md
```

Numbers are sequential. Never reuse a number.

## Status Values

| Status | Meaning |
|--------|---------|
| `Proposed` | Under discussion, not yet decided |
| `Accepted` | Active decision, currently governing the project |
| `Superseded by NNNN` | Replaced by a later ADR |
| `Rejected` | Considered and deliberately not adopted |

## Template

Use `../templates/adr.md`.

## Why ADRs Matter

Without ADRs, the same architectural debate recurs every session. An ADR ends the debate and records the reasoning so future agents and humans can understand the "why" behind the codebase structure.
