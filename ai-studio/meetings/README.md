# Meetings

**Owner:** Creative Director (facilitates); all roles (contribute)
**Scope:** AI Studio internal — records of planning sessions, design discussions, and decision-making conversations between AI agents and human collaborators.

## File Naming

```
YYYY-MM-DD-<topic>.md
```

Example: `2026-07-07-phase-0-kickoff.md`

## Meeting Record Structure

Each file must contain:

1. **Date**
2. **Participants** (roles present)
3. **Agenda**
4. **Key Decisions** — bulleted, each with a decision owner
5. **Action Items** — each with an owner and a GitHub Issue link (or "to be filed")
6. **Open Questions** — deferred items requiring follow-up

## Rules

- Decisions that affect architecture must also produce an ADR in `ai-studio/adr/`.
- Action items without a GitHub Issue link must have one filed before the next session.
- Meeting records are append-only after the session closes — corrections go in a follow-up note at the bottom of the file, dated.
- Do not use this directory for async discussions — those belong in GitHub Issues.
