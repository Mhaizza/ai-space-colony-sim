# Prototype Stage 1 — Single Colonist Vertical Slice: Implementation Plan

**Date:** 2026-07-10
**Status:** Approved (implementation plan review 2026-07-10 — approved with two improvements, both applied below: Behavior Trace validation artifact; config split into constants/tuning)
**Authority:** design/engineering-specification.md v0.2.0 (§10 stage 1); design/ai-behavior-specification.md v0.2.0; ADR-17, ADR-18 (Accepted); design/phase-2-architecture-freeze.md v1.0.0; ai-studio/constitution/coding-standards.md
**Scope anchor:** engineering spec §10 stage 1 — one colonist, smallest meaningful end-to-end loop: clock → world → needs/stress → triggers → snapshot → decision → task → execution → consequences → logs. Proves the pipeline, the determinism obligations (§8), and the replay harness (EQ-8) before anything scales.
**Rule:** implementation has not begun; this plan authorizes it upon the standing approval. No architecture, module boundary, or update-order deviation from the engineering specification.

---

## 1. Module Breakdown

Stage 1 implements a subset of the engineering spec's modules — same names, same boundaries. Minimal means *thin*, not *restructured*.

| Spec module | Stage 1 realization | Deliberately excluded at stage 1 |
|---|---|---|
| M1 Clock | In-game time, fixed-step advance, speed scaling (pause/1x/2x/4x) | Stage-3 crisis speed cap (needs S2 crisis staging) |
| M2 World | Minimal station: 3 modules (food station, rest bunk, workstation), food resource stock, module functional/failed flag | Maintenance model, conduits, health gradations (binary functional flag suffices to produce blockage and availability) |
| M3 Policy | One shift policy (work/rest/free durations); real permission check (trivially permissive but present — eligibility stays a true 3-way intersection) | Scopes/cascade (one colonist = colony scope only), pending changes |
| M4 Snapshot | Full contract: fixed per-decision snapshot; the only world→decision read path | Nearby-colonist section is an empty set at 1 colonist (field exists, empty) |
| M5 Colonist State | Full three-layer container with invariants | Relationship handle (M10 is stage 2, blocked on AQ-2) |
| M6 Needs | All five needs; monotone decay; low/critical/satisfaction-point per ADR-17 D3; per-need monotone urgency; Rest amplifier (existing-urgency-only) | Nothing — the need system is the heart of stage 1. **Social is unsatisfiable at 1 colonist by design** (see Risks) |
| M7 Stress | Accumulation (unmet psychological needs, biological strain, overwork), dissipation (rest, satisfied needs, stable conditions), per-source attribution | Hostile-proximity and crisis-exposure sources (need other colonists / crisis system) |
| M8 Traits | One provisional trait (Driven) exercising both surfaces: decay/threshold modifier (M6) and weight tilt (M11); marked non-canonical (DQ-T1) | Discovery states (no player), trait modifiers ("Worn Down" — needs Condition-memory maturity) |
| M9 Memory | Bounded pool; involuntary formation on significance; impact fixed at formation; influence = recency × impact; eviction by lowest influence; Deprivation + Condition types exercised | Relational type (stage 2), Crisis type (no crisis system) |
| M10 Relationships | **Not implemented** — stage 2; formally blocked on AQ-2 (EQ-1) | — |
| M11 Decision | Full: five-source generation (source 5 minimal: idle/rest voluntary only — no social); ADR-01 filter with actionability/fall-through/Blocked; weight composition (base + traits + memory + stress, retained decomposition); seeded selection; deterministic tie-break; motivation recording; goal stack (suspend / blocked-persist / abandon-stale) | Relationship weight family (stage 2) |
| M12 Task & Execution | Classes: Assignment, Satisfaction, Response (minimal), Transit-and-idle; eligibility = skill ∩ permission ∩ requirement; availability from snapshot; execution into ambient states (Working/Resting/Eating/Stressed/Blocked reachable); completion per category; mid-execution failure → re-decision | Social class (stage 2); Socializing / In Conflict unreachable (correct at 1 colonist) |
| S1 PRNG | Save-seeded deterministic PRNG, serializable state, draw-attribution trace in debug | — |
| S2 Records | Event log (append-only) + decision log (significant decisions with full weight decomposition) | Story-event detection, crisis staging (stage 3) |
| S3 Serialization | Full save/load of the stage-relevant §7 subset, including PRNG state | Format stability / migration (explicit non-goal) |

## 2. File Structure

TypeScript, `strict: true`, headless Node (tests run without a browser or game session — coding-standards). Under `prototype/` to keep calibration-instrument code visibly separate from future product `src/`:

