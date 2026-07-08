# Release Process

Defines how AI Studio documents are formally released at project milestones. A release is a named, tagged snapshot of the AI Studio's state — a point in time from which any future agent or collaborator can reconstruct the authoritative rules the project operated under.

---

## What Is a Release

A release is not a code deployment. It is a **document checkpoint** that marks: "at this phase milestone, these are the rules we agreed on."

Releases exist because documents evolve. Without releases, it becomes impossible to answer "what did the constitution say when Phase 1 was built?" — which matters when debugging decisions made months earlier.

---

## Release Triggers

A release is created at:

| Trigger | Release Type |
|---------|-------------|
| Phase completion (Phase 0, Phase 1, …) | **Phase Release** — full snapshot of all AI Studio documents |
| Major architectural decision accepted | **ADR Release** — snapshot of affected documents at the time the ADR was accepted |
| Onboarding a new contributor or AI agent | **Onboarding Snapshot** — current state packaged for handoff |

Releases are not created for routine task completions. A release is a milestone marker, not a commit.

---

## Release Process

### Phase Release

1. **Freeze documents** — mark all `constitution/` and `governance/` files as `FROZEN` (see `versioning.md`).
2. **Audit checklist** — verify every document in the ownership matrix is at a stable, approved version.
3. **Resolve open Tier 3–4 changes** — no unapproved amendments may be open at release time.
4. **Tag in git** — create a git tag: `ai-studio/phase-N-release`
5. **Write release notes** — create `ai-studio/meetings/YYYY-MM-DD-phase-N-release.md` summarizing:
   - Documents included in the release
   - Major changes since the last release
   - Known open questions deferred to the next phase
6. **Unfreeze documents** — remove `FROZEN` status after the tag is created.

### ADR Release (lightweight)

1. Confirm the ADR is in `Accepted` status.
2. Confirm all documents amended by the ADR are at their new version.
3. Tag in git: `ai-studio/adr-NNNN-accepted`
4. No freeze required.

---

## Release Checklist

Before tagging a Phase Release, all of the following must be true:

- [ ] All Phase N Kanban cards are in `Done` or explicitly deferred with a filed GitHub Issue.
- [ ] No document has an open Tier 3–4 change pending approval.
- [ ] No document has an `<!-- EMERGENCY CHANGE -->` marker that has not been retroactively processed.
- [ ] All ADRs referenced by Phase N tasks are in `Accepted` status.
- [ ] `ai-studio/README.md` accurately reflects the current directory structure.
- [ ] The ownership matrix in `governance/ownership.md` is current.
- [ ] Release notes have been written.

---

## Accessing a Past Release

```bash
git checkout ai-studio/phase-0-release -- ai-studio/
```

This restores the full `ai-studio/` directory to its state at the Phase 0 release, without affecting any other files. Use this when investigating why a decision was made under a specific phase's rules.

---

## Release Versioning

Phase releases follow the project phase number. There is no separate version number for the AI Studio — its version is the project phase.

| Tag | Meaning |
|-----|---------|
| `ai-studio/phase-0-release` | AI Studio state at Phase 0 completion |
| `ai-studio/phase-1-release` | AI Studio state at Phase 1 completion |
| `ai-studio/adr-0003-accepted` | Documents at the time ADR 0003 was accepted |
