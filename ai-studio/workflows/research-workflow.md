# Research Workflow

## 1. Purpose

Define how exploratory work is conducted, scoped, and concluded. Research tasks answer a specific question. They always end with a concrete recommendation — never with "more research is needed."

---

## 2. When to Use

Use this workflow when:
- A technical or design question must be answered before a feature can be designed.
- Multiple approaches exist and the right one is unclear.
- Domain knowledge is needed before writing a spec or ADR.
- A prior decision needs to be re-evaluated in light of new information.

Do **not** use this workflow when:
- The approach is already decided — use `feature-workflow.md` or `architecture-workflow.md`.
- The task is a bug investigation — use `bug-workflow.md`.
- The task is a design activity with a known output — use `feature-workflow.md`.

---

## 3. Inputs

| Input | Required? | Description |
|-------|-----------|-------------|
| Research question | Required | A single, specific question the research will answer |
| Scope boundary | Required | What is in and out of scope for this research |
| GitHub Issue | Required | Issue documenting the question and expected output format |
| Deadline / phase constraint | Recommended | When the answer is needed to unblock downstream work |
| Prior ADRs and constitution docs | Required | Research must not ignore prior decisions |

---

## 4. Outputs

| Output | Description |
|--------|-------------|
| Research summary | Findings organized around the research question |
| Recommendation | A single, specific recommendation with rationale |
| Alternatives evaluated | All options considered, with reasons for not choosing them |
| Decision Log | One entry capturing the recommendation and rejected alternatives |
| Follow-up issues | Any new questions or tasks surfaced during research |
| Kanban Update | Mandatory completion record |

Research does **not** output: "this requires more research," "it depends," or an open-ended list of options with no preference stated. If the answer genuinely cannot be determined from available information, the output is: "Recommendation: defer this decision until [specific condition]. Reason: [specific gap]." That is a recommendation, not a non-answer.

---

## 5. Step-by-Step Process

```
1. [Claude] Post Start Task record with:
   - The research question (single sentence)
   - Scope boundary (what will and will not be investigated)
   - Expected output format (recommendation + alternatives)

2. [Claude] Review constitution, existing ADRs, and prior research for relevant prior decisions
   → If the question was already answered: note the prior decision; close as duplicate

3. [Claude] Investigate within scope
   → Read specifications, academic references, comparable projects
   → Document each option evaluated with: pros, cons, fit with constitution
   → Do not expand scope without updating the GitHub Issue

4. [Claude] Form a recommendation
   → Pick one option as the recommendation
   → If genuinely undecidable: state the specific missing information and the concrete
     condition under which it would become decidable — this is still a recommendation

5. [Claude] Write research summary with:
   - Research question (restated)
   - Recommendation (one option, clearly stated)
   - Rationale (why this option over others)
   - Alternatives evaluated (each with reason for rejection)
   - Assumptions made
   - Risks or caveats
   - Follow-up issues (if any)

6. [ChatGPT] Minor Review:
   → Does the recommendation follow from the evidence?
   → Are alternatives genuinely evaluated or superficially dismissed?
   → Is the recommendation actionable without further research?

7. [Human] Read summary + review; decide whether to:
   → Accept recommendation → follow-up Feature or Architecture task is filed
   → Reject recommendation → Claude revises with specific guidance
   → Defer recommendation → explicit deferral reason posted in GitHub Issue

8. [Claude] Write Decision Log + Kanban Update
```

---

## 6. Decision Points

| Point | Question | Paths |
|-------|----------|-------|
| Step 2 | Was this already researched? | Yes → cite prior decision, close as duplicate; No → continue |
| Step 4 | Can a single recommendation be formed? | Yes → continue; No → state specific missing condition, still counts as recommendation |
| Step 6 | Does the recommendation hold under review? | Yes → step 7; No → revise |
| Step 7 | Does Human accept the recommendation? | Accept → file follow-up task; Reject → revise; Defer → document deferral reason |

---

## 7. Required Approvals

| Approval | Who | When | Blocking? |
|----------|-----|------|-----------|
| Research review | ChatGPT | After research summary is written | Yes — ensures recommendation is well-founded |
| Recommendation acceptance | Human Collaborator | After ChatGPT review | Yes — determines whether follow-up work is filed |

---

## 8. Kanban State Transitions

```
Backlog
  → Ready         (after research question is scoped in GitHub Issue)
  → In Progress   (investigation underway)
  → Review        (summary written; ChatGPT reviewing)
  → Blocked       (scope requires information that is unavailable)
  → Done          (Human accepts or explicitly defers recommendation)
```

---

## 9. Required Artifacts

- [ ] Start Task record with research question and scope boundary
- [ ] Research summary (question, recommendation, alternatives, assumptions, risks)
- [ ] ChatGPT review record
- [ ] Human acceptance, rejection, or explicit deferral comment in GitHub Issue
- [ ] Decision Log
- [ ] Kanban Update
- [ ] Follow-up issues filed (if research surfaces new questions)

---

## 10. Exit Criteria

Research is **Done** when all of the following are true:

- [ ] A recommendation is on record (even if that recommendation is a specific deferral).
- [ ] All evaluated alternatives have documented rejection reasons.
- [ ] ChatGPT review has passed.
- [ ] Human has explicitly accepted, rejected, or deferred the recommendation.
- [ ] Follow-up issues are filed for any new questions surfaced.
- [ ] Decision Log is written.
- [ ] Kanban Update is written and linked.
