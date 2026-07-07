# Memory

Persistent context snapshots for AI agents. When a session ends or a major milestone is reached, relevant discoveries, decisions, and open questions are recorded here so the next session can continue without re-deriving context.

## File Naming

```
YYYY-MM-DD-<topic>.md
```

Example: `2026-07-07-phase-0-complete.md`

## What to Record

- Decisions made and their rationale
- Approaches that were tried and failed (and why)
- Open questions deferred to a future session
- Current state of in-progress work

## What NOT to Record

- Information already in an ADR (put it there instead)
- Code snippets (put them in the codebase with a comment)
- Task lists (use GitHub Issues)

Memory files are append-friendly but never edited retroactively — they are a log, not a living document.
