# Coding Standards

High-level standards that apply to all code in this repository. Specific patterns are documented in `ai-studio/knowledge/patterns/`. Exceptions require a comment explaining why.

---

## TypeScript First

All code is TypeScript. No plain JavaScript files in `src/`. Strict mode is on.

- `strict: true` in `tsconfig.json` — no exceptions.
- No `any` without a `// reason:` comment explaining why inference fails here.
- Prefer `unknown` over `any` at system boundaries.
- Types are the documentation for function signatures — write them fully, even when inference could derive them.

---

## Small PRs

A pull request changes one thing. A PR that adds a new system, refactors an existing one, and fixes an unrelated bug is three PRs.

- PRs that exceed ~400 lines of meaningful diff require justification in the PR description.
- Every PR is linked to a GitHub Issue.
- A PR is not mergeable without a passing review (see `ai-studio/workflows/review-workflow.md`).

---

## No Duplicated Logic

If logic appears in two places, it belongs in one place. The second appearance is a bug waiting to diverge.

- Extract shared logic to a utility before writing it twice.
- If you copy-paste more than three lines of logic, stop and factor it out.
- Duplication in tests is acceptable when it improves test clarity — but shared test fixtures belong in a shared helper.

---

## Pure Functions Where Possible

Simulation logic is expressed as pure functions: same inputs, same outputs, no side effects.

- A function that reads or writes external state (DB, file, DOM, global) is impure. Keep impure functions at the edges of the system and out of the simulation core.
- Impure functions are explicitly named or documented as such.
- Prefer returning new state over mutating input parameters.

---

## Tests Required

Every non-trivial piece of simulation logic ships with a test.

- "Non-trivial" means: a branch, a loop, a formula, or any logic that could produce a wrong answer silently.
- Tests live adjacent to the code they test (`*.test.ts` co-located with `*.ts`).
- Tests must run without a browser or a running game session.
- A PR that adds simulation logic without tests will not be approved.

---

## Documentation Required

Every exported function, type, and constant has a one-line summary comment. Complex functions have an explanation of *why* they work the way they do — not *what* the code does (the code already says that).

- No multi-paragraph JSDoc for straightforward functions.
- Document non-obvious invariants, hidden constraints, and known limitations.
- Comments that explain *what* the code does (rather than *why*) are noise and should be deleted.

---

## ADR Required for Architecture Changes

Any change that affects system boundaries, data flow, serialization format, or inter-system contracts requires an Architecture Decision Record before implementation begins.

- "I'll document it after" is not acceptable. The ADR is part of the definition of done for architectural work.
- ADRs live in `ai-studio/adr/`. Use the template at `ai-studio/templates/adr.md`.
- An ADR is not a design document — it is a decision record. It states the context, the decision, and the consequences. It does not need to be long.
