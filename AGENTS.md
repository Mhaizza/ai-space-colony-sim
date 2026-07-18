# AI Agent Instructions

## Boot Authority

Agents read `ai-studio/AI_STUDIO_BOOT.md` first. That file is the unchanged first-read cold-start authority for every session.

The workflow pack in `docs/ai-workflow/` supplements rather than replaces:

- constitution
- governance
- ai-studio workflows
- roles
- accepted ADRs

Use the workflow pack during Boot Step 8 (current Kanban card) before posting Start Task.

## Workflow Pack

After boot, use the repository workflow pack by default.

Read these files in order:

1. `docs/ai-workflow/README.md`
2. `docs/ai-workflow/operating-model.md`
3. `docs/ai-workflow/prompt-pack.md`
4. `CONTRIBUTING.md`

## Default Rule

Unless the current task explicitly says otherwise, use the workflow pack for all work in this repository.

That means:

- no work without a card
- name the authority chain before implementation
- use the templates in `docs/ai-workflow/`
- stop at review-ready state before merge
- do not widen scope silently
- if the next step is obvious, provide the next prompt immediately

## Role Routing

Use `docs/ai-workflow/prompt-pack.md` to choose the right operating mode:

- `Planner`
- `Implementer`
- `Reviewer`
- `Workflow Operator`

## Required Behavior

When handling a task:

1. identify the card/issue
2. identify the authority chain
3. determine whether design or ADR gates are required
4. execute only the current scope
5. report validation and the exact next step

## Escalation Rule

If implementation discovers a contradiction or needs to widen scope:

- stop
- report the contradiction
- open the required design or ADR follow-up instead of improvising in code

## Repository Entry Points

- Boot authority: `ai-studio/AI_STUDIO_BOOT.md`
- Workflow entrypoint: `docs/ai-workflow/README.md`
- Full policy: `docs/ai-workflow/operating-model.md`
- Prompts: `docs/ai-workflow/prompt-pack.md`
- Templates: `docs/ai-workflow/`

This file routes agents into the workflow pack after the AI Studio boot sequence.
