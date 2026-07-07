# Constitution Change Workflow

## 1. Purpose

Govern any change to the documents in `ai-studio/constitution/`. The constitution is the highest-authority layer of the project — changes to it affect every agent, every workflow, and every decision that references it. This workflow ensures those changes are deliberate, reviewed, documented, and traceable.

---

## 2. When to Use

Use this workflow for any proposed change to:
- `constitution/vision.md`
- `constitution/principles.md`
- `constitution/architecture-philosophy.md`
- `constitution/coding-standards.md`
- `constitution/glossary.md`

Also use this workflow for changes to `ai-studio/governance/` — governance documents carry the same authority weight as constitution documents.

This workflow is a Tier 4 change by definition (see `change-management.md`). There are no exceptions.

---

## 3. Inputs

| Input | Required? | Description |
|-------|-----------|-------------|
| Proposed change description | Required | What is changing and why, in plain language |
| GitHub Issue | Required | Issue titled `[Constitution] <description>` |
| Current document version | Required | What the document says now |
| Trigger | Required | What situation revealed that the current text is wrong or insufficient |
| Affected downstream documents | Required | Which workflows, ADRs, or design specs reference the section being changed |

---

## 4. Outputs

| Output | Description |
|--------|-------------|
| ADR | Permanent record of the constitutional decision |
| Updated constitution document | Amended text with MAJOR version bump |
| Updated downstream documents | All documents that reference the changed section, updated to reflect new meaning |
| Decision Log | Entry capturing the change, all alternatives considered, and future revisit trigger |
| Kanban Update | Mandatory completion record |

---

## 5. Step-by-Step Process

```
Phase 1 — Propose

1. [Any agent or Human] File GitHub Issue: [Constitution] <description of proposed change>
   → Include: what is wrong with the current text, what the proposed change is,
     and what triggered the need for this change
2. [Claude] Post Start Task record
3. [Claude] Identify all downstream documents that reference the affected section
   → Search all files in ai-studio/ and design/ for references to the changed term or principle
   → List every affected document in the GitHub Issue before proceeding

Phase 2 — Draft ADR

4. [Claude] Write ADR draft in ai-studio/adr/NNNN-constitution-<topic>.md
   → Context: why the current text is insufficient
   → Decision: exactly what the new text will say
   → Consequences: what downstream documents must change as a result
   → Alternatives considered: other phrasings or approaches evaluated
   → Rejected alternatives: reasons each was not chosen

Phase 3 — Architecture Review

5. [ChatGPT] Architecture Review of the ADR:
   → Does the proposed change contradict any other principle in the constitution?
   → Does it contradict any accepted ADR?
   → Are all downstream consequences identified?
   → Are alternatives genuinely evaluated?
   → Post result: Approved / Approved with conditions / Rejected

   → Rejected: Claude revises ADR; return to step 4
   → Approved with conditions: Claude resolves; ChatGPT confirms; continue

Phase 4 — Human Approval

6. [Human] Read the proposed change, the ADR, and the Architecture Review result
   → Post explicit approval or rejection with specific feedback
   → Rejection: Claude revises; return to step 4
   → Approval: ADR status changes to Accepted; proceed

Phase 5 — Apply Change

7. [Claude] Edit the constitution document
   → Change only what the ADR specifies — no opportunistic edits
   → Bump MAJOR version in the document header per versioning.md
   → Add ADR reference to version header: <!-- version: X.0 | adr: NNNN -->

8. [Claude] Update all downstream documents identified in step 3
   → Each updated document receives a version bump per versioning.md
   → Each update is noted in the Kanban Update Changed Files section

Phase 6 — Verify + Close

9. [ChatGPT] Final Review:
   → Confirm constitution document change matches the accepted ADR exactly
   → Confirm all identified downstream documents have been updated
   → Confirm version headers are correct
   → Post result: Approved or Rejected

10. [Claude] Write Decision Log + Kanban Update
11. [Human] Move card to Done
```

---

## 6. Decision Points

| Point | Question | Paths |
|-------|----------|-------|
| Step 3 | Are there downstream documents to update? | Yes → list them before proceeding; No → document "no downstream impact" in Issue |
| Step 5 | Does ADR pass Architecture Review? | Pass → step 6; Rejected → revise ADR |
| Step 6 | Does Human approve? | Yes → apply change; No → revise or abandon |
| Step 7 | Does the edit exceed the ADR's scope? | In scope → continue; Exceeds scope → stop, file new issue for the additional change |
| Step 9 | Does Final Review pass? | Yes → Done; No → revert excess changes, re-review |

---

## 7. Required Approvals

| Approval | Who | When | Blocking? | Can Be Skipped? |
|----------|-----|------|-----------|----------------|
| Architecture Review | ChatGPT | After ADR draft | Yes | Never |
| Human Approval | Human Collaborator | After Architecture Review | Yes | Never |
| Final Review | ChatGPT | After change applied | Yes | Never |

No step in this workflow can be waived. Constitution changes are the only workflow category where the Review Waived mechanism in `kanban-update-protocol.md` does not apply.

---

## 8. Kanban State Transitions

```
Backlog
  → Ready         (after issue is filed with full change description)
  → In Progress   (ADR drafting and downstream identification)
  → Review        (Architecture Review; Final Review)
  → Blocked       (if ADR conflicts with existing decision that must be resolved first)
  → Done          (Human approved, change applied, downstream updated, Final Review passed)
```

The constitution document is not edited until step 7 — after Human approval. No draft edits to constitution files during earlier phases.

---

## 9. Required Artifacts

- [ ] GitHub Issue titled `[Constitution] <description>`
- [ ] ADR with status `Accepted` in `ai-studio/adr/`
- [ ] ChatGPT Architecture Review record (archived in `ai-studio/reviews/`)
- [ ] Human approval comment in GitHub Issue
- [ ] Amended constitution document with MAJOR version bump and ADR reference
- [ ] All downstream documents updated with version bumps
- [ ] ChatGPT Final Review record
- [ ] Decision Log
- [ ] Kanban Update

---

## 10. Exit Criteria

The constitution change is **Done** when all of the following are true:

- [ ] ADR is in `Accepted` status and linked from the amended document.
- [ ] Human approval is on record in the GitHub Issue.
- [ ] Constitution document reflects the accepted ADR — no more, no less.
- [ ] MAJOR version was bumped on the amended document.
- [ ] All downstream documents identified in step 3 have been updated.
- [ ] ChatGPT Final Review has passed.
- [ ] Decision Log is written with future revisit trigger specified.
- [ ] Kanban Update is written and linked.
