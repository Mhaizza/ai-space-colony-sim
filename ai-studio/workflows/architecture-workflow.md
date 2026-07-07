# Architecture Workflow

## 1. Purpose

Govern the process for proposing, evaluating, and accepting architectural decisions. Architecture decisions affect system structure in ways that are expensive to reverse — this workflow ensures they are made deliberately, documented permanently, and never implemented until formally approved.

---

## 2. When to Use

Use this workflow when a task touches any of the following:

- Folder structure or module boundaries
- Data model (simulation entity shape, type definitions)
- Simulation architecture (tick model, agent decision strategy, world state format)
- Save/load format
- Public API surface (exported functions, types, events that cross system boundaries)
- Dependency graph (adding, removing, or replacing a package)
- Serialization format
- Inter-system contracts or communication patterns

**Implementation stops** when any of the above triggers are recognized mid-task. The Architecture Workflow must complete before implementation resumes.

---

## 3. Inputs

| Input | Required? | Description |
|-------|-----------|-------------|
| GitHub Issue | Required | Issue describing the architectural question or change |
| Kanban card | Required | Card in `Ready` status |
| Trigger context | Required | Description of what triggered the architecture review (which task, which discovery) |
| Relevant ADRs | Required | Prior decisions that bear on this proposal |
| Constitution documents | Required | `architecture-philosophy.md`, `principles.md` |

---

## 4. Outputs

| Output | Description |
|--------|-------------|
| ADR | Completed Architecture Decision Record in `ai-studio/adr/` |
| Human approval | Explicit approval of the ADR in the GitHub Issue |
| Updated documents | Any constitution, design spec, or workflow updated as a consequence |
| Decision Log | Entry capturing the decision and all rejected alternatives |
| Kanban Update | Mandatory completion record |

---

## 5. Step-by-Step Process

```
1. [Any agent] Recognize an architecture trigger (see §2 above)
   → Stop current implementation immediately
   → Note the trigger point in the GitHub Issue

2. [Claude] Post Start Task record to the architecture GitHub Issue
3. [Claude] Research: read relevant ADRs, constitution, and prior decisions
4. [Claude] Write ADR draft in ai-studio/adr/NNNN-title.md
   → Include: Context, Decision, Consequences, Alternatives Considered, Rejected Alternatives
5. [Claude] Move card to Review

6. [ChatGPT] Architecture Review:
   → Check ADR against constitution/architecture-philosophy.md
   → Check for contradictions with existing ADRs
   → Check that all alternatives were genuinely considered
   → Post result: Approved / Approved with conditions / Rejected

7. [Human] Read ADR + ChatGPT architecture review
   → Post explicit approval or rejection with feedback
   → Rejection: Claude revises ADR; return to step 4
   → Approval: ADR status changes to Accepted

8. [Claude] Update ADR status to Accepted
9. [Claude] Update any documents affected by the decision (version bump per versioning.md)
10. [Claude] Write Decision Log + Kanban Update
11. [Claude] Unblock the original task that triggered this workflow
    → Original task may now resume implementation
```

---

## 6. Decision Points

| Point | Question | Paths |
|-------|----------|-------|
| Step 1 | Is this trigger architectural? | Yes → stop + open Architecture Workflow; No → continue with Feature Workflow |
| Step 6 | Does ADR pass ChatGPT review? | Pass → step 7; Rejected → revise ADR |
| Step 7 | Does Human approve the ADR? | Yes → ADR Accepted; No → revise or abandon |
| Step 9 | Do any existing documents contradict the new decision? | Yes → amend documents per change-management.md Tier 3/4; No → continue |

---

## 7. Required Approvals

| Approval | Who | When | Blocking? |
|----------|-----|------|-----------|
| Architecture Review | ChatGPT | After ADR draft | Yes — Human cannot approve an unreviewed ADR |
| ADR Acceptance | Human Collaborator | After ChatGPT review | Yes — implementation does not resume without it |

No AI agent may accept an ADR on behalf of the Human. This rule has no exceptions.

---

## 8. Kanban State Transitions

```
Backlog
  → Ready         (after trigger is recognized and issue is filed)
  → In Progress   (while ADR is being drafted)
  → Review        (ADR submitted for ChatGPT architecture review)
  → Blocked       (if prior ADR conflict requires resolution before proceeding)
  → Done          (ADR accepted, documents updated, original task unblocked)
```

The original task that triggered this workflow remains `Blocked` until this card reaches `Done`.

---

## 9. Required Artifacts

- [ ] ADR in `ai-studio/adr/NNNN-title.md` with status `Accepted`
- [ ] ChatGPT architecture review record
- [ ] Human approval comment in GitHub Issue
- [ ] Updated documents (if any) with version bumps
- [ ] Decision Log
- [ ] Kanban Update

---

## 10. Exit Criteria

The architectural decision is **Done** when all of the following are true:

- [ ] ADR is filed in `ai-studio/adr/` and status is `Accepted`.
- [ ] Human approval is on record in the GitHub Issue.
- [ ] All documents affected by the decision have been updated.
- [ ] The original task that triggered this workflow has been unblocked.
- [ ] Decision Log is written.
- [ ] Kanban Update is written and linked.