```
prototype/
  package.json            (node + typescript + vitest; no other dependencies)
  tsconfig.json           (strict: true)
  src/
    core/
      clock.ts            M1
      prng.ts             S1
      serialization.ts    S3
    world/
      world.ts            M2
      policy.ts           M3
      snapshot.ts         M4
    colonist/
      colonist.ts         M5
      needs.ts            M6
      stress.ts           M7
      traits.ts           M8
      memory.ts           M9
    decision/
      goals.ts            M11: generation + priority filter + stack
      weights.ts          M11: composition (retained decomposition)
      decide.ts           M11: selection + commitment
    tasks/
      tasks.ts            M12: classes, eligibility, availability
      execution.ts        M12: execution, completion, failure
    records/
      logs.ts             S2
    sim/
      tick.ts             the seven-phase update order (engineering spec §5), fixed
      run.ts              headless run harness (N in-game days, scenario setup)
    debug/
      inspector.ts        read-only inspector/debug output (spec §9 debug reads)
      replay.ts           replay harness: run save twice, diff behavioral output (EQ-8)
    config/
      constants.ts        STRUCTURAL constants (see Configuration Split below)
      tuning.ts           PROVISIONAL calibration values (see Configuration Split below)
  main.ts                 CLI entry: run / save / load / replay / inspect
  (tests co-located: needs.test.ts beside needs.ts, etc.)
```

Pure functions in the simulation core; impurity (console, file I/O) confined to `main.ts`, `debug/`, `serialization.ts`.

### Configuration split *(review improvement 2)*

Two config files with a hard classification rule — **the classification test is the source of the value's authority:**

- **`config/constants.ts` — structural constants, capacities, limits.** Values fixed by accepted architecture: anything traceable to a frozen decision, an ADR, or this spec's structure — the closed-list sizes (five needs, seven ambient states, five goal sources, five task classes, six re-decision triggers), threshold *ordering* invariants (critical < low < satisfaction point), category memberships (which needs are biological), engineering capacities/limits that bound resources without shaping behavior. **Changing a value in constants.ts means an architecture document changed first.** Each entry cites its source.
- **`config/tuning.ts` — provisional calibration values: rates, thresholds, weights.** Everything the architecture deferred: decay rates, threshold *positions*, hysteresis band widths, urgency shapes/scales, amplifier magnitude, stress rates, weight magnitudes, memory pool size and decay, goal-stack depth. Every entry annotated `provisional — DQ-xx.x calibration`; none counts against the deferred-question ledger before stage 4 (engineering spec §10). **Changing a value in tuning.ts is free during prototyping.**

A value that fits neither file cleanly is a flag, not a judgment call — raise it before placing it.

## 3. Build Order

Dependency-ordered; each step leaves a testable increment; EQ-2/EQ-3/EQ-6/EQ-8 resolved as their step arrives, documented in code:

1. **Foundations:** `prng.ts` (EQ-3: single stream, draw counter for attribution) + `clock.ts` + config skeletons — tests: PRNG determinism, serialization round-trip.
2. **Colonist statics + needs:** `colonist.ts`, `needs.ts` — decay monotonicity, thresholds, hysteresis, urgency, Rest amplifier. Most test-dense step (each ADR-17 D2–D6 invariant gets a test).
3. **Stress:** `stress.ts` — accumulation/dissipation with per-source attribution.
4. **World + policy + snapshot:** `world.ts`, `policy.ts`, `snapshot.ts` — the perception choke point; snapshots fixed and complete.
5. **Traits + memory:** `traits.ts` (both surfaces), `memory.ts` (formation, influence, eviction).
6. **Decision:** `goals.ts`, `weights.ts`, `decide.ts` — generation, filter, composition (decomposability test: contributions reconstruct the composed weight), selection (EQ-2 tie-break: stable candidate ordering, documented), motivation recording.
7. **Tasks + execution:** `tasks.ts`, `execution.ts` — eligibility intersection, availability, completion, failure → re-decision.
8. **Tick assembly:** `tick.ts` (seven phases, fixed order), `run.ts` — first full end-to-end in-game day.
9. **Records + serialization:** `logs.ts`, `serialization.ts` (EQ-6: JSON save, versioned header, behavior-preserving constraint noted).
10. **Replay harness + inspector:** `replay.ts` (the standing determinism test), `inspector.ts`, `main.ts` CLI — then the validation plan runs.

## 4. Risks

