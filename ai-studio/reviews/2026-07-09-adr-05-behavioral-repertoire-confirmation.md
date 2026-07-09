# ADR-05 Revisit Confirmation — Seven-State Behavioral Repertoire

**Date:** 2026-07-09
**Type:** Revisit-trigger execution (ADR-05; freeze report §3.3)
**Trigger text:** "The behavioral state repertoire may need expansion when colonist AI behaviors are designed — revisit before AI design begins."
**Reviewed against:** design/colonist-agent-model.md v0.2.0, design/needs-system.md v0.2.0, design/personality-traits.md v0.1.0, design/goal-system.md v0.1.0, design/memory-system.md v0.2.0 (all Approved)

---

## Verdict: CONFIRMED — the seven states are sufficient for the Phase 2 design set

The seven ambient states (Working, Resting, Eating, Socializing, Stressed, Blocked, In Conflict) were checked against every behavioral demand the five approved Phase 2 documents place on Tier 1 visibility. No document required a new ambient state; every one routes its observable expression through the existing repertoire.

## Evidence per document

| Document | Ambient demand | Fits existing repertoire? |
|---|---|---|
| Colonist Agent Model | Current behavioral state defined as "one of the seven per ADR-05"; Boundary 5 forbids the model from extending the output vocabulary | ✅ By construction |
| Needs System | All five needs express through the seven states plus movement/posture textures (P4); Purpose expansion explicitly commits to "no new ambient state"; psychological escalation surfaces as the existing Stressed state | ✅ Explicit |
| Personality Traits | B3: all trait expressions live inside the seven states and their textures; a trait inexpressible within them is defined as an ADR-05 revisit trigger — none arose | ✅ Explicit |
| Goal System | "The Goal System adds no new signals — it is the model behind the signals the player already reads"; Blocked and the deviation vocabulary used as defined | ✅ Explicit |
| Memory System | Memory is invisible in ambient play (AQ-M1 resolution); zero new ambient demand | ✅ By design |

## Scope of this confirmation

This confirms sufficiency of the *state vocabulary* at the design level. It does not confirm — and cannot — that the movement/posture **textures** within states (trait expressions, Purpose erosion, memory drift) are distinguishable at overview zoom with 24 colonists. That is the cumulative ambient-legibility load flagged in the Phase 2 Architecture Integration Review (Risk 4) and remains a prototype validation target, not a state-count question.

## Effect

ADR-05's "revisit before AI design begins" checkpoint is executed and closed. Decision Loop design may proceed against the seven-state repertoire as a fixed output vocabulary. Any future document requiring an eighth state must reopen ADR-05 through the architecture workflow.
