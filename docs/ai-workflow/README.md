# AI Workflow Pack

This folder is the ready-to-use operating kit for AI agents in `ai-space-colony-sim`.

## Boot Authority

Agents read `ai-studio/AI_STUDIO_BOOT.md` first. That file is the unchanged first-read cold-start authority for every session.

This pack supplements rather than replaces:

- constitution
- governance
- ai-studio workflows
- roles
- accepted ADRs

Use this pack during Boot Step 8 (current Kanban card) before posting Start Task.

If you want to start work immediately without redesigning the process each time, use this order:

1. Read [`operating-model.md`](./operating-model.md).
2. Copy the relevant template from this folder.
3. Use the matching prompt from [`prompt-pack.md`](./prompt-pack.md).
4. Run the card through the standard flow:
   - task/card
   - start task
   - implementation or gate work
   - review
   - closeout

## Immediate Use

### For a new card

- Copy [`task-template.md`](./task-template.md)
- Fill scope, authority, dependencies, risks, and acceptance criteria
- Then use the Planner prompt from [`prompt-pack.md`](./prompt-pack.md)

### Before starting work

- Copy [`start-task-template.md`](./start-task-template.md)
- Post it before design, ADR, or implementation begins

### When opening a PR

- Copy [`pr-summary-template.md`](./pr-summary-template.md)

### When reviewing

- Copy [`review-template.md`](./review-template.md)

### When closing a card

- Copy [`done-update-template.md`](./done-update-template.md)

## Files

- [`operating-model.md`](./operating-model.md) - full workflow rules and role definitions
- [`prompt-pack.md`](./prompt-pack.md) - copy-paste prompts for each AI role
- [`task-template.md`](./task-template.md) - task/card template
- [`start-task-template.md`](./start-task-template.md) - start-task template
- [`pr-summary-template.md`](./pr-summary-template.md) - PR body template
- [`review-template.md`](./review-template.md) - review result template
- [`done-update-template.md`](./done-update-template.md) - final closeout template

## Default Team Shape

- Human Owner: final approval authority
- Planner: creates the next card only
- Implementer: executes the approved scope only
- Reviewer: checks regressions, scope, and architecture drift
- Workflow Operator: merges and closes only after approval

## Daily Rule

If the next step is obvious, provide the next prompt immediately. Do not ask whether one should be written.

## Validate The Pack

From the repository root, run:

```powershell
node tools/ai-workflow/validate-workflow-pack.mjs .
node --test tools/ai-workflow/validate-workflow-pack.test.mjs
```

The validator is read-only. It checks required workflow files, policy and role contracts, lifecycle template fields, entrypoint routing, and local Markdown links.
