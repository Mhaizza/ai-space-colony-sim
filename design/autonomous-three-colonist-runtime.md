# Design — Autonomous Three-Colonist Runtime Migration (Stage 2 Slice 6, EQ-1)

**Version:** 0.1.0 (draft for ChatGPT review + Human approval)
**Phase:** Phase 3 — Stage 2 Slice 6
**Status:** Draft — awaiting ChatGPT design review and Human approval (`ai-studio/workflows/feature-workflow.md` steps 4–7)
**Author:** Claude (design task)
**Tracks:** GitHub issue #128
**Authority (treated as authoritative):** `design/engineering-specification.md` v0.3.0 (EQ-1's migration definition, EQ-2's ordering discipline, EQ-3's open PRNG question, §5's seven-phase order, §8's determinism obligations, and the reconciled Stage 2 runtime boundary); ADR-20 (M10 storage — unchanged); ADR-21 (offer storage — unchanged); ADR-18 (social architecture — unchanged); `design/social-offer-response-protocol.md` v0.2.0 (the protocol this migration must preserve); `ai-studio/constitution/architecture-philosophy.md`
**This document is NOT implementation:** no code. It specifies the state shape, ordering rules, snapshot discipline, PRNG decision, and persistence surfaces Codex implements exactly — after this design is approved AND the §9 ADR gate is satisfied.

**Traceability rule:** every decision cites its authorizing source.

---

## 1. Context — the gap this closes

The reconciled engineering specification (Issue #99) records the current Stage 2 boundary: **one fully simulated colonist plus an identity-only roster**. EQ-1 names the migration to the full Stage 2 target — three independently simulated colonists — as an implementation expansion under the accepted architecture: "broadening the singular `colonist` / `execution` / baseline slots into a stable, canonically ordered collection of per-colonist state, then running phases 3, 5, and 6 across that collection without changing §5's seven-phase semantics."

Reading the current implementation (`prototype/src/simulation/tick.ts`, `run.ts`, `core/serialization.ts`, `replay/replay.ts`, `inspection/inspector.ts`):

- `SimulationState` holds exactly one `colonist: ColonistState`, one `execution`, one `suspendedExecution`, and one set of memory-formation baselines (`deprivationBaselines`, `stressBaseline`, `relationshipAffinityBaselines`).
- Other colonists exist only as `roster: readonly ColonistIdentity[]`, and `rosterObservations` hardcodes every roster member's ambient state to `"resting"` — a documented placeholder this design retires.
- The relationship store (M10, ADR-20) and offer store (M12, ADR-21) are already centralized, multi-colonist-shaped, and need **no structural change** — they were designed for exactly this migration.

## 2. D1 — State shape: one canonically ordered collection of per-colonist runtime containers

`SimulationState`'s five singular per-colonist slots are replaced by one collection:

```text
SimulationState.colonists: readonly ColonistRuntime[]   // canonically ordered by colonist id

ColonistRuntime {
  colonist: ColonistState                    // identity, needs, stress, memory, goals — unchanged shape
  execution: Execution | null
  suspendedExecution: Execution | null
  deprivationBaselines: Record<NeedId, number>
  stressBaseline: number
  relationshipAffinityBaselines: Record<string, number>
}
```

- **Everything per-colonist moves inside the container; nothing else does.** Clock, world, policy, PRNG, event/decision logs, `relationships` (M10), and `socialOffers` (M12) remain top-level singletons — their ownership does not change (ADR-20 Invariant 1; ADR-21 D1).
- **The `roster` field is retired.** Identity lives in each `ColonistRuntime.colonist.identity`; there is no second colonist list to drift from the first. The collection admits any size from 1 (today's boundary, used by the migration's behavior-identical first step — §10) through 3 (this slice's target). Stage 3's 8 is out of scope but requires no shape change.
- **Ordering is structural:** `colonists` is sorted by the same documented ordinal string comparison used everywhere (ADR-20 D5, EQ-2); serialization preserves it; load rejects an out-of-order or duplicate-id collection (§7). "First entry" carries no special status — there is no primary colonist anymore.
- Existing per-colonist invariants (the suspended-pair rule, the offer-backed suspension exception from Slice 5, goal/execution key agreement) apply **per container**, unchanged in content, validated per entry.

## 3. D2 — Phase realization: the seven-phase order runs each per-colonist phase across the collection

§5's seven-phase order is unchanged in effect. Each per-colonist phase iterates the collection in canonical order, completing that phase for all colonists before the next phase begins:

1. **Time advance** — once (shared clock).
2. **World evolution** — once (still a Stage-2 no-op beyond execution consequences).
3. **Colonist continuous state** — for each colonist in canonical order: need decay, stress, then M10 atrophy once for the whole store in canonical pair order (as today).
4. **Condition & trigger detection** — for each colonist in canonical order: threshold crossings, completion/blockage, interruption/suspension-resolution checks — each computed from that colonist's own container plus shared state.
5. **Decisions** — for each *triggered* colonist in canonical order: snapshot, decide, commit (per D3's snapshot discipline). Social commits create offers exactly per the Slice 5 design; nothing about offer creation changes except that any colonist can now be an initiator.
6. **Execution & consequences** — the offer lifecycle pass first (ascending offer id, unchanged from Slice 5), then each colonist's execution progress and consequence fan-out in canonical order over live shared state.
7. **Records** — once; events across colonists within one tick are appended in the order produced, which is deterministic because every loop above is.

**Phase-boundary rule (binding):** a later phase never runs for any colonist before an earlier phase has completed for every colonist. This is what makes "phase inputs" well-defined in D3.

## 4. D3 — Snapshot discipline: same-tick non-observability by construction

The named migration risk (engineering spec §12) is a later colonist in phase 5 or 6 observing an earlier colonist's same-step decision through live state. The rule that prevents it:

- **One observation basis per tick.** Before phase 5 begins, the tick computes a single Tier-1 observation set: every colonist's `ObservableColonist { id, ambientState }`, derived by the existing `ambientStateFor(execution, stress)` read from each container **as of the end of phase 4** — after continuous state and trigger detection, before any phase-5 decision. This retires the `"resting"` placeholder: ambient states are now real, derived from actual execution/stress state by the same function the inspector already uses (locked #21: one registry serves both).
- **Every deciding colonist's snapshot is built from that same basis.** Colonist B's snapshot is identical whether B decides before or after A in the canonical order; A's phase-5 commitment is not in it. Snapshots remain fixed plain values (M4's copy-at-build rule, unchanged).
- **`nearbyColonists` = all other colonists' observations.** Stage 2's minimal station has no spatial model; "nearby" is everyone else, as it already is for the single colonist. Spatial bounding is a later, separately-owned concern (locked #22's spatial bounds are honored vacuously, as today).
- **Phase 6 applies consequences sequentially over live shared state in canonical order.** This is sanctioned: §5's non-observability rule governs *decisions* (phase 5 reads), not consequence application — one colonist eating before another in the same tick contends for food stock deterministically, exactly as the world already behaves across ticks. What phase 6 must never do is feed back into any same-tick phase-5 input, and it cannot: all decisions completed before phase 6 began (D2's phase-boundary rule).
- **Regression tests must pin this** (spec §12's mitigation): a test where reordering two colonists' ids changes nothing about a third's decision inputs; a test that colonist A's same-tick commitment is absent from B's snapshot; replay verification over multi-colonist runs.

## 5. D4 — EQ-3 decision: one shared PRNG stream, fixed draw order, attributed draws

**Decision: keep the single mulberry32 stream** (`SimulationState.prng`), with draw order fixed by the same canonical iteration that fixes everything else, and every draw attributed (purpose + colonist id) in the decision/event records as today.

**Why (over per-colonist streams):**

- Determinism needs *an* order, not stream isolation. Every draw site already executes in a fixed, documented order (D2/D3); given that, one stream reproduces bit-identically — replay verifies it for free through the existing `prng` field.
- Zero save-format or replay change: `PrngState { a, draws }` stays exactly as serialized today. Per-colonist streams would multiply save/validation/replay surfaces for no Stage 2 benefit.
- S1 stays one choke point (engineering spec §14's named trade) — one place to attribute, one place to audit.
- The known cost is accepted and named: **stream alignment is global.** Adding or removing a colonist mid-run shifts every subsequent draw, so cross-run comparisons are only valid between runs with identical colonist sets. This is irrelevant during the prototype (colonists are seeded at creation; ADR-19 arrival is explicitly out of scope) and is the documented revisit trigger: **re-open EQ-3 if ADR-19 lands mid-run colonist arrival.**

Per EQ-3's own requirement ("must be documented and stable"), this decision is recorded in the §9 ADR so it carries an accepted record, not just design prose.

## 6. D5 — Social protocol integration: unchanged rules, real participants

`design/social-offer-response-protocol.md` v0.2.0 continues to govern; this migration changes only who can play each role:

- Any colonist can initiate (phase-5 commit → pending offer) and any colonist can respond. Responder eligibility (D4 of that design) now reads *real* ambient states through the same snapshot basis — the "reads through the placeholder" note in that design resolves itself with no rule change, exactly as it anticipated.
- The pending-per-responder guard and double-booking cancellation (that design's D6) become genuinely reachable with multiple initiators; their already-specified ascending-id resolution is sufficient and unchanged.
- A responder who is *also* a fully simulated colonist keeps their own independent decision loop; accepting an offer does **not** commit the responder to a goal in this slice — acceptance still gates only the initiator's execution, per the approved protocol. Mutual-participation execution (the responder visibly joining) is presentation/`ambientState` texture already covered by the accepted protocol's D7, not new architecture. If review judges responder-side goal commitment necessary now, that is a scope decision for the Human gate, flagged here rather than silently added.
- Offer/relationship stores already validate against "known colonist ids"; that set becomes the collection's ids (§7).

## 7. D6 — Save/load, replay, inspector

- **Save format bumps to v5.** The five singular per-colonist fields are replaced by one `colonists` array serialized in canonical order. No migration framework (ADR-20 D8 posture); v4 saves are rejected by version, as every prior bump.
- **Load validates, never repairs** (per the established discipline): non-empty collection; unique, safe, canonically ordered colonist ids; per-container cross-field invariants (suspended pair, offer-backed suspension exception, goal/execution agreement) applied per entry; `relationships` and `socialOffers` validated against the collection's id set; every existing per-field rule carried over unchanged.
- **Replay:** `STATE_FIELDS` replaces `colonist`, `execution`, `suspendedExecution`, `deprivationBaselines`, `stressBaseline`, `relationshipAffinityBaselines`, and `roster` with the single `colonists` entry — diffed generically, divergences pathed as `colonists[i].…`. `prng`, `relationships`, `socialOffers`, and the logs are unchanged entries.
- **Inspector:** `inspect` gains a per-colonist summary list (needs/stress/ambient/goals/execution per container, detached as always); shared surfaces (relationships pair views, offers, logs, replay summary) are unchanged. Exact summary shape is implementation freedom under the existing detachment rule.

## 8. Out of scope (Issue #128, restated and held to)

- Comfort, Assist, Confrontation, `In Conflict` — vocabulary-only, untouched.
- Stage 3 scale (8 colonists), colony texture (ADR-08), spatial modeling.
- ADR-19 colonist arrival — colonists are seeded at creation only.
- Responder-side goal commitment on offer acceptance (flagged in D5 for the Human gate).
- UI/presentation beyond the existing inspector surfaces.

## 9. Architecture Review Gate — ADR-22 required (planned, not discovered)

This design's D1 and D6 are squarely on `kanban-update-protocol.md`'s Architecture Review Required surface: **Data model** (restructuring `SimulationState`'s per-colonist slots into a collection), **Save format** (v5), and **Serialization** (new validation rules, replay field change). Per the precedent set by ADR-21 on Slice 5 — where this gate was initially missed and corrected in review — it is planned from the start here:

1. After ChatGPT review and Human approval of this document, a candidate **ADR-22 — "Per-Colonist Runtime Collection"** is written from D1, D4, and D6 specifically: the `ColonistRuntime` container shape, canonical collection ordering, the retirement of `roster`, the EQ-3 single-stream decision (recorded per its "documented and stable" requirement), the save-version bump, the load-rejection list, and the replay `STATE_FIELDS` change.
2. ADR-22 goes through the architecture workflow with explicit Human acceptance, as ADR-20 and ADR-21 did.
3. **No implementation touches `SimulationState`, `serialization.ts`, or `STATE_FIELDS` until ADR-22 is Accepted.** Phase-realization rules (D2/D3) and protocol integration (D5) instantiate the already-accepted seven-phase architecture and Slice 5 design; they are governed by this document, not the ADR.

No accepted decision (ADR-01–ADR-21, the freeze's locked set) is reopened, reinterpreted, or contradicted by D1–D6 — for the reviewer to confirm, not assume.

## 10. Implementation staging (informational — for the post-ADR hand-off)

Three sub-slices, each independently reviewable and replay-verified:

- **6a — shape migration, behavior-identical:** collection of size 1, save v5, replay/inspector rewired. Acceptance: every existing test passes with only fixture-shape changes; a fixed-seed run produces the identical event/decision trace as pre-migration.
- **6b — promotion to three simulated colonists:** phases 3–6 loop the collection; real ambient observations; non-observability regression tests.
- **6c — social protocol at three:** offers with real initiators/responders on all sides; the previously unreachable guards exercised.

## 11. Options Considered

| Option | Summary | Rejected because |
|---|---|---|
| Keep `roster` alongside a simulated-colonist collection | Smaller diff | Two lists describing colonists, one authoritative for identity and one for simulation — the drift-by-synchronization shape architecture-philosophy forbids; roster's only purpose (known ids for pairs) is served by the collection |
| Primary colonist + secondary collection | Preserves current field names | A structurally privileged "first colonist" the architecture never defined; every consumer needs two code paths; ordering bias becomes easy to reintroduce |
| Per-colonist PRNG streams (EQ-3 alternative) | Stream isolation; colonist-set changes don't shift other colonists' draws | Multiplies save/validation/replay surfaces now, for a benefit (mid-run arrival stability) that is out of scope until ADR-19; canonical draw order already delivers determinism; revisit trigger documented in D4 |
| Deferred/staged consequence application in phase 6 (buffer all, apply at once) | Symmetric-looking | §5 already sanctions sequential application (non-observability governs decisions, not consequences); buffering adds a merge/conflict policy the architecture never asked for — speculative complexity |
| Per-colonist snapshots built mid-phase-5 (each decider sees earlier deciders' commitments) | Arguably "fresher" | Directly violates locked #4/#23 and the spec's same-tick rule — this is the exact leak D3 exists to prevent |

## 12. Deferred Questions

| # | Question | Owner |
|---|---|---|
| DQ-1 | Inspector per-colonist summary exact shape | Implementation freedom under the detachment rule |
| DQ-2 | Whether responder acceptance should commit a responder-side goal (mutual participation) | Human gate on this design; if yes, a follow-up card — not silently this slice |
| DQ-3 | EQ-3 revisit on mid-run colonist arrival | ADR-19's future owner; trigger documented in D4 |

## 13. Decision Log

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| One canonically ordered `colonists` collection replaces the five singular slots AND the roster | One authoritative colonist list; no primary/secondary asymmetry; ordering structural per EQ-2 | Roster kept alongside; primary + secondary split |
| Phase-boundary rule: each phase completes for all colonists before the next begins | Makes "phase inputs" well-defined — the precondition for D3's observation basis | Interleaved per-colonist full ticks (order bias by construction) |
| Single pre-phase-5 observation basis; all deciders' snapshots built from it | Same-tick non-observability by construction, not convention; retires the "resting" placeholder via the existing ambientStateFor registry | Mid-phase snapshot rebuilds (the leak itself) |
| EQ-3: single shared attributed stream, canonical draw order | Zero save/replay change; S1 stays one choke point; determinism comes from ordering, which is already fixed | Per-colonist streams (surface multiplication without in-scope benefit) |
| Phase 6 applies consequences sequentially over live state in canonical order | §5 governs decision reads, not consequence application; matches existing single-colonist semantics | Buffered simultaneous application (unrequested merge policy) |
| ADR-22 planned from the start, scoped to D1/D4/D6 | The trigger surface is certain; Slice 5's review correction becomes this slice's default posture | Discovering the gate in review again |

---

## 14. Kanban Update

**Card:** [Phase 3] Stage 2 Slice 6 — Autonomous Three-Colonist Runtime (EQ-1)
**Status:** Review — design artifact complete, awaiting ChatGPT design review and Human approval per `feature-workflow.md` steps 4–7. No ADR draft and no implementation until both gates pass and ADR-22 is subsequently Accepted (§9).
**Completed:** Produced `design/autonomous-three-colonist-runtime.md` — per-colonist `ColonistRuntime` collection shape (D1), seven-phase realization across the collection with a binding phase-boundary rule (D2), the single-observation-basis snapshot discipline that makes same-tick non-observability structural and retires the roster `"resting"` placeholder (D3), the EQ-3 single-stream decision with its documented revisit trigger (D4), Slice 5 protocol integration with the responder-commitment question explicitly flagged for the Human gate (D5), save v5 / replay / inspector implications (D6), the planned ADR-22 gate scoped to D1/D4/D6 (§9), and implementation staging (§10).
**Changed Files:**
  CREATED  design/autonomous-three-colonist-runtime.md
**Validation:** Grounded against the current implementation (tick.ts's phase realization and validation invariants, run.ts, serialization.ts v4, replay STATE_FIELDS, inspector detachment rule) and cross-checked against engineering-specification v0.3.0 (EQ-1/EQ-2/EQ-3, §5, §8, §12's named migration risk), ADR-20, ADR-21, and the approved Slice 5 design — no accepted decision reopened; the relationship and offer stores need no structural change, as their ADRs anticipated.
**Follow-up Tasks:** ADR-22 drafting after design approval (§9). DQ-2 (responder-side goal commitment) to be decided at the Human gate.

**Not committed** per instruction — this is a design artifact only; no code in `prototype/src` is created or modified by this task.
