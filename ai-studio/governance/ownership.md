# Ownership

The authority matrix for every document set in the AI Studio. Ownership determines who may propose changes, who reviews them, and who must approve them before they take effect.

---

## Authority Levels

| Level | Meaning |
|-------|---------|
| **Owner** | Responsible for the document's accuracy and relevance. Proposes and drafts changes. |
| **Reviewer** | Reviews proposed changes for correctness and consistency. May approve Tier 1–2 changes. |
| **Approver** | Must explicitly approve Tier 3–4 changes before they are applied. Final authority. |

---

## Ownership Matrix

| Document Set | Owner | Reviewer | Approver |
|---|---|---|---|
| `constitution/vision.md` | Creative Director | Technical Director | Human Collaborator |
| `constitution/principles.md` | Creative Director + Technical Director | ChatGPT | Human Collaborator |
| `constitution/architecture-philosophy.md` | Technical Director | ChatGPT | Human Collaborator |
| `constitution/coding-standards.md` | Technical Director | ChatGPT | Human Collaborator |
| `constitution/glossary.md` | Technical Director | Creative Director + ChatGPT | Human Collaborator |
| `governance/` (all files) | Technical Director | ChatGPT | Human Collaborator |
| `roles/` (all files) | Technical Director | Creative Director | Human Collaborator |
| `workflows/` (all files) | Technical Director | ChatGPT | Human Collaborator |
| `prompts/` (all files) | Technical Director | QA Reviewer | Human Collaborator |
| `templates/` (all files) | Technical Director | — | Human Collaborator |
| `checklists/` (all files) | QA Reviewer | Technical Director | Human Collaborator |
| `knowledge/` (all files) | Technical Director (domain); role owner per subdirectory | Peer role | Human Collaborator |
| `reviews/` (all files) | QA Reviewer | — | — (records, not decisions) |
| `meetings/` (all files) | Creative Director (facilitates) | — | — (records, not decisions) |
| `adr/` (all files) | Author of the ADR | ChatGPT + relevant role | Human Collaborator |
| `/design` (root) | Game Systems Designer | Creative Director | Human Collaborator |
| `/docs` (root) | Technical Director | — | Human Collaborator |
| `/game` (root) | Creative Director | — | Human Collaborator |

---

## Rules

**Ownership is not exclusivity.** Any agent may propose a change to any document. Ownership means the owner is responsible for the document's quality — not that others cannot contribute.

**The Human Collaborator is the final approver for all Tier 3–4 changes.** No AI agent has final authority over constitutional or governance documents.

**When a document has no explicit owner**, the Technical Director is the default owner until one is assigned.

**Ownership of a new document** is declared in the document's README or header at creation time. A document without a declared owner defaults to the Technical Director.

---

## Owner Responsibilities

An owner is expected to:

1. Keep the document accurate as the project evolves.
2. Proactively flag when the document has become stale or contradictory.
3. Review any proposed change within the current phase before it is applied.
4. Ensure the document version is bumped when required (see `versioning.md`).

An owner is **not** expected to personally write every change — they are responsible for its quality, not its authorship.

---

## Changing Ownership

Ownership changes are Tier 4 changes — they require an ADR and human approval. Ownership cannot be transferred informally in a task comment or Kanban Update.
