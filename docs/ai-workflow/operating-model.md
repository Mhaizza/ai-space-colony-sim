# AI Agent Operating Model

This document defines the standard multi-agent workflow for `ai-space-colony-sim`.

Use it as the default operating system for every new card unless a card explicitly says otherwise.

## Purpose

This workflow exists to keep AI agents aligned on:

- scope control
- architecture discipline
- review quality
- reproducible handoffs
- reliable closeout

The goal is not maximum parallelism. The goal is correct, reviewable delivery.

## Core Laws

### Law 1 - No Card, No Work

No design, ADR, implementation, or closeout work starts without a supporting issue/card.

### Law 2 - One Card, One Owner

At any one time, one implementation card has one primary implementer.

### Law 3 - Authority First

Every task must name its authority chain before work starts:

- issue/card
- design doc
- ADR
- relevant merged PRs
- governing workflow docs

### Law 4 - No Silent Scope Expansion

If implementation needs behavior or architecture beyond the card, stop and escalate.

### Law 5 - Review Before Merge

No PR merges until the required review gate passes.

### Law 6 - Findings First

All reviews report findings before summary.

### Law 7 - Exact Next Step

Every handoff ends with one exact next step.

## Roles

### Planner

Responsible for:

- creating the next executable card or sub-slice
- setting in-scope and out-of-scope boundaries
- naming dependencies, risks, acceptance criteria, and workflow gates
- deciding whether design and/or ADR gates are required

Planner does not implement code.

### Implementer

Responsible for:

- posting `Start Task` before work
- implementing only the approved card scope
- opening the PR
- posting `Kanban Update: Review`
- reporting validations and remaining risks

Implementer does not merge and does not widen scope unilaterally.

### Reviewer

Responsible for:

- checking regressions
- checking spec/design/ADR conformance
- checking scope drift
- checking validation quality
- issuing `Approved` or `Revisions Required`

Reviewer does not rewrite the task unless escalation is required.

### Workflow Operator

Responsible for:

- recording approvals
- merging approved PRs
- posting final Decision Log / Kanban Update
- closing issues
- identifying the next-card candidate

Workflow Operator does not implement code or reinterpret scope.

### Human Owner

Responsible for:

- approving design/ADR/final gates where required
- answering deferred questions
- making the final call on scope conflicts

## Standard Task States

Every card moves through these states as applicable:

1. `Ready`
2. `Design`
3. `Architecture Gate`
4. `Implementation`
5. `Review`
6. `Human Approval`
7. `Merge`
8. `Done`

Not every card needs every state, but every card must still follow the same overall model.

## Decision Rules

### Require a design step when:

- behavior changes materially
- a new lifecycle or protocol is introduced
- simulation semantics are being revised
- there is real uncertainty about intended behavior

### Require an ADR step when:

- data model changes
- save format changes
- serialization/validation changes
- ownership boundaries change
- replay or other public architectural contracts change

### Go straight to implementation only when:

- the card is already covered by approved design/ADR authority
- no existing authority is being reopened
- the work is an implementation-only slice

### Stop and escalate when:

- implementation contradicts approved design or ADR
- acceptance criteria require widening scope
- a new architectural surface appears

## Golden Path

### 1. Planning

Planner creates exactly one next card or sub-slice.

### 2. Design or ADR Gates

If required, complete them before implementation.

### 3. Implementation

Implementer:

- posts `Start Task`
- works on a dedicated branch
- opens a PR
- posts `Kanban Update: Review`
- stops at review-ready state

### 4. Review

Reviewer checks the PR and returns:

- `Approved`, or
- `Revisions Required`

### 5. Closeout

If approved, Workflow Operator:

- merges the PR
- posts final Done-state update
- closes the issue
- identifies the next card

## Required Artifacts

Every task should use these templates:

- `task-template.md`
- `start-task-template.md`
- `pr-summary-template.md`
- `review-template.md`
- `done-update-template.md`

## Review Priorities

Reviewer checks in this order:

1. behavioral regressions
2. scope violations
3. architecture drift
4. missing validation
5. test gaps
6. maintainability risks

## Handoff Standard

Every handoff must answer:

1. what was done
2. what changed
3. what was validated
4. what remains blocked
5. exact next step

## Project-Specific Rules

For this repository:

- do not mix gameplay work with repo hygiene unless the card explicitly says so
- do not mix design, ADR, and implementation in one step unless the workflow explicitly authorizes it
- do not start the next sub-slice in the same PR
- keep deferred questions deferred until human approval resolves them
- remove transitional `ponytail:` logic only in the slice explicitly meant to retire it

## Default Role Mapping

Recommended default:

- Human Owner: project owner
- Planner: architecture/planning thread
- Implementer: worker thread
- Reviewer: review thread
- Workflow Operator: merge/closeout thread

In a small setup, Planner and Reviewer may be the same agent, but Implementer should remain separate.

## Automation Defaults

When the next step is obvious:

- provide the next prompt or command automatically
- do not ask whether a prompt should be written
- if review fails, provide a revision prompt
- if review passes, provide the closeout prompt
- if a card closes and the next card is obvious, provide the next-card prompt

## Anti-Patterns

Do not:

- implement without a card
- merge without review approval
- widen scope silently
- start follow-up slices in the same PR
- hide blocking findings behind summaries
- claim validation that was not actually run

## Daily Usage

For each new card:

1. copy the task template into the issue or Start Task
2. name the authority chain
3. run the appropriate gate sequence
4. stop at review-ready state
5. review
6. merge and close only after approval

This operating model is the default until explicitly replaced.
