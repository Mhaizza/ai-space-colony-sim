# Stage 1 Vertical Slice: Implementation A ("prototype") vs. B (PR #107)

## 1. Architecture compliance

Both preserve the spec's module names/boundaries — no merging of conceptually separate modules. But A's own plan promised `core/serialization.ts` (S3), `records/logs.ts` (S2), `debug/inspector.ts`, `debug/replay.ts`, and `main.ts`, and **none exist**. S2 is folded into `simulation/tick.ts`'s `TickEvent` union (`tick.ts:90-106`) instead of its own module — an unreported deviation from success criterion 8.

B keeps S2 as a real, separate module: `services/events.ts` (`EventLogEntry`/`DecisionLogEntry`/`WeightDecomposition`), wired through `sim/loop.ts`. B also has no S3 module and no CLI — same gap as A. B conflates tick-assembly with session bootstrapping in one file (`sim/loop.ts`); A keeps `tick.ts` (phases) and `run.ts` (harness) separate, matching the plan's file list better there.

Net: A shortcut S2 into tick events and skipped S3/CLI; B did S2 properly but skipped S3/CLI too and merges tick-assembly with session harness.

## 2. Module coverage

| Module | A | B |
|---|---|---|
| M8 Traits | 1 (`driven`), deliberate per plan | 4 (`driven`,`resilient`,`social`,`wary`), one per category (`sim/traits.ts:26-63`) |
| M9 Memory types | 2 wired (deprivation, condition) | 4 defined (`types.ts:75`) but **not reachable in a real run** — see §5 |
| Rest amplifier | Yes, `colonist/needs.ts:150-161` | Yes, `sim/needs.ts:67-76` |
| Stress attribution | Yes, `colonist/stress.ts` | Yes, `sim/stress.ts` + `events.ts:60-65` |
| S2 Records | Folded into `TickEvent` | Dedicated module, typed decomposition |
| S3 Serialization | PRNG-only (`core/prng.ts:34-41`) | None |
| M12 Task tests | `task/tasks.test.ts` + `task/execution.test.ts` | **no `task.test.ts`**; only indirect coverage |

B declares more breadth (4 traits, 4 memory types); A wires less but connects all of it end-to-end.

## 3. Determinism & replay

Both pass seeds explicitly through a counted PRNG and have bit-identical replay tests: A (`run.test.ts:393-406`, `:408+`), B (`replay.test.ts:20-31`, `toBe` on raw PRNG state). B adds one thing A lacks: a "different seed must diverge" sanity check (`replay.test.ts:33-41`) proving the PRNG is actually load-bearing. Neither implements save/load-resume replay (plan item 2, unmet by both).

## 4. Test coverage

291 (A) vs 78 (B) `it()` blocks, confirmed by direct count. Not just volume:
- A's `needs.test.ts`: 26 tests targeting ADR-17 D2-D6-style invariants (monotone decay, hysteresis, non-self-referential amplifier). B's: 13.
- A unit-tests eligibility/availability/execution directly (`task/execution.test.ts`, `task/tasks.test.ts`). **B has zero unit tests for `task.ts`** (5 classes, 7 states) — covered only incidentally via `loop.test.ts` (5 tests) and `replay.test.ts`.
- A has a live-run wiring test proving memory actually forms during a real run (`run.test.ts:83-96`) and a purity test (`:98-105`). B's `memory.test.ts` (10 tests) is solid in isolation but has no equivalent live-run proof — because there's nothing to prove (§5).

A is thinner only on the diverging-seed check; B is thin on module tests for its most complex system (task/execution) and has no proof memory formation ever fires.

## 5. Missing functionality

- **A (known, not re-verified):** `task/execution.ts`'s `eatAtFoodStation` restores hunger at the nominal per-tick rate uncapped by food actually consumed when stock runs out mid-tick.
- **B, same bug class, more severe:** `sim/task.ts:41-45` `startTask` calls `consumeResource(world, task.moduleId, 10)` and **discards the boolean return value**. `consumeResource` (`world.ts:63-68`) returns `false` and consumes nothing if stock < 10, but the eat task still starts and `satisfyingConditionsFor` (`task.ts:53-58`) unconditionally reports `hunger: true` for its full duration regardless. The decision-time eligibility check only requires `hasResource(world, m.id, 1)` (`snapshot.ts:38`) against a 10-unit consumption — so the task is selectable, silently no-ops the resource cost, and still fully restores hunger. This is a permanent decoupling, not a mid-tick rounding edge case, and the failure signal is thrown away entirely.
- **B: M9 Memory is not wired into the simulation at all.** `formMemory` (`memory.ts:40`) is called only from `.test.ts` files — never from `sim/loop.ts` or `sim/task.ts`. `decision.ts` reads memory (`memoryWeightTilt`/`materialMemories`, lines 10, 155, 225), but nothing ever writes to the pool during a real `step()`, so memory's decision contribution is always zero in any actual run. The PR's "M9 Memory (4 types)" claim describes isolated-tested code, not working pipeline behavior — a materially bigger gap than anything in A.
- **Both:** no S3 save/load-resume, no `main.ts`, no `debug/inspector.ts`.

## 6. Duplicated work

Near-complete overlap: clock, PRNG, needs, stress, world/policy/snapshot, decision (generation/filter/composition/tie-break), task/execution, replay determinism — all independently solved twice at comparable design fidelity, citing the same ADRs. Genuine scope differences are narrow: B added 3 extra traits and 2 extra memory-type definitions (by A's plan, deliberately excluded); B built a cleaner S2 module; A built a working task/execution test suite and an actually-wired memory pipeline.

## 7. Integration risk

**Keep A, drop B:** low risk. A's layout already matches stage-2 growth points (M10 into `colonist/`, relationship family into `decision/weights.ts`). Debt is self-inflicted: fold S2/S3/CLI out of `tick.ts` into real modules.

**Keep B, drop A:** higher risk. `task.ts` has no unit tests, so stage-2 changes (second colonist, Social task class) have no safety net below the integration level. Memory needs an actual wiring pass into `loop.ts` before stage 2 relational memories can build on a foundation never proven to fire.

**Merge risk:** naming aligns well (`ComposedWeight` fields `base/traits/memory/stress/relationships` match A's `weights.ts` shape almost exactly), so grafting is cheap. B has no `constants.ts`/`tuning.ts` authority split (one `calibration.ts` instead) — porting any B constant means re-classifying it against A's split.

## Recommendation

**Supersede PR #107 with Implementation A**, cherry-picking two concrete pieces from B:

1. **`services/events.ts`'s S2 module shape** — extract `EventLogEntry`/`DecisionLogEntry`/`WeightDecomposition` into a real `records/logs.ts` in A, closing A's own unreported module-boundary gap.
2. **The diverging-seed replay check** from `replay.test.ts:33-41` — add to A's `run.test.ts` replay-determinism suite; a one-test gap.

Do not port B's trait set, memory-type breadth, or `task.ts`: the extra breadth isn't exercised in a live run (memory formation is dead code in B's `loop.ts`), and B's task.ts has a more severe, untested version of the same food-consumption bug A has open. A's 291-vs-78 test gap isn't just effort — A's tests chase the spec's actual invariants and prove live wiring; B's higher module count conceals functionality that's defined but never connected. Keep building on A; fix `eatAtFoodStation`, and add a regression test for B's discarded-return-value pattern as a cheap cross-check once that fix lands.
