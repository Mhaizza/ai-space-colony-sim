# ADR-23 - Mission Control Projection and Control Boundary

**Status:** Proposed (revision 11 after architecture review: trust classes, canonical projection identity, audit ownership, complete workflow-record contract, polling/failure semantics, database outage, runtime-mount boundaries, repository-qualified artifact references, per-repository startup probes, start_task supersession authorization, duplicate-JSON-member rejection, repository-scoped completeness partitions, repository-qualified path artifacts, the canonical RoleSlug registry, Pull Request review startup probes, the reserved human-owner RoleSlug, pinned public fork visibility, local-auth redaction, self-repository-only workflow-record authority, deterministic kanban_update/completion worker-role pairing, canonical PR-conversation-comment partitioning, the manual-refresh action-route exception, scoped worker-role pairing ban, GitHub-credential audit/diagnostic redaction, Worker-class-only assignment targets, typed non-PR review/approval gates, inline PR review comment projection, a unified pr:/path: current-head gate rule, independent handoff-target validation, artifact-scoped gate-record effectiveness, path-gate current-head tracking, widened non-PR review outcome states, and start_task/handoff worker-role-pair validation closed)
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

The fork's GitHub visibility is **public**. This is a fixed part of D1, not implementation freedom: D5's credential is scoped to exactly `read:project` with no repository scope, and reads Issues/Pull Requests/reviews/checks through public read endpoints; a private `mission-control` repository would make every `mission-control`-qualified artifact permanently unprobable and disabled under D5, regardless of D1/D4 otherwise being satisfied. If public visibility of the fork ever becomes unacceptable, this ADR must be revisited and a different credential model chosen before bootstrap proceeds or continues — the credential scope is never silently widened to add repository access as a workaround.

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
| `github_issue` | GitHub global node ID of the Issue | Owning repository node ID |
| `github_pull_request` | GitHub global node ID of the Pull Request | Owning repository node ID |
| `github_issue_comment` | GitHub global node ID of the Issue comment | The parent number's own canonical node ID — see below |
| `github_pull_request_review` | GitHub global node ID of the Pull Request review | Parent Pull Request global node ID |
| `github_pull_request_review_comment` | GitHub global node ID of the Pull Request review comment (inline diff comment) | Parent Pull Request global node ID |
| `github_check_suite` | GitHub REST `node_id` of the check suite | Owning repository node ID + tracked Pull Request head commit OID |
| `github_check_run` | GitHub REST `node_id` of the check run | Owning repository node ID + parent check-suite `node_id` |
| `github_workflow_run` | GitHub REST `node_id` of the Actions workflow run | Owning repository node ID + tracked Pull Request head commit OID |
| `github_commit_status` | GitHub REST `node_id` of the commit status | Owning repository node ID + commit OID |
| `local_worktree` | Immutable UUID `worktreeId` declared by the allowlisted host manifest | Host-manifest installation ID |
| `local_automation` | Immutable UUID `automationId` declared by the allowlisted host manifest | Host-manifest installation ID |
| `local_openclaw` | Immutable UUID `openclawInstanceId` declared once for the observed installation | Host-manifest installation ID |

