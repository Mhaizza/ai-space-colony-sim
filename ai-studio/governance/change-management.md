# Change Management

Defines what process is required before any AI Studio document is modified. The process scales with the impact of the change — trivial clarifications have a lighter path than constitutional amendments.

---

## Change Tiers

| Tier | Description | Examples |
|------|-------------|---------|
| **Tier 1 — Clarification** | Rewording that does not alter meaning. Typo fixes, formatting, added examples. | Fix a typo in `principles.md`; add an example to `glossary.md` |
| **Tier 2 — Extension** | Adding new content that does not contradict existing content. | Add a new principle; add a new glossary term; add a new workflow step |
| **Tier 3 — Amendment** | Changing existing meaning, removing content, or redefining a term or rule. | Change a principle's anti-patterns; redefine a glossary term; remove a workflow step |
| **Tier 4 — Constitutional Change** | Any change to `ai-studio/constitution/` or `ai-studio/governance/`. | Modify `vision.md`; change ownership rules; alter the ADR requirement |

---

## Required Process per Tier

### Tier 1 — Clarification
1. Edit the file directly.
2. Note the change in the Kanban Update (`Changed Files` section).
3. No ADR, no review required.

### Tier 2 — Extension
1. Propose the addition in the relevant GitHub Issue.
2. ChatGPT review (consistency check against existing content).
3. Human approval in the GitHub Issue.
4. Edit the file.
5. Kanban Update with Decision Log entry.

### Tier 3 — Amendment
1. Propose the change in a GitHub Issue with full rationale.
2. ChatGPT review.
3. Human approval — explicit, documented in the GitHub Issue.
4. Edit the file.
5. Bump the document version (see `versioning.md`).
6. Kanban Update with Decision Log entry.

### Tier 4 — Constitutional Change
1. Open a GitHub Issue titled `[Constitution] <description of change>`.
2. Write an ADR in `ai-studio/adr/` before making any edits.
3. ADR must reach `Accepted` status (human approval) before the file is touched.
4. ChatGPT review of the proposed change against all dependent documents.
5. Human approval of the full change set.
6. Edit the file(s).
7. Bump version on all affected documents.
8. Kanban Update with Decision Log entry linking the ADR.

---

## Emergency Changes

An emergency change is a Tier 3 or Tier 4 change that must be made immediately because a blocking error or contradiction was discovered mid-task.

Process:
1. Make the minimum edit required to unblock work.
2. Mark the change with an inline comment: `<!-- EMERGENCY CHANGE: reason, date -->`
3. File a GitHub Issue immediately tagged `emergency-change`.
4. Complete the full Tier 3 or Tier 4 process retroactively within the same phase.

Emergency changes that are not retroactively processed within the same phase are treated as violations of this protocol.

---

## What Triggers an ADR

An ADR is required (regardless of tier) when any change involves:

- A decision that future agents or contributors will need to understand without reading the task transcript.
- A choice where multiple reasonable alternatives existed and were evaluated.
- A change to any document in `ai-studio/constitution/` or `ai-studio/governance/`.
- Any change that affects the interpretation of a glossary term used in code.

When in doubt, write the ADR. ADRs are cheap. Reconstructing a decision from history is expensive.
