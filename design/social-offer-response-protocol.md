# Design — Social Offer/Response Protocol (Stage 2 Slice 5)

**Version:** 0.1.0 (draft for ChatGPT review + Human approval)
**Phase:** Phase 3 — Stage 2 Slice 5
**Status:** Draft — awaiting ChatGPT design review and Human approval (`ai-studio/workflows/feature-workflow.md` steps 4–7)
**Author:** Claude (design task)
**Tracks:** GitHub issue #120 (parent #119)
**Authority (treated as authoritative):** ADR-18 D5 (Participation rules — offers, not commands); ADR-18 D4 (initiation conditions); ADR-18 D6 (relationship effects — Declined offers → forced-proximity friction); ADR-18 D7 (need crediting — participation credits, not opportunity); ADR-20 (Relationship Record Storage — storage/serialization precedent this design follows); `design/engineering-specification.md` v0.3.0 (Stage 2 runtime boundary, seven-phase order); `design/decision-loop.md` §2 (re-decision triggers, commitment stickiness)
**This document is NOT implementation:** no code is written here. It specifies the data shape, deterministic rules, phase placement, and validation Codex implements exactly.

**Traceability rule:** every decision below cites its authorizing source.

---

## 1. Context — the gap this closes

ADR-18 D5 requires that Conversation and Shared Downtime be **offers**: the initiator's action creates a condition the responder answers through their own weighted response, with decline as a legitimate, observable outcome. Today's implementation does not do this.

Reading the current code (`prototype/src/decision/goals.ts`, `prototype/src/task/tasks.ts`, `prototype/src/simulation/tick.ts`):

- Source 5 (voluntary, tier 5) generates a social candidate goal carrying `relatedColonistId` and `relatedSocialTaskId` directly from `rosterObservations` — every roster member currently reports a fixed placeholder ambient state of `"resting"` (interruptible), so every roster member is always initiation-eligible.
- Once that goal is committed and resolved to a task, `execution.ts`'s `beginExecution` starts immediately. There is no responder decision anywhere in the path — the "offer" always succeeds.
- `tick.ts` applies companionship Social-need restoration and relationship affinity drift (`companionshipAffinityDeltaPerTick`) unconditionally, once the task begins executing.

This is a straight-line ADR-18 D5 gap: **no offer is ever created, no response is ever computed, and decline cannot occur.** Issue #120 asks for the explicit protocol; this document specifies it, scoped to exactly Conversation and Shared Downtime — the only two Sought Companionship actions already wired end-to-end in this slice's expected files. Shared Meal stays an overlay task per ADR-18 D3 and is untouched (it is not a Sought interaction and has no offer/response step). Comfort, Assist, and Confrontation stay unreachable vocabulary per Issue #120's Out of Scope list.

---

## 2. D1 — Offer state shape

```ts
type SocialOfferAction = "conversation" | "sharedDowntime";
type SocialOfferStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

interface SocialOffer {
  readonly id: number;                    // D2 — deterministic sequence, never a UUID
  readonly initiatorId: string;           // always the primary colonist in this slice (D3)
  readonly responderId: string;           // always a roster id in this slice (D3)
  readonly action: SocialOfferAction;
  readonly createdAtTick: number;
  readonly expiresAtTick: number;         // D6 — deterministic timeout
  readonly status: SocialOfferStatus;
  readonly resolvedAtTick: number | null; // set exactly when status leaves "pending"
  readonly reason: string | null;         // set exactly when status is "declined", "cancelled", or "expired" (D6/D7)
}

interface SocialOfferStore {
  readonly offers: readonly SocialOffer[]; // bounded (D8); pending offers are never evicted
  readonly nextOfferSequence: number;
}
```

`SocialOfferStore` is a new top-level `SimulationState` field, `socialOffers`, alongside `relationships` and `roster` — the same pattern ADR-20 established for M10. This is additive: no existing field is renamed or removed.

**Why an array-of-records store, not a per-colonist field:** the issue's proposed model already frames the offer as its own addressable entity (an `id`, a status machine) rather than colonist-owned state — matching ADR-20's Option-B reasoning (D1) that one interaction between two parties belongs to one shared record, not duplicated across both. A social offer is pairwise and event-shaped like a `PairHistoryEntry`, not identity-shaped like `ColonistIdentity`; it does not belong on `ColonistState` or on a roster entry.

