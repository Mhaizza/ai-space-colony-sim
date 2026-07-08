# AI Studio Boot Sequence

**Read this file first. Every session. Every agent.**

This is the cold-start protocol for every AI agent entering this project — Claude, ChatGPT, Codex, Cursor, or any future agent. Follow this sequence before doing any work, writing any code, or making any decision. The sequence is not a suggestion; it is the operating procedure.

If you are resuming mid-task, start from the step matching your current context. If you are unsure where you left off, start from step 1.

---

## Boot Sequence

```
AI_STUDIO_BOOT.md        ← you are here
        ↓
1. SYSTEM_MAP.md          ← understand the full project structure
        ↓
2. constitution/          ← internalize the laws
        ↓
3. governance/            ← understand who has authority over what
        ↓
4. workflows/             ← know the process for your task type
        ↓
5. kanban-update-protocol ← mandatory completion format
        ↓
6. Role prompt            ← adopt your operating role
        ↓
7. Relevant ADRs          ← decisions already made that govern your work
        ↓
8. Current Kanban card    ← your actual task
```

---

## Step-by-Step Instructions

### Step 1 — SYSTEM_MAP.md
*File: `ai-studio/SYSTEM_MAP.md` (create if missing — see note below)*

Read the system map to understand:
- The full directory structure of this project
- Which directory owns which type of content
- Where to put any artifact you produce

**Extract:** "I know where everything lives in this project."

---

### Step 2 — Constitution
*Files: `ai-studio/constitution/`*

Read in this order:
1. `vision.md` — what we are building and why
2. `principles.md` — the design laws; memorize the anti-patterns
3. `architecture-philosophy.md` — structural constraints any implementation must satisfy
4. `coding-standards.md` — mandatory code rules
5. `glossary.md` — canonical definitions; use these terms, not informal synonyms

**Extract:** "I know what this project is, what it values, and what it forbids."

**Test yourself:** Can you state the 7 principles from memory? If not, re-read `principles.md`.

---

### Step 3 — Governance
*Files: `ai-studio/governance/`*

Read:
1. `ownership.md` — who owns which documents; who can approve changes
2. `change-management.md` — what tier of change your task involves
3. `versioning.md` — when and how to bump document versions

Skip `release-process.md` unless you are executing a release.

**Extract:** "I know who has authority over the documents I will touch, and what process I must follow to change them."

---

### Step 4 — Workflows
*Files: `ai-studio/workflows/`*

Read only the workflow(s) relevant to your task:

| If your task is... | Read |
|--------------------|------|
| A new feature | `feature-workflow.md` |
| An architectural decision | `architecture-workflow.md` |
| A code or design review | `review-workflow.md` |
| A bug fix | `bug-workflow.md` |
| Research or exploration | `research-workflow.md` |
| A phase release | `release-workflow.md` |
| A change to the constitution | `constitution-change-workflow.md` |

If you are unsure which workflow applies, read `feature-workflow.md` as the default.

**Extract:** "I know the exact steps, approval gates, and artifacts required for my task type."

---

### Step 5 — Kanban Update Protocol
*File: `ai-studio/workflows/kanban-update-protocol.md`*

Read the full file. This is not optional even if you have read it before.

**Extract:**
- The Two Laws (no card = no work; no update = not done)
- The Start Task format
- The Decision Log format
- The Kanban Update format
- The review pipeline order

If you cannot recite the Two Laws, re-read the file.

---

### Step 6 — Role Prompt
*Files: `ai-studio/roles/`*

Load the role matching your assignment for this session:

| Agent | Role file |
|-------|-----------|
| Claude (design tasks) | `roles/executive/creative-director.md` or `roles/executive/technical-director.md` |
| Claude (engineering tasks) | `roles/engineering/gameplay-engineer.md` |
| ChatGPT (review tasks) | `roles/qa/qa-reviewer.md` |
| Codex / Cursor | `roles/engineering/gameplay-engineer.md` |

If no role is specified in the Kanban card, ask the human collaborator before proceeding.

**Extract:** "I know my mandate, my authority, and what is out of scope for my role."

---

### Step 7 — Relevant ADRs
*Files: `ai-studio/adr/`*

Read every ADR with status `Accepted` that is relevant to your task domain. At minimum:
- Read any ADR linked in the Kanban card or GitHub Issue
- Read any ADR that governs the system or document you will be modifying

Do not skip this step — ADRs record decisions that must not be re-litigated. If you are about to make a decision that contradicts an accepted ADR, stop and raise it as a blocker.

**Extract:** "I know which architectural decisions are already settled and must not be re-opened without a new ADR."

---

### Step 8 — Current Kanban Card
*Source: GitHub Issues / Kanban board*

Read the full Kanban card and its linked GitHub Issue:
- Task title and phase
- Acceptance criteria (every item)
- Dependencies listed
- Prior comments and blocker reports

Then write your **Start Task record** (format in `kanban-update-protocol.md`) and post it to the GitHub Issue.

**You are now authorized to begin work.**

---

## If a Required File Is Missing

| Missing file | Action |
|---|---|
| `SYSTEM_MAP.md` | Create it before continuing — the project needs it |
| A constitution document | Stop; flag as blocker; do not infer content |
| A workflow document | Stop; flag as blocker; do not proceed without the process definition |
| Role file for your assignment | Ask human collaborator; do not infer your role |
| Kanban card | Do not begin work — Law 1 applies |

Never skip a step because a file is missing. A missing file is a blocker, not a shortcut.

---

## Boot Sequence Checklist

Before beginning any task, confirm:

- [ ] Read `SYSTEM_MAP.md` — know the directory structure
- [ ] Read all 5 constitution documents — can state the 7 principles
- [ ] Read `ownership.md` — know who approves changes to documents I will touch
- [ ] Read the applicable workflow — know every step and approval gate
- [ ] Read `kanban-update-protocol.md` — know the Two Laws and all required formats
- [ ] Loaded the correct role prompt
- [ ] Read all relevant accepted ADRs
- [ ] Read the Kanban card and GitHub Issue — understand acceptance criteria
- [ ] Posted Start Task record to GitHub Issue

**All boxes checked? Begin work.**
**Any box unchecked? Do not begin work.**

---

## Note on SYSTEM_MAP.md

`SYSTEM_MAP.md` does not yet exist in this project. The first agent to reach Step 1 should create it. It must contain:
- The complete directory tree of the repository
- One-line description of each directory's purpose
- A note on which directories are AI-Studio-internal vs. project-wide

Once created, link it from `ai-studio/README.md`.
