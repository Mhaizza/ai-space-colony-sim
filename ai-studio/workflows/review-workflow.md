# Review Workflow

## 1. Purpose

Define the four review types used in this project, when each applies, and what outcome each must produce. Reviews are not optional commentary — they are gates that must be passed before work progresses.

---

## 2. When to Use

This workflow is invoked by other workflows. It does not have its own Kanban card — it is a subprocess. Refer to this document when any workflow says "proceed to review."

---

## 3. Review Types

### Minor Review

**Purpose:** Confirm that a non-architectural change is correct, complete, and consistent with existing documents.

**Applies to:**
- New workflow documents, checklists, or prompt files
- Extensions to existing documents (Tier 2 changes)
- Documentation updates that do not affect system behavior

**Reviewer:** ChatGPT

**Process:**
1. Reviewer reads the artifact against its acceptance criteria.
2. Reviewer checks for contradictions with the constitution and existing workflows.
3. Reviewer posts result: `Approved`, `Approved with conditions`, or `Rejected` with specific feedback.

**Required outcome:** `Approved` or `Approved with conditions` (conditions resolved before progressing).

**Human approval required:** No — unless the change is Tier 3 or higher (see `change-management.md`).

---

### Architecture Review

**Purpose:** Confirm that an ADR is sound — that the decision is well-reasoned, alternatives were genuinely considered, and the decision does not contradict the constitution or prior accepted ADRs.

**Applies to:**
- All ADR drafts (required before Human approval)
- Any task flagged as an architecture trigger (see `architecture-workflow.md`)

**Reviewer:** ChatGPT

**Process:**
1. Reviewer reads the ADR against `architecture-philosophy.md` and `principles.md`.
2. Reviewer checks for conflicts with all existing `Accepted` ADRs.
3. Reviewer evaluates whether rejected alternatives were genuinely considered.
4. Reviewer posts result: `Approved`, `Approved with conditions`, or `Rejected` with specific, actionable feedback.

**Required outcome:** `Approved` or `Approved with conditions` before Human reads the ADR.

**Human approval required:** Yes — Architecture Review is a prerequisite for Human approval, not a substitute for it.

---

### Game Design Review

**Purpose:** Confirm that a design document or game system spec is consistent with the project vision, principles, and player fantasy — and that it would produce the intended player experience.

**Applies to:**
- New files in `design/systems/`, `design/ui/`, `design/narrative/`
- Changes to `game/core-loop.md` or `game/narrative-bible.md`
- Any mechanic that significantly affects the player experience

**Reviewer:** ChatGPT + Creative Director role

**Process:**
1. Reviewer reads the design against `vision.md`, `principles.md`, and the player fantasy statement.
2. Reviewer checks for mechanical conflicts with existing system specs.
3. Reviewer evaluates whether the design could produce unintended emergent behavior that contradicts the vision.
4. Reviewer posts result: `Approved`, `Approved with conditions`, or `Rejected` with specific feedback.

**Required outcome:** `Approved` or `Approved with conditions` before the design moves to implementation.

**Human approval required:** Yes — all game design reviews require Human approval before implementation.

---

### Final Review

**Purpose:** Confirm that implementation matches the approved design and meets all acceptance criteria. This is the last gate before `Done`.

**Applies to:**
- All implemented features (mandatory)
- Bug fixes that modify simulation logic (mandatory)
- Refactors that cross system boundaries (mandatory)

**Reviewer:** ChatGPT

**Process:**
1. Reviewer reads the implemented code or document against the approved design artifact.
2. Reviewer verifies every acceptance criterion from the GitHub Issue is met.
3. Reviewer checks for unintended side effects or scope creep introduced during implementation.
4. Reviewer posts result: `Approved` (card moves to Done) or `Rejected` (card returns to In Progress with specific feedback).

**Required outcome:** `Approved` before card moves to `Done`.

**Human approval required:** No — unless Final Review is waived (see `kanban-update-protocol.md` Review Waived section).

---

## 4. Inputs

| Input | Required? | Description |
|-------|-----------|-------------|
| Artifact to review | Required | The document, ADR, design spec, or implementation |
| Acceptance criteria | Required | From the linked GitHub Issue |
| Reference documents | Required | Constitution docs, prior ADRs, or approved design |
| Review type | Required | Minor / Architecture / Game Design / Final |

---

## 5. Outputs

| Output | Description |
|--------|-------------|
| Review result | `Approved`, `Approved with conditions`, or `Rejected` |
| Findings | Specific, actionable feedback for every issue raised |
| Review record | Posted in GitHub Issue; archived in `ai-studio/reviews/` for Architecture and Game Design reviews |

---

## 6. Step-by-Step Process

```
1. Requesting agent posts review request in GitHub Issue with:
   - Review type
   - Link to artifact
   - Acceptance criteria reference
   - Specific questions (if any)

2. Reviewer reads artifact against reference documents

3. Reviewer checks each acceptance criterion explicitly

4. Reviewer posts structured result:
   [REVIEW TYPE] — [Result]
   Findings:
     - Finding 1 (severity: critical / major / minor / nit)
     - Finding 2
   Required before progressing: [list or "None"]

5. Requesting agent handles findings:
   → Approved: continue to next step in parent workflow
   → Approved with conditions: resolve each condition; reviewer confirms; continue
   → Rejected: revise artifact; request new review

6. For Architecture Review and Game Design Review:
   Archive result in ai-studio/reviews/YYYY-MM-DD-[type]-[subject].md
```

---

## 7. Decision Points

| Point | Question | Paths |
|-------|----------|-------|
| After review result | What is the outcome? | Approved → continue; Conditions → resolve first; Rejected → revise |
| Conditions resolution | Are all conditions resolved? | Yes → reviewer confirms, continue; No → stay in Review |
| Finding severity | Is any finding `critical`? | Yes → Rejected regardless of other findings; No → may be Approved with conditions |

---

## 8. Kanban State Transitions

Review does not own a Kanban card — it is a subprocess. The parent card stays in `Review` status while any review is in progress.

---

## 9. Required Artifacts

- [ ] Review request posted in GitHub Issue
- [ ] Structured review result (type, outcome, findings)
- [ ] For Architecture and Game Design reviews: archived record in `ai-studio/reviews/`

---

## 10. Exit Criteria

A review is **complete** when:

- [ ] Reviewer has posted a structured result with outcome and findings.
- [ ] All `critical` and `major` findings are resolved or explicitly accepted as known risk.
- [ ] `Approved` or `Approved with conditions (resolved)` is on record.
- [ ] For Architecture and Game Design: result is archived in `ai-studio/reviews/`.
