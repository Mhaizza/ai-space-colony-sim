# Contributing

This repository uses a standard AI workflow pack for both human contributors and AI workers.

## Boot Authority

Agents read `ai-studio/AI_STUDIO_BOOT.md` first. That file is the unchanged first-read cold-start authority for every session.

The workflow pack in `docs/ai-workflow/` supplements rather than replaces:

- constitution
- governance
- ai-studio workflows
- roles
- accepted ADRs

Use the workflow pack during Boot Step 8 (current Kanban card) before posting Start Task.

Before starting new work, also read:

- [`docs/ai-workflow/README.md`](./docs/ai-workflow/README.md)
- [`docs/ai-workflow/operating-model.md`](./docs/ai-workflow/operating-model.md)

## Default Rule

All new work should follow the workflow pack unless a card explicitly says otherwise.

That means:

- no work without a card
- name the authority chain before implementation
- use the standard task / start-task / PR / review / done templates
- stop at review-ready state before merge
- do not widen scope silently

## AI Workers

AI workers should use:

- [`docs/ai-workflow/prompt-pack.md`](./docs/ai-workflow/prompt-pack.md) for role prompts
- the templates under [`docs/ai-workflow/`](./docs/ai-workflow/) for cards, start-task records, PR summaries, reviews, and closeout

## Minimum Expected Flow

1. Create or refine the card
2. Post `Start Task`
3. Execute only approved scope
4. Open PR with validation
5. Pass review
6. Merge and close out

## Scope Discipline

If implementation discovers a contradiction or needs to widen scope:

- stop
- report the contradiction
- open the required design or ADR follow-up instead of improvising in code

This is the default contribution model for the repository.
