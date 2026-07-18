# Claude Project Instructions

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

Use the repository workflow pack by default after boot.

Read:

1. `docs/ai-workflow/README.md`
2. `docs/ai-workflow/operating-model.md`
3. `docs/ai-workflow/prompt-pack.md`
4. `CONTRIBUTING.md`

## Working Rules

- Do not start work without a card/issue.
- Do not widen scope silently.
- Do not merge before the required review gate passes.
- Use the templates in `docs/ai-workflow/` for task creation, start-task records, PR summaries, review outputs, and closeout.
- If the next step is obvious, write the next prompt immediately instead of asking whether one should be written.

## Role Selection

Choose one role from `docs/ai-workflow/prompt-pack.md` before acting:

- Planner
- Implementer
- Reviewer
- Workflow Operator

## Escalation

If you hit a contradiction between the task, design, ADR, or implementation reality:

- stop
- report the contradiction clearly
- request the required design or ADR follow-up

Do not improvise an architecture change inside implementation work.
