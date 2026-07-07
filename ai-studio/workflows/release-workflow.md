# Release Workflow

## 1. Purpose

Define the process for releasing a completed project phase. A release is a named, versioned, tagged snapshot confirming that all phase deliverables are complete, tested, documented, and reproducible.

---

## 2. When to Use

Use this workflow when:
- A project phase (Phase 0, Phase 1, …) is complete and all cards are in `Done` or explicitly deferred.
- A significant milestone requires a stable, named reference point.

Do **not** use this workflow for individual feature completions — those end with a Kanban Update, not a release.

---

## 3. Inputs

| Input | Required? | Description |
|-------|-----------|-------------|
| Phase completion checklist | Required | All Kanban cards in `Done` or deferred with filed issues |
| AI Studio governance checklist | Required | All Tier 3–4 changes have accepted ADRs |
| Test results | Required | All tests passing |
| Documentation audit | Required | All docs accurate and version-current |
| Release notes draft | Required | Summary of changes since last release |

---

## 4. Outputs

| Output | Description |
|--------|-------------|
| Passing test suite | All tests green at the release commit |
| Updated documentation | All docs reflect current state; version headers bumped where required |
| Version update | `package.json` (or equivalent) version bumped |
| Git tag | `ai-studio/phase-N-release` and `v0.N.0` (or equivalent) |
| GitHub Release | Published release with release notes |
| Release meeting record | `ai-studio/meetings/YYYY-MM-DD-phase-N-release.md` |
| Kanban Update | Mandatory completion record |

---

## 5. Step-by-Step Process

```
Phase 1 — Testing

1. [Claude] Confirm all Kanban cards for this phase are in Done or explicitly deferred
   → Deferred cards must have filed follow-up issues; they cannot simply be abandoned
2. [Codex] Run the full test suite; confirm all tests pass
   → Failing tests: treat as Critical bugs; fix before continuing (use bug-workflow.md)
3. [Claude] Run through phase acceptance criteria:
   → Confirm each criterion in the phase GitHub milestone is met
   → Document any unmet criteria as Critical issues; fix before continuing

Phase 2 — Documentation

4. [Claude] Audit all documents changed this phase:
   → Specs in design/ match implemented behavior
   → Constitution documents are at correct version per versioning.md
   → governance/ownership.md is current
   → ai-studio/README.md reflects current directory structure
   → Any emergency changes have been retroactively processed
5. [Claude] Write or update release notes draft:
   → What was built this phase
   → Major decisions made (link to ADRs)
   → Known limitations and deferred items
   → What changes in the next phase

Phase 3 — Version Update

6. [Claude] Determine version number:
   → Phase 0 complete → v0.1.0
   → Phase N complete → v0.(N+1).0
   → Breaking changes present → bump MAJOR instead
7. [Codex] Update version in package.json (or equivalent)
8. [Claude] Bump version headers on all amended constitution/governance documents
   → Follow versioning.md rules

Phase 4 — Tag

9. [Claude] Post Start Task record for release
10. [ChatGPT] Final Review of release:
    → Confirm test suite passed
    → Confirm documentation is accurate
    → Confirm version is correct
    → Post result: Approved or Rejected with specific findings
11. [Human] Approve the release
12. [Codex] Create git commit: "release: phase N complete — vX.Y.Z"
13. [Codex] Create git tags:
    → ai-studio/phase-N-release
    → vX.Y.Z
14. [Codex] Unfreeze AI Studio documents (remove FROZEN markers)

Phase 5 — GitHub Release

15. [Claude] Publish GitHub Release:
    → Tag: vX.Y.Z
    → Title: "Phase N Release — vX.Y.Z"
    → Body: release notes
    → Mark as pre-release if simulation is not yet feature-complete

16. [Claude] Write release meeting record in ai-studio/meetings/
17. [Claude] Write Decision Log + Kanban Update
```

---

## 6. Decision Points

| Point | Question | Paths |
|-------|----------|-------|
| Step 1 | Are all cards Done or explicitly deferred? | Yes → continue; No → fix or file deferral issues |
| Step 2 | Do all tests pass? | Yes → continue; No → fix via bug-workflow, Critical priority |
| Step 3 | Are all phase acceptance criteria met? | Yes → continue; No → fix or escalate to human |
| Step 10 | Does ChatGPT Final Review pass? | Yes → step 11; No → fix findings, re-review |
| Step 11 | Does Human approve? | Yes → tag; No → address issues, re-review |

---

## 7. Required Approvals

| Approval | Who | When | Blocking? |
|----------|-----|------|-----------|
| Release review | ChatGPT | After documentation + testing complete | Yes |
| Release approval | Human Collaborator | After ChatGPT review passes | Yes — no tag without Human approval |

---

## 8. Kanban State Transitions

```
Backlog
  → Ready         (after all phase cards reach Done or explicit deferral)
  → In Progress   (testing and documentation phase)
  → Review        (ChatGPT release review)
  → Done          (git tag created, GitHub Release published)
```

---

## 9. Required Artifacts

- [ ] Full test suite passing (evidence in PR or CI)
- [ ] Documentation audit complete (all docs current)
- [ ] Release notes
- [ ] Version update committed (`package.json` or equivalent)
- [ ] Git tags: `ai-studio/phase-N-release` and `vX.Y.Z`
- [ ] GitHub Release published
- [ ] Release meeting record in `ai-studio/meetings/`
- [ ] ChatGPT release review record
- [ ] Human approval on record
- [ ] Decision Log
- [ ] Kanban Update

---

## 10. Exit Criteria

The release is **Done** when all of the following are true:

- [ ] All tests pass at the tagged commit.
- [ ] Documentation is accurate and version-current.
- [ ] Version number is updated in the codebase.
- [ ] Git tags are created and pushed.
- [ ] GitHub Release is published with release notes.
- [ ] Release meeting record is written.
- [ ] Human approval is on record.
- [ ] Kanban Update is written and linked.
