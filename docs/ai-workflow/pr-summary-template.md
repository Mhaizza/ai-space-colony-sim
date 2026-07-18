# PR Summary Template

Use this as the standard PR body shape.

```md
Part of #<issue>

## Summary
- ...

## Scope
- In scope:
- Out of scope:

## Authority
- Issue:
- Design:
- ADR:
- Prior PRs:

## Changes
- ...

## Not Changed
- ...

## Validation
- `npm --prefix prototype test`:
- `npm exec --prefix prototype -- tsc --noEmit -p prototype/tsconfig.json`:
- replay / save-load / deterministic checks:

## Risks / Notes
- ...

## Workflow
- Status: Review
- Awaiting: ChatGPT review / architecture review / human approval / final review
```