"Owning repository node ID" resolves through the entity's `RepoQualifier` (D4): `self`'s GitHub repository node ID for `Mhaizza/ai-space-colony-sim`, or `mission-control`'s repository node ID once D1's fork bootstrap records the `owner/repo` mapping. Every CI partition (`github_check_suite`, `github_check_run`, `github_workflow_run`, `github_commit_status`) includes the owning repository node ID precisely because commit OIDs and check-suite IDs are not unique across repositories — a fork can share a commit SHA with its upstream, and a complete sync for one repository's partition must never tombstone or merge another repository's CI records at the same OID. `github_pull_request_review` and `github_pull_request_review_comment` each inherit their owning repository transitively through their parent Pull Request partition and need no separate repository component. Inline PR review comments (GitHub's `PullRequestReviewComment` objects, attached to a specific diff line and distinct from both generic Issue comments and the review-summary object) are their own source type precisely so D5's sync can persist and tombstone them independently — a sync that only covers `github_issue_comment` and `github_pull_request_review` can satisfy this table while silently never storing or removing inline diff feedback, leaving Mission Control's Live Feed and review context incomplete even though D2 assigns Pull Requests ownership of their comments. Project #4 items are inherently single-project-scoped and are unaffected by repository qualification.

`github_issue_comment`'s parent is pinned to exactly one canonical identity, never chosen per sync pass. GitHub numbers Issues and Pull Requests from one shared per-repository sequence, so a given number is always exactly one of an Issue or a Pull Request, never both. The comment's partition is that same number's canonical node ID as already resolved elsewhere in this table: the `github_issue` canonical `sourceId` if the number is an Issue, or the `github_pull_request` canonical `sourceId` (not a separately re-derived Issue identity) if the number is a Pull Request — including for Pull Request conversation comments, which are `IssueComment` objects reachable through both the generic Issues-comment endpoint and Pull-Request-specific traversal. An implementation must resolve a number's Issue-vs-Pull-Request identity once and reuse that same resolution for every comment sync path; it may never partition the same comment under two different parent identities depending on which traversal discovered it, since that would let a complete sync of one partition fail to tombstone a stale comment still held under the other.

Display numbers, names, URLs, branches, filesystem paths, process IDs, and process names are attributes, never identity. A local entity keeps its manifest UUID when those attributes change. Changing a canonical ID is a remove-plus-add source event, not an in-place identity repair.

The projection retains the source URL when one exists, source update time, last observed time, last successful projection time, and the completeness partition. A partition is complete only after every page and required child query for that partition succeeds under one sync attempt. Tombstones are scoped to the completed partition; success in one partition cannot tombstone another.

For every repository-qualified path referenced by a `path:` artifact under active or candidate D4 gate evaluation, sync additionally resolves and refreshes that path's **current head-for-path**: the SHA of the owning repository's default-branch commit that most recently changed the file at that path, using the same poll cadence and idempotent-upsert discipline as every other projected fact. This is a derived comparison value D4's gate-validity check reads, not a new persisted `sourceType` and not itself independently tombstoned — if the path or its repository becomes unresolvable, the value simply stops refreshing and the gate falls back to D4's quarantine-on-unresolvable rule.

The MVP initiates synchronization only through outbound scheduled polling or a local manual refresh that invokes the same read-only sync path. It exposes no inbound webhook or external event-ingestion endpoint. Poll interval and numeric backoff limits remain tuning under the accepted design; changing to webhooks or another inbound mechanism is an ADR revisit.

Sync is an idempotent upsert. Repeating the same complete source response produces the same projection. Only a successful, explicitly complete enumeration for one partition may tombstone records absent from that partition. Partial, failed, rate-limited, unauthorized, or schema-invalid reads never infer deletion, completion, reassignment, approval, or status change. Tombstones remain source-linked and may be retained for the design's bounded operational period.

On GitHub rate limit, the sync client honors reset and retry metadata, applies bounded exponential backoff with jitter, and exposes degraded source health. It does not busy-loop, bypass the reset window, mark the source healthy, or commit completeness-based tombstones. Numeric delay bounds are tuning, but honoring server metadata, bounded backoff, jitter, and degraded health are structural behavior.

Unknown enum members, malformed records, and unsupported external schema shapes are quarantined rather than coerced. Quarantine preserves non-secret diagnostic metadata and the source link, does not affect derived workflow state, and exposes source degradation. The system validates and rejects; it does not repair authoritative input.

Staleness is explicit source metadata. GitHub failure leaves the last successful projection visible as stale and read-only. Failure of one local source does not make GitHub projection unavailable. The backend never falls back to browser-local workflow truth.

If PostgreSQL or the projection store is unavailable, the backend returns an explicit service-unavailable response and the UI renders an unavailable state. It does not return an empty board, create an in-memory replacement authority, infer that no cards are active, or use browser-local cached data as current truth. Polling pauses or fails without committing projection changes and resumes through the normal reconciliation path after storage health is restored.

### D4 - `ai-workflow-record:v1` is the only machine authority for derived agents and gates

Machine-readable workflow comments contain exactly one `ai-workflow-record:v1` HTML-comment payload with the closed fields and unions defined by design v0.4.0. The record types are:

```text
start_task | handoff | review_result | human_approval | kanban_update | completion
```

The payload is a JSON object with exactly these fields and no others:

```text
{
  type: RecordType
  card: positive integer
  worker: WorkerId | null
  role: RoleSlug | null
  artifact: ArtifactRef | null
  head: FullCommitSha | null
  result: ReviewResult | null
  supersedes: positive GitHub comment id | null
}

WorkerId = "codex" | "claude" | "cursor" | "openclaw" | "human" | "chatgpt-reviewer"
ReviewResult = "approved" | "approved_with_conditions" | "rejected"
ArtifactRef = "pr:<RepoQualifier>#<positive integer>" | "issue:<RepoQualifier>#<positive integer>" | "path:<RepoQualifier>#<normalized repository-relative path>"
RepoQualifier = "self" | "mission-control"
FullCommitSha = exactly 40 lowercase hexadecimal characters
RoleSlug = a slug present in the closed canonical role-slug registry
```

`ReviewResult`'s three members are the exact outcome vocabulary `ai-studio/workflows/architecture-workflow.md` §5 step 6 already requires the Reviewer principal to post: Approved, Approved with conditions, or Rejected. The prior two-member union (`approved` | `revisions_required`) could not represent "approved with conditions" at all and used non-canonical wording for the third state; `rejected` replaces `revisions_required` as this ADR's own record on Issue #142 has itself been an instance of exactly this workflow, and its record's `result` is now expressible without loss for either artifact form. `ReviewResult` is shared, unmodified, by both `pr:` and `path:` gates — a `path:` design/architecture review can now record "approved with conditions" or "rejected" exactly as a `pr:` implementation review can.

`WorkerId` is a closed union spanning three disjoint trust classes (Worker, Human, Reviewer), but not every member is a valid `start_task`/`handoff` assignment target: `human` and `chatgpt-reviewer` are structural sentinels identifying the Human approver and Reviewer principal in the `worker` field of `human_approval` and `review_result` respectively — they are never registered Worker-class principals and can never hold a card's effective assignment. A `start_task` or `handoff` naming `human` or `chatgpt-reviewer` as the assigned worker is malformed and quarantined, since neither sentinel can subsequently author a worker-authored `kanban_update`, `completion`, or `handoff` as that assignment's owner.

`start_task`'s "Worker identity being started" and `handoff`'s "next Worker identity" are validated by two different rules, not one shared allowlist. `start_task` is a self-declaration: its worker value must be one of `codex`, `claude`, `cursor`, or `openclaw`, and must be a worker identity the server-only principal registry allows the *authoring* Worker principal (or the Human approver) to declare for itself. `handoff`'s target is validated independently: it must be one of `codex`, `claude`, `cursor`, or `openclaw`, and must be a Worker-class identity registered in the principal registry as some principal's own identity — but it is never checked against the authoring principal's own declarable-identity allowlist. This separation is deliberate: if a handoff target were validated through the handing-off principal's declarable set, ordinary cross-worker handoffs (`codex` → `claude`) would be impossible unless `codex`'s principal were also granted permission to declare `claude` — and that same grant would then let `codex`'s principal author a `start_task` self-assigning an unowned card to `claude` under the self-declaration rule above. Keeping the two checks independent closes that path while leaving normal handoffs unaffected.

`start_task`'s role and `handoff`'s role are each validated as a **worker-role pair**, not merely as an independently valid `RoleSlug`. Being present in the canonical `RoleSlug` registry (below) is necessary but not sufficient: the server-only principal registry additionally enumerates, per Worker-class identity (`codex`, `claude`, `cursor`, `openclaw`), the closed set of roles that identity may hold. A `start_task` or `handoff` naming a role outside its own named worker's allowlisted role set is malformed and quarantined, even when that role is a valid registry member and the worker identity itself passes the identity-validation rules above — a card can never be assigned to a worker under a role that worker's registry entry does not list. This is a distinct rule from `kanban_update`/`completion`'s worker-role pairing (below), which instead checks a worker/role pair against the card's own current effective assignment record rather than against the principal registry's static per-worker allowlist; the two pairing rules apply to disjoint record types and are never merged.

The canonical `RoleSlug` registry is closed and derived one-to-one from the governed role files under `ai-studio/roles/**/*.md` (excluding `README.md`), using each file's basename without extension as its slug, plus exactly one workflow-native reserved slug not backed by a file: `human-owner`, denoting the Human approver principal. Its initial closed set is: `ai-simulation-designer`, `creative-director`, `game-systems-designer`, `gameplay-engineer`, `human-owner`, `qa-reviewer`, `technical-director`, `ui-ux-engineer`, `world-designer`. A `role` value outside this set is unknown and quarantined.

`human-owner` is legal as a `role` value only where `worker` is `human`: required exactly for `human_approval`, and required exactly for `kanban_update`/`completion` when their `worker` is `human`. It is never a legal `role` value for `start_task`, `handoff`, or `review_result`. When `kanban_update` or `completion` is instead authored by the effective Worker identity (`worker` is not `human`), `role` must be exactly the role recorded in the card's current effective assignment record (the latest effective `start_task` or `handoff`) — never `human-owner`, and never any other slug. This closes the gap where `human-owner` was reserved exclusively for `human_approval` while the matrix still permitted `worker = human` for `kanban_update`/`completion` with no valid role left for the parser to accept: those two records now have exactly one legal role for each of their two possible authors, and any other worker/role pairing is malformed and quarantined.

The file-derived slugs grow only when a new role file is added under `ai-studio/roles/` and the workflow-compatibility prerequisite card (below) generates and validates a canonical machine-readable manifest (e.g. a generated `role-slugs.json`) from those files plus the reserved `human-owner` entry; templates, the principal registry, and the parser must all read that manifest rather than independently deriving slugs, so they cannot disagree about which roles are valid.

The parser rejects a payload containing duplicate JSON object member names before normal object parsing; it never applies default last-value-wins or first-value-wins duplicate-key behavior, because that ambiguity would let two readers of the same comment disagree about assignment or approval facts. A record with any duplicate member name is malformed and quarantined regardless of whether the duplicated values agree.

A record is authoritative only when posted on an Issue in `Mhaizza/ai-space-colony-sim` that is linked to Project #4 and numbered `card`. A structurally identical, syntactically valid record posted on an Issue in `mission-control` — even one that happens to share the same `card` number — is a non-authoritative Live Feed entry and never contributes to derived assignment, review, Human approval, Kanban Update, or completion state; issue numbers are not globally unique across repositories, and `mission-control`'s own Issues, once D5 probes that repository, are read for local Live Feed display only, never as a second source of authoritative `card`-bound records. Records on another Issue in `self`, or only on a Pull Request, are likewise non-authoritative Live Feed entries. `path:` rejects absolute paths, backslashes, empty segments, `.`/`..` segments, percent-encoded traversal, and paths outside the repository identified by its `RepoQualifier`. Every artifact form — `pr:`, `issue:`, and `path:` — is repository-qualified, because D1 places Mission Control implementation in a sibling repository: `self` resolves to `Mhaizza/ai-space-colony-sim` (the repository hosting the record); `mission-control` resolves to the exact `owner/repo` that D1's fork bootstrap records as `origin` in `UPSTREAM.md`, mirrored into server-only configuration. A `mission-control`-qualified artifact of any form — including `path:` — is malformed and quarantined until that mapping exists and D5's startup probes for that repository have passed — there is nothing yet for it to resolve to, and an unprobed repository must fail closed rather than silently accept its artifacts. Any qualifier other than `self` or `mission-control`, or an unqualified `pr:<number>`/`issue:<number>`/`path:<path>` (the pre-revision-3/4 forms), is malformed. The per-type validity matrix is exhaustive; every `pr:`, `issue:`, and `path:` cell below requires a valid `RepoQualifier`:

| `type` | `worker` | `role` | `artifact` | `head` | `result` | `supersedes` |
|---|---|---|---|---|---|---|
| `start_task` | Worker identity being started (registered Worker-class principal only; never `human` or `chatgpt-reviewer`) | required governed role, valid only when paired with the named worker in the principal registry's per-worker role allowlist | `null` | `null` | `null` | `null`, or (only when authored by the Human approver) a prior same-card assignment record |
| `handoff` | next Worker identity (registered Worker-class principal only; never `human` or `chatgpt-reviewer`) | next governed role, valid only when paired with the named worker in the principal registry's per-worker role allowlist | `null` | `null` | `null` | required effective assignment record |
| `review_result` | `chatgpt-reviewer` | required reviewer role | required `pr:` (PR gate) or `path:` (non-PR design/architecture gate) reference; never `issue:` | required exact head — the artifact's current head at authoring (PR's current head for `pr:`, current head-for-path for `path:`) | required review result | `null` or prior same-card, same-artifact review result |
| `human_approval` | `human` | required, exactly `human-owner` | required `pr:` (PR gate) or `path:` (non-PR design/architecture gate) reference; never `issue:` | required exact head — the artifact's current head at authoring (PR's current head for `pr:`, current head-for-path for `path:`) | `null` | `null` or prior same-card, same-artifact Human approval |
| `kanban_update` | effective Worker identity or `human` | required, exactly `human-owner` if `worker` is `human`; otherwise required, exactly the card's effective assignment record's role | `null` | `null` | `null` | `null` or prior same-card Kanban Update |
| `completion` | effective Worker identity or `human` | required, exactly `human-owner` if `worker` is `human`; otherwise required, exactly the card's effective assignment record's role | required `pr:`, `issue:`, or `path:` reference | required exact head for `pr:`, otherwise `null` | `null` | `null` or prior same-card completion |

