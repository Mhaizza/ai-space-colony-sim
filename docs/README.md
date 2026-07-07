# Docs

**Owner:** Technical Director
**Scope:** Project-wide — general documentation accessible to all contributors and AI agents.

Reference material, onboarding guides, the project roadmap, and process documentation that doesn't belong in a more specific directory.

## Files (expected)

| File | Contents |
|------|----------|
| `roadmap.md` | Phase-by-phase delivery plan |
| `onboarding.md` | How to get started contributing |
| `kanban-rules.md` | Kanban board column definitions and rules |
| `definition-of-done.md` | What "done" means per task type |
| `workflow.md` | High-level development workflow overview |

## Rules

- If a document belongs in `design/`, `game/`, `ai-studio/adr/`, or `ai-studio/memory/`, put it there. `docs/` is for everything else.
- When a category accumulates more than five files, create a subdirectory.
- No implementation code or simulation logic.
- Docs must stay accurate — stale documentation is treated as a bug.
