# Kanban Update Protocol

This protocol is mandatory for every AI agent on this project. No exceptions.

---

## The Two Laws

### Law 1: No Kanban Card → No Work

If a GitHub Issue and a Kanban card do not exist for the task, the task does not begin. This applies to every agent, every session, every task — including small fixes, refactors, and "quick" changes.

If no card exists, the agent's first action is to flag this to the human collaborator and request that a card be created before proceeding.

### Law 2: No Kanban Update → Task Not Done

A task is not complete until a Kanban Update has been written and the card status has been moved. Code committed without a Kanban Update is considered abandoned work, not completed work.

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| **Backlog** | Identified but not yet scoped or prioritized. No work begins here. |
| **Ready** | Scoped, has a GitHub Issue, has acceptance criteria. Safe to begin. |
| **In Progress** | An agent has started work. Only one assignee per card at a time. |
| **Review** | Implementation complete. Waiting for review by the designated reviewer. |
| **Testing** | Review approved. Awaiting validation against acceptance criteria. |
| **Done** | All acceptance criteria met, review passed, Kanban Update written, card closed. |
| **Blocked** | Work cannot continue due to a dependency, missing decision, or external blocker. A blocker report is required (see below). |

A card moves backward (e.g., Review → In Progress) only when a reviewer rejects the work. The rejection reason must be documented in the GitHub Issue before the card moves.

---

## Start Task Protocol

Before any work begins, the agent must produce a Start Task record and post it as a comment on the GitHub Issue. This record is not optional — it is the contract between the agent and the human collaborator for what the task will do.

```
Start Task

Task:                    [Phase N] Exact Kanban card title
Goal:                    One sentence — what this task achieves and why.
Acceptance Criteria:
  - Criterion 1
  - Criterion 2
Files Expected To Change:
  CREATED  path/to/new-file.md
  UPDATED  path/to/existing-file.ts
Dependencies:            Other cards, ADRs, or decisions this task depends on. Or "None."
Risks:                   Known unknowns, scope edge cases, or constitutional conflicts.
Estimated Deliverables:  List of artifacts this task will produce (files, decisions, formats).

<!-- ai-workflow-record:v1
{"type":"start_task","card":146,"worker":"cursor","role":"gameplay-engineer","artifact":null,"head":null,"result":null,"supersedes":null}
-->
```

**Rules:**
- The Start Task record must be posted before the first file is created or edited.
- If Acceptance Criteria cannot be written yet, the task is not `Ready` — return it to `Backlog` for scoping.
- `Files Expected To Change` is a forecast, not a promise. Deviations must be noted in the Kanban Update.
- If Dependencies are unresolved, the card must move to `Blocked` before work begins.

---

## Before Starting Work

Every agent must do all of the following before writing any code, document, or design artifact:

1. **Confirm the card exists** in the Kanban board with status `Ready` or `In Progress`.
2. **Read the linked GitHub Issue** — understand the acceptance criteria fully before proceeding.
3. **Read the relevant constitution documents** — at minimum `principles.md` and `architecture-philosophy.md`.
4. **Check for prior attempts** — search session memory (`ai-studio/memory/`) and task history for prior work on this topic. If a prior attempt was abandoned, read why before starting.
5. **Check for blockers** — review `ai-studio/memory/` and the GitHub Issue for known blockers or dependencies not yet resolved.
6. **Move the card to `In Progress`** if it is not already there.
7. **Confirm scope** — if the task scope is ambiguous, ask for clarification before beginning. Do not infer scope and proceed silently.

---

## During Work

While a task is `In Progress`:

- Make incremental progress visible — update the GitHub Issue with notes on significant decisions, obstacles, or scope changes discovered mid-task.
- Do not expand scope without creating a new card. If a new subtask is discovered, file a GitHub Issue for it and link it to the current card. Do not absorb it into the current task.
- If a decision is made that affects architecture or system boundaries, **stop and write an ADR** before continuing (see ADR requirement below).
- If work is blocked, immediately move the card to `Blocked` and write a blocker report.

---

## After Completing Work

When implementation is complete:

1. Self-review against the acceptance criteria in the GitHub Issue. Every criterion must be met or explicitly noted as deferred with justification.
2. Write the **Kanban Update** (format below).
3. Move the card to `Review`.
4. Assign the review to the designated reviewer per the review handoff rules below.
5. Link the Kanban Update in the GitHub Issue comment.

