# Reviews

**Owner:** QA Reviewer (leads); Creative Director and Technical Director (approve)
**Scope:** AI Studio internal — structured review artifacts for code, design, and architecture.

Completed review records: what was reviewed, who reviewed it, findings, and the resolution of each finding. Reviews are triggered by `ai-studio/workflows/review-workflow.md`.

## File Naming

```
YYYY-MM-DD-<type>-<subject>.md
```

Types: `code`, `design`, `architecture`, `security`

Example: `2026-07-07-design-oxygen-system.md`

## Review Record Structure

Each file must contain:

1. **Subject** — what was reviewed (link to file, PR, or spec)
2. **Reviewer(s)**
3. **Date**
4. **Findings** — each finding with severity (`critical / major / minor / nit`) and status (`open / resolved / accepted-risk`)
5. **Outcome** — `Approved`, `Approved with conditions`, or `Rejected`

## Rules

- A review record is created *after* the review is complete, not before.
- Findings must be linked to GitHub Issues when they require follow-up work.
- Closed reviews are immutable — open a new review if re-review is needed.
- Do not store review checklists here — checklists live in `ai-studio/checklists/`.