Every row is exact. A field value or nullability that does not match its row is malformed and quarantined. Adding a field, enum member, artifact form, record type, or legal row shape requires an ADR revision.

The authenticated GitHub author, comment ID, `createdAt`, and `updatedAt` are source facts. The payload cannot claim its own actor. A server-only principal registry maps GitHub logins into exactly one of three disjoint trust classes:

- **Worker principal:** may declare only its explicitly allowlisted worker identities and roles.
- **Reviewer principal:** may author `review_result` only and has credentials unavailable to workers.
- **Human approver principal:** may assign/start/handoff work and author `human_approval`; its credential is Human-only and unavailable to every AI agent, reviewer runtime, OpenClaw runtime, Mission Control service, and automation process.

One GitHub login cannot belong to more than one trust class. Startup fails closed on overlapping login membership, unknown principal classes, or missing custody attestation metadata. The Human owner provisions and rotates Human/reviewer/worker credentials outside Mission Control and attests that each credential is available only to its declared class; the service cannot compare secret tokens it correctly never receives. The service stores no Human or reviewer posting credential because the MVP is read-only. Shared GitHub credentials may represent multiple workers only inside the Worker class when every allowed worker identity/role is explicitly enumerated. Worker identity then remains a governed declaration, not independent process authentication.

The following are structural rules:

- `start_task` is valid only from a registered Worker principal declaring an allowed identity/role or from the Human approver assigning one. A `start_task` may supersede a prior same-card assignment record only when authored by the Human approver; a `start_task` authored by a Worker principal is valid only when no effective assignment currently exists for the card. A Worker principal can never take over a card's existing effective assignment through `start_task` — transferring an already-assigned card between workers requires `handoff` from the effective Worker principal, or a Human-approver-authored `start_task`.
- `handoff` is valid only from the effective Worker principal or Human approver, must identify the next worker and role, and must supersede the effective assignment record. The next-worker identity is validated as a registered Worker-class identity independently of the authoring principal's own declarable-identity allowlist — that allowlist governs only `start_task`'s self-declared identity, never a `handoff` target.
- `start_task` and `handoff` must assign the card to a registered Worker-class principal's identity; `human` and `chatgpt-reviewer` are never valid assignment targets even when the record is otherwise authored correctly.
- `review_result` is valid only from the disjoint Reviewer principal, carries `approved`, `approved_with_conditions`, or `rejected`, and identifies a `pr:` or `path:` artifact whose `head` equals that artifact's **current head** as observed by sync at or immediately after the record's authoring — a well-formed but non-current or anticipatory SHA is quarantined, and a record's validity is fixed at authoring, never later satisfied by the artifact subsequently reaching that SHA. "Current head" is resolved identically in kind for both artifact forms, by an artifact-type-specific source: for a `pr:` artifact it is the referenced Pull Request's current head commit SHA; for a `path:` artifact it is D3's current head-for-path (the owning repository's default-branch commit that most recently changed the file). Neither form is treated as inherently fixed or exempt from this check — a `path:` gate's approval stops being effective the moment the file's current head-for-path advances past the reviewed commit, exactly as a `pr:` gate's approval stops being effective the moment the Pull Request's head advances.
- `human_approval` is valid only from the disjoint Human approver principal, carries `role` exactly `human-owner`, and identifies a `pr:` or `path:` artifact under the same unified current-head rule as `review_result`.
- `review_result` and `human_approval` represent two gate kinds: implementation Pull Request gates (`pr:` artifact) and non-PR design/architecture gates (`path:` artifact) — such as this ADR's own architecture-review and Human-acceptance verdicts on Issue #142, which reference `path:self#ai-studio/adr/0023-mission-control-projection-and-control-boundary.md` at each revision's exact head. An `issue:` artifact is never valid for either type: a gate always reviews one exact versioned document (a PR's current head, or a `path:`'s current head-for-path), never an abstract Issue with no fixed version to pin.
- `start_task` and `handoff` role values are validated as worker-role pairs against the principal registry's per-worker role allowlist, not merely as members of the closed `RoleSlug` registry; a role that is registry-valid but not allowlisted for the specifically named worker identity is malformed and quarantined.
- `kanban_update` and `completion` are valid only from the effective Worker principal or Human approver; when authored by the Human approver (`worker` is `human`), `role` must be exactly `human-owner`; when authored by the effective Worker principal, `role` must be exactly the role recorded in the card's current effective assignment record. Any other worker/role pairing for these two types is malformed and quarantined.
- approval or review of one head never applies to another head.
- edited comments are invalid; correction is a new authorized record with explicit supersession.
- ordering is GitHub `createdAt`, then numeric comment ID.
- supersession is same-card, earlier-record, authorized, acyclic, and one-to-one; for `review_result` and `human_approval` specifically, supersession is additionally same-artifact — a record referencing one artifact can never supersede a record referencing a different artifact, even for the same card and type.
- unknown fields, missing fields, invalid nullability, unknown enums, abbreviated heads, duplicate records, conflicting effective assignment, unauthorized authors, and malformed supersession are quarantined.
- an `ArtifactRef` with a missing, unqualified, unknown, or not-yet-resolvable `RepoQualifier` is quarantined.
- a record posted on an Issue that is not in `Mhaizza/ai-space-colony-sim` and linked to Project #4 is never authoritative, regardless of whether its `card` number matches; it is quarantined as non-authoritative Live Feed rather than being evaluated as a candidate effective record.
- a `start_task` authored by a Worker principal that attempts to supersede an existing effective same-card assignment is an unauthorized supersession and is quarantined; only a Human-approver-authored `start_task`, or a `handoff` from the effective Worker principal, may transfer an active assignment.
- a payload containing a duplicate JSON object member name is quarantined; duplicate-member detection runs before the payload is otherwise parsed as a JSON object.
- a `start_task` or `handoff` naming `human` or `chatgpt-reviewer` as the assigned worker is quarantined; only a `WorkerId` registered as a Worker-class principal may be an assignment target.
- a terminal authoritative GitHub card status clears active derived assignment.

For `start_task`, `handoff`, `kanban_update`, and `completion`, the effective record for a card is the latest valid, unsuperseded record of that type by the ordering above — exactly one effective record per card per type, as before.

