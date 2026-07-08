# Versioning

Defines when and how AI Studio documents are versioned. Versioning creates a recoverable history of meaning, not just of text — it signals to any reader whether a document has changed significantly since they last read it.

---

## Version Scheme

Documents use a two-part version: `MAJOR.MINOR`

| Part | Increments when |
|------|----------------|
| **MAJOR** | The meaning of the document changes in a way that could invalidate prior understanding. Existing readers must re-read. |
| **MINOR** | Content is added or clarified without changing existing meaning. Existing readers may skim for additions. |

There is no patch version. Typo fixes and formatting changes are not versioned — they are tracked by git history alone.

---

## Version Location

Every versioned document carries a version line in its header:

```markdown
# Document Title
<!-- version: 1.2 | last-amended: YYYY-MM-DD | tier: 3 -->
```

The `tier` field records the highest change tier applied in the last amendment (see `change-management.md`).

Documents that have never been amended carry no version line. A missing version line means `1.0` (original, unamended).

---

## When to Increment MAJOR

- A principle is renamed, redefined, or removed.
- A glossary term's definition changes in a way that affects how it would be used in code or design.
- An ownership assignment changes (a document gets a new owner).
- A workflow step is removed or reordered.
- Any constitutional document is amended (Tier 4 change).

MAJOR increment resets MINOR to `0`. Example: `1.3` → `2.0`.

---

## When to Increment MINOR

- A new principle, term, example, or section is added.
- An existing section is clarified without changing its meaning.
- A new workflow step is appended (not inserted mid-flow).
- Anti-patterns or examples are added to an existing entry.

Example: `1.2` → `1.3`.

---

## Version and the ADR Link

When a MAJOR version bump occurs, the document's version line must include a reference to the ADR that authorized the change:

```markdown
<!-- version: 2.0 | last-amended: 2026-07-07 | tier: 4 | adr: 0003 -->
```

This creates a direct, machine-readable link between a document version and the decision that produced it.

---

## Document Freeze

During active implementation of a phase, constitution and governance documents may be frozen to prevent mid-phase drift. A frozen document carries:

```markdown
<!-- version: 1.2 | status: FROZEN | frozen-until: phase-1-complete -->
```

Frozen documents may only receive Tier 1 (clarification) changes. Any Tier 2+ change during a freeze must wait until the freeze lifts, unless the human collaborator explicitly overrides the freeze in a GitHub Issue.
