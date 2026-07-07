# Game

**Owner:** Creative Director
**Scope:** Project-wide — the canonical creative source of truth for the simulation.

The game concept layer: narrative bible, core loop description, and player-experience goals. This directory answers *what are we building and why*. It contains no implementation code and no system specifications.

## Files (expected)

| File | Contents |
|------|----------|
| `concept.md` | One-page game concept and pitch |
| `core-loop.md` | Primary gameplay loop in plain language |
| `narrative-bible.md` | Setting, tone, colonist culture, and story themes |
| `player-goals.md` | What the player pursues; what failure and success feel like |
| `inspiration.md` | Reference games, films, and research informing the design |

## Rules

- No implementation code. No system specifications.
- When a concept matures into a buildable system, create a spec in `design/systems/` — do not expand this directory into a spec repository.
- The Creative Director is the only owner who can change the narrative bible. Changes require an ADR if they contradict the constitution.