For `review_result` and `human_approval`, effectiveness is scoped one level finer: the effective record is the latest valid, unsuperseded record of that type **for a given artifact reference**, not merely for the card and type. A card can therefore carry more than one simultaneously effective gate record — for example an effective `path:`-artifact design-review verdict alongside an independently effective `pr:`-artifact implementation-review verdict, once implementation begins — without either ever superseding or hiding the other. A later `review_result`/`human_approval` naming a *different* artifact never replaces the effective record for a prior artifact; only a record sharing the same `type`, `card`, and identical artifact reference can supersede it (per the same-artifact supersession rule above). Every gate record's effectiveness is additionally bound to its artifact's current head (above): a record that no longer matches its artifact's current head stops being effective on its own, without requiring a new record to supersede it.

A superseded record is never effective. Multiple valid unsuperseded assignment records that claim different primary implementers are a conflict: the card's derived assignment is quarantined rather than selecting a winner. Multiple cards may be active concurrently, but at most one primary implementer record is effective per card. This artifact-scoped model never introduces "latest review wins" behavior across different artifacts or revisions: effectiveness is always keyed to one exact artifact identity, never inferred from recency alone. Legacy prose remains visible in Live Feed but never creates assignment, review, or approval state.

The workflow templates and validator must adopt this record contract in a separate prerequisite card before the GitHub adapter consumes it. The adapter cannot infer or backfill machine records from historical prose.

### D5 - Dedicated GitHub read credential with exact scope

Mission Control never reuses the operator's authenticated `gh` session. Because Project #4 is user-owned, the backend uses a dedicated classic personal access token with exactly the single OAuth scope `read:project`. Every configured `RepoQualifier` repository — `Mhaizza/ai-space-colony-sim` always, and the D1 fork (public, per D1) once mapped — is read through public read endpoints without `repo`, `public_repo`, `workflow`, or any write scope; this credential model depends structurally on both repositories being public.

Startup fails closed unless:

1. the normalized `X-OAuth-Scopes` response set is exactly `{read:project}`;
2. a read-only query can access user-owned Project #4;
3. read-only probes can access, for **every configured `RepoQualifier`** (D4) — `self` always, and `mission-control` whenever D1's fork bootstrap has recorded an `owner/repo` mapping — that repository's Issues, Pull Requests, Pull Request reviews, Pull Request review comments, comments, Actions runs, commit statuses, check suites, and check runs; and
4. no credential value reaches browser code, API output, persisted projection rows, quarantine payloads, operational audit records, diagnostic output, or logs.

The GitHub PAT's redaction obligation is not limited to sync-time logging: D2's non-authoritative operational audit records (sync attempts, mapping errors, health transitions, local refresh requests) and any diagnostic surface are first-class stores that can retain request/response evidence, so they are covered by this same redaction rule exactly as browser code, API output, projection rows, and quarantine payloads are — an `Authorization` header value or the raw token must never appear in any of them, even when a sync or auth failure is being recorded for operator diagnosis.

A `RepoQualifier` whose probes have not both been configured and passed is not enabled: the backend never falls back to serving `mission-control`-qualified artifacts as if they were probed, and D4 treats any such artifact as malformed rather than stale or pending. Adding a `RepoQualifier` value is itself an ADR revisit trigger, and enabling `mission-control` requires its own probe set to pass at startup, not merely the mapping being present in `UPSTREAM.md`.

The token is server-only local configuration, never committed. Rotation changes credentials, not projection identity or authority.

### D6 - Closed Windows host-export contract; no runtime mount or command channel

A host-side exporter runs as the current Windows user. It reads only configured roots and closed probe types, then atomically replaces:

`C:\Users\Mhaiz\AppData\Local\ai-space-colony-mission-control\export\host-status.json`

The export directory permits writes only by the current user and `SYSTEM`. Docker Compose mounts only that directory into the backend container at `/run/mission-control-host:ro`. The game repository, worktrees, and `C:\Users\Mhaiz\.openclaw` are not mounted into Mission Control containers.

The version-1 snapshot has a process-session UUID, a sequence increasing within that session, generation/expiry times, and closed derived-health arrays. Within one session the backend requires increasing sequence. A new session is accepted only with a later generation time and valid expiry; a retired session cannot become current again. Expired, malformed, unsupported-version, out-of-order, or replayed snapshots are rejected while the last valid observation remains stale.

The exporter never emits OpenClaw credentials, configuration, identity, message/media content, raw logs, approval tokens, arbitrary paths, or arbitrary workspace content. Neither exporter nor backend provides a generic shell, parameterized command execution, arbitrary file reader, process launcher, or reverse command channel.

### D7 - Local-only container boundary

Mission Control runs through Docker Compose under Docker Desktop's WSL2 Linux backend. Frontend and backend processes listen on their container interfaces. Compose publishes only the frontend and backend ports to Windows host loopback (`127.0.0.1`); wildcard host publishing is invalid. PostgreSQL and Redis remain internal with no default host ports.

Local authentication is mandatory when Clerk is absent and uses a random token of at least 50 characters. No host repository, game worktree, Mission Control source tree, or OpenClaw runtime directory is mounted into a running container; application source is copied into immutable images at build time. The sole host-data runtime mount is D6's redacted export directory, mounted read-only. Persistent volumes contain rebuildable projection data or non-authoritative audit history, never workflow authority. A remote or internet-facing deployment is not pre-authorized by this ADR.

The local-auth token, its `Authorization`/cookie header values, and any bearer material derived from it are redacted from logs, audit records, diagnostics, quarantine payloads, API output, and persisted projection state. D5's credential-redaction rule is scoped to the GitHub PAT and does not by itself cover this token — because the local-auth token must reach the browser to authenticate the host-loopback UI, this boundary carries its own explicit redaction requirement rather than inheriting D5's implicitly.

### D8 - The read-only boundary is architectural; future controls require ADR revision

The MVP has no GitHub write-back, merge, approval, branch, worktree mutation, prompt execution, process control, or OpenClaw configuration action. Write/action endpoints are absent, with exactly one explicit exception: D3's local manual-refresh endpoint, which triggers only the same read-only outbound sync path scheduled polling already uses, mutates no external system, GitHub state, local repository, worktree, or process, and is itself subject to D2's operational-audit-record requirements. Every other endpoint remains absent or hard-disabled. If inherited upstream routes cannot yet be removed, startup requires a hard-disabled configuration and tests prove the routes expose no action capability beyond that one read-only refresh trigger.

Any future control action requires all of the following before implementation:

- a new Kanban card and threat model;
- an ADR-23 revision accepted through the Architecture Workflow;
- explicit per-action authority and least-privilege credentials;
- idempotency, confirmation, audit, rollback, and failure semantics; and
- explicit Human approval.

Read-only acceptance cannot be interpreted as deferred permission to add controls.

## Required Invariants