---

## Decision Log

Every task must produce a Decision Log before the Kanban Update. One entry per significant decision made during the task. If no decisions were made, write `Decision Log: None.`

A "significant decision" is any choice that a future agent or collaborator might question, re-litigate, or need to understand without reading the full task transcript.

### Format

```
Decision Log

Decision:                  What was decided.
Reason:                    Why this option was chosen over others.
Alternatives Considered:   What else was evaluated.
Rejected Alternatives:     Why they were not chosen.
Future Revisit Trigger:    The condition under which this decision should be re-examined.
```

Multiple decisions in one task — repeat the block, one per decision.

### Example

```
Decision Log

Decision:                  Keep docs/, design/, and game/ at the repository root.
Reason:                    Project docs belong to the repository, not the AI operating system.
                           Burying them inside ai-studio/ makes them look like AI tooling.
Alternatives Considered:   Store all docs under ai-studio/docs/.
Rejected Alternatives:     Makes project structure AI-centric instead of project-centric.
                           Contributors unfamiliar with ai-studio would not find them.
Future Revisit Trigger:    If the project becomes a multi-repository workspace where
                           docs need to live closer to the tooling that generates them.
```

### Rules

- The Decision Log is written before the Kanban Update, not after.
- Every rejected alternative must have a reason. "Not chosen" is not a reason.
- `Future Revisit Trigger` must be a concrete condition, not "if things change."
- Decision Logs are the first place to check before re-opening a closed architectural debate.

---

## Required Completion Format

Every completed task must produce a Kanban Update in exactly this format:

```
Kanban Update

Card:            [Phase N] Title of the Kanban card
Status:          Review | Done | Blocked
Completed:       One or two sentences describing what was done.
Changed Files:
  CREATED  path/to/file.md
  UPDATED  path/to/other-file.ts
  REMOVED  path/to/deleted-file.ts
Validation:      How it was confirmed that the work meets acceptance criteria.
Follow-up Tasks: List of new GitHub Issues to create, or "None."

<!-- ai-workflow-record:v1
{"type":"kanban_update","card":146,"worker":"cursor","role":"gameplay-engineer","artifact":null,"head":null,"result":null,"supersedes":null}
-->
```

**Rules for the format:**
- `Card` must match the exact Kanban card title.
- `Status` is `Review` when handing off, `Done` only after review passes.
- `Changed Files` lists every file touched — no omissions.
- `Validation` must be specific. "Looks correct" is not acceptable. Name what was checked and how.
- `Follow-up Tasks` must list every out-of-scope issue discovered during the task.

---

## Blocker Report Format

When a card moves to `Blocked`, the agent must post this in the GitHub Issue immediately:

```
Blocker Report

Card:                  [Phase N] Title
Blocked by:            Description of the blocker (missing decision / dependency / external factor)
Impact:                What cannot proceed until this is resolved
Resolution:            What is needed to unblock (a decision, an ADR, another task completing first)
Owner:                 Who can resolve this (human collaborator / specific role / agent type)
Expected Unblock Date: ISO date (YYYY-MM-DD) or "Unknown — pending Owner decision"
```

A blocked card stays `Blocked` until the resolution is confirmed. Do not restart work on a blocked card without confirming the blocker is resolved.

---

## Duplicate Issue Handling

Before filing a new GitHub Issue:

1. Search open and closed issues for similar titles and keywords.
2. If a duplicate exists and is **open**: add a comment to the existing issue rather than creating a new one. Link the current work to it.
3. If a duplicate exists and is **closed as Done**: the work was completed. Confirm the implementation actually exists before re-opening. If the implementation is missing, re-open with a note explaining what is missing.
4. If a duplicate exists and is **closed as Won't Fix**: do not re-open without a new decision from the human collaborator documented in the issue.

---

## When a Task Can Move to Done

A card moves to `Done` only when **all** of the following are true:

- [ ] All acceptance criteria in the GitHub Issue are met.
- [ ] The designated reviewer has approved the work (see review handoff rules).
- [ ] A Kanban Update has been written and linked in the GitHub Issue.
- [ ] All follow-up issues discovered during the task have been filed.
- [ ] If the task involved architectural changes, the ADR has been written, linked, and accepted.
- [ ] No open questions from the task remain unrecorded (they must be in follow-up issues or the Kanban Update).