## 3. D2 — Deterministic id and ordering scheme

- **No wall-clock time, no random UUIDs** (Issue #120's own Determinism Constraints; `design/engineering-specification.md` §8's determinism obligations).
- `id` is `nextOfferSequence` at creation time, then `nextOfferSequence` increments by exactly 1. This is a **persisted counter**, not derived by scanning existing offers (`Math.max(...existing) + 1`) — unlike `relationships.ts`'s `nextSequence` (which is scoped to one pair's bounded history and can safely re-derive from what's still retained), offer ids must stay unique across the store's full lifetime even after old resolved offers are evicted from the bounded window (D8). A derived-max scheme would reuse an id once its highest holder is evicted. A persisted counter, incremented once per creation, cannot collide.
- **Processing order within a tick is fixed**: offers are always iterated in ascending `id` order wherever more than one is touched in the same phase (creation order is already ascending `id` order, so this is simply "iterate the array in stored order" — no live re-sort). At this slice's scale (one primary colonist, so at most one active initiator per tick) this is rarely exercised, but it is specified now so it never becomes an undocumented assumption later.

## 4. D3 — Phase placement in the seven-phase tick

Per `design/engineering-specification.md` §5 (unchanged by this design — ADR-18 D5 already scoped this as "one interruption-class nuance to the re-decision architecture... a scoping of trigger 2, not a new trigger kind"):

- **Phase 5 (Decisions — M4 + M11):** when a `voluntary` candidate goal for `conversation` or `sharedDowntime` is committed (the existing `relatedColonistId`/`relatedSocialTaskId` path in `goals.ts`), task resolution (`tasks.ts`) resolves it to the task as it does today — but **execution does not begin here**. Instead, a `SocialOffer` is created: `initiatorId` = the committing colonist, `responderId` = `goal.relatedColonistId`, `action` = `goal.relatedSocialTaskId`, `status: "pending"`, `createdAtTick` = current tick, `expiresAtTick` = current tick + the deterministic timeout (D6).
- **Phase 6 (Execution & consequences — M12):** every still-`"pending"` offer created this tick (or carried over from a prior tick, see below) is resolved in ascending `id` order:
  1. Re-check cancellation conditions (D6). If cancelled, stop — no execution begins.
  2. Compute responder eligibility (D4). If ineligible, decline with the eligibility reason — no PRNG draw is spent on an offer that was never really open.
  3. If eligible, draw acceptance (D5). Accepted → `beginExecution` runs exactly as today's `conversation`/`sharedDowntime` path (unchanged execution/consequence application in `execution.ts`/`tick.ts`). Declined → apply D6's decline consequence; no execution begins.
- **Same-tick common case:** because the responder in this slice is always an identity-only roster member with no independent decision loop (Issue #99's reconciled boundary), Phase 6 of the *same* tick that created the offer is always able to resolve it — there is nothing on the responder's side that needs another tick to "think." The offer is created `"pending"` in Phase 5 and leaves `"pending"` before Phase 6 ends, in the overwhelming majority of ticks.
- **Cross-tick persistence exists for exactly one reason:** if the initiator's own committed goal is itself preempted between Phase 5 and Phase 6 of its creating tick (a higher-tier survival/critical-need re-decision fires first — decision-loop §2 trigger 2), Phase 6 never reaches the offer this tick. The offer stays `"pending"` into the next tick's Phase 6, where it is retried, subject to D6's cancellation/timeout rules. This is what makes cancellation and timeout real, testable behavior rather than dead code.

This placement keeps the "six-trigger list stands, this is a scoping of trigger 2" framing ADR-18 D5 already committed to — no new trigger kind, no new phase, no change to §5's normative order.

## 5. D4 — Responder eligibility (ADR-18 D4.3/D4.4, snapshot facts only)

An offer is eligible for a response draw only if, at resolution time:

1. **Responder still exists in the roster.** Defensive — the roster is fixed for Stage 2 (Issue #99), but load-time or future-slice removal must not leave a dangling offer (mirrors the existing roster-reference validation `tick.ts` already applies to `relatedColonistId`).
2. **Responder's Tier-1 observable state is interruptible** (ADR-18 D4.3: Conversation/Shared Downtime seek colonists in interruptible states). This reads `ObservableColonist.ambientState` from the same snapshot machinery `nearbyColonists`/`rosterObservations` already produce — **not** a new roster-specific rule. `rosterObservations` currently hardcodes `"resting"` for every roster member; that is an existing, separately-tracked Stage 2 simplification (not introduced or changed by this design) and this protocol reads through it rather than duplicating or working around it. If a later slice makes roster ambient state real, this eligibility check needs no change.
3. **Relationship gate is non-hostile in both directions**, mirroring the existing `sharedMealPartnerId` pattern exactly (`isNonHostile` on both `perspective(relationships, initiatorId, responderId)` and `perspective(relationships, responderId, initiatorId)`): a Hostile or Fractured pair, in either direction, is never offered at all — the offer is declined immediately with reason `"relationship gate"`, and D5's PRNG draw is never spent. This matches ADR-18 D4.4's initiator-side gate and extends it to a two-sided check for the same reason `sharedMealPartnerId` already does: relationship drift is directional, and an offer must not proceed on the initiator's stale, more-favorable view.

Failing any of (1)–(3) resolves the offer to `"declined"` with a `reason` string identifying which check failed — never to `"cancelled"` (cancellation is reserved for D6's availability changes, not standing ineligibility).

## 6. D5 — Deterministic acceptance draw (ADR-18 D5, "weighted, not rule-bound")

Roster responders are identity-only (Issue #99): they carry no stress, traits, needs, or goal state to compose a full weighted decision from. The only responder-side signal this slice has is the relationship perspective already read for D4's gate. Per Issue #120's Determinism Constraint ("Any probabilistic response must use the existing seeded PRNG service with attributable draws"), acceptance is:

1. Look up `responderState = deriveRelationshipState(perspective(relationships, responderId, initiatorId).affinity)`.
2. Look up an acceptance probability for `responderState` from a new provisional `SOCIAL_OFFER_TUNING.acceptanceProbability` table in `config/tuning.ts` (values deferred — DQ-1 below), keyed over the five states an eligible offer can reach (`tense`, `acquainted`, `neutral`, `positive`, `bonded` — `hostile`/`fractured` never reach this step per D4).
3. Draw one `next(prng)` value from S1, attributed in the decision/event record as `"socialOfferResponse"` (a named draw, matching the attribution discipline `design/engineering-specification.md` §8 requires of every S1 draw). Accept if the draw is below the looked-up probability; otherwise decline with `reason: "declined"`.

This is deterministic for a given seed and state (the draw is a pure function of the PRNG stream position, which is itself fully determined by prior ticks), monotonically weighted by relationship state (satisfying D5's "weighted, not rule-bound" spirit within the data this slice actually has), and spends no PRNG draw on offers D4 already ruled out — keeping the PRNG stream identical between two runs that reach the same eligibility outcome by different paths is not a concern here, because D4 is itself a pure function of already-recorded state, not of any draw.

**Declined offers never restore Social and never apply positive relationship drift** (acceptance criterion, ADR-18 D7 — "participation credits, not opportunity"). A decline instead applies the existing `forcedProximityMutualStress` change source via `applyInteraction` (ADR-18 D6's "Declined offers → forced-proximity friction family, negative, low, context-dependent" row) — the same write path `tick.ts` already calls for accepted companionship interactions, with a low negative delta in both directions rather than the existing positive `sharedDowntimeAffinityDeltaPerTick`/`conversationSocialRestorePerTick` figures. The magnitude is a new provisional `SOCIAL_OFFER_TUNING` constant (DQ-1), not a reuse of the acceptance-path constants.

## 7. D6 — Cancellation and timeout

- **Timeout:** `expiresAtTick = createdAtTick + SOCIAL_OFFER_TUNING.offerTimeoutTicks` (provisional constant, DQ-2). At the start of Phase 6 resolution, any `"pending"` offer with `state.clock.tick >= expiresAtTick` resolves to `"expired"` with `reason: "timeout"`, before eligibility/acceptance are checked. Expiry is a deterministic clock comparison, not a PRNG draw, and never touches Social crediting or relationship affinity (same non-effect as a decline, per D7 below) — it is not itself a change source in the ADR-12 table and applies no `applyInteraction` call.
- **Initiator unavailable → cancel:** if the initiator's current committed goal no longer matches the offer (`currentGoal` is null, or its `key` no longer matches the goal that created this offer — i.e., a higher-tier trigger preempted it before Phase 6 could resolve the offer), the offer resolves to `"cancelled"` with `reason: "initiator unavailable"`. This is the mechanism D3's cross-tick carry-over needs: an offer that survives past its creating tick because the initiator's goal was preempted is cancelled the next time Phase 6 sees it, rather than resolving against a goal that no longer exists.
- **Responder unavailable → cancel:** if the responder id is no longer present in `state.roster` (defensive, per D4.1) or the responder is already the `responderId` of another currently-`"pending"` offer at resolution time (a double-booking guard — this slice's realistic traffic is at most one offer at a time since there is exactly one initiator, but the rule is specified so it is not silently assumed), the later-created offer (higher `id`) cancels with `reason: "responder unavailable"` and the earlier one proceeds through D4/D5 normally.
- Cancellation, like expiry, applies no relationship or Social-need effect — cancellation is not a decline (the responder never had the opportunity to answer) and not a change source in ADR-12's table.

## 8. D7 — Execution integration (unchanged downstream path)

Accepted offers hand off to exactly today's path: `beginExecution(task, goal, currentTick)` in `execution.ts`, then `tick.ts`'s existing companionship Social-restoration and positive-affinity-drift application, keyed on `execution.taskId` — **no change to that code's shape**, only to what gates reaching it. Declined, cancelled, and expired offers never call `beginExecution`; the goal they were attached to is abandoned (not blocked — an unaccepted offer is not "no task exists," it is "this specific attempt did not succeed," matching ADR-18 D5's "the attempt ends" framing for a decline), and `decide.ts`'s ordinary re-decision path picks the colonist's next candidate at the next natural trigger, with no special-cased retry loop introduced by this design.

## 9. D8 — Serialization and validation (ADR-20 D8 precedent)

- `socialOffers: SocialOfferStore` is added to `SimulationState`, `serialization.ts`'s save/load, and the save version is incremented (mirroring ADR-20 D8's "Stage 2 adds one top-level slice... The save version is incremented. No migration framework is required during the prototype.").
- **Bounded, deterministic retention:** pending offers are never evicted. Resolved offers (`accepted`/`declined`/`cancelled`/`expired`) beyond a bounded retention window (provisional `SOCIAL_OFFER_TUNING.resolvedOfferRetention`, DQ-3 — same FIFO-by-append-order eviction shape as `relationships.ts`'s `boundHistory`) are evicted oldest-first. `nextOfferSequence` is never rolled back by eviction (D2).
- **Load rejects** (same enumerated-rejection discipline as ADR-20 D8 — never silently repaired):
  - duplicate offer ids;
  - `initiatorId` or `responderId` referencing an unknown colonist (not the primary colonist id and not a roster id) — reuses the existing roster-reference validation `tick.ts` already applies to `relatedColonistId`;
  - `initiatorId === responderId` (self-offer is invalid, same discipline as `canonicalPairId`'s self-pair rejection);
  - `status: "pending"` with a non-null `resolvedAtTick`, or any non-`"pending"` status with a null `resolvedAtTick`;
  - any non-`"pending"` status other than `"pending"` with a null `reason`;
  - `expiresAtTick <= createdAtTick`, or `resolvedAtTick` present and less than `createdAtTick`;
  - an offer id greater than or equal to the stored `nextOfferSequence` (the counter must always exceed every id it produced).

## 10. D9 — Replay and inspector integration

- **Replay:** add `"socialOffers"` to `replay.ts`'s `STATE_FIELDS` array. No other change to `replay.ts` is needed — `firstStateDivergence` already diffs any field in that list generically, field-by-field in the same fixed, alphabetically-sorted order every other field uses, and reports the first divergence with a dotted path exactly as it does today for `relationships`/`roster`. This satisfies the acceptance criterion "Replay compares offer/response state and reports the first divergence" with zero new replay logic.
- **Inspector:** add `readonly socialOffers: readonly SocialOffer[]` to `InspectionSummary`, populated as `detach(state.socialOffers.offers)` in `inspect()` — the same one-line `detach()` pattern already used for `roster`, `execution`, and every other field, satisfying "Inspector returns detached offer/response values" with no new detachment logic (`SocialOffer` is already plain JSON-safe data, so the existing `JSON.parse(JSON.stringify(...))` detach implementation covers it without modification).

## 11. Architecture Review Determination

`ai-studio/workflows/kanban-update-protocol.md`'s Architecture Review Required table lists Data model, Save format, and Serialization as ADR triggers. This design proposes exactly those: a new `SimulationState` field, a save version bump, new load-rejection rules. The same table governed ADR-20's AQ-2 work.

**Determination: this is implementation scope under ADR-18, not a new open architecture question, and does not require a new ADR** — for the same reason `roster` (Stage 2 Slice 2) and `relationshipAffinityBaselines` (Stage 2 build step 8) were added to `SimulationState`/`STATE_FIELDS` without a dedicated ADR after ADR-20 settled M10's storage model: ADR-18 D5 already decided the *architecture* of offers (pairwise, offer-not-command, explicit accept/decline, interruption-class trigger scoping, forced-proximity-friction decline consequence) at the conceptual-architecture level; ADR-20 already decided the *storage precedent* (a new bounded top-level state slice, sparse where possible, save-version-bumped, validated-not-repaired on load) for exactly this kind of addition. This document supplies the concrete shape filling an already-decided architectural slot — the same relationship ADR-20's own action items describe as "implementation of M10" following ADR-20's acceptance. No accepted decision (ADR-01, ADR-05, ADR-12, ADR-18, ADR-20, or a locked freeze decision) is reopened, reinterpreted, or contradicted by D1–D9 above.

This determination is offered for confirmation, not self-approved: per `kanban-update-protocol.md`'s Review Handoff Rules, only ChatGPT Review + Human Approval can authorize implementation to proceed, and this document does not proceed to Codex without that gate.

## 12. Out of scope (Issue #120, restated and held to)

- Independent full simulation state for roster colonists — a roster responder's eligibility and acceptance (D4/D5) draw only on identity, snapshot-observable ambient state, and the existing relationship store; no needs/stress/traits/goal state is added to roster entries by this design.
- Comfort, Assist, Confrontation, `In Conflict` state — the offer/response protocol here is reachable only from `conversation`/`sharedDowntime`'s existing `relatedSocialTaskId` union; extending it to another `SocialTaskId` is explicitly a future slice's decision, not an automatic consequence of this shape.
- Stage 3 scaling, product UI.

## 13. Options Considered

| Option | Summary | Rejected because |
|---|---|---|
| Offer state embedded on the initiator's `ColonistState` (a `pendingOffer` field) | Simpler top-level shape — no new store | An offer is a fact about two colonists, not one; embedding it on the initiator alone is the same "colonist-owned duplicate" problem ADR-20 D1 already rejected for relationships, and it has no natural home on a roster entry (identity-only) for the responder side |
| Resolve offers purely synchronously within the same Phase 5→6 span, no `"pending"` status, no timeout/cancellation | Fewer states, less code | Cannot satisfy the acceptance criteria for timeout and cancellation, and forecloses the protocol working once roster colonists gain real per-tick state (a later slice, explicitly not this one, but the shape should not have to be redesigned to reach it) |
| Full ADR-18 D5 weighted composition (stress, traits, memory) for responder acceptance | Most faithful to D5's "weighted, not rule-bound" language | Requires roster colonists to carry stress/trait/memory state, which Issue #99's reconciled Stage 2 boundary and Issue #120's Out of Scope explicitly exclude from this slice; relationship-state-modulated PRNG draw is the largest faithful subset of D5 available without that state |
| UUID or `${tick}-${initiatorId}-${responderId}` string ids | Human-legible, no persisted counter | UUIDs violate the explicit determinism constraint; a composite string key collides if the same pair gets two offers in the same tick (not possible in this slice's traffic, but the id scheme should not rely on that being permanently true), and neither survives eviction of the record it was derived from the way a persisted counter does |

## 14. Deferred Questions

| # | Question | Owner |
|---|---|---|
| DQ-1 | `SOCIAL_OFFER_TUNING.acceptanceProbability` values per relationship state, and the decline friction magnitude | Prototype calibration (same discipline as ADR-18 DQ-18.1) |
| DQ-2 | `SOCIAL_OFFER_TUNING.offerTimeoutTicks` | Prototype calibration (same discipline as ADR-18 DQ-18.2 — offer/response pacing) |
| DQ-3 | `SOCIAL_OFFER_TUNING.resolvedOfferRetention` (bounded history window) | Prototype calibration, mirroring `RELATIONSHIP_TUNING.historyBound`'s existing provisional value |

## 15. Decision Log

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| New top-level `socialOffers: SocialOfferStore`, persisted `nextOfferSequence` counter | Matches ADR-20's storage precedent; a persisted counter survives eviction of the offers it numbered, unlike a derived max | Colonist-embedded offer field; UUID/composite-string ids |
| Offer created in Phase 5 (goal commit), resolved in Phase 6 (execution), same tick in the common case | Preserves the unchanged seven-phase order (`design/engineering-specification.md` §5); matches ADR-18 D5's "scoping of trigger 2, not a new trigger kind" | A dedicated new phase or trigger kind (reopens the frozen phase order without cause) |
| Responder eligibility from snapshot `ambientState` + two-directional relationship gate, no new roster state | Stays inside Issue #99's identity-only roster boundary and Issue #120's Out of Scope | Full per-colonist state for roster responders (out of scope by both issues) |
| Acceptance via attributed S1 draw modulated by relationship state only | Largest faithful subset of ADR-18 D5's "weighted, not rule-bound" available without roster colonists carrying stress/traits/memory | Full weighted composition (needs unavailable roster state); rule-bound accept/reject (violates D5's "not rule-bound" language) |
| Declines apply `forcedProximityMutualStress` via the existing `applyInteraction` path; timeout/cancellation apply no relationship or Social effect | Matches ADR-18 D6's decline row exactly; timeout/cancellation are not a change source in ADR-12's table, so they must not silently become one | Treating timeout/cancellation as declines (would apply an unauthorized new implicit change-source use) |
| No new ADR; determination recorded for review rather than assumed | Matches the `roster`/`relationshipAffinityBaselines` precedent of implementation-scope additions after ADR-18/ADR-20 already settled the relevant architecture questions | Silent no-ADR decision (unreviewable); reflexive new-ADR request (reopens already-settled ADR-18/ADR-20 questions without a real contradiction) |

---

## 16. Kanban Update

**Card:** [Phase 3] Stage 2 Slice 5 — Social Offer/Response Protocol
**Status:** Review — design artifact complete, awaiting ChatGPT design review and Human approval per `feature-workflow.md` steps 4–7. Codex does not implement until Human approval is posted to Issue #120.
**Completed:** Produced `design/social-offer-response-protocol.md` — offer state shape (D1), deterministic id/ordering scheme (D2), phase placement in the unchanged seven-phase tick (D3), responder eligibility from snapshot facts only (D4), deterministic PRNG-attributed acceptance modulated by relationship state (D5), cancellation/timeout rules (D6), unchanged downstream execution integration (D7), serialization/save-version/load-validation rules following ADR-20's precedent (D8), replay/inspector integration via existing generic mechanisms (D9), and an explicit Architecture Review Determination that no new ADR is required, offered for review rather than self-decided.
**Changed Files:**
  CREATED  design/social-offer-response-protocol.md
**Validation:** Grounded against the current implementation directly — read `prototype/src/decision/goals.ts`, `task/tasks.ts`, `task/execution.ts`, `simulation/tick.ts`, `colonist/relationships.ts`, `core/serialization.ts` (conventions), `replay/replay.ts`, `inspection/inspector.ts` — every mechanism this design proposes (STATE_FIELDS addition, `detach()` reuse, `applyInteraction`/`isNonHostile` reuse, `nextSequence`-style vs. persisted-counter id reasoning) is checked against what those modules already do, not assumed. Cross-checked against ADR-18 D4–D7, ADR-20 D1/D5/D7/D8, and `design/engineering-specification.md` v0.3.0's Stage 2 runtime boundary and seven-phase order for contradiction — none found.
**Risks:** The acceptance-probability and decline-friction magnitudes (DQ-1) are provisional by design (prototype calibration territory, consistent with every other ADR-18/ADR-20 magnitude); if the reviewer wants the full ADR-18 D5 weighted composition now rather than the relationship-only subset, that requires either scope-expanding roster colonists' state (explicitly out of scope for this slice) or a documented exception — flagged here rather than decided unilaterally.
**Follow-up Tasks:** None identified beyond what Issue #120 already tracks. If ChatGPT review or Human approval identifies a genuine architecture contradiction (not currently found), that becomes a new ADR discussion, not a revision to this document's Architecture Review Determination.

**Not committed** per instruction — this is a design artifact only; no code in `prototype/src` is created or modified by this task.