- **Provisional numbers acquire authority.** *Held by:* the config split — tuning values annotated and ledger-excluded until stage 4; constants change only behind document changes.
- **Social is unsatisfiable at 1 colonist** — decays, crosses low, generates tier-4 candidates with no serving task → permanently blocked goal + stress accumulation. Correct behavior, not a bug (psychological escalation + blocked-goal persistence demonstrated); it will dominate long runs. *Held by:* scenario length ends runs before Social stress swamps the log; the effect is a validation asset (must appear traceably in stress attribution).
- **Determinism traps in JS:** object-key/Map iteration order, floating-point accumulation across speed steps. *Held by:* fixed explicit orderings wherever behavior is touched (EQ-2); speed scaling as step-count-invariant in-game deltas; replay harness in CI from step 10; speed-invariance is a named validation check.
- **Scope creep toward stage 2/3.** *Held by:* M10 formally blocked on AQ-2; the success criteria are the exit — anything beyond them is stage 2.
- **Minimal ≠ contract-breaking:** thinning a module could silently drop an invariant. *Held by:* the validation plan tests invariants, not features.

## 5. Validation Plan

**Automated (tests + harness):**
1. **Replay:** same save + seed run twice → bit-identical event log, decision log, final state.
2. **Save/load resume:** save mid-run at a phase boundary, load, continue → identical to the uninterrupted run.
3. **Speed invariance:** same in-game timeline at 1x vs 2x/4x → identical decisions and logs.
4. **Invariant tests** (co-located, per module): monotone decay; no direct need-level writes; psychological needs structurally cannot reach critical; amplifier never creates urgency from zero; hysteresis prevents satisfy/re-trigger oscillation; no weight crosses tiers; modifiers bound-never-veto; composition decomposes exactly; every re-decision traces to one of the six triggers (no clock triggers — audited); memory impact immutable after formation; eviction by lowest influence.

**Manual (inspector output over a multi-day headless run):**
5. **Explanation completeness:** every logged decision answers behavior-spec §5's questions from retained data only.
6. **Behavioral shape:** critical overrides occur *and are exceptional* under the default policy; the day reads as shift baseline + legible deviations; Blocked appears when the food module fails and reads correctly; Stressed appears from Social deprivation with correct attribution.

### Behavior Trace — required validation artifact *(review improvement 1)*

The stage-1 run must produce, and the inspector must render, at least one complete traced behavioral cycle of the following shape. The example below is illustrative of the *required content*, not a prescribed output format:

```
[Day 2, mid work period]  NEED       Hunger crosses LOW threshold
                                     (decay at trait-modified rate; urgency begins, grows with depth)
[+trigger]                TRIGGER    Re-decision trigger 4 (need threshold crossing)
[decision #14]            SNAPSHOT   Fixed. Policy: work period active. Food station: functional,
                                     stocked, reachable. No survival conditions.
                          GENERATE   Candidates: [T3 shift assignment (workstation)],
                                     [T4 satisfy Hunger (food station)]
                          FILTER     Highest actionable tier: T3 (critical NOT crossed —
                                     low-threshold Hunger defers; ADR-01 P4 behavior)
                          SELECT     T3 assignment wins (single candidate in tier)
                          COMMIT     Goal: work assignment; motivation recorded:
                                     "shift active; Hunger low but not critical"
                          LOG        Not significant (routine on-schedule) — event log only
[execution continues]     STATE      Working
[Day 2, work period ends] TRIGGER    Trigger 5 (shift boundary condition; not safety-critical)
[decision #15]            GENERATE   [T4 satisfy Hunger], [T5 idle/rest voluntary]
                          FILTER     Highest actionable tier: T4
                          RESOLVE    Task: Eat @ food station (eligible: skill ✓ permission ✓
                                     requirement ✓; available: functional ✓ stocked ✓ reachable ✓)
                          COMMIT     Goal: satisfy Hunger; motivation: "Hunger low since
                                     mid-shift; deferred per priority order"
                          LOG        Significant (need-driven deviation from baseline follows) —
                                     decision log entry with decomposition:
                                     base: Hunger urgency (depth: moderate)
                                     traits: Driven -slight (leans toward staying on task)
                                     memory: none material
                                     stress: +slight (relief-serving candidate)
[execution]               STATE      Eating (transit → food station, then consumption)
[state changes]           NEED       Hunger restores while conditions hold → reaches
                                     SATISFACTION POINT (above low threshold — hysteresis band)
                          COMPLETE   Need goal completes at satisfaction point (never at the
                                     trigger line; never on a clock value)
                          STRESS     'satisfied needs' relief applies; attribution updated
                          MEMORY     No formation (no significance criterion met — routine
                                     satisfaction is not memorable)
                          WORLD      Food stock decremented
[+trigger]                TRIGGER    Trigger 1 (goal completion) → next decision
```

The trace validates, in one artifact: threshold → urgency → trigger → snapshot → generation → filter → selection → commitment-with-motivation → resolution → execution → ambient state → restoration-with-hysteresis → completion → stress/world consequences → correct memory *non*-formation → next trigger. A second trace variant must show the critical-override path (Hunger reaches CRITICAL during work → tier-2 override → immediate deviation, logged with decomposition) and a third the blocked path (food module failed → goal blocked, persists → fall-through → Blocked state if nothing actionable).

