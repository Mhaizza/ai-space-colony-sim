# Prompts

Reusable prompt documents for AI agents. These are not one-off instructions — they are stable, versioned text that can be loaded into any session.

## Files

| File | Use |
|------|-----|
| `global-system.md` | Loaded into every AI session as the base system prompt |
| `task-start.md` | Prompt to orient an agent at the start of a new task |
| `review-request.md` | Prompt to trigger a structured code or design review |
| `kanban-update.md` | Prompt format for closing a Kanban card |

## Guidelines

- Prompts must be self-contained — they cannot assume prior session context.
- Keep prompts factual and directive. No padding.
- When a prompt references another document, use a relative path.
- Version bump the filename (`global-system-v2.md`) only for breaking changes; otherwise edit in place and rely on git history.
