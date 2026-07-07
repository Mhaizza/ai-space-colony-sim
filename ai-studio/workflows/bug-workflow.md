# Bug Workflow

## 1. Purpose

Define the process for reporting, classifying, investigating, fixing, and verifying bugs. Classification determines how fast a bug must be addressed and how much review is required.

---

## 2. When to Use

Use this workflow for any defect: behavior that contradicts the specification, a crash, incorrect output, or a simulation invariant that is violated. Do not use this workflow for missing features — those are Feature Workflow tasks.

---

## 3. Bug Classification

Classification is assigned at report time and may be revised when the root cause is understood.

| Class | Definition | Examples | Response Time |
|-------|-----------|---------|--------------|
| **Critical** | Breaks the simulation, causes data loss, or makes the game unplayable. Cannot ship with this open. | Simulation crashes on tick; save file corrupts on load; agent decision loop hangs | Immediately — blocks all other work |
| **Major** | Significant incorrect behavior that contradicts a spec or principle. Affects core gameplay but does not crash. | Colonist need never decays; resource calculation wrong; AI Director fires events at wrong conditions | Current phase — must be fixed before phase release |
| **Minor** | Incorrect behavior in a non-critical path. Noticeable but does not break core gameplay. | Wrong tooltip text; minor visual misalignment; edge-case colonist decision is suboptimal | Next sprint — may be deferred with filed issue |
| **Trivial** | Cosmetic or inconsequential. | Typo in a log message; wrong color on a non-critical UI element | Backlog — fixed when convenient |

**Reclassification:** If investigation reveals a different severity than initially reported, update the GitHub Issue label and note the reclassification with a reason.

---

## 4. Inputs

| Input | Required? | Description |
|-------|-----------|-------------|
| Bug report | Required | GitHub Issue with reproduction steps, expected behavior, actual behavior |
| Classification | Required | Critical / Major / Minor / Trivial |
| Affected spec or principle | Recommended | Which document defines the correct behavior |
| Reproduction case | Required for Critical/Major | Minimal steps or test case that triggers the bug |

---

## 5. Outputs

| Output | Description |
|--------|-------------|
| Root cause analysis | Posted in GitHub Issue — what caused the bug, not just where it manifested |
| Fix | Code change that addresses the root cause |
| Regression test | A test that will fail if this bug is reintroduced (required for Critical/Major) |
| Decision Log | If the fix involves a non-obvious choice between approaches |
| Kanban Update | Mandatory completion record |

---

## 6. Step-by-Step Process

```
1. [Reporter] File GitHub Issue with:
   - Reproduction steps
   - Expected behavior (cite the spec or principle)
   - Actual behavior
   - Initial classification (Critical / Major / Minor / Trivial)
   - Environment / conditions where bug occurs

2. [Claude] Confirm classification; reclassify if root cause investigation warrants it
   → Critical: move card to In Progress immediately; notify human collaborator
   → Major: move card to In Progress within current sprint
   → Minor/Trivial: card stays in Backlog until scheduled

3. [Claude] Post Start Task record

4. [Claude] Investigate root cause
   → Read every caller of the affected function, not just the reported path
   → Identify whether the bug exists in one place or multiple places
   → The fix goes at the root cause, not at each symptom

5. [Claude] Propose fix approach in GitHub Issue comment
   → For Critical/Major: requires human acknowledgement before implementing
   → For Minor/Trivial: may proceed without acknowledgement

6. [Codex] Implement the fix at the root cause
   → If fix touches architectural boundaries: stop; open Architecture Workflow first
   → Fix must not change behavior in unaffected paths

7. [Codex] Write regression test (required for Critical/Major)

8. [ChatGPT] Final Review:
   → Confirm fix addresses root cause, not just the reported symptom
   → Confirm regression test would catch a reintroduction
   → Confirm no unintended behavior changes in adjacent paths

9. [Claude] Write Decision Log (if applicable) + Kanban Update
10. [Human] Move card to Done
```

---

## 7. Decision Points

| Point | Question | Paths |
|-------|----------|-------|
| Step 2 | Is classification correct? | Matches → continue; Needs change → reclassify + note reason |
| Step 4 | Is the root cause in one place or multiple? | One → single fix; Multiple → fix at the shared root, not each caller |
| Step 6 | Does the fix touch an architecture trigger? | Yes → open Architecture Workflow before continuing; No → continue |
| Step 8 | Does the fix introduce unintended behavior changes? | No → Approved; Yes → Rejected, revise |

---

## 8. Required Approvals

| Approval | Class | Who | Blocking? |
|----------|-------|-----|-----------|
| Fix approach acknowledgement | Critical, Major | Human Collaborator | Yes |
| Fix approach acknowledgement | Minor, Trivial | Not required | — |
| Final Review | Critical, Major | ChatGPT | Yes |
| Final Review | Minor, Trivial | ChatGPT (lightweight) | Yes |

---

## 9. Kanban State Transitions

```
Backlog
  → Ready         (after issue is filed and classified)
  → In Progress   (investigation and fix in progress)
  → Review        (fix complete; regression test written)
  → Blocked       (root cause requires architectural decision)
  → Done          (Final Review passed; regression test committed)
```

Critical bugs move directly from filing to `In Progress` — they do not wait in `Ready`.

---

## 10. Required Artifacts

- [ ] GitHub Issue with reproduction steps, expected/actual behavior, and classification
- [ ] Root cause analysis (Issue comment)
- [ ] Fix committed to codebase
- [ ] Regression test (Critical and Major — mandatory; Minor — recommended; Trivial — optional)
- [ ] ChatGPT Final Review record
- [ ] Decision Log (if fix involved a non-obvious approach choice)
- [ ] Kanban Update

---

## 11. Exit Criteria

The bug is **Done** when all of the following are true:

- [ ] Root cause (not just symptom) is fixed.
- [ ] Regression test is committed (Critical and Major).
- [ ] ChatGPT Final Review has passed.
- [ ] No new bugs introduced in adjacent paths (confirmed by Final Review).
- [ ] Kanban Update is written and linked.
