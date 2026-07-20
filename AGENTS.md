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

## Cursor Cloud specific instructions

The only runnable code lives in `prototype/` — a headless, deterministic TypeScript simulation with zero runtime dependencies. Everything else (`game/`, `design/`, `docs/`, `ai-studio/`, `tools/`, `ai-space-colony-starter-kit/`) is documentation/workflow content, not executable.

- Test: `npm --prefix prototype test` (Vitest, ~640 tests).
- Lint/typecheck gate: `npm exec --prefix prototype -- tsc --noEmit -p prototype/tsconfig.json`. There is no ESLint; the strict `tsc` typecheck is the lint gate (see `.github/PULL_REQUEST_TEMPLATE.md`).
- There is no build step, dev server, or UI. The "application" is the headless CLI.
- Running the app: `prototype/src/main.ts` exports `runCli(argv)` (commands: `run`/`continue`/`verify`) but is a PURE module with no process wrapper that prints. To run it, add a one-line entry (e.g. `console.log(runCli(process.argv.slice(2)))`) and execute with `npx tsx` — plain `node` type-stripping fails because internal imports use `.js` specifiers that resolve to `.ts` files, which only `tsx` remaps. Example: `npx tsx runner.ts run --seed 42 --ticks 50`.
