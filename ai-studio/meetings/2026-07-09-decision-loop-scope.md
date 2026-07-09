# Decision Loop Scope Definition

**Date:** 2026-07-09
**Type:** Card-scoping decision record for `[Phase 2] Design Decision Loop` (design/decision-loop.md)
**Basis:** Phase 2 Architecture Integration Review (READY WITH MINOR FIXES — Fixes 4, 5, 6 are discharged by this scope); all five approved Phase 2 design documents; ADR-01–ADR-16

---

## What the Decision Loop IS

The conceptual design of how a colonist gets from *state* to *behavior*: how candidate goals are generated from the five sources, how one is adopted within a priority tier, how an adopted goal resolves to a task, and how re-decision works under interruption and blockage. It is the layer every approved Phase 2 document has been deferring to — their DQ lists are its work queue.

## Sequencing decision (discharges Integration Review Fix 3)

design/decision-loop.md proceeds as a **conceptual document**, consistent with the entire Phase 2 design set. ADR-17 (Need System Architecture) and ADR-18 (Social Action Space) **gate its finalization and all downstream AI behavior specification** — not its start. Concretely: the Decision Loop may define selection *structure* (what is weighed, in what order, with what constraints) but no numeric content (ADR-17 gate) and no social action vocabulary (ADR-18 gate). The freeze report's "ADR-17/18 required before Phase 2 AI behavior design" is honored by this gating: the behavior *specification* that follows the conceptual Decision Loop cannot begin until both ADRs are accepted.

## Ownership explicitly assigned to the Decision Loop

**1. Task resolution** *(discharges Fix 4; absorbs goal-system DQ-G3)*
The Decision Loop owns goal→task resolution AND the conceptual task vocabulary: what kinds of tasks exist, how a goal finds candidate tasks, the availability model (location, occupancy, module state), and eligibility as the intersection of colonist skill × policy permission × task requirement (per the accepted AQ-1 resolution in colonist-agent-model.md). Social tasks remain vocabulary-gated by ADR-18.

**2. Stress dynamics** *(discharges Fix 5)*
The Decision Loop owns the conceptual rules of stress: what accumulates it (unmet psychological needs per needs-system B4, biological strain, hostile-relationship exposure, crisis exposure, memory-amplified conditions), what dissipates it, and where its behavioral thresholds sit relative to the Stressed state (ADR-05) and story events (ADR-08). Constraint attached: every stress movement must be traceable to its sources in the inspector (needs-system Risk 1 mitigation carries over).

**3. Weight composition — Needs × Traits × Relationships × Memory** *(discharges Fix 6; expands personality-traits DQ-T6)*
The Decision Loop owns the single composition question: how the four weight-modifying systems combine on one decision. This subsumes trait×trait interaction (DQ-T6), memory's influence weighting (ADR-16), relationship behavioral influence (ADR-12), and need urgency. Constraints attached: composition operates *within* ADR-01 tiers only, never across them; the composed result must be decomposable in explanation surfaces (Principle 6 — the DQ-T6 traceability constraint governs the whole); any stochastic element uses a seeded PRNG (Principle 7).

**Also in scope (the standing work queue from the approved documents):**
- World state snapshot content (colonist-agent-model DQ-2)
- Within-tier selection mechanism (goal-system DQ-G1)
- Interruption, blockage, and re-decision rules (goal-system DQ-G4)
- Goal stack depth and queue management (goal-system DQ-G2; prototype-validated)
- Completion criteria granularity (goal-system DQ-G5; need-goal parameters ADR-17-gated)
- Memory content granularity — what influence can key on (memory-system DQ-M2)
- Materiality threshold for memory attribution in explanations (memory-system DQ-M3)

## What the Decision Loop must NOT define

- **No numeric content** — need rates, thresholds, satisfaction values, stress rates, weight magnitudes, pool sizes (ADR-17 and prototype scope)
- **No social action vocabulary** — what social interactions exist, initiation, proximity (ADR-18 scope)
- **No canonical trait list or per-trait expressions** (AI behavior specification / prototype; personality-traits DQ-T1)
- **No implementation** — no algorithms as code, no utility-function definitions, no GOAP/behavior-tree/state-machine formalisms, no data structures, no storage, no TypeScript
- **No relationship storage decision** — AQ-2 (colonist-owned vs. centralized records) is an engineering-facing architecture question resolved before implementation, not by this document
- **No UI presentation** — explanation-surface *content* obligations are in scope; their visual design is not
- **No reopening of accepted ADRs** — in particular: no cross-tier priority weighing (ADR-01), no clock-triggered decisions (ADR-02), no eighth ambient state (ADR-05, per the 2026-07-09 confirmation record), no player command channel of any kind (ADR-07 / Pillar 2)
- **No new goal sources, trait categories, or memory types** — the three closed lists in the approved documents are the architecture guards; extending any of them is an explicit architecture decision, not Decision Loop content

## Exit criteria for the Decision Loop card

The document is complete when every item in the standing work queue above is either resolved conceptually or explicitly re-deferred with an owner — and no NOT-list item has been touched.
