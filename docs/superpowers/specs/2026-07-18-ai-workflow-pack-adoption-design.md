# AI Workflow Pack Adoption Design

**Issue:** #136  
**Status:** Approved for written-spec review  
**Date:** 2026-07-18

## Goal

Make one permanent repository workflow immediately discoverable and mechanically verifiable by Claude, Codex, Cursor, and human contributors. This is a tooling and governance change only; it does not alter simulation behavior.

## Canonical Sources

- `docs/ai-workflow/operating-model.md` is the authority for roles, gates, state transitions, and handoffs.
- `docs/ai-workflow/prompt-pack.md` contains reusable role prompts.
- The lifecycle templates in `docs/ai-workflow/` define card, Start Task, PR, review, and Done records.
- `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and GitHub templates are entrypoints. They point to the canonical sources instead of duplicating the full policy.

If an entrypoint conflicts with the operating model, the operating model wins and the validator reports the drift.

## Repository Shape

The adopted pack consists of:

- root entrypoints for Codex/general agents, Claude, and contributors;
- `docs/ai-workflow/` for the operating model, prompt pack, and templates;
- `.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE.md` for GitHub-native routing;
- a dependency-free Node.js validator and Node test suite;
- one documented local validation command.

No root package manager or new runtime dependency is introduced. The validator runs with the Node.js runtime already required by the prototype.

## Validator Contract

The validator accepts a repository root and returns a non-zero exit code with actionable messages when any required contract is broken. It checks:

1. all required workflow, entrypoint, and GitHub-template files exist;
2. the operating model contains the core laws and required role sections;
3. the prompt pack contains Planner, Implementer, Reviewer, and Workflow Operator prompts;
4. lifecycle templates contain their required fields;
5. root entrypoints reference `docs/ai-workflow/` and identify the relevant worker role;
6. Markdown links used by the workflow pack resolve inside the repository.

The validator must not modify files, GitHub state, or Kanban state. Output is deterministic: findings are sorted by file and rule id.

## Error Handling

- Missing files produce one finding per file.
- Missing headings, fields, or role prompts identify the file and contract name.
- Broken local links identify both source file and unresolved target.
- Multiple findings are reported in one run so a worker can fix them in one patch.
- Success prints a short summary with the number of validated files and checks.

## Agent Workflow Trial

- **Codex Planner:** owns Issue #136, authority mapping, design, implementation plan, and routing.
- **Claude Implementer:** adopts the approved files and implements the validator/tests on a dedicated branch; stops at review-ready PR state.
- **Codex Reviewer:** reviews findings-first for behavior, scope, governance drift, and validation quality.
- **Cursor Patch Worker:** receives only concrete review findings with parent issue/PR, exact files, and acceptance checks; it does not own broad implementation.
- **Human Owner:** approves the written design and final merge/close gates.
- **Codex Workflow Operator:** records approval, merges, closes, and posts the final Done update only after Human approval.

If review has no findings, Cursor is explicitly recorded as `not invoked: no patch required`; the workflow does not manufacture a defect merely to exercise a role.

## Testing

The implementation must include:

- a positive test against a complete temporary workflow fixture;
- negative tests for a missing file, missing role prompt, missing template field, and broken link;
- deterministic finding-order coverage;
- a live validator run against the proposed repository tree;
- the existing prototype suite to prove the tooling change does not affect gameplay;
- a changed-file audit proving Issue #135 and `prototype/src/` are untouched.

## Scope Boundaries

In scope: the workflow pack, its entrypoints/templates, validator, tests, and usage documentation.

Out of scope: gameplay code, Issue #135, automatic approval, automatic merge, automatic issue closure, ADRs, and unrelated local drafts such as `.codex/`, codebase snapshots, or session maps.

## Completion Gates

1. Human approves this written design.
2. An implementation plan is committed.
3. Claude returns a review-ready PR with validation evidence.
4. Codex issues `Approved` or concrete findings.
5. Cursor addresses findings only if findings exist, followed by re-review.
6. Human approves merge.
7. Workflow Operator merges, posts Done, and closes #136.