1. GitHub remains the sole source of card, scope, review, approval, and completion truth. Only Issues in `Mhaizza/ai-space-colony-sim` linked to Project #4 can host authoritative workflow records; a same-numbered Issue in the `mission-control` fork is never a second source of `card`-bound authority.
2. Mission Control projection/cache is rebuildable; local audit history is non-authoritative, separately retained, and may be lost. Neither is an independent work queue.
3. Projection identity uses the closed D3 `sourceType` union and canonical immutable `sourceId`; only a complete successful partition read can tombstone absent records in that partition. Every partition that could otherwise collide across repositories (`github_issue`, `github_pull_request`, and every CI-derived source type) includes the owning repository node ID. `github_issue_comment`'s partition is the same single canonical Issue-or-Pull-Request identity regardless of which sync traversal discovered the comment; it is never split across two parent identities for the same underlying number.
4. Partial failure or projection-store outage never infers empty state, deletion, completion, reassignment, approval, or status change.
5. Derived agent and gate state comes only from records matching the exhaustive `ai-workflow-record:v1` schema/matrix and exact GitHub source facts; prose is never parsed as authority. `start_task`, `handoff`, `kanban_update`, and `completion` use latest-valid-unsuperseded precedence scoped to (card, type); `review_result` and `human_approval` use latest-valid-unsuperseded precedence scoped to (card, type, artifact reference) — a card may carry more than one simultaneously effective gate record when they reference different artifacts, and a record for one artifact never supersedes or hides a record for a different artifact. Every `pr:`, `issue:`, and `path:` artifact reference is repository-qualified (`self` or `mission-control`); an unqualified or unresolvable reference is never effective. `role` values are drawn only from the closed canonical `RoleSlug` registry, which includes the reserved `human-owner` slug; a `human_approval` not carrying exactly `human-owner` is never effective; a `kanban_update` or `completion` is never effective unless `role` is exactly `human-owner` when `worker` is `human`, or exactly the card's effective assignment record's role when `worker` is the effective Worker identity — for `kanban_update`/`completion` specifically, any other worker/role pairing is unknown or malformed and never effective. `start_task` and `handoff` are never effective unless `role` is additionally allowlisted for the named worker identity in the principal registry's per-worker role allowlist — a registry-valid role not allowlisted for that worker is malformed and never effective. These two worker/role pairing rules are distinct and scoped to their own record types: the `kanban_update`/`completion` rule does not narrow `start_task`/`handoff`, and the `start_task`/`handoff` rule does not narrow `kanban_update`/`completion`/`review_result`. A payload with a duplicate JSON member name is never effective. A card's existing effective assignment can be transferred only by `handoff` from the effective Worker principal or by a Human-approver-authored `start_task`; a Worker principal can never take over another worker's active assignment. `start_task` and `handoff` can only assign a card to a registered Worker-class principal; a record naming `human` or `chatgpt-reviewer` as the assignment target is never effective. `start_task`'s target is valid only within the authoring principal's own declarable-identity allowlist; `handoff`'s target is valid whenever it is a registered Worker-class identity, independent of that allowlist.
6. Worker, reviewer, and Human principals are disjoint trust classes. Review and Human approval are exact-head facts and never survive a head change. `review_result`/`human_approval` express implementation Pull Request gates (`pr:` artifact) and non-PR design/architecture gates (`path:` artifact) only, never `issue:`, and now share one `ReviewResult` outcome vocabulary (`approved` | `approved_with_conditions` | `rejected`) matching `ai-studio/workflows/architecture-workflow.md`'s reviewer outcomes for both artifact forms. A gate record is never effective unless its `head` equals its artifact's current head observed at authoring — the referenced Pull Request's current head for `pr:`, or D3's current head-for-path for `path:`; neither artifact form is exempt from this check, and validity is fixed at authoring, never re-evaluated against a later current head.
7. The GitHub token has exactly `read:project`; broader, missing, or write-capable scope fails closed. Startup probes every configured `RepoQualifier`'s repository read access, including Pull Request reviews and Pull Request review comments; a `RepoQualifier` whose probes are not configured and passing is disabled, and its artifacts (of any `ArtifactRef` form) are malformed rather than served unverified. This depends structurally on every configured `RepoQualifier` repository being public (D1, D5); the credential scope is never widened to add repository access. The token never appears in operational audit records or diagnostic output, exactly as it never appears in browser code, API output, persisted projection rows, quarantine payloads, or logs.
8. Containers receive only the redacted host-export directory at runtime; no host repository, source tree, worktree, or OpenClaw root is mounted.
9. Host observations are versioned, atomic, expiry-bounded, restart-safe, and replay-resistant.
10. Network publication is host-loopback only; PostgreSQL and Redis have no default host exposure.
11. The MVP has no control/write channel, except D3's local manual-refresh endpoint, which only re-invokes the existing read-only outbound sync path and mutates no external system. Adding any other channel requires an accepted ADR-23 revision.
12. The adopted upstream tree changes only through a separate reviewed card and exact-SHA Human approval.
13. The local-auth token, its header/cookie values, and derived bearer material are redacted from logs, audits, diagnostics, quarantine, API output, and persisted projection state, independent of and in addition to D5's GitHub-credential redaction.

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
- Idempotency, partition-completeness tombstone, cross-partition isolation, partial-failure non-deletion, polling/manual-refresh equivalence, no-webhook surface, rate-limit metadata/backoff/jitter/degraded-health, stale, projection-store outage/unavailable-state, and projection-rebuild tests.
- Projection-key tests covering every closed source type, canonical GitHub node ID, stable local manifest UUID, mutable display attributes, and remove-plus-add identity changes.
- Exhaustive `ai-workflow-record:v1` parser tests covering every matrix row and nullability violation, unknown/extra fields and enums, artifact/path validation, Issue/card binding, disjoint trust classes, login-class overlap and missing-custody-attestation rejection, worker impersonation of reviewer/Human, handoff target worker/role, Kanban/completion authors, exact-head gates, edits, latest-valid-unsuperseded precedence, supersession, cycles, assignment conflicts, and malformed records.
- Repository-qualifier tests: `self`- and `mission-control`-qualified `pr:`, `issue:`, and `path:` artifacts accepted correctly, an unqualified `pr:<number>`/`issue:<number>`/`path:<path>` (pre-revision form) rejected, an unknown qualifier rejected, and a `mission-control`-qualified artifact of any form rejected until both D1's fork-bootstrap `owner/repo` mapping is recorded and D5's probes for that repository have passed.
- Repository-scoped partition tests: a shared commit OID across `self` and `mission-control` produces two distinct CI-record partitions that cannot tombstone or merge each other's records; a complete sync of one repository's `github_issue`/`github_pull_request` partition never tombstones the other repository's records.
- `RoleSlug` registry tests: every initial closed slug (including reserved `human-owner`) is accepted, a slug not in the registry is quarantined, `human_approval` with `role` other than `human-owner` is quarantined, `human-owner` is rejected for `start_task`/`handoff`/`review_result`, and the generated canonical manifest matches the current `ai-studio/roles/**/*.md` file set plus the reserved entry exactly (fails the workflow-compatibility prerequisite card's own validation if it drifts).
- `kanban_update`/`completion` worker/role pairing tests: `worker = human` with `role = human-owner` is accepted; `worker = human` with any other `role` is quarantined; `worker` = the effective Worker identity with `role` exactly the card's effective assignment record's role is accepted; the same `worker` with `role = human-owner` or any other mismatched role is quarantined; both record types are proven to have no worker/role pairing that a parser must guess at.
- Card-binding tests: a syntactically valid record posted on a `mission-control` Issue sharing a `card` number with an active `self` card never becomes or affects that card's effective assignment/review/approval/completion state, and is projected as Live Feed only.
- Fork-visibility test: verify the bootstrapped `mission-control` repository is public, and that D5's startup probes fail closed (rather than silently degrade) if it is found private.
- Local-auth redaction tests: request/response logs, audit records, diagnostics, quarantine payloads, API output, and persisted projection rows never contain the local-auth token, its header/cookie values, or derived bearer material.
- Credential tests requiring exactly `read:project`, rejecting broader/missing scopes, and probing every required public read endpoint — including Pull Request reviews and Pull Request review comments — for every configured `RepoQualifier` (`self` always; `mission-control` once mapped), including a test that an unprobed or failed-probe `RepoQualifier` is disabled rather than served.
- `github_pull_request_review_comment` source tests: an inline diff comment is projected, partitioned under its parent Pull Request, tombstoned on a complete sync that no longer observes it, and distinguished from both `github_issue_comment` and `github_pull_request_review` records on the same PR.
- `start_task` supersession-authorization tests: a Worker-authored `start_task` is accepted when no effective assignment exists, rejected/quarantined when it attempts to supersede an existing effective assignment, and a Human-approver-authored `start_task` is accepted in the same transfer case; a `handoff`-based transfer between workers still succeeds.
- Duplicate-JSON-member-name parser tests: a payload with a duplicated field name is quarantined even when the duplicated values are identical, and detection is proven to run before generic JSON-object parsing (not relying on the runtime's default duplicate-key behavior).
- Exporter tests for redaction, fixed paths, ACL/setup failure, atomic replacement, schema version, session restart, sequence, expiry, replay, and stale retention.
- Compose tests proving host-loopback-only publication, internal-only PostgreSQL/Redis, no runtime host mounts except the read-only export directory, local auth, and absent/hard-disabled write routes except the read-only manual-refresh endpoint.
- A destructive-cache test proving projection deletion followed by sync reconstructs current workflow state from authoritative sources while clearly reporting that destroyed local audit history was not reconstructed.
- Comment-partition determinism test: a Pull Request conversation comment synced once via the Issues-comment traversal and once via Pull-Request-specific traversal resolves to the identical partition both times, and a complete sync of that partition tombstones a removed comment regardless of which traversal ran.
- Manual-refresh route test: the local manual-refresh endpoint is present and functional, invokes only the existing outbound sync path, produces an operational audit record, and every other write/action route remains absent or hard-disabled.
- Non-PR gate typed-record tests: a `review_result`/`human_approval` with a `path:` artifact and current head-for-path `head` is accepted and appears as a structured Approvals-panel gate; the same record with an `issue:` artifact is quarantined; a design/architecture verdict posted as prose only (no machine record) remains Live Feed only, never inferred as a structured gate.
- Unified current-head-match tests: a `review_result`/`human_approval` naming a `pr:` artifact with a well-formed 40-character `head` that is not the referenced Pull Request's current head at authoring is quarantined; an equivalent `path:`-artifact record whose `head` is not the artifact's current head-for-path at authoring is likewise quarantined; neither record later becomes effective if the artifact subsequently reaches that SHA (validity is fixed at authoring, not re-evaluated); a record whose `head` does match its artifact's current head at authoring is accepted for either form, and stops being effective the moment that artifact's current head changes.
- Handoff-target validation test: a Worker principal not registered to declare a given Worker-class identity can still author a valid `handoff` naming that identity as the next worker (ordinary cross-worker handoff succeeds); the same principal authoring a `start_task` that self-declares an identity outside its own declarable set is quarantined; and no combination of a valid `handoff` grant and the declarable-identity rule lets one principal gain `start_task` authority over an unowned card under another identity.
- Artifact-scoped gate-effectiveness tests: a card with an effective `path:`-artifact `review_result`/`human_approval` and a later, different, `pr:`-artifact `review_result`/`human_approval` shows both as independently effective; a later record naming the same artifact correctly supersedes the earlier one for that artifact only; a record naming a different artifact is proven not to supersede, hide, or quarantine the effective record of another artifact on the same card.
- Path-gate current-head tracking tests: sync resolves and refreshes a `path:` artifact's current head-for-path to the owning repository's default-branch commit that most recently changed the file; an effective `path:`-artifact gate record stops being effective the moment a new commit changes that file, without any new record being posted; an unresolvable path or repository leaves the gate quarantined under the existing unresolvable-artifact rule rather than silently treated as still current.
- `ReviewResult` outcome tests: `review_result` records carrying `approved`, `approved_with_conditions`, and `rejected` are each accepted and distinguishable for both `pr:` and `path:` artifacts; a `revisions_required` or any other non-member value is quarantined; `human_approval`'s `result` remains `null`-only and is unaffected by this widening.
- Worker-role-pairing tests (`start_task`/`handoff`): a `start_task`/`handoff` naming a role present in the closed `RoleSlug` registry but absent from the named worker's principal-registry role allowlist is quarantined; the same role, worker, and record accepted when the pairing is allowlisted; this rule is proven independent of the existing `kanban_update`/`completion` worker-role pairing rule (a change to one allowlist does not affect the other record types' validation).
- Worker/role-pairing-scope test: proves the `kanban_update`/`completion` worker/role pairing rule quarantines only those two record types on a mismatch, while a valid `start_task`, `handoff`, and `review_result` record with a role that would not satisfy the `kanban_update`/`completion` pairing rule is still accepted per its own matrix row.
- Credential-redaction-coverage test: a simulated sync or auth failure that would normally populate an operational audit record or diagnostic output is asserted to contain no PAT value, `Authorization` header, or other credential material in that record.
- Assignment-target-principal test: a `start_task`/`handoff` naming `human` or `chatgpt-reviewer` as the assigned worker is quarantined regardless of correct authorship, and a valid Worker-class identity (`codex`/`claude`/`cursor`/`openclaw`) is accepted.

## Revisit Triggers

Revise this ADR before any of the following:

- Mission Control writes to GitHub or local repositories/processes.
- Project authority moves away from GitHub Project #4 or becomes organization-owned.
- Credentials require a scope beyond exactly `read:project`.
- Polling/manual-refresh initiation changes or webhooks/remote deployment introduce an inbound trust boundary.
- Projection-store outage returns anything other than an explicit unavailable state.
- Containers receive direct repository, worktree, or OpenClaw runtime mounts.
- `ai-workflow-record:v1` changes fields, types, authority, ordering, supersession, or exact-head semantics.
- Principal trust classes overlap, credential custody changes, or an agent gains a Human/reviewer credential.
- A persisted source type, canonical source ID rule, or completeness partition changes.
- Projection records become behavior/decision input for an agent rather than operator observation.
- The adopted OpenClaw upstream commit changes.
- A `RepoQualifier` value is added, or a `RepoQualifier` is enabled without its own passing startup probe set.
- `start_task` supersession authorization changes, or an assignment transfer path other than `handoff`/Human-approver `start_task` is introduced.
- A completeness/tombstone partition drops its owning-repository component, or a new cross-repository-collidable source type is added without one.
- The canonical `RoleSlug` registry's derivation rule changes, or a role is accepted without a matching file under `ai-studio/roles/` (other than the reserved `human-owner` entry).
- A projected source type is read without a corresponding D5 startup probe for every enabled `RepoQualifier`.
- The `human-owner` slug's legal worker/type pairings (`human_approval`; `kanban_update`/`completion` when `worker` is `human`) change, or `start_task`, `handoff`, or `review_result` is made to accept it.
- The `kanban_update`/`completion` worker-role pairing rule changes, or either type is made to accept a `role` that matches neither `human-owner` (for `worker = human`) nor the card's effective assignment record's role (for the effective Worker identity).
- `github_issue_comment`'s canonical-parent resolution rule changes, or a comment is ever partitioned under more than one parent identity.
- The manual-refresh endpoint gains any capability beyond re-invoking the existing read-only outbound sync path, or a second write/action-route exception is introduced.
- The `path:` non-PR gate form for `review_result`/`human_approval` is removed, or either type is made to accept an `issue:` artifact.
- The unified current-head-at-authoring rule for `review_result`/`human_approval` — applying identically in kind to `pr:` and `path:` artifacts via their respective current-head sources — changes, either artifact form is made exempt from it, or a record's validity is ever re-evaluated against a later current head than the one observed at authoring.
- `github_pull_request_review_comment` is merged into another source type, dropped from probing, or partitioned other than under its parent Pull Request.
- `handoff`'s target-validation rule is ever merged back into the authoring principal's declarable-identity allowlist.
- The `kanban_update`/`completion` worker/role pairing scope is widened to affect `start_task`, `handoff`, or `review_result`.
- The GitHub credential's redaction coverage narrows, or credential material is found in operational audit records or diagnostic output.
- `WorkerId`'s Worker-class subset changes, or `human`/`chatgpt-reviewer` is ever made a valid `start_task`/`handoff` assignment target.
- The D1 fork's visibility changes from public, or public visibility becomes unacceptable and a different credential model is needed.
- Local-auth redaction coverage changes, or local-auth material is found in logs, audits, diagnostics, quarantine, API output, or persisted state.
- Authoritative workflow-record binding expands beyond Issues in `Mhaizza/ai-space-colony-sim` linked to Project #4.
- `review_result`/`human_approval` effectiveness precedence is scoped to anything other than (card, type, artifact reference), or a record for one artifact is ever allowed to supersede or hide the effective record of a different artifact on the same card.
- D3's current head-for-path tracking is removed, changed to a source other than the owning repository's default-branch most-recent-change commit for that path, or a `path:` gate is made effective without a current head-for-path comparison.
- `ReviewResult`'s member set changes from `approved` | `approved_with_conditions` | `rejected`, or `pr:` and `path:` gates are ever given different outcome vocabularies.
- The `start_task`/`handoff` worker-role pairing rule (against the principal registry's per-worker role allowlist) changes, is merged with the `kanban_update`/`completion` worker-role pairing rule, or either record type is made to accept a registry-valid role without checking that allowlist.

## Decision Log

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| Standalone fork pinned to exact upstream SHA | Isolates tooling lifecycle and makes adoption reproducible | Embed in simulation repo; floating upstream |
| GitHub sole authority; projection/audit only | Prevents split-brain work and keeps current projection rebuildable | Mission Control task authority; bidirectional MVP |
| Projection rebuildable; audit non-authoritative and not reconstructable | Distinguishes current derived state from local historical evidence | Claiming reconstructed audit history after cache loss |
| Closed source types, canonical IDs, partition-scoped validate-never-infer reconciliation | Makes sync idempotent, rebuild-stable, and partial failure safe | Display/path identity; heuristic repair; deletion on failed/partial reads |
| Polling/manual refresh only; bounded rate-limit backoff | Keeps the local MVP outbound-only and failure-safe | Inbound webhooks; busy retry; inferred completeness on failure |
| Exhaustive `ai-workflow-record:v1` schema/matrix, latest-valid-unsuperseded precedence, and disjoint Worker/Reviewer/Human trust classes | Deterministic, source-linked assignment and non-forgeable gates | Delegated payload shape; parsing prose; incomplete precedence; inferring actor from payload; shared cross-class credential |
| Repository-qualified `pr:`/`issue:` artifacts (`self` \| `mission-control`, tied to D1's fork identity) | D1 puts implementation in a sibling repository; an unqualified PR number cannot bind an exact-head gate to the correct repository | Unqualified artifact numbers; constraining every artifact to one repository (would make Slice 1's fork-bootstrap PR ungatable) |
| Startup probes required per configured `RepoQualifier`; an unprobed qualifier is disabled | Accepting `mission-control` artifacts without proving read access to that repository would quarantine/stale real gates instead of failing closed | Probing only the singular target repository; treating an unmapped/unprobed sibling repo as eventually-consistent rather than disabled |
| `start_task` may supersede an existing effective assignment only when authored by the Human approver; worker-to-worker transfer requires `handoff` | A Worker principal taking over another worker's active card via `start_task` bypasses the one-owner/handoff boundary the projection exists to enforce | Letting any registered Worker principal's `start_task` supersede an existing assignment |
| Duplicate JSON object member names are rejected before normal parsing | Default duplicate-key parsing behavior is parser-dependent and would let two readers of the same record disagree on gate-authority facts | Relying on the runtime's default last-value-wins/first-value-wins JSON parsing |
| `github_issue`/`github_pull_request` partitions use the owning repository node ID, not a fixed `self` repository | A `mission-control`-qualified issue has no complete partition to sync against if the partition is fixed to `ai-space-colony-sim` | Fixing every GitHub-entity partition to the singular target repository |
| CI-derived partitions (`github_check_suite`, `github_check_run`, `github_workflow_run`, `github_commit_status`) include the owning repository node ID | Commit OIDs and check-suite IDs are not unique across repositories; a fork can share a commit SHA with upstream, risking cross-repository tombstone/merge | Partitioning CI records by commit OID/check-suite ID alone |
| `path:` artifacts are repository-qualified (`path:<RepoQualifier>#<path>`) with the same mapping/probe gating as `pr:`/`issue:` | An unqualified path is ambiguous once a sibling repository exists; a `mission-control` path (e.g. `UPSTREAM.md`) must resolve unambiguously | Leaving `path:` unqualified while qualifying `pr:`/`issue:` |
| Closed canonical `RoleSlug` registry derived from `ai-studio/roles/**/*.md`, with an explicit initial slug set and a generated manifest as the workflow-compatibility prerequisite's output | Without a pinned registry, templates/principal-config/parser can independently choose slugs and cause inconsistent authorization | Leaving `RoleSlug` as an informal reference to "the governed role registry" with no canonical manifest |
| D5 startup probes cover Pull Request reviews for every enabled `RepoQualifier` | D3 lists `github_pull_request_review` as a projected source; omitting its probe lets the backend start healthy while silently unable to serve review state | Probing issues/PRs/comments/Actions/statuses/checks but not reviews |
| Reserved `human-owner` `RoleSlug`, legal only where `worker` is `human` | The file-derived registry has no Human-owner slug; leaving the row as informal prose lets implementers quarantine every Human approval or misuse an unrelated slug | Leaving "Human-owner role" undefined; reusing an existing role file's slug (e.g. `technical-director`) to mean Human approval |
| D1 fork visibility is pinned public | D5's credential has no repository scope and depends on public read endpoints; a private fork would permanently disable every `mission-control` artifact | Leaving visibility unspecified/implementation freedom; silently adding repository scope to the credential to support a private fork |
| `kanban_update`/`completion` require `role` exactly `human-owner` when `worker` is `human`, or exactly the card's effective assignment record's role when `worker` is the effective Worker identity | Reserving `human-owner` exclusively for `human_approval` left `worker = human` on `kanban_update`/`completion` with no valid role, forcing the parser to guess or quarantining every Human-authored one of these records | Leaving "corresponding role" undefined for the Human author; reusing `human-owner` for the Worker-authored case; quarantining all Human-authored `kanban_update`/`completion` records outright |
| D7 carries an explicit local-auth token/header/cookie redaction rule, independent of D5's GitHub-credential redaction | The local-auth token must reach the browser to authenticate the UI, so D5's PAT-scoped redaction rule doesn't cover it; leaving it uncovered risks logging the bearer secret for a host-loopback-reachable UI | Assuming D5's redaction rule implicitly covers local auth |
| Authoritative workflow records require an Issue in `Mhaizza/ai-space-colony-sim` linked to Project #4; same-numbered `mission-control` Issues are Live Feed only | Issue numbers are not globally unique across repositories; without this, a sibling-repo Issue could contribute to or corrupt a `self` card's derived gates | Binding records by `card` number alone with no repository/Project #4 anchor |
| Dedicated classic PAT with exactly `read:project` | Reads user Project #4 without broad operator credentials | Operator `gh` token; write-scoped token |
| Atomic redacted host export and read-only mount | Observes local health without exposing roots or shell access | Direct mounts; loopback command API; arbitrary probes |
| Compose host-loopback publication | Local usability without LAN/database exposure | Wildcard host ports; container-loopback binding |
| Explicit unavailable state on projection-store outage | Prevents an outage from appearing as an empty workflow | Empty board; browser-local authority; in-memory replacement store |
| No write/control routes | Proves observability before consequential authority | Deferred hidden controls; write-through MVP |
| `github_issue_comment` partitioned by the parent number's single resolved Issue-or-Pull-Request identity, never per-traversal | The prior "Parent Issue or Pull Request" wording let the same comment land in two different partitions depending on discovery path, letting a complete sync of one path fail to tombstone a stale record still held under the other | Splitting into separate `sourceType`s for Issue vs. PR conversation comments (unnecessary complexity given both are `IssueComment` objects); leaving the ambiguous either/or partition |
| D8's write/action-route ban carries one explicit exception for D3's read-only manual-refresh endpoint | The blanket ban textually conflicted with D3's own required manual-refresh trigger, which is read-only and audited, not a control action | Removing manual refresh from D3; leaving the contradiction for implementers to resolve inconsistently |
| `review_result`/`human_approval` support both `pr:` (implementation Pull Request gates) and `path:` (non-PR design/architecture gates) artifacts, each with an artifact-appropriate exact-head pin; `issue:` is never valid for either | Design v0.4.0's decision log requires typed reviewer outcomes so the Approvals panel can represent non-PR review gates without parsing prose; restricting these types to PR-only (the revision-8/9 posture) left design/architecture gates — including this ADR's own review flow — unrepresentable, contradicting that requirement | Keeping the PR-only restriction and leaving non-PR gates prose-only indefinitely; adding an `issue:` non-PR form (an Issue has no fixed version to pin, unlike a `path:`'s exact commit) |
| `review_result`/`human_approval` must carry their artifact's exact current head at authoring — the referenced Pull Request's current head for `pr:`, or D3's current head-for-path for `path:` — applied identically in kind to both artifact forms; validity is fixed then, never re-satisfied or re-lapsed by a later observation | The revision-10 rule covered only `pr:` and left `path:` an exempt "fixed pin," which the revision-11 re-review found let a stale `path:` approval remain effective after the reviewed file was revised; unifying the rule under one artifact-current-head concept closes that gap without introducing a second, differently-shaped check | Re-evaluating head-match at read time instead of authoring time (would let prewritten approvals eventually satisfy the gate); leaving `path:` permanently exempt from any current-head comparison |
| `github_pull_request_review_comment` added as its own `sourceType`, partitioned under its parent Pull Request, with its own D5 startup probe | Inline PR diff comments are distinct GitHub objects from both `github_issue_comment` and `github_pull_request_review`; a sync satisfying only those two source types could never store or tombstone inline review feedback despite D2 assigning Pull Requests ownership of their comments | Folding inline comments into `github_pull_request_review`; excluding inline PR comments from product scope entirely |
| `handoff`'s next-worker target is validated as a registered Worker-class identity independently of the authoring principal's declarable-identity allowlist; `start_task`'s self-declared identity keeps using that allowlist | Reusing the author's declarable-identity allowlist for `handoff` targets would either block ordinary cross-worker handoffs or require granting one worker permission to declare another — which would also let that same grant authorize a `start_task` self-assignment of an unowned card under the declared identity | Keeping one shared declarable-identity check for both `start_task` and `handoff` |
| The `kanban_update`/`completion` worker/role pairing rule is explicitly scoped to those two record types only | Read unscoped, Invariant 5's "any other worker/role pairing is malformed" could be misapplied to quarantine valid `start_task`, `handoff`, and `review_result` records that already have their own independent role rules | Leaving the scoping implicit from surrounding context; broadening the pairing rule to cover every record type |
| GitHub PAT redaction explicitly covers operational audit records and diagnostic output, not only browser/API/projection/quarantine/logs | D2 makes audit records a first-class store; a sync/auth failure diagnostic could otherwise retain an `Authorization` value while the ADR's redaction list didn't name that surface | Leaving audit/diagnostic coverage implied rather than stated; relying on D7's separate local-auth redaction rule to also cover the unrelated GitHub PAT |
| `start_task`/`handoff` assignment targets are constrained to registered Worker-class principals; `human`/`chatgpt-reviewer` are illegal targets | The closed `WorkerId` union includes the Human and Reviewer sentinels, so an unconstrained assignment target could create an effective "owner" outside the Worker trust class that can never author a later worker-authored update | Leaving any `WorkerId` member assignable; relying on principal-registry configuration alone without a structural quarantine rule |
| `review_result`/`human_approval` effectiveness is scoped to (card, type, artifact reference), not (card, type) alone; a record for one artifact never supersedes or hides the effective record of another artifact on the same card | Card-and-type-only precedence let a later `pr:` implementation-review verdict silently replace an earlier, still-relevant `path:` design-review verdict in the Approvals panel, even though the two gates review different documents | Keeping single card-and-type precedence and accepting that only the most recent gate of a type is ever visible per card |
| D3 tracks a **current head-for-path** per referenced `path:` artifact — the owning repository's default-branch commit that most recently changed the file — refreshed at normal sync cadence, and `path:` gates are validated against it exactly as `pr:` gates are validated against a Pull Request's current head | Without a defined current-head source, a `path:` approval had no way to lapse when the reviewed file was revised, so a stale approval could remain effective indefinitely after the document changed | Requiring all non-PR review/approval gates to route through a moving `pr:` artifact instead (would force every design/architecture review through an implementation Pull Request, which does not exist at that stage) |
| `ReviewResult` widened to `approved` \| `approved_with_conditions` \| `rejected`, matching `ai-studio/workflows/architecture-workflow.md`'s reviewer-outcome vocabulary exactly, shared unmodified by `pr:` and `path:` gates | The prior two-member union could not encode "approved with conditions" at all, and `path:` gates need the same outcome expressiveness a `pr:` implementation review already implicitly has through GitHub's own review states | Leaving `ReviewResult` at two members and forcing "approved with conditions" outcomes to be recorded as prose only; giving `pr:` and `path:` gates different outcome unions |
| `start_task`/`handoff` role values are validated as worker-role pairs against the principal registry's per-worker role allowlist, independent of the `kanban_update`/`completion` worker-role pairing rule | A role being a valid member of the closed `RoleSlug` registry does not mean the specific target worker is authorized to hold it; without this pairing check a card could be assigned to a worker under a role that worker's registry entry never lists | Treating "role is in the closed registry" as sufficient validation for `start_task`/`handoff`; reusing the `kanban_update`/`completion` pairing rule (which checks against the card's effective assignment, not the principal registry) for these two record types instead |

---

## Kanban Update

**Card:** ADR-23 - Mission Control Projection and Control Boundary (#142)
**Status:** Review - ADR status Proposed; revision 11 closes all four unresolved P2 findings from the revision-10 re-review (artifact/head-scoped gate-record effectiveness, path-gate current-head tracking, widened non-PR review outcome states, and start_task/handoff worker-role-pair validation); awaiting a fresh architecture review of this exact head.
**Completed:** Revised D3/D4 after the revision-10 re-review, at the model/invariant level rather than with narrow wording patches. `review_result`/`human_approval` effectiveness precedence is now scoped to (card, type, artifact reference), not (card, type) alone, so a `path:` design-review gate and a later `pr:` implementation-review gate on the same card are each independently effective; only a record naming the identical artifact can supersede another (D4, matrix `supersedes` cells, Required Invariant 5). D3 adds a tracked current head-for-path per referenced `path:` artifact (the owning repository's default-branch commit that most recently changed the file), and D4's `pr:`/`path:` current-head-match rule is unified into one rule applied identically in kind to both artifact forms — the revision-10 "path is a fixed pin, exempt from current-head checks" language is retired, since it was the exact gap the re-review found (a stale `path:` approval could otherwise outlive a file revision). `ReviewResult` widens from two members (`approved` | `revisions_required`) to the three-member vocabulary `ai-studio/workflows/architecture-workflow.md` §5 step 6 already specifies (`approved` | `approved_with_conditions` | `rejected`), shared unmodified by `pr:` and `path:` gates. `start_task`/`handoff` role values are now validated as worker-role pairs against the principal registry's per-worker role allowlist, distinct from and independent of the existing `kanban_update`/`completion` worker-role pairing rule — the two pairing rules are explicitly cross-referenced so they are never conflated. The revision-10 Decision Log row on the `pr:`-only current-head rule was amended in place (not just appended) since the re-review directly reversed its "path: exempt" portion; four new rows were added for this revision's fixes. Required Invariants 5/6, validation requirements, and revisit triggers were updated to match. D1/D2/D5/D6/D7/D8 and the rest of D3/D4 remain unchanged from revision 10. No new deferred question or follow-up card became necessary beyond the existing workflow-compatibility prerequisite card already tracked in D4/Consequences.
**Changed Files:**
  CREATED  ai-studio/adr/0023-mission-control-projection-and-control-boundary.md
**Validation:** Traced every decision to the four revision-10 re-review findings explicitly scoped by the requester and, for the `ReviewResult` widening, to `ai-studio/workflows/architecture-workflow.md` §5 step 6's own reviewer-outcome vocabulary; confirmed no gameplay ADR is reopened; confirmed the existing OpenClaw runtime and all implementation files remain untouched. Added artifact-scoped gate-effectiveness tests, path-gate current-head tracking tests, `ReviewResult` outcome tests, and worker-role-pairing tests for `start_task`/`handoff`, alongside all tests carried from revisions 1-10 (with the prior PR-head-match test bullet folded into the new unified current-head-match test bullet).
**Follow-up Tasks:** Architecture re-review, then Human acceptance. Only after acceptance may the five implementation cards be opened in dependency order.
