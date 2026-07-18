# AI Workflow Mission Control Design

**Version:** 0.2.0

**Status:** Proposed

**Date:** 2026-07-18

**Owner:** Technical Director

**Card:** [Issue #140](https://github.com/Mhaizza/ai-space-colony-sim/issues/140)

**Upstream:** [abhi1693/openclaw-mission-control](https://github.com/abhi1693/openclaw-mission-control)

**Pinned upstream commit:** `75eb8b0894803e48891a8a92b564c25fb126f2ea` (`master`)

**Authority:** AI Studio feature workflow, architecture workflow, Kanban Update protocol, and this Human-approved design direction

## 1. Context

The repository's permanent AI workflow pack establishes GitHub Issues, Pull Requests, Project #4, structured comments, and gated Human approvals as the operating system for work. Those records are authoritative but fragmented across GitHub and local machine state. A local Mission Control UI should make the workflow observable without creating a second task system or bypassing its gates.

The machine already has an operational OpenClaw runtime rooted at `C:\Users\Mhaiz\.openclaw`, with its local workspace at `C:\Users\Mhaiz\.openclaw\workspace`. That installation is not the OpenClaw Mission Control application repository and contains local operator changes. It is an observed external system, not an installation target for this project.

This design adopts OpenClaw Mission Control as a standalone, pinned fork, adds a read-only GitHub adapter, and observes the existing OpenClaw runtime through a narrow local adapter. The first release is an observability surface only. It does not reinstall or modify OpenClaw, execute work, mutate GitHub, merge Pull Requests, approve gates, or run arbitrary local commands.

## 2. Goals

- Display GitHub Project #4 as a board-first Mission Control interface.
- Show card, agent, approval, Pull Request, check, worktree, and automation health in one local UI.
- Preserve GitHub and the workflow pack as the only authoritative control plane.
- Operate locally on Windows through Docker Desktop with the WSL2 Linux backend.
- Reuse the existing OpenClaw runtime as a read-only observation source without changing its configuration or workspace.
- Fail safely when GitHub, local probes, or the Mission Control database are unavailable.
- Keep upstream OpenClaw updates controlled, reviewable, and reversible.

## 3. Non-Goals

- Replacing GitHub Project #4 or GitHub Issues as the work queue.
- Writing workflow state back to GitHub in the MVP.
- Starting agents, executing prompts, changing branches, merging Pull Requests, or approving gates.
- Installing, upgrading, reconfiguring, or replacing the existing OpenClaw runtime as part of Issue #140.
- Changing gameplay, simulation, ADR-18 through ADR-22, or files under `prototype/src`.
- Supporting remote or internet-facing deployment in the MVP.

## 4. Decisions

### D1. Standalone Pinned Fork

Mission Control lives in a sibling repository at:

`C:\Users\Mhaiz\Projects\ai-space-colony-mission-control`

It is not embedded in the game repository and is not placed inside `C:\Users\Mhaiz\.openclaw`. The repository preserves OpenClaw Mission Control's MIT license and attribution, uses `origin` for the project's fork, and uses `upstream` for `abhi1693/openclaw-mission-control`. The immutable adoption point is upstream `master` commit `75eb8b0894803e48891a8a92b564c25fb126f2ea`. Bootstrap must reproduce that exact tree and record the SHA in `UPSTREAM.md`; it must not resolve `master` again. The pin is never advanced automatically.

This separation prevents dashboard dependencies, database migrations, and deployment tooling from entering the simulation repository.

### D2. GitHub Is Authoritative

GitHub Project #4, its linked Issues and Pull Requests, and structured workflow comments remain authoritative. Mission Control stores a disposable projection/cache plus operational audit records. No Mission Control row may become an independent work assignment, approval, card status, or completion record.

Deleting or corrupting the Mission Control database must not lose workflow truth. Rebuilding the projection from GitHub and approved local signals must restore the UI.

### D3. Adapter Architecture

The fork gains a server-side GitHub projection adapter behind the existing backend boundary:

1. A scheduler requests GitHub data at a configurable interval.
2. A GitHub client reads Project #4, linked Issues, Pull Requests, reviews, checks, labels, and structured comments using server-side credentials.
3. Normalizers convert external records into closed projection types.
4. An idempotent projector upserts records into the Mission Control database.
5. Read APIs return projection data and source-health metadata to the frontend.

The MVP must not reuse the operator's authenticated `gh` session. It uses a dedicated server-only fine-grained personal access token created solely for Mission Control. Its access is limited to the `Mhaizza/ai-space-colony-sim` repository and the owning user's Project #4, with only these read permissions: account Projects, repository Metadata, Issues, Pull requests, Actions, and Commit statuses. All write permissions and access to other repositories are excluded. Startup performs read-only capability probes for Project #4 and the repository and fails closed if either resource is inaccessible. Credential provisioning records the reviewed permission set outside the repository; rotating the token does not change projection identity. Credentials never enter browser bundles, API responses, logs, or persisted projection rows.

Local machine state is supplied by a host-side read-only exporter plus a container-side ingestion adapter. The exporter runs as the current Windows user, reads an allowlisted manifest and bounded probes for registered worktrees, automation state, and the existing OpenClaw runtime, then writes one versioned JSON snapshot to `C:\Users\Mhaiz\AppData\Local\ai-space-colony-mission-control\export\host-status.json`. It writes a temporary file in the same directory, flushes it, and atomically replaces the destination. The directory ACL permits only the current user and `SYSTEM` to write. Docker Compose mounts only the export directory into the backend container at `/run/mission-control-host:ro`; no runtime or repository root is mounted.

The snapshot contains `schemaVersion`, `sequence`, `generatedAt`, `expiresAt`, and closed arrays of derived health records. The backend accepts only schema version 1, requires a strictly increasing sequence for freshness, rejects snapshots whose `expiresAt` is in the past, and retains the last valid snapshot as stale without inferring deletion. The exporter runs every 15 seconds and sets `expiresAt` to 45 seconds after generation. For OpenClaw, it exposes only derived health/status fields from approved non-secret files and process/endpoint health; it excludes `credentials`, identity material, messages, media, raw logs, `openclaw.json`, approval tokens, and arbitrary workspace content. The web application must not expose a generic shell, arbitrary path reader, command parameter, or process launcher.

### D4. Projection Mapping

GitHub Project status values map directly to board columns:

| GitHub Project #4 | Mission Control |
| --- | --- |
| Backlog | Backlog |
| Ready | Ready |
| In Progress | In Progress |
| Review | Review |
| Testing | Testing |
| Blocked | Blocked |
| Done | Done |

Multiple cards may be active concurrently. The UI groups them by authoritative Project status and worker assignment without treating concurrency as an error. The invariant is per card: at most one primary implementer record may be effective for a card at a time. Conflicting effective assignment records quarantine that card's derived assignment while preserving its GitHub status; Mission Control never chooses a winner or repairs GitHub.

Agent state and Human approval state are derived only from the closed workflow-record contract below, augmented by allowlisted local worktree and OpenClaw health observations. OpenClaw runtime presence never proves that an agent owns a card. Pull Request state and CI status come directly from GitHub. Worktree and automation health are observational signals and never override card or approval state.

Every machine-readable workflow comment contains exactly one HTML comment with this shape; surrounding prose is display-only:

```text
<!-- ai-workflow-record:v1
{"type":"start_task","card":140,"worker":"codex","role":"technical-director","artifact":null,"head":null,"supersedes":null}
-->
```

The closed `type` union is `start_task | handoff | human_approval | kanban_update | completion`. `card` is the GitHub Issue number. `worker` is one of `codex | claude | cursor | openclaw | human` when the type requires a worker, otherwise `null`. `role` is a repository role slug when the type requires one, otherwise `null`. `artifact` is a repository-relative path, Issue number, or Pull Request number when applicable. `head` is a full 40-character commit SHA for artifact approval and otherwise `null`. `supersedes` is a GitHub comment ID or `null`. Unknown fields, missing fields, wrong nullability, unknown enum members, abbreviated SHAs, and multiple records in one comment are malformed.

The authenticated GitHub comment author and immutable comment ID/timestamps are authoritative; an actor value is never accepted from payload data. Valid `start_task` records must be authored by the configured Human approver or repository owner. A `handoff` must be authored by the currently effective worker, identify the next worker/role in `worker`/`role`, and explicitly supersede the effective assignment record. A `human_approval` must be authored by a configured Human approver, reference the Pull Request in `artifact`, include its exact current `head`, and may not approve a changed head. `kanban_update` and `completion` records must be authored by the effective worker or configured Human approver. Configured Human approvers are an explicit GitHub-login allowlist in server-only configuration.

Records are ordered by GitHub `createdAt`, then numeric comment ID. Edited comments are invalid after `updatedAt != createdAt`; correction requires a new record with `supersedes`. Supersession is valid only when the new record's author is authorized for its type, targets an earlier record on the same card, and does not create a cycle. A record can be superseded at most once. Malformed, unauthorized, cyclic, duplicate-supersession, or cross-card records are quarantined with a source link and never affect derived state. The effective record is the latest valid unsuperseded record of the relevant type. A terminal GitHub card status clears derived active assignment regardless of older records.

Human-readable legacy comments, including the current Start Task template without a machine marker, remain visible in Live Feed but do not create deterministic assignment or approval state. Before adapter rollout, a separate workflow-pack compatibility card must add the machine marker to templates and validation; it cannot retroactively infer records from prose.

Every projected object retains its source type, source identifier, source URL where applicable, source update timestamp, and projection timestamp.

### D5. Synchronization and Reconciliation

The MVP uses polling every 15 seconds by default, configurable between 15 and 300 seconds. Webhooks are deferred because the product is local-only and must not require an inbound public endpoint.

Projection writes are idempotent and keyed by `(source, sourceId)`. A completed sync marks records absent from an authoritative complete result as archived/tombstoned rather than deleting them immediately. Partial or failed syncs never infer deletion.

The UI displays last-successful-sync time, current sync state, source health, and stale badges. A projection is stale after two missed configured intervals. Manual refresh requests another read-only sync and has no write-back behavior.

### D6. Security and Control Boundary

- Frontend and backend bind to `127.0.0.1` only.
- Local authentication uses a random token of at least 50 characters when Clerk is not configured.
- GitHub credentials are server-side only and receive read-only minimum scopes for the MVP.
- PostgreSQL and Redis bind to loopback or remain internal to the Compose network.
- Containers receive only required mounts; repository mounts are read-only.
- The local-observation adapter accepts only configured roots and closed probe types.
- The existing `C:\Users\Mhaiz\.openclaw` tree is never mounted into a container; the host exporter emits only the closed, redacted snapshot through the read-only export-directory mount.
- Write/action endpoints are absent. If inherited upstream endpoints cannot be removed immediately, startup fails unless the endpoints are explicitly hard-disabled by configuration, and tests prove they return no action capability.
- Audit and diagnostic logs redact authorization headers, tokens, cookie values, repository secrets, and local-auth material.

Any future control action requires a separate card, threat model, ADR revision, least-privilege design, audit contract, explicit Human approval, and per-action confirmation. Read-only MVP acceptance does not pre-authorize that work.

### D7. Upstream Update Policy

`UPSTREAM.md` records the upstream URL, pinned commit SHA, adoption date, local divergence summary, and last compatibility result. Each upstream update requires its own Kanban card and isolated branch. The update flow is fetch, inspect release and security changes, merge or rebase explicitly, run compatibility tests, review the diff, and obtain Human approval before merge.

There are no automatic upstream merges, floating image tags, or unattended dependency upgrades that can change the adopted OpenClaw application.

### D8. User Interface Scope

The board-first OpenClaw visual language is retained where practical. The MVP provides:

- **Boards:** Project #4 cards grouped by authoritative status.
- **Live Feed:** Ordered projection events with links back to GitHub.
- **Approvals:** Outstanding and completed Human/reviewer gates.
- **Agents:** Derived worker role, assignment, state, and last record.
- **Worktrees:** Allowlisted local worktree branch and cleanliness observations.
- **Pull Requests:** Review state, exact head, CI checks, and merge readiness signals.
- **Settings:** Sync health, intervals, source configuration, version, and upstream pin.

Visible controls inherited from upstream that would mutate state are removed or rendered disabled with the label `Read-only MVP`. The UI never implies that a disabled action has been executed.

### D9. Local Deployment

The supported deployment is Docker Compose under Docker Desktop's WSL2 Linux backend. The web application defaults to `127.0.0.1:3000`, the backend to `127.0.0.1:8000`, and PostgreSQL/Redis to the internal Compose network unless a loopback diagnostic port is explicitly enabled. The existing OpenClaw runtime remains independently managed at `C:\Users\Mhaiz\.openclaw`; Mission Control neither owns its lifecycle nor shares its credential/configuration directories.

Configuration and secrets live in ignored local environment files. A checked-in example contains names and safe defaults only. Persistent volumes hold projection data but are treated as rebuildable cache, not workflow authority.

### D10. Mandatory Architecture Gate

Implementation introduces an inter-system contract, a persistent projection with explicit ownership, new repository and runtime dependencies, and a security boundary between GitHub, local machine observations, and the UI. These are architecture triggers, not implementation details.

After this design is approved, a separate architecture card must produce candidate **ADR-23: Mission Control Projection and Control Boundary**. The ADR must pin D1 through D7 and D9, including authority, storage ownership, sync semantics, credential boundary, and the future write-action gate. No fork bootstrap, adapter implementation, or persistent schema work may begin until ADR-23 is Accepted and merged.

## 5. Failure Behavior

| Failure | Required behavior |
| --- | --- |
| GitHub unavailable | Continue serving the last successful projection as stale and read-only; do not delete records. |
| GitHub rate limit | Honor reset/retry metadata, apply bounded exponential backoff with jitter, and expose degraded source health. |
| Partial GitHub query failure | Commit no completeness-based tombstones for the failed source; expose per-source failure details. |
| Local observation unavailable | Keep GitHub projection available and mark only local signals stale. |
| Unknown external status/schema | Quarantine the affected record, preserve diagnostic metadata without secrets, and show a mapping error. |
| Database unavailable | Return an explicit unavailable state; never fall back to browser-local workflow truth. |
| Credential invalid | Stop sync, expose a redacted authentication error, and require local operator repair. |

## 6. Data Ownership and Retention

Projection records are derived and may be rebuilt. Operational audit records contain sync attempts, source health transitions, mapping errors, and local user refresh requests. They must not duplicate secret-bearing payloads. Raw GitHub response bodies are not retained by default.

Archived projection records may be retained for 30 days for UI continuity, then deleted by local maintenance. This retention policy does not affect GitHub records. Configuration identifies exactly one GitHub owner/repository and Project #4 for the initial deployment.

## 7. Validation Strategy

Implementation must provide:

- Contract fixtures for Project items, Issues, Pull Requests, reviews, comments, and checks.
- Exhaustive status and approval mapping tests, including unknown-value quarantine.
- Workflow-record parser tests for every type, authorization rule, exact-head approval, edit invalidation, precedence, supersession, conflict, and malformed payload path.
- Idempotency tests showing repeated identical syncs produce identical projection state.
- Partial-sync and tombstone tests proving failures cannot delete or falsely complete work.
- Rate-limit, backoff, stale-state, and recovery tests with a fake clock.
- Credential-redaction and frontend-bundle checks.
- Tests proving all GitHub calls are read-only and all write/action routes are absent or hard-disabled.
- Path allowlist and command-injection tests for local observations.
- Redaction fixtures proving the OpenClaw exporter cannot emit credentials, raw configuration, identity content, messages, media paths, or token-bearing logs.
- Host-export tests for atomic replacement, ACL/setup failure, schema/version rejection, monotonic sequence, expiry, stale retention, and read-only container mounting.
- Docker Compose smoke tests for health, loopback binding, migration, restart, and projection rebuild.
- An operator acceptance test that compares representative Project #4 cards against their Mission Control rendering.

## 8. Implementation Slices

Each slice requires its own Kanban card, Start Task record, isolated branch/worktree, validation, review, and Human gate.

1. **Pinned Mission Control Fork Bootstrap:** Create the sibling UI fork from exact upstream commit `75eb8b0894803e48891a8a92b564c25fb126f2ea`, preserve license/attribution, record `UPSTREAM.md`, hard-disable mutation routes, and establish local Compose health. Do not install, update, or reconfigure the existing OpenClaw runtime. No GitHub integration.
2. **Workflow Record Compatibility and Read-Only GitHub Adapter:** Add the v1 machine marker to governed workflow templates/validation, then implement Project #4/Issue/PR/check/comment projection, polling, deterministic record parsing, mapping, reconciliation, stale/error behavior, and board/read APIs.
3. **Local Observability Adapter:** Add the allowlisted manifest, bounded read-only worktree/automation probes, and the redacted status exporter for the existing OpenClaw runtime, all with per-source health.
4. **UX and Operations Hardening:** Complete board/live-feed/approval/agent/worktree/PR surfaces, security verification, backup/rebuild guidance, update runbook, and operator documentation.

Secure write controls are not a fifth implicit slice. They are a future initiative requiring a new card and ADR-23 revision.

## 9. Alternatives Rejected

### Unmodified OpenClaw Plus External Bridge

Rejected because OpenClaw's own task model would remain visible and mutable alongside GitHub, creating two apparent sources of truth and ambiguous reconciliation.

### New Frontend Only

Rejected because reproducing the board is not the hard part; safe synchronization, persistent projection, auth, source health, and audit boundaries would still require a backend and operational model.

### Embed Mission Control in the Game Repository

Rejected because it couples simulation development to a separate web application, database, cache, deployment stack, and upstream lifecycle.

### Write-Through GitHub Integration in the MVP

Rejected because it increases credential scope and makes UI or adapter defects consequential before observability semantics have been proven.

## 10. Acceptance Criteria

The design is accepted when reviewers confirm that:

- GitHub Project #4 is the sole workflow authority and the database is explicitly disposable projection state.
- The sibling fork location, upstream pin, attribution, and controlled update policy are fixed.
- Card, agent, approval, Pull Request/check, worktree, and automation mappings are deterministic and source-linked.
- Concurrent cards are allowed, while each card has at most one effective primary implementer record.
- `ai-workflow-record:v1` defines closed schemas, authorized authors, exact-head approval, precedence, supersession, and quarantine behavior.
- Polling, idempotency, tombstones, stale state, partial failure, rate limits, and schema mismatch behavior are specified.
- The Windows host exporter and container ingestion boundary fixes path, ACL, atomicity, freshness, expiry, and read-only mount behavior.
- Credentials, local probes, network binding, mounts, logs, and mutation routes have closed security boundaries.
- Windows local deployment through Docker Desktop/WSL2 is pinned.
- ADR-23 is a mandatory pre-implementation gate.
- Implementation is divided into independently reviewable cards.
- No gameplay or Mission Control implementation is included in Issue #140.

## 11. Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-07-18 | Use a standalone pinned OpenClaw fork. | Reuses the desired UI while isolating tooling dependencies from the game. |
| 2026-07-18 | Observe the existing OpenClaw installation in place. | Avoids destructive reinstall/configuration drift and treats agent runtime health as a non-authoritative signal. |
| 2026-07-18 | Keep GitHub Project #4 authoritative. | Preserves the governed workflow and prevents split-brain task state. |
| 2026-07-18 | Make the MVP read-only. | Proves observability and reconciliation before granting consequential authority. |
| 2026-07-18 | Use polling rather than webhooks. | Fits local-only deployment without exposing an inbound endpoint. |
| 2026-07-18 | Require ADR-23 before implementation. | The projection, ownership, dependency, and security contracts are architectural. |
| 2026-07-18 | Defer all control actions. | Write capability requires a separate threat model, approval, and architecture revision. |
| 2026-07-19 | Pin upstream commit `75eb8b0894803e48891a8a92b564c25fb126f2ea`. | Gives the design, ADR, and bootstrap card one immutable source tree. |
| 2026-07-19 | Require a dedicated least-privilege GitHub credential. | The operator's `gh` token may include write scopes and is not an acceptable service credential. |
| 2026-07-19 | Use an atomic host-export snapshot and read-only directory mount. | Pins the Windows/WSL2 container boundary without exposing runtime roots or shell access. |
| 2026-07-19 | Permit concurrent active cards and enforce one effective primary implementer per card. | Matches repository governance for parallel work. |
| 2026-07-19 | Define `ai-workflow-record:v1`. | Makes assignment, handoff, approval, and completion projection deterministic and auditable. |

## 12. Review Outcome Required

Reviewers must return either `Approved` or `Revisions Required` against this document version and PR head. Human approval of the design authorizes only the ADR-23 workflow. It does not authorize fork installation or implementation.