## 6. Prototype Success Criteria

Stage 1 is **done** when all hold — anything beyond them is stage 2:

1. A single colonist runs headless for multiple in-game days through the full pipeline: all seven tick phases, all five needs, decisions with retained decompositions, task execution into ambient states, memory formation and eviction, event + decision logs.
2. Replay, save/load-resume, and speed-invariance checks pass bit-identically (the standing determinism test exists and runs).
3. Every logged decision is fully decomposable from retained data (the §9 retention floor is real).
4. All invariant tests pass — every behavior-spec invariant applicable at 1 colonist covered by at least one test.
5. Inspector/debug output exists, is read-only, and answers the explanation-surface questions for any logged decision.
6. **The three Behavior Traces (routine-deferral, critical-override, blocked) are produced by real runs and rendered by the inspector** *(review improvement 1)*.
7. **Every numeric value lives in exactly one of the two config files under the classification rule: structural constants (source-cited) in `constants.ts`; provisional calibration (DQ-annotated) in `tuning.ts`; no number anywhere else; no calibration value in constants** *(review improvement 2)*.
8. Zero deviations from the engineering spec's module boundaries, ownership table, and update order — or any forced deviation reported, not silently absorbed.

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Implement stage 1 as a thin subset of the spec's modules — same names, same boundaries | Renaming/merging "because it's small" would make stage 2 a refactor instead of an extension; boundaries are cheap to keep from the start | Collapsed mini-architecture for stage 1 (stage 2 pays the split cost; ownership table stops mapping to code) |
| `prototype/` directory, headless, vitest, zero runtime dependencies | Calibration instrument, visibly separate from future product code; tests must run without a game session (coding-standards); dependencies add nondeterminism surface | Building in product `src/` (prototype code acquires product authority); engine/browser host (heavier, slower to validate, no validation benefit at stage 1) |
| One provisional trait (Driven) rather than zero or a set | Zero traits leaves the trait weight family and rate-modifier surfaces untested (a pipeline hole); a set is DQ-T1 authoring work that belongs to later stages | No traits (untested family); multiple traits (premature DQ-T1 content) |
| Social left unsatisfiable; its stress consequence treated as a validation asset | At 1 colonist this is the architecture behaving correctly (psychological escalation, blocked persistence); hiding it (disabling Social) would remove a free invariant demonstration | Disabling Social decay at stage 1 (masks the escalation path; one need becomes special-cased — needs-system P1 violation in spirit) |
| *(Review improvement 1)* Three required Behavior Traces (routine-deferral, critical-override, blocked) as validation artifacts rendered from real runs | A trace proves the pipeline *as a narrative* — thresholds, triggers, filter behavior, hysteresis, logging significance, and consequence fan-out in one inspectable artifact; three variants cover the three structurally distinct paths a need can take | Single happy-path trace (misses override and blockage semantics); synthetic hand-written trace (proves formatting, not behavior) |
| *(Review improvement 2)* Config split: `constants.ts` (structural, source-cited, changes only behind document changes) vs `tuning.ts` (provisional, DQ-annotated, free during prototyping) | The classification rule turns the file boundary into an authority boundary — the guard against provisional numbers acquiring silent authority becomes mechanical; a value that fits neither file is a flag | Single config (structural and provisional values indistinguishable; the plan's own top risk unmitigated); constants scattered in code (unauditable) |

## Kanban Update

**Card:** [Phase 4] Prototype Stage 1 — Single Colonist Vertical Slice (planning)
**Status:** Implementation plan Approved (plan review 2026-07-10 — two improvements applied). **Implementation not begun**, per instruction.

**Completed:**
- ✅ Implementation plan: module breakdown (stage-1 subset of engineering spec M1–M12/S1–S3, boundaries unchanged; M10 excluded, blocked on AQ-2), file structure (TypeScript strict, headless, `prototype/`, co-located tests), 10-step build order (EQ-2/3/6/8 resolved at their steps), risks, validation plan, success criteria
- ✅ Review improvement 1 applied: Behavior Trace added as a required validation artifact — three variants (routine-deferral, critical-override, blocked), with a full illustrative trace of one complete cycle from need evaluation through action and resulting state changes; success criterion 6 added
- ✅ Review improvement 2 applied: configuration split into `config/constants.ts` (structural constants, capacities, limits — source-cited, change requires a document change) and `config/tuning.ts` (provisional calibration — rates, thresholds, weights, DQ-annotated); success criterion 7 updated; risk mitigation strengthened

**Constraints honored:** No architecture changes, no module boundary changes, no build-order changes (the two improvements touched validation and configuration only). No implementation code written.

**Next step (awaiting go signal):** Build step 1 (foundations: PRNG, clock, config skeletons).

**Not committed** per instruction.
