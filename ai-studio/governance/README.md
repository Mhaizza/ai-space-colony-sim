# Governance

**Owner:** Technical Director + Human Collaborator (joint)
**Scope:** AI Studio internal — defines who can change what, when review is required, and how the AI Studio itself evolves over time.

Governance documents are the rules about the rules. They prevent the constitution and workflows from drifting silently as the project grows, and ensure that any AI agent — current or future — operates within a known, auditable authority structure.

## Files

| File | Purpose |
|------|---------|
| [`change-management.md`](change-management.md) | Who can change each document type, what process is required, what triggers an ADR |
| [`versioning.md`](versioning.md) | When and how to bump document versions; freeze protocol |
| [`ownership.md`](ownership.md) | Authority matrix: document → owner → reviewer → approver |
| [`release-process.md`](release-process.md) | How AI Studio documents are released at phase milestones; git tagging |

## Why This Exists

A project with one contributor and one AI agent can run on informal rules. A project with multiple AI agents, multiple human collaborators, or multi-phase history cannot. Governance makes the implicit explicit before the implicit becomes a source of contradictions.

## Rule

Governance documents change rarely and require Human Collaborator approval before any edit is applied. Changes to governance are themselves governed by `change-management.md` at Tier 4.
