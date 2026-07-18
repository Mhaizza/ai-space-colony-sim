# ADR-23 - Mission Control Projection and Control Boundary

**Status:** Proposed
**Date:** 2026-07-19
**Phase:** Tooling architecture gate
**Deciders:** Project owner, Technical Director
**Tracks:** GitHub issue #142 (parent #140)
**Governed by:** `docs/superpowers/specs/2026-07-18-ai-workflow-mission-control-design.md` v0.4.0 (Human-approved at PR #141 head `4088b7077af5b9ffce483b0dd4a16b295490902b`, merged as `721a5001b1c8717b97f7709f11d860c4ccdc5bbc`), `docs/ai-workflow/operating-model.md`, `ai-studio/workflows/architecture-workflow.md`, `ai-studio/constitution/architecture-philosophy.md`, and `ai-studio/constitution/principles.md`

**This ADR does not contain:** implementation library choices, UI layout, polling/tuning values, database table definitions, Docker image versions, workflow-template edits, or permission to install or modify OpenClaw. Those remain implementation decisions or separate cards under the accepted design. This ADR records only the inter-system authority, persistence ownership, identity/reconciliation, machine-record, credential, host/container, deployment, upstream, and future-control boundaries that must be stable before implementation.

---

## Context

The project's governed workflow is distributed across GitHub Project #4, Issues, Pull Requests, checks, and structured workflow comments. Local worktrees, automation processes, and the existing OpenClaw runtime at `C:\Users\Mhaiz\.openclaw` provide useful operational signals but are not workflow authority. Issue #140 approved a local Mission Control interface based on a pinned OpenClaw Mission Control fork so the operator can observe these sources in one place.

That design introduces architecture triggers: a standalone repository and dependency boundary, an inter-system GitHub contract, a persistent projection, a machine-readable workflow record, a credential boundary, and a Windows-host-to-container communication path. Without an accepted decision, implementation could accidentally create a second task system, infer approvals from prose, expose the operator's broad credentials or OpenClaw secrets, or make read-only observation a back door for control actions.

The decision must preserve the constitution's single-owner rule, explicit interfaces, validation at boundaries, Human approval gates, and reversibility. The Mission Control database must remain rebuildable and subordinate to GitHub.

## Decision

### D1 - Standalone pinned fork, isolated from the simulation and OpenClaw runtime

Mission Control is a sibling repository at:

`C:\Users\Mhaiz\Projects\ai-space-colony-mission-control`

It is neither embedded in `ai-space-colony-sim` nor placed under `C:\Users\Mhaiz\.openclaw`. It starts from the immutable OpenClaw Mission Control upstream commit `75eb8b0894803e48891a8a92b564c25fb126f2ea` on upstream branch `master`, preserves the MIT license and attribution, records that SHA in `UPSTREAM.md`, and keeps `origin` and `upstream` as separate remotes.

Upstream movement is never automatic. Every upstream update requires a new Kanban card, a newly reviewed exact SHA, compatibility validation, and Human approval. Floating branch or image references cannot define the adopted source.

### D2 - GitHub is the sole workflow authority; Mission Control owns only projection and audit state

GitHub Project #4 owns card status and ordering. GitHub Issues and Pull Requests own task scope, comments, reviews, exact heads, checks, and completion records. Mission Control may not originate or override any of those facts in the read-only system.

Mission Control owns only:

- a disposable projection of authoritative GitHub records;
- a disposable projection of allowlisted local health records;
- sync cursors and source-health metadata;
- quarantine records for malformed or unauthorized inputs; and
- operational audit records for sync attempts, mapping errors, health transitions, and local refresh requests.

Projection and audit state are never simulation state, project authority, approval authority, or an independent work queue. Loss of the Mission Control database must not lose a workflow decision. A complete rebuild from GitHub plus current allowlisted local snapshots must restore the observable state.

### D3 - Stable projection identity and validate-never-infer reconciliation

Every projected entity is identified by the closed tuple `(sourceType, sourceId)`, where `sourceType` distinguishes GitHub Project items, Issues, Pull Requests, comments, reviews, checks, workflow runs, commit statuses, worktrees, automation health, and OpenClaw health. The projection retains the source URL when one exists, source update time, last observed time, and last successful projection time.

Sync is an idempotent upsert. Repeating the same complete source response produces the same projection. Only a successful, explicitly complete enumeration for one source may tombstone records absent from that source. Partial, failed, rate-limited, unauthorized, or schema-invalid reads never infer deletion, completion, reassignment, approval, or status change. Tombstones remain source-linked and may be retained for the design's bounded operational period.

Unknown enum members, malformed records, and unsupported external schema shapes are quarantined rather than coerced. Quarantine preserves non-secret diagnostic metadata and the source link, does not affect derived workflow state, and exposes source degradation. The system validates and rejects; it does not repair authoritative input.

Staleness is explicit source metadata. GitHub failure leaves the last successful projection visible as stale and read-only. Failure of one local source does not make GitHub projection unavailable. The backend never falls back to browser-local workflow truth.

### D4 - `ai-workflow-record:v1` is the only machine authority for derived agents and gates

Machine-readable workflow comments contain exactly one `ai-workflow-record:v1` HTML-comment payload with the closed fields and unions defined by design v0.4.0. The record types are:

```text
start_task | handoff | review_result | human_approval | kanban_update | completion
```

The authenticated GitHub author, comment ID, `createdAt`, and `updatedAt` are source facts. The payload cannot claim its own actor. A server-only principal registry maps GitHub logins to allowed worker identities and roles and separately marks Human approvers and reviewer principals. Worker identity on a shared login is a governed declaration allowed only by that registry; it is not independent process authentication.

The following are structural rules:

- `start_task` is valid only from a registered worker declaring an allowed identity/role or from a Human approver assigning one.
- `handoff` is valid only from the effective worker principal or a Human approver and must supersede the effective assignment record.
- `review_result` is valid only from a configured reviewer, carries `approved` or `revisions_required`, and identifies an exact Pull Request and full 40-character head SHA.
- `human_approval` is valid only from a configured Human approver and identifies an exact Pull Request and full head SHA.
- approval or review of one head never applies to another head.
- edited comments are invalid; correction is a new authorized record with explicit supersession.
- ordering is GitHub `createdAt`, then numeric comment ID.
- supersession is same-card, earlier-record, authorized, acyclic, and one-to-one.
- unknown fields, missing fields, invalid nullability, unknown enums, abbreviated heads, duplicate records, conflicting effective assignment, unauthorized authors, and malformed supersession are quarantined.
- a terminal authoritative GitHub card status clears active derived assignment.

Multiple cards may be active concurrently. At most one primary implementer record is effective per card. Legacy prose remains visible in Live Feed but never creates assignment, review, or approval state.

The workflow templates and validator must adopt this record contract in a separate prerequisite card before the GitHub adapter consumes it. The adapter cannot infer or backfill machine records from historical prose.

### D5 - Dedicated GitHub read credential with exact scope

Mission Control never reuses the operator's authenticated `gh` session. Because Project #4 is user-owned, the backend uses a dedicated classic personal access token with exactly the single OAuth scope `read:project`. The public repository is read through public endpoints without `repo`, `public_repo`, `workflow`, or any write scope.

Startup fails closed unless:

1. the normalized `X-OAuth-Scopes` response set is exactly `{read:project}`;
2. a read-only query can access user-owned Project #4;
3. read-only probes can access the target repository's Issues, Pull Requests, comments, Actions runs, commit statuses, check suites, and check runs; and
4. no credential value reaches browser code, API output, persisted projection rows, quarantine payloads, or logs.

The token is server-only local configuration, never committed. Rotation changes credentials, not projection identity or authority.

### D6 - Closed Windows host-export contract; no runtime mount or command channel

A host-side exporter runs as the current Windows user. It reads only configured roots and closed probe types, then atomically replaces:

`C:\Users\Mhaiz\AppData\Local\ai-space-colony-mission-control\export\host-status.json`

The export directory permits writes only by the current user and `SYSTEM`. Docker Compose mounts only that directory into the backend container at `/run/mission-control-host:ro`. The game repository, worktrees, and `C:\Users\Mhaiz\.openclaw` are not mounted into Mission Control containers.

The version-1 snapshot has a process-session UUID, a sequence increasing within that session, generation/expiry times, and closed derived-health arrays. Within one session the backend requires increasing sequence. A new session is accepted only with a later generation time and valid expiry; a retired session cannot become current again. Expired, malformed, unsupported-version, out-of-order, or replayed snapshots are rejected while the last valid observation remains stale.

The exporter never emits OpenClaw credentials, configuration, identity, message/media content, raw logs, approval tokens, arbitrary paths, or arbitrary workspace content. Neither exporter nor backend provides a generic shell, parameterized command execution, arbitrary file reader, process launcher, or reverse command channel.

### D7 - Local-only container boundary

Mission Control runs through Docker Compose under Docker Desktop's WSL2 Linux backend. Frontend and backend processes listen on their container interfaces. Compose publishes only the frontend and backend ports to Windows host loopback (`127.0.0.1`); wildcard host publishing is invalid. PostgreSQL and Redis remain internal with no default host ports.

Local authentication is mandatory when Clerk is absent and uses a random token of at least 50 characters. Repository mounts are read-only and minimal. Persistent volumes contain rebuildable projection data, not workflow authority. A remote or internet-facing deployment is not pre-authorized by this ADR.

### D8 - The read-only boundary is architectural; future controls require ADR revision

The MVP has no GitHub write-back, merge, approval, branch, worktree mutation, prompt execution, process control, or OpenClaw configuration action. Write/action endpoints are absent. If inherited upstream routes cannot yet be removed, startup requires a hard-disabled configuration and tests prove the routes expose no action capability.

Any future control action requires all of the following before implementation:

- a new Kanban card and threat model;
- an ADR-23 revision accepted through the Architecture Workflow;
- explicit per-action authority and least-privilege credentials;
- idempotency, confirmation, audit, rollback, and failure semantics; and
- explicit Human approval.

Read-only acceptance cannot be interpreted as deferred permission to add controls.

## Required Invariants

1. GitHub remains the sole source of card, scope, review, approval, and completion truth.
2. Mission Control persistence is rebuildable projection/audit state and never an independent work queue.
3. Projection identity is `(sourceType, sourceId)`; complete successful reads alone can tombstone absent records.
4. Partial failure never infers deletion, completion, reassignment, approval, or status change.
5. Derived agent and gate state comes only from valid `ai-workflow-record:v1` records and exact GitHub source facts; prose is never parsed as authority.
6. Review and Human approval are exact-head facts and never survive a head change.
7. The GitHub token has exactly `read:project`; broader, missing, or write-capable scope fails closed.
8. Containers receive only the redacted host-export directory; runtime and repository roots are not mounted.
9. Host observations are versioned, atomic, expiry-bounded, restart-safe, and replay-resistant.
10. Network publication is host-loopback only; PostgreSQL and Redis have no default host exposure.
11. The MVP has no control/write channel. Adding one requires an accepted ADR-23 revision.
12. The adopted upstream tree changes only through a separate reviewed card and exact-SHA Human approval.

## Options Considered

### Option A - GitHub-authoritative read-only projection (selected)

One control plane, a rebuildable projection, explicit source health, and reversible local deployment. It delivers observability without giving the dashboard consequential authority.

### Option B - Use OpenClaw Mission Control as the task authority

**Rejected because:** it creates a second work queue beside Project #4, splits assignment and approval truth, and requires bidirectional reconciliation whose conflict owner is undefined.

### Option C - Bidirectional GitHub sync in the MVP

**Rejected because:** write credentials and conflict resolution become prerequisite architecture before read semantics, security, and operator trust have been proven.

### Option D - Reuse the operator's `gh` credential

**Rejected because:** the current token may carry repository, project, organization, and workflow write scopes. Read-only code does not reduce the consequence of credential exposure.

### Option E - Mount repositories and `.openclaw` into the backend

**Rejected because:** it exposes sensitive configuration and arbitrary content to a web-facing service and turns a status reader into a potential local command/file channel.

### Option F - Embed the dashboard in the simulation repository

**Rejected because:** it couples simulation architecture to a separate Next.js/Python/database/cache/deployment lifecycle and upstream update stream.

### Option G - Build a new frontend without the OpenClaw fork

**Rejected because:** it avoids upstream code but still requires the same projection, auth, storage, health, and audit architecture while discarding the selected board UI.

## Consequences

### Positive

- The operator gets one observable workflow surface without changing GitHub authority.
- Projection loss is recoverable by rebuild; stale and partial states are explicit.
- Exact-head gates and closed workflow records prevent approval/assignment inference from prose.
- Existing OpenClaw runtime secrets and local repository contents remain outside containers.
- Read-only deployment is reversible and can be removed without affecting the project workflow.

### Negative

- A dedicated classic PAT must be created, protected, rotated, and scope-checked.
- The workflow pack needs a compatibility card before deterministic agent/approval panels can be complete.
- A Windows host exporter adds a separately operated component and ACL/freshness tests.
- The fork creates an ongoing controlled upstream-maintenance responsibility.

### Neutral / Deferred

- Poll interval, stale threshold, retention duration, database schema, and UI component shape remain implementation/tuning choices within the design bounds.
- Remote deployment, organization-owned Projects, webhook ingestion, and every write/control action are future architecture work.
- The existing OpenClaw runtime remains independently managed and is neither upgraded nor repaired by this initiative.

## Validation Required Before Implementation

- Verify the fork tree equals upstream commit `75eb8b0894803e48891a8a92b564c25fb126f2ea`, preserves MIT attribution, and records both remotes.
- Contract tests for all Project/Issue/Pull Request/comment/review/Actions/status/check source fixtures and unknown-shape quarantine.
- Idempotency, complete-source tombstone, partial-failure non-deletion, rate-limit, stale, and rebuild tests.
- Exhaustive `ai-workflow-record:v1` parser tests covering author authority, principal mapping, exact-head gates, edits, precedence, supersession, cycles, conflicts, and malformed records.
- Credential tests requiring exactly `read:project`, rejecting broader/missing scopes, and probing every required public read endpoint.
- Exporter tests for redaction, fixed paths, ACL/setup failure, atomic replacement, schema version, session restart, sequence, expiry, replay, and stale retention.
- Compose tests proving host-loopback-only publication, internal-only PostgreSQL/Redis, minimal read-only mounts, local auth, and absent/hard-disabled write routes.
- A destructive-cache test proving projection deletion followed by sync reconstructs workflow state from authoritative sources.

## Revisit Triggers

Revise this ADR before any of the following:

- Mission Control writes to GitHub or local repositories/processes.
- Project authority moves away from GitHub Project #4 or becomes organization-owned.
- Credentials require a scope beyond exactly `read:project`.
- Webhooks or remote deployment introduce an inbound trust boundary.
- Containers receive direct repository, worktree, or OpenClaw runtime mounts.
- `ai-workflow-record:v1` changes fields, types, authority, ordering, supersession, or exact-head semantics.
- Projection records become behavior/decision input for an agent rather than operator observation.
- The adopted OpenClaw upstream commit changes.

## Decision Log

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| Standalone fork pinned to exact upstream SHA | Isolates tooling lifecycle and makes adoption reproducible | Embed in simulation repo; floating upstream |
| GitHub sole authority; projection/audit only | Prevents split-brain work and keeps cache rebuildable | Mission Control task authority; bidirectional MVP |
| Stable source identity and validate-never-infer reconciliation | Makes sync idempotent and partial failure safe | Heuristic repair; deletion on failed/partial reads |
| Closed `ai-workflow-record:v1` | Deterministic, source-linked assignment and gates | Parsing prose; inferring actor from payload |
| Dedicated classic PAT with exactly `read:project` | Reads user Project #4 without broad operator credentials | Operator `gh` token; write-scoped token |
| Atomic redacted host export and read-only mount | Observes local health without exposing roots or shell access | Direct mounts; loopback command API; arbitrary probes |
| Compose host-loopback publication | Local usability without LAN/database exposure | Wildcard host ports; container-loopback binding |
| No write/control routes | Proves observability before consequential authority | Deferred hidden controls; write-through MVP |

---

## Kanban Update

**Card:** ADR-23 - Mission Control Projection and Control Boundary (#142)
**Status:** Review - ADR status Proposed; awaiting architecture review and Human acceptance.
**Completed:** Drafted ADR-23 from the accepted Mission Control design v0.4.0, covering only the architecture trigger surface: repository/upstream boundary, authority and persistence ownership, projection identity/reconciliation, deterministic workflow records, credential scope, Windows host export, local deployment, and future-control gate.
**Changed Files:**
  CREATED  ai-studio/adr/0023-mission-control-projection-and-control-boundary.md
**Validation:** Traced every decision to design v0.4.0; confirmed no gameplay ADR is reopened; confirmed the existing OpenClaw runtime and all implementation files remain untouched.
**Follow-up Tasks:** Architecture review, then Human acceptance. Only after acceptance may the five implementation cards be opened in dependency order.
