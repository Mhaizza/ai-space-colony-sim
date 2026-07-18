# ADR-23 - Mission Control Projection and Control Boundary

**Status:** Proposed (revision 1 after architecture review: trust classes, canonical projection identity, audit ownership, workflow-record precedence, and polling/failure semantics closed)
**Date:** 2026-07-19
**Phase:** Tooling architecture gate
**Deciders:** Project owner, Technical Director
**Tracks:** GitHub issue #142 (parent #140)
**Governed by:** `docs/superpowers/specs/2026-07-18-ai-workflow-mission-control-design.md` v0.4.0 (Human-approved at PR #141 head `4088b7077af5b9ffce483b0dd4a16b295490902b`, merged as `721a5001b1c8717b97f7709f11d860c4ccdc5bbc`), `docs/ai-workflow/operating-model.md`, `ai-studio/workflows/architecture-workflow.md`, `ai-studio/constitution/architecture-philosophy.md`, and `ai-studio/constitution/principles.md`

**This ADR does not contain:** implementation library choices, UI layout, polling interval/tuning values, database table definitions, Docker image versions, workflow-template edits, or permission to install or modify OpenClaw. Those remain implementation decisions or separate cards under the accepted design. This ADR records only the inter-system authority, persistence ownership, identity/reconciliation, machine-record, credential, host/container, deployment, upstream, and future-control boundaries that must be stable before implementation.

---

## Context

The project's governed workflow is distributed across GitHub Project #4, Issues, Pull Requests, checks, and structured workflow comments. Local worktrees, automation processes, and the existing OpenClaw runtime at `C:\Users\Mhaiz\.openclaw` provide useful operational signals but are not workflow authority. Issue #140 approved a local Mission Control interface based on a pinned OpenClaw Mission Control fork so the operator can observe these sources in one place.

That design introduces architecture triggers: a standalone repository and dependency boundary, an inter-system GitHub contract, a persistent projection, a machine-readable workflow record, a credential boundary, and a Windows-host-to-container communication path. Without an accepted decision, implementation could accidentally create a second task system, infer approvals from prose, expose the operator's broad credentials or OpenClaw secrets, or make read-only observation a back door for control actions.

The decision must preserve the constitution's single-owner rule, explicit interfaces, validation at boundaries, Human approval gates, and reversibility. The Mission Control projection must remain rebuildable and subordinate to GitHub; non-authoritative local audit history has separate retention and loss semantics.

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
- non-authoritative operational audit records for sync attempts, mapping errors, health transitions, and local refresh requests.

Projection and audit state are never simulation state, project authority, approval authority, or an independent work queue. Projection/cache is disposable and rebuildable: a complete rebuild from GitHub plus current allowlisted local snapshots restores current observable workflow and health state. Audit history is not rebuildable from those sources. It is bounded local evidence, may be lost when its store is destroyed, and must never be presented as reconstructed history after a rebuild. Loss of either store must not lose or change a workflow decision.

### D3 - Stable projection identity and validate-never-infer reconciliation

Every projected entity is identified by the closed tuple `(sourceType, sourceId)`. The persisted `sourceType` union and canonical `sourceId` rules are:

| `sourceType` | Canonical `sourceId` | Completeness/tombstone partition |
|---|---|---|
| `github_project_item` | GitHub global node ID of the `ProjectV2Item` | Project #4 global node ID |
| `github_issue` | GitHub global node ID of the Issue | `Mhaizza/ai-space-colony-sim` repository node ID |
| `github_pull_request` | GitHub global node ID of the Pull Request | Repository node ID |
| `github_issue_comment` | GitHub global node ID of the Issue comment | Parent Issue or Pull Request global node ID |
| `github_pull_request_review` | GitHub global node ID of the Pull Request review | Parent Pull Request global node ID |
| `github_check_suite` | GitHub REST `node_id` of the check suite | Tracked Pull Request head commit OID |
| `github_check_run` | GitHub REST `node_id` of the check run | Parent check-suite `node_id` |
| `github_workflow_run` | GitHub REST `node_id` of the Actions workflow run | Tracked Pull Request head commit OID |
| `github_commit_status` | GitHub REST `node_id` of the commit status | Commit OID |
| `local_worktree` | Immutable UUID `worktreeId` declared by the allowlisted host manifest | Host-manifest installation ID |
| `local_automation` | Immutable UUID `automationId` declared by the allowlisted host manifest | Host-manifest installation ID |
| `local_openclaw` | Immutable UUID `openclawInstanceId` declared once for the observed installation | Host-manifest installation ID |

Display numbers, names, URLs, branches, filesystem paths, process IDs, and process names are attributes, never identity. A local entity keeps its manifest UUID when those attributes change. Changing a canonical ID is a remove-plus-add source event, not an in-place identity repair.

The projection retains the source URL when one exists, source update time, last observed time, last successful projection time, and the completeness partition. A partition is complete only after every page and required child query for that partition succeeds under one sync attempt. Tombstones are scoped to the completed partition; success in one partition cannot tombstone another.

The MVP initiates synchronization only through outbound scheduled polling or a local manual refresh that invokes the same read-only sync path. It exposes no inbound webhook or external event-ingestion endpoint. Poll interval and numeric backoff limits remain tuning under the accepted design; changing to webhooks or another inbound mechanism is an ADR revisit.

Sync is an idempotent upsert. Repeating the same complete source response produces the same projection. Only a successful, explicitly complete enumeration for one partition may tombstone records absent from that partition. Partial, failed, rate-limited, unauthorized, or schema-invalid reads never infer deletion, completion, reassignment, approval, or status change. Tombstones remain source-linked and may be retained for the design's bounded operational period.

On GitHub rate limit, the sync client honors reset and retry metadata, applies bounded exponential backoff with jitter, and exposes degraded source health. It does not busy-loop, bypass the reset window, mark the source healthy, or commit completeness-based tombstones. Numeric delay bounds are tuning, but honoring server metadata, bounded backoff, jitter, and degraded health are structural behavior.

Unknown enum members, malformed records, and unsupported external schema shapes are quarantined rather than coerced. Quarantine preserves non-secret diagnostic metadata and the source link, does not affect derived workflow state, and exposes source degradation. The system validates and rejects; it does not repair authoritative input.

Staleness is explicit source metadata. GitHub failure leaves the last successful projection visible as stale and read-only. Failure of one local source does not make GitHub projection unavailable. The backend never falls back to browser-local workflow truth.

### D4 - `ai-workflow-record:v1` is the only machine authority for derived agents and gates

Machine-readable workflow comments contain exactly one `ai-workflow-record:v1` HTML-comment payload with the closed fields and unions defined by design v0.4.0. The record types are:

```text
start_task | handoff | review_result | human_approval | kanban_update | completion
```

The authenticated GitHub author, comment ID, `createdAt`, and `updatedAt` are source facts. The payload cannot claim its own actor. A server-only principal registry maps GitHub logins into exactly one of three disjoint trust classes:

- **Worker principal:** may declare only its explicitly allowlisted worker identities and roles.
- **Reviewer principal:** may author `review_result` only and has credentials unavailable to workers.
- **Human approver principal:** may assign/start/handoff work and author `human_approval`; its credential is Human-only and unavailable to every AI agent, reviewer runtime, OpenClaw runtime, Mission Control service, and automation process.

One GitHub login cannot belong to more than one trust class. Startup fails closed on overlapping login membership, unknown principal classes, or missing custody attestation metadata. The Human owner provisions and rotates Human/reviewer/worker credentials outside Mission Control and attests that each credential is available only to its declared class; the service cannot compare secret tokens it correctly never receives. The service stores no Human or reviewer posting credential because the MVP is read-only. Shared GitHub credentials may represent multiple workers only inside the Worker class when every allowed worker identity/role is explicitly enumerated. Worker identity then remains a governed declaration, not independent process authentication.

The following are structural rules:

- `start_task` is valid only from a registered Worker principal declaring an allowed identity/role or from the Human approver assigning one.
- `handoff` is valid only from the effective Worker principal or Human approver, must identify the next worker and role, and must supersede the effective assignment record.
- `review_result` is valid only from the disjoint Reviewer principal, carries `approved` or `revisions_required`, and identifies an exact Pull Request and full 40-character head SHA.
- `human_approval` is valid only from the disjoint Human approver principal and identifies an exact Pull Request and full head SHA.
- `kanban_update` and `completion` are valid only from the effective Worker principal or Human approver.
- approval or review of one head never applies to another head.
- edited comments are invalid; correction is a new authorized record with explicit supersession.
- ordering is GitHub `createdAt`, then numeric comment ID.
- supersession is same-card, earlier-record, authorized, acyclic, and one-to-one.
- unknown fields, missing fields, invalid nullability, unknown enums, abbreviated heads, duplicate records, conflicting effective assignment, unauthorized authors, and malformed supersession are quarantined.
- a terminal authoritative GitHub card status clears active derived assignment.

For each card and relevant record type, the effective record is the latest valid, unsuperseded record by the ordering above. A superseded record is never effective. Multiple valid unsuperseded assignment records that claim different primary implementers are a conflict: the card's derived assignment is quarantined rather than selecting a winner. Multiple cards may be active concurrently, but at most one primary implementer record is effective per card. Legacy prose remains visible in Live Feed but never creates assignment, review, or approval state.

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
2. Mission Control projection/cache is rebuildable; local audit history is non-authoritative, separately retained, and may be lost. Neither is an independent work queue.
3. Projection identity uses the closed D3 `sourceType` union and canonical immutable `sourceId`; only a complete successful partition read can tombstone absent records in that partition.
4. Partial failure never infers deletion, completion, reassignment, approval, or status change.
5. Derived agent and gate state comes only from valid `ai-workflow-record:v1` records and exact GitHub source facts; prose is never parsed as authority; effective records use latest-valid-unsuperseded precedence.
6. Worker, reviewer, and Human principals are disjoint trust classes. Review and Human approval are exact-head facts and never survive a head change.
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
- Worker automation must use credentials distinct from the Human-only and reviewer-only GitHub principals; existing shared-owner credentials cannot produce trusted Human/reviewer records.
- A Windows host exporter adds a separately operated component and ACL/freshness tests.
- The fork creates an ongoing controlled upstream-maintenance responsibility.

### Neutral / Deferred

- Poll interval, numeric backoff limits, stale threshold, retention duration, database schema, and UI component shape remain implementation/tuning choices within the design bounds.
- Remote deployment, organization-owned Projects, inbound webhook/event ingestion, and every write/control action are future architecture work.
- The existing OpenClaw runtime remains independently managed and is neither upgraded nor repaired by this initiative.

## Validation Required Before Implementation

- Verify the fork tree equals upstream commit `75eb8b0894803e48891a8a92b564c25fb126f2ea`, preserves MIT attribution, and records both remotes.
- Contract tests for all Project/Issue/Pull Request/comment/review/Actions/status/check source fixtures and unknown-shape quarantine.
- Idempotency, partition-completeness tombstone, cross-partition isolation, partial-failure non-deletion, polling/manual-refresh equivalence, no-webhook surface, rate-limit metadata/backoff/jitter/degraded-health, stale, and projection-rebuild tests.
- Projection-key tests covering every closed source type, canonical GitHub node ID, stable local manifest UUID, mutable display attributes, and remove-plus-add identity changes.
- Exhaustive `ai-workflow-record:v1` parser tests covering disjoint trust classes, login-class overlap and missing-custody-attestation rejection, worker impersonation of reviewer/Human, handoff target worker/role, Kanban/completion authors, exact-head gates, edits, latest-valid-unsuperseded precedence, supersession, cycles, assignment conflicts, and malformed records.
- Credential tests requiring exactly `read:project`, rejecting broader/missing scopes, and probing every required public read endpoint.
- Exporter tests for redaction, fixed paths, ACL/setup failure, atomic replacement, schema version, session restart, sequence, expiry, replay, and stale retention.
- Compose tests proving host-loopback-only publication, internal-only PostgreSQL/Redis, minimal read-only mounts, local auth, and absent/hard-disabled write routes.
- A destructive-cache test proving projection deletion followed by sync reconstructs current workflow state from authoritative sources while clearly reporting that destroyed local audit history was not reconstructed.

## Revisit Triggers

Revise this ADR before any of the following:

- Mission Control writes to GitHub or local repositories/processes.
- Project authority moves away from GitHub Project #4 or becomes organization-owned.
- Credentials require a scope beyond exactly `read:project`.
- Polling/manual-refresh initiation changes or webhooks/remote deployment introduce an inbound trust boundary.
- Containers receive direct repository, worktree, or OpenClaw runtime mounts.
- `ai-workflow-record:v1` changes fields, types, authority, ordering, supersession, or exact-head semantics.
- Principal trust classes overlap, credential custody changes, or an agent gains a Human/reviewer credential.
- A persisted source type, canonical source ID rule, or completeness partition changes.
- Projection records become behavior/decision input for an agent rather than operator observation.
- The adopted OpenClaw upstream commit changes.

## Decision Log

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| Standalone fork pinned to exact upstream SHA | Isolates tooling lifecycle and makes adoption reproducible | Embed in simulation repo; floating upstream |
| GitHub sole authority; projection/audit only | Prevents split-brain work and keeps current projection rebuildable | Mission Control task authority; bidirectional MVP |
| Projection rebuildable; audit non-authoritative and not reconstructable | Distinguishes current derived state from local historical evidence | Claiming reconstructed audit history after cache loss |
| Closed source types, canonical IDs, partition-scoped validate-never-infer reconciliation | Makes sync idempotent, rebuild-stable, and partial failure safe | Display/path identity; heuristic repair; deletion on failed/partial reads |
| Polling/manual refresh only; bounded rate-limit backoff | Keeps the local MVP outbound-only and failure-safe | Inbound webhooks; busy retry; inferred completeness on failure |
| Closed `ai-workflow-record:v1`, latest-valid-unsuperseded precedence, and disjoint Worker/Reviewer/Human trust classes | Deterministic, source-linked assignment and non-forgeable gates | Parsing prose; incomplete precedence; inferring actor from payload; shared cross-class credential |
| Dedicated classic PAT with exactly `read:project` | Reads user Project #4 without broad operator credentials | Operator `gh` token; write-scoped token |
| Atomic redacted host export and read-only mount | Observes local health without exposing roots or shell access | Direct mounts; loopback command API; arbitrary probes |
| Compose host-loopback publication | Local usability without LAN/database exposure | Wildcard host ports; container-loopback binding |
| No write/control routes | Proves observability before consequential authority | Deferred hidden controls; write-through MVP |

---

## Kanban Update

**Card:** ADR-23 - Mission Control Projection and Control Boundary (#142)
**Status:** Review - ADR status Proposed; revision 1 closes the seven architecture-review findings; awaiting architecture re-review and Human acceptance.
**Completed:** Drafted ADR-23 from the accepted Mission Control design v0.4.0 and revised D2-D4 after architecture review: projection and audit loss semantics are separated; every source has a canonical ID and completeness partition; polling/manual-refresh and rate-limit behavior are structural; Worker/Reviewer/Human principals and credentials are disjoint; handoff/update/completion author rules and latest-valid-unsuperseded precedence are explicit. Repository/upstream, credential scope, Windows host export, local deployment, and future-control boundaries remain unchanged.
**Changed Files:**
  CREATED  ai-studio/adr/0023-mission-control-projection-and-control-boundary.md
**Validation:** Traced every decision to design v0.4.0, Issue #142, the Architecture Workflow, or an explicit architecture-review correction; confirmed no gameplay ADR is reopened; confirmed the existing OpenClaw runtime and all implementation files remain untouched. Added required tests for trust-class impersonation/overlap, source identity/partitions, polling/rate-limit behavior, effective-record precedence, and audit-loss reporting.
**Follow-up Tasks:** Architecture re-review, then Human acceptance. Only after acceptance may the five implementation cards be opened in dependency order.