---

## When Follow-Up Issues Must Be Created

A follow-up GitHub Issue must be created (not just noted) when any of the following is discovered during a task:

- A bug in existing code unrelated to the current task.
- A design gap that was not in scope but will affect future work.
- A performance, security, or correctness concern that cannot be addressed within the current task.
- An open question from the Kanban Update that requires a decision before related work can begin.
- Any technical debt introduced deliberately to complete the current task on time.

Follow-up issues must be filed before the Kanban Update is written, so they can be listed in `Follow-up Tasks`.

---

## Review Handoff Rules

This project operates a multi-agent review pipeline. The handoff order is fixed:

```
Claude (design / authoring)
  ↓
ChatGPT Review
  ↓
Human Approval
  ↓
Codex / Cursor (implementation)
  ↓
ChatGPT Final Review
  ↓
Done
```

**Rules:**

1. **Claude** produces designs, documents, architecture proposals, and prompts. Claude does not self-approve design work for implementation.
2. **ChatGPT Review** reviews Claude's output for correctness, completeness, and consistency with the constitution. The review must result in one of: `Approved`, `Approved with conditions`, or `Rejected`. A rejection must include specific, actionable feedback. Conditions must be resolved before the next step.
3. **Human Approval** is a hard gate. The human collaborator reads the ChatGPT review and explicitly approves or rejects the work before implementation begins. This approval is documented in the GitHub Issue. No implementation proceeds without it.
4. **Codex / Cursor** implements the human-approved design. Implementation follows the spec exactly. If the spec is ambiguous or incomplete, implementation stops and the ambiguity is raised as a blocker — it is not resolved by inference.
5. **ChatGPT Final Review** confirms that implementation matches the approved design and meets acceptance criteria. The result must be one of: `Approved` (card moves to Done) or `Rejected` (card returns to In Progress with documented feedback).

**No step is skipped.** Claude does not implement. Codex does not design. Human Approval cannot be proxied by an AI agent. Any deviation requires explicit approval from the human collaborator documented in the GitHub Issue.

---

## Architecture Review Required

An architecture review is mandatory — and an ADR must be written and linked — before a Kanban card can move to `Done` when the task touches any of the following:

| Trigger | Examples |
|---------|---------|
| **Folder structure** | Adding, removing, or renaming top-level directories; relocating modules between layers |
| **Data model** | Adding, removing, or renaming fields on simulation entities; changing type shapes |
| **Simulation** | Tick model, agent decision strategy, state management, world state format |
| **Save format** | Any change to the serialized representation of game state |
| **Public API** | Adding or removing exported functions, types, or events that cross system boundaries |
| **Dependency graph** | Adding a new package dependency; removing or replacing an existing one |
| **Serialization** | Changes to how entities, events, or world state are encoded or decoded |

**Process:**

1. Stop implementation when a trigger is recognized — do not continue before the review.
2. Write the ADR in `ai-studio/adr/` using `ai-studio/templates/adr.md`.
3. Move the card to `Review` and request human approval of the ADR before resuming.
4. Link the accepted ADR number in the Kanban Update under `Changed Files`.

A task is not `Done` if an architectural decision was made during it but no ADR was written. This applies even if the change seemed minor.

---

## Review Waived

If the human collaborator explicitly waives the ChatGPT Final Review step, the waiver must be recorded before the card moves to `Done`:

```
Review Waived

Card:        [Phase N] Title
Step Waived: ChatGPT Final Review
Reason:      Explanation of why the review was waived (e.g., trivial non-logic change,
             documentation-only, time-critical hotfix with human having personally reviewed).
Approved By: Human collaborator name or identifier
Date:        YYYY-MM-DD
```

**Rules:**
- Only the human collaborator can waive a review step. No AI agent may self-waive.
- The waiver record must be posted in the GitHub Issue before the card moves to `Done`.
- Waiving review on any task that touches simulation logic, data model, or save format is not permitted regardless of circumstance — those tasks require the full pipeline.
- A pattern of waivers on a given task type is a signal that the review pipeline is too heavy for that task type. Raise it as a follow-up issue to adjust the protocol, rather than normalizing silent skips.
