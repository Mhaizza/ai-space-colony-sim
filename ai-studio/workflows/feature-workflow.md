# Feature Workflow

## 1. Purpose

Define the end-to-end process for designing, reviewing, implementing, and shipping a new feature. Ensures every feature passes through design validation and human approval before implementation begins, and through final review before it is considered done.

---

## 2. When to Use

Use this workflow when:
- Adding new functionality that did not exist before.
- Extending an existing system with new behavior.
- Building a new UI component, simulation system, or game mechanic.

Do **not** use this workflow for:
- Bug fixes → use `bug-workflow.md`
- Architecture changes that precede a feature → use `architecture-workflow.md` first
- Research or exploration with no immediate deliverable → use `research-workflow.md`

---

## 3. Inputs

| Input | Required? | Description |
|-------|-----------|-------------|
| GitHub Issue | Required | Scoped issue with acceptance criteria |
| Kanban card | Required | Card in `Ready` status |
| Constitution documents | Required | `principles.md`, `architecture-philosophy.md` |
| Design spec or reference | Recommended | Prior research output, relevant ADRs, glossary definitions |
| Start Task record | Required | Posted to GitHub Issue before work begins |

---

## 4. Outputs

| Output | Description |
|--------|-------------|
| Design document | Claude's design artifact — spec, document, or prompt |
| ChatGPT review record | Review result with findings and approval status |
| Human approval comment | Explicit approval in the GitHub Issue |
| Implementation | Code produced by Codex / Cursor |
| Final review record | ChatGPT confirmation that implementation matches the approved design |
| Decision Log | One entry per significant decision made during the feature |
| Kanban Update | Mandatory completion record |

---

## 5. Step-by-Step Process

```
1. [Claude] Post Start Task record to GitHub Issue
2. [Claude] Read constitution, relevant ADRs, and acceptance criteria
3. [Claude] Produce design artifact (spec, document, prompt, or schema)
4. [Claude] Move card to Review; assign to ChatGPT
5. [ChatGPT] Review design for correctness, completeness, constitutional alignment
6. [ChatGPT] Post review result: Approved / Approved with conditions / Rejected
   → Rejected: Claude revises; return to step 3
   → Approved with conditions: Claude resolves conditions; ChatGPT confirms; continue
7. [Human] Read design + ChatGPT review; post explicit approval comment
   → Not approved: Claude revises per feedback; return to step 3
8. [Claude] Move card to In Progress
9. [Codex] Implement the approved design exactly as specified
   → Ambiguity discovered: stop; raise blocker; wait for clarification
   → Architecture trigger discovered: stop immediately
     · Move feature card to Blocked
     · Open Architecture Workflow card (separate issue)
     · Unaffected parts of this feature may only continue if filed as a new follow-up issue
       with its own card — they do not continue under the blocked card
     · Feature card stays Blocked until Architecture Workflow reaches Done
10. [Cursor] (Optional) Refactor for code quality without changing behavior
    → Any behavioral change in refactor = new issue, new card
11. [ChatGPT] Final review: confirm implementation matches approved design + acceptance criteria
    → Rejected: Codex fixes; return to step 9
12. [Claude] Write Decision Log + Kanban Update
13. [Human] Move card to Done
```

---

## 6. Decision Points

| Point | Question | Paths |
|-------|----------|-------|
| After step 5 | Does the design pass ChatGPT review? | Pass → step 7; Rejected → step 3; Conditions → resolve then continue |
| After step 7 | Does the Human approve the design? | Yes → step 8; No → step 3 with feedback |
| During step 9 | Is the spec ambiguous or incomplete? | Clear → continue; Ambiguous → blocker, wait |
| After step 11 | Does implementation match the approved design? | Yes → step 12; No → step 9 |

---

## 7. Required Approvals

| Approval | Who | When | Blocking? |
|----------|-----|------|-----------|
| Design review | ChatGPT | After Claude produces design | Yes — implementation cannot begin without it |
| Human approval | Human Collaborator | After ChatGPT approves design | Yes — hardest gate in the pipeline |
| Final review | ChatGPT | After implementation | Yes — card cannot move to Done without it |
| Final review waiver | Human Collaborator | If Final Review is skipped | Yes — must be recorded per governance rules |

---

## 8. Kanban State Transitions

```
Backlog
  → Ready         (after issue is scoped and acceptance criteria are written)
  → In Progress   (after Human approval; when Codex begins implementation)
  → Review        (after Claude design; after Codex implementation)
  → Blocked       (if ambiguity, missing dependency, or unresolved decision)
  → Done          (after Final Review passes and Kanban Update is written)
```

A card may cycle between `In Progress` and `Review` multiple times before reaching `Done`.

---

## 9. Required Artifacts

- [ ] Start Task record (GitHub Issue comment)
- [ ] Design artifact (document, spec, or schema)
- [ ] ChatGPT review record
- [ ] Human approval comment in GitHub Issue
- [ ] Implementation (committed code)
- [ ] Decision Log (one entry per significant decision)
- [ ] Kanban Update

If the Final Review is waived: Review Waived record (see `kanban-update-protocol.md`).

---

## 10. Exit Criteria

The feature is **Done** when all of the following are true:

- [ ] All acceptance criteria in the GitHub Issue are met.
- [ ] ChatGPT Final Review has passed (or waiver is on record).
- [ ] Human has confirmed the card can move to Done.
- [ ] Decision Log is written.
- [ ] Kanban Update is written and linked in the GitHub Issue.
- [ ] All follow-up issues discovered during the feature have been filed.
- [ ] If the feature touched architectural boundaries: ADR is written and accepted.
