# AI Studio

The AI Studio is the creative and technical brain of this project. It contains every document, prompt, workflow, and decision record that guides AI agents and human collaborators in building the **AI Space Colony Simulator**.

No simulation code lives here. Code lives in `src/`. This directory is purely organizational infrastructure.

> **Every AI agent starts here:**
> [`AI_STUDIO_BOOT.md`](AI_STUDIO_BOOT.md) — read this before doing anything else.

## Directory Map

### AI Studio (internal tooling and process)

| Directory | Purpose |
|-----------|---------|
| [`constitution/`](constitution/) | Immutable principles, vision, and architecture contracts |
| [`roles/`](roles/) | AI agent role definitions and responsibilities |
| [`prompts/`](prompts/) | Reusable system prompts and task-prompt templates |
| [`workflows/`](workflows/) | Step-by-step process documents for recurring work |
| [`templates/`](templates/) | Blank document scaffolds (ADRs, issues, specs) |
| [`checklists/`](checklists/) | Quality gates for start-of-task and end-of-task |
| [`memory/`](memory/) | Session memory and persistent AI context snapshots |
| [`knowledge/`](knowledge/) | Verified, durable reference facts loaded as agent context |
| [`reviews/`](reviews/) | Completed review records (code, design, architecture) |
| [`meetings/`](meetings/) | Planning session records, decisions, and action items |
| [`governance/`](governance/) | Authority matrix, change tiers, versioning, and release process |
| [`adr/`](adr/) | Architecture Decision Records |

### Repository root (project-wide, not AI-tooling-specific)

| Directory | Purpose |
|-----------|---------|
| [`/design`](../design/) | Game design documents and system specifications |
| [`/docs`](../docs/) | General project documentation and onboarding guides |
| [`/game`](../game/) | Game concept, narrative bible, and mechanics overview |

## How to Use

1. **Always start with [`AI_STUDIO_BOOT.md`](AI_STUDIO_BOOT.md)** — it defines the reading order for every session.
2. Check `constitution/principles.md` when a decision feels uncertain.
3. Log every architectural decision in `adr/`.
4. Finish every task with a **Kanban Update** (format in `workflows/kanban-update-protocol.md`).
