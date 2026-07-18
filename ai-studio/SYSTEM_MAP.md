# SYSTEM_MAP

**This is the master navigation document for the AI Studio.**
Every agent reads this at boot (Step 1 of `AI_STUDIO_BOOT.md`). It answers: where does everything live, what does it do, who owns it, and how does it change?

---

## Table of Contents

1. [Full Directory Map](#1-full-directory-map)
2. [Purpose of Every Directory](#2-purpose-of-every-directory)
3. [Document Dependency Graph](#3-document-dependency-graph)
4. [Tier Classification](#4-tier-classification)
5. [Boot Sequence Reference](#5-boot-sequence-reference)
6. [Governance Reference](#6-governance-reference)
7. [Workflow Reference](#7-workflow-reference)
8. [Role Reference](#8-role-reference)
9. [ADR Reference](#9-adr-reference)
10. [Document Lifecycle](#10-document-lifecycle)
11. [Where New Documents Belong](#11-where-new-documents-belong)
12. [Ownership Table](#12-ownership-table)
13. [Update Policy](#13-update-policy)

---

## 1. Full Directory Map

```
ai-space-colony-sim/                        ← repository root
│
├── ai-studio/                              ← AI operating system (agents read from here)
│   ├── AI_STUDIO_BOOT.md                   ← cold-start protocol — read first, every session
│   ├── SYSTEM_MAP.md                       ← this file — master navigation
│   │
│   ├── constitution/                       ← foundational laws — highest authority
│   │   ├── vision.md
│   │   ├── principles.md
│   │   ├── architecture-philosophy.md
│   │   ├── coding-standards.md
│   │   └── glossary.md
│   │
│   ├── governance/                         ← rules about the rules
│   │   ├── change-management.md
│   │   ├── versioning.md
│   │   ├── ownership.md
│   │   └── release-process.md
│   │
│   ├── workflows/                          ← process definitions
│   │   ├── kanban-update-protocol.md       ← mandatory for every task
│   │   ├── feature-workflow.md
│   │   ├── architecture-workflow.md
│   │   ├── review-workflow.md
│   │   ├── bug-workflow.md
│   │   ├── research-workflow.md
│   │   ├── release-workflow.md
│   │   └── constitution-change-workflow.md
│   │
│   ├── roles/                              ← agent identity and authority
│   │   ├── executive/
│   │   │   ├── creative-director.md
│   │   │   └── technical-director.md
│   │   ├── design/
│   │   │   ├── ai-simulation-designer.md
│   │   │   ├── game-systems-designer.md
│   │   │   └── world-designer.md
│   │   ├── engineering/
│   │   │   ├── gameplay-engineer.md
│   │   │   └── ui-ux-engineer.md
│   │   └── qa/
│   │       └── qa-reviewer.md
│   │
│   ├── prompts/                            ← reusable system prompts
│   ├── templates/                          ← blank scaffolds (ADR, issue, spec)
│   ├── checklists/                         ← quality gates per task phase
│   ├── knowledge/                          ← verified, durable reference facts
│   ├── reviews/                            ← completed review records
│   ├── meetings/                           ← session records and decisions
│   ├── memory/                             ← session memory snapshots
│   └── adr/                               ← Architecture Decision Records
│
├── design/                                 ← game design specs (project-wide)
│   ├── systems/
│   ├── ui/
│   ├── balance/
│   └── narrative/
│
├── docs/                                   ← project documentation (project-wide)
│   └── ai-workflow/                        ← Tier 2 subordinate extension: AI agent workflow pack
│
├── game/                                   ← game concept and narrative bible (project-wide)
│
└── src/                                    ← simulation and game code (not yet created)
```

---

## 2. Purpose of Every Directory

### AI Studio (agent operating layer)

| Directory | Purpose | Read-frequency |
|-----------|---------|---------------|
| `AI_STUDIO_BOOT.md` | Cold-start protocol; defines boot order | Every session |
| `SYSTEM_MAP.md` | Master navigation; this file | Every session |
| `constitution/` | Foundational laws that govern all decisions | Every session |
| `governance/` | Authority, change process, versioning, releases | When changing documents |
| `workflows/` | Step-by-step process for every task type | Per task |
| `roles/` | Agent mandate, authority, out-of-scope definitions | Per session |
| `prompts/` | System prompts loaded into agent sessions | Per session |
| `templates/` | Blank scaffolds to copy and fill | When creating new artifacts |
| `checklists/` | Quality gates: start-of-task, pre-commit, pre-review | Per task phase |
| `knowledge/` | Verified facts loaded as agent context | When domain knowledge is needed |
| `reviews/` | Completed review records; append-only log | After every Architecture/Game Design review |
| `meetings/` | Session records, decisions, action items; append-only | After every planning session |
| `memory/` | Session memory snapshots; append-only | At session milestones |
| `adr/` | Architecture Decision Records; immutable once Accepted | When making architectural decisions |

### Repository Root (project-wide)

| Directory | Purpose |
|-----------|---------|
| `design/` | Game system specs, UI/UX, balance, narrative scripts |
| `docs/` | Onboarding, roadmap, process guides, reference docs |
| `docs/ai-workflow/` | Tier 2 subordinate extension: operating model, prompts, and lifecycle templates for AI agents. Supplements ai-studio; does not replace constitution, governance, workflows, roles, or accepted ADRs. Used at Boot Step 8 before Start Task. |
| `game/` | Creative brief: concept, core loop, narrative bible |
| `src/` | Simulation code, game logic, UI (not yet created) |

---

## 3. Document Dependency Graph

Documents that must be read before others are considered safe to act on.

```
constitution/vision.md
constitution/principles.md          ← all design and engineering decisions depend on this
constitution/architecture-philosophy.md
constitution/coding-standards.md
constitution/glossary.md
        │
        ▼
governance/ownership.md             ← who can change what
governance/change-management.md     ← how changes are made
governance/versioning.md            ← when versions change
governance/release-process.md
        │
        ▼
workflows/kanban-update-protocol.md ← mandatory for every task; read before any workflow
        │
        ├──▶ workflows/feature-workflow.md
        │         └──▶ workflows/review-workflow.md
        │         └──▶ workflows/architecture-workflow.md (if trigger found)
        │
        ├──▶ workflows/architecture-workflow.md
        │         └──▶ adr/ (produces an ADR)
        │
        ├──▶ workflows/bug-workflow.md
        │         └──▶ workflows/architecture-workflow.md (if fix triggers architecture)
        │
        ├──▶ workflows/research-workflow.md
        │         └──▶ workflows/feature-workflow.md (if recommendation accepted)
        │
        ├──▶ workflows/release-workflow.md
        │         └──▶ governance/release-process.md
        │
        └──▶ workflows/constitution-change-workflow.md
                  └──▶ workflows/architecture-workflow.md
                  └──▶ adr/ (always produces an ADR)
                  └──▶ governance/change-management.md (Tier 4)
        │
        ▼
roles/<group>/<role>.md             ← loaded per session after understanding the task
        │
        ▼
adr/<relevant accepted ADRs>        ← read before implementing anything in their domain
        │
        ▼
Current Kanban card + GitHub Issue  ← the actual task
```

**Reading rule:** A document further down the graph must not be acted on without having read everything above it. Constitution is always read first. ADRs are always read before implementation.

---

## 4. Tier Classification

Tiers define how difficult a document is to change. Higher tier = more authority = more process required to modify. See `governance/change-management.md` for full process per tier.

| Tier | Change Type | Process Required | Directories |
|------|------------|-----------------|-------------|
| **Tier 4** | Constitutional / Governance | ADR + Architecture Review + Human Approval + Version bump | `constitution/`, `governance/` |
| **Tier 3** | Amendment (changes existing meaning) | Human Approval + Version bump | `workflows/`, `roles/` (existing entries), `governance/ownership.md` |
| **Tier 2** | Extension (new content, no contradiction) | ChatGPT Review + Human Approval | `workflows/` (new steps), `roles/` (new roles), `prompts/`, `templates/` |
| **Tier 1** | Clarification (no meaning change) | Edit directly; note in Kanban Update | Any document |
| **Append-only** | New records added; existing records never edited | Write and commit | `adr/`, `reviews/`, `meetings/`, `memory/` |

---

## 5. Boot Sequence Reference

Full protocol: [`AI_STUDIO_BOOT.md`](AI_STUDIO_BOOT.md)

| Step | File(s) | Purpose |
|------|---------|---------|
| 1 | `SYSTEM_MAP.md` | Understand the full project structure |
| 2 | `constitution/` (all 5 files) | Internalize the laws |
| 3 | `governance/ownership.md`, `change-management.md`, `versioning.md` | Understand authority |
| 4 | Applicable workflow | Know the process |
| 5 | `workflows/kanban-update-protocol.md` | Know the Two Laws and formats |
| 6 | `roles/<group>/<role>.md` | Adopt operating role |
| 7 | Relevant accepted ADRs | Know settled decisions |
| 8 | Current Kanban card + write Start Task | Begin work |

---

## 6. Governance Reference

| Question | Where to look |
|----------|--------------|
| Who can approve a change to document X? | `governance/ownership.md` |
| What process is required for this change? | `governance/change-management.md` |
| Should I bump the version on this document? | `governance/versioning.md` |
| How do I prepare a phase release? | `governance/release-process.md` |

---

## 7. Workflow Reference

| Situation | Workflow |
|-----------|---------|
| Building a new feature | `workflows/feature-workflow.md` |
| Making an architectural decision | `workflows/architecture-workflow.md` |
| Performing a review | `workflows/review-workflow.md` |
| Fixing a bug | `workflows/bug-workflow.md` |
| Exploring an open question | `workflows/research-workflow.md` |
| Releasing a phase | `workflows/release-workflow.md` |
| Changing the constitution | `workflows/constitution-change-workflow.md` |
| Any task (completion format) | `workflows/kanban-update-protocol.md` |
| AI agent card / Start Task / PR / review / closeout | `docs/ai-workflow/` (Tier 2 subordinate; use at Boot Step 8) |

---

## 8. Role Reference

| Agent / Task type | Role file |
|-------------------|-----------|
| Design, documents, architecture proposals | `roles/executive/creative-director.md` |
| Engineering decisions, standards, quality | `roles/executive/technical-director.md` |
| AI colonist behavior, emergent systems | `roles/design/ai-simulation-designer.md` |
| Game mechanics, balance, economy | `roles/design/game-systems-designer.md` |
| World, environments, spatial layout | `roles/design/world-designer.md` |
| Simulation code, game logic | `roles/engineering/gameplay-engineer.md` |
| UI, HUD, player feedback | `roles/engineering/ui-ux-engineer.md` |
| All review tasks | `roles/qa/qa-reviewer.md` |

If no role is specified in a Kanban card, ask the human collaborator. Do not infer.

---

## 9. ADR Reference

Location: `ai-studio/adr/`
Template: `ai-studio/templates/adr.md` *(to be created)*

| ADR status | Meaning |
|------------|---------|
| `Proposed` | Under discussion — not yet governing anything |
| `Accepted` | Active decision — governs the project now |
| `Superseded by NNNN` | Replaced — read the new ADR |
| `Rejected` | Considered and deliberately not adopted |

**Reading rule:** Before implementing anything that could be governed by an ADR, search `adr/` for relevant accepted decisions. Implementing against an accepted ADR without a new superseding ADR is a protocol violation.

**Naming:** `NNNN-short-title-with-hyphens.md` — sequential, never reuse a number.

---

## 10. Document Lifecycle

Every document in the AI Studio passes through these states:

```
Draft
  → Review (ChatGPT review, then Human approval if Tier 2+)
    → Active (in use; governs agent behavior)
      → Amended (MAJOR/MINOR version bump; prior meaning may have changed)
        → Superseded (a newer document replaces it; old file is kept for history)
          → Archived (no longer relevant; moved to a dated archive subfolder)
```

**Append-only documents** (`adr/`, `reviews/`, `meetings/`, `memory/`) skip the Amendment and Superseded states — they are never edited after being written.

**Constitution documents** follow the full lifecycle but require the `constitution-change-workflow.md` to move from Active to Amended.

---

## 11. Where New Documents Belong

Use this table when you produce an artifact and need to decide where it goes:

| Artifact type | Goes in |
|---------------|---------|
| Game concept, creative brief, narrative goals | `game/` |
| Game system specification | `design/systems/` |
| UI/UX design | `design/ui/` |
| Balance parameters | `design/balance/` |
| Narrative scripts or event templates | `design/narrative/` |
| Project documentation, onboarding, roadmap | `docs/` |
| AI agent workflow pack artifacts (operating model, prompts, lifecycle templates) | `docs/ai-workflow/` |
| Architectural decision | `adr/` |
| Review record (architecture or game design) | `ai-studio/reviews/` |
| Session meeting record | `ai-studio/meetings/` |
| Session memory snapshot | `ai-studio/memory/` |
| Verified domain knowledge | `ai-studio/knowledge/` |
| Reusable system prompt | `ai-studio/prompts/` |
| Blank document scaffold | `ai-studio/templates/` |
| Quality gate checklist | `ai-studio/checklists/` |
| New workflow | `ai-studio/workflows/` |
| New role definition | `ai-studio/roles/<group>/` |
| Simulation code | `src/` *(not yet created)* |

**When unsure:** ask "is this AI Studio tooling, or is this part of the game?" Tooling → `ai-studio/`. Game artifact → `design/`, `docs/`, or `game/`.

---

## 12. Ownership Table

Full ownership details: `governance/ownership.md`

Quick reference:

| Document Set | Owner | Final Approver |
|---|---|---|
| `constitution/` | Creative Director + Technical Director | Human Collaborator |
| `governance/` | Technical Director | Human Collaborator |
| `workflows/` | Technical Director | Human Collaborator |
| `roles/` | Technical Director | Human Collaborator |
| `design/` | Game Systems Designer | Human Collaborator |
| `game/` | Creative Director | Human Collaborator |
| `docs/` | Technical Director | Human Collaborator |
| `adr/` (each record) | Author | Human Collaborator |
| `reviews/`, `meetings/`, `memory/` | Relevant session agent | — (records, not decisions) |

**Invariant:** The Human Collaborator is the final approver for every Tier 3–4 change. No AI agent has final authority over any document in this project.

---

## 13. Update Policy

| This document changes when... | Tier | Process |
|-------------------------------|------|---------|
| A new directory is added to the repo | Tier 2 | Update §1, §2, §11; ChatGPT review; Human approval |
| A new workflow is added | Tier 2 | Update §7; ChatGPT review; Human approval |
| A new role is added | Tier 2 | Update §8; ChatGPT review; Human approval |
| Directory purpose changes | Tier 3 | Update §2, §11, §12; Human approval; version bump |
| Ownership changes | Tier 4 | Update §12; ADR required; Human approval; version bump |
| Boot sequence changes | Tier 4 | Update §5; ADR required; also update `AI_STUDIO_BOOT.md`; Human approval |

**SYSTEM_MAP.md must never be stale.** A SYSTEM_MAP that does not reflect the actual directory structure is worse than no map — it actively misleads agents. Any agent that discovers a discrepancy must file a GitHub Issue immediately, even if they are mid-task.
