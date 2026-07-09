# ADR-16 Clarification Record — Memory Visibility

**Date:** 2026-07-09
**Type:** Clarification of an accepted ADR — NOT a new ADR, NOT an architectural change
**Clarifies:** ADR-16 (Colonist Memory Architecture), where it states memory is "invisible to the player except through observed colonist behavior"
**Origin:** AQ-M1, raised in design/memory-system.md v0.1.0; resolved by architecture review 2026-07-09; recorded in design/memory-system.md v0.2.0. This record makes the resolution part of the ADR-adjacent record so the ADR set remains the authoritative reference.

---

## Clarification

1. **Memory remains invisible during ambient gameplay.** It is not shown as a normal UI stat — no memory bar, no ambient icon, no always-on panel. In moment-to-moment play, memory reaches the player only through observed colonist behavior, exactly as ADR-16 states.

2. **Memory influence is visible only through explanation surfaces, and only when materially relevant.** Where the player asks *why* — the inspector's decision detail, the decision log (ADR-14), the post-mortem — memory is a possible cause factor and appears in the explanation **only when it materially influenced a significant decision**. Explanation surfaces show causes, never the pool.

3. **This clarifies, it does not decide.** ADR-16's invisibility commitment always coexisted with constitution Principle 6 (every agent decision inspectable with a true, legible answer). This record resolves the apparent tension by scoping each commitment to its surface: ADR-16's invisibility governs ambient play; Principle 6's completeness governs explanation surfaces. No retention model, influence mechanism, pool structure, or boundary of ADR-16 changes.

4. **The memory / event-log separation is untouched.** The event log (ADR-14) records what happened — permanent, world-owned. Memory records what still influences the colonist — bounded, fading, colonist-owned. An explanation naming a memory reports a live influence; when that memory fades or is evicted, it stops appearing in new explanations while the event log's record remains.

## Consequential note for ADR-14 readers

ADR-14's log-entry "Why" line ("cause state at decision time — needs, stress, relationship states, active trait") is to be read as including **memory** as a cause-factor category under the materiality condition above. The materiality threshold itself is deferred to the Decision Loop design (design/memory-system.md DQ-M3).

## Status

Clarification recorded. ADR-16 and ADR-14 remain Accepted, unmodified.
